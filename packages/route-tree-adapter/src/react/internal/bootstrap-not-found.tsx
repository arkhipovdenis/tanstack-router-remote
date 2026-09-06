import { createElement } from 'react'
import {
  DefaultGlobalNotFound,
  isNotFound,
  useRouter,
  type AnyRoute,
  type NotFoundRouteProps,
} from '@tanstack/react-router'

/** A structural miss must enter the mount even when an ancestor owns a 404. */
export function createBootstrapNotFound(route: AnyRoute) {
  const resourceNotFound = route.options.notFoundComponent

  return function BootstrapNotFound(props: NotFoundRouteProps) {
    const router = useRouter()
    // TanStack passes a notFound() error for missing resources, but no error
    // for an unmatched pathname. Keep lifecycle failures out of the bootstrap.
    const component = isNotFound(props)
      ? (resourceNotFound ?? router.options.defaultNotFoundComponent)
      : route.options.component

    // Read the component at render time: file routes and Vue-style setup can
    // assign it with route.update() after createRemoteRoute() returns.
    return createElement(component ?? DefaultGlobalNotFound, props)
  }
}
