import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'
import { useTranslation } from '../hooks/useTranslation'
import { setLanguage as setI18nLanguage } from '../../shared/i18n'

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
