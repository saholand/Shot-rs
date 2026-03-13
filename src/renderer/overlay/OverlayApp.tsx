import { useState, useEffect, useCallback, useRef } from 'react'
import { useSelection } from './hooks/useSelection'
import { useAnnotations } from '../annotation/hooks/useAnnotations'
import { renderAll } from '../annotation/render'
import { SelectionCanvas } from './SelectionCanvas'
import { EditingCanvas } from './EditingCanvas'
import { FloatingToolbar } from './FloatingToolbar'
import { MIN_SELECTION_SIZE } from '../../shared/constants'
import type { SelectionRegion } from '../../shared/types/ipc'

type Phase = 'selecting' | 'capturing' | 'editing'
type HandleId = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se'

const HANDLE_SIZE = 10
const MIN_SIZE = 20

const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
  w: 'ew-resize', e: 'ew-resize',
  sw: 'nesw-resize', s: 'ns-resize', se: 'nwse-resize'
}

function getHandlePositions(r: SelectionRegion): { id: HandleId; x: number; y: number }[] {
  const { x, y, width, height } = r
  const mx = x + width / 2
  const my = y + height / 2
  return [
    { id: 'nw', x, y },
    { id: 'n', x: mx, y },
    { id: 'ne', x: x + width, y },
    { id: 'w', x, y: my },
    { id: 'e', x: x + width, y: my },
    { id: 'sw', x, y: y + height },
    { id: 's', x: mx, y: y + height },
    { id: 'se', x: x + width, y: y + height }
  ]
}

