import { ipcMain, shell, dialog, BrowserWindow, clipboard, nativeImage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import {
  getAllHistory,
  deleteHistoryEntry,
  clearHistory
} from '../services/history-store'
import { tMain } from '../services/i18n-main'

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
        return { success: false, error: tMain('error.fileNotFound') }
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
          return { success: false, error: tMain('error.fileNotFoundShort') }
        }
        const img = nativeImage.createFromPath(filePath)
        if (img.isEmpty()) {
          return { success: false, error: tMain('error.imageUnreadable') }
        }
        clipboard.writeImage(img)
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : tMain('error.copyFailed') }
      }
    }
  )
}
