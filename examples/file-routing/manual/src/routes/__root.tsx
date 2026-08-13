import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: FileManualShell,
})

function FileManualShell() {
  return (
    <main className="file-example-shell">
      <header className="file-example-header">
        <div>
          <p className="file-example-eyebrow">TanStack file routing</p>
          <h1>Manually decorated remote mount</h1>
        </div>
        <span className="file-example-badge">manual mode</span>
      </header>
      <nav className="file-example-nav" aria-label="File-route manual navigation">
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
        explicitly calls <code>createRemoteRoute(Route)</code> after its
        generator-visible declaration; no companion plugin is installed.
      </p>
      <Outlet />
    </main>
  )
}
