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
 * Provides the {@link RemoteRouterAdapter} that every `RemoteRouteMount` below
 * it uses. Render it above the host's `RouterProvider`, once per application:
 * one adapter owns all route-tree mutation, so a second provider would give
 * remotes a competing attachment queue.
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
export function RemoteRouteMount(props: RemoteRouteMountProps) {
  const adapter = useRemoteRouterAdapter()
  const attachment = useRouteTreeAttachment(adapter, props.mountRoute)

  // After mount, so the attach starts only once TanStack has committed the
  // match: calling router.load() during a route lifecycle would recurse into
  // the navigation that is still pending.
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
