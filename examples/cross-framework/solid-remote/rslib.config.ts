import { defineConfig } from '@rslib/core'
import { pluginBabel } from '@rsbuild/plugin-babel'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      bundle: false,
      syntax: ['chrome 111', 'firefox 128', 'safari 16.4'],
      dts: { build: true },
      // Same reason as the adapter's Solid lib: Solid's JSX compiles to
      // `solid-js/web` calls, which only its Babel preset emits.
      plugins: [
        pluginBabel({
          include: /\.(?:jsx|tsx)$/,
          babelLoaderOptions: (_, { addPresets }) => {
            addPresets(['babel-preset-solid'])
          },
        }),
      ],
    },
  ],
  source: {
    entry: { index: ['./src/**/*.ts', './src/**/*.tsx'] },
    tsconfigPath: './tsconfig.build.json',
  },
  output: { target: 'web', cleanDistPath: true },
})
