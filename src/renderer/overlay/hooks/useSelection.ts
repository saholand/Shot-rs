import { useState, useCallback, useRef } from 'react'
import { MIN_SELECTION_SIZE } from '../../../shared/constants'
import type { SelectionRegion } from '../../../shared/types/ipc'

interface SelectionState {
  isSelecting: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface UseSelectionReturn {
  region: SelectionRegion | null
  isSelecting: boolean
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void
    onMouseMove: (e: React.MouseEvent) => void
    onMouseUp: (e: React.MouseEvent) => void
  }
  reset: () => void
}

function normalizeRegion(state: SelectionState): SelectionRegion {
  const x = Math.min(state.startX, state.currentX)
  const y = Math.min(state.startY, state.currentY)
  const width = Math.abs(state.currentX - state.startX)
  const height = Math.abs(state.currentY - state.startY)
  return { x, y, width, height }
}

function isValidSelection(region: SelectionRegion): boolean {
  return region.width >= MIN_SELECTION_SIZE && region.height >= MIN_SELECTION_SIZE
}

export function useSelection(onConfirm?: (region: SelectionRegion) => void): UseSelectionReturn {
  const [state, setState] = useState<SelectionState>({
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  })
  const [confirmedRegion, setConfirmedRegion] = useState<SelectionRegion | null>(null)
  const isSelectingRef = useRef(false)
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isSelectingRef.current = true
    setConfirmedRegion(null)
    setState({
      isSelecting: true,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY
    })
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelectingRef.current) return
    setState(prev => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY
    }))
  }, [])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isSelectingRef.current) return
    isSelectingRef.current = false

    const finalState: SelectionState = {
      ...state,
      isSelecting: false,
      currentX: e.clientX,
      currentY: e.clientY
    }
    const region = normalizeRegion(finalState)

    setState(prev => ({ ...prev, isSelecting: false, currentX: e.clientX, currentY: e.clientY }))

    if (isValidSelection(region)) {
      setConfirmedRegion(region)
      // Auto-confirm on mouse-up (Lightshot behavior)
      onConfirmRef.current?.(region)
    }
  }, [state])

  const reset = useCallback(() => {
    isSelectingRef.current = false
    setState({
      isSelecting: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    })
    setConfirmedRegion(null)
  }, [])

  const liveRegion = state.isSelecting ? normalizeRegion(state) : confirmedRegion

  return {
    region: liveRegion,
    isSelecting: state.isSelecting,
    handlers: { onMouseDown, onMouseMove, onMouseUp },
    reset
  }
}
