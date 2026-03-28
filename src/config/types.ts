/**
 * Core type definitions for @playwright-ordertest/core.
 *
 * All types used across the plugin are centralized here to prevent circular imports.
 * This file has no internal dependencies.
 */

// ---------------------------------------------------------------------------
// Execution Modes
// ---------------------------------------------------------------------------

/** Execution mode for an ordered test sequence. */
export type ExecutionMode = 'serial' | 'parallel' | 'fullyParallel';

/** Strategy to apply when sharding conflicts with ordered test chains. */
export type ShardStrategy = 'collapse' | 'warn' | 'fail';

/** Log level for the plugin's persistent activity logging. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

// ---------------------------------------------------------------------------
// File Specification
// ---------------------------------------------------------------------------

/**
 * Detailed specification for a test file within a sequence.
 * Allows selecting specific tests and applying tag filters.
 */
export interface FileSpecification {
  /** Relative path to the test file (from testDir). */
  readonly file: string;

  /**
   * Specific test names to include. If empty or undefined, all tests in the file are included.
   * Test names are matched against `test()` titles using grep.
   */
  readonly tests?: readonly string[];

  /** Tags to filter tests within this file (e.g., ['@smoke', '@regression']). */
  readonly tags?: readonly string[];
}

/**
 * A file entry in a sequence — either a simple string path or a detailed FileSpecification.
 */
export type FileEntry = string | FileSpecification;

// ---------------------------------------------------------------------------
// Sequence Definition
// ---------------------------------------------------------------------------

/**
 * Definition of an ordered test sequence.
 * A sequence specifies a set of test files to run in a deterministic order
 * with a specific execution mode.
 */
export interface SequenceDefinition {
  /** Unique name for this sequence. Used in project naming and reporting. */
  readonly name: string;

  /** Execution mode: how files and tests within files are run. */
  readonly mode: ExecutionMode;

  /**
   * Ordered list of test files in this sequence.
   * Files are executed in the order they appear in this array.
   */
  readonly files: readonly FileEntry[];

  /** Browser/project to use (optional, uses default if not specified). */
  readonly browser?: string;

  /** Override retries for this sequence (optional, inherits from base config). */
  readonly retries?: number;

  /** Override timeout in milliseconds for this sequence (optional). */
  readonly timeout?: number;

  /**
   * Override workers for this sequence (optional).
   * Only meaningful for 'parallel' and 'fullyParallel' modes.
   * Ignored for 'serial' mode (always uses 1 worker).
   */
  readonly workers?: number;

  /** Tags to filter tests across all files in this sequence (optional). */
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// Plugin Configuration
// ---------------------------------------------------------------------------

/** Configuration for log file rotation. */
export interface LogRotationConfig {
  /** Max file size before rotation (e.g., '10m', '1g'). Default: '10m'. */
  readonly maxSize?: string;

  /** Number of rotated files to keep. Default: 5. */
  readonly maxFiles?: number;
}

/**
 * Plugin-specific configuration for ordered test execution.
 * This is the `orderedTests` section within the Playwright config.
 */
export interface OrderedTestPluginConfig {
  /** Ordered test sequences. */
  readonly sequences?: readonly SequenceDefinition[];

  /** Path to external manifest file (overrides auto-discovery). */
  readonly manifest?: string;

  /** Log level for persistent activity logging. Default: 'info'. */
  readonly logLevel?: LogLevel;

  /** Directory for log files (relative to project root). Default: '.ordertest'. */
  readonly logDir?: string;

  /** Also emit logs to stdout. Default: false. */
  readonly logStdout?: boolean;

  /** Log rotation settings. */
  readonly logRotation?: LogRotationConfig;

  /** Strategy when sharding conflicts with ordering. Default: 'collapse'. */
  readonly shardStrategy?: ShardStrategy;

  /** Enable verbose debug output to stderr. Default: false. */
  readonly debug?: boolean;
}

// ---------------------------------------------------------------------------
// External Manifest
// ---------------------------------------------------------------------------

/**
 * Schema for external manifest files (ordertest.config.json/yaml/ts).
 * Contains only the sequences — no log or shard config (those go in the main config).
 */
export interface OrderedTestManifest {
  /** Ordered test sequences defined in the manifest. */
  readonly sequences: readonly SequenceDefinition[];
}

// ---------------------------------------------------------------------------
// Shard Information
// ---------------------------------------------------------------------------

/** Source where shard configuration was detected. */
export type ShardDetectionSource = 'config' | 'argv' | 'env';

/** Information about the current shard configuration. */
export interface ShardInfo {
  /** Current shard number (1-indexed). */
  readonly current: number;

  /** Total number of shards. */
  readonly total: number;

  /** Where the shard config was detected from. */
  readonly source: ShardDetectionSource;
}

// ---------------------------------------------------------------------------
// Generated Project Config
// ---------------------------------------------------------------------------

/**
 * Plugin metadata attached to generated Playwright project configs.
 * Useful for debugging and custom tooling to identify which sequence a project belongs to.
 */
export interface OrderTestProjectMetadata {
  /** Name of the sequence this project belongs to. */
  readonly sequenceName: string;

  /** Index of this step within the sequence (0-based). */
  readonly stepIndex: number;

  /** Total number of steps in the sequence. */
  readonly totalSteps: number;

  /** Execution mode of the parent sequence. */
  readonly mode: ExecutionMode;

  /** Whether this project was collapsed from a chain for shard safety. */
  readonly isCollapsed: boolean;
}

// ---------------------------------------------------------------------------
// Sequence Metadata (for Reporter)
// ---------------------------------------------------------------------------

/**
 * Metadata about a test's position within an ordered sequence.
 * Useful for custom tooling that needs to understand test ordering context.
 */
export interface SequenceMetadata {
  /** Name of the sequence the test belongs to. */
  readonly sequenceName: string;

  /** Human-readable position (e.g., "Step 2 of 5"). */
  readonly position: string;

  /** Numeric step index (0-based). */
  readonly stepIndex: number;

  /** Total steps in the sequence. */
  readonly totalSteps: number;

  /** Execution mode of the sequence. */
  readonly mode: ExecutionMode;

  /** Whether the sequence was collapsed for shard safety. */
  readonly isCollapsed: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default log directory (relative to project root). */
export const DEFAULT_LOG_DIR = '.ordertest';

/** Default log file name. */
export const DEFAULT_LOG_FILE = 'activity.log';

/** Default log level. */
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

/** Default shard strategy. */
export const DEFAULT_SHARD_STRATEGY: ShardStrategy = 'collapse';

/** Default max log file size before rotation. */
export const DEFAULT_LOG_MAX_SIZE = '10m';

/** Default number of rotated log files to keep. */
export const DEFAULT_LOG_MAX_FILES = 5;

/** Prefix for generated project names. */
export const PROJECT_NAME_PREFIX = 'ordertest';

/** Name of the unordered passthrough project. */
export const UNORDERED_PROJECT_NAME = `${PROJECT_NAME_PREFIX}:unordered`;

/** Debug console output prefix. */
export const DEBUG_PREFIX = '[ordertest:debug]';
