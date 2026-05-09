/**
 * Global mouse hook for the recording session — currently only used to
 * push cursor position to the highlighter cursor overlay window. Started
 * when recording begins, stopped when it ends. uiohook-napi is loaded
 * lazily so a missing native binary doesn't crash app startup.
 */

type MouseMoveCb = (payload: { x: number; y: number }) => void
type MouseDownCb = (payload: { x: number; y: number; button: number }) => void

interface HookCallbacks {
  onMouseMove?: MouseMoveCb
  onMouseDown?: MouseDownCb
}

let active = false
let cleanup: (() => void) | null = null

export async function startMouseHook(cbs: HookCallbacks): Promise<boolean> {
  if (active) return true

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

  try {
    uIOhook.on('mousemove', handleMouseMove)
    uIOhook.on('mousedown', handleMouseDown)
    uIOhook.start()
    active = true
    cleanup = () => {
      try {
        uIOhook.off('mousemove', handleMouseMove)
        uIOhook.off('mousedown', handleMouseDown)
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
