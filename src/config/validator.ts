/**
 * Zod schema validation for @playwright-ordertest/core plugin config and manifest.
 *
 * Validates all user-supplied input at the entry point so that downstream modules
 * can trust the data they receive. Validation failures produce clear, actionable
 * error messages via OrderTestValidationError.
 */

import { z } from 'zod';

import type {
  ExecutionMode,
  FileEntry,
  FileSpecification,
  LogLevel,
  LogRotationConfig,
  OrderedTestManifest,
  OrderedTestPluginConfig,
  SequenceDefinition,
  ShardStrategy,
} from '../config/types.js';
import { OrderTestValidationError } from '../errors/errors.js';
import { debugConsole } from '../logger/logger.js';
import type { Logger } from '../logger/logger.js';

// ---------------------------------------------------------------------------
// Primitive Schemas
// ---------------------------------------------------------------------------

/** Schema for execution modes. */
export const executionModeSchema: z.ZodEnum<['serial', 'parallel', 'fullyParallel']> = z.enum([
  'serial',
  'parallel',
  'fullyParallel',
]);

/** Schema for shard conflict strategies. */
export const shardStrategySchema: z.ZodEnum<['collapse', 'warn', 'fail']> = z.enum([
  'collapse',
  'warn',
  'fail',
]);

/** Schema for log levels. */
export const logLevelSchema: z.ZodEnum<['debug', 'info', 'warn', 'error', 'silent']> = z.enum([
  'debug',
  'info',
  'warn',
  'error',
  'silent',
]);

// ---------------------------------------------------------------------------
// File Specification Schemas
// ---------------------------------------------------------------------------

