import type { AnnotationTool } from '../../shared/types/annotation'

// Live annotation tools
type LiveTool = 'pen' | 'arrow' | 'rectangle' | 'line' | 'highlight' | 'cover'

const TOOLS: { id: LiveTool; label: string; icon: string }[] = [
  { id: 'pen', label: 'Kalem', icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' },
  { id: 'highlight', label: 'Fosforlu', icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM5 19v-1.17l9.93-9.93 1.17 1.17L6.17 19H5z' },
  { id: 'arrow', label: 'Ok', icon: 'M12 2l-1.41 1.41L16.17 9H4v2h12.17l-5.58 5.59L12 18l8-8z' },
  { id: 'rectangle', label: 'Kutu', icon: 'M3 3h18v18H3V3zm2 2v14h14V5H5z' },
  { id: 'line', label: 'Çizgi', icon: 'M3.5 18.5l15-15M5.12 20.12l15-15' },
  { id: 'cover', label: 'Gizle', icon: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h4v4H7zm6 0h4v4h-4zM7 13h4v4H7zm6 0h4v4h-4z' }
]

const COLORS = [
  '#ff0000',
  '#4fa3f7',
  '#28a745',
  '#ffc107',
  '#ffffff',
  '#000000'
]

interface Props {
  activeTool: AnnotationTool | null
  onToolChange: (tool: AnnotationTool | null) => void
  activeColor: string
  onColorChange: (color: string) => void
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
  drawMode: boolean
  onCloseDraw: () => void
  onStopRecording: () => void
}

export function LiveAnnotationToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onUndo,
  onClear,
  canUndo,
  drawMode,
  onCloseDraw,
  onStopRecording
}: Props) {
  if (!drawMode) return null

  return (
    <div className="la-toolbar">
      {/* Close draw mode */}
      <button className="la-btn la-btn-close-draw" onClick={onCloseDraw} title="Çizimi Kapat (Esc)">
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
          onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
          title={tool.label}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d={tool.icon} />
          </svg>
        </button>
      ))}

      <div className="la-sep" />

      {/* Eraser (click-to-delete mode) */}
      <button
        className={`la-btn ${activeTool === 'move' ? 'la-btn-active' : ''}`}
        onClick={() => onToolChange(activeTool === 'move' ? null : 'move')}
        title="Silgi (tıkla-sil)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 20H7L3 16l7-7 10 10z" />
          <path d="M6 11l4-4" />
        </svg>
      </button>

      {/* Undo */}
      <button className="la-btn" onClick={onUndo} disabled={!canUndo} title="Geri Al (Ctrl+Z)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
          <path d="M7 14l-4-4 4-4" />
        </svg>
      </button>

      {/* Clear all */}
      <button className="la-btn la-btn-danger" onClick={onClear} title="Tümünü Temizle">
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
          onClick={() => onColorChange(color)}
        />
      ))}

      <div className="la-sep" />

      {/* Stop recording */}
      <button className="la-btn la-btn-stop" onClick={onStopRecording} title="Kaydı Durdur">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1"/>
        </svg>
      </button>
    </div>
  )
}
