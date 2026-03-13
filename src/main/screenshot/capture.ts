import { desktopCapturer, screen } from 'electron'
import type { SelectionRegion } from '../../shared/types/ipc'

export async function captureAndCrop(region: SelectionRegion): Promise<Electron.NativeImage | null> {
  const cursorDisplay = screen.getDisplayNearestPoint({ x: region.x, y: region.y })
  const scaleFactor = cursorDisplay.scaleFactor

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: cursorDisplay.size.width * scaleFactor,
      height: cursorDisplay.size.height * scaleFactor
    }
  })

  if (sources.length === 0) return null

  // Find the source matching the display
  const source = sources.find(s => {
    const displayId = cursorDisplay.id.toString()
    return s.display_id === displayId || s.id.includes(displayId)
  }) || sources[0]

  const fullImage = source.thumbnail
  if (fullImage.isEmpty()) return null

  // Convert logical coordinates to physical pixels for crop
  // Adjust for display offset (multi-monitor)
  const displayBounds = cursorDisplay.bounds
  const cropX = Math.round((region.x - displayBounds.x) * scaleFactor)
  const cropY = Math.round((region.y - displayBounds.y) * scaleFactor)
  const cropWidth = Math.round(region.width * scaleFactor)
  const cropHeight = Math.round(region.height * scaleFactor)

  const imgSize = fullImage.getSize()
  const cropped = fullImage.crop({
    x: Math.max(0, cropX),
    y: Math.max(0, cropY),
    width: Math.min(cropWidth, imgSize.width - Math.max(0, cropX)),
    height: Math.min(cropHeight, imgSize.height - Math.max(0, cropY))
  })

  return cropped
}

export async function captureFullScreen(region: SelectionRegion): Promise<{ full: Electron.NativeImage; cropped: Electron.NativeImage; scaleFactor: number } | null> {
  const cursorDisplay = screen.getDisplayNearestPoint({ x: region.x, y: region.y })
  const scaleFactor = cursorDisplay.scaleFactor

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: cursorDisplay.size.width * scaleFactor,
      height: cursorDisplay.size.height * scaleFactor
    }
  })

  if (sources.length === 0) return null

  const source = sources.find(s => {
    const displayId = cursorDisplay.id.toString()
    return s.display_id === displayId || s.id.includes(displayId)
  }) || sources[0]

  const fullImage = source.thumbnail
  if (fullImage.isEmpty()) return null

  const displayBounds = cursorDisplay.bounds
  const cropX = Math.round((region.x - displayBounds.x) * scaleFactor)
  const cropY = Math.round((region.y - displayBounds.y) * scaleFactor)
  const cropWidth = Math.round(region.width * scaleFactor)
  const cropHeight = Math.round(region.height * scaleFactor)

  const imgSize = fullImage.getSize()
  const cropped = fullImage.crop({
    x: Math.max(0, cropX),
    y: Math.max(0, cropY),
    width: Math.min(cropWidth, imgSize.width - Math.max(0, cropX)),
    height: Math.min(cropHeight, imgSize.height - Math.max(0, cropY))
  })

  return { full: fullImage, cropped, scaleFactor }
}
