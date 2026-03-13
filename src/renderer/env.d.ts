import type { ElectronAPI, OverlayAPI, AnnotationOverlayAPI } from '../shared/types/ipc'

declare global {
  interface Window {
    electronAPI: ElectronAPI
    overlayAPI: OverlayAPI
    annotationOverlayAPI: AnnotationOverlayAPI
  }
}
