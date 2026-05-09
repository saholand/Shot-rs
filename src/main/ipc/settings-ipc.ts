import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { getSettings, saveSettings } from '../services/settings-store'
import { getMainWindow } from '../windows/main-window'
import { reRegisterHotkeys } from '../services/hotkey'
import { tMain } from '../services/i18n-main'
import type { AppSettings } from '../../shared/types/settings'

export function registerSettingsIPC(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_event, settings: AppSettings): {
    success: boolean
    error?: string
    /** Hotkeys that couldn't be bound (taken by another app or invalid). */
    failedHotkeys?: { type: string; hotkey: string }[]
  } => {
    try {
      saveSettings(settings)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'save failed' }
    }
    // Re-register hotkeys if they changed. Failure here doesn't roll back
    // the saved settings — the user already chose them — but we surface
    // the conflict list so the UI can show a specific warning.
    try {
      const result = reRegisterHotkeys()
      if (result.failed.length > 0) {
        return { success: true, failedHotkeys: result.failed }
      }
    } catch (err) {
      return { success: true, error: err instanceof Error ? err.message : 'hotkey register failed' }
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SELECT_DIR, async (): Promise<string | null> => {
    const mainWindow = getMainWindow()
    const options: Electron.OpenDialogOptions = {
      title: tMain('dialog.selectDefaultSaveDir'),
      properties: ['openDirectory']
    }

    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
}
