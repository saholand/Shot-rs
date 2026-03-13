import { useRef, useEffect, useState, useCallback } from 'react'
import type { Annotation, AnnotationTool, Point } from '../../shared/types/annotation'
import { renderAll, renderAnnotation } from './render'

interface AnnotationCanvasProps {
  imageDataUrl: string
  annotations: Annotation[]
  activeTool: AnnotationTool | null
  activeColor: string
  onAddAnnotation: (annotation: Annotation) => void
}

interface TextInputState {
  imagePos: Point
  displayX: number
  displayY: number
  value: string
}

let idCounter = 0
function nextId(): string {
  return `ann-${++idCounter}-${Date.now()}`
}

export function AnnotationCanvas({
  imageDataUrl,
  annotations,
  activeTool,
  activeColor,
  onAddAnnotation
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null)
  const [textInput, setTextInput] = useState<TextInputState | null>(null)

  // Compute stroke/font sizes based on image dimensions
  const getStrokeWidth = useCallback(() => {
    if (!imageRef.current) return 3
    return Math.max(2, Math.round(Math.min(imageRef.current.naturalWidth, imageRef.current.naturalHeight) / 200))
  }, [])

  const getFontSize = useCallback(() => {
    if (!imageRef.current) return 24
    return Math.max(16, Math.round(Math.min(imageRef.current.naturalWidth, imageRef.current.naturalHeight) / 30))
  }, [])

  // Convert mouse event to image coordinates
  const toImageCoords = useCallback((e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * canvas.width),
      y: Math.round(((e.clientY - rect.top) / rect.height) * canvas.height)
    }
  }, [])

  // Load image
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
      }
      setImageLoaded(true)
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Build preview annotation from current drawing state
  const getPreview = useCallback((): Annotation | null => {
    if (!drawing || !startPoint || !currentPoint || !activeTool) return null
    if (activeTool === 'text') return null

    const sw = getStrokeWidth()

    if (activeTool === 'arrow') {
      return {
        id: '__preview',
        type: 'arrow',
        color: activeColor,
        strokeWidth: sw,
        start: startPoint,
        end: currentPoint
      }
    }

    if (activeTool === 'rectangle') {
      const x = Math.min(startPoint.x, currentPoint.x)
      const y = Math.min(startPoint.y, currentPoint.y)
      return {
        id: '__preview',
        type: 'rectangle',
        color: activeColor,
        strokeWidth: sw,
        x,
        y,
        width: Math.abs(currentPoint.x - startPoint.x),
        height: Math.abs(currentPoint.y - startPoint.y)
      }
    }

    if (activeTool === 'blur') {
      const x = Math.min(startPoint.x, currentPoint.x)
      const y = Math.min(startPoint.y, currentPoint.y)
      return {
        id: '__preview',
        type: 'blur',
        color: '',
        strokeWidth: 0,
        x,
        y,
        width: Math.abs(currentPoint.x - startPoint.x),
        height: Math.abs(currentPoint.y - startPoint.y),
        intensity: 10
      }
    }

    return null
  }, [drawing, startPoint, currentPoint, activeTool, activeColor, getStrokeWidth])

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imageRef.current
    if (!canvas || !ctx || !img) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    renderAll(ctx, annotations, img)

    const preview = getPreview()
    if (preview) {
      renderAnnotation(ctx, preview, img)
    }
  }, [annotations, getPreview])

  useEffect(() => {
    if (imageLoaded) redraw()
  }, [imageLoaded, redraw])

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activeTool || activeTool === 'text') return
    if (textInput) commitText()
    const pt = toImageCoords(e)
    setStartPoint(pt)
    setCurrentPoint(pt)
    setDrawing(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return
    setCurrentPoint(toImageCoords(e))
  }

  const handleMouseUp = () => {
    if (!drawing || !startPoint || !currentPoint || !activeTool) {
      setDrawing(false)
      return
    }

    const sw = getStrokeWidth()

    if (activeTool === 'arrow') {
      const dx = currentPoint.x - startPoint.x
      const dy = currentPoint.y - startPoint.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        onAddAnnotation({
          id: nextId(),
          type: 'arrow',
          color: activeColor,
          strokeWidth: sw,
          start: startPoint,
          end: currentPoint
        })
      }
    }

    if (activeTool === 'rectangle') {
      const w = Math.abs(currentPoint.x - startPoint.x)
      const h = Math.abs(currentPoint.y - startPoint.y)
      if (w > 2 && h > 2) {
        onAddAnnotation({
          id: nextId(),
          type: 'rectangle',
          color: activeColor,
          strokeWidth: sw,
          x: Math.min(startPoint.x, currentPoint.x),
          y: Math.min(startPoint.y, currentPoint.y),
          width: w,
          height: h
        })
      }
    }

    if (activeTool === 'blur') {
      const w = Math.abs(currentPoint.x - startPoint.x)
      const h = Math.abs(currentPoint.y - startPoint.y)
      if (w > 2 && h > 2) {
        onAddAnnotation({
          id: nextId(),
          type: 'blur',
          color: '',
          strokeWidth: 0,
          x: Math.min(startPoint.x, currentPoint.x),
          y: Math.min(startPoint.y, currentPoint.y),
          width: w,
          height: h,
          intensity: 10
        })
      }
    }

    setDrawing(false)
    setStartPoint(null)
    setCurrentPoint(null)
  }

  // Text click handler
  const handleClick = (e: React.MouseEvent) => {
    if (activeTool !== 'text') return
    const imgPt = toImageCoords(e)
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    setTextInput({
      imagePos: imgPt,
      displayX: e.clientX - rect.left,
      displayY: e.clientY - rect.top,
      value: ''
    })
  }

  const commitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null)
      return
    }
    onAddAnnotation({
      id: nextId(),
      type: 'text',
      color: activeColor,
      strokeWidth: getStrokeWidth(),
      position: textInput.imagePos,
      text: textInput.value.trim(),
      fontSize: getFontSize()
    })
    setTextInput(null)
  }

  const cursor = activeTool ? 'crosshair' : 'default'

  return (
    <div className="annotation-canvas-wrapper" style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        className="annotation-canvas"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
      {textInput && (
        <input
          className="annotation-text-input"
          style={{
            position: 'absolute',
            left: textInput.displayX,
            top: textInput.displayY
          }}
          autoFocus
          value={textInput.value}
          onChange={e => setTextInput({ ...textInput, value: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter') commitText()
            if (e.key === 'Escape') setTextInput(null)
          }}
          onBlur={commitText}
        />
      )}
    </div>
  )
}
