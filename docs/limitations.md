# Runtime limits and invariants

## Current validated boundary

The adapter is tested as a static-mount, attach-only integration. Its ordinary
CSR path mutates generated route instances, gives `router.update()` a new
host-root identity, and explicitly calls `router.load()` to replace the active
fuzzy not-found match.

This is a carefully tested workaround, not an officially supported TanStack
Router composition API. It describes the current validated CSR boundary; it
does not conclude that adjacent capabilities are impossible.

## Remote root bridge

A generated `RootRoute` has fixed `__root__` identity and cannot become a
child route. The adapter therefore creates a pathless bridge below the host
mount. It copies compatible route options from `remoteTree.options` and renders
the remote root component in a scoped router context.

The following regular route behavior is expected to work on the bridge:

- `loader`, `beforeLoad`, context and search validation;
- pending, error and not-found boundaries;
- route cache policy, head/meta/assets and pathless layouts.

The following stays host-owned or is unavailable to the embedded remote root:

- actual `__root__` identity and APIs bound to it, such as
  `RemoteRootRoute.useLoaderData()`;
- `shellComponent`, router-wide settings, browser history and `basepath`;

Non-streaming SSR/hydration has a validated bootstrap path: prepare a fresh
remote tree before server `router.load()`, then prepare matching fresh trees
before client `hydrate(router)`. Treat the result as `±`: it requires a
request-local host/router/remote tree, the same resolved remote version on both
sides, TanStack `<Scripts />` outside the React hydration root, and a custom
async request/bootstrap step before the first server load. The original remote
root identity remains unavailable in that path too. Deferred/streaming SSR,
TanStack Start/default-handler integration, transport-specific server loading,
and route-level HMR each remain `? not researched`, not `− unsupported`.

Remote child route APIs continue to operate on their original, reparented route
instances.

## Mount and ownership rules

1. Create one `RemoteRouterAdapter` per host router and place
   `RemoteRouterProvider` above the host `RouterProvider`. Do not
   create an adapter inside an individual mount route.
2. Create a code mount with `createRemoteRoute({ ... })` before
   `createRouter()` receives the host route tree. For a standard file route,
   wrap the declaration — `export const Route = createRemoteRoute(
createFileRoute('/catalog')({ ... }))` — so the decoration is the exported
   value and cannot be omitted; TanStack's generator reads the inner
   `createFileRoute` call and needs no build-time transform. This holds in both
   generator modes: physical routing, where the filename decides the URL, and
   virtual routing, where `virtualRouteConfig` assigns it. One trade-off comes
   with the wrapper — the generator auto-corrects a mismatched
   `createFileRoute()` path only when that call is the direct export
   initializer, so a wrapped file keeps a wrong path instead of having it
   silently fixed. The mount must initially have no children.
3. Render `RemoteRouteMount` from the mount component. A direct deep link below
   an unattached mount produces a fuzzy 404 that _matches the mount_ rather than
   throwing into it, so that same component renders the loading UI and starts
   the attach. A local `notFoundComponent` on the mount is **not** required for
   this and is redundant if it only re-renders the mount; declare one to catch a
   `notFound()` thrown by the mount's own `beforeLoad`/`loader`, which is the
   case TanStack routes it to.
   After attachment, a structural miss stays a native fuzzy 404 on that mount
   and renders the remote root's `notFoundComponent` in a scoped context. If
   that boundary is absent, it safely uses the host default or TanStack's
   default instead of re-entering the mount. The adapter does **not** add a
   `/$` catch-all: a full-match splat would steal
   partial parameter branches and nested remote deep links. This does not
   replace `throw notFound()` for a matched dynamic route whose resource is
   absent.
   This direct-deep-link mechanism requires TanStack Router's default
   `notFoundMode: 'fuzzy'`. With `notFoundMode: 'root'` (or the legacy
   `notFoundRoute` option), an unmounted remote deep link is intentionally
   handled by the host root 404 before the mount can load its route tree.
4. A generated route tree object is mutable and may be attached only once per
   document. To mount one remote in two places, expose
   `createRouteTree(): AnyRoute`, not a singleton `routeTree`.
5. Route-tree mutations are serialized per host router, and mounts that attach
   concurrently are collapsed into one batch. Their remote trees load in
   parallel, their grafts apply in order, and the batch pays a single
   `router.update()` plus a single `router.load()` instead of one pair per
   mount — `router.update()` rebuilds the whole route index, so N mounts
   previously cost N reindexes and N rematches. `attach()` (CSR) and `prepare()`
   (SSR/hydration bootstrap) never share a batch, because only the former owns a
   client load. Batching is an internal scheduling detail: each mount still gets
   its own promise and its own published state.
   The current public API exposes no detach or remote-replacement operation;
   those lifecycle operations have not yet been researched. Reload the host
   document to recover from a failed mid-mutation attach.
   A failure before `router.load()` — including a `router.update()` throw after
   the graft — rolls the mount back to its pre-graft shape and releases the
   remote tree's single-mount claim, so a host memoizing that tree instance
   (typically an SSR module scope) can still serve the next request from a fresh
   router. That mount is nevertheless poisoned for the current document: a
   subsequent `attach()` on it rejects rather than retrying against a router
   that may have consumed a half-built tree. A failure in the later `load()`
   step leaves the remote tree attached and claimed, because the host router is
   already indexing its routes.
   Failure is per member wherever it can be: a mount whose transport fails, or
   whose tree is already claimed, is rejected on its own and leaves its healthy
   batch siblings attached. The shared steps are the exception — an `update()`
   throw rolls back and poisons every mount in that batch, and a `load()` throw
   poisons every mount that grafted into it, because at that point the host
   router has already consumed one tree built from all of them.
