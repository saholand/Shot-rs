export interface AppSettings {
  closeToTray: boolean
  quickRecordEnabled: boolean
  defaultSaveDir: string
  screenshotFileNameFormat: string
  recordingFileNameFormat: string
  uploadServerUrl: string
  screenshotHotkey: string
  recordingHotkey: string
  annotationHotkey: string
  ocrHotkey: string
  language: 'tr' | 'en'
  /** Magnifier loupe shown during selection. Off by default; user can
   *  override on-the-fly by holding Shift while selecting. */
  magnifierEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  closeToTray: true,
  quickRecordEnabled: false,
  defaultSaveDir: '',
  screenshotFileNameFormat: 'screenshot-{timestamp}',
  recordingFileNameFormat: 'recording-{timestamp}',
  uploadServerUrl: '',
  screenshotHotkey: 'PrintScreen',
  recordingHotkey: 'CommandOrControl+Alt+R',
  annotationHotkey: 'CommandOrControl+Shift+D',
  ocrHotkey: 'CommandOrControl+Shift+O',
  language: 'tr',
  magnifierEnabled: false
}

/**
 * Supported placeholders:
 *   {timestamp} → Date.now()
 *   {date}      → YYYY-MM-DD
 *   {time}      → HH-MM-SS
 */
export function resolveFileName(format: string, extension: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

  const resolved = format
    .replace(/\{timestamp\}/g, String(Date.now()))
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)

  return `${resolved}.${extension}`
}
