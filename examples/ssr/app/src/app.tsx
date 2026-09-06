import { useEffect, useState } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Link,
  Outlet,
} from '@tanstack/react-router'
import {
  createRemoteRoute,
  RemoteRouterAdapter,
  RemoteRouteMount,
} from 'tanstack-router-remote/react'

// Called independently for every server request and once for client bootstrap.
export function createApp(url: string, isServer: boolean) {
  const remoteRoot = createRootRoute({
    component: () => (
      <>
        <h2>Orders remote</h2>
        <Outlet />
      </>
    ),
  })
  const detail = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/$orderId',
    loader: ({ params }) => ({ label: `Server-ready order ${params.orderId}` }),
    staleTime: Infinity,
    component: Detail,
  })
  function Detail() {
    const data = detail.useLoaderData()
    const [clicks, setClicks] = useState(0)
    const [hydrated, setHydrated] = useState(false)
    useEffect(() => setHydrated(true), [])
    return (
      <section>
        <p>{data.label}</p>
        <p>{hydrated ? 'Client hydrated' : 'Server rendered'}</p>
        <button onClick={() => setClicks((value) => value + 1)}>
          Clicks: {clicks}
        </button>
        <Link to="/$orderId" params={{ orderId: '77' }}>
          Order 77
        </Link>
      </section>
    )
  }
  const remoteTree = remoteRoot.addChildren([detail])
  const root = createRootRoute({
    component: () => (
      <main>
        <h1>Prepared SSR host</h1>
        <Outlet />
      </main>
    ),
  })
  const mount = createRemoteRoute({
    getParentRoute: () => root,
    path: '/orders',
    component: Mount,
  })
  function Mount() {
    return (
      <RemoteRouteMount
        mountRoute={mount}
        loadRouteTree={async () => remoteTree}
      >
        <Outlet />
      </RemoteRouteMount>
    )
  }
  const router = createRouter({
    routeTree: root.addChildren([mount]),
    ...(isServer
      ? { history: createMemoryHistory({ initialEntries: [url] }) }
      : {}),
    isServer,
  })
  const adapter = new RemoteRouterAdapter(() => router)
  return {
    router,
    adapter,
    prepare: () =>
      adapter.prepare({
        mountRoute: mount,
        loadRouteTree: async () => remoteTree,
      }),
  }
}
