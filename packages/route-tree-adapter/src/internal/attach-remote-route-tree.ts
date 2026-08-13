import type {
  AnyRoute,
  AnyRouter,
  NotFoundRouteComponent,
} from '@tanstack/react-router'

import type {
  AttachRemoteRouteTreeOptions,
  RouterGetter,
} from '../types.js'
import {
  claimRemoteRouteTreeMount,
  releaseRemoteRouteTreeMount,
} from './ownership.js'
import {
  cloneHostRootForUpdate,
  graftRemoteRouteTree,
} from './route-tree.js'

export type RouteTreeAttachmentResult =
  | { readonly kind: 'attached' }
  | {
      readonly kind: 'failed'
      readonly error: Error
      readonly hostTreeWasMutated: boolean
    }

export type RouteTreePreparationResult =
  | { readonly kind: 'prepared' }
  | {
      readonly kind: 'failed'
      readonly error: Error
      readonly hostTreeWasMutated: boolean
    }

export interface RouteTreeAttachmentTransaction {
  execute(
    options: AttachRemoteRouteTreeOptions,
  ): Promise<RouteTreeAttachmentResult>
  prepare(
    options: AttachRemoteRouteTreeOptions,
  ): Promise<RouteTreePreparationResult>
  loadPrepared(): Promise<RouteTreeAttachmentResult>
}

/**
 * Encapsulates the TanStack-specific mutable operation. It is deliberately
 * internal so the public adapter does not expose grafting implementation
 * details as an extension API.
 */
export class TanStackRouteTreeAttachmentTransaction<
  TRouter extends AnyRouter = AnyRouter,
> implements RouteTreeAttachmentTransaction {
  private router: TRouter | undefined

  constructor(private readonly resolveRouter: RouterGetter<TRouter>) {}

  async execute({
    mountRoute,
    loadRouteTree,
    preserveMountChildren,
  }: AttachRemoteRouteTreeOptions): Promise<RouteTreeAttachmentResult> {
    const result = await this.prepare({
      mountRoute,
      loadRouteTree,
      preserveMountChildren,
    })

    if (result.kind === 'failed') {
      return result
    }

    return this.loadPrepared()
  }

  async prepare({
    mountRoute,
    loadRouteTree,
    preserveMountChildren = false,
  }: AttachRemoteRouteTreeOptions): Promise<RouteTreePreparationResult> {
    let remoteTree: AnyRoute | undefined
    let hostTreeWasMutated = false

    try {
      remoteTree = await loadRouteTree()

      if (!remoteTree) {
        throw new Error('loadRouteTree() did not return a routeTree')
      }

      // Resolve before claim/graft so a host that has not created its router
      // yet can retry without leaving a mutable route tree in a poisoned state.
      const router = this.getRouter()

      claimRemoteRouteTreeMount({ remoteTree, mountRoute })
      graftRemoteRouteTree({
        hostDefaultNotFoundComponent: (
          router.options as {
            defaultNotFoundComponent?: NotFoundRouteComponent
          }
        ).defaultNotFoundComponent,
        mountRoute,
        remoteTree,
        preserveMountChildren,
      })
      hostTreeWasMutated = true

      const nextTree = cloneHostRootForUpdate(router.routeTree as never)

      router.update({ routeTree: nextTree } as never)

      return { kind: 'prepared' }
    } catch (cause) {
      if (remoteTree && !hostTreeWasMutated) {
        releaseRemoteRouteTreeMount({ remoteTree, mountRoute })
      }

      return {
        kind: 'failed',
        error: cause instanceof Error ? cause : new Error(String(cause)),
        hostTreeWasMutated,
      }
    }
  }

  async loadPrepared(): Promise<RouteTreeAttachmentResult> {
    try {
      // update() rebuilds route indexes but retains active matches. load()
      // rematches the fuzzy local not-found location against remote children.
      await this.getRouter().load()
      return { kind: 'attached' }
    } catch (cause) {
      return {
        kind: 'failed',
        error: cause instanceof Error ? cause : new Error(String(cause)),
        hostTreeWasMutated: true,
      }
    }
  }

  private getRouter() {
    if (!this.router) {
      this.router = this.resolveRouter()
    }

    return this.router
  }
}
