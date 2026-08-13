import type { Compiler } from '@rspack/core'
import { describe, expect, it } from 'vitest'

import { TanStackRouterRemoteAdapterPlugin } from '../../packages/rspack-plugin/src/plugin.js'
import { transformRemoteRouteModule } from '../../packages/rspack-plugin/src/transform.js'

const routeSource = `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/orders')({
  component: OrdersMount,
})

function OrdersMount() {
  return null
}
`

describe('rspack remote-route transform', () => {
  it('keeps the generator-visible Route initializer and decorates that instance after it', () => {
    const transformed = transformRemoteRouteModule(
      routeSource,
      '/app/src/routes/orders.remote.tsx',
    )

    expect(transformed).toContain(
      "export const Route = createFileRoute('/orders')({",
    )
    expect(transformed).toContain(
      "import { createRemoteRoute as __tanstackRouterRemoteCreateRemoteRoute } from \"@tanstack-router-remote/route-tree-adapter\"",
    )
    expect(transformed).toContain('__tanstackRouterRemoteCreateRemoteRoute(Route)')
    expect(
      transformed.indexOf('__tanstackRouterRemoteCreateRemoteRoute(Route)'),
    ).toBeGreaterThan(transformed.indexOf('component: OrdersMount'))
  })

  it('is idempotent and preserves a semicolon-free declaration', () => {
    const transformed = transformRemoteRouteModule(
      routeSource,
      '/app/src/routes/orders.remote.tsx',
    )

    expect(transformRemoteRouteModule(transformed, '/app/src/routes/orders.remote.tsx')).toBe(
      transformed,
    )
    expect(transformed).toContain('})\n;\n__tanstackRouterRemoteCreateRemoteRoute(Route)')
  })

  it('uses an alias that cannot collide with a route-local binding', () => {
    const transformed = transformRemoteRouteModule(
      `${routeSource}\nconst __tanstackRouterRemoteCreateRemoteRoute = 'local'\n`,
      '/app/src/routes/orders.remote.tsx',
    )

    expect(transformed).toContain(
      'createRemoteRoute as __tanstackRouterRemoteCreateRemoteRoute1',
    )
    expect(transformed).toContain('__tanstackRouterRemoteCreateRemoteRoute1(Route)')
  })

  it('rejects a remote filename that does not expose the direct generated shape', () => {
    expect(() =>
      transformRemoteRouteModule(
        'export const Route = createRemoteRoute({})',
        '/app/src/routes/orders.remote.tsx',
      ),
    ).toThrow('must export `const Route = createFileRoute(...)(...)`')
  })

  it('rejects an outer wrapper around createFileRoute so generator support stays explicit', () => {
    expect(() =>
      transformRemoteRouteModule(
        `export const Route = createRemoteRoute(
          createFileRoute('/orders')({ component: OrdersMount }),
        )`,
        '/app/src/routes/orders.remote.tsx',
      ),
    ).toThrow('must export `const Route = createFileRoute(...)(...)`')
  })

  it('adds a pre-loader rule to the Rspack compiler before rules are compiled', () => {
    const compiler = {
      options: {
        module: {
          rules: [],
        },
      },
    } as unknown as Compiler
    const plugin = new TanStackRouterRemoteAdapterPlugin({
      adapterPackage: '@company/router-adapter',
      helperExport: 'markRemoteRoute',
    })

    plugin.apply(compiler)

    expect(compiler.options.module.rules).toHaveLength(1)
    expect(compiler.options.module.rules[0]).toMatchObject({
      enforce: 'pre',
      test: /\.remote\.[cm]?[jt]sx?$/,
      use: [
        {
          options: {
            adapterPackage: '@company/router-adapter',
            helperExport: 'markRemoteRoute',
          },
        },
      ],
    })
  })
})
