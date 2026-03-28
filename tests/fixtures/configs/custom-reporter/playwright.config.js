import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineOrderedConfig } from '../../../../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specsDir = path.resolve(__dirname, '../../sample-specs');

// The integration test sets ORDERTEST_CUSTOM_REPORT_PATH to a temp file path.
const reportOutputFile = process.env.ORDERTEST_CUSTOM_REPORT_PATH || 'ordertest-report.html';

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
        mode: 'parallel',
        files: ['profile.spec.js'],
      },
    ],
  },
  reporter: [
    ['dot'],
    [
      path.resolve(__dirname, '../../../../dist/reporter/customHtmlReporter.js'),
      {
        outputFile: reportOutputFile,
        showTimeline: true,
        showSummary: true,
        showDependencyGraph: true,
        showShardDistribution: true,
        logLevel: 'silent',
      },
    ],
  ],
});
