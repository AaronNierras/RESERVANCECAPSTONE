/**
 * Brave and some Windows setups upload Word/PDF files with a missing
 * extension or as application/octet-stream. Detect the real type from
 * the file bytes and rebuild a File the API can accept.
 */
export async function normalizeDocumentFile(file) {
  if (!file) {
    throw new Error('Choose a Word (.docx) or PDF file.')
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const detected = detectDocumentKind(header, file)

  if (!detected) {
    const name = (file.name || '').toLowerCase()
    if (name.endsWith('.doc') && !name.endsWith('.docx')) {
      throw new Error('Older .doc Word files are not supported. Open the file in Word and save it as .docx, then upload again.')
    }
    throw new Error('Upload a Word (.docx) or PDF file. Brave may hide the file type — pick the real .docx or .pdf file.')
  }

  const safeName = ensureExtension(file.name || `document.${detected.extension}`, detected.extension)
  return new File([file], safeName, {
    type: detected.mime,
    lastModified: file.lastModified || Date.now(),
  })
}

function detectDocumentKind(header, file) {
  const name = String(file.name || '').toLowerCase()
  const mime = String(file.type || '').toLowerCase()

  // PDF starts with %PDF
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return { extension: 'pdf', mime: 'application/pdf' }
  }

  // DOCX is a ZIP package (PK..)
  if (header[0] === 0x50 && header[1] === 0x4b) {
    return {
      extension: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }

  // Old OLE Word .doc
  if (header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0) {
    return null
  }

  if (name.endsWith('.pdf') || mime.includes('pdf')) {
    return { extension: 'pdf', mime: 'application/pdf' }
  }
  if (name.endsWith('.docx') || mime.includes('wordprocessingml') || mime.includes('officedocument.wordprocessingml')) {
    return {
      extension: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  }

  return null
}

function ensureExtension(name, extension) {
  const base = String(name || 'document').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document'
  const lower = base.toLowerCase()
  if (lower.endsWith(`.${extension}`)) return base
  const without = base.replace(/\.[^.]+$/, '')
  return `${without || 'document'}.${extension}`
}
