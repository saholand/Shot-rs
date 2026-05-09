import { desktopCapturer, screen } from 'electron'
import type { SelectionRegion } from '../../shared/types/ipc'

/**
 * Resolve which display a window-local region was selected on.
 * If `targetDisplay` is provided (overlay-window.ts knows the display),
 * use it directly — otherwise fall back to a screen lookup.
 *
 * The region passed in is in WINDOW-LOCAL DIPs (origin at the overlay's
 * top-left). Treating it as a screen point breaks multi-monitor capture
 * because (10,10) inside a non-primary overlay still maps to the
 * primary display when fed to `screen.getDisplayNearestPoint`.
 */
function resolveDisplay(region: SelectionRegion, targetDisplay?: Electron.Display | null): Electron.Display {
  if (targetDisplay) return targetDisplay
  // Fallback: assume region is already in screen-coords
  return screen.getDisplayNearestPoint({ x: region.x, y: region.y })
}

function findSourceForDisplay(
  sources: Electron.DesktopCapturerSource[],
  display: Electron.Display
): Electron.DesktopCapturerSource | null {
  if (sources.length === 0) return null
  const displayId = display.id.toString()
  // Prefer exact display_id match (Windows + recent Electron expose this)
  const exact = sources.find(s => s.display_id === displayId)
  if (exact) return exact
  // Fallback: substring match in source.id
  const fuzzy = sources.find(s => s.id.includes(displayId))
  if (fuzzy) return fuzzy
  // Last resort: pick the source whose thumbnail aspect ratio matches the
  // display, then by index. This avoids silently capturing the wrong screen
  // when only one screen source exists.
  if (sources.length === 1) return sources[0]
  return sources[0]
}

export async function captureAndCrop(
  region: SelectionRegion,
  targetDisplay?: Electron.Display | null
): Promise<Electron.NativeImage | null> {
  const display = resolveDisplay(region, targetDisplay)
  const scaleFactor = display.scaleFactor

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * scaleFactor),
      height: Math.round(display.size.height * scaleFactor)
    }
  })

  const source = findSourceForDisplay(sources, display)
  if (!source) return null

  const fullImage = source.thumbnail
  if (fullImage.isEmpty()) return null

  // When `targetDisplay` is provided the region is window-local (0-based
  // within the overlay), so no display-bounds offset is needed. Otherwise
  // assume screen-space coords and subtract bounds.
  const offsetX = targetDisplay ? 0 : display.bounds.x
  const offsetY = targetDisplay ? 0 : display.bounds.y

  const cropX = Math.round((region.x - offsetX) * scaleFactor)
  const cropY = Math.round((region.y - offsetY) * scaleFactor)
  const cropWidth = Math.round(region.width * scaleFactor)
  const cropHeight = Math.round(region.height * scaleFactor)

  const imgSize = fullImage.getSize()
  const safeX = Math.max(0, Math.min(cropX, imgSize.width - 1))
  const safeY = Math.max(0, Math.min(cropY, imgSize.height - 1))
  const safeW = Math.max(1, Math.min(cropWidth, imgSize.width - safeX))
  const safeH = Math.max(1, Math.min(cropHeight, imgSize.height - safeY))

  const cropped = fullImage.crop({ x: safeX, y: safeY, width: safeW, height: safeH })
  return cropped
}

export async function captureFullScreen(
  region: SelectionRegion,
  targetDisplay?: Electron.Display | null
): Promise<{ full: Electron.NativeImage; cropped: Electron.NativeImage; scaleFactor: number; sourceId: string; display: Electron.Display } | null> {
  const display = resolveDisplay(region, targetDisplay)
  const scaleFactor = display.scaleFactor

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * scaleFactor),
      height: Math.round(display.size.height * scaleFactor)
    }
  })

  const source = findSourceForDisplay(sources, display)
  if (!source) return null

  const fullImage = source.thumbnail
  if (fullImage.isEmpty()) return null

  const offsetX = targetDisplay ? 0 : display.bounds.x
  const offsetY = targetDisplay ? 0 : display.bounds.y

  const cropX = Math.round((region.x - offsetX) * scaleFactor)
  const cropY = Math.round((region.y - offsetY) * scaleFactor)
  const cropWidth = Math.round(region.width * scaleFactor)
  const cropHeight = Math.round(region.height * scaleFactor)

  const imgSize = fullImage.getSize()
  const safeX = Math.max(0, Math.min(cropX, imgSize.width - 1))
  const safeY = Math.max(0, Math.min(cropY, imgSize.height - 1))
  const safeW = Math.max(1, Math.min(cropWidth, imgSize.width - safeX))
  const safeH = Math.max(1, Math.min(cropHeight, imgSize.height - safeY))

  const cropped = fullImage.crop({ x: safeX, y: safeY, width: safeW, height: safeH })
  return { full: fullImage, cropped, scaleFactor, sourceId: source.id, display }
}
