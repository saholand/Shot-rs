import type {
  ElectronAPI, OverlayAPI, AnnotationOverlayAPI,
  HighlighterCursorState, HighlighterPosPayload
} from '../shared/types/ipc'

interface HighlighterCursorAPI {
  onUpdate: (callback: (state: HighlighterCursorState) => void) => void
  removeUpdateListener: () => void
  onPos: (callback: (pos: HighlighterPosPayload) => void) => void
  removePosListener: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    overlayAPI: OverlayAPI
    annotationOverlayAPI: AnnotationOverlayAPI
    highlighterCursorAPI: HighlighterCursorAPI
  }
}
