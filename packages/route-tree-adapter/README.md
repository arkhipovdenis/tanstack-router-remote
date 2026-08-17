# @tanstack-router-remote/route-tree-adapter

Production-oriented route-tree attachment for TanStack React Router
microfrontends. It supports ordinary CSR attachment and a documented,
non-streaming SSR/hydration bootstrap. It is the current bridge for remote
route modules while TanStack Router has no first-class remote-tree composition
API. It has no Module Federation dependency: provide
`loadRouteTree(): Promise<AnyRoute>` from any transport.

It is supported for the repository's documented TanStack Router/React version
range and covered by runtime and browser-like integration tests. The package
API remains `0.x` because attachment is not yet an official TanStack Router
composition API; see the repository [compatibility contract](../../README.md#production-scope-and-compatibility)
and [limitations](../../docs/limitations.md).

The host owns one adapter and provides it above its `RouterProvider`:

```tsx
import {
  RouteTreeUpdateAdapter,
  RouteTreeUpdateAdapterProvider,
} from '@tanstack-router-remote/route-tree-adapter'

const adapter = new RouteTreeUpdateAdapter(() => router)

<RouteTreeUpdateAdapterProvider adapter={adapter}>
  <RouterProvider router={router} />
</RouteTreeUpdateAdapterProvider>
```

Every `RemoteRouteMount`, including one rendered by a nested remote, then
uses that same adapter automatically:

```tsx
<RemoteRouteMount
  mountRoute={Route}
  loadRouteTree={async () => (await loadRemote('someRemote/routeTree')).routeTree}
  loading={<Spinner />}
  error={(error) => <RemoteLoadError error={error} />}
>
  <Outlet />
</RemoteRouteMount>
```

That singleton `routeTree` form is appropriate for a CSR document and may be
attached once there. SSR/hydration instead requires the remote module to expose
`createRouteTree(): AnyRoute` and to return a fresh tree for every server
request and matching client bootstrap.

Create code mounts with `createRemoteRoute({ ... })` before creating the host
router. It has the same options and inferred type as TanStack `createRoute`,
but prepares the mount internally. For a standard file route, wrap the
generated declaration so the decoration is the exported value:

```tsx
export const Route = createRemoteRoute(
  createFileRoute('/catalog')({ component: CatalogMount }),
)
```

TanStack's generator reads the inner `createFileRoute` call, so no build-time
transform is needed. See the runnable [file-route
example](../../examples/file-routing/README.md). Render `RemoteRouteMount` from
the route's normal component: a deep link below an unattached mount
fuzzy-matches the mount itself, so that one component also covers the
direct-link case. See the repository README for the full contract and
limitations.

For SSR/hydration, call `adapter.prepare(...)` with fresh host and remote trees
before server `router.load()` or client `hydrate(router)`. `prepare()` exposes
the intermediate `prepared` state and deliberately does not perform a CSR
rematch. The full request/bootstrap sequence is documented in the repository
[SSR guide](../../README.md#ssr-and-hydration).

This package is private until its community-owned npm name is decided. It is
not affiliated with or endorsed by TanStack.
