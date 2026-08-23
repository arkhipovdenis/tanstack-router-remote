# Package structure

This is a small integration library, so its source is organized by public API
and framework boundary—not by an application-layer template.

```text
src/
  index.ts             the extension point: bare adapter + FrameworkBinding
  core/                no framework import anywhere below this line
    types.ts           public transport and attachment contracts
    framework.ts       the seam a framework entry point implements
    adapter.ts         lifecycle coordinator
    internal/
      prepare-mount.ts   childless-mount invariant
      attachment-store.ts observable immutable snapshots
      batching-task-queue.ts serialized, batch-collapsing route-tree mutations
      attach-remote-route-tree.ts TanStack attach/update/rematch transaction
      route-tree.ts      mutable tree grafting and host-root replacement
      ownership.ts       mutable route-tree ownership guard
  react/               entry point: `tanstack-router-remote/react`
    index.ts           public exports for React
    adapter.ts         core adapter pre-bound to the React binding
    create-remote-route.ts code-route factory and file-route enhancer
    components.tsx     adapter provider, mount component, and hooks
    internal/
      binding.ts       the three React-bound operations
      remote-root.tsx  remote-root bridge
      scoped-router.tsx mount-aware navigation facade
  solid/               entry point: `tanstack-router-remote/solid`
  vue/                 entry point: `tanstack-router-remote/vue`
```

`solid/` and `vue/` mirror `react/` file for file. Only the framework-bound
parts differ: the binding, the remote-root bridge, the scoped-router wrapper
and the components. Nothing about grafting is duplicated.

## Framework boundary

`core/` operates on `@tanstack/router-core` objects and imports no framework
package. Everything it does to a route tree — reparenting children, cloning the
host root, undoing a failed graft — is identical across React, Solid and Vue.

Three operations cannot be neutral, because they create routes or render
components: `createRootRoute`, building the remote-root bridge, and wiring the
structural not-found boundary. `core/framework.ts` declares them as
`FrameworkBinding`; each entry point supplies one. That is why adding Solid or
Vue means writing those three plus the components, not another copy of the
attachment logic.

## Public surface

Each framework entry point exports four names: `RemoteRouterAdapter`,
`RemoteRouterProvider`, `RemoteRouteMount` and `createRemoteRoute`, plus the
attachment types. The root exports only what a new binding needs — the bare
adapter, whose constructor takes a `FrameworkBinding`, and that type. These
names follow semver; what does not is the ground under them, since attachment
is not an official TanStack Router API. That is an upstream-compatibility
risk, not a limit on the production scope documented in the README.

- `RemoteRouterAdapter` coordinates attachment lifecycle and idempotency.
  It accepts a lazy `getRouter()` callback, pinned on the first attachment
  after the remote tree resolves.
- `RouteTreeAttachmentSource` exposes only snapshots and subscriptions, while
  `RouteTreeAttachmentController` additionally permits `attach()`. React
  rendering consumes the narrower source contract.
- `RemoteRouterProvider` is the host-level ownership boundary. It receives one
  pre-created adapter and makes it available to every mount through the
  framework's own context mechanism — React context, Solid context, Vue
  provide/inject. That transport matters for nested remotes: a remote's own
  mount is rendered by the router as a route `component`, so it cannot be
  handed the adapter as a prop.
- `createRemoteRoute` declares the static, initially childless host mount and
  has two overloads. Given TanStack `createRoute` options it mirrors that
  signature and its inferred route type; given an existing route instance it
  returns the same instance, prepared in place, with its type unchanged. The
  second form is what a file route wraps:
  `createRemoteRoute(createFileRoute('/catalog')({ ... }))`.
- `RemoteRouteMount` is the rendering half and is optional; the imperative
  adapter remains usable without it. In Vue its `loading` and `error` are
  slots rather than props, which is the idiomatic shape there.

Create one adapter per host router outside render, then place
`RemoteRouterProvider` above that host's `RouterProvider`. The context remains
unchanged through nested TanStack `RouterContextProvider`s, so scoped
navigation facades never create a second route-tree mutation queue.

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
