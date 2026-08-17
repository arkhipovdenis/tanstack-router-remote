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

/** One member of a batch: what to graft, and how far to take it. */
export type RouteTreeAttachmentRequest = {
  readonly options: AttachRemoteRouteTreeOptions
  readonly operation: 'attach' | 'prepare'
  /**
   * Set when an earlier `prepare()` already grafted this mount. Such a member
   * contributes no graft and only needs the batch's shared `router.load()`.
   */
  readonly alreadyPrepared: boolean
}

export type RouteTreeBatchMemberResult =
  | { readonly kind: 'attached' }
  | { readonly kind: 'prepared' }
  | {
      readonly kind: 'failed'
      readonly error: Error
      readonly hostTreeWasMutated: boolean
    }

export interface RouteTreeAttachmentTransaction {
  /**
   * Runs one batch: remote trees load in parallel, grafts apply in order, and
   * a single `router.update()` (plus one `router.load()` when any member is a
   * CSR attach) covers every member that grafted successfully.
   *
   * Returns one result per request, positionally aligned.
   */
  executeBatch(
    requests: readonly RouteTreeAttachmentRequest[],
  ): Promise<readonly RouteTreeBatchMemberResult[]>
}

type GraftedMember = {
  readonly index: number
  readonly request: RouteTreeAttachmentRequest
  readonly remoteTree: AnyRoute | undefined
  readonly undoGraft: (() => void) | undefined
}

function toError(cause: unknown) {
  return cause instanceof Error ? cause : new Error(String(cause))
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

  async executeBatch(
    requests: readonly RouteTreeAttachmentRequest[],
  ): Promise<readonly RouteTreeBatchMemberResult[]> {
    const results: (RouteTreeBatchMemberResult | undefined)[] = requests.map(
      () => undefined,
    )

    // Transports are independent, so the whole batch pays one round trip
    // instead of N. Grafting stays sequential below — it mutates shared state.
    const loaded = await Promise.all(
      requests.map(async (request) => {
        if (request.alreadyPrepared) {
          return { kind: 'skipped' as const }
        }

        try {
          const remoteTree = await request.options.loadRouteTree()

          if (!remoteTree) {
            throw new Error('loadRouteTree() did not return a routeTree')
          }

          return { kind: 'loaded' as const, remoteTree }
        } catch (cause) {
          return { kind: 'failed' as const, error: toError(cause) }
        }
      }),
    )

    const grafted: GraftedMember[] = []
    let router: TRouter | undefined

    requests.forEach((request, index) => {
      const outcome = loaded[index]

      if (outcome.kind === 'failed') {
        results[index] = {
          kind: 'failed',
          error: outcome.error,
          hostTreeWasMutated: false,
        }
        return
      }

      if (outcome.kind === 'skipped') {
        // Already grafted by a previous prepare(): it joins the batch only for
        // the shared load, and it must not release its ownership claim — the
        // router already indexes its routes.
        grafted.push({ index, request, remoteTree: undefined, undoGraft: undefined })
        return
      }

      const { remoteTree } = outcome
      let claimed = false

      try {
        // Resolve before claim/graft so a host that has not created its router
        // yet can retry without leaving a mutable route tree in a poisoned
        // state. Resolution failure is per member: it mutated nothing.
        router ??= this.getRouter()

        claimRemoteRouteTreeMount({ remoteTree, mountRoute: request.options.mountRoute })
        claimed = true

        const { undo } = graftRemoteRouteTree({
          hostDefaultNotFoundComponent: (
            router.options as {
              defaultNotFoundComponent?: NotFoundRouteComponent
            }
          ).defaultNotFoundComponent,
          mountRoute: request.options.mountRoute,
          remoteTree,
          preserveMountChildren: request.options.preserveMountChildren ?? false,
        })

        grafted.push({ index, request, remoteTree, undoGraft: undo })
      } catch (cause) {
        if (claimed) {
          releaseRemoteRouteTreeMount({
            remoteTree,
            mountRoute: request.options.mountRoute,
          })
        }

        results[index] = {
          kind: 'failed',
          error: toError(cause),
          hostTreeWasMutated: false,
        }
      }
    })

    if (grafted.length) {
      this.commitBatch({ grafted, results, router })
    }

    const pendingLoad = results.some((result) => result === undefined)

    if (pendingLoad) {
      await this.loadBatch({ grafted, results })
    }

    return results.map(
      (result) =>
        result ?? {
          kind: 'failed',
          error: new Error('Route-tree batch produced no result for a member'),
          hostTreeWasMutated: true,
        },
    )
  }

  /**
   * One `cloneHostRootForUpdate()` + `router.update()` for the whole batch.
   * A throw here has already consumed a half-built tree, so every grafted
   * member is rolled back and reported as poisoned — the same contract a single
   * failing attachment had, applied to all of them.
   */
  private commitBatch({
    grafted,
    results,
    router,
  }: {
    grafted: readonly GraftedMember[]
    results: (RouteTreeBatchMemberResult | undefined)[]
    /** Already resolved by a grafting member; absent when all were prepared. */
    router: TRouter | undefined
  }) {
    try {
      // `router` is set by any member that grafted. A batch of only
      // already-prepared members has none, though it can only exist once an
      // earlier prepare() resolved and pinned the router. Resolving inside the
      // try keeps even that unreachable failure a rollback rather than a throw
      // that escapes the batch.
      const hostRouter = router ?? this.getRouter()
      const nextTree = cloneHostRootForUpdate(hostRouter.routeTree as never)

      hostRouter.update({ routeTree: nextTree } as never)
    } catch (cause) {
      const error = toError(cause)

      for (const member of grafted) {
        member.undoGraft?.()

        if (member.remoteTree) {
          releaseRemoteRouteTreeMount({
            remoteTree: member.remoteTree,
            mountRoute: member.request.options.mountRoute,
          })
        }

        results[member.index] = {
          kind: 'failed',
          error,
          // A member that only rejoined for the load never grafted here, but
          // the router did consume a tree built from its earlier graft.
          hostTreeWasMutated: true,
        }
      }
    }
  }

  /**
   * `update()` rebuilt the route indexes but retained the active matches.
   * `load()` rematches the fuzzy local not-found location against the remote
   * children — one call covers every attach member in the batch.
   *
   * A `prepare()` member deliberately skips it: SSR calls `router.load()` and
   * the client calls `hydrate(router)` at their own bootstrap boundary.
   */
  private async loadBatch({
    grafted,
    results,
  }: {
    grafted: readonly GraftedMember[]
    results: (RouteTreeBatchMemberResult | undefined)[]
  }) {
    const survivors = grafted.filter(
      (member) => results[member.index] === undefined,
    )
    const needsLoad = survivors.some(
      (member) => member.request.operation === 'attach',
    )

    if (needsLoad) {
      try {
        await this.getRouter().load()
      } catch (cause) {
        const error = toError(cause)

        for (const member of survivors) {
          // The router already indexes these routes, so the graft is not undone
          // and the claim is not released: freeing the tree for another host
          // would corrupt the live one.
          results[member.index] = {
            kind: 'failed',
            error,
            hostTreeWasMutated: true,
          }
        }

        return
      }
    }

    for (const member of survivors) {
      results[member.index] =
        member.request.operation === 'prepare'
          ? { kind: 'prepared' }
          : { kind: 'attached' }
    }
  }

  private getRouter() {
    if (!this.router) {
      this.router = this.resolveRouter()
    }

    return this.router
  }
}
