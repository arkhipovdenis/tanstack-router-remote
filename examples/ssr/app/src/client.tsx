import { hydrateRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { hydrate } from '@tanstack/react-router/ssr/client'
import { RemoteRouterProvider } from 'tanstack-router-remote/react'
import { createApp } from './app.js'

async function bootstrap() {
  const app = createApp(location.pathname + location.search, false)
  await app.prepare()
  await hydrate(app.router)
  const element = document.getElementById('root')
  if (!element) throw new Error('Missing SSR root')
  hydrateRoot(
    element,
    <RemoteRouterProvider adapter={app.adapter}>
      <RouterProvider router={app.router} />
    </RemoteRouterProvider>,
  )
}
void bootstrap()
