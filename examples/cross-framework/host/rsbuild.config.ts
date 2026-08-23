import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  source: { entry: { index: './src/index.ts' } },
  html: { title: 'Cross-framework host — tanstack-router-remote' },
  server: { port: 3500, strictPort: true, historyApiFallback: true },
  output: { assetPrefix: '/cross/' },
  plugins: [pluginReact()],
})
