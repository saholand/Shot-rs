/**
 * Lightweight production logger. Writes to <userData>/logs/app.log so the
 * user can attach it to a bug report — by default the renderer/main only
 * print to stderr, which is invisible in a packaged app.
 *
 * Rotation: when the log exceeds MAX_BYTES the file is renamed to
 * `app.log.old` (overwriting any previous rollover) and a fresh one is
 * started. We keep one rollover, not a multi-file ring; this is a desktop
 * app, not a server.
 *
 * No external deps — `fs.appendFileSync` is fast enough for the volume
 * we expect (errors only, not info/debug).
 */

import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync, statSync, renameSync, appendFileSync } from 'fs'

const MAX_BYTES = 1 * 1024 * 1024 // 1 MB before rollover
let logPath: string | null = null

function getLogPath(): string {
  if (logPath) return logPath
  const dir = join(app.getPath('userData'), 'logs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  logPath = join(dir, 'app.log')
  return logPath
}

function rotateIfNeeded(path: string): void {
  try {
    if (!existsSync(path)) return
    const size = statSync(path).size
    if (size < MAX_BYTES) return
    const old = `${path}.old`
    try { renameSync(path, old) } catch { /* ignore */ }
  } catch { /* ignore — never let the logger crash the app */ }
}

function writeLine(level: 'INFO' | 'WARN' | 'ERROR', scope: string, message: string): void {
  try {
    const path = getLogPath()
    rotateIfNeeded(path)
    const line = `${new Date().toISOString()} [${level}] [${scope}] ${message}\n`
    appendFileSync(path, line, 'utf-8')
  } catch { /* ignore — logging must never throw */ }
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? ''}`
  if (typeof arg === 'object') {
    try { return JSON.stringify(arg) } catch { return String(arg) }
  }
  return String(arg)
}

export function logInfo(scope: string, ...args: unknown[]): void {
  writeLine('INFO', scope, args.map(formatArg).join(' '))
}

export function logWarn(scope: string, ...args: unknown[]): void {
  writeLine('WARN', scope, args.map(formatArg).join(' '))
}

export function logError(scope: string, ...args: unknown[]): void {
  writeLine('ERROR', scope, args.map(formatArg).join(' '))
}

/** Returns the absolute path of the current log file (for "show in folder"). */
export function getLogFilePath(): string {
  return getLogPath()
}
