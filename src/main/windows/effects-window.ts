/**
 * Recording effects overlay — a single transparent always-on-top window
 * spanning the full virtual desktop. Hosts:
 *
 *   - click ripples (Phase 2)
 *   - cursor spotlight / dim background (Phase 3, future)
 *
 * The window is content-protection-OFF so its overlays appear in screen
 * captures, click-through (setIgnoreMouseEvents) so the user can still
 * interact with apps underneath.
 */

import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'
import { logInfo } from '../services/logger'
import type { EffectsState, EffectsClickPayload, HighlighterPosPayload } from '../../shared/types/ipc'

let effectsWindow: BrowserWindow | null = null

export function createEffectsWindow(): BrowserWindow {
  if (effectsWindow && !effectsWindow.isDestroyed()) {
    effectsWindow.show()
    return effectsWindow
  }

  // Span the virtual desktop so events on any monitor land inside the
  // window's coordinate space.
  const displays = screen.getAllDisplays()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x)
    minY = Math.min(minY, d.bounds.y)
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width)
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height)
  }

  effectsWindow = new BrowserWindow({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
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

  effectsWindow.setAlwaysOnTop(true, 'screen-saver')
  effectsWindow.setIgnoreMouseEvents(true, { forward: true })

  logInfo('effects-window', `creating at ${minX},${minY} ${maxX-minX}x${maxY-minY}`)
  if (process.env.ELECTRON_RENDERER_URL) {
    effectsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/effects.html`)
  } else {
    effectsWindow.loadFile(join(__dirname, '../renderer/effects.html'))
  }
  effectsWindow.webContents.on('did-finish-load', () => logInfo('effects-window', 'loaded'))
  effectsWindow.webContents.on('did-fail-load', (_e, code, desc) =>
    logInfo('effects-window', `load failed: ${code} ${desc}`))

  // Async close → late 'closed' event could null a newer window's ref.
  const win = effectsWindow
  win.on('closed', () => { if (effectsWindow === win) effectsWindow = null })

  return effectsWindow
}

export function getEffectsWindow(): BrowserWindow | null {
  return effectsWindow
}

export function closeEffectsWindow(): void {
  if (effectsWindow && !effectsWindow.isDestroyed()) {
    effectsWindow.close()
  }
  effectsWindow = null
}

export function pushEffectsState(state: EffectsState): void {
  if (effectsWindow && !effectsWindow.isDestroyed()) {
    effectsWindow.webContents.send(IPC_CHANNELS.EFFECTS_STATE, state)
  }
}

export function pushEffectsClick(payload: EffectsClickPayload): void {
  if (!effectsWindow || effectsWindow.isDestroyed()) return
  // Convert virtual-desktop coords to window-local
  const bounds = effectsWindow.getBounds()
  effectsWindow.webContents.send(IPC_CHANNELS.EFFECTS_CLICK, {
    x: payload.x - bounds.x,
    y: payload.y - bounds.y,
    button: payload.button
  })
}

export function pushEffectsCursor(payload: HighlighterPosPayload): void {
  if (!effectsWindow || effectsWindow.isDestroyed()) return
  const bounds = effectsWindow.getBounds()
  effectsWindow.webContents.send(IPC_CHANNELS.EFFECTS_CURSOR_POS, {
    x: payload.x - bounds.x,
    y: payload.y - bounds.y
  })
}
