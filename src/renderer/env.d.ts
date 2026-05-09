import type {
  ElectronAPI, OverlayAPI, AnnotationOverlayAPI,
  HighlighterCursorState, HighlighterPosPayload,
  EffectsState, EffectsClickPayload
} from '../shared/types/ipc'

interface HighlighterCursorAPI {
  onUpdate: (callback: (state: HighlighterCursorState) => void) => void
  removeUpdateListener: () => void
  onPos: (callback: (pos: HighlighterPosPayload) => void) => void
  removePosListener: () => void
}

interface EffectsAPI {
  onState: (callback: (state: EffectsState) => void) => void
  removeStateListener: () => void
  onClick: (callback: (payload: EffectsClickPayload) => void) => void
  removeClickListener: () => void
  onCursorPos: (callback: (payload: HighlighterPosPayload) => void) => void
  removeCursorPosListener: () => void
}

interface WebcamConfig { deviceId: string | null; shape: 'circle' | 'rounded' }

interface WebcamAPI {
  onConfig: (callback: (cfg: WebcamConfig) => void) => void
  removeConfigListener: () => void
  setBounds: (b: { x: number; y: number; w: number; h: number }) => void
  getBounds: () => Promise<{ x: number; y: number; w: number; h: number } | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    overlayAPI: OverlayAPI
    annotationOverlayAPI: AnnotationOverlayAPI
    highlighterCursorAPI: HighlighterCursorAPI
    effectsAPI: EffectsAPI
    webcamAPI: WebcamAPI
  }
}
