type Handler<P> = (payload: P) => void

/**
 * Minimal type-safe event emitter. `on()` returns an unsubscribe function so
 * React effects can clean up with `return emitter.on(...)`.
 */
export class TypedEmitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>()

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as Handler<never>)
    return () => this.off(type, handler)
  }

  off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    // Copy first, so a handler that unsubscribes mid-emit is safe.
    for (const handler of [...(this.handlers.get(type) ?? [])]) {
      ;(handler as Handler<Events[K]>)(payload)
    }
  }

  listenerCount(type?: keyof Events): number {
    if (type) return this.handlers.get(type)?.size ?? 0
    let total = 0
    for (const set of this.handlers.values()) total += set.size
    return total
  }

  removeAllListeners(): void {
    this.handlers.clear()
  }
}
