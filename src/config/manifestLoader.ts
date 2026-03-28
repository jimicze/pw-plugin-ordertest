/**
 * External manifest file loader for @jimicze-pw/ordertest-core.
 *
 * Supports JSON, YAML, and TypeScript manifest formats. When no explicit path is
 * provided, auto-discovers the manifest by searching the project root in a
 * fixed priority order.
 *
 * Supported file names (auto-discovery order):
 *   1. ordertest.config.ts
 *   2. ordertest.config.json
 *   3. ordertest.config.yaml
 *   4. ordertest.config.yml
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import yaml from 'yaml';

import type { OrderedTestManifest } from '../config/types.js';
import { OrderTestManifestError } from '../errors/errors.js';
import { debugConsole } from '../logger/logger.js';
import type { Logger } from '../logger/logger.js';
import { validateManifest } from './validator.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Candidate manifest file names, in auto-discovery priority order. */
const MANIFEST_CANDIDATES: readonly string[] = [
  'ordertest.config.ts',
  'ordertest.config.json',
  'ordertest.config.yaml',
  'ordertest.config.yml',
];

// ---------------------------------------------------------------------------
// Public Options Interface
// ---------------------------------------------------------------------------

/** Options for {@link loadManifest}. */
export interface LoadManifestOptions {
  /** Explicit path to the manifest file. Takes priority over auto-discovery. */
  readonly manifestPath?: string;

  /** Project root directory used for auto-discovery. Defaults to `process.cwd()`. */
  readonly rootDir?: string;

  /** Logger instance for structured debug output. */
  readonly logger?: Logger;
}

// ---------------------------------------------------------------------------
// Format Detection
// ---------------------------------------------------------------------------

/** Supported manifest file formats. */
type ManifestFormat = 'json' | 'yaml' | 'ts';

/**
 * Detect the manifest format from a file path's extension.
 *
 * @param filePath - Path to the manifest file
 * @returns The detected format
 * @throws OrderTestManifestError if the extension is not recognised
 */
function detectFormat(filePath: string): ManifestFormat {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.json':
      return 'json';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.ts':
      return 'ts';
    default:
      throw new OrderTestManifestError(
        `Unsupported manifest file extension "${ext}". Supported extensions are: .json, .yaml, .yml, .ts.`,
        { filePath, ext },
      );
  }
}

// ---------------------------------------------------------------------------
// File Loading Helpers
// ---------------------------------------------------------------------------

/**
 * Load and parse a JSON manifest file.
 *
 * @param filePath - Absolute path to the JSON file
 * @returns Parsed JSON content as unknown
 * @throws OrderTestManifestError on read or parse failure
 */
async function loadJsonManifest(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new OrderTestManifestError(
      `Failed to read manifest file "${filePath}": ${String(error instanceof Error ? error.message : error)}`,
      { filePath, format: 'json', cause: error },
    );
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new OrderTestManifestError(
      `Failed to parse JSON manifest "${filePath}": ${String(error instanceof Error ? error.message : error)}`,
      { filePath, format: 'json', cause: error },
    );
  }
}

/**
 * Load and parse a YAML manifest file.
 *
 * @param filePath - Absolute path to the YAML file
 * @returns Parsed YAML content as unknown
 * @throws OrderTestManifestError on read or parse failure
 */
async function loadYamlManifest(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new OrderTestManifestError(
      `Failed to read manifest file "${filePath}": ${String(error instanceof Error ? error.message : error)}`,
      { filePath, format: 'yaml', cause: error },
    );
  }

  try {
    return yaml.parse(raw) as unknown;
  } catch (error) {
    throw new OrderTestManifestError(
      `Failed to parse YAML manifest "${filePath}": ${String(error instanceof Error ? error.message : error)}`,
      { filePath, format: 'yaml', cause: error },
    );
  }
}

/**
 * Load a TypeScript manifest file via dynamic `import()`.
 * The file must export the manifest object as its default export.
 *
 * @param filePath - Absolute path to the TypeScript file
 * @returns The default export value as unknown
 * @throws OrderTestManifestError on import failure or missing default export
 */
