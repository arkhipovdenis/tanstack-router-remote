import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rspack } from '@rspack/core'

import { tanstackRouterRemoteAdapter } from '../dist/index.js'

const fixturePath = fileURLToPath(
  new URL('../fixtures/basic/', import.meta.url),
)
const outputPath = await mkdtemp(join(tmpdir(), 'rspack-remote-route-smoke-'))
const compiler = rspack({
  context: fixturePath,
  mode: 'development',
  devtool: false,
  entry: './entry.ts',
  output: {
    path: outputPath,
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  optimization: {
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    tanstackRouterRemoteAdapter({
      adapterPackage: './adapter',
    }),
  ],
})

try {
  const stats = await runCompiler(compiler)
  const errors = stats.toJson({ all: false, errors: true }).errors

  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join('\n'))
  }

  const bundle = await readFile(join(outputPath, 'bundle.js'), 'utf8')
  const routeDeclaration = /(?:var|const)\s+Route\s*=\s*createFileRoute\(['"]\/orders['"]\)\(/.exec(
    bundle,
  )
  const remoteDecoration = /createRemoteRoute\)\(Route\)/.exec(bundle)

  if (!routeDeclaration || !remoteDecoration) {
    throw new Error(
      'Rspack remote-route transform did not emit both Route and createRemoteRoute(Route).',
    )
  }

  if (remoteDecoration.index <= routeDeclaration.index) {
    throw new Error(
      'Rspack remote-route transform decorated Route before its direct createFileRoute declaration.',
    )
  }

  console.log('Rspack remote-route smoke passed.')
} finally {
  await closeCompiler(compiler)
  await rm(outputPath, { recursive: true, force: true })
}

function runCompiler(compilerInstance) {
  return new Promise((resolve, reject) => {
    compilerInstance.run((error, stats) => {
      if (error) {
        reject(error)
        return
      }

      if (!stats) {
        reject(new Error('Rspack completed without compilation stats.'))
        return
      }

      resolve(stats)
    })
  })
}

function closeCompiler(compilerInstance) {
  return new Promise((resolve, reject) => {
    compilerInstance.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
