# Contributing

This repository is a compatibility-sensitive production bridge. Do not widen the
supported TanStack Router range or relax a documented limitation without a
reproduction and regression test.

Before opening a change:

1. Keep the public surface limited to the adapter, its host-level React
   provider, mount preparation, and React attachment helpers. Graft/bridge
   internals are intentionally private.
2. Run `npm run check`.
3. Add a unit or browser integration test for behavior that depends on route
   tree mutation, `router.update()`, or rematching.
4. Describe whether the change affects direct deep links, SPA navigation,
   basepaths, lifecycle options, cache, route-bound navigation, or a second
   mount.

Keep the public API at `0.x` until the compatibility matrix is broad enough to
justify a stable contract. This does not change the supported production scope
documented in the repository README.
