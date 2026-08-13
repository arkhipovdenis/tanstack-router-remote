/** Serializes route-tree mutations while allowing later work after a failure. */
export class SerialTaskQueue {
  private tail: Promise<void> = Promise.resolve()

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const request = this.tail.then(task, task)

    this.tail = request.then(
      () => undefined,
      () => undefined,
    )

    return request
  }
}
