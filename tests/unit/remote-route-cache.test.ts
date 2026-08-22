// Loader caching only exists on router-core's client build, which newer
// versions select by export condition — the default `node` environment
// resolves the server build, where matches are not cached across navigations.
// The sibling remote-route-runtime.test.ts stays on `node` because it asserts
// SSR markup through renderToStaticMarkup.
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { RemoteRouterAdapter } from '../../packages/route-tree-adapter/src/react'
import {
  createInstrumentedRemote,
  createRuntimeHost,
} from '../support/remote-runtime-fixtures'

describe('attached remote runtime cache', () => {
  it('retains native root, index, detail, and nested loader cache across SPA transitions', async () => {
    const host = createRuntimeHost('/orders?tab=overview')
    const remote = createInstrumentedRemote()
    const adapter = new RemoteRouterAdapter(() => host.router)

    await host.router.load()
    await adapter.attach({
      mountRoute: host.mount,
      loadRouteTree: async () => remote.tree,
    })

    // No SSR render here: this test asserts loader runs, not markup, and
    // renderToStaticMarkup does not settle on the client load path.
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

    const activeProbes = host.router.state.matches.map(
      (match) => (match.staticData as { cacheProbe?: string }).cacheProbe,
    )

    expect(activeProbes).not.toEqual(
      expect.arrayContaining(['remote-root', 'remote-line-items']),
    )

    await host.router.navigate({ to: '/orders/42/line-items' } as never)

    // The cached-match list has no public accessor on newer routers, so the
    // cache is asserted by its effect: returning must not re-run the loaders.
    expect(remote.lifecycle.rootLoader).toBe(1)
    expect(remote.lifecycle.indexLoader).toBe(1)
    expect(remote.lifecycle.detailLoader).toBe(1)
    expect(remote.lifecycle.lineItemsLoader).toBe(1)
  })
})
