import { defineComponent, h } from 'vue'
import {
  DefaultGlobalNotFound,
  isNotFound,
  useRouter,
  type AnyRoute,
} from '@tanstack/vue-router'

export function createBootstrapNotFound(route: AnyRoute) {
  const resourceNotFound = route.options.notFoundComponent

  return defineComponent({
    name: 'BootstrapNotFound',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      const router = useRouter()

      return () => {
        const component = isNotFound(attrs)
          ? (resourceNotFound ?? router.options.defaultNotFoundComponent)
          : route.options.component

        return h((component ?? DefaultGlobalNotFound) as never, attrs)
      }
    },
  })
}
