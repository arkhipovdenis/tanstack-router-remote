import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import {
  RemoteRouterAdapter,
  RemoteRouterProvider,
} from 'tanstack-router-remote/react'

import { router } from './router'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('File-routing host root element was not found')
}

const routeTreeAdapter = new RemoteRouterAdapter(() => router)

createRoot(rootElement).render(
  <StrictMode>
    <RemoteRouterProvider adapter={routeTreeAdapter}>
      <RouterProvider router={router} />
    </RemoteRouterProvider>
  </StrictMode>,
)
