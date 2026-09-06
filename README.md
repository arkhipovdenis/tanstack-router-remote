# TanStack Router Remote

[![npm](https://img.shields.io/npm/v/tanstack-router-remote.svg)](https://www.npmjs.com/package/tanstack-router-remote)
[![CI](https://github.com/arkhipovdenis/tanstack-router-remote/actions/workflows/ci.yml/badge.svg)](https://github.com/arkhipovdenis/tanstack-router-remote/actions/workflows/ci.yml)
[![types](https://img.shields.io/badge/types-included-blue.svg)](https://www.npmjs.com/package/tanstack-router-remote)
[![license](https://img.shields.io/npm/l/tanstack-router-remote.svg)](LICENSE)

Attach a microfrontend's routes to a TanStack Router host **at runtime** — one
router, one history, one route cache. React, Solid and Vue.

## The problem

TanStack Router builds its route tree when you call `createRouter()`. A
microfrontend host does not have that tree: each remote is deployed separately
and owns routes the host has never seen. The two usual workarounds both cost
something:

- **Load every remote at startup** so the tree is complete before
  `createRouter()`. You pay for remotes nobody visits, and one slow remote
  delays the whole application.
- **Give each remote its own `<RouterProvider>`.** Now two routers listen to one
  history, with separate caches and separate ideas of the current URL. Deep
  links and back/forward stop behaving like one application.

This package takes a third path: the remote exports its **route tree**, not a
router, and the host grafts that tree into the tree it already has — the first
time someone opens a URL under the mount.

```text
user opens /orders/42
  → a static, childless /orders mount catches the unmatched deep link
  → the mount loads the remote's route tree
  → the tree is grafted, then router.update() + router.load()
  → the same router rematches /orders/42 as the remote's detail route
```

Loaders, `validateSearch`, `beforeLoad`, boundaries, the route cache and
`Link`/`useNavigate` need no integration — inside a mounted remote they behave
as they do anywhere else.

**Reach for this when** remotes are deployed independently and own routes the
host cannot know at build time. **Do not** if every route is known in one build
— TanStack's own code splitting is simpler and does the job. Mixing renderers
(a Vue remote in a React host) additionally needs a rendering bridge you write
yourself; picking another package entry does not create one.

## Install and compatibility

```sh
npm install tanstack-router-remote
```

That is all you add: in an app that already renders TanStack Router, every other
peer is present. `@tanstack/router-core` arrives as a dependency of your
router package, and the renderer peers are the ones your app already has.

ESM only. Import from `/react`, `/solid` or `/vue` to match your renderer — the
other renderers' peers are optional and never installed. Use one TanStack
version across host and remotes; do not upgrade them independently. Tested
combinations are in [compatibility](docs/compatibility.md).

## Quick start

Two files, in an existing React/TypeScript app with an `id="root"` element. Host
and remote must use the same dependency versions. This uses a native `import()`
so there is nothing to configure; swap it for a federation call once it works.

**1. The remote exports a route tree** — no router, no provider:

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

**2. The host declares a mount** before `createRouter()`, and provides one
adapter above `RouterProvider`:

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

Open `/orders/42` directly — not `/orders` first. The deep link is the case that
matters: the mount catches it, loads the tree and rematches, all before anything
renders. Your dev server must serve the host HTML for application URLs.

To deploy the remote separately, replace `import('./remote')` with a transport —
`loadRemote('orders/routeTree')` for Module Federation, or anything else that
returns a route tree. The adapter does not care which; see
[Module Federation](docs/module-federation.md).

## Know before you adopt

- **Keep the default fuzzy not-found matching.** That is what lets a childless
  mount catch a deep link below itself and start loading. `notFoundMode: 'root'`
  breaks the mechanism.
- **A tree attaches once, and grafting mutates it.** To mount the same remote
  twice, or to serve SSR requests, export a factory that returns a fresh tree.
  Detaching or replacing an attached tree is not supported.
- **The host owns basepath, history and global router options.** A remote cannot
  set its own.
- **Types do not cross the runtime boundary.** Remote routes are not part of the
  host's compile-time route union, so a host `<Link to="/orders/42">` is not
  typed against them.
- **Navigation inside a remote is scoped, redirects are not.** A `redirect()`
  thrown from remote lifecycle code targets the host router. Where a remote path
  collides with a host one, resolve it explicitly with `resolveRemotePath`.
- **SSR needs `prepare()` before the first match**, not `attach()`. TanStack
  Start and streaming/deferred SSR are untested, not claimed.

One more thing worth knowing up front: this builds on `route.update()` and
`addChildren()`, which are not an official TanStack composition API. The public
API here follows semver, but an upstream release can force the peer range to
narrow in a minor. A scheduled canary job runs the full suite against the newest
published router so that surfaces here rather than in your build.

See [navigation and types](docs/navigation.md), [API and retry](docs/api.md)
and [full limitations](docs/limitations.md).

## Choose a guide or runnable example

| Integration                     | Start here                                                         |
| ------------------------------- | ------------------------------------------------------------------ |
| Module Federation               | [transport and singleton configuration](docs/module-federation.md) |
| React / Solid / Vue             | [framework setup](docs/frameworks.md)                              |
| Physical / virtual file routing | [file routing examples](examples/file-routing/README.md)           |
| Nested remote trees             | [Orders → Invoices example](examples/module-federation/README.md)  |
| Native ESM                      | [complete workspace example](examples/native-import/README.md)     |
| SSR / hydration                 | [runnable server and client](examples/ssr/README.md)               |
| Custom rendering bridge         | [cross-framework example](examples/cross-framework/README.md)      |

The framework entries export the adapter, provider, mount, route helper,
and explicit path resolver. The package root is the
[framework extension point](docs/architecture.md).

## Run the examples

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run dev:example:module-federation
```

Then open <http://localhost:3100/platform/orders> for a host with one federated
remote, or `/platform/orders/invoices/INV-42` for a remote loaded by that remote
— two levels deep, still one router. Host home also has a switch that kills the
remote entry, so you can watch a transport failure stay inside its mount.

Other scripts: `dev:example:native-import`, `dev:example:file-routing`,
`dev:example:solid`, `dev:example:vue`, `dev:example:cross-framework`.
`pnpm run test:e2e` drives these production builds in a real browser.

## Contributing

Repository tooling is pinned to pnpm 11.9.0, also checks pnpm 10.26.0, and requires Node
`^22.18.0 || >=24.11.0`. The supported tooling floor is pnpm 10.26.0;
package consumers are not constrained to pnpm.

```sh
corepack pnpm run check
corepack pnpm run check:consumers
```

[CONTRIBUTING](CONTRIBUTING.md) · [compatibility policy](docs/compatibility.md)

Not affiliated with or endorsed by TanStack.
