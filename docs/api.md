# Public API and failure handling

Import the binding for your renderer: `tanstack-router-remote/react`, `/solid`
or `/vue`. The package root exposes the framework extension interfaces, not a
renderer selected automatically at runtime.

| API                                                                     | Contract                                                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createRemoteRoute(optionsOrRoute)`                                     | Creates/prepares a static childless mount before router construction. Accepts an existing code/file route. Uses a bootstrap not-found boundary for deep links.       |
| `new RemoteRouterAdapter(() => router)`                                 | Own one per host router. The getter is resolved after loading and then pinned.                                                                                       |
| `adapter.attach({ mountRoute, loadRouteTree, preserveMountChildren? })` | Returns `Promise<void>` after graft, reindex and host load. Loader returns the tree itself, not an ES module.                                                        |
| `adapter.prepare(options)`                                              | Grafts and reindexes without loading routes. Only for controlled SSR/hydration bootstrap.                                                                            |
| `adapter.getSnapshot(mountRoute)`                                       | Stable snapshot with `state`; an error snapshot also contains `error`.                                                                                               |
| `adapter.subscribe(listener)`                                           | Receives state changes; returns an unsubscribe function. Read each tracked mount's snapshot.                                                                         |
| `RemoteRouterProvider`                                                  | Supplies the same adapter above the framework's RouterProvider.                                                                                                      |
| `RemoteRouteMount`                                                      | Uses that adapter in the mount component. Accepts mountRoute, loadRouteTree, loading, error, children and preserveMountChildren. Framework rendering syntax differs. |
| `resolveRemotePath(router, path)`                                       | Explicit root-relative local path resolution; see [navigation](navigation.md).                                                                                       |

`preserveMountChildren` opts into retaining existing mount children during graft;
it does not relax the requirement that a new `createRemoteRoute` mount starts
childless. Ordinary mounts should omit it.

## State and concurrency

`idle → loading → attached` is normal client attachment. Preparation ends at
`prepared`. A subsequent `attach()` uses the prepared tree and performs the
missing load without loading the remote again. `loading → error` reports failure.

Concurrent calls on one mount share the pending work. `attach` during `prepare`
waits and then loads; `prepare` during `attach` waits for the full attachment.
Repeating a completed operation is a no-op. The first loader/options win while
an operation is in flight. Different mounts load independently: a stuck transport
cannot hold a ready remote's mutation batch. Grafts and host loads remain
serialized, including across mixed prepare/attach operations.

## Retry, timeouts and diagnostics

There is no automatic timeout or retry loop. Define transport cancellation and
a time budget in your loader if needed. Timing out a dynamic import does not
cancel the underlying import; discard its late result instead of grafting it.
Use a fresh tree factory when another mount/request needs a tree.

A failure before host mutation can be retried with another explicit
`adapter.attach(options)`. A failure after mutation poisons that mount: the next
attempt rejects and asks for a host document reload. There is no transactional
rollback. Do not treat every error as safely retryable. The example's recovery
link reloads the document, covering both cases conservatively.

`RemoteRouteMount` displays an error but does not repeatedly retry on every state
change. For custom diagnostics, subscribe and log mount identity, state, elapsed
time and the error at your host boundary. Avoid logging user route params or
search values by default. Unsubscribe when disposing your observer. There is no
built-in telemetry destination or cancellation API.

A remote route loader failure is a separate layer: after successful attachment,
TanStack owns route error/not-found boundaries and native invalidation. Fixing a
transport does not require inventing a second route cache.
