import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
import type {
  ElectronAPI, OverlayAPI, AnnotationOverlayAPI, AnnotationMode, ScreenBounds, SelectionRegion,
  HighlighterCursorState, HighlighterPosPayload,
  EffectsState, EffectsClickPayload,
  ZoomTriggerPayload, ZoomWheelPayload
} from '../shared/types/ipc'

const RESULT_CHANNEL = IPC_CHANNELS.SCREENSHOT_RESULT
const CAPTURED_CHANNEL = IPC_CHANNELS.SCREENSHOT_CAPTURED

const api: ElectronAPI = {
  screenshot: {
    start: () => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_START),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_CANCEL),
    capture: (region) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_CAPTURE, region),
    save: () => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_SAVE),
    copy: () => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_COPY),
    copyFinal: (dataUrl) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_COPY_FINAL, dataUrl),
    saveFinal: (dataUrl) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_SAVE_FINAL, dataUrl),
    onResult: (callback) => {
      ipcRenderer.on(RESULT_CHANNEL, (_event, result) => callback(result))
    },
    removeResultListener: () => {
      ipcRenderer.removeAllListeners(RESULT_CHANNEL)
    },
    onCaptured: (callback) => {
      ipcRenderer.on(CAPTURED_CHANNEL, (_event, dataUrl) => callback(dataUrl))
    },
    removeCapturedListener: () => {
      ipcRenderer.removeAllListeners(CAPTURED_CHANNEL)
    }
  },
  recording: {
    getSources: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_GET_SOURCES),
    startRecording: (sourceId, sourceName, micEnabled) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_START, sourceId, sourceName, micEnabled),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_STOP),
    save: (buffer, mimeType) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_SAVE, buffer, mimeType),
    toggleAnnotation: () => ipcRenderer.send(IPC_CHANNELS.ANNOTATION_OVERLAY_TOGGLE),
    sendAnnotationCommand: (command) => ipcRenderer.send(IPC_CHANNELS.ANNOTATION_COMMAND, command),
    onAnnotationMode: (callback) => {
      ipcRenderer.on(IPC_CHANNELS.ANNOTATION_MODE_CHANGED, (_e, drawing) => callback(drawing))
    },
    removeAnnotationModeListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.ANNOTATION_MODE_CHANGED)
    },
    onStopRequest: (callback) => {
      ipcRenderer.on(IPC_CHANNELS.ANNOTATION_STOP_RECORDING, () => callback())
    },
    removeStopRequestListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.ANNOTATION_STOP_RECORDING)
    },
    onQuickStart: (callback) => {
      ipcRenderer.on(IPC_CHANNELS.RECORDING_QUICK_START, (_e, source) => callback(source))
    },
    removeQuickStartListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.RECORDING_QUICK_START)
    },
    selectRegion: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_SELECT_REGION),
    onRegionSelected: (callback) => {
      ipcRenderer.on(IPC_CHANNELS.RECORDING_REGION_SELECTED, (_e, region) => callback(region))
    },
    removeRegionSelectedListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.RECORDING_REGION_SELECTED)
    },
    // Crash safety
    initTemp: (mimeType, sourceName) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_INIT_TEMP, mimeType, sourceName),
    writeChunk: (chunkBuffer) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_WRITE_CHUNK, chunkBuffer),
    finalize: (mimeType) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_FINALIZE, mimeType),
    checkRecovery: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_CHECK_RECOVERY),
    recoverRecording: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_RECOVER, sessionId),
    discardRecovery: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_DISCARD_RECOVERY, sessionId),
    // Highlighter cursor toggle (sent from live toolbar window)
    setHighlighterCursor: (state: HighlighterCursorState) => {
      ipcRenderer.send(IPC_CHANNELS.HIGHLIGHTER_CURSOR_TOGGLE, state)
    },
    updateHighlighterCursor: (state: HighlighterCursorState) => {
      ipcRenderer.send(IPC_CHANNELS.HIGHLIGHTER_CURSOR_UPDATE, state)
    },
    // Effects (click ripple + spotlight) — single combined state push
    setEffectsState: (state: EffectsState) => {
      ipcRenderer.send(IPC_CHANNELS.EFFECTS_TOGGLE, state)
    },
    // Click-to-zoom triggers from main (mouse hook)
    onZoomTrigger: (callback: (payload: ZoomTriggerPayload) => void) => {
      ipcRenderer.on(IPC_CHANNELS.RECORDING_ZOOM_TRIGGER, (_e, payload) => callback(payload))
    },
    removeZoomTriggerListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.RECORDING_ZOOM_TRIGGER)
    },
    onZoomWheel: (callback: (payload: ZoomWheelPayload) => void) => {
      ipcRenderer.on(IPC_CHANNELS.RECORDING_ZOOM_WHEEL, (_e, payload) => callback(payload))
    },
    removeZoomWheelListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.RECORDING_ZOOM_WHEEL)
    },
    trim: (payload) => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_TRIM, payload),
    toggleWebcam: (enabled: boolean) => ipcRenderer.send(IPC_CHANNELS.WEBCAM_TOGGLE, enabled),
    onClickEvent: (callback: (payload: EffectsClickPayload) => void) => {
      ipcRenderer.on(IPC_CHANNELS.RECORDING_CLICK_EVENT, (_e, payload) => callback(payload))
    },
    removeClickEventListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.RECORDING_CLICK_EVENT)
    }
  },
  app: {
    onForceMode: (callback) => {
      ipcRenderer.on(IPC_CHANNELS.APP_FORCE_MODE, (_event, mode) => callback(mode))
    },
    removeForceModeListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.APP_FORCE_MODE)
    },
    togglePin: () => ipcRenderer.invoke(IPC_CHANNELS.APP_TOGGLE_PIN),
    close: () => ipcRenderer.send(IPC_CHANNELS.APP_CLOSE),
    hide: () => ipcRenderer.send(IPC_CHANNELS.APP_HIDE),
    resize: (width: number, height: number) => ipcRenderer.send(IPC_CHANNELS.APP_RESIZE, width, height)
  },
  history: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_ALL),
    deleteEntry: (id) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, id),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR),
    openFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_OPEN_FILE, filePath),
    showInFolder: (filePath) => ipcRenderer.send(IPC_CHANNELS.HISTORY_SHOW_IN_FOLDER, filePath),
    readFileBuffer: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ_BUFFER, filePath),
    saveBuffer: (buffer, defaultName) => ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_BUFFER, buffer, defaultName),
    copyFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_COPY_FILE, filePath)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    save: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
    selectDir: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_DIR)
  },
  upload: {
    screenshot: (dataUrl) => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_SCREENSHOT, dataUrl),
    file: (filePath, fileType) => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_FILE, filePath, fileType)
  }
}

