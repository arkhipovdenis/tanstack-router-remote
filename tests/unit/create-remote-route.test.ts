import {
  createFileRoute,
  createRootRoute,
  createRoute,
  type AnyRoute,
} from '@tanstack/react-router'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { createRemoteRoute } from '../../packages/route-tree-adapter/src'

const Null = () => null

function childRoutesOf(route: AnyRoute) {
  if (Array.isArray(route.children)) {
    return route.children as AnyRoute[]
  }

  return Object.values(route.children ?? {}) as AnyRoute[]
}

describe('createRemoteRoute', () => {
  it('creates the childless local fuzzy mount needed before router creation', () => {
    const root = createRootRoute({ component: Null })
    const mount = createRemoteRoute({
      getParentRoute: () => root,
      path: '/orders',
      component: Null,
      notFoundComponent: Null,
    })

    expect(mount.parentRoute).toBeUndefined()
    expect(childRoutesOf(mount)).toEqual([])
    expect(mount.children).toEqual([])
  })

  it('preserves TanStack createRoute inference for params, search, and loader data', () => {
    const root = createRootRoute({ component: Null })
    const mount = createRemoteRoute({
      getParentRoute: () => root,
      path: '/orders/$orderId',
      component: Null,
      notFoundComponent: Null,
      validateSearch: (search) => ({
        tab:
          typeof (search as { tab?: unknown }).tab === 'string'
            ? (search as { tab: string }).tab
            : 'overview',
      }),
      loaderDeps: ({ search }) => ({ tab: search.tab }),
      loader: ({ deps, params }) => ({
        orderId: params.orderId,
        tab: deps.tab,
      }),
    })

    const acceptsInferredParams: { orderId: string } =
      null as never as (typeof mount)['types']['params']
    const acceptsExpectedParams: (typeof mount)['types']['params'] = {
      orderId: '42',
    }

    expectTypeOf(acceptsInferredParams).toEqualTypeOf<{
      orderId: string
    }>()
    expectTypeOf(acceptsExpectedParams).toMatchTypeOf<{
      orderId: string
    }>()
    expectTypeOf<(typeof mount)['types']['searchSchema']>().toEqualTypeOf<{
      tab: string
    }>()
    expectTypeOf<(typeof mount)['types']['loaderData']>().toEqualTypeOf<{
      orderId: string
      tab: string
    }>()
    expectTypeOf(mount.fullPath).toEqualTypeOf<'/orders/$orderId'>()
  })

  it('returns the exact same route type when decorating an instance', () => {
    const root = createRootRoute({ component: Null })
    const plain = createRoute({
      getParentRoute: () => root,
      path: '/orders/$orderId',
      component: Null,
      validateSearch: () => ({ tab: 'overview' }),
    })

    // The instance overload must be identity-preserving, not a widening pass
    // through AnyRoute: `fullPath` stays a literal and the inferred types
    // survive.
    const decorated = createRemoteRoute(plain)

    expectTypeOf(decorated).toEqualTypeOf(plain)
    expectTypeOf(decorated.fullPath).toEqualTypeOf<'/orders/$orderId'>()
    const decoratedParams: { orderId: string } =
      null as never as (typeof decorated)['types']['params']

    expectTypeOf(decoratedParams).toEqualTypeOf<{ orderId: string }>()
    expectTypeOf<(typeof decorated)['types']['searchSchema']>().toEqualTypeOf<{
      tab: string
    }>()
    expect(decorated).toBe(plain)
  })

  it('keeps preparation idempotent for a childless route', () => {
    const root = createRootRoute({ component: Null })
    const mount = createRoute({
      getParentRoute: () => root,
      path: '/orders',
      component: Null,
      notFoundComponent: Null,
    })

    expect(createRemoteRoute(mount)).toBe(mount)
    expect(createRemoteRoute(mount)).toBe(mount)
    expect(childRoutesOf(mount)).toEqual([])
  })

  it('prepares a generator-style file route in place', () => {
    const Route = createFileRoute('/orders' as never)({
      component: Null,
      notFoundComponent: Null,
    }) as unknown as AnyRoute

    const configuredRoute = createRemoteRoute(Route)

    expect(configuredRoute).toBe(Route)
    expect(childRoutesOf(Route)).toEqual([])
  })

  it('rejects a route that already has static children', () => {
    const root = createRootRoute({ component: Null })
    const mount = createRoute({
      getParentRoute: () => root,
      path: '/orders',
      component: Null,
      notFoundComponent: Null,
    })
    const child = createRoute({
      getParentRoute: () => mount,
      path: '/static',
      component: Null,
    })

    mount.addChildren([child])

    expect(() => createRemoteRoute(mount)).toThrow(
      'must not have static children',
    )
  })
})
