import { useState, useEffect, useRef, useCallback } from 'react'
import { SourcePicker } from './SourcePicker'
import { useTranslation } from '../hooks/useTranslation'
import type { DesktopSource, SelectionRegion, RecordingRegionPayload } from '../../shared/types/ipc'
import type { AppSettings, VideoFormat } from '../../shared/types/settings'
import { VIDEO_BITRATE, DEFAULT_SETTINGS } from '../../shared/types/settings'

interface RecordingPanelProps {
  onBack: () => void
  onRecordingStart?: () => void
  onRecordingEnd?: () => void
  compact?: boolean
}

type Phase = 'pick' | 'recording' | 'saving'

const WEBM_MIMES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
]
const MP4_MIMES = [
  'video/mp4;codecs=h264',
  'video/mp4;codecs=avc1',
  'video/mp4'
]

/**
 * Pick the best mimeType supported by this Chromium given the user's
 * preferred container. Falls back to whichever container is available so
 * recording still works even if the preferred one isn't supported.
 */
function getSupportedMime(format: VideoFormat): string {
  const primary = format === 'mp4' ? MP4_MIMES : WEBM_MIMES
  for (const mime of primary) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  const fallback = format === 'mp4' ? WEBM_MIMES : MP4_MIMES
  for (const mime of fallback) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

export function RecordingPanel({ onBack, onRecordingStart, onRecordingEnd, compact }: RecordingPanelProps) {
  const { t } = useTranslation()
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

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPausedRef = useRef(false)
  const isQuickModeRef = useRef(false)
  const cropRegionRef = useRef<SelectionRegion | null>(null)
  const cropScaleFactorRef = useRef<number>(1)
  const cropVideoRef = useRef<HTMLVideoElement | null>(null)
  const cropAnimRef = useRef<number | null>(null)
  const cropStreamRef = useRef<MediaStream | null>(null)
  // Pending chunk-write count — replaces the unbounded Promise array.
  // Bumped on each writeChunk call, decremented on resolve. We poll this
  // (instead of awaiting an array of N resolved Promises) on stop.
  const pendingWritesCountRef = useRef(0)
  const stopGuardRef = useRef(false)
  const handleStartRef = useRef<(overrideSource?: DesktopSource, region?: SelectionRegion, isQuick?: boolean, scaleFactor?: number) => Promise<void>>()

  // Load settings on mount
  useEffect(() => {
    window.electronAPI.settings.get().then(s => setSettings(s)).catch(() => { /* keep defaults */ })
  }, [])

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
    window.electronAPI.recording.onRegionSelected(async (payload: RecordingRegionPayload) => {
      const { region, displayId, scaleFactor } = payload
      cropRegionRef.current = region
      cropScaleFactorRef.current = scaleFactor || 1
      // Pick the screen source matching the display the region was selected on.
      // Falling back to the first 'screen:' source captures the wrong monitor
      // on multi-display setups.
      const allSources = await window.electronAPI.recording.getSources()
      const screenSources = allSources.filter(s => s.id.startsWith('screen:'))
      // `s.display_id` would be authoritative but it's stripped in the
      // shared DesktopSource type; fall back to a `:N:` boundary check on
      // s.id (e.g. "screen:1:0") so displayId="1" doesn't accidentally
      // match "screen:10:0".
      const matched = displayId
        ? screenSources.find(s => s.id === `screen:${displayId}:0` || s.id.includes(`:${displayId}:`)) ?? null
        : null
      const screenSource = matched ?? screenSources[0]
      if (screenSource) {
        setSelectedSource(screenSource)
        handleStartRef.current?.(screenSource, region, false, scaleFactor)
      }
    })
    return () => window.electronAPI.recording.removeRegionSelectedListener()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cropAnimRef.current) {
        cancelAnimationFrame(cropAnimRef.current)
        cropAnimRef.current = null
      }
      if (cropStreamRef.current) {
        cropStreamRef.current.getTracks().forEach(t => t.stop())
        cropStreamRef.current = null
      }
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

  const handleStartRecording = async (overrideSource?: DesktopSource, region?: SelectionRegion, isQuick?: boolean, displayScaleFactor?: number) => {
    const source = overrideSource || selectedSource
    if (!source) return

    setStatus(null)
    setSavedFilePath(null)
    setIsPaused(false)
    setMicActive(false)

    const mimeType = getSupportedMime(settings.videoFormat)
    if (!mimeType) {
      setStatus({ text: t('recording.noCodec'), type: 'error' })
      return
    }

    try {
      const useMic = isQuick ? false : micEnabled
      const useSystemAudio = settings.recordSystemAudio
      const startResult = await window.electronAPI.recording.startRecording(source.id, source.name, useMic)
      if (!startResult.success) {
        setStatus({ text: startResult.error || t('recording.startFailed'), type: 'error' })
        return
      }

      // Try to grab desktop audio (Windows loopback) alongside video when
      // the user opted in. Fails silently if the platform doesn't expose it.
      let desktopStream: MediaStream
      if (useSystemAudio) {
        try {
          desktopStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop'
              }
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id
              }
            }
          })
        } catch {
          // Loopback not available — fall back to video-only desktop stream
          desktopStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id
              }
            }
          })
          setStatus({ text: t('recording.systemAudioUnavailable'), type: 'info' })
        }
      } else {
        desktopStream = await (navigator.mediaDevices as any).getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id
            }
          }
        })
      }

      // Build the stream to record (full screen or cropped region)
      const cropRegion = region || cropRegionRef.current
      let recordStream: MediaStream

      if (cropRegion) {
        // Canvas cropping pipeline: crop each frame to the selected region.
        // The desktop video stream is delivered at the source display's
        // PHYSICAL pixel resolution, not at the recording renderer's DPR.
        // Use the scale factor passed in from main.
        const sf = displayScaleFactor || cropScaleFactorRef.current || window.devicePixelRatio || 1

        const video = document.createElement('video')
        video.srcObject = desktopStream
        video.muted = true
        cropVideoRef.current = video

        await new Promise<void>(resolve => {
          video.onloadedmetadata = () => resolve()
          if (video.readyState >= 1) resolve()
        })
        await video.play().catch(() => { /* autoplay may need a tick */ })

        const vw = video.videoWidth || Math.round(cropRegion.width * sf)
        const vh = video.videoHeight || Math.round(cropRegion.height * sf)

        const sx = Math.max(0, Math.round(cropRegion.x * sf))
        const sy = Math.max(0, Math.round(cropRegion.y * sf))
        const cw = Math.max(1, Math.min(Math.round(cropRegion.width * sf), vw - sx))
        const ch = Math.max(1, Math.min(Math.round(cropRegion.height * sf), vh - sy))

        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')!

        let intervalHandle: ReturnType<typeof setInterval> | null = null
        const drawOnce = () => {
          try {
            ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch)
          } catch { /* video not ready */ }
        }
        const drawFrame = () => {
          drawOnce()
          cropAnimRef.current = requestAnimationFrame(drawFrame)
        }
        const onVisibility = () => {
          if (document.hidden) {
            if (cropAnimRef.current) cancelAnimationFrame(cropAnimRef.current)
            cropAnimRef.current = null
            if (!intervalHandle) {
              intervalHandle = setInterval(drawOnce, Math.round(1000 / settings.videoFramerate))
            }
          } else {
            if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null }
            if (!cropAnimRef.current) drawFrame()
          }
        }
        document.addEventListener('visibilitychange', onVisibility)
        ;(video as HTMLVideoElement & { _onVis?: () => void })._onVis = onVisibility
        drawFrame()

        recordStream = canvas.captureStream(settings.videoFramerate)
        cropStreamRef.current = recordStream
      } else {
        recordStream = desktopStream
      }

      const combinedStream = new MediaStream()
      recordStream.getVideoTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t))

      // Carry the desktop audio track when system-audio capture succeeded
      // (only present on the original desktopStream, not on the cropped one).
      if (useSystemAudio) {
        desktopStream.getAudioTracks().forEach(tr => combinedStream.addTrack(tr))
      }

      if (useMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          micStreamRef.current = micStream
          micStream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
          setMicActive(true)
        } catch {
          setStatus({ text: t('recording.micUnavailable'), type: 'info' })
        }
      }

      // Keep original desktop stream ref for cleanup
      streamRef.current = desktopStream
      stopGuardRef.current = false
      pendingWritesCountRef.current = 0

      // Initialize temp file for crash-safe recording
      const initResult = await window.electronAPI.recording.initTemp(mimeType, source.name)
      if (!initResult.success) {
        setStatus({ text: initResult.error || 'Ge\u00e7ici dosya olu\u015fturulamad\u0131', type: 'error' })
        cleanupStreams()
        return
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITRATE[settings.videoQuality],
        audioBitsPerSecond: 128_000
      })

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size === 0) return
        // Stream chunks straight to disk via main; do NOT accumulate them
        // in renderer memory \u2014 for hour-long recordings that would balloon
        // RAM by hundreds of MB while the same data is also on disk.
        pendingWritesCountRef.current++
        ;(async () => {
          try {
            const buffer = await e.data.arrayBuffer()
            await window.electronAPI.recording.writeChunk(buffer)
          } catch (err) {
            console.error('Failed to write chunk to disk:', err)
          } finally {
            pendingWritesCountRef.current = Math.max(0, pendingWritesCountRef.current - 1)
          }
        })()
      }

      recorder.onerror = () => {
        setStatus({ text: t('recording.errorDuring'), type: 'error' })
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
      const msg = err instanceof Error ? err.message : t('recording.cantStart')
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
      // Flush the in-flight timeslice so the on-disk file ends at the
      // pause boundary instead of carrying half-buffered frames into the
      // next resume.
      try { recorder.requestData() } catch { /* not always supported */ }
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
    // Stop crop video element + detach visibility listener / interval
    if (cropVideoRef.current) {
      const v = cropVideoRef.current as HTMLVideoElement & {
        _onVis?: () => void
        _interval?: ReturnType<typeof setInterval> | null
      }
      if (v._onVis) document.removeEventListener('visibilitychange', v._onVis)
      if (v._interval) clearInterval(v._interval)
      cropVideoRef.current.pause()
      cropVideoRef.current.srcObject = null
      cropVideoRef.current = null
    }
    // Stop the canvas captureStream (its tracks are independent of the
    // desktop stream and otherwise leak the video frame loop).
    if (cropStreamRef.current) {
      cropStreamRef.current.getTracks().forEach(t => t.stop())
      cropStreamRef.current = null
    }
    cropRegionRef.current = null
    cropScaleFactorRef.current = 1

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
    // Guard against double-stop: stop() may be triggered from compact bar,
    // panel button, hotkey, and tray simultaneously. The second call is a
    // no-op on MediaRecorder but the second `await Promise(onstop)` would
    // hang forever because onstop only fires once per stop.
    if (stopGuardRef.current) return
    stopGuardRef.current = true

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

    // Wait for final dataavailable + onstop, with a bounded timeout so a
    // misbehaving recorder can't deadlock the UI.
    await new Promise<void>(resolve => {
      let resolved = false
      const done = () => { if (!resolved) { resolved = true; resolve() } }
      recorder.onstop = done
      try { recorder.stop() } catch { done() }
      setTimeout(done, 5000)
    })

    // Drain pending chunk writes (also bounded — disk could be slow but
    // we shouldn't wait forever).
    const drainStart = Date.now()
    while (pendingWritesCountRef.current > 0 && Date.now() - drainStart < 5000) {
      await new Promise(r => setTimeout(r, 50))
    }
    pendingWritesCountRef.current = 0

    cleanupStreams()
    mediaRecorderRef.current = null

    // Finalize: main process closes temp file and shows save dialog
    try {
      const result = await window.electronAPI.recording.finalize(recorder.mimeType)

      if (result.success) {
        setStatus({ text: `${t('recording.saved')} ${result.filePath}`, type: 'success' })
        setSavedFilePath(result.filePath || null)
      } else if (result.error === 'Save cancelled') {
        setStatus({ text: t('recording.saveCancelled'), type: 'info' })
      } else {
        setStatus({ text: `${t('recording.saveError')} ${result.error}`, type: 'error' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('recording.saveFailed')
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
        setStatus({ text: `Link kopyaland\u0131: ${result.url}`, type: 'success' })
      } else {
        setStatus({ text: result.error || 'Upload ba\u015far\u0131s\u0131z', type: 'error' })
      }
    } catch {
      setStatus({ text: 'Upload ba\u015far\u0131s\u0131z', type: 'error' })
    }
    setUploading(false)
  }

  // Compact recording bar
  if (compact && phase === 'recording') {
    return (
      <div className="rec-compact-inner">
        <span className={`rec-dot-sm ${isPaused ? 'rec-paused' : ''}`} />
        <span className="rec-compact-time">{formatTime(elapsed)}</span>
        <button className="rec-compact-btn" onClick={handlePauseResume} title={isPaused ? t('recording.resume') : t('recording.pause')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            {isPaused
              ? <path d="M8 5v14l11-7z"/>
              : <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
            }
          </svg>
        </button>
        <button className="rec-compact-btn rec-compact-stop" onClick={handleStopRecording} title={t('recording.stop')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1"/>
          </svg>
        </button>
        <button
          className={`rec-compact-btn rec-compact-draw ${drawMode ? 'rec-compact-draw-active' : ''}`}
          onClick={handleToggleAnnotation}
          title={drawMode ? t('recording.closeDrawing') : t('recording.drawOnScreen')}
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
      <h2>{t('recording.title')}</h2>

      {phase === 'pick' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p>{t('recording.selectSource')}</p>
            <button className="back-btn" style={{ marginTop: 0, fontSize: '11px', padding: '4px 10px' }} onClick={loadSources}>
              {t('recording.refresh')}
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
            <span className="mic-toggle-label">{t('recording.microphone')}</span>
          </label>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="mode-btn"
              style={{ width: 'auto', padding: '12px 24px', opacity: selectedSource ? 1 : 0.4 }}
              onClick={() => handleStartRecording()}
              disabled={!selectedSource}
            >
              <span className="mode-label">{t('recording.startRecording')}</span>
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
              <span className="mode-label">{t('recording.selectRegion')}</span>
            </button>
          </div>
        </>
      )}

      {phase === 'recording' && (
        <div className="recording-active">
          <div className="recording-indicator">
            <span className={`rec-dot ${isPaused ? 'rec-paused' : ''}`} />
            <span className={`rec-label ${isPaused ? 'rec-label-paused' : ''}`}>
              {isPaused ? t('recording.paused') : t('recording.recording')}
            </span>
            <span className="rec-time">{formatTime(elapsed)}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#888' }}>
            {selectedSource?.name}
            {micActive && <span className="mic-badge">MIC</span>}
          </p>
          <div className="recording-controls">
            <button className="mode-btn rec-control-btn" onClick={handlePauseResume}>
              <span className="mode-label">{isPaused ? t('recording.resume') : t('recording.pause')}</span>
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
              <span className="mode-label">{drawMode ? t('recording.closeDrawing') : t('recording.drawOnScreen')}</span>
            </button>
            <button className="mode-btn rec-control-btn rec-stop-btn" onClick={handleStopRecording}>
              <span className="mode-label">{t('recording.stop')}</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'saving' && (
        <p style={{ color: '#888' }}>{t('recording.saving')}</p>
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
          {uploading ? t('recording.uploading') : t('recording.shareBtn')}
        </button>
      )}

      {phase === 'pick' && (
        <button className="back-btn" onClick={onBack}>
          {t('recording.back')}
        </button>
      )}
    </div>
  )
}
