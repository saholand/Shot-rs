// Suppress EPIPE errors from broken stdout/stderr pipes (dev mode)
process.stdout?.on?.('error', () => {})
process.stderr?.on?.('error', () => {})

import { app, BrowserWindow, protocol, net, screen } from 'electron'
import { pathToFileURL } from 'url'
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

// Register custom protocol for serving local media files to renderer
// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: { stream: true, supportFetchAPI: true, bypassCSP: true }
  }
])

app.whenReady().then(() => {
  // Handle local-media:// requests by serving local files
  protocol.handle('local-media', (request) => {
    const url = new URL(request.url)
    let filePath = decodeURIComponent(url.pathname)
    // On Windows, pathname starts with /C:/... — remove leading slash
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1)
    }
    return net.fetch(pathToFileURL(filePath).href)
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

  createMainWindow()
  createTray()

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
