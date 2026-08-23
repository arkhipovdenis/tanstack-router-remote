import { createSignal } from 'solid-js'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
} from '@tanstack/solid-router'

type CatalogItem = { readonly id: string; readonly name: string }

const catalogItems: readonly CatalogItem[] = [
  { id: 'sr-1', name: 'Solid remote item one' },
  { id: 'sr-2', name: 'Solid remote item two' },
]

let rootLoaderRuns = 0

function SolidRemoteRoot() {
  const [clicks, setClicks] = createSignal(0)

  return (
    <section data-testid="solid-remote-root">
      <h2>Solid remote route tree</h2>
      <p data-testid="solid-root-loader">
        root loader #{solidRootRoute.useLoaderData()().run}
      </p>

      <nav>
        <Link to="/" data-testid="solid-link-index">
          Catalog index
        </Link>
        <Link
          to="/$itemId"
          params={{ itemId: 'sr-2' }}
          data-testid="solid-link-detail"
        >
          Item sr-2
        </Link>
      </nav>

      <p>
        <button
          type="button"
          data-testid="solid-root-increment"
          onClick={() => setClicks((value) => value + 1)}
        >
          Solid root state +1
        </button>
        <output data-testid="solid-root-state">{clicks()}</output>
      </p>

      <Outlet />
    </section>
  )
}

const solidRootRoute = createRootRoute({
  component: SolidRemoteRoot,
  loader: () => ({ run: ++rootLoaderRuns }),
})

const solidIndexRoute = createRoute({
  getParentRoute: () => solidRootRoute,
  path: '/',
  component: function SolidIndex() {
    return (
      <ul data-testid="solid-remote-index">
        {catalogItems.map((item) => (
          <li>{item.name}</li>
        ))}
      </ul>
    )
  },
})

const solidDetailRoute = createRoute({
  getParentRoute: () => solidRootRoute,
  path: '/$itemId',
  loader: ({ params }) => {
    const item = catalogItems.find((entry) => entry.id === params.itemId)

    return { name: item?.name ?? 'unknown item' }
  },
  component: function SolidDetail() {
    const data = solidDetailRoute.useLoaderData()
    const params = solidDetailRoute.useParams()

    return (
      <article data-testid="solid-remote-detail">
        <h3>{params().itemId}</h3>
        <p data-testid="solid-detail-loader">{data().name}</p>
      </article>
    )
  },
})

export const routeTree = solidRootRoute.addChildren([
  solidIndexRoute,
  solidDetailRoute,
])
