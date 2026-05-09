import { useRef, useEffect, useState, useCallback } from 'react'
import type { Annotation, AnnotationTool, CoverStyle, Point } from '../../shared/types/annotation'
import { renderAll, renderAnnotation } from '../annotation/render'
import { useTranslation } from '../hooks/useTranslation'

type StrokeWidth = 'thin' | 'medium' | 'thick'
type FontSize = 'small' | 'medium' | 'large'
type ArrowStyle = 'filled' | 'outline'
type EraserSize = 'small' | 'medium' | 'large'

const ERASER_RADIUS_PX: Record<EraserSize, number> = {
  small: 12,
  medium: 24,
  large: 48
}

interface Props {
  annotations: Annotation[]
  activeTool: AnnotationTool | null
  activeColor: string
  strokeWidth: StrokeWidth
  fontSize: FontSize
  arrowStyle: ArrowStyle
  eraserSize: EraserSize
  coverStyle: CoverStyle
  onAddAnnotation: (annotation: Annotation) => void
  onEraseAt: (center: Point, radius: number) => void
  onMoveAnnotation: (id: string, dx: number, dy: number) => void
  drawMode: boolean
  onOCRStatus?: (status: { text: string; type: 'success' | 'error' } | null) => void
  pendingText?: { text: string; color: string } | null
  onTextPlaced?: () => void
}

let idCounter = 0
function nextId(): string {
  return `la-${++idCounter}-${Date.now()}`
}

const STROKE_WIDTH_PX: Record<StrokeWidth, number> = {
  thin: 2,
  medium: 3,
  thick: 6
}

const FONT_SIZE_PX: Record<FontSize, number> = {
  small: 18,
  medium: 24,
  large: 36
}

