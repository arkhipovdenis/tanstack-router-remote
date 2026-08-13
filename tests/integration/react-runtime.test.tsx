// @vitest-environment jsdom

import { act, useState, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  type AnyRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createRemoteRoute,
  RemoteRouteMount,
  RouteTreeUpdateAdapter,
  RouteTreeUpdateAdapterProvider,
  useRouteTreeUpdateAdapter,
} from '../../packages/route-tree-adapter/src'

type UntypedLinkProps = {
  children: ReactNode
  params?: Record<string, string>
  search?: Record<string, string>
  to: string
  'data-testid': string
}

const RouterLink = Link as unknown as ComponentType<UntypedLinkProps>

type Deferred<T> = {
  promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}

async function waitFor(assertion: () => void, timeout = 2_000) {
  const deadline = Date.now() + timeout
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  throw lastError
}

function getByTestId(container: Element, testId: string) {
  const element = container.querySelector(`[data-testid="${testId}"]`)

  if (!element) {
    throw new Error(`Expected [data-testid="${testId}"] to be rendered`)
  }

  return element
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        button: 0,
        cancelable: true,
      }),
    )
  })
}

type RuntimeFixture = ReturnType<typeof createRuntimeFixture>

type RuntimeFixtureOptions = {
  deferRemoteTree?: boolean
  failRemoteTree?: boolean
  includeDetailRoute?: boolean
  includeHostDefaultNotFound?: boolean
  includeRemoteRootNotFound?: boolean
}

