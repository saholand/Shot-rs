import { ipcMain, nativeImage, BrowserWindow, clipboard, Notification } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import {
  createOverlayWindow,
  closeOverlayWindow,
  getOverlayWindow,
  hideOverlayWindow,
  showOverlayWindow
} from '../windows/overlay-window'
import { getMainWindow } from '../windows/main-window'
import { captureAndCrop, captureFullScreen } from '../screenshot/capture'
import { exportToClipboard, exportToFile } from '../screenshot/export'
import type { SelectionRegion, ExportResult } from '../../shared/types/ipc'

let lastCapturedImage: Electron.NativeImage | null = null

type OverlayMode = 'screenshot' | 'region' | 'ocr'
let overlayMode: OverlayMode = 'screenshot'

// Lazy-import OCR worker from ocr-ipc (shared worker)
let ocrWorkerGetter: (() => Promise<import('tesseract.js').Worker>) | null = null

export function setOCRWorkerGetter(getter: () => Promise<import('tesseract.js').Worker>): void {
  ocrWorkerGetter = getter
}

export function startOCRSelection(): void {
  overlayMode = 'ocr'
  createOverlayWindow()
}

export function registerScreenshotIPC(): void {
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_START, () => {
    createOverlayWindow()
  })

  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_CANCEL, () => {
    closeOverlayWindow()
  })

  // Region selection for recording — opens overlay in region-only mode
  ipcMain.handle(IPC_CHANNELS.RECORDING_SELECT_REGION, () => {
    overlayMode = 'region'
    createOverlayWindow()
  })

  // OCR start — open overlay for region selection in OCR mode
  ipcMain.handle(IPC_CHANNELS.OCR_START, () => {
    startOCRSelection()
  })

  // Overlay confirmed selection → screenshot, region selection, or OCR
  ipcMain.on(IPC_CHANNELS.OVERLAY_SELECTION_DONE, async (_event, region: SelectionRegion) => {
    // Region selection mode: send region to main window for recording, close overlay
    if (overlayMode === 'region') {
      overlayMode = 'screenshot'
      closeOverlayWindow()
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.webContents.send(IPC_CHANNELS.RECORDING_REGION_SELECTED, region)
      }
      return
    }

    // OCR mode: capture region → OCR → clipboard
    if (overlayMode === 'ocr') {
      overlayMode = 'screenshot'
      hideOverlayWindow()
      await new Promise(resolve => setTimeout(resolve, 100))

      try {
        const image = await captureAndCrop(region)
        closeOverlayWindow()

        if (!image || image.isEmpty()) {
          showOCRNotification('Ekran yakalanamadı', false)
          return
        }

        const dataUrl = image.toDataURL()

        // Use shared OCR worker
        if (!ocrWorkerGetter) {
          showOCRNotification('OCR hazır değil', false)
          return
        }
        const w = await ocrWorkerGetter()
        const result = await w.recognize(dataUrl)
        const text = result.data.text.trim()

        if (!text) {
          showOCRNotification('Metin bulunamadı', false)
          return
        }

        clipboard.writeText(text)
        showOCRNotification(`Metin kopyalandı! (${text.length} karakter)`, true)
      } catch (err) {
        closeOverlayWindow()
        const msg = err instanceof Error ? err.message : String(err)
        console.error('OCR hotkey error:', msg)
        showOCRNotification('OCR hatası', false)
      }
      return
    }

    const overlay = getOverlayWindow()

    // Hide overlay for clean capture
    hideOverlayWindow()
    await new Promise(resolve => setTimeout(resolve, 100))

    let result: { full: Electron.NativeImage; cropped: Electron.NativeImage; scaleFactor: number } | null = null
    try {
      result = await captureFullScreen(region)
    } catch (err) {
      closeOverlayWindow()
      const message = err instanceof Error ? err.message : 'Capture failed'
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SCREENSHOT_RESULT, {
          clipboard: { success: false, action: 'capture', error: message },
          file: null
        })
      }
      return
    }

    if (!result || result.cropped.isEmpty()) {
      closeOverlayWindow()
      return
    }

    lastCapturedImage = result.cropped

    // Send full screen image + region to overlay for inline editing with re-crop
    if (overlay && !overlay.isDestroyed()) {
      showOverlayWindow()
      overlay.webContents.send(
        IPC_CHANNELS.OVERLAY_CAPTURED,
        result.full.toDataURL(),
        region,
        result.scaleFactor
      )
    } else {
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SCREENSHOT_CAPTURED, result.cropped.toDataURL())
      }
    }
  })

  ipcMain.on(IPC_CHANNELS.OVERLAY_CANCELLED, () => {
    const wasRegionMode = overlayMode === 'region'
    overlayMode = 'screenshot'
    closeOverlayWindow()
    // Show main window back when region selection is cancelled
    if (wasRegionMode) {
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
      }
    }
  })

  // Manual capture from renderer
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_CAPTURE, async (_event, region: SelectionRegion) => {
    try {
      const image = await captureAndCrop(region)
      if (image && !image.isEmpty()) {
        lastCapturedImage = image
        return image.toDataURL()
      }
    } catch {
      // Fall through
    }
    return null
  })

  // Copy final composited image (with annotations) to clipboard
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_COPY_FINAL, (_event, dataUrl: string): ExportResult => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl)
      if (image.isEmpty()) {
        return { success: false, action: 'clipboard', error: 'Empty image' }
      }
      lastCapturedImage = image
      return exportToClipboard(image)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Copy failed'
      return { success: false, action: 'clipboard', error: message }
    }
  })

  // Save final composited image (with annotations) to file
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_SAVE_FINAL, async (event, dataUrl: string): Promise<ExportResult> => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl)
      if (image.isEmpty()) {
        return { success: false, action: 'file', error: 'Empty image' }
      }
      lastCapturedImage = image
      // Use the calling window as parent for save dialog
      const callerWindow = BrowserWindow.fromWebContents(event.sender)
      return exportToFile(image, callerWindow)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      return { success: false, action: 'file', error: message }
    }
  })

  // Legacy manual save/copy (without annotations)
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_SAVE, async (): Promise<ExportResult> => {
    if (!lastCapturedImage) {
      return { success: false, action: 'file', error: 'No image to save' }
    }
    const mainWindow = getMainWindow()
    return exportToFile(lastCapturedImage, mainWindow)
  })

  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_COPY, (): ExportResult => {
    if (!lastCapturedImage) {
      return { success: false, action: 'clipboard', error: 'No image to copy' }
    }
    return exportToClipboard(lastCapturedImage)
  })
}

function showOCRNotification(body: string, success: boolean): void {
  new Notification({
    title: success ? 'OCR Tamamlandı' : 'OCR Hatası',
    body
  }).show()
}
