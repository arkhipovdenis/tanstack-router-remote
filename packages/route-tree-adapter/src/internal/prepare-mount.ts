import type { AnyRoute } from '@tanstack/react-router'

import { childRoutesOf } from './route-tree'

/**
 * Internal invariant for a static remote mount. The public code-route factory
 * and file-route enhancer call this before the host router is created.
 */
export function prepareRouteTreeMount<TRoute extends AnyRoute>(
  mountRoute: TRoute,
) {
  if (childRoutesOf(mountRoute).length) {
    throw new Error(
      'A route-tree mount must not have static children before the first attach. ' +
        "Render the loading boundary from the mount's own component instead: a " +
        'deep link below an unattached mount fuzzy-matches the mount itself.',
    )
  }

  mountRoute.addChildren([])

  return mountRoute
}
