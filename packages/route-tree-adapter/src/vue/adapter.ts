import type { AnyRouter } from '@tanstack/router-core'

import { RemoteRouterAdapter as CoreRemoteRouterAdapter } from '../core/adapter.js'
import type { RouterGetter } from '../core/types.js'
import { vueBinding } from './internal/binding.js'

/**
 * The host-level coordinator, bound to Vue.
 *
 * Identical to the core adapter except that it supplies the Vue framework
 * binding itself, so a host writes `new RemoteRouterAdapter(() => router)`.
 */
export class RemoteRouterAdapter<
  TRouter extends AnyRouter = AnyRouter,
> extends CoreRemoteRouterAdapter<TRouter> {
  constructor(getRouter: RouterGetter<TRouter>) {
    super(getRouter, vueBinding)
  }
}
