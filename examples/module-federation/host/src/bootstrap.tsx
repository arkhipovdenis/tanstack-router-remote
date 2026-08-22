import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import {
  RouteTreeUpdateAdapter,
  RouteTreeUpdateAdapterProvider,
} from 'tanstack-router-remote'

import { demoRuntimeProbe, router } from './router'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Host root element was not found')
}

// One coordinator owns every mutable route-tree attach for this host router.
const routeTreeAdapter = new RouteTreeUpdateAdapter(() => router)
demoRuntimeProbe.routeTreeAdapter = routeTreeAdapter

createRoot(rootElement).render(
  <StrictMode>
    <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RouteTreeUpdateAdapterProvider>
  </StrictMode>,
)
