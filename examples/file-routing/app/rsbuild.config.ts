import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  output: {
    assetPrefix: 'http://localhost:3210/',
  },
  dev: {
    assetPrefix: 'http://localhost:3210/',
    // The remote is a built workspace package. Compile dynamic imports eagerly
    // so a route-module split never races a transient remote rebuild.
    lazyCompilation: false,
  },
  server: {
    port: 3210,
    strictPort: true,
    historyApiFallback: true,
  },
  plugins: [pluginReact()],
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({
          target: 'react',
          routesDirectory: './src/routes',
          generatedRouteTree: './src/routeTree.gen.ts',
          routeToken: /(?:route|remote)/,
          autoCodeSplitting: true,
        }),
      ],
    },
  },
})
