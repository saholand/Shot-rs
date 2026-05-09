import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'
import { useTranslation } from '../hooks/useTranslation'
import { setLanguage as setI18nLanguage } from '../../shared/i18n'

interface CameraOption { deviceId: string; label: string }

interface Props {
  onBack: () => void
}

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'info'
}

/** Convert KeyboardEvent to Electron accelerator string */
function keyEventToAccelerator(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('CommandOrControl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  const keyMap: Record<string, string> = {
    'PrintScreen': 'PrintScreen',
    ' ': 'Space',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Delete': 'Delete',
    'Insert': 'Insert',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'Escape': 'Escape',
    'Enter': 'Enter',
    'Tab': 'Tab',
    'Backspace': 'Backspace'
  }

  let key = keyMap[e.key] || e.key.toUpperCase()
  if (/^F\d{1,2}$/.test(e.key)) key = e.key

  parts.push(key)
  return parts.join('+')
}

/** Pretty-print Electron accelerator for display */
function formatAccelerator(acc: string): string {
  return acc
    .replace('CommandOrControl', 'Ctrl')
    .replace(/\+/g, ' + ')
}

function HotkeyInput({ value, onChange, label, desc, pressKeyText }: {
  value: string
  onChange: (val: string) => void
  label: string
  desc: string
  pressKeyText: string
}) {
  const [listening, setListening] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const acc = keyEventToAccelerator(e)
    if (acc) {
      onChange(acc)
      setListening(false)
    }
  }, [onChange])

  useEffect(() => {
    if (!listening) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [listening, handleKeyDown])

  useEffect(() => {
    if (!listening) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListening(false)
    }
    window.addEventListener('keyup', onEsc)
    return () => window.removeEventListener('keyup', onEsc)
  }, [listening])

  return (
    <div className="settings-item settings-item-col">
      <span className="settings-item-label">{label}</span>
      <span className="settings-item-desc">{desc}</span>
      <button
        className={`settings-hotkey-btn ${listening ? 'settings-hotkey-listening' : ''}`}
        onClick={() => setListening(true)}
        onBlur={() => setListening(false)}
      >
        {listening ? pressKeyText : formatAccelerator(value)}
      </button>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="settings-section-title">{children}</div>
}

