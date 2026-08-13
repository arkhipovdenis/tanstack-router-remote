import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: PluginHome,
})

function PluginHome() {
  return (
    <section className="file-example-card">
      <p className="file-example-eyebrow">Generated index route</p>
          <h2>Plugin-decorated file route example</h2>
      <p>
        Open the catalog normally or paste a deep link. The local
        <code> notFoundComponent </code> becomes the loading boundary before
        the ESM remote tree attaches.
      </p>
      <pre>
        <code>{`export const Route = createFileRoute('/catalog')({ ... })\n// No createRemoteRoute(Route) in this file`}</code>
      </pre>
      <Link to="/catalog" preload={false}>
        Load catalog remote
      </Link>
    </section>
  )
}
