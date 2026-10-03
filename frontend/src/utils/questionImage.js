const MAX_WIDTH = 1280
const MAX_HEIGHT = 1280
const WEBP_QUALITY = 0.82

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image file.'))
    }
    img.src = url
  })
}

/**
 * Compress and convert question images in the browser before upload.
 * Server-side WebP conversion still runs as the final optimization pass.
 */
export async function optimizeQuestionImage(file) {
  if (!file?.type?.startsWith('image/')) {
    return file
  }

  if (file.type === 'image/gif') {
    return file
  }

  try {
    const img = await loadImageElement(file)
    const scale = Math.min(
      1,
      MAX_WIDTH / Math.max(1, img.naturalWidth),
      MAX_HEIGHT / Math.max(1, img.naturalHeight),
    )
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
    })

    if (!blob || blob.size >= file.size) {
      return file
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'question-image'

    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB']
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** power)
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`
}
