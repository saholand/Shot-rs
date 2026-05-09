import type {
  Annotation,
  ArrowAnnotation,
  RectangleAnnotation,
  TextAnnotation,
  BlurAnnotation,
  PenAnnotation,
  LineAnnotation,
  HighlightAnnotation,
  CoverAnnotation
} from '../../shared/types/annotation'

export function renderArrow(ctx: CanvasRenderingContext2D, a: ArrowAnnotation): void {
  const dx = a.end.x - a.start.x
  const dy = a.end.y - a.start.y
  if (dx === 0 && dy === 0) return

  const angle = Math.atan2(dy, dx)
  const headLen = a.strokeWidth * 4
  const outline = a.headStyle === 'outline'

  ctx.strokeStyle = a.color
  ctx.lineWidth = a.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Shorten the shaft slightly when the head is filled so it doesn't peek
  // past the triangle base
  const shaftEndX = outline ? a.end.x : a.end.x - Math.cos(angle) * (headLen * 0.6)
  const shaftEndY = outline ? a.end.y : a.end.y - Math.sin(angle) * (headLen * 0.6)

  ctx.beginPath()
  ctx.moveTo(a.start.x, a.start.y)
  ctx.lineTo(shaftEndX, shaftEndY)
  ctx.stroke()

  // Two head wings (always drawn the same way)
  const x1 = a.end.x - headLen * Math.cos(angle - Math.PI / 6)
  const y1 = a.end.y - headLen * Math.sin(angle - Math.PI / 6)
  const x2 = a.end.x - headLen * Math.cos(angle + Math.PI / 6)
  const y2 = a.end.y - headLen * Math.sin(angle + Math.PI / 6)

  if (outline) {
    // Open chevron — two strokes meeting at the tip
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(a.end.x, a.end.y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  } else {
    ctx.fillStyle = a.color
    ctx.beginPath()
    ctx.moveTo(a.end.x, a.end.y)
    ctx.lineTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.closePath()
    ctx.fill()
  }
}

export function renderRectangle(ctx: CanvasRenderingContext2D, a: RectangleAnnotation): void {
  if (a.width === 0 || a.height === 0) return
  ctx.strokeStyle = a.color
  ctx.lineWidth = a.strokeWidth
  ctx.lineJoin = 'miter'
  ctx.strokeRect(a.x, a.y, a.width, a.height)
}

export function renderText(ctx: CanvasRenderingContext2D, a: TextAnnotation): void {
  if (!a.text) return
  ctx.fillStyle = a.color
  ctx.font = `bold ${a.fontSize}px sans-serif`
  ctx.textBaseline = 'top'
  ctx.fillText(a.text, a.position.x, a.position.y)
}

export function renderBlur(
  ctx: CanvasRenderingContext2D,
  a: BlurAnnotation,
  baseImage: CanvasImageSource
): void {
  if (a.width === 0 || a.height === 0) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(a.x, a.y, a.width, a.height)
  ctx.clip()
  ctx.filter = `blur(${a.intensity}px)`
  ctx.drawImage(baseImage, 0, 0)
  ctx.filter = 'none'
  ctx.restore()
}

export function renderPen(ctx: CanvasRenderingContext2D, a: PenAnnotation): void {
  if (a.points.length < 2) return
  ctx.strokeStyle = a.color
  ctx.lineWidth = a.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(a.points[0].x, a.points[0].y)
  for (let i = 1; i < a.points.length; i++) {
    ctx.lineTo(a.points[i].x, a.points[i].y)
  }
  ctx.stroke()
}

export function renderLine(ctx: CanvasRenderingContext2D, a: LineAnnotation): void {
  ctx.strokeStyle = a.color
  ctx.lineWidth = a.strokeWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.start.x, a.start.y)
  ctx.lineTo(a.end.x, a.end.y)
  ctx.stroke()
}

