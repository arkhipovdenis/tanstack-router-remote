// Loader caching only exists on router-core's client build, which newer
// versions select by export condition — the default `node` environment
// resolves the server build, where matches are not cached across navigations.
// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'

import {
  createRemoteRoute,
  RemoteRouterAdapter,
} from '../../packages/route-tree-adapter/src/react'
import { scopeLocationOptions } from '../../packages/route-tree-adapter/src/core/internal/scoped-router'
import { clearRouterCache, isNotFoundMatch } from '../support/router-compat'

const Null = () => null

function childRoutesOf(route: AnyRoute) {
  if (Array.isArray(route.children)) {
    return route.children as AnyRoute[]
  }

  return Object.values(route.children ?? {}) as AnyRoute[]
}

function routeId(mountPath: string, childPath: string) {
  return mountPath + '/__remote-root-bridge' + childPath
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}

function generatedRemote() {
  const rootLoader = () => ({ source: 'remote-root' })
  const root = createRootRoute({
    component: Null,
    loader: rootLoader,
    staticData: { remote: true },
  })
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: Null,
  })
  const detail = createRoute({
    getParentRoute: () => root,
    path: '/$orderId',
    component: Null,
  })

  return {
    root,
    rootLoader,
    index,
    detail,
    tree: root.addChildren([index, detail]),
  }
}

function cacheableRemote() {
  let detailRuns = 0
  const root = createRootRoute({ component: Null })
  const detail = createRoute({
    getParentRoute: () => root,
    path: '/$orderId',
    component: Null,
    staticData: { cacheProbe: 'remote-detail' },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    loader: () => ({ run: ++detailRuns }),
  })

  return {
    detail,
    tree: root.addChildren([detail]),
    detailRuns: () => detailRuns,
  }
}

function host(mountPaths: string[]) {
  const root = createRootRoute({ component: Null })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/home',
    component: Null,
  })
  const mounts = mountPaths.map((path) => {
    const mount = createRemoteRoute({
      getParentRoute: () => root,
      path,
      component: Null,
      notFoundComponent: Null,
    }) as AnyRoute

    return mount
  })

  return {
    home: home as AnyRoute,
    mounts,
    tree: root.addChildren([home, ...mounts]),
  }
}

