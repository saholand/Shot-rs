import { useState, useEffect } from 'react'
import { useAnnotations } from '../annotation/hooks/useAnnotations'
import { LiveAnnotationCanvas } from './LiveAnnotationCanvas'
import type { AnnotationMode, AnnotationCommand } from '../../shared/types/ipc'
import type { AnnotationTool, CoverStyle } from '../../shared/types/annotation'
import './live-annotation.css'

type StrokeWidth = 'thin' | 'medium' | 'thick'
type FontSize = 'small' | 'medium' | 'large'
type ArrowStyle = 'filled' | 'outline'
type EraserSize = 'small' | 'medium' | 'large'

/**
 * Overlay window — only renders the drawing canvas.
 * The toolbar lives in a separate content-protected window
 * so it's visible to the user but hidden from screen capture.
 */
export function LiveAnnotationOverlay() {
  const [mode, setMode] = useState<AnnotationMode>('passthrough')
  const [ocrStatus, setOCRStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [pendingText, setPendingText] = useState<{ text: string; color: string } | null>(null)
  const { annotations, activeTool, activeColor, addAnnotation, moveAnnotation, eraseAt, undo, clear, setTool, setColor } = useAnnotations()

  // Live tool options driven by the toolbar window via IPC commands
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>('medium')
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>('filled')
  const [eraserSize, setEraserSize] = useState<EraserSize>('medium')
  const [coverStyle, setCoverStyle] = useState<CoverStyle>('noise')
  const [zoomLevel, setZoomLevel] = useState<number>(2)

  const drawMode = mode === 'draw'

  // Listen for mode changes from main process
  useEffect(() => {
    window.annotationOverlayAPI.onModeChange((newMode: AnnotationMode) => {
      setMode(newMode)
      if (newMode === 'draw' && !activeTool) {
        setTool('pen')
      }
    })
    return () => window.annotationOverlayAPI.removeModeListener()
  }, [activeTool, setTool])

  // Listen for annotation commands from the toolbar window (separate process)
  useEffect(() => {
    window.annotationOverlayAPI.onCommand((cmd: AnnotationCommand) => {
      switch (cmd.type) {
        case 'set-tool': setTool(cmd.tool as AnnotationTool | null); break
        case 'set-color': setColor(cmd.color); break
        case 'undo': undo(); break
        case 'clear':
          clear()
          break
        case 'add-text':
          setPendingText({ text: cmd.text, color: cmd.color })
          break
        case 'set-stroke-width': setStrokeWidth(cmd.value); break
        case 'set-font-size': setFontSize(cmd.value); break
        case 'set-arrow-style': setArrowStyle(cmd.value); break
        case 'set-eraser-size': setEraserSize(cmd.value); break
        case 'set-cover-style': setCoverStyle(cmd.value); break
        case 'set-zoom-level': setZoomLevel(cmd.value); break
        case 'zoom-reset':
          // Smooth reset: send a zoomGo with level=1.0 to the pipeline.
          // Wrapped because if zoomGo isn't exposed (older preload, race
          // on first overlay mount) we don't want to crash the whole
          // command handler — it would also kill set-tool / set-color.
          try {
            window.electronAPI?.recording?.zoomGo?.({ x: 0, y: 0, level: 1.0 })
          } catch (err) {
            console.warn('[LiveAnnotationOverlay] zoom-reset send failed:', err)
          }
          break
      }
    })
    return () => window.annotationOverlayAPI.removeCommandListener()
  }, [setTool, setColor, undo, clear])

  return (
    <>
      <LiveAnnotationCanvas
        annotations={annotations}
        activeTool={activeTool}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        fontSize={fontSize}
        arrowStyle={arrowStyle}
        eraserSize={eraserSize}
        coverStyle={coverStyle}
        zoomLevel={zoomLevel}
        onAddAnnotation={addAnnotation}
        onEraseAt={eraseAt}
        onMoveAnnotation={moveAnnotation}
        drawMode={drawMode}
        onOCRStatus={setOCRStatus}
        pendingText={pendingText}
        onTextPlaced={() => setPendingText(null)}
      />
      {ocrStatus && (
        <div className={`la-ocr-toast la-ocr-toast-${ocrStatus.type}`}>
          {ocrStatus.text}
        </div>
      )}
    </>
  )
}
