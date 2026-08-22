import { useMemo, type ReactNode } from 'react'
import {
  RouterContextProvider,
  useRouter,
  type NotFoundRouteComponent,
  type NotFoundRouteProps,
  type RouteComponent,
} from '@tanstack/react-router'

import { createScopedRouter } from '../../core/internal/scoped-router.js'

function ScopedRouterContext({
  mountPath,
  children,
}: {
  mountPath: string
  children: ReactNode
}) {
  const router = useRouter()
  const scopedRouter = useMemo(
    () => createScopedRouter(router, mountPath),
    [mountPath, router],
  )

  return (
    <RouterContextProvider router={scopedRouter}>
      {children}
    </RouterContextProvider>
  )
}

export function provideScopedRouter(
  mountPath: string,
  RemoteRoot: RouteComponent,
) {
  function ScopedRemoteRoot() {
    return (
      <ScopedRouterContext mountPath={mountPath}>
        <RemoteRoot />
      </ScopedRouterContext>
    )
  }

  ScopedRemoteRoot.displayName = 'ScopedRemoteRoot'

  return ScopedRemoteRoot
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
  function ScopedRemoteNotFound(props: NotFoundRouteProps) {
    return (
      <ScopedRouterContext mountPath={mountPath}>
        <RemoteNotFound {...props} />
      </ScopedRouterContext>
    )
  }

  ScopedRemoteNotFound.displayName = 'ScopedRemoteNotFound'

  return ScopedRemoteNotFound
}
