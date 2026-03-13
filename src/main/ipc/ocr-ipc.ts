import { ipcMain, clipboard } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { captureAndCrop } from '../screenshot/capture'
import { getAnnotationOverlay } from '../windows/annotation-overlay-window'
import { showAnnotationToolbar } from '../windows/annotation-toolbar-window'
import { getMainWindow } from '../windows/main-window'
import type { SelectionRegion } from '../../shared/types/ipc'

// Lazy-load tesseract.js to avoid interfering with electron startup
let TesseractModule: typeof import('tesseract.js') | null = null
let worker: import('tesseract.js').Worker | null = null
let workerLoading = false

async function getTesseract() {
  if (!TesseractModule) {
    TesseractModule = await import('tesseract.js')
  }
  return TesseractModule.default || TesseractModule
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
    worker = await Tesseract.createWorker('eng+tur')
    return worker
  } finally {
    workerLoading = false
  }
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
      const result = await w.recognize(imageDataUrl)
      const text = result.data.text.trim()
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
    try {
      // Hide overlay so annotations/preview don't contaminate the capture
      if (overlay && !overlay.isDestroyed()) {
        overlay.hide()
      }
      await new Promise(r => setTimeout(r, 150))

      const image = await captureAndCrop(region)

      restoreWindowOrder(overlay)

      if (!image || image.isEmpty()) {
        return { success: false, error: 'Ekran yakalanamadı' }
      }
      const dataUrl = image.toDataURL()
      const w = await getWorker()
      const result = await w.recognize(dataUrl)
      const text = result.data.text.trim()
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
