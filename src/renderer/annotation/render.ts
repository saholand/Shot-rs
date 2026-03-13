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

  ctx.strokeStyle = a.color
  ctx.lineWidth = a.strokeWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.start.x, a.start.y)
  ctx.lineTo(a.end.x, a.end.y)
  ctx.stroke()

  ctx.fillStyle = a.color
  ctx.beginPath()
  ctx.moveTo(a.end.x, a.end.y)
  ctx.lineTo(
    a.end.x - headLen * Math.cos(angle - Math.PI / 6),
    a.end.y - headLen * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    a.end.x - headLen * Math.cos(angle + Math.PI / 6),
    a.end.y - headLen * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
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

export function renderCover(ctx: CanvasRenderingContext2D, a: CoverAnnotation): void {
  if (a.width === 0 || a.height === 0) return
  const block = 10
  ctx.save()
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
