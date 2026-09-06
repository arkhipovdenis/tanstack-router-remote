import { Dynamic } from 'solid-js/web'
import {
  DefaultGlobalNotFound,
  isNotFound,
  useRouter,
  type AnyRoute,
  type NotFoundRouteProps,
} from '@tanstack/solid-router'

export function createBootstrapNotFound(route: AnyRoute) {
  const resourceNotFound = route.options.notFoundComponent

  return function BootstrapNotFound(props: NotFoundRouteProps) {
    const router = useRouter()

    return (
      <Dynamic
        component={
          (isNotFound(props)
            ? (resourceNotFound ?? router.options.defaultNotFoundComponent)
            : route.options.component) ?? DefaultGlobalNotFound
        }
        {...props}
      />
    )
  }
}
