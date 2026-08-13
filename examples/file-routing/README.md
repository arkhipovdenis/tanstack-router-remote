# File-based routing examples

These are two independent, runnable hosts using the official TanStack Router
generator and the same native-ESM `Catalog` remote. They differ only in how
the static `/catalog` mount is marked before `createRouter()` receives the
generated `routeTree`.

| Example | Command | URL | Decoration in `catalog.remote.tsx` |
| --- | --- | --- | --- |
| Manual | `npm run dev:example:file-routing:manual` | [localhost:3210/file-manual/](http://localhost:3210/file-manual/) | Explicit `createRemoteRoute(Route)` after the normal file-route declaration. |
| Companion plugin | `npm run dev:example:file-routing:plugin` | [localhost:3211/file-plugin/](http://localhost:3211/file-plugin/) | No source-level call; `tanstackRouterRemoteAdapter()` injects it during compilation. |

Run both together with:

```bash
npm run dev:example:file-routing
```

For production artifacts use `npm run preview:example:file-routing`. Each
example shares the existing native remote package, which its start command
builds first; neither requires Module Federation.

## What is deliberately identical

Both workspaces use:

- `@tanstack/router-plugin/rspack` to generate `src/routeTree.gen.ts` from
  `src/routes/`;
- `routeToken: /(?:route|remote)/`, so `catalog.remote.tsx` produces
  `/catalog`, rather than `/catalog/remote`;
- the same `RemoteRouteMount`, local `notFoundComponent`, adapter provider,
  basepath, and native `import()` loader;
- the same actual generated remote tree: remote root + pathless layout +
  index/search + parameterized product detail + loaders and native cache.

Try a direct deep link in each host:

```text
http://localhost:3210/file-manual/catalog/SKU-42?tab=history
http://localhost:3211/file-plugin/catalog/SKU-42?tab=history
```

The page first renders the mount route's local loading boundary, then attaches
the remote and rematches the same URL. Once attached, use the remote controls
to inspect its root/layout React state, route params/search and native loader
cache exactly as in the native-import example.

## Source-level difference

Manual mode is the no-plugin baseline:

```tsx
// catalog.remote.tsx
export const Route = createFileRoute('/catalog')({
  component: CatalogMount,
  notFoundComponent: CatalogMount,
})

createRemoteRoute(Route)
```

Plugin mode contains only the generator-supported declaration:

```tsx
export const Route = createFileRoute('/catalog')({
  component: CatalogMount,
  notFoundComponent: CatalogMount,
})
```

Its Rsbuild configuration runs the official TanStack plugin first and then
`tanstackRouterRemoteAdapter()`. The companion transform appends
`createRemoteRoute(Route)` after the declaration in the compiled module; it
does not wrap the exported initializer. Therefore TanStack still sees the
normal `createFileRoute(...)({...})` form when generating the tree.

`routeTree.gen.ts` is generated output. Do not edit it manually.

## HMR boundary

The official plugin can handle ordinary file-route generation and HMR. This
bridge has not yet researched a controlled remote-tree replacement or
route-level HMR lifecycle after attachment, so those capabilities retain `?`
status rather than being claimed as supported. For a predictable lab run,
reload the host page after changing an already attached remote mount.
