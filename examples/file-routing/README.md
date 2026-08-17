# File-based routing example

A runnable host that uses the official TanStack Router generator and the same
native-ESM `Catalog` remote as the other examples. It shows how a static
`/catalog` mount is declared before `createRouter()` receives the generated
`routeTree`.

| Command | URL |
| --- | --- |
| `npm run dev:example:file-routing` | [localhost:3210/file-routing/](http://localhost:3210/file-routing/) |

For production artifacts use `npm run preview:example:file-routing`. The example
shares the existing native remote package, which its start command builds first;
it does not require Module Federation.

## How the mount is declared

`createRemoteRoute` wraps the generated file route, so the decoration *is* the
exported value:

```tsx
// catalog.remote.tsx
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
and is satisfied by it, so the wrapper needs no build-time transform. Verified
against the generator: it emits `/catalog` into `routeTree.gen.ts` and leaves
this source file untouched.

## Setup

The workspace uses:

- `@tanstack/router-plugin/rspack` to generate `src/routeTree.gen.ts` from
  `src/routes/`;
- `routeToken: /(?:route|remote)/`, so `catalog.remote.tsx` produces
  `/catalog`, rather than `/catalog/remote`;
- `RemoteRouteMount`, the adapter provider, a basepath, and a native
  `import()` loader;
- the generated remote tree: remote root + pathless layout + index/search +
  parameterized product detail + loaders and native cache.

Try a direct deep link:

```text
http://localhost:3210/file-routing/catalog/SKU-42?tab=history
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
