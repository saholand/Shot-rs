import { Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import { getMainWindow, showMainWindow, hideMainWindow } from '../windows/main-window'
import { createOverlayWindow } from '../windows/overlay-window'

let tray: Tray | null = null

function loadTrayIcon(): Electron.NativeImage {
  try {
    const iconPath = join(__dirname, '../../resources/tray-icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) return icon
  } catch {
    // fall through
  }
  // Fallback: empty image (tray still works, just no visible icon)
  return nativeImage.createEmpty()
}

function toggleWindow(): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed() && win.isVisible()) {
    hideMainWindow()
  } else {
    showMainWindow()
  }
}

export function createTray(): void {
  if (tray) return

  const icon = loadTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('Shotırs')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: toggleWindow
    },
    { type: 'separator' },
    {
      label: 'Screenshot',
      click: () => {
        createOverlayWindow()
      }
    },
    {
      label: 'Recording',
      click: () => {
        showMainWindow()
        const win = getMainWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.APP_FORCE_MODE, 'recording')
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Single click → show, double click → toggle
  tray.on('click', () => showMainWindow())
  tray.on('double-click', toggleWindow)
}

export function updateTrayRecordingState(recording: boolean): void {
  if (!tray) return

  if (recording) {
    tray.setToolTip('Shotırs — Recording...')
  } else {
    tray.setToolTip('Shotırs')
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
