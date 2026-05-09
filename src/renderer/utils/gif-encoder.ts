/**
 * Minimal GIF89a Encoder — Pure TypeScript, zero dependencies.
 * Supports animated GIF with LZW compression.
 */

import { t } from '../../shared/i18n'

export class GifEncoder {
  private width: number
  private height: number
  private palette: Uint8Array // 768 bytes (256 × RGB)
  private frames: { indices: Uint8Array; delay: number }[] = []

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    // Web-safe palette: 6×6×6 cube = 216 colors + 40 grays
    this.palette = new Uint8Array(768)
    let idx = 0
    for (let r = 0; r < 6; r++)
      for (let g = 0; g < 6; g++)
        for (let b = 0; b < 6; b++) {
          this.palette[idx++] = r * 51
          this.palette[idx++] = g * 51
          this.palette[idx++] = b * 51
        }
    // Fill remaining 40 entries with grays
    for (let i = 0; i < 40; i++) {
      const v = Math.round((i / 39) * 255)
      this.palette[idx++] = v
      this.palette[idx++] = v
      this.palette[idx++] = v
    }
  }

  /** Add a video frame. delay is in milliseconds. */
  addFrame(imageData: ImageData, delay: number = 100): void {
    const { data, width, height } = imageData
    const indices = new Uint8Array(width * height)
    for (let i = 0; i < indices.length; i++) {
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      // Find nearest palette color (6×6×6 cube)
      const ri = Math.min(5, Math.round(r / 51))
      const gi = Math.min(5, Math.round(g / 51))
      const bi = Math.min(5, Math.round(b / 51))
      indices[i] = ri * 36 + gi * 6 + bi
    }
    this.frames.push({ indices, delay })
  }

  /** Encode all frames into a GIF89a byte array. */
  encode(): Uint8Array {
    const buf: number[] = []

    // ── Header ──
    this.str(buf, 'GIF89a')

    // ── Logical Screen Descriptor ──
    this.u16(buf, this.width)
    this.u16(buf, this.height)
    buf.push(0xf7) // GCT flag=1, color-res=7, sort=0, GCT-size=7 (2^(7+1)=256)
    buf.push(0)    // background color index
    buf.push(0)    // pixel aspect ratio

    // ── Global Color Table (256 × 3 bytes) ──
    for (let i = 0; i < 768; i++) buf.push(this.palette[i])

    // ── Netscape Application Extension (infinite loop) ──
    if (this.frames.length > 1) {
      buf.push(0x21, 0xff, 0x0b)
      this.str(buf, 'NETSCAPE2.0')
      buf.push(0x03, 0x01)
      this.u16(buf, 0) // loop count: 0 = infinite
      buf.push(0x00)   // block terminator
    }

    // ── Frames ──
    for (const frame of this.frames) {
      // Graphic Control Extension
      buf.push(0x21, 0xf9, 0x04)
      buf.push(0x00) // packed: disposal=0, no user input, no transparency
      this.u16(buf, Math.max(2, Math.round(frame.delay / 10))) // delay in centiseconds
      buf.push(0x00) // transparent color index
      buf.push(0x00) // block terminator

      // Image Descriptor
      buf.push(0x2c)
      this.u16(buf, 0) // left
      this.u16(buf, 0) // top
      this.u16(buf, this.width)
      this.u16(buf, this.height)
      buf.push(0x00) // packed: no LCT, not interlaced

      // Image Data (LZW compressed)
      const minCodeSize = 8
      buf.push(minCodeSize)
      const lzw = this.lzwEncode(frame.indices, minCodeSize)
      // Write sub-blocks (max 255 bytes each)
      let off = 0
      while (off < lzw.length) {
        const sz = Math.min(255, lzw.length - off)
        buf.push(sz)
        for (let i = 0; i < sz; i++) buf.push(lzw[off + i])
        off += sz
      }
      buf.push(0x00) // block terminator
    }

    // ── Trailer ──
    buf.push(0x3b)

    return new Uint8Array(buf)
  }

  /** LZW encoder following GIF specification. */
  private lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
    const clearCode = 1 << minCodeSize  // 256
    const eoiCode = clearCode + 1       // 257

    let codeSize = minCodeSize + 1      // start at 9 bits
    let nextCode = eoiCode + 1          // 258

    // Dictionary: (prefixCode * 256 + pixelValue) → code
    const dict = new Map<number, number>()

    const resetDict = () => {
      dict.clear()
      codeSize = minCodeSize + 1
      nextCode = eoiCode + 1
    }

    // Bit-packing output
    const out: number[] = []
    let bitBuf = 0
    let bitCount = 0

    const emit = (code: number) => {
      bitBuf |= code << bitCount
      bitCount += codeSize
      while (bitCount >= 8) {
        out.push(bitBuf & 0xff)
        bitBuf >>= 8
        bitCount -= 8
      }
    }

    resetDict()
    emit(clearCode)

    if (indices.length === 0) {
      emit(eoiCode)
      if (bitCount > 0) out.push(bitBuf & 0xff)
      return new Uint8Array(out)
    }

    let current = indices[0]

    for (let i = 1; i < indices.length; i++) {
      const pixel = indices[i]
      const key = current * 256 + pixel

      if (dict.has(key)) {
        current = dict.get(key)!
      } else {
        emit(current)

        if (nextCode < 4096) {
          dict.set(key, nextCode++)
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++
          }
        } else {
          emit(clearCode)
          resetDict()
        }

        current = pixel
      }
    }

    emit(current)
    emit(eoiCode)

    if (bitCount > 0) out.push(bitBuf & 0xff)

    return new Uint8Array(out)
  }

  private u16(buf: number[], val: number) {
    buf.push(val & 0xff, (val >> 8) & 0xff)
  }

  private str(buf: number[], s: string) {
    for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i))
  }
}

