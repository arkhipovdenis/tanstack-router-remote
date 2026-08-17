import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * A pathless layout contributed by the virtual config. It adds a match above
 * the remote mount without changing its URL, which is what makes the mount's
 * fuzzy-404 handoff worth checking in this example: the deep link resolves
 * through this layout before reaching `/catalog`.
 */
export const Route = createFileRoute('/_shell')({
  component: VirtualShell,
})

function VirtualShell() {
  return (
    <section className="file-example-shell-frame">
      <p className="file-example-eyebrow">Virtual pathless layout</p>
      <Outlet />
    </section>
  )
}
