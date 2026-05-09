import { useState, useEffect } from 'react'
import type { ScreenshotResult } from '../../shared/types/ipc'
import { AnnotationEditor } from '../annotation/AnnotationEditor'
import { t } from '../../shared/i18n'

interface ScreenshotPanelProps {
  onBack: () => void
}

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'info'
}

type Phase = 'idle' | 'annotating'

export function ScreenshotPanel({ onBack }: ScreenshotPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusMessage | null>(null)

  useEffect(() => {
    // Listen for captured image (sent after overlay selection + screen capture)
    window.electronAPI.screenshot.onCaptured((dataUrl: string) => {
      setCapturedImage(dataUrl)
      setPhase('annotating')
      setStatus(null)
    })

    // Listen for capture errors
    window.electronAPI.screenshot.onResult((result: ScreenshotResult) => {
      if (!result.clipboard.success && result.clipboard.error) {
        setStatus({ text: t('overlay.errorPrefix', { msg: result.clipboard.error }), type: 'error' })
        setTimeout(() => setStatus(null), 5000)
      }
    })

    return () => {
      window.electronAPI.screenshot.removeCapturedListener()
      window.electronAPI.screenshot.removeResultListener()
    }
  }, [])

  const handleStart = () => {
    setStatus(null)
    window.electronAPI.screenshot.start()
  }

  const handleDone = () => {
    setCapturedImage(null)
    setPhase('idle')
  }

  // Annotation editor phase
  if (phase === 'annotating' && capturedImage) {
    return (
      <AnnotationEditor
        imageDataUrl={capturedImage}
        onCopy={(dataUrl) => window.electronAPI.screenshot.copyFinal(dataUrl)}
        onSave={(dataUrl) => window.electronAPI.screenshot.saveFinal(dataUrl)}
        onShare={(dataUrl) => window.electronAPI.upload.screenshot(dataUrl)}
        onDone={handleDone}
      />
    )
  }

  // Idle phase
  return (
    <div className="panel">
      <h2>{t('overlay.screenshot')}</h2>
      <p>{t('overlay.selectArea')}</p>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          className="mode-btn"
          style={{ width: 'auto', padding: '12px 24px' }}
          onClick={handleStart}
        >
          <span className="mode-label">{t('overlay.startCapture')}</span>
        </button>
      </div>

      {status && (
        <div
          className={`status-msg status-${status.type}`}
          style={{ marginTop: '12px', fontSize: '12px', maxWidth: '360px', textAlign: 'center' }}
        >
          {status.text}
        </div>
      )}

      <p style={{ fontSize: '11px', color: '#666', marginTop: '12px' }}>
        {t('overlay.printScreenHint')}
      </p>
      <button className="back-btn" onClick={onBack}>
        {t('app.back')}
      </button>
    </div>
  )
}
