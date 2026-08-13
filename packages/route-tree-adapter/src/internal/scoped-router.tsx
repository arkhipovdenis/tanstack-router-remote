import { useMemo, type ReactNode } from 'react'
import {
  RouterContextProvider,
  joinPaths,
  useRouter,
  type AnyRouter,
  type NotFoundRouteComponent,
  type NotFoundRouteProps,
  type RouteComponent,
} from '@tanstack/react-router'

type LocationOptions = {
  from?: unknown
  to?: unknown
}

function isAbsoluteBrowserUrl(value: string) {
  return /^[a-z][a-z\d+.-]*:/i.test(value)
}

function normalizedMountPath(mountPath: string) {
  return mountPath === '/' ? '/' : mountPath.replace(/\/+$/, '')
}

function isAlreadyScoped(mountPath: string, value: string) {
  const normalized = normalizedMountPath(mountPath)

  return (
    normalized !== '/' &&
    (value === normalized || value.startsWith(normalized + '/'))
  )
}

/**
 * Rewrites a remote absolute route path into its host mount path. The
 * idempotence check is essential for route-bound APIs: TanStack can pass an
 * already-expanded `from`/`to`, such as `/orders/$orderId`, to the facade.
 */
function rebaseRoutePath(mountPath: string, value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  if (
    isAbsoluteBrowserUrl(value) ||
    !value.startsWith('/') ||
    isAlreadyScoped(mountPath, value)
  ) {
    return value
  }

  if (value === '/') {
    return normalizedMountPath(mountPath)
  }

  return joinPaths([mountPath, value])
}

export function scopeLocationOptions<T extends LocationOptions>(
  mountPath: string,
  options: T,
): T {
  return {
    ...options,
    from: rebaseRoutePath(mountPath, options.from),
    to: rebaseRoutePath(mountPath, options.to),
  }
}

function createScopedRouter<TRouter extends AnyRouter>(
  router: TRouter,
  mountPath: string,
): TRouter {
  // This is deliberately a lightweight prototype facade, not a copied
  // TanStack Router. It leaves stores, history, cache, and every
  // non-navigation member on the contextual router. A generic ES Proxy would
  // also have to preserve RouterCore accessor receivers, while this narrow
  // facade changes only the two navigation methods we actually scope. A nested
  // facade delegates to the previous contextual facade, so prefixes compose
  // until the original host router receives the navigation.
  const scopedRouter = Object.create(router) as TRouter

  scopedRouter.navigate = ((options: LocationOptions) =>
    router.navigate(scopeLocationOptions(mountPath, options) as never)) as TRouter['navigate']
  scopedRouter.buildLocation = ((options: LocationOptions) =>
    router.buildLocation(
      scopeLocationOptions(mountPath, options) as never,
    )) as TRouter['buildLocation']

  return scopedRouter
}

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
