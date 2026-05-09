/**
 * Centralized save-dialog helper for video & image exports.
 *
 * Multiple IPC handlers (recording save, recording recover, trim save,
 * screenshot export) used to construct identical dialog options
 * inline — title, defaultPath, filter list — diverging slightly each
 * time. Now they all go through `buildVideoDialog` / `buildImageDialog`
 * so the single source of truth is here.
 *
 * Side benefit: all handlers automatically pick up `resolveDefaultSavePath`
 * (which silently falls back when the user's saved folder no longer
 * exists) without each call site having to remember.
 */

import { dialog, BrowserWindow } from 'electron'
import { getSettings, resolveDefaultSavePath } from './settings-store'
import { resolveFileName } from '../../shared/types/settings'
import { tMain } from './i18n-main'

type VideoExt = 'mp4' | 'webm'

export interface DialogResult {
  canceled: boolean
  filePath?: string
}

function videoExtFromMime(mimeType?: string): VideoExt {
  return mimeType?.includes('mp4') ? 'mp4' : 'webm'
}

async function showSaveDialog(
  parent: BrowserWindow | null,
  options: Electron.SaveDialogOptions
): Promise<DialogResult> {
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  return { canceled: result.canceled, filePath: result.filePath }
}

/**
 * Open a save dialog for a recording (mp4 or webm). `titleKey` chooses
 * which i18n title to use — typically `'dialog.saveRecording'` but the
 * recovery flow uses `'dialog.recoverRecording'` and trim uses
 * `'dialog.trimAndSave'`.
 */
export async function buildVideoDialog(
  parent: BrowserWindow | null,
  mimeType: string | undefined,
  titleKey: 'dialog.saveRecording' | 'dialog.recoverRecording' | 'dialog.trimAndSave' = 'dialog.saveRecording'
): Promise<DialogResult> {
  const settings = getSettings()
  const ext = videoExtFromMime(mimeType)
  const filterName = ext === 'mp4' ? 'MP4 Video' : 'WebM Video'
  const fileName = resolveFileName(settings.recordingFileNameFormat, ext)
  const defaultPath = resolveDefaultSavePath(fileName)
  return showSaveDialog(parent, {
    title: tMain(titleKey),
    defaultPath,
    filters: [{ name: filterName, extensions: [ext] }]
  })
}

/** Variant for trim, which already knows the input's extension. */
export async function buildVideoDialogForExt(
  parent: BrowserWindow | null,
  ext: VideoExt,
  titleKey: 'dialog.saveRecording' | 'dialog.recoverRecording' | 'dialog.trimAndSave' = 'dialog.trimAndSave'
): Promise<DialogResult> {
  const settings = getSettings()
  const filterName = ext === 'mp4' ? 'MP4 Video' : 'WebM Video'
  const fileName = resolveFileName(settings.recordingFileNameFormat, ext)
  const defaultPath = resolveDefaultSavePath(fileName)
  return showSaveDialog(parent, {
    title: tMain(titleKey),
    defaultPath,
    filters: [{ name: filterName, extensions: [ext] }]
  })
}

/** Save dialog for PNG screenshots. */
export async function buildScreenshotDialog(parent: BrowserWindow | null): Promise<DialogResult> {
  const settings = getSettings()
  const fileName = resolveFileName(settings.screenshotFileNameFormat, 'png')
  const defaultPath = resolveDefaultSavePath(fileName)
  return showSaveDialog(parent, {
    title: tMain('dialog.saveScreenshot'),
    defaultPath,
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  })
}
