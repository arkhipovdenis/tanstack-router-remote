# TanStack Router Remote

> A production bridge between independently delivered remote route modules and
> TanStack React Router.

TanStack Router Remote is a production-ready integration within its documented
CSR scope, with a separate non-streaming SSR/hydration bootstrap. It lets a
host load a generated remote `routeTree` after its router has already been
created, then attaches that tree below a static host route while retaining one
host `RouterProvider`, router instance, browser history, and native router
cache.

It is a current solution for route-module composition while TanStack Router
does not provide a first-class remote-tree API. It is not an official TanStack
package or endorsement. A future official API may replace the internals, but
it is not a prerequisite for using this bridge in production today.

## Why this exists

TanStack Router is designed around a route tree known when the host router is
created. Microfrontend platforms often discover a separately delivered route
module later:

```text
Host router exists
  → user opens /orders/42
  → host loads someRemote/routeTree
  → the same host router rematches /orders/42 against remote routes
```

This repository packages that transition behind a small adapter. The adapter
does not know about Module Federation: the host supplies
`loadRouteTree(): Promise<AnyRoute>`. The examples use both
`loadRemote('someRemote/routeTree')` and native ESM `import()`.

## Production scope and compatibility

The verified production scope is **attach-only CSR**, plus a documented
**non-streaming SSR/hydration bootstrap**. The lowest validated TanStack Router
version is `1.168.18`; the repository's reproducible build baseline is
`@tanstack/react-router` `1.170.18` and React `19.2.0`. The adapter accepts
`@tanstack/react-router` `>=1.168.18`, so a newer compatible router does not
require a new package release or a dedicated CI matrix.

TanStack Router's compiler plugin has an intentionally independent release
number. The file-route example uses the compatible current pair
`@tanstack/router-plugin` `1.168.18` + `@tanstack/react-router` `1.170.18`;
that is not a second runtime version.

The table deliberately distinguishes a known constraint (`−`) from an area
that has not yet been researched (`?`). A `?` is neither an incompatibility
claim nor a decision not to support the capability; it simply has no validated
contract yet. The CSR result above remains production-ready on its own.

The bridge is covered by **70 automated tests** across TanStack Router runtime,
browser-like React integration, route-tree mutation, deep links, nested
remotes, native cache, lifecycle hooks, navigation APIs, and 404 boundaries.
`npm run check` also builds every runnable transport example.

The package API remains `0.x` because remote-tree attachment is not yet an
official TanStack Router composition API. That versioning reflects API
evolution risk, not a recommendation against production use in the supported
scope.

| Capability | Current result |
| --- | --- |
| One host router, history, stores and native route cache | `+` Supported and regression-tested |
| Remote index, nested routes, params, search, loaders and boundaries | `+` Supported and regression-tested |
| Remote root component and compatible root options | `±` Supported through a documented pathless bridge |
| Original remote `__root__` identity and RootRoute APIs | `−` Not part of the host tree |
| Non-streaming SSR | `±` A custom pre-attach bootstrap, remote rendering and TanStack data dehydration are regression-tested; fresh per-request trees are required |
| Hydration | `±` Fresh-tree hydration restores remote loader data without rerunning initial loaders; matching remote version must be available before hydrate |
| Deferred / streaming SSR | `?` Not yet researched |
| TanStack Start/default request handler and remote-transport integration | `?` Not yet researched; the validated path currently uses a custom async bootstrap before the first `router.load()` |
| Detach | `?` Not yet researched; the current public API has no detach operation |
| Remote replacement | `?` Not yet researched; the current public API has no replacement operation |
| Route-level HMR | `?` Not yet researched as a controlled remote-tree replacement lifecycle |

Read the [limitations](docs/limitations.md) before adopting this bridge. The
[runtime evidence matrix](docs/runtime-evidence.md) maps each supported claim
to executable tests and examples. [Potential upstream API directions](docs/proposal.md)
are kept separately as a discussion aid, not as the primary purpose or roadmap
of this repository.

