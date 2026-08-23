import { createApp } from 'vue'
import { RouterProvider } from '@tanstack/vue-router'
import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/vue'

import { router } from './router'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('#root is missing')
}

const routeTreeAdapter = new RemoteRouterAdapter(() => router)

createApp(() => (
  <RemoteRouterProvider adapter={routeTreeAdapter}>
    <RouterProvider router={router} />
  </RemoteRouterProvider>
)).mount(rootElement)
