import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: FileRoutingHome,
})

function FileRoutingHome() {
  return (
    <section className="file-example-card">
      <p className="file-example-eyebrow">Generated index route</p>
      <h2>File-route remote mount</h2>
      <p>
        This example proves the library works with standard TanStack file-based
        routing, with no build-time transform involved.
      </p>
      <pre>
        <code>{`export const Route = createRemoteRoute(\n  createFileRoute('/catalog')({ ... }),\n)`}</code>
      </pre>
      <Link to="/catalog" preload={false}>
        Load catalog remote
      </Link>
    </section>
  )
}
