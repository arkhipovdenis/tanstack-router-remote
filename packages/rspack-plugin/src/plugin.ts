import { fileURLToPath } from 'node:url'
import type {
  Compiler,
  RspackPluginInstance,
  RuleSetRule,
} from '@rspack/core'

import {
  DEFAULT_ADAPTER_PACKAGE,
  DEFAULT_HELPER_EXPORT,
  REMOTE_ROUTE_FILE_PATTERN,
} from './constants.js'
import type { RemoteRouteTransformOptions } from './transform.js'

export type TanStackRouterRemoteAdapterOptions =
  RemoteRouteTransformOptions & {
  /** Override the default *.remote.tsx filename contract. */
  test?: RegExp
}

/**
 * Rspack companion for file-based remote mounts.
 *
 * The rule is registered before Rspack compiles module rules and runs as a
 * pre-loader. It leaves the generator-visible route initializer untouched and
 * appends an in-place `createRemoteRoute(Route)` call after it.
 */
export class TanStackRouterRemoteAdapterPlugin
  implements RspackPluginInstance
{
  readonly name = 'TanStackRouterRemoteAdapterPlugin'

  constructor(
    private readonly options: TanStackRouterRemoteAdapterOptions = {},
  ) {}

  apply(compiler: Compiler) {
    const moduleOptions = compiler.options.module

    if (!moduleOptions) {
      throw new Error('Rspack compiler module options were not initialized.')
    }

    const rules = moduleOptions.rules

    rules.push({
      test: this.options.test ?? REMOTE_ROUTE_FILE_PATTERN,
      enforce: 'pre',
      use: [
        {
          loader: fileURLToPath(new URL('./loader.js', import.meta.url)),
          options: {
            adapterPackage:
              this.options.adapterPackage ?? DEFAULT_ADAPTER_PACKAGE,
            helperExport: this.options.helperExport ?? DEFAULT_HELPER_EXPORT,
          },
        },
      ],
    } satisfies RuleSetRule)
  }
}

export function tanstackRouterRemoteAdapter(
  options?: TanStackRouterRemoteAdapterOptions,
) {
  return new TanStackRouterRemoteAdapterPlugin(options)
}
