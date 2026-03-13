import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'
import { getSettings, saveSettings } from '../services/settings-store'
import { getMainWindow } from '../windows/main-window'
import { reRegisterHotkeys } from '../services/hotkey'
import type { AppSettings } from '../../shared/types/settings'

export function registerSettingsIPC(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_event, settings: AppSettings) => {
    saveSettings(settings)
    // Re-register hotkeys if they changed
    reRegisterHotkeys()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SELECT_DIR, async (): Promise<string | null> => {
    const mainWindow = getMainWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Varsayılan kayıt klasörünü seç',
      properties: ['openDirectory']
    }

    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
}
