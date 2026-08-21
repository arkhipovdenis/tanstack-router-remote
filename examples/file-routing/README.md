# File-based routing examples

Two runnable hosts using the official TanStack Router generator and the same
native-ESM `Catalog` remote as the other examples. They show how a static
`/catalog` mount is declared before `createRouter()` receives the generated
`routeTree`, in each of the generator's two modes.

| Example  | Command                                      | URL                                                                                 | Route paths come from         |
| -------- | -------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| Physical | `pnpm run dev:example:file-routing:physical` | [localhost:3210/file-routing/](http://localhost:3210/file-routing/)                 | filenames under `src/routes/` |
| Virtual  | `pnpm run dev:example:file-routing:virtual`  | [localhost:3211/file-routing-virtual/](http://localhost:3211/file-routing-virtual/) | `src/routes.ts`               |

Run both together with `pnpm run dev:example:file-routing`. For production
artifacts use `pnpm run preview:example:file-routing`. Both share the existing
native remote package, which their start commands build first; neither requires
Module Federation.

## How the mount is declared

Identical in both modes — `createRemoteRoute` wraps the generated file route, so
the decoration _is_ the exported value:

```tsx
export const Route = createRemoteRoute(
  createFileRoute('/catalog')({
    component: CatalogMount,
  }),
)
```

This form matters beyond style. A mount that is never passed to
`createRemoteRoute` still serves `/catalog`, but a direct deep link to
`/catalog/SKU-42` silently fails — the mount has no children to fuzzy-match
into, so nothing triggers the attach. Wrapping the declaration makes that state
unrepresentable: there is no exported `Route` that skipped the call.

The TanStack generator reads the inner `createFileRoute('/catalog')({...})` call
and is satisfied by it, so the wrapper needs no build-time transform. Covered by
[`tests/unit/virtual-file-routes.test.ts`](../../tests/unit/virtual-file-routes.test.ts),
which runs the real generator in both modes.

### Trade-off: no path auto-correction

In physical routing the generator rewrites a route file whose
`createFileRoute()` path disagrees with its location — but only when that call
is the direct export initializer. Wrapped, the file is left alone, so a wrong
path stays wrong instead of being silently fixed:

```tsx
// physical routing, routes/catalog.tsx
export const Route = createFileRoute('/WRONG')({ ... })          // → rewritten to '/catalog'
export const Route = createRemoteRoute(createFileRoute('/WRONG')({ ... }))  // → left as '/WRONG'
```

Asserted in the same test file. It costs a convenience that only ever applied to
mismatched paths; in the virtual mode below the generator never derives paths
from filenames anyway.

## Physical mode

`examples/file-routing/app`, served at `/file-routing`. Filenames decide URLs:
`routes/catalog.remote.tsx` produces `/catalog` because `routeToken:
/(?:route|remote)/` is configured, so the `.remote` segment is not treated as a
path segment.

## Virtual mode

`examples/file-routing/virtual`, served at `/file-routing-virtual`. Every URL is
declared in `src/routes.ts`; filenames carry no path meaning at all:

```ts
export const routes = rootRoute('__root.tsx', [
  index('home.tsx'),
  layout('shell.tsx', [route('/catalog', 'catalog-mount.tsx')]),
])
```

The mount file is called `catalog-mount.tsx` and lives nowhere near a `/catalog`
directory — the config decides it serves `/catalog`. It also sits below a
pathless `shell.tsx` layout, so the generated tree contains `/_shell` and
`/_shell/catalog` while the visible URL stays `/catalog`. That is the case worth
checking here: a direct deep link resolves through the extra layout match before
reaching the mount, and the fuzzy-404 handoff still starts the attach.

Note the argument the mount passes to `createFileRoute`:

```tsx
// routes/catalog-mount.tsx — the id, not the URL
export const Route = createRemoteRoute(
  createFileRoute('/_shell/catalog')({ component: CatalogMount }),
)
```

Under a layout, the generated route **id** carries the layout segment even
though `path` and `fullPath` stay `/catalog`. `createFileRoute` is keyed by that
id, so passing `'/catalog'` here is a type error. This is ordinary TanStack
behavior, unrelated to the remote mount, but it is easy to trip over when moving
a mount under a layout.

`virtualRouteConfig: './src/routes.ts'` replaces `routeToken` in the plugin
options; nothing else about the host or the mount changes.

## Setup

Both workspaces use:

- `@tanstack/router-plugin/rspack` to generate `src/routeTree.gen.ts` from
  `src/routes/`;
- `RemoteRouteMount`, the adapter provider, a basepath, and a native
  `import()` loader;
- the generated remote tree: remote root + pathless layout + index/search +
  parameterized product detail + loaders and native cache.

Try a direct deep link in either host:

```text
http://localhost:3210/file-routing/catalog/SKU-42?tab=history
http://localhost:3211/file-routing-virtual/catalog/SKU-42?tab=history
```

The page first renders the mount route's loading boundary, then attaches the
remote and rematches the same URL. Once attached, use the remote controls to
inspect its root/layout React state, route params/search and native loader
cache exactly as in the native-import example.

`routeTree.gen.ts` is generated output. Do not edit it manually.

## HMR boundary

The official plugin can handle ordinary file-route generation and HMR. This
bridge has not yet researched a controlled remote-tree replacement or
route-level HMR lifecycle after attachment, so those capabilities retain `?`
status rather than being claimed as supported. For a predictable lab run,
reload the host page after changing an already attached remote mount.
