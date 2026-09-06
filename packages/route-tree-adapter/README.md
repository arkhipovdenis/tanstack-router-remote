# TanStack Router Remote

Load a remote's route tree when it is needed and attach it to an existing
TanStack Router. The host and its remotes share history, stores and route cache.
Bindings are available for React, Solid and Vue.

Use this when independently delivered remotes own routes unknown to the host at
build time. If all routes are known in one build, start with TanStack's ordinary
code splitting instead. Cross-renderer applications need an explicit rendering
bridge; choosing another package entry does not create one automatically.

## Install and compatibility

```sh
npm install tanstack-router-remote @tanstack/react-router @tanstack/router-core react react-dom
```

ESM only. Choose `/react`, `/solid` or `/vue` to match your renderer. Install only
that renderer's optional peers; core is required. The current tested router
combination and the distinction between accepted and verified versions are in
[compatibility](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/compatibility.md). Do not independently mix TanStack versions
across host and remotes.

## Complete React example with native import

In an existing React/TypeScript app, add these two files and an HTML element with
`id="root"`. Use the same dependency versions for the host and remote.

`remote.tsx` exports the tree itself. It does not create a router or a provider:

```tsx
import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router'

const root = createRootRoute({
  component: () => (
    <>
      <h2>Orders</h2>
      <Outlet />
    </>
  ),
})
const index = createRoute({
  getParentRoute: () => root,
  path: '/',
  component: () => <p>Orders index</p>,
})
const detail = createRoute({
  getParentRoute: () => root,
  path: '/$orderId',
  component: () => <p>Order {detail.useParams().orderId}</p>,
})
export const routeTree = root.addChildren([index, detail])
```

`main.tsx` creates the mount before the router and provides one adapter:

```tsx
import { createRoot } from 'react-dom/client'
import {
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import {
  createRemoteRoute,
  RemoteRouteMount,
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/react'

const root = createRootRoute({
  component: () => (
    <>
      <h1>Host</h1>
      <Outlet />
    </>
  ),
  notFoundComponent: () => <p>Host page not found</p>,
})
const mount = createRemoteRoute({
  getParentRoute: () => root,
  path: '/orders',
  component: OrdersMount,
})
function OrdersMount() {
  return (
    <RemoteRouteMount
      mountRoute={mount}
      loadRouteTree={async () => (await import('./remote')).routeTree}
      loading={<p>Loading orders…</p>}
      error={(error) => <p>Could not load orders: {error.message}</p>}
    >
      <Outlet />
    </RemoteRouteMount>
  )
}
const router = createRouter({ routeTree: root.addChildren([mount]) })
const adapter = new RemoteRouterAdapter(() => router)
const element = document.getElementById('root')
if (!element) throw new Error('Missing #root element')
createRoot(element).render(
  <RemoteRouterProvider adapter={adapter}>
    <RouterProvider router={router} />
  </RemoteRouterProvider>,
)
```

Open `/orders/42` directly. Configure your web server to serve the host HTML for
application URLs. Native import demonstrates the adapter without federation;
independent deployment requires a transport such as Module Federation.

## Constraints to decide on before adoption

- Use default fuzzy not-found matching. A static childless mount catches the
  initial unmatched deep link, loads its tree and rematches it.
- Trees attach once and are mutated. Export a factory for multiple mounts or
  SSR requests. Detach/replacement is not supported.
- The host owns basepath, browser history and global router options.
- Remote component navigation is scoped; lifecycle redirects are not rebased.
  Colliding path prefixes need `resolveRemotePath` explicitly.
- Runtime routes do not extend the host's compile-time route union. The remote
  root is represented by a pathless bridge, not the host root identity.
- SSR requires explicit preparation before matching. TanStack Start and
  streaming/deferred SSR are not established support claims.

See [navigation and types](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/navigation.md), [API and retry](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/api.md)
and [full limitations](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/limitations.md).

## Choose a guide or runnable example

| Integration                     | Start here                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Module Federation               | [transport and singleton configuration](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/module-federation.md) |
| React / Solid / Vue             | [framework setup](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/frameworks.md)                              |
| Physical / virtual file routing | [file routing examples](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/examples/file-routing/README.md)           |
| Nested remote trees             | [Orders → Invoices example](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/examples/module-federation/README.md)  |
| Native ESM                      | [complete workspace example](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/examples/native-import/README.md)     |
| SSR / hydration                 | [runnable server and client](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/examples/ssr/README.md)               |
| Custom rendering bridge         | [cross-framework example](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/examples/cross-framework/README.md)      |

The framework entries export the adapter, provider, mount, route helper,
and explicit path resolver. The package root is the
[framework extension point](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/architecture.md).

## Run the examples

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run dev:example:module-federation
# http://localhost:3100/platform/orders/invoices/INV-42
```

Other scripts: `dev:example:native-import`, `dev:example:file-routing`,
`dev:example:solid`, `dev:example:vue`, `dev:example:cross-framework`.
The federation demo includes an unavailable-remote scenario on Host home.
`pnpm run test:e2e` drives these production builds in a real browser.

## Contributing

Repository tooling is pinned to pnpm 11.9.0, also checks pnpm 10.26.0, and requires Node
`^22.18.0 || >=24.11.0`. The supported tooling floor is pnpm 10.26.0;
package consumers are not constrained to pnpm.

```sh
corepack pnpm run check
corepack pnpm run check:consumers
```

[CONTRIBUTING](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/CONTRIBUTING.md) · [compatibility policy](https://github.com/arkhipovdenis/tanstack-router-remote/blob/main/docs/compatibility.md)

Not affiliated with or endorsed by TanStack.
