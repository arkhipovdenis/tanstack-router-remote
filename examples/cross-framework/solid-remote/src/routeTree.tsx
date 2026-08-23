import { createSignal } from 'solid-js'
import { createRootRoute, createRoute } from '@tanstack/solid-router'

/**
 * A Solid route tree meant to be grafted into a host of another framework.
 *
 * Its components take route data as a `data` prop instead of calling
 * `useLoaderData()`. That is the one concession the cross-framework case
 * requires: the host mounts these components as their own Solid application,
 * which puts them outside this router's match context, so the framework-bound
 * hooks have nothing to read. The host reads the match and passes it across.
 */
const items = [
  { id: 'sr-1', name: 'Solid item one' },
  { id: 'sr-2', name: 'Solid item two' },
]

let runs = 0

const rootRoute = createRootRoute({
  loader: () => ({ run: ++runs }),
})

rootRoute.update({
  component: (props: { data?: { run: number } }) => {
    const [clicks, setClicks] = createSignal(0)

    return (
      <section data-testid="solid-remote-root">
        <h2>Solid route tree</h2>
        <p data-testid="solid-root-loader">
          solid root loader #{props.data?.run}
        </p>
        <button
          type="button"
          data-testid="solid-root-increment"
          onClick={() => setClicks((value) => value + 1)}
        >
          Solid state +1
        </button>
        <output data-testid="solid-root-state">{clicks()}</output>
      </section>
    )
  },
} as never)

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
})

indexRoute.update({
  component: () => (
    <ul data-testid="solid-remote-index">
      {items.map((item) => (
        <li>{item.name}</li>
      ))}
    </ul>
  ),
} as never)

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$itemId',
  loader: ({ params }) => ({
    name: items.find((item) => item.id === params.itemId)?.name ?? 'unknown',
  }),
})

detailRoute.update({
  component: (props: { data?: { name: string } }) => (
    <article data-testid="solid-remote-detail">
      <p data-testid="solid-detail-loader">{props.data?.name}</p>
    </article>
  ),
} as never)

export const routeTree = rootRoute.addChildren([indexRoute, detailRoute])
