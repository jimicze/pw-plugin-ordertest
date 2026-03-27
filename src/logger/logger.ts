/**
 * Persistent structured logger for @playwright-ordertest/core.
 *
 * Provides two output channels:
 * 1. Pino JSON file logging to `.ordertest/activity.log` (structured, for post-mortem analysis)
 * 2. Human-readable debug console output to stderr (for real-time debugging)
 *
 * Both channels are activated by setting debug mode via:
 * - `ORDERTEST_DEBUG=true` environment variable
 * - `orderedTests.debug: true` in config
 * - `logLevel: 'debug'` (implicitly enables console debug output)
 */

import fs from 'node:fs';
import path from 'node:path';

import pino from 'pino';

import type { LogLevel } from '../config/types.js';
import {
  DEBUG_PREFIX,
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_MAX_FILES,
  DEFAULT_LOG_MAX_SIZE,
} from '../config/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Logger instance type (pino logger). */
export type Logger = pino.Logger;

/** Options for creating a logger instance. */
export interface CreateLoggerOptions {
  /** Log level. Default: 'info'. Overridden by ORDERTEST_LOG_LEVEL env var. */
  readonly logLevel?: LogLevel;

  /** Directory for log files. Default: '.ordertest'. Overridden by ORDERTEST_LOG_DIR env var. */
  readonly logDir?: string;

  /** Also emit to stdout. Default: false. Overridden by ORDERTEST_LOG_STDOUT env var. */
  readonly logStdout?: boolean;

  /** Max log file size before rotation. Default: '10m'. */
  readonly maxSize?: string;

  /** Number of rotated files to keep. Default: 5. */
  readonly maxFiles?: number;

  /** Enable verbose debug console output to stderr. Default: false. */
  readonly debug?: boolean;
}

// ---------------------------------------------------------------------------
// Module State
// ---------------------------------------------------------------------------

let _isDebugEnabled = false;

// ---------------------------------------------------------------------------
// Debug Console Output
// ---------------------------------------------------------------------------

/**
 * Write a human-readable debug line to stderr.
 * Only outputs when debug mode is enabled.
 * Prefixed with `[ordertest:debug]` for easy filtering.
 *
 * @param msg - The message to write (no newline needed — it's added automatically)
 */
export function debugConsole(msg: string): void {
  if (_isDebugEnabled) {
    process.stderr.write(`${DEBUG_PREFIX} ${msg}\n`);
  }
}

/**
 * Check if debug console output is currently enabled.
 *
 * @returns true if debug mode is active
 */
export function isDebugEnabled(): boolean {
  return _isDebugEnabled;
}

// ---------------------------------------------------------------------------
// Pino Log Level Mapping
// ---------------------------------------------------------------------------

const PINO_LEVEL_MAP: Record<LogLevel, string> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  silent: 'silent',
};

// ---------------------------------------------------------------------------
// Logger Factory
// ---------------------------------------------------------------------------

/**
 * Resolve the effective log level, considering env var overrides.
 *
 * @param configLevel - Log level from config
 * @returns The resolved log level
 */
function resolveLogLevel(configLevel: LogLevel | undefined): LogLevel {
  const envLevel = process.env.ORDERTEST_LOG_LEVEL as LogLevel | undefined;
  if (envLevel && envLevel in PINO_LEVEL_MAP) {
    return envLevel;
  }
  return configLevel ?? DEFAULT_LOG_LEVEL;
}

/**
 * Resolve whether stdout logging is enabled.
 *
 * @param configStdout - Value from config
 * @returns Whether to also log to stdout
 */
function resolveLogStdout(configStdout: boolean | undefined): boolean {
  if (process.env.ORDERTEST_LOG_STDOUT === 'true') {
    return true;
  }
  return configStdout ?? false;
}

/**
 * Resolve whether debug mode is enabled.
 *
 * @param configDebug - Value from config
 * @param logLevel - Resolved log level
 * @returns Whether debug console output is enabled
 */