## How attachment works

For a direct deep link such as `/orders/42`:

```text
1. A static, childless host /orders route receives a fuzzy local 404 match.
2. That match renders the mount's own component, which shows a loading state.
3. RemoteRouteMount loads the remote routeTree.
4. The adapter grafts remote children below a pathless root bridge.
5. The adapter calls router.update({ routeTree }) and router.load().
6. The existing host router rematches /orders/42 as the remote detail route.
```

The mutation/rematch operation is serialized for every mount attached to the
same host router. A route tree instance is mutable and can be attached once;
if one remote must mount in multiple places, expose a factory that returns a
fresh tree for each mount.

## Quick start

There are three required pieces:

1. Create a static, initially childless host mount before `createRouter()`.
2. Render `RemoteRouteMount` from the mount's component. A fuzzy 404 below an
   unattached mount is an ordinary match on that mount, so this one component
   covers both `/orders` and a direct `/orders/42`.
3. Create one adapter for the host router and provide it above `RouterProvider`.

The direct deep-link handoff requires TanStack Router's default
`notFoundMode: 'fuzzy'`. `notFoundMode: 'root'` and the legacy `notFoundRoute`
handle an unknown URL at the host before this bridge can load the remote tree.

### 1. Declare the mount and loader

```tsx
import { Outlet, createRootRoute, type AnyRoute } from '@tanstack/react-router'
import {
  createRemoteRoute,
  RemoteRouteMount,
} from '@tanstack-router-remote/route-tree-adapter'
import { loadRemote } from '@module-federation/runtime'

type RemoteRouteTreeModule = { routeTree: AnyRoute }

// CSR only: a singleton tree may be attached once in this browser document.
const loadOrdersRouteTree = async () => {
  const remote = await loadRemote<RemoteRouteTreeModule>(
    'someRemote/routeTree',
  )

  return remote.routeTree
}

const rootRoute = createRootRoute()

const ordersMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrdersMount,
})

function OrdersMount() {
  return (
    <RemoteRouteMount
      mountRoute={ordersMountRoute}
      loadRouteTree={loadOrdersRouteTree}
      loading={<p>Loading Orders…</p>}
      error={(error) => <p>Orders failed to load: {error.message}</p>}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}
```

`createRemoteRoute` has the same route options and inferred type as TanStack's
`createRoute`, but prepares the initial fuzzy mount internally.

### 2. Provide one host-level adapter

```tsx
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import {
  RouteTreeUpdateAdapter,
  RouteTreeUpdateAdapterProvider,
} from '@tanstack-router-remote/route-tree-adapter'
import { router } from './router'

const routeTreeAdapter = new RouteTreeUpdateAdapter(() => router)

createRoot(rootElement).render(
  <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
    <RouterProvider router={router} />
  </RouteTreeUpdateAdapterProvider>,
)
```

The provider belongs above the host `RouterProvider`, never inside an
individual mount route. Nested remotes reuse that same adapter while their
scoped navigation paths compose back to the original host router.

## SSR and hydration

SSR uses the same adapter, but it must attach the remote tree **before** the
first server match. Use a new host router, adapter, host tree and remote tree
for every request—route instances are deliberately mutable.

This is a validated **manual request/bootstrap** path, not a drop-in wrapper
around TanStack Router's default `createRequestHandler`: that handler starts
the first `router.load()` before an asynchronous `loadRemote()` call can
complete. Use a server integration with an async step before that first load.
TanStack Start/default-handler integration, streaming/deferred data, and each
transport's server asset-loading contract remain separately marked `?` in the
compatibility matrix.

The remote module must expose a factory for SSR. Loading a federated/ESM
module may be cached, but every factory invocation must return new route
instances:

