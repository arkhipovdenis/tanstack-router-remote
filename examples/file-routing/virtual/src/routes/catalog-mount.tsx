import { Outlet, createFileRoute, type AnyRoute } from '@tanstack/react-router'
import {
  RemoteRouteMount,
  createRemoteRoute,
} from 'tanstack-router-remote/react'

type NativeRouteTreeModule = {
  readonly routeTree: AnyRoute
}

const loadCatalogRouteTree = async () => {
  const remote =
    (await import('@tanstack-router-remote/example-native-import-remote/routeTree')) as NativeRouteTreeModule

  if (!remote.routeTree) {
    throw new Error('The native ESM remote did not export routeTree.')
  }

  return remote.routeTree
}

// The decoration IS the exported value, so a remote mount cannot be declared
// without it. This file's name says nothing about its URL — src/routes.ts
// mounts it at /catalog, below the pathless `shell.tsx` layout, which is why
// the generated route id is '/_shell/catalog' while the visible path stays
// '/catalog'. The generator reads the inner createFileRoute call either way.
export const Route = createRemoteRoute(
  createFileRoute('/_shell/catalog')({
    component: CatalogMount,
  }),
)

function CatalogMount() {
  return (
    <RemoteRouteMount
      mountRoute={Route}
      loadRouteTree={loadCatalogRouteTree}
      loading={
        <section
          className="file-example-card"
          data-testid="file-routing-virtual-loading"
        >
          <p className="file-example-eyebrow">Local file-route boundary</p>
          <h2>Catalog mount is loading…</h2>
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
