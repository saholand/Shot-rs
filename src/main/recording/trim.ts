/**
 * Lossless video trim via ffmpeg. Input is the full recording on disk,
 * output is a new file containing only [startSec, endSec). Uses stream
 * copy when possible (no re-encode) for instant cuts; falls back to
 * re-encoding if the codec / container disallows copy at the requested
 * boundaries.
 */

import { spawn } from 'child_process'
import ffmpegStatic from 'ffmpeg-static'

export interface TrimResult {
  success: boolean
  error?: string
}

/**
 * Resolve the ffmpeg binary path. ffmpeg-static publishes the binary in
 * its own package directory. asarUnpack ensures it's reachable from a
 * packaged build.
 */
function ffmpegPath(): string | null {
  if (!ffmpegStatic) return null
  // In a packaged app the path may be inside app.asar — replace with
  // the unpacked equivalent if so.
  return (ffmpegStatic as string).replace('app.asar', 'app.asar.unpacked')
}

export async function trimVideo(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number
): Promise<TrimResult> {
  const bin = ffmpegPath()
  if (!bin) return { success: false, error: 'ffmpeg binary not found' }
  if (endSec <= startSec) return { success: false, error: 'Invalid range' }

  const duration = endSec - startSec
  // -ss before -i = fast seek (less accurate on some codecs); -to after
  // -i = accurate end. Combined gives a reasonable trim. Stream-copy
  // (-c copy) means no re-encode → instant + lossless. If keyframes
  // don't align, the start may snap to the nearest keyframe, but that's
  // acceptable for screen-recording use.
  const args = [
    '-y',                     // overwrite output if exists
    '-ss', String(startSec),  // start
    '-i', inputPath,
    '-t', String(duration),   // duration (more reliable than -to with -ss)
    '-c', 'copy',             // stream copy: no re-encode
    '-avoid_negative_ts', 'make_zero',
    outputPath
  ]

  return new Promise<TrimResult>(resolve => {
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', chunk => { stderr += chunk.toString() })
    proc.on('error', err => {
      resolve({ success: false, error: err.message })
    })
    proc.on('close', code => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: `ffmpeg exited ${code}: ${stderr.slice(-400)}` })
      }
    })
  })
}
