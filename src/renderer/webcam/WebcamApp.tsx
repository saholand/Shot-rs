import { useEffect, useRef, useState } from 'react'

interface Config {
  deviceId: string | null
  shape: 'circle' | 'rounded'
}

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const EDGE_CURSORS: Record<Edge, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  nw: 'nwse-resize', se: 'nwse-resize'
}

/**
 * Webcam preview window. Shows the camera feed inside a circular or
 * rounded-square frame the user can drag (top handle) and resize from
 * any edge or corner. The window itself is the recording artifact —
 * nothing else composes the camera into the captured video.
 */
export function WebcamApp() {
  const [config, setConfig] = useState<Config>({ deviceId: null, shape: 'circle' })
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Pull config from main
  useEffect(() => {
    window.webcamAPI.onConfig((c: Config) => setConfig(c))
    return () => window.webcamAPI.removeConfigListener()
  }, [])

  // (Re)acquire camera whenever deviceId changes
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Stop any previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      try {
        // Always probe enumerateDevices first — gives a clearer error
        // than getUserMedia when no camera exists.
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoInputs = devices.filter(d => d.kind === 'videoinput')
        console.log('[webcam] available cameras:', videoInputs.length, videoInputs.map(d => d.label || d.deviceId))
        if (videoInputs.length === 0) {
          setError('Bilgisayarda kamera bulunamadı / No camera detected')
          return
        }
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: config.deviceId ? { deviceId: { exact: config.deviceId } } : true
        }
        console.log('[webcam] requesting getUserMedia', constraints)
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => { /* autoplay grace */ })
        }
        console.log('[webcam] stream live')
        setError(null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Camera unavailable'
        console.error('[webcam] getUserMedia failed:', msg)
        if (!cancelled) setError(msg)
      }
    })()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [config.deviceId])

  // ── Resize handling ────────────────────────────────────────────────
  // Same rAF-throttle + commit-on-up pattern as drag. pointermove can
  // fire at 1000Hz on gaming mice; we coalesce into one setBounds per
  // animation frame and only persist once on pointerup.
  const startResize = (edge: Edge) => async (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const initial = await window.webcamAPI.getBounds()
    if (!initial) return
    const startX = e.screenX
    const startY = e.screenY

    let pending: { x: number; y: number; w: number; h: number } | null = null
    let scheduled = false
    const flush = () => {
      scheduled = false
      if (pending) {
        window.webcamAPI.setBounds(pending)
        pending = null
      }
    }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.screenX - startX
      const dy = ev.screenY - startY
      let { x, y, w, h } = initial
      if (edge.includes('w')) { x += dx; w -= dx }
      if (edge.includes('e')) { w += dx }
      if (edge.includes('n')) { y += dy; h -= dy }
      if (edge.includes('s')) { h += dy }
      if (w < 100) {
        if (edge.includes('w')) x = initial.x + initial.w - 100
        w = 100
      }
      if (h < 100) {
        if (edge.includes('n')) y = initial.y + initial.h - 100
        h = 100
      }
      pending = { x, y, w, h }
      if (!scheduled) {
        scheduled = true
        requestAnimationFrame(flush)
      }
    }
    const onUp = () => {
      if (pending) {
        window.webcamAPI.setBounds(pending)
        pending = null
      }
      window.webcamAPI.commitBounds()
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  // ── Drag handling ──────────────────────────────────────────────────
  // Custom pointer-based drag — `-webkit-app-region: drag` is unreliable
  // on Windows transparent + frame:false windows. Pointermove fires up
  // to 1000Hz on gaming mice and each Win32 SetWindowPos is slow, so we
  // throttle to one update per animation frame and only commit (persist)
  // on pointerup.
  const startDrag = async (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const initial = await window.webcamAPI.getBounds()
    if (!initial) return
    const startX = e.screenX
    const startY = e.screenY

    let pending: { x: number; y: number; w: number; h: number } | null = null
    let scheduled = false
    const flush = () => {
      scheduled = false
      if (pending) {
        window.webcamAPI.setBounds(pending)
        pending = null
      }
    }
    const onMove = (ev: PointerEvent) => {
      pending = {
        x: initial.x + (ev.screenX - startX),
        y: initial.y + (ev.screenY - startY),
        w: initial.w, h: initial.h
      }
      if (!scheduled) {
        scheduled = true
        requestAnimationFrame(flush)
      }
    }
    const onUp = () => {
      // Flush whatever's queued, then commit (persist).
      if (pending) {
        window.webcamAPI.setBounds(pending)
        pending = null
      }
      window.webcamAPI.commitBounds()
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const handles: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

  return (
    <div className={`wc-frame wc-frame-${config.shape}`}>
      {/* Camera */}
      {error ? (
        <div className="wc-error">{error}</div>
      ) : (
        <video ref={videoRef} className="wc-video" autoPlay muted playsInline />
      )}

      {/* Drag area — covers most of the frame except the resize edges. */}
      <div className="wc-drag-area" onPointerDown={startDrag} title="Sürükle / Drag" />

      {/* 8 resize handles */}
      {handles.map(h => (
        <div
          key={h}
          className={`wc-resize wc-resize-${h}`}
          style={{ cursor: EDGE_CURSORS[h] }}
          onPointerDown={startResize(h)}
        />
      ))}
    </div>
  )
}
