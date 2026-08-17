# Native ESM import example

This example uses the route-tree adapter without Module Federation. The remote
is a regular TypeScript-built ESM workspace package; the host imports its
published subpath at runtime:

```ts
await import('@tanstack-router-remote/example-native-import-remote/routeTree')
```

There is no federation plugin, manifest, remote container, or relative source
import in either package.

## Scope of this transport example

Rsbuild resolves this package during the host build and preserves the native
`import()` as a lazy split point. Thus this lab proves that the adapter does
not require a Module Federation runtime, while still using a separately built
and versionable ESM package. It does not claim to model an independently
deployed HTTP ESM module or an import-map registry. Those transports only need
to implement the same `loadRouteTree(): Promise<{ routeTree }>` boundary.

## Packages

| Workspace | Role | Build/runtime |
| --- | --- | --- |
| `@tanstack-router-remote/example-native-import-remote` | Plain remote package exposing `./routeTree` | `tsc` → `dist/routeTree.js` + declarations |
| `@tanstack-router-remote/example-native-import-host` | Browser host | Rsbuild on port `3200` |

Run the native-import lab independently from the repository root:

```bash
npm run dev:example:native-import
```

The command builds the adapter and remote package before it starts the host.
For production artifacts, use:

```bash
npm run preview:example:native-import
```

Open [http://localhost:3200/native/](http://localhost:3200/native/), then use
the catalog link. A direct initial navigation also works:

```text
http://localhost:3200/native/catalog/SKU-42?tab=history
```

An unmatched remote deep link stays in the remote after its tree attaches:

```text
http://localhost:3200/native/catalog/no/such/path
```

For live remote-package rebuilds during host development, use a second
terminal:

```bash
npm run dev --workspace=@tanstack-router-remote/example-native-import-remote
```

## What the UI demonstrates

`/native/catalog` mounts a static, initially childless host route. While the
native `import()` resolves, the mount's own component displays the loading
state; if import or attachment fails, it displays the error state. The adapter
then grafts the package's generated `routeTree` and asks the same host router
to rematch the current URL.

The imported tree visibly contains:

- its original root component, including `beforeLoad → loader` context and
  local React state;
- an actual pathless layout with its own state and loader;
- index search validation and independent native loader cache keys;
- a `/$productId` route with `params.parse` validation/normalization,
  validated search, local state, and parameter/search-based loader cache keys.
- a remote-root structural 404. The native fuzzy 404 remains on the mount,
  while the adapter renders the remote boundary without adding a catch-all
  route that could shadow deeper paths.

Every remote `Link` is a normal TanStack Router link. The adapter scopes it
below `/native/catalog`, so a remote `Link to="/"` navigates to the remote
index rather than the host home page.
