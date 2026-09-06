# React SSR with explicit preparation

This is a runnable Node server and browser client. It creates fresh host and
remote route objects per request, prepares them before the first match, and
hydrates a separately created client tree from TanStack's serialized data.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:packages
corepack pnpm --filter @tanstack-router-remote/example-ssr build
corepack pnpm --filter @tanstack-router-remote/example-ssr preview
# http://localhost:3600/orders/42
```

The [server](app/src/server.tsx) runs `prepare → router.load → dehydrate →
renderRouterToString`. It includes the actual generated client script entries
and TanStack's `Scripts` payload. The [client](app/src/client.tsx) runs
`prepare → hydrate(router) → hydrateRoot`, without a second initial route load.
The [shared factory](app/src/app.tsx) creates every mutable tree inside the call.
Never replace it with a process-global tree shared by requests.

On 2026-09-05, the production bundle was opened in the Codex in-app browser at
`/orders/42`. It showed “Client hydrated”; the counter changed from 0 to 1;
a link navigated to `/orders/77` while keeping the counter at 1. The existing
SSR integration suite additionally verifies server HTML and that hydration does
not rerun dehydrated loaders.

This intentionally small example uses a local tree factory. Production remote
transport, asset manifests, CSP/nonces, request context and error status policy
must be designed for the deployment. The static server is a local demonstration,
not production hosting middleware. Deferred/streaming loaders, TanStack Start
and its default request handler are not verified by this example. For nested
SSR remotes, prepare required ancestors and descendants before matching.
