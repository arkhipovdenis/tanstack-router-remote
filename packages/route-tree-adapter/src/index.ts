// Package root: the extension point, for implementing a framework binding.
//
// Applications do not import this. They import the entry for their framework —
// `tanstack-router-remote/react`, `/solid` or `/vue` — which supplies the
// binding, adds the mount component, and re-exports the attachment types.
//
// Reach for this one to support a framework that has no entry yet. Implement
// `FrameworkBinding` (three operations: create a root route, project the remote
// root onto a bridge, wire the structural not-found boundary), then hand it to
// `RemoteRouterAdapter` alongside the host router getter. Everything else —
// grafting, batching, rollback, path rebasing — is already framework-neutral
// and needs no per-framework code.
//
// See `src/react/internal/binding.ts` for the smallest complete example.

export { RemoteRouterAdapter } from './core/adapter.js'
export type { FrameworkBinding } from './core/framework.js'
export type { AnyNotFoundComponent, RouterGetter } from './core/types.js'