function resolveDebugEnabled(configDebug: boolean | undefined, logLevel: LogLevel): boolean {
  if (process.env.ORDERTEST_DEBUG === 'true') {
    return true;
  }
  if (configDebug === true) {
    return true;
  }
  // logLevel: 'debug' implicitly enables console debug output
  return logLevel === 'debug';
}

/**
 * Resolve the log directory, considering env var overrides.
 *
 * @param configLogDir - Log directory from config
 * @returns The resolved log directory path
 */
function resolveLogDir(configLogDir: string | undefined): string {
  return process.env.ORDERTEST_LOG_DIR ?? configLogDir ?? DEFAULT_LOG_DIR;
}

/**
 * Ensure the log directory exists, creating it if necessary.
 *
 * @param logDir - The directory path to create
 */
function ensureLogDir(logDir: string): void {
  const absoluteDir = path.resolve(logDir);
  if (!fs.existsSync(absoluteDir)) {
    fs.mkdirSync(absoluteDir, { recursive: true });
  }
}

/**
 * Create a configured pino logger instance with file transport and optional stdout.
 *
 * Features:
 * - JSON structured logging to `.ordertest/activity.log`
 * - Log rotation via pino-roll (configurable maxSize and maxFiles)
 * - Optional stdout mirroring for CI environments
 * - Debug console output to stderr (human-readable, `[ordertest:debug]` prefixed)
 * - Environment variable overrides for all settings
 * - Concurrent-write safe for multi-worker Playwright environments
 *
 * @param options - Logger configuration options
 * @returns A configured pino Logger instance
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const logLevel = resolveLogLevel(options.logLevel);
  const logDir = resolveLogDir(options.logDir);
  const isStdout = resolveLogStdout(options.logStdout);
  const maxSize = options.maxSize ?? DEFAULT_LOG_MAX_SIZE;
  const maxFiles = options.maxFiles ?? DEFAULT_LOG_MAX_FILES;

  // Set global debug state
  _isDebugEnabled = resolveDebugEnabled(options.debug, logLevel);

  // Ensure log directory exists
  ensureLogDir(logDir);

  const logFilePath = path.resolve(logDir, DEFAULT_LOG_FILE);
  const pinoLevel = PINO_LEVEL_MAP[logLevel] ?? 'info';

  // When log level is silent, skip the file transport entirely to avoid
  // initializing pino-roll unnecessarily (pino-roll can fail in multi-worker
  // test environments when opened with a silent logger).
  if (pinoLevel === 'silent') {
    debugConsole(`Logger initialized (level: ${logLevel}, dir: ${logDir}, stdout: ${isStdout})`);
    return pino({ level: 'silent' });
  }

  // Build transport targets
  const targets: pino.TransportTargetOptions[] = [
    {
      target: 'pino-roll',
      options: {
        file: logFilePath,
        size: maxSize,
        limit: { count: maxFiles },
      },
      level: pinoLevel,
    },
  ];

  // Add stdout transport if configured
  if (isStdout) {
    targets.push({
      target: 'pino/file',
      options: { destination: 1 }, // fd 1 = stdout
      level: pinoLevel,
    });
  }

  const transport = pino.transport({ targets });

  // Prevent pino-roll transport errors (e.g. rotation race conditions in
  // multi-worker test environments) from crashing the worker process.
  transport.on('error', (err: unknown) => {
    process.stderr.write(
      `[ordertest:warn] Logger transport error (non-fatal): ${String(err instanceof Error ? err.message : err)}\n`,
    );
  });

  const logger = pino(
    {
      level: pinoLevel,
      name: 'ordertest',
    },
    transport,
  );

  debugConsole(`Logger initialized (level: ${logLevel}, dir: ${logDir}, stdout: ${isStdout})`);

  return logger;
}

/**
 * Create a no-op logger that discards all output.
 * Useful for testing or when logging is disabled.
 *
 * @returns A pino Logger instance at 'silent' level
 */
export function createSilentLogger(): Logger {
  return pino({ level: 'silent' });
}
