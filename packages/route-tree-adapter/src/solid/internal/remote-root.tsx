import {
  DefaultGlobalNotFound,
  createRoute,
  type AnyRoute,
  type NotFoundRouteComponent,
  type RouteComponent,
} from '@tanstack/solid-router'

import { hasUnattachedDescendantMount } from '../../core/internal/route-tree.js'
import type { AnyNotFoundComponent } from '../../core/types.js'
import {
  provideScopedNotFoundRouter,
  provideScopedRouter,
} from './scoped-router.js'

type RouteOptionsBag = Record<string, unknown>

// Shared by every mount, and deliberately not suffixed: TanStack resolves a
// child `id` against the parent's fullPath, so two mounts yield
// `/orders/__remote-root-bridge` and `/invoices/__remote-root-bridge`. The
// constant collides only if two bridges share one parent, which cannot happen —
// a mount accepts a single remote tree.
const bridgeRouteId = '__remote-root-bridge'

function optionsOf(route: AnyRoute): RouteOptionsBag {
  return route.options as unknown as RouteOptionsBag
}

function getRemoteRootComponent(remoteTree: AnyRoute) {
  const component = remoteTree.options.component

  if (!component) {
    throw new Error('Remote routeTree root must define a component')
  }

  return component as RouteComponent
}

function staticDataOf(options: RouteOptionsBag) {
  const staticData = options.staticData

  return staticData && typeof staticData === 'object'
    ? (staticData as Record<string, unknown>)
    : {}
}

/**
 * A generated RootRoute has the fixed __root__ identity and cannot become a
 * child of a host route. This ordinary pathless route is its mountable
 * counterpart. It projects compatible lifecycle and boundary options onto a
 * real host match and renders the original remote root component.
 */
export function createRemoteRootBridge({
  mountRoute,
  remoteTree,
}: {
  mountRoute: AnyRoute
  remoteTree: AnyRoute
}) {
  const remoteOptions = optionsOf(remoteTree)
  const {
    shellComponent: _shellComponent,
    component: _component,
    staticData: _staticData,
    // Held back deliberately - see the React binding for the full reason: a
    // boundary here would shadow a descendant mount that has not attached yet.
    notFoundComponent: _notFoundComponent,
    ...mountCompatibleOptions
  } = remoteOptions

  return createRoute({
    ...mountCompatibleOptions,
    getParentRoute: () => mountRoute,
    id: bridgeRouteId,
    component: provideScopedRouter(
      mountRoute.fullPath,
      getRemoteRootComponent(remoteTree),
    ),
    staticData: {
      ...staticDataOf(remoteOptions),
      remoteRootBridge: true,
      remoteOriginalRootId: '__root__',
    },
  } as never) as AnyRoute
}

/**
 * Once the mount owns a fuzzy global 404, TanStack renders its local
 * notFoundComponent instead of entering the pathless bridge. Replace that
 * boundary only after the tree is grafted, preserving TanStack's native 404
 * match/status without adding a full-match splat that could steal deeper fuzzy
 * branches (including nested remote mounts).
 */
export function configureRemoteStructuralNotFound({
  hostDefaultNotFoundComponent,
  mountRoute,
  remoteRootBridge,
  remoteRootNotFoundComponent,
}: {
  // Narrowed from the core's `AnyNotFoundComponent` here: this is the Solid
  // boundary, the first place the value is used as a component rather than
  // carried through.
  hostDefaultNotFoundComponent?: AnyNotFoundComponent
  mountRoute: AnyRoute
  remoteRootBridge: AnyRoute
  remoteRootNotFoundComponent?: AnyNotFoundComponent
}) {
  if (hasUnattachedDescendantMount(remoteRootBridge)) {
    return
  }

  const remoteRootNotFound = remoteRootNotFoundComponent

  // A remote-local boundary is part of the mounted application, so it needs
  // scoped navigation. A host-wide default is only a safety fallback and must
  // retain the host router context (for example, its `Link to="/"`).
  const structuralNotFoundComponent = remoteRootNotFound
    ? provideScopedNotFoundRouter(
        mountRoute.fullPath,
        remoteRootNotFound as NotFoundRouteComponent,
      )
    : ((hostDefaultNotFoundComponent as NotFoundRouteComponent | undefined) ??
      DefaultGlobalNotFound)

  mountRoute.update({
    notFoundComponent: structuralNotFoundComponent,
  } as never)

  if (remoteRootNotFound) {
    remoteRootBridge.update({
      notFoundComponent: remoteRootNotFound,
    } as never)
  }
}
