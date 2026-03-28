/**
 * Main entry point for @playwright-ordertest/core.
 *
 * `defineOrderedConfig()` is the primary API consumers use. It wraps
 * Playwright's own config object, extracts the `orderedTests` plugin section,
 * validates it, generates the correct projects array (using strategies,
 * shard guard, etc.), and returns a plain Playwright config ready for
 * `defineConfig()`.
 *
 * The function is intentionally **synchronous** for the common case (inline
 * sequences) and **asynchronous** only when a manifest file must be loaded.
 *
 * Key design rules:
 * - Deterministic and idempotent: same input always produces same output.
 * - No side effects beyond logging.
 * - Passthrough when no orderedTests config is present.
 */

import {
  type GeneratedProject,
  collectOrderedFiles,
  generateProjects,
  generateUnorderedProject,
} from '../engine/projectGenerator.js';
import { OrderTestConfigError } from '../errors/errors.js';
import { type Logger, createLogger, createSilentLogger, debugConsole } from '../logger/logger.js';
import { loadManifest } from './manifestLoader.js';
import { applyShardGuard, detectShardConfig, resolveShardStrategy } from './shardGuard.js';
import type { OrderedTestManifest, OrderedTestPluginConfig, SequenceDefinition } from './types.js';
import { UNORDERED_PROJECT_NAME } from './types.js';
import { validateConfig } from './validator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A Playwright config object augmented with the optional `orderedTests` section.
 *
 * We keep this deliberately loose (`Record<string, unknown>`) to avoid coupling
 * to a specific Playwright version's config type.
 */
export interface PlaywrightConfigWithOrderedTests {
  /** Plugin-specific configuration for ordered test execution. */
  readonly orderedTests?: OrderedTestPluginConfig;

  /** Playwright's native project array (we merge into this). */
  readonly projects?: readonly Record<string, unknown>[];

  /** Playwright's shard config. */
  readonly shard?: { current: number; total: number };

  /** Any other Playwright config fields. */
  readonly [key: string]: unknown;
}

