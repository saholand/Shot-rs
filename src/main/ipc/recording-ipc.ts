import { ipcMain, dialog } from 'electron'
import { writeFile, copyFile, unlink } from 'fs/promises'
import { basename, join } from 'path'
import { statSync } from 'fs'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '../../shared/constants'
import { getAvailableSources } from '../recording/source-selector'
import { startSession, stopSession, setSaving, isRecording } from '../recording/lifecycle'
import { getMainWindow, setRecordingAlwaysOnTop } from '../windows/main-window'
import { createAnnotationOverlay, closeAnnotationOverlay } from '../windows/annotation-overlay-window'
import { addHistoryEntry } from '../services/history-store'
import { getSettings } from '../services/settings-store'
import { resolveFileName } from '../../shared/types/settings'
import {
  initTempFile, writeChunk, finalizeTempFile,
  checkForRecovery, discardRecovery, getRecoveryFilePath
} from '../recording/temp-file-manager'
import { startMouseHook, stopMouseHook } from '../recording/mouse-hook'
import { trimVideo } from '../recording/trim'
import {
  createHighlighterCursorWindow, closeHighlighterCursorWindow,
  pushHighlighterState, pushHighlighterPos, getHighlighterCursorWindow
} from '../windows/highlighter-cursor-window'
import {
  createEffectsWindow, closeEffectsWindow,
  pushEffectsState, pushEffectsClick, pushEffectsCursor, getEffectsWindow
} from '../windows/effects-window'
import {
  createWebcamWindow, closeWebcamWindow
} from '../windows/webcam-window'
import type { RecordingResult } from '../../shared/types/recording'
import type { HighlighterCursorState, EffectsState } from '../../shared/types/ipc'

