import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { UploadRecord } from '../types'

const DATA_DIR = join(__dirname, '../../data')
const DB_PATH = join(DATA_DIR, 'uploads.json')

let records: UploadRecord[] = []

export function initDB(): void {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(DB_PATH)) {
    try {
      const raw = readFileSync(DB_PATH, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) records = data
    } catch {
      records = []
    }
  }
}

function persist(): void {
  writeFileSync(DB_PATH, JSON.stringify(records, null, 2), 'utf-8')
}

export function insertUpload(record: UploadRecord): void {
  records.push(record)
  persist()
}

export function getUploadById(id: string): UploadRecord | undefined {
  return records.find((r) => r.id === id)
}

export function deleteUploadById(id: string): void {
  records = records.filter((r) => r.id !== id)
  persist()
}

export function getExpiredUploads(): UploadRecord[] {
  const now = Date.now()
  return records.filter((r) => r.expires_at < now)
}

export function deleteExpiredUploads(): void {
  const now = Date.now()
  records = records.filter((r) => r.expires_at >= now)
  persist()
}