```tsx
import type { AnyRoute } from '@tanstack/react-router'

type SsrRemoteRouteTreeModule = {
  createRouteTree(): AnyRoute
}

async function createOrdersRouteTree() {
  const remote = await loadRemote<SsrRemoteRouteTreeModule>(
    'someRemote/routeTree',
  )

  return remote.createRouteTree()
}
```

```tsx
import { hydrateRoot } from 'react-dom/client'
import {
  RouterContextProvider,
  RouterProvider,
  Scripts,
} from '@tanstack/react-router'
import {
  RouterServer,
  attachRouterServerSsrUtils,
  renderRouterToString,
} from '@tanstack/react-router/ssr/server'
import { hydrate } from '@tanstack/react-router/ssr/client'
import {
  RouteTreeUpdateAdapterProvider,
} from '@tanstack-router-remote/route-tree-adapter'

// Server request: create fresh host route instances/router/history and an
// adapter for this request. Do this before its first router.load().
attachRouterServerSsrUtils({ router, manifest })
await routeTreeAdapter.prepare({
  mountRoute: ordersMountRoute,
  loadRouteTree: createOrdersRouteTree,
})
await router.load()
await router.serverSsr!.dehydrate()
const response = await renderRouterToString({
  router,
  responseHeaders: new Headers(),
  children: (
    <html>
      <body>
        <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
          <RouterContextProvider router={router}>
            <div id="root">
              <RouterServer router={router} />
            </div>
            <Scripts />
          </RouterContextProvider>
        </RouteTreeUpdateAdapterProvider>
      </body>
    </html>
  ),
})

// Browser bootstrap: construct fresh matching host/remote route instances and
// resolve the same remote version before React hydration.
await routeTreeAdapter.prepare({
  mountRoute: ordersMountRoute,
  loadRouteTree: createOrdersRouteTree,
})
await hydrate(router)
hydrateRoot(
  document.getElementById('root')!,
  <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
    <RouterProvider router={router} />
  </RouteTreeUpdateAdapterProvider>,
)
```

`prepare()` only grafts and reindexes the tree, then exposes the `prepared`
state. It intentionally does not call `router.load()`: on the server that
leaves TanStack in control of loader data and dehydration; on the client it
lets TanStack restore the serialized matches without rerunning initial remote
loaders. Complete the server `router.load()` or client `hydrate(router)` before
rendering `RemoteRouteMount`. Use `attach()`/`RemoteRouteMount` for ordinary
CSR navigation.

The SSR evidence currently covers non-streaming `renderRouterToString`, remote
root/index/detail matches, lifecycle context, TanStack's serialized loader data
and a `hydrateRoot` handoff with no recoverable mismatch. The example uses a
custom request/bootstrap pipeline deliberately; streaming/deferred loaders,
default-handler/Start integration, and transport-specific server loading are
separate `?` research items.

## Remote navigation and 404s

Inside a mounted remote, ordinary TanStack `Link`, `Route.Link`, and
`Route.useNavigate()` resolve absolute remote paths below the mount. For
example, `to="/"` in an Orders remote mounted at `/orders` goes to
`/orders`, not host home.

For an unknown direct remote URL, the adapter preserves native fuzzy matching
and its 404 status:

- Before attachment, the fuzzy match renders the mount's component, which shows
  loading. The mount needs no local `notFoundComponent` for this: a fuzzy 404
  does not throw into the mount, it matches the mount. Declare one only to catch
  a `notFound()` thrown by the mount's own `beforeLoad`/`loader`.
- If the mount itself owns the structural 404 after attachment, its visible
  boundary delegates to the remote root's `notFoundComponent` in the remote
  scope.
- If a remote branch already partially matches, TanStack chooses the nearest
  matching remote boundary as usual; for example, `/orders/42/nope` remains a
  detail-route 404.
- If the remote root has no 404 boundary, the host's
  `defaultNotFoundComponent`, then TanStack's built-in fallback, is used in the
  host context.

The bridge deliberately does not add a catch-all `/$` route: it would change
TanStack route ranking and can hide partial parameter branches or nested remote
deep links. A dynamic route whose resource is absent should still
`throw notFound()` from `beforeLoad` or its loader.

