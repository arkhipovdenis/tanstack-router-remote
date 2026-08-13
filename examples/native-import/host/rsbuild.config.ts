import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  output: {
    assetPrefix: 'http://localhost:3200/',
  },
  dev: {
    assetPrefix: 'http://localhost:3200/',
  },
  server: {
    port: 3200,
    strictPort: true,
    historyApiFallback: true,
  },
  plugins: [pluginReact()],
})
