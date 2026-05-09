import { desktopCapturer } from 'electron'
import type { DesktopSource } from '../../shared/types/ipc'

const THUMBNAIL_SIZE = { width: 320, height: 180 }

/**
 * System UI surfaces that desktopCapturer reports but that aren't useful
 * recording targets — they either fail when handed to getUserMedia or
 * just confuse the picker. Match case-insensitively against the source
 * name (which is a localized window title, but these names are stable
 * enough on Windows).
 */
const NOISY_NAMES = [
  /^program manager$/i,
  /^task switching$/i,
  /^searchapp$/i,
  /^cortana$/i,
  /^windows shell experience host$/i,
  /^startmenuexperiencehost$/i,
  /^widgets$/i,
  /^xboxgamebar/i
]

function isNoisyWindow(name: string): boolean {
  return NOISY_NAMES.some(re => re.test(name))
}

export async function getAvailableSources(): Promise<DesktopSource[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: THUMBNAIL_SIZE,
      fetchWindowIcons: false
    })

    return sources
      .filter(s => {
        // Always keep screen sources
        if (s.id.startsWith('screen:')) return true
        // Drop empty-thumbnail windows (minimized / not yet rendered)
        if (s.thumbnail.isEmpty()) return false
        return !isNoisyWindow(s.name)
      })
      .map(source => ({
        id: source.id,
        name: source.name,
        thumbnailDataUrl: source.thumbnail.toDataURL()
      }))
  } catch (err) {
    console.error('Failed to get sources:', err)
    return []
  }
}
