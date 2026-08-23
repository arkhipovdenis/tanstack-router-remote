# Upstream proposal: attach a remote route tree safely

## Problem

TanStack Router excels with one statically known route tree. A module-federated
microfrontend needs a host to discover a generated remote route tree after the
host router has already been created.

The adapter in this repository proves that a current browser router can be
rematched after a remote tree becomes available. It does so by mutating route
instances, inserting a bridge route, cloning the host root, calling
`router.update({ routeTree })`, then calling `router.load()`.

That is intentionally not a stable public integration contract. Route objects
are mutable, root routes have special semantics, and the host must understand
matcher rebuilding and active-match replacement.

## The shape the operation converged on

Whatever ships it, the attach operation ended up with this signature. It is
included here as evidence of what the problem actually requires, not as a
request to add it to the router core — see the proposal below for where it
belongs.

```ts
await router.attachRouteTree({
  parentRoute: ordersMountRoute,
  loadRouteTree: () => loadRemote('orders/routeTree'),
  preserveParentChildren: false,
})
```

Three details of that shape come from running the adapter in production rather
than from designing it on paper.

**It takes a loader, not a tree.** Accepting `routeTree: AnyRoute` would mean
the caller already awaited the remote — which is the startup cost this whole
feature exists to avoid. Owning the load lets the router batch concurrent
mounts into one reindex, roll back cleanly when a transport fails, and reject a
second attach for a mount that is already resolving.

**Two operations, not one.** `attach` grafts _and_ rematches the current
location. SSR needs the graft without the rematch, because the server owns the
moment of `router.load()` and calls `dehydrate()` straight after; the client
then hydrates against the same fresh tree. In this repository those are
`attach()` and `prepare()`, and conflating them breaks the SSR path.

**Existing children are a policy, not an accident.** A mount usually carries a
bootstrap fallback that competes with the remote's dynamic routes, so the
default should replace them — but a host with non-overlapping static children
needs to keep them.

It should:

1. validate whether the tree is attachable and whether its route instances are
   already owned;
2. define a supported representation for a remote root below a parent route;
3. rebuild route indexes and matcher state atomically;
4. rematch the current location without requiring application code to call
   `router.load()` recursively from a lifecycle;
5. own the transport call, so batching, rollback and idempotency are the
   router's concern rather than every host's;
6. preserve documented router/cache/history behavior and expose an explicit
   detach/replacement policy;
7. provide type-level support for a route tree that is attached after host code
   generation.

## The proposal: an ecosystem package, not a core feature

Runtime route-tree attachment does not belong in the router core. Most
applications know their whole route tree at build time and would carry the
validation, batching, ownership and rollback machinery without ever calling it.
Microfrontends are the minority asking for it, and a minority should not widen
everyone's surface area.

The concrete proposal is therefore this: **adopt this work as an ecosystem
package** — `@tanstack/router-remote`, or whatever name fits the family —
rather than growing `router-core`. I am offering to maintain it in that role,
and to move it under TanStack governance if that is preferred; it is already
built the way an ecosystem package would need to be:

- framework-neutral core with React, Solid and Vue entry points, mirroring how
  the router itself is packaged;
- open peer range with a scheduled canary against the latest published router,
  so upstream drift surfaces as a failing job rather than as user bug reports;
- limitations written down as a contract, separating what is proven from what
  is merely untested;
- runnable examples for Module Federation, native ESM, both file-routing
  generator modes, and a cross-framework host.

### What the core would still owe it

A companion package can own transports, ownership rules, batching and the
framework bindings. What it cannot own from outside is the route-tree surface
it currently reaches through: `route.update({ getParentRoute })`, repeated
`addChildren()`, root cloning, and handing `router.update()` a new root
identity to force a reindex. None of that is committed API, and depending on it
is what makes the package fragile.

That fragility is not hypothetical. `router-core` 1.171.16 changed which route
owns a not-found boundary; nested deep links broke silently, and the canary
caught it. A supported seam would remove that whole class of breakage:

- an official way to reparent a route instance and trigger a reindex;
- a supported representation for a remote root below a parent route, so the
  pathless bridge stops being an outside invention;
- a stable rule for which route owns the not-found boundary while a descendant
  mount has not attached yet — the exact invariant that broke.

Three small, testable additions to the core. Everything else stays outside,
where the churn belongs.

## Questions for discussion

- Can a remote root preserve a first-class identity without creating two
  document-level root concepts?
- What official SSR manifest contract should replace the bridge's current
  request-local pre-attach bootstrap?
- What route tree factory/ownership contract is needed for mounting one remote
  multiple times?
- How should `redirect`, preload, `getRouteApi`, and typed links behave across
  the host/remote boundary?
- Which router state (cache, pending state, scroll restoration and
  subscriptions) is guaranteed through an attach?

## Evidence supplied by this repository

The suite demonstrates a local fuzzy not-found bootstrap, deep-link rematch,
router/history preservation, idempotent attach, serialized multiple mounts,
duplicate-tree rejection, projected root options, scoped navigation paths,
browser-like React integration, and a constrained non-streaming SSR/hydration
bootstrap. It is deliberately not evidence of broad framework support;
a multi-version compatibility matrix and real-world server transport evidence
remain prerequisites for that broader claim.
