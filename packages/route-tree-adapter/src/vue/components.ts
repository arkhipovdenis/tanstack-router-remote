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
 * Host-level ownership boundary for the single mutable route-tree adapter.
 * Put it above RouterProvider so scoped TanStack router contexts never create
 * a second attachment queue.
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
 * Vue adapter for a mount route. Render it from the mount's component: a fuzzy
 * 404 below an unattached mount matches the mount rather than throwing into it,
 * so one component covers both the exact path and a direct deep link. It begins
 * the attach on mount, once TanStack committed that match; invoking
 * router.load() during a route lifecycle would recurse into the navigation that
 * is currently pending.
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
