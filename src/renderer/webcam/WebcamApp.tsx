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
  // Each edge handle, on pointerdown, captures starting bounds and the
  // pointer; on pointermove computes new bounds and pushes via IPC. The
  // BrowserWindow itself is non-resizable (resizable: false in main), so
  // setBounds is the single source of truth.
  const startResize = (edge: Edge) => async (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const initial = await window.webcamAPI.getBounds()
    if (!initial) return
    const startX = e.screenX
    const startY = e.screenY

    const onMove = (ev: PointerEvent) => {
      const dx = ev.screenX - startX
      const dy = ev.screenY - startY
      let { x, y, w, h } = initial
      if (edge.includes('w')) { x += dx; w -= dx }
      if (edge.includes('e')) { w += dx }
      if (edge.includes('n')) { y += dy; h -= dy }
      if (edge.includes('s')) { h += dy }
      // Keep min size; if user drags through, anchor opposite edge
      if (w < 100) {
        if (edge.includes('w')) x = initial.x + initial.w - 100
        w = 100
      }
      if (h < 100) {
        if (edge.includes('n')) y = initial.y + initial.h - 100
        h = 100
      }
      window.webcamAPI.setBounds({ x, y, w, h })
    }
    const onUp = () => {
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

      {/* Drag handle: a thin transparent strip across the top */}
      <div className="wc-drag-handle" title="Sürükle / Drag" />

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