describe('route-tree update adapter', () => {
  it('prepares a remote tree without loading it, for an explicit SSR bootstrap', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
      isServer: true,
    })
    const adapter = new RemoteRouterAdapter(() => router)

    await adapter.prepare({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => remote.tree,
    })

    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'prepared' })
    expect(router.state.matches.map((match) => match.routeId)).toEqual([])
    expect(
      (router.routesById as Record<string, unknown>)[
        routeId('/orders', '/$orderId')
      ],
    ).toBe(remote.detail)

    await router.load()

    expect(router.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('upgrades a prepared tree through attach without loading its remote twice', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)
    const loadRouteTree = vi.fn(async () => remote.tree)

    await adapter.prepare({ mountRoute: local.mounts[0], loadRouteTree })
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'prepared' })

    await adapter.attach({ mountRoute: local.mounts[0], loadRouteTree })

    expect(loadRouteTree).toHaveBeenCalledTimes(1)
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'attached' })
    expect(router.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('upgrades an in-flight preparation to attach after the one shared graft', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)
    const remoteReady = deferred<AnyRoute>()
    const loadRouteTree = vi.fn(async () => remoteReady.promise)

    const preparation = adapter.prepare({
      mountRoute: local.mounts[0],
      loadRouteTree,
    })
    const attachment = adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree,
    })

    remoteReady.resolve(remote.tree)
    await Promise.all([preparation, attachment])

    expect(loadRouteTree).toHaveBeenCalledTimes(1)
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'attached' })
    expect(router.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('creates a childless local fuzzy not-found mount before router creation', async () => {
    const local = host(['/orders'])
    const mount = local.mounts[0]
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })

    await router.load()

    expect(childRoutesOf(mount)).toEqual([])
    expect(router.state.matches.map((match) => match.routeId)).toEqual([
      '__root__',
      '/orders',
    ])
    expect(isNotFoundMatch(router.state.matches.at(-1))).toBe(true)
  })

  it('resolves the router lazily, after the remote tree has loaded', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    let router: ReturnType<typeof createRouter<typeof local.tree>> | undefined
    const getRouter = vi.fn(() => {
      if (!router) {
        throw new Error('Router was accessed before the host created it')
      }

      return router
    })
    const adapter = new RemoteRouterAdapter(getRouter)

    expect(getRouter).not.toHaveBeenCalled()

    const hostRouter = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    router = hostRouter

    await hostRouter.load()
    expect(getRouter).not.toHaveBeenCalled()

    const loadRouteTree = vi.fn(async () => {
      expect(getRouter).not.toHaveBeenCalled()
      return remote.tree
    })

    await adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree,
    })

    expect(loadRouteTree).toHaveBeenCalledTimes(1)
    expect(getRouter).toHaveBeenCalledTimes(1)
    expect(hostRouter.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('does not mutate or poison a mount when the lazy router getter fails', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    let resolveRouter: () => typeof router = () => {
      throw new Error('router is not ready')
    }
    const adapter = new RemoteRouterAdapter(() => resolveRouter())

    await router.load()
    await expect(
      adapter.attach({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => remote.tree,
      }),
    ).rejects.toThrow('router is not ready')

    expect(childRoutesOf(local.mounts[0])).toEqual([])
    expect(adapter.getSnapshot(local.mounts[0]).state).toBe('error')

    resolveRouter = () => router
    await adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => remote.tree,
    })

    expect(adapter.getSnapshot(local.mounts[0]).state).toBe('attached')
    expect(router.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('pins the first router resolved by a lazy getter', async () => {
    const local = host(['/orders', '/payments'])
    const orders = generatedRemote()
    const payments = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const getRouter = vi.fn(() => router)
    const adapter = new RemoteRouterAdapter(getRouter)

    await router.load()
    await adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => orders.tree,
    })
    await adapter.attach({
      mountRoute: local.mounts[1],
      loadRouteTree: async () => payments.tree,
    })

    expect(getRouter).toHaveBeenCalledTimes(1)
    expect(adapter.getSnapshot(local.mounts[0]).state).toBe('attached')
    expect(adapter.getSnapshot(local.mounts[1]).state).toBe('attached')
  })

  it('keeps the same router/history, projects root options, and rematches a deep link', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const history = createMemoryHistory({ initialEntries: ['/orders/42'] })
    const router = createRouter({ routeTree: local.tree, history })
    const adapter = new RemoteRouterAdapter(() => router)

    await router.load()
    const originalRouter = router
    const originalTree = router.routeTree

    await adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => remote.tree,
    })

    const bridge = remote.detail.parentRoute as AnyRoute

    expect(router).toBe(originalRouter)
    expect(router.history).toBe(history)
    expect(router.routeTree).not.toBe(originalTree)
    expect(router.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
    expect(router.state.matches.at(-1)?.params).toMatchObject({ orderId: '42' })
    expect(isNotFoundMatch(router.state.matches.at(-1))).toBe(false)
    expect(router.routesById[routeId('/orders', '/$orderId')]).toBe(
      remote.detail,
    )
    expect(bridge.parentRoute).toBe(local.mounts[0])
    expect(bridge.options.loader).toBe(remote.rootLoader)
    expect(bridge.options.staticData).toMatchObject({
      remote: true,
      remoteRootBridge: true,
      remoteOriginalRootId: '__root__',
    })
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'attached' })
    expect(() => clearRouterCache(router)).not.toThrow()
  })

  it('attaches a mount once and keeps its branch stable through SPA transitions', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const history = createMemoryHistory({ initialEntries: ['/orders/42'] })
    const router = createRouter({ routeTree: local.tree, history })
    const adapter = new RemoteRouterAdapter(() => router)
    const loadRouteTree = vi.fn(async () => remote.tree)

    await router.load()
    await adapter.attach({ mountRoute: local.mounts[0], loadRouteTree })

    const attachedTree = router.routeTree

    for (const orderId of ['43', '44']) {
      await router.navigate({ to: '/home' })
      await router.navigate({ to: '/orders/' + orderId } as never)

      expect(router.routeTree).toBe(attachedTree)
      expect(router.state.matches.at(-1)?.routeId).toBe(
        routeId('/orders', '/$orderId'),
      )
      expect(router.state.matches.at(-1)?.params).toMatchObject({ orderId })
    }

    await adapter.attach({ mountRoute: local.mounts[0], loadRouteTree })

    expect(loadRouteTree).toHaveBeenCalledTimes(1)
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'attached' })
  })

  it('keeps native remote loader cache through home-to-remote navigation', async () => {
    const local = host(['/orders'])
    const remote = cacheableRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const getRouter = vi.fn(() => router)
    const adapter = new RemoteRouterAdapter(getRouter)

    await router.load()
    await adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => remote.tree,
    })

    expect(remote.detailRuns()).toBe(1)
    await router.navigate({ to: '/home' })

    expect(
      router.state.matches.some((match) => {
        const staticData = match.staticData as
          Record<string, unknown> | undefined

        return staticData?.cacheProbe === 'remote-detail'
      }),
    ).toBe(false)

    await router.navigate({ to: '/orders/42' } as never)

    // The cached-match list has no public accessor on newer routers, so the
    // cache is asserted by its effect: returning must not re-run the loader.
    expect(remote.detailRuns()).toBe(1)
  })

  it('serializes two independent mount attachments on the same router', async () => {
    const local = host(['/orders', '/payments'])
    const orders = generatedRemote()
    const payments = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)
    const calls: string[] = []
    const ordersStarted = deferred()
    const releaseOrders = deferred()

    await router.load()
    const ordersAttachment = adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => {
        calls.push('orders:start')
        ordersStarted.resolve()
        await releaseOrders.promise
        calls.push('orders:end')
        return orders.tree
      },
    })

    await ordersStarted.promise

    const paymentsAttachment = adapter.attach({
      mountRoute: local.mounts[1],
      loadRouteTree: async () => {
        calls.push('payments')
        return payments.tree
      },
    })

    expect(calls).toEqual(['orders:start'])

    releaseOrders.resolve()
    await Promise.all([ordersAttachment, paymentsAttachment])

    expect(calls).toEqual(['orders:start', 'orders:end', 'payments'])
    expect(router.routesById[routeId('/orders', '/$orderId')]).toBe(
      orders.detail,
    )
    expect(router.routesById[routeId('/payments', '/$orderId')]).toBe(
      payments.detail,
    )
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'attached' })
    expect(adapter.getSnapshot(local.mounts[1])).toEqual({ state: 'attached' })
  })

  it('collapses concurrent attachments into one update() and one load()', async () => {
    const local = host(['/orders', '/payments', '/invoices'])
    const remotes = [generatedRemote(), generatedRemote(), generatedRemote()]
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)

    await router.load()

    const update = vi.spyOn(router, 'update')
    const load = vi.spyOn(router, 'load')
    const transports: string[] = []

    await Promise.all(
      local.mounts.map((mountRoute, index) =>
        adapter.attach({
          mountRoute,
          loadRouteTree: async () => {
            transports.push('start:' + index)
            await Promise.resolve()
            transports.push('end:' + index)
            return remotes[index].tree
          },
        }),
      ),
    )

    // One reindex and one rematch for the whole batch, not one per mount.
    expect(update).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(1)
    // Transports overlap instead of running back to back.
    expect(transports).toEqual([
      'start:0',
      'start:1',
      'start:2',
      'end:0',
      'end:1',
      'end:2',
    ])

    for (const [index, mount] of local.mounts.entries()) {
      expect(adapter.getSnapshot(mount)).toEqual({ state: 'attached' })
      expect(
        router.routesById[routeId(mount.fullPath as string, '/$orderId')],
      ).toBe(remotes[index].detail)
    }

    expect(router.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('fails only the unavailable remote when a batch is partially broken', async () => {
    const local = host(['/orders', '/payments', '/invoices'])
    const orders = generatedRemote()
    const invoices = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)

    await router.load()
    const update = vi.spyOn(router, 'update')

    const settled = await Promise.allSettled([
      adapter.attach({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => orders.tree,
      }),
      adapter.attach({
        mountRoute: local.mounts[1],
        loadRouteTree: async () => {
          throw new Error('remote unavailable')
        },
      }),
      adapter.attach({
        mountRoute: local.mounts[2],
        loadRouteTree: async () => invoices.tree,
      }),
    ])

    expect(settled.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ])
    expect(update).toHaveBeenCalledTimes(1)
    expect(router.routesById[routeId('/orders', '/$orderId')]).toBe(
      orders.detail,
    )
    expect(router.routesById[routeId('/payments', '/$orderId')]).toBeUndefined()
    expect(router.routesById[routeId('/invoices', '/$orderId')]).toBe(
      invoices.detail,
    )
    expect(adapter.getSnapshot(local.mounts[1])).toMatchObject({
      state: 'error',
      error: { message: 'remote unavailable' },
    })
    // A broken sibling must not poison a healthy mount that shared its batch.
    expect(childRoutesOf(local.mounts[1])).toEqual([])
  })

  it('rolls back every grafted member when the shared update() throws', async () => {
    const local = host(['/orders', '/payments'])
    const orders = generatedRemote()
    const payments = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)

    await router.load()
    vi.spyOn(router, 'update').mockImplementationOnce(() => {
      throw new Error('update failed')
    })

    const settled = await Promise.allSettled([
      adapter.attach({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => orders.tree,
      }),
      adapter.attach({
        mountRoute: local.mounts[1],
        loadRouteTree: async () => payments.tree,
      }),
    ])

    expect(settled.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ])

    for (const mount of local.mounts) {
      expect(childRoutesOf(mount)).toEqual([])
      expect(adapter.getSnapshot(mount).state).toBe('error')
    }

    // Both remote trees are detached again, so a server memoizing either one
    // can still serve the next request from a fresh host router.
    expect(orders.detail.options.getParentRoute()).toBe(orders.root)
    expect(payments.detail.options.getParentRoute()).toBe(payments.root)

    const fresh = host(['/orders', '/payments'])
    const freshRouter = createRouter({
      routeTree: fresh.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const freshAdapter = new RemoteRouterAdapter(() => freshRouter)

    await freshRouter.load()
    await Promise.all([
      freshAdapter.attach({
        mountRoute: fresh.mounts[0],
        loadRouteTree: async () => orders.tree,
      }),
      freshAdapter.attach({
        mountRoute: fresh.mounts[1],
        loadRouteTree: async () => payments.tree,
      }),
    ])

    expect(freshAdapter.getSnapshot(fresh.mounts[0])).toEqual({
      state: 'attached',
    })
    expect(freshAdapter.getSnapshot(fresh.mounts[1])).toEqual({
      state: 'attached',
    })
  })

  it('batches concurrent preparations without loading the router', async () => {
    const local = host(['/orders', '/payments'])
    const orders = generatedRemote()
    const payments = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
      isServer: true,
    })
    const adapter = new RemoteRouterAdapter(() => router)
    const update = vi.spyOn(router, 'update')
    const load = vi.spyOn(router, 'load')

    await Promise.all([
      adapter.prepare({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => orders.tree,
      }),
      adapter.prepare({
        mountRoute: local.mounts[1],
        loadRouteTree: async () => payments.tree,
      }),
    ])

    expect(update).toHaveBeenCalledTimes(1)
    // The SSR bootstrap still owns the first match.
    expect(load).not.toHaveBeenCalled()
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'prepared' })
    expect(adapter.getSnapshot(local.mounts[1])).toEqual({ state: 'prepared' })
    expect(router.state.matches.map((match) => match.routeId)).toEqual([])

    await router.load()

    expect(router.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('never lets a prepare() share a batch with an attach()', async () => {
    const local = host(['/orders', '/payments'])
    const orders = generatedRemote()
    const payments = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)

    await router.load()
    const load = vi.spyOn(router, 'load')

    const preparation = adapter.prepare({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => orders.tree,
    })
    const attachment = adapter.attach({
      mountRoute: local.mounts[1],
      loadRouteTree: async () => payments.tree,
    })

    await Promise.all([preparation, attachment])

    // The attach batch loads; the prepare batch must not have been dragged
    // into a client load it did not ask for.
    expect(load).toHaveBeenCalledTimes(1)
    expect(adapter.getSnapshot(local.mounts[0])).toEqual({ state: 'prepared' })
    expect(adapter.getSnapshot(local.mounts[1])).toEqual({ state: 'attached' })
  })

  it('deduplicates a reentrant attach from a loading subscriber', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)
    const loadRouteTree = vi.fn(async () => remote.tree)
    const states: string[] = []
    let reentered = false
    let reentrantRequest: Promise<void> | undefined

    adapter.subscribe(() => {
      states.push(adapter.getSnapshot(local.mounts[0]).state)
    })
    adapter.subscribe(() => {
      if (
        !reentered &&
        adapter.getSnapshot(local.mounts[0]).state === 'loading'
      ) {
        reentered = true
        reentrantRequest = adapter.attach({
          mountRoute: local.mounts[0],
          loadRouteTree,
        })
      }
    })

    await router.load()
    const request = adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree,
    })

    expect(reentrantRequest).toBe(request)
    await request

    expect(loadRouteTree).toHaveBeenCalledTimes(1)
    expect(states).toEqual(['loading', 'attached'])
    expect(Object.isFrozen(adapter.getSnapshot(local.mounts[0]))).toBe(true)
  })

  it('keeps an attachment successful when an observer throws', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)

    adapter.subscribe(() => {
      throw new Error('render observer failed')
    })

    await router.load()
    await expect(
      adapter.attach({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => remote.tree,
      }),
    ).resolves.toBeUndefined()

    expect(adapter.getSnapshot(local.mounts[0]).state).toBe('attached')
  })

  it('rejects a mutable remote tree that was already claimed by another mount', async () => {
    const local = host(['/orders', '/payments'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)

    await router.load()
    await adapter.attach({
      mountRoute: local.mounts[0],
      loadRouteTree: async () => remote.tree,
    })

    await expect(
      adapter.attach({
        mountRoute: local.mounts[1],
        loadRouteTree: async () => remote.tree,
      }),
    ).rejects.toThrow('already mounted at /orders')

    expect(router.routesById[routeId('/orders', '/$orderId')]).toBe(
      remote.detail,
    )
    expect(router.routesById[routeId('/payments', '/$orderId')]).toBeUndefined()
    expect(adapter.getSnapshot(local.mounts[1]).state).toBe('error')
  })

  it('reports a transport failure without mutating the host tree', async () => {
    const local = host(['/orders'])
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const getRouter = vi.fn(() => router)
    const adapter = new RemoteRouterAdapter(getRouter)
    const originalTree = router.routeTree

    await router.load()

    await expect(
      adapter.attach({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => {
          throw new Error('remote unavailable')
        },
      }),
    ).rejects.toThrow('remote unavailable')

    expect(router.routeTree).toBe(originalTree)
    expect(adapter.getSnapshot(local.mounts[0])).toMatchObject({
      state: 'error',
      error: { message: 'remote unavailable' },
    })
    expect(getRouter).not.toHaveBeenCalled()
  })

  it('poisons a mount when rematching fails after route-tree mutation', async () => {
    const local = host(['/orders'])
    const remote = generatedRemote()
    const router = createRouter({
      routeTree: local.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const adapter = new RemoteRouterAdapter(() => router)

    await router.load()
    vi.spyOn(router, 'load').mockRejectedValueOnce(new Error('rematch failed'))

    await expect(
      adapter.attach({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => remote.tree,
      }),
    ).rejects.toThrow('rematch failed')

    expect(router.routesById[routeId('/orders', '/$orderId')]).toBe(
      remote.detail,
    )
    await expect(
      adapter.attach({
        mountRoute: local.mounts[0],
        loadRouteTree: async () => generatedRemote().tree,
      }),
    ).rejects.toThrow('Reload the host document before retrying')
  })

  it('detaches a memoized remote tree when update() throws after the graft', async () => {
    const remote = generatedRemote()
    const failing = host(['/orders'])
    const failingMount = failing.mounts[0]
    const failingRouter = createRouter({
      routeTree: failing.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const failingAdapter = new RemoteRouterAdapter(() => failingRouter)

    await failingRouter.load()
    const mountNotFoundComponent = failingMount.options.notFoundComponent
    vi.spyOn(failingRouter, 'update').mockImplementationOnce(() => {
      throw new Error('update failed')
    })

    await expect(
      failingAdapter.attach({
        mountRoute: failingMount,
        loadRouteTree: async () => remote.tree,
      }),
    ).rejects.toThrow('update failed')

    // The graft is rolled back, so no half-attached branch survives on the
    // poisoned host, and the mount keeps its own fuzzy 404 boundary.
    expect(childRoutesOf(failingMount)).toEqual([])
    expect(failingMount.options.notFoundComponent).toBe(mountNotFoundComponent)
    expect(remote.detail.options.getParentRoute()).toBe(remote.root)
    await expect(
      failingAdapter.attach({
        mountRoute: failingMount,
        loadRouteTree: async () => remote.tree,
      }),
    ).rejects.toThrow('Reload the host document before retrying')

    // A server memoizing that same tree instance must still be able to serve
    // the next request from a fresh host router.
    const fresh = host(['/orders'])
    const freshRouter = createRouter({
      routeTree: fresh.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
    })
    const freshAdapter = new RemoteRouterAdapter(() => freshRouter)

    await freshRouter.load()
    await freshAdapter.attach({
      mountRoute: fresh.mounts[0],
      loadRouteTree: async () => remote.tree,
    })

    expect(freshAdapter.getSnapshot(fresh.mounts[0])).toEqual({
      state: 'attached',
    })
    expect(freshRouter.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
  })

  it('serves the next SSR request from a fresh router after a prepare() graft failed', async () => {
    const remote = generatedRemote()
    const failing = host(['/orders'])
    const failingMount = failing.mounts[0]
    const failingRouter = createRouter({
      routeTree: failing.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
      isServer: true,
    })
    const failingAdapter = new RemoteRouterAdapter(() => failingRouter)
    const mountNotFoundComponent = failingMount.options.notFoundComponent

    vi.spyOn(failingRouter, 'update').mockImplementationOnce(() => {
      throw new Error('update failed')
    })

    await expect(
      failingAdapter.prepare({
        mountRoute: failingMount,
        loadRouteTree: async () => remote.tree,
      }),
    ).rejects.toThrow('update failed')

    // Same contract as the attach path: the graft is undone and the mount keeps
    // its own fuzzy 404 boundary, but the mount itself stays poisoned.
    expect(childRoutesOf(failingMount)).toEqual([])
    expect(failingMount.options.notFoundComponent).toBe(mountNotFoundComponent)
    expect(remote.detail.options.getParentRoute()).toBe(remote.root)
    expect(failingAdapter.getSnapshot(failingMount).state).toBe('error')
    await expect(
      failingAdapter.prepare({
        mountRoute: failingMount,
        loadRouteTree: async () => remote.tree,
      }),
    ).rejects.toThrow('Reload the host document before retrying')

    // The next request builds fresh host routes but reuses the memoized remote
    // tree, and must render the deep link through the explicit SSR bootstrap.
    const fresh = host(['/orders'])
    const freshRouter = createRouter({
      routeTree: fresh.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
      isServer: true,
    })
    const freshAdapter = new RemoteRouterAdapter(() => freshRouter)

    await freshAdapter.prepare({
      mountRoute: fresh.mounts[0],
      loadRouteTree: async () => remote.tree,
    })

    expect(freshAdapter.getSnapshot(fresh.mounts[0])).toEqual({
      state: 'prepared',
    })
    expect(freshRouter.state.matches.map((match) => match.routeId)).toEqual([])

    await freshRouter.load()

    expect(freshRouter.state.matches.at(-1)?.routeId).toBe(
      routeId('/orders', '/$orderId'),
    )
    expect(isNotFoundMatch(freshRouter.state.matches.at(-1))).toBe(false)
  })

  it('rolls back a whole prepare() batch when its shared update() throws', async () => {
    const orders = generatedRemote()
    const payments = generatedRemote()
    const failing = host(['/orders', '/payments'])
    const failingRouter = createRouter({
      routeTree: failing.tree,
      history: createMemoryHistory({ initialEntries: ['/orders/42'] }),
      isServer: true,
    })
    const failingAdapter = new RemoteRouterAdapter(() => failingRouter)

    vi.spyOn(failingRouter, 'update').mockImplementationOnce(() => {
      throw new Error('update failed')
    })

    const settled = await Promise.allSettled([
      failingAdapter.prepare({
        mountRoute: failing.mounts[0],
        loadRouteTree: async () => orders.tree,
      }),
      failingAdapter.prepare({
        mountRoute: failing.mounts[1],
        loadRouteTree: async () => payments.tree,
      }),
    ])

    // One shared update() means one shared failure: both members roll back.
    expect(settled.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ])

    for (const mount of failing.mounts) {
      expect(childRoutesOf(mount)).toEqual([])
      expect(failingAdapter.getSnapshot(mount).state).toBe('error')
    }

    expect(orders.detail.options.getParentRoute()).toBe(orders.root)
    expect(payments.detail.options.getParentRoute()).toBe(payments.root)

    const fresh = host(['/orders', '/payments'])
    const freshRouter = createRouter({
      routeTree: fresh.tree,
      history: createMemoryHistory({ initialEntries: ['/payments/42'] }),
      isServer: true,
    })
    const freshAdapter = new RemoteRouterAdapter(() => freshRouter)

    await Promise.all([
      freshAdapter.prepare({
        mountRoute: fresh.mounts[0],
        loadRouteTree: async () => orders.tree,
      }),
      freshAdapter.prepare({
        mountRoute: fresh.mounts[1],
        loadRouteTree: async () => payments.tree,
      }),
    ])

    expect(freshAdapter.getSnapshot(fresh.mounts[0])).toEqual({
      state: 'prepared',
    })
    expect(freshAdapter.getSnapshot(fresh.mounts[1])).toEqual({
      state: 'prepared',
    })

    await freshRouter.load()

    expect(freshRouter.state.matches.at(-1)?.routeId).toBe(
      routeId('/payments', '/$orderId'),
    )
  })

  it('does not double-prefix route-bound navigation locations', () => {
    expect(
      scopeLocationOptions('/orders', {
        from: '/$orderId',
        to: '/',
      }),
    ).toEqual({
      from: '/orders/$orderId',
      to: '/orders',
    })
    expect(
      scopeLocationOptions('/orders', {
        from: '/orders/$orderId',
        to: '/orders/43',
      }),
    ).toEqual({
      from: '/orders/$orderId',
      to: '/orders/43',
    })
    expect(
      scopeLocationOptions('/orders', {
        to: 'https://tanstack.com/router',
      }),
    ).toEqual({ to: 'https://tanstack.com/router' })
  })

  it('composes navigation prefixes through nested scoped facades', () => {
    const remoteOptions = scopeLocationOptions('/invoices', { to: '/' })

    expect(scopeLocationOptions('/orders', remoteOptions)).toEqual({
      to: '/orders/invoices',
    })
  })
})