export function SettingsPanel({ onBack }: Props) {
  const { t, language, setLanguage } = useTranslation()
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [dirty, setDirty] = useState(false)
  const [cameras, setCameras] = useState<CameraOption[]>([])

  // Enumerate cameras once. Note: device labels are hidden until the user
  // grants camera permission at least once; so initial list may show
  // empty labels.
  useEffect(() => {
    (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setCameras(devices
          .filter(d => d.kind === 'videoinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || 'Camera' })))
      } catch { /* permission not granted yet */ }
    })()
  }, [])

  useEffect(() => {
    window.electronAPI.settings.get().then((s) => {
      setSettings(s)
      // Sync i18n language with saved setting
      if (s.language) setI18nLanguage(s.language)
      setLoading(false)
    })
  }, [])

  // Auto-dismiss status
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 3000)
    return () => clearTimeout(t)
  }, [status])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    setStatus(null)
  }

  const handleLanguageChange = (lang: 'tr' | 'en') => {
    update('language', lang)
    setLanguage(lang)
  }

  const handleSelectDir = async () => {
    const dir = await window.electronAPI.settings.selectDir()
    if (dir) update('defaultSaveDir', dir)
  }

  const handleClearDir = () => update('defaultSaveDir', '')

  const handleSave = async () => {
    await window.electronAPI.settings.save(settings)
    setDirty(false)
    setStatus({ text: t('settings.settingsSaved'), type: 'success' })
  }

  if (loading) {
    return (
      <div className="panel">
        <p>{t('settings.loading')}</p>
      </div>
    )
  }

  return (
    <div className="panel settings-panel">
      <div className="settings-list">

        {/* ── Shortcuts ── */}
        <SectionTitle>{t('settings.shortcuts')}</SectionTitle>

        <HotkeyInput
          value={settings.screenshotHotkey}
          onChange={(v) => update('screenshotHotkey', v)}
          label={t('settings.screenshotHotkey')}
          desc={t('settings.screenshotHotkeyDesc')}
          pressKeyText={t('settings.pressKey')}
        />

        <HotkeyInput
          value={settings.recordingHotkey}
          onChange={(v) => update('recordingHotkey', v)}
          label={t('settings.recordingHotkey')}
          desc={t('settings.recordingHotkeyDesc')}
          pressKeyText={t('settings.pressKey')}
        />

        <HotkeyInput
          value={settings.annotationHotkey}
          onChange={(v) => update('annotationHotkey', v)}
          label={t('settings.drawModeHotkey')}
          desc={t('settings.drawModeHotkeyDesc')}
          pressKeyText={t('settings.pressKey')}
        />

        <HotkeyInput
          value={settings.ocrHotkey}
          onChange={(v) => update('ocrHotkey', v)}
          label={t('settings.ocrHotkey')}
          desc={t('settings.ocrHotkeyDesc')}
          pressKeyText={t('settings.pressKey')}
        />

        {/* ── General ── */}
        <SectionTitle>{t('settings.general')}</SectionTitle>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.language')}</span>
            <span className="settings-item-desc">{t('settings.languageDesc')}</span>
          </div>
          <select
            className="settings-select"
            value={settings.language || 'tr'}
            onChange={(e) => handleLanguageChange(e.target.value as 'tr' | 'en')}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.closeToTray')}</span>
            <span className="settings-item-desc">{t('settings.closeToTrayDesc')}</span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.closeToTray}
              onChange={(e) => update('closeToTray', e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.quickRecord')}</span>
            <span className="settings-item-desc">{t('settings.quickRecordDesc')}</span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.quickRecordEnabled}
              onChange={(e) => update('quickRecordEnabled', e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.magnifier')}</span>
            <span className="settings-item-desc">{t('settings.magnifierDesc')}</span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.magnifierEnabled}
              onChange={(e) => update('magnifierEnabled', e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.magnifierZoom')}</span>
            <span className="settings-item-desc">{t('settings.magnifierZoomDesc')}</span>
          </div>
          <select
            className="settings-select"
            value={settings.magnifierZoom}
            onChange={(e) => update('magnifierZoom', e.target.value as 'low' | 'medium' | 'high')}
          >
            <option value="low">{t('settings.zoomLow')}</option>
            <option value="medium">{t('settings.zoomMed')}</option>
            <option value="high">{t('settings.zoomHigh')}</option>
          </select>
        </div>

        {/* ── Recording ── */}
        <SectionTitle>{t('settings.recordingSection')}</SectionTitle>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.videoFormat')}</span>
            <span className="settings-item-desc">{t('settings.videoFormatDesc')}</span>
          </div>
          <select
            className="settings-select"
            value={settings.videoFormat}
            onChange={(e) => update('videoFormat', e.target.value as 'webm' | 'mp4')}
          >
            <option value="webm">WebM</option>
            <option value="mp4">MP4 (H.264)</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.videoQuality')}</span>
            <span className="settings-item-desc">{t('settings.videoQualityDesc')}</span>
          </div>
          <select
            className="settings-select"
            value={settings.videoQuality}
            onChange={(e) => update('videoQuality', e.target.value as 'low' | 'medium' | 'high' | 'ultra')}
          >
            <option value="low">{t('settings.qualityLow')} (1.5 Mbps)</option>
            <option value="medium">{t('settings.qualityMed')} (2.5 Mbps)</option>
            <option value="high">{t('settings.qualityHigh')} (5 Mbps)</option>
            <option value="ultra">{t('settings.qualityUltra')} (8 Mbps)</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.videoFramerate')}</span>
            <span className="settings-item-desc">{t('settings.videoFramerateDesc')}</span>
          </div>
          <select
            className="settings-select"
            value={settings.videoFramerate}
            onChange={(e) => update('videoFramerate', parseInt(e.target.value, 10) as 24 | 30 | 60)}
          >
            <option value="24">24 fps</option>
            <option value="30">30 fps</option>
            <option value="60">60 fps</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.systemAudio')}</span>
            <span className="settings-item-desc">{t('settings.systemAudioDesc')}</span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.recordSystemAudio}
              onChange={(e) => update('recordSystemAudio', e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.maxDuration')}</span>
            <span className="settings-item-desc">{t('settings.maxDurationDesc')}</span>
          </div>
          <select
            className="settings-select"
            value={settings.recordingMaxDurationSec ?? ''}
            onChange={(e) => update('recordingMaxDurationSec', e.target.value === '' ? null : parseInt(e.target.value, 10))}
          >
            <option value="">{t('settings.maxDurationNone')}</option>
            <option value="60">1 dk</option>
            <option value="300">5 dk</option>
            <option value="900">15 dk</option>
            <option value="1800">30 dk</option>
            <option value="3600">1 saat</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">{t('settings.webcam')}</span>
            <span className="settings-item-desc">{t('settings.webcamDesc')}</span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.webcamEnabled}
              onChange={(e) => update('webcamEnabled', e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        {settings.webcamEnabled && (
          <>
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">{t('settings.webcamDevice')}</span>
                <span className="settings-item-desc">{t('settings.webcamDeviceDesc')}</span>
              </div>
              <select
                className="settings-select"
                value={settings.webcamDeviceId ?? ''}
                onChange={(e) => update('webcamDeviceId', e.target.value || null)}
              >
                <option value="">{t('settings.webcamDeviceDefault')}</option>
                {cameras.map(c => (
                  <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">{t('settings.webcamPosition')}</span>
              </div>
              <select
                className="settings-select"
                value={settings.webcamPosition}
                onChange={(e) => update('webcamPosition', e.target.value as AppSettings['webcamPosition'])}
              >
                <option value="tl">{t('settings.posTL')}</option>
                <option value="tr">{t('settings.posTR')}</option>
                <option value="bl">{t('settings.posBL')}</option>
                <option value="br">{t('settings.posBR')}</option>
              </select>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">{t('settings.webcamSize')}</span>
              </div>
              <select
                className="settings-select"
                value={settings.webcamSize}
                onChange={(e) => update('webcamSize', e.target.value as AppSettings['webcamSize'])}
              >
                <option value="small">{t('settings.sizeSmall')}</option>
                <option value="medium">{t('settings.sizeMed')}</option>
                <option value="large">{t('settings.sizeLarge')}</option>
              </select>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">{t('settings.webcamShape')}</span>
              </div>
              <select
                className="settings-select"
                value={settings.webcamShape}
                onChange={(e) => update('webcamShape', e.target.value as AppSettings['webcamShape'])}
              >
                <option value="circle">{t('settings.shapeCircle')}</option>
                <option value="rounded">{t('settings.shapeRounded')}</option>
              </select>
            </div>
          </>
        )}

        {/* ── File Settings ── */}
        <SectionTitle>{t('settings.fileSettings')}</SectionTitle>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">{t('settings.defaultSaveDir')}</span>
          <span className="settings-item-desc">{t('settings.defaultSaveDirDesc')}</span>
          <div className="settings-dir-row">
            <span className="settings-dir-path">
              {settings.defaultSaveDir || t('settings.notSpecified')}
            </span>
            <button className="settings-dir-btn" onClick={handleSelectDir}>{t('settings.select')}</button>
            {settings.defaultSaveDir && (
              <button className="settings-dir-btn settings-dir-clear" onClick={handleClearDir}>{t('settings.clearDir')}</button>
            )}
          </div>
        </div>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">{t('settings.screenshotFileName')}</span>
          <span className="settings-item-desc">
            {t('settings.placeholders')} {'{timestamp}'}, {'{date}'}, {'{time}'}
          </span>
          <input
            className="settings-input"
            value={settings.screenshotFileNameFormat}
            onChange={(e) => update('screenshotFileNameFormat', e.target.value)}
            placeholder="screenshot-{timestamp}"
          />
        </div>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">{t('settings.recordingFileName')}</span>
          <span className="settings-item-desc">
            {t('settings.placeholders')} {'{timestamp}'}, {'{date}'}, {'{time}'}
          </span>
          <input
            className="settings-input"
            value={settings.recordingFileNameFormat}
            onChange={(e) => update('recordingFileNameFormat', e.target.value)}
            placeholder="recording-{timestamp}"
          />
        </div>

        {/* ── Advanced ── */}
        <SectionTitle>{t('settings.advanced')}</SectionTitle>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">{t('settings.uploadServer')}</span>
          <span className="settings-item-desc">
            {t('settings.uploadServerDesc')}
          </span>
          <input
            className="settings-input"
            value={settings.uploadServerUrl}
            onChange={(e) => update('uploadServerUrl', e.target.value)}
            placeholder="http://localhost:3500"
          />
        </div>
      </div>

      {/* Sticky save footer */}
      <div className="settings-footer">
        <button
          className={`settings-save-btn ${dirty ? 'settings-save-dirty' : ''}`}
          onClick={handleSave}
          disabled={!dirty}
        >
          {dirty ? t('settings.save') : t('settings.saved')}
        </button>
        {status && (
          <span className={`settings-status status-${status.type}`}>{status.text}</span>
        )}
        <span className="settings-version">Shotirs v1.0.0</span>
      </div>
    </div>
  )
}
