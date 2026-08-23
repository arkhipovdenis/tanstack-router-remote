// @vitest-environment jsdom

import { render } from 'solid-js/web'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/solid-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createRemoteRoute,
  RemoteRouteMount,
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from '../../packages/route-tree-adapter/src/solid'

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length) {
    disposers.pop()?.()
  }
  document.body.innerHTML = ''
})

const settle = async () => {
  for (let index = 0; index < 8; index++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/** A chain of remote trees, each holding the mount for the next one. */
function createChain(depth: number, leafLoader: () => unknown) {
  const loaders: Array<ReturnType<typeof vi.fn>> = []

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

    const loadTree = vi.fn(async () => buildTree(level + 1))
    loaders.push(loadTree)

    const mount = createRemoteRoute({
      getParentRoute: () => root,
      path: `/level${level + 1}`,
      component: () => (
        <RemoteRouteMount mountRoute={mount} loadRouteTree={loadTree}>
          <Outlet />
        </RemoteRouteMount>
      ),
    }) as AnyRoute

    return root.addChildren([index, mount])
  }

  return { buildTree, loaders }
}

function createFixture(depth: number, path: string) {
  const leafLoader = vi.fn(() => ({ ok: true }))
  const chain = createChain(depth, leafLoader)
  const loadRootTree = vi.fn(async () => chain.buildTree(1))

  const hostRoot = createRootRoute({
    component: () => (
      <main>
        <Outlet />
      </main>
    ),
  })

  const hostMount = createRemoteRoute({
    getParentRoute: () => hostRoot,
    path: '/remote',
    component: () => (
      <RemoteRouteMount mountRoute={hostMount} loadRouteTree={loadRootTree}>
        <Outlet />
      </RemoteRouteMount>
    ),
  }) as AnyRoute

  const router = createRouter({
    routeTree: hostRoot.addChildren([hostMount]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  return {
    adapter: new RemoteRouterAdapter(() => router),
    chain,
    leafLoader,
    router,
  }
}

async function mount(fixture: ReturnType<typeof createFixture>) {
  const container = document.createElement('div')
  document.body.append(container)

  await fixture.router.load()

  disposers.push(
    render(
      () => (
        <RemoteRouterProvider adapter={fixture.adapter}>
          <RouterProvider router={fixture.router} />
        </RemoteRouterProvider>
      ),
      container,
    ),
  )

  await settle()

  return container
}

describe('solid deep links through chained remote mounts', () => {
  it('attaches four levels in one direct entry', async () => {
    const fixture = createFixture(4, '/remote/level2/level3/level4/LEAF-1')
    const container = await mount(fixture)

    expect(container.querySelector('[data-testid="leaf-detail"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="level-4-root"]')).toBeTruthy()
    expect(fixture.leafLoader).toHaveBeenCalledTimes(1)
  })

  it('keeps the deepest 404 boundary for an unknown path', async () => {
    const fixture = createFixture(3, '/remote/level2/level3/nope/deeper')
    const container = await mount(fixture)

    expect(container.querySelector('[data-testid="level-3-404"]')).toBeTruthy()
  })
})
