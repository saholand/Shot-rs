import { BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { isQuitting } from '../services/app-state'
import { getSetting } from '../services/settings-store'
import { IPC_CHANNELS, APP_NAME } from '../../shared/constants'

function loadAppIcon(): Electron.NativeImage | undefined {
  try {
    const iconPath = join(__dirname, '../../resources/icon.ico')
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) return icon
  } catch {
    // fallback: Electron default icon
  }
  return undefined
}

let mainWindow: BrowserWindow | null = null
let isPinned = false

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 400,
    height: 48,
    resizable: false,
    maximizable: false,
    minimizable: true,
    frame: false,
    transparent: true,
    title: APP_NAME,
    icon: loadAppIcon(),
    center: true,
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Close → hide (stay in tray) or quit, depending on setting
  mainWindow.on('close', (e) => {
    if (!isQuitting() && getSetting('closeToTray')) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  // Async close → late 'closed' event could null a newer window's ref.
  // Self-check: only clear the module ref if it still points at this win.
  const win = mainWindow
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

export function hideMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
  }
}

/** Force main window above annotation overlay during recording */
export function setRecordingAlwaysOnTop(on: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (on) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    // Hide compact bar from screen capture (visible to user, invisible in recording)
    mainWindow.setContentProtection(true)
  } else {
    // Restore: only stay on top if user pinned
    mainWindow.setAlwaysOnTop(isPinned, 'screen-saver')
    mainWindow.setContentProtection(false)
  }
}

export function registerMainWindowIPC(): void {
  ipcMain.handle(IPC_CHANNELS.APP_TOGGLE_PIN, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false
    isPinned = !isPinned
    mainWindow.setAlwaysOnTop(isPinned, 'screen-saver')
    return isPinned
  })

  ipcMain.on(IPC_CHANNELS.APP_CLOSE, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (getSetting('closeToTray')) {
      mainWindow.hide()
    } else {
      mainWindow.close()
    }
  })

  ipcMain.on(IPC_CHANNELS.APP_HIDE, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.hide()
  })

  ipcMain.on(IPC_CHANNELS.APP_RESIZE, (_event, width: number, height: number) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const clampedW = Math.max(200, Math.min(800, width))
    const clampedH = Math.max(36, Math.min(700, height))
    mainWindow.setResizable(true)
    mainWindow.setSize(clampedW, clampedH, true)
    mainWindow.setResizable(false)
  })
}
