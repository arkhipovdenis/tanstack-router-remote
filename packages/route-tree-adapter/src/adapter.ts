import type { AnyRoute, AnyRouter } from '@tanstack/react-router'

import type {
  AttachRemoteRouteTreeOptions,
  RouterGetter,
  RouteTreeAttachment,
  RouteTreeAttachmentController,
  RouteTreePreparationController,
} from './types.js'
import { AttachmentStore } from './internal/attachment-store.js'
import {
  TanStackRouteTreeAttachmentTransaction,
  type RouteTreeAttachmentRequest,
  type RouteTreeAttachmentTransaction,
  type RouteTreeBatchMemberResult,
} from './internal/attach-remote-route-tree.js'
import {
  BatchingTaskQueue,
  type BatchMemberResult,
} from './internal/batching-task-queue.js'

/**
 * Attach-only adapter around one existing host router. It coordinates mount
 * lifecycle and idempotency; state publication, mutation serialization, and
 * the TanStack-specific transaction have separate owners.
 *
 * The getter is resolved only after a remote tree has loaded, then pinned for
 * this adapter's remaining lifetime.
 */
export class RouteTreeUpdateAdapter<TRouter extends AnyRouter = AnyRouter>
  implements RouteTreeAttachmentController, RouteTreePreparationController
{
  private readonly attachedMounts = new WeakSet<AnyRoute>()
  private readonly preparedMounts = new WeakSet<AnyRoute>()
  private readonly poisonedMounts = new WeakSet<AnyRoute>()
  private readonly pendingByMount = new WeakMap<AnyRoute, Promise<void>>()
  private readonly pendingOperationByMount = new WeakMap<
    AnyRoute,
    'attach' | 'prepare'
  >()
  private readonly attachmentStore = new AttachmentStore()
  private readonly transaction: RouteTreeAttachmentTransaction
  // `prepare()` hands routing to an explicit SSR/hydration boundary while
  // `attach()` owns a client load, so the two never share a batch. Separate
  // queues keep each kind collapsible without interleaving the other.
  private readonly attachQueue: BatchingTaskQueue<
    RouteTreeAttachmentRequest,
    void
  >
  private readonly prepareQueue: BatchingTaskQueue<
    RouteTreeAttachmentRequest,
    void
  >

  constructor(getRouter: RouterGetter<TRouter>) {
    this.transaction = new TanStackRouteTreeAttachmentTransaction(getRouter)

    const runBatch = (requests: readonly RouteTreeAttachmentRequest[]) =>
      this.runBatch(requests)

    this.attachQueue = new BatchingTaskQueue(runBatch)
    this.prepareQueue = new BatchingTaskQueue(runBatch)
  }

  subscribe(listener: () => void) {
    return this.attachmentStore.subscribe(listener)
  }

  getSnapshot(mountRoute: AnyRoute): RouteTreeAttachment {
    return this.attachmentStore.getSnapshot(mountRoute)
  }

  attach(options: AttachRemoteRouteTreeOptions): Promise<void> {
    const { mountRoute } = options

    if (this.attachedMounts.has(mountRoute)) {
      return Promise.resolve()
    }

    const pending = this.pendingByMount.get(mountRoute)
    if (pending) {
      if (this.pendingOperationByMount.get(mountRoute) === 'attach') {
        return pending
      }

      // A caller that asks for a full CSR attachment while an SSR preparation
      // is in flight must wait for the graft, then perform the missing load.
      return pending.then(() => this.attach(options))
    }

    return this.enqueue(options, 'attach')
  }

  /**
   * Grafts the remote tree without initiating a client-side route load.
   *
   * Use this only at an explicit server/client bootstrap boundary: SSR calls
   * `router.load()` and `router.serverSsr.dehydrate()` afterwards, while the
   * client calls TanStack's `hydrate(router)` against the same fresh tree.
   * Browser mounts should use `attach()` through RemoteRouteMount instead.
   */
  prepare(options: AttachRemoteRouteTreeOptions): Promise<void> {
    const { mountRoute } = options

    if (
      this.attachedMounts.has(mountRoute) ||
      this.preparedMounts.has(mountRoute)
    ) {
      return Promise.resolve()
    }

    const pending = this.pendingByMount.get(mountRoute)
    if (pending) {
      return pending
    }

    return this.enqueue(options, 'prepare')
  }

  private enqueue(
    options: AttachRemoteRouteTreeOptions,
    operation: 'attach' | 'prepare',
  ): Promise<void> {
    const { mountRoute } = options

    if (this.attachedMounts.has(mountRoute)) {
      return Promise.resolve()
    }

    if (this.poisonedMounts.has(mountRoute)) {
      return Promise.reject(
        new Error(
          'This route-tree mount failed after mutating the router. Reload the host document before retrying.',
        ),
      )
    }

    const queue = operation === 'prepare' ? this.prepareQueue : this.attachQueue
    const request = queue.enqueue({
      options,
      operation,
      alreadyPrepared: this.preparedMounts.has(mountRoute),
    })

    this.pendingByMount.set(mountRoute, request)
    this.pendingOperationByMount.set(mountRoute, operation)
    void request.then(
      () => this.clearPending(mountRoute, request),
      () => this.clearPending(mountRoute, request),
    )

    // Register pending before publishing: a synchronous subscriber may call
    // attach() again and must receive this same promise.
    this.attachmentStore.setSnapshot(mountRoute, { state: 'loading' })

    return request
  }

  /**
   * Applies one collapsed batch and publishes each member's own outcome, so a
   * mount whose remote is unavailable never fails the mounts beside it.
   */
  private async runBatch(
    requests: readonly RouteTreeAttachmentRequest[],
  ): Promise<readonly BatchMemberResult<void>[]> {
    const results = await this.transaction.executeBatch(requests)

    return requests.map((request, index) =>
      this.publishMemberResult(request, results[index]),
    )
  }

  private publishMemberResult(
    request: RouteTreeAttachmentRequest,
    result: RouteTreeBatchMemberResult,
  ): BatchMemberResult<void> {
    const { mountRoute } = request.options

    if (result.kind === 'prepared') {
      this.preparedMounts.add(mountRoute)
      this.attachmentStore.setSnapshot(mountRoute, { state: 'prepared' })
      return { status: 'fulfilled', value: undefined }
    }

    if (result.kind === 'attached') {
      this.preparedMounts.delete(mountRoute)
      this.attachedMounts.add(mountRoute)
      this.attachmentStore.setSnapshot(mountRoute, { state: 'attached' })
      return { status: 'fulfilled', value: undefined }
    }

    if (result.hostTreeWasMutated) {
      this.preparedMounts.delete(mountRoute)
      this.poisonedMounts.add(mountRoute)
    }

    this.attachmentStore.setSnapshot(mountRoute, {
      state: 'error',
      error: result.error,
    })

    return { status: 'rejected', reason: result.error }
  }

  private clearPending(mountRoute: AnyRoute, request: Promise<void>) {
    if (this.pendingByMount.get(mountRoute) === request) {
      this.pendingByMount.delete(mountRoute)
      this.pendingOperationByMount.delete(mountRoute)
    }
  }
}
