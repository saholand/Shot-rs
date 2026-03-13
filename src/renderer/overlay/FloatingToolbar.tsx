import type { AnnotationTool } from '../../shared/types/annotation'
import type { SelectionRegion } from '../../shared/types/ipc'

interface FloatingToolbarProps {
  region: SelectionRegion
  activeTool: AnnotationTool | null
  onToolChange: (tool: AnnotationTool | null) => void
  activeColor: string
  onColorChange: (color: string) => void
  onUndo: () => void
  canUndo: boolean
  onCopy: () => void
  onSave: () => void
  onShare: () => void
  onClose: () => void
  uploading: boolean
  status: { text: string; type: 'success' | 'error' } | null
}

// SVG icon paths for each tool
const ToolIcon = ({ id }: { id: string }) => {
  switch (id) {
    case 'move':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 9l-3 3 3 3" /><path d="M9 5l3-3 3 3" /><path d="M15 19l-3 3-3-3" /><path d="M19 9l3 3-3 3" />
          <path d="M2 12h20" /><path d="M12 2v20" />
        </svg>
      )
    case 'pen':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      )
    case 'highlight':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
          <rect x="3" y="19" width="6" height="2" rx="1" fill="currentColor" opacity="0.4" />
        </svg>
      )
    case 'arrow':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19L19 5" /><path d="M12 5h7v7" />
        </svg>
      )
    case 'rectangle':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      )
    case 'line':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M4 20L20 4" />
        </svg>
      )
    case 'text':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 4v3h5.5v12h3V7H19V4z" />
        </svg>
      )
    case 'blur':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="12" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="8" cy="12" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="16" cy="12" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="8" cy="16" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" opacity="0.3" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" opacity="0.3" />
        </svg>
      )
    case 'eyedropper':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 22l1-1h3l9-9" /><path d="M13 7l4 4" /><path d="M10.5 9.5l4 4" />
          <circle cx="18" cy="4" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'ocr':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 17h7" strokeWidth="2.5" /><path d="M17.5 14v7" strokeWidth="2.5" />
        </svg>
      )
    default:
      return null
  }
}

const TOOLS: { id: AnnotationTool; label: string; shortcut?: string }[] = [
  { id: 'move', label: 'Taşı', shortcut: 'V' },
  { id: 'pen', label: 'Kalem', shortcut: 'P' },
  { id: 'highlight', label: 'Fosforlu', shortcut: 'H' },
  { id: 'arrow', label: 'Ok', shortcut: 'A' },
  { id: 'rectangle', label: 'Kutu', shortcut: 'R' },
  { id: 'line', label: 'Çizgi', shortcut: 'L' },
  { id: 'text', label: 'Metin', shortcut: 'T' },
  { id: 'blur', label: 'Bulanık', shortcut: 'B' },
  { id: 'eyedropper', label: 'Damlalık', shortcut: 'I' },
  { id: 'ocr', label: 'OCR', shortcut: 'O' }
]

const COLORS = ['#ff0000', '#00cc00', '#0088ff', '#ffcc00', '#ffffff', '#000000']

export function FloatingToolbar({
  region,
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onUndo,
  canUndo,
  onCopy,
  onSave,
  onShare,
  onClose,
  uploading,
  status
}: FloatingToolbarProps) {
  // Position toolbar below selection, or above if no room
  const toolbarHeight = 44
  const gap = 8
  const screenH = window.innerHeight
  const screenW = window.innerWidth
  const toolbarWidth = 680

  let top = region.y + region.height + gap
  if (top + toolbarHeight > screenH) {
    top = region.y - toolbarHeight - gap
  }
  if (top < 0) top = 4

  let left = region.x + region.width / 2 - toolbarWidth / 2
  if (left < 4) left = 4
  if (left + toolbarWidth > screenW - 4) left = screenW - toolbarWidth - 4

  return (
    <>
      <div className="ft-bar" style={{ position: 'fixed', left, top }}>
        {/* Tools */}
        <div className="ft-group">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`ft-btn ft-tool ${activeTool === t.id ? 'ft-active' : ''}`}
              onClick={() => onToolChange(activeTool === t.id ? null : t.id)}
              title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
            >
              <ToolIcon id={t.id} />
            </button>
          ))}
        </div>

        <div className="ft-sep" />

        {/* Colors */}
        <div className="ft-group">
          {COLORS.map(c => (
            <button
              key={c}
              className={`ft-color ${activeColor === c ? 'ft-color-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
            />
          ))}
        </div>

        <div className="ft-sep" />

        {/* Undo */}
        <button className="ft-btn" onClick={onUndo} disabled={!canUndo} title="Geri Al (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
            <path d="M7 14l-4-4 4-4" />
          </svg>
        </button>

        <div className="ft-sep" />

        {/* Actions */}
        <div className="ft-group">
          <button className="ft-btn ft-action" onClick={onCopy} title="Panoya kopyala (Ctrl+C)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button className="ft-btn ft-action" onClick={onSave} title="Dosyaya kaydet (Ctrl+S)">
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
            title="Paylaş"
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

        <button className="ft-btn ft-close" onClick={onClose} title="Kapat (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status toast */}
      {status && (
        <div
          className={`ft-toast ft-toast-${status.type}`}
          style={{
            position: 'fixed',
            left: region.x + region.width / 2,
            top: top + (top > region.y ? toolbarHeight + gap : -28)
          }}
        >
          {status.text}
        </div>
      )}
    </>
  )
}
