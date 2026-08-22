import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/react'

import { demoRuntimeProbe, router } from './router'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Host root element was not found')
}

// One coordinator owns every mutable route-tree attach for this host router.
const routeTreeAdapter = new RemoteRouterAdapter(() => router)
demoRuntimeProbe.routeTreeAdapter = routeTreeAdapter

createRoot(rootElement).render(
  <StrictMode>
    <RemoteRouterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RemoteRouterProvider>
  </StrictMode>,
)
