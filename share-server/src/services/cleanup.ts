import { getExpiredUploads, deleteExpiredUploads } from './db'
import { deleteObject } from './storage'

const ONE_HOUR = 60 * 60 * 1000

export async function cleanupExpired(): Promise<number> {
  const expired = getExpiredUploads()
  if (expired.length === 0) return 0

  for (const record of expired) {
    try {
      await deleteObject(record.storage_key)
    } catch {
      // Storage delete failed — still remove from DB so it doesn't block
    }
  }

  deleteExpiredUploads()
  return expired.length
}

export function startCleanupInterval(): void {
  // Run once on startup
  cleanupExpired().then((count) => {
    if (count > 0) console.log(`[cleanup] Removed ${count} expired uploads`)
  })

  // Then every hour
  setInterval(async () => {
    const count = await cleanupExpired()
    if (count > 0) console.log(`[cleanup] Removed ${count} expired uploads`)
  }, ONE_HOUR)
}
