# Renderer bindings

Every binding uses the same core attach/prepare lifecycle. Use the entry matching
the renderer that owns the route components. The following links point to code
included in the repository's typecheck and production example builds.

| Renderer | Router peer              | Adapter entry                  | Complete host and remote                   |
| -------- | ------------------------ | ------------------------------ | ------------------------------------------ |
| React    | `@tanstack/react-router` | `tanstack-router-remote/react` | [native import](../examples/native-import) |
| Solid    | `@tanstack/solid-router` | `tanstack-router-remote/solid` | [Solid example](../examples/solid)         |
| Vue      | `@tanstack/vue-router`   | `tanstack-router-remote/vue`   | [Vue example](../examples/vue)             |

For all three, create a static mount with `createRemoteRoute`, add it to the host
tree, create the router, then supply one RemoteRouterAdapter above RouterProvider.
The mount component uses RemoteRouteMount with a loader returning `module.routeTree`
and renders the router Outlet after attachment. Keep the loader and mount stable
rather than allocating a new route tree on each component render.

React uses elements/children. Solid uses its own JSX and reactive components.
Vue uses its component props and slots; follow the Vue example rather than
pasting a React JSX callback into a Vue template. Do not install React merely to
use the Vue binding. Runtime/deep-link regressions exist for all three bindings;
SSR hydration evidence currently comes from the React fixture.

The [file routing guide](../examples/file-routing/README.md) covers wrapping an
existing generated route declaration and pathless route IDs. The
[cross-framework example](../examples/cross-framework/README.md) explicitly owns
renderer interoperability; it is not a feature the adapter automatically adds.
