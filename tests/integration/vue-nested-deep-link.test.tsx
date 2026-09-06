// @vitest-environment jsdom

import { createApp, defineComponent } from 'vue'
import {
  Outlet,
  notFound,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createRemoteRoute,
  RemoteRouteMount,
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from '../../packages/route-tree-adapter/src/vue'

const apps: Array<{ unmount: () => void }> = []

afterEach(() => {
  while (apps.length) {
    apps.pop()?.unmount()
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

    const mount = createRemoteRoute({
      getParentRoute: () => root,
      path: `/level${level + 1}`,
    }) as AnyRoute

    mount.update({
      component: defineComponent({
        name: `Level${level + 1}Mount`,
        setup() {
          return () => (
            <RemoteRouteMount
              mountRoute={mount}
              loadRouteTree={loadTree}
              v-slots={{ default: () => <Outlet /> }}
            />
          )
        },
      }),
    } as never)

    return root.addChildren([index, mount])
  }

  return { buildTree }
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
  }) as AnyRoute

  hostMount.update({
    component: defineComponent({
      name: 'HostMount',
      setup() {
        return () => (
          <RemoteRouteMount
            mountRoute={hostMount}
            loadRouteTree={loadRootTree}
            v-slots={{ default: () => <Outlet /> }}
          />
        )
      },
    }),
  } as never)

  const router = createRouter({
    routeTree: hostRoot.addChildren(
      boundary === 'layout' ? [layout.addChildren([hostMount])] : [hostMount],
    ),
    defaultNotFoundComponent: boundary === 'default' ? HostNotFound : undefined,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  return {
    adapter: new RemoteRouterAdapter(() => router),
    leafLoader,
    loadRootTree,
    router,
  }
}

async function mount(fixture: ReturnType<typeof createFixture>) {
  const container = document.createElement('div')
  document.body.append(container)

  await fixture.router.load()

  const app = createApp(() => (
    <RemoteRouterProvider adapter={fixture.adapter}>
      <RouterProvider router={fixture.router} />
    </RemoteRouterProvider>
  ))

  app.mount(container)
  apps.push(app)

  await settle()

  return container
}

describe('vue deep links through chained remote mounts', () => {
  it.each(['beforeLoad', 'loader'] as const)(
    'preserves the mount resource boundary for %s failures',
    async (failure) => {
      const fixture = createFixture(2, '/remote/42', 'root', failure)
      const container = await mount(fixture)
      expect(
        container.querySelector('[data-testid="mount-404"]')?.textContent,
      ).toBe('mount-resource-missing')
      expect(fixture.loadRootTree).not.toHaveBeenCalled()
    },
  )

  it('keeps explicit root not-found mode on the host', async () => {
    const fixture = createFixture(2, '/remote/level2/LEAF-1', 'root')
    fixture.router.update({ notFoundMode: 'root' })
    const container = await mount(fixture)
    expect(container.querySelector('[data-testid="host-404"]')).toBeTruthy()
    expect(fixture.loadRootTree).not.toHaveBeenCalled()
  })

  it('keeps unrelated missing URLs on the host', async () => {
    const fixture = createFixture(2, '/outside/unknown', 'root')
    const container = await mount(fixture)
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
      const container = await mount(fixture)
      expect(
        container.querySelector('[data-testid="leaf-detail"]'),
      ).toBeTruthy()
      expect(container.querySelector('[data-testid="host-404"]')).toBeNull()
      expect(fixture.leafLoader).toHaveBeenCalledTimes(1)
    },
  )

  it('uses the parent remote 404 after a nested remote has attached', async () => {
    const fixture = createFixture(2, '/remote/level2/LEAF-1')
    const container = await mount(fixture)
    await fixture.router.navigate({ to: '/remote/unknown/deeper' } as never)
    await settle()
    expect(container.querySelector('[data-testid="level-1-404"]')).toBeTruthy()
  })

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
