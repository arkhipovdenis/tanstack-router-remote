import {
  createRootRoute,
  type AnyRootRoute,
  type AnyRoute,
  type NotFoundRouteComponent,
} from '@tanstack/react-router'

import {
  configureRemoteStructuralNotFound,
  createRemoteRootBridge,
} from './remote-root.js'

export function childRoutesOf(route: AnyRoute) {
  if (Array.isArray(route.children)) {
    return route.children as AnyRoute[]
  }

  return Object.values(route.children ?? {}) as AnyRoute[]
}

/**
 * router.update() rebuilds its matcher only for a routeTree with a new
 * identity. A cloned root is sufficient once all direct host children are
 * rebound to that root.
 */
export function cloneHostRootForUpdate(routeTree: AnyRootRoute) {
  const nextRoot = createRootRoute({
    ...routeTree.options,
  } as never) as AnyRootRoute
  const hostChildren = childRoutesOf(routeTree)
  const previousParents = hostChildren.map((route) => ({
    route,
    getParentRoute: route.options.getParentRoute,
  }))

  try {
    for (const route of hostChildren) {
      route.update({ getParentRoute: () => nextRoot } as never)
    }

    nextRoot.addChildren(hostChildren as never)
  } catch (error) {
    for (const { route, getParentRoute } of previousParents) {
      route.update({ getParentRoute } as never)
    }

    throw error
  }

  return nextRoot
}

/**
 * Reparents generated remote children below a pathless root bridge. The
 * original remote __root__ remains outside the host tree; the bridge owns the
 * compatible root options and renders its component.
 *
 * Returns an `undo()` that restores the mount and the remote children to their
 * pre-graft shape. The caller owns it for as long as the surrounding
 * transaction can still fail — `router.update()` runs after the graft and
 * mutating the host tree without a way back would strand the remote tree.
 */
export function graftRemoteRouteTree({
  hostDefaultNotFoundComponent,
  mountRoute,
  remoteTree,
  preserveMountChildren,
}: {
  hostDefaultNotFoundComponent?: NotFoundRouteComponent
  mountRoute: AnyRoute
  remoteTree: AnyRoute
  preserveMountChildren: boolean
}) {
  const remoteChildren = childRoutesOf(remoteTree)

  if ((remoteTree as { isRoot?: boolean }).isRoot !== true) {
    throw new Error('Remote routeTree must be the generated root route.')
  }

  if (!remoteChildren.length) {
    throw new Error('Remote routeTree must expose at least one child route')
  }

  const hostChildren = childRoutesOf(mountRoute)
  const mountNotFoundComponent = mountRoute.options.notFoundComponent
  const remoteRootBridge = createRemoteRootBridge({
    mountRoute,
    remoteTree,
  })
  const previousParents = remoteChildren.map((route) => ({
    route,
    getParentRoute: route.options.getParentRoute,
  }))
  const undo = () => {
    mountRoute.addChildren(hostChildren as never)
    mountRoute.update({
      notFoundComponent: mountNotFoundComponent,
    } as never)

    for (const { route, getParentRoute } of previousParents) {
      route.update({ getParentRoute } as never)
    }
  }

  try {
    for (const route of remoteChildren) {
      route.update({ getParentRoute: () => remoteRootBridge } as never)
    }

    remoteRootBridge.addChildren(remoteChildren as never)
    mountRoute.addChildren(
      (preserveMountChildren
        ? [...hostChildren, remoteRootBridge]
        : [remoteRootBridge]) as never,
    )
    configureRemoteStructuralNotFound({
      hostDefaultNotFoundComponent,
      mountRoute,
      remoteRootBridge,
    })
  } catch (error) {
    undo()

    throw error
  }

  return { undo }
}
