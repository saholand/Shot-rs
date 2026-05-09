/**
 * Webcam preview window — draggable + resizable by the user, visible in
 * the screen recording (content-protection OFF). The renderer inside
 * runs `getUserMedia({video: deviceId})` and shows the camera; the user
 * places + sizes the window where they want, and the OS desktopCapturer
 * picks it up alongside everything else when recording.
 *
 * Drag is handled via -webkit-app-region: drag on a top handle inside
 * the renderer. Resize is handled via 8 invisible handle elements on
 * the edges; the renderer captures pointer events and calls the main
 * process to update the window bounds.
 */

import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import { saveSettings, getSettings } from '../services/settings-store'

let webcamWindow: BrowserWindow | null = null

interface InitArgs {
  deviceId: string | null
  shape: 'circle' | 'rounded'
}

const DEFAULT_W = 240
const DEFAULT_H = 240

export function createWebcamWindow(args: InitArgs): BrowserWindow {
  if (webcamWindow && !webcamWindow.isDestroyed()) {
    webcamWindow.show()
    pushWebcamConfig(args)
    return webcamWindow
  }

  // Restore saved bounds, or place near top-right of the cursor's display
  // (top-right is more visible than bottom-right since the bottom edge
  // often has the taskbar / dock obstructing).
  const settings = getSettings()
  let x: number, y: number, w = DEFAULT_W, h = DEFAULT_H
  if (settings.webcamBounds) {
    ({ x, y, w, h } = settings.webcamBounds)
  } else {
    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    x = display.bounds.x + display.bounds.width - w - 24
    y = display.bounds.y + 60
  }
  console.log(`[webcam] creating window at ${x},${y} ${w}×${h}, deviceId=${args.deviceId}`)

  webcamWindow = new BrowserWindow({
    x, y, width: w, height: h,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,        // we handle resize manually for fine-grained UX
    movable: true,
    fullscreenable: false,
    hasShadow: false,
    minWidth: 100,
    minHeight: 100,
    maxWidth: 800,
    maxHeight: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  webcamWindow.setAlwaysOnTop(true, 'screen-saver')

  if (process.env.ELECTRON_RENDERER_URL) {
    webcamWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/webcam.html`)
  } else {
    webcamWindow.loadFile(join(__dirname, '../renderer/webcam.html'))
  }

  webcamWindow.webContents.once('did-finish-load', () => {
    pushWebcamConfig(args)
  })

  // Persist position/size on close (if window lifecycle moves it later
  // we'll persist on each setBounds via the IPC handler below).
  webcamWindow.on('closed', () => {
    webcamWindow = null
  })

  return webcamWindow
}

export function getWebcamWindow(): BrowserWindow | null {
  return webcamWindow
}

export function closeWebcamWindow(): void {
  if (webcamWindow && !webcamWindow.isDestroyed()) {
    webcamWindow.close()
  }
  webcamWindow = null
}

export function pushWebcamConfig(args: InitArgs): void {
  if (webcamWindow && !webcamWindow.isDestroyed()) {
    webcamWindow.webContents.send(IPC_CHANNELS.WEBCAM_CONFIG, args)
  }
}

/** IPC handlers for drag-resize from the renderer. */
export function registerWebcamWindowIPC(): void {
  ipcMain.on(IPC_CHANNELS.WEBCAM_SET_BOUNDS, (_event, bounds: { x: number; y: number; w: number; h: number }) => {
    if (!webcamWindow || webcamWindow.isDestroyed()) return
    const w = Math.max(100, Math.min(800, Math.round(bounds.w)))
    const h = Math.max(100, Math.min(800, Math.round(bounds.h)))
    webcamWindow.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: w,
      height: h
    })
    // Persist
    const s = getSettings()
    saveSettings({ ...s, webcamBounds: { x: Math.round(bounds.x), y: Math.round(bounds.y), w, h } })
  })

  ipcMain.handle(IPC_CHANNELS.WEBCAM_GET_BOUNDS, () => {
    if (!webcamWindow || webcamWindow.isDestroyed()) return null
    const b = webcamWindow.getBounds()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })
}
