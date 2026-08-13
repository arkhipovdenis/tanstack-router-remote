import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  useLoaderData,
  useParams,
  useRouter,
  useSearch,
  type AnyRoute,
} from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'

import {
  createRemoteRoute,
  RouteTreeUpdateAdapter,
} from '../../packages/route-tree-adapter/src'

const Null = () => null

function renderRouter(router: unknown) {
  return renderToStaticMarkup(
    createElement(RouterProvider, {
      router: router as never,
    }),
  )
}

function createRuntimeHost(initialEntry: string, basepath?: string) {
  function HostRoot() {
    return createElement(
      'main',
      { 'data-host-root': 'true' },
      createElement(Outlet),
    )
  }

  function HostMount() {
    return createElement(
      'section',
      { 'data-host-mount': 'orders' },
      createElement(Outlet),
    )
  }

  const root = createRootRoute({ component: HostRoot })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/home',
    component: () => createElement('p', null, 'host-home'),
  })
  const mount = createRemoteRoute({
    getParentRoute: () => root,
    path: '/orders',
    component: HostMount,
    notFoundComponent: HostMount,
  }) as AnyRoute

  const router = createRouter({
    routeTree: root.addChildren([home, mount]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    basepath,
  })

  return { mount, router }
}

function createInstrumentedRemote() {
  const lifecycle = {
    rootValidateSearch: 0,
    rootBeforeLoad: 0,
    rootLoader: 0,
    indexLoader: 0,
    detailLoader: 0,
    lineItemsLoader: 0,
    rootRouters: [] as unknown[],
    indexRouters: [] as unknown[],
    detailRouters: [] as unknown[],
    lineItemsRouters: [] as unknown[],
  }

  function RemoteRoot() {
    const data = useLoaderData({ strict: false }) as {
      source: string
      contextMarker: string
    }
    const search = useSearch({ strict: false }) as { tab?: string }

    lifecycle.rootRouters.push(useRouter())

    return createElement(
      'section',
      {
        'data-remote-root': data.source,
        'data-root-context': data.contextMarker,
        'data-root-tab': search.tab,
      },
      createElement(Outlet),
    )
  }

  function RemoteIndex() {
    const data = useLoaderData({ strict: false }) as {
      source: string
      contextMarker: string
    }

    lifecycle.indexRouters.push(useRouter())

    return createElement(
      'p',
      {
        'data-remote-index': data.source,
        'data-index-context': data.contextMarker,
      },
      'remote-index',
    )
  }

  function RemoteDetail() {
    const data = useLoaderData({ strict: false }) as {
      source: string
      orderId: string
    }
    const params = useParams({ strict: false }) as { orderId?: string }

    lifecycle.detailRouters.push(useRouter())

    return createElement(
      'section',
      {
        'data-remote-detail': data.source,
        'data-detail-order-id': params.orderId,
      },
      createElement(Outlet),
    )
  }

  function RemoteLineItems() {
    const data = useLoaderData({ strict: false }) as {
      source: string
      orderId: string
    }
    const params = useParams({ strict: false }) as { orderId?: string }

    lifecycle.lineItemsRouters.push(useRouter())

    return createElement(
      'p',
      {
        'data-remote-line-items': data.source,
        'data-line-items-order-id': params.orderId,
      },
      'remote-line-items',
    )
  }

  const root = createRootRoute({
    component: RemoteRoot,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    staticData: { cacheProbe: 'remote-root' },
    validateSearch: (search) => {
      lifecycle.rootValidateSearch += 1
      const value = search as { tab?: unknown }

      return { tab: typeof value.tab === 'string' ? value.tab : 'overview' }
    },
    beforeLoad: () => {
      lifecycle.rootBeforeLoad += 1

      return { remoteRootContext: 'root-before-load' }
    },
    loader: ({ context }) => {
      lifecycle.rootLoader += 1

      return {
        source: 'remote-root-loader',
        contextMarker: String(context.remoteRootContext),
      }
    },
  })
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: RemoteIndex,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    staticData: { cacheProbe: 'remote-index' },
    loader: ({ context }) => {
      lifecycle.indexLoader += 1

      return {
        source: 'remote-index-loader',
        contextMarker: String(context.remoteRootContext),
      }
    },
  })
  const detail = createRoute({
    getParentRoute: () => root,
    path: '/$orderId',
    component: RemoteDetail,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    staticData: { cacheProbe: 'remote-detail' },
    loader: ({ params }) => {
      lifecycle.detailLoader += 1

      return { source: 'remote-detail-loader', orderId: params.orderId }
    },
  })
  const lineItems = createRoute({
    getParentRoute: () => detail,
    path: '/line-items',
    component: RemoteLineItems,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    staticData: { cacheProbe: 'remote-line-items' },
    loader: ({ params }) => {
      lifecycle.lineItemsLoader += 1

      return { source: 'remote-line-items-loader', orderId: params.orderId }
    },
  })

  return {
    lifecycle,
    root,
    index,
    detail,
    lineItems,
    tree: root.addChildren([index, detail.addChildren([lineItems])]),
  }
}

