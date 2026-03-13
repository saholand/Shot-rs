import { clipboard, dialog, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { randomUUID } from 'crypto'
import type { ExportResult } from '../../shared/types/ipc'
import { addHistoryEntry } from '../services/history-store'
import { getSettings } from '../services/settings-store'
import { resolveFileName } from '../../shared/types/settings'

/**
 * Shared core: convert NativeImage to PNG buffer.
 * Both clipboard and file export use this.
 */
export function imageToPNG(image: Electron.NativeImage): Buffer {
  return image.toPNG()
}

/**
 * Copy image to system clipboard.
 */
export function exportToClipboard(image: Electron.NativeImage): ExportResult {
  try {
    const buffer = imageToPNG(image)
    if (buffer.length === 0) {
      return { success: false, action: 'clipboard', error: 'Empty image buffer' }
    }
    clipboard.writeImage(image)
    return { success: true, action: 'clipboard' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown clipboard error'
    return { success: false, action: 'clipboard', error: message }
  }
}

/**
 * Save image to file via save dialog.
 * Returns result indicating success, cancel, or error.
 */
export async function exportToFile(
  image: Electron.NativeImage,
  parentWindow?: BrowserWindow | null
): Promise<ExportResult> {
  try {
    const settings = getSettings()
    const fileName = resolveFileName(settings.screenshotFileNameFormat, 'png')
    const defaultPath = settings.defaultSaveDir
      ? join(settings.defaultSaveDir, fileName)
      : fileName

    const dialogOptions: Electron.SaveDialogOptions = {
      title: 'Ekran Görüntüsünü Kaydet',
      defaultPath,
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    }

    const { canceled, filePath } = parentWindow
      ? await dialog.showSaveDialog(parentWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)

    if (canceled || !filePath) {
      return { success: false, action: 'file', error: 'Save cancelled' }
    }

    const buffer = imageToPNG(image)
    if (buffer.length === 0) {
      return { success: false, action: 'file', error: 'Empty image buffer' }
    }

    await writeFile(filePath, buffer)

    // Record in history with thumbnail
    const thumbnail = image.resize({ width: 160 })
    addHistoryEntry({
      id: randomUUID(),
      type: 'screenshot',
      filePath,
      fileName: basename(filePath),
      timestamp: Date.now(),
      thumbnailDataUrl: thumbnail.toDataURL()
    })

    return { success: true, action: 'file', filePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown file save error'
    return { success: false, action: 'file', error: message }
  }
}
