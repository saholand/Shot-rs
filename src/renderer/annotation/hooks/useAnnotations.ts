import { useState, useCallback } from 'react'
import type { Annotation, AnnotationTool, Point } from '../../../shared/types/annotation'

export type StrokeWidth = 'thin' | 'medium' | 'thick'
export type FontSize = 'small' | 'medium' | 'large'
export type ArrowStyle = 'filled' | 'outline'

export interface ToolOptions {
  strokeWidth: StrokeWidth
  fontSize: FontSize
  arrowStyle: ArrowStyle
  blurIntensity: number
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
  blurIntensity: 12
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
  undo: () => void
  clear: () => void
  setTool: (tool: AnnotationTool | null) => void
  setColor: (color: string) => void
  setOptions: (next: Partial<ToolOptions>) => void
}

function offsetPoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy }
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
    undo,
    clear,
    setTool,
    setColor,
    setOptions
  }
}
