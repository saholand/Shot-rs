export type VideoFormat = 'webm' | 'mp4'
export type VideoQuality = 'low' | 'medium' | 'high' | 'ultra'
export type VideoFramerate = 24 | 30 | 60
export type MagnifierZoom = 'low' | 'medium' | 'high'
export type HighlighterThickness = 'small' | 'medium' | 'large'

/** Diameter (in screen pixels at 1× DPI) of the highlighter cursor disc. */
export const HIGHLIGHTER_DIAMETER: Record<HighlighterThickness, number> = {
  small: 24,
  medium: 40,
  large: 64
}

/** Bitrate (bps) for each quality preset. */
export const VIDEO_BITRATE: Record<VideoQuality, number> = {
  low: 1_500_000,
  medium: 2_500_000,
  high: 5_000_000,
  ultra: 8_000_000
}

/** Pixel-radius sampled around the cursor for the magnifier loupe.
 *  Lower radius = more zoom = less context. */
export const MAGNIFIER_RADIUS: Record<MagnifierZoom, number> = {
  low: 18,
  medium: 14,
  high: 10
}

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
  magnifierZoom: MagnifierZoom

  // ── Recording params ──
  videoFormat: VideoFormat
  videoQuality: VideoQuality
  videoFramerate: VideoFramerate
  /** Capture system audio (desktop loopback) alongside mic. Windows-only;
   *  silently no-ops on platforms that don't expose loopback. */
  recordSystemAudio: boolean
  /** Auto-stop the recording after this many seconds. null = no limit. */
  recordingMaxDurationSec: number | null

  // ── Highlighter cursor ──
  highlighterCursorEnabled: boolean
  highlighterCursorThickness: HighlighterThickness

  // ── Click ripple ──
  clickRippleEnabled: boolean
  clickRippleColor: string
  clickRippleSize: 'small' | 'medium' | 'large'

  // ── Cursor spotlight ──
  cursorSpotlightEnabled: boolean
  cursorSpotlightRadius: 'small' | 'medium' | 'large'
  cursorSpotlightDim: 'low' | 'medium' | 'high'

  // ── Webcam PIP ──
  webcamEnabled: boolean
  webcamDeviceId: string | null
  /** Free-form bounds (in screen pixels) for the webcam preview window.
   *  null = use a default position/size on first show. */
  webcamBounds: { x: number; y: number; w: number; h: number } | null
  webcamShape: 'circle' | 'rounded'
  // Legacy preset fields kept for migration / quick-select; the bounds
  // above override them when present.
  webcamPosition: 'tl' | 'tr' | 'bl' | 'br'
  webcamSize: 'small' | 'medium' | 'large'

  // ── Click-to-zoom (toolbar tool) ──
  /** Always-on flag — when true, the canvas pipeline is enabled so the
   *  zoom tool's clicks have a transform target. Off by default to keep
   *  the fast path (direct desktopStream → MediaRecorder) for users who
   *  don't use zoom. */
  zoomEnabled: boolean
  /** Default level the toolbar starts at when the user enters zoom mode. */
  zoomDefaultLevel: number
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
  magnifierEnabled: false,
  magnifierZoom: 'medium',
  videoFormat: 'webm',
  videoQuality: 'medium',
  videoFramerate: 30,
  recordSystemAudio: false,
  recordingMaxDurationSec: null,
  highlighterCursorEnabled: false,
  highlighterCursorThickness: 'medium',
  clickRippleEnabled: false,
  clickRippleColor: '#4fa3f7',
  clickRippleSize: 'medium',
  cursorSpotlightEnabled: false,
  cursorSpotlightRadius: 'medium',
  cursorSpotlightDim: 'medium',
  webcamEnabled: false,
  webcamDeviceId: null,
  webcamBounds: null,
  webcamShape: 'circle',
  webcamPosition: 'br',
  webcamSize: 'medium',
  zoomEnabled: false,
  zoomDefaultLevel: 2
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
