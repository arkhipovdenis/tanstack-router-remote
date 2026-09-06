import {
  defineComponent,
  inject,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  type InjectionKey,
  type PropType,
  type ShallowRef,
} from 'vue'
import { type AnyRoute } from '@tanstack/vue-router'

import type {
  RemoteRouteTreeLoader,
  RouteTreeAttachment,
  RouteTreeAttachmentController,
  RouteTreeAttachmentSource,
} from '../core/types.js'

const remoteRouterAdapterKey: InjectionKey<RouteTreeAttachmentController> =
  Symbol('tanstack-router-remote.adapter')

/**
 * Provides the {@link RemoteRouterAdapter} that every `RemoteRouteMount` below
 * it uses. Render it above the host's `RouterProvider`, once per application:
 * one adapter owns all route-tree mutation, so a second provider would give
 * remotes a competing attachment queue.
 */
export const RemoteRouterProvider = defineComponent({
  name: 'RemoteRouterProvider',
  props: {
    adapter: {
      type: Object as PropType<RouteTreeAttachmentController>,
      required: true,
    },
  },
  setup(props, { slots }) {
    provide(remoteRouterAdapterKey, props.adapter)

    return () => slots.default?.()
  },
})

export function useRemoteRouterAdapter() {
  const adapter = inject(remoteRouterAdapterKey, null)

  if (!adapter) {
    throw new Error(
      'RemoteRouteMount must be rendered below RemoteRouterProvider.',
    )
  }

  return adapter
}

/**
 * Vue's counterpart to the React `useSyncExternalStore` subscription. The store
 * hands out frozen per-mount snapshots, so a shallow ref is enough — the
 * snapshot object is replaced wholesale, never mutated.
 */
export function useRouteTreeAttachment(
  attachmentSource: RouteTreeAttachmentSource,
  mountRoute: AnyRoute,
): ShallowRef<RouteTreeAttachment> {
  const attachment = shallowRef(attachmentSource.getSnapshot(mountRoute))

  const unsubscribe = attachmentSource.subscribe(() => {
    attachment.value = attachmentSource.getSnapshot(mountRoute)
  })

  onScopeDispose(unsubscribe)

  return attachment
}

/**
 * Loads and attaches a remote route tree below a mount created with
 * {@link createRemoteRoute}. Render it from the mount's own `component`, and it
 * covers both the mount path and a direct deep link below it.
 *
 * Takes `mountRoute` and `loadRouteTree` as props; the `default`, `loading` and
 * `error` slots render the attached tree, the pending state and a failure. The
 * `error` slot receives the `Error`.
 *
 * ```vue
 * <RemoteRouteMount :mountRoute="mount" :loadRouteTree="loadOrders">
 *   <template #default><RouterOutlet /></template>
 *   <template #loading><Spinner /></template>
 *   <template #error="error"><p>{{ error.message }}</p></template>
 * </RemoteRouteMount>
 * ```
 *
 * The attach runs once per mount. A failed load is reported through the `error`
 * slot and is not retried automatically; retrying is the host's decision.
 */
export const RemoteRouteMount = defineComponent({
  name: 'RemoteRouteMount',
  props: {
    mountRoute: { type: Object as PropType<AnyRoute>, required: true },
    loadRouteTree: {
      type: Function as PropType<RemoteRouteTreeLoader>,
      required: true,
    },
    preserveMountChildren: { type: Boolean, default: undefined },
  },
  setup(props, { slots }) {
    const adapter = useRemoteRouterAdapter()
    const attachment = useRouteTreeAttachment(adapter, props.mountRoute)

    // On mount, so the attach starts only once TanStack has committed the
    // match: calling router.load() during a route lifecycle would recurse into
    // the navigation that is still pending.
    onMounted(() => {
      // An SSR/client bootstrap has already grafted the matching fresh tree and
      // will hand routing to router.load() or hydrate(router) before this mount
      // is rendered. Do not turn that controlled handoff into a second CSR load.
      //
      // Deliberately `onMounted` and not `watchEffect`: this must run exactly
      // once. A failed transport publishes `error`, and re-running on that
      // publication would turn one failed import into an implicit retry loop.
      // Retrying is an explicit host decision.
      const snapshot = adapter.getSnapshot(props.mountRoute)
      if (snapshot.state === 'prepared' || snapshot.state === 'attached') {
        return
      }

      void adapter
        .attach({
          mountRoute: props.mountRoute,
          loadRouteTree: props.loadRouteTree,
          preserveMountChildren: props.preserveMountChildren,
        })
        .catch(() => undefined)
    })

    return () => {
      const current = attachment.value

      if (current.state === 'prepared' || current.state === 'attached') {
        return slots.default?.()
      }

      if (current.state === 'error') {
        return slots.error?.(current.error) ?? null
      }

      return slots.loading?.() ?? null
    }
  },
})
