import { defineComponent, ref } from 'vue'
import { createRootRoute, createRoute } from '@tanstack/vue-router'

/**
 * The second-level Vue remote: a tree grafted inside a tree that was itself
 * grafted into the React host. Reaching its detail route by a direct URL is
 * the case that regressed in router-core 1.171.16.
 */
const notes = [
  { id: 'n-1', text: 'Vue nested note one' },
  { id: 'n-2', text: 'Vue nested note two' },
]

let runs = 0

const VueNestedRoot = defineComponent({
  name: 'VueNestedRoot',
  props: { data: { type: Object, required: false } },
  setup(props) {
    const clicks = ref(0)

    return () => (
      <section data-testid="vue-nested-root">
        <h3>Vue nested tree</h3>
        <p data-testid="vue-nested-loader">
          nested loader #{(props.data as { run?: number } | undefined)?.run}
        </p>
        <button
          type="button"
          data-testid="vue-nested-increment"
          onClick={() => (clicks.value += 1)}
        >
          Nested state +1
        </button>
        <output data-testid="vue-nested-state">{clicks.value}</output>
      </section>
    )
  },
})

const rootRoute = createRootRoute({
  component: VueNestedRoot,
  loader: () => ({ run: ++runs }),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <ul data-testid="vue-nested-index">
      {notes.map((note) => (
        <li key={note.id}>{note.text}</li>
      ))}
    </ul>
  ),
})

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$noteId',
  loader: ({ params }) => ({
    text: notes.find((note) => note.id === params.noteId)?.text ?? 'unknown',
  }),
  component: function VueNestedDetail(props: { data?: { text: string } }) {
    return (
      <article data-testid="vue-nested-detail">
        <p data-testid="vue-nested-detail-text">{props.data?.text}</p>
      </article>
    )
  },
})

export const nestedRouteTree = rootRoute.addChildren([indexRoute, detailRoute])
