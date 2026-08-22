import {
  createRoute,
  type AnyContext,
  type AnyRoute,
  type ResolveFullPath,
  type ResolveId,
  type ResolveParams,
  type Route,
  type RouteConstraints,
  type RouteOptions,
} from '@tanstack/react-router'

import { prepareRouteTreeMount } from '../core/internal/prepare-mount.js'

/**
 * Creates a childless host mount for a remotely supplied route tree.
 *
 * Two call forms, one behavior — the returned route is always prepared as a
 * static mount with no children:
 *
 * - **Existing route instance.** Pass a route and get the *same* instance back,
 *   prepared in place. This is the file-route form: wrap the generated
 *   declaration so the decoration is the exported value.
 * - **Code route.** Pass the same options TanStack's `createRoute` takes.
 *
 * ```tsx
 * export const Route = createRemoteRoute(
 *   createFileRoute('/catalog')({ component: CatalogMount }),
 * )
 * ```
 *
 * The generator reads the inner `createFileRoute` call and is satisfied by it,
 * so no build-time transform is involved.
 */
export function createRemoteRoute<TRoute extends AnyRoute>(
  route: TRoute,
): TRoute
/**
 * The generic list mirrors `createRoute` because inference is positional:
 * expressing this as `Parameters<typeof createRoute>` collapses `fullPath`,
 * params, search and loader data back to `unknown`.
 */
export function createRemoteRoute<
  TRegister = unknown,
  TParentRoute extends RouteConstraints['TParentRoute'] = AnyRoute,
  TPath extends RouteConstraints['TPath'] = '/',
  TFullPath extends RouteConstraints['TFullPath'] = ResolveFullPath<
    TParentRoute,
    TPath
  >,
  TCustomId extends RouteConstraints['TCustomId'] = string,
  TId extends RouteConstraints['TId'] = ResolveId<
    TParentRoute,
    TCustomId,
    TPath
  >,
  TSearchValidator = undefined,
  TParams = ResolveParams<TPath>,
  TRouteContextFn = AnyContext,
  TBeforeLoadFn = AnyContext,
  TLoaderDeps extends Record<string, any> = {},
  TLoaderFn = undefined,
  TChildren = unknown,
  TSSR = unknown,
  const TServerMiddlewares = unknown,
>(
  options: RouteOptions<
    TRegister,
    TParentRoute,
    TId,
    TCustomId,
    TFullPath,
    TPath,
    TSearchValidator,
    TParams,
    TLoaderDeps,
    TLoaderFn,
    AnyContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TSSR,
    TServerMiddlewares
  >,
): Route<
  TRegister,
  TParentRoute,
  TPath,
  TFullPath,
  TCustomId,
  TId,
  TSearchValidator,
  TParams,
  AnyContext,
  TRouteContextFn,
  TBeforeLoadFn,
  TLoaderDeps,
  TLoaderFn,
  TChildren,
  TSSR,
  TServerMiddlewares
>
export function createRemoteRoute(input: unknown) {
  const route = isRouteInstance(input) ? input : createRoute(input as never)

  return prepareRouteTreeMount(route)
}

function isRouteInstance(value: unknown): value is AnyRoute {
  return (
    typeof value === 'object' &&
    value !== null &&
    'options' in value &&
    'addChildren' in value &&
    typeof (value as { addChildren?: unknown }).addChildren === 'function'
  )
}