export function registerRecordingIPC(): void {
  // List available screens/windows
  ipcMain.handle(IPC_CHANNELS.RECORDING_GET_SOURCES, async () => {
    return getAvailableSources()
  })

  // Validate source exists and return its ID for getUserMedia constraint
  // The renderer needs the source ID to create a MediaStream
  ipcMain.handle(IPC_CHANNELS.RECORDING_START, async (_event, sourceId: string, sourceName: string, micEnabled: boolean) => {
    if (isRecording()) {
      return { success: false, error: 'Already recording' }
    }
    startSession(sourceId, sourceName || sourceId, !!micEnabled)
    // Open annotation overlay for live drawing during recording
    createAnnotationOverlay()
    // Keep compact bar above the overlay
    setRecordingAlwaysOnTop(true)

    // Open the webcam preview window if the user has it enabled. The
    // window is what the desktopCapturer picks up — there's no separate
    // canvas-compose path. User can drag/resize it freely.
    const settings = getSettings()
    if (settings.webcamEnabled) {
      createWebcamWindow({
        deviceId: settings.webcamDeviceId,
        shape: settings.webcamShape
      })
    }

    // Spin up the mouse hook to push cursor positions to the highlighter
    // overlay window + click events to the click-ripple effects window.
    // Best-effort — failures (missing native binary, AV) just disable
    // those visual effects without breaking the recording.
    startMouseHook({
      onMouseMove: (payload) => {
        if (getHighlighterCursorWindow()) {
          pushHighlighterPos(payload)
        }
        if (getEffectsWindow()) {
          pushEffectsCursor(payload)
        }
      },
      onMouseDown: (payload) => {
        if (getEffectsWindow()) {
          pushEffectsClick(payload)
        }
      }
    }).catch(err => console.warn('startMouseHook error:', err))

    return { success: true }
  })

  // Stop recording (state only — renderer stops MediaRecorder itself)
  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, () => {
    stopSession()
    closeAnnotationOverlay()
    setRecordingAlwaysOnTop(false)
    stopMouseHook()
    closeHighlighterCursorWindow()
    closeEffectsWindow()
    closeWebcamWindow()
  })

  // Toolbar zoom tool → forward to main window (RecordingPanel listens
  // and stages the canvas zoom transform).
  ipcMain.on(IPC_CHANNELS.RECORDING_ZOOM_GO, (_event, payload: { x: number; y: number; level: number }) => {
    const mw = getMainWindow()
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send(IPC_CHANNELS.RECORDING_ZOOM_GO, payload)
    }
  })

  // Mid-recording webcam toggle (live toolbar / pick-phase quick toggle)
  ipcMain.on(IPC_CHANNELS.WEBCAM_TOGGLE, (_event, enabled: boolean) => {
    if (enabled) {
      const s = getSettings()
      createWebcamWindow({ deviceId: s.webcamDeviceId, shape: s.webcamShape })
    } else {
      closeWebcamWindow()
    }
  })

  // Highlighter cursor toggle / state updates from the live toolbar
  ipcMain.on(IPC_CHANNELS.HIGHLIGHTER_CURSOR_TOGGLE, (_event, state: HighlighterCursorState) => {
    console.log('[ipc] highlighter toggle:', state)
    if (state.enabled) {
      const win = createHighlighterCursorWindow()
      // Push the current state both immediately AND on did-finish-load —
      // accommodates race between create-and-toggle on a fresh window.
      const sendNow = () => pushHighlighterState(state)
      win.webContents.once('did-finish-load', sendNow)
      if (!win.webContents.isLoading()) sendNow()
    } else {
      closeHighlighterCursorWindow()
    }
  })

  ipcMain.on(IPC_CHANNELS.HIGHLIGHTER_CURSOR_UPDATE, (_event, state: HighlighterCursorState) => {
    if (state.enabled) {
      pushHighlighterState(state)
    }
  })

  // Effects (click ripple + spotlight) — single combined state push.
  // Window opens when ANY effect is enabled; closes when ALL are off.
  ipcMain.on(IPC_CHANNELS.EFFECTS_TOGGLE, (_event, state: EffectsState) => {
    const anyOn = state.clickRipple.enabled || state.spotlight.enabled
    if (anyOn) {
      const win = createEffectsWindow()
      const sendNow = () => pushEffectsState(state)
      win.webContents.once('did-finish-load', sendNow)
      if (!win.webContents.isLoading()) sendNow()
    } else {
      closeEffectsWindow()
    }
  })

  // Save recorded video buffer to file
  ipcMain.handle(IPC_CHANNELS.RECORDING_SAVE, async (_event, buffer: ArrayBuffer, mimeType?: string): Promise<RecordingResult> => {
    setSaving()
    try {
      const mainWindow = getMainWindow()
      const settings = getSettings()

      // Determine file extension from mimeType
      const isMP4 = mimeType?.includes('mp4')
      const ext = isMP4 ? 'mp4' : 'webm'
      const filterName = isMP4 ? 'MP4 Video' : 'WebM Video'

      const fileName = resolveFileName(settings.recordingFileNameFormat, ext)
      const defaultPath = settings.defaultSaveDir
        ? join(settings.defaultSaveDir, fileName)
        : fileName

      const dialogOptions: Electron.SaveDialogOptions = {
        title: 'Kaydı Kaydet',
        defaultPath,
        filters: [{ name: filterName, extensions: [ext] }]
      }

      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)

      if (canceled || !filePath) {
        stopSession()
        return { success: false, error: 'Save cancelled' }
      }

      const nodeBuffer = Buffer.from(buffer)
      if (nodeBuffer.length === 0) {
        stopSession()
        return { success: false, error: 'Empty recording buffer' }
      }

      await writeFile(filePath, nodeBuffer)
      stopSession()

      addHistoryEntry({
        id: randomUUID(),
        type: 'recording',
        filePath,
        fileName: basename(filePath),
        timestamp: Date.now()
      })

      return { success: true, filePath }
    } catch (err) {
      stopSession()
      const message = err instanceof Error ? err.message : 'Unknown save error'
      return { success: false, error: message }
    }
  })

  // --- Crash safety handlers ---

  ipcMain.handle(IPC_CHANNELS.RECORDING_INIT_TEMP, async (_event, mimeType: string, sourceName: string) => {
    try {
      const sessionId = initTempFile(mimeType, sourceName)
      return { success: true, sessionId }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to init temp file' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECORDING_WRITE_CHUNK, async (_event, chunkBuffer: ArrayBuffer) => {
    try {
      const ok = writeChunk(Buffer.from(chunkBuffer))
      return { success: ok }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Write failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECORDING_FINALIZE, async (_event, mimeType?: string): Promise<RecordingResult> => {
    setSaving()
    try {
      const tempPath = await finalizeTempFile()
      if (!tempPath) {
        stopSession()
        return { success: false, error: 'No temp file to finalize' }
      }

      const stat = statSync(tempPath)
      if (stat.size === 0) {
        try { await unlink(tempPath) } catch { /* ignore */ }
        stopSession()
        return { success: false, error: 'Recording was empty' }
      }

      const mainWindow = getMainWindow()
      const settings = getSettings()
      const isMP4 = mimeType?.includes('mp4')
      const ext = isMP4 ? 'mp4' : 'webm'
      const filterName = isMP4 ? 'MP4 Video' : 'WebM Video'

      const fileName = resolveFileName(settings.recordingFileNameFormat, ext)
      const defaultPath = settings.defaultSaveDir
        ? join(settings.defaultSaveDir, fileName)
        : fileName

      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, { title: 'Kaydı Kaydet', defaultPath, filters: [{ name: filterName, extensions: [ext] }] })
        : await dialog.showSaveDialog({ title: 'Kaydı Kaydet', defaultPath, filters: [{ name: filterName, extensions: [ext] }] })

      if (canceled || !filePath) {
        try { await unlink(tempPath) } catch { /* ignore */ }
        stopSession()
        return { success: false, error: 'Save cancelled' }
      }

      await copyFile(tempPath, filePath)
      try { await unlink(tempPath) } catch { /* ignore */ }
      stopSession()

      addHistoryEntry({
        id: randomUUID(),
        type: 'recording',
        filePath,
        fileName: basename(filePath),
        timestamp: Date.now()
      })

      return { success: true, filePath }
    } catch (err) {
      stopSession()
      return { success: false, error: err instanceof Error ? err.message : 'Unknown save error' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECORDING_CHECK_RECOVERY, async () => {
    return checkForRecovery()
  })

  ipcMain.handle(IPC_CHANNELS.RECORDING_RECOVER, async (_event, sessionId: string): Promise<RecordingResult> => {
    try {
      const tempPath = getRecoveryFilePath(sessionId)
      if (!tempPath) return { success: false, error: 'Recovery file not found' }

      const mainWindow = getMainWindow()
      const settings = getSettings()
      const ext = tempPath.endsWith('.mp4') ? 'mp4' : 'webm'
      const filterName = ext === 'mp4' ? 'MP4 Video' : 'WebM Video'

      const fileName = resolveFileName(settings.recordingFileNameFormat, ext)
      const defaultPath = settings.defaultSaveDir
        ? join(settings.defaultSaveDir, fileName)
        : fileName

      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, { title: 'Kaydı Kurtar', defaultPath, filters: [{ name: filterName, extensions: [ext] }] })
        : await dialog.showSaveDialog({ title: 'Kaydı Kurtar', defaultPath, filters: [{ name: filterName, extensions: [ext] }] })

      if (canceled || !filePath) return { success: false, error: 'Save cancelled' }

      await copyFile(tempPath, filePath)
      try { await unlink(tempPath) } catch { /* ignore */ }

      addHistoryEntry({
        id: randomUUID(),
        type: 'recording',
        filePath,
        fileName: basename(filePath),
        timestamp: Date.now()
      })

      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Recovery failed' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECORDING_DISCARD_RECOVERY, async (_event, sessionId: string) => {
    discardRecovery(sessionId)
    return { success: true }
  })

  // Trim editor: cut [startSec, endSec) from inputPath. Renderer asks the
  // user where to save, then we ffmpeg-cut. New file is added to history.
  ipcMain.handle(IPC_CHANNELS.RECORDING_TRIM, async (event, payload: { inputPath: string; startSec: number; endSec: number }): Promise<RecordingResult> => {
    try {
      const callerWindow = require('electron').BrowserWindow.fromWebContents(event.sender) as Electron.BrowserWindow | null
      const settings = getSettings()
      const ext = payload.inputPath.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm'
      const filterName = ext === 'mp4' ? 'MP4 Video' : 'WebM Video'
      const fileName = resolveFileName(settings.recordingFileNameFormat, ext)
      const defaultPath = settings.defaultSaveDir
        ? join(settings.defaultSaveDir, fileName)
        : fileName

      const dialogOptions: Electron.SaveDialogOptions = {
        title: 'Trim & Save',
        defaultPath,
        filters: [{ name: filterName, extensions: [ext] }]
      }
      const { canceled, filePath } = callerWindow
        ? await dialog.showSaveDialog(callerWindow, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      if (canceled || !filePath) return { success: false, error: 'Save cancelled' }

      const result = await trimVideo(payload.inputPath, filePath, payload.startSec, payload.endSec)
      if (!result.success) {
        return { success: false, error: result.error || 'Trim failed' }
      }
      addHistoryEntry({
        id: randomUUID(),
        type: 'recording',
        filePath,
        fileName: basename(filePath),
        timestamp: Date.now()
      })
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Trim failed' }
    }
  })
}
