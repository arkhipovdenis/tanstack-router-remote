import type { ReactElement } from 'react'
import {
  Link,
  Outlet,
  createRootRoute,
  createRouter,
  useMatch,
  type AnyRoute,
} from '@tanstack/react-router'
import {
  RemoteRouteMount,
  createRemoteRoute,
} from 'tanstack-router-remote/react'

import { SolidIsland, VueIsland } from './islands'

/**
 * Wraps every component in a remote tree so React can render it.
 *
 * The tree itself is grafted untouched — this only swaps the leaf renderers.
 * Route options, loaders, params and the scoped navigation facade all keep
 * working, because none of that is framework-specific.
 */
function islandify(
  tree: AnyRoute,
  Island: (props: { component: never; data: unknown }) => ReactElement,
) {
  const visit = (route: AnyRoute) => {
    const original = route.options.component

    if (original) {
      // `IslandRoute` is an ordinary React component rendered by the host
      // router, so it sits inside the React context and can use its hooks. The
      // island below does not: it mounts a separate Solid/Vue application, and
      // React context does not cross into a foreign framework's tree. So the
      // data is read here, from context, and carried across as a plain prop.
      //
      // `useMatch({ strict: false })` returns the nearest match, which is this
      // route's own. Looking it up by `route.id` would not work: a grafted
      // remote root is projected onto the bridge and matches under the
      // bridge's id, not its original `__root__`.
      route.update({
        component: function IslandRoute() {
          const data = useMatch({
            strict: false,
            select: (match) => match.loaderData,
          })

          // React owns the nesting: each route in the remote tree renders its
          // own island plus the host's Outlet, so a child route mounts as a
          // sibling island rather than inside the parent's foreign tree.
          // Solid's and Vue's own `Outlet` cannot work inside an island - it
          // reads a match context that does not cross the boundary.
          return (
            <>
              <Island component={original as never} data={data} />
              <Outlet />
            </>
          )
        },
      } as never)
    }

    const children = Array.isArray(route.children)
      ? route.children
      : Object.values(route.children ?? {})

    for (const child of children as AnyRoute[]) {
      visit(child)
    }
  }

  visit(tree)

  return tree
}

// The remotes are separate workspaces, built by their own framework's
// transform. That is not incidental to the example - it is required. A single
// bundle cannot compile React JSX and Solid JSX at once: whichever plugin is
// configured wins, and the other framework's components come out as calls into
// a runtime that cannot render them.
const loadSolidRouteTree = async () => {
  const remote =
    (await import('@tanstack-router-remote/example-cross-solid-remote/routeTree')) as {
      routeTree: AnyRoute
    }

  return islandify(remote.routeTree, SolidIsland)
}

const loadVueRouteTree = async () => {
  const remote =
    (await import('@tanstack-router-remote/example-cross-vue-remote/routeTree')) as {
      routeTree: AnyRoute
    }

  return islandify(remote.routeTree, VueIsland)
}

const rootRoute = createRootRoute({
  component: () => (
    <main>
      <h1>React host, remote route trees from three frameworks</h1>
      <nav>
        <Link to="/" data-testid="host-link-home">
          Host home
        </Link>
        <Link to="/solid" data-testid="host-link-solid">
          Solid remote
        </Link>
        <Link to="/vue" data-testid="host-link-vue">
          Vue remote
        </Link>
      </nav>
      <Outlet />
    </main>
  ),
})

const indexRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <p data-testid="host-home">
      One React router, one history, one route cache. The Solid and Vue trees
      below are grafted into it.
    </p>
  ),
})

function SolidMount() {
  return (
    <RemoteRouteMount
      mountRoute={solidMountRoute}
      loadRouteTree={loadSolidRouteTree}
      loading={<p data-testid="solid-loading">Loading Solid remote…</p>}
      error={(error) => (
        <p data-testid="solid-error">Solid remote failed: {error.message}</p>
      )}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}

const solidMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/solid',
  component: SolidMount,
})

function VueMount() {
  return (
    <RemoteRouteMount
      mountRoute={vueMountRoute}
      loadRouteTree={loadVueRouteTree}
      loading={<p data-testid="vue-loading">Loading Vue remote…</p>}
      error={(error) => (
        <p data-testid="vue-error">Vue remote failed: {error.message}</p>
      )}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}

const vueMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/vue',
  component: VueMount,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    solidMountRoute,
    vueMountRoute,
  ]),
  basepath: '/cross',
})
