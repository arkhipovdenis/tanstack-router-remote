import {
  Link,
  Outlet,
  createRootRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/vue-router'
import { RemoteRouteMount, createRemoteRoute } from 'tanstack-router-remote/vue'

type VueRemoteModule = { routeTree: AnyRoute }

const loadCatalogRouteTree = async () => {
  const remote =
    (await import('@tanstack-router-remote/example-vue-remote/routeTree')) as VueRemoteModule

  if (!remote.routeTree) {
    throw new Error('vue remote did not expose routeTree')
  }

  return remote.routeTree
}

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <main>
      <h1>Vue host</h1>
      <nav>
        <Link to="/" data-testid="host-link-home">
          Host home
        </Link>{' '}
        <Link to="/catalog" data-testid="host-link-catalog">
          Catalog remote
        </Link>
      </nav>
      <Outlet />
    </main>
  )
}

const indexRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <p data-testid="host-home">Host home route</p>,
})

const catalogMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog',
  component: CatalogMount,
})

function CatalogMount() {
  return (
    <RemoteRouteMount
      mountRoute={catalogMountRoute}
      loadRouteTree={loadCatalogRouteTree}
      v-slots={{
        default: () => <Outlet />,
        loading: () => (
          <p data-testid="vue-remote-loading">Loading Vue remote…</p>
        ),
        error: (error: Error) => (
          <p data-testid="vue-remote-error">
            Vue remote failed: {error.message}
          </p>
        ),
      }}
    />
  )
}

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, catalogMountRoute]),
  basepath: '/vue',
})
