import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

let toolbarWindow: BrowserWindow | null = null

/**
 * Toolbar window dimensions.
 * The toolbar is a compact strip: tools + colors + actions.
 */
const TOOLBAR_WIDTH = 780
const TOOLBAR_HEIGHT = 52

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

  toolbarWindow.on('closed', () => {
    toolbarWindow = null
  })

  return toolbarWindow
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
