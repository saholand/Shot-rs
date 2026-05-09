import { useState, useEffect } from 'react'
import type { HistoryEntry } from '../../shared/types/history'
import { videoToGif } from '../utils/gif-encoder'
import { TrimEditor } from '../trim/TrimEditor'
import { useTranslation } from '../hooks/useTranslation'
import { t as i18nT } from '../../shared/i18n'

interface Props {
  onBack: () => void
}

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'info'
}

type Filter = 'all' | 'screenshot' | 'recording'

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return i18nT('history.timeJustNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return i18nT('history.timeMinutes', { count: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return i18nT('history.timeHours', { count: hr })
  const day = Math.floor(hr / 24)
  if (day === 1) return i18nT('history.timeYesterday')
  if (day < 30) return i18nT('history.timeDays', { count: day })
  const month = Math.floor(day / 30)
  if (month < 12) return i18nT('history.timeMonths', { count: month })
  return i18nT('history.timeYears', { count: Math.floor(month / 12) })
}

function fullDate(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// SVG icons as components
const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M8 5V3h8v2" />
  </svg>
)

const IconVideo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </svg>
)

const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const IconFolder = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
)

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" />
  </svg>
)

const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
)

const IconShare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
)

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)

const IconGif = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold" fontFamily="sans-serif">GIF</text>
  </svg>
)

const IconScissors = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

const IconLoading = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
)

