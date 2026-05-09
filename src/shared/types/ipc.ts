export type { RecordingResult } from './recording'
export type { HistoryEntry } from './history'
export type { AppSettings } from './settings'

export interface UploadResult {
  success: boolean
  url?: string
  deleteToken?: string
  error?: string
}

export type AppMode = 'idle' | 'screenshot' | 'recording' | 'history' | 'settings'

export interface SelectionRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface ScreenBounds {
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
  /** Whether the user has the selection-phase magnifier enabled in settings. */
  magnifierEnabled?: boolean
  /** Magnifier zoom preset (radius of source pixels sampled). */
  magnifierZoom?: 'low' | 'medium' | 'high'
}

/**
 * Sent from main → renderer when the user picks a region for screen
 * recording. Carries the display info so the renderer can pick the
 * correct screen source and use the right scaleFactor for canvas crop.
 */
export interface RecordingRegionPayload {
  region: SelectionRegion
  displayId: string | null
  scaleFactor: number
  displayBounds: { x: number; y: number; width: number; height: number } | null
}

/** Cursor position for the highlighter cursor overlay. */
export interface HighlighterPosPayload {
  /** Window-local screen coordinates (the overlay covers full display). */
  x: number
  y: number
}

/** State broadcast to the highlighter cursor overlay window. */
export interface HighlighterCursorState {
  enabled: boolean
  color: string
  thickness: 'small' | 'medium' | 'large'
  /** 'disc' = full color glow (default). 'ring' = thin colored outline,
   *  used as a "smooth cursor" / subtle tracker without the fluorescent
   *  look. */
  mode?: 'disc' | 'ring'
}

/** Effects overlay state — click ripples and (Phase 3) cursor spotlight. */
export interface EffectsState {
  clickRipple: {
    enabled: boolean
    color: string
    size: 'small' | 'medium' | 'large'
  }
  spotlight: {
    enabled: boolean
    radius: 'small' | 'medium' | 'large'
    dim: 'low' | 'medium' | 'high'
  }
}

export interface EffectsClickPayload {
  /** Virtual-desktop X. */
  x: number
  /** Virtual-desktop Y. */
  y: number
  /** uiohook button code (1=L, 2=R, 3=M typically). */
  button: number
}

/** Toolbar-driven click-to-zoom payload. Coordinates are in CSS screen
 * pixels (e.screenX / e.screenY); the recording pipeline scales them up
 * by the display's scaleFactor to match the captured video's pixel grid. */
export interface ZoomGoPayload {
  x: number
  y: number
  /** Target zoom level. 1.0 = reset (smooth pan back to baseRect center). */
  level: number
}

export interface ExportResult {
  success: boolean
  action: 'clipboard' | 'file' | 'capture'
  error?: string
  filePath?: string
}

export interface ScreenshotResult {
  clipboard: ExportResult
  file: ExportResult | null
}

export interface DesktopSource {
  id: string
  name: string
  thumbnailDataUrl: string
}

export interface ElectronAPI {
  screenshot: {
    start: () => Promise<void>
    cancel: () => Promise<void>
    capture: (region: SelectionRegion) => Promise<string | null>
    save: () => Promise<ExportResult>
    copy: () => Promise<ExportResult>
    copyFinal: (dataUrl: string) => Promise<ExportResult>
    saveFinal: (dataUrl: string) => Promise<ExportResult>
    onResult: (callback: (result: ScreenshotResult) => void) => void
    removeResultListener: () => void
    onCaptured: (callback: (dataUrl: string) => void) => void
    removeCapturedListener: () => void
  }