## File routes

The core adapter works with code routes, Module Federation, native imports, or
another remote-module transport. For a TanStack **file-route** module, wrap the
generated declaration so the decoration is the exported value:

```tsx
export const Route = createRemoteRoute(
  createFileRoute('/orders')({
    component: OrdersMount,
  }),
)
```

No build-time transform is involved. TanStack's generator reads the inner
`createFileRoute('/orders')({...})` call, emits `/orders` into
`routeTree.gen.ts`, and leaves the source file untouched.

Wrapping is the point. A mount that is never passed to `createRemoteRoute`
still serves `/orders`, but a direct deep link to `/orders/42` silently fails:
the mount has no children to fuzzy-match into, so nothing starts the attach.
As the exported initializer, the call cannot be forgotten in one file and
present in another.

Both generator modes are supported and covered: physical routing, where
filenames decide URLs, and virtual routing, where `virtualRouteConfig` assigns
every path in a config file. See the runnable [file-route
examples](examples/file-routing/README.md).

One trade-off is worth knowing: in physical routing the generator auto-corrects
a route file whose `createFileRoute()` path disagrees with its location, but
only when that call is the direct export initializer. Wrapped, the file is left
alone and a wrong path stays wrong.

## Run the examples

```bash
npm ci
npm run check
```

CI runs on Node 20 and 22. `npm run check` type-checks the workspaces, runs all
70 automated tests, and builds packages and examples.

Run all labs:

```bash
npm run dev:examples
```

| Lab | Command | Local URL | What it proves |
| --- | --- | --- | --- |
| Module Federation | `npm run dev:example:module-federation` | `http://localhost:3100/platform/` | Host → Orders → Invoices, including a nested remote tree |
| Native ESM import | `npm run dev:example:native-import` | `http://localhost:3200/native/catalog` | The adapter has no Module Federation runtime dependency |
| File routes, physical | `npm run dev:example:file-routing:physical` | `http://localhost:3210/file-routing/` | The generator accepts a `createRemoteRoute`-wrapped file route |
| File routes, virtual | `npm run dev:example:file-routing:virtual` | `http://localhost:3211/file-routing-virtual/` | The same wrapper under `virtualRouteConfig`, below a pathless layout |

Use `npm run preview:examples`, or the corresponding
`preview:example:*` command, for production artifacts. More detailed exercises
are available in the [Module Federation lab](examples/module-federation/README.md),
[native ESM-import lab](examples/native-import/README.md), and [file-route
labs](examples/file-routing/README.md).

## Current API constraints and research backlog

- CSR attachment and non-streaming SSR/hydration are validated separately.
  Deferred/streaming SSR, default-handler/transport integration, detach,
  replacement and route-level HMR each retain their own `?` status until they
  receive a dedicated PoC and regression coverage.
- The original remote `__root__` does not become a child of the host tree.
  Its component and compatible options are projected to a bridge, but APIs
  tied to the original root identity, such as `RemoteRootRoute.useLoaderData()`,
  are not supported in the embed.
- The host owns `basepath`, browser history, shell component and global router
  options.
- A `redirect({ to: '/' })` thrown from remote lifecycle code bypasses the
  scoped router facade and targets the host router. Cross-host navigation needs
  an explicit platform contract.

See [limitations](docs/limitations.md) for the complete operational contract.

## Packaging and contributing

The packages remain `private` while the public package name and compatibility
policy are finalised. `npm pack --dry-run` is a packaging smoke test; it does
not imply publication readiness. Do not publish under `@tanstack/*` without
agreement from the TanStack team.

Contributions are welcome as reproducible regressions and narrowly scoped
compatibility improvements. Read [CONTRIBUTING.md](CONTRIBUTING.md), especially
before changing route-tree mutation, `router.update()`, direct deep links,
navigation scoping, or the supported TanStack Router range.
