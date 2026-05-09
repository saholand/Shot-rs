/**
 * Auto-update wiring via electron-updater + GitHub Releases.
 *
 * Behavior:
 *   - On app start, ask GitHub for the latest release.
 *   - If a newer version exists, download silently in the background.
 *   - When the download finishes, surface a tray balloon / system
 *     notification: "Update ready — restart to install".
 *
 * The auto-updater is a no-op in development (electron-builder doesn't
 * publish dev builds and `app.isPackaged` is false), so we early-return
 * to avoid spamming GitHub during local iteration.
 *
 * To publish a new release:
 *   1. Bump `version` in package.json
 *   2. `git tag v1.2.3 && git push --tags`
 *   3. The GitHub Actions workflow at `.github/workflows/release.yml`
 *      builds & uploads the installers; users get the update next launch.
 */

import { app, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
import { logError, logInfo } from './logger'

let initialized = false

export function initAutoUpdater(): void {
  if (initialized) return
  initialized = true

  // Don't run in dev — electron-builder yml files only exist in packaged
  // builds and the GitHub repo may not even exist yet for first-time
  // contributors running the project locally.
  if (!app.isPackaged) {
    logInfo('updater', 'skipped: not packaged (dev build)')
    return
  }

  // Pipe updater events to our file logger so users can attach a log if
  // updates aren't reaching them.
  autoUpdater.logger = {
    info: (msg: unknown) => logInfo('updater', String(msg)),
    warn: (msg: unknown) => logInfo('updater', `WARN ${String(msg)}`),
    error: (msg: unknown) => logError('updater', String(msg)),
    debug: () => { /* drop debug noise */ }
  }

  // Quiet auto-download in the background; only surface the result when
  // a real update is ready to install.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    logInfo('updater', `update available: ${info?.version ?? 'unknown'}`)
  })

  autoUpdater.on('update-not-available', () => {
    logInfo('updater', 'no update available')
  })

  autoUpdater.on('error', (err) => {
    // Network failure on launch is common (offline, captive portal).
    // Don't bubble up to the user — log and move on.
    logError('updater', err)
  })

  autoUpdater.on('update-downloaded', (info) => {
    logInfo('updater', `update downloaded: ${info?.version ?? 'unknown'}`)
    try {
      new Notification({
        title: 'Shotırs',
        body: `Yeni sürüm hazır: ${info?.version}. Uygulamayı yeniden başlat.`
      }).show()
    } catch { /* notifications might be off */ }
  })

  // Fire and forget — errors land in the 'error' handler above.
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    logError('updater', err)
  })
}