export function OverlayApp() {
  const [phase, setPhase] = useState<Phase>('selecting')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [selectionRegion, setSelectionRegion] = useState<SelectionRegion | null>(null)
  const [editRegion, setEditRegion] = useState<SelectionRegion | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  // Resize handle drag state
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null)
  const handleDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const handleInitialRegionRef = useRef<SelectionRegion | null>(null)

  const { annotations, activeTool, activeColor, addAnnotation, moveAnnotation, undo, setTool, setColor } = useAnnotations()

  // Auto-confirm on selection done (back to original behavior)
  const handleSelectionDone = useCallback((region: SelectionRegion) => {
    if (region.width >= MIN_SELECTION_SIZE && region.height >= MIN_SELECTION_SIZE) {
      setSelectionRegion(region)
      setEditRegion(region)
      setPhase('capturing')
      window.overlayAPI.sendSelection(region)
    }
  }, [])

  const { region, isSelecting, handlers } = useSelection(handleSelectionDone)

  // Listen for captured image from main process
  useEffect(() => {
    window.overlayAPI.onCaptured((fullDataUrl: string, _region: SelectionRegion, sf: number) => {
      setCapturedImage(fullDataUrl)
      setScaleFactor(sf)
      setPhase('editing')
      const img = new Image()
      img.onload = () => { imageRef.current = img }
      img.src = fullDataUrl
    })
    return () => window.overlayAPI.removeCapturedListener()
  }, [])

  // Get composited image (base + annotations)
  const getComposited = useCallback((): string => {
    const img = imageRef.current
    if (!img || !editRegion) return capturedImage || ''
    const sf = scaleFactor
    const cw = Math.round(editRegion.width * sf)
    const ch = Math.round(editRegion.height * sf)
    const sx = Math.round(editRegion.x * sf)
    const sy = Math.round(editRegion.y * sf)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch)
    if (annotations.length > 0) {
      ctx.save()
      ctx.translate(-sx, -sy)
      renderAll(ctx, annotations, img)
      ctx.restore()
    }
    return canvas.toDataURL('image/png')
  }, [capturedImage, annotations, editRegion, scaleFactor])

  // Frame move from EditingCanvas (when no tool is active, drag to move)
  const handleFrameMove = useCallback((dx: number, dy: number) => {
    setEditRegion(prev => {
      if (!prev) return null
      const img = imageRef.current
      const newX = prev.x + dx
      const newY = prev.y + dy
      if (!img) return { ...prev, x: newX, y: newY }
      const maxX = img.naturalWidth / scaleFactor - prev.width
      const maxY = img.naturalHeight / scaleFactor - prev.height
      return {
        ...prev,
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      }
    })
  }, [scaleFactor])

  // Resize handle mouse down
  const handleResizeStart = useCallback((handle: HandleId, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!editRegion) return
    setActiveHandle(handle)
    handleDragStartRef.current = { x: e.clientX, y: e.clientY }
    handleInitialRegionRef.current = { ...editRegion }
  }, [editRegion])

  // Window-level mousemove/mouseup for resize handles
  useEffect(() => {
    if (!activeHandle) return
    if (!handleDragStartRef.current || !handleInitialRegionRef.current) return

    const onMouseMove = (e: MouseEvent) => {
      const start = handleDragStartRef.current!
      const init = handleInitialRegionRef.current!
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y

      let left = init.x
      let top = init.y
      let right = init.x + init.width
      let bottom = init.y + init.height

      if (activeHandle.includes('w')) left = init.x + dx
      if (activeHandle.includes('e')) right = init.x + init.width + dx
      if (activeHandle.includes('n')) top = init.y + dy
      if (activeHandle.includes('s')) bottom = init.y + init.height + dy

      if (left > right) [left, right] = [right, left]
      if (top > bottom) [top, bottom] = [bottom, top]

      // Clamp to full image bounds
      const img = imageRef.current
      if (img) {
        const maxW = img.naturalWidth / scaleFactor
        const maxH = img.naturalHeight / scaleFactor
        left = Math.max(0, left)
        top = Math.max(0, top)
        right = Math.min(maxW, right)
        bottom = Math.min(maxH, bottom)
      }

      const w = Math.max(MIN_SIZE, right - left)
      const h = Math.max(MIN_SIZE, bottom - top)

      setEditRegion({ x: left, y: top, width: w, height: h })
    }

    const onMouseUp = () => {
      setActiveHandle(null)
      handleDragStartRef.current = null
      handleInitialRegionRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [activeHandle, scaleFactor])

  // Action handlers
  const handleCopy = useCallback(async () => {
    const result = await window.overlayAPI.copyFinal(getComposited())
    if (result.success) {
      setStatus({ text: 'Kopyalandı!', type: 'success' })
      setTimeout(() => window.overlayAPI.sendCancel(), 600)
    } else {
      setStatus({ text: result.error || 'Kopyalama başarısız', type: 'error' })
    }
  }, [getComposited])

  const handleSave = useCallback(async () => {
    const result = await window.overlayAPI.saveFinal(getComposited())
    if (result.success) {
      setStatus({ text: 'Kaydedildi!', type: 'success' })
      setTimeout(() => window.overlayAPI.sendCancel(), 600)
    } else if (result.error !== 'Save cancelled') {
      setStatus({ text: result.error || 'Kaydetme başarısız', type: 'error' })
    }
  }, [getComposited])

  const handleShare = useCallback(async () => {
    setUploading(true)
    setStatus(null)
    try {
      const result = await window.overlayAPI.uploadScreenshot(getComposited())
      if (result.success && result.url) {
        setStatus({ text: 'Link kopyalandı!', type: 'success' })
        setTimeout(() => window.overlayAPI.sendCancel(), 1200)
      } else {
        setStatus({ text: result.error || 'Yükleme başarısız', type: 'error' })
      }
    } catch {
      setStatus({ text: 'Yükleme başarısız', type: 'error' })
    }
    setUploading(false)
  }, [getComposited])

  const handleOCRRegion = useCallback(async (regionDataUrl: string) => {
    setTool(null)
    setStatus({ text: 'OCR taranıyor...', type: 'success' })
    try {
      const result = await window.overlayAPI.ocrRecognize(regionDataUrl)
      if (result.success && result.text) {
        await navigator.clipboard.writeText(result.text)
        setStatus({ text: 'Metin kopyalandı!', type: 'success' })
      } else if (result.error) {
        setStatus({ text: `OCR hata: ${result.error.slice(0, 60)}`, type: 'error' })
      } else {
        setStatus({ text: 'Metin bulunamadı', type: 'error' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('OCR error:', err)
      setStatus({ text: `OCR hata: ${msg.slice(0, 60)}`, type: 'error' })
    }
  }, [setTool])

  const handleColorPick = useCallback(async (hex: string) => {
    setColor(hex)
    setTool(null)
    try {
      await navigator.clipboard.writeText(hex)
      setStatus({ text: `${hex} kopyalandı`, type: 'success' })
    } catch {
      setStatus({ text: hex, type: 'success' })
    }
  }, [setColor, setTool])

  const handleClose = useCallback(() => {
    window.overlayAPI.sendCancel()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (phase === 'editing' && activeTool) {
          setTool(null)
        } else {
          handleClose()
        }
      }

      if (phase === 'editing') {
        if (e.ctrlKey && e.key === 'c') {
          e.preventDefault()
          handleCopy()
        }
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault()
          handleSave()
        }
        if (e.ctrlKey && e.key === 'z') {
          e.preventDefault()
          undo()
        }
        // Tool shortcuts (single key, no modifier)
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          const shortcuts: Record<string, typeof activeTool> = {
            v: 'move', p: 'pen', h: 'highlight', a: 'arrow',
            r: 'rectangle', l: 'line', t: 'text', b: 'blur',
            i: 'eyedropper', o: 'ocr'
          }
          const tool = shortcuts[e.key.toLowerCase()]
          if (tool) {
            e.preventDefault()
            setTool(activeTool === tool ? null : tool)
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, activeTool, handleClose, handleCopy, handleSave, undo, setTool])

  // Editing phase — show captured image + toolbar + annotation + resize handles
  if (phase === 'editing' && capturedImage && editRegion) {
    return (
      <div className="overlay-container overlay-editing">
        {/* Dim areas around edit region */}
        <div className="overlay-dim" style={{ top: 0, left: 0, right: 0, height: editRegion.y }} />
        <div className="overlay-dim" style={{ top: editRegion.y, left: 0, width: editRegion.x, height: editRegion.height }} />
        <div className="overlay-dim" style={{ top: editRegion.y, left: editRegion.x + editRegion.width, right: 0, height: editRegion.height }} />
        <div className="overlay-dim" style={{ top: editRegion.y + editRegion.height, left: 0, right: 0, bottom: 0 }} />

        {/* Captured image + annotation canvas */}
        <EditingCanvas
          imageDataUrl={capturedImage}
          region={editRegion}
          scaleFactor={scaleFactor}
          annotations={annotations}
          activeTool={activeTool}
          activeColor={activeColor}
          onAddAnnotation={addAnnotation}
          onMoveAnnotation={moveAnnotation}
          onFrameMove={handleFrameMove}
          onColorPick={handleColorPick}
          onOCRRegion={handleOCRRegion}
        />

        {/* 8 resize handles around edit region */}
        {getHandlePositions(editRegion).map(h => (
          <div
            key={h.id}
            className="selection-handle"
            style={{
              left: h.x - HANDLE_SIZE / 2,
              top: h.y - HANDLE_SIZE / 2,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              cursor: HANDLE_CURSORS[h.id]
            }}
            onMouseDown={(e) => handleResizeStart(h.id, e)}
          />
        ))}

        {/* Floating toolbar */}
        <FloatingToolbar
          region={editRegion}
          activeTool={activeTool}
          onToolChange={setTool}
          activeColor={activeColor}
          onColorChange={setColor}
          onUndo={undo}
          canUndo={annotations.length > 0}
          onCopy={handleCopy}
          onSave={handleSave}
          onShare={handleShare}
          onClose={handleClose}
          uploading={uploading}
          status={status}
        />
      </div>
    )
  }

  // Capturing phase — show frozen selection while screen is being captured
  if (phase === 'capturing' && selectionRegion) {
    return (
      <div className="overlay-container">
        <SelectionCanvas region={selectionRegion} isSelecting={false} hideHint />
      </div>
    )
  }

  // Selecting phase — normal selection flow
  return (
    <div
      className="overlay-container"
      onMouseDown={handlers.onMouseDown}
      onMouseMove={handlers.onMouseMove}
      onMouseUp={handlers.onMouseUp}
    >
      <SelectionCanvas region={region} isSelecting={isSelecting} />
    </div>
  )
}
