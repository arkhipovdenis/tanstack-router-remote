import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: ManualHome,
})

function ManualHome() {
  return (
    <section className="file-example-card">
      <p className="file-example-eyebrow">Generated index route</p>
      <h2>Manual file-route decoration</h2>
      <p>
        This example proves the library works with standard TanStack
        file-based routing without the Rspack companion plugin.
      </p>
      <pre>
        <code>{`export const Route = createFileRoute('/catalog')({ ... })\ncreateRemoteRoute(Route)`}</code>
      </pre>
      <Link to="/catalog" preload={false}>
        Load catalog remote
      </Link>
    </section>
  )
}
