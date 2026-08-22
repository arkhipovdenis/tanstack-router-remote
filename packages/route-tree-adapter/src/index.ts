// Package root: the shared contracts, and nothing that binds a framework.
//
// Two entry points sit below it:
//   `tanstack-router-remote/adapter` — the framework-neutral attachment engine
//   `tanstack-router-remote/react`   — the React adapter, provider and mount
//                                      (`/solid` and `/vue` as they land)

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
export type { FrameworkBinding } from './core/framework.js'
