import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import './trim-editor.css'

interface Props {
  /** Local file path (renderer reads it via local-media:// protocol). */
  filePath: string
  onClose: () => void
  onSaved: (newPath: string) => void
}

/**
 * Post-recording trim editor. Plays the source video, lets the user
 * drag two handles on a timeline, previews the in-range segment, and
 * saves a trimmed copy via ffmpeg in the main process.
 */
export function TrimEditor({ filePath, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Renderer can't read absolute file paths directly; main registered
  // a `local-media://` protocol that serves them.
  const src = `local-media:///${filePath.replace(/\\/g, '/')}`

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onMeta = () => {
      setDuration(v.duration || 0)
      setEnd(v.duration || 0)
    }
    const onTime = () => setCurrentTime(v.currentTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', onTime)
    return () => {
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('timeupdate', onTime)
    }
  }, [])

  // Stop preview when current time crosses end
  useEffect(() => {
    if (!previewing) return
    const v = videoRef.current
    if (!v) return
    const tick = () => {
      if (v.currentTime >= end) {
        v.pause()
        v.currentTime = start
        setPreviewing(false)
      }
    }
    v.addEventListener('timeupdate', tick)
    return () => v.removeEventListener('timeupdate', tick)
  }, [previewing, start, end])

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toFixed(1).padStart(4, '0')
    return `${m}:${s}`
  }

  const seek = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(duration, t))
  }

  const handleStartDrag = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setStart(Math.min(v, end - 0.1))
    seek(Math.min(v, end - 0.1))
  }
  const handleEndDrag = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setEnd(Math.max(v, start + 0.1))
    seek(Math.max(v, start + 0.1))
  }

  const playPreview = () => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = start
    v.play().catch(() => { /* ignore */ })
    setPreviewing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await window.electronAPI.recording.trim({
        inputPath: filePath,
        startSec: start,
        endSec: end
      })
      if (result.success && result.filePath) {
        onSaved(result.filePath)
      } else if (result.error !== 'Save cancelled') {
        setError(result.error || t('trim.saveFailed'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trim.saveFailed'))
    }
    setSaving(false)
  }

  const startPct = duration > 0 ? (start / duration) * 100 : 0
  const endPct = duration > 0 ? (end / duration) * 100 : 100
  const cursorPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="trim-overlay">
      <div className="trim-modal">
        <div className="trim-header">
          <h3>{t('trim.title')}</h3>
          <button className="trim-close" onClick={onClose} title={t('trim.close')}>×</button>
        </div>

        <video ref={videoRef} className="trim-video" src={src} controls={false} />

        <div className="trim-timeline">
          {/* Highlight band for the selected region */}
          <div className="trim-band" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
          {/* Playhead */}
          <div className="trim-playhead" style={{ left: `${cursorPct}%` }} />
          {/* Range inputs (overlap, both control the same duration) */}
          <input
            type="range" min={0} max={duration || 1} step={0.05}
            value={start}
            onChange={handleStartDrag}
            className="trim-handle trim-handle-start"
          />
          <input
            type="range" min={0} max={duration || 1} step={0.05}
            value={end}
            onChange={handleEndDrag}
            className="trim-handle trim-handle-end"
          />
        </div>

        <div className="trim-info">
          <span>{t('trim.start')}: {fmt(start)}</span>
          <span>{t('trim.end')}: {fmt(end)}</span>
          <span>{t('trim.duration')}: {fmt(end - start)}</span>
        </div>

        {error && <div className="trim-error">{error}</div>}

        <div className="trim-actions">
          <button className="trim-btn" onClick={playPreview} disabled={previewing || saving}>
            {previewing ? t('trim.previewing') : t('trim.preview')}
          </button>
          <button className="trim-btn trim-btn-cancel" onClick={onClose} disabled={saving}>
            {t('trim.cancel')}
          </button>
          <button
            className="trim-btn trim-btn-save"
            onClick={handleSave}
            disabled={saving || (end - start) < 0.1}
          >
            {saving ? t('trim.saving') : t('trim.saveTrimmed')}
          </button>
        </div>
      </div>
    </div>
  )
}
