import type { SelectionRegion } from '../../shared/types/ipc'

interface SelectionCanvasProps {
  region: SelectionRegion | null
  isSelecting: boolean
  hideHint?: boolean
}

export function SelectionCanvas({ region, isSelecting, hideHint }: SelectionCanvasProps) {
  if (!region || (region.width < 2 && region.height < 2)) {
    return <div className="overlay-dim overlay-dim-full" />
  }

  const { x, y, width, height } = region

  return (
    <>
      {/* Dim areas */}
      <div className="overlay-dim" style={{ top: 0, left: 0, right: 0, height: y }} />
      <div className="overlay-dim" style={{ top: y, left: 0, width: x, height }} />
      <div className="overlay-dim" style={{ top: y, left: x + width, right: 0, height }} />
      <div className="overlay-dim" style={{ top: y + height, left: 0, right: 0, bottom: 0 }} />

      {/* Selection border */}
      <div
        className={`selection-border ${isSelecting ? 'selecting' : 'confirmed'}`}
        style={{ left: x, top: y, width, height }}
      />

      {/* Size indicator */}
      <div
        className="selection-size"
        style={{ left: x, top: Math.max(0, y - 24) }}
      >
        {Math.round(width)} x {Math.round(height)}
      </div>

      {/* Hint */}
      {!isSelecting && !hideHint && width > 0 && (
        <div
          className="selection-hint"
          style={{ left: x + width / 2, top: y + height + 8 }}
        >
          ESC ile iptal et
        </div>
      )}
    </>
  )
}
