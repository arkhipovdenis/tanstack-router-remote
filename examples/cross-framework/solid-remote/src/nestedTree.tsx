import { createSignal } from 'solid-js'
import { createRootRoute, createRoute } from '@tanstack/solid-router'

/**
 * The second-level Solid remote: a tree grafted inside a tree that was itself
 * grafted into the React host. Reaching its detail route by a direct URL is
 * the case that regressed in router-core 1.171.16.
 */
const notes = [
  { id: 'n-1', text: 'Solid nested note one' },
  { id: 'n-2', text: 'Solid nested note two' },
]

let runs = 0

const rootRoute = createRootRoute({
  loader: () => ({ run: ++runs }),
})

rootRoute.update({
  component: (props: { data?: { run: number } }) => {
    const [clicks, setClicks] = createSignal(0)

    return (
      <section data-testid="solid-nested-root">
        <h3>Solid nested tree</h3>
        <p data-testid="solid-nested-loader">
          nested loader #{props.data?.run}
        </p>
        <button
          type="button"
          data-testid="solid-nested-increment"
          onClick={() => setClicks((value) => value + 1)}
        >
          Nested state +1
        </button>
        <output data-testid="solid-nested-state">{clicks()}</output>
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
    <ul data-testid="solid-nested-index">
      {notes.map((note) => (
        <li>{note.text}</li>
      ))}
    </ul>
  ),
} as never)

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$noteId',
  loader: ({ params }) => ({
    text: notes.find((note) => note.id === params.noteId)?.text ?? 'unknown',
  }),
})

detailRoute.update({
  component: (props: { data?: { text: string } }) => (
    <article data-testid="solid-nested-detail">
      <p data-testid="solid-nested-detail-text">{props.data?.text}</p>
    </article>
  ),
} as never)

export const nestedRouteTree = rootRoute.addChildren([indexRoute, detailRoute])
