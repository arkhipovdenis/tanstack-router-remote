import { Outlet, createFileRoute, type AnyRoute } from '@tanstack/react-router'
import { RemoteRouteMount } from '@tanstack-router-remote/route-tree-adapter'

type NativeRouteTreeModule = {
  readonly routeTree: AnyRoute
}

const loadCatalogRouteTree = async () => {
  const remote = (await import(
    '@tanstack-router-remote/example-native-import-remote/routeTree'
  )) as NativeRouteTreeModule

  if (!remote.routeTree) {
    throw new Error('The native ESM remote did not export routeTree.')
  }

  return remote.routeTree
}

// Keep this declaration directly generator-visible. The companion plugin adds
// createRemoteRoute(Route) after it while preserving this exact shape.
export const Route = createFileRoute('/catalog')({
  component: CatalogMount,
  notFoundComponent: CatalogMount,
})

function CatalogMount() {
  return (
    <RemoteRouteMount
      mountRoute={Route}
      loadRouteTree={loadCatalogRouteTree}
      loading={
        <section className="file-example-card" data-testid="file-plugin-loading">
          <p className="file-example-eyebrow">Local file-route boundary</p>
          <h2>Plugin-decorated mount is loading…</h2>
          <p>
            The current URL fuzzy-matched <code>/catalog</code>. The adapter is
            importing the remote route tree, then it will update and rematch
            this same router.
          </p>
        </section>
      }
      error={(error) => (
        <section className="file-example-card file-example-error">
          <p className="file-example-eyebrow">Attachment failed</p>
          <h2>Catalog remote could not attach</h2>
          <code>{error.message}</code>
        </section>
      )}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}
