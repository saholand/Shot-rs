import { useState, useEffect, useCallback, useRef } from 'react'
import type { AnnotationTool } from '../../shared/types/annotation'
import { t } from '../../shared/i18n'
import './live-annotation.css'

type LiveTool = 'pen' | 'arrow' | 'rectangle' | 'line' | 'highlight' | 'cover' | 'ocr' | 'text'

const COLORS = [
  '#ff0000',
  '#4fa3f7',
  '#28a745',
  '#ffc107',
  '#ffffff',
  '#000000'
]

export function AnnotationToolbarApp() {
  const [activeTool, setActiveTool] = useState<AnnotationTool | null>('pen')
  const [activeColor, setActiveColor] = useState('#ff0000')
  const [textInput, setTextInput] = useState('')
  const textInputRef = useRef<HTMLInputElement>(null)

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

  // Send command to overlay canvas via IPC
  const sendCommand = useCallback((command: { type: string; tool?: string; color?: string; text?: string }) => {
    window.annotationOverlayAPI.sendCommand(command as any)
  }, [])

  const handleToolChange = useCallback((tool: AnnotationTool | null) => {
    setActiveTool(tool)
    if (tool) {
      sendCommand({ type: 'set-tool', tool })
    }
  }, [sendCommand])

  const handleColorChange = useCallback((color: string) => {
    setActiveColor(color)
    sendCommand({ type: 'set-color', color })
  }, [sendCommand])

  const handleUndo = useCallback(() => {
    sendCommand({ type: 'undo' })
  }, [sendCommand])

  const handleClear = useCallback(() => {
    sendCommand({ type: 'clear' })
  }, [sendCommand])

  const handleCloseDraw = useCallback(() => {
    window.annotationOverlayAPI.toggle()
  }, [])

  const handleStopRecording = useCallback(() => {
    window.annotationOverlayAPI.stopRecording()
  }, [])

  const handleTextSubmit = useCallback(() => {
    const trimmed = textInput.trim()
    if (!trimmed) return
    sendCommand({ type: 'add-text', text: trimmed, color: activeColor })
    setTextInput('')
  }, [textInput, activeColor, sendCommand])

  // Focus text input when text tool is selected
  useEffect(() => {
    if (activeTool === 'text') {
      setTimeout(() => textInputRef.current?.focus(), 50)
    }
  }, [activeTool])

  // Keyboard shortcuts — only handle known combos, block all others to prevent visual artifacts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Text input is active — let it handle its own events
      if (activeTool === 'text' && document.activeElement === textInputRef.current) return

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        e.stopPropagation()
        handleUndo()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCloseDraw()
        return
      }
      // Block all other keys from creating visual artifacts
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleUndo, handleCloseDraw, activeTool])

  // Send initial tool/color on mount so overlay canvas is in sync
  useEffect(() => {
    sendCommand({ type: 'set-tool', tool: 'pen' })
    sendCommand({ type: 'set-color', color: '#ff0000' })
  }, [sendCommand])

  return (
    <div className="la-toolbar la-toolbar-standalone">
      {/* Close draw mode */}
      <button className="la-btn la-btn-close-draw" onClick={handleCloseDraw} title={t('liveToolbar.closeDrawing')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      <div className="la-sep" />

      {/* Tools */}
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

      {/* Text input — shown when text tool is active */}
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

      {/* Drag (move annotations) */}
      <button
        className={`la-btn ${activeTool === 'drag' ? 'la-btn-active' : ''}`}
        onClick={() => handleToolChange(activeTool === 'drag' ? null : 'drag')}
        title={t('liveToolbar.moveDrag')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 9l-3 3 3 3" />
          <path d="M9 5l3-3 3 3" />
          <path d="M15 19l-3 3-3-3" />
          <path d="M19 9l3 3-3 3" />
          <path d="M2 12h20" />
          <path d="M12 2v20" />
        </svg>
      </button>

      {/* Eraser (click-to-delete mode) */}
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

      {/* Undo */}
      <button className="la-btn" onClick={handleUndo} title={t('liveToolbar.undo')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
          <path d="M7 14l-4-4 4-4" />
        </svg>
      </button>

      {/* Clear all */}
      <button className="la-btn la-btn-danger" onClick={handleClear} title={t('liveToolbar.clearAll')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" />
        </svg>
      </button>

      <div className="la-sep" />

      {/* Colors */}
      {COLORS.map(color => (
        <button
          key={color}
          className={`la-color ${activeColor === color ? 'la-color-active' : ''}`}
          style={{ background: color }}
          onClick={() => handleColorChange(color)}
        />
      ))}

      <div className="la-sep" />

      {/* Stop recording */}
      <button className="la-btn la-btn-stop" onClick={handleStopRecording} title={t('liveToolbar.stopRecording')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1"/>
        </svg>
      </button>
    </div>
  )
}
