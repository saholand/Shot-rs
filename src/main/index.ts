// Suppress EPIPE errors from broken stdout/stderr pipes (dev mode)
process.stdout?.on?.('error', () => {})
process.stderr?.on?.('error', () => {})

// Last-resort error handlers. An uncaught exception or unhandled promise
// rejection in the main process would otherwise either crash the app
// silently (in production) or print a useless stack to a stderr that no
// one is reading. Log to file (userData/logs/app.log) and keep the app
// alive — Electron's default exit(1) on uncaught is hostile to a tray-
// resident app.
process.on('uncaughtException', (err) => {
  try { console.error('[main] uncaughtException:', err) } catch { /* EPIPE */ }
  // Lazy import — logger needs `app` ready, but uncaught can fire even
  // before whenReady. The require is cheap and guarded inside the logger.
  try { require('./services/logger').logError('main', 'uncaughtException', err) } catch { /* ignore */ }
})
process.on('unhandledRejection', (reason) => {
  try { console.error('[main] unhandledRejection:', reason) } catch { /* EPIPE */ }
  try { require('./services/logger').logError('main', 'unhandledRejection', reason) } catch { /* ignore */ }
})

import { app, BrowserWindow, protocol, net, screen } from 'electron'
import { pathToFileURL } from 'url'
import { resolve as resolvePath, relative as relativePath, extname, sep } from 'path'
import { createMainWindow, getMainWindow, registerMainWindowIPC } from './windows/main-window'
import { createOverlayWindow } from './windows/overlay-window'
import { IPC_CHANNELS } from '../shared/constants'
import { registerScreenshotIPC } from './ipc/screenshot-ipc'
import { registerRecordingIPC } from './ipc/recording-ipc'
import { registerHistoryIPC } from './ipc/history-ipc'
import { registerSettingsIPC } from './ipc/settings-ipc'
import { registerUploadIPC } from './ipc/upload-ipc'
import { registerOCRIPC, getWorker, terminateWorker } from './ipc/ocr-ipc'
import { registerScreenshotHotkey, registerRecordingHotkey, registerAnnotationHotkey, registerOCRHotkey, unregisterAll } from './services/hotkey'
import { startOCRSelection, setOCRWorkerGetter } from './ipc/screenshot-ipc'
import { toggleAnnotationDrawMode, getAnnotationOverlay, registerAnnotationOverlayIPC } from './windows/annotation-overlay-window'
import { registerAnnotationToolbarIPC } from './windows/annotation-toolbar-window'
import { registerWebcamWindowIPC } from './windows/webcam-window'
import { createTray, destroyTray, updateTrayRecordingState } from './services/tray'
import { setQuitting } from './services/app-state'
import { getSetting } from './services/settings-store'
import { isRecording } from './recording/lifecycle'
import { getAvailableSources } from './recording/source-selector'
import { initAutoUpdater } from './services/updater'

// Register custom protocol for serving local media files to renderer
// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: { stream: true, supportFetchAPI: true, bypassCSP: true }
  }
])

// Allowlist of file extensions servable through local-media://. Anything
// else (config files, executables, plain text) is rejected.
const ALLOWED_LOCAL_MEDIA_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.webm', '.mp4', '.gif', '.mov'])

/**
 * Returns true if `requested` resolves under (or equal to) `root`. Handles
 * Windows case-insensitive comparison and normalizes ".." traversal.
 */
function isPathInside(requested: string, root: string): boolean {
  const rel = relativePath(root, requested)
  if (!rel || rel.startsWith('..') || rel.startsWith(`..${sep}`)) return false
  // Reject absolute relpath (different drive on Windows)
  return !resolvePath(rel).startsWith(sep) && !/^[A-Za-z]:/.test(rel)
}

