import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import { RouterContextProvider, Scripts } from '@tanstack/react-router'
import {
  attachRouterServerSsrUtils,
  renderRouterToString,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { RemoteRouterProvider } from 'tanstack-router-remote/react'
import { createApp } from './app.js'

const assets = fileURLToPath(new URL('../client/', import.meta.url))
createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost:3600')
    if (url.pathname.startsWith('/static/')) {
      const path = resolve(assets, '.' + decodeURIComponent(url.pathname))
      if (!path.startsWith(resolve(assets) + sep)) {
        response.writeHead(403).end()
        return
      }
      response.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
      )
      response.end(await readFile(path))
      return
    }
    const clientHtml = await readFile(resolve(assets, 'client.html'), 'utf8')
    const scripts = [...clientHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
      (match) => match[1],
    )
    const app = createApp(url.pathname + url.search, true)
    attachRouterServerSsrUtils({ router: app.router, manifest: undefined })
    await app.prepare()
    await app.router.load()
    await app.router.serverSsr!.dehydrate()
    const rendered = await renderRouterToString({
      router: app.router,
      responseHeaders: new Headers({
        'Content-Type': 'text/html; charset=utf-8',
      }),
      children: (
        <html>
          <head>
            <title>Remote SSR example</title>
          </head>
          <body>
            <RemoteRouterProvider adapter={app.adapter}>
              <RouterContextProvider router={app.router}>
                <div id="root">
                  <RouterServer router={app.router} />
                </div>
                <Scripts />
              </RouterContextProvider>
            </RemoteRouterProvider>
            {scripts.map((src) => (
              <script key={src} src={src} defer />
            ))}
          </body>
        </html>
      ),
    })
    response.writeHead(rendered.status, Object.fromEntries(rendered.headers))
    response.end(await rendered.text())
  } catch (error) {
    console.error(error)
    response.writeHead(500).end('SSR example failed')
  }
}).listen(3600, 'localhost', () =>
  console.log('SSR example: http://localhost:3600/orders/42'),
)
