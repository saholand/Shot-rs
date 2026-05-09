export interface Point {
  x: number
  y: number
}

export type AnnotationTool = 'move' | 'drag' | 'arrow' | 'rectangle' | 'text' | 'blur' | 'pen' | 'line' | 'highlight' | 'cover' | 'eyedropper' | 'ocr'

interface BaseAnnotation {
  id: string
  type: AnnotationTool
  color: string
  strokeWidth: number
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow'
  start: Point
  end: Point
  /** 'filled' (solid triangle, default) or 'outline' (open chevron). */
  headStyle?: 'filled' | 'outline'
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: 'rectangle'
  x: number
  y: number
  width: number
  height: number
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  position: Point
  text: string
  fontSize: number
}

export interface BlurAnnotation extends BaseAnnotation {
  type: 'blur'
  x: number
  y: number
  width: number
  height: number
  intensity: number
}

export interface PenAnnotation extends BaseAnnotation {
  type: 'pen'
  points: Point[]
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line'
  start: Point
  end: Point
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight'
  points: Point[]
  opacity: number
}

export interface CoverAnnotation extends BaseAnnotation {
  type: 'cover'
  x: number
  y: number
  width: number
  height: number
}

export type Annotation =
  | ArrowAnnotation
  | RectangleAnnotation
  | TextAnnotation
  | BlurAnnotation
  | PenAnnotation
  | LineAnnotation
  | HighlightAnnotation
  | CoverAnnotation