async function loadTsManifest(filePath: string): Promise<unknown> {
  const absolutePath = path.resolve(filePath);
  const fileUrl = pathToFileURL(absolutePath).href;

  let mod: { default?: unknown };
  try {
    mod = (await import(fileUrl)) as { default?: unknown };
  } catch (error) {
    throw new OrderTestManifestError(
      `Failed to import TypeScript manifest "${filePath}": ${String(error instanceof Error ? error.message : error)}. Ensure the file is compiled or that ts-node / tsx is available in your environment.`,
      { filePath, format: 'ts', cause: error },
    );
  }

  if (mod.default === undefined) {
    throw new OrderTestManifestError(
      `TypeScript manifest "${filePath}" does not have a default export. Export the manifest object as the default export: \`export default { sequences: [...] };\``,
      { filePath, format: 'ts' },
    );
  }

  return mod.default;
}

// ---------------------------------------------------------------------------
// Auto-Discovery
// ---------------------------------------------------------------------------

/**
 * Search for a manifest file in the project root using the fixed auto-discovery order.
 * Returns the absolute path of the first candidate that exists on disk, or `undefined`
 * if none are found.
 *
 * Discovery order:
 *   1. `ordertest.config.ts`
 *   2. `ordertest.config.json`
 *   3. `ordertest.config.yaml`
 *   4. `ordertest.config.yml`
 *
 * @param rootDir - Directory to search in
 * @param logger - Optional logger for structured debug output
 * @returns Absolute path of the discovered manifest, or `undefined`
 */
