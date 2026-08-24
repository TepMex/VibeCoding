import type { CollectionMetadata, DashboardData } from '../types'

type WorkerMethod = 'loadCollection' | 'analyze'

interface WorkerResponse<T> {
  id: number
  result?: T
  error?: string
}

class CollectionWorker {
  private worker: Worker
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >()

  constructor() {
    this.worker = new Worker(
      new URL('../workers/collection.worker.ts', import.meta.url),
      { type: 'module' },
    )
    this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse<unknown>>) => {
      const request = this.pending.get(data.id)
      if (!request) return
      this.pending.delete(data.id)
      if (data.error) request.reject(new Error(data.error))
      else request.resolve(data.result)
    }
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Collection worker crashed')
      for (const request of this.pending.values()) request.reject(error)
      this.pending.clear()
    }
  }

  private request<T>(
    method: WorkerMethod,
    args: unknown[],
    transfer: Transferable[] = [],
  ): Promise<T> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      })
      this.worker.postMessage({ id, method, args }, transfer)
    })
  }

  loadCollection(buffer: ArrayBuffer): Promise<CollectionMetadata> {
    return this.request('loadCollection', [buffer], [buffer])
  }

  analyze(
    selectedDecks: string[],
    iPlusOneFields: Record<string, string>,
  ): Promise<DashboardData> {
    return this.request('analyze', [selectedDecks, iPlusOneFields])
  }

  terminate() {
    this.worker.terminate()
    this.pending.clear()
  }
}

let instance: CollectionWorker | null = null

export function getCollectionWorker() {
  instance ??= new CollectionWorker()
  return instance
}

export function resetCollectionWorker() {
  instance?.terminate()
  instance = null
}
