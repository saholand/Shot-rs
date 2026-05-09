import { useEffect, useRef, useState } from 'react'
import type { EffectsState, EffectsClickPayload, HighlighterPosPayload } from '../../shared/types/ipc'

interface Ripple {
  id: number
  x: number
  y: number
  startedAt: number
  color: string
  baseSize: number
}

const RIPPLE_DURATION_MS = 500
const RIPPLE_BASE: Record<'small' | 'medium' | 'large', number> = {
  small: 60,
  medium: 100,
  large: 160
}

const SPOTLIGHT_RADIUS: Record<'small' | 'medium' | 'large', number> = {
  small: 110,
  medium: 180,
  large: 280
}
const SPOTLIGHT_DIM: Record<'low' | 'medium' | 'high', number> = {
  low: 0.25,
  medium: 0.5,
  high: 0.75
}

const DEFAULT_STATE: EffectsState = {
  clickRipple: { enabled: false, color: '#4fa3f7', size: 'medium' },
  spotlight: { enabled: false, radius: 'medium', dim: 'medium' }
}

let ripIdSeq = 0

export function EffectsApp() {
  const [state, setState] = useState<EffectsState>(DEFAULT_STATE)
  const ripplesRef = useRef<Ripple[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  // Cursor position (for spotlight). Smoothed via lerp inside the rAF
  // tick so the spotlight tracks the cursor without jitter.
  const cursorTargetRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 })
  const cursorRenderRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 })
  const spotlightElRef = useRef<HTMLDivElement | null>(null)

  // Wire IPC: state updates + click events from main
  useEffect(() => {
    window.effectsAPI.onState((s: EffectsState) => setState(s))
    window.effectsAPI.onClick((p: EffectsClickPayload) => {
      // Only react to LEFT clicks (button 1) for ripple — right/middle
      // would also fire and pollute. Skip if ripple disabled.
      if (!ripplesRef.current) return
      const cur = (window as unknown as { __effectsState?: EffectsState }).__effectsState
      const ripple = cur?.clickRipple ?? DEFAULT_STATE.clickRipple
      if (!ripple.enabled || p.button !== 1) return
      ripplesRef.current.push({
        id: ++ripIdSeq,
        x: p.x,
        y: p.y,
        startedAt: performance.now(),
        color: ripple.color,
        baseSize: RIPPLE_BASE[ripple.size]
      })
      // Cap at 6 concurrent ripples to avoid runaway memory on rapid
      // clicks.
      if (ripplesRef.current.length > 6) {
        ripplesRef.current.splice(0, ripplesRef.current.length - 6)
      }
    })
    window.effectsAPI.onCursorPos((p: HighlighterPosPayload) => {
      cursorTargetRef.current = { x: p.x, y: p.y }
    })
    return () => {
      window.effectsAPI.removeStateListener()
      window.effectsAPI.removeClickListener()
      window.effectsAPI.removeCursorPosListener()
    }
  }, [])

  // Mirror state to a global so the click handler closure (registered
  // once on mount) reads the latest values without re-binding the IPC
  // listener on every state change.
  useEffect(() => {
    ;(window as unknown as { __effectsState: EffectsState }).__effectsState = state
  }, [state])

  // rAF loop: render ripple DOM nodes via direct manipulation (avoid
  // React re-render storm at 60fps). Also drives the spotlight tracking.
  useEffect(() => {
    const tick = () => {
      const now = performance.now()

      // Spotlight: smooth cursor lerp + radial-gradient mask via CSS var
      const sp = spotlightElRef.current
      if (sp) {
        const t = cursorTargetRef.current
        const r = cursorRenderRef.current
        const dx = t.x - r.x
        const dy = t.y - r.y
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          r.x = t.x; r.y = t.y
        } else {
          r.x += dx * 0.85
          r.y += dy * 0.85
        }
        sp.style.setProperty('--cx', `${r.x}px`)
        sp.style.setProperty('--cy', `${r.y}px`)
      }

      const container = containerRef.current
      if (container) {
        // Update / cull ripples
        const live: Ripple[] = []
        const seenIds = new Set<string>()
        for (const r of ripplesRef.current) {
          const t = (now - r.startedAt) / RIPPLE_DURATION_MS
          if (t >= 1) continue
          live.push(r)
          const key = `r${r.id}`
          seenIds.add(key)
          let el = container.querySelector<HTMLDivElement>(`[data-rid="${key}"]`)
          if (!el) {
            el = document.createElement('div')
            el.className = 'fx-ripple'
            el.dataset.rid = key
            container.appendChild(el)
          }
          // Ease-out cubic: starts fast, ends slow
          const e = 1 - Math.pow(1 - t, 3)
          const size = r.baseSize * (0.4 + 1.6 * e)
          const opacity = 0.7 * (1 - e)
          const borderColor = r.color
          el.style.left = `${r.x - size / 2}px`
          el.style.top = `${r.y - size / 2}px`
          el.style.width = `${size}px`
          el.style.height = `${size}px`
          el.style.opacity = String(opacity)
          el.style.borderColor = borderColor
          el.style.boxShadow = `0 0 ${size * 0.18}px ${borderColor}`
        }
        ripplesRef.current = live
        // Remove DOM nodes for ripples that completed
        const nodes = container.querySelectorAll<HTMLDivElement>('.fx-ripple')
        nodes.forEach(n => {
          if (!seenIds.has(n.dataset.rid ?? '')) container.removeChild(n)
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const spot = state.spotlight
  const spotRadius = SPOTLIGHT_RADIUS[spot.radius]
  const spotDim = SPOTLIGHT_DIM[spot.dim]

  return (
    <>
      {spot.enabled && (
        <div
          ref={spotlightElRef}
          className="fx-spotlight"
          style={{
            // Radial mask: transparent in a circle around cursor, dim
            // black everywhere else. CSS variables let the rAF loop
            // update the center without React re-render.
            background: `radial-gradient(circle ${spotRadius}px at var(--cx) var(--cy),
              transparent 0%,
              transparent ${Math.round(spotRadius * 0.6)}px,
              rgba(0, 0, 0, ${spotDim}) ${spotRadius}px,
              rgba(0, 0, 0, ${spotDim}) 100%)`
          }}
        />
      )}
      <div ref={containerRef} className="fx-root" />
    </>
  )
}
