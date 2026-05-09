import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '../../shared/i18n'
import type { AnnotationTool } from '../../shared/types/annotation'
import type { SelectionRegion } from '../../shared/types/ipc'
import type { ToolOptions, StrokeWidth, FontSize, ArrowStyle, EraserSize } from '../annotation/hooks/useAnnotations'

interface FloatingToolbarProps {
  region: SelectionRegion
  activeTool: AnnotationTool | null
  onToolChange: (tool: AnnotationTool | null) => void
  activeColor: string
  recentColors: string[]
  onColorChange: (color: string) => void
  options: ToolOptions
  onOptionsChange: (next: Partial<ToolOptions>) => void
  onUndo: () => void
  canUndo: boolean
  onCopy: () => void
  onSave: () => void
  onShare: () => void
  onClose: () => void
  uploading: boolean
  status: { text: string; type: 'success' | 'error' } | null
}

/**
 * Unified icon set — all outline-stroke 2 with rounded caps & joins.
 * Designed to feel cohesive across the toolbar instead of mixing
 * filled/outline/different stroke weights.
 */
const ToolIcon = ({ id }: { id: string }) => {
  // Common SVG props — keep every icon visually consistent.
  const svg = (children: React.ReactNode) => (
    <svg
      width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      {children}
    </svg>
  )

  switch (id) {
    case 'move':
      return svg(<>
        <path d="M12 5v14M5 12h14" />
        <path d="M9 8l-3 4 3 4M15 8l3 4-3 4M8 9l4-3 4 3M8 15l4 3 4-3" />
      </>)

    case 'pen':
      // A clean pen / fountain-pen nib outline
      return svg(<>
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </>)

    case 'highlight':
      // Highlighter / marker silhouette
      return svg(<>
        <path d="M9 11l-6 6v4h4l6-6" />
        <path d="M22 12l-7-7-8 8 7 7 8-8z" />
        <path d="M14 6l4 4" />
      </>)

    case 'arrow':
      return svg(<>
        <path d="M7 17L17 7" />
        <path d="M17 14V7h-7" />
      </>)

    case 'rectangle':
      return svg(<rect x="4" y="4" width="16" height="16" rx="2" />)

    case 'line':
      return svg(<path d="M5 19L19 5" />)

    case 'text':
      return svg(<>
        <path d="M5 5h14" />
        <path d="M12 5v14" />
        <path d="M9 19h6" />
      </>)

    case 'blur':
      // Stylized 3x3 dots — outline, lighter weight via opacity
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

    case 'eyedropper':
      return svg(<>
        <path d="M2 22l4-4" />
        <path d="M5 19l9-9" />
        <path d="M14 4l6 6-3 3-6-6z" />
      </>)

    case 'eraser':
      // Tilted eraser, outline only
      return svg(<>
        <path d="M19 13l-6-6L4 16l3 3h10l5-5-3-3z" />
        <path d="M9 11l4 4" />
      </>)

    case 'ocr':
      // 4 corner brackets framing characters
      return svg(<>
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

const PRESET_COLORS = ['#ff0000', '#00cc00', '#0088ff', '#ffcc00', '#ffffff', '#000000']

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

const BLUR_INTENSITIES: { value: number; label: string }[] = [
  { value: 6, label: t('toolbar.blurLow') },
  { value: 12, label: t('toolbar.blurMed') },
  { value: 24, label: t('toolbar.blurHigh') }
]

const ERASER_SIZES: { id: EraserSize; label: string; dot: number }[] = [
  { id: 'small', label: t('toolbar.eraserSmall'), dot: 6 },
  { id: 'medium', label: t('toolbar.eraserMed'), dot: 10 },
  { id: 'large', label: t('toolbar.eraserLarge'), dot: 14 }
]

/** Tools that have at least one option in the context sub-bar. */
const TOOLS_WITH_OPTIONS: Set<AnnotationTool> = new Set(['pen', 'highlight', 'arrow', 'rectangle', 'line', 'text', 'blur', 'eraser'])

const TOOLBAR_MIN_WIDTH = 680
const TOOLBAR_HEIGHT = 44
const SUBBAR_HEIGHT = 36
const GAP = 8
const SCREEN_MARGIN = 8

function isHexColor(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim())
}

interface ToolDef {
  id: AnnotationTool
  label: string
  shortcut?: string
}

export function FloatingToolbar({
  region,
  activeTool,
  onToolChange,
  activeColor,
  recentColors,
  onColorChange,
  options,
  onOptionsChange,
  onUndo,
  canUndo,
  onCopy,
  onSave,
  onShare,
  onClose,
  uploading,
  status
}: FloatingToolbarProps) {
  const TOOLS: ToolDef[] = [
    { id: 'move', label: t('toolbar.move'), shortcut: 'V' },
    { id: 'pen', label: t('toolbar.pen'), shortcut: 'P' },
    { id: 'highlight', label: t('toolbar.highlighter'), shortcut: 'H' },
    { id: 'arrow', label: t('toolbar.arrow'), shortcut: 'A' },
    { id: 'rectangle', label: t('toolbar.rect'), shortcut: 'R' },
    { id: 'line', label: t('toolbar.line'), shortcut: 'L' },
    { id: 'text', label: t('toolbar.text'), shortcut: 'T' },
    { id: 'blur', label: t('toolbar.blur'), shortcut: 'B' },
    { id: 'eraser', label: t('toolbar.eraser'), shortcut: 'E' },
    { id: 'eyedropper', label: t('toolbar.eyedropper'), shortcut: 'I' },
    { id: 'ocr', label: t('toolbar.ocr'), shortcut: 'O' }
  ]

  const barRef = useRef<HTMLDivElement>(null)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [hexInput, setHexInput] = useState(activeColor)
  const [measuredWidth, setMeasuredWidth] = useState(TOOLBAR_MIN_WIDTH)

  // Measure actual rendered width so positioning math accounts for fonts /
  // long localized labels.
  useLayoutEffect(() => {
    if (barRef.current) {
      const w = barRef.current.getBoundingClientRect().width
      if (w > 0) setMeasuredWidth(Math.ceil(w))
    }
  }, [activeTool, options.strokeWidth, options.fontSize, options.arrowStyle, options.blurIntensity])

  useEffect(() => { setHexInput(activeColor) }, [activeColor])

  // Close color picker on outside click / escape
  useEffect(() => {
    if (!colorPickerOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.ft-color-popover') && !target.closest('.ft-color-trigger')) {
        setColorPickerOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColorPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [colorPickerOpen])

  // ── Smart positioning ─────────────────────────────────────────────
  const screenH = window.innerHeight
  const screenW = window.innerWidth
  const showSubbar = activeTool ? TOOLS_WITH_OPTIONS.has(activeTool) : false
  const totalHeight = TOOLBAR_HEIGHT + (showSubbar ? SUBBAR_HEIGHT + 4 : 0)
  const tbWidth = Math.min(measuredWidth, screenW - SCREEN_MARGIN * 2)

  // Vertical: prefer below selection, fall back above, finally inside-top
  let top: number
  let placement: 'below' | 'above' | 'inside' = 'below'
  const belowY = region.y + region.height + GAP
  const aboveY = region.y - totalHeight - GAP
  if (belowY + totalHeight <= screenH - SCREEN_MARGIN) {
    top = belowY
    placement = 'below'
  } else if (aboveY >= SCREEN_MARGIN) {
    top = aboveY
    placement = 'above'
  } else {
    // No room above or below — pin inside region near bottom
    top = Math.max(SCREEN_MARGIN, region.y + region.height - totalHeight - GAP)
    placement = 'inside'
  }

  // Horizontal: center on region, clamp to viewport
  let left = region.x + region.width / 2 - tbWidth / 2
  if (left < SCREEN_MARGIN) left = SCREEN_MARGIN
  if (left + tbWidth > screenW - SCREEN_MARGIN) left = screenW - tbWidth - SCREEN_MARGIN

  // Toast: place opposite the toolbar so it doesn't overlap
  const toastTop = placement === 'above'
    ? top - 26
    : top + totalHeight + 4

  // ── Subbar contents ───────────────────────────────────────────────
  const renderStrokeWidthGroup = () => (
    <div className="ft-sub-group">
      <span className="ft-sub-label">{t('toolbar.size')}</span>
      {STROKE_WIDTHS.map(s => (
        <button
          key={s.id}
          className={`ft-stroke-btn ${options.strokeWidth === s.id ? 'ft-stroke-active' : ''}`}
          onClick={() => onOptionsChange({ strokeWidth: s.id })}
          title={s.label}
        >
          <span className="ft-stroke-dot" style={{ width: s.dot, height: s.dot }} />
        </button>
      ))}
    </div>
  )

  const renderFontSizeGroup = () => (
    <div className="ft-sub-group">
      <span className="ft-sub-label">{t('toolbar.fontSize')}</span>
      {FONT_SIZES.map(f => (
        <button
          key={f.id}
          className={`ft-pill ${options.fontSize === f.id ? 'ft-pill-active' : ''}`}
          onClick={() => onOptionsChange({ fontSize: f.id })}
          title={f.label}
        >
          {f.label}
        </button>
      ))}
    </div>
  )

  const renderArrowStyleGroup = () => (
    <div className="ft-sub-group">
      <span className="ft-sub-label">{t('toolbar.arrowHead')}</span>
      {ARROW_STYLES.map(a => (
        <button
          key={a.id}
          className={`ft-pill ${options.arrowStyle === a.id ? 'ft-pill-active' : ''}`}
          onClick={() => onOptionsChange({ arrowStyle: a.id })}
        >
          {a.label}
        </button>
      ))}
    </div>
  )

  const renderBlurGroup = () => (
    <div className="ft-sub-group">
      <span className="ft-sub-label">{t('toolbar.intensity')}</span>
      {BLUR_INTENSITIES.map(b => (
        <button
          key={b.value}
          className={`ft-pill ${options.blurIntensity === b.value ? 'ft-pill-active' : ''}`}
          onClick={() => onOptionsChange({ blurIntensity: b.value })}
        >
          {b.label}
        </button>
      ))}
    </div>
  )

  const renderEraserGroup = () => (
    <div className="ft-sub-group">
      <span className="ft-sub-label">{t('toolbar.eraserSize')}</span>
      {ERASER_SIZES.map(e => (
        <button
          key={e.id}
          className={`ft-stroke-btn ${options.eraserSize === e.id ? 'ft-stroke-active' : ''}`}
          onClick={() => onOptionsChange({ eraserSize: e.id })}
          title={e.label}
        >
          <span className="ft-stroke-dot" style={{ width: e.dot, height: e.dot }} />
        </button>
      ))}
    </div>
  )

  const subbarContent = (() => {
    switch (activeTool) {
      case 'pen':
      case 'highlight':
      case 'rectangle':
      case 'line':
        return renderStrokeWidthGroup()
      case 'arrow':
        return (
          <>
            {renderStrokeWidthGroup()}
            <div className="ft-sub-sep" />
            {renderArrowStyleGroup()}
          </>
        )
      case 'text':
        return renderFontSizeGroup()
      case 'blur':
        return renderBlurGroup()
      case 'eraser':
        return renderEraserGroup()
      default:
        return null
    }
  })()

  const handleHexCommit = () => {
    let v = hexInput.trim()
    if (!v.startsWith('#')) v = '#' + v
    if (isHexColor(v)) {
      onColorChange(v)
      setColorPickerOpen(false)
    } else {
      // Reset to current
      setHexInput(activeColor)
    }
  }

  const subbarTop = placement === 'above'
    ? top + TOOLBAR_HEIGHT + 4
    : top + TOOLBAR_HEIGHT + 4

  return (
    <>
      <div
        ref={barRef}
        className={`ft-bar ft-bar-${placement}`}
        style={{ position: 'fixed', left, top }}
      >
        {/* Tools */}
        <div className="ft-group">
          {/* Pointer / Select — neutral tool, no drawing */}
          <button
            className={`ft-btn ft-tool ${activeTool === null ? 'ft-active' : ''}`}
            onClick={() => onToolChange(null)}
            title={`${t('toolbar.select')} (Esc)`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 2l8 18 2-7 7-2L5 2z" />
            </svg>
          </button>
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              className={`ft-btn ft-tool ${activeTool === tool.id ? 'ft-active' : ''}`}
              onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
              title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            >
              <ToolIcon id={tool.id} />
            </button>
          ))}
        </div>

        <div className="ft-sep" />

        {/* Color row */}
        <div className="ft-group">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              className={`ft-color ${activeColor.toLowerCase() === c.toLowerCase() ? 'ft-color-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
              title={c}
            />
          ))}
          {/* Custom color trigger */}
          <button
            className="ft-color-trigger"
            onClick={() => setColorPickerOpen(o => !o)}
            title={t('toolbar.customColor')}
            style={{ backgroundColor: activeColor }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="ft-sep" />

        {/* Undo */}
        <button className="ft-btn" onClick={onUndo} disabled={!canUndo} title={t('toolbar.undoShortcut')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
            <path d="M7 14l-4-4 4-4" />
          </svg>
        </button>

        <div className="ft-sep" />

        {/* Actions */}
        <div className="ft-group">
          <button className="ft-btn ft-action" onClick={onCopy} title={t('toolbar.copyToClipboard')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button className="ft-btn ft-action" onClick={onSave} title={t('toolbar.saveToFile')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>
          <button
            className="ft-btn ft-action ft-share"
            onClick={onShare}
            disabled={uploading}
            title={t('toolbar.share')}
          >
            {uploading ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            )}
          </button>
        </div>

        <div className="ft-sep" />

        <button className="ft-btn ft-close" onClick={onClose} title={t('toolbar.closeEsc')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Context sub-bar (tool-specific options) */}
      {showSubbar && subbarContent && (
        <div
          className="ft-subbar"
          style={{ position: 'fixed', left, top: subbarTop, width: tbWidth }}
        >
          {subbarContent}
        </div>
      )}

      {/* Custom color picker popover */}
      {colorPickerOpen && (
        <div
          className="ft-color-popover"
          style={{
            position: 'fixed',
            left: Math.min(left + tbWidth - 200, screenW - 208),
            top: placement === 'above' ? top - 138 : top + TOOLBAR_HEIGHT + (showSubbar ? SUBBAR_HEIGHT + 8 : 4)
          }}
        >
          <div className="ft-color-popover-header">{t('toolbar.customColor')}</div>
          <div className="ft-color-popover-row">
            <input
              type="color"
              className="ft-color-native"
              value={isHexColor(activeColor) ? activeColor : '#ff0000'}
              onChange={e => onColorChange(e.target.value)}
            />
            <input
              type="text"
              className="ft-color-hex-input"
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
              <div className="ft-color-popover-sub">{t('toolbar.recent')}</div>
              <div className="ft-color-popover-recent">
                {recentColors.map(c => (
                  <button
                    key={c}
                    className="ft-color"
                    style={{ backgroundColor: c }}
                    onClick={() => { onColorChange(c); setColorPickerOpen(false) }}
                    title={c}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Status toast */}
      {status && (
        <div
          className={`ft-toast ft-toast-${status.type}`}
          style={{
            position: 'fixed',
            left: region.x + region.width / 2,
            top: toastTop
          }}
        >
          {status.text}
        </div>
      )}
    </>
  )
}
