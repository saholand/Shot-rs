import 'dotenv/config'
import express from 'express'
import { initDB } from './services/db'
import { initStorage } from './services/storage'
import { startCleanupInterval } from './services/cleanup'
import uploadRouter from './routes/upload'
import fileRouter from './routes/file'

const app = express()
const PORT = parseInt(process.env.PORT || '3500', 10)

// Init services
initDB()
initStorage()
startCleanupInterval()

// Routes
app.use(uploadRouter)
app.use(fileRouter)

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() })
})

app.listen(PORT, () => {
  console.log(`[share-server] Listening on port ${PORT}`)
})
