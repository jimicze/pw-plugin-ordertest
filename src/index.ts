/**
 * @playwright-ordertest/core
 *
 * Playwright Test plugin for deterministic, user-defined test execution ordering.
 *
 * @example
 * ```typescript
 * // playwright.config.ts
 * import { defineOrderedConfig } from '@playwright-ordertest/core';
 *
 * export default defineOrderedConfig({
 *   orderedTests: {
 *     sequences: [
 *       { name: 'checkout', mode: 'serial', files: ['auth.spec.ts', 'cart.spec.ts'] },
 *     ],
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Main API — defineOrderedConfig
// ---------------------------------------------------------------------------

export {
  defineOrderedConfig,
  defineOrderedConfigAsync,
} from './config/defineOrderedConfig.js';

export type {
  PlaywrightConfigWithOrderedTests,
  TransformedConfig,
} from './config/defineOrderedConfig.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  ExecutionMode,
  FileEntry,
  FileSpecification,
  LogLevel,
  LogRotationConfig,
  OrderedTestManifest,
  OrderedTestPluginConfig,
  OrderTestProjectMetadata,
  SequenceDefinition,
  SequenceMetadata,
  ShardDetectionSource,
  ShardInfo,
  ShardStrategy,
} from './config/types.js';

export {
  DEBUG_PREFIX,
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_MAX_FILES,
  DEFAULT_LOG_MAX_SIZE,
  DEFAULT_SHARD_STRATEGY,
  PROJECT_NAME_PREFIX,
  UNORDERED_PROJECT_NAME,
} from './config/types.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export {
  OrderTestConfigError,
  OrderTestError,
  OrderTestManifestError,
  OrderTestShardError,
  OrderTestValidationError,
} from './errors/errors.js';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export type { Logger } from './logger/logger.js';
export { createLogger, createSilentLogger, debugConsole, isDebugEnabled } from './logger/logger.js';

// ---------------------------------------------------------------------------
// Validation (useful for consumers building custom tooling)
// ---------------------------------------------------------------------------

export { validateConfig, validateManifest } from './config/validator.js';

// ---------------------------------------------------------------------------
// Manifest Loading (useful for consumers building custom tooling)
// ---------------------------------------------------------------------------

export { loadManifest, discoverManifest } from './config/manifestLoader.js';

// ---------------------------------------------------------------------------
// Engine (advanced — for custom project generation)
// ---------------------------------------------------------------------------

export type { GeneratedProject } from './engine/projectGenerator.js';
export {
  collectOrderedFiles,
  generateProjects,
  generateUnorderedProject,
} from './engine/projectGenerator.js';

// ---------------------------------------------------------------------------
// Shard Guard (advanced — for custom shard handling)
// ---------------------------------------------------------------------------

export {
  applyShardGuard,
  detectShardConfig,
  resolveShardStrategy,
} from './config/shardGuard.js';

export type { ShardGuardOptions } from './config/shardGuard.js';

// ---------------------------------------------------------------------------
// Test Filter (advanced — for custom grep pattern building)
// ---------------------------------------------------------------------------

export { buildGrepPattern, escapeRegex } from './engine/testFilter.js';
