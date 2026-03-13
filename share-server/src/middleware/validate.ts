import type { Request, Response, NextFunction } from 'express'

const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024   // 10 MB
const MAX_RECORDING_SIZE = 100 * 1024 * 1024    // 100 MB

// PNG: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
// WebM (EBML header): 1A 45 DF A3
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])

function checkMagicBytes(buffer: Buffer, fileType: string): boolean {
  if (fileType === 'screenshot') {
    if (buffer.length < PNG_MAGIC.length) return false
    return buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
  }
  if (fileType === 'recording') {
    if (buffer.length < WEBM_MAGIC.length) return false
    return buffer.subarray(0, WEBM_MAGIC.length).equals(WEBM_MAGIC)
  }
  return false
}

export function validateUpload(req: Request, res: Response, next: NextFunction): void {
  const file = req.file
  const fileType = req.body.fileType as string

  if (!file) {
    res.status(400).json({ success: false, error: 'No file provided' })
    return
  }

  if (!fileType || (fileType !== 'screenshot' && fileType !== 'recording')) {
    res.status(400).json({ success: false, error: 'Invalid fileType. Must be "screenshot" or "recording"' })
    return
  }

  // Size check
  const maxSize = fileType === 'screenshot' ? MAX_SCREENSHOT_SIZE : MAX_RECORDING_SIZE
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024)
    res.status(413).json({ success: false, error: `File too large. Max ${limitMB} MB for ${fileType}` })
    return
  }

  // Magic bytes check
  if (!checkMagicBytes(file.buffer, fileType)) {
    const expected = fileType === 'screenshot' ? 'PNG' : 'WebM'
    res.status(400).json({ success: false, error: `Invalid file content. Expected ${expected} format` })
    return
  }

  next()
}
