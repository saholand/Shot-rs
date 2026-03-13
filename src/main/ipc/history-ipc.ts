import { ipcMain, shell, dialog, BrowserWindow, clipboard, nativeImage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import {
  getAllHistory,
  deleteHistoryEntry,
  clearHistory
} from '../services/history-store'

export function registerHistoryIPC(): void {
  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_ALL, () => {
    return getAllHistory()
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_DELETE, (_event, id: string) => {
    deleteHistoryEntry(id)
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, () => {
    clearHistory()
  })

  ipcMain.handle(
    IPC_CHANNELS.HISTORY_OPEN_FILE,
    async (_event, filePath: string): Promise<{ success: boolean; error?: string }> => {
      if (!existsSync(filePath)) {
        return { success: false, error: 'Dosya bulunamadı. Silinmiş veya taşınmış olabilir.' }
      }
      const result = await shell.openPath(filePath)
      if (result) {
        return { success: false, error: result }
      }
      return { success: true }
    }
  )

  ipcMain.on(IPC_CHANNELS.HISTORY_SHOW_IN_FOLDER, (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // Copy image file to clipboard
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_COPY_FILE,
    async (_event, filePath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!existsSync(filePath)) {
          return { success: false, error: 'Dosya bulunamadı' }
        }
        const img = nativeImage.createFromPath(filePath)
        if (img.isEmpty()) {
          return { success: false, error: 'Görüntü okunamadı' }
        }
        clipboard.writeImage(img)
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Kopyalama hatası' }
      }
    }
  )

  // Read file as buffer (for GIF export etc.)
  ipcMain.handle(
    IPC_CHANNELS.FILE_READ_BUFFER,
    async (_event, filePath: string): Promise<ArrayBuffer> => {
      const buffer = readFileSync(filePath)
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }
  )

  // Save buffer to file with save dialog
  ipcMain.handle(
    IPC_CHANNELS.FILE_SAVE_BUFFER,
    async (_event, buffer: ArrayBuffer, defaultName: string): Promise<{ success: boolean; filePath?: string; error?: string }> => {
      try {
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
        const ext = defaultName.split('.').pop() || 'gif'
        const result = await dialog.showSaveDialog(win!, {
          defaultPath: defaultName,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
        })
        if (result.canceled || !result.filePath) {
          return { success: false, error: 'İptal edildi' }
        }
        writeFileSync(result.filePath, Buffer.from(buffer))
        return { success: true, filePath: result.filePath }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Kaydetme hatası' }
      }
    }
  )
}
