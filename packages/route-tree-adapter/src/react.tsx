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
} from './types.js'

const routeTreeUpdateAdapterContext =
  createContext<RouteTreeAttachmentController | null>(null)

export type RouteTreeUpdateAdapterProviderProps = {
  adapter: RouteTreeAttachmentController
  children: ReactNode
}

/**
 * Host-level ownership boundary for the single mutable route-tree adapter.
 * Put it above RouterProvider so scoped TanStack router contexts never create
 * a second attachment queue.
 */
export function RouteTreeUpdateAdapterProvider({
  adapter,
  children,
}: RouteTreeUpdateAdapterProviderProps) {
  return (
    <routeTreeUpdateAdapterContext.Provider value={adapter}>
      {children}
    </routeTreeUpdateAdapterContext.Provider>
  )
}

export function useRouteTreeUpdateAdapter() {
  const adapter = useContext(routeTreeUpdateAdapterContext)

  if (!adapter) {
    throw new Error(
      'RemoteRouteMount must be rendered below RouteTreeUpdateAdapterProvider.',
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
 * React adapter for a mount route. Render it from the mount's component: a
 * fuzzy 404 below an unattached mount matches the mount rather than throwing
 * into it, so one component covers both the exact path and a direct deep link.
 * It begins the attach in an effect only after TanStack committed that match;
 * invoking router.load() during a route lifecycle would recurse into the
 * navigation that is currently pending.
 */
export function RemoteRouteMount({
  mountRoute,
  loadRouteTree,
  preserveMountChildren,
  loading = null,
  error,
  children,
}: RemoteRouteMountProps) {
  const adapter = useRouteTreeUpdateAdapter()
  const attachment = useRouteTreeAttachment(adapter, mountRoute)

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
