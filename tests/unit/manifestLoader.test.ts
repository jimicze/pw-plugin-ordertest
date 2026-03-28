import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { discoverManifest, loadManifest } from '../../src/config/manifestLoader.js';
import { OrderTestManifestError } from '../../src/errors/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ordertest-manifest-'));
}

const VALID_JSON = JSON.stringify({
  sequences: [{ name: 'my-sequence', mode: 'serial', files: ['a.spec.ts', 'b.spec.ts'] }],
});

const VALID_YAML =
  'sequences:\n  - name: my-sequence\n    mode: serial\n    files:\n      - a.spec.ts\n      - b.spec.ts\n';

// ---------------------------------------------------------------------------
// discoverManifest
// ---------------------------------------------------------------------------

test.describe('discoverManifest', () => {
  let tmpDir: string;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  test.afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('returns undefined when no candidate files exist', async () => {
    const result = await discoverManifest(tmpDir);
    expect(result).toBeUndefined();
  });

  test('discovers ordertest.config.json', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.json'), VALID_JSON);
    const result = await discoverManifest(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'ordertest.config.json'));
  });

  test('discovers ordertest.config.yaml when only yaml exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.yaml'), VALID_YAML);
    const result = await discoverManifest(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'ordertest.config.yaml'));
  });

  test('discovers ordertest.config.yml when only yml exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.yml'), VALID_YAML);
    const result = await discoverManifest(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'ordertest.config.yml'));
  });

  test('ts wins over json when both exist', async () => {
    // ordertest.config.ts must be first in priority. We write both but don't
    // need it to be importable — discovery only checks existence via fs.access.
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.ts'), '// stub');
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.json'), VALID_JSON);
    const result = await discoverManifest(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'ordertest.config.ts'));
  });

  test('json wins over yaml when both exist (no ts)', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.json'), VALID_JSON);
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.yaml'), VALID_YAML);
    const result = await discoverManifest(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'ordertest.config.json'));
  });

  test('yaml wins over yml when both exist (no ts, no json)', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.yaml'), VALID_YAML);
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.yml'), VALID_YAML);
    const result = await discoverManifest(tmpDir);
    expect(result).toBe(path.join(tmpDir, 'ordertest.config.yaml'));
  });

  test('returned path is an absolute path', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.json'), VALID_JSON);
    const result = await discoverManifest(tmpDir);
    expect(result).not.toBeUndefined();
    expect(path.isAbsolute(result as string)).toBe(true);
  });

  test('uses the provided rootDir, not cwd', async () => {
    // Put the file only in tmpDir — cwd does NOT have the file
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.json'), VALID_JSON);
    const result = await discoverManifest(tmpDir);
    expect(result).toContain(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// loadManifest — explicit path
// ---------------------------------------------------------------------------

test.describe('loadManifest — explicit path', () => {
  let tmpDir: string;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  test.afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('throws OrderTestManifestError when explicit path file does not exist', async () => {
    const missing = path.join(tmpDir, 'missing.json');
    await expect(loadManifest({ manifestPath: missing, rootDir: tmpDir })).rejects.toThrow(
      OrderTestManifestError,
    );
  });

  test('error message mentions the missing file path', async () => {
    const missing = path.join(tmpDir, 'missing.json');
    let errorMessage = '';
    try {
      await loadManifest({ manifestPath: missing, rootDir: tmpDir });
    } catch (e) {
      if (e instanceof Error) {
        errorMessage = e.message;
      }
    }
    expect(errorMessage).toContain('missing.json');
  });

  test('throws OrderTestManifestError for unsupported extension', async () => {
    const tomlPath = path.join(tmpDir, 'manifest.toml');
    await fs.writeFile(tomlPath, '[sequences]');
    await expect(loadManifest({ manifestPath: tomlPath, rootDir: tmpDir })).rejects.toThrow(
      OrderTestManifestError,
    );
  });

  test('unsupported extension error mentions the extension', async () => {
    const tomlPath = path.join(tmpDir, 'manifest.toml');
    await fs.writeFile(tomlPath, '[sequences]');
    let errorMessage = '';
    try {
      await loadManifest({ manifestPath: tomlPath, rootDir: tmpDir });
    } catch (e) {
      if (e instanceof Error) {
        errorMessage = e.message;
      }
    }
    expect(errorMessage).toContain('.toml');
  });

  test('loads a valid JSON manifest from explicit path', async () => {
    const jsonPath = path.join(tmpDir, 'manifest.json');
    await fs.writeFile(jsonPath, VALID_JSON);
    const manifest = await loadManifest({ manifestPath: jsonPath, rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
    expect(manifest.sequences[0]?.name).toBe('my-sequence');
  });

  test('loads a valid YAML manifest from explicit path (.yaml)', async () => {
    const yamlPath = path.join(tmpDir, 'manifest.yaml');
    await fs.writeFile(yamlPath, VALID_YAML);
    const manifest = await loadManifest({ manifestPath: yamlPath, rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
    expect(manifest.sequences[0]?.mode).toBe('serial');
  });

  test('loads a valid YAML manifest from explicit path (.yml)', async () => {
    const ymlPath = path.join(tmpDir, 'manifest.yml');
    await fs.writeFile(ymlPath, VALID_YAML);
    const manifest = await loadManifest({ manifestPath: ymlPath, rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
    expect(manifest.sequences[0]?.files).toContain('a.spec.ts');
  });

  test('throws when JSON file has invalid JSON syntax', async () => {
    const jsonPath = path.join(tmpDir, 'bad.json');
    await fs.writeFile(jsonPath, '{ invalid json }');
    await expect(loadManifest({ manifestPath: jsonPath, rootDir: tmpDir })).rejects.toThrow(
      OrderTestManifestError,
    );
  });

  test('throws when YAML file has invalid YAML syntax', async () => {
    const yamlPath = path.join(tmpDir, 'bad.yaml');
    // Tabs in YAML are invalid
    await fs.writeFile(yamlPath, 'sequences:\n\t- name: broken');
    await expect(loadManifest({ manifestPath: yamlPath, rootDir: tmpDir })).rejects.toThrow(
      OrderTestManifestError,
    );
  });

  test('throws when JSON parses but fails manifest validation (missing sequences)', async () => {
    const jsonPath = path.join(tmpDir, 'invalid.json');
    await fs.writeFile(jsonPath, JSON.stringify({ notSequences: [] }));
    await expect(loadManifest({ manifestPath: jsonPath, rootDir: tmpDir })).rejects.toThrow(
      OrderTestManifestError,
    );
  });

  test('returned manifest sequences match the written file', async () => {
    const content = JSON.stringify({
      sequences: [
        { name: 'alpha', mode: 'parallel', files: ['x.spec.ts'] },
        { name: 'beta', mode: 'fullyParallel', files: ['y.spec.ts', 'z.spec.ts'] },
      ],
    });
    const jsonPath = path.join(tmpDir, 'multi.json');
    await fs.writeFile(jsonPath, content);
    const manifest = await loadManifest({ manifestPath: jsonPath, rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(2);
    expect(manifest.sequences[0]?.name).toBe('alpha');
    expect(manifest.sequences[1]?.name).toBe('beta');
    expect(manifest.sequences[1]?.files).toHaveLength(2);
  });

  test('manifestPath is resolved relative to rootDir when it is a relative path', async () => {
    // Write the file into tmpDir/sub/
    const subDir = path.join(tmpDir, 'sub');
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(path.join(subDir, 'my.json'), VALID_JSON);
    // Provide a relative manifestPath — the loader resolves it against rootDir
    const manifest = await loadManifest({ manifestPath: 'sub/my.json', rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// loadManifest — auto-discovery
// ---------------------------------------------------------------------------

test.describe('loadManifest — auto-discovery', () => {
  let tmpDir: string;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  test.afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('throws when no manifest files found in rootDir', async () => {
    await expect(loadManifest({ rootDir: tmpDir })).rejects.toThrow(OrderTestManifestError);
  });

  test('error message mentions the rootDir when no files found', async () => {
    let errorMessage = '';
    try {
      await loadManifest({ rootDir: tmpDir });
    } catch (e) {
      if (e instanceof Error) {
        errorMessage = e.message;
      }
    }
    expect(errorMessage).toContain(tmpDir);
  });

  test('error message lists the candidate file names', async () => {
    let errorMessage = '';
    try {
      await loadManifest({ rootDir: tmpDir });
    } catch (e) {
      if (e instanceof Error) {
        errorMessage = e.message;
      }
    }
    expect(errorMessage).toMatch(/ordertest\.config\.(ts|json|yaml|yml)/);
  });

  test('auto-discovers JSON manifest and loads it', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.json'), VALID_JSON);
    const manifest = await loadManifest({ rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
    expect(manifest.sequences[0]?.name).toBe('my-sequence');
  });

  test('auto-discovers YAML manifest (.yaml) and loads it', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.yaml'), VALID_YAML);
    const manifest = await loadManifest({ rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
    expect(manifest.sequences[0]?.mode).toBe('serial');
  });

  test('auto-discovers YAML manifest (.yml) and loads it', async () => {
    await fs.writeFile(path.join(tmpDir, 'ordertest.config.yml'), VALID_YAML);
    const manifest = await loadManifest({ rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// loadManifest — TypeScript manifest
// ---------------------------------------------------------------------------

test.describe('loadManifest — TypeScript manifest', () => {
  let tmpDir: string;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  test.afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('throws OrderTestManifestError for a .ts file that has no default export', async () => {
    const tsPath = path.join(tmpDir, 'manifest.ts');
    // Named export only — no default export
    await fs.writeFile(tsPath, 'export const sequences = [];');
    await expect(loadManifest({ manifestPath: tsPath, rootDir: tmpDir })).rejects.toThrow(
      OrderTestManifestError,
    );
  });

  test('throws OrderTestManifestError when .ts file fails to import', async () => {
    const tsPath = path.join(tmpDir, 'broken.ts');
    // Syntax error that will cause the import to fail
    await fs.writeFile(tsPath, 'export default { this is not valid TS syntax {{{{ }');
    await expect(loadManifest({ manifestPath: tsPath, rootDir: tmpDir })).rejects.toThrow(
      OrderTestManifestError,
    );
  });
});

// ---------------------------------------------------------------------------
// loadManifest — ORDERTEST_MANIFEST env var
// ---------------------------------------------------------------------------

test.describe('loadManifest — ORDERTEST_MANIFEST env var', () => {
  let tmpDir: string;

  test.beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  test.afterEach(async () => {
    Reflect.deleteProperty(process.env, 'ORDERTEST_MANIFEST');
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('env var takes priority over explicit manifestPath', async () => {
    // Write two distinct manifests so we can tell which one was loaded
    const envContent = JSON.stringify({
      sequences: [{ name: 'from-env', mode: 'serial', files: ['env.spec.ts'] }],
    });
    const optContent = JSON.stringify({
      sequences: [{ name: 'from-option', mode: 'serial', files: ['opt.spec.ts'] }],
    });
    const envPath = path.join(tmpDir, 'env-manifest.json');
    const optPath = path.join(tmpDir, 'opt-manifest.json');
    await fs.writeFile(envPath, envContent);
    await fs.writeFile(optPath, optContent);

    process.env.ORDERTEST_MANIFEST = envPath;

    const manifest = await loadManifest({ manifestPath: optPath, rootDir: tmpDir });
    expect(manifest.sequences[0]?.name).toBe('from-env');
  });

  test('empty env var is ignored (falls back to manifestPath)', async () => {
    const jsonPath = path.join(tmpDir, 'manifest.json');
    await fs.writeFile(jsonPath, VALID_JSON);

    process.env.ORDERTEST_MANIFEST = '';

    const manifest = await loadManifest({ manifestPath: jsonPath, rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
    expect(manifest.sequences[0]?.name).toBe('my-sequence');
  });

  test('env var path is resolved against rootDir', async () => {
    const subDir = path.join(tmpDir, 'sub');
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(path.join(subDir, 'env-manifest.json'), VALID_JSON);

    process.env.ORDERTEST_MANIFEST = 'sub/env-manifest.json';

    const manifest = await loadManifest({ rootDir: tmpDir });
    expect(manifest.sequences).toHaveLength(1);
    expect(manifest.sequences[0]?.name).toBe('my-sequence');
  });

  test('throws OrderTestManifestError when env var points to non-existent file', async () => {
    process.env.ORDERTEST_MANIFEST = 'nonexistent.json';

    await expect(loadManifest({ rootDir: tmpDir })).rejects.toThrow(OrderTestManifestError);
  });

  test('error message mentions ORDERTEST_MANIFEST when env var is used and file is missing', async () => {
    process.env.ORDERTEST_MANIFEST = 'nonexistent.json';

    let errorMessage = '';
    try {
      await loadManifest({ rootDir: tmpDir });
    } catch (e) {
      if (e instanceof Error) {
        errorMessage = e.message;
      }
    }
    expect(errorMessage).toContain('ORDERTEST_MANIFEST');
  });
});
