import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'

const FILE_NAME = 'settings.json'

function getFilePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

let cached: AppSettings | null = null

export function getSettings(): AppSettings {
  if (cached) return cached
  const filePath = getFilePath()
  if (!existsSync(filePath)) {
    cached = { ...DEFAULT_SETTINGS }
    return cached
  }
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    cached = { ...DEFAULT_SETTINGS, ...data }
    return cached!
  } catch {
    cached = { ...DEFAULT_SETTINGS }
    return cached
  }
}

export function saveSettings(settings: AppSettings): void {
  cached = { ...settings }
  const filePath = getFilePath()
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return getSettings()[key]
}
