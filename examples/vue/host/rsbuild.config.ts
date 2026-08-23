import { defineConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'
import { pluginBabel } from '@rsbuild/plugin-babel'

export default defineConfig({
  source: { entry: { index: './src/index.ts' } },
  html: { title: 'Vue host — tanstack-router-remote' },
  server: { port: 3400, strictPort: true, historyApiFallback: true },
  output: { assetPrefix: '/vue/' },
  plugins: [
    pluginVue(),
    // Vue JSX compiles to `createVNode`; without this pass rsbuild's default
    // SWC transform treats .tsx as React and the bundle fails with
    // "React is not defined".
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
      babelLoaderOptions: (_, { addPlugins }) => {
        addPlugins(['@vue/babel-plugin-jsx'])
      },
    }),
  ],
})
