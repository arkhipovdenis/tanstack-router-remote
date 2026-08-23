# tanstack-router-remote

Production-oriented route-tree attachment for TanStack React Router
microfrontends. It supports ordinary CSR attachment and a documented,
non-streaming SSR/hydration bootstrap. It is the current bridge for remote
route modules while TanStack Router has no first-class remote-tree composition
API. It has no Module Federation dependency: provide
`loadRouteTree(): Promise<AnyRoute>` from any transport.

It is supported for the repository's documented TanStack Router version range
and covered by runtime and browser-like integration tests. The public API
follows semver; the internals depend on TanStack behaviour that is not an
official composition API, so an upstream release can narrow the supported peer
range in a minor. See the repository [compatibility contract](https://github.com/arkhipovdenis/tanstack-router-remote#production-scope-and-compatibility)
and [limitations](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/limitations.md).

ESM only. Every framework peer is optional, so a Vue host never installs React.

## Entry points

| Import                         | Use it to                                             |
| ------------------------------ | ----------------------------------------------------- |
| `tanstack-router-remote/react` | build a React host or remote                          |
| `tanstack-router-remote/solid` | build a Solid host or remote                          |
| `tanstack-router-remote/vue`   | build a Vue host or remote                            |
| `tanstack-router-remote`       | implement a binding for a framework with no entry yet |

Applications use the framework entry — it supplies the binding, adds the mount
component, and re-exports the attachment types:

```ts
import { RemoteRouterAdapter } from 'tanstack-router-remote/react'
```

The root is the extension point, not a second way to do the same thing. It
exports the bare `RemoteRouterAdapter` — whose constructor takes a
`FrameworkBinding` — plus the three types that binding needs. Everything the
adapter does to a route tree is already framework-neutral, so a new framework
means implementing three operations, not reimplementing attachment:

```ts
import {
  RemoteRouterAdapter,
  type FrameworkBinding,
} from 'tanstack-router-remote'
import { createRootRoute } from '@tanstack/svelte-router'

const svelteBinding: FrameworkBinding = {
  createRootRoute: (options) => createRootRoute(options as never),
  createRemoteRootBridge, // project the remote root onto a pathless bridge
  configureStructuralNotFound, // point the mount's 404 at the remote boundary
}

const adapter = new RemoteRouterAdapter(() => router, svelteBinding)
```

`src/react/internal/binding.ts` is the smallest complete example — 15 lines.

The host owns one adapter and provides it above its `RouterProvider`:

```tsx
import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/react'

const adapter = new RemoteRouterAdapter(() => router)

<RemoteRouterProvider adapter={adapter}>
  <RouterProvider router={router} />
</RemoteRouterProvider>
```

Every `RemoteRouteMount`, including one rendered by a nested remote, then
uses that same adapter automatically:

```tsx
<RemoteRouteMount
  mountRoute={Route}
  loadRouteTree={async () =>
    (await loadRemote('someRemote/routeTree')).routeTree
  }
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
example](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/examples/file-routing/README.md). Render `RemoteRouteMount` from
the route's normal component: a deep link below an unattached mount
fuzzy-matches the mount itself, so that one component also covers the
direct-link case. See the repository README for the full contract and
limitations.

For SSR/hydration, call `adapter.prepare(...)` with fresh host and remote trees
before server `router.load()` or client `hydrate(router)`. `prepare()` exposes
the intermediate `prepared` state and deliberately does not perform a CSR
rematch. The full request/bootstrap sequence is documented in the repository
[SSR guide](https://github.com/arkhipovdenis/tanstack-router-remote#ssr-and-hydration).

The `@tanstack-router-remote` scope is unofficial: this package is not
affiliated with or endorsed by TanStack.
