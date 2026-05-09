import { ipcMain, clipboard, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { IPC_CHANNELS } from '../../shared/constants'
import { captureAndCrop } from '../screenshot/capture'
import { getAnnotationOverlay, getAnnotationDisplay } from '../windows/annotation-overlay-window'
import { showAnnotationToolbar } from '../windows/annotation-toolbar-window'
import { getMainWindow } from '../windows/main-window'
import type { SelectionRegion } from '../../shared/types/ipc'

// Lazy-load tesseract.js to avoid interfering with electron startup
let TesseractModule: typeof import('tesseract.js') | null = null
let worker: import('tesseract.js').Worker | null = null
let workerLoading = false

// Serialize concurrent recognize() calls — a single tesseract worker can
// only process one job at a time; parallel calls cause "TesseractError:
// Image data already in use" / corrupted output.
let recognizeChain: Promise<unknown> = Promise.resolve()

async function getTesseract() {
  if (!TesseractModule) {
    TesseractModule = await import('tesseract.js')
  }
  return TesseractModule.default || TesseractModule
}

/**
 * Resolve a directory holding `eng.traineddata` and `tur.traineddata`.
 * In dev: <project>/resources/tessdata
 * In packaged build: process.resourcesPath/app.asar.unpacked/resources/tessdata
 *   (requires asarUnpack: ["resources/tessdata/**"] in electron-builder)
 * Returns null if no local tessdata is found — tesseract.js will then fall
 * back to its CDN download (requires internet).
 */
function resolveTessdataDir(): string | null {
  const candidates: string[] = []
  if (app.isPackaged) {
    candidates.push(join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'tessdata'))
    candidates.push(join(process.resourcesPath, 'resources', 'tessdata'))
  } else {
    candidates.push(join(app.getAppPath(), 'resources', 'tessdata'))
    // electron-vite outputs main to out/main; __dirname → out/main → up two
    candidates.push(join(__dirname, '..', '..', 'resources', 'tessdata'))
  }
  for (const dir of candidates) {
    if (existsSync(join(dir, 'eng.traineddata'))) return dir
  }
  return null
}

export async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (worker) return worker
  if (workerLoading) {
    while (workerLoading) {
      await new Promise(r => setTimeout(r, 100))
    }
    if (worker) return worker
  }
  workerLoading = true
  try {
    const Tesseract = await getTesseract()
    const tessdataDir = resolveTessdataDir()
    const options: Record<string, unknown> = {}
    if (tessdataDir) {
      // tesseract.js accepts a local filesystem path here and looks for
      // `<langPath>/<lang>.traineddata` (uncompressed).
      options.langPath = tessdataDir
      options.gzip = false
      options.cacheMethod = 'none'
    }
    worker = await Tesseract.createWorker(['eng', 'tur'], 1, options)
    return worker
  } finally {
    workerLoading = false
  }
}

export async function runRecognize(w: import('tesseract.js').Worker, image: string): Promise<{ text: string }> {
  const next = recognizeChain.then(async () => {
    const result = await w.recognize(image)
    return { text: result.data.text.trim() }
  })
  // Keep the chain alive even if this call rejects, but don't propagate
  // the error to the *next* caller.
  recognizeChain = next.catch(() => undefined)
  return next
}

/** Restore all windows to correct z-order after OCR capture */
function restoreWindowOrder(overlay: Electron.BrowserWindow | null): void {
  if (overlay && !overlay.isDestroyed()) {
    overlay.show()
    overlay.setAlwaysOnTop(true, 'pop-up-menu')
    overlay.setIgnoreMouseEvents(false)
  }
  showAnnotationToolbar()
  const main = getMainWindow()
  if (main && !main.isDestroyed()) {
    main.moveTop()
    main.setAlwaysOnTop(true, 'screen-saver')
  }
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    try { await worker.terminate() } catch { /* ignore */ }
    worker = null
  }
}

export function registerOCRIPC(): void {
  ipcMain.handle(IPC_CHANNELS.OCR_RECOGNIZE, async (_event, imageDataUrl: string) => {
    try {
      const w = await getWorker()
      const { text } = await runRecognize(w, imageDataUrl)
      return { success: true, text }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('OCR error:', err)
      return { success: false, error: msg }
    }
  })

  // Capture a screen region and run OCR (used during recording)
  ipcMain.handle(IPC_CHANNELS.OCR_CAPTURE_REGION, async (_event, region: SelectionRegion) => {
    const overlay = getAnnotationOverlay()
    const annotationDisplay = getAnnotationDisplay()
    try {
      // Hide overlay so annotations/preview don't contaminate the capture
      if (overlay && !overlay.isDestroyed()) {
        overlay.hide()
      }
      await new Promise(r => setTimeout(r, 150))

      const image = await captureAndCrop(region, annotationDisplay)

      restoreWindowOrder(overlay)

      if (!image || image.isEmpty()) {
        return { success: false, error: 'Ekran yakalanamadı' }
      }
      const dataUrl = image.toDataURL()
      const w = await getWorker()
      const { text } = await runRecognize(w, dataUrl)
      if (!text) return { success: false, error: 'Metin bulunamadı' }

      // Copy via Electron clipboard (renderer window is focusable:false)
      clipboard.writeText(text)
      return { success: true, text }
    } catch (err) {
      restoreWindowOrder(overlay)
      const msg = err instanceof Error ? err.message : String(err)
      console.error('OCR capture-region error:', err)
      return { success: false, error: msg }
    }
  })
}
