// Package root: framework-neutral surface only.
//
// The mount components, the adapter and `createRemoteRoute` are bound to a
// framework, so they live behind an explicit entry point:
// `tanstack-router-remote/react` (and `/solid`, `/vue` as they land). Importing
// the root gives you the contracts shared by all of them.

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
