import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: VirtualRoutingHome,
})

function VirtualRoutingHome() {
  return (
    <section className="file-example-card">
      <p className="file-example-eyebrow">Generated index route</p>
      <h2>Virtual route config</h2>
      <p>
        This example proves the same mount form works when TanStack derives no
        paths from filenames at all.
      </p>
      <pre>
        <code>{`// src/routes.ts\nlayout('shell.tsx', [\n  route('/catalog', 'catalog-mount.tsx'),\n])`}</code>
      </pre>
      <Link to="/catalog" preload={false}>
        Load catalog remote
      </Link>
    </section>
  )
}