export function renderHighlight(ctx: CanvasRenderingContext2D, a: HighlightAnnotation): void {
  if (a.points.length < 2) return
  ctx.save()
  ctx.globalAlpha = a.opacity
  ctx.strokeStyle = a.color
  ctx.lineWidth = a.strokeWidth * 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(a.points[0].x, a.points[0].y)
  for (let i = 1; i < a.points.length; i++) {
    ctx.lineTo(a.points[i].x, a.points[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Cover ("blur") annotation. We can't actually blur the underlying screen
 * because the canvas is a transparent overlay with no access to the
 * pixels behind it — so all four styles are opaque/translucent fills
 * tuned to *look* like a privacy mask without revealing what they cover.
 */
export function renderCover(ctx: CanvasRenderingContext2D, a: CoverAnnotation): void {
  if (a.width === 0 || a.height === 0) return
  const style = a.style ?? 'noise'
  ctx.save()

  if (style === 'solid') {
    ctx.fillStyle = a.color || '#000000'
    ctx.fillRect(a.x, a.y, a.width, a.height)
    ctx.restore()
    return
  }

  if (style === 'pixelate') {
    // Big blocks of the cover color with deterministic shade variation.
    // Reads as a chunky mosaic — the classic "pixelated face" look.
    const block = 24
    const rgb = parseHex(a.color) ?? { r: 90, g: 90, b: 90 }
    for (let bx = 0; bx < a.width; bx += block) {
      for (let by = 0; by < a.height; by += block) {
        // ±18 shade jitter around the base color, deterministic per cell
        const j = (((bx / block) * 11 + (by / block) * 17) % 36) - 18
        const cr = clamp8(rgb.r + j)
        const cg = clamp8(rgb.g + j)
        const cb = clamp8(rgb.b + j)
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`
        ctx.fillRect(
          a.x + bx,
          a.y + by,
          Math.min(block, a.width - bx),
          Math.min(block, a.height - by)
        )
      }
    }
    ctx.restore()
    return
  }

  if (style === 'frosted') {
    // Translucent white fill + a soft 4px noise grid → frosted-glass look.
    // Hides text but keeps the area visibly "soft" instead of opaque.
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillRect(a.x, a.y, a.width, a.height)
    const block = 4
    ctx.globalAlpha = 0.18
    for (let bx = 0; bx < a.width; bx += block) {
      for (let by = 0; by < a.height; by += block) {
        const shade = (((bx / block) * 7 + (by / block) * 13) % 70) + 160
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`
        ctx.fillRect(
          a.x + bx,
          a.y + by,
          Math.min(block, a.width - bx),
          Math.min(block, a.height - by)
        )
      }
    }
    ctx.restore()
    return
  }

  // 'noise' (default) — original gray static
  const block = 10
  for (let bx = 0; bx < a.width; bx += block) {
    for (let by = 0; by < a.height; by += block) {
      const shade = (((bx / block) * 7 + (by / block) * 13) % 50) + 100
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`
      ctx.fillRect(
        a.x + bx,
        a.y + by,
        Math.min(block, a.width - bx),
        Math.min(block, a.height - by)
      )
    }
  }
  ctx.restore()
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1]
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16)
    }
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  }
}

function clamp8(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0
}

export function renderAnnotation(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  baseImage?: CanvasImageSource
): void {
  switch (a.type) {
    case 'arrow': renderArrow(ctx, a); break
    case 'rectangle': renderRectangle(ctx, a); break
    case 'text': renderText(ctx, a); break
    case 'blur':
      if (baseImage) renderBlur(ctx, a, baseImage)
      break
    case 'pen': renderPen(ctx, a); break
    case 'line': renderLine(ctx, a); break
    case 'highlight': renderHighlight(ctx, a); break
    case 'cover': renderCover(ctx, a); break
  }
}

export function renderAll(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  baseImage?: CanvasImageSource
): void {
  for (const a of annotations) {
    renderAnnotation(ctx, a, baseImage)
  }
}

export function compositeImage(
  baseImage: HTMLImageElement,
  annotations: Annotation[]
): string {
  const canvas = document.createElement('canvas')
  canvas.width = baseImage.naturalWidth
  canvas.height = baseImage.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(baseImage, 0, 0)
  if (annotations.length > 0) {
    renderAll(ctx, annotations, baseImage)
  }
  return canvas.toDataURL('image/png')
}
