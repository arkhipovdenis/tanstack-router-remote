import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  basepath: '/file-routing-virtual',
  // See the module-federation host: scoped imperative preload makes this safe.
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
