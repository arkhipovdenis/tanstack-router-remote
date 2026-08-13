import { describe, expect, it } from 'vitest'

import { SerialTaskQueue } from '../../packages/route-tree-adapter/src/internal/serial-task-queue'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}

describe('SerialTaskQueue', () => {
  it('runs work in order and continues after a rejected task', async () => {
    const queue = new SerialTaskQueue()
    const gate = deferred()
    const events: string[] = []

    const first = queue.enqueue(async () => {
      events.push('first:start')
      await gate.promise
      events.push('first:end')
    })
    const second = queue.enqueue(async () => {
      events.push('second')
    })

    await Promise.resolve()
    expect(events).toEqual(['first:start'])

    gate.resolve()
    await Promise.all([first, second])
    expect(events).toEqual(['first:start', 'first:end', 'second'])

    await expect(
      queue.enqueue(async () => {
        throw new Error('expected failure')
      }),
    ).rejects.toThrow('expected failure')

    await queue.enqueue(async () => {
      events.push('after-failure')
    })

    expect(events.at(-1)).toBe('after-failure')
  })
})
