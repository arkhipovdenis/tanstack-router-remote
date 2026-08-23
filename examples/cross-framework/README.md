# Cross-framework example

A **React** host whose route tree is extended at runtime by a **Solid** remote
and a **Vue** remote — all in one router, one history and one route cache.

```bash
pnpm run dev:example:cross-framework   # http://localhost:3500/cross/
```

| URL                 | What it shows                                        |
| ------------------- | ---------------------------------------------------- |
| `/cross/`           | Host home, no remote loaded                          |
| `/cross/solid`      | Solid tree grafted into the React router             |
| `/cross/solid/sr-2` | Deep link into a nested Solid route with loader data |
| `/cross/vue`        | Vue tree grafted into the same router                |
| `/cross/vue/vr-1`   | Deep link into a nested Vue route with loader data   |

## What this proves, and what it costs

Grafting is genuinely framework-neutral. The adapter works on
`@tanstack/router-core` objects, so a Solid or Vue tree lands in the React
host's `routesById` like any other — `/vue/__remote-root-bridge/$itemId` is a
real match in the React router, with its params parsed and its loader run.

**Rendering is not neutral**, and the example carries the interop itself:

1. **Islands.** React cannot render a Solid component (it returns DOM nodes) or
   a Vue one (it returns VNodes). `islands.tsx` is a React component that owns
   an empty element and hands it to the other framework's own renderer.

2. **Data crosses as a prop.** An island mounts a separate application, and
   React context does not reach into it — so the remote's components cannot
   call `useLoaderData()`. The host reads the nearest match, where the context
   does exist, and passes the data across. Note this is read _from_ context;
   the prop is only the vehicle across the boundary.

3. **React owns the nesting.** `Outlet` inside an island does not work: it
   reads a match context that stops at the boundary. Each route renders its own
   island plus the host's `Outlet`, so a child mounts as a sibling island.

4. **Separate build workspaces are required, not a stylistic choice.** One
   bundle cannot compile React JSX and Solid JSX at once — whichever plugin is
   configured wins, and the other framework's components come out calling a
   runtime that cannot render them. Each remote is its own workspace built with
   its own transform.

The remotes here take route data as a `data` prop for reason 2. That is the one
concession the cross-framework case asks of a remote; a same-framework remote
(see `examples/solid`, `examples/vue`) uses `useLoaderData()` normally.
