// Пакет OOXML пишется в zip без сжатия (метод 0): архив крупнее, зато нет
// зависимости от deflate в браузере, а Excel такой пакет читает как обычный.

const encoder = new TextEncoder()

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function write16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true) }
export function write32(view: DataView, offset: number, value: number) { view.setUint32(offset, value, true) }

export function zip(files: Array<{ name: string; content: string }>) {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const localView = new DataView(local.buffer)
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800); write16(localView, 8, 0)
    write32(localView, 14, crc); write32(localView, 18, data.length); write32(localView, 22, data.length); write16(localView, 26, name.length)
    local.set(name, 30); local.set(data, 30 + name.length); chunks.push(local)

    const directory = new Uint8Array(46 + name.length)
    const directoryView = new DataView(directory.buffer)
    write32(directoryView, 0, 0x02014b50); write16(directoryView, 4, 20); write16(directoryView, 6, 20); write16(directoryView, 8, 0x0800); write16(directoryView, 10, 0)
    write32(directoryView, 16, crc); write32(directoryView, 20, data.length); write32(directoryView, 24, data.length); write16(directoryView, 28, name.length); write32(directoryView, 42, offset)
    directory.set(name, 46); central.push(directory); offset += local.length
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  write32(endView, 0, 0x06054b50); write16(endView, 8, files.length); write16(endView, 10, files.length); write32(endView, 12, centralSize); write32(endView, 16, offset)
  const parts = [...chunks, ...central, end]
  const archive = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let archiveOffset = 0
  for (const part of parts) {
    archive.set(part, archiveOffset)
    archiveOffset += part.length
  }
  return new Blob([archive.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
