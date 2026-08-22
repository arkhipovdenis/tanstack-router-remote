// Framework entry point: `tanstack-router-remote/react`.

export type {
  AttachRemoteRouteTreeOptions,
  RemoteRouteTreeLoader,
  RouteTreeAttachment,
  RouteTreeAttachmentController,
  RouteTreeAttachmentSource,
  RouteTreePreparationController,
  RouterGetter,
} from '../core/types.js'
export { RouteTreeUpdateAdapter } from './adapter.js'
export { createRemoteRoute } from './create-remote-route.js'
export {
  RemoteRouteMount,
  RouteTreeUpdateAdapterProvider,
  useRouteTreeAttachment,
  useRouteTreeUpdateAdapter,
} from './components.js'
export type {
  RemoteRouteMountProps,
  RouteTreeUpdateAdapterProviderProps,
} from './components.js'
