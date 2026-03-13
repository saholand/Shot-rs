import { readFileSync } from 'fs'
import { basename } from 'path'
import { clipboard } from 'electron'
import { getSetting } from './settings-store'

export interface UploadResult {
  success: boolean
  url?: string
  deleteToken?: string
  error?: string
}

const TIMEOUT_SCREENSHOT = 30_000
const TIMEOUT_RECORDING = 120_000

function httpErrorMessage(status: number, body: Record<string, unknown>): string {
  const serverMsg = body.error as string | undefined

  switch (status) {
    case 400:
      return serverMsg || 'Geçersiz istek'
    case 413:
      return 'Dosya boyutu sunucu limitini aşıyor'
    case 429:
      return 'Çok fazla istek — biraz bekleyip tekrar deneyin'
    default:
      if (status >= 500) return serverMsg || 'Sunucu hatası — daha sonra tekrar deneyin'
      return serverMsg || `Beklenmeyen hata (HTTP ${status})`
  }
}

function classifyNetworkError(err: unknown): string {
  if (!(err instanceof Error)) return 'Upload başarısız'

  if (err.name === 'AbortError') {
    return 'Bağlantı zaman aşımına uğradı'
  }

  const msg = err.message.toLowerCase()
  if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('enotfound')) {
    return 'Sunucuya bağlanılamadı — adres ve bağlantınızı kontrol edin'
  }
  if (msg.includes('econnreset') || msg.includes('socket hang up')) {
    return 'Bağlantı kesildi — tekrar deneyin'
  }

  return err.message
}

async function doUploadLitterbox(
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
      return { success: false, error: text || `Upload başarısız (HTTP ${response.status})` }
    }

    clipboard.writeText(text)
    return { success: true, url: text }
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
  const serverUrl = getSetting('uploadServerUrl')
  if (!serverUrl) {
    return doUploadLitterbox(buffer, fileName, mimeType)
  }

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

export async function uploadScreenshot(dataUrl: string): Promise<UploadResult> {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) return { success: false, error: 'Geçersiz data URL' }

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
    const message = err instanceof Error ? err.message : 'Dosya okunamadı'
    return { success: false, error: message }
  }
}
