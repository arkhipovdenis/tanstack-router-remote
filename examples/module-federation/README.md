# Runnable Module Federation evidence lab

This is a small, independent `Host → Orders → Invoices` chain. Rsbuild and
Module Federation only transport generated `routeTree` objects; the published
adapter has no federation dependency.

```bash
pnpm run dev:example:module-federation
```

This starts only the Module Federation chain: Invoices (`:3102`), Orders
(`:3101`) and Host (`:3100`). Press <kbd>Ctrl</kbd>+<kbd>C</kbd> once to stop
every process. Then open `http://localhost:3100/platform/` and enter **Orders
remote**. The remote screen is deliberately an interactive evidence lab,
rather than a minimal hello-world. Use `pnpm run dev:examples` only when both
the federation and native-import labs are wanted together.

## Routes to try

| URL                                            | What it demonstrates                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/platform/orders`                             | Remote root `beforeLoad → loader` context, actual pathless layout, index route, validated search and index loader.                           |
| `/platform/orders?view=audit&query=cache-demo` | Search validation and an index loader dependency/cache key.                                                                                  |
| `/platform/orders/42?tab=overview`             | Parameterized detail parent plus its index child.                                                                                            |
| `/platform/orders/42/activity`                 | A nested remote child that inherits the parent parameter.                                                                                    |
| `/platform/orders/slow`                        | Remote `pendingComponent`; the loader waits for 700 ms on a cold entry.                                                                      |
| `/platform/orders/failure`                     | Remote route `errorComponent`.                                                                                                               |
| `/platform/orders/not-found`                   | Remote route `notFoundComponent`.                                                                                                            |
| `/platform/orders/42/not-a-real-child`         | A natural nested not-found path caught by the remote detail boundary.                                                                        |
| `/platform/orders/no/such/path`                | A native fuzzy 404 whose visible boundary is delegated to the remote root after the tree attaches.                                           |
| `/platform/orders/invoices`                    | A real second Module Federation attachment: Orders loads `invoices/routeTree` using the same host-owned adapter.                             |
| `/platform/orders/invoices/INV-42`             | Deep link through two fuzzy mounts, nested remote root/pathless/index/detail routes, params, native cache and two scoped navigation facades. |
| `http://localhost:3101/42`                     | Same remote tree rendered standalone, without a host runtime probe.                                                                          |
| `http://localhost:3102/INV-42`                 | Invoices tree rendered standalone with its own adapter provider.                                                                             |

## Reading the screen

The top table uses an explicit result convention:

| Mark | Meaning                                                                                      |
| ---- | -------------------------------------------------------------------------------------------- |
| `✓`  | The matching route/layout is mounted and its shown capability has executed.                  |
| `…`  | A loader or mount is still resolving.                                                        |
| `—`  | That route is not active; use the adjacent navigation action to make it active.              |
| `✕`  | A runtime identity check unexpectedly differs. This should not happen in the hosted example. |

The **Runtime identity** panel distinguishes the scoped navigation facade from
the router runtime. The remote intentionally sees a different router object
(a scoped facade), while `history`, `stores` (including the native route
cache), `routesById`, and current location are the _same objects_ as the host
router. The probe is example-only context; it is not required by the package.

## State and native cache experiments

The labels on screen are intentionally precise about React lifecycle:

1. Increment **Root React state** and **Pathless state**, then switch Index →
   Detail → Activity → Pending → Index. Both values remain because the remote
   root and pathless layout matches remain mounted across descendants.
2. Go to Host home and return to Orders. Those two values reset because their
   components were unmounted. This is expected React behavior, not cache loss.
3. On Index, change its local state and draft, then use **Change search**.
   The same index component stays mounted, so both values remain. Leave for a
   Detail route and return: the index leaf is replaced and resets as expected.
4. On Detail, change local state, then change the order id and `tab` search.
   The detail route has no `remountDeps`, so its component and local state
   remain mounted for those updates. Activity gives the same check for a nested
   leaf route.
5. Every loader badge displays an execution number and cache key. With
   `staleTime: Infinity` and a five-minute `gcTime`, navigate Index summary →
   audit → summary or Detail 42 → 77 → 42: returning to a fresh key should
   display its previous execution number. Click **Invalidate active native
   route cache** to force the active loaders to run again. The output directly
   below the button prints the active loader numbers before and after that
   operation. No custom cache is used anywhere in this example.
6. On a Detail page, use both controls in **Route-bound navigation APIs**.
   They exercise the actual `orderRoute.Link` and `orderRoute.useNavigate()`
   APIs, rather than the generic `Link`. Both `to="/"` actions resolve to the
   mounted remote index (`/platform/orders` in the host) rather than host home.

The root loader is intentionally read from the active bridge match. The remote
root component and its compatible root options run, but the generated remote
`__root__` itself does not become an identity in the host tree, so
`rootRoute.useLoaderData()` is not a supported embedded-root API.

## Nested federation example

The **Invoices nested remote** link in Orders mounts a genuinely separate
federated build—not a local route-tree fixture. It has its own root,
`beforeLoad → loader` context marker, pathless workspace route, index and
parameterized detail route. Its runtime panel proves that both remote levels
share the original host history, stores, route registry, and one attachment
adapter, while navigation scopes compose to `/platform/orders/invoices`.

For a complete reproducible walkthrough, including deep links, pending/error
boundaries, state persistence and cache checks, see
[manual verification scenarios](SCENARIOS.md).

## Integration details

The host and both remotes share React, React DOM, `@tanstack/react-router`,
its core, history, and `@tanstack-router-remote/route-tree-adapter` as singletons.
A remote that renders its own
`RemoteRouteMount` must also share
`@tanstack-router-remote/route-tree-adapter` as a singleton so it reads the host's
adapter context. Two copies make the bridge context and mutable route object
identities unsafe.

The demo intentionally uses code routes to keep the repository focused on the
adapter, using `createRemoteRoute({ ... })` for every static mount. A file-route
host instead wraps its generated declaration —
`createRemoteRoute(createFileRoute('/orders')({ ... }))` — before
`createRouter({ routeTree })`. It then renders `RemoteRouteMount` from the
mount's normal component, which also covers the fuzzy 404 a direct deep link
produces.
