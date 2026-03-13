export type RecordingState = 'idle' | 'recording' | 'paused' | 'saving'

export interface RecordingSession {
  sourceId: string
  sourceName: string
  state: RecordingState
  startedAt: number | null
  micEnabled: boolean
}

export interface RecordingResult {
  success: boolean
  error?: string
  filePath?: string
}
