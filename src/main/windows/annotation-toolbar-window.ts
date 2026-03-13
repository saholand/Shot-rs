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
  const { x, y, width, height } = display.bounds

  // Position: bottom-center of the display
  const toolbarX = x + Math.round((width - TOOLBAR_WIDTH) / 2)
  const toolbarY = y + height - TOOLBAR_HEIGHT - 40

  toolbarWindow = new BrowserWindow({
    x: toolbarX,
    y: toolbarY,
    width: TOOLBAR_WIDTH,
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
