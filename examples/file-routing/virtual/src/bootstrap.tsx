import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import {
  RouteTreeUpdateAdapter,
  RouteTreeUpdateAdapterProvider,
} from 'tanstack-router-remote/react'

import { router } from './router'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Virtual file-routing host root element was not found')
}

const routeTreeAdapter = new RouteTreeUpdateAdapter(() => router)

createRoot(rootElement).render(
  <StrictMode>
    <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RouteTreeUpdateAdapterProvider>
  </StrictMode>,
)
