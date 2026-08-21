import type { AnyRoute, AnyRouter } from '@tanstack/react-router'

/** Resolves the host router only when an attachment needs to mutate it. */
export type RouterGetter<TRouter extends AnyRouter = AnyRouter> = () => TRouter

/**
 * Keep the transport outside the package. A Module Federation host can adapt
 * `loadRemote('someRemote/routeTree')`, while another host can use dynamic import
 * or a route-registry client.
 */
export type RemoteRouteTreeLoader = () => Promise<AnyRoute>

export type RouteTreeAttachment =
  | Readonly<{ state: 'idle' }>
  | Readonly<{ state: 'loading' }>
  /** The tree is grafted/reindexed; SSR bootstrap still owns the first match. */
  | Readonly<{ state: 'prepared' }>
  | Readonly<{ state: 'attached' }>
  | Readonly<{ state: 'error'; error: Error }>

/** Read-only attachment state needed by React and other renderers. */
export interface RouteTreeAttachmentSource {
  subscribe(listener: () => void): () => void
  getSnapshot(mountRoute: AnyRoute): RouteTreeAttachment
}

/** Full attachment capability, kept separate from read-only consumers. */
export interface RouteTreeAttachmentController extends RouteTreeAttachmentSource {
  attach(options: AttachRemoteRouteTreeOptions): Promise<void>
}

/**
 * Server/client bootstrap operation. It grafts a remote tree and rebuilds the
 * host route registry, then publishes `prepared` rather than `attached`.
 * The caller deliberately owns the first server `router.load()` or client
 * `hydrate(router)`, before React renders the mount.
 */
export interface RouteTreePreparationController extends RouteTreeAttachmentSource {
  prepare(options: AttachRemoteRouteTreeOptions): Promise<void>
}

export type AttachRemoteRouteTreeOptions = {
  /** A static, childless host route created with createRemoteRoute(). */
  mountRoute: AnyRoute
  /** Resolves a fresh generated remote route tree. */
  loadRouteTree: RemoteRouteTreeLoader
  /**
   * Keeps host children below the mount after attach. The default removes a
   * bootstrap fallback, which otherwise competes with remote dynamic routes.
   */
  preserveMountChildren?: boolean
}