function createRootBoundaryRemote() {
  let mode: 'ready' | 'error' | 'not-found' = 'ready'
  let pendingRenders = 0
  let errorRenders = 0
  let notFoundRenders = 0

  function Root() {
    return createElement(
      'section',
      { 'data-boundary-root': 'true' },
      createElement(Outlet),
    )
  }

  function Pending() {
    pendingRenders += 1
    return createElement(
      'p',
      { 'data-root-pending': 'true' },
      'root-pending',
    )
  }

  function ErrorBoundary({ error }: { error: Error }) {
    errorRenders += 1
    return createElement(
      'p',
      { 'data-root-error': error.message },
      'root-error',
    )
  }

  function NotFoundBoundary() {
    notFoundRenders += 1
    return createElement(
      'p',
      { 'data-root-not-found': 'true' },
      'root-not-found',
    )
  }

  const root = createRootRoute({
    component: Root,
    pendingMs: 0,
    pendingComponent: Pending,
    errorComponent: ErrorBoundary,
    notFoundComponent: NotFoundBoundary,
    loader: () => {
      if (mode === 'error') {
        throw new Error('remote root loader failed')
      }

      if (mode === 'not-found') {
        throw notFound({ data: { source: 'remote-root-loader' } })
      }

      return { source: 'remote-root-loader' }
    },
  })
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => createElement('p', null, 'boundary-index'),
  })

  return {
    root,
    index,
    tree: root.addChildren([index]),
    getBoundaryRenders: () => ({
      pending: pendingRenders,
      error: errorRenders,
      notFound: notFoundRenders,
    }),
    setMode(nextMode: typeof mode) {
      mode = nextMode
    },
  }
}

