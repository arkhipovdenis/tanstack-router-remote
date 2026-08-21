import { describe, expect, it } from 'vitest'

import {
  BatchingTaskQueue,
  type BatchMemberResult,
} from '../../packages/route-tree-adapter/src/internal/batching-task-queue'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}

function fulfilled<T>(value: T): BatchMemberResult<T> {
  return { status: 'fulfilled', value }
}

describe('BatchingTaskQueue', () => {
  it('collapses same-tick items into one run and settles each member', async () => {
    const runs: string[][] = []
    const queue = new BatchingTaskQueue<string, string>(async (items) => {
      runs.push([...items])

      return items.map((item) => fulfilled(item.toUpperCase()))
    })

    const results = await Promise.all([
      queue.enqueue('a'),
      queue.enqueue('b'),
      queue.enqueue('c'),
    ])

    expect(runs).toEqual([['a', 'b', 'c']])
    expect(results).toEqual(['A', 'B', 'C'])
  })

  it('collects everything enqueued while a run is in flight into the next batch', async () => {
    const runs: string[][] = []
    const gate = deferred()
    const queue = new BatchingTaskQueue<string, string>(async (items) => {
      runs.push([...items])

      if (runs.length === 1) {
        await gate.promise
      }

      return items.map((item) => fulfilled(item))
    })

    const first = queue.enqueue('first')

    // Let the first run start before anything else is enqueued.
    await Promise.resolve()
    await Promise.resolve()

    const later = Promise.all([queue.enqueue('second'), queue.enqueue('third')])

    expect(runs).toEqual([['first']])

    gate.resolve()
    await first
    await later

    expect(runs).toEqual([['first'], ['second', 'third']])
  })

  it('rejects only the members the runner reported as rejected', async () => {
    const queue = new BatchingTaskQueue<string, string>(async (items) =>
      items.map((item) =>
        item === 'bad'
          ? { status: 'rejected' as const, reason: new Error('bad item') }
          : fulfilled(item),
      ),
    )

    const settled = await Promise.allSettled([
      queue.enqueue('good'),
      queue.enqueue('bad'),
      queue.enqueue('also-good'),
    ])

    expect(settled.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ])
  })

  it('fails every member when the runner itself throws, and keeps accepting work', async () => {
    let shouldThrow = true
    const queue = new BatchingTaskQueue<string, string>(async (items) => {
      if (shouldThrow) {
        throw new Error('runner exploded')
      }

      return items.map((item) => fulfilled(item))
    })

    await expect(
      Promise.all([queue.enqueue('a'), queue.enqueue('b')]),
    ).rejects.toThrow('runner exploded')

    shouldThrow = false

    await expect(queue.enqueue('c')).resolves.toBe('c')
  })

  it('rejects a member the runner returned no result for', async () => {
    const queue = new BatchingTaskQueue<string, string>(async () => [])

    await expect(queue.enqueue('a')).rejects.toThrow(
      'Batch runner returned no result for batch member 0',
    )
  })

  it('runs batches in order and keeps accepting work after a rejected batch', async () => {
    const gate = deferred()
    const events: string[] = []
    const queue = new BatchingTaskQueue<string, void>(async (items) => {
      events.push('start:' + items.join(','))

      if (items.includes('first')) {
        await gate.promise
      }

      events.push('end:' + items.join(','))

      return items.map((item) =>
        item === 'boom'
          ? {
              status: 'rejected' as const,
              reason: new Error('expected failure'),
            }
          : fulfilled(undefined),
      )
    })

    const first = queue.enqueue('first')

    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['start:first'])

    const second = queue.enqueue('second')

    // The second batch must not start before the first one finished mutating.
    expect(events).toEqual(['start:first'])

    gate.resolve()
    await Promise.all([first, second])

    expect(events).toEqual([
      'start:first',
      'end:first',
      'start:second',
      'end:second',
    ])

    await expect(queue.enqueue('boom')).rejects.toThrow('expected failure')
    await queue.enqueue('after-failure')

    expect(events.at(-1)).toBe('end:after-failure')
  })
})
