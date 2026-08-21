import { loadRemote } from '@module-federation/runtime'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
  type AnyRouter,
} from '@tanstack/react-router'
import {
  createRemoteRoute,
  RemoteRouteMount,
} from '@tanstack-router-remote/route-tree-adapter'

type RemoteRouteTreeModule = {
  routeTree: AnyRoute
}

/**
 * This context value exists only to make the runnable example observable. It
 * lets the remote compare its contextual scoped router with the raw host
 * router without adding a runtime contract to the adapter package.
 */
export type DemoRuntimeProbe = {
  readonly hostRouterId: string
  rawRouter: AnyRouter | null
  routeTreeAdapter: object | null
}

export const demoRuntimeProbe: DemoRuntimeProbe = {
  hostRouterId: `host-router-${Date.now().toString(36)}`,
  rawRouter: null,
  routeTreeAdapter: null,
}

const loadOrdersRouteTree = async () => {
  const remote = await loadRemote<RemoteRouteTreeModule>('orders/routeTree')

  if (!remote?.routeTree) {
    throw new Error('orders/routeTree did not expose routeTree')
  }

  return remote.routeTree
}

const rootRoute = createRootRoute({
  component: HostShell,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <section>
      <h2>Host home</h2>
      <p>
        Open the remote with a native TanStack Link. The remote screen is an
        interactive evidence lab: root, pathless layout, index, params,
        search, loaders, boundaries, React state, native route cache, and
        shared router stores.
      </p>
      <p className="runtime-note" data-testid="host-runtime-id">
        Host runtime identity: <code>{demoRuntimeProbe.hostRouterId}</code>
      </p>
    </section>
  ),
})

const ordersMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrdersMount,
})

const routeTree = rootRoute.addChildren([homeRoute, ordersMountRoute])

export const router = createRouter({
  routeTree,
  basepath: '/platform',
  // Safe since imperative `preloadRoute`/`matchRoute` became scoped: a remote
  // `to` no longer resolves against the host tree. Hovering an unattached mount
  // preloads nothing (it is a static route), and the transport still runs once,
  // on navigation.
  defaultPreload: 'intent',
  context: {
    demoRuntimeProbe,
  },
})

demoRuntimeProbe.rawRouter = router

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function HostShell() {
  return (
    <main>
      <p className="eyebrow">TanStack Router Remote</p>
      <h1>Host /platform</h1>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/orders" preload={false}>
          Orders remote
        </Link>
      </nav>
      <p className="runtime-note">
        One host router is retained for the complete browser session. The
        remote receives a scoped navigation facade over that runtime.
      </p>
      <Outlet />
    </main>
  )
}

function OrdersMount() {
  return (
    <RemoteRouteMount
      mountRoute={ordersMountRoute}
      loadRouteTree={loadOrdersRouteTree}
      loading={<p data-testid="orders-loading">Loading orders route tree…</p>}
      error={(error) => (
        <p data-testid="orders-error">Orders failed to load: {error.message}</p>
      )}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}
