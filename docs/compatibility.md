# Compatibility policy

The reproducible tested snapshot lives in `pnpm-workspace.yaml`. Current router
minimums are React 1.170.31, Solid 1.170.29, Vue 1.170.28 and core 1.171.26.
These are the baseline, not four independently interchangeable versions. Install
one coherent TanStack dependency graph; duplicate router/framework runtimes can
break context and stores even when individual versions satisfy a peer range.

Peer ranges stop before TanStack 2. Future major-1 releases are allowed by the
manifest but are not all proven compatible. The latest canary runs separately;
a workflow definition is not evidence of a successful run. The earlier
`>=1.168.18` lower bound had no dedicated verification and has been withdrawn.
Baseline currently equals the minimum router combination. Framework peer ranges
are broader than the tested React 19.2.0 / Solid 1.9.15 / Vue 3.5.13 snapshot.

| Verification               | Scope                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run check`           | Pinned workspace: React/Solid/Vue runtime tests, types, package and example builds                                               |
| `pnpm run check:consumers` | Pack, fresh npm installation, strict NodeNext application typecheck with skipLibCheck, production bundle for each renderer entry |
| Latest canary workflow     | Floating upstream versions, informational until the run succeeds                                                                 |
| Browser report             | Specific manually exercised browser, URLs and scenarios only                                                                     |

The adapter relies on mutable TanStack internals, not an official route-tree
composition API. A confirmed upstream regression may require narrowing peer
ranges. Record the affected combination and fix/restrict it before releasing.

Repository tooling is pinned to Corepack pnpm 11.9.0, with a supported floor of
10.26.0. A fresh temporary copy installed the frozen lockfile and completed the
full check on pnpm 10.26.0. CI now covers both managers on Node 22.18 and 24.
This is a supported floor, not proof that every older pnpm version fails.
The original global pnpm 8.14.1 was left unchanged.

The supported repository Node matrix remains `^22.18.0 || >=24.11.0`.
Babel transforms are now aligned on Babel 7; the Node floor has not been
reduced without a separate verification run. This tooling policy is not a
browser runtime requirement for package consumers.

A clean baseline consumer with `skipLibCheck: false` currently fails inside
TanStack core 1.171.26: SSR types index `MakeRouteMatch.__beforeLoadContext`,
which is absent from that type. Consumer checks skip third-party declaration
bodies while checking application imports and usage. This is not evidence that
the full dependency graph passes strict declaration validation.

An isolated pnpm 8.14.1 probe without any engines restriction fails to resolve
`react@catalog:` with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`. This confirms
that the current catalog syntax needs a newer manager, independently of the
root engine field. It does not invalidate successful older-checkout usage or
establish whether pnpm versions between 8.14.1 and 10.26.0 can install and build this workspace.

## Latest snapshot verified on 2026-09-06

The full check passed in an independent temporary copy on Node 24.14.0 /
pnpm 10.26.0: 121 tests, lint, formatting, types, package and example builds.
The working catalog was kept at its existing baseline.

| Package                       | Verified latest |
| ----------------------------- | --------------- |
| @tanstack/react-router        | 1.170.32        |
| @tanstack/router-core         | 1.171.27        |
| @tanstack/solid-router        | 1.170.30        |
| @tanstack/vue-router          | 1.170.29        |
| @tanstack/router-plugin       | 1.168.35        |
| @tanstack/router-generator    | 1.167.33        |
| @tanstack/virtual-file-routes | 1.162.0         |

The newly configured GitHub Actions matrix has not yet run remotely. Local
verification is not a claim about the status of an unpublished CI run.

## Build dependency alignment — 2026-09-06

Babel 7.29.7 and Vue JSX plugin 2.0.1 are used consistently. The Solid runtime
and preset are aligned at 1.9.15 to satisfy the Rsbuild plugin's transitive
requirements. `pnpm peers check` reports no peer conflicts, and the full
baseline check passes with 121 tests. Installations in CI and release workflows
now enforce peer requirements. Earlier baseline/latest observations using
Solid 1.9.10 remain historical evidence; they are not a separate verification
of this new compiler/runtime combination against every upstream version.
