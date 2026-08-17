import {
  index,
  layout,
  rootRoute,
  route,
} from '@tanstack/virtual-file-routes'

/**
 * Virtual route config: the URL of every route is declared here, not derived
 * from a filename. `catalog-mount.tsx` is deliberately named nothing like
 * `/catalog` — it is the config below that decides where the remote mount
 * lives, and the mount itself is a normal `createRemoteRoute(...)` wrapper.
 */
export const routes = rootRoute('__root.tsx', [
  index('home.tsx'),
  layout('shell.tsx', [route('/catalog', 'catalog-mount.tsx')]),
])
