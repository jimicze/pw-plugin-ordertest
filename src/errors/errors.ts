/**
 * Custom error classes for @jimicze-pw/ordertest-core.
 *
 * All plugin errors extend OrderTestError for easy catch-all handling.
 * Error messages are actionable — they tell the user what went wrong and how to fix it.
 */

/**
 * Base error class for all @jimicze-pw/ordertest-core errors.
 * Provides a `context` field for structured error metadata.
 */
export class OrderTestError extends Error {
  /** Structured metadata about the error context. */
  public readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(`[ordertest] ${message}`);
    this.name = 'OrderTestError';
    this.context = context;
  }
}

/**
 * Thrown when the user's plugin configuration is invalid.
 * Wraps Zod validation errors with human-readable messages.
 *
 * @example
 * ```
 * throw new OrderTestConfigError(
 *   'Sequence "checkout-flow" has no files. Add at least one file to the sequence.',
 *   { sequenceName: 'checkout-flow', field: 'files' }
 * );
 * ```
 */
export class OrderTestConfigError extends OrderTestError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(`Config error: ${message}`, context);
    this.name = 'OrderTestConfigError';
  }
}

/**
 * Thrown when Zod schema validation fails on the plugin config or manifest.
 * Contains the original Zod error for programmatic access.
 *
 * @example
 * ```
 * throw new OrderTestValidationError(
 *   'Invalid config: sequences[0].mode must be "serial", "parallel", or "fullyParallel".',
 *   { zodErrors: formatted, path: 'sequences[0].mode' }
 * );
 * ```
 */
export class OrderTestValidationError extends OrderTestError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(`Validation error: ${message}`, context);
    this.name = 'OrderTestValidationError';
  }
}

/**
 * Thrown when sharding conflicts with ordered test execution.
 * Raised by the shard guard when strategy is 'fail'.
 *
 * @example
 * ```
 * throw new OrderTestShardError(
 *   'Sharding detected (--shard=2/5) but ordered sequences require atomic execution. ' +
 *   'Set shardStrategy to "collapse" or "warn" to allow sharded runs.',
 *   { shard: { current: 2, total: 5 }, strategy: 'fail' }
 * );
 * ```
 */
export class OrderTestShardError extends OrderTestError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(`Shard error: ${message}`, context);
    this.name = 'OrderTestShardError';
  }
}

/**
 * Thrown when an external manifest file cannot be loaded or parsed.
 *
 * @example
 * ```
 * throw new OrderTestManifestError(
 *   'Failed to parse ordertest.config.yaml: invalid YAML at line 12.',
 *   { filePath: 'ordertest.config.yaml', format: 'yaml', line: 12 }
 * );
 * ```
 */
export class OrderTestManifestError extends OrderTestError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(`Manifest error: ${message}`, context);
    this.name = 'OrderTestManifestError';
  }
}
