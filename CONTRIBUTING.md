# Contributing

This repository is a compatibility-sensitive production bridge. Do not widen the
supported TanStack Router range or relax a documented limitation without a
reproduction and regression test.

## Setup

This is a pnpm workspace; npm and Yarn will not resolve `workspace:*` or the
version catalog. Node 20+ and pnpm 11+ are required.

```bash
pnpm install
```

Shared versions (React, the TanStack packages, the Rsbuild toolchain) live in
the `catalog:` of `pnpm-workspace.yaml`, not in the individual manifests.
Change them there — a version that drifts apart from the others is how two
React copies end up in one process, which surfaces as `Invalid hook call` in
tests that look unrelated.

Before opening a change:

1. Keep the public surface limited to the adapter, its host-level React
   provider, mount preparation, and React attachment helpers. Graft/bridge
   internals are intentionally private.
2. Run `pnpm run check` (lint, format, typecheck, tests, builds).
   `pnpm run format` fixes formatting; `pnpm run lint:fix` fixes lint.
3. Add a unit or browser integration test for behavior that depends on route
   tree mutation, `router.update()`, or rematching.
4. Describe whether the change affects direct deep links, SPA navigation,
   basepaths, lifecycle options, cache, route-bound navigation, or a second
   mount.
5. Add a changeset (`pnpm changeset`) for anything that changes the published
   package. Examples are private and do not need one.

## Releasing

The adapter is built with rslib (`packages/route-tree-adapter/rslib.config.ts`)
as ESM only, one output file per source file. Releases go through Changesets:
`changeset version` opens the version PR, and merging it publishes.

The `Release` workflow is manual and defaults to a dry run; publishing needs an
`NPM_TOKEN` secret that is not configured yet.

Keep the public API at `0.x` until the compatibility matrix is broad enough to
justify a stable contract. This does not change the supported production scope
documented in the repository README.
