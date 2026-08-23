// @vitest-environment jsdom

import { createApp, defineComponent, nextTick, ref } from 'vue'
import {
  Link,
  Outlet,
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

type Fixture = ReturnType<typeof createFixture>

const apps: Array<{ unmount: () => void }> = []

afterEach(() => {
  while (apps.length) {
    apps.pop()?.unmount()
  }
  document.body.innerHTML = ''
})

function createRemoteTree() {
  const remoteRoot = createRootRoute({
    component: () => (
      <section data-testid="remote-root">
        <Outlet />
      </section>
    ),
  })

  const remoteIndex = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/',
    component: () => <p data-testid="remote-index">remote-index</p>,
  })

  const remoteDetail = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/$orderId',
    loader: ({ params }) => ({ orderId: params.orderId }),
  })

  // `defineComponent` with a setup-returned render function, not a plain
  // function component: a bare function runs on every render, so `ref(0)`
  // would be recreated and the state under test could never survive.
  const RemoteDetail = defineComponent({
    name: 'RemoteDetail',
    setup() {
      const data = remoteDetail.useLoaderData()
      const count = ref(0)

      return () => (
        <article data-testid="remote-detail">
          <p data-testid="remote-detail-loader">detail:{data.value.orderId}</p>
          <button
            type="button"
            data-testid="remote-detail-increment"
            onClick={() => (count.value += 1)}
          >
            +1
          </button>
          <output data-testid="remote-detail-state">{count.value}</output>
          <Link to="/" data-testid="remote-link-index">
            index
          </Link>
        </article>
      )
    },
  })

  remoteDetail.update({ component: RemoteDetail } as never)

  return remoteRoot.addChildren([remoteIndex, remoteDetail])
}

function createFixture({
  initialPath,
  loadRouteTree,
}: {
  initialPath: string
  loadRouteTree: () => Promise<AnyRoute>
}) {
  const hostRoot = createRootRoute({
    component: () => (
      <main>
        <Outlet />
      </main>
    ),
  })

  const hostIndex = createRoute({
    getParentRoute: () => hostRoot,
    path: '/',
    component: () => <p data-testid="host-index">host-index</p>,
  })

  const mountRoute = createRemoteRoute({
    getParentRoute: () => hostRoot,
    path: '/orders',
  }) as AnyRoute

  function OrdersMount() {
    return (
      <RemoteRouteMount
        mountRoute={mountRoute}
        loadRouteTree={loadRouteTree}
        v-slots={{
          default: () => <Outlet />,
          loading: () => <p data-testid="remote-loading">loading</p>,
          error: (error: Error) => (
            <p data-testid="remote-error">{error.message}</p>
          ),
        }}
      />
    )
  }

  mountRoute.update({ component: OrdersMount } as never)

  const router = createRouter({
    routeTree: hostRoot.addChildren([hostIndex, mountRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  const adapter = new RemoteRouterAdapter(() => router)

  return { adapter, mountRoute, router }
}

async function mount(fixture: Fixture) {
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

  return container
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const byId = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-testid="${id}"]`)

describe('vue remote route mount', () => {
  it('serves a direct deep link through the fuzzy-404 handoff', async () => {
    const fixture = createFixture({
      initialPath: '/orders/42',
      loadRouteTree: async () => createRemoteTree(),
    })

    const container = await mount(fixture)

    // Before the attach lands the mount itself owns the fuzzy 404 and shows
    // its loading slot - the whole reason a childless mount is required.
    expect(byId(container, 'remote-loading')).toBeTruthy()
    expect(byId(container, 'remote-detail')).toBeNull()

    await settle()
    await settle()

    expect(byId(container, 'remote-root')).toBeTruthy()
    expect(byId(container, 'remote-detail-loader')?.textContent).toBe(
      'detail:42',
    )
  })

  it('keeps one host router and rebases a scoped Link onto the mount', async () => {
    const fixture = createFixture({
      initialPath: '/orders/42',
      loadRouteTree: async () => createRemoteTree(),
    })

    const container = await mount(fixture)
    await settle()
    await settle()

    expect(byId(container, 'remote-link-index')?.getAttribute('href')).toBe(
      '/orders',
    )
    expect(Object.keys(fixture.router.routesById)).toContain(
      '/orders/__remote-root-bridge/$orderId',
    )
  })

  it('does not retry a failed transport after publishing error', async () => {
    const loadRouteTree = vi.fn(async () => {
      throw new Error('transport failed')
    })

    const fixture = createFixture({ initialPath: '/orders/42', loadRouteTree })
    const container = await mount(fixture)

    await settle()
    await settle()

    expect(byId(container, 'remote-error')?.textContent).toBe(
      'transport failed',
    )

    await settle()
    expect(loadRouteTree).toHaveBeenCalledTimes(1)
  })

  it('keeps remote component state across navigation inside the remote', async () => {
    const fixture = createFixture({
      initialPath: '/orders/42',
      loadRouteTree: async () => createRemoteTree(),
    })

    const container = await mount(fixture)
    await settle()
    await settle()

    const increment = byId(
      container,
      'remote-detail-increment',
    ) as HTMLButtonElement
    increment.click()
    // Vue batches reactivity into its own tick; a macrotask alone can land
    // before the DOM is patched.
    await nextTick()

    expect(byId(container, 'remote-detail-state')?.textContent).toBe('1')
  })
})
