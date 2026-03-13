import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { HistoryEntry } from '../../shared/types/history'

const MAX_ENTRIES = 100
const FILE_NAME = 'history.json'

function getFilePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

function readAll(): HistoryEntry[] {
  const filePath = getFilePath()
  if (!existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data
    return []
  } catch {
    return []
  }
}

function writeAll(entries: HistoryEntry[]): void {
  const filePath = getFilePath()
  writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8')
}

export function addHistoryEntry(entry: HistoryEntry): void {
  const entries = readAll()
  entries.unshift(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES
  }
  writeAll(entries)
}

export function getAllHistory(): HistoryEntry[] {
  return readAll()
}

export function deleteHistoryEntry(id: string): void {
  const entries = readAll().filter((e) => e.id !== id)
  writeAll(entries)
}

export function clearHistory(): void {
  writeAll([])
}

export function updateHistoryShareUrl(filePath: string, shareUrl: string): void {
  const entries = readAll()
  const entry = entries.find((e) => e.filePath === filePath)
  if (entry) {
    entry.shareUrl = shareUrl
    writeAll(entries)
  }
}
