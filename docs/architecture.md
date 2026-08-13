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
    serial-task-queue.ts serialized route-tree mutations
    attach-remote-route-tree.ts TanStack attach/update/rematch transaction
    route-tree.ts      mutable tree grafting and host-root replacement
    remote-root.tsx    remote-root bridge
    scoped-router.tsx  mount-aware navigation facade
    ownership.ts       mutable route-tree ownership guard
```

## Public surface

`types.ts`, `adapter.ts`, `create-remote-route.ts`, and `react.tsx` make up the
supported alpha surface and are re-exported from `index.ts`.

- `RouteTreeUpdateAdapter` coordinates attachment lifecycle and idempotency.
  It accepts a lazy `getRouter()` callback, pinned on the first attachment
  after the remote tree resolves.
- `RouteTreeAttachmentSource` exposes only snapshots and subscriptions, while
  `RouteTreeAttachmentController` additionally permits `attach()`. React
  rendering consumes the narrower source contract.
- `RouteTreeUpdateAdapterProvider` is the host-level ownership boundary. It
  receives one pre-created adapter and makes it available to every mount via
  React context.
- `createRemoteRoute` has the same signature as TanStack `createRoute` and
  declares the static, initially childless host mount internally. It can also
  enhance a generator-created file-route instance in place.
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

The package has no Module Federation dependency. `loadRouteTree` is supplied by
the host, keeping Module Federation, native ESM `import()`, import maps, and
registry clients at the consumer boundary. The two runnable example families
exercise the same adapter contract with Module Federation and a plain built
workspace package respectively.

Keep future code near the boundary it serves. Add a shared module only when a
real reuse case appears, and do not add subpath exports without a consumer need.
