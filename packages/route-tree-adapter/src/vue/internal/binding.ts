import { createRootRoute } from '@tanstack/vue-router'
import type { AnyRoute } from '@tanstack/router-core'

import type { FrameworkBinding } from '../../core/framework.js'
import {
  configureRemoteStructuralNotFound,
  createRemoteRootBridge,
} from './remote-root.js'

/** Supplies the Vue implementations of the three framework-bound operations. */
export const vueBinding: FrameworkBinding = {
  createRootRoute: (options) => createRootRoute(options as never) as AnyRoute,
  createRemoteRootBridge,
  configureStructuralNotFound: configureRemoteStructuralNotFound,
}
