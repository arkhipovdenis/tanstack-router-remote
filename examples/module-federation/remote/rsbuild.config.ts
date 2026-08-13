import { defineConfig } from '@rsbuild/core'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { pluginReact } from '@rsbuild/plugin-react'

const shared = {
  react: { singleton: true, requiredVersion: false as const },
  'react/': { singleton: true, requiredVersion: false as const },
  'react/jsx-runtime': { singleton: true, requiredVersion: false as const },
  'react-dom': { singleton: true, requiredVersion: false as const },
  'react-dom/': { singleton: true, requiredVersion: false as const },
  'react-dom/client': { singleton: true, requiredVersion: false as const },
  '@tanstack/react-router': { singleton: true, requiredVersion: false as const },
  '@tanstack/router-core': { singleton: true, requiredVersion: false as const },
  '@tanstack/history': { singleton: true, requiredVersion: false as const },
  '@tanstack-router-remote/route-tree-adapter': {
    singleton: true,
    requiredVersion: false as const,
  },
}

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  output: {
    assetPrefix: 'http://localhost:3101/',
  },
  dev: {
    assetPrefix: 'http://localhost:3101/',
  },
  server: {
    port: 3101,
    strictPort: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:3100',
    },
  },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'orders',
      filename: 'remoteEntry.js',
      manifest: true,
      dts: false,
      remotes: {
        invoices: 'invoices@http://localhost:3102/mf-manifest.json',
      },
      exposes: {
        './routeTree': './src/routeTree.tsx',
      },
      shared,
    }),
  ],
})
