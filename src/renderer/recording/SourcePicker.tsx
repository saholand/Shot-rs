import type { DesktopSource } from '../../shared/types/ipc'

interface SourcePickerProps {
  sources: DesktopSource[]
  selectedId: string | null
  onSelect: (source: DesktopSource) => void
  loading: boolean
}

export function SourcePicker({ sources, selectedId, onSelect, loading }: SourcePickerProps) {
  if (loading) {
    return <p className="source-loading">Kaynaklar yükleniyor...</p>
  }

  if (sources.length === 0) {
    return <p className="source-empty">Ekran veya pencere bulunamadı.</p>
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
