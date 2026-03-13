export interface HistoryEntry {
  id: string
  type: 'screenshot' | 'recording'
  filePath: string
  fileName: string
  timestamp: number
  thumbnailDataUrl?: string
  shareUrl?: string
}
