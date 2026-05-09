/**
 * Always-on-top transparent BrowserWindow that paints a fluorescent disc
 * under the user's cursor during recording. Click-through so it doesn't
 * intercept any mouse interaction; visible to screen-capture so it shows
 * up in the recorded video.
 */

import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import type { HighlighterCursorState, HighlighterPosPayload } from '../../shared/types/ipc'

let cursorWindow: BrowserWindow | null = null

export function createHighlighterCursorWindow(): BrowserWindow {
  if (cursorWindow && !cursorWindow.isDestroyed()) {
    cursorWindow.show()
    return cursorWindow
  }

  // Span the entire virtual desktop (union of all displays' bounds) so
  // the cursor disc stays visible no matter which monitor the user
  // moves to. uiohook reports cursor coords in this same virtual space.
  const displays = screen.getAllDisplays()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x)
    minY = Math.min(minY, d.bounds.y)
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width)
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height)
  }
  const x = minX, y = minY
  const width = maxX - minX
  const height = maxY - minY

  cursorWindow = new BrowserWindow({
    x, y, width, height,
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

  cursorWindow.setAlwaysOnTop(true, 'screen-saver')
  // Make ALL clicks pass through; user keeps interacting with what's behind.
  cursorWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    cursorWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/highlighter-cursor.html`)
  } else {
    cursorWindow.loadFile(join(__dirname, '../renderer/highlighter-cursor.html'))
  }

  // Async close → late 'closed' event could null a newer window's ref.
  const win = cursorWindow
  win.on('closed', () => { if (cursorWindow === win) cursorWindow = null })

  return cursorWindow
}

export function getHighlighterCursorWindow(): BrowserWindow | null {
  return cursorWindow
}

export function closeHighlighterCursorWindow(): void {
  if (cursorWindow && !cursorWindow.isDestroyed()) {
    cursorWindow.close()
  }
  cursorWindow = null
}

export function pushHighlighterState(state: HighlighterCursorState): void {
  if (cursorWindow && !cursorWindow.isDestroyed()) {
    cursorWindow.webContents.send(IPC_CHANNELS.HIGHLIGHTER_CURSOR_UPDATE, state)
  }
}

export function pushHighlighterPos(pos: HighlighterPosPayload): void {
  if (cursorWindow && !cursorWindow.isDestroyed()) {
    // Convert virtual-desktop coords to window-local
    const bounds = cursorWindow.getBounds()
    const local: HighlighterPosPayload = { x: pos.x - bounds.x, y: pos.y - bounds.y }
    cursorWindow.webContents.send(IPC_CHANNELS.HIGHLIGHTER_CURSOR_POS, local)
  }
}