/**
 * Wait for a video event with timeout fallback.
 */
function waitForEvent(video: HTMLVideoElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener(event, handler)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      video.removeEventListener(event, handler)
      resolve()
    }, timeoutMs)
    video.addEventListener(event, handler)
  })
}

/**
 * Resolve the real duration of a video.
 * MediaRecorder WebM files often report Infinity until you seek to the end.
 */
async function resolveDuration(video: HTMLVideoElement, maxDuration: number): Promise<number> {
  // If duration is already valid, use it
  if (isFinite(video.duration) && video.duration > 0) {
    return Math.min(video.duration, maxDuration)
  }

  // WebM Infinity duration workaround: seek to a huge time, browser clamps to actual end
  video.currentTime = 1e10
  await waitForEvent(video, 'timeupdate', 3000)

  const realDuration = video.duration
  // Seek back to start
  video.currentTime = 0
  await waitForEvent(video, 'seeked', 2000)

  if (isFinite(realDuration) && realDuration > 0) {
    return Math.min(realDuration, maxDuration)
  }

  // Still unknown — use maxDuration as best effort
  return maxDuration
}

/**
 * Extract frames from a video blob and encode as GIF.
 * Uses play-based capture for reliability with WebM files.
 */
export async function videoToGif(
  videoSource: Blob | string,
  options: { maxWidth?: number; fps?: number; maxDuration?: number } = {},
  onProgress?: (pct: number) => void
): Promise<Uint8Array> {
  const { maxWidth = 480, fps = 10, maxDuration = 15 } = options

  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true

  // If string URL provided (e.g. local-media://), use directly; otherwise create blob URL
  const isBlobSource = typeof videoSource !== 'string'
  const url = isBlobSource ? URL.createObjectURL(videoSource) : videoSource

  try {
    video.src = url

    // Wait for first frame to be ready
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => { cleanup(); resolve() }
      const onError = () => {
        cleanup()
        reject(new Error(`${t('gif.loadFailed')} (code: ${video.error?.code}): ${video.error?.message || t('gif.unknown')}`))
      }
      const timer = setTimeout(() => { cleanup(); reject(new Error(t('gif.loadTimeout'))) }, 15000)
      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoaded)
        video.removeEventListener('error', onError)
        clearTimeout(timer)
      }
      video.addEventListener('loadeddata', onLoaded)
      video.addEventListener('error', onError)
    })

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error(t('gif.noDimensions'))
    }

    const duration = await resolveDuration(video, maxDuration)

    const scale = Math.min(1, maxWidth / video.videoWidth)
    const w = Math.round(video.videoWidth * scale)
    const h = Math.round(video.videoHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    const encoder = new GifEncoder(w, h)
    const frameDelay = Math.round(1000 / fps) // ms between frames
    const totalFrames = Math.ceil(duration * fps)

    // Play-based frame capture — more reliable than seeking for WebM
    video.currentTime = 0
    await waitForEvent(video, 'seeked', 2000)
    video.playbackRate = 4 // 4x speed for faster capture

    let frameCount = 0
    let lastCaptureTime = -1

    await new Promise<void>((resolve) => {
      const captureInterval = frameDelay / video.playbackRate // real-time interval

      const intervalId = setInterval(() => {
        const currentTime = video.currentTime

        // Don't capture same timestamp twice
        if (currentTime === lastCaptureTime) return
        lastCaptureTime = currentTime

        // Stop if we've passed duration or captured enough
        if (currentTime >= duration || frameCount >= totalFrames) {
          clearInterval(intervalId)
          video.pause()
          resolve()
          return
        }

        ctx.drawImage(video, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        encoder.addFrame(imageData, frameDelay)

        frameCount++
        onProgress?.(Math.round((frameCount / totalFrames) * 90))
      }, captureInterval)

      // Safety timeout: don't run forever
      const safetyTimeout = setTimeout(() => {
        clearInterval(intervalId)
        video.pause()
        resolve()
      }, (duration / video.playbackRate + 5) * 1000)

      video.play().then(() => {
        // Playing started
      }).catch(() => {
        // Play failed — fall back to seeking approach
        clearInterval(intervalId)
        clearTimeout(safetyTimeout)
        video.pause()
        resolve()
      })

      // Also stop when video naturally ends
      video.addEventListener('ended', () => {
        clearInterval(intervalId)
        clearTimeout(safetyTimeout)
        resolve()
      }, { once: true })
    })

    // If play-based approach captured no frames, fall back to seeking
    if (frameCount === 0) {
      const seekInterval = 1 / fps
      for (let ts = 0; ts < duration && frameCount < totalFrames; ts += seekInterval) {
        video.currentTime = ts
        await waitForEvent(video, 'seeked', 2000)

        ctx.drawImage(video, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        encoder.addFrame(imageData, frameDelay)

        frameCount++
        onProgress?.(Math.round((frameCount / totalFrames) * 90))
      }
    }

    if (frameCount === 0) {
      throw new Error(t('gif.noFrames'))
    }

    onProgress?.(95)
    const result = encoder.encode()
    onProgress?.(100)
    return result
  } finally {
    if (isBlobSource) URL.revokeObjectURL(url)
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}
