// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

/**
 * Guards the packaging of the Solid entry, which the React suite cannot cover.
 * Solid's JSX must go through its own Babel preset; an SWC/React-style
 * transform still type-checks and still imports cleanly, and only shows up as
 * a component that renders nothing. Falsified against exactly that: swapping
 * the emitted `createComponent` call for React's `jsx` leaves the host element
 * empty and fails the second test.
 */
describe('solid entry point', () => {
  it('resolves from dist and exports the public surface', async () => {
    const mod =
      await import('../../packages/route-tree-adapter/dist/solid/index.js')

    expect(Object.keys(mod).sort()).toEqual([
      'RemoteRouteMount',
      'RemoteRouterAdapter',
      'RemoteRouterProvider',
      'createRemoteRoute',
    ])
  })

  it('renders a component built by the Solid transform', async () => {
    const { render } = await import('solid-js/web')
    const { RemoteRouterProvider } =
      await import('../../packages/route-tree-adapter/dist/solid/index.js')

    const host = document.createElement('div')
    const adapter = { subscribe: () => () => {}, getSnapshot: () => ({}) }

    const dispose = render(
      () =>
        RemoteRouterProvider({
          adapter,
          children: 'solid-transform-ok',
        } as never) as never,
      host,
    )

    expect(host.textContent).toContain('solid-transform-ok')
    dispose()
  })
})
