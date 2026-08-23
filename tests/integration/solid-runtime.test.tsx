// @vitest-environment jsdom

import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Link,
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

type Fixture = ReturnType<typeof createFixture>

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length) {
    disposers.pop()?.()
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
    component: function RemoteDetail() {
      const data = remoteDetail.useLoaderData()
      const [count, setCount] = createSignal(0)

      return (
        <article data-testid="remote-detail">
          <p data-testid="remote-detail-loader">detail:{data().orderId}</p>
          <button
            type="button"
            data-testid="remote-detail-increment"
            onClick={() => setCount((value) => value + 1)}
          >
            +1
          </button>
          <output data-testid="remote-detail-state">{count()}</output>
          <Link to="/" data-testid="remote-link-index">
            index
          </Link>
        </article>
      )
    },
  })

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
    component: OrdersMount,
  }) as AnyRoute

  function OrdersMount() {
    return (
      <RemoteRouteMount
        mountRoute={mountRoute}
        loadRouteTree={loadRouteTree}
        loading={<p data-testid="remote-loading">loading</p>}
        error={(error) => <p data-testid="remote-error">{error.message}</p>}
      >
        <Outlet />
      </RemoteRouteMount>
    )
  }

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

  const dispose = render(
    () => (
      <RemoteRouterProvider adapter={fixture.adapter}>
        <RouterProvider router={fixture.router} />
      </RemoteRouterProvider>
    ),
    container,
  )

  disposers.push(dispose)

  return container
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const byId = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-testid="${id}"]`)

describe('solid remote route mount', () => {
  it('serves a direct deep link through the fuzzy-404 handoff', async () => {
    const fixture = createFixture({
      initialPath: '/orders/42',
      loadRouteTree: async () => createRemoteTree(),
    })

    const container = await mount(fixture)

    // Before the attach lands the mount itself owns the fuzzy 404 and shows
    // its loading boundary - the whole reason a childless mount is required.
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

    // `to="/"` inside the remote means the remote index, not host home.
    expect(byId(container, 'remote-link-index')?.getAttribute('href')).toBe(
      '/orders',
    )

    // One router: the remote routes are indexed by the host itself.
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

    // Publishing the error must not re-run the effect: one failed import stays
    // one failed import until the host decides otherwise.
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
    await settle()

    expect(byId(container, 'remote-detail-state')?.textContent).toBe('1')
  })
})
