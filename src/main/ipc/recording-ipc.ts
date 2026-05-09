import { ipcMain } from 'electron'
import { writeFile, copyFile, unlink } from 'fs/promises'
import { basename } from 'path'
import { statSync } from 'fs'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '../../shared/constants'
import { getAvailableSources } from '../recording/source-selector'
import { startSession, stopSession, setSaving, isRecording } from '../recording/lifecycle'
import { getMainWindow, setRecordingAlwaysOnTop } from '../windows/main-window'
import { createAnnotationOverlay, closeAnnotationOverlay } from '../windows/annotation-overlay-window'
import { addHistoryEntry } from '../services/history-store'
import { buildVideoDialog, buildVideoDialogForExt } from '../services/save-dialog'
import {
  initTempFile, writeChunk, finalizeTempFile,
  checkForRecovery, discardRecovery, getRecoveryFilePath,
  getStreamError
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
  // The renderer needs the source ID to create a MediaStream.
  //
  // Safety: this handler runs invoke-style — if it throws, the renderer
  // hangs forever waiting on the unresolved promise. Wrap every side
  // effect (window creation, mouse hook startup) in a try/catch so a
  // single failure can't take down the whole start sequence.
  ipcMain.handle(IPC_CHANNELS.RECORDING_START, async (_event, sourceId: string, sourceName: string, micEnabled: boolean) => {
    try {
      if (isRecording()) {
        return { success: false, error: 'Already recording' }
      }
      startSession(sourceId, sourceName || sourceId, !!micEnabled)

      // Open annotation overlay for live drawing during recording.
      // Failures here used to crash the handler silently; now we log
      // and continue so the recording itself still starts.
      try {
        createAnnotationOverlay()
      } catch (err) {
        console.warn('[recording-ipc] createAnnotationOverlay failed:', err)
      }
      // Keep compact bar above the overlay
      try {
        setRecordingAlwaysOnTop(true)
      } catch (err) {
        console.warn('[recording-ipc] setRecordingAlwaysOnTop failed:', err)
      }

      // Open the webcam preview window if the user has it enabled.
      const settings = getSettings()
      if (settings.webcamEnabled) {
        try {
          createWebcamWindow({
            deviceId: settings.webcamDeviceId,
            shape: settings.webcamShape
          })
        } catch (err) {
          console.warn('[recording-ipc] createWebcamWindow failed:', err)
        }
      }

      // Spin up the mouse hook for cursor effects + click ripple. Best-
      // effort — uiohook native binary or AV blocks just disable visual
      // effects without breaking the recording itself.
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[recording-ipc] RECORDING_START fatal:', err)
      return { success: false, error: `Recording start failed: ${msg}` }
    }
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
      const { canceled, filePath } = await buildVideoDialog(getMainWindow(), mimeType)

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
      const sessionId = await initTempFile(mimeType, sourceName)
      return { success: true, sessionId }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to init temp file' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECORDING_WRITE_CHUNK, async (_event, chunkBuffer: ArrayBuffer) => {
    try {
      const ok = writeChunk(Buffer.from(chunkBuffer))
      if (!ok) {
        // Surface the underlying reason (disk full, permission denied, …)
        // so the renderer can show a meaningful message instead of an
        // ambiguous "write failed".
        const err = getStreamError()
        return { success: false, error: err ? `${err.message} (${(err as NodeJS.ErrnoException).code ?? ''})`.trim() : 'stream closed' }
      }
      return { success: true }
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

      const { canceled, filePath } = await buildVideoDialog(getMainWindow(), mimeType)

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

      const ext: 'mp4' | 'webm' = tempPath.endsWith('.mp4') ? 'mp4' : 'webm'
      const { canceled, filePath } = await buildVideoDialogForExt(getMainWindow(), ext, 'dialog.recoverRecording')

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
      const ext: 'mp4' | 'webm' = payload.inputPath.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm'
      const { canceled, filePath } = await buildVideoDialogForExt(callerWindow, ext, 'dialog.trimAndSave')
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
