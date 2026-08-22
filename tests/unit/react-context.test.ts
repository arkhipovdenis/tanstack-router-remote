import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  RouterContextProvider,
  createMemoryHistory,
  createRoute,
  createRootRoute,
  createRouter,
  useRouter,
} from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from '../../packages/route-tree-adapter/src/react'
// Not public API: RemoteRouteMount is its only caller. Tested directly because
// these two properties - one adapter per provider, and a named failure outside
// it - are what the provider exists for.
import { useRemoteRouterAdapter } from '../../packages/route-tree-adapter/src/react/components'
import { provideScopedRouter } from '../../packages/route-tree-adapter/src/react/internal/scoped-router'

describe('RemoteRouterProvider', () => {
  it('supplies the same host-owned adapter to every descendant', () => {
    const adapter = new RemoteRouterAdapter(() => {
      throw new Error('The adapter is not expected to attach in this test')
    })
    const received: unknown[] = []

    function Probe() {
      received.push(useRemoteRouterAdapter())
      return null
    }

    renderToStaticMarkup(
      createElement(RemoteRouterProvider, {
        adapter,
        children: createElement(
          Fragment,
          null,
          createElement(Probe),
          createElement(Probe),
        ),
      }),
    )

    expect(received).toEqual([adapter, adapter])
  })

  it('fails fast outside the host adapter provider', () => {
    function Probe() {
      useRemoteRouterAdapter()
      return null
    }

    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(
      'RemoteRouterProvider',
    )
  })

  it('keeps the host adapter through nested scoped router facades', async () => {
    const rootRoute = createRootRoute({ component: () => null })
    const ordersRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/orders',
      component: () => null,
    })
    const invoicesRoute = createRoute({
      getParentRoute: () => ordersRoute,
      path: '/invoices',
      component: () => null,
    })
    const hostRouter = createRouter({
      routeTree: rootRoute.addChildren([
        ordersRoute.addChildren([invoicesRoute]),
      ]),
      history: createMemoryHistory({
        initialEntries: ['/orders/invoices'],
      }),
    })
    const adapter = new RemoteRouterAdapter(() => hostRouter)
    let receivedAdapter: unknown
    let receivedRouter: unknown

    await hostRouter.load()

    function Probe() {
      receivedAdapter = useRemoteRouterAdapter()
      receivedRouter = useRouter()
      return null
    }
    const InvoicesScopedProbe = provideScopedRouter('/orders/invoices', Probe)
    const ScopedProbe = provideScopedRouter('/orders', InvoicesScopedProbe)

    renderToStaticMarkup(
      createElement(RemoteRouterProvider, {
        adapter,
        children: createElement(RouterContextProvider, {
          router: hostRouter,
          children: createElement(ScopedProbe),
        }),
      }),
    )

    expect(receivedRouter).not.toBe(hostRouter)
    expect((receivedRouter as typeof hostRouter).history).toBe(
      hostRouter.history,
    )
    expect((receivedRouter as typeof hostRouter).stores).toBe(hostRouter.stores)
    expect(receivedAdapter).toBe(adapter)

    await (receivedRouter as typeof hostRouter).navigate({ to: '/' } as never)

    expect(hostRouter.state.location.pathname).toBe('/orders/invoices')
  })
})
