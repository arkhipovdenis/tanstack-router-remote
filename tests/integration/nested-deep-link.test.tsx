// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Outlet,
  notFound,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createRemoteRoute,
  RemoteRouteMount,
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from '../../packages/route-tree-adapter/src/react'

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const settle = async () => {
  for (let index = 0; index < 8; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

type Level = {
  /** Path segment this level's mount occupies in its parent tree. */
  segment: string
  loadTree: ReturnType<typeof vi.fn>
}

/**
 * Builds a chain of remote trees, each containing the mount for the next one.
 * The innermost tree ends in a `/$leafId` detail route.
 *
 * levels[0] is the host mount; every deeper level is a mount that only exists
 * once its parent tree has been grafted — which is the whole point: a direct
 * deep link has to attach all of them in sequence, with no navigation between.
 */
function createChain(depth: number, leafLoader: () => unknown) {
  const levels: Level[] = []

  const buildTree = (level: number): AnyRoute => {
    const root = createRootRoute({
      component: () => (
        <section data-testid={`level-${level}-root`}>
          <Outlet />
        </section>
      ),
      notFoundComponent: () => (
        <p data-testid={`level-${level}-404`}>level {level} 404</p>
      ),
    })

    const index = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => (
        <p data-testid={`level-${level}-index`}>level-{level}-index</p>
      ),
    })

    if (level === depth) {
      const leaf = createRoute({
        getParentRoute: () => root,
        path: '/$leafId',
        loader: leafLoader,
        component: () => <p data-testid="leaf-detail">leaf-detail</p>,
      })

      return root.addChildren([index, leaf])
    }

    const segment = `level${level + 1}`
    const loadTree = vi.fn(async () => buildTree(level + 1))
    levels.push({ segment, loadTree })

    const mount = createRemoteRoute({
      getParentRoute: () => root,
      path: `/${segment}`,
      component: NextMount,
    }) as AnyRoute

    function NextMount() {
      return (
        <RemoteRouteMount mountRoute={mount} loadRouteTree={loadTree}>
          <Outlet />
        </RemoteRouteMount>
      )
    }

    return root.addChildren([index, mount])
  }

  return { buildTree, levels }
}

type HostBoundary = 'none' | 'root' | 'layout' | 'default'

