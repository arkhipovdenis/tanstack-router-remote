// Installs the published artifact outside the workspace; keeps evidence on failure.
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../', import.meta.url))
const output = await mkdtemp(join(tmpdir(), 'router-consumers-'))
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
run(
  'npm',
  ['pack', '--pack-destination', output],
  join(repo, 'packages/route-tree-adapter'),
)
const manifest = JSON.parse(
  await readFile(
    join(repo, 'packages/route-tree-adapter/package.json'),
    'utf8',
  ),
)
const catalog = await readFile(join(repo, 'pnpm-workspace.yaml'), 'utf8')
const version = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = catalog.match(new RegExp(`^  '?${escaped}'?: ([^\\s]+)$`, 'm'))
  if (!match) throw new Error(`Missing catalog version: ${name}`)
  return match[1]
}
for (const framework of ['react', 'solid', 'vue']) {
  const dir = join(output, framework)
  await mkdir(dir)
  const router = `@tanstack/${framework}-router`
  const peers =
    framework === 'react'
      ? ['react', 'react-dom', '@types/react', '@types/react-dom']
      : framework === 'solid'
        ? ['solid-js']
        : ['vue']
  const dependencies = Object.fromEntries(
    [
      router,
      '@tanstack/router-core',
      'typescript',
      '@rsbuild/core',
      ...peers,
    ].map((name) => [name, version(name)]),
  )
  dependencies['tanstack-router-remote'] =
    `file:../tanstack-router-remote-${manifest.version}.tgz`
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies }, null, 2),
  )
  await writeFile(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        skipLibCheck: true,
      },
      include: ['src.ts'],
    }),
  )
  await writeFile(
    join(dir, 'rsbuild.config.mjs'),
    "export default { source: { entry: { index: './src.ts' } } }\n",
  )
  await writeFile(
    join(dir, 'src.ts'),
    `import { createRootRoute, createRoute, createRouter, createMemoryHistory } from '${router}'
import { createRemoteRoute, RemoteRouterAdapter, resolveRemotePath } from 'tanstack-router-remote/${framework}'
const root = createRootRoute()
const mount = createRemoteRoute({ getParentRoute: () => root, path: '/remote' })
const router = createRouter({ routeTree: root.addChildren([mount]), history: createMemoryHistory() })
const adapter = new RemoteRouterAdapter(() => router)
const remote = createRootRoute()
const child = createRoute({ getParentRoute: () => remote, path: '/' })
void adapter.prepare({ mountRoute: mount, loadRouteTree: async () => remote.addChildren([child]) }).then(() => {
  document.body.textContent = adapter.getSnapshot(mount).state + resolveRemotePath(router, '/remote')
})
`,
  )
  console.log(`Consumer: ${framework} at ${dir}`)
  run('npm', ['install', '--no-audit', '--no-fund'], dir)
  run(join(dir, 'node_modules/.bin/tsc'), ['--noEmit'], dir)
  run(join(dir, 'node_modules/.bin/rsbuild'), ['build'], dir)
  if (framework === 'react') {
    const readme = await readFile(join(repo, 'README.md'), 'utf8')
    const snippets = [...readme.matchAll(/```tsx\n([\s\S]*?)```/g)].map(
      (match) => match[1],
    )
    if (snippets.length !== 2)
      throw new Error('Expected the two complete README files')
    await writeFile(join(dir, 'remote.tsx'), snippets[0])
    await writeFile(join(dir, 'main.tsx'), snippets[1])
    await writeFile(
      join(dir, 'tsconfig.docs.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          skipLibCheck: true,
        },
        include: ['main.tsx', 'remote.tsx'],
      }),
    )
    run(join(dir, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.docs.json'], dir)
  }
}
console.log(`All packed consumers passed. Artifacts: ${output}`)
