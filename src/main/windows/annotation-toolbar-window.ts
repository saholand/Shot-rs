import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../../shared/constants'

let toolbarWindow: BrowserWindow | null = null

/**
 * Toolbar window dimensions.
 * Two rows: main controls + context sub-bar (tool-specific options).
 *
 * Height grows on demand when the renderer requests it (e.g. when the
 * custom-color popover opens and needs ~150px above the toolbar that
 * the regular bounds would clip).
 */
const TOOLBAR_WIDTH = 820
const TOOLBAR_HEIGHT = 92
const TOOLBAR_HEIGHT_EXPANDED = 260
let toolbarBaseY: number | null = null
let toolbarBaseHeight = TOOLBAR_HEIGHT

export function createAnnotationToolbar(): BrowserWindow {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.show()
    return toolbarWindow
  }

  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  // Use workArea so we don't end up under the taskbar on Windows. Falls
  // back to bounds on displays that don't expose a separate work area.
  const area = display.workArea && display.workArea.width > 0 ? display.workArea : display.bounds
  const { x, y, width, height } = area

  // Position: bottom-center of the work area, clamped so the toolbar
  // never spills off-screen on small displays.
  const margin = 40
  const effectiveWidth = Math.min(TOOLBAR_WIDTH, Math.max(240, width - 16))
  const rawX = x + Math.round((width - effectiveWidth) / 2)
  const rawY = y + height - TOOLBAR_HEIGHT - margin
  const toolbarX = Math.max(x + 8, Math.min(rawX, x + width - effectiveWidth - 8))
  const toolbarY = Math.max(y + 8, Math.min(rawY, y + height - TOOLBAR_HEIGHT - 8))
  toolbarBaseY = toolbarY
  toolbarBaseHeight = TOOLBAR_HEIGHT

  toolbarWindow = new BrowserWindow({
    x: toolbarX,
    y: toolbarY,
    width: effectiveWidth,
    height: TOOLBAR_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Higher z-level than overlay ('pop-up-menu') so toolbar receives clicks
  toolbarWindow.setAlwaysOnTop(true, 'screen-saver')

  if (process.env.ELECTRON_RENDERER_URL) {
    toolbarWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/annotation-toolbar.html`)
  } else {
    toolbarWindow.loadFile(join(__dirname, '../renderer/annotation-toolbar.html'))
  }

  // Async close → late 'closed' event could null a newer window's ref.
  const win = toolbarWindow
  win.on('closed', () => {
    if (toolbarWindow === win) {
      toolbarWindow = null
      toolbarBaseY = null
    }
  })

  return toolbarWindow
}

/**
 * Resize the toolbar window. Used when the renderer needs more vertical
 * space (e.g. opening the custom-color popover). Keeps the toolbar's
 * BOTTOM edge fixed so the toolbar doesn't visually jump.
 */
export function registerAnnotationToolbarIPC(): void {
  ipcMain.on(IPC_CHANNELS.ANNOTATION_TOOLBAR_RESIZE, (_event, expanded: boolean) => {
    if (!toolbarWindow || toolbarWindow.isDestroyed() || toolbarBaseY === null) return
    const targetH = expanded ? TOOLBAR_HEIGHT_EXPANDED : TOOLBAR_HEIGHT
    const bounds = toolbarWindow.getBounds()
    const bottomEdge = toolbarBaseY + toolbarBaseHeight
    toolbarWindow.setBounds({
      x: bounds.x,
      y: bottomEdge - targetH,
      width: bounds.width,
      height: targetH
    })
  })
}

export function showAnnotationToolbar(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.show()
    toolbarWindow.moveTop()
    toolbarWindow.setAlwaysOnTop(true, 'screen-saver')
  }
}

export function hideAnnotationToolbar(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.hide()
  }
}

export function closeAnnotationToolbar(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.close()
    toolbarWindow = null
  }
}

export function getAnnotationToolbar(): BrowserWindow | null {
  return toolbarWindow
}
