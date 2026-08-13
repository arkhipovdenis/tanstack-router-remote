import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: FilePluginShell,
})

function FilePluginShell() {
  return (
    <main className="file-example-shell">
      <header className="file-example-header">
        <div>
          <p className="file-example-eyebrow">TanStack file routing</p>
          <h1>Plugin-decorated remote mount</h1>
        </div>
        <span className="file-example-badge">plugin mode</span>
      </header>
      <nav className="file-example-nav" aria-label="File-route plugin navigation">
        <Link to="/">Host home</Link>
        <Link to="/catalog" preload={false}>
          Load catalog remote
        </Link>
        <Link
          to={'/catalog/$productId' as never}
          params={{ productId: 'SKU-42' } as never}
        >
          Direct remote detail
        </Link>
      </nav>
      <p className="file-example-note">
        The file route below uses a normal generated TanStack route tree. Its
        <code> *.remote.tsx </code> source contains no decorator call: the
        companion Rspack plugin appends it during compilation.
      </p>
      <Outlet />
    </main>
  )
}