const overlayAPI: OverlayAPI = {
  sendSelection: (region: SelectionRegion) => {
    ipcRenderer.send(IPC_CHANNELS.OVERLAY_SELECTION_DONE, region)
  },
  sendCancel: () => {
    ipcRenderer.send(IPC_CHANNELS.OVERLAY_CANCELLED)
  },
  onScreenBounds: (callback: (bounds: ScreenBounds) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SCREEN_BOUNDS, (_event, bounds) => callback(bounds))
  },
  onCaptured: (callback: (fullDataUrl: string, region: SelectionRegion, scaleFactor: number) => void) => {
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_CAPTURED, (_event, fullDataUrl, region, scaleFactor) => callback(fullDataUrl, region, scaleFactor))
  },
  removeCapturedListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.OVERLAY_CAPTURED)
  },
  onBackground: (callback: (bgDataUrl: string, scaleFactor: number) => void) => {
    ipcRenderer.on(IPC_CHANNELS.OVERLAY_BACKGROUND, (_event, bgDataUrl, scaleFactor) => callback(bgDataUrl, scaleFactor))
  },
  removeBackgroundListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.OVERLAY_BACKGROUND)
  },
  copyFinal: (dataUrl) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_COPY_FINAL, dataUrl),
  saveFinal: (dataUrl) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_SAVE_FINAL, dataUrl),
  uploadScreenshot: (dataUrl) => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_SCREENSHOT, dataUrl),
  ocrRecognize: (imageDataUrl) => ipcRenderer.invoke(IPC_CHANNELS.OCR_RECOGNIZE, imageDataUrl)
}