/** The result of config transformation — a plain Playwright config. */
export interface TransformedConfig {
  readonly projects?: readonly Record<string, unknown>[];
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a {@link GeneratedProject} into a plain Playwright project config
 * object. Strips the internal `metadata` field (Playwright doesn't understand it)
 * and maps fields to the format Playwright expects.
 *
 * @param project - The generated project to convert
 * @param testDir - The Playwright testDir (for resolving paths)
 * @returns A plain Playwright-compatible project config
 */
function toPlaywrightProject(project: GeneratedProject, testDir?: string): Record<string, unknown> {
  const pwProject: Record<string, unknown> = {
    name: project.name,
    testMatch: project.testMatch,
  };

  if (project.dependencies !== undefined && project.dependencies.length > 0) {
    pwProject.dependencies = [...project.dependencies];
  }

  if (project.workers !== undefined) {
    pwProject.workers = project.workers;
  }

  if (project.fullyParallel !== undefined) {
    pwProject.fullyParallel = project.fullyParallel;
  }

  if (project.grep !== undefined) {
    pwProject.grep = project.grep;
  }

  if (project.retries !== undefined) {
    pwProject.retries = project.retries;
  }

  if (project.timeout !== undefined) {
    pwProject.timeout = project.timeout;
  }

  // Store metadata so reporters can read it.
  // We set the native `metadata` field (available in Playwright >=1.45) so that
  // reporters receive it in FullConfig.projects[n].metadata.
  // We also keep `_ordertestMetadata` for backward compat and to avoid conflicts
  // with user-set metadata (the underscore-prefixed version is always ours).
  if (project.metadata !== undefined) {
    pwProject.metadata = { ...project.metadata };
    pwProject._ordertestMetadata = { ...project.metadata };
  }

  if (testDir !== undefined) {
    pwProject.testDir = testDir;
  }

  return pwProject;
}

/**
 * Build the unordered passthrough Playwright project.
 *
 * This project picks up all test files NOT claimed by any ordered sequence.
 * It uses `testIgnore` to skip ordered files.
 *
 * @param sequences - All ordered sequences (to compute the ignore list)
 * @param testDir - The base testDir from the user's config
 * @param userProjects - The user's original projects (to preserve their config)
 * @param logger - Optional logger
 * @returns A Playwright project config, or undefined if there are no files to run
 */
function buildUnorderedProject(
  sequences: readonly SequenceDefinition[],
  testDir?: string,
  logger?: Logger,
): Record<string, unknown> {
  const unorderedGenerated = generateUnorderedProject(sequences, logger);
  const orderedFiles = collectOrderedFiles(sequences);

  const project: Record<string, unknown> = {
    name: unorderedGenerated.name,
    testMatch: unorderedGenerated.testMatch,
  };

  if (orderedFiles.length > 0) {
    project.testIgnore = orderedFiles;
  }

  if (testDir !== undefined) {
    project.testDir = testDir;
  }

  debugConsole(
    `buildUnorderedProject: name="${UNORDERED_PROJECT_NAME}" testIgnore=${orderedFiles.length} file(s)`,
  );

  return project;
}

// ---------------------------------------------------------------------------
// Main Entry Point — Synchronous (inline config)
// ---------------------------------------------------------------------------

/**
 * Transform a Playwright config with ordered test configuration into a plain
 * Playwright config with the correct projects array.
 *
 * This is the **main public API** of the plugin. Users call it in their
 * `playwright.config.ts`:
 *
 * ```typescript
 * import { defineOrderedConfig } from '@playwright-ordertest/core';
 *
 * export default defineOrderedConfig({
 *   orderedTests: {
 *     sequences: [
 *       { name: 'checkout', mode: 'serial', files: ['auth.spec.ts', 'cart.spec.ts'] },
 *     ],
 *   },
 *   // ...other Playwright config
 * });
 * ```
 *
 * When `orderedTests.manifest` is specified or auto-discovery finds a manifest
 * file, use {@link defineOrderedConfigAsync} instead (manifest loading is async).
 *
 * @param config - A Playwright config with an optional `orderedTests` section
 * @returns A transformed Playwright config ready for `defineConfig()`
 * @throws {OrderTestConfigError} If the config is invalid or inconsistent
 * @throws {OrderTestShardError} If shard strategy is 'fail' and sharding is detected
 */
export function defineOrderedConfig(config: PlaywrightConfigWithOrderedTests): TransformedConfig {
  const startTime = performance.now();

  debugConsole('defineOrderedConfig: entry (synchronous)');

  // -------------------------------------------------------------------------
  // Step 1: Extract and validate the orderedTests section
  // -------------------------------------------------------------------------

  const { orderedTests, projects: userProjects, shard: configShard, ...restConfig } = config;

  // Passthrough: no orderedTests config at all
  if (orderedTests === undefined) {
    debugConsole('defineOrderedConfig: no orderedTests config — passthrough');
    return config as TransformedConfig;
  }

  // Initialize logger from plugin config
  const logger = initLogger(orderedTests);

  debugConsole('defineOrderedConfig: validating plugin config...');
  logger.info('defineOrderedConfig: start');

  const validatedConfig = validateConfig(orderedTests, logger);

  // -------------------------------------------------------------------------
  // Step 2: Resolve sequences
  // -------------------------------------------------------------------------

  const sequences = validatedConfig.sequences;

  if (sequences === undefined || sequences.length === 0) {
    // No sequences: check if manifest is specified
    if (validatedConfig.manifest !== undefined) {
      throw new OrderTestConfigError(
        'orderedTests.manifest is specified but defineOrderedConfig() is synchronous. Use defineOrderedConfigAsync() to load manifest files, or provide inline sequences.',
        { manifest: validatedConfig.manifest },
      );
    }

    debugConsole('defineOrderedConfig: no sequences defined — passthrough');
    logger.info('No sequences defined — passing config through unchanged');
    return { ...restConfig, projects: userProjects } as TransformedConfig;
  }

  debugConsole(`defineOrderedConfig: ${sequences.length} sequence(s) to process`);
  logger.info({ sequenceCount: sequences.length }, 'Processing ordered sequences');

  // -------------------------------------------------------------------------
  // Step 3: Generate projects from sequences
  // -------------------------------------------------------------------------

  const result = transformConfig(sequences, validatedConfig, configShard, userProjects, logger);

  const duration = Math.round(performance.now() - startTime);
  debugConsole(`defineOrderedConfig: complete (${duration}ms)`);
  logger.info(
    { duration, projectCount: result.generatedProjects.length },
    'Config transformation complete',
  );

  return { ...restConfig, projects: result.projects } as TransformedConfig;
}

// ---------------------------------------------------------------------------
// Main Entry Point — Asynchronous (manifest loading)
// ---------------------------------------------------------------------------

/**
 * Async version of {@link defineOrderedConfig} that supports loading external
 * manifest files.
 *
 * Use this when your ordered test sequences are defined in an external
 * `ordertest.config.json`, `.yaml`, or `.ts` file.
 *
 * ```typescript
 * import { defineOrderedConfigAsync } from '@playwright-ordertest/core';
 *
 * export default defineOrderedConfigAsync({
 *   orderedTests: {
 *     manifest: './ordertest.config.json',
 *   },
 *   // ...other Playwright config
 * });
 * ```
 *
 * @param config - A Playwright config with an optional `orderedTests` section
 * @returns A Promise resolving to a transformed Playwright config
 */
export async function defineOrderedConfigAsync(
  config: PlaywrightConfigWithOrderedTests,
): Promise<TransformedConfig> {
  const startTime = performance.now();

  debugConsole('defineOrderedConfigAsync: entry');

  // -------------------------------------------------------------------------
  // Step 1: Extract and validate
  // -------------------------------------------------------------------------

  const { orderedTests, projects: userProjects, shard: configShard, ...restConfig } = config;

  if (orderedTests === undefined) {
    debugConsole('defineOrderedConfigAsync: no orderedTests config — passthrough');
    return config as TransformedConfig;
  }

  const logger = initLogger(orderedTests);

  debugConsole('defineOrderedConfigAsync: validating plugin config...');
  logger.info('defineOrderedConfigAsync: start');

  const validatedConfig = validateConfig(orderedTests, logger);

  // -------------------------------------------------------------------------
  // Step 2: Resolve sequences (inline takes precedence over manifest)
  // -------------------------------------------------------------------------

  let sequences: readonly SequenceDefinition[] | undefined = validatedConfig.sequences;

  if (sequences !== undefined && sequences.length > 0 && validatedConfig.manifest !== undefined) {
    // Inline sequences take precedence — warn about the manifest being ignored
    debugConsole(
      'defineOrderedConfigAsync: both inline sequences and manifest specified; inline takes precedence',
    );
    logger.warn(
      { manifest: validatedConfig.manifest, inlineSequenceCount: sequences.length },
      'Both inline sequences and manifest specified; inline takes precedence (manifest ignored)',
    );
  } else if (sequences === undefined || sequences.length === 0) {
    // Try loading from manifest
    const manifest = await resolveManifest(validatedConfig, logger);
    if (manifest !== undefined) {
      sequences = manifest.sequences;
      debugConsole(
        `defineOrderedConfigAsync: loaded ${sequences.length} sequence(s) from manifest`,
      );
      logger.info({ sequenceCount: sequences.length }, 'Loaded sequences from manifest');
    }
  }

  if (sequences === undefined || sequences.length === 0) {
    debugConsole('defineOrderedConfigAsync: no sequences found — passthrough');
    logger.info('No sequences found (inline or manifest) — passing config through unchanged');
    return { ...restConfig, projects: userProjects } as TransformedConfig;
  }

  debugConsole(`defineOrderedConfigAsync: ${sequences.length} sequence(s) to process`);

  // -------------------------------------------------------------------------
  // Step 3: Generate projects
  // -------------------------------------------------------------------------

  const result = transformConfig(sequences, validatedConfig, configShard, userProjects, logger);

  const duration = Math.round(performance.now() - startTime);
  debugConsole(`defineOrderedConfigAsync: complete (${duration}ms)`);
  logger.info(
    { duration, projectCount: result.generatedProjects.length },
    'Async config transformation complete',
  );

  return { ...restConfig, projects: result.projects } as TransformedConfig;
}

// ---------------------------------------------------------------------------
// Shared Internals
// ---------------------------------------------------------------------------

/** Result of the shared config transformation logic. */
interface TransformResult {
  readonly projects: readonly Record<string, unknown>[];
  readonly generatedProjects: readonly GeneratedProject[];
}

/**
 * Initialize the logger from plugin config.
 * Uses a silent logger if logLevel is 'silent'.
 *
 * @param pluginConfig - The plugin config (may have partial logging fields)
 * @returns A configured Logger instance
 */
function initLogger(pluginConfig: OrderedTestPluginConfig): Logger {
  if (pluginConfig.logLevel === 'silent') {
    return createSilentLogger();
  }

  return createLogger({
    logLevel: pluginConfig.logLevel,
    logDir: pluginConfig.logDir,
    logStdout: pluginConfig.logStdout,
    maxSize: pluginConfig.logRotation?.maxSize,
    maxFiles: pluginConfig.logRotation?.maxFiles,
    debug: pluginConfig.debug,
  });
}

/**
 * Try to load a manifest file, either from an explicit path or via auto-discovery.
 *
 * @param validatedConfig - The validated plugin config
 * @param logger - Logger for debug output
 * @returns The loaded manifest, or undefined if none was found
 */
async function resolveManifest(
  validatedConfig: OrderedTestPluginConfig,
  logger: Logger,
): Promise<OrderedTestManifest | undefined> {
  try {
    const manifest = await loadManifest({
      manifestPath: validatedConfig.manifest,
      logger,
    });
    return manifest;
  } catch (error) {
    // If no explicit path was given and auto-discovery finds nothing, that's OK
    if (validatedConfig.manifest === undefined) {
      debugConsole(
        'defineOrderedConfig: no manifest found during auto-discovery — continuing without',
      );
      logger.debug('No manifest found during auto-discovery — continuing without');
      return undefined;
    }
    // If an explicit path was given and it failed, that's an error
    throw error;
  }
}

/**
 * Core transformation logic shared between sync and async entry points.
 *
 * 1. Generates projects from sequences via strategy routing.
 * 2. Applies shard guard if sharding is detected.
 * 3. Builds the unordered passthrough project.
 * 4. Merges with user-defined projects.
 *
 * @param sequences - The resolved sequence definitions
 * @param validatedConfig - The validated plugin config
 * @param configShard - The Playwright shard config (if any)
 * @param userProjects - The user's original projects array
 * @param logger - Logger instance
 * @returns The assembled project list and generated projects
 */
function transformConfig(
  sequences: readonly SequenceDefinition[],
  validatedConfig: OrderedTestPluginConfig,
  configShard: { current: number; total: number } | undefined,
  userProjects: readonly Record<string, unknown>[] | undefined,
  logger: Logger,
): TransformResult {
  // -----------------------------------------------------------------------
  // Step A: Generate projects from sequences
  // -----------------------------------------------------------------------

  debugConsole('transformConfig: generating projects from sequences...');
  let generatedProjects = generateProjects(sequences, logger);

  debugConsole(`transformConfig: generated ${generatedProjects.length} ordered project(s)`);
  logger.info(
    { orderedProjectCount: generatedProjects.length },
    'Generated ordered projects from sequences',
  );

  // -----------------------------------------------------------------------
  // Step B: Apply shard guard
  // -----------------------------------------------------------------------

  const shardInfo = detectShardConfig(configShard);

  if (shardInfo !== undefined) {
    const strategy = resolveShardStrategy(validatedConfig.shardStrategy);

    debugConsole(
      `transformConfig: shard detected (${shardInfo.current}/${shardInfo.total} via ${shardInfo.source}), strategy=${strategy}`,
    );
    logger.info({ shardInfo, strategy }, 'Shard detected — applying shard guard');

    generatedProjects = applyShardGuard({
      projects: generatedProjects,
      shardInfo,
      strategy,
      logger,
    });

    debugConsole(`transformConfig: after shard guard — ${generatedProjects.length} project(s)`);
  } else {
    debugConsole('transformConfig: no sharding detected');
  }

  // -----------------------------------------------------------------------
  // Step C: Build Playwright project configs
  // -----------------------------------------------------------------------

  const testDir = (userProjects?.[0] as Record<string, unknown> | undefined)?.testDir as
    | string
    | undefined;

  // Convert generated projects to Playwright-compatible format
  const orderedPlaywrightProjects = generatedProjects.map((p) => toPlaywrightProject(p, testDir));

  // Build the unordered passthrough project
  const unorderedProject = buildUnorderedProject(sequences, testDir, logger);

  // -----------------------------------------------------------------------
  // Step D: Merge with user projects
  // -----------------------------------------------------------------------

  // User projects that are NOT the special "ordertest:" projects are preserved
  const preservedUserProjects: Record<string, unknown>[] = [];
  if (userProjects !== undefined) {
    for (const up of userProjects) {
      const name = up.name as string | undefined;
      if (name?.startsWith('ordertest:')) {
        debugConsole(`transformConfig: skipping user project "${name}" (ordertest: prefix)`);
        continue;
      }
      preservedUserProjects.push({ ...up });
    }
  }

  // Final assembly: ordered projects + unordered project + preserved user projects
  const finalProjects = [...orderedPlaywrightProjects, unorderedProject, ...preservedUserProjects];

  debugConsole(
    `transformConfig: final projects — ${orderedPlaywrightProjects.length} ordered + 1 unordered + ${preservedUserProjects.length} user = ${finalProjects.length} total`,
  );
  logger.info(
    {
      orderedCount: orderedPlaywrightProjects.length,
      unorderedCount: 1,
      userCount: preservedUserProjects.length,
      totalCount: finalProjects.length,
    },
    'Final project list assembled',
  );

  return {
    projects: finalProjects,
    generatedProjects,
  };
}