app.whenReady().then(() => {
  // Handle local-media:// requests by serving local files.
  //
  // Hardening: allowlist directories (userData/recording-temp, history, the
  // user's chosen save dir) and allowlist media extensions. Anything else
  // is rejected with a 403 — defense-in-depth against XSS/compromised
  // renderer that tries to exfiltrate arbitrary files via this protocol.
  protocol.handle('local-media', (request) => {
    try {
      const url = new URL(request.url)
      let filePath = decodeURIComponent(url.pathname)
      // On Windows, pathname starts with /C:/... — remove leading slash
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1)
      }
      const abs = resolvePath(filePath)

      // Build the allowlist at request time so a settings change (e.g. user
      // moves their default save dir) takes effect without an app restart.
      const allowedRoots: string[] = [
        resolvePath(app.getPath('userData')),
        resolvePath(app.getPath('temp'))
      ]
      const saveDir = (getSetting('defaultSaveDir') ?? '').trim()
      if (saveDir) allowedRoots.push(resolvePath(saveDir))

      const ext = extname(abs).toLowerCase()
      if (!ALLOWED_LOCAL_MEDIA_EXTS.has(ext)) {
        return new Response('forbidden', { status: 403 })
      }
      const ok = allowedRoots.some(root => isPathInside(abs, root))
      if (!ok) {
        return new Response('forbidden', { status: 403 })
      }
      return net.fetch(pathToFileURL(abs).href)
    } catch {
      return new Response('bad request', { status: 400 })
    }
  })

  registerScreenshotIPC()
  registerRecordingIPC()
  registerHistoryIPC()
  registerSettingsIPC()
  registerUploadIPC()
  registerOCRIPC()
  registerMainWindowIPC()
  registerAnnotationOverlayIPC()
  registerAnnotationToolbarIPC()
  registerWebcamWindowIPC()

  // Renderer → file logger bridge. Renderer error handlers forward
  // through this channel so a packaged-app crash leaves a paper trail.
  const { ipcMain: ipcM, shell } = require('electron')
  const { logError: lE, logWarn: lW, getLogFilePath } = require('./services/logger')
  ipcM.on(IPC_CHANNELS.LOG_RENDERER, (_e: unknown, level: 'ERROR' | 'WARN', scope: string, message: string) => {
    if (level === 'ERROR') lE(scope, message)
    else lW(scope, message)
  })
  ipcM.on(IPC_CHANNELS.LOG_SHOW_FOLDER, () => {
    try { shell.showItemInFolder(getLogFilePath()) } catch { /* ignore */ }
  })

  createMainWindow()
  createTray()

  // Check for updates against GitHub releases. Fires-and-forgets — errors
  // (offline, no release yet, dev build) are swallowed by the updater's
  // own error handler, never blocking startup.
  initAutoUpdater()

  registerScreenshotHotkey(() => {
    createOverlayWindow()
  })

  registerRecordingHotkey(async () => {
    const quickRecord = getSetting('quickRecordEnabled')

    if (quickRecord && isRecording()) {
      // Already recording → stop and show window for save dialog
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.show()
        win.webContents.send(IPC_CHANNELS.ANNOTATION_STOP_RECORDING)
      }
      updateTrayRecordingState(false)
      return
    }

    if (quickRecord) {
      // Quick record: auto-select the screen the cursor is on so multi-
      // monitor users don't always end up recording the primary display.
      const sources = await getAvailableSources()
      const screenSources = sources.filter(s => s.id.startsWith('screen:'))
      const cursorPoint = screen.getCursorScreenPoint()
      const display = screen.getDisplayNearestPoint(cursorPoint)
      const displayId = display.id.toString()
      const screenSource =
        screenSources.find(s => s.id === `screen:${displayId}:0`)
        ?? screenSources.find(s => s.id.includes(`:${displayId}:`))
        ?? screenSources[0]
      if (!screenSource) return

      const win = createMainWindow()
      win.webContents.send(IPC_CHANNELS.APP_FORCE_MODE, 'recording')
      // Delay to let RecordingPanel mount and register listener
      setTimeout(() => {
        win.webContents.send(IPC_CHANNELS.RECORDING_QUICK_START, screenSource)
      }, 300)
      updateTrayRecordingState(true)
      return
    }

    // Normal recording flow
    const win = createMainWindow()
    win.webContents.send(IPC_CHANNELS.APP_FORCE_MODE, 'recording')
    win.show()
  })

  registerAnnotationHotkey(() => {
    // Only toggle if annotation overlay is open (during recording)
    if (getAnnotationOverlay()) {
      toggleAnnotationDrawMode()
    }
  })

  // OCR hotkey: open overlay for region selection → OCR → clipboard
  setOCRWorkerGetter(getWorker)
  registerOCRHotkey(() => {
    startOCRSelection()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('before-quit', () => {
  setQuitting(true)
})

app.on('will-quit', () => {
  unregisterAll()
  destroyTray()
  terminateWorker()
})

app.on('window-all-closed', () => {
  // When closeToTray is off and all windows are closed, quit the app.
  // When closeToTray is on, app stays in tray.
  if (!getSetting('closeToTray')) {
    app.quit()
  }
})
