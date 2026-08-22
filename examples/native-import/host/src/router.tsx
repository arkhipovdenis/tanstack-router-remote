import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/react-router'
import {
  createRemoteRoute,
  RemoteRouteMount,
} from 'tanstack-router-remote/react'

type NativeRouteTreeModule = {
  readonly routeTree: AnyRoute
}

const loadNativeImportRouteTree = async () => {
  // This is intentionally a package-specifier native ESM import. There is no
  // Module Federation runtime, remote manifest, container, or alias to source.
  const remote =
    (await import('@tanstack-router-remote/example-native-import-remote/routeTree')) as NativeRouteTreeModule

  if (!remote.routeTree) {
    throw new Error(
      'The native ESM package did not export routeTree from ./routeTree.',
    )
  }

  return remote.routeTree
}

const rootRoute = createRootRoute({
  component: NativeImportHostShell,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <section className="host-home" data-testid="native-host-home">
      <p className="host-eyebrow">No Module Federation</p>
      <h2>Native ESM import host</h2>
      <p>
        This host dynamically resolves a TypeScript-built workspace package at
        the local route mount. It uses the same route-tree adapter contract as
        the federation examples, but the transport is a native browser module
        import.
      </p>
      <pre>
        <code>
          await
          import('@tanstack-router-remote/example-native-import-remote/routeTree')
        </code>
      </pre>
      <p className="host-note">
        The Host owns one TanStack Router instance and one attachment adapter.
        The imported tree receives a scoped navigation facade below{' '}
        <code>/native/catalog</code>.
      </p>
    </section>
  ),
})

const catalogMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog',
  component: NativeCatalogMount,
})

const routeTree = rootRoute.addChildren([homeRoute, catalogMountRoute])

export const router = createRouter({
  routeTree,
  basepath: '/native',
  // See the module-federation host: scoped imperative preload makes this safe.
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function NativeImportHostShell() {
  return (
    <main className="native-host-shell">
      <header className="host-header">
        <div>
          <p className="host-eyebrow">TanStack Router remote tree adapter</p>
          <h1>Host basepath: /native</h1>
        </div>
        <span className="host-badge">native ESM transport</span>
      </header>
      <nav className="host-nav" aria-label="Native import host navigation">
        <Link to="/">Host home</Link>
        <Link to="/catalog" preload={false}>
          Load catalog route tree
        </Link>
        <Link
          to={'/catalog/$productId' as never}
          params={{ productId: 'SKU-42' } as never}
        >
          Direct detail deep link
        </Link>
        <Link to={'/catalog/no/such/path' as never} preload={false}>
          Remote structural 404
        </Link>
      </nav>
      <p className="host-note">
        The catalog mount renders a local loading/error boundary while the
        dynamic <code>import()</code> resolves and the adapter rematches the
        current URL against the remote descendants.
      </p>
      <Outlet />
    </main>
  )
}

function NativeCatalogMount() {
  return (
    <RemoteRouteMount
      mountRoute={catalogMountRoute}
      loadRouteTree={loadNativeImportRouteTree}
      loading={
        <section
          className="native-load-state"
          data-testid="native-import-loading"
        >
          <p className="host-eyebrow">Native import pending</p>
          <h2>Importing the ESM route tree…</h2>
          <p>
            The host locally fuzzy-matched <code>/catalog</code>. It is now
            resolving the built package and will call{' '}
            <code>router.update()</code> before rendering the imported routes.
          </p>
        </section>
      }
      error={(error) => (
        <section
          className="native-load-state native-load-error"
          data-testid="native-import-error"
        >
          <p className="host-eyebrow">Native import failed</p>
          <h2>Catalog route tree could not attach</h2>
          <p>
            <code>{error.message}</code>
          </p>
          <Link to="/">Return to host home</Link>
        </section>
      )}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}
