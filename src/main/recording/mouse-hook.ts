/**
 * Global mouse hook for the recording session. Surfaces:
 *   - mousemove (highlighter cursor + spotlight position),
 *   - mousedown (click ripple effect),
 *   - right-click double-tap (zoom trigger),
 *   - wheel rotations (zoom in/out adjustments while zoom is active).
 *
 * Started when recording begins, stopped when it ends. uiohook-napi is
 * loaded lazily so a missing native binary doesn't crash app startup.
 */

import { screen } from 'electron'

type MouseMoveCb = (payload: { x: number; y: number }) => void
type MouseDownCb = (payload: { x: number; y: number; button: number }) => void
type ZoomTriggerCb = (payload: { x: number; y: number; scaleFactor: number; displayId: string }) => void
type WheelCb = (payload: { delta: number }) => void

interface HookCallbacks {
  onMouseMove?: MouseMoveCb
  onMouseDown?: MouseDownCb
  onZoomTrigger?: ZoomTriggerCb
  onWheel?: WheelCb
}

let active = false
let cleanup: (() => void) | null = null

export async function startMouseHook(
  cbs: HookCallbacks,
  options: { doubleClickWindowMs?: number } = {}
): Promise<boolean> {
  if (active) return true
  const doubleClickWindowMs = options.doubleClickWindowMs ?? 350

  let mod: typeof import('uiohook-napi') | null = null
  try {
    mod = await import('uiohook-napi')
  } catch (err) {
    console.warn('uiohook-napi load failed:', err)
    return false
  }
  const { uIOhook } = mod

  const handleMouseMove = (e: { x: number; y: number }) => {
    cbs.onMouseMove?.({ x: e.x, y: e.y })
  }
  const handleMouseDown = (e: { x: number; y: number; button: number }) => {
    cbs.onMouseDown?.({ x: e.x, y: e.y, button: e.button })
  }

  // Right-click double-tap: 350ms-window detection. Right button is 2 on
  // libuiohook on Windows; 3 on some configurations — accept both.
  let lastRightUp = 0
  const isRightButton = (b: number) => b === 2 || b === 3
  const handleMouseUp = (e: { x: number; y: number; button: number }) => {
    if (!isRightButton(e.button)) return
    const now = Date.now()
    if (now - lastRightUp <= doubleClickWindowMs) {
      lastRightUp = 0
      const display = screen.getDisplayNearestPoint({ x: e.x, y: e.y })
      cbs.onZoomTrigger?.({
        x: e.x, y: e.y,
        scaleFactor: display.scaleFactor,
        displayId: display.id.toString()
      })
    } else {
      lastRightUp = now
    }
  }

  const handleWheel = (e: { rotation: number }) => {
    cbs.onWheel?.({ delta: e.rotation > 0 ? 1 : -1 })
  }

  try {
    uIOhook.on('mousemove', handleMouseMove)
    uIOhook.on('mousedown', handleMouseDown)
    uIOhook.on('mouseup', handleMouseUp)
    uIOhook.on('wheel', handleWheel)
    uIOhook.start()
    active = true
    cleanup = () => {
      try {
        uIOhook.off('mousemove', handleMouseMove)
        uIOhook.off('mousedown', handleMouseDown)
        uIOhook.off('mouseup', handleMouseUp)
        uIOhook.off('wheel', handleWheel)
        uIOhook.stop()
      } catch (err) {
        console.warn('uiohook teardown error:', err)
      }
      active = false
    }
    return true
  } catch (err) {
    console.warn('[mouse-hook] start failed:', err)
    return false
  }
}

export function stopMouseHook(): void {
  if (cleanup) {
    cleanup()
    cleanup = null
  }
}

export function isMouseHookActive(): boolean {
  return active
}
