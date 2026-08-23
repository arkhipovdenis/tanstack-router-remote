import { defineConfig } from '@rslib/core'
import { pluginBabel } from '@rsbuild/plugin-babel'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      bundle: false,
      syntax: ['chrome 111', 'firefox 128', 'safari 16.4'],
      dts: { build: true },
    },
  ],
  source: {
    entry: { index: ['./src/**/*.tsx'] },
    tsconfigPath: './tsconfig.build.json',
  },
  plugins: [
    // Vue JSX compiles to `createVNode` calls through its own Babel plugin.
    // @rsbuild/plugin-vue-jsx does not take effect under rslib's transpile
    // mode, so the Babel pass is wired directly - the same shape the Solid
    // remote needs.
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
      babelLoaderOptions: (_, { addPlugins }) => {
        addPlugins(['@vue/babel-plugin-jsx'])
      },
    }),
  ],
  output: { target: 'web', cleanDistPath: true },
})
