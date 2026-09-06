# Navigation and types

Inside a remote component, native `Link`, `useNavigate`, `router.navigate`,
`buildLocation`, `preloadRoute` and `matchRoute` use a scoped facade over the
host router. History, stores and cache remain the host's. The host owns browser
`basepath`; never prepend it yourself.

## Local paths that resemble the mount

The legacy shorthand accepts both local and already-prefixed paths. Those are
ambiguous when a remote mounted at `/orders` itself defines `/orders/history`.
Use the explicit resolver to say that a path is local:

```tsx
import { useRouter, Link } from '@tanstack/react-router'
import { resolveRemotePath } from 'tanstack-router-remote/react'

function HistoryLink() {
  const router = useRouter()
  return <Link to={resolveRemotePath(router, '/orders/history')}>History</Link>
}
```

This resolves to `/orders/orders/history`; host basepath `/platform` is added
by TanStack when creating the browser URL. It also composes nested scopes.
Outside a remote scope, the resolver leaves a root-relative host path alone.
Pass `search` and `hash` as navigation options, not embedded in the path.
Relative paths, URLs and protocol-relative URLs are rejected by this helper.
Existing relative and route-bound navigation continues through TanStack;
`resolveRemotePath` is only for explicit root-relative remote paths.

For a deliberate jump outside the remote, pass a callback from the host that
uses the original host router. Do not try to escape a scope by counting `../`.

## Compile-time boundaries

`Register` describes the router visible to one compilation. Loading a tree at
runtime cannot add remote paths to the host's TypeScript union. Compile each
remote against its own routes and keep dynamic cross-remote destinations behind
a small host navigation API. The resolved helper returns `string`, so a strictly
registered host may require a local, deliberate type boundary for dynamic links;
it does not validate that a destination actually exists.

Route-bound hooks for remote descendants retain their route identity after
grafting. The remote `__root__` is projected onto a new pathless bridge and does
not become the host `__root__`. Do not use `remoteRoot.useLoaderData()` expecting
that identity; read the active bridge match with an appropriately typed loose
hook, as the runnable examples demonstrate.

A lifecycle `redirect({ to: '/' })` is processed by the host router, not by the
component facade. Its destination is not automatically rebased. Produce host
paths explicitly when redirecting from `beforeLoad` or a loader.
