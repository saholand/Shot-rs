import { app } from 'electron'
import { join } from 'path'
import {
  existsSync, unlinkSync, mkdirSync,
  createWriteStream, readdirSync, statSync,
  readFileSync, writeFileSync
} from 'fs'
import type { WriteStream } from 'fs'
import type { RecoverableRecording } from '../../shared/types/ipc'

const TEMP_DIR_NAME = 'recording-temp'
const TEMP_PREFIX = 'rec-'
const METADATA_SUFFIX = '.meta.json'

interface TempRecordingMeta {
  sessionId: string
  mimeType: string
  sourceName: string
  startedAt: number
  lastChunkAt: number
}

let currentStream: WriteStream | null = null
let currentTempPath: string | null = null
let currentMetaPath: string | null = null
let currentSessionId: string | null = null

function getTempDir(): string {
  const dir = join(app.getPath('userData'), TEMP_DIR_NAME)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function closeTempStream(): Promise<void> {
  return new Promise((resolve) => {
    if (!currentStream || currentStream.destroyed) {
      currentStream = null
      resolve()
      return
    }
    const stream = currentStream
    currentStream = null
    stream.on('finish', resolve)
    stream.on('error', () => resolve())
    stream.end()
  })
}

/** Initialize a new temp file for a recording session. */
export function initTempFile(mimeType: string, sourceName: string): string {
  closeTempStream()

  const sessionId = `${TEMP_PREFIX}${Date.now()}`
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
  const tempDir = getTempDir()
  const tempPath = join(tempDir, `${sessionId}.${ext}`)
  const metaPath = join(tempDir, `${sessionId}${METADATA_SUFFIX}`)

  const meta: TempRecordingMeta = {
    sessionId,
    mimeType,
    sourceName,
    startedAt: Date.now(),
    lastChunkAt: Date.now()
  }
  writeFileSync(metaPath, JSON.stringify(meta), 'utf-8')

  currentStream = createWriteStream(tempPath, { flags: 'w' })
  currentTempPath = tempPath
  currentMetaPath = metaPath
  currentSessionId = sessionId

  return sessionId
}

/** Append a chunk to the current temp file. */
export function writeChunk(chunk: Buffer): boolean {
  if (!currentStream || currentStream.destroyed) return false
  currentStream.write(chunk)

  if (currentMetaPath && existsSync(currentMetaPath)) {
    try {
      const meta: TempRecordingMeta = JSON.parse(readFileSync(currentMetaPath, 'utf-8'))
      meta.lastChunkAt = Date.now()
      writeFileSync(currentMetaPath, JSON.stringify(meta), 'utf-8')
    } catch { /* non-critical */ }
  }
  return true
}

/** Close stream and return temp file path. Removes metadata (normal completion). */
export async function finalizeTempFile(): Promise<string | null> {
  await closeTempStream()
  const path = currentTempPath
  if (currentMetaPath && existsSync(currentMetaPath)) {
    unlinkSync(currentMetaPath)
  }
  currentTempPath = null
  currentMetaPath = null
  currentSessionId = null
  return path
}

/** Discard the current temp file (cancel / empty recording). */
export async function discardTempFile(): Promise<void> {
  await closeTempStream()
  if (currentTempPath && existsSync(currentTempPath)) unlinkSync(currentTempPath)
  if (currentMetaPath && existsSync(currentMetaPath)) unlinkSync(currentMetaPath)
  currentTempPath = null
  currentMetaPath = null
  currentSessionId = null
}

/** Check for orphaned temp files from a previous crash. */
export function checkForRecovery(): RecoverableRecording[] {
  const tempDir = getTempDir()
  if (!existsSync(tempDir)) return []

  const files = readdirSync(tempDir)
  const metaFiles = files.filter(f => f.endsWith(METADATA_SUFFIX))
  const results: RecoverableRecording[] = []

  for (const metaFile of metaFiles) {
    try {
      const metaPath = join(tempDir, metaFile)
      const meta: TempRecordingMeta = JSON.parse(readFileSync(metaPath, 'utf-8'))

      const videoFile = files.find(f =>
        f.startsWith(meta.sessionId) && !f.endsWith(METADATA_SUFFIX)
      )
      if (!videoFile) {
        unlinkSync(metaPath)
        continue
      }

      const videoPath = join(tempDir, videoFile)
      const stat = statSync(videoPath)

      if (stat.size === 0) {
        unlinkSync(videoPath)
        unlinkSync(metaPath)
        continue
      }

      results.push({
        sessionId: meta.sessionId,
        tempFilePath: videoPath,
        mimeType: meta.mimeType,
        sourceName: meta.sourceName,
        startedAt: meta.startedAt,
        lastChunkAt: meta.lastChunkAt,
        fileSizeBytes: stat.size
      })
    } catch { /* skip corrupted */ }
  }
  return results
}

/** Discard a specific recoverable recording. */
export function discardRecovery(sessionId: string): void {
  const tempDir = getTempDir()
  if (!existsSync(tempDir)) return

  for (const file of readdirSync(tempDir)) {
    if (file.startsWith(sessionId)) {
      const fullPath = join(tempDir, file)
      if (existsSync(fullPath)) unlinkSync(fullPath)
    }
  }
}

/** Get and consume recovery file path (removes metadata). */
export function getRecoveryFilePath(sessionId: string): string | null {
  const tempDir = getTempDir()
  const files = readdirSync(tempDir)

  const videoFile = files.find(f =>
    f.startsWith(sessionId) && !f.endsWith(METADATA_SUFFIX)
  )
  if (!videoFile) return null

  const metaFile = files.find(f =>
    f.startsWith(sessionId) && f.endsWith(METADATA_SUFFIX)
  )
  if (metaFile) {
    const metaPath = join(tempDir, metaFile)
    if (existsSync(metaPath)) unlinkSync(metaPath)
  }

  return join(tempDir, videoFile)
}
