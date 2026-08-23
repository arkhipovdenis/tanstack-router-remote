import { computed, defineComponent, h, type PropType } from 'vue'
import {
  RouterContextProvider,
  useRouter,
  type NotFoundRouteComponent,
  type RouteComponent,
} from '@tanstack/vue-router'

import { createScopedRouter } from '../../core/internal/scoped-router.js'

const ScopedRouterContext = defineComponent({
  name: 'ScopedRouterContext',
  props: {
    mountPath: { type: String as PropType<string>, required: true },
  },
  setup(props, { slots }) {
    const router = useRouter()
    // Same intent as the React memo: the facade is a new object per call, and
    // handing a fresh router down on every render would churn the context.
    const scopedRouter = computed(() =>
      createScopedRouter(router as never, props.mountPath),
    )

    return () =>
      h(RouterContextProvider, { router: scopedRouter.value }, slots.default)
  },
})

export function provideScopedRouter(
  mountPath: string,
  RemoteRoot: RouteComponent,
) {
  return defineComponent({
    name: 'ScopedRemoteRoot',
    setup() {
      return () =>
        h(ScopedRouterContext, { mountPath }, () => h(RemoteRoot as never))
    },
  })
}

/**
 * A structural miss may still be rendered by the host mount's local 404
 * boundary. Keep the remote 404 in the same scoped router context as its
 * ordinary root, so `Link to="/"` still points at the remote index.
 */
export function provideScopedNotFoundRouter(
  mountPath: string,
  RemoteNotFound: NotFoundRouteComponent,
) {
  return defineComponent({
    name: 'ScopedRemoteNotFound',
    setup(_props, { attrs }) {
      return () =>
        h(ScopedRouterContext, { mountPath }, () =>
          h(RemoteNotFound as never, attrs),
        )
    },
  })
}