6. By default the adapter replaces host children under the mount. A bootstrap
   splat fallback would otherwise overlap remote dynamic routes. Set
   `preserveMountChildren` only for non-overlapping static children.

## Navigation

The bridge supplies a router facade to remote root rendering. It prefixes
remote absolute paths such as `/$orderId` with the host mount and avoids
double-prefixing already-expanded paths used by route-bound navigation APIs.

This facade applies to navigation performed through the scoped router context.
Do not assume it covers every route-core entry point. In particular,
`redirect({ to: '/' })` thrown in remote lifecycle code is handled by the real
host router and is **not** rebased. Cross-host navigation should use an explicit
host navigation API supplied through context or a platform exposure.

The facade scopes `navigate`, `buildLocation`, `preloadRoute`, and `matchRoute`.
`<Link>` resolves its target through the scoped `buildLocation` and passes the
result to `preloadRoute` as a prebuilt location, so hover/viewport preloading is
scoped through that path regardless. The `preloadRoute` and `matchRoute`
wrappers cover the imperative calls, which carry no prebuilt location: without
them a remote `preloadRoute({ to: '/slow' })` resolves against the host tree and
silently preloads a same-named host route instead of the remote one.

`useRouter()` inside a remote returns the facade, which is an `Object.create`
descendant of the host router and therefore **not** `===` the host router
instance. Remote code that compares router identity or keys a
`WeakMap<Router, …>` by it will not see the host instance. This is deliberate —
a narrow prototype facade preserves RouterCore accessor receivers where a
generic Proxy does not — but it is a real constraint on remote code.

Nested scoped facades delegate navigation to their parent facade, so route
prefixes compose back to the host router. The route-tree adapter itself does
not use that TanStack router context: it is supplied once through
`RemoteRouterProvider` and therefore remains the same at every depth.

## Validation required before expanding the supported scope

- Browser test: direct deep link, local loading, structural remote 404,
  loader-thrown remote 404, and import error.
- Browser test: native `Link`, `Route.Link`, `Route.useNavigate`, relative and
  absolute paths, host basepath and remote-to-host navigation.
- Regression tests: root bridge lifecycle/options, loader cache, repeated
  home-to-remote transitions and two sequential mounts.
- Consumer test: `npm pack` followed by a typecheck and production build in a
  fresh host application.
- CI matrix for the explicitly supported TanStack Router minor versions.

## Upstream version drift

The peer range is open while the repository pins an exact version (both in
`pnpm-workspace.yaml` and the package manifest, not restated here), so a fresh
install can resolve a router this project has never been tested against. The `Canary (TanStack latest)` workflow runs `pnpm run check`
against the latest published release on a schedule to surface that gap; it is
informational and not a required check.

Known drift above the pinned baseline. The versions below are historical
record — the release that removed an API does not change — unlike the pin
itself, which lives in the catalog:

- **Removed introspection APIs, by `1.170.27` (`router-core@1.171.22`).**
  `router.stores.cachedMatches`, `router.clearExpiredCache()`,
  `router.hasNotFoundMatch()`, `state.statusCode` and `match.globalNotFound`
  are gone. `clearExpiredCache()` maps to `clearCache()`, and `globalNotFound`
  to `match._notFound` — note that `status` stays `'success'` on a not-found
  match, so `status === 'notFound'` is not a substitute. The cached-match list
  has no public replacement: match caching moved to a private `router._cache`.
  Assert loader caching by counting loader runs instead of reading the cache.

Adapter sources (`packages/route-tree-adapter/src`) use none of these APIs — the breakage was
confined to test probes, which now use the version-neutral helpers in
`tests/support/router-compat.ts`. Do not widen the peer range's upper end, or
repin, without re-running the canary.

### Router loading paths differ between environments

`@tanstack/router-core` ships separate server and client builds selected by
export conditions: the `node` condition resolves the server build
(`isServer === true`), and a browser-like environment resolves the client one.
Only the client path keeps matches cached across navigations — the server path
has no cross-navigation match cache by design.

This matters when reading test results. The default Vitest environment is
`node`, so a "loader cache" assertion run there exercises the server path.
A plain-Node probe that navigates away and back will re-run the loader on any
version, which looks exactly like a caching regression but is not one. Verify
caching claims in a `jsdom` environment before concluding that upstream broke
something.