const annotationOverlayAPI: AnnotationOverlayAPI = {
  onModeChange: (callback: (mode: AnnotationMode) => void) => {
    ipcRenderer.on(IPC_CHANNELS.ANNOTATION_OVERLAY_MODE, (_event, mode) => callback(mode))
  },
  removeModeListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.ANNOTATION_OVERLAY_MODE)
  },
  toggle: () => {
    ipcRenderer.send(IPC_CHANNELS.ANNOTATION_OVERLAY_TOGGLE)
  },
  stopRecording: () => {
    ipcRenderer.send(IPC_CHANNELS.ANNOTATION_STOP_RECORDING)
  },
  sendCommand: (command) => {
    ipcRenderer.send(IPC_CHANNELS.ANNOTATION_COMMAND, command)
  },
  onCommand: (callback) => {
    ipcRenderer.on(IPC_CHANNELS.ANNOTATION_COMMAND, (_e, command) => callback(command))
  },
  removeCommandListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.ANNOTATION_COMMAND)
  },
  ocrCaptureRegion: (region) => ipcRenderer.invoke(IPC_CHANNELS.OCR_CAPTURE_REGION, region),
  resizeToolbar: (expanded) => ipcRenderer.send(IPC_CHANNELS.ANNOTATION_TOOLBAR_RESIZE, expanded)
}

const highlighterCursorAPI = {
  onUpdate: (callback: (state: HighlighterCursorState) => void) => {
    ipcRenderer.on(IPC_CHANNELS.HIGHLIGHTER_CURSOR_UPDATE, (_e, state) => callback(state))
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.HIGHLIGHTER_CURSOR_UPDATE)
  },
  onPos: (callback: (pos: HighlighterPosPayload) => void) => {
    ipcRenderer.on(IPC_CHANNELS.HIGHLIGHTER_CURSOR_POS, (_e, pos) => callback(pos))
  },
  removePosListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.HIGHLIGHTER_CURSOR_POS)
  }
}

const effectsAPI = {
  onState: (callback: (state: EffectsState) => void) => {
    ipcRenderer.on(IPC_CHANNELS.EFFECTS_STATE, (_e, state) => callback(state))
  },
  removeStateListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.EFFECTS_STATE)
  },
  onClick: (callback: (payload: EffectsClickPayload) => void) => {
    ipcRenderer.on(IPC_CHANNELS.EFFECTS_CLICK, (_e, payload) => callback(payload))
  },
  removeClickListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.EFFECTS_CLICK)
  },
  onCursorPos: (callback: (payload: HighlighterPosPayload) => void) => {
    ipcRenderer.on(IPC_CHANNELS.EFFECTS_CURSOR_POS, (_e, payload) => callback(payload))
  },
  removeCursorPosListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.EFFECTS_CURSOR_POS)
  }
}

interface WebcamConfig { deviceId: string | null; shape: 'circle' | 'rounded' }

const webcamAPI = {
  onConfig: (callback: (cfg: WebcamConfig) => void) => {
    ipcRenderer.on(IPC_CHANNELS.WEBCAM_CONFIG, (_e, cfg) => callback(cfg))
  },
  removeConfigListener: () => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.WEBCAM_CONFIG)
  },
  setBounds: (b: { x: number; y: number; w: number; h: number }) => {
    ipcRenderer.send(IPC_CHANNELS.WEBCAM_SET_BOUNDS, b)
  },
  commitBounds: () => {
    ipcRenderer.send(IPC_CHANNELS.WEBCAM_COMMIT_BOUNDS)
  },
  getBounds: () => ipcRenderer.invoke(IPC_CHANNELS.WEBCAM_GET_BOUNDS) as Promise<{ x: number; y: number; w: number; h: number } | null>
}

contextBridge.exposeInMainWorld('electronAPI', api)
contextBridge.exposeInMainWorld('overlayAPI', overlayAPI)
contextBridge.exposeInMainWorld('annotationOverlayAPI', annotationOverlayAPI)
contextBridge.exposeInMainWorld('highlighterCursorAPI', highlighterCursorAPI)
contextBridge.exposeInMainWorld('effectsAPI', effectsAPI)
contextBridge.exposeInMainWorld('webcamAPI', webcamAPI)
