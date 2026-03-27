/**
 * @playwright-ordertest/core
 *
 * Playwright Test plugin for deterministic, user-defined test execution ordering.
 */

// -- Types --
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

// -- Errors --
export {
  OrderTestConfigError,
  OrderTestError,
  OrderTestManifestError,
  OrderTestShardError,
  OrderTestValidationError,
} from './errors/errors.js';

// -- Logger --
export type { Logger } from './logger/logger.js';
export { createLogger, createSilentLogger, debugConsole, isDebugEnabled } from './logger/logger.js';
