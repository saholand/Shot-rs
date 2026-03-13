/**
 * generate-icon.js
 * Creates a placeholder build/icon.ico with 16, 32, 48, 256 sizes.
 * Replace build/icon.ico with a real designed icon later.
 *
 * Usage:  node scripts/generate-icon.js
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// Brand color — dark blue-ish
const R = 0x33, G = 0x99, B = 0xff

// ── PNG helper (for 256×256 inside ICO) ──────────────────────────

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const payload = Buffer.concat([t, data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc32(payload), 0)
  return Buffer.concat([len, payload, c])
}

function createPNG(w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.writeUInt8(8, 8)   // bit depth
  ihdr.writeUInt8(6, 9)   // RGBA
  // raw pixel rows: filter(1) + RGBA(4*w) per row
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 4)
    raw[row] = 0 // filter none
    for (let x = 0; x < w; x++) {
      const px = row + 1 + x * 4
      // Simple "S" letter placeholder on solid background
      const inBorder = x < 2 || x >= w - 2 || y < 2 || y >= h - 2
      const cx = x / w, cy = y / h
      const inS =
        (cy > 0.15 && cy < 0.30 && cx > 0.25 && cx < 0.75) || // top bar
        (cy > 0.15 && cy < 0.50 && cx > 0.25 && cx < 0.40) || // top-left vertical
        (cy > 0.42 && cy < 0.58 && cx > 0.25 && cx < 0.75) || // middle bar
        (cy > 0.50 && cy < 0.85 && cx > 0.60 && cx < 0.75) || // bottom-right vertical
        (cy > 0.70 && cy < 0.85 && cx > 0.25 && cx < 0.75)    // bottom bar
      if (inBorder) {
        raw[px] = 0x20; raw[px+1] = 0x60; raw[px+2] = 0xcc; raw[px+3] = 0xff
      } else if (inS) {
        raw[px] = 0xff; raw[px+1] = 0xff; raw[px+2] = 0xff; raw[px+3] = 0xff
      } else {
        raw[px] = R; raw[px+1] = G; raw[px+2] = B; raw[px+3] = 0xff
      }
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ── BMP helper (for 16, 32, 48 inside ICO) ──────────────────────

function createBMPData(w, h) {
  // BITMAPINFOHEADER (40) + pixel data (BGRA) + AND mask
  const hdr = Buffer.alloc(40)
  hdr.writeUInt32LE(40, 0)
  hdr.writeInt32LE(w, 4)
  hdr.writeInt32LE(h * 2, 8) // doubled height for ICO
  hdr.writeUInt16LE(1, 12)
  hdr.writeUInt16LE(32, 14) // 32 bpp

  const pixels = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const off = (y * w + x) * 4
      const inBorder = x < 1 || x >= w - 1 || y < 1 || y >= h - 1
      const cx = x / w, cy = 1 - y / h // BMP is bottom-up
      const inS =
        (cy > 0.15 && cy < 0.30 && cx > 0.25 && cx < 0.75) ||
        (cy > 0.15 && cy < 0.50 && cx > 0.25 && cx < 0.40) ||
        (cy > 0.42 && cy < 0.58 && cx > 0.25 && cx < 0.75) ||
        (cy > 0.50 && cy < 0.85 && cx > 0.60 && cx < 0.75) ||
        (cy > 0.70 && cy < 0.85 && cx > 0.25 && cx < 0.75)
      if (inBorder) {
        pixels[off] = 0xcc; pixels[off+1] = 0x60; pixels[off+2] = 0x20; pixels[off+3] = 0xff
      } else if (inS) {
        pixels[off] = 0xff; pixels[off+1] = 0xff; pixels[off+2] = 0xff; pixels[off+3] = 0xff
      } else {
        pixels[off] = B; pixels[off+1] = G; pixels[off+2] = R; pixels[off+3] = 0xff
      }
    }
  }

  const andRowBytes = Math.ceil(w / 8)
  const andPaddedRow = Math.ceil(andRowBytes / 4) * 4
  const andMask = Buffer.alloc(andPaddedRow * h) // all 0 = fully opaque

  return Buffer.concat([hdr, pixels, andMask])
}

// ── Build ICO ────────────────────────────────────────────────────

const sizes = [16, 32, 48, 256]
const images = sizes.map(s => s === 256 ? createPNG(s, s) : createBMPData(s, s))

// ICONDIR header (6 bytes)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2) // type ICO
header.writeUInt16LE(sizes.length, 4)

// ICONDIRENTRY array
const entriesSize = sizes.length * 16
let dataOffset = 6 + entriesSize
const entries = []
for (let i = 0; i < sizes.length; i++) {
  const e = Buffer.alloc(16)
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0) // 0 means 256
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1)
  e.writeUInt8(0, 2) // palette
  e.writeUInt8(0, 3) // reserved
  e.writeUInt16LE(1, 4) // color planes
  e.writeUInt16LE(32, 6) // bpp
  e.writeUInt32LE(images[i].length, 8)
  e.writeUInt32LE(dataOffset, 12)
  dataOffset += images[i].length
  entries.push(e)
}

const ico = Buffer.concat([header, ...entries, ...images])

const outDir = path.join(__dirname, '..', 'build')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'icon.ico')
fs.writeFileSync(outPath, ico)
console.log(`Created ${outPath} (${ico.length} bytes) with sizes: ${sizes.join(', ')}`)

// Also save 256x256 PNG separately for electron-builder fallback
const pngPath = path.join(outDir, 'icon.png')
fs.writeFileSync(pngPath, images[3])
console.log(`Created ${pngPath} (${images[3].length} bytes)`)
