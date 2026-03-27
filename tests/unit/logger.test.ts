import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  createLogger,
  createSilentLogger,
  debugConsole,
  isDebugEnabled,
} from '../../src/logger/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ordertest-logger-'));
}

// ---------------------------------------------------------------------------
// createSilentLogger
// ---------------------------------------------------------------------------

test.describe('createSilentLogger', () => {
  test('returns a logger object with standard pino methods', () => {
    const logger = createSilentLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('calling logger.info does not throw', () => {
    const logger = createSilentLogger();
    expect(() => logger.info('test message')).not.toThrow();
  });

  test('calling logger.debug does not throw', () => {
    const logger = createSilentLogger();
    expect(() => logger.debug({ key: 'value' }, 'debug message')).not.toThrow();
  });

  test('calling logger.warn does not throw', () => {
    const logger = createSilentLogger();
    expect(() => logger.warn('warn message')).not.toThrow();
  });

  test('calling logger.error does not throw', () => {
    const logger = createSilentLogger();
    expect(() => logger.error('error message')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createLogger — basic behavior
// ---------------------------------------------------------------------------

test.describe('createLogger — basic behavior', () => {
  let tmpDir: string;
  // Saved env vars
  let savedLogLevel: string | undefined;
  let savedDebug: string | undefined;
  let savedLogDir: string | undefined;
  let savedLogStdout: string | undefined;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
    savedLogLevel = process.env.ORDERTEST_LOG_LEVEL;
    savedDebug = process.env.ORDERTEST_DEBUG;
    savedLogDir = process.env.ORDERTEST_LOG_DIR;
    savedLogStdout = process.env.ORDERTEST_LOG_STDOUT;
    // Clear env vars so they don't interfere
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_STDOUT');
  });

  test.afterEach(async () => {
    if (savedLogLevel !== undefined) {
      process.env.ORDERTEST_LOG_LEVEL = savedLogLevel;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    }
    if (savedDebug !== undefined) {
      process.env.ORDERTEST_DEBUG = savedDebug;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    }
    if (savedLogDir !== undefined) {
      process.env.ORDERTEST_LOG_DIR = savedLogDir;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
    }
    if (savedLogStdout !== undefined) {
      process.env.ORDERTEST_LOG_STDOUT = savedLogStdout;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_STDOUT');
    }
    // Reset debug state by creating a silent logger
    createLogger({ logLevel: 'silent', logDir: tmpDir });
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns a logger with standard pino methods', () => {
    const logger = createLogger({ logLevel: 'silent', logDir: tmpDir });
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('does not throw when called with explicit options', () => {
    expect(() => createLogger({ logLevel: 'info', logDir: tmpDir })).not.toThrow();
  });

  test('creates the log directory if it does not exist', async () => {
    const newDir = path.join(tmpDir, 'newLogDir');
    createLogger({ logLevel: 'silent', logDir: newDir });
    const stat = await fs.stat(newDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('creates nested log directories', async () => {
    const nestedDir = path.join(tmpDir, 'deep', 'nested', 'dir');
    createLogger({ logLevel: 'silent', logDir: nestedDir });
    const stat = await fs.stat(nestedDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('accepts logLevel: silent without throwing', () => {
    expect(() => createLogger({ logLevel: 'silent', logDir: tmpDir })).not.toThrow();
  });

  test('accepts logLevel: debug without throwing', () => {
    expect(() => createLogger({ logLevel: 'debug', logDir: tmpDir })).not.toThrow();
  });

  test('accepts logLevel: info without throwing', () => {
    expect(() => createLogger({ logLevel: 'info', logDir: tmpDir })).not.toThrow();
  });

  test('accepts logLevel: warn without throwing', () => {
    expect(() => createLogger({ logLevel: 'warn', logDir: tmpDir })).not.toThrow();
  });

  test('accepts logLevel: error without throwing', () => {
    expect(() => createLogger({ logLevel: 'error', logDir: tmpDir })).not.toThrow();
  });

  test('calling logger.info does not throw', () => {
    const logger = createLogger({ logLevel: 'silent', logDir: tmpDir });
    expect(() => logger.info('hello')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createLogger — debug mode activation
// ---------------------------------------------------------------------------

test.describe('createLogger — debug mode activation', () => {
  let tmpDir: string;
  let savedLogLevel: string | undefined;
  let savedDebug: string | undefined;
  let savedLogDir: string | undefined;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
    savedLogLevel = process.env.ORDERTEST_LOG_LEVEL;
    savedDebug = process.env.ORDERTEST_DEBUG;
    savedLogDir = process.env.ORDERTEST_LOG_DIR;
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
  });

  test.afterEach(async () => {
    if (savedLogLevel !== undefined) {
      process.env.ORDERTEST_LOG_LEVEL = savedLogLevel;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    }
    if (savedDebug !== undefined) {
      process.env.ORDERTEST_DEBUG = savedDebug;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    }
    if (savedLogDir !== undefined) {
      process.env.ORDERTEST_LOG_DIR = savedLogDir;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
    }
    // Reset debug state
    createLogger({ logLevel: 'silent', logDir: tmpDir });
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('isDebugEnabled returns false when no debug mode is triggered', () => {
    createLogger({ logLevel: 'info', logDir: tmpDir });
    expect(isDebugEnabled()).toBe(false);
  });

  test('isDebugEnabled returns true when options.debug === true', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: true });
    expect(isDebugEnabled()).toBe(true);
  });

  test('isDebugEnabled returns true when options.logLevel === debug', () => {
    createLogger({ logLevel: 'debug', logDir: tmpDir });
    expect(isDebugEnabled()).toBe(true);
  });

  test('isDebugEnabled returns true when ORDERTEST_DEBUG=true env var is set', () => {
    process.env.ORDERTEST_DEBUG = 'true';
    createLogger({ logLevel: 'silent', logDir: tmpDir });
    expect(isDebugEnabled()).toBe(true);
  });

  test('isDebugEnabled returns false when ORDERTEST_DEBUG is not set and debug/logLevel are not debug', () => {
    createLogger({ logLevel: 'warn', logDir: tmpDir, debug: false });
    expect(isDebugEnabled()).toBe(false);
  });

  test('ORDERTEST_DEBUG=false does not enable debug mode', () => {
    process.env.ORDERTEST_DEBUG = 'false';
    createLogger({ logLevel: 'info', logDir: tmpDir });
    expect(isDebugEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createLogger — env var overrides
// ---------------------------------------------------------------------------

test.describe('createLogger — env var overrides', () => {
  let tmpDir: string;
  let savedLogLevel: string | undefined;
  let savedDebug: string | undefined;
  let savedLogDir: string | undefined;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
    savedLogLevel = process.env.ORDERTEST_LOG_LEVEL;
    savedDebug = process.env.ORDERTEST_DEBUG;
    savedLogDir = process.env.ORDERTEST_LOG_DIR;
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
  });

  test.afterEach(async () => {
    if (savedLogLevel !== undefined) {
      process.env.ORDERTEST_LOG_LEVEL = savedLogLevel;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    }
    if (savedDebug !== undefined) {
      process.env.ORDERTEST_DEBUG = savedDebug;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    }
    if (savedLogDir !== undefined) {
      process.env.ORDERTEST_LOG_DIR = savedLogDir;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
    }
    createLogger({ logLevel: 'silent', logDir: tmpDir });
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('ORDERTEST_LOG_LEVEL env var does not cause a throw', () => {
    process.env.ORDERTEST_LOG_LEVEL = 'warn';
    expect(() => createLogger({ logLevel: 'info', logDir: tmpDir })).not.toThrow();
  });

  test('ORDERTEST_LOG_DIR env var overrides options.logDir — the env dir is created', async () => {
    const envDir = path.join(tmpDir, 'env-override-dir');
    process.env.ORDERTEST_LOG_DIR = envDir;
    createLogger({ logLevel: 'silent', logDir: path.join(tmpDir, 'ignored-dir') });
    const stat = await fs.stat(envDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('ORDERTEST_LOG_LEVEL=debug via env enables debug mode', () => {
    process.env.ORDERTEST_LOG_LEVEL = 'debug';
    createLogger({ logLevel: 'info', logDir: tmpDir });
    expect(isDebugEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// debugConsole
// ---------------------------------------------------------------------------

test.describe('debugConsole', () => {
  let tmpDir: string;
  let savedDebug: string | undefined;
  let savedLogLevel: string | undefined;
  let savedLogDir: string | undefined;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
    savedDebug = process.env.ORDERTEST_DEBUG;
    savedLogLevel = process.env.ORDERTEST_LOG_LEVEL;
    savedLogDir = process.env.ORDERTEST_LOG_DIR;
    Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
  });

  test.afterEach(async () => {
    if (savedDebug !== undefined) {
      process.env.ORDERTEST_DEBUG = savedDebug;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    }
    if (savedLogLevel !== undefined) {
      process.env.ORDERTEST_LOG_LEVEL = savedLogLevel;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    }
    if (savedLogDir !== undefined) {
      process.env.ORDERTEST_LOG_DIR = savedLogDir;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
    }
    // Reset debug state
    createLogger({ logLevel: 'silent', logDir: tmpDir });
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('does NOT write to stderr when debug mode is disabled', () => {
    createLogger({ logLevel: 'info', logDir: tmpDir, debug: false });
    const originalWrite = process.stderr.write.bind(process.stderr);
    const captured: string[] = [];
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      captured.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    };
    debugConsole('should not appear');
    process.stderr.write = originalWrite;
    expect(captured).toHaveLength(0);
  });

  test('does write to stderr when debug mode is enabled', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: true });
    const originalWrite = process.stderr.write.bind(process.stderr);
    const captured: string[] = [];
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      captured.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    };
    debugConsole('hello debug');
    process.stderr.write = originalWrite;
    expect(captured.length).toBeGreaterThan(0);
  });

  test('written message is prefixed with [ordertest:debug]', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: true });
    const originalWrite = process.stderr.write.bind(process.stderr);
    const captured: string[] = [];
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      captured.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    };
    debugConsole('my message');
    process.stderr.write = originalWrite;
    const output = captured.join('');
    expect(output).toContain('[ordertest:debug]');
  });

  test('written message contains the provided text', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: true });
    const originalWrite = process.stderr.write.bind(process.stderr);
    const captured: string[] = [];
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      captured.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    };
    debugConsole('unique-debug-message-12345');
    process.stderr.write = originalWrite;
    const output = captured.join('');
    expect(output).toContain('unique-debug-message-12345');
  });

  test('written message ends with newline', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: true });
    const originalWrite = process.stderr.write.bind(process.stderr);
    const captured: string[] = [];
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      captured.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    };
    debugConsole('newline test');
    process.stderr.write = originalWrite;
    const output = captured.join('');
    expect(output.endsWith('\n')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isDebugEnabled
// ---------------------------------------------------------------------------

test.describe('isDebugEnabled', () => {
  let tmpDir: string;
  let savedDebug: string | undefined;
  let savedLogLevel: string | undefined;
  let savedLogDir: string | undefined;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
    savedDebug = process.env.ORDERTEST_DEBUG;
    savedLogLevel = process.env.ORDERTEST_LOG_LEVEL;
    savedLogDir = process.env.ORDERTEST_LOG_DIR;
    Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
  });

  test.afterEach(async () => {
    if (savedDebug !== undefined) {
      process.env.ORDERTEST_DEBUG = savedDebug;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_DEBUG');
    }
    if (savedLogLevel !== undefined) {
      process.env.ORDERTEST_LOG_LEVEL = savedLogLevel;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_LEVEL');
    }
    if (savedLogDir !== undefined) {
      process.env.ORDERTEST_LOG_DIR = savedLogDir;
    } else {
      Reflect.deleteProperty(process.env, 'ORDERTEST_LOG_DIR');
    }
    createLogger({ logLevel: 'silent', logDir: tmpDir });
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns a boolean', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir });
    expect(typeof isDebugEnabled()).toBe('boolean');
  });

  test('reflects the last createLogger call debug resolution — false after silent', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: false });
    expect(isDebugEnabled()).toBe(false);
  });

  test('reflects the last createLogger call debug resolution — true after debug:true', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: true });
    expect(isDebugEnabled()).toBe(true);
  });

  test('changes when createLogger is called again with different debug setting', () => {
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: true });
    expect(isDebugEnabled()).toBe(true);
    createLogger({ logLevel: 'silent', logDir: tmpDir, debug: false });
    expect(isDebugEnabled()).toBe(false);
  });
});
