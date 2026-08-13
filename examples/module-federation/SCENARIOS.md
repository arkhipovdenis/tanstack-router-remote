# Manual verification scenarios

This guide turns the runnable Module Federation lab into a manual counterpart
to the router-runtime and React-runtime tests. The hosted URLs deliberately
include the host `basepath` (`/platform`). Use browser navigation, rather than
editing code, for every scenario below.

## Start the Module Federation lab

Run only the federation chain with one command:

```bash
npm run dev:example:module-federation
```

It starts nested Invoices (`:3102`), Orders (`:3101`) and Host (`:3100`) in
one terminal. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> once to stop all processes.
Use `npm run dev:examples` only to run this lab and the separate native
ESM-import lab together.

For a production-artifact check, stop the dev servers first, then run:

```bash
npm run preview:example:module-federation
```

Open [host home](http://localhost:3100/platform/). A visible loader can be
short-lived when bundles are cached. To make either mount loader observable,
open a fresh/private browser session, disable cache in DevTools, or use a
network throttle and hard-reload the target URL.

## What the screen means

The Orders evidence table uses these marks:

| Mark | Meaning |
| --- | --- |
| `✓` | The route/layout is active and the shown capability ran. |
| `…` | An attach or loader is resolving. |
| `—` | That route is not active yet. |
| `✕` | A runtime-identity comparison differs unexpectedly. |

Loader badges have the form `loader #N · cache-key`. With the example's
`staleTime: Infinity` and five-minute `gcTime`, returning to a previously
visited cache key should keep its original `#N` until an explicit invalidation.

## Hosted Orders scenarios

| Runtime capability | Route and action | Expected visible evidence |
| --- | --- | --- |
| Static mount, direct deep link, host `basepath` | Hard-reload [Orders index](http://localhost:3100/platform/orders). | URL remains under `/platform`; first the local **Loading orders route tree…** UI may appear, then `Orders route tree`, the root badge and `Remote index is active` render. |
| Remote root bridge and root lifecycle | Stay on [Orders index](http://localhost:3100/platform/orders). | The evidence table shows `Remote root + bridge loader` and `Remote root beforeLoad → loader context` with `root-before-load`. This is the projected remote-root lifecycle, not a second router. |
| Real pathless route and remote index | Stay on [Orders index](http://localhost:3100/platform/orders). | `Workspace layout` is present above the index, its loader badge is visible, and the table marks the pathless layout and index active. |
| Validated search and loader dependencies | Open [audit search](http://localhost:3100/platform/orders?view=audit&query=cache-demo), then use **Change search** and **Return to cached summary**. | The index prints validated search. `summary` and `audit` have distinct cache keys; returning to an already visited view preserves its loader number. An unsupported `view` in the address bar normalizes to `summary`. |
| Params, detail loader, and detail index child | Open [Order 42](http://localhost:3100/platform/orders/42?tab=overview), then use **Change param** and **Change search**. | The detail prints `orderId` and validated `tab`, has a parameterized loader key, and renders **Order overview**, the index child under `/$orderId`. |
| Nested child and inherited params | Open [Order 42 activity](http://localhost:3100/platform/orders/42/activity). | **Activity for order 42** and its loader badge appear. Use **Change activity param**; it should become order 77 without leaving the nested route. |
| Generic and route-bound navigation | On an Order detail page, use **Route.Link → remote Index**, return to detail, then use **Route.useNavigate() → remote Index**. | Both actions end at `/platform/orders`, never `/platform/`. This is the visible counterpart of the `Route.Link` / `Route.useNavigate` rebasing test; the normal navigation links exercise generic `Link`. |
| One browser runtime | On any hosted Orders page, read **Runtime identity**. | `Scoped router facade` says `✓ expected facade`; browser history, TanStack stores/native cache, route registry, and current location all say `✓ same object`. The facade is intentionally different, but the runtime is shared. |
| React state mount semantics | Increment **Root React state** and **Pathless state**. Navigate Index → Order → Activity → Index. Then go **Home** and enter Orders again. | Root and pathless values persist across remote descendants, then reset after Home unmounts the remote. This distinguishes ordinary React mounting from router cache behavior. |
| Leaf state semantics | On Index, increment local state/type a draft, then change only index search; next leave for Detail and return. On Detail, increment local state, then change its param and search. | Index state survives its own search update but resets when the index leaf is replaced. Detail state survives its param/search updates because the same detail match remains mounted. Activity and Order overview similarly demonstrate replacement of a nested leaf. |
| Native router cache and invalidation | Visit index `summary` → `audit` → `summary`, then detail `42` → `77` → `42`. Finally click **Invalidate active native route cache**. | Before invalidation, a revisited fresh key retains its loader number. The output beneath the button reports active loader numbers before and after invalidation; after it completes, those active numbers increase. No custom MFE cache participates. |
| Native pending boundary | Open [slow route](http://localhost:3100/platform/orders/slow). | **Loading remote slow route…** appears during the deliberate 700 ms loader, then **Slow loader completed** replaces it. |
| Error and not-found boundaries | Open [failure](http://localhost:3100/platform/orders/failure), [explicit not-found](http://localhost:3100/platform/orders/not-found), [unknown detail child](http://localhost:3100/platform/orders/42/not-a-real-child), and a [structural remote miss](http://localhost:3100/platform/orders/no/such/path). | Each remains inside the Orders UI and shows a **Remote failure was contained** or **Remote route was not found** boundary. The last URL starts with the local mount loader; after attach it remains a native fuzzy 404 and renders the remote root boundary. No catch-all route is added, so nested deep links keep their normal priority. |

## Nested `Host → Orders → Invoices` scenarios

The next routes cause two serial attachments: the Host loads `orders/routeTree`,
then Orders loads `invoices/routeTree` with the same host-owned adapter. A hard
reload of a deep Invoice URL is the strongest smoke test.

| Runtime capability | Route and action | Expected visible evidence |
| --- | --- | --- |
| Nested fuzzy mount and deep link | Hard-reload [Invoices index](http://localhost:3100/platform/orders/invoices) or [Invoice INV-42](http://localhost:3100/platform/orders/invoices/INV-42). | Orders first appears; then the local **Loading invoices route tree…** boundary may appear; finally **Invoices route tree** and the requested index/detail render. No extra TanStack Router instance is created. |
| Second root bridge, lifecycle, pathless layout, index | Open [Invoices index](http://localhost:3100/platform/orders/invoices). | The Invoices root loader and `invoices-before-load` lifecycle marker, **Invoices workspace layout** (a real pathless route), and **Invoices index component** all render under Orders. |
| Nested search, params, and native cache | Use **Index with search**, **Return to summary cache**, **Invoice INV-42**, and **Invoice INV-77**. | The index prints validated `view`; summary/payments have separate keys. Detail keys include the invoice ID. Returning to a previously visited key while fresh retains its loader number. |
| Second scoped navigation facade | From any Invoices page click **Invoices index** or **Back to nested index**. | The URL stays below `/platform/orders/invoices` (the validated default may add `?view=summary`), never host home or the Orders index. This is a native TanStack `Link` passing through two composed scopes. |
| Nested runtime identity and one adapter | Read **Nested runtime identity** on a hosted Invoices page. | All five checks are `✓ same runtime`: second scoped facade, host history, host stores/cache, route registry, and the one attachment adapter. |
| Nested React state semantics | Increment **Nested root state** and **Pathless state**, then switch between index and invoice detail. Leave Invoices for Orders index, then return. | Root/pathless values survive their descendant changes, then reset after the Invoices mount unmounts. Index/detail leaf state follows the same ordinary match-lifecycle rule as Orders. |

The Invoices root visibly runs its own `beforeLoad → loader` context chain;
the `invoices-before-load` marker is passed through the second root bridge.

## Standalone remotes

These URLs are useful to contrast an embedded route tree with a normal remote
application. Their runtime panels correctly show that no host probe exists:

| URL | Expected result |
| --- | --- |
| [Orders standalone](http://localhost:3101/42) | Orders root, pathless layout, detail route, loaders, and state examples render without the host identity comparison. |
| [Invoices standalone](http://localhost:3102/INV-42) | Invoices root, pathless layout, parameterized detail route, and loaders render without the host identity comparison. |

## Boundaries of this guide

These scenarios validate the supported CSR attach path. They do not
make the generated remote `__root__` a host-tree identity: the remote root
component and compatible lifecycle options are projected through a bridge, so
`rootRoute.useLoaderData()` remains unsupported for an embedded remote root.
The separate SSR/hydration bootstrap, HMR, detach/replacement, and redirects
thrown from remote lifecycle code are intentionally outside this manual lab. See the
[runtime limits](../../docs/limitations.md) for the full contract.
