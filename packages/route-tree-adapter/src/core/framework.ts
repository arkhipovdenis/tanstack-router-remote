import type { AnyRoute } from '@tanstack/router-core'

import type { AnyNotFoundComponent } from './types.js'

/**
 * The seam between the framework-neutral core and a framework entry point.
 *
 * Everything the core does to a route tree — reparenting children, cloning the
 * host root, undoing a failed graft — is identical for React, Solid and Vue,
 * because it operates on `router-core` route objects. Only three operations
 * need the framework: creating routes (each framework has its own
 * `createRoute`/`createRootRoute` that bind component types), projecting the
 * remote root onto a bridge, and wiring the structural not-found boundary,
 * which renders components.
 *
 * A framework entry point supplies this once; the core never imports a
 * framework package.
 */
export type FrameworkBinding = {
  /** The framework's `createRootRoute`, used to clone the host root. */
  createRootRoute: (options: Record<string, unknown>) => AnyRoute

  /**
   * Builds the pathless bridge that carries the remote root's compatible
   * options and renders its component in a scoped router context.
   */
  createRemoteRootBridge: (args: {
    mountRoute: AnyRoute
    remoteTree: AnyRoute
  }) => AnyRoute

  /**
   * Points the mount's structural 404 at the remote root's boundary, falling
   * back to the host default. Runs after the bridge is attached.
   */
  configureStructuralNotFound: (args: {
    hostDefaultNotFoundComponent?: AnyNotFoundComponent
    mountRoute: AnyRoute
    remoteRootBridge: AnyRoute
    /**
     * The remote root's own boundary. The bridge does not carry it while a
     * descendant mount is still unattached, so it is passed separately.
     */
    remoteRootNotFoundComponent?: AnyNotFoundComponent
  }) => void
}