function createRuntimeFixture(
  initialEntry: string,
  {
    deferRemoteTree = false,
    failRemoteTree = false,
    includeDetailRoute = true,
    includeHostDefaultNotFound = false,
    includeRemoteRootNotFound = true,
  }: RuntimeFixtureOptions = {},
) {
  const rootLoader = vi.fn(async () => ({ source: 'remote-root-loader' }))
  const rootBeforeLoad = vi.fn(() => ({ remoteScope: 'remote-root' }))
  const indexLoader = vi.fn(async () => ({ source: 'remote-index-loader' }))
  const indexBeforeLoad = vi.fn(() => ({ indexScope: 'remote-index' }))
  const detailLoader = vi.fn(async ({ params }: { params: { orderId: string } }) => ({
    source: `remote-detail-loader:${params.orderId}`,
  }))
  const detailBeforeLoad = vi.fn(() => ({ detailScope: 'remote-detail' }))
  const brokenLoader = vi.fn(async () => {
    throw new Error('remote broken loader')
  })
  const remoteRootNotFound = vi.fn(() => (
      <section data-testid="remote-root-not-found">
        <p>Remote root structural 404</p>
        <RouterLink data-testid="remote-root-not-found-recovery" to="/">
          Return to remote index
        </RouterLink>
      </section>
    ),
  )
  const hostDefaultNotFound = vi.fn(() => (
    <section data-testid="host-default-not-found">
      <p>Host default structural 404</p>
      <RouterLink data-testid="host-default-not-found-recovery" to="/">
        Return to host home
      </RouterLink>
    </section>
  ))
  const pathlessLayoutLoader = vi.fn(async () => ({
    source: 'remote-pathless-layout-loader',
  }))
  const nestedLeafLoader = vi.fn(
    async ({ params }: { params: { projectId: string } }) => ({
      source: `remote-nested-leaf-loader:${params.projectId}`,
    }),
  )
  const slowRouteReady = deferred<{ source: string }>()
  const slowLoader = vi.fn(async () => slowRouteReady.promise)
  const remoteRouterReferences = new Set<unknown>()
  const adapterReferences: unknown[] = []

  function RemoteRoot() {
    const router = useRouter()
    const adapter = useRouteTreeUpdateAdapter()
    const [count, setCount] = useState(0)
    const pathname = useRouterState({
      select: (state) => state.location.pathname,
    })

    remoteRouterReferences.add(router)
    adapterReferences.push(adapter)

    return (
      <section data-testid="remote-root">
        <p data-testid="remote-root-state">root-state:{count}</p>
        <p data-testid="remote-router-path">router-path:{pathname}</p>
        <button
          data-testid="remote-root-increment"
          onClick={() => setCount((value) => value + 1)}
        >
          Increment root state
        </button>
        <nav>
          <RouterLink data-testid="remote-index-link" to="/">
            Remote index
          </RouterLink>
          <RouterLink
            data-testid="remote-detail-link"
            params={{ orderId: '42' }}
            to="/$orderId"
          >
            Remote detail
          </RouterLink>
          <RouterLink data-testid="remote-slow-link" to="/slow">
            Remote slow route
          </RouterLink>
          <RouterLink data-testid="remote-broken-link" to="/broken">
            Remote broken route
          </RouterLink>
        </nav>
        <Outlet />
      </section>
    )
  }

  function RemoteIndex() {
    const [count, setCount] = useState(0)
    const router = useRouter()

    remoteRouterReferences.add(router)

    return (
      <section data-testid="remote-index">
        <p data-testid="remote-index-state">index-state:{count}</p>
        <button
          data-testid="remote-index-increment"
          onClick={() => setCount((value) => value + 1)}
        >
          Increment index state
        </button>
        <p>Remote index component</p>
      </section>
    )
  }

  function RemoteDetail() {
    const [count, setCount] = useState(0)
    const router = useRouter()
    const navigate = remoteDetail.useNavigate()

    remoteRouterReferences.add(router)

    return (
      <section data-testid="remote-detail">
        <p data-testid="remote-detail-state">detail-state:{count}</p>
        <button
          data-testid="remote-detail-increment"
          onClick={() => setCount((value) => value + 1)}
        >
          Increment detail state
        </button>
        <remoteDetail.Link data-testid="remote-detail-route-link" to="/">
          Remote detail route Link to index
        </remoteDetail.Link>
        <button
          data-testid="remote-detail-route-navigate"
          onClick={() => {
            void navigate({ to: '/' } as never)
          }}
        >
          Remote detail useNavigate to index
        </button>
        <p>Remote detail component</p>
      </section>
    )
  }

  function RemoteSlow() {
    return <p data-testid="remote-slow">Remote slow component</p>
  }

  function RemoteSlowPending() {
    return <p data-testid="remote-slow-pending">Remote slow pending</p>
  }

  function RemoteBroken() {
    return <p data-testid="remote-broken">Remote broken component</p>
  }

  function RemotePathlessLayout() {
    const [count, setCount] = useState(0)

    return (
      <section data-testid="remote-pathless-layout">
        <p data-testid="remote-pathless-layout-state">
          pathless-layout-state:{count}
        </p>
        <button
          data-testid="remote-pathless-layout-increment"
          onClick={() => setCount((value) => value + 1)}
        >
          Increment pathless layout state
        </button>
        <Outlet />
      </section>
    )
  }

  function RemoteNestedLeaf() {
    const [count, setCount] = useState(0)

    return (
      <section data-testid="remote-nested-leaf">
        <p data-testid="remote-nested-leaf-state">nested-leaf-state:{count}</p>
        <button
          data-testid="remote-nested-leaf-increment"
          onClick={() => setCount((value) => value + 1)}
        >
          Increment nested leaf state
        </button>
        <p>Remote nested leaf component</p>
      </section>
    )
  }

  function RemoteNestedActivity() {
    return <p data-testid="remote-nested-activity">Remote nested activity</p>
  }

  function RemoteRootError({ error }: { error: Error }) {
    return <p data-testid="remote-root-error">Remote root error:{error.message}</p>
  }

  const remoteRoot = createRootRoute({
    beforeLoad: rootBeforeLoad,
    component: RemoteRoot,
    errorComponent: RemoteRootError,
    loader: rootLoader,
    ...(includeRemoteRootNotFound
      ? { notFoundComponent: remoteRootNotFound }
      : {}),
    staleTime: 60_000,
    staticData: { cacheProbe: 'remote-root' },
  })
  const remoteIndex = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/',
    component: RemoteIndex,
    beforeLoad: indexBeforeLoad,
    loader: indexLoader,
    loaderDeps: ({ search }) => ({ tab: search.tab }),
    staleTime: 60_000,
    staticData: { cacheProbe: 'remote-index' },
    validateSearch: (search: Record<string, unknown>) => ({
      tab: typeof search.tab === 'string' ? search.tab : 'all',
    }),
  })
  const remoteDetail = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/$orderId',
    component: RemoteDetail,
    beforeLoad: detailBeforeLoad,
    loader: detailLoader,
    staleTime: 60_000,
    staticData: { cacheProbe: 'remote-detail' },
    validateSearch: (search: Record<string, unknown>) => ({
      tab: typeof search.tab === 'string' ? search.tab : 'all',
    }),
  })
  const remoteSlow = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/slow',
    component: RemoteSlow,
    loader: slowLoader,
    pendingComponent: RemoteSlowPending,
    pendingMinMs: 0,
    pendingMs: 0,
  })
  const remoteBroken = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/broken',
    component: RemoteBroken,
    loader: brokenLoader,
  })
  const remotePathlessLayout = createRoute({
    getParentRoute: () => remoteRoot,
    id: 'remote-pathless-layout',
    component: RemotePathlessLayout,
    loader: pathlessLayoutLoader,
    staleTime: 60_000,
    staticData: { cacheProbe: 'remote-pathless-layout' },
  })
  const remoteNestedLeaf = createRoute({
    getParentRoute: () => remotePathlessLayout,
    path: '/projects/$projectId',
    component: RemoteNestedLeaf,
    loader: nestedLeafLoader,
    staleTime: 60_000,
    staticData: { cacheProbe: 'remote-nested-leaf' },
    validateSearch: (search: Record<string, unknown>) => ({
      tab: typeof search.tab === 'string' ? search.tab : 'overview',
    }),
  })
  const remoteNestedActivity = createRoute({
    getParentRoute: () => remotePathlessLayout,
    path: '/projects/$projectId/activity',
    component: RemoteNestedActivity,
  })
  const remoteTree = remoteRoot.addChildren([
    remoteIndex,
    ...(includeDetailRoute ? [remoteDetail] : []),
    remoteSlow,
    remoteBroken,
    remotePathlessLayout.addChildren([remoteNestedLeaf, remoteNestedActivity]),
  ])
  const remoteTreeReady = deferRemoteTree ? deferred<AnyRoute>() : undefined
  const loadRouteTree = vi.fn(async () => {
    if (failRemoteTree) {
      throw new Error('remote transport failed')
    }

    return remoteTreeReady?.promise ?? remoteTree
  })

  const hostRoot = createRootRoute({ component: () => <Outlet /> })
  const homeRoute = createRoute({
    getParentRoute: () => hostRoot,
    path: '/home',
    component: () => <p data-testid="host-home">Host home</p>,
  })
  let ordersMountRoute!: AnyRoute

  function OrdersMount() {
    return (
      <RemoteRouteMount
        mountRoute={ordersMountRoute}
        loadRouteTree={loadRouteTree}
        loading={<p data-testid="remote-loading">Loading remote route tree</p>}
        error={(error) => (
          <p data-testid="remote-mount-error">
            Remote mount error:{error.message}
          </p>
        )}
      >
        <Outlet />
      </RemoteRouteMount>
    )
  }

  const localOrdersMountRoute = createRemoteRoute({
    getParentRoute: () => hostRoot,
    path: '/orders',
    component: OrdersMount,
    notFoundComponent: OrdersMount,
  })
  ordersMountRoute = localOrdersMountRoute

  const router = createRouter({
    routeTree: hostRoot.addChildren([homeRoute, localOrdersMountRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    ...(includeHostDefaultNotFound
      ? { defaultNotFoundComponent: hostDefaultNotFound }
      : {}),
    defaultPendingMinMs: 0,
    defaultPendingMs: 0,
  })
  const adapter = new RouteTreeUpdateAdapter(() => router)

  return {
    adapter,
    adapterReferences,
    brokenLoader,
    detailLoader,
    detailBeforeLoad,
    hostDefaultNotFound,
    indexLoader,
    indexBeforeLoad,
    loadRouteTree,
    nestedLeafLoader,
    pathlessLayoutLoader,
    remoteDetail,
    remoteIndex,
    ordersMountRoute,
    remoteRoot,
    remoteRootNotFound,
    remoteRouterReferences,
    releaseRemoteTree() {
      remoteTreeReady?.resolve(remoteTree)
    },
    releaseSlowRoute() {
      slowRouteReady.resolve({ source: 'remote-slow-loader' })
    },
    rootBeforeLoad,
    rootLoader,
    router,
    slowLoader,
  }
}

async function renderFixture(fixture: RuntimeFixture) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await fixture.router.load()
  await act(async () => {
    root.render(
      <RouteTreeUpdateAdapterProvider adapter={fixture.adapter}>
        <RouterProvider router={fixture.router} />
      </RouteTreeUpdateAdapterProvider>,
    )
  })

  return {
    container,
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('remote route tree mount in a browser-like React runtime', () => {
  let cleanup: (() => Promise<void>) | undefined

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
      writable: true,
    })
  })

  afterEach(async () => {
    await cleanup?.()
    cleanup = undefined
    document.body.replaceChildren()
  })

  it('renders the remote root and index components after the local mount loading boundary', async () => {
    const fixture = createRuntimeFixture('/orders?tab=overview', {
      deferRemoteTree: true,
    })
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Loading remote route tree')
    })
    fixture.releaseRemoteTree()
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote index component')
    })

    expect(getByTestId(rendered.container, 'remote-root')).toBeTruthy()
    expect(getByTestId(rendered.container, 'remote-index')).toBeTruthy()
    expect(fixture.loadRouteTree).toHaveBeenCalledTimes(1)
    expect(fixture.rootBeforeLoad).toHaveBeenCalledTimes(1)
    expect(fixture.rootLoader).toHaveBeenCalledTimes(1)
    expect(fixture.indexLoader).toHaveBeenCalledTimes(1)
    expect(fixture.indexBeforeLoad).toHaveBeenCalledTimes(1)
    expect(fixture.router.state.location.search).toMatchObject({ tab: 'overview' })
    expect(fixture.router.state.matches.at(-1)?.search).toMatchObject({
      tab: 'overview',
    })

    const bridgeMatch = fixture.router.state.matches.find(
      (match) => match.routeId === '/orders/__remote-root-bridge',
    )

    expect(bridgeMatch?.loaderData).toEqual({ source: 'remote-root-loader' })
    expect(bridgeMatch?.context).toMatchObject({ remoteScope: 'remote-root' })
    expect(
      (fixture.router.routesById as Record<string, unknown>)[
        '/orders/__remote-root-bridge/'
      ],
    ).toBe(fixture.remoteIndex)
    expect(fixture.adapterReferences).toContain(fixture.adapter)
  })

  it('does not automatically retry a failed remote transport after it publishes error', async () => {
    const fixture = createRuntimeFixture('/orders', {
      failRemoteTree: true,
    })
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain(
        'Remote mount error:remote transport failed',
      )
    })
    // A state publication used to retrigger the mount effect. The real loader
    // must now run once; retry is an explicit host UI decision.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(fixture.loadRouteTree).toHaveBeenCalledTimes(1)
    expect(fixture.adapter.getSnapshot(fixture.ordersMountRoute)).toMatchObject({
      state: 'error',
    })
  })

  it('keeps native router state, cache, and scoped navigation semantics across remote routes', async () => {
    const fixture = createRuntimeFixture('/orders/42?tab=first')
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote detail component')
    })

    const firstScopedRouter = [
      ...fixture.remoteRouterReferences,
    ].at(-1) as typeof fixture.router

    expect(firstScopedRouter).not.toBe(fixture.router)
    expect(firstScopedRouter.history).toBe(fixture.router.history)
    expect(firstScopedRouter.stores).toBe(fixture.router.stores)
    expect(firstScopedRouter.state).toBe(fixture.router.state)
    expect(fixture.detailLoader).toHaveBeenCalledTimes(1)
    expect(fixture.detailBeforeLoad).toHaveBeenCalledTimes(1)

    await click(getByTestId(rendered.container, 'remote-root-increment'))
    await click(getByTestId(rendered.container, 'remote-detail-increment'))
    expect(getByTestId(rendered.container, 'remote-root-state').textContent).toContain(
      'root-state:1',
    )
    expect(getByTestId(rendered.container, 'remote-detail-state').textContent).toContain(
      'detail-state:1',
    )

    await act(async () => {
      await fixture.router.navigate({
        to: '/orders/$orderId',
        params: { orderId: '43' },
        search: { tab: 'second' },
      } as never)
    })
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders/43')
      expect(fixture.router.state.location.search).toMatchObject({ tab: 'second' })
    })
    expect(getByTestId(rendered.container, 'remote-router-path').textContent).toContain(
      'router-path:/orders/43',
    )

    // A leaf match remains mounted while only its params/search change.
    expect(getByTestId(rendered.container, 'remote-root-state').textContent).toContain(
      'root-state:1',
    )
    expect(getByTestId(rendered.container, 'remote-detail-state').textContent).toContain(
      'detail-state:1',
    )

    await click(getByTestId(rendered.container, 'remote-index-link'))
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders')
      expect(rendered.container.textContent).toContain('Remote index component')
    })

    // The layout/root match remains mounted across descendants.
    expect(getByTestId(rendered.container, 'remote-root-state').textContent).toContain(
      'root-state:1',
    )
    expect(getByTestId(rendered.container, 'remote-index-state').textContent).toContain(
      'index-state:0',
    )

    await click(getByTestId(rendered.container, 'remote-index-increment'))
    await act(async () => {
      await fixture.router.navigate({
        to: '/orders',
        search: { tab: 'same-index' },
      } as never)
    })
    await waitFor(() => {
      expect(fixture.router.state.location.search).toMatchObject({
        tab: 'same-index',
      })
    })
    expect(getByTestId(rendered.container, 'remote-index-state').textContent).toContain(
      'index-state:1',
    )
    expect(fixture.indexLoader).toHaveBeenCalledTimes(2)

    await click(getByTestId(rendered.container, 'remote-detail-link'))
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders/42')
      expect(rendered.container.textContent).toContain('Remote detail component')
    })
    // The leaf was unmatched on the index route, so its React-local state is
    // intentionally reset when it is mounted again.
    expect(getByTestId(rendered.container, 'remote-detail-state').textContent).toContain(
      'detail-state:0',
    )

    await act(async () => {
      await fixture.router.navigate({ to: '/home' } as never)
    })
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Host home')
    })
    const cachedProbes = fixture.router.stores.cachedMatches
      .get()
      .map(
        (match) =>
          (match.staticData as Record<string, unknown> | undefined)?.cacheProbe,
      )

    expect(cachedProbes).toEqual(
      expect.arrayContaining([
        'remote-root',
        'remote-index',
        'remote-detail',
      ]),
    )
    await act(async () => {
      await fixture.router.navigate({
        to: '/orders/$orderId',
        params: { orderId: '43' },
        search: { tab: 'second' },
      } as never)
    })
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote detail component')
    })

    // Native TanStack cache belongs to the unchanged host router and is reused.
    expect(fixture.rootLoader).toHaveBeenCalledTimes(1)
    expect(fixture.detailLoader).toHaveBeenCalledTimes(2)
    const mostRecentScopedRouter = [...fixture.remoteRouterReferences].at(-1)

    expect(mostRecentScopedRouter).not.toBe(fixture.router)
    expect((mostRecentScopedRouter as typeof fixture.router).history).toBe(
      fixture.router.history,
    )
    expect((mostRecentScopedRouter as typeof fixture.router).stores).toBe(
      fixture.router.stores,
    )
  })

  it('rebases route-bound Link and useNavigate APIs from a remote detail route', async () => {
    const fixture = createRuntimeFixture('/orders/42')
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote detail component')
    })

    expect(
      getByTestId(rendered.container, 'remote-detail-route-link').getAttribute('href'),
    ).toBe('/orders')
    await click(getByTestId(rendered.container, 'remote-detail-route-link'))
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders')
      expect(rendered.container.textContent).toContain('Remote index component')
    })

    await act(async () => {
      await fixture.router.navigate({
        to: '/orders/$orderId',
        params: { orderId: '42' },
      } as never)
    })
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote detail component')
    })

    await click(getByTestId(rendered.container, 'remote-detail-route-navigate'))
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders')
      expect(rendered.container.textContent).toContain('Remote index component')
    })
  })

  it('renders a remote route pending boundary during a native Link transition', async () => {
    const fixture = createRuntimeFixture('/orders')
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote index component')
    })

    await click(getByTestId(rendered.container, 'remote-slow-link'))
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders/slow')
      expect(rendered.container.textContent).toContain('Remote slow pending')
    })

    fixture.releaseSlowRoute()
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote slow component')
    })
    expect(fixture.slowLoader).toHaveBeenCalledTimes(1)
  })

  it('uses the remote root error boundary for a nested remote loader failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fixture = createRuntimeFixture('/orders')
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    try {
      await waitFor(() => {
        expect(rendered.container.textContent).toContain('Remote index component')
      })

      await click(getByTestId(rendered.container, 'remote-broken-link'))
      await waitFor(() => {
        expect(rendered.container.textContent).toContain(
          'Remote root error:remote broken loader',
        )
      })
      expect(fixture.brokenLoader).toHaveBeenCalledTimes(1)
    } finally {
      consoleError.mockRestore()
      consoleWarn.mockRestore()
    }
  })

  it('keeps a structural remote 404 at the mount without changing fuzzy route precedence', async () => {
    const fixture = createRuntimeFixture('/orders/no/such/path')
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain(
        'Remote root structural 404',
      )
    })

    expect(fixture.loadRouteTree).toHaveBeenCalledTimes(1)
    expect(fixture.router.hasNotFoundMatch()).toBe(true)
    expect(fixture.router.state.statusCode).toBe(404)
    // The React wrapper renders the bridge's configured remote root boundary.
    // TanStack itself owns the 404 match/status; the component intentionally
    // does not require a synthetic route or manually forged error object.
    expect(fixture.remoteRootNotFound).toHaveBeenCalledTimes(1)

    expect(
      getByTestId(
        rendered.container,
        'remote-root-not-found-recovery',
      ).getAttribute('href'),
    ).toBe('/orders')
    await click(
      getByTestId(rendered.container, 'remote-root-not-found-recovery'),
    )
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders')
      expect(rendered.container.textContent).toContain('Remote index component')
    })

    await act(async () => {
      await fixture.router.navigate({ to: '/orders/42/not-a-real-child' } as never)
    })
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe(
        '/orders/42/not-a-real-child',
      )
    })

    // The $orderId fuzzy branch still wins over the root mount. The adapter
    // must never add a full catch-all route that steals this nested URL.
    expect(fixture.router.state.matches.at(-1)?.routeId).toBe(
      fixture.remoteDetail.id,
    )
  })

  it('delegates a true mount-level structural 404 to the remote root boundary', async () => {
    const fixture = createRuntimeFixture('/orders/no/such/path', {
      includeDetailRoute: false,
    })
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain(
        'Remote root structural 404',
      )
    })

    // There is no matching remote child for the first segment. The mounted
    // route itself remains TanStack's fuzzy 404 owner; its boundary is now a
    // scoped remote-root boundary, rather than an Outlet recursion.
    expect(fixture.router.state.matches.at(-1)?.routeId).toBe(
      fixture.ordersMountRoute.id,
    )
    expect(fixture.router.hasNotFoundMatch()).toBe(true)
    expect(fixture.router.state.statusCode).toBe(404)
    expect(fixture.remoteRootNotFound).toHaveBeenCalledTimes(1)
    expect(fixture.loadRouteTree).toHaveBeenCalledTimes(1)

    expect(
      getByTestId(
        rendered.container,
        'remote-root-not-found-recovery',
      ).getAttribute('href'),
    ).toBe('/orders')
  })

  it('uses a safe default 404 when the remote root has no boundary', async () => {
    const fixture = createRuntimeFixture('/orders/no/such/path', {
      includeDetailRoute: false,
      includeRemoteRootNotFound: false,
    })
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Not Found')
    })

    expect(fixture.router.state.matches.at(-1)?.routeId).toBe(
      fixture.ordersMountRoute.id,
    )
    expect(fixture.router.hasNotFoundMatch()).toBe(true)
    expect(fixture.router.state.statusCode).toBe(404)
    expect(fixture.remoteRootNotFound).not.toHaveBeenCalled()
  })

  it('prefers the remote root 404 over a host router default', async () => {
    const fixture = createRuntimeFixture('/orders/no/such/path', {
      includeDetailRoute: false,
      includeHostDefaultNotFound: true,
    })
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain(
        'Remote root structural 404',
      )
    })

    expect(fixture.remoteRootNotFound).toHaveBeenCalledTimes(1)
    expect(fixture.hostDefaultNotFound).not.toHaveBeenCalled()
    expect(fixture.router.state.statusCode).toBe(404)
  })

  it('uses the host router default when the remote has no 404 boundary', async () => {
    const fixture = createRuntimeFixture('/orders/no/such/path', {
      includeDetailRoute: false,
      includeHostDefaultNotFound: true,
      includeRemoteRootNotFound: false,
    })
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain(
        'Host default structural 404',
      )
    })

    expect(fixture.remoteRootNotFound).not.toHaveBeenCalled()
    expect(fixture.hostDefaultNotFound).toHaveBeenCalledTimes(1)
    expect(fixture.router.state.statusCode).toBe(404)
    expect(
      getByTestId(
        rendered.container,
        'host-default-not-found-recovery',
      ).getAttribute('href'),
    ).toBe('/')
  })

  it('preserves pathless layout state and native cache through nested remote branches', async () => {
    const fixture = createRuntimeFixture('/orders/projects/alpha?tab=first')
    const rendered = await renderFixture(fixture)
    cleanup = rendered.cleanup

    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote nested leaf component')
    })
    expect(getByTestId(rendered.container, 'remote-pathless-layout')).toBeTruthy()
    expect(fixture.pathlessLayoutLoader).toHaveBeenCalledTimes(1)
    expect(fixture.nestedLeafLoader).toHaveBeenCalledTimes(1)

    await click(getByTestId(rendered.container, 'remote-pathless-layout-increment'))
    await click(getByTestId(rendered.container, 'remote-nested-leaf-increment'))
    expect(
      getByTestId(rendered.container, 'remote-pathless-layout-state').textContent,
    ).toContain('pathless-layout-state:1')
    expect(getByTestId(rendered.container, 'remote-nested-leaf-state').textContent).toContain(
      'nested-leaf-state:1',
    )

    await act(async () => {
      await fixture.router.navigate({
        to: '/orders/projects/$projectId',
        params: { projectId: 'beta' },
        search: { tab: 'second' },
      } as never)
    })
    await waitFor(() => {
      expect(fixture.router.state.location.pathname).toBe('/orders/projects/beta')
      expect(fixture.router.state.location.search).toMatchObject({ tab: 'second' })
    })
    // Params/search change on the same leaf route does not unmount either
    // component. The leaf loader runs once per parameter value.
    expect(
      getByTestId(rendered.container, 'remote-pathless-layout-state').textContent,
    ).toContain('pathless-layout-state:1')
    expect(getByTestId(rendered.container, 'remote-nested-leaf-state').textContent).toContain(
      'nested-leaf-state:1',
    )
    expect(fixture.nestedLeafLoader).toHaveBeenCalledTimes(2)

    await act(async () => {
      await fixture.router.navigate({
        to: '/orders/projects/$projectId/activity',
        params: { projectId: 'beta' },
      } as never)
    })
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote nested activity')
    })
    // The pathless layout remains mounted while the nested child changes.
    expect(
      getByTestId(rendered.container, 'remote-pathless-layout-state').textContent,
    ).toContain('pathless-layout-state:1')

    await act(async () => {
      await fixture.router.navigate({
        to: '/orders/projects/$projectId',
        params: { projectId: 'alpha' },
        search: { tab: 'first' },
      } as never)
    })
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote nested leaf component')
    })
    // The leaf was unmatched by the activity branch, therefore local React
    // state starts over. Its TanStack loader data is still reused from cache.
    expect(
      getByTestId(rendered.container, 'remote-pathless-layout-state').textContent,
    ).toContain('pathless-layout-state:1')
    expect(getByTestId(rendered.container, 'remote-nested-leaf-state').textContent).toContain(
      'nested-leaf-state:0',
    )
    expect(fixture.nestedLeafLoader).toHaveBeenCalledTimes(2)

    await act(async () => {
      await fixture.router.navigate({ to: '/home' } as never)
    })
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Host home')
    })
    const cachedProbes = fixture.router.stores
      .cachedMatches
      .get()
      .map(
        (match) =>
          (match.staticData as Record<string, unknown> | undefined)?.cacheProbe,
      )

    expect(cachedProbes).toEqual(
      expect.arrayContaining([
        'remote-pathless-layout',
        'remote-nested-leaf',
      ]),
    )

    await act(async () => {
      await fixture.router.navigate({
        to: '/orders/projects/$projectId',
        params: { projectId: 'beta' },
        search: { tab: 'second' },
      } as never)
    })
    await waitFor(() => {
      expect(rendered.container.textContent).toContain('Remote nested leaf component')
    })
    expect(fixture.pathlessLayoutLoader).toHaveBeenCalledTimes(1)
    expect(fixture.nestedLeafLoader).toHaveBeenCalledTimes(2)
  })
})
