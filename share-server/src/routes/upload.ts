import { Router } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { validateUpload } from '../middleware/validate'
import { uploadLimiter } from '../middleware/rate-limit'
import { putObject } from '../services/storage'
import { insertUpload } from '../services/db'
import type { UploadResponse } from '../types'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }  // 100 MB global max
})

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200)
}

router.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  validateUpload,
  async (req, res) => {
    try {
      const file = req.file!
      const fileType = req.body.fileType as 'screenshot' | 'recording'
      const rawName = req.body.fileName || file.originalname || `file-${Date.now()}`
      const fileName = sanitizeFileName(rawName)

      const id = uuidv4()
      const deleteToken = uuidv4()
      const storageKey = `uploads/${id}/${fileName}`
      const mimeType = fileType === 'screenshot' ? 'image/png' : 'video/webm'
      const now = Date.now()

      await putObject(storageKey, file.buffer, mimeType)

      insertUpload({
        id,
        storage_key: storageKey,
        file_name: fileName,
        file_type: fileType,
        mime_type: mimeType,
        size_bytes: file.size,
        delete_token: deleteToken,
        created_at: now,
        expires_at: now + SEVEN_DAYS_MS
      })

      const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3500}`

      const response: UploadResponse = {
        success: true,
        id,
        url: `${publicUrl}/s/${id}`,
        deleteToken,
        expiresAt: now + SEVEN_DAYS_MS
      }

      res.status(201).json(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      console.error('[upload] Error:', message)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
)

export default router
