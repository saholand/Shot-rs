/**
 * Renderer-process global error guard. Catches uncaught synchronous errors
 * and unhandled promise rejections so a single bug doesn't blank-page the
 * window and leave the user staring at nothing.
 *
 * Logs go to:
 *  - the renderer console (visible in dev tools)
 *  - main's file logger (userData/logs/app.log) so packaged-app crashes
 *    leave a breadcrumb the user can attach to a bug report
 *
 * We deliberately *don't* re-throw — the renderer should keep running so
 * the user can interact with anything that still works.
 *
 * Call once from each renderer entry point (`main.tsx`, `overlay.tsx`, etc.).
 */
function formatForLog(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`
  if (typeof value === 'object' && value !== null) {
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

export function installRendererErrorHandlers(scope: string): void {
  window.addEventListener('error', (event) => {
    const err = event.error ?? event.message
    console.error(`[${scope}] window.error:`, err)
    // Bridge to main's file logger. Optional chaining: not every renderer
    // window exposes electronAPI (the webcam preload is the same bundle,
    // but a future per-window preload split shouldn't break the handler).
    try { window.electronAPI?.log?.error(scope, formatForLog(err)) } catch { /* ignore */ }
  })

  window.addEventListener('unhandledrejection', (event) => {
    console.error(`[${scope}] unhandledrejection:`, event.reason)
    try { window.electronAPI?.log?.error(scope, formatForLog(event.reason)) } catch { /* ignore */ }
  })
}
