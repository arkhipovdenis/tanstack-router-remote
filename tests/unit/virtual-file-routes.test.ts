// Runs the real TanStack route generator over a scratch route directory.
//
// The claim under test is a compatibility one — that a mount declared as
// `createRemoteRoute(createFileRoute(...)({...}))` is accepted by the generator
// and needs no build-time transform — so imitating the generator would prove
// nothing. These tests invoke it and read the file it emits.

import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { Generator, getConfig } from '@tanstack/router-generator'
import { afterEach, describe, expect, it } from 'vitest'

const scratchDirs: string[] = []

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true })
  }
})

const ROOT_ROUTE = `import { Outlet, createRootRoute } from '@tanstack/react-router'
export const Route = createRootRoute({ component: () => <Outlet /> })
`

const INDEX_ROUTE = `import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({ component: () => <p>home</p> })
`

/** The documented mount form: the decoration is the exported value. */
const REMOTE_MOUNT = `import { Outlet, createFileRoute } from '@tanstack/react-router'
import { createRemoteRoute } from 'tanstack-router-remote'

export const Route = createRemoteRoute(
  createFileRoute('/catalog')({
    component: CatalogMount,
  }),
)

function CatalogMount() {
  return <Outlet />
}
`

// Kept inside the repository rather than the OS temp dir: routes.ts imports
// `@tanstack/virtual-file-routes`, which the generator resolves from the
// scratch project's own location.
const SCRATCH_PARENT = join(
  import.meta.dirname,
  '..',
  '..',
  'node_modules',
  '.tmp',
)

function createScratchProject(files: Record<string, string>) {
  mkdirSync(SCRATCH_PARENT, { recursive: true })
  const dir = mkdtempSync(join(SCRATCH_PARENT, 'tsr-remote-virtual-'))
  scratchDirs.push(dir)

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = join(dir, relativePath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, contents)
  }

  return dir
}

async function generate(root: string, virtualRouteConfig?: string) {
  const config = await getConfig(
    {
      routesDirectory: './routes',
      generatedRouteTree: './routeTree.gen.ts',
      disableLogging: true,
      ...(virtualRouteConfig ? { virtualRouteConfig } : {}),
    },
    root,
  )

  await new Generator({ config, root }).run()

  return readFileSync(join(root, 'routeTree.gen.ts'), 'utf8')
}

/** Route paths the generator committed to its generated tree. */
function routePathsOf(routeTree: string) {
  return [
    ...new Set(
      [...routeTree.matchAll(/^\s*'(\/[^']*)': typeof /gm)].map(
        (match) => match[1],
      ),
    ),
  ].sort()
}

