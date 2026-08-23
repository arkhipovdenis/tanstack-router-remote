import { useEffect, useRef } from 'react'

/**
 * Rendering interop, which the adapter deliberately does not provide.
 *
 * Grafting a remote route tree is framework-neutral — it operates on
 * `router-core` objects, so a Solid or Vue tree lands in the React host's
 * `routesById` like any other. Rendering is not: React cannot render a Solid
 * component (it returns DOM nodes) or a Vue one (it returns VNodes).
 *
 * The bridge is therefore a React component that owns an empty element and
 * hands it to the other framework's own renderer. That framework mounts into
 * it, and unmounts when React tears the element down.
 *
 * `@module-federation/bridge-react` and `bridge-vue3` solve the same problem,
 * but they mount a remote *application with its own router* and take a
 * `basename`. That is the opposite of what this package does — one host router
 * for every remote — so the island is kept minimal and router-free here.
 */
function useIsland(mount: (container: HTMLElement) => () => void) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    return mount(container)
    // Deliberately empty: `mount` closes over this island's route data and is
    // recreated on every render, so depending on it would remount the foreign
    // application on every host render.
  }, [])

  return containerRef
}

export function SolidIsland({
  component,
  data,
}: {
  component: never
  data: unknown
}) {
  const ref = useIsland((container) => {
    // Imported lazily so a host that never opens this route pays nothing.
    let dispose: (() => void) | undefined
    // The import is async, so the effect can be torn down before it lands -
    // React StrictMode does exactly that on every mount. Without the flag the
    // cleanup runs while `dispose` is still undefined and the render that
    // arrives afterwards leaks into a detached container.
    let cancelled = false
    const Component = component as unknown as (props: {
      data: unknown
    }) => unknown

    void import('solid-js/web').then(({ render }) => {
      if (cancelled) {
        return
      }

      dispose = render(() => Component({ data }) as never, container)
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  })

  return <div data-testid="solid-island" ref={ref} />
}

export function VueIsland({
  component,
  data,
}: {
  component: never
  data: unknown
}) {
  const ref = useIsland((container) => {
    let unmount: (() => void) | undefined
    let cancelled = false

    void import('vue').then(({ createApp, h }) => {
      if (cancelled) {
        return
      }

      const app = createApp({ render: () => h(component as never, { data }) })
      app.mount(container)
      unmount = () => app.unmount()
    })

    return () => {
      cancelled = true
      unmount?.()
    }
  })

  return <div data-testid="vue-island" ref={ref} />
}
