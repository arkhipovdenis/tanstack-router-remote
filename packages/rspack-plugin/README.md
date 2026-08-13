# TanStack Router Remote Adapter for Rspack

`tanstackRouterRemoteAdapter()` decorates `*.remote.tsx` file routes after TanStack
Router's generator has read their ordinary `createFileRoute` declaration.

It complements, rather than replaces, the normal
[`tanstackRouter` Rspack/Rsbuild setup](https://tanstack.com/router/latest/docs/installation/with-rspack).
Install that TanStack plugin for file-route generation and add this plugin to
the same `tools.rspack.plugins` array:

```ts
import { tanstackRouter } from '@tanstack/router-plugin/rspack'
import { tanstackRouterRemoteAdapter } from '@tanstack-router-remote/rspack-plugin'

export default defineConfig({
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({ target: 'react' }),
        tanstackRouterRemoteAdapter(),
      ],
    },
  },
})
```

For a remote file route such as `orders.remote.tsx`, the source stays
generator-compatible:

```tsx
export const Route = createFileRoute('/orders')({
  component: OrdersMount,
  notFoundComponent: OrdersMount,
})
```

The pre-loader adds a private alias import of `createRemoteRoute` and then calls it
with that same `Route` instance. The generated route tree continues to import
the original file export; no wrapper changes the exported initializer.

The plugin is optional. Without it, put `createRemoteRoute(Route)` directly
after the same declaration. The repository includes runnable [manual and
plugin file-route examples](../../examples/file-routing/README.md) using the
official TanStack generator and one shared ESM remote.

The plugin only decorates file routes; it does not change the adapter's
separate SSR/hydration bootstrap requirements. A `*.remote.tsx` suffix is a
plugin convention, not TanStack Router metadata: verify its generated URL in
your project's file-route naming configuration. The transform intentionally
supports only the direct `export const Route = createFileRoute(...)(...)`
shape. It does not preserve source maps in this first version.
