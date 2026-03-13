import { desktopCapturer } from 'electron'
import type { DesktopSource } from '../../shared/types/ipc'

const THUMBNAIL_SIZE = { width: 320, height: 180 }

export async function getAvailableSources(): Promise<DesktopSource[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: THUMBNAIL_SIZE,
      fetchWindowIcons: false
    })

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnailDataUrl: source.thumbnail.toDataURL()
    }))
  } catch (err) {
    console.error('Failed to get sources:', err)
    return []
  }
}
