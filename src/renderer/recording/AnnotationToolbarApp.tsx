import { useState, useEffect, useCallback, useRef } from 'react'
import type { AnnotationTool } from '../../shared/types/annotation'
import type { AnnotationCommand } from '../../shared/types/ipc'
import { t } from '../../shared/i18n'
import './live-annotation.css'

type LiveTool = 'pen' | 'arrow' | 'rectangle' | 'line' | 'highlight' | 'cover' | 'ocr' | 'text'
type StrokeWidth = 'thin' | 'medium' | 'thick'
type FontSize = 'small' | 'medium' | 'large'
type ArrowStyle = 'filled' | 'outline'
type EraserSize = 'small' | 'medium' | 'large'
type HighlighterThickness = 'small' | 'medium' | 'large'
type RippleSize = 'small' | 'medium' | 'large'
type SpotRadius = 'small' | 'medium' | 'large'
type SpotDim = 'low' | 'medium' | 'high'

const PRESET_COLORS = ['#ff0000', '#4fa3f7', '#28a745', '#ffc107', '#ffffff', '#000000']
const RECENT_COLORS_LIMIT = 4

const STROKE_WIDTHS: { id: StrokeWidth; dot: number; label: string }[] = [
  { id: 'thin', dot: 3, label: t('toolbar.thin') },
  { id: 'medium', dot: 5, label: t('toolbar.medium') },
  { id: 'thick', dot: 8, label: t('toolbar.thick') }
]

const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 'small', label: 'S' },
  { id: 'medium', label: 'M' },
  { id: 'large', label: 'L' }
]

const ARROW_STYLES: { id: ArrowStyle; label: string }[] = [
  { id: 'filled', label: t('toolbar.arrowFilled') },
  { id: 'outline', label: t('toolbar.arrowOutline') }
]

const ERASER_SIZES: { id: EraserSize; label: string; dot: number }[] = [
  { id: 'small', label: t('toolbar.eraserSmall'), dot: 6 },
  { id: 'medium', label: t('toolbar.eraserMed'), dot: 10 },
  { id: 'large', label: t('toolbar.eraserLarge'), dot: 14 }
]

/** Tools that have something to show in the sub-bar. Note: in live mode
 *  the eraser is named 'move' for legacy reasons. */
const TOOLS_WITH_OPTIONS = new Set<string>(['pen', 'highlight', 'arrow', 'rectangle', 'line', 'text', 'move'])

function isHexColor(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim())
}

