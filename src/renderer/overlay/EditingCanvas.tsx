import { useRef, useEffect, useState, useCallback } from 'react'
import type { Annotation, AnnotationTool, Point } from '../../shared/types/annotation'
import type { SelectionRegion } from '../../shared/types/ipc'
import { renderAll, renderAnnotation } from '../annotation/render'

interface EditingCanvasProps {
  imageDataUrl: string
  region: SelectionRegion
  scaleFactor: number
  annotations: Annotation[]
  activeTool: AnnotationTool | null
  activeColor: string
  onAddAnnotation: (annotation: Annotation) => void
  onMoveAnnotation: (id: string, dx: number, dy: number) => void
  onFrameMove?: (dx: number, dy: number) => void
  onColorPick?: (hex: string) => void
  onOCRRegion?: (regionDataUrl: string) => void
}

interface EyedropperState {
  screenX: number
  screenY: number
  hex: string
}

interface TextInputState {
  imagePos: Point
  screenX: number
  screenY: number
  value: string
}

let idCounter = 0
function nextId(): string {
  return `ann-${++idCounter}-${Date.now()}`
}

export function EditingCanvas({
  imageDataUrl,
  region,
  scaleFactor,
  annotations,
  activeTool,
  activeColor,
  onAddAnnotation,
  onMoveAnnotation,
  onFrameMove,
  onColorPick,
  onOCRRegion
}: EditingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null)
  const [textInput, setTextInput] = useState<TextInputState | null>(null)

  // Freehand drawing state (pen, highlight)
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([])

  // Move tool state
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveStart, setMoveStart] = useState<Point | null>(null)

  // Frame drag state (move entire frame when no tool active)
  const [frameDragging, setFrameDragging] = useState(false)
  const frameDragStartRef = useRef<{ x: number; y: number } | null>(null)

  // Text input drag state
  const [textDragging, setTextDragging] = useState(false)
  const [textDragOffset, setTextDragOffset] = useState<Point | null>(null)

  // Eyedropper state
  const [eyedropperPos, setEyedropperPos] = useState<EyedropperState | null>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null)

  const getStrokeWidth = useCallback(() => {
    const w = Math.round(region.width * scaleFactor)
    const h = Math.round(region.height * scaleFactor)
    return Math.max(2, Math.round(Math.min(w, h) / 200))
  }, [region.width, region.height, scaleFactor])

  const getFontSize = useCallback(() => {
    const w = Math.round(region.width * scaleFactor)
    const h = Math.round(region.height * scaleFactor)
    return Math.max(16, Math.round(Math.min(w, h) / 30))
  }, [region.width, region.height, scaleFactor])

  // Convert screen mouse coords → full-image pixel coords
  const toImageCoords = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const canvasX = ((e.clientX - rect.left) / rect.width) * canvas.width
    const canvasY = ((e.clientY - rect.top) / rect.height) * canvas.height
    return {
      x: Math.round(canvasX + region.x * scaleFactor),
      y: Math.round(canvasY + region.y * scaleFactor)
    }
  }, [region.x, region.y, scaleFactor])

  // Load captured image + cache pixel data for eyedropper
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = Math.round(region.width * scaleFactor)
        canvas.height = Math.round(region.height * scaleFactor)
      }
      // Cache full image pixel data for fast eyedropper reads
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = img.naturalWidth
      tempCanvas.height = img.naturalHeight
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.drawImage(img, 0, 0)
        imageDataRef.current = tempCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
      }
      setImageLoaded(true)
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Hit test: find annotation under point
  const hitTest = useCallback((pt: Point): string | null => {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i]
      const margin = Math.max(a.strokeWidth * 2, 8)
      switch (a.type) {
        case 'rectangle':
        case 'blur':
          if (pt.x >= a.x - margin && pt.x <= a.x + a.width + margin &&
              pt.y >= a.y - margin && pt.y <= a.y + a.height + margin) {
            return a.id
          }
          break
        case 'text': {
          const fs = a.fontSize
          const approxW = a.text.length * fs * 0.6
          if (pt.x >= a.position.x - margin && pt.x <= a.position.x + approxW + margin &&
              pt.y >= a.position.y - margin && pt.y <= a.position.y + fs + margin) {
            return a.id
          }
          break
        }
        case 'arrow':
        case 'line': {
          const s = a.start, e = a.end
          const dx = e.x - s.x
          const dy = e.y - s.y
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len < 1) break
          const t = Math.max(0, Math.min(1, ((pt.x - s.x) * dx + (pt.y - s.y) * dy) / (len * len)))
          const projX = s.x + t * dx
          const projY = s.y + t * dy
          const dist = Math.sqrt((pt.x - projX) ** 2 + (pt.y - projY) ** 2)
          if (dist <= margin + 4) return a.id
          break
        }
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

  // Build preview annotation while drawing
  const getPreview = useCallback((): Annotation | null => {
    if (!drawing || !activeTool) return null
    if (activeTool === 'text' || activeTool === 'move' || activeTool === 'eyedropper') return null

    const sw = getStrokeWidth()

    // Freehand tools
    if ((activeTool === 'pen' || activeTool === 'highlight') && freehandPoints.length >= 2) {
      if (activeTool === 'pen') {
        return { id: '__preview', type: 'pen', color: activeColor, strokeWidth: sw, points: freehandPoints }
      }
      return { id: '__preview', type: 'highlight', color: activeColor, strokeWidth: sw, points: freehandPoints, opacity: 0.4 }
    }

    if (!startPoint || !currentPoint) return null

    if (activeTool === 'arrow') {
      return { id: '__preview', type: 'arrow', color: activeColor, strokeWidth: sw, start: startPoint, end: currentPoint }
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
    if (activeTool === 'blur') {
      return {
        id: '__preview', type: 'blur', color: '', strokeWidth: 0,
        x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x), height: Math.abs(currentPoint.y - startPoint.y),
        intensity: 10
      }
    }
    if (activeTool === 'ocr') {
      return {
        id: '__preview', type: 'rectangle', color: '#0088ff', strokeWidth: sw,
        x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x), height: Math.abs(currentPoint.y - startPoint.y)
      }
    }
    return null
  }, [drawing, startPoint, currentPoint, activeTool, activeColor, getStrokeWidth, freehandPoints])

  // Redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imageRef.current
    if (!canvas || !ctx || !img) return

    // Update canvas size for current crop region
    const cw = Math.round(region.width * scaleFactor)
    const ch = Math.round(region.height * scaleFactor)
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }

    const sx = Math.round(region.x * scaleFactor)
    const sy = Math.round(region.y * scaleFactor)
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch)

    // Translate so annotations (stored in full-image coords) render correctly
    ctx.save()
    ctx.translate(-sx, -sy)
    renderAll(ctx, annotations, img)

    // Highlight selected annotation in move mode
    if (activeTool === 'move' && movingId) {
      const a = annotations.find(ann => ann.id === movingId)
      if (a) {
        ctx.save()
        ctx.strokeStyle = '#4fa3f7'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        switch (a.type) {
          case 'rectangle':
          case 'blur':
            ctx.strokeRect(a.x - 4, a.y - 4, a.width + 8, a.height + 8)
            break
          case 'text':
            ctx.strokeRect(a.position.x - 4, a.position.y - 4, a.text.length * a.fontSize * 0.6 + 8, a.fontSize + 8)
            break
          case 'arrow':
          case 'line':
            ctx.strokeRect(
              Math.min(a.start.x, a.end.x) - 4, Math.min(a.start.y, a.end.y) - 4,
              Math.abs(a.end.x - a.start.x) + 8, Math.abs(a.end.y - a.start.y) + 8
            )
            break
          case 'pen':
          case 'highlight': {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            for (const p of a.points) {
              if (p.x < minX) minX = p.x
              if (p.y < minY) minY = p.y
              if (p.x > maxX) maxX = p.x
              if (p.y > maxY) maxY = p.y
            }
            ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8)
            break
          }
        }
        ctx.restore()
      }
    }

    const preview = getPreview()
    if (preview) renderAnnotation(ctx, preview, img)
    ctx.restore()
  }, [annotations, getPreview, activeTool, movingId, region, scaleFactor])

  useEffect(() => {
    if (imageLoaded) redraw()
  }, [imageLoaded, redraw])

  // Eyedropper: read pixel color at image coordinates
  const readPixelColor = useCallback((imgX: number, imgY: number): string | null => {
    const imgData = imageDataRef.current
    const img = imageRef.current
    if (!imgData || !img) return null
    const x = Math.max(0, Math.min(imgX, img.naturalWidth - 1))
    const y = Math.max(0, Math.min(imgY, img.naturalHeight - 1))
    const idx = (y * img.naturalWidth + x) * 4
    const r = imgData.data[idx]
    const g = imgData.data[idx + 1]
    const b = imgData.data[idx + 2]
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }, [])

  // Eyedropper: draw zoomed loupe canvas
  const drawLoupe = useCallback((imgX: number, imgY: number) => {
    const loupe = loupeCanvasRef.current
    const img = imageRef.current
    if (!loupe || !img) return
    const ctx = loupe.getContext('2d')
    if (!ctx) return
    const radius = 4
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 90, 90)
    ctx.drawImage(
      img,
      Math.max(0, imgX - radius), Math.max(0, imgY - radius),
      radius * 2 + 1, radius * 2 + 1,
      0, 0, 90, 90
    )
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 1
    ctx.strokeRect(40, 40, 10, 10)
  }, [])

  // Clear eyedropper state when tool changes
  useEffect(() => {
    if (activeTool !== 'eyedropper') {
      setEyedropperPos(null)
    }
  }, [activeTool])

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (textInput) commitText()

    // Eyedropper: pick color on click
    if (activeTool === 'eyedropper') {
      e.stopPropagation()
      const pt = toImageCoords(e)
      const hex = readPixelColor(pt.x, pt.y)
      if (hex && onColorPick) {
        onColorPick(hex)
      }
      setEyedropperPos(null)
      return
    }

    // Move tool: annotation hit → move annotation, empty space → move frame
    if (activeTool === 'move') {
      e.stopPropagation()
      const pt = toImageCoords(e)
      const id = hitTest(pt)
      if (id) {
        setMovingId(id)
        setMoveStart(pt)
      } else {
        setMovingId(null)
        if (onFrameMove) {
          e.preventDefault()
          setFrameDragging(true)
          frameDragStartRef.current = { x: e.clientX, y: e.clientY }
        }
      }
      return
    }

    // No tool active → frame move
    if (!activeTool && onFrameMove) {
      e.preventDefault()
      e.stopPropagation()
      setFrameDragging(true)
      frameDragStartRef.current = { x: e.clientX, y: e.clientY }
      return
    }

    if (!activeTool || activeTool === 'text' || activeTool === 'eyedropper') return

    e.stopPropagation()
    const pt = toImageCoords(e)
    setStartPoint(pt)
    setCurrentPoint(pt)
    setDrawing(true)

    // Start freehand for pen/highlight
    if (activeTool === 'pen' || activeTool === 'highlight') {
      setFreehandPoints([pt])
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    // Eyedropper: track color under cursor
    if (activeTool === 'eyedropper') {
      e.stopPropagation()
      const pt = toImageCoords(e)
      const hex = readPixelColor(pt.x, pt.y)
      if (hex) {
        setEyedropperPos({ screenX: e.clientX, screenY: e.clientY, hex })
        drawLoupe(pt.x, pt.y)
      }
      return
    }

    // Move tool dragging
    if (activeTool === 'move' && movingId && moveStart) {
      e.stopPropagation()
      const pt = toImageCoords(e)
      const dx = pt.x - moveStart.x
      const dy = pt.y - moveStart.y
      if (dx !== 0 || dy !== 0) {
        onMoveAnnotation(movingId, dx, dy)
        setMoveStart(pt)
      }
      return
    }

    if (!drawing) return
    e.stopPropagation()

    const pt = toImageCoords(e)
    setCurrentPoint(pt)

    // Accumulate freehand points
    if (activeTool === 'pen' || activeTool === 'highlight') {
      setFreehandPoints(prev => [...prev, pt])
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    // Move tool release
    if (activeTool === 'move' && movingId) {
      e.stopPropagation()
      setMoveStart(null)
      return
    }

    if (!drawing || !activeTool) {
      setDrawing(false)
      return
    }
    e.stopPropagation()

    const sw = getStrokeWidth()

    // Commit freehand tools
    if ((activeTool === 'pen' || activeTool === 'highlight') && freehandPoints.length >= 2) {
      if (activeTool === 'pen') {
        onAddAnnotation({ id: nextId(), type: 'pen', color: activeColor, strokeWidth: sw, points: freehandPoints })
      } else {
        onAddAnnotation({ id: nextId(), type: 'highlight', color: activeColor, strokeWidth: sw, points: freehandPoints, opacity: 0.4 })
      }
    } else if (startPoint && currentPoint) {
      if (activeTool === 'arrow') {
        const dx = currentPoint.x - startPoint.x
        const dy = currentPoint.y - startPoint.y
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          onAddAnnotation({ id: nextId(), type: 'arrow', color: activeColor, strokeWidth: sw, start: startPoint, end: currentPoint })
        }
      }

      if (activeTool === 'line') {
        const dx = currentPoint.x - startPoint.x
        const dy = currentPoint.y - startPoint.y
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          onAddAnnotation({ id: nextId(), type: 'line', color: activeColor, strokeWidth: sw, start: startPoint, end: currentPoint })
        }
      }

      if (activeTool === 'rectangle') {
        const w = Math.abs(currentPoint.x - startPoint.x)
        const h = Math.abs(currentPoint.y - startPoint.y)
        if (w > 2 && h > 2) {
          onAddAnnotation({
            id: nextId(), type: 'rectangle', color: activeColor, strokeWidth: sw,
            x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
            width: w, height: h
          })
        }
      }

      if (activeTool === 'blur') {
        const w = Math.abs(currentPoint.x - startPoint.x)
        const h = Math.abs(currentPoint.y - startPoint.y)
        if (w > 2 && h > 2) {
          onAddAnnotation({
            id: nextId(), type: 'blur', color: '', strokeWidth: 0,
            x: Math.min(startPoint.x, currentPoint.x), y: Math.min(startPoint.y, currentPoint.y),
            width: w, height: h, intensity: 10
          })
        }
      }

      if (activeTool === 'ocr' && onOCRRegion) {
        const x = Math.min(startPoint.x, currentPoint.x)
        const y = Math.min(startPoint.y, currentPoint.y)
        const w = Math.abs(currentPoint.x - startPoint.x)
        const h = Math.abs(currentPoint.y - startPoint.y)
        if (w > 10 && h > 10 && imageRef.current) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = w
          tempCanvas.height = h
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.drawImage(imageRef.current, x, y, w, h, 0, 0, w, h)
          onOCRRegion(tempCanvas.toDataURL('image/png'))
        }
      }
    }

    setDrawing(false)
    setStartPoint(null)
    setCurrentPoint(null)
    setFreehandPoints([])
  }

  // Text tool
  const handleClick = (e: React.MouseEvent) => {
    if (activeTool !== 'text') return
    e.stopPropagation()
    const imgPt = toImageCoords(e)
    setTextInput({
      imagePos: imgPt,
      screenX: e.clientX,
      screenY: e.clientY,
      value: ''
    })
  }

  const commitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null)
      return
    }
    onAddAnnotation({
      id: nextId(), type: 'text', color: activeColor, strokeWidth: getStrokeWidth(),
      position: textInput.imagePos, text: textInput.value.trim(), fontSize: getFontSize()
    })
    setTextInput(null)
  }

  // Text input drag handlers
  const handleTextDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!textInput) return
    setTextDragging(true)
    setTextDragOffset({ x: e.clientX - textInput.screenX, y: e.clientY - textInput.screenY })
  }

  useEffect(() => {
    if (!textDragging || !textInput) return
    const onMove = (e: MouseEvent) => {
      if (!textDragOffset) return
      const newScreenX = e.clientX - textDragOffset.x
      const newScreenY = e.clientY - textDragOffset.y
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const imgX = Math.round(((newScreenX - rect.left) / rect.width) * canvas.width + region.x * scaleFactor)
      const imgY = Math.round(((newScreenY - rect.top) / rect.height) * canvas.height + region.y * scaleFactor)
      setTextInput(prev => prev ? { ...prev, screenX: newScreenX, screenY: newScreenY, imagePos: { x: imgX, y: imgY } } : null)
    }
    const onUp = () => {
      setTextDragging(false)
      setTextDragOffset(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [textDragging, textDragOffset, textInput, region, scaleFactor])

  // Frame drag effect (window-level mousemove/mouseup)
  useEffect(() => {
    if (!frameDragging || !onFrameMove) return
    const onMove = (e: MouseEvent) => {
      const start = frameDragStartRef.current
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx !== 0 || dy !== 0) {
        onFrameMove(dx, dy)
        frameDragStartRef.current = { x: e.clientX, y: e.clientY }
      }
    }
    const onUp = () => {
      setFrameDragging(false)
      frameDragStartRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [frameDragging, onFrameMove])

  const cursor = activeTool === 'move' ? 'move' : activeTool === 'eyedropper' ? 'crosshair' : activeTool ? 'crosshair' : 'grab'

  return (
    <>
      <canvas
        ref={canvasRef}
        className="editing-canvas"
        style={{
          position: 'fixed',
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
          cursor
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />

      {/* Eyedropper loupe */}
      {eyedropperPos && (
        <div
          className="eyedropper-loupe"
          style={{
            position: 'fixed',
            left: Math.min(eyedropperPos.screenX + 20, window.innerWidth - 110),
            top: Math.max(4, eyedropperPos.screenY - 120)
          }}
        >
          <canvas ref={loupeCanvasRef} width={90} height={90} className="eyedropper-zoom" />
          <div className="eyedropper-info">
            <span className="eyedropper-swatch" style={{ background: eyedropperPos.hex }} />
            <span className="eyedropper-hex">{eyedropperPos.hex}</span>
          </div>
        </div>
      )}

      {/* Draggable text input */}
      {textInput && (
        <div
          className="editing-text-box"
          style={{
            position: 'fixed',
            left: textInput.screenX,
            top: textInput.screenY - 22
          }}
        >
          <div
            className="editing-text-handle"
            onMouseDown={handleTextDragStart}
            title="Sürükle"
          >
            <span className="editing-text-grip">⋮⋮</span>
          </div>
          <input
            className="editing-text-input"
            autoFocus
            value={textInput.value}
            placeholder="Metin yaz..."
            onChange={e => setTextInput({ ...textInput, value: e.target.value })}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') commitText()
              if (e.key === 'Escape') setTextInput(null)
            }}
            onBlur={() => {
              if (!textDragging) commitText()
            }}
          />
        </div>
      )}
    </>
  )
}
