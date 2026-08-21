# Runtime evidence matrix

The adapter changes a mutable TanStack Router route tree, so its useful
contract must be demonstrated at runtime—not inferred from the generated
route objects alone. The suite has two complementary levels of evidence.

The same suite has been run successfully against TanStack Router `1.168.18`
and the current repository baseline `1.170.18`. The published adapter peer
range is `>=1.168.18`; the repository intentionally keeps one reproducible
baseline instead of a permanent CI job for every TanStack patch release.

## Deterministic router runtime

[`tests/unit/remote-route-runtime.test.ts`](../tests/unit/remote-route-runtime.test.ts)
uses a real memory-history TanStack router and renders the resulting matches.
It proves:

| Area                      | Evidence                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Remote root bridge        | The original remote root component renders; its projected `validateSearch`, `beforeLoad`, loader and returned context run.                                   |
| Index and nested paths    | Remote index, parameterized detail and nested `line-items` components render with the right params and loader data.                                          |
| Root boundaries           | Projected `pendingComponent`, `errorComponent` and `notFoundComponent` options are retained; error and not-found boundaries render after lifecycle failures. |
| Native cache              | Root, index, detail and nested loader entries remain fresh through host-to-remote SPA transitions.                                                           |
| One runtime               | Scoped remote router contexts share the host `history`, `stores`, route tree and route registry.                                                             |
| Host basepath and nesting | Scoped navigation retains host `basepath`; a second route tree can attach inside the first through the same adapter.                                         |

## Browser-like React runtime

[`tests/integration/react-runtime.test.tsx`](../tests/integration/react-runtime.test.tsx)
runs in `jsdom` with `react-dom/client`, real effects, `RouterProvider`,
`RemoteRouteMount`, native TanStack `Link` and a deferred loader.

It proves:

| Area                 | Evidence                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct mount loading | The local mount loading UI appears before the remote tree resolves, then the remote root and index render.                                                                                                          |
| Lifecycles           | Root and child `beforeLoad`, loaders and validated search execute on an attached remote branch.                                                                                                                     |
| State semantics      | Root/layout state persists while descendant matches change. Index/detail state persists for search or parameter updates of the same route and resets when that leaf is unmatched—ordinary React lifecycle behavior. |
| Router identity      | `useRouter()` inside the remote returns a scoped navigation facade, while `history`, `stores` and observable router state are the same host runtime objects.                                                        |
| Cache and navigation | Native `Link`, route-bound `Route.Link` / `Route.useNavigate`, params, search, `useRouterState` and TanStack's own loader cache work without a custom MFE cache.                                                    |
| Boundaries           | A remote pending boundary and the projected remote-root error boundary render in a browser-like runtime.                                                                                                            |

## Server render and hydration

[`tests/integration/ssr-route-tree.test.tsx`](../tests/integration/ssr-route-tree.test.tsx)
uses TanStack Router's public SSR server/client APIs rather than a mock
serializer. It proves:

| Area                    | Evidence                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request-time attachment | A fresh remote tree is prepared before the first server `router.load()`, so the initial root, index and direct detail matches are remote matches.                                        |
| Server response         | `RouterServer`, `Scripts` and `renderRouterToString` render the projected remote root/leaf components and TanStack's real dehydrated match payload; `<Scripts />` stays outside `#root`. |
| Data hydration          | A fresh client tree is prepared before public `hydrate(router)`; remote `beforeLoad` context and loader data are restored without rerunning the initial remote lifecycle or loaders.     |
| React handoff           | `hydrateRoot` accepts the matching app-root markup without a recoverable mismatch; the TanStack `<Scripts />` payload stays outside that root.                                           |

This is non-streaming SSR evidence for a custom request bootstrap with an
async pre-attach step before the first `router.load()`. Deferred/streaming
loaders, TanStack Start/default-handler integration, and the server-side
transport/asset contract for each remote loader remain separate `?` research
items.

## Interactive example

[`examples/module-federation`](../examples/module-federation/README.md) is a
visual counterpart to the tests. It exposes root, pathless, index, detail and
nested routes; loader execution numbers; state persistence/reset semantics;
pending/error/not-found boundaries; and a live comparison of the scoped facade
with the host router's `history`, `stores`, registry and current location.
It also runs an actual `Host → Orders → Invoices` Module Federation chain:
`/platform/orders/invoices/INV-42` attaches the second generated tree inside
the first and visibly proves two composed scopes, one adapter, and one host
router runtime. The [manual scenario guide](../examples/module-federation/SCENARIOS.md)
maps each visible exercise to the automated runtime evidence.

[`examples/native-import`](../examples/native-import/README.md) covers the
same attach contract without Module Federation: the host resolves a plain ESM
workspace package using native `import()`, then attaches its root, pathless,
index and parameterized routes below `/native/catalog`.

[`examples/file-routing`](../examples/file-routing/README.md) adds two actual
TanStack file-route hosts built with `@tanstack/router-plugin`, whose mount is
declared as `createRemoteRoute(createFileRoute('/catalog')({ ... }))`. The
physical host derives `/catalog` from the filename; the virtual host assigns
every path in `src/routes.ts` and mounts the same file — named
`catalog-mount.tsx` — at `/catalog` below a pathless layout. Both attach the
same ESM remote on direct deep links.

[`tests/unit/virtual-file-routes.test.ts`](../tests/unit/virtual-file-routes.test.ts)
runs the real generator over scratch route directories rather than imitating it,
since the claim is a compatibility one. It proves:

| Area                 | Evidence                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Virtual config       | A wrapped mount whose URL comes from `routes.ts`, not its filename, is emitted into the generated tree                                         |
| Virtual layouts      | The same mount composes below a pathless `layout(...)`, keeping its own URL                                                                    |
| Physical config      | The identical wrapped form works with no virtual config, so a regression is attributable to one mode                                           |
| Source integrity     | The generator leaves the wrapped file byte-identical and does not rewrite it                                                                   |
| Documented trade-off | Wrapping opts the file out of the generator's path auto-correction: an unwrapped `'/WRONG'` is rewritten to `'/catalog'`, a wrapped one is not |

## Evidence boundary and research backlog

These tests do not turn the bridge into a general composition API. In
particular, the original remote `__root__` still does not gain host-tree
identity.

Route-level HMR, detach and remote replacement are not covered by this evidence
suite yet. Their status is **not researched**, rather than known unsupported:
each requires its own PoC and regression suite before it can receive either a
supported or a constrained result. See [limitations](limitations.md).
