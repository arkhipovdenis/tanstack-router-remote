import type { LoaderDefinition } from '@rspack/core'

import {
  transformRemoteRouteModule,
  type RemoteRouteTransformOptions,
} from './transform.js'

const remoteRouteLoader: LoaderDefinition<RemoteRouteTransformOptions> =
  function remoteRouteLoader(source) {
    return transformRemoteRouteModule(
      source,
      this.resourcePath,
      this.getOptions(),
    )
  }

export default remoteRouteLoader
