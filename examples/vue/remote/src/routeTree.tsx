import { ref } from 'vue'
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
} from '@tanstack/vue-router'

type CatalogItem = { readonly id: string; readonly name: string }

const catalogItems: readonly CatalogItem[] = [
  { id: 'vr-1', name: 'Vue remote item one' },
  { id: 'vr-2', name: 'Vue remote item two' },
]

let rootLoaderRuns = 0

const vueRootRoute = createRootRoute({
  component: VueRemoteRoot,
  loader: () => ({ run: ++rootLoaderRuns }),
})

function VueRemoteRoot() {
  const clicks = ref(0)
  const loaderData = vueRootRoute.useLoaderData()

  return (
    <section data-testid="vue-remote-root">
      <h2>Vue remote route tree</h2>
      <p data-testid="vue-root-loader">root loader #{loaderData.value.run}</p>

      <nav>
        <Link to="/" data-testid="vue-link-index">
          Catalog index
        </Link>{' '}
        <Link
          to="/$itemId"
          params={{ itemId: 'vr-2' }}
          data-testid="vue-link-detail"
        >
          Item vr-2
        </Link>
      </nav>

      <p>
        <button
          type="button"
          data-testid="vue-root-increment"
          onClick={() => (clicks.value += 1)}
        >
          Vue root state +1
        </button>
        <output data-testid="vue-root-state">{clicks.value}</output>
      </p>

      <Outlet />
    </section>
  )
}

const vueIndexRoute = createRoute({
  getParentRoute: () => vueRootRoute,
  path: '/',
  component: function VueRemoteIndex() {
    return (
      <ul data-testid="vue-remote-index">
        {catalogItems.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    )
  },
})

const vueDetailRoute = createRoute({
  getParentRoute: () => vueRootRoute,
  path: '/$itemId',
  loader: ({ params }) => {
    const item = catalogItems.find((entry) => entry.id === params.itemId)

    return { name: item?.name ?? 'unknown item' }
  },
  component: VueRemoteDetail,
})

function VueRemoteDetail() {
  const data = vueDetailRoute.useLoaderData()
  const params = vueDetailRoute.useParams()

  return (
    <article data-testid="vue-remote-detail">
      <h3>{params.value.itemId}</h3>
      <p data-testid="vue-detail-loader">{data.value.name}</p>
    </article>
  )
}

export const routeTree = vueRootRoute.addChildren([
  vueIndexRoute,
  vueDetailRoute,
])
