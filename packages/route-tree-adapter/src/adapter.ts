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
  type RouteTreeAttachmentTransaction,
} from './internal/attach-remote-route-tree.js'
import { SerialTaskQueue } from './internal/serial-task-queue.js'

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
  private readonly mutationQueue = new SerialTaskQueue()
  private readonly transaction: RouteTreeAttachmentTransaction

  constructor(getRouter: RouterGetter<TRouter>) {
    this.transaction = new TanStackRouteTreeAttachmentTransaction(
      getRouter,
    )
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

    const request = this.mutationQueue.enqueue(() =>
      this.attachInQueue(options, operation),
    )
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

  private async attachInQueue(
    options: AttachRemoteRouteTreeOptions,
    operation: 'attach' | 'prepare',
  ): Promise<void> {
    const { mountRoute } = options

    if (operation === 'prepare') {
      const result = await this.transaction.prepare(options)

      if (result.kind === 'prepared') {
        this.preparedMounts.add(mountRoute)
        this.attachmentStore.setSnapshot(mountRoute, { state: 'prepared' })
        return
      }

      this.publishFailure(mountRoute, result)
      throw result.error
    }

    const result = this.preparedMounts.has(mountRoute)
      ? await this.transaction.loadPrepared()
      : await this.transaction.execute(options)

    if (result.kind === 'attached') {
      this.preparedMounts.delete(mountRoute)
      this.attachedMounts.add(mountRoute)
      this.attachmentStore.setSnapshot(mountRoute, { state: 'attached' })
      return
    }

    this.publishFailure(mountRoute, result)
    throw result.error
  }

  private publishFailure(
    mountRoute: AnyRoute,
    result: Extract<
      Awaited<ReturnType<RouteTreeAttachmentTransaction['execute']>>,
      { kind: 'failed' }
    >,
  ) {
    if (result.hostTreeWasMutated) {
      this.preparedMounts.delete(mountRoute)
      this.poisonedMounts.add(mountRoute)
    }

    this.attachmentStore.setSnapshot(mountRoute, {
      state: 'error',
      error: result.error,
    })
  }

  private clearPending(mountRoute: AnyRoute, request: Promise<void>) {
    if (this.pendingByMount.get(mountRoute) === request) {
      this.pendingByMount.delete(mountRoute)
      this.pendingOperationByMount.delete(mountRoute)
    }
  }
}
