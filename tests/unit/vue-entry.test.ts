// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

/**
 * Guards the packaging of the Vue entry. Unlike React and Solid, these
 * components are written with `defineComponent` + `h()`, so no JSX transform is
 * involved — what this checks is that the entry resolves, exports its public
 * surface, and that its components actually mount and render through Vue.
 */
describe('vue entry point', () => {
  it('resolves from dist and exports the public surface', async () => {
    const mod =
      await import('../../packages/route-tree-adapter/dist/vue/index.js')

    expect(Object.keys(mod).sort()).toEqual([
      'RemoteRouteMount',
      'RemoteRouterAdapter',
      'RemoteRouterProvider',
      'createRemoteRoute',
    ])
  })

  it('mounts the provider and renders its slot', async () => {
    const { createApp, h } = await import('vue')
    const { RemoteRouterProvider } =
      await import('../../packages/route-tree-adapter/dist/vue/index.js')

    const host = document.createElement('div')
    const adapter = { subscribe: () => () => {}, getSnapshot: () => ({}) }

    const app = createApp({
      render: () =>
        h(RemoteRouterProvider, { adapter } as never, {
          default: () => 'vue-render-ok',
        }),
    })

    app.mount(host)
    expect(host.textContent).toContain('vue-render-ok')
    app.unmount()
  })
})