export function LiveAnnotationCanvas({
  annotations,
  activeTool,
  activeColor,
  strokeWidth,
  fontSize,
  arrowStyle,
  eraserSize,
  coverStyle,
  onAddAnnotation,
  onEraseAt,
  onMoveAnnotation,
  drawMode,
  onOCRStatus,
  pendingText,
  onTextPlaced
}: Props) {
  const { t } = useTranslation()
  const sw = STROKE_WIDTH_PX[strokeWidth]
  const fs = FONT_SIZE_PX[fontSize]
  const eraserRadius = ERASER_RADIUS_PX[eraserSize]
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([])

  // Drag state
  const dragRef = useRef<{ id: string; lastMouse: Point } | null>(null)

  // Eraser is held-and-drag: while true, every mousemove deletes whatever
  // annotation is under the cursor (Paint-style behavior).
  const erasingRef = useRef(false)

  // Set canvas to screen size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth * window.devicePixelRatio
    canvas.height = window.innerHeight * window.devicePixelRatio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
  }, [])

  // Hide the eraser preview when the tool changes away from eraser
  useEffect(() => {
    if (activeTool !== 'move') setEraserCursor(null)
  }, [activeTool])

  // Build preview annotation while drawing
  const getPreview = useCallback((): Annotation | null => {
    if (!drawing || !activeTool) return null

    if ((activeTool === 'pen' || activeTool === 'highlight') && freehandPoints.length >= 2) {
      if (activeTool === 'pen') {
        return { id: '__preview', type: 'pen', color: activeColor, strokeWidth: sw, points: freehandPoints }
      }
      return { id: '__preview', type: 'highlight', color: activeColor, strokeWidth: sw, points: freehandPoints, opacity: 0.4 }
    }

    if (!startPoint || !currentPoint) return null

    if (activeTool === 'arrow') {
      return { id: '__preview', type: 'arrow', color: activeColor, strokeWidth: sw, start: startPoint, end: currentPoint, headStyle: arrowStyle }
    }
    if (activeTool === 'rectangle') {
      return {
        id: '__preview', type: 'rectangle', color: activeColor, strokeWidth: sw,
        x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x), height: Math.abs(currentPoint.y - startPoint.y)
      }
    }
    if (activeTool === 'line') {
      return { id: '__preview', type: 'line', color: activeColor, strokeWidth: sw, start: startPoint, end: currentPoint }
    }
    if (activeTool === 'cover') {
      return {
        id: '__preview', type: 'cover', color: activeColor, strokeWidth: 0,
        x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x), height: Math.abs(currentPoint.y - startPoint.y),
        style: coverStyle
      }
    }
    if (activeTool === 'ocr') {
      return {
        id: '__preview', type: 'rectangle', color: '#0088ff', strokeWidth: 2,
        x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x), height: Math.abs(currentPoint.y - startPoint.y)
      }
    }
    return null
  }, [drawing, activeTool, activeColor, startPoint, currentPoint, freehandPoints, sw, arrowStyle, coverStyle])

  // Redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio)
    renderAll(ctx, annotations)

    const preview = getPreview()
    if (preview) renderAnnotation(ctx, preview)
  }, [annotations, getPreview])

  useEffect(() => {
    redraw()
  }, [redraw])

  // Hit test for eraser
  const hitTest = useCallback((pt: Point): string | null => {
    const margin = 12
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i]
      switch (a.type) {
        case 'rectangle':
        case 'cover':
          if ('x' in a && pt.x >= a.x - margin && pt.x <= a.x + a.width + margin &&
              pt.y >= a.y - margin && pt.y <= a.y + a.height + margin) return a.id
          break
        case 'arrow':
        case 'line': {
          const s = a.start, e = a.end
          const dx = e.x - s.x, dy = e.y - s.y
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len < 1) break
          const t = Math.max(0, Math.min(1, ((pt.x - s.x) * dx + (pt.y - s.y) * dy) / (len * len)))
          const px = s.x + t * dx, py = s.y + t * dy
          if (Math.sqrt((pt.x - px) ** 2 + (pt.y - py) ** 2) <= margin + 4) return a.id
          break
        }
        case 'text':
          if ('position' in a) {
            const tw = a.text.length * a.fontSize * 0.6
            if (pt.x >= a.position.x - margin && pt.x <= a.position.x + tw + margin &&
                pt.y >= a.position.y - margin && pt.y <= a.position.y + a.fontSize + margin) return a.id
          }
          break
        case 'pen':
        case 'highlight':
          for (const p of a.points) {
            if (Math.abs(pt.x - p.x) <= margin && Math.abs(pt.y - p.y) <= margin) return a.id
          }
          break
      }
    }
    return null
  }, [annotations])

  const toScreenCoords = (e: React.MouseEvent): Point => {
    return { x: e.clientX, y: e.clientY }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!drawMode || !activeTool) return
    e.preventDefault()


    // Eraser mode — start drag-erase. mouseUp ends it, mousemove keeps
    // erasing whatever's under the cursor (Paint-style, partial-erase).
    if (activeTool === 'move') {
      erasingRef.current = true
      const pt = toScreenCoords(e)
      onEraseAt(pt, eraserRadius)
      return
    }

    // Drag mode — click to grab, drag to move
    if (activeTool === 'drag') {
      const pt = toScreenCoords(e)
      const id = hitTest(pt)
      if (id) {
        dragRef.current = { id, lastMouse: pt }
      }
      return
    }

    // Text placement — click to place pending text
    if (activeTool === 'text' && pendingText) {
      const pt = toScreenCoords(e)
      onAddAnnotation({
        id: nextId(),
        type: 'text',
        color: pendingText.color,
        strokeWidth: 0,
        position: pt,
        text: pendingText.text,
        fontSize: fs
      })
      onTextPlaced?.()
      return
    }

    const pt = toScreenCoords(e)
    setStartPoint(pt)
    setCurrentPoint(pt)
    setDrawing(true)

    if (activeTool === 'pen' || activeTool === 'highlight') {
      setFreehandPoints([pt])
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    // Drag in progress
    if (dragRef.current) {
      const pt = toScreenCoords(e)
      const dx = pt.x - dragRef.current.lastMouse.x
      const dy = pt.y - dragRef.current.lastMouse.y
      onMoveAnnotation(dragRef.current.id, dx, dy)
      dragRef.current.lastMouse = pt
      return
    }

    // Eraser preview circle follows cursor regardless of button state
    if (activeTool === 'move') {
      setEraserCursor({ x: e.clientX, y: e.clientY })
    }

    // Drag-erase: while the eraser is held down, partial-erase whatever
    // the cursor passes over.
    if (erasingRef.current && activeTool === 'move') {
      const pt = toScreenCoords(e)
      onEraseAt(pt, eraserRadius)
      return
    }

    if (!drawing) return

    const pt = toScreenCoords(e)
    setCurrentPoint(pt)

    if (activeTool === 'pen' || activeTool === 'highlight') {
      setFreehandPoints(prev => [...prev, pt])
    }
  }

  const handleMouseUp = () => {
    // End drag
    if (dragRef.current) {
      dragRef.current = null
      return
    }

    // End eraser stroke
    if (erasingRef.current) {
      erasingRef.current = false
      return
    }

    if (!drawing || !activeTool) {
      setDrawing(false)
      return
    }

    if ((activeTool === 'pen' || activeTool === 'highlight') && freehandPoints.length >= 2) {
      if (activeTool === 'pen') {
        onAddAnnotation({ id: nextId(), type: 'pen', color: activeColor, strokeWidth: sw, points: freehandPoints })
      } else {
        onAddAnnotation({ id: nextId(), type: 'highlight', color: activeColor, strokeWidth: sw, points: freehandPoints, opacity: 0.4 })
      }
    } else if (startPoint && currentPoint) {
      const dx = Math.abs(currentPoint.x - startPoint.x)
      const dy = Math.abs(currentPoint.y - startPoint.y)

      if (activeTool === 'arrow' && (dx > 2 || dy > 2)) {
        onAddAnnotation({ id: nextId(), type: 'arrow', color: activeColor, strokeWidth: sw, start: startPoint, end: currentPoint, headStyle: arrowStyle })
      }
      if (activeTool === 'rectangle' && dx > 2 && dy > 2) {
        onAddAnnotation({
          id: nextId(), type: 'rectangle', color: activeColor, strokeWidth: sw,
          x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
          width: dx, height: dy
        })
      }
      if (activeTool === 'line' && (dx > 2 || dy > 2)) {
        onAddAnnotation({ id: nextId(), type: 'line', color: activeColor, strokeWidth: sw, start: startPoint, end: currentPoint })
      }
      if (activeTool === 'cover' && dx > 2 && dy > 2) {
        onAddAnnotation({
          id: nextId(), type: 'cover', color: activeColor, strokeWidth: 0,
          x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
          width: dx, height: dy,
          style: coverStyle
        })
      }
      if (activeTool === 'ocr' && dx > 10 && dy > 10) {
        // Convert window-relative coords to screen-absolute (multi-monitor support)
        const region = {
          x: Math.min(startPoint.x, currentPoint.x) + window.screenX,
          y: Math.min(startPoint.y, currentPoint.y) + window.screenY,
          width: dx,
          height: dy
        }
        onOCRStatus?.({ text: t('liveOcr.scanning'), type: 'success' })
        window.annotationOverlayAPI.ocrCaptureRegion(region).then(result => {
          if (result.success && result.text) {
            onOCRStatus?.({ text: t('liveOcr.copied'), type: 'success' })
          } else {
            onOCRStatus?.({ text: result.error || t('liveOcr.notFound'), type: 'error' })
          }
          setTimeout(() => onOCRStatus?.(null), 2000)
        }).catch(() => {
          onOCRStatus?.({ text: t('liveOcr.error'), type: 'error' })
          setTimeout(() => onOCRStatus?.(null), 2000)
        })
      }
    }

    setDrawing(false)
    setStartPoint(null)
    setCurrentPoint(null)
    setFreehandPoints([])
  }

  const cursor =
    !drawMode ? 'default'
    : activeTool === 'move' ? 'none'  /* preview circle replaces cursor */
    : activeTool === 'drag' ? 'grab'
    : activeTool === 'text' && pendingText ? 'text'
    : activeTool ? 'crosshair'
    : 'default'

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`la-canvas ${drawMode ? 'la-canvas-draw' : 'la-canvas-passthrough'}`}
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {drawMode && activeTool === 'move' && eraserCursor && (
        <div
          className="la-eraser-preview"
          style={{
            left: eraserCursor.x - eraserRadius,
            top: eraserCursor.y - eraserRadius,
            width: eraserRadius * 2,
            height: eraserRadius * 2
          }}
        />
      )}
    </>
  )
}
