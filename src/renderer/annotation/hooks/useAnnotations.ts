import { useState, useCallback } from 'react'
import type { Annotation, AnnotationTool, Point } from '../../../shared/types/annotation'

export interface UseAnnotationsReturn {
  annotations: Annotation[]
  activeTool: AnnotationTool | null
  activeColor: string
  addAnnotation: (annotation: Annotation) => void
  moveAnnotation: (id: string, dx: number, dy: number) => void
  undo: () => void
  clear: () => void
  setTool: (tool: AnnotationTool | null) => void
  setColor: (color: string) => void
}

function offsetPoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy }
}

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeTool, setActiveTool] = useState<AnnotationTool | null>(null)
  const [activeColor, setActiveColor] = useState('#ff0000')

  const addAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation])
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
  }, [])

  return {
    annotations,
    activeTool,
    activeColor,
    addAnnotation,
    moveAnnotation,
    undo,
    clear,
    setTool,
    setColor
  }
}
