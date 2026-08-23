# TanStack Router Remote

Attach a remote route tree to a TanStack Router host **after** the host router
already exists — one router, one history, one route cache.

Works with React, Solid and Vue.

## Install

```bash
pnpm add tanstack-router-remote
```

ESM only. Every framework peer is optional, so a Vue host never installs React.

| Entry    | Exports                                                                                |
| -------- | -------------------------------------------------------------------------------------- |
| `/react` | `RemoteRouterAdapter`, `RemoteRouterProvider`, `RemoteRouteMount`, `createRemoteRoute` |
| `/solid` | the same four, bound to Solid                                                          |
| `/vue`   | the same four, bound to Vue                                                            |
| root     | the extension point — see [architecture](docs/architecture.md)                         |

## Quick start

**1. Declare the mount** — static, childless, created before `createRouter()`:

```tsx
import { Outlet, type AnyRoute } from '@tanstack/react-router'
import { loadRemote } from '@module-federation/runtime'
import {
  createRemoteRoute,
  RemoteRouteMount,
} from 'tanstack-router-remote/react'

const ordersMountRoute = createRemoteRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrdersMount,
})

function OrdersMount() {
  return (
    <RemoteRouteMount
      mountRoute={ordersMountRoute}
      loadRouteTree={async () =>
        (await loadRemote<{ routeTree: AnyRoute }>('someRemote/routeTree'))
          .routeTree
      }
      loading={<p>Loading Orders…</p>}
      error={(error) => <p>Orders failed: {error.message}</p>}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}
```

**2. Provide one adapter** above the host `RouterProvider`:

```tsx
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/react'

const routeTreeAdapter = new RemoteRouterAdapter(() => router)

createRoot(rootElement).render(
  <RemoteRouterProvider adapter={routeTreeAdapter}>
    <RouterProvider router={router} />
  </RemoteRouterProvider>,
)
```

That is the whole CSR setup. Nested remotes reuse the same adapter.

Two constraints to know up front:

- Requires the default `notFoundMode: 'fuzzy'`.
- A route tree attaches **once**. To mount one remote twice, export a factory
  returning a fresh tree.

## Why it works this way

TanStack Router builds its route tree when the router is created. A
microfrontend host does not have that tree yet — the remote is resolved at
runtime, often only when the user opens one of its URLs. The usual answers each
cost something: loading every remote upfront pays for remotes nobody visits,
and giving the remote its own `<RouterProvider>` splits history and cache in
two, so deep links and back/forward stop behaving like one app.

This grafts the remote tree into the host router instead:

```text
user opens /orders/42
  → a static, childless /orders mount takes the fuzzy 404
  → RemoteRouteMount loads someRemote/routeTree
  → the adapter grafts it, then router.update() + router.load()
  → the same router rematches /orders/42 as the remote detail route
```

The adapter knows nothing about Module Federation — you supply
`loadRouteTree(): Promise<AnyRoute>`, from federation, native `import()`, or
anything else.

## Integrating with TanStack features

| Feature                | How                                                            | Example                                                              |
| ---------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Code routes            | `createRemoteRoute({ getParentRoute, path, component })`       | [module-federation](examples/module-federation)                      |
| File routes (physical) | Wrap the declaration: `createRemoteRoute(createFileRoute(…)…)` | [file-routing/app](examples/file-routing/app)                        |
| Virtual file routes    | Same wrapper; `virtualRouteConfig` assigns the path            | [file-routing/virtual](examples/file-routing/virtual)                |
| Pathless layouts       | Pass the route **id** (`/_shell/catalog`), not the URL         | [file-routing/virtual](examples/file-routing/virtual)                |
| Nested remotes         | The inner remote reuses the host adapter — nothing to wire     | [module-federation/remote](examples/module-federation/remote)        |
| Module Federation      | `loadRouteTree: () => loadRemote('someRemote/routeTree')`      | [module-federation/host](examples/module-federation/host)            |
| Native ESM import      | `loadRouteTree: () => import('remote/routeTree')`              | [native-import/host](examples/native-import/host)                    |
| SSR / hydration        | `adapter.prepare()` + a `createRouteTree()` factory            | [ssr-route-tree.test.tsx](tests/integration/ssr-route-tree.test.tsx) |

Loaders, `validateSearch`, `beforeLoad`, boundaries, the route cache and scoped
`Link`/`useNavigate` need **no** integration — they work inside a mounted
remote as they do anywhere else.

## Examples

```bash
pnpm run dev:example:module-federation   # localhost:3100/platform/
pnpm run dev:example:native-import       # localhost:3200/native/catalog
pnpm run dev:example:file-routing        # localhost:3210 and :3211
pnpm run dev:example:solid               # localhost:3300/solid/
pnpm run dev:example:vue                 # localhost:3400/vue/
pnpm run dev:example:cross-framework     # localhost:3500/cross/
```

The [cross-framework example](examples/cross-framework) is a React host with
Solid **and** Vue remotes in one router — and documents the rendering interop
that needs, which the package deliberately does not ship.

## SSR

Attachment must happen **before** the first server match, so SSR needs a
bootstrap with an async step — not TanStack's default `createRequestHandler`,
which starts `router.load()` too early. Use `prepare()` instead of `attach()`,
with fresh host router, adapter and trees per request:

```tsx
await routeTreeAdapter.prepare({ mountRoute, loadRouteTree: createRouteTree })
await router.load() // server — or hydrate(router) on the client
```

`prepare()` only grafts and reindexes, leaving TanStack in control of loader
data, dehydration and hydration. Full sequence in
[limitations](docs/limitations.md).

## Constraints

- The host owns `basepath`, history, shell component and global router options.
- `redirect({ to: '/' })` from remote lifecycle code targets the **host** router.
- No catch-all `/$` route is added; a missing resource should still
  `throw notFound()`.

Not researched yet — not known incompatibilities: the remote `__root__`
identity (projected onto a pathless bridge), streaming/deferred SSR and
TanStack Start, detach and remote replacement.

Full contract: [limitations](docs/limitations.md).

## Status

The public API follows semver. The ground under it does not: remote-tree
attachment is not an official TanStack composition API, so an upstream release
can force the peer range to narrow in a minor. The `Canary (TanStack latest)`
workflow runs the full check against the newest published router to catch that
early.

Solid and Vue currently have entry-level test coverage only; the behavioural
suite React has is not yet mirrored for them. See the
[evidence matrix](docs/runtime-evidence.md).

Not affiliated with or endorsed by TanStack.

## Development

Requires Node 22.13+ and pnpm 11+ (npm and Yarn cannot resolve `workspace:*` or
the version catalog).

```bash
pnpm install --frozen-lockfile
pnpm run check
```

[CONTRIBUTING.md](CONTRIBUTING.md) · [architecture](docs/architecture.md) ·
[upstream API directions](docs/proposal.md)
