import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'

let overlayWindow: BrowserWindow | null = null

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus()
    return overlayWindow
  }

  // Get the display where the cursor currently is
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const { x, y, width, height } = display.bounds

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`)
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  // Send screen bounds to overlay after it loads
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow?.webContents.send(IPC_CHANNELS.SCREEN_BOUNDS, {
      x,
      y,
      width,
      height,
      scaleFactor: display.scaleFactor
    })
  })

  return overlayWindow
}

export function closeOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
    overlayWindow = null
  }
}

export function hideOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
}

export function showOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    overlayWindow.focus()
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  }
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}
