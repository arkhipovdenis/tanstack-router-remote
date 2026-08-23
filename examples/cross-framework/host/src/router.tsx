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
    const staticData = route.options.staticData as
      { crossFrameworkMount?: string } | undefined

    // A mount inside a remote tree stays React-rendered: `RemoteRouteMount`
    // needs the host's adapter context, which an island would cut it off from.
    // The remote marks it with staticData rather than exporting a component,
    // so the remote never has to import a React binding.
    if (staticData?.crossFrameworkMount === 'solid-nested') {
      route.update({ component: SolidNestedMount } as never)
      nestedSolidMountRoute = route

      return
    }

    if (staticData?.crossFrameworkMount === 'vue-nested') {
      route.update({ component: VueNestedMount } as never)
      nestedVueMountRoute = route

      return
    }

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
let nestedSolidMountRoute: AnyRoute | undefined

const loadNestedSolidTree = async () => {
  const remote =
    await import('@tanstack-router-remote/example-cross-solid-remote/nestedTree')

  return islandify(remote.nestedRouteTree as AnyRoute, SolidIsland)
}

function SolidNestedMount() {
  return (
    <RemoteRouteMount
      mountRoute={nestedSolidMountRoute as AnyRoute}
      loadRouteTree={loadNestedSolidTree}
      loading={<p data-testid="solid-nested-loading">Loading nested Solid…</p>}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}

let nestedVueMountRoute: AnyRoute | undefined

const loadNestedVueTree = async () => {
  const remote =
    await import('@tanstack-router-remote/example-cross-vue-remote/nestedTree')

  return islandify(remote.nestedRouteTree as AnyRoute, VueIsland)
}

function VueNestedMount() {
  return (
    <RemoteRouteMount
      mountRoute={nestedVueMountRoute as AnyRoute}
      loadRouteTree={loadNestedVueTree}
      loading={<p data-testid="vue-nested-loading">Loading nested Vue…</p>}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}

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
      <h1>One router, three frameworks</h1>
      <p className="lede">
        A React host whose route tree is extended at runtime by a Solid remote
        and a Vue remote. Same router, same history, same route cache — the
        labelled panels below are rendered by the framework named on them.
      </p>
      <nav>
        <Link to="/" data-testid="host-link-home">
          Host home
        </Link>
        <Link to="/solid" data-framework="solid" data-testid="host-link-solid">
          Solid remote
        </Link>
        <Link to="/vue" data-framework="vue" data-testid="host-link-vue">
          Vue remote
        </Link>
        <Link
          to="/solid/nested/n-2"
          data-framework="solid"
          data-testid="host-link-nested"
        >
          Solid → Solid (2 levels)
        </Link>
        <Link
          to="/vue/nested/n-2"
          data-framework="vue"
          data-testid="host-link-vue-nested"
        >
          Vue → Vue (2 levels)
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
    <p className="host-note" data-testid="host-home">
      Open a remote above. Each one is a route tree authored in another
      framework and grafted into this router on demand — its URL, params and
      loader data all belong to the host router, and a direct link to{' '}
      <code>/cross/solid/sr-2</code> resolves without loading the other remote.
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
