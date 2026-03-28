/**
 * Shard guard for @jimicze-pw/ordertest-core.
 *
 * Detects CI sharding configuration from three sources (config, argv, env) and
 * adjusts or collapses ordered project chains to prevent order breakage across
 * shard boundaries.
 *
 * When Playwright distributes tests across shards, `dependencies` between projects
 * are NOT enforced across shard boundaries. The shard guard solves this by
 * collapsing chained projects in a sequence into a single atomic project so the
 * entire sequence lands on the same shard and the declared order is preserved.
 */

import type { ShardDetectionSource, ShardInfo, ShardStrategy } from '../config/types.js';
import { DEFAULT_SHARD_STRATEGY, PROJECT_NAME_PREFIX } from '../config/types.js';
import type { GeneratedProject } from '../engine/serialStrategy.js';
import { OrderTestShardError } from '../errors/errors.js';
import type { Logger } from '../logger/logger.js';
import { debugConsole } from '../logger/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for {@link applyShardGuard}. */
export interface ShardGuardOptions {
  /** The generated projects to protect from shard-boundary order breakage. */
  readonly projects: readonly GeneratedProject[];

  /** Detected shard configuration. */
  readonly shardInfo: ShardInfo;

  /** Strategy to apply when sharding conflicts with ordering. */
  readonly strategy: ShardStrategy;

  /** Optional logger for structured activity logging. */
  readonly logger?: Logger;
}

// ---------------------------------------------------------------------------
// Shard Detection
// ---------------------------------------------------------------------------

/**
 * Parse a shard string in `N/M` format into `{ current, total }`.
 *
 * @param raw - Raw shard string, e.g. `'2/5'`
 * @returns Parsed shard numbers, or `undefined` if the format is invalid
 */
function parseShardString(raw: string): { current: number; total: number } | undefined {
  const match = /^(\d+)\/(\d+)$/.exec(raw.trim());
  if (match === null) {
    return undefined;
  }

  const current = Number(match[1]);
  const total = Number(match[2]);

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(total) ||
    current < 1 ||
    total < 1 ||
    current > total
  ) {
    return undefined;
  }

  return { current, total };
}

/**
 * Detect sharding from `process.argv`.
 *
 * Handles both `--shard=N/M` and `--shard N/M` argument styles.
 *
 * @returns Parsed shard values, or `undefined` if not found in argv
 */
function detectShardFromArgv(): { current: number; total: number } | undefined {
  const argv = process.argv;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }

    // --shard=N/M
    const eqMatch = /^--shard=(.+)$/.exec(arg);
    if (eqMatch !== null) {
      const raw = eqMatch[1];
      if (raw !== undefined) {
        debugConsole(`shardGuard: argv source — found --shard=${raw}`);
        return parseShardString(raw);
      }
    }

    // --shard N/M (next argument)
    if (arg === '--shard') {
      const next = argv[i + 1];
      if (next !== undefined) {
        debugConsole(`shardGuard: argv source — found --shard ${next}`);
        return parseShardString(next);
      }
    }
  }

  return undefined;
}

/**
 * Detect sharding from the `PLAYWRIGHT_SHARD` environment variable.
 *
 * Expected format: `N/M` (e.g. `'2/5'`).
 *
 * @returns Parsed shard values, or `undefined` if the env var is not set or invalid
 */
function detectShardFromEnv(): { current: number; total: number } | undefined {
  const raw = process.env.PLAYWRIGHT_SHARD;
  if (raw === undefined || raw === '') {
    return undefined;
  }

  debugConsole(`shardGuard: env source — PLAYWRIGHT_SHARD=${raw}`);
  return parseShardString(raw);
}

/**
 * Detect whether CI sharding is active and return shard details.
 *
 * Checks three sources in priority order:
 * 1. `playwrightConfigShard` parameter — the `config.shard` value from the Playwright config
 * 2. `process.argv` — looks for `--shard=N/M` or `--shard N/M`
 * 3. `PLAYWRIGHT_SHARD` environment variable — format `N/M`
 *
 * @param playwrightConfigShard - Optional shard config from the Playwright config object
 * @returns {@link ShardInfo} if sharding is active, `undefined` otherwise
 */
