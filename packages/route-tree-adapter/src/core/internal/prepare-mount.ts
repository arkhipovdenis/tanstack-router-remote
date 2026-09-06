import type { AnyRoute } from '@tanstack/router-core'

import type { AnyNotFoundComponent } from '../types.js'

import { childRoutesOf } from './route-tree.js'

const preparedMounts = new WeakSet<AnyRoute>()

/**
 * Internal invariant for a static remote mount. The public code-route factory
 * and file-route enhancer call this before the host router is created.
 */
export function prepareRouteTreeMount<TRoute extends AnyRoute>(
  mountRoute: TRoute,
  createBootstrapNotFound: (route: AnyRoute) => AnyNotFoundComponent,
) {
  if (childRoutesOf(mountRoute).length) {
    throw new Error(
      'A route-tree mount must not have static children before the first attach. ' +
        "Render the loading boundary from the mount's own component instead: a " +
        'deep link below an unattached mount fuzzy-matches the mount itself.',
    )
  }

  if (!preparedMounts.has(mountRoute)) {
    mountRoute.update({
      notFoundComponent: createBootstrapNotFound(mountRoute),
    } as never)
    preparedMounts.add(mountRoute)
  }

  mountRoute.addChildren([])

  return mountRoute
}