function createFixture(
  depth: number,
  path: string,
  boundary: HostBoundary = 'none',
  failure?: 'beforeLoad' | 'loader',
) {
  const leafLoader = vi.fn(() => ({ ok: true }))
  const chain = createChain(depth, leafLoader)
  const loadRootTree = vi.fn(async () => chain.buildTree(1))

  const HostNotFound = () => <p data-testid="host-404">host-404</p>
  const hostRoot = createRootRoute({
    notFoundComponent: boundary === 'root' ? HostNotFound : undefined,
    component: () => (
      <main>
        <Outlet />
      </main>
    ),
  })

  const layout = createRoute({
    getParentRoute: () => hostRoot,
    id: 'shell',
    component: () => <Outlet />,
    notFoundComponent: HostNotFound,
  })
  const hostMount = createRemoteRoute({
    getParentRoute: () => (boundary === 'layout' ? layout : hostRoot),
    path: '/remote',
    ...(failure
      ? {
          [failure]: () => {
            throw notFound({ data: 'mount-resource-missing' })
          },
          notFoundComponent: ({ data }: { data?: unknown }) => (
            <p data-testid="mount-404">{String(data)}</p>
          ),
        }
      : {}),
    component: HostMount,
  }) as AnyRoute

  function HostMount() {
    return (
      <RemoteRouteMount mountRoute={hostMount} loadRouteTree={loadRootTree}>
        <Outlet />
      </RemoteRouteMount>
    )
  }

  const router = createRouter({
    routeTree: hostRoot.addChildren(
      boundary === 'layout' ? [layout.addChildren([hostMount])] : [hostMount],
    ),
    defaultNotFoundComponent: boundary === 'default' ? HostNotFound : undefined,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  return {
    adapter: new RemoteRouterAdapter(() => router),
    chain,
    leafLoader,
    loadRootTree,
    router,
  }
}

async function render(fixture: ReturnType<typeof createFixture>) {
  const container = document.createElement('div')
  document.body.append(container)

  await fixture.router.load()

  const root = createRoot(container)
  cleanup = () => act(() => root.unmount())

  await act(async () => {
    root.render(
      <RemoteRouterProvider adapter={fixture.adapter}>
        <RouterProvider router={fixture.router} />
      </RemoteRouterProvider>,
    )
  })

  await settle()

  return container
}

describe('deep links through chained remote mounts', () => {
  it.each(['beforeLoad', 'loader'] as const)(
    'preserves the mount resource boundary for %s failures',
    async (failure) => {
      const fixture = createFixture(2, '/remote/42', 'root', failure)
      const container = await render(fixture)
      expect(
        container.querySelector('[data-testid="mount-404"]')?.textContent,
      ).toBe('mount-resource-missing')
      expect(fixture.loadRootTree).not.toHaveBeenCalled()
    },
  )

  it('keeps explicit root not-found mode on the host', async () => {
    const fixture = createFixture(2, '/remote/level2/LEAF-1', 'root')
    fixture.router.update({ notFoundMode: 'root' })
    const container = await render(fixture)
    expect(container.querySelector('[data-testid="host-404"]')).toBeTruthy()
    expect(fixture.loadRootTree).not.toHaveBeenCalled()
  })

  it('keeps unrelated missing URLs on the host', async () => {
    const fixture = createFixture(2, '/outside/unknown', 'root')
    const container = await render(fixture)
    expect(container.querySelector('[data-testid="host-404"]')).toBeTruthy()
    expect(fixture.loadRootTree).not.toHaveBeenCalled()
  })

  it.each(['root', 'layout', 'default'] as const)(
    'attaches a deep link with a host %s 404 boundary',
    async (boundary) => {
      const fixture = createFixture(
        4,
        '/remote/level2/level3/level4/LEAF-1',
        boundary,
      )
      const container = await render(fixture)
      expect(
        container.querySelector('[data-testid="leaf-detail"]'),
      ).toBeTruthy()
      expect(container.querySelector('[data-testid="host-404"]')).toBeNull()
      expect(fixture.leafLoader).toHaveBeenCalledTimes(1)
    },
  )

  it('uses the parent remote 404 after a nested remote has attached', async () => {
    const fixture = createFixture(2, '/remote/level2/LEAF-1')
    const container = await render(fixture)
    await act(async () => {
      await fixture.router.navigate({ to: '/remote/unknown/deeper' } as never)
    })
    await settle()
    expect(container.querySelector('[data-testid="level-1-404"]')).toBeTruthy()
  })

  it('attaches two levels in one direct entry', async () => {
    const fixture = createFixture(2, '/remote/level2/LEAF-1')
    const container = await render(fixture)

    expect(container.querySelector('[data-testid="leaf-detail"]')).toBeTruthy()
    expect(fixture.leafLoader).toHaveBeenCalledTimes(1)
  })

  it('attaches four levels in one direct entry', async () => {
    // Nesting is not capped at two: each level's mount only appears once its
    // parent tree is grafted, so this exercises the same handoff repeatedly.
    const fixture = createFixture(4, '/remote/level2/level3/level4/LEAF-1')
    const container = await render(fixture)

    expect(container.querySelector('[data-testid="leaf-detail"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="level-4-root"]')).toBeTruthy()
    expect(fixture.leafLoader).toHaveBeenCalledTimes(1)

    for (const level of fixture.chain.levels) {
      expect(level.loadTree).toHaveBeenCalledTimes(1)
    }
  })

  it('still renders an intermediate level on its own path', async () => {
    // Guard rail: stopping partway must render that level's index, not the
    // deepest tree, and must not attach levels nobody asked for.
    const fixture = createFixture(4, '/remote/level2')
    const container = await render(fixture)

    expect(
      container.querySelector('[data-testid="level-2-index"]'),
    ).toBeTruthy()
    expect(fixture.leafLoader).not.toHaveBeenCalled()
  })

  it('keeps the deepest 404 boundary for an unknown path', async () => {
    const fixture = createFixture(3, '/remote/level2/level3/nope/deeper')
    const container = await render(fixture)

    expect(container.querySelector('[data-testid="level-3-404"]')).toBeTruthy()
  })
})
