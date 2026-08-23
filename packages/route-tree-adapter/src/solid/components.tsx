import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js'
import { type AnyRoute } from '@tanstack/solid-router'

import type {
  RemoteRouteTreeLoader,
  RouteTreeAttachment,
  RouteTreeAttachmentController,
  RouteTreeAttachmentSource,
} from '../core/types.js'

const remoteRouterAdapterContext =
  createContext<RouteTreeAttachmentController | null>(null)

export type RemoteRouterProviderProps = {
  adapter: RouteTreeAttachmentController
  children: JSX.Element
}

/**
 * Host-level ownership boundary for the single mutable route-tree adapter.
 * Put it above RouterProvider so scoped TanStack router contexts never create
 * a second attachment queue.
 */
export function RemoteRouterProvider(props: RemoteRouterProviderProps) {
  return (
    <remoteRouterAdapterContext.Provider value={props.adapter}>
      {props.children}
    </remoteRouterAdapterContext.Provider>
  )
}

export function useRemoteRouterAdapter() {
  const adapter = useContext(remoteRouterAdapterContext)

  if (!adapter) {
    throw new Error(
      'RemoteRouteMount must be rendered below RemoteRouterProvider.',
    )
  }

  return adapter
}

/**
 * Solid's counterpart to the React `useSyncExternalStore` subscription. The
 * store hands out frozen per-mount snapshots, so a plain signal holding the
 * current one is enough — `equals: false` is not needed, since the store
 * returns the same object identity while nothing changed.
 */
export function useRouteTreeAttachment(
  attachmentSource: RouteTreeAttachmentSource,
  mountRoute: AnyRoute,
): Accessor<RouteTreeAttachment> {
  const [attachment, setAttachment] = createSignal(
    attachmentSource.getSnapshot(mountRoute),
  )

  const unsubscribe = attachmentSource.subscribe(() => {
    setAttachment(attachmentSource.getSnapshot(mountRoute))
  })

  onCleanup(unsubscribe)

  return attachment
}

export type RemoteRouteMountProps = {
  mountRoute: AnyRoute
  loadRouteTree: RemoteRouteTreeLoader
  preserveMountChildren?: boolean
  loading?: JSX.Element
  error?: (error: Error) => JSX.Element
  children: JSX.Element
}

/**
 * Solid adapter for a mount route. Render it from the mount's component: a
 * fuzzy 404 below an unattached mount matches the mount rather than throwing
 * into it, so one component covers both the exact path and a direct deep link.
 * It begins the attach after mount, once TanStack committed that match;
 * invoking router.load() during a route lifecycle would recurse into the
 * navigation that is currently pending.
 */
export function RemoteRouteMount(props: RemoteRouteMountProps) {
  const adapter = useRemoteRouterAdapter()
  const attachment = useRouteTreeAttachment(adapter, props.mountRoute)

  onMount(() => {
    // An SSR/client bootstrap has already grafted the matching fresh tree and
    // will hand routing to router.load() or hydrate(router) before this mount
    // is rendered. Do not turn that controlled handoff into a second CSR load.
    //
    // Deliberately `onMount` and not `createEffect`: this must run exactly
    // once. A failed transport publishes `error`, and re-running on that
    // publication would turn one failed import into an implicit retry loop.
    // Retrying is an explicit host decision: remount with a new route
    // tree/document or add a retry UI.
    const snapshot = adapter.getSnapshot(props.mountRoute)
    if (snapshot.state === 'prepared' || snapshot.state === 'attached') {
      return
    }

    void adapter
      .attach({
        mountRoute: props.mountRoute,
        loadRouteTree: props.loadRouteTree,
        preserveMountChildren: props.preserveMountChildren,
      })
      .catch(() => undefined)
  })

  return (
    <>
      {(() => {
        const state = attachment().state

        if (state === 'prepared' || state === 'attached') {
          return props.children
        }

        if (state === 'error') {
          const current = attachment()
          return current.state === 'error'
            ? (props.error?.(current.error) ?? null)
            : null
        }

        return props.loading ?? null
      })()}
    </>
  )
}
