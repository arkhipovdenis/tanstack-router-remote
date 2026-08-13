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

## Desired official API

An upstream API could make these responsibilities explicit and owned by
TanStack Router:

```ts
await router.attachRouteTree({
  parentRoute: ordersMountRoute,
  routeTree: remoteRouteTree,
  strategy: 'replace-mount-children',
})
```

It should:

1. validate whether the tree is attachable and whether its route instances are
   already owned;
2. define a supported representation for a remote root below a parent route;
3. rebuild route indexes and matcher state atomically;
4. rematch the current location without requiring application code to call
   `router.load()` recursively from a lifecycle;
5. preserve documented router/cache/history behavior and expose an explicit
   detach/replacement policy;
6. provide type-level support for a route tree that is attached after host code
   generation.

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
