import { globalShortcut } from 'electron'
import { getSetting } from './settings-store'
import { DEFAULT_SCREENSHOT_HOTKEY, DEFAULT_RECORDING_HOTKEY, DEFAULT_ANNOTATION_HOTKEY, DEFAULT_OCR_HOTKEY } from '../../shared/constants'

type HotkeyType = 'screenshot' | 'recording' | 'annotation' | 'ocr'

let screenshotCallback: (() => void) | null = null
let recordingCallback: (() => void) | null = null
let annotationCallback: (() => void) | null = null
let ocrCallback: (() => void) | null = null
let currentScreenshotKey: string | null = null
let currentRecordingKey: string | null = null
let currentAnnotationKey: string | null = null
let currentOCRKey: string | null = null

export function registerScreenshotHotkey(callback: () => void): boolean {
  screenshotCallback = callback
  const hotkey = getSetting('screenshotHotkey') || DEFAULT_SCREENSHOT_HOTKEY
  return registerKey(hotkey, callback, 'screenshot')
}

export function registerRecordingHotkey(callback: () => void): boolean {
  recordingCallback = callback
  const hotkey = getSetting('recordingHotkey') || DEFAULT_RECORDING_HOTKEY
  return registerKey(hotkey, callback, 'recording')
}

export function registerAnnotationHotkey(callback: () => void): boolean {
  annotationCallback = callback
  const hotkey = getSetting('annotationHotkey') || DEFAULT_ANNOTATION_HOTKEY
  return registerKey(hotkey, callback, 'annotation')
}

export function registerOCRHotkey(callback: () => void): boolean {
  ocrCallback = callback
  const hotkey = getSetting('ocrHotkey') || DEFAULT_OCR_HOTKEY
  return registerKey(hotkey, callback, 'ocr')
}

function setCurrentKey(type: HotkeyType, hotkey: string): void {
  if (type === 'screenshot') currentScreenshotKey = hotkey
  else if (type === 'recording') currentRecordingKey = hotkey
  else if (type === 'annotation') currentAnnotationKey = hotkey
  else currentOCRKey = hotkey
}

function getCurrentKey(type: HotkeyType): string | null {
  if (type === 'screenshot') return currentScreenshotKey
  if (type === 'recording') return currentRecordingKey
  if (type === 'annotation') return currentAnnotationKey
  return currentOCRKey
}

const MAX_RETRIES = 3

function tryRegister(hotkey: string, callback: () => void, type: HotkeyType): boolean {
  try {
    // If something (possibly us) already holds it, free it first so we
    // don't leak a stale registration when re-binding.
    if (globalShortcut.isRegistered(hotkey)) {
      try { globalShortcut.unregister(hotkey) } catch { /* ignore */ }
    }
    const success = globalShortcut.register(hotkey, callback)
    if (success) {
      setCurrentKey(type, hotkey)
      return true
    }
    return false
  } catch {
    return false
  }
}

function safelog(msg: string): void {
  try { console.warn(msg) } catch { /* EPIPE safe */ }
}

function registerKey(hotkey: string, callback: () => void, type: HotkeyType, attempt = 1): boolean {
  if (tryRegister(hotkey, callback, type)) return true

  if (attempt >= MAX_RETRIES) {
    safelog(`Giving up on ${type} hotkey ${hotkey} after ${attempt} attempts`)
    return false
  }

  // Retry — previous instance or another app may briefly hold the shortcut
  safelog(`Failed to register ${type} hotkey: ${hotkey} — retry ${attempt}/${MAX_RETRIES} in 1s`)
  setTimeout(() => {
    if (!getCurrentKey(type)) {
      registerKey(hotkey, callback, type, attempt + 1)
    }
  }, 1000)
  return false
}

/** Result of a re-register pass — lists hotkeys that failed to bind so
 *  the UI can warn the user (e.g. another app already owns PrintScreen). */
export interface HotkeyRegisterResult {
  failed: { type: HotkeyType; hotkey: string }[]
}

/** Re-register hotkeys after settings change. Returns the list of hotkeys
 *  that failed to register so the renderer can surface a clear warning. */
export function reRegisterHotkeys(): HotkeyRegisterResult {
  // Unregister old keys
  if (currentScreenshotKey) {
    try { globalShortcut.unregister(currentScreenshotKey) } catch { /* ignore */ }
    currentScreenshotKey = null
  }
  if (currentRecordingKey) {
    try { globalShortcut.unregister(currentRecordingKey) } catch { /* ignore */ }
    currentRecordingKey = null
  }
  if (currentAnnotationKey) {
    try { globalShortcut.unregister(currentAnnotationKey) } catch { /* ignore */ }
    currentAnnotationKey = null
  }
  if (currentOCRKey) {
    try { globalShortcut.unregister(currentOCRKey) } catch { /* ignore */ }
    currentOCRKey = null
  }

  const failed: HotkeyRegisterResult['failed'] = []

  // Re-register with new settings. Capture failures synchronously — the
  // retry timer in registerKey doesn't help us here because the renderer
  // is waiting on the IPC reply.
  if (screenshotCallback) {
    const key = getSetting('screenshotHotkey') || DEFAULT_SCREENSHOT_HOTKEY
    if (!tryRegister(key, screenshotCallback, 'screenshot')) failed.push({ type: 'screenshot', hotkey: key })
  }
  if (recordingCallback) {
    const key = getSetting('recordingHotkey') || DEFAULT_RECORDING_HOTKEY
    if (!tryRegister(key, recordingCallback, 'recording')) failed.push({ type: 'recording', hotkey: key })
  }
  if (annotationCallback) {
    const key = getSetting('annotationHotkey') || DEFAULT_ANNOTATION_HOTKEY
    if (!tryRegister(key, annotationCallback, 'annotation')) failed.push({ type: 'annotation', hotkey: key })
  }
  if (ocrCallback) {
    const key = getSetting('ocrHotkey') || DEFAULT_OCR_HOTKEY
    if (!tryRegister(key, ocrCallback, 'ocr')) failed.push({ type: 'ocr', hotkey: key })
  }

  return { failed }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  currentScreenshotKey = null
  currentRecordingKey = null
  currentAnnotationKey = null
  currentOCRKey = null
}
