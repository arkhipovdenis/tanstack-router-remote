/** Per-member outcome of one batch run, positionally aligned with its input. */
export type BatchMemberResult<T> =
  | { readonly status: 'fulfilled'; readonly value: T }
  | { readonly status: 'rejected'; readonly reason: unknown }

export type BatchRunner<TItem, TValue> = (
  items: readonly TItem[],
) => Promise<readonly BatchMemberResult<TValue>[]>

/**
 * Serializes work like {@link SerialTaskQueue}, but collects everything
 * enqueued while a run is in flight (or within the same microtask) into one
 * batch. The runner amortizes whatever is shared across members — here a single
 * `router.update()` plus `router.load()` instead of one pair per mount.
 *
 * The runner must return one positionally aligned result per item so a member
 * that fails on its own leaves its siblings attached.
 */
export class BatchingTaskQueue<TItem, TValue> {
  private pending: TItem[] = []
  private pendingSettlers: ((result: BatchMemberResult<TValue>) => void)[] = []
  private tail: Promise<void> = Promise.resolve()
  private scheduled = false

  constructor(private readonly run: BatchRunner<TItem, TValue>) {}

  enqueue(item: TItem): Promise<TValue> {
    const settled = new Promise<BatchMemberResult<TValue>>((resolve) => {
      this.pending.push(item)
      this.pendingSettlers.push(resolve)
    })

    this.schedule()

    return settled.then((result) => {
      if (result.status === 'rejected') {
        throw result.reason
      }

      return result.value
    })
  }

  private schedule() {
    if (this.scheduled) {
      return
    }

    this.scheduled = true
    // Chaining off the tail is what makes batching happen: while a run is in
    // flight every further enqueue lands in `pending` and is picked up whole by
    // the next drain. An idle queue still yields one microtask first, so mounts
    // that attach in the same tick (the common React commit) share a run.
    this.tail = this.tail.then(
      () => this.drain(),
      () => this.drain(),
    )
  }

  private async drain() {
    const items = this.pending
    const settlers = this.pendingSettlers

    this.pending = []
    this.pendingSettlers = []
    this.scheduled = false

    if (!items.length) {
      return
    }

    let results: readonly BatchMemberResult<TValue>[]

    try {
      results = await this.run(items)
    } catch (cause) {
      // A runner that throws instead of reporting per member is a bug in the
      // runner, not in a member. Fail the whole batch rather than hanging it.
      for (const settle of settlers) {
        settle({ status: 'rejected', reason: cause })
      }

      return
    }

    settlers.forEach((settle, index) => {
      settle(
        results[index] ?? {
          status: 'rejected',
          reason: new Error(
            'Batch runner returned no result for batch member ' + index,
          ),
        },
      )
    })
  }
}
