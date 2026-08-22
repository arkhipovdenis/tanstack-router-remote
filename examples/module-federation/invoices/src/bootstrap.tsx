import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/react'

import { routeTree } from './routeTree'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Invoices remote root element was not found')
}

const router = createRouter({ routeTree })
const routeTreeAdapter = new RemoteRouterAdapter(() => router)

createRoot(rootElement).render(
  <StrictMode>
    <RemoteRouterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RemoteRouterProvider>
  </StrictMode>,
)
