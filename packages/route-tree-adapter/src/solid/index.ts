// Framework entry point: `tanstack-router-remote/solid`.

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
export type {
  RemoteRouteMountProps,
  RemoteRouterProviderProps,
} from './components.js'
