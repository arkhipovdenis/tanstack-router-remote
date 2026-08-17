import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: FileRoutingShell,
})

function FileRoutingShell() {
  return (
    <main className="file-example-shell">
      <header className="file-example-header">
        <div>
          <p className="file-example-eyebrow">TanStack file routing</p>
          <h1>File-route remote mount</h1>
        </div>
        <span className="file-example-badge">file routes</span>
      </header>
      <nav className="file-example-nav" aria-label="File-route navigation">
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
        This host uses TanStack&apos;s generated route tree. The file route
        wraps its declaration in <code>createRemoteRoute(...)</code>, which the
        generator reads through; no build-time transform is involved.
      </p>
      <Outlet />
    </main>
  )
}