describe('attached remote runtime', () => {
  it('renders the projected remote root and its index component with root lifecycle data', async () => {
    const host = createRuntimeHost('/orders?tab=activity')
    const remote = createInstrumentedRemote()
    const adapter = new RouteTreeUpdateAdapter(() => host.router)

    await host.router.load()
    await adapter.attach({
      mountRoute: host.mount,
      loadRouteTree: async () => remote.tree,
    })

    const markup = renderRouter(host.router)

    expect(markup).toContain('data-remote-root="remote-root-loader"')
    expect(markup).toContain('data-root-context="root-before-load"')
    expect(markup).toContain('data-root-tab="activity"')
    expect(markup).toContain('data-remote-index="remote-index-loader"')
    expect(markup).toContain('data-index-context="root-before-load"')
    expect(markup).toContain('remote-index')
    expect(remote.lifecycle.rootValidateSearch).toBeGreaterThan(0)
    expect(remote.lifecycle.rootBeforeLoad).toBe(1)
    expect(remote.lifecycle.rootLoader).toBe(1)
    expect(remote.lifecycle.indexLoader).toBe(1)

    const rootMatch = host.router.state.matches.find(
      (match) =>
        (match.staticData as { cacheProbe?: string }).cacheProbe ===
        'remote-root',
    )
    const indexMatch = host.router.state.matches.find(
      (match) =>
        (match.staticData as { cacheProbe?: string }).cacheProbe ===
        'remote-index',
    )

    expect(rootMatch?.loaderData).toMatchObject({
      source: 'remote-root-loader',
      contextMarker: 'root-before-load',
    })
    expect(rootMatch?.search).toMatchObject({ tab: 'activity' })
    expect(indexMatch?.loaderData).toMatchObject({
      source: 'remote-index-loader',
      contextMarker: 'root-before-load',
    })
  })

  it('renders nested remote routes with params through one shared host runtime', async () => {
    const host = createRuntimeHost('/orders/42/line-items?tab=detail')
    const remote = createInstrumentedRemote()
    const adapter = new RouteTreeUpdateAdapter(() => host.router)

    await host.router.load()
    await adapter.attach({
      mountRoute: host.mount,
      loadRouteTree: async () => remote.tree,
    })

    const markup = renderRouter(host.router)
    const rootRouter = remote.lifecycle.rootRouters.at(-1) as typeof host.router
    const detailRouter = remote.lifecycle.detailRouters.at(-1)
    const lineItemsRouter = remote.lifecycle.lineItemsRouters.at(-1)
    const attachedTree = host.router.routeTree

    expect(markup).toContain('data-remote-root="remote-root-loader"')
    expect(markup).toContain('data-remote-detail="remote-detail-loader"')
    expect(markup).toContain('data-detail-order-id="42"')
    expect(markup).toContain('data-remote-line-items="remote-line-items-loader"')
    expect(markup).toContain('data-line-items-order-id="42"')
    expect(remote.lifecycle.rootLoader).toBe(1)
    expect(remote.lifecycle.detailLoader).toBe(1)
    expect(remote.lifecycle.lineItemsLoader).toBe(1)

    // The mounted remote gets a navigation facade, not a second TanStack
    // Router. All route components observe the same facade and its runtime
    // stores/history are the original host instances.
    expect(rootRouter).not.toBe(host.router)
    expect(rootRouter).toBe(detailRouter)
    expect(rootRouter).toBe(lineItemsRouter)
    expect(rootRouter.history).toBe(host.router.history)
    expect(rootRouter.stores).toBe(host.router.stores)
    expect(rootRouter.routeTree).toBe(host.router.routeTree)

    const detailMatch = host.router.state.matches.find(
      (match) =>
        (match.staticData as { cacheProbe?: string }).cacheProbe ===
        'remote-detail',
    )
    const lineItemsMatch = host.router.state.matches.find(
      (match) =>
        (match.staticData as { cacheProbe?: string }).cacheProbe ===
        'remote-line-items',
    )

    expect(detailMatch?.params).toMatchObject({ orderId: '42' })
    expect(detailMatch?.loaderData).toMatchObject({
      source: 'remote-detail-loader',
      orderId: '42',
    })
    expect(lineItemsMatch?.params).toMatchObject({ orderId: '42' })
    expect(lineItemsMatch?.loaderData).toMatchObject({
      source: 'remote-line-items-loader',
      orderId: '42',
    })

    await rootRouter.navigate({ to: '/' } as never)

    expect(host.router.state.location.pathname).toBe('/orders')
    expect(host.router.routeTree).toBe(attachedTree)
    expect(renderRouter(host.router)).toContain('data-remote-index="remote-index-loader"')

    const indexRootRouter = remote.lifecycle.rootRouters.at(-1) as typeof host.router
    const indexRouter = remote.lifecycle.indexRouters.at(-1)

    expect(indexRootRouter).toBe(indexRouter)
    expect(indexRootRouter.stores).toBe(host.router.stores)
    expect(indexRootRouter.stores.matches).toBe(host.router.stores.matches)
    expect(indexRootRouter.state.location.pathname).toBe(
      host.router.state.location.pathname,
    )
  })

  it('retains native root, index, detail, and nested loader cache across SPA transitions', async () => {
    const host = createRuntimeHost('/orders?tab=overview')
    const remote = createInstrumentedRemote()
    const adapter = new RouteTreeUpdateAdapter(() => host.router)

    await host.router.load()
    await adapter.attach({
      mountRoute: host.mount,
      loadRouteTree: async () => remote.tree,
    })

    renderRouter(host.router)

    expect(remote.lifecycle.rootLoader).toBe(1)
    expect(remote.lifecycle.indexLoader).toBe(1)

    await host.router.navigate({ to: '/home' })
    await host.router.navigate({ to: '/orders', search: { tab: 'overview' } })

    expect(remote.lifecycle.rootLoader).toBe(1)
    expect(remote.lifecycle.indexLoader).toBe(1)

    await host.router.navigate({ to: '/orders/42/line-items' } as never)

    expect(remote.lifecycle.rootLoader).toBe(1)
    expect(remote.lifecycle.detailLoader).toBe(1)
    expect(remote.lifecycle.lineItemsLoader).toBe(1)

    await host.router.navigate({ to: '/home' })

    const cachedProbes = host.router.stores.cachedMatches
      .get()
      .map((match) => (match.staticData as { cacheProbe?: string }).cacheProbe)

    expect(cachedProbes).toEqual(
      expect.arrayContaining([
        'remote-root',
        'remote-index',
        'remote-detail',
        'remote-line-items',
      ]),
    )

    await host.router.navigate({ to: '/orders/42/line-items' } as never)

    expect(remote.lifecycle.rootLoader).toBe(1)
    expect(remote.lifecycle.indexLoader).toBe(1)
    expect(remote.lifecycle.detailLoader).toBe(1)
    expect(remote.lifecycle.lineItemsLoader).toBe(1)
  })

  it('matches through a host basepath and preserves it for scoped remote navigation', async () => {
    const host = createRuntimeHost(
      '/platform/orders/42?tab=detail',
      '/platform',
    )
    const remote = createInstrumentedRemote()
    const adapter = new RouteTreeUpdateAdapter(() => host.router)

    await host.router.load()
    await adapter.attach({
      mountRoute: host.mount,
      loadRouteTree: async () => remote.tree,
    })

    expect(renderRouter(host.router)).toContain('data-detail-order-id="42"')

    const scopedRouter = remote.lifecycle.rootRouters.at(-1) as typeof host.router

    await scopedRouter.navigate({ to: '/' } as never)

    expect(host.router.history.location.pathname).toBe('/platform/orders')
    expect(renderRouter(host.router)).toContain('data-remote-index="remote-index-loader"')
  })

  it('attaches nested remote trees through one host adapter and composes scoped navigation', async () => {
    let invoicesRouter: unknown

    function OrdersRoot() {
      return createElement(
        'section',
        { 'data-orders-root': 'true' },
        createElement(Outlet),
      )
    }

    function InvoicesMount() {
      return createElement(
        'section',
        { 'data-invoices-mount': 'true' },
        createElement(Outlet),
      )
    }

    function InvoicesRoot() {
      invoicesRouter = useRouter()
      return createElement(
        'section',
        { 'data-invoices-root': 'true' },
        createElement(Outlet),
      )
    }

    const ordersRoot = createRootRoute({ component: OrdersRoot })
    const ordersIndex = createRoute({
      getParentRoute: () => ordersRoot,
      path: '/',
      component: () => createElement('p', null, 'orders-index'),
    })
    const invoicesMount = createRemoteRoute({
      getParentRoute: () => ordersRoot,
      path: '/invoices',
      component: InvoicesMount,
      notFoundComponent: InvoicesMount,
    }) as AnyRoute

    const invoicesRoot = createRootRoute({ component: InvoicesRoot })
    const invoicesIndex = createRoute({
      getParentRoute: () => invoicesRoot,
      path: '/',
      component: () => createElement('p', null, 'invoices-index'),
    })
    const invoiceDetail = createRoute({
      getParentRoute: () => invoicesRoot,
      path: '/$invoiceId',
      component: () => {
        const params = useParams({ strict: false }) as { invoiceId?: string }

        return createElement(
          'p',
          { 'data-invoice-id': params.invoiceId },
          'invoice-detail',
        )
      },
    })
    const host = createRuntimeHost('/orders/invoices/42')
    const adapter = new RouteTreeUpdateAdapter(() => host.router)

    await host.router.load()
    await adapter.attach({
      mountRoute: host.mount,
      loadRouteTree: async () =>
        ordersRoot.addChildren([ordersIndex, invoicesMount]),
    })
    await adapter.attach({
      mountRoute: invoicesMount,
      loadRouteTree: async () =>
        invoicesRoot.addChildren([invoicesIndex, invoiceDetail]),
    })

    expect(renderRouter(host.router)).toContain('data-invoice-id="42"')
    expect(adapter.getSnapshot(host.mount)).toEqual({ state: 'attached' })
    expect(adapter.getSnapshot(invoicesMount)).toEqual({ state: 'attached' })

    const scopedInvoicesRouter = invoicesRouter as typeof host.router

    expect(scopedInvoicesRouter).not.toBe(host.router)
    expect(scopedInvoicesRouter.history).toBe(host.router.history)
    expect(scopedInvoicesRouter.stores).toBe(host.router.stores)

    await scopedInvoicesRouter.navigate({ to: '/' } as never)

    expect(host.router.history.location.pathname).toBe('/orders/invoices')
    expect(renderRouter(host.router)).toContain('invoices-index')
  })

  it('projects root pending/error/not-found boundaries and executes root error and not-found states', async () => {
    const host = createRuntimeHost('/orders?tab=overview')
    const remote = createRootBoundaryRemote()
    const adapter = new RouteTreeUpdateAdapter(() => host.router)

    await host.router.load()
    await adapter.attach({
      mountRoute: host.mount,
      loadRouteTree: async () => remote.tree,
    })

    const bridge = remote.index.parentRoute as AnyRoute

    expect(bridge.options.pendingComponent).toBe(remote.root.options.pendingComponent)
    expect(bridge.options.errorComponent).toBe(remote.root.options.errorComponent)
    expect(bridge.options.notFoundComponent).toBe(remote.root.options.notFoundComponent)

    remote.setMode('error')
    await host.router.invalidate({ forcePending: true })

    expect(renderRouter(host.router)).toContain(
      'data-root-error="remote root loader failed"',
    )
    expect(remote.getBoundaryRenders().error).toBe(1)
    expect(adapter.getSnapshot(host.mount)).toEqual({ state: 'attached' })

    remote.setMode('not-found')
    await host.router.invalidate({ forcePending: true })

    expect(renderRouter(host.router)).toContain('data-root-not-found="true"')
    expect(remote.getBoundaryRenders().notFound).toBe(1)
    expect(adapter.getSnapshot(host.mount)).toEqual({ state: 'attached' })
    // SSR cannot display client-only pending UI; this assertion protects the
    // projected option while browser coverage verifies its visual behavior.
    expect(remote.getBoundaryRenders().pending).toBe(0)
  })
})
