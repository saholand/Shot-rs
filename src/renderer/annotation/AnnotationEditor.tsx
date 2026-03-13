import { useRef, useEffect, useState } from 'react'
import type { ExportResult, UploadResult } from '../../shared/types/ipc'
import { useAnnotations } from './hooks/useAnnotations'
import { AnnotationCanvas } from './AnnotationCanvas'
import { AnnotationToolbar } from './AnnotationToolbar'
import { compositeImage } from './render'

interface AnnotationEditorProps {
  imageDataUrl: string
  onCopy: (dataUrl: string) => Promise<ExportResult>
  onSave: (dataUrl: string) => Promise<ExportResult>
  onShare?: (dataUrl: string) => Promise<UploadResult>
  onDone: () => void
}

interface StatusMessage {
  text: string
  type: 'success' | 'error' | 'info'
}

export function AnnotationEditor({ imageDataUrl, onCopy, onSave, onShare, onDone }: AnnotationEditorProps) {
  const { annotations, activeTool, activeColor, addAnnotation, undo, setTool, setColor } = useAnnotations()
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [uploading, setUploading] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => { imageRef.current = img }
    img.src = imageDataUrl
  }, [imageDataUrl])

  const getComposited = (): string => {
    if (!imageRef.current) return imageDataUrl
    return compositeImage(imageRef.current, annotations)
  }

  const handleCopy = async () => {
    const result = await onCopy(getComposited())
    if (result.success) {
      setStatus({ text: 'Panoya kopyalandı!', type: 'success' })
    } else {
      setStatus({ text: result.error || 'Kopyalama başarısız', type: 'error' })
    }
  }

  const handleSave = async () => {
    const result = await onSave(getComposited())
    if (result.success) {
      setStatus({ text: `Kaydedildi: ${result.filePath}`, type: 'success' })
    } else if (result.error !== 'Save cancelled') {
      setStatus({ text: result.error || 'Kaydetme başarısız', type: 'error' })
    }
  }

  const handleShare = async () => {
    if (!onShare) return
    setUploading(true)
    setStatus(null)
    try {
      const result = await onShare(getComposited())
      if (result.success) {
        setStatus({ text: `Link kopyalandı: ${result.url}`, type: 'success' })
      } else {
        setStatus({ text: result.error || 'Upload başarısız', type: 'error' })
      }
    } catch {
      setStatus({ text: 'Upload başarısız', type: 'error' })
    }
    setUploading(false)
  }

  return (
    <div className="annotation-editor">
      <AnnotationToolbar
        activeTool={activeTool}
        onToolChange={setTool}
        activeColor={activeColor}
        onColorChange={setColor}
        onUndo={undo}
        canUndo={annotations.length > 0}
      />
      <AnnotationCanvas
        imageDataUrl={imageDataUrl}
        annotations={annotations}
        activeTool={activeTool}
        activeColor={activeColor}
        onAddAnnotation={addAnnotation}
      />
      <div className="annotation-actions">
        <button className="ann-btn ann-btn-secondary" onClick={onDone}>Kapat</button>
        <div className="annotation-actions-right">
          {onShare && (
            <button
              className="ann-btn ann-btn-share"
              onClick={handleShare}
              disabled={uploading}
            >
              {uploading ? 'Yükleniyor...' : 'Paylaş'}
            </button>
          )}
          <button className="ann-btn ann-btn-primary" onClick={handleCopy}>Kopyala</button>
          <button className="ann-btn ann-btn-primary" onClick={handleSave}>Kaydet</button>
        </div>
      </div>
      {status && (
        <p className={`status-msg status-${status.type}`}>{status.text}</p>
      )}
    </div>
  )
}
