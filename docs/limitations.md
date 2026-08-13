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

1. Create one `RouteTreeUpdateAdapter` per host router and place
   `RouteTreeUpdateAdapterProvider` above the host `RouterProvider`. Do not
   create an adapter inside an individual mount route.
2. Create a code mount with `createRemoteRoute({ ... })` before
   `createRouter()` receives the host route tree. For a standard file route,
   keep the generator-visible `Route = createFileRoute(...)`, then either call
   `createRemoteRoute(Route)` yourself or let the optional Rspack companion
   plugin inject that same call before router creation. The mount must
   initially have no children.
3. Render the same `RemoteRouteMount` from the normal mount component and
   its local `notFoundComponent` so direct deep links show loading UI.
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
5. Attachments are serialized per host router. The current public API exposes
   no detach or remote-replacement operation; those lifecycle operations have
   not yet been researched. Reload the host document to recover from a failed
   mid-mutation attach.
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

Nested scoped facades delegate navigation to their parent facade, so route
prefixes compose back to the host router. The route-tree adapter itself does
not use that TanStack router context: it is supplied once through
`RouteTreeUpdateAdapterProvider` and therefore remains the same at every depth.

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
