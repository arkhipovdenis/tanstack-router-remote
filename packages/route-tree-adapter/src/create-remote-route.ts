import { createRoute, type AnyRoute } from '@tanstack/react-router'

import { prepareRouteTreeMount } from './internal/prepare-mount.js'

type RemoteRouteDecorator = <TRoute extends AnyRoute>(route: TRoute) => TRoute
type CreateRemoteRoute = typeof createRoute & RemoteRouteDecorator

/**
 * Creates a childless host mount for a remotely supplied route tree.
 *
 * This has the exact same options and inferred route type as TanStack's
 * `createRoute`. It can also decorate a generated file-route instance in
 * place: keep the generator-visible `createFileRoute` export, then call
 * `createRemoteRoute(Route)` before the host router is created.
 */
export const createRemoteRoute = ((input: unknown) => {
  const route = isRouteInstance(input) ? input : createRoute(input as never)

  return prepareRouteTreeMount(route)
}) as CreateRemoteRoute

function isRouteInstance(value: unknown): value is AnyRoute {
  return (
    typeof value === 'object' &&
    value !== null &&
    'options' in value &&
    'addChildren' in value &&
    typeof (value as { addChildren?: unknown }).addChildren === 'function'
  )
}
