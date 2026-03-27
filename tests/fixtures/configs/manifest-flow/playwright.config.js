import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineOrderedConfigAsync } from '../../../../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.resolve(__dirname, '../../sample-specs');

export default defineOrderedConfigAsync({
  testDir: specsDir,
  orderedTests: {
    logLevel: 'silent',
    manifest: path.join(__dirname, '../../manifests/serial-manifest.json'),
  },
  reporter: 'dot',
});
