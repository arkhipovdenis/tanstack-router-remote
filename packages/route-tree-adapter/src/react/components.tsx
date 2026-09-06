import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { type AnyRoute } from '@tanstack/react-router'

import type {
  RemoteRouteTreeLoader,
  RouteTreeAttachment,
  RouteTreeAttachmentController,
  RouteTreeAttachmentSource,
} from '../core/types.js'

const routeTreeUpdateAdapterContext =
  createContext<RouteTreeAttachmentController | null>(null)

export type RemoteRouterProviderProps = {
  adapter: RouteTreeAttachmentController
  children: ReactNode
}

/**
 * Provides the {@link RemoteRouterAdapter} that every `RemoteRouteMount` below
 * it uses. Render it above the host's `RouterProvider`, once per application:
 * one adapter owns all route-tree mutation, so a second provider would give
 * remotes a competing attachment queue.
 */
export function RemoteRouterProvider({
  adapter,
  children,
}: RemoteRouterProviderProps) {
  return (
    <routeTreeUpdateAdapterContext.Provider value={adapter}>
      {children}
    </routeTreeUpdateAdapterContext.Provider>
  )
}

export function useRemoteRouterAdapter() {
  const adapter = useContext(routeTreeUpdateAdapterContext)

  if (!adapter) {
    throw new Error(
      'RemoteRouteMount must be rendered below RemoteRouterProvider.',
    )
  }

  return adapter
}

export function useRouteTreeAttachment(
  attachmentSource: RouteTreeAttachmentSource,
  mountRoute: AnyRoute,
) {
  return useSyncExternalStore(
    (listener) => attachmentSource.subscribe(listener),
    () => attachmentSource.getSnapshot(mountRoute),
    () => attachmentSource.getSnapshot(mountRoute),
  )
}

export type RemoteRouteMountProps = {
  mountRoute: AnyRoute
  loadRouteTree: RemoteRouteTreeLoader
  preserveMountChildren?: boolean
  loading?: ReactNode
  error?: (error: Error) => ReactNode
  children: ReactNode
}

/**
 * Loads and attaches a remote route tree below a mount created with
 * {@link createRemoteRoute}. Render it from the mount's own `component`, and it
 * covers both the mount path and a direct deep link below it.
 *
 * ```tsx
 * const mount = createRemoteRoute({ getParentRoute: () => root, path: '/orders',
 *   component: () => (
 *     <RemoteRouteMount
 *       mountRoute={mount}
 *       loadRouteTree={async () => (await import('orders/routeTree')).routeTree}
 *       loading={<Spinner />}
 *       error={(error) => <p>{error.message}</p>}
 *     >
 *       <Outlet />
 *     </RemoteRouteMount>
 *   ) })
 * ```
 *
 * The attach runs once per mount. A failed load is reported through `error` and
 * is not retried automatically; retrying is the host's decision.
 */
export function RemoteRouteMount({
  mountRoute,
  loadRouteTree,
  preserveMountChildren,
  loading = null,
  error,
  children,
}: RemoteRouteMountProps) {
  const adapter = useRemoteRouterAdapter()
  const attachment = useRouteTreeAttachment(adapter, mountRoute)

  // In an effect, so the attach starts only after TanStack has committed the
  // match: calling router.load() during a route lifecycle would recurse into
  // the navigation that is still pending.
  useEffect(() => {
    // An SSR/client bootstrap has already grafted the matching fresh tree and
    // will hand routing to router.load() or hydrate(router) before this mount
    // is rendered. Do not turn that controlled handoff into a second CSR load.
    //
    // Intentionally do not depend on attachment state here. A failed transport
    // publishes `error`; making that publication re-run this effect would turn
    // one failed import into an implicit retry loop. Retrying is an explicit
    // host decision: remount with a new route tree/document or add a retry UI.
    const snapshot = adapter.getSnapshot(mountRoute)
    if (snapshot.state === 'prepared' || snapshot.state === 'attached') {
      return
    }

    void adapter
      .attach({ mountRoute, loadRouteTree, preserveMountChildren })
      .catch(() => undefined)
  }, [adapter, loadRouteTree, mountRoute, preserveMountChildren])

  return renderAttachment({
    attachment,
    children,
    error,
    loading,
  })
}

function renderAttachment({
  attachment,
  children,
  error,
  loading,
}: {
  attachment: RouteTreeAttachment
  children: ReactNode
  error?: (error: Error) => ReactNode
  loading: ReactNode
}) {
  if (attachment.state === 'prepared' || attachment.state === 'attached') {
    return <>{children}</>
  }

  if (attachment.state === 'error') {
    return <>{error?.(attachment.error) ?? null}</>
  }

  return <>{loading}</>
}
