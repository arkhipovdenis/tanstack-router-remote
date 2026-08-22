import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import {
  RouteTreeUpdateAdapter,
  RouteTreeUpdateAdapterProvider,
} from 'tanstack-router-remote'

import { router } from './router'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Native import host root element was not found')
}

// The host owns the only mutable attachment coordinator and router instance.
const routeTreeAdapter = new RouteTreeUpdateAdapter(() => router)

createRoot(rootElement).render(
  <StrictMode>
    <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RouteTreeUpdateAdapterProvider>
  </StrictMode>,
)
