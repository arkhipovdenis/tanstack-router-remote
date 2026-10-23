// @vitest-environment jsdom

import { act, type ComponentType, type ReactNode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  Link,
  Outlet,
  RouterContextProvider,
  RouterProvider,
  Scripts,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useLoaderData,
  useParams,
  type AnyRoute,
} from '@tanstack/react-router'
import {
  RouterServer,
  attachRouterServerSsrUtils,
  renderRouterToString,
} from '@tanstack/react-router/ssr/server'
import { hydrate as hydrateRouter } from '@tanstack/react-router/ssr/client'
import { describe, expect, it, vi } from 'vitest'

import {
  createRemoteRoute,
  RemoteRouteMount,
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from '../../packages/route-tree-adapter/src/react'

type UntypedLinkProps = {
  children: ReactNode
  to: string
}

const RouterLink = Link as unknown as ComponentType<UntypedLinkProps>

type SsrFixture = ReturnType<typeof createSsrFixture>

function createSsrFixture(initialEntry: string) {
  const rootBeforeLoad = vi.fn(() => ({ requestScope: 'remote-request' }))
  const rootLoader = vi.fn(
    ({ context }: { context: { requestScope: string } }) => ({
      source: `root-loader:${context.requestScope}`,
    }),
  )
  const indexLoader = vi.fn(() => ({ source: 'index-loader' }))
  const detailLoader = vi.fn(({ params }: { params: { orderId: string } }) => ({
    source: `detail-loader:${params.orderId}`,
  }))

  function RemoteRoot() {
    const data = useLoaderData({ strict: false }) as { source: string }

    return (
      <section data-testid="remote-root">
        <p>remote-root:{data.source}</p>
        <RouterLink to="/">remote-index-link</RouterLink>
        <Outlet />
      </section>
    )
  }

  function RemoteIndex() {
    const data = useLoaderData({ strict: false }) as { source: string }

    return <p data-testid="remote-index">remote-index:{data.source}</p>
  }

  function RemoteDetail() {
    const data = useLoaderData({ strict: false }) as { source: string }
    const params = useParams({ strict: false }) as { orderId?: string }

    return (
      <p data-testid="remote-detail">
        remote-detail:{params.orderId}:{data.source}
      </p>
    )
  }

  const remoteRoot = createRootRoute({
    component: RemoteRoot,
    beforeLoad: rootBeforeLoad,
    loader: rootLoader,
  })
  const remoteIndex = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/',
    component: RemoteIndex,
    loader: indexLoader,
  })
  const remoteDetail = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/$orderId',
    component: RemoteDetail,
    loader: detailLoader,
  })
  const remoteTree = remoteRoot.addChildren([remoteIndex, remoteDetail])

  const hostRoot = createRootRoute({ component: () => <Outlet /> })
  let mountRoute!: AnyRoute

  function OrdersMount() {
    return (
      <RemoteRouteMount
        mountRoute={mountRoute}
        loadRouteTree={async () => remoteTree}
        loading={<p>remote-loading</p>}
      >
        <Outlet />
      </RemoteRouteMount>
    )
  }

  mountRoute = createRemoteRoute({
    getParentRoute: () => hostRoot,
    path: '/orders',
    component: OrdersMount,
    notFoundComponent: OrdersMount,
  }) as AnyRoute

  const router = createRouter({
    routeTree: hostRoot.addChildren([mountRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    // The test runs with jsdom available in the overall Vitest process on
    // some runners. Force TanStack's server branch independently of globals.
    isServer: true,
  })
  const adapter = new RemoteRouterAdapter(() => router)
  const loadRouteTree = vi.fn(async () => remoteTree)

  return {
    adapter,
    detailLoader,
    indexLoader,
    loadRouteTree,
    mountRoute,
    rootBeforeLoad,
    rootLoader,
    router,
  }
}

function createClientFixture(initialEntry: string) {
  const rootBeforeLoad = vi.fn(() => ({ requestScope: 'remote-request' }))
  const rootLoader = vi.fn(
    ({ context }: { context: { requestScope: string } }) => ({
      source: `root-loader:${context.requestScope}`,
    }),
  )
  const detailLoader = vi.fn(({ params }: { params: { orderId: string } }) => ({
    source: `detail-loader:${params.orderId}`,
  }))

  function RemoteRoot() {
    const data = useLoaderData({ strict: false }) as { source: string }

    return (
      <section data-testid="remote-root">
        <p>remote-root:{data.source}</p>
        <RouterLink to="/">remote-index-link</RouterLink>
        <Outlet />
      </section>
    )
  }

  function RemoteDetail() {
    const data = useLoaderData({ strict: false }) as { source: string }
    const params = useParams({ strict: false }) as { orderId?: string }

    return (
      <p data-testid="remote-detail">
        remote-detail:{params.orderId}:{data.source}
      </p>
    )
  }

  const remoteRoot = createRootRoute({
    component: RemoteRoot,
    beforeLoad: rootBeforeLoad,
    loader: rootLoader,
  })
  const remoteDetail = createRoute({
    getParentRoute: () => remoteRoot,
    path: '/$orderId',
    component: RemoteDetail,
    loader: detailLoader,
  })
  const remoteTree = remoteRoot.addChildren([remoteDetail])

  const hostRoot = createRootRoute({ component: () => <Outlet /> })
  let mountRoute!: AnyRoute

  function OrdersMount() {
    return (
      <RemoteRouteMount
        mountRoute={mountRoute}
        loadRouteTree={async () => remoteTree}
        loading={<p>remote-loading</p>}
      >
        <Outlet />
      </RemoteRouteMount>
    )
  }

  mountRoute = createRemoteRoute({
    getParentRoute: () => hostRoot,
    path: '/orders',
    component: OrdersMount,
    notFoundComponent: OrdersMount,
  }) as AnyRoute

  const router = createRouter({
    routeTree: hostRoot.addChildren([mountRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    isServer: false,
  })
  const adapter = new RemoteRouterAdapter(() => router)
  const loadRouteTree = vi.fn(async () => remoteTree)

  return {
    adapter,
    detailLoader,
    loadRouteTree,
    mountRoute,
    rootBeforeLoad,
    rootLoader,
    router,
  }
}

async function renderRequest(fixture: SsrFixture) {
  attachRouterServerSsrUtils({
    router: fixture.router,
    manifest: undefined,
  })

  // This is the server-side equivalent of the browser mount effect. It must
  // happen before the request's first router.load(), so the remote routes are
  // part of the initial match and of the dehydrated TanStack payload.
  await fixture.adapter.prepare({
    mountRoute: fixture.mountRoute,
    loadRouteTree: fixture.loadRouteTree,
  })
  expect(fixture.adapter.getSnapshot(fixture.mountRoute)).toEqual({
    state: 'prepared',
  })
  await fixture.router.load()
  await fixture.router.serverSsr!.dehydrate()

  return renderRouterToString({
    router: fixture.router,
    responseHeaders: new Headers(),
    children: (
      <html>
        <body>
          <RemoteRouterProvider adapter={fixture.adapter}>
            <RouterContextProvider router={fixture.router}>
              <div id="root">
                <RouterServer router={fixture.router} />
              </div>
              <Scripts />
            </RouterContextProvider>
          </RemoteRouterProvider>
        </body>
      </html>
    ),
  })
}

describe('SSR route-tree attachment', () => {
  it('pre-attaches a fresh remote tree and server-renders its root and index', async () => {
    const fixture = createSsrFixture('/orders')
    const response = await renderRequest(fixture)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('data-testid="remote-root"')
    expect(html).toContain('root-loader:remote-request')
    expect(html).toContain('data-testid="remote-index"')
    expect(html).toContain('index-loader')
    expect(html).toContain('href="/orders"')
    expect(html).toContain('$_TSR')
    expect(fixture.loadRouteTree).toHaveBeenCalledTimes(1)
    expect(fixture.rootBeforeLoad).toHaveBeenCalledTimes(1)
    expect(fixture.rootLoader).toHaveBeenCalledTimes(1)
    expect(fixture.indexLoader).toHaveBeenCalledTimes(1)
    expect(fixture.detailLoader).not.toHaveBeenCalled()
  })

  it('includes a direct remote detail match and its loader data in the initial response', async () => {
    const fixture = createSsrFixture('/orders/42')
    const response = await renderRequest(fixture)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('data-testid="remote-root"')
    expect(html).toContain('root-loader:remote-request')
    expect(html).toContain('data-testid="remote-detail"')
    expect(html).toContain('detail-loader:42')
    expect(fixture.loadRouteTree).toHaveBeenCalledTimes(1)
    expect(fixture.rootBeforeLoad).toHaveBeenCalledTimes(1)
    expect(fixture.rootLoader).toHaveBeenCalledTimes(1)
    expect(fixture.detailLoader).toHaveBeenCalledTimes(1)
    expect(fixture.indexLoader).not.toHaveBeenCalled()
    expect(fixture.adapter.getSnapshot(fixture.mountRoute)).toEqual({
      state: 'prepared',
    })
  })

  it('hydrates a fresh, pre-attached client tree from TanStack loader data without re-running remote loaders', async () => {
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
      writable: true,
    })
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true

    const serverFixture = createSsrFixture('/orders/42')
    const response = await renderRequest(serverFixture)
    const html = await response.text()
    const documentElement = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('html')!

    document.documentElement.innerHTML = documentElement.innerHTML
    const appRoot = document.getElementById('root')!
    // The dehydrate payload is located by its content, not by a marker: router
    // 1.171.26 tagged these scripts `class="$tsr"`, while 1.171.39 replaced
    // that with a `data-tsr-stream-part` attribute the final boundary script
    // does not even carry. The `$_TSR.router=` assignment is the stable part.
    const findRouterScript = (scope: ParentNode) =>
      [...scope.querySelectorAll('script')].find((candidate) =>
        candidate.textContent?.includes('$_TSR.router'),
      )
    const script = findRouterScript(document.body)
    expect(findRouterScript(appRoot)).toBeUndefined()
    expect(script?.textContent).toContain('$_TSR.router')
    // jsdom does not execute scripts inserted through innerHTML. The response
    // carries TanStack's real dehydrate payload, so execute that exact script
    // before calling the public client hydrate() API — minus the trailing
    // self-cleanup, which has no `document.currentScript` to work with here.
    // Both the old single-statement form and the newer sibling-sweeping block
    // are stripped, so this survives either emitter.
    const serializedRouterScript = script!
      .textContent!.replace(
        /\{let s=document\.currentScript,p;.*?s\.remove\(\)\}$/,
        '',
      )
      .replace(/;document\.currentScript\.remove\(\)$/, '')
    window.eval(serializedRouterScript)

    const clientFixture = createClientFixture('/orders/42')
    await clientFixture.adapter.prepare({
      mountRoute: clientFixture.mountRoute,
      loadRouteTree: clientFixture.loadRouteTree,
    })
    await hydrateRouter(clientFixture.router)

    const recoverableErrors: Array<unknown> = []
    let root!: ReturnType<typeof hydrateRoot>
    await act(async () => {
      root = hydrateRoot(
        appRoot,
        <RemoteRouterProvider adapter={clientFixture.adapter}>
          <RouterProvider router={clientFixture.router} />
        </RemoteRouterProvider>,
        {
          onRecoverableError(error) {
            recoverableErrors.push(error)
          },
        },
      )
    })

    expect(appRoot.textContent).toContain(
      'remote-root:root-loader:remote-request',
    )
    expect(appRoot.textContent).toContain('remote-detail:42:detail-loader:42')
    expect(recoverableErrors).toEqual([])
    expect(clientFixture.loadRouteTree).toHaveBeenCalledTimes(1)
    // hydrate() restores the serialized beforeLoad context; it does not rerun
    // lifecycle/loaders for an SSR match that already has dehydrated data.
    expect(clientFixture.rootBeforeLoad).not.toHaveBeenCalled()
    expect(clientFixture.rootLoader).not.toHaveBeenCalled()
    expect(clientFixture.detailLoader).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
    document.body.replaceChildren()
  })
})
