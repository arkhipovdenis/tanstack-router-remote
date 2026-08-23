import { createRootRoute } from '@tanstack/solid-router'
import type { AnyRoute } from '@tanstack/router-core'

import type { FrameworkBinding } from '../../core/framework.js'
import {
  configureRemoteStructuralNotFound,
  createRemoteRootBridge,
} from './remote-root.js'

/** Supplies the Solid implementations of the three framework-bound operations. */
export const solidBinding: FrameworkBinding = {
  createRootRoute: (options) => createRootRoute(options as never) as AnyRoute,
  createRemoteRootBridge,
  configureStructuralNotFound: configureRemoteStructuralNotFound,
}