  recording: {
    getSources: () => Promise<DesktopSource[]>
    startRecording: (sourceId: string, sourceName: string, micEnabled: boolean) => Promise<{ success: boolean; error?: string }>
    stop: () => Promise<void>
    save: (buffer: ArrayBuffer, mimeType: string) => Promise<RecordingResult>
    toggleAnnotation: () => void
    sendAnnotationCommand: (command: AnnotationCommand) => void
    onAnnotationMode: (callback: (drawing: boolean) => void) => void
    removeAnnotationModeListener: () => void
    onStopRequest: (callback: () => void) => void
    removeStopRequestListener: () => void
    onQuickStart: (callback: (source: DesktopSource) => void) => void
    removeQuickStartListener: () => void
    selectRegion: () => Promise<void>
    onRegionSelected: (callback: (payload: RecordingRegionPayload) => void) => void
    removeRegionSelectedListener: () => void
    // Crash safety
    initTemp: (mimeType: string, sourceName: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>
    writeChunk: (chunkBuffer: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
    finalize: (mimeType: string) => Promise<RecordingResult>
    checkRecovery: () => Promise<RecoverableRecording[]>
    recoverRecording: (sessionId: string) => Promise<RecordingResult>
    discardRecovery: (sessionId: string) => Promise<{ success: boolean }>
    // Highlighter cursor
    setHighlighterCursor: (state: HighlighterCursorState) => void
    updateHighlighterCursor: (state: HighlighterCursorState) => void
    // Effects overlay (click ripple + spotlight)
    setEffectsState: (state: EffectsState) => void
    // Click-to-zoom (toolbar tool → recording pipeline)
    zoomGo: (payload: ZoomGoPayload) => void
    onZoomGo: (callback: (payload: ZoomGoPayload) => void) => void
    removeZoomGoListener: () => void
    // Trim editor
    trim: (payload: { inputPath: string; startSec: number; endSec: number }) => Promise<RecordingResult>
    // Webcam window mid-session toggle
    toggleWebcam: (enabled: boolean) => void
  }

  app: {
    onForceMode: (callback: (mode: AppMode) => void) => void
    removeForceModeListener: () => void
    togglePin: () => Promise<boolean>
    close: () => void
    hide: () => void
    resize: (width: number, height: number) => void
  }

  history: {
    getAll: () => Promise<HistoryEntry[]>
    deleteEntry: (id: string) => Promise<void>
    clear: () => Promise<void>
    openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
    showInFolder: (filePath: string) => void
    readFileBuffer: (filePath: string) => Promise<ArrayBuffer>
    saveBuffer: (buffer: ArrayBuffer, defaultName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    copyFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  }

  settings: {
    get: () => Promise<AppSettings>
    save: (settings: AppSettings) => Promise<void>
    selectDir: () => Promise<string | null>
  }

  upload: {
    screenshot: (dataUrl: string) => Promise<UploadResult>
    file: (filePath: string, fileType: 'screenshot' | 'recording') => Promise<UploadResult>
  }
}

export type AnnotationMode = 'draw' | 'passthrough'

export type AnnotationCommand =
  | { type: 'set-tool'; tool: string | null }
  | { type: 'set-color'; color: string }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'add-text'; text: string; color: string }
  | { type: 'set-stroke-width'; value: 'thin' | 'medium' | 'thick' }
  | { type: 'set-font-size'; value: 'small' | 'medium' | 'large' }
  | { type: 'set-arrow-style'; value: 'filled' | 'outline' }
  | { type: 'set-eraser-size'; value: 'small' | 'medium' | 'large' }
  | { type: 'set-cover-style'; value: 'noise' | 'pixelate' | 'solid' | 'frosted' }
  | { type: 'set-zoom-level'; value: number }
  | { type: 'zoom-reset' }

export interface AnnotationOverlayAPI {
  onModeChange: (callback: (mode: AnnotationMode) => void) => void
  removeModeListener: () => void
  toggle: () => void
  stopRecording: () => void
  sendCommand: (command: AnnotationCommand) => void
  onCommand: (callback: (command: AnnotationCommand) => void) => void
  removeCommandListener: () => void
  ocrCaptureRegion: (region: SelectionRegion) => Promise<OCRResult>
  resizeToolbar: (expanded: boolean) => void
}

export interface RecoverableRecording {
  sessionId: string
  tempFilePath: string
  mimeType: string
  sourceName: string
  startedAt: number
  lastChunkAt: number
  fileSizeBytes: number
}

export interface OCRResult {
  success: boolean
  text?: string
  error?: string
}

export interface OverlayAPI {
  sendSelection: (region: SelectionRegion) => void
  sendCancel: () => void
  onScreenBounds: (callback: (bounds: ScreenBounds) => void) => void
  onCaptured: (callback: (fullDataUrl: string, region: SelectionRegion, scaleFactor: number) => void) => void
  removeCapturedListener: () => void
  onBackground: (callback: (bgDataUrl: string, scaleFactor: number) => void) => void
  removeBackgroundListener: () => void
  copyFinal: (dataUrl: string) => Promise<ExportResult>
  saveFinal: (dataUrl: string) => Promise<ExportResult>
  uploadScreenshot: (dataUrl: string) => Promise<UploadResult>
  ocrRecognize: (imageDataUrl: string) => Promise<OCRResult>
}
