import { useState, useCallback } from 'react'
import type { Annotation, AnnotationTool, Point } from '../../../shared/types/annotation'

export type StrokeWidth = 'thin' | 'medium' | 'thick'
export type FontSize = 'small' | 'medium' | 'large'
export type ArrowStyle = 'filled' | 'outline'
export type EraserSize = 'small' | 'medium' | 'large'

/** Eraser radius (in image pixels) for each preset. */
export const ERASER_RADIUS: Record<EraserSize, number> = {
  small: 12,
  medium: 24,
  large: 48
}

export interface ToolOptions {
  strokeWidth: StrokeWidth
  fontSize: FontSize
  arrowStyle: ArrowStyle
  blurIntensity: number
  eraserSize: EraserSize
}

export const STROKE_WIDTH_FACTORS: Record<StrokeWidth, number> = {
  thin: 0.6,
  medium: 1.0,
  thick: 1.6
}

export const FONT_SIZE_FACTORS: Record<FontSize, number> = {
  small: 0.7,
  medium: 1.0,
  large: 1.5
}

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  strokeWidth: 'medium',
  fontSize: 'medium',
  arrowStyle: 'filled',
  blurIntensity: 12,
  eraserSize: 'medium'
}

const RECENT_COLORS_LIMIT = 4

export interface UseAnnotationsReturn {
  annotations: Annotation[]
  activeTool: AnnotationTool | null
  activeColor: string
  recentColors: string[]
  options: ToolOptions
  addAnnotation: (annotation: Annotation) => void
  moveAnnotation: (id: string, dx: number, dy: number) => void
  deleteAnnotation: (id: string) => void
  /** Apply an eraser stroke at a point. Splits pen/highlight strokes that
   *  pass through the eraser circle and removes other annotations whose
   *  bounds overlap the circle. */
  eraseAt: (center: Point, radius: number) => void
  undo: () => void
  clear: () => void
  setTool: (tool: AnnotationTool | null) => void
  setColor: (color: string) => void
  setOptions: (next: Partial<ToolOptions>) => void
}

function offsetPoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy }
}

function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by
  return dx * dx + dy * dy
}

/** Distance from point P to the segment AB (squared). */
function pointToSegmentDistanceSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return distanceSq(p.x, p.y, a.x, a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return distanceSq(p.x, p.y, projX, projY)
}

let eraseCounter = 0
function nextEraseId(): string {
  return `er-${++eraseCounter}-${Date.now()}`
}

/**
 * Apply an eraser circle to a single annotation. Returns the resulting
 * list — possibly empty (fully erased), one (untouched or trimmed), or
 * multiple (split into segments).
 */
function eraseFromAnnotation(a: Annotation, center: Point, radius: number): Annotation[] {
  const r2 = radius * radius
  switch (a.type) {
    case 'pen':
    case 'highlight': {
      // Split the points into runs whose distance to `center` exceeds the
      // radius. Each run with ≥2 points becomes its own annotation.
      const runs: Point[][] = []
      let current: Point[] = []
      for (const p of a.points) {
        if (distanceSq(p.x, p.y, center.x, center.y) > r2) {
          current.push(p)
        } else if (current.length > 0) {
          runs.push(current)
          current = []
        }
      }
      if (current.length > 0) runs.push(current)
      return runs
        .filter(seg => seg.length >= 2)
        .map(seg => ({ ...a, id: nextEraseId(), points: seg }))
    }
    case 'line':
    case 'arrow': {
      // Segment proximity test
      if (pointToSegmentDistanceSq(center, a.start, a.end) <= r2) return []
      return [a]
    }
    case 'rectangle':
    case 'blur':
    case 'cover': {
      const closestX = Math.max(a.x, Math.min(center.x, a.x + a.width))
      const closestY = Math.max(a.y, Math.min(center.y, a.y + a.height))
      if (distanceSq(closestX, closestY, center.x, center.y) <= r2) return []
      return [a]
    }
    case 'text': {
      const tw = a.text.length * a.fontSize * 0.6
      const closestX = Math.max(a.position.x, Math.min(center.x, a.position.x + tw))
      const closestY = Math.max(a.position.y, Math.min(center.y, a.position.y + a.fontSize))
      if (distanceSq(closestX, closestY, center.x, center.y) <= r2) return []
      return [a]
    }
    default:
      return [a]
  }
}

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeTool, setActiveTool] = useState<AnnotationTool | null>(null)
  const [activeColor, setActiveColor] = useState('#ff0000')
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [options, setOptionsState] = useState<ToolOptions>(DEFAULT_TOOL_OPTIONS)

  const addAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation])
  }, [])

  const setOptions = useCallback((next: Partial<ToolOptions>) => {
    setOptionsState(prev => ({ ...prev, ...next }))
  }, [])

  const moveAnnotation = useCallback((id: string, dx: number, dy: number) => {
    setAnnotations(prev => prev.map(a => {
      if (a.id !== id) return a
      switch (a.type) {
        case 'arrow':
          return { ...a, start: offsetPoint(a.start, dx, dy), end: offsetPoint(a.end, dx, dy) }
        case 'rectangle':
        case 'blur':
        case 'cover':
          return { ...a, x: a.x + dx, y: a.y + dy }
        case 'text':
          return { ...a, position: offsetPoint(a.position, dx, dy) }
        case 'pen':
        case 'highlight':
          return { ...a, points: a.points.map(p => offsetPoint(p, dx, dy)) }
        case 'line':
          return { ...a, start: offsetPoint(a.start, dx, dy), end: offsetPoint(a.end, dx, dy) }
        default:
          return a
      }
    }))
  }, [])

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [])

  const eraseAt = useCallback((center: Point, radius: number) => {
    setAnnotations(prev => prev.flatMap(a => eraseFromAnnotation(a, center, radius)))
  }, [])

  const undo = useCallback(() => {
    setAnnotations(prev => prev.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    setAnnotations([])
  }, [])

  const setTool = useCallback((tool: AnnotationTool | null) => {
    setActiveTool(tool)
  }, [])

  const setColor = useCallback((color: string) => {
    setActiveColor(color)
    // Push to recent colors (most-recent-first, dedupe, limit)
    setRecentColors(prev => {
      const normalized = color.toLowerCase()
      const filtered = prev.filter(c => c.toLowerCase() !== normalized)
      return [color, ...filtered].slice(0, RECENT_COLORS_LIMIT)
    })
  }, [])

  return {
    annotations,
    activeTool,
    activeColor,
    recentColors,
    options,
    addAnnotation,
    moveAnnotation,
    deleteAnnotation,
    eraseAt,
    undo,
    clear,
    setTool,
    setColor,
    setOptions
  }
}
