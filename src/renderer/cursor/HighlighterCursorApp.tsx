import { useEffect, useRef, useState } from 'react'
import { HIGHLIGHTER_DIAMETER, type HighlighterThickness } from '../../shared/types/settings'
import type { HighlighterCursorState, HighlighterPosPayload } from '../../shared/types/ipc'

interface State {
  visible: boolean
  color: string
  thickness: HighlighterThickness
  mode: 'disc' | 'ring'
}

const DEFAULT_STATE: State = {
  visible: false,
  color: '#ffea00',
  thickness: 'medium',
  mode: 'disc'
}

/**
 * Renders a fluorescent disc that follows the cursor. Two pieces of state:
 *
 *  - `state` (visible/color/thickness): comes from the toolbar via IPC.
 *  - `pos` (x,y): comes from the global mouse hook each mousemove event.
 *
 * To keep movement fluid even when IPC events arrive irregularly, we lerp
 * the rendered position toward the latest reported position inside a
 * requestAnimationFrame loop. The lerp factor is high enough that the
 * disc effectively tracks the cursor with one or two frames of softening.
 */
export function HighlighterCursorApp() {
  const [state, setState] = useState<State>(DEFAULT_STATE)

  // Latest reported cursor pos (target).
  const targetRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 })
  // Currently rendered pos (animated).
  const renderRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 })
  const discRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    window.highlighterCursorAPI.onUpdate((s: HighlighterCursorState) => {
      setState({
        visible: s.enabled,
        color: s.color,
        thickness: s.thickness,
        mode: s.mode ?? 'disc'
      })
    })
    window.highlighterCursorAPI.onPos((p: HighlighterPosPayload) => {
      targetRef.current = { x: p.x, y: p.y }
    })
    return () => {
      window.highlighterCursorAPI.removeUpdateListener()
      window.highlighterCursorAPI.removePosListener()
    }
  }, [])

  // Apply target position to the disc every frame. Tiny lerp just to
  // avoid jitter when two events arrive at the same frame; fast enough
  // that the disc never visibly trails the cursor on quick swipes.
  useEffect(() => {
    const tick = () => {
      const t = targetRef.current
      const r = renderRef.current
      // Snap when the gap is small; otherwise fast lerp (0.85) so the
      // disc keeps up with rapid movements.
      const dx = t.x - r.x
      const dy = t.y - r.y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        r.x = t.x; r.y = t.y
      } else {
        r.x += dx * 0.85
        r.y += dy * 0.85
      }
      const disc = discRef.current
      if (disc) {
        const d = HIGHLIGHTER_DIAMETER[state.thickness]
        disc.style.transform = `translate3d(${r.x - d / 2}px, ${r.y - d / 2}px, 0)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    if (state.visible) {
      // Initialize render pos to current target so the disc doesn't
      // start at -1000 and slide in.
      renderRef.current = { ...targetRef.current }
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [state.visible, state.thickness])

  if (!state.visible) return null

  const diameter = HIGHLIGHTER_DIAMETER[state.thickness]
  // 'subtle' renders as a thin ring without color glow — gives the
  // smoothing benefit (jitter-free tracked cursor) without the
  // fluorescent look. Other thicknesses still render the highlighter
  // disc with the user's chosen color.
  const isRing = state.mode === 'ring'
  return (
    <div
      ref={discRef}
      className={`hl-disc ${isRing ? 'hl-ring' : ''}`}
      style={{
        width: diameter,
        height: diameter,
        background: isRing ? 'transparent' : `radial-gradient(circle,
          ${state.color}55 0%,
          ${state.color}33 45%,
          ${state.color}10 75%,
          transparent 100%)`,
        boxShadow: isRing ? 'none' : `0 0 ${diameter * 0.45}px ${state.color}55`,
        border: isRing ? `2px solid ${state.color}` : 'none'
      }}
    />
  )
}
