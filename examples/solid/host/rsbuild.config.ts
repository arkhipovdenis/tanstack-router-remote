import { defineConfig } from '@rsbuild/core'
import { pluginBabel } from '@rsbuild/plugin-babel'

export default defineConfig({
  source: {
    entry: { index: './src/index.ts' },
  },
  html: { title: 'Solid host — tanstack-router-remote' },
  server: { port: 3300, strictPort: true, historyApiFallback: true },
  output: { assetPrefix: '/solid/' },
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
      babelLoaderOptions: (_, { addPresets }) => {
        addPresets(['babel-preset-solid'])
      },
    }),
  ],
})
