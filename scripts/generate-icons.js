const fs = require('fs')
const path = require('path')

function buildICO(pngPaths) {
  const images = pngPaths.map(p => {
    const buf = fs.readFileSync(p)
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    return { width, height, buffer: buf }
  })

  const headerSize = 6
  const entrySize = 16
  const numImages = images.length

  let offset = headerSize + (entrySize * numImages)
  const entries = []

  for (const img of images) {
    entries.push({
      width: img.width >= 256 ? 0 : img.width,
      height: img.height >= 256 ? 0 : img.height,
      dataSize: img.buffer.length,
      offset: offset
    })
    offset += img.buffer.length
  }

  const buf = Buffer.alloc(offset)
  let pos = 0

  buf.writeUInt16LE(0, pos); pos += 2
  buf.writeUInt16LE(1, pos); pos += 2
  buf.writeUInt16LE(numImages, pos); pos += 2

  for (const e of entries) {
    buf.writeUInt8(e.width, pos); pos += 1
    buf.writeUInt8(e.height, pos); pos += 1
    buf.writeUInt8(0, pos); pos += 1
    buf.writeUInt8(0, pos); pos += 1
    buf.writeUInt16LE(1, pos); pos += 2
    buf.writeUInt16LE(32, pos); pos += 2
    buf.writeUInt32LE(e.dataSize, pos); pos += 4
    buf.writeUInt32LE(e.offset, pos); pos += 4
  }

  for (let i = 0; i < images.length; i++) {
    images[i].buffer.copy(buf, entries[i].offset)
  }

  return buf
}

const tmpDir = path.join(__dirname, '..', 'build', 'tmp-icons')
const sizes = [16, 32, 48, 64, 128, 256]
const pngPaths = sizes.map(s => path.join(tmpDir, `icon-${s}.png`))

const missing = pngPaths.filter(p => !fs.existsSync(p))
if (missing.length > 0) {
  console.error('Missing:', missing)
  process.exit(1)
}

const ico = buildICO(pngPaths)
fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.ico'), ico)
console.log(`build/icon.ico (${ico.length} bytes, ${sizes.length} sizes)`)

fs.copyFileSync(path.join(tmpDir, 'icon-256.png'), path.join(__dirname, '..', 'resources', 'icon.ico'))
console.log('resources/icon.ico updated')

fs.rmSync(tmpDir, { recursive: true, force: true })
console.log('Temp cleaned')
