import { readFileSync } from 'fs'
import { basename } from 'path'
import { clipboard } from 'electron'
import { getSetting } from './settings-store'
import { tMain } from './i18n-main'

export interface UploadResult {
  success: boolean
  url?: string
  deleteToken?: string
  error?: string
}

const TIMEOUT_SCREENSHOT = 30_000
const TIMEOUT_RECORDING = 120_000

// Hard caps on upload payload size. A buggy renderer that hands us a
// 10 GB buffer would otherwise OOM the main process or hang it for
// minutes; reject early with a clear error.
const MAX_SCREENSHOT_BYTES = 50 * 1024 * 1024   // 50 MB
const MAX_RECORDING_BYTES = 500 * 1024 * 1024   // 500 MB

function httpErrorMessage(status: number, body: Record<string, unknown>): string {
  const serverMsg = body.error as string | undefined

  switch (status) {
    case 400:
      return serverMsg || tMain('upload.badRequest')
    case 413:
      return tMain('upload.serverLimit')
    case 429:
      return tMain('upload.rateLimited')
    default:
      if (status >= 500) return serverMsg || tMain('upload.serverError')
      return serverMsg || tMain('upload.unexpectedHttp', { status })
  }
}

function classifyNetworkError(err: unknown): string {
  if (!(err instanceof Error)) return tMain('upload.failed')

  if (err.name === 'AbortError') {
    return tMain('upload.timedOut')
  }

  const msg = err.message.toLowerCase()
  if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('enotfound')) {
    return tMain('upload.cantReach')
  }
  if (msg.includes('econnreset') || msg.includes('socket hang up')) {
    return tMain('upload.disconnected')
  }

  return err.message
}

/** Network failures that are worth retrying (transient connectivity issues
 *  the user is likely to recover from). HTTP-level errors are NOT retried —
 *  413 (too large) and 429 (rate limited) won't get better on retry. */
function isTransientError(result: UploadResult): boolean {
  if (result.success || !result.error) return false
  const e = result.error.toLowerCase()
  return e.includes('timed out') || e.includes('zaman aşım') ||
         e.includes('reach the server') || e.includes('bağlanılamadı') ||
         e.includes('disconnected') || e.includes('bağlantı kesil')
}

async function doUploadLitterboxOnce(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_SCREENSHOT)

  try {
    const blob = new Blob([buffer], { type: mimeType })
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('time', '72h')
    form.append('fileToUpload', blob, fileName)

    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: form,
      signal: controller.signal
    })

    const text = (await response.text()).trim()

    if (!response.ok || !text.startsWith('https://')) {
      return { success: false, error: text || tMain('upload.unexpectedHttp', { status: response.status }) }
    }

    clipboard.writeText(text)
    return { success: true, url: text }
  } catch (err) {
    return { success: false, error: classifyNetworkError(err) }
  } finally {
    clearTimeout(timer)
  }
}

async function doUploadLitterbox(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  // One retry on transient network errors. Mobile / flaky-wifi users get a
  // second chance without seeing the error toast. Backoff is small (1s)
  // because longer waits feel like the app froze.
  const first = await doUploadLitterboxOnce(buffer, fileName, mimeType)
  if (first.success || !isTransientError(first)) return first
  await new Promise(r => setTimeout(r, 1000))
  return doUploadLitterboxOnce(buffer, fileName, mimeType)
}

async function doUploadCustomOnce(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fileType: 'screenshot' | 'recording',
  serverUrl: string
): Promise<UploadResult> {
  const timeout = fileType === 'recording' ? TIMEOUT_RECORDING : TIMEOUT_SCREENSHOT
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const blob = new Blob([buffer], { type: mimeType })
    const form = new FormData()
    form.append('file', blob, fileName)
    form.append('fileType', fileType)

    const response = await fetch(`${serverUrl.replace(/\/+$/, '')}/upload`, {
      method: 'POST',
      body: form,
      signal: controller.signal
    })

    let data: Record<string, unknown> = {}
    try {
      data = await response.json() as Record<string, unknown>
    } catch {
      // response body is not JSON
    }

    if (!response.ok || !data.success) {
      return { success: false, error: httpErrorMessage(response.status, data) }
    }

    const url = data.url as string
    const deleteToken = data.deleteToken as string

    clipboard.writeText(url)

    return { success: true, url, deleteToken }
  } catch (err) {
    return { success: false, error: classifyNetworkError(err) }
  } finally {
    clearTimeout(timer)
  }
}

async function doUpload(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fileType: 'screenshot' | 'recording'
): Promise<UploadResult> {
  const sizeLimit = fileType === 'recording' ? MAX_RECORDING_BYTES : MAX_SCREENSHOT_BYTES
  if (buffer.length > sizeLimit) {
    const limitMB = Math.round(sizeLimit / (1024 * 1024))
    const key = fileType === 'recording' ? 'upload.tooLargeRecording' : 'upload.tooLargeScreenshot'
    return { success: false, error: tMain(key, { limit: limitMB }) }
  }

  const serverUrl = getSetting('uploadServerUrl')
  if (!serverUrl) {
    return doUploadLitterbox(buffer, fileName, mimeType)
  }

  // Enforce HTTPS for custom upload servers — recording payloads can be
  // hundreds of MB and may contain sensitive screen contents; refuse to
  // ship them over plaintext HTTP.
  try {
    const proto = new URL(serverUrl).protocol
    if (proto !== 'https:') {
      return { success: false, error: tMain('upload.httpsRequired') }
    }
  } catch {
    return { success: false, error: tMain('upload.invalidUrl') }
  }

  // Same single-retry policy as Litterbox — transient connectivity errors
  // (timeout, DNS hiccup) get a second chance.
  const first = await doUploadCustomOnce(buffer, fileName, mimeType, fileType, serverUrl)
  if (first.success || !isTransientError(first)) return first
  await new Promise(r => setTimeout(r, 1000))
  return doUploadCustomOnce(buffer, fileName, mimeType, fileType, serverUrl)
}

export async function uploadScreenshot(dataUrl: string): Promise<UploadResult> {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) return { success: false, error: tMain('upload.invalidDataUrl') }

  const buffer = Buffer.from(match[1], 'base64')
  return doUpload(buffer, 'screenshot.png', 'image/png', 'screenshot')
}

export async function uploadFile(
  filePath: string,
  fileType: 'screenshot' | 'recording'
): Promise<UploadResult> {
  try {
    const buffer = readFileSync(filePath)
    const mimeType = fileType === 'screenshot' ? 'image/png' : 'video/webm'
    const fileName = basename(filePath)
    return doUpload(buffer, fileName, mimeType, fileType)
  } catch (err) {
    const message = err instanceof Error ? err.message : tMain('upload.cantReadFile')
    return { success: false, error: message }
  }
}