export async function discoverManifest(
  rootDir: string,
  logger?: Logger,
): Promise<string | undefined> {
  debugConsole(`Auto-discovering manifest in "${rootDir}"`);
  logger?.debug({ rootDir, candidates: MANIFEST_CANDIDATES }, 'Auto-discovering manifest');

  for (const candidate of MANIFEST_CANDIDATES) {
    const candidatePath = path.resolve(rootDir, candidate);
    debugConsole(`  Trying: ${candidatePath}`);

    try {
      await fs.access(candidatePath);
      // File exists
      debugConsole(`  Found: ${candidatePath}`);
      logger?.debug({ candidatePath }, 'Manifest file found during auto-discovery');
      return candidatePath;
    } catch {
      // File does not exist — try next candidate
      debugConsole(`  Not found: ${candidatePath}`);
      logger?.debug({ candidatePath }, 'Manifest candidate not found, trying next');
    }
  }

  debugConsole('  No manifest file found during auto-discovery');
  logger?.debug({ rootDir }, 'No manifest file found during auto-discovery');
  return undefined;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Load and validate an external ordered-test manifest file.
 *
 * When `manifestPath` is provided, that path is resolved against `rootDir` and
 * loaded directly. Otherwise, the function auto-discovers the manifest by searching
 * `rootDir` for the supported file names in priority order.
 *
 * Supports JSON (`.json`), YAML (`.yaml` / `.yml`), and TypeScript (`.ts`) formats.
 * The parsed content is validated against the manifest schema before being returned.
 *
 * @param options - Options controlling manifest resolution and logging
 * @returns The validated manifest
 * @throws OrderTestManifestError if the file cannot be found, read, parsed, or validated
 */
export async function loadManifest(options: LoadManifestOptions): Promise<OrderedTestManifest> {
  const { logger } = options;
  const rootDir = options.rootDir ?? process.cwd();

  debugConsole(`loadManifest called (rootDir: "${rootDir}")`);
  logger?.debug({ rootDir, manifestPath: options.manifestPath }, 'loadManifest called');

  // ---------------------------------------------------------------------------
  // Step 1: Resolve the manifest file path
  // ---------------------------------------------------------------------------

  // ORDERTEST_MANIFEST env var overrides both explicit manifestPath and auto-discovery
  const envManifestPath = process.env.ORDERTEST_MANIFEST;
  const effectiveManifestPath =
    envManifestPath !== undefined && envManifestPath.length > 0
      ? envManifestPath
      : options.manifestPath;

  if (envManifestPath !== undefined && envManifestPath.length > 0) {
    debugConsole(`  ORDERTEST_MANIFEST env var override: "${envManifestPath}"`);
    logger?.debug({ envManifestPath }, 'ORDERTEST_MANIFEST env var overrides manifest path');
  }

  let resolvedPath: string;

  if (effectiveManifestPath !== undefined && effectiveManifestPath.length > 0) {
    resolvedPath = path.resolve(rootDir, effectiveManifestPath);
    debugConsole(`  Using explicit manifest path: ${resolvedPath}`);
    logger?.debug({ resolvedPath }, 'Using explicit manifest path');

    // Verify the file exists when an explicit path is given — fail fast with a
    // clear message rather than letting the format-specific loader produce a
    // confusing "ENOENT" error.
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new OrderTestManifestError(
        `Manifest file not found at "${resolvedPath}". ${envManifestPath !== undefined && envManifestPath.length > 0 ? 'Check the ORDERTEST_MANIFEST environment variable' : 'Check the "manifest" option in your Playwright config'} and verify the path is correct.`,
        { filePath: resolvedPath, rootDir },
      );
    }
  } else {
    const discovered = await discoverManifest(rootDir, logger);
    if (discovered === undefined) {
      throw new OrderTestManifestError(
        `No manifest file found in "${rootDir}". Create one of: ordertest.config.ts, ordertest.config.json, ordertest.config.yaml, ordertest.config.yml — or provide an explicit path via the "manifest" option in your Playwright config.`,
        { rootDir, candidates: MANIFEST_CANDIDATES },
      );
    }
    resolvedPath = discovered;
  }

  // ---------------------------------------------------------------------------
  // Step 2: Detect format
  // ---------------------------------------------------------------------------

  const format = detectFormat(resolvedPath);
  debugConsole(`  Detected format: ${format} (${resolvedPath})`);
  logger?.debug({ resolvedPath, format }, 'Detected manifest format');

  // ---------------------------------------------------------------------------
  // Step 3: Parse the file
  // ---------------------------------------------------------------------------

  debugConsole(`  Parsing manifest (format: ${format})...`);

  let parsed: unknown;
  switch (format) {
    case 'json':
      parsed = await loadJsonManifest(resolvedPath);
      break;
    case 'yaml':
      parsed = await loadYamlManifest(resolvedPath);
      break;
    case 'ts':
      parsed = await loadTsManifest(resolvedPath);
      break;
    default: {
      // Exhaustive check — TypeScript narrows `format` to `never` here.
      const _exhaustive: never = format;
      throw new OrderTestManifestError(`Unhandled manifest format: ${String(_exhaustive)}`, {
        filePath: resolvedPath,
      });
    }
  }

  debugConsole('  Parse successful');
  logger?.debug({ filePath: resolvedPath, format }, 'Manifest file parsed successfully');

  // ---------------------------------------------------------------------------
  // Step 4: Validate
  // ---------------------------------------------------------------------------

  debugConsole('  Validating manifest...');

  let manifest: OrderedTestManifest;
  try {
    manifest = validateManifest(parsed, logger);
  } catch (error) {
    // Re-wrap validation errors with manifest file context so the user knows
    // which file triggered the failure.
    throw new OrderTestManifestError(
      `Manifest validation failed for "${resolvedPath}": ${String(error instanceof Error ? error.message : error)}`,
      { filePath: resolvedPath, format, cause: error },
    );
  }

  debugConsole(
    `  Manifest loaded successfully: ${manifest.sequences.length} sequence(s) from "${resolvedPath}"`,
  );
  logger?.debug(
    { filePath: resolvedPath, format, sequenceCount: manifest.sequences.length },
    'Manifest loaded and validated successfully',
  );

  return manifest;
}