export function detectShardConfig(playwrightConfigShard?: { current: number; total: number }):
  | ShardInfo
  | undefined {
  debugConsole('shardGuard: checking for shard configuration...');

  // Priority 1: explicit config.shard
  if (
    playwrightConfigShard !== undefined &&
    playwrightConfigShard.current >= 1 &&
    playwrightConfigShard.total >= 1
  ) {
    const source: ShardDetectionSource = 'config';
    const info: ShardInfo = {
      current: playwrightConfigShard.current,
      total: playwrightConfigShard.total,
      source,
    };
    debugConsole(`shardGuard: shard detected via ${source} — ${info.current}/${info.total}`);
    return info;
  }

  debugConsole('shardGuard: no shard in config, checking argv...');

  // Priority 2: process.argv
  const argvShard = detectShardFromArgv();
  if (argvShard !== undefined) {
    const source: ShardDetectionSource = 'argv';
    const info: ShardInfo = { current: argvShard.current, total: argvShard.total, source };
    debugConsole(`shardGuard: shard detected via ${source} — ${info.current}/${info.total}`);
    return info;
  }

  debugConsole('shardGuard: no shard in argv, checking env...');

  // Priority 3: PLAYWRIGHT_SHARD env var
  const envShard = detectShardFromEnv();
  if (envShard !== undefined) {
    const source: ShardDetectionSource = 'env';
    const info: ShardInfo = { current: envShard.current, total: envShard.total, source };
    debugConsole(`shardGuard: shard detected via ${source} — ${info.current}/${info.total}`);
    return info;
  }

  debugConsole('shardGuard: no sharding detected');
  return undefined;
}

// ---------------------------------------------------------------------------
// Strategy Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective shard strategy.
 *
 * Precedence (highest → lowest):
 * 1. `ORDERTEST_SHARD_STRATEGY` environment variable
 * 2. `configStrategy` parameter
 * 3. `DEFAULT_SHARD_STRATEGY` (`'collapse'`)
 *
 * @param configStrategy - Strategy from the plugin config, if set
 * @returns The resolved {@link ShardStrategy}
 */
export function resolveShardStrategy(configStrategy?: ShardStrategy): ShardStrategy {
  const envStrategy = process.env.ORDERTEST_SHARD_STRATEGY as ShardStrategy | undefined;
  if (
    envStrategy !== undefined &&
    (envStrategy === 'collapse' || envStrategy === 'warn' || envStrategy === 'fail')
  ) {
    debugConsole(
      `shardGuard: strategy resolved from env — ORDERTEST_SHARD_STRATEGY=${envStrategy}`,
    );
    return envStrategy;
  }

  if (configStrategy !== undefined) {
    debugConsole(`shardGuard: strategy resolved from config — ${configStrategy}`);
    return configStrategy;
  }

  debugConsole(`shardGuard: strategy defaulting to '${DEFAULT_SHARD_STRATEGY}'`);
  return DEFAULT_SHARD_STRATEGY;
}

// ---------------------------------------------------------------------------
// Collapse Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all file paths from a {@link GeneratedProject}'s `testMatch` field
 * as a plain string array.
 *
 * @param project - The project whose testMatch to collect
 * @returns Array of file path strings
 */
function collectTestMatch(project: GeneratedProject): string[] {
  if (Array.isArray(project.testMatch)) {
    return [...project.testMatch];
  }
  return [project.testMatch];
}

/**
 * Collapse a group of projects that belong to the same ordered sequence into
 * a single atomic project.
 *
 * The resulting project:
 * - Has a name of `ordertest:<sequenceName>` (no step index)
 * - Combines all `testMatch` entries from the group
 * - Uses `workers: 1` and `fullyParallel: false` for atomicity
 * - Inherits external `dependencies` from the first project in the chain
 *   (i.e. dependencies on OTHER sequences, not internal chain links)
 * - Has `metadata.isCollapsed: true`, `stepIndex: 0`, `totalSteps: 1`
 *
 * @param sequenceName - Name of the sequence being collapsed
 * @param group - Ordered array of projects in the sequence
 * @param logger - Optional logger
 * @returns A single collapsed {@link GeneratedProject}
 */
function collapseSequenceGroup(
  sequenceName: string,
  group: readonly GeneratedProject[],
  logger?: Logger,
): GeneratedProject {
  const collapsedName = `${PROJECT_NAME_PREFIX}:${sequenceName}`;

  // Gather all test files in declaration order
  const allTestMatch: string[] = [];
  for (const project of group) {
    allTestMatch.push(...collectTestMatch(project));
  }

  // External dependencies: only keep deps from the first project that point
  // OUTSIDE this sequence (i.e., not to sibling step projects).
  const firstProject = group[0];
  const internalPrefix = `${PROJECT_NAME_PREFIX}:${sequenceName}:`;
  const externalDeps: string[] =
    firstProject?.dependencies !== undefined
      ? firstProject.dependencies.filter((dep) => !dep.startsWith(internalPrefix))
      : [];

  // Inherit mode from metadata (fall back to 'serial' for safety)
  const mode = firstProject?.metadata?.mode ?? 'serial';

  const collapsed: GeneratedProject = {
    name: collapsedName,
    testMatch: allTestMatch,
    ...(externalDeps.length > 0 && { dependencies: externalDeps }),
    workers: 1,
    fullyParallel: false,
    metadata: {
      sequenceName,
      stepIndex: 0,
      totalSteps: 1,
      mode,
      isCollapsed: true,
    },
  };

  debugConsole(
    `shardGuard: collapsed sequence="${sequenceName}" ` +
      `(${group.length} step(s) → 1 project, files=${allTestMatch.length}, ` +
      `externalDeps=[${externalDeps.join(', ')}])`,
  );
  logger?.warn(
    {
      sequence: sequenceName,
      originalSteps: group.length,
      files: allTestMatch.length,
      externalDeps,
      collapsedName,
    },
    'Ordered sequence collapsed to single atomic project for shard safety',
  );

  return collapsed;
}

