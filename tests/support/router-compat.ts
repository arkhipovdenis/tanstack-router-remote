// Version-neutral probes for TanStack Router internals the tests inspect.
//
// The peer range is open (`>=1.168.18`), so the suite has to read router state
// on both the pinned version and whatever the canary workflow resolves. These
// helpers paper over the introspection APIs that changed between them; see
// "Upstream version drift" in docs/limitations.md.

import type { AnyRouteMatch, AnyRouter } from '@tanstack/react-router'

/**
 * Whether a match is the not-found match.
 *
 * Up to `router-core@1.171.15` this was `match.globalNotFound`; newer versions
 * expose `match._notFound`. `status` stays `'success'` on a not-found match in
 * both, so it cannot be used here.
 */
export function isNotFoundMatch(match: AnyRouteMatch | undefined): boolean {
  if (!match) return false

  const probe = match as { globalNotFound?: boolean; _notFound?: boolean }

  return probe.globalNotFound === true || probe._notFound === true
}

/** Whether the router resolved the current location to a not-found match. */
export function hasNotFoundMatch(router: AnyRouter): boolean {
  return router.state.matches.some(isNotFoundMatch)
}

/**
 * Clears the router's expired match cache.
 *
 * `clearExpiredCache()` was renamed to `clearCache()`; both are present on some
 * versions, so prefer the current name and fall back to the old one.
 */
export function clearRouterCache(router: AnyRouter): void {
  const probe = router as unknown as {
    clearCache?: () => void
    clearExpiredCache?: () => void
  }

  const clear = probe.clearCache ?? probe.clearExpiredCache

  if (!clear) {
    throw new Error(
      'router exposes neither clearCache() nor clearExpiredCache()',
    )
  }

  clear.call(router)
}
