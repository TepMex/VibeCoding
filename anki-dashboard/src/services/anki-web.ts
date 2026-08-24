import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core'
import type { SyncProgress, SyncStatus } from '../types'

interface NativeSyncResult {
  collectionUri: string
  byteLength: number
  syncedAt: number
  serverMod?: number
}

interface AnkiWebNativePlugin {
  getStatus(): Promise<SyncStatus>
  sync(options: {
    username: string
    password?: string
    endpoint: string
  }): Promise<NativeSyncResult>
  logout(): Promise<void>
  addListener(
    eventName: 'syncProgress',
    listener: (event: SyncProgress) => void,
  ): Promise<PluginListenerHandle>
}

const nativePlugin = registerPlugin<AnkiWebNativePlugin>('AnkiWeb')

export const DEFAULT_ENDPOINT = 'https://sync.ankiweb.net/'
export const isNative = Capacitor.isNativePlatform()

export async function getSyncStatus(): Promise<SyncStatus> {
  if (!isNative) {
    return {
      hasCollection: false,
      connected: false,
      username: '',
      endpoint: DEFAULT_ENDPOINT,
      syncedAt: null,
    }
  }
  return nativePlugin.getStatus()
}

export async function syncFromAnkiWeb(
  options: { username: string; password?: string; endpoint: string },
  onProgress?: (progress: SyncProgress) => void,
): Promise<{ buffer: ArrayBuffer; result: NativeSyncResult }> {
  if (!isNative) {
    throw new Error(
      'AnkiWeb blocks browser requests. Install the Android app to sync, or import collection.anki2 here.',
    )
  }
  const listener = onProgress
    ? await nativePlugin.addListener('syncProgress', onProgress)
    : null
  try {
    const result = await nativePlugin.sync(options)
    const localUrl = Capacitor.convertFileSrc(result.collectionUri)
    const response = await fetch(localUrl)
    if (!response.ok) {
      throw new Error(`Cannot open downloaded collection (${response.status})`)
    }
    return { buffer: await response.arrayBuffer(), result }
  } finally {
    await listener?.remove()
  }
}

export async function logoutAnkiWeb() {
  if (isNative) await nativePlugin.logout()
}
