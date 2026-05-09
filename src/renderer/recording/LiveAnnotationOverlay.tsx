import { useState, useEffect, useCallback } from 'react'
import { useAnnotations } from '../annotation/hooks/useAnnotations'
import { LiveAnnotationCanvas } from './LiveAnnotationCanvas'
import type { AnnotationMode, AnnotationCommand } from '../../shared/types/ipc'
import type { AnnotationTool } from '../../shared/types/annotation'
import './live-annotation.css'

type StrokeWidth = 'thin' | 'medium' | 'thick'
type FontSize = 'small' | 'medium' | 'large'
type ArrowStyle = 'filled' | 'outline'

/**
 * Overlay window — only renders the drawing canvas.
 * The toolbar lives in a separate content-protected window
 * so it's visible to the user but hidden from screen capture.
 */
export function LiveAnnotationOverlay() {
  const [mode, setMode] = useState<AnnotationMode>('passthrough')
  const [ocrStatus, setOCRStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [pendingText, setPendingText] = useState<{ text: string; color: string } | null>(null)
  const { annotations, activeTool, activeColor, addAnnotation, moveAnnotation, undo, clear, setTool, setColor } = useAnnotations()

  // Live tool options driven by the toolbar window via IPC commands
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>('medium')
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>('filled')

  const drawMode = mode === 'draw'

  // For eraser, we filter annotations by adding a special delete function
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

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
        case 'set-tool': setTool(cmd.tool as AnnotationTool); break
        case 'set-color': setColor(cmd.color); break
        case 'undo': undo(); break
        case 'clear':
          clear()
          setDeletedIds(new Set())
          break
        case 'add-text':
          setPendingText({ text: cmd.text, color: cmd.color })
          break
        case 'set-stroke-width': setStrokeWidth(cmd.value); break
        case 'set-font-size': setFontSize(cmd.value); break
        case 'set-arrow-style': setArrowStyle(cmd.value); break
      }
    })
    return () => window.annotationOverlayAPI.removeCommandListener()
  }, [setTool, setColor, undo, clear])

  const handleDelete = useCallback((id: string) => {
    setDeletedIds(prev => new Set(prev).add(id))
  }, [])

  const visibleAnnotations = annotations.filter(a => !deletedIds.has(a.id))

  return (
    <>
      <LiveAnnotationCanvas
        annotations={visibleAnnotations}
        activeTool={activeTool}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        fontSize={fontSize}
        arrowStyle={arrowStyle}
        onAddAnnotation={addAnnotation}
        onDeleteAnnotation={handleDelete}
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
