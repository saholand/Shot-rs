import type { DesktopSource } from '../../shared/types/ipc'
import { t } from '../../shared/i18n'

interface SourcePickerProps {
  sources: DesktopSource[]
  selectedId: string | null
  onSelect: (source: DesktopSource) => void
  loading: boolean
}

export function SourcePicker({ sources, selectedId, onSelect, loading }: SourcePickerProps) {
  if (loading) {
    return <p className="source-loading">{t('sourcePicker.loading')}</p>
  }

  if (sources.length === 0) {
    return <p className="source-empty">{t('sourcePicker.empty')}</p>
  }

  return (
    <div className="source-grid">
      {sources.map(source => (
        <button
          key={source.id}
          className={`source-item ${selectedId === source.id ? 'source-selected' : ''}`}
          onClick={() => onSelect(source)}
        >
          <img
            className="source-thumb"
            src={source.thumbnailDataUrl}
            alt={source.name}
          />
          <span className="source-name">{source.name}</span>
        </button>
      ))}
    </div>
  )
}
