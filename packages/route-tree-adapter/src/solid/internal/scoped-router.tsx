import { createMemo, type JSX } from 'solid-js'
import {
  RouterContextProvider,
  useRouter,
  type NotFoundRouteComponent,
  type NotFoundRouteProps,
  type RouteComponent,
} from '@tanstack/solid-router'

import { createScopedRouter } from '../../core/internal/scoped-router.js'

function ScopedRouterContext(props: {
  mountPath: string
  children: JSX.Element
}) {
  const router = useRouter()
  // Solid's reactivity is fine-grained, so this memo exists for the same reason
  // React's does: the facade is a new object each call, and handing a fresh
  // router down on every read would churn the context for no reason.
  const scopedRouter = createMemo(() =>
    createScopedRouter(router, props.mountPath),
  )

  // Solid's RouterContextProvider takes `children` as a thunk, not an element:
  // it evaluates them under the new context rather than eagerly.
  return (
    <RouterContextProvider router={scopedRouter()}>
      {() => props.children}
    </RouterContextProvider>
  )
}

export function provideScopedRouter(
  mountPath: string,
  RemoteRoot: RouteComponent,
) {
  return function ScopedRemoteRoot() {
    return (
      <ScopedRouterContext mountPath={mountPath}>
        <RemoteRoot />
      </ScopedRouterContext>
    )
  }
}

/**
 * A structural miss may still be rendered by the host mount's local 404
 * boundary. Keep the remote 404 in the same scoped router context as its
 * ordinary root, so `Link to="/"` still points at the remote index.
 */
export function provideScopedNotFoundRouter(
  mountPath: string,
  RemoteNotFound: NotFoundRouteComponent,
) {
  return function ScopedRemoteNotFound(props: NotFoundRouteProps) {
    return (
      <ScopedRouterContext mountPath={mountPath}>
        <RemoteNotFound {...props} />
      </ScopedRouterContext>
    )
  }
}
