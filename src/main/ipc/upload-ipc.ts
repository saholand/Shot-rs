import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { uploadScreenshot, uploadFile } from '../services/uploader'
import { updateHistoryShareUrl } from '../services/history-store'
import type { UploadResult } from '../../shared/types/ipc'

export function registerUploadIPC(): void {
  // Upload screenshot from data URL (annotation editor)
  ipcMain.handle(
    IPC_CHANNELS.UPLOAD_SCREENSHOT,
    async (_event, dataUrl: string): Promise<UploadResult> => {
      return uploadScreenshot(dataUrl)
    }
  )

  // Upload file from disk (recording, history)
  ipcMain.handle(
    IPC_CHANNELS.UPLOAD_FILE,
    async (_event, filePath: string, fileType: 'screenshot' | 'recording'): Promise<UploadResult> => {
      const result = await uploadFile(filePath, fileType)

      // Update history entry with share URL
      if (result.success && result.url) {
        updateHistoryShareUrl(filePath, result.url)
      }

      return result
    }
  )
}
