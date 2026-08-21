import type { AnyRoute } from '@tanstack/react-router'

import type { RouteTreeAttachment, RouteTreeAttachmentSource } from '../types'

const idleAttachment: RouteTreeAttachment = Object.freeze({ state: 'idle' })

/**
 * Owns observable attachment snapshots. Keeping this separate makes render
 * consumers independent from the mutable route-tree transaction.
 */
export class AttachmentStore implements RouteTreeAttachmentSource {
  private readonly snapshots = new WeakMap<AnyRoute, RouteTreeAttachment>()
  private readonly listeners = new Set<() => void>()

  subscribe(listener: () => void) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(mountRoute: AnyRoute): RouteTreeAttachment {
    return this.snapshots.get(mountRoute) ?? idleAttachment
  }

  setSnapshot(mountRoute: AnyRoute, snapshot: RouteTreeAttachment) {
    this.snapshots.set(
      mountRoute,
      Object.freeze({ ...snapshot }) as RouteTreeAttachment,
    )
    this.notify()
  }

  private notify() {
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        // A rendering observer must not change the outcome of a route-tree
        // transaction. React's store subscribers do not normally throw.
      }
    }
  }
}
