import { useEffect, useRef } from 'react'

interface SelectionMagnifierProps {
  /** Pre-captured screen image at native pixels. */
  bgImage: HTMLImageElement | null
  /** Native scale factor of the captured image. */
  scaleFactor: number
  /** Cursor position in window-local DIPs (clientX/Y). */
  cursorX: number
  cursorY: number
  /** Whether the magnifier is currently visible. */
  visible: boolean
  /** Live size info while user is dragging — shown beneath the loupe. */
  sizeText?: string
}

const LOUPE_SIZE = 120
const ZOOM_RADIUS = 8 // pixels (in source) sampled around cursor
const VIEWPORT_MARGIN = 16

/**
 * Pixel-accurate magnifier loupe shown next to the cursor during selection.
 * Reads from a pre-captured screen image and scales 1 source pixel up to
 * roughly LOUPE_SIZE / (ZOOM_RADIUS*2+1) screen pixels.
 *
 * Positioned to follow the cursor but flips to the opposite quadrant so it
 * doesn't cover the area the user is actively selecting.
 */
export function SelectionMagnifier({
  bgImage, scaleFactor, cursorX, cursorY, visible, sizeText
}: SelectionMagnifierProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!visible || !bgImage) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Convert window-local DIPs to source-image native pixels
    const px = Math.round(cursorX * scaleFactor)
    const py = Math.round(cursorY * scaleFactor)
    const r = ZOOM_RADIUS

    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE)

    const sx = Math.max(0, px - r)
    const sy = Math.max(0, py - r)
    const sw = r * 2 + 1
    const sh = r * 2 + 1

    try {
      ctx.drawImage(bgImage, sx, sy, sw, sh, 0, 0, LOUPE_SIZE, LOUPE_SIZE)
    } catch {
      /* image may not be ready yet */
    }

    // Center crosshair (highlights the exact pixel under cursor)
    const pixelSize = LOUPE_SIZE / sw
    const cx = Math.floor((px - sx) * pixelSize)
    const cy = Math.floor((py - sy) * pixelSize)

    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1
    ctx.strokeRect(cx + 0.5, cy + 0.5, Math.ceil(pixelSize), Math.ceil(pixelSize))
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.strokeRect(cx - 0.5, cy - 0.5, Math.ceil(pixelSize) + 2, Math.ceil(pixelSize) + 2)
  }, [bgImage, scaleFactor, cursorX, cursorY, visible])

  if (!visible || !bgImage) return null

  // Place loupe in the quadrant opposite the cursor's screen quadrant so it
  // doesn't cover the selection region.
  const offset = 20
  const screenW = window.innerWidth
  const screenH = window.innerHeight
  let left = cursorX + offset
  let top = cursorY + offset
  if (left + LOUPE_SIZE + VIEWPORT_MARGIN > screenW) left = cursorX - LOUPE_SIZE - offset
  if (top + LOUPE_SIZE + 28 + VIEWPORT_MARGIN > screenH) top = cursorY - LOUPE_SIZE - 28 - offset
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN
  if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN

  return (
    <div className="selection-loupe" style={{ left, top }}>
      <canvas
        ref={canvasRef}
        width={LOUPE_SIZE}
        height={LOUPE_SIZE}
        className="selection-loupe-canvas"
      />
      {sizeText && (
        <div className="selection-loupe-info">{sizeText}</div>
      )}
    </div>
  )
}
