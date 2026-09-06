# Module Federation transport

Start from the [native-import quick start](../README.md). Replace only the
loader; federation must already be configured by the host's bundler/runtime:

```ts
import { loadRemote } from '@module-federation/runtime'
import type { AnyRoute } from '@tanstack/react-router'

const loadRouteTree = async () => {
  const module = await loadRemote<{ routeTree: AnyRoute }>('orders/routeTree')
  if (!module?.routeTree) throw new Error('orders did not expose routeTree')
  return module.routeTree
}
```

Native ESM follows the same contract:
`async () => (await import('your-remote-package')).routeTree`.
Neither loader returns the module namespace itself.

Expose `./routeTree` from Orders and register its remote entry as `orders` in the
host. Share a single compatible renderer, router and adapter runtime on both
sides, including subpaths. The runnable React example configures:

```ts
const shared = {
  react: { singleton: true, requiredVersion: false },
  'react/': { singleton: true, requiredVersion: false },
  'react-dom': { singleton: true, requiredVersion: false },
  'react-dom/': { singleton: true, requiredVersion: false },
  '@tanstack/react-router': { singleton: true, requiredVersion: false },
  '@tanstack/router-core': { singleton: true, requiredVersion: false },
  'tanstack-router-remote': { singleton: true, requiredVersion: false },
  'tanstack-router-remote/': { singleton: true, requiredVersion: false },
}
```

`requiredVersion: false` is a demo configuration with coordinated pinned builds;
it disables version negotiation checks and is not a promise of compatibility.
Choose and test a deployment version policy before using independent releases.
Subpath sharing matters because consumers import `/react` and frameworks may
import JSX or SSR entry points.

A nested remote declares its own childless mount and uses RemoteRouteMount under
the inherited adapter provider. It exports a tree and never mounts a second
RouterProvider. See the complete host, Orders and Invoices configs in
[the example](../examples/module-federation).
