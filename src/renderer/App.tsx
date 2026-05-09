import { useState, useEffect, useCallback } from 'react'
import type { AppMode, RecoverableRecording } from '../shared/types/ipc'
import { RecordingPanel } from './recording/RecordingPanel'
import { HistoryPanel } from './history/HistoryPanel'
import { SettingsPanel } from './settings/SettingsPanel'
import { useTranslation } from './hooks/useTranslation'
import { setLanguage } from '../shared/i18n'

type ViewMode = 'bar' | 'recording' | 'history' | 'settings'

const SIZES: Record<ViewMode, { width: number; height: number }> = {
  bar:       { width: 400, height: 48 },
  recording: { width: 420, height: 520 },
  history:   { width: 420, height: 520 },
  settings:  { width: 420, height: 520 }
}

export default function App() {
  const { t } = useTranslation()
  const [view, setView] = useState<ViewMode>('bar')
  const [pinned, setPinned] = useState(false)
  const [recActive, setRecActive] = useState(false)
  const [recoveryList, setRecoveryList] = useState<RecoverableRecording[]>([])

  // Load saved language on startup
  useEffect(() => {
    window.electronAPI.settings.get().then((s) => {
      if (s.language) setLanguage(s.language)
    })
  }, [])

  const VIEW_META: Record<Exclude<ViewMode, 'bar'>, { title: string; icon: string; accent: string }> = {
    recording: { title: t('app.recording'), icon: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', accent: '#e74c4c' },
    history:   { title: t('app.captures'), icon: 'M3 3v18h18M7 18V10M12 18V6M17 18V13', accent: '#5c7cfa' },
    settings:  { title: t('app.settings'), icon: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83', accent: '#aaa' }
  }

  const switchView = useCallback((newView: ViewMode) => {
    setView(newView)
    const size = SIZES[newView]
    window.electronAPI.app.resize(size.width, size.height)
  }, [])

  const handleRecStart = useCallback(() => {
    setRecActive(true)
    window.electronAPI.app.resize(340, 48)
  }, [])

  const handleRecEnd = useCallback(() => {
    setRecActive(false)
    window.electronAPI.app.resize(SIZES.recording.width, SIZES.recording.height)
  }, [])

  const goBack = useCallback(() => {
    switchView('bar')
  }, [switchView])

  useEffect(() => {
    window.electronAPI.recording.checkRecovery().then(list => {
      if (list.length > 0) {
        setRecoveryList(list)
        window.electronAPI.app.resize(400, 48 + list.length * 44)
      }
    })
  }, [])

  const handleRecover = async (sessionId: string) => {
    const result = await window.electronAPI.recording.recoverRecording(sessionId)
    const next = recoveryList.filter(r => r.sessionId !== sessionId)
    setRecoveryList(next)
    if (next.length === 0) {
      window.electronAPI.app.resize(SIZES.bar.width, SIZES.bar.height)
    }
    if (result.success) { /* recovered */ }
  }

  const handleDiscardRecovery = async (sessionId: string) => {
    await window.electronAPI.recording.discardRecovery(sessionId)
    const next = recoveryList.filter(r => r.sessionId !== sessionId)
    setRecoveryList(next)
    if (next.length === 0) {
      window.electronAPI.app.resize(SIZES.bar.width, SIZES.bar.height)
    }
  }

  useEffect(() => {
    window.electronAPI.app.onForceMode((newMode: AppMode) => {
      if (newMode === 'recording') switchView('recording')
      else if (newMode === 'history') switchView('history')
      else if (newMode === 'settings') switchView('settings')
      else if (newMode === 'screenshot') {
        window.electronAPI.app.hide()
        window.electronAPI.screenshot.start()
      }
    })
    return () => window.electronAPI.app.removeForceModeListener()
  }, [switchView])

  const handlePin = async () => {
    const result = await window.electronAPI.app.togglePin()
    setPinned(result)
  }

  const handleClose = () => window.electronAPI.app.close()

  const handleScreenshot = () => {
    window.electronAPI.app.hide()
    window.electronAPI.screenshot.start()
  }

  const handleRecording = () => switchView('recording')

  // Recording view
  if (view === 'recording') {
    const meta = VIEW_META.recording
    return (
      <div className={recActive ? 'rec-compact-bar' : 'exp-window'}>
        <div className="exp-header" style={{ '--accent': meta.accent, display: recActive ? 'none' : undefined } as React.CSSProperties}>
          <div className="exp-header-bg" />
          <div className="exp-header-content">
            <button className="exp-back" onClick={goBack} title={t('app.back')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div className="exp-header-info">
              <svg className="exp-header-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={meta.icon} />
              </svg>
              <span className="exp-header-title">{meta.title}</span>
            </div>
            <button className="exp-close" onClick={handleClose} title={t('app.close')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className={recActive ? '' : 'exp-content'}>
          <RecordingPanel onRecordingStart={handleRecStart} onRecordingEnd={handleRecEnd} compact={recActive} />
        </div>
      </div>
    )
  }

  // History & Settings views
  if (view === 'history' || view === 'settings') {
    const Panel = view === 'history' ? HistoryPanel : SettingsPanel
    const meta = VIEW_META[view]
    return (
      <div className="exp-window">
        <div className="exp-header" style={{ '--accent': meta.accent } as React.CSSProperties}>
          <div className="exp-header-bg" />
          <div className="exp-header-content">
            <button className="exp-back" onClick={goBack} title={t('app.back')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div className="exp-header-info">
              <svg className="exp-header-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={meta.icon} />
              </svg>
              <span className="exp-header-title">{meta.title}</span>
            </div>
            <button className="exp-close" onClick={handleClose} title={t('app.close')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="exp-content">
          <Panel />
        </div>
      </div>
    )
  }

  // ── Horizontal bar (default) ──
  return (
    <div className={recoveryList.length > 0 ? 'bar bar-with-recovery' : 'bar'}>

      {recoveryList.length > 0 && (
        <div className="recovery-banner">
          {recoveryList.map(r => (
            <div key={r.sessionId} className="recovery-item">
              <span className="recovery-info">
                {t('app.recoverableRecording')} {r.sourceName} ({(r.fileSizeBytes / 1024 / 1024).toFixed(1)} MB)
              </span>
              <button className="recovery-btn recovery-save" onClick={() => handleRecover(r.sessionId)}>{t('app.recover')}</button>
              <button className="recovery-btn recovery-discard" onClick={() => handleDiscardRecovery(r.sessionId)}>{t('app.delete')}</button>
            </div>
          ))}
        </div>
      )}

      <button className="bar-btn bar-capture" onClick={handleScreenshot} title={t('app.screenshotTooltip')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M8 5V3h8v2" />
        </svg>
      </button>

      <button className="bar-btn bar-record" onClick={handleRecording} title={t('app.recording')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <div className="bar-sep" />

      <button className="bar-btn bar-text-btn" onClick={() => switchView('history')} title={t('app.captures')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 3v18h18" /><rect x="7" y="10" width="3" height="8" rx="1" /><rect x="12" y="6" width="3" height="12" rx="1" /><rect x="17" y="13" width="3" height="5" rx="1" />
        </svg>
        <span>{t('app.captures')}</span>
      </button>

      <button className="bar-btn" onClick={() => switchView('settings')} title={t('app.settings')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      </button>

      <div className="bar-sep" />

      <button
        className={`bar-btn bar-pin ${pinned ? 'bar-pin-on' : ''}`}
        onClick={handlePin}
        title={pinned ? t('app.unpin') : t('app.pin')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
        </svg>
      </button>

      <button className="bar-btn bar-close" onClick={handleClose} title={t('app.close')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
