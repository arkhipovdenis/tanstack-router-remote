import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  source: { entry: { client: './src/client.tsx' } },
  output: {
    distPath: { root: 'dist/client' },
    filename: { js: '[name].js' },
    assetPrefix: '/',
  },
  plugins: [pluginReact()],
})
