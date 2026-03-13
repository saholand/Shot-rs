import { useState, useEffect, useRef, useCallback } from 'react'
import { SourcePicker } from './SourcePicker'
import type { DesktopSource, SelectionRegion } from '../../shared/types/ipc'

interface RecordingPanelProps {
  onBack: () => void
  onRecordingStart?: () => void
  onRecordingEnd?: () => void
  compact?: boolean
}

type Phase = 'pick' | 'recording' | 'saving'

const PREFERRED_MIME = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
]

function getSupportedMime(): string {
  for (const mime of PREFERRED_MIME) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

export function RecordingPanel({ onBack, onRecordingStart, onRecordingEnd, compact }: RecordingPanelProps) {
  const [sources, setSources] = useState<DesktopSource[]>([])
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [drawMode, setDrawMode] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPausedRef = useRef(false)
  const isQuickModeRef = useRef(false)
  const cropRegionRef = useRef<SelectionRegion | null>(null)
  const cropVideoRef = useRef<HTMLVideoElement | null>(null)
  const cropAnimRef = useRef<number | null>(null)
  const pendingWritesRef = useRef<Promise<void>[]>([])
  const handleStartRef = useRef<(overrideSource?: DesktopSource, region?: SelectionRegion, isQuick?: boolean) => Promise<void>>()

  // Load sources
  const loadSources = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.recording.getSources()
      setSources(result)
    } catch {
      setSources([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  // Timer — pauses when isPausedRef is true
  useEffect(() => {
    if (phase === 'recording') {
      setElapsed(0)
      isPausedRef.current = false
      timerRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          setElapsed(prev => prev + 1)
        }
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // Listen for annotation draw mode changes from main process
  useEffect(() => {
    if (phase === 'recording') {
      window.electronAPI.recording.onAnnotationMode((drawing) => {
        setDrawMode(drawing)
      })
      window.electronAPI.recording.onStopRequest(() => {
        handleStopRecording()
      })
    } else {
      setDrawMode(false)
    }
    return () => {
      window.electronAPI.recording.removeAnnotationModeListener()
      window.electronAPI.recording.removeStopRequestListener()
    }
  }, [phase])

  // Listen for quick-start signal from main process
  useEffect(() => {
    window.electronAPI.recording.onQuickStart((source: DesktopSource) => {
      handleStartRef.current?.(source, undefined, true)
    })
    return () => window.electronAPI.recording.removeQuickStartListener()
  }, [])

  // Listen for region selection result
  useEffect(() => {
    window.electronAPI.recording.onRegionSelected(async (region: SelectionRegion) => {
      cropRegionRef.current = region
      // Find the first screen source and auto-start recording with it
      const allSources = await window.electronAPI.recording.getSources()
      const screenSource = allSources.find(s => s.id.startsWith('screen:'))
      if (screenSource) {
        setSelectedSource(screenSource)
        handleStartRef.current?.(screenSource, region)
      }
    })
    return () => window.electronAPI.recording.removeRegionSelectedListener()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleStartRecording = async (overrideSource?: DesktopSource, region?: SelectionRegion, isQuick?: boolean) => {
    const source = overrideSource || selectedSource
    if (!source) return

    setStatus(null)
    setSavedFilePath(null)
    setIsPaused(false)
    setMicActive(false)

    const mimeType = getSupportedMime()
    if (!mimeType) {
      setStatus({ text: 'Desteklenen video codec bulunamadı', type: 'error' })
      return
    }

    try {
      const useMic = isQuick ? false : micEnabled
      const startResult = await window.electronAPI.recording.startRecording(source.id, source.name, useMic)
      if (!startResult.success) {
        setStatus({ text: startResult.error || 'Başlatma başarısız', type: 'error' })
        return
      }

      const desktopStream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
          }
        }
      })

      // Build the stream to record (full screen or cropped region)
      const cropRegion = region || cropRegionRef.current
      let recordStream: MediaStream

      if (cropRegion) {
        // Canvas cropping pipeline: crop each frame to the selected region
        const dpr = window.devicePixelRatio || 1
        const sx = Math.round(cropRegion.x * dpr)
        const sy = Math.round(cropRegion.y * dpr)
        const cw = Math.round(cropRegion.width * dpr)
        const ch = Math.round(cropRegion.height * dpr)

        const video = document.createElement('video')
        video.srcObject = desktopStream
        video.muted = true
        cropVideoRef.current = video

        // Wait for video to be ready
        await new Promise<void>(resolve => {
          video.onloadedmetadata = () => resolve()
          if (video.readyState >= 1) resolve()
        })
        video.play()

        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')!

        // Start frame loop
        const drawFrame = () => {
          ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch)
          cropAnimRef.current = requestAnimationFrame(drawFrame)
        }
        drawFrame()

        recordStream = canvas.captureStream(30)
      } else {
        recordStream = desktopStream
      }

      const combinedStream = new MediaStream()
      recordStream.getVideoTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t))

      if (useMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          micStreamRef.current = micStream
          micStream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
          setMicActive(true)
        } catch {
          setStatus({ text: 'Mikrofon kullanılamıyor — ses olmadan kaydediliyor', type: 'info' })
        }
      }

      // Keep original desktop stream ref for cleanup
      streamRef.current = desktopStream
      chunksRef.current = []

      // Initialize temp file for crash-safe recording
      const initResult = await window.electronAPI.recording.initTemp(mimeType, source.name)
      if (!initResult.success) {
        setStatus({ text: initResult.error || 'Geçici dosya oluşturulamadı', type: 'error' })
        cleanupStreams()
        return
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000
      })

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          // Send chunk to main process for incremental disk write
          const writePromise = (async () => {
            try {
              const buffer = await e.data.arrayBuffer()
              await window.electronAPI.recording.writeChunk(buffer)
            } catch (err) {
              console.error('Failed to write chunk to disk:', err)
            }
          })()
          pendingWritesRef.current.push(writePromise)
        }
      }

      recorder.onerror = () => {
        setStatus({ text: 'Kayıt sırasında hata oluştu', type: 'error' })
        handleStopRecording()
      }

      // Timeslice: get chunks every 5 seconds for crash safety
      recorder.start(5000)
      mediaRecorderRef.current = recorder
      setSelectedSource(source)
      setPhase('recording')
      onRecordingStart?.()

      // Quick mode: hide window after starting
      if (isQuick) {
        isQuickModeRef.current = true
        window.electronAPI.app.hide()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kayıt başlatılamadı'
      setStatus({ text: msg, type: 'error' })
      cleanupStreams()
    }
  }

  // Keep ref always pointing to latest handleStartRecording
  handleStartRef.current = handleStartRecording

  const handleRegionSelect = () => {
    window.electronAPI.app.hide()
    window.electronAPI.recording.selectRegion()
  }

  const handleToggleAnnotation = () => {
    window.electronAPI.recording.toggleAnnotation()
  }

  const handlePauseResume = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    if (recorder.state === 'recording') {
      recorder.pause()
      isPausedRef.current = true
      setIsPaused(true)
    } else if (recorder.state === 'paused') {
      recorder.resume()
      isPausedRef.current = false
      setIsPaused(false)
    }
  }

  const cleanupStreams = () => {
    // Stop crop animation loop
    if (cropAnimRef.current) {
      cancelAnimationFrame(cropAnimRef.current)
      cropAnimRef.current = null
    }
    // Stop crop video element
    if (cropVideoRef.current) {
      cropVideoRef.current.pause()
      cropVideoRef.current.srcObject = null
      cropVideoRef.current = null
    }
    cropRegionRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
    setMicActive(false)
  }

  const handleStopRecording = async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setPhase('pick')
      return
    }

    setPhase('saving')
    setIsPaused(false)
    isPausedRef.current = false
    onRecordingEnd?.()

    await window.electronAPI.recording.stop()

    // Wait for final dataavailable + onstop
    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    // Wait for all pending chunk writes to complete before finalizing
    await Promise.all(pendingWritesRef.current)
    pendingWritesRef.current = []

    cleanupStreams()
    mediaRecorderRef.current = null
    chunksRef.current = []

    // Finalize: main process closes temp file and shows save dialog
    try {
      const result = await window.electronAPI.recording.finalize(recorder.mimeType)

      if (result.success) {
        setStatus({ text: `Kaydedildi: ${result.filePath}`, type: 'success' })
        setSavedFilePath(result.filePath || null)
      } else if (result.error === 'Save cancelled') {
        setStatus({ text: 'Kaydetme iptal edildi', type: 'info' })
      } else {
        setStatus({ text: `Kaydetme hatası: ${result.error}`, type: 'error' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kaydetme başarısız'
      setStatus({ text: msg, type: 'error' })
    }

    setPhase('pick')
  }

  const handleShare = async () => {
    if (!savedFilePath) return
    setUploading(true)
    try {
      const result = await window.electronAPI.upload.file(savedFilePath, 'recording')
      if (result.success) {
        setStatus({ text: `Link kopyalandı: ${result.url}`, type: 'success' })
      } else {
        setStatus({ text: result.error || 'Upload başarısız', type: 'error' })
      }
    } catch {
      setStatus({ text: 'Upload başarısız', type: 'error' })
    }
    setUploading(false)
  }

  // Compact recording bar
  if (compact && phase === 'recording') {
    return (
      <div className="rec-compact-inner">
        <span className={`rec-dot-sm ${isPaused ? 'rec-paused' : ''}`} />
        <span className="rec-compact-time">{formatTime(elapsed)}</span>
        <button className="rec-compact-btn" onClick={handlePauseResume} title={isPaused ? 'Devam' : 'Duraklat'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            {isPaused
              ? <path d="M8 5v14l11-7z"/>
              : <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
            }
          </svg>
        </button>
        <button className="rec-compact-btn rec-compact-stop" onClick={handleStopRecording} title="Durdur">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1"/>
          </svg>
        </button>
        <button
          className={`rec-compact-btn rec-compact-draw ${drawMode ? 'rec-compact-draw-active' : ''}`}
          onClick={handleToggleAnnotation}
          title={drawMode ? 'Çizimi kapat' : 'Ekrana çiz'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/>
            <circle cx="11" cy="11" r="2"/>
          </svg>
        </button>
        {micActive && <span className="rec-compact-mic">MIC</span>}
      </div>
    )
  }

  return (
    <div className="panel" style={{ justifyContent: 'flex-start', paddingTop: '24px' }}>
      <h2>Ekran Kaydı</h2>

      {phase === 'pick' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p>Ekran veya pencere seçin</p>
            <button className="back-btn" style={{ marginTop: 0, fontSize: '11px', padding: '4px 10px' }} onClick={loadSources}>
              Yenile
            </button>
          </div>
          <SourcePicker
            sources={sources}
            selectedId={selectedSource?.id ?? null}
            onSelect={setSelectedSource}
            loading={loading}
          />

          <label className="mic-toggle">
            <input
              type="checkbox"
              checked={micEnabled}
              onChange={e => setMicEnabled(e.target.checked)}
            />
            <span className="mic-toggle-label">Mikrofon</span>
          </label>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="mode-btn"
              style={{ width: 'auto', padding: '12px 24px', opacity: selectedSource ? 1 : 0.4 }}
              onClick={() => handleStartRecording()}
              disabled={!selectedSource}
            >
              <span className="mode-label">Kaydı Başlat</span>
            </button>
            <button
              className="mode-btn"
              style={{ width: 'auto', padding: '12px 24px' }}
              onClick={handleRegionSelect}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 3v18"/>
                <path d="M15 3v18"/>
                <path d="M3 9h18"/>
                <path d="M3 15h18"/>
              </svg>
              <span className="mode-label">Bölge Seç</span>
            </button>
          </div>
        </>
      )}

      {phase === 'recording' && (
        <div className="recording-active">
          <div className="recording-indicator">
            <span className={`rec-dot ${isPaused ? 'rec-paused' : ''}`} />
            <span className={`rec-label ${isPaused ? 'rec-label-paused' : ''}`}>
              {isPaused ? 'DURDURULDU' : 'KAYIT'}
            </span>
            <span className="rec-time">{formatTime(elapsed)}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#888' }}>
            {selectedSource?.name}
            {micActive && <span className="mic-badge">MIC</span>}
          </p>
          <div className="recording-controls">
            <button className="mode-btn rec-control-btn" onClick={handlePauseResume}>
              <span className="mode-label">{isPaused ? 'Devam Et' : 'Duraklat'}</span>
            </button>
            <button
              className={`mode-btn rec-control-btn rec-draw-btn ${drawMode ? 'rec-draw-active' : ''}`}
              onClick={handleToggleAnnotation}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
              <span className="mode-label">{drawMode ? 'Çizimi Kapat' : 'Ekrana Çiz'}</span>
            </button>
            <button className="mode-btn rec-control-btn rec-stop-btn" onClick={handleStopRecording}>
              <span className="mode-label">Durdur</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'saving' && (
        <p style={{ color: '#888' }}>Kayıt kaydediliyor...</p>
      )}

      {status && (
        <div className={`status-msg status-${status.type}`} style={{ marginTop: '8px', maxWidth: '360px', textAlign: 'center' }}>
          {status.text}
        </div>
      )}

      {phase === 'pick' && savedFilePath && (
        <button
          className="ann-btn ann-btn-share"
          onClick={handleShare}
          disabled={uploading}
          style={{ marginTop: '4px' }}
        >
          {uploading ? 'Yükleniyor...' : 'Paylaş'}
        </button>
      )}

      {phase === 'pick' && (
        <button className="back-btn" onClick={onBack}>
          Geri
        </button>
      )}
    </div>
  )
}
