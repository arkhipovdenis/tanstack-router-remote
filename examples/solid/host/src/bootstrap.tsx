import { render } from 'solid-js/web'
import { RouterProvider } from '@tanstack/solid-router'
import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/solid'

import { router } from './router'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('#root is missing')
}

const routeTreeAdapter = new RemoteRouterAdapter(() => router)

render(
  () => (
    <RemoteRouterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RemoteRouterProvider>
  ),
  rootElement,
)
