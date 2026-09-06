// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterContextProvider,
} from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import {
  createRemoteRoute,
  RemoteRouterAdapter,
  resolveRemotePath,
} from '../../packages/route-tree-adapter/src/react'
import { createScopedRouter } from '../../packages/route-tree-adapter/src/core/internal/scoped-router'

const Null = () => null

describe('explicit remote paths', () => {
  it('builds, renders, preloads and navigates a colliding path with a host basepath', async () => {
    const root = createRootRoute({ component: Null })
    const mount = createRemoteRoute({
      getParentRoute: () => root,
      path: '/orders',
      component: Null,
    })
    const hostHistory = createRoute({
      getParentRoute: () => root,
      path: '/orders/history',
      component: Null,
    })
    const router = createRouter({
      routeTree: root.addChildren([mount, hostHistory]),
      basepath: '/platform',
      history: createMemoryHistory({ initialEntries: ['/platform/'] }),
    })
    const remote = createRootRoute({ component: Null })
    const loader = vi.fn(() => 'remote-history')
    const history = createRoute({
      getParentRoute: () => remote,
      path: '/orders/history',
      component: Null,
      loader,
      staleTime: Infinity,
    })
    await new RemoteRouterAdapter(() => router).attach({
      mountRoute: mount,
      loadRouteTree: async () => remote.addChildren([history]),
    })
    const scoped = createScopedRouter(router, mount.fullPath)
    const to = resolveRemotePath(scoped, '/orders/history')
    expect(to).toBe('/orders/orders/history')
    expect(scoped.buildLocation({ to } as never).href).toBe(
      '/platform/orders/orders/history',
    )
    const html = renderToString(
      createElement(RouterContextProvider, {
        router: scoped,
        children: createElement(
          Link as never,
          { to, children: 'History' } as never,
        ),
      }),
    )
    expect(html).toContain('href="/platform/orders/orders/history"')
    await scoped.preloadRoute({ to } as never)
    expect(loader).toHaveBeenCalledTimes(1)
    await scoped.navigate({ to } as never)
    expect(router.state.location.pathname).toBe('/orders/orders/history')
    expect(router.history.location.pathname).toBe(
      '/platform/orders/orders/history',
    )
    expect(router.state.matches.at(-1)?.routeId).toBe(history.id)
    expect(scoped.matchRoute({ to } as never)).not.toBe(false)
    await router.navigate({ to: '/orders/history' } as never)
    expect(router.state.matches.at(-1)?.routeId).toBe(hostHistory.id)
  })

  it('resolves nested and standalone paths without duplicating the host prefix', () => {
    const router = createRouter({
      routeTree: createRootRoute(),
      history: createMemoryHistory(),
    })
    const parent = createScopedRouter(router, '/orders')
    const nested = createScopedRouter(parent, '/orders/invoices')
    expect(resolveRemotePath(nested, '/invoices/history')).toBe(
      '/orders/invoices/invoices/history',
    )
    expect(resolveRemotePath(nested, '/')).toBe('/orders/invoices')
    expect(resolveRemotePath(router, '/orders/history')).toBe('/orders/history')
    expect(
      nested.buildLocation({
        to: resolveRemotePath(nested, '/invoices/history'),
      } as never).pathname,
    ).toBe('/orders/invoices/invoices/history')
  })

  it.each(['relative', '//other-host/path', '/path?search=1', '/path#hash'])(
    'rejects ambiguous non-route input %s',
    (path) => {
      const router = createRouter({
        routeTree: createRootRoute(),
        history: createMemoryHistory(),
      })
      expect(() => resolveRemotePath(router, path)).toThrow(
        'root-relative route path',
      )
    },
  )
})
