# Contributing

This repository is a compatibility-sensitive production bridge. Do not widen the
supported TanStack Router range or relax a documented limitation without a
reproduction and regression test.

## Setup

This is a pnpm workspace; npm and Yarn will not resolve `workspace:*` or the
version catalog. Node 22.13+ and pnpm 11+ are required (pnpm 11 itself needs 22.13; Node 20 reached EOL in April 2026).

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

## Releasing

The adapter is built with rslib (`packages/route-tree-adapter/rslib.config.ts`)
as ESM only, one output file per source file.

Releases are tag-driven. The manifest stays at `0.0.0` in git; the version is
set as part of cutting a release:

```bash
pnpm run release 1.0.0   # or major | minor | patch | prerelease
git push origin main v1.0.0
```

`pnpm run release` bumps the manifest, commits it and tags the commit. It
refuses to run on a dirty tree, so the release commit only ever contains the
version bump. (`pnpm version` alone stops after the bump here: npm only
commits and tags when package.json sits at the git root, and ours is under
`packages/`.)

The `Publish` workflow runs `pnpm run check`, verifies that the tag matches the
manifest version, and publishes with `--provenance --access public`. A tag that
disagrees with the version fails before anything reaches npm.

Publishing uses the `NPM_TOKEN` repository secret (an npm automation token with
publish rights).

The public API follows semver: the four exported names keep their shape within
a major. The internals are a different matter — they rely on TanStack behaviour
that is not an official composition API, so an upstream release can force the
peer range to narrow in a minor. Widening the supported range still needs a
reproduction and a regression test, as above.