/** Schema for a detailed file specification with optional test/tag filtering. */
export const fileSpecificationSchema: z.ZodObject<{
  file: z.ZodString;
  tests: z.ZodOptional<z.ZodArray<z.ZodString>>;
  tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}> = z.object({
  file: z.string().min(1, 'file path must be a non-empty string'),
  tests: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

/** Schema for a file entry — either a plain path string or a FileSpecification object. */
export const fileEntrySchema: z.ZodUnion<[z.ZodString, typeof fileSpecificationSchema]> = z.union([
  z.string().min(1, 'file path must be a non-empty string'),
  fileSpecificationSchema,
]);

// ---------------------------------------------------------------------------
// Log Rotation Schema
// ---------------------------------------------------------------------------

/** Schema for log file rotation configuration. */
export const logRotationSchema: z.ZodObject<{
  maxSize: z.ZodOptional<z.ZodString>;
  maxFiles: z.ZodOptional<z.ZodNumber>;
}> = z.object({
  maxSize: z.string().optional(),
  maxFiles: z.number().int().positive('maxFiles must be a positive integer').optional(),
});

// ---------------------------------------------------------------------------
// Sequence Definition Schema
// ---------------------------------------------------------------------------

/** Schema for an ordered test sequence definition. */
export const sequenceDefinitionSchema: z.ZodObject<{
  name: z.ZodString;
  mode: z.ZodEnum<['serial', 'parallel', 'fullyParallel']>;
  files: z.ZodArray<typeof fileEntrySchema>;
  browser: z.ZodOptional<z.ZodString>;
  retries: z.ZodOptional<z.ZodNumber>;
  timeout: z.ZodOptional<z.ZodNumber>;
  workers: z.ZodOptional<z.ZodNumber>;
  tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}> = z.object({
  name: z.string().min(1, 'sequence name must be a non-empty string'),
  mode: executionModeSchema,
  files: z.array(fileEntrySchema).min(1, 'each sequence must have at least one file'),
  browser: z.string().optional(),
  retries: z.number().int().min(0, 'retries must be >= 0').optional(),
  timeout: z.number().positive('timeout must be > 0').optional(),
  workers: z.number().int().min(1, 'workers must be >= 1').optional(),
  tags: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Plugin Config Schema
// ---------------------------------------------------------------------------

/** Schema for the full plugin configuration (the `orderedTests` block). */
export const orderedTestPluginConfigSchema = z
  .object({
    sequences: z.array(sequenceDefinitionSchema).optional(),
    manifest: z.string().optional(),
    logLevel: logLevelSchema.optional(),
    logDir: z.string().optional(),
    logStdout: z.boolean().optional(),
    logRotation: logRotationSchema.optional(),
    shardStrategy: shardStrategySchema.optional(),
    debug: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sequences) {
      return;
    }
    const seen = new Set<string>();
    for (let i = 0; i < data.sequences.length; i++) {
      const seq = data.sequences[i];
      if (seq === undefined) {
        continue;
      }
      if (seen.has(seq.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sequences', i, 'name'],
          message: `Sequence name "${seq.name}" is not unique. Each sequence must have a distinct name.`,
        });
      }
      seen.add(seq.name);
    }
  });

// ---------------------------------------------------------------------------
// Manifest Schema
// ---------------------------------------------------------------------------

/** Schema for external manifest files (ordertest.config.json/yaml/ts). */
export const orderedTestManifestSchema = z
  .object({
    sequences: z
      .array(sequenceDefinitionSchema)
      .min(1, 'manifest must define at least one sequence'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < data.sequences.length; i++) {
      const seq = data.sequences[i];
      if (seq === undefined) {
        continue;
      }
      if (seen.has(seq.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sequences', i, 'name'],
          message: `Sequence name "${seq.name}" is not unique. Each sequence must have a distinct name.`,
        });
      }
      seen.add(seq.name);
    }
  });

// ---------------------------------------------------------------------------
// Error Formatting
// ---------------------------------------------------------------------------

/**
 * Format Zod validation errors into a human-readable multi-line string.
 * Each error is presented with its field path and message.
 *
 * @param error - The ZodError to format
 * @returns A formatted string with one error per line
 */
export function formatZodErrors(error: z.ZodError): string {
  const lines = error.errors.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  - ${path}: ${issue.message}`;
  });
  return `\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Exported Validation Functions
// ---------------------------------------------------------------------------

/**
 * Validate the plugin configuration object.
 * Parses the input against the orderedTestPluginConfigSchema.
 * Throws OrderTestValidationError with formatted messages on failure.
 *
 * @param config - Unknown input to validate (typically from the user's playwright.config.ts)
 * @param logger - Optional logger for structured debug output
 * @returns The validated and typed OrderedTestPluginConfig
 * @throws OrderTestValidationError if validation fails
 */
export function validateConfig(config: unknown, logger?: Logger): OrderedTestPluginConfig {
  try {
    debugConsole('Validating plugin config...');
    logger?.debug({ config }, 'Validating plugin config');

    const result = orderedTestPluginConfigSchema.parse(config);

    debugConsole(`  sequences: ${result.sequences?.length ?? 0}`);
    debugConsole(`  manifest: ${result.manifest ?? '(none)'}`);
    debugConsole(`  logLevel: ${result.logLevel ?? '(default)'}`);
    debugConsole(`  shardStrategy: ${result.shardStrategy ?? '(default)'}`);
    debugConsole(`  debug: ${result.debug ?? false}`);
    debugConsole('Plugin config validated successfully');

    logger?.debug({ result }, 'Plugin config validated successfully');

    return result as OrderedTestPluginConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = formatZodErrors(error);
      logger?.debug({ zodErrors: error.errors }, 'Plugin config validation failed');
      throw new OrderTestValidationError(`Invalid plugin config:${message}`, {
        zodErrors: error.errors,
      });
    }
    throw error;
  }
}

/**
 * Validate an external manifest data object.
 * Parses the input against the orderedTestManifestSchema.
 * Throws OrderTestValidationError with formatted messages on failure.
 *
 * @param data - Unknown input to validate (typically parsed JSON/YAML/TS manifest)
 * @param logger - Optional logger for structured debug output
 * @returns The validated and typed OrderedTestManifest
 * @throws OrderTestValidationError if validation fails
 */
export function validateManifest(data: unknown, logger?: Logger): OrderedTestManifest {
  try {
    debugConsole('Validating manifest...');
    logger?.debug({ data }, 'Validating manifest');

    const result = orderedTestManifestSchema.parse(data);

    debugConsole(`  sequences: ${result.sequences.length}`);
    for (let i = 0; i < result.sequences.length; i++) {
      const seq = result.sequences[i];
      if (seq !== undefined) {
        debugConsole(`  [${i}] "${seq.name}" (${seq.mode}, ${seq.files.length} files)`);
      }
    }
    debugConsole('Manifest validated successfully');

    logger?.debug({ result }, 'Manifest validated successfully');

    return result as OrderedTestManifest;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = formatZodErrors(error);
      logger?.debug({ zodErrors: error.errors }, 'Manifest validation failed');
      throw new OrderTestValidationError(`Invalid manifest:${message}`, {
        zodErrors: error.errors,
      });
    }
    throw error;
  }
}

// Re-export types so callers can use them without importing from types.ts directly.
export type {
  ExecutionMode,
  FileEntry,
  FileSpecification,
  LogLevel,
  LogRotationConfig,
  OrderedTestManifest,
  OrderedTestPluginConfig,
  SequenceDefinition,
  ShardStrategy,
};
