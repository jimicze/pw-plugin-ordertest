import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'reporter/orderedHtmlReporter': 'src/reporter/orderedHtmlReporter.ts',
    'reporter/customHtmlReporter': 'src/reporter/customHtmlReporter.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: ['@playwright/test'],
  outDir: 'dist',
});
