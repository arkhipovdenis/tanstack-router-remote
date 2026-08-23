import { defineConfig } from '@rslib/core'
import { pluginBabel } from '@rsbuild/plugin-babel'
import { pluginSolid } from '@rsbuild/plugin-solid'

// Transpile-only, one output file per source file, for every lib below. Keeps
// `dist/` shaped like `src/`, so the exports map, `sideEffects: false` and
// consumer-side tree-shaking behave as they did under `tsc`.
const shared = {
  format: 'esm',
  bundle: false,
  syntax: ['node 20', 'chrome 111', 'firefox 128', 'safari 16.4'],
  dts: { build: true },
} as const

export default defineConfig({
  lib: [
    {
      ...shared,
      // The neutral core and the package root. There is no JSX here at all -
      // these are plain .ts files - so this lib carries no framework
      // transform, and neither framework's settings apply to it.
      id: 'core',
      source: {
        entry: {
          index: ['./src/index.ts', './src/core/**/*.ts'],
        },
        tsconfigPath: './tsconfig.build.core.json',
      },
    },
    {
      ...shared,
      // React JSX must use the automatic runtime: the classic one emits bare
      // `React.createElement` with no import, which only works when a bundler
      // happens to supply the global.
      id: 'react',
      source: {
        entry: {
          index: ['./src/react/**/*.ts', './src/react/**/*.tsx'],
        },
        tsconfigPath: './tsconfig.build.react.json',
      },
      output: {
        distPath: { js: 'react' },
      },
      tools: {
        swc: {
          jsc: { transform: { react: { runtime: 'automatic' } } },
        },
      },
    },
    {
      ...shared,
      // Solid compiles JSX into its own reactive calls rather than to a
      // createElement-style runtime, so it needs its own pass with its own
      // plugin over its own files.
      id: 'solid',
      source: {
        entry: {
          index: ['./src/solid/**/*.ts', './src/solid/**/*.tsx'],
        },
        tsconfigPath: './tsconfig.build.solid.json',
      },
      output: {
        distPath: { js: 'solid' },
      },
      // Solid needs its own Babel transform: its JSX compiles to
      // `template`/`insert`/`createComponent` calls, and `solid-js/jsx-runtime`
      // deliberately exports no `jsx`, so an SWC automatic-runtime pass emits
      // imports that do not exist.
      plugins: [
        pluginBabel({
          include: /\.(?:jsx|tsx)$/,
          babelLoaderOptions: (_, { addPresets }) => {
            addPresets(['babel-preset-solid'])
          },
        }),
        pluginSolid(),
      ],
    },
    {
      ...shared,
      // Vue needs no JSX transform: these components are written with
      // `defineComponent` + `h()`, so they are plain .ts files.
      id: 'vue',
      source: {
        entry: {
          index: ['./src/vue/**/*.ts'],
        },
        tsconfigPath: './tsconfig.build.vue.json',
      },
      output: {
        distPath: { js: 'vue' },
      },
    },
  ],
  output: {
    target: 'web',
    cleanDistPath: true,
    sourceMap: {
      js: 'source-map',
    },
  },
})
