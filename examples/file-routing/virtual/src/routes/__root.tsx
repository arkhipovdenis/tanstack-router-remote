import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: VirtualRoutingShell,
})

function VirtualRoutingShell() {
  return (
    <main className="file-example-shell">
      <header className="file-example-header">
        <div>
          <p className="file-example-eyebrow">TanStack file routing</p>
          <h1>Virtual file routes</h1>
        </div>
        <span className="file-example-badge">virtual routes</span>
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
        Every URL here is declared in <code>src/routes.ts</code>, not derived
        from a filename: the mount lives in <code>catalog-mount.tsx</code> and
        still serves <code>/catalog</code>, below a pathless layout. It is the
        same <code>createRemoteRoute(...)</code> wrapper as the physical
        example.
      </p>
      <Outlet />
    </main>
  )
}
