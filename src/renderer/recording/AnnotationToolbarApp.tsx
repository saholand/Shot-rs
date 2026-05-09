import { useState, useEffect, useCallback, useRef } from 'react'
import type { AnnotationTool } from '../../shared/types/annotation'
import type { AnnotationCommand } from '../../shared/types/ipc'
import { t } from '../../shared/i18n'
import './live-annotation.css'

type LiveTool = 'pen' | 'arrow' | 'rectangle' | 'line' | 'highlight' | 'cover' | 'ocr' | 'text'
type StrokeWidth = 'thin' | 'medium' | 'thick'
type FontSize = 'small' | 'medium' | 'large'
type ArrowStyle = 'filled' | 'outline'

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

/** Tools that have something to show in the sub-bar. */
const TOOLS_WITH_OPTIONS = new Set<LiveTool>(['pen', 'highlight', 'arrow', 'rectangle', 'line', 'text'])

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
  const [textInput, setTextInput] = useState('')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [hexInput, setHexInput] = useState(activeColor)

  const textInputRef = useRef<HTMLInputElement>(null)
  const colorPopoverRef = useRef<HTMLDivElement>(null)

  const TOOLS: { id: LiveTool; label: string; icon: string; svgCustom?: boolean }[] = [
    { id: 'pen', label: t('toolbar.pen'), icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' },
    { id: 'highlight', label: t('toolbar.highlighter'), icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM5 19v-1.17l9.93-9.93 1.17 1.17L6.17 19H5z' },
    { id: 'arrow', label: t('toolbar.arrow'), icon: 'M12 2l-1.41 1.41L16.17 9H4v2h12.17l-5.58 5.59L12 18l8-8z' },
    { id: 'rectangle', label: t('toolbar.rect'), icon: 'M3 3h18v18H3V3zm2 2v14h14V5H5z' },
    { id: 'line', label: t('toolbar.line'), icon: 'M4.22 19.78l1.42 1.41L20.19 6.64l-1.41-1.42z' },
    { id: 'text', label: t('toolbar.text'), icon: 'M5 4v3h5.5v12h3V7H19V4H5z' },
    { id: 'cover', label: t('liveToolbar.blur'), icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    { id: 'ocr', label: t('toolbar.ocr'), icon: 'ocr', svgCustom: true }
  ]

  const sendCommand = useCallback((command: AnnotationCommand) => {
    window.annotationOverlayAPI.sendCommand(command)
  }, [])

  const handleToolChange = useCallback((tool: AnnotationTool | null) => {
    setActiveTool(tool)
    if (tool) sendCommand({ type: 'set-tool', tool })
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

  // Sync hex input with active color when picker opens
  useEffect(() => { setHexInput(activeColor) }, [activeColor])

  // Close color picker on outside click / escape
  useEffect(() => {
    if (!colorPickerOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.la-color-popover') && !target.closest('.la-color-trigger')) {
        setColorPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [colorPickerOpen])

  // Keyboard shortcuts — block all other keys to prevent visual artifacts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTool === 'text' && document.activeElement === textInputRef.current) return
      const inHex = document.activeElement?.classList.contains('la-color-hex-input')
      if (inHex) return

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); e.stopPropagation()
        handleUndo()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        if (colorPickerOpen) { setColorPickerOpen(false); return }
        handleCloseDraw()
        return
      }
      e.preventDefault(); e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleUndo, handleCloseDraw, activeTool, colorPickerOpen])

  // Send initial state to canvas on mount
  useEffect(() => {
    sendCommand({ type: 'set-tool', tool: 'pen' })
    sendCommand({ type: 'set-color', color: '#ff0000' })
    sendCommand({ type: 'set-stroke-width', value: 'medium' })
    sendCommand({ type: 'set-font-size', value: 'medium' })
    sendCommand({ type: 'set-arrow-style', value: 'filled' })
  }, [sendCommand])

  const handleHexCommit = () => {
    let v = hexInput.trim()
    if (!v.startsWith('#')) v = '#' + v
    if (isHexColor(v)) {
      handleColorChange(v)
      setColorPickerOpen(false)
    } else {
      setHexInput(activeColor)
    }
  }

  // Sub-bar content per tool
  const showSubbar = activeTool ? TOOLS_WITH_OPTIONS.has(activeTool as LiveTool) : false

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
      default:
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

        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`la-btn ${activeTool === tool.id ? 'la-btn-active' : ''}`}
            onClick={() => handleToolChange(activeTool === tool.id ? null : tool.id)}
            title={tool.label}
          >
            {tool.svgCustom ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 17h7" strokeWidth="2.5"/>
                <path d="M17.5 14v7" strokeWidth="2.5"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d={tool.icon} />
              </svg>
            )}
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
        <button
          className="la-color-trigger"
          onClick={() => setColorPickerOpen(o => !o)}
          title={t('toolbar.customColor')}
          style={{ backgroundColor: activeColor }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
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

      {/* ── Custom color popover ──────────────────────────── */}
      {colorPickerOpen && (
        <div ref={colorPopoverRef} className="la-color-popover">
          <div className="la-color-popover-header">{t('toolbar.customColor')}</div>
          <div className="la-color-popover-row">
            <input
              type="color"
              className="la-color-native"
              value={isHexColor(activeColor) ? activeColor : '#ff0000'}
              onChange={e => handleColorChange(e.target.value)}
            />
            <input
              type="text"
              className="la-color-hex-input"
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') handleHexCommit()
                if (e.key === 'Escape') setColorPickerOpen(false)
              }}
              onBlur={handleHexCommit}
              placeholder="#RRGGBB"
              spellCheck={false}
              autoFocus
            />
          </div>
          {recentColors.length > 0 && (
            <>
              <div className="la-color-popover-sub">{t('toolbar.recent')}</div>
              <div className="la-color-popover-recent">
                {recentColors.map(c => (
                  <button
                    key={c}
                    className="la-color"
                    style={{ background: c }}
                    onClick={() => { handleColorChange(c); setColorPickerOpen(false) }}
                    title={c}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
