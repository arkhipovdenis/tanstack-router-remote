# TanStack Router Remote

Attach a remote route tree to a TanStack React Router host **after** the host
router already exists.

## The problem

TanStack Router builds its route tree when the router is created. A
microfrontend host does not have that tree: the remote is delivered separately
and resolved at runtime, often only once the user opens one of its URLs.

The usual workarounds each cost something:

- **Load every remote before `createRouter()`** — startup pays for remotes the
  user never visits.
- **Give the remote its own `<RouterProvider>`** — two routers, two histories,
  two caches. Deep links, back/forward and cross-remote navigation stop
  behaving like one app.

This bridge does neither. The host keeps **one** router, history, store and
native route cache; the remote tree is grafted into it on demand:

```text
Host router exists
  → user opens /orders/42
  → a static, childless /orders mount takes the fuzzy 404
  → RemoteRouteMount loads someRemote/routeTree
  → the adapter grafts it and calls router.update() + router.load()
  → the same router rematches /orders/42 as the remote detail route
```

The adapter knows nothing about Module Federation. You supply
`loadRouteTree(): Promise<AnyRoute>` — federation, native `import()`, or any
other transport.

## Install

```bash
pnpm add tanstack-router-remote
```

Peers: `@tanstack/react-router >=1.168.18`, React 18 or 19. ESM only.

## Quick start

**1. Declare the mount** — static, childless, created before `createRouter()`:

```tsx
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

`createRemoteRoute` takes the same options and infers the same type as
`createRoute`; it just prepares the fuzzy mount internally.

**2. Provide one adapter** above the host `RouterProvider` — never inside a
mount route:

```tsx
const routeTreeAdapter = new RouteTreeUpdateAdapter(() => router)

createRoot(rootElement).render(
  <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
    <RouterProvider router={router} />
  </RouteTreeUpdateAdapterProvider>,
)
```

That is the whole CSR setup. Nested remotes reuse the same adapter.

Two constraints worth knowing up front:

- Requires the default `notFoundMode: 'fuzzy'`. With `'root'` the host resolves
  an unknown URL before the remote can load.
- A route tree instance is mutable and attaches **once**. To mount one remote in
  two places, export a factory returning a fresh tree.

## Integrating with TanStack features

How the mount is declared for each way of building a route tree:

| TanStack feature       | How to integrate                                                         | Example                                                                |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Code routes            | `createRemoteRoute({ getParentRoute, path, component })`                 | [examples/module-federation](examples/module-federation)               |
| File routes (physical) | Wrap the generated declaration: `createRemoteRoute(createFileRoute(…)…)` | [examples/file-routing/app](examples/file-routing/app)                 |
| Virtual file routes    | Same wrapper; `virtualRouteConfig` assigns the path                      | [examples/file-routing/virtual](examples/file-routing/virtual)         |
| Pathless layouts       | Pass the route **id** (`/_shell/catalog`), not the URL                   | [examples/file-routing/virtual](examples/file-routing/virtual)         |
| Nested remotes         | The inner remote reuses the host adapter — nothing extra to wire         | [examples/module-federation/remote](examples/module-federation/remote) |
| Module Federation      | `loadRouteTree: () => loadRemote('someRemote/routeTree')`                | [examples/module-federation/host](examples/module-federation/host)     |
| Native ESM import      | `loadRouteTree: () => import('remote/routeTree')`                        | [examples/native-import/host](examples/native-import/host)             |
| SSR / hydration        | `adapter.prepare()` + a `createRouteTree()` factory                      | [ssr-route-tree.test.tsx](tests/integration/ssr-route-tree.test.tsx)   |

Loaders, `validateSearch`, `beforeLoad` context, `pendingComponent`,
`errorComponent`, `notFoundComponent`, the native route cache and scoped
`Link`/`useNavigate` need **no** integration — they work inside a mounted
remote as they do anywhere else. The [Module Federation
lab](examples/module-federation/README.md#routes-to-try) has a URL exercising
each one.

Run them:

| Lab                   | Command                                      | URL                                           |
| --------------------- | -------------------------------------------- | --------------------------------------------- |
| Module Federation     | `pnpm run dev:example:module-federation`     | `http://localhost:3100/platform/`             |
| Native ESM import     | `pnpm run dev:example:native-import`         | `http://localhost:3200/native/catalog`        |
| File routes, physical | `pnpm run dev:example:file-routing:physical` | `http://localhost:3210/file-routing/`         |
| File routes, virtual  | `pnpm run dev:example:file-routing:virtual`  | `http://localhost:3211/file-routing-virtual/` |

## SSR

SSR works, but attachment must happen **before** the first server match, so it
needs a bootstrap with an async step — not TanStack's default
`createRequestHandler`, which starts `router.load()` too early.

Use `adapter.prepare()` instead of `attach()`, and create fresh host router,
adapter and trees per request; the remote must export a
`createRouteTree(): AnyRoute` factory rather than a singleton.

```tsx
await routeTreeAdapter.prepare({ mountRoute, loadRouteTree: createRouteTree })
await router.load() // server — or hydrate(router) on the client
```

`prepare()` only grafts and reindexes; it deliberately does not call
`router.load()`, leaving TanStack in control of loader data, dehydration and
hydration. Full sequence: [limitations](docs/limitations.md) and
[`ssr-route-tree.test.tsx`](tests/integration/ssr-route-tree.test.tsx).

## Constraints

- The host owns `basepath`, history, shell component and global router options.
- `redirect({ to: '/' })` thrown from remote lifecycle code targets the **host**
  router, bypassing the scoped facade.
- No catch-all `/$` route is added — it would change TanStack route ranking. A
  missing resource should still `throw notFound()`.

Not supported yet — unresearched, not known incompatibilities:

| Area                                        | State                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Remote `__root__` identity                  | Projected onto a pathless bridge; `RemoteRootRoute.useLoaderData()` is unavailable |
| Streaming / deferred SSR, TanStack Start    | No validated contract                                                              |
| Detach, remote replacement, route-level HMR | No public API                                                                      |

Full operational contract: [limitations](docs/limitations.md).

## Status

`0.x`: remote-tree attachment is not an official TanStack composition API, so
the internals may need to follow upstream. Covered by 70 automated tests across
router runtime, React integration, tree mutation, deep links, nested remotes,
cache, lifecycle and 404 boundaries — see the
[evidence matrix](docs/runtime-evidence.md).

Not affiliated with or endorsed by TanStack; the `@tanstack-router-remote`
scope is unofficial.

## Development

Requires Node 20+ and pnpm 11+ (npm and Yarn cannot resolve `workspace:*` or the
version catalog).

```bash
pnpm install --frozen-lockfile
pnpm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) · [architecture](docs/architecture.md) ·
[upstream API directions](docs/proposal.md)
