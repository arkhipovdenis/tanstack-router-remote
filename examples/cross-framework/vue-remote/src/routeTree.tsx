import { defineComponent, ref } from 'vue'
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

// `defineComponent` with a setup-returned render function, not a plain
// function component: a bare function runs on every render, so `ref(0)` would
// be recreated each time and the counter could never move off zero.
const VueRemoteRoot = defineComponent({
  name: 'VueRemoteRoot',
  props: { data: { type: Object, required: false } },
  setup(props) {
    const clicks = ref(0)

    return () => (
      <section data-testid="vue-remote-root">
        <h2>Vue route tree</h2>
        <p data-testid="vue-root-loader">
          vue root loader #{(props.data as { run?: number } | undefined)?.run}
        </p>
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
  },
})

const rootRoute = createRootRoute({
  component: VueRemoteRoot,
  loader: () => ({ run: ++runs }),
})

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

/**
 * A mount inside this remote tree, for the second level of nesting. The host
 * recognises it and keeps it React-rendered: a `RemoteRouteMount` has to stay
 * in the host's own tree, since an island would cut it off from the adapter.
 */
const nestedMountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nested',
  staticData: { crossFrameworkMount: 'vue-nested' },
})

nestedMountRoute.addChildren([])

export const routeTree = rootRoute.addChildren([
  indexRoute,
  detailRoute,
  nestedMountRoute,
])
