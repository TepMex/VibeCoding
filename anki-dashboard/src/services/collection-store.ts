const COLLECTION_FILE = 'collection.anki2'
const DB_NAME = 'anki-dashboard'
const STORE_NAME = 'collections'

function hasOpfs() {
  return typeof navigator.storage?.getDirectory === 'function'
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = action(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function saveCollection(buffer: ArrayBuffer) {
  if (hasOpfs()) {
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle(COLLECTION_FILE, { create: true })
    const writable = await handle.createWritable()
    await writable.write(buffer)
    await writable.close()
    return
  }
  await idbRequest('readwrite', (store) => store.put(buffer, COLLECTION_FILE))
}

export async function loadCollection(): Promise<ArrayBuffer | null> {
  if (hasOpfs()) {
    try {
      const root = await navigator.storage.getDirectory()
      const handle = await root.getFileHandle(COLLECTION_FILE)
      return await (await handle.getFile()).arrayBuffer()
    } catch {
      return null
    }
  }
  return (await idbRequest<ArrayBuffer | undefined>(
    'readonly',
    (store) => store.get(COLLECTION_FILE),
  )) ?? null
}

export async function removeCollection() {
  if (hasOpfs()) {
    try {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(COLLECTION_FILE)
    } catch {
      // The collection was already absent.
    }
    return
  }
  await idbRequest('readwrite', (store) => store.delete(COLLECTION_FILE))
}