// ---------------------------------------------------------------------------
// Main Guard
// ---------------------------------------------------------------------------

/**
 * Apply shard safety to a list of generated Playwright projects.
 *
 * Projects without `metadata` (e.g. the `ordertest:unordered` catch-all project)
 * are passed through unchanged regardless of strategy.
 *
 * Strategy behaviour:
 * - **`'collapse'`**: Groups ordered projects by sequence name and merges each
 *   group into a single atomic project (`workers: 1`, no step chain). This
 *   guarantees the whole sequence lands on one shard.
 * - **`'warn'`**: Logs a prominent warning that shard boundaries may break
 *   declared ordering, then returns projects unchanged.
 * - **`'fail'`**: Throws {@link OrderTestShardError} immediately. Use this in
 *   environments where broken ordering is unacceptable.
 *
 * @param options - {@link ShardGuardOptions}
 * @returns The (potentially modified) list of generated projects
 * @throws {OrderTestShardError} When `strategy` is `'fail'`
 */
export function applyShardGuard(options: ShardGuardOptions): GeneratedProject[] {
  const { projects, shardInfo, strategy, logger } = options;

  debugConsole(
    `shardGuard: applyShardGuard — shard=${shardInfo.current}/${shardInfo.total} ` +
      `source=${shardInfo.source} strategy=${strategy} projects=${projects.length}`,
  );
  logger?.debug(
    { shardInfo, strategy, projectCount: projects.length },
    'Applying shard guard to generated projects',
  );

  // -------------------------------------------------------------------------
  // Strategy: fail — hard stop immediately
  // -------------------------------------------------------------------------
  if (strategy === 'fail') {
    const msg = `Sharding detected (--shard=${shardInfo.current}/${shardInfo.total}) but ordered sequences require atomic execution. Set shardStrategy to 'collapse' or 'warn' to allow sharded runs.`;

    debugConsole('shardGuard: strategy=fail — throwing OrderTestShardError');
    logger?.error({ shardInfo, strategy }, msg);

    throw new OrderTestShardError(msg, { shardInfo, strategy });
  }

  // -------------------------------------------------------------------------
  // Strategy: warn — log and return unchanged
  // -------------------------------------------------------------------------
  if (strategy === 'warn') {
    const warnMsg = `[ordertest] WARNING: Sharding is active (--shard=${shardInfo.current}/${shardInfo.total}, source: ${shardInfo.source}). Ordered sequences may have their execution order broken across shard boundaries. Set shardStrategy to 'collapse' to enforce ordering, or 'fail' to treat this as an error.`;

    process.stderr.write(`${warnMsg}\n`);
    debugConsole('shardGuard: strategy=warn — emitting warning, returning projects unchanged');
    logger?.warn(
      { shardInfo, strategy },
      'Sharding detected with strategy=warn; ordering may be broken across shard boundaries',
    );

    return projects as GeneratedProject[];
  }

  // -------------------------------------------------------------------------
  // Strategy: collapse — group by sequence, merge each group
  // -------------------------------------------------------------------------
  debugConsole('shardGuard: strategy=collapse — grouping projects by sequence name');
  logger?.info(
    { shardInfo, strategy },
    'Sharding detected; collapsing ordered sequences to atomic projects',
  );

  // Separate ordered projects (have metadata) from unordered pass-throughs
  const sequenceGroups = new Map<string, GeneratedProject[]>();
  const unorderedProjects: GeneratedProject[] = [];

  for (const project of projects) {
    if (project.metadata === undefined) {
      unorderedProjects.push(project);
      debugConsole(`shardGuard: pass-through project="${project.name}" (no metadata)`);
      continue;
    }

    const { sequenceName } = project.metadata;
    const existing = sequenceGroups.get(sequenceName);
    if (existing !== undefined) {
      existing.push(project);
    } else {
      sequenceGroups.set(sequenceName, [project]);
    }
  }

  debugConsole(
    `shardGuard: found ${sequenceGroups.size} sequence group(s) and ` +
      `${unorderedProjects.length} unordered project(s)`,
  );

  // Collapse each sequence group into a single atomic project
  const collapsedProjects: GeneratedProject[] = [];

  for (const [sequenceName, group] of sequenceGroups) {
    const collapsed = collapseSequenceGroup(sequenceName, group, logger);
    collapsedProjects.push(collapsed);
  }

  const result = [...collapsedProjects, ...unorderedProjects];

  debugConsole(
    `shardGuard: collapse complete — ${projects.length} project(s) → ${result.length} project(s)`,
  );
  logger?.info(
    { originalCount: projects.length, collapsedCount: result.length },
    'Shard guard collapse complete',
  );

  return result;
}
