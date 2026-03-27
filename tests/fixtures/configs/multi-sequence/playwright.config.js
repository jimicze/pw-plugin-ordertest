import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineOrderedConfig } from '../../../../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.resolve(__dirname, '../../sample-specs');

export default defineOrderedConfig({
  testDir: specsDir,
  orderedTests: {
    logLevel: 'silent',
    sequences: [
      {
        name: 'checkout-flow',
        mode: 'serial',
        files: ['auth.spec.js', 'cart.spec.js', 'checkout.spec.js'],
      },
      {
        name: 'profile-flow',
        mode: 'serial',
        files: ['profile.spec.js'],
      },
    ],
  },
  reporter: 'dot',
});