export function HistoryPanel({ onBack }: Props) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmClear, setConfirmClear] = useState(false)
  const [gifExportingId, setGifExportingId] = useState<string | null>(null)
  const [gifProgress, setGifProgress] = useState(0)
  const [trimEntry, setTrimEntry] = useState<HistoryEntry | null>(null)

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.history.getAll()
      setEntries(data)
    } catch {
      setStatus({ text: t('history.loadFailed'), type: 'error' })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Auto-dismiss status after 3s
  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), 3000)
    return () => clearTimeout(timer)
  }, [status])

  const handleOpen = async (entry: HistoryEntry) => {
    const result = await window.electronAPI.history.openFile(entry.filePath)
    if (!result.success) {
      setStatus({ text: result.error || t('history.fileOpenFailed'), type: 'error' })
    }
  }

  const handleCopyToClipboard = async (entry: HistoryEntry) => {
    if (entry.type !== 'screenshot') return
    const result = await window.electronAPI.history.copyFile(entry.filePath)
    if (result.success) {
      setStatus({ text: t('history.copiedToClipboard'), type: 'success' })
    } else {
      setStatus({ text: result.error || t('history.copyFailed'), type: 'error' })
    }
  }

  const handleShowInFolder = (entry: HistoryEntry) => {
    window.electronAPI.history.showInFolder(entry.filePath)
  }

  const handleDelete = async (entry: HistoryEntry) => {
    await window.electronAPI.history.deleteEntry(entry.id)
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
  }

  const handleShare = async (entry: HistoryEntry) => {
    setUploadingId(entry.id)
    setStatus(null)
    try {
      const result = await window.electronAPI.upload.file(entry.filePath, entry.type)
      if (result.success && result.url) {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, shareUrl: result.url } : e))
        )
        setStatus({ text: t('history.linkCopied'), type: 'success' })
      } else {
        setStatus({ text: result.error || t('history.uploadFailed'), type: 'error' })
      }
    } catch {
      setStatus({ text: t('history.uploadFailed'), type: 'error' })
    }
    setUploadingId(null)
  }

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setStatus({ text: t('history.linkCopied'), type: 'success' })
  }

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    await window.electronAPI.history.clear()
    setEntries([])
    setConfirmClear(false)
    setStatus({ text: t('history.cleared'), type: 'info' })
  }

  const handleGifExport = async (entry: HistoryEntry) => {
    setGifExportingId(entry.id)
    setGifProgress(0)
    setStatus(null)
    try {
      // Use custom protocol URL to bypass Electron's blob URL security check
      const mediaUrl = `local-media:///${entry.filePath.replace(/\\/g, '/')}`

      // Convert to GIF
      const gifData = await videoToGif(mediaUrl, { maxWidth: 480, fps: 10, maxDuration: 15 }, (pct) => {
        setGifProgress(pct)
      })

      // Save GIF file
      const gifName = entry.fileName.replace(/\.[^.]+$/, '.gif')
      const result = await window.electronAPI.history.saveBuffer(gifData.buffer, gifName)

      if (result.success) {
        setStatus({ text: t('history.gifSaved'), type: 'success' })
      } else if (result.error === 'İptal edildi') {
        setStatus({ text: t('history.gifCancelled'), type: 'info' })
      } else {
        setStatus({ text: result.error || t('history.gifError'), type: 'error' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('gif.unknown')
      console.error('GIF export error:', err)
      setStatus({ text: `${t('history.gifError')}: ${msg}`, type: 'error' })
    }
    setGifExportingId(null)
    setGifProgress(0)
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter)

  const screenshotCount = entries.filter(e => e.type === 'screenshot').length
  const recordingCount = entries.filter(e => e.type === 'recording').length

  return (
    <div className="panel history-panel">
      {/* Toolbar: filters + clear */}
      <div className="history-toolbar">
        <div className="history-filters">
          <button
            className={`history-filter-btn ${filter === 'all' ? 'history-filter-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('history.all')} ({entries.length})
          </button>
          <button
            className={`history-filter-btn ${filter === 'screenshot' ? 'history-filter-active' : ''}`}
            onClick={() => setFilter('screenshot')}
          >
            <IconCamera /> ({screenshotCount})
          </button>
          <button
            className={`history-filter-btn ${filter === 'recording' ? 'history-filter-active' : ''}`}
            onClick={() => setFilter('recording')}
          >
            <IconVideo /> ({recordingCount})
          </button>
        </div>
        {entries.length > 0 && (
          <button
            className={`history-clear-btn ${confirmClear ? 'history-clear-confirm' : ''}`}
            onClick={handleClearAll}
            onBlur={() => setConfirmClear(false)}
          >
            {confirmClear ? t('history.confirmClear') : t('history.clear')}
          </button>
        )}
      </div>

      {/* Status message */}
      {status && (
        <p className={`status-msg status-${status.type}`}>{status.text}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="history-loading">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="history-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M8 5V3h8v2" />
          </svg>
          <span className="history-empty-title">
            {filter === 'all' ? t('history.emptyAll') : filter === 'screenshot' ? t('history.emptyScreenshot') : t('history.emptyRecording')}
          </span>
          <span className="history-empty-desc">
            {filter === 'all' ? t('history.emptyDesc') : t('history.emptyCategoryDesc')}
          </span>
        </div>
      )}

      {/* History list */}
      {!loading && filtered.length > 0 && (
        <div className="history-list">
          {filtered.map((entry) => (
            <div key={entry.id} className="history-item" onDoubleClick={() => handleOpen(entry)}>
              <div className="history-thumb">
                {entry.thumbnailDataUrl ? (
                  <img src={entry.thumbnailDataUrl} alt="" />
                ) : (
                  <span className="history-type-icon">
                    {entry.type === 'screenshot' ? <IconCamera /> : <IconVideo />}
                  </span>
                )}
              </div>
              <div className="history-info">
                <span className="history-filename">{entry.fileName}</span>
                <span className="history-meta">
                  <span className={`history-badge history-badge-${entry.type}`}>
                    {entry.type === 'screenshot' ? t('history.badgeScreenshot') : t('history.badgeRecording')}
                  </span>
                  <span className="history-time" title={fullDate(entry.timestamp)}>
                    {relativeTime(entry.timestamp)}
                  </span>
                </span>
              </div>
              <div className="history-actions">
                {entry.shareUrl ? (
                  <button
                    className="history-action-btn history-share-btn"
                    onClick={() => handleCopyLink(entry.shareUrl!)}
                    title={t('history.copyLink')}
                  >
                    <IconLink />
                  </button>
                ) : (
                  <button
                    className="history-action-btn history-share-btn"
                    onClick={() => handleShare(entry)}
                    disabled={uploadingId === entry.id}
                    title={t('history.share')}
                  >
                    {uploadingId === entry.id ? <IconLoading /> : <IconShare />}
                  </button>
                )}
                {entry.type === 'screenshot' && (
                  <button
                    className="history-action-btn history-copy-btn"
                    onClick={() => handleCopyToClipboard(entry)}
                    title={t('history.copyToClipboard')}
                  >
                    <IconCopy />
                  </button>
                )}
                {entry.type === 'recording' && (
                  <>
                    <button
                      className="history-action-btn"
                      onClick={() => setTrimEntry(entry)}
                      title={t('history.trim')}
                    >
                      <IconScissors />
                    </button>
                    <button
                      className="history-action-btn history-gif-btn"
                      onClick={() => handleGifExport(entry)}
                      disabled={gifExportingId === entry.id}
                      title={t('history.exportGif')}
                    >
                      {gifExportingId === entry.id ? (
                        <span className="history-gif-progress">{gifProgress}%</span>
                      ) : (
                        <IconGif />
                      )}
                    </button>
                  </>
                )}
                <button
                  className="history-action-btn"
                  onClick={() => handleOpen(entry)}
                  title={t('history.open')}
                >
                  <IconPlay />
                </button>
                <button
                  className="history-action-btn"
                  onClick={() => handleShowInFolder(entry)}
                  title={t('history.showInFolder')}
                >
                  <IconFolder />
                </button>
                <button
                  className="history-action-btn history-delete-btn"
                  onClick={() => handleDelete(entry)}
                  title={t('history.removeFromList')}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {trimEntry && (
        <TrimEditor
          filePath={trimEntry.filePath}
          onClose={() => setTrimEntry(null)}
          onSaved={async () => {
            setTrimEntry(null)
            // Refresh list so the trimmed copy appears
            const fresh = await window.electronAPI.history.getAll()
            setEntries(fresh)
            setStatus({ text: i18nT('history.trimSaved'), type: 'success' })
          }}
        />
      )}
    </div>
  )
}
