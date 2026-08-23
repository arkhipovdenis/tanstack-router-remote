import {
  Link,
  Outlet,
  createRootRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/solid-router'
import {
  RemoteRouteMount,
  createRemoteRoute,
} from 'tanstack-router-remote/solid'

type SolidRemoteModule = { routeTree: AnyRoute }

const loadCatalogRouteTree = async () => {
  const remote =
    (await import('@tanstack-router-remote/example-solid-remote/routeTree')) as SolidRemoteModule

  if (!remote.routeTree) {
    throw new Error('solid remote did not expose routeTree')
  }

  return remote.routeTree
}

const rootRoute = createRootRoute({
  component: () => (
    <main>
      <h1>Solid host</h1>
      <nav>
        <Link to="/" data-testid="host-link-home">
          Host home
        </Link>
        <Link to="/catalog" data-testid="host-link-catalog">
          Catalog remote
        </Link>
      </nav>
      <Outlet />
    </main>
  ),
})

const indexRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <p data-testid="host-home">Host home route</p>,
})

function CatalogMount() {
  return (
    <RemoteRouteMount
      mountRoute={catalogMountRoute}
      loadRouteTree={loadCatalogRouteTree}
      loading={<p data-testid="solid-remote-loading">Loading Solid remote…</p>}
      error={(error) => (
        <p data-testid="solid-remote-error">
          Solid remote failed: {error.message}
        </p>
      )}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}

const catalogMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog',
  component: CatalogMount,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, catalogMountRoute]),
  basepath: '/solid',
})
