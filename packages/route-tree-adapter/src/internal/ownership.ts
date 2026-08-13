import type { AnyRoute } from '@tanstack/react-router'

const mountByRemoteTree = new WeakMap<AnyRoute, AnyRoute>()

/**
 * Generated route instances are mutable. A single exposed tree can therefore
 * belong to only one mount for the lifetime of the current document.
 */
export function claimRemoteRouteTreeMount({
  remoteTree,
  mountRoute,
}: {
  remoteTree: AnyRoute
  mountRoute: AnyRoute
}) {
  const existingMount = mountByRemoteTree.get(remoteTree)

  if (existingMount) {
    throw new Error(
      'This remote routeTree is already mounted at ' +
        existingMount.fullPath +
        '. Expose a fresh routeTree instance for another host mount.',
    )
  }

  mountByRemoteTree.set(remoteTree, mountRoute)
}

export function releaseRemoteRouteTreeMount({
  remoteTree,
  mountRoute,
}: {
  remoteTree: AnyRoute
  mountRoute: AnyRoute
}) {
  if (mountByRemoteTree.get(remoteTree) === mountRoute) {
    mountByRemoteTree.delete(remoteTree)
  }
}
