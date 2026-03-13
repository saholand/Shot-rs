import type { RecordingState, RecordingSession } from '../../shared/types/recording'

let session: RecordingSession = {
  sourceId: '',
  sourceName: '',
  state: 'idle',
  startedAt: null,
  micEnabled: false
}

export function getRecordingState(): RecordingState {
  return session.state
}

export function getSession(): RecordingSession {
  return { ...session }
}

export function startSession(sourceId: string, sourceName: string, micEnabled: boolean): void {
  session = {
    sourceId,
    sourceName,
    state: 'recording',
    startedAt: Date.now(),
    micEnabled
  }
}

export function pauseSession(): void {
  if (session.state === 'recording') {
    session.state = 'paused'
  }
}

export function resumeSession(): void {
  if (session.state === 'paused') {
    session.state = 'recording'
  }
}

export function stopSession(): void {
  session.state = 'idle'
  session.startedAt = null
  session.micEnabled = false
}

export function setSaving(): void {
  session.state = 'saving'
}

export function isRecording(): boolean {
  return session.state === 'recording' || session.state === 'paused'
}
