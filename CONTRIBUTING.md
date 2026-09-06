# Contributing

This repository is a compatibility-sensitive production bridge. Do not widen the
supported TanStack Router range or relax a documented limitation without a
reproduction and regression test.

## Setup

This is a pnpm workspace; npm and Yarn will not resolve `workspace:*` or the
version catalog. Use Node `^22.18.0 || >=24.11.0` and Corepack pnpm 11.9.0. These Node versions define the supported repository verification matrix. pnpm 10.26.0 is the supported lower bound and is also checked in CI.

```bash
pnpm install
```

Shared versions (React, the TanStack packages, the Rsbuild toolchain) live in
the `catalog:` of `pnpm-workspace.yaml`, not in the individual manifests.
Change them there — a version that drifts apart from the others is how two
React copies end up in one process, which surfaces as `Invalid hook call` in
tests that look unrelated.

Before opening a change:

1. Keep the public surface limited to the adapter, its host-level framework
   providers, mount preparation, and React/Solid/Vue attachment helpers. Graft/bridge
   internals are intentionally private.
2. Run `pnpm run check` (lint, format, typecheck, tests, builds) and
   `pnpm run check:consumers` (archive installed outside the workspace).
   `pnpm run format` fixes formatting; `pnpm run lint:fix` fixes lint.
3. Add a unit or browser integration test for behavior that depends on route
   tree mutation, `router.update()`, or rematching. If the behavior only
   appears with real chunk loading, the federation runtime or a network
   failure, add it to `tests/e2e` instead and run `pnpm run test:e2e`
   (Playwright against the production preview; needs
   `pnpm exec playwright install chromium` once).
4. Describe whether the change affects direct deep links, SPA navigation,
   basepaths, lifecycle options, cache, route-bound navigation, or a second
   mount.

## Releasing

The adapter is built with rslib (`packages/route-tree-adapter/rslib.config.ts`)
as ESM only, one output file per source file.

Releases are tag-driven. The committed manifest records the package version; a new version is
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

Push the branch and the tag together, as above: the workflow refuses a tag that
is not an ancestor of `main`, so a tag that arrives before its commit fails.

The `Publish` workflow checks the tag against the manifest version and against
`main`, runs `pnpm run check` and `check:consumers`, builds the package, and
refuses to continue if the resulting tarball carries no `dist/` files. It then
publishes with `--provenance --access public`. Everything that can fail is
checked before the irreversible step.

Publishing uses the `NPM_TOKEN` secret (an npm automation token with publish
rights) and runs in the `npm` environment, which must exist under
Settings → Environments. Give that environment required reviewers to hold each
release for approval, and hold `NPM_TOKEN` there rather than at repository
level so no other workflow can read it.

The public API follows semver: documented public exports keep their shape within
a major. The internals are a different matter — they rely on TanStack behaviour
that is not an official composition API, so an upstream release can force the
peer range to narrow in a minor. Widening the supported range still needs a
reproduction and a regression test, as above.