describe('virtual file routes', () => {
  it('accepts a wrapped remote mount whose path comes from the virtual config', async () => {
    // The file is named `catalog-mount.tsx` and lives nowhere near a `/catalog`
    // directory: with virtual routes the URL is assigned by routes.ts, so this
    // proves the generator reads through the createRemoteRoute() wrapper rather
    // than inferring anything from the filename.
    const root = createScratchProject({
      'routes/__root.tsx': ROOT_ROUTE,
      'routes/home.tsx': INDEX_ROUTE,
      'routes/catalog-mount.tsx': REMOTE_MOUNT,
      'routes.ts': `import { rootRoute, route, index } from '@tanstack/virtual-file-routes'
export const routes = rootRoute('__root.tsx', [
  index('home.tsx'),
  route('/catalog', 'catalog-mount.tsx'),
])
`,
    })

    const routeTree = await generate(root, './routes.ts')

    expect(routePathsOf(routeTree)).toEqual(['/', '/catalog'])
    expect(routeTree).toContain("from './routes/catalog-mount'")
  })

  it('opts the file out of the generator path auto-correction', async () => {
    // A real trade-off of the wrapper form, asserted so it is not discovered in
    // the field. In physical routing the generator rewrites a route file whose
    // createFileRoute() path disagrees with its location — but only when the
    // call is the direct export initializer. Wrapped, the file is left alone
    // and a wrong path stays wrong.
    const wrongPath = REMOTE_MOUNT.replace("'/catalog'", "'/WRONG'")
    const unwrapped = `import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/WRONG')({ component: () => null })
`

    const wrappedRoot = createScratchProject({
      'routes/__root.tsx': ROOT_ROUTE,
      'routes/index.tsx': INDEX_ROUTE,
      'routes/catalog.tsx': wrongPath,
    })
    const unwrappedRoot = createScratchProject({
      'routes/__root.tsx': ROOT_ROUTE,
      'routes/index.tsx': INDEX_ROUTE,
      'routes/catalog.tsx': unwrapped,
    })

    await generate(wrappedRoot)
    await generate(unwrappedRoot)

    const pathIn = (root: string) =>
      readFileSync(join(root, 'routes/catalog.tsx'), 'utf8').match(
        /createFileRoute\('([^']*)'\)/,
      )?.[1]

    expect(pathIn(unwrappedRoot)).toBe('/catalog')
    expect(pathIn(wrappedRoot)).toBe('/WRONG')
  })

  it('leaves the wrapped source file untouched', async () => {
    const root = createScratchProject({
      'routes/__root.tsx': ROOT_ROUTE,
      'routes/home.tsx': INDEX_ROUTE,
      'routes/catalog-mount.tsx': REMOTE_MOUNT,
      'routes.ts': `import { rootRoute, route, index } from '@tanstack/virtual-file-routes'
export const routes = rootRoute('__root.tsx', [
  index('home.tsx'),
  route('/catalog', 'catalog-mount.tsx'),
])
`,
    })
    const mountPath = join(root, 'routes/catalog-mount.tsx')
    const before = readFileSync(mountPath, 'utf8')
    const mtimeBefore = statSync(mountPath).mtimeMs

    await generate(root, './routes.ts')

    // The generator does rewrite route files it considers malformed, so this is
    // the assertion that no build-time transform is needed: byte-identical and
    // never rewritten.
    expect(readFileSync(mountPath, 'utf8')).toBe(before)
    expect(statSync(mountPath).mtimeMs).toBe(mtimeBefore)
    expect(before).toContain('createRemoteRoute(')
  })

  it('mounts a wrapped remote route inside a virtual layout', async () => {
    const root = createScratchProject({
      'routes/__root.tsx': ROOT_ROUTE,
      'routes/home.tsx': INDEX_ROUTE,
      'routes/catalog-mount.tsx': REMOTE_MOUNT,
      'routes/shell.tsx': `import { Outlet, createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/_shell')({ component: () => <Outlet /> })
`,
      'routes.ts': `import { rootRoute, index, layout, route } from '@tanstack/virtual-file-routes'
export const routes = rootRoute('__root.tsx', [
  index('home.tsx'),
  layout('shell.tsx', [route('/catalog', 'catalog-mount.tsx')]),
])
`,
    })

    const routeTree = await generate(root, './routes.ts')

    // The mount composes under a pathless layout: its URL stays /catalog while
    // the layout owns an extra match above it.
    expect(routePathsOf(routeTree)).toContain('/catalog')
    expect(routeTree).toContain("'/_shell'")

    // The generated *id* carries the layout segment even though path and
    // fullPath do not. `createFileRoute` is keyed by that id, so a mount moved
    // under a layout has to declare '/_shell/catalog' — easy to trip over, and
    // a type error rather than a silent mismatch.
    expect(routeTree).toContain("'/_shell/catalog': {")
    expect(routeTree).toMatch(/'\/_shell\/catalog': \{[^}]*path: '\/catalog'/)
    expect(routeTree).toMatch(
      /'\/_shell\/catalog': \{[^}]*fullPath: '\/catalog'/,
    )
  })

  it('accepts the same wrapped mount without any virtual config', async () => {
    // The physical-routing baseline, asserted here so a regression in either
    // mode is attributable.
    const root = createScratchProject({
      'routes/__root.tsx': ROOT_ROUTE,
      'routes/index.tsx': INDEX_ROUTE,
      'routes/catalog.tsx': REMOTE_MOUNT,
    })

    const routeTree = await generate(root)

    expect(routePathsOf(routeTree)).toEqual(['/', '/catalog'])
  })
})
