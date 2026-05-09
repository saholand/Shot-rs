import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import { getMainWindow } from './main-window'
import {
  createAnnotationToolbar,
  showAnnotationToolbar,
  hideAnnotationToolbar,
  closeAnnotationToolbar
} from './annotation-toolbar-window'

let annotationWindow: BrowserWindow | null = null
let annotationDisplay: Electron.Display | null = null
let drawMode = false

export function getAnnotationDisplay(): Electron.Display | null {
  return annotationDisplay
}

export function createAnnotationOverlay(): BrowserWindow {
  if (annotationWindow && !annotationWindow.isDestroyed()) {
    annotationWindow.show()
    return annotationWindow
  }

  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  annotationDisplay = display
  const { x, y, width, height } = display.bounds

  annotationWindow = new BrowserWindow({
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
    focusable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Use 'pop-up-menu' so the compact recording bar ('screen-saver') stays above
  annotationWindow.setAlwaysOnTop(true, 'pop-up-menu')

  // Start in passthrough mode (click-through)
  drawMode = false
  annotationWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    annotationWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/annotation-overlay.html`)
  } else {
    annotationWindow.loadFile(join(__dirname, '../renderer/annotation-overlay.html'))
  }

  // Pre-create toolbar window (hidden) — will be shown on draw mode
  createAnnotationToolbar()
  hideAnnotationToolbar()

  annotationWindow.on('closed', () => {
    annotationWindow = null
    annotationDisplay = null
    drawMode = false
  })

  return annotationWindow
}

export function toggleAnnotationDrawMode(): boolean {
  if (!annotationWindow || annotationWindow.isDestroyed()) return false

  drawMode = !drawMode

  if (drawMode) {
    // Draw mode: overlay catches mouse events
    annotationWindow.setIgnoreMouseEvents(false)
    // Show the content-protected toolbar window
    showAnnotationToolbar()
  } else {
    // Passthrough: mouse goes through, drawings stay visible
    annotationWindow.setIgnoreMouseEvents(true, { forward: true })
    // Hide toolbar when not drawing
    hideAnnotationToolbar()
  }

  annotationWindow.webContents.send(IPC_CHANNELS.ANNOTATION_OVERLAY_MODE, drawMode ? 'draw' : 'passthrough')

  // Notify main window so the recording panel can update its button state
  const mainWin = getMainWindow()
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(IPC_CHANNELS.ANNOTATION_MODE_CHANGED, drawMode)
  }

  return drawMode
}

export function closeAnnotationOverlay(): void {
  // Close toolbar window first
  closeAnnotationToolbar()

  if (annotationWindow && !annotationWindow.isDestroyed()) {
    annotationWindow.close()
    annotationWindow = null
    annotationDisplay = null
    drawMode = false
  }
}

export function getAnnotationOverlay(): BrowserWindow | null {
  return annotationWindow
}

export function isAnnotationDrawMode(): boolean {
  return drawMode
}

export function registerAnnotationOverlayIPC(): void {
  ipcMain.on(IPC_CHANNELS.ANNOTATION_OVERLAY_TOGGLE, () => {
    toggleAnnotationDrawMode()
  })

  // Stop recording from annotation overlay or toolbar (sends signal to main window)
  ipcMain.on(IPC_CHANNELS.ANNOTATION_STOP_RECORDING, () => {
    const mainWin = getMainWindow()
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.ANNOTATION_STOP_RECORDING)
    }
  })

  // Forward annotation commands from toolbar window to overlay canvas
  ipcMain.on(IPC_CHANNELS.ANNOTATION_COMMAND, (_event, command) => {
    if (annotationWindow && !annotationWindow.isDestroyed()) {
      annotationWindow.webContents.send(IPC_CHANNELS.ANNOTATION_COMMAND, command)
    }
  })
}
