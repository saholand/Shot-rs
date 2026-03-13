import { Router } from 'express'
import { getUploadById, deleteUploadById } from '../services/db'
import { getObject, deleteObject } from '../services/storage'
import { downloadLimiter, deleteLimiter } from '../middleware/rate-limit'

const router = Router()

// GET /s/:id — serve file
router.get('/s/:id', downloadLimiter, async (req, res) => {
  try {
    const record = getUploadById(req.params.id)

    if (!record) {
      res.status(404).json({ success: false, error: 'Not found' })
      return
    }

    // Expiry check
    if (record.expires_at < Date.now()) {
      res.status(410).json({ success: false, error: 'This link has expired' })
      return
    }

    const { body, contentType } = await getObject(record.storage_key)

    res.setHeader('Content-Type', contentType || record.mime_type)
    res.setHeader('Content-Disposition', `inline; filename="${record.file_name}"`)
    res.setHeader('Cache-Control', 'public, max-age=86400')

    body.pipe(res)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve file'
    console.error('[file:get] Error:', message)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// DELETE /s/:id?token=... — delete file
router.delete('/s/:id', deleteLimiter, async (req, res) => {
  try {
    const token = req.query.token as string
    if (!token) {
      res.status(400).json({ success: false, error: 'Missing delete token' })
      return
    }

    const record = getUploadById(req.params.id)

    if (!record) {
      res.status(404).json({ success: false, error: 'Not found' })
      return
    }

    if (record.delete_token !== token) {
      res.status(403).json({ success: false, error: 'Invalid delete token' })
      return
    }

    await deleteObject(record.storage_key)
    deleteUploadById(record.id)

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete file'
    console.error('[file:delete] Error:', message)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