export function AnnotationToolbarApp() {
  const [activeTool, setActiveTool] = useState<AnnotationTool | null>('pen')
  const [activeColor, setActiveColor] = useState('#ff0000')
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>('medium')
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>('filled')
  const [eraserSize, setEraserSize] = useState<EraserSize>('medium')
  const [highlighterEnabled, setHighlighterEnabled] = useState(false)
  const [highlighterThickness, setHighlighterThickness] = useState<HighlighterThickness>('medium')
  const [highlighterMode, setHighlighterMode] = useState<'disc' | 'ring'>('disc')
  const [rippleEnabled, setRippleEnabled] = useState(false)
  const [rippleColor, setRippleColor] = useState('#4fa3f7')
  const [rippleSize, setRippleSize] = useState<RippleSize>('medium')
  const [spotEnabled, setSpotEnabled] = useState(false)
  const [spotRadius, setSpotRadius] = useState<SpotRadius>('medium')
  const [spotDim, setSpotDim] = useState<SpotDim>('medium')
  // Webcam window toggle — fires the same IPC the pick-phase checkbox
  // does. We don't need to read the canonical setting because the user
  // sees the toggled state immediately (window open or not).
  const [webcamOn, setWebcamOn] = useState(false)
  const handleWebcamToggle = useCallback(() => {
    const next = !webcamOn
    setWebcamOn(next)
    window.electronAPI.recording.toggleWebcam(next)
  }, [webcamOn])
  const [textInput, setTextInput] = useState('')

  const textInputRef = useRef<HTMLInputElement>(null)
  const nativeColorRef = useRef<HTMLInputElement>(null)

  const TOOLS: { id: LiveTool; label: string }[] = [
    { id: 'pen', label: t('toolbar.pen') },
    { id: 'highlight', label: t('toolbar.highlighter') },
    { id: 'arrow', label: t('toolbar.arrow') },
    { id: 'rectangle', label: t('toolbar.rect') },
    { id: 'line', label: t('toolbar.line') },
    { id: 'text', label: t('toolbar.text') },
    { id: 'cover', label: t('liveToolbar.blur') },
    { id: 'ocr', label: t('toolbar.ocr') }
  ]

  // Unified outline icon set, matches the screenshot toolbar style
  // (stroke 2, rounded caps/joins).
  const renderToolIcon = (id: LiveTool) => {
    const wrap = (children: React.ReactNode) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    )
    switch (id) {
      case 'pen':
        return wrap(<>
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </>)
      case 'highlight':
        return wrap(<>
          <path d="M9 11l-6 6v4h4l6-6" />
          <path d="M22 12l-7-7-8 8 7 7 8-8z" />
          <path d="M14 6l4 4" />
        </>)
      case 'arrow':
        return wrap(<><path d="M7 17L17 7" /><path d="M17 14V7h-7" /></>)
      case 'rectangle':
        return wrap(<rect x="4" y="4" width="16" height="16" rx="2" />)
      case 'line':
        return wrap(<path d="M5 19L19 5" />)
      case 'text':
        return wrap(<><path d="M5 5h14" /><path d="M12 5v14" /><path d="M9 19h6" /></>)
      case 'cover':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="6" cy="6" r="1.4" opacity="0.4" />
            <circle cx="12" cy="6" r="1.4" opacity="0.65" />
            <circle cx="18" cy="6" r="1.4" opacity="0.4" />
            <circle cx="6" cy="12" r="1.4" opacity="0.65" />
            <circle cx="12" cy="12" r="1.4" opacity="0.95" />
            <circle cx="18" cy="12" r="1.4" opacity="0.65" />
            <circle cx="6" cy="18" r="1.4" opacity="0.4" />
            <circle cx="12" cy="18" r="1.4" opacity="0.65" />
            <circle cx="18" cy="18" r="1.4" opacity="0.4" />
          </svg>
        )
      case 'ocr':
        return wrap(<>
          <path d="M4 8V5h3" />
          <path d="M20 8V5h-3" />
          <path d="M4 16v3h3" />
          <path d="M20 16v3h-3" />
          <path d="M9 9v6" />
          <path d="M14 15v-6" />
          <path d="M9 12h5" />
        </>)
      default:
        return null
    }
  }

  const sendCommand = useCallback((command: AnnotationCommand) => {
    window.annotationOverlayAPI.sendCommand(command)
  }, [])

  const handleToolChange = useCallback((tool: AnnotationTool | null) => {
    setActiveTool(tool)
    // Always notify the canvas — null = "no drawing tool active"
    // (Select / pointer mode). Without this, switching to Select left
    // the canvas stuck on whatever tool was last set.
    sendCommand({ type: 'set-tool', tool })
  }, [sendCommand])

  const handleColorChange = useCallback((color: string) => {
    setActiveColor(color)
    setRecentColors(prev => {
      const lc = color.toLowerCase()
      return [color, ...prev.filter(c => c.toLowerCase() !== lc)].slice(0, RECENT_COLORS_LIMIT)
    })
    sendCommand({ type: 'set-color', color })
  }, [sendCommand])

  const handleStrokeChange = useCallback((value: StrokeWidth) => {
    setStrokeWidth(value)
    sendCommand({ type: 'set-stroke-width', value })
  }, [sendCommand])

  const handleFontChange = useCallback((value: FontSize) => {
    setFontSize(value)
    sendCommand({ type: 'set-font-size', value })
  }, [sendCommand])

  const handleArrowStyleChange = useCallback((value: ArrowStyle) => {
    setArrowStyle(value)
    sendCommand({ type: 'set-arrow-style', value })
  }, [sendCommand])

  const handleEraserSizeChange = useCallback((value: EraserSize) => {
    setEraserSize(value)
    sendCommand({ type: 'set-eraser-size', value })
  }, [sendCommand])

  // Highlighter cursor — toggles a fluorescent overlay disc following the
  // cursor. The disc color tracks the active draw color; thickness has its
  // own sub-bar. Mode picks between 'disc' (full color glow) and 'ring'
  // (thin outline = "smooth cursor" preset).
  const pushHighlighterState = useCallback((
    enabled: boolean, color: string, thickness: HighlighterThickness, mode: 'disc' | 'ring'
  ) => {
    window.electronAPI.recording.setHighlighterCursor({ enabled, color, thickness, mode })
  }, [])

  const handleHighlighterToggle = useCallback(() => {
    const next = !highlighterEnabled
    setHighlighterEnabled(next)
    pushHighlighterState(next, activeColor, highlighterThickness, highlighterMode)
  }, [highlighterEnabled, activeColor, highlighterThickness, highlighterMode, pushHighlighterState])

  const handleHighlighterThicknessChange = useCallback((value: HighlighterThickness) => {
    setHighlighterThickness(value)
    if (highlighterEnabled) {
      window.electronAPI.recording.updateHighlighterCursor({ enabled: true, color: activeColor, thickness: value, mode: highlighterMode })
    }
  }, [highlighterEnabled, activeColor, highlighterMode])

  const handleHighlighterModeChange = useCallback((value: 'disc' | 'ring') => {
    setHighlighterMode(value)
    if (highlighterEnabled) {
      window.electronAPI.recording.updateHighlighterCursor({ enabled: true, color: activeColor, thickness: highlighterThickness, mode: value })
    }
  }, [highlighterEnabled, activeColor, highlighterThickness])

  // Keep the highlighter overlay in sync when the user picks a new color
  useEffect(() => {
    if (highlighterEnabled) {
      window.electronAPI.recording.updateHighlighterCursor({
        enabled: true,
        color: activeColor,
        thickness: highlighterThickness,
        mode: highlighterMode
      })
    }
  }, [activeColor, highlighterEnabled, highlighterThickness, highlighterMode])

  // Combined effects state push: both ripple + spotlight live in one
  // window so we always push the full snapshot on any change.
  const pushEffects = useCallback((
    rippleEn: boolean, rColor: string, rSize: RippleSize,
    spotEn: boolean, sRadius: SpotRadius, sDim: SpotDim
  ) => {
    window.electronAPI.recording.setEffectsState({
      clickRipple: { enabled: rippleEn, color: rColor, size: rSize },
      spotlight: { enabled: spotEn, radius: sRadius, dim: sDim }
    })
  }, [])

  const handleRippleToggle = useCallback(() => {
    const next = !rippleEnabled
    setRippleEnabled(next)
    pushEffects(next, rippleColor, rippleSize, spotEnabled, spotRadius, spotDim)
  }, [rippleEnabled, rippleColor, rippleSize, spotEnabled, spotRadius, spotDim, pushEffects])

  const handleRippleSizeChange = useCallback((value: RippleSize) => {
    setRippleSize(value)
    pushEffects(rippleEnabled, rippleColor, value, spotEnabled, spotRadius, spotDim)
  }, [rippleEnabled, rippleColor, spotEnabled, spotRadius, spotDim, pushEffects])

  const handleRippleColorChange = useCallback((value: string) => {
    setRippleColor(value)
    pushEffects(rippleEnabled, value, rippleSize, spotEnabled, spotRadius, spotDim)
  }, [rippleEnabled, rippleSize, spotEnabled, spotRadius, spotDim, pushEffects])

  const handleSpotToggle = useCallback(() => {
    const next = !spotEnabled
    setSpotEnabled(next)
    pushEffects(rippleEnabled, rippleColor, rippleSize, next, spotRadius, spotDim)
  }, [spotEnabled, rippleEnabled, rippleColor, rippleSize, spotRadius, spotDim, pushEffects])

  const handleSpotRadiusChange = useCallback((value: SpotRadius) => {
    setSpotRadius(value)
    pushEffects(rippleEnabled, rippleColor, rippleSize, spotEnabled, value, spotDim)
  }, [rippleEnabled, rippleColor, rippleSize, spotEnabled, spotDim, pushEffects])

  const handleSpotDimChange = useCallback((value: SpotDim) => {
    setSpotDim(value)
    pushEffects(rippleEnabled, rippleColor, rippleSize, spotEnabled, spotRadius, value)
  }, [rippleEnabled, rippleColor, rippleSize, spotEnabled, spotRadius, pushEffects])

  const handleUndo = useCallback(() => sendCommand({ type: 'undo' }), [sendCommand])
  const handleClear = useCallback(() => sendCommand({ type: 'clear' }), [sendCommand])
  const handleCloseDraw = useCallback(() => window.annotationOverlayAPI.toggle(), [])
  const handleStopRecording = useCallback(() => window.annotationOverlayAPI.stopRecording(), [])

  const handleTextSubmit = useCallback(() => {
    const trimmed = textInput.trim()
    if (!trimmed) return
    sendCommand({ type: 'add-text', text: trimmed, color: activeColor })
    setTextInput('')
  }, [textInput, activeColor, sendCommand])

  // Focus text input when text tool selected
  useEffect(() => {
    if (activeTool === 'text') {
      setTimeout(() => textInputRef.current?.focus(), 50)
    }
  }, [activeTool])

  // Keyboard shortcuts — block all other keys to prevent visual artifacts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTool === 'text' && document.activeElement === textInputRef.current) return

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); e.stopPropagation()
        handleUndo()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        handleCloseDraw()
        return
      }
      e.preventDefault(); e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleUndo, handleCloseDraw, activeTool])

  // Send initial state to canvas on mount
  useEffect(() => {
    sendCommand({ type: 'set-tool', tool: 'pen' })
    sendCommand({ type: 'set-color', color: '#ff0000' })
    sendCommand({ type: 'set-stroke-width', value: 'medium' })
    sendCommand({ type: 'set-font-size', value: 'medium' })
    sendCommand({ type: 'set-arrow-style', value: 'filled' })
  }, [sendCommand])

  // Sub-bar content per tool
  const showSubbar = (activeTool ? TOOLS_WITH_OPTIONS.has(activeTool as LiveTool) : false)
    || highlighterEnabled
    || rippleEnabled
    || spotEnabled

  const renderStroke = () => (
    <div className="la-sub-group">
      <span className="la-sub-label">{t('toolbar.size')}</span>
      {STROKE_WIDTHS.map(s => (
        <button
          key={s.id}
          className={`la-stroke-btn ${strokeWidth === s.id ? 'la-stroke-active' : ''}`}
          onClick={() => handleStrokeChange(s.id)}
          title={s.label}
        >
          <span className="la-stroke-dot" style={{ width: s.dot, height: s.dot }} />
        </button>
      ))}
    </div>
  )

  const renderFont = () => (
    <div className="la-sub-group">
      <span className="la-sub-label">{t('toolbar.fontSize')}</span>
      {FONT_SIZES.map(f => (
        <button
          key={f.id}
          className={`la-pill ${fontSize === f.id ? 'la-pill-active' : ''}`}
          onClick={() => handleFontChange(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )

  const renderArrow = () => (
    <div className="la-sub-group">
      <span className="la-sub-label">{t('toolbar.arrowHead')}</span>
      {ARROW_STYLES.map(a => (
        <button
          key={a.id}
          className={`la-pill ${arrowStyle === a.id ? 'la-pill-active' : ''}`}
          onClick={() => handleArrowStyleChange(a.id)}
        >
          {a.label}
        </button>
      ))}
    </div>
  )

  const renderEraser = () => (
    <div className="la-sub-group">
      <span className="la-sub-label">{t('toolbar.eraserSize')}</span>
      {ERASER_SIZES.map(e => (
        <button
          key={e.id}
          className={`la-stroke-btn ${eraserSize === e.id ? 'la-stroke-active' : ''}`}
          onClick={() => handleEraserSizeChange(e.id)}
          title={e.label}
        >
          <span className="la-stroke-dot" style={{ width: e.dot, height: e.dot }} />
        </button>
      ))}
    </div>
  )

  const HIGHLIGHTER_SIZES: { id: HighlighterThickness; dot: number; label: string }[] = [
    { id: 'small', dot: 6, label: t('liveToolbar.highlightCursorSmall') },
    { id: 'medium', dot: 10, label: t('liveToolbar.highlightCursorMed') },
    { id: 'large', dot: 14, label: t('liveToolbar.highlightCursorLarge') }
  ]

  const RIPPLE_SIZES: { id: RippleSize; dot: number; label: string }[] = [
    { id: 'small', dot: 6, label: t('liveToolbar.rippleSmall') },
    { id: 'medium', dot: 10, label: t('liveToolbar.rippleMed') },
    { id: 'large', dot: 14, label: t('liveToolbar.rippleLarge') }
  ]
  const RIPPLE_COLORS = ['#ff0000', '#4fa3f7', '#28a745', '#ffc107', '#ffffff']

  const SPOT_RADII: { id: SpotRadius; dot: number; label: string }[] = [
    { id: 'small', dot: 6, label: t('liveToolbar.spotSmall') },
    { id: 'medium', dot: 10, label: t('liveToolbar.spotMed') },
    { id: 'large', dot: 14, label: t('liveToolbar.spotLarge') }
  ]
  const SPOT_DIMS: { id: SpotDim; label: string }[] = [
    { id: 'low', label: t('liveToolbar.spotDimLow') },
    { id: 'medium', label: t('liveToolbar.spotDimMed') },
    { id: 'high', label: t('liveToolbar.spotDimHigh') }
  ]
  const renderSpot = () => (
    <>
      <div className="la-sub-group">
        <span className="la-sub-label">{t('liveToolbar.spotRadius')}</span>
        {SPOT_RADII.map(r => (
          <button
            key={r.id}
            className={`la-stroke-btn ${spotRadius === r.id ? 'la-stroke-active' : ''}`}
            onClick={() => handleSpotRadiusChange(r.id)}
            title={r.label}
          >
            <span className="la-stroke-dot" style={{ width: r.dot, height: r.dot }} />
          </button>
        ))}
      </div>
      <div className="la-sub-sep" />
      <div className="la-sub-group">
        <span className="la-sub-label">{t('liveToolbar.spotDim')}</span>
        {SPOT_DIMS.map(d => (
          <button
            key={d.id}
            className={`la-pill ${spotDim === d.id ? 'la-pill-active' : ''}`}
            onClick={() => handleSpotDimChange(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
    </>
  )
  const renderRipple = () => (
    <>
      <div className="la-sub-group">
        <span className="la-sub-label">{t('liveToolbar.rippleSize')}</span>
        {RIPPLE_SIZES.map(s => (
          <button
            key={s.id}
            className={`la-stroke-btn ${rippleSize === s.id ? 'la-stroke-active' : ''}`}
            onClick={() => handleRippleSizeChange(s.id)}
            title={s.label}
          >
            <span className="la-stroke-dot" style={{ width: s.dot, height: s.dot, background: rippleColor }} />
          </button>
        ))}
      </div>
      <div className="la-sub-sep" />
      <div className="la-sub-group">
        <span className="la-sub-label">{t('liveToolbar.rippleColor')}</span>
        {RIPPLE_COLORS.map(c => (
          <button
            key={c}
            className={`la-color ${rippleColor.toLowerCase() === c.toLowerCase() ? 'la-color-active' : ''}`}
            style={{ background: c, width: 16, height: 16 }}
            onClick={() => handleRippleColorChange(c)}
            title={c}
          />
        ))}
      </div>
    </>
  )
  const HIGHLIGHTER_MODES: { id: 'disc' | 'ring'; label: string }[] = [
    { id: 'disc', label: t('liveToolbar.highlightModeDisc') },
    { id: 'ring', label: t('liveToolbar.highlightModeRing') }
  ]
  const renderHighlighterCursor = () => (
    <>
      <div className="la-sub-group">
        <span className="la-sub-label">{t('liveToolbar.highlightCursorSize')}</span>
        {HIGHLIGHTER_SIZES.map(h => (
          <button
            key={h.id}
            className={`la-stroke-btn ${highlighterThickness === h.id ? 'la-stroke-active' : ''}`}
            onClick={() => handleHighlighterThicknessChange(h.id)}
            title={h.label}
          >
            <span className="la-stroke-dot" style={{ width: h.dot, height: h.dot, background: activeColor }} />
          </button>
        ))}
      </div>
      <div className="la-sub-sep" />
      <div className="la-sub-group">
        <span className="la-sub-label">{t('liveToolbar.highlightCursorMode')}</span>
        {HIGHLIGHTER_MODES.map(m => (
          <button
            key={m.id}
            className={`la-pill ${highlighterMode === m.id ? 'la-pill-active' : ''}`}
            onClick={() => handleHighlighterModeChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </>
  )

  const subbar = (() => {
    switch (activeTool) {
      case 'pen':
      case 'highlight':
      case 'rectangle':
      case 'line':
        return renderStroke()
      case 'arrow':
        return (
          <>
            {renderStroke()}
            <div className="la-sub-sep" />
            {renderArrow()}
          </>
        )
      case 'text':
        return renderFont()
      case 'move':
        // Live mode legacy: 'move' is the eraser tool
        return renderEraser()
      default:
        // No tool with options selected — fall back to whichever effect
        // toggle is on, in priority order: ripple > spotlight > highlighter.
        if (rippleEnabled) return renderRipple()
        if (spotEnabled) return renderSpot()
        if (highlighterEnabled) return renderHighlighterCursor()
        return null
    }
  })()

  return (
    <div className="la-toolbar la-toolbar-standalone la-toolbar-tall">
      {/* ── Main row ──────────────────────────────────────── */}
      <div className="la-toolbar-row">
        <button className="la-btn la-btn-close-draw" onClick={handleCloseDraw} title={t('liveToolbar.closeDrawing')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className="la-sep" />

        {/* Pointer / Select — neutral tool, no drawing */}
        <button
          className={`la-btn ${activeTool === null ? 'la-btn-active' : ''}`}
          onClick={() => handleToolChange(null)}
          title={t('liveToolbar.select')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 2l8 18 2-7 7-2L5 2z" />
          </svg>
        </button>

        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`la-btn ${activeTool === tool.id ? 'la-btn-active' : ''}`}
            onClick={() => handleToolChange(activeTool === tool.id ? null : tool.id)}
            title={tool.label}
          >
            {renderToolIcon(tool.id)}
          </button>
        ))}

        {activeTool === 'text' && (
          <input
            ref={textInputRef}
            className="la-text-input"
            type="text"
            placeholder={t('liveToolbar.textPlaceholder')}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleTextSubmit() }
              e.stopPropagation()
            }}
          />
        )}

        <div className="la-sep" />

        <button
          className={`la-btn ${activeTool === 'drag' ? 'la-btn-active' : ''}`}
          onClick={() => handleToolChange(activeTool === 'drag' ? null : 'drag')}
          title={t('liveToolbar.moveDrag')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 9l-3 3 3 3" /><path d="M9 5l3-3 3 3" />
            <path d="M15 19l-3 3-3-3" /><path d="M19 9l3 3-3 3" />
            <path d="M2 12h20" /><path d="M12 2v20" />
          </svg>
        </button>

        <button
          className={`la-btn ${activeTool === 'move' ? 'la-btn-active' : ''}`}
          onClick={() => handleToolChange(activeTool === 'move' ? null : 'move')}
          title={t('liveToolbar.eraser')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 20H7L3 16l7-7 10 10z" />
            <path d="M6 11l4-4" />
          </svg>
        </button>

        <button className="la-btn" onClick={handleUndo} title={t('liveToolbar.undo')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
            <path d="M7 14l-4-4 4-4" />
          </svg>
        </button>

        <button className="la-btn la-btn-danger" onClick={handleClear} title={t('liveToolbar.clearAll')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" />
          </svg>
        </button>

        <div className="la-sep" />

        {/* Colors */}
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            className={`la-color ${activeColor.toLowerCase() === color.toLowerCase() ? 'la-color-active' : ''}`}
            style={{ background: color }}
            onClick={() => handleColorChange(color)}
          />
        ))}
        {/* Recent custom colors (max 4) — inline so they don't push the
            toolbar layout into a third row that overflows the window. */}
        {recentColors.map(c => (
          <button
            key={c}
            className={`la-color la-color-recent ${activeColor.toLowerCase() === c.toLowerCase() ? 'la-color-active' : ''}`}
            style={{ background: c }}
            onClick={() => handleColorChange(c)}
            title={c}
          />
        ))}
        <button
          className="la-color-trigger"
          onClick={() => nativeColorRef.current?.click()}
          title={t('toolbar.customColor')}
          style={{ backgroundColor: activeColor }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <input
          ref={nativeColorRef}
          type="color"
          className="la-color-native-hidden"
          value={isHexColor(activeColor) ? activeColor : '#ff0000'}
          onChange={e => handleColorChange(e.target.value)}
        />

        <div className="la-sep" />

        {/* Highlighter cursor toggle — fluorescent disc follows the
            cursor in the recording, color tracks the active draw color. */}
        <button
          className={`la-btn ${highlighterEnabled ? 'la-btn-active' : ''}`}
          onClick={handleHighlighterToggle}
          title={t('liveToolbar.highlightCursor')}
          style={highlighterEnabled ? { color: activeColor, borderColor: activeColor } : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.55" />
            <circle cx="12" cy="12" r="9" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
          </svg>
        </button>

        {/* Click ripple toggle — expanding circle on every left-click in
            the recording. Color and size are independent of draw color. */}
        <button
          className={`la-btn ${rippleEnabled ? 'la-btn-active' : ''}`}
          onClick={handleRippleToggle}
          title={t('liveToolbar.clickRipple')}
          style={rippleEnabled ? { color: rippleColor, borderColor: rippleColor } : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <circle cx="12" cy="12" r="6" opacity="0.6" />
            <circle cx="12" cy="12" r="10" opacity="0.3" />
          </svg>
        </button>

        {/* Spotlight toggle — dims the recording around the cursor */}
        <button
          className={`la-btn ${spotEnabled ? 'la-btn-active' : ''}`}
          onClick={handleSpotToggle}
          title={t('liveToolbar.spotlight')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" opacity="0.18" />
            <circle cx="12" cy="12" r="4.5" fill="currentColor" opacity="0.95" />
          </svg>
        </button>

        {/* Webcam toggle — opens / closes the draggable camera window */}
        <button
          className={`la-btn ${webcamOn ? 'la-btn-active' : ''}`}
          onClick={handleWebcamToggle}
          title={t('liveToolbar.webcam')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="14" height="12" rx="2" />
            <path d="M16 10l5-3v10l-5-3z" />
          </svg>
        </button>

        <div className="la-sep" />

        <button className="la-btn la-btn-stop" onClick={handleStopRecording} title={t('liveToolbar.stopRecording')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1"/>
          </svg>
        </button>
      </div>

      {/* ── Sub-bar (tool-specific options) ───────────────── */}
      <div className={`la-subbar ${showSubbar ? '' : 'la-subbar-empty'}`}>
        {showSubbar ? subbar : (
          <span className="la-sub-empty-hint">
            {activeTool === 'cover' ? t('liveToolbar.blur')
              : activeTool === 'ocr' ? 'OCR'
              : activeTool === 'move' ? t('liveToolbar.eraser')
              : activeTool === 'drag' ? t('liveToolbar.moveDrag')
              : ''}
          </span>
        )}
      </div>

    </div>
  )
}
