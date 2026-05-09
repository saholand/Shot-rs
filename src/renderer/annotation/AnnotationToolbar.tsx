import type { AnnotationTool } from '../../shared/types/annotation'
import { t } from '../../shared/i18n'

interface AnnotationToolbarProps {
  activeTool: AnnotationTool | null
  onToolChange: (tool: AnnotationTool | null) => void
  activeColor: string
  onColorChange: (color: string) => void
  onUndo: () => void
  canUndo: boolean
}

const COLORS = ['#ff0000', '#00cc00', '#0088ff', '#ffcc00', '#ffffff', '#000000']

export function AnnotationToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onUndo,
  canUndo
}: AnnotationToolbarProps) {
  const TOOLS: { id: AnnotationTool; label: string }[] = [
    { id: 'arrow', label: t('toolbar.arrow') },
    { id: 'rectangle', label: t('toolbar.rect') },
    { id: 'text', label: t('toolbar.text') },
    { id: 'blur', label: t('toolbar.blur') }
  ]

  return (
    <div className="annotation-toolbar">
      <div className="toolbar-tools">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'tool-active' : ''}`}
            onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
            title={tool.label}
          >
            {tool.label}
          </button>
        ))}
        <button
          className="tool-btn tool-undo"
          onClick={onUndo}
          disabled={!canUndo}
          title={t('toolbar.undo')}
        >
          {t('toolbar.undo')}
        </button>
      </div>
      <div className="toolbar-colors">
        {COLORS.map(color => (
          <button
            key={color}
            className={`color-btn ${activeColor === color ? 'color-active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}
