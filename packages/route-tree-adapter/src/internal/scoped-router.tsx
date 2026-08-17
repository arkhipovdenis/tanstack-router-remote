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

function isAlreadyScoped(normalizedMount: string, value: string) {
  return (
    normalizedMount !== '/' &&
    (value === normalizedMount || value.startsWith(normalizedMount + '/'))
  )
}

/**
 * Rewrites a remote absolute route path into its host mount path. The
 * idempotence check is essential for route-bound APIs: TanStack can pass an
 * already-expanded `from`/`to`, such as `/orders/$orderId`, to the facade.
 */
function rebaseRoutePath(
  mountPath: string,
  normalizedMount: string,
  value: unknown,
) {
  if (typeof value !== 'string') {
    return value
  }

  if (
    isAbsoluteBrowserUrl(value) ||
    !value.startsWith('/') ||
    isAlreadyScoped(normalizedMount, value)
  ) {
    return value
  }

  if (value === '/') {
    return normalizedMount
  }

  return joinPaths([mountPath, value])
}

/**
 * `buildLocation` runs on every `<Link>` render, so the mount path is
 * normalized once per facade and threaded through instead of being recomputed
 * (and reallocated) for each `from`/`to` on every call.
 */
function scopeLocationOptionsWith<T extends LocationOptions>(
  mountPath: string,
  normalizedMount: string,
  options: T,
): T {
  return {
    ...options,
    from: rebaseRoutePath(mountPath, normalizedMount, options.from),
    to: rebaseRoutePath(mountPath, normalizedMount, options.to),
  }
}

export function scopeLocationOptions<T extends LocationOptions>(
  mountPath: string,
  options: T,
): T {
  return scopeLocationOptionsWith(
    mountPath,
    normalizedMountPath(mountPath),
    options,
  )
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
  const normalizedMount = normalizedMountPath(mountPath)
  const scope = <T extends LocationOptions>(options: T) =>
    scopeLocationOptionsWith(mountPath, normalizedMount, options)

  scopedRouter.navigate = ((options: LocationOptions) =>
    router.navigate(scope(options) as never)) as TRouter['navigate']
  scopedRouter.buildLocation = ((options: LocationOptions) =>
    router.buildLocation(scope(options) as never)) as TRouter['buildLocation']

  // `<Link>` resolves its own target through the scoped `buildLocation` above
  // and hands `preloadRoute` a `_builtLocation`, so hover preloading is already
  // scoped. An imperative `preloadRoute({ to })` has no such prebuilt location
  // and would otherwise resolve the remote path against the host tree, quietly
  // preloading a same-named host route. `matchRoute` resolves `to` itself and
  // would likewise never match the mounted remote.
  scopedRouter.preloadRoute = ((options: LocationOptions = {}) =>
    router.preloadRoute(scope(options) as never)) as TRouter['preloadRoute']
  scopedRouter.matchRoute = ((options: LocationOptions, matchOptions?: unknown) =>
    router.matchRoute(
      scope(options) as never,
      matchOptions as never,
    )) as TRouter['matchRoute']

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
