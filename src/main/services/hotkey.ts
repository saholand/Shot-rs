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

function tryRegister(hotkey: string, callback: () => void, type: HotkeyType): boolean {
  try {
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

function registerKey(hotkey: string, callback: () => void, type: HotkeyType): boolean {
  if (tryRegister(hotkey, callback, type)) return true

  // Retry — previous instance may still hold the shortcut
  safelog(`Failed to register ${type} hotkey: ${hotkey} — retrying in 1s`)
  setTimeout(() => {
    if (!getCurrentKey(type)) {
      if (!tryRegister(hotkey, callback, type)) {
        safelog(`Retry failed: ${type} hotkey ${hotkey}`)
      }
    }
  }, 1000)
  return false
}

/** Re-register hotkeys after settings change */
export function reRegisterHotkeys(): void {
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

  // Re-register with new settings
  if (screenshotCallback) {
    const key = getSetting('screenshotHotkey') || DEFAULT_SCREENSHOT_HOTKEY
    registerKey(key, screenshotCallback, 'screenshot')
  }
  if (recordingCallback) {
    const key = getSetting('recordingHotkey') || DEFAULT_RECORDING_HOTKEY
    registerKey(key, recordingCallback, 'recording')
  }
  if (annotationCallback) {
    const key = getSetting('annotationHotkey') || DEFAULT_ANNOTATION_HOTKEY
    registerKey(key, annotationCallback, 'annotation')
  }
  if (ocrCallback) {
    const key = getSetting('ocrHotkey') || DEFAULT_OCR_HOTKEY
    registerKey(key, ocrCallback, 'ocr')
  }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  currentScreenshotKey = null
  currentRecordingKey = null
  currentAnnotationKey = null
  currentOCRKey = null
}
