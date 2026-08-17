// Shared runtime fixtures for the attached-remote tests.
//
// Extracted so the SPA-transition cache test can run in a `jsdom` environment
// (loader caching only exists on router-core's client build) while the SSR
// oriented tests keep the default `node` environment.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useLoaderData,
  useParams,
  useRouter,
  useSearch,
  type AnyRoute,
} from '@tanstack/react-router'

import { createRemoteRoute } from '../../packages/route-tree-adapter/src'

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

export { Null, renderRouter, createRuntimeHost, createInstrumentedRemote }
