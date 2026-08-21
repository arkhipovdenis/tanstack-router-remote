import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      // Transpile-only, one output file per source file. Keeps `dist/` shaped
      // like `src/`, so the exports map, `sideEffects: false` and consumer-side
      // tree-shaking behave exactly as they did under `tsc`.
      bundle: false,
      dts: {
        build: true,
      },
      syntax: ['node 20', 'chrome 111', 'firefox 128', 'safari 16.4'],
    },
  ],
  source: {
    entry: {
      index: ['./src/**/*.ts', './src/**/*.tsx'],
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    target: 'web',
    cleanDistPath: true,
    sourceMap: {
      js: 'source-map',
    },
  },
})
