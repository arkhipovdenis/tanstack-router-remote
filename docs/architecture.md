# Package structure

This is a small integration library, so its source is organized by public API
and framework boundary—not by an application-layer template.

```text
src/
  index.ts             public exports only
  types.ts             public transport and attachment contracts
  adapter.ts           public lifecycle coordinator
  create-remote-route.ts code-route factory and file-route enhancer
  react.tsx            host adapter provider, mount component, and hooks
  internal/
    prepare-mount.ts   childless-mount invariant
    attachment-store.ts observable immutable snapshots
    batching-task-queue.ts serialized, batch-collapsing route-tree mutations
    attach-remote-route-tree.ts TanStack attach/update/rematch transaction
    route-tree.ts      mutable tree grafting and host-root replacement
    remote-root.tsx    remote-root bridge
    scoped-router.tsx  mount-aware navigation facade
    ownership.ts       mutable route-tree ownership guard
```

## Public surface

`types.ts`, `adapter.ts`, `create-remote-route.ts`, and `react.tsx` make up the
supported public surface and are re-exported from `index.ts`. It stays `0.x`
because attachment is not yet an official TanStack Router API — an API-evolution
risk, not a limit on the production scope documented in the README.

- `RouteTreeUpdateAdapter` coordinates attachment lifecycle and idempotency.
  It accepts a lazy `getRouter()` callback, pinned on the first attachment
  after the remote tree resolves.
- `RouteTreeAttachmentSource` exposes only snapshots and subscriptions, while
  `RouteTreeAttachmentController` additionally permits `attach()`. React
  rendering consumes the narrower source contract.
- `RouteTreeUpdateAdapterProvider` is the host-level ownership boundary. It
  receives one pre-created adapter and makes it available to every mount via
  React context.
- `createRemoteRoute` declares the static, initially childless host mount and
  has two overloads. Given TanStack `createRoute` options it mirrors that
  signature and its inferred route type; given an existing route instance it
  returns the same instance, prepared in place, with its type unchanged. The
  second form is what a file route wraps:
  `createRemoteRoute(createFileRoute('/catalog')({ ... }))`.
- `RemoteRouteMount` and its hooks are optional React bindings. The
  imperative adapter remains usable without them.

Create one adapter per host router outside React render, then place
`RouteTreeUpdateAdapterProvider` above that host's `RouterProvider`. The
context remains unchanged through nested TanStack `RouterContextProvider`s, so
scoped navigation facades never create a second route-tree mutation queue.

## Internal implementation

`internal/` contains the TanStack Router-specific workaround and its focused
runtime collaborators: observable attachment state, mutation serialization,
the attach/update/rematch transaction, mutable route-tree operations, the
pathless root bridge, navigation scoping, and the single-mount ownership
check. These modules are deliberately not package exports, so consumers do not
depend on implementation details that may change with TanStack Router.

`BatchingTaskQueue` owns the scheduling half of that serialization. Mounts that
attach concurrently are collected into one run, so the expensive shared steps —
`cloneHostRootForUpdate()`, `router.update()`, `router.load()` — are paid once
per batch rather than once per mount. The transaction reports one result per
member, which is what keeps a single broken remote from failing the mounts
beside it. `attach()` and `prepare()` use separate queues: a preparation must
never be pulled into the client `router.load()` that an attachment owns.

The package has no Module Federation dependency. `loadRouteTree` is supplied by
the host, keeping Module Federation, native ESM `import()`, import maps, and
registry clients at the consumer boundary. Three runnable example families
exercise the same adapter contract: Module Federation, a plain built workspace
package loaded with native `import()`, and TanStack file routing in both its
physical and virtual generator modes.

Keep future code near the boundary it serves. Add a shared module only when a
real reuse case appears, and do not add subpath exports without a consumer need.
