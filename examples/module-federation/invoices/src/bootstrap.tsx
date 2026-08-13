import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import {
  RouteTreeUpdateAdapter,
  RouteTreeUpdateAdapterProvider,
} from '@tanstack-router-remote/route-tree-adapter'

import { routeTree } from './routeTree'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Invoices remote root element was not found')
}

const router = createRouter({ routeTree })
const routeTreeAdapter = new RouteTreeUpdateAdapter(() => router)

createRoot(rootElement).render(
  <StrictMode>
    <RouteTreeUpdateAdapterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RouteTreeUpdateAdapterProvider>
  </StrictMode>,
)
