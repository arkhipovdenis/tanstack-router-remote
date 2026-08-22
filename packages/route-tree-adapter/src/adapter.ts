// Framework-neutral entry point: `tanstack-router-remote/adapter`.
//
// The attachment engine itself: it grafts a remote route tree into a host
// router, serializes and batches the mutations, and publishes mount state. It
// imports no framework package — it works on `@tanstack/router-core` objects.
//
// Constructing it directly requires a `FrameworkBinding`, which supplies the
// three operations that cannot be neutral (creating routes, projecting the
// remote root, wiring the structural not-found boundary). Hosts normally use a
// framework entry instead — `tanstack-router-remote/react` exports a
// `RemoteRouterAdapter` that supplies its own binding.
//
// Reach for this entry to implement a new framework binding, or to drive
// attachment from code that must not depend on a UI framework.

export { RemoteRouterAdapter } from './core/adapter.js'
export type { FrameworkBinding } from './core/framework.js'
export type {
  AnyNotFoundComponent,
  AttachRemoteRouteTreeOptions,
  RemoteRouteTreeLoader,
  RouteTreeAttachment,
  RouteTreeAttachmentController,
  RouteTreeAttachmentSource,
  RouteTreePreparationController,
  RouterGetter,
} from './core/types.js'
