import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'

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

function HotkeyInput({ value, onChange, label, desc }: {
  value: string
  onChange: (val: string) => void
  label: string
  desc: string
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
        {listening ? 'Bir tuş kombinasyonu basın...' : formatAccelerator(value)}
      </button>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="settings-section-title">{children}</div>
}

export function SettingsPanel({ onBack }: Props) {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    window.electronAPI.settings.get().then((s) => {
      setSettings(s)
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

  const handleSelectDir = async () => {
    const dir = await window.electronAPI.settings.selectDir()
    if (dir) update('defaultSaveDir', dir)
  }

  const handleClearDir = () => update('defaultSaveDir', '')

  const handleSave = async () => {
    await window.electronAPI.settings.save(settings)
    setDirty(false)
    setStatus({ text: 'Ayarlar kaydedildi', type: 'success' })
  }

  if (loading) {
    return (
      <div className="panel">
        <p>Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="panel settings-panel">
      <div className="settings-list">

        {/* ── Kısayollar ── */}
        <SectionTitle>Kısayollar</SectionTitle>

        <HotkeyInput
          value={settings.screenshotHotkey}
          onChange={(v) => update('screenshotHotkey', v)}
          label="Ekran görüntüsü"
          desc="Ekran yakalamayı başlatır"
        />

        <HotkeyInput
          value={settings.recordingHotkey}
          onChange={(v) => update('recordingHotkey', v)}
          label="Ekran kaydı"
          desc="Kayıt başlatır / durdurur"
        />

        <HotkeyInput
          value={settings.annotationHotkey}
          onChange={(v) => update('annotationHotkey', v)}
          label="Çizim modu"
          desc="Kayıt sırasında çizim aç/kapat"
        />

        <HotkeyInput
          value={settings.ocrHotkey}
          onChange={(v) => update('ocrHotkey', v)}
          label="OCR (metin tanıma)"
          desc="Ekrandan alan seç → metin panoya kopyalansın"
        />

        {/* ── Genel ── */}
        <SectionTitle>Genel</SectionTitle>

        <div className="settings-item">
          <div className="settings-item-info">
            <span className="settings-item-label">Kapatınca tray'de kal</span>
            <span className="settings-item-desc">Pencere kapatıldığında arka planda çalışmaya devam eder</span>
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
            <span className="settings-item-label">Hızlı kayıt modu</span>
            <span className="settings-item-desc">Kısayolla UI göstermeden doğrudan kayıt başlat</span>
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

        {/* ── Dosya Ayarları ── */}
        <SectionTitle>Dosya Ayarları</SectionTitle>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">Varsayılan kayıt klasörü</span>
          <span className="settings-item-desc">Boş bırakılırsa her seferinde sorulur</span>
          <div className="settings-dir-row">
            <span className="settings-dir-path">
              {settings.defaultSaveDir || '(Belirtilmemiş)'}
            </span>
            <button className="settings-dir-btn" onClick={handleSelectDir}>Seç</button>
            {settings.defaultSaveDir && (
              <button className="settings-dir-btn settings-dir-clear" onClick={handleClearDir}>Temizle</button>
            )}
          </div>
        </div>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">Ekran görüntüsü dosya adı</span>
          <span className="settings-item-desc">
            Yer tutucular: {'{timestamp}'}, {'{date}'}, {'{time}'}
          </span>
          <input
            className="settings-input"
            value={settings.screenshotFileNameFormat}
            onChange={(e) => update('screenshotFileNameFormat', e.target.value)}
            placeholder="screenshot-{timestamp}"
          />
        </div>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">Ekran kaydı dosya adı</span>
          <span className="settings-item-desc">
            Yer tutucular: {'{timestamp}'}, {'{date}'}, {'{time}'}
          </span>
          <input
            className="settings-input"
            value={settings.recordingFileNameFormat}
            onChange={(e) => update('recordingFileNameFormat', e.target.value)}
            placeholder="recording-{timestamp}"
          />
        </div>

        {/* ── Gelişmiş ── */}
        <SectionTitle>Gelişmiş</SectionTitle>

        <div className="settings-item settings-item-col">
          <span className="settings-item-label">Upload sunucu adresi</span>
          <span className="settings-item-desc">
            Paylaşım özelliği için sunucu adresi
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
          {dirty ? 'Kaydet' : 'Kaydedildi'}
        </button>
        {status && (
          <span className={`settings-status status-${status.type}`}>{status.text}</span>
        )}
        <span className="settings-version">Shotırs v1.0.0</span>
      </div>
    </div>
  )
}
