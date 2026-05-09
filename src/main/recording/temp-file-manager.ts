import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  existsSync, unlinkSync, mkdirSync,
  createWriteStream, readdirSync, statSync,
  readFileSync, writeFileSync, openSync, readSync, closeSync
} from 'fs'
import type { WriteStream } from 'fs'
import type { RecoverableRecording } from '../../shared/types/ipc'

/**
 * Read the first 4 bytes of `filePath` and return them. Used to validate
 * a recovery file's container header before offering it to the user.
 */
function readMagicBytes(filePath: string): Buffer | null {
  try {
    const fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(4)
    const n = readSync(fd, buf, 0, 4, 0)
    closeSync(fd)
    if (n < 4) return null
    return buf
  } catch {
    return null
  }
}

/**
 * Heuristic check that the file looks like a valid WebM (EBML 1A 45 DF A3)
 * or MP4 (...ftyp at offset 4). A non-empty file that doesn't pass either
 * check is almost certainly broken (e.g., disk full, crash before header).
 */
function looksLikeVideo(filePath: string): boolean {
  const magic = readMagicBytes(filePath)
  if (!magic) return false
  // WebM / Matroska
  if (magic[0] === 0x1A && magic[1] === 0x45 && magic[2] === 0xDF && magic[3] === 0xA3) return true
  // MP4 — first 4 bytes are box size, next 4 are 'ftyp'. Read more if needed.
  try {
    const fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(8)
    readSync(fd, buf, 0, 8, 0)
    closeSync(fd)
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true
  } catch { /* ignore */ }
  return false
}

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
// Captured if the underlying file stream errors mid-recording (most
// commonly ENOSPC = disk full). We report this back through writeChunk's
// return value so the renderer can stop the recording and show the user
// a meaningful message instead of producing a half-written file.
let streamError: Error | null = null

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

/** Initialize a new temp file for a recording session.
 *  Awaits closeTempStream so a back-to-back start can't race the previous
 *  session's stream finish and truncate the new file. */
export async function initTempFile(mimeType: string, sourceName: string): Promise<string> {
  await closeTempStream()

  // randomUUID() avoids the Date.now() collision window when two recordings
  // start within the same millisecond (rare, but possible on hotkey burst).
  const sessionId = `${TEMP_PREFIX}${randomUUID()}`
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
  // Capture stream-level errors (disk full, permission revoked) so
  // writeChunk can report them. Without this, the error is emitted on
  // the stream and we'd silently lose chunks.
  streamError = null
  currentStream.on('error', (err) => { streamError = err })
  currentTempPath = tempPath
  currentMetaPath = metaPath
  currentSessionId = sessionId

  return sessionId
}

/** Last error reported by the recording temp-file stream, if any. */
export function getStreamError(): Error | null {
  return streamError
}

/** Append a chunk to the current temp file. Returns false if the stream
 *  has died (e.g. disk full); the caller should stop recording. */
export function writeChunk(chunk: Buffer): boolean {
  if (!currentStream || currentStream.destroyed) return false
  // A previous chunk's write surfaced an error event — refuse new chunks
  // so we don't accumulate them in memory waiting on a dead stream.
  if (streamError) return false
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

      // Skip files that don't have a valid video container header. Better
      // to silently drop a corrupted recovery than to hand the user a
      // broken file labelled "recovered recording".
      if (!looksLikeVideo(videoPath)) {
        try { unlinkSync(videoPath) } catch { /* ignore */ }
        try { unlinkSync(metaPath) } catch { /* ignore */ }
        continue
      }

      // Skip suspiciously small files (< 16 KB) — usually the recorder
      // wrote a header and crashed before any frame data landed.
      if (stat.size < 16 * 1024) {
        try { unlinkSync(videoPath) } catch { /* ignore */ }
        try { unlinkSync(metaPath) } catch { /* ignore */ }
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
