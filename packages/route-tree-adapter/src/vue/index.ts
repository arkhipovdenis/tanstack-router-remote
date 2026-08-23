// Framework entry point: `tanstack-router-remote/vue`.

export type {
  AttachRemoteRouteTreeOptions,
  RemoteRouteTreeLoader,
  RouteTreeAttachment,
  RouteTreeAttachmentController,
  RouteTreeAttachmentSource,
  RouteTreePreparationController,
  RouterGetter,
} from '../core/types.js'
export { RemoteRouterAdapter } from './adapter.js'
export { createRemoteRoute } from './create-remote-route.js'
export { RemoteRouteMount, RemoteRouterProvider } from './components.js'
