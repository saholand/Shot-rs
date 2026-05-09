import { BrowserWindow, screen, desktopCapturer } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import { getSetting } from '../services/settings-store'

let overlayWindow: BrowserWindow | null = null
let overlayDisplay: Electron.Display | null = null

// Listeners notified when the overlay window closes for any reason
// (normal cancel, OS-level close, crash recovery). screenshot-ipc.ts
// uses this to reset its overlayMode so the next screenshot doesn't
// inherit a stale 'ocr' or 'region' mode.
const closeListeners = new Set<() => void>()

export function onOverlayClosed(fn: () => void): () => void {
  closeListeners.add(fn)
  return () => { closeListeners.delete(fn) }
}

export function getOverlayDisplay(): Electron.Display | null {
  return overlayDisplay
}

/**
 * Capture the current state of `display` as a data URL. Used to feed the
 * selection-phase magnifier loupe with pixel data. Called BEFORE the
 * overlay's React app mounts the dim layer so the captured frame is clean.
 */
async function captureDisplayBackground(display: Electron.Display): Promise<string | null> {
  try {
    const sf = display.scaleFactor
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * sf),
        height: Math.round(display.size.height * sf)
      }
    })
    const idStr = display.id.toString()
    const source = sources.find(s => s.display_id === idStr)
      ?? sources.find(s => s.id.includes(idStr))
      ?? sources[0]
    if (!source || source.thumbnail.isEmpty()) return null
    return source.thumbnail.toDataURL()
  } catch (err) {
    console.warn('Failed to pre-capture overlay background:', err)
    return null
  }
}

export async function createOverlayWindow(): Promise<BrowserWindow> {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus()
    return overlayWindow
  }

  // Get the display where the cursor currently is
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  overlayDisplay = display
  const { x, y, width, height } = display.bounds

  // Kick off capture immediately so it overlaps with window construction
  const backgroundPromise = captureDisplayBackground(display)

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
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  // Wait for the capture to complete BEFORE loading the renderer. While
  // BrowserWindow is constructed transparent + empty, the screen behind
  // it is intact — once React mounts the dim layer, any later capture
  // would include the dim. So we block for the capture here.
  const backgroundDataUrl = await backgroundPromise

  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`)
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  // Async close → late 'closed' event could null a newer window's ref.
  const win = overlayWindow
  win.on('closed', () => {
    if (overlayWindow === win) {
      overlayWindow = null
      overlayDisplay = null
    }
    // Always notify subscribers — even when this is the late closed event
    // for a stale window, subscribers (e.g. screenshot-ipc resetting its
    // overlayMode) need to know the overlay is gone.
    closeListeners.forEach(fn => {
      try { fn() } catch { /* ignore listener errors */ }
    })
  })

  // Send screen bounds + pre-captured background to overlay after it loads
  overlayWindow.webContents.on('did-finish-load', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    overlayWindow.webContents.send(IPC_CHANNELS.SCREEN_BOUNDS, {
      x,
      y,
      width,
      height,
      scaleFactor: display.scaleFactor,
      magnifierEnabled: !!getSetting('magnifierEnabled'),
      magnifierZoom: getSetting('magnifierZoom') ?? 'medium'
    })
    if (backgroundDataUrl) {
      overlayWindow.webContents.send(
        IPC_CHANNELS.OVERLAY_BACKGROUND,
        backgroundDataUrl,
        display.scaleFactor
      )
    }
    overlayWindow.show()
    overlayWindow.focus()
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
