import type { AnyRoute } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { AttachmentStore } from '../../packages/route-tree-adapter/src/internal/attachment-store'

describe('AttachmentStore', () => {
  it('publishes immutable snapshots and isolates observer failures', () => {
    const store = new AttachmentStore()
    const mount = {} as AnyRoute
    const states: string[] = []
    const unsubscribe = store.subscribe(() => {
      states.push(store.getSnapshot(mount).state)
    })
    store.subscribe(() => {
      throw new Error('observer failed')
    })

    const idle = store.getSnapshot(mount)
    expect(idle).toEqual({ state: 'idle' })
    expect(Object.isFrozen(idle)).toBe(true)

    expect(() => {
      store.setSnapshot(mount, { state: 'loading' })
      store.setSnapshot(mount, { state: 'attached' })
    }).not.toThrow()

    const attached = store.getSnapshot(mount)
    expect(attached).toEqual({ state: 'attached' })
    expect(Object.isFrozen(attached)).toBe(true)
    expect(states).toEqual(['loading', 'attached'])

    unsubscribe()
    store.setSnapshot(mount, { state: 'error', error: new Error('failed') })

    expect(states).toEqual(['loading', 'attached'])
  })
})
