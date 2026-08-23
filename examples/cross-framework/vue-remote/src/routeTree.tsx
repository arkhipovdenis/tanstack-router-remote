import { ref } from 'vue'
import { createRootRoute, createRoute } from '@tanstack/vue-router'

/**
 * A Vue route tree meant to be grafted into a host of another framework. Its
 * components take route data as a `data` prop instead of calling
 * `useLoaderData()`: the host mounts them as their own Vue application, which
 * puts them outside this router's match context.
 */
const items = [
  { id: 'vr-1', name: 'Vue item one' },
  { id: 'vr-2', name: 'Vue item two' },
]

let runs = 0

const rootRoute = createRootRoute({
  component: VueRemoteRoot,
  loader: () => ({ run: ++runs }),
})

function VueRemoteRoot(props: { data?: { run: number } }) {
  const clicks = ref(0)

  return (
    <section data-testid="vue-remote-root">
      <h2>Vue route tree</h2>
      <p data-testid="vue-root-loader">vue root loader #{props.data?.run}</p>
      <button
        type="button"
        data-testid="vue-root-increment"
        onClick={() => (clicks.value += 1)}
      >
        Vue state +1
      </button>
      <output data-testid="vue-root-state">{clicks.value}</output>
    </section>
  )
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function VueRemoteIndex() {
    return (
      <ul data-testid="vue-remote-index">
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    )
  },
})

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$itemId',
  loader: ({ params }) => ({
    name: items.find((item) => item.id === params.itemId)?.name ?? 'unknown',
  }),
  component: function VueRemoteDetail(props: { data?: { name: string } }) {
    return (
      <article data-testid="vue-remote-detail">
        <p data-testid="vue-detail-loader">{props.data?.name}</p>
      </article>
    )
  },
})

export const routeTree = rootRoute.addChildren([indexRoute, detailRoute])
