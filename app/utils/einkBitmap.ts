/**
 * Image → e-ink bitmap pipeline.
 *
 * Everything here is pure canvas + typed-array code so the same pixels feed the
 * preview and the exported file: quantise to the panel's own grey ramp first,
 * then hand the device an image whose conversion is the identity.
 */

export type EinkFit = 'cover' | 'contain'
export type EinkDither = 'floyd-steinberg' | 'bayer' | 'none'

export interface EinkPreset {
  id: string
  label: string
  width: number
  height: number
  note: string
}

/** Panel sizes verified against the hardware — portrait, i.e. the panel rotated. */
export const EINK_PRESETS: EinkPreset[] = [
  { id: 'x4', label: 'Xteink X4 / X4 Pro', width: 480, height: 800, note: '4 physical greys, portrait sleep screen' },
  { id: 'x3', label: 'Xteink X3', width: 528, height: 792, note: '4 physical greys, portrait' },
  { id: 'square', label: 'Square 600 × 600', width: 600, height: 600, note: 'generic 1-bit reader panel' },
  { id: 'custom', label: 'Custom size', width: 0, height: 0, note: 'set the width and height yourself' }
]

export const EINK_DITHERS: { id: EinkDither, label: string, hint: string }[] = [
  { id: 'floyd-steinberg', label: 'Floyd–Steinberg', hint: 'error diffusion — best for photos and washes' },
  { id: 'bayer', label: 'Ordered 4×4', hint: 'cross-hatch pattern, keeps edges crisp' },
  { id: 'none', label: 'None (posterise)', hint: 'flat bands — best for line art and logos' }
]

export interface EinkSettings {
  preset: string
  width: number
  height: number
  fit: EinkFit
  /** 0 = keep the left/top edge, 1 = keep the right/bottom edge. Cover only. */
  biasX: number
  biasY: number
  /** Inset in target pixels, contain only. */
  margin: number
  rotate: number
  levels: 2 | 4
  dither: EinkDither
  /** Ink points, -40…40. */
  brightness: number
  /** Multiplier around mid-grey, -50…50. */
  contrast: number
  /** Percentile mapped to paper white; 100 disables the stretch. */
  whitePoint: number
  invert: boolean
}

export const EINK_LIMITS = {
  minSize: 64,
  maxSize: 2400,
  margin: 40,
  bias: 1,
  brightness: 40,
  contrast: 50,
  whitePoint: [80, 100] as const
}

export function greyRamp(levels: 2 | 4): number[] {
  return levels === 2 ? [0, 255] : [0, 85, 170, 255]
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, parsed))
}

/** 24-bit BMP, BI_RGB, bottom-up rows — the format CrossPoint reads. */
export function bmpByteSize(width: number, height: number): number {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  return 54 + rowSize * height
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function einkFileName(stem: string, width: number, height: number, extension: string): string {
  const base = stem
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'eink-wallpaper'
  return `${base}-${width}x${height}.${extension}`
}

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
]

function histograms(luma: Float32Array) {
  const histogram = new Uint32Array(256)
  for (let i = 0; i < luma.length; i++) {
    const bin = Math.min(255, Math.max(0, Math.round(luma[i]!)))
    histogram[bin] = (histogram[bin] ?? 0) + 1
  }
  return histogram
}

function percentileFromHistogram(histogram: Uint32Array, total: number, proportion: number): number {
  const target = total * proportion
  let seen = 0
  for (let bin = 0; bin < 256; bin++) {
    seen += histogram[bin] ?? 0
    if (seen >= target) return bin
  }
  return 255
}

function snapToRamp(value: number, ramp: number[]): number {
  let best = ramp[0]!
  let bestDistance = Number.POSITIVE_INFINITY
  for (const level of ramp) {
    const distance = Math.abs(level - value)
    if (distance < bestDistance) {
      bestDistance = distance
      best = level
    }
  }
  return best
}

/**
 * Tone-map and dither in place. Order matters: stretch the paper to white,
 * then contrast, then brightness, then invert, then quantise.
 */
export function quantiseImageData(imageData: ImageData, settings: EinkSettings): void {
  const { data, width, height } = imageData
  const pixels = width * height
  const luma = new Float32Array(pixels)

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
  }

  let low = 0
  let high = 255
  if (settings.whitePoint < 100) {
    const histogram = histograms(luma)
    low = percentileFromHistogram(histogram, pixels, 0.005)
    high = percentileFromHistogram(histogram, pixels, Math.min(99.9, settings.whitePoint) / 100)
    if (high - low < 8) {
      // A flat or near-empty source cannot be stretched without blowing up noise.
      low = 0
      high = 255
    }
  }

  const scale = 255 / (high - low)
  const factor = 1 + settings.contrast / 100
  const offset = settings.brightness

  for (let p = 0; p < pixels; p++) {
    let value = (luma[p]! - low) * scale
    value = (value - 128) * factor + 128 + offset
    if (settings.invert) value = 255 - value
    luma[p] = Math.min(255, Math.max(0, value))
  }

  const ramp = greyRamp(settings.levels)

  if (settings.dither === 'floyd-steinberg') {
    const step = 255 / (ramp.length - 1)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        const old = luma[index]!
        const quantised = Math.round(old / step) * step
        luma[index] = quantised
        const error = old - quantised
        if (x + 1 < width) luma[index + 1] = luma[index + 1]! + error * 7 / 16
        if (y + 1 < height) {
          const next = index + width
          if (x > 0) luma[next - 1] = luma[next - 1]! + error * 3 / 16
          luma[next] = luma[next]! + error * 5 / 16
          if (x + 1 < width) luma[next + 1] = luma[next + 1]! + error * 1 / 16
        }
      }
    }
  } else if (settings.dither === 'bayer') {
    const step = 255 / (ramp.length - 1)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        const threshold = ((BAYER_4X4[(y % 4) * 4 + (x % 4)] ?? 8) + 0.5) / 16 - 0.5
        const shifted = luma[index]! + threshold * step
        luma[index] = Math.round(shifted / step) * step
      }
    }
  }

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const value = snapToRamp(luma[p]!, ramp)
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
}

export interface EinkRender {
  width: number
  height: number
  imageData: ImageData
}

/**
 * Draw the source into the panel-sized canvas, then quantise it.
 * Cover crops the overflow around the bias point; contain letterboxes on paper white.
 */
export function drawEinkBitmap(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  settings: EinkSettings,
  canvas: HTMLCanvasElement
): EinkRender {
  const width = Math.max(1, Math.round(settings.width))
  const height = Math.max(1, Math.round(settings.height))
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('This browser refused a 2D canvas context.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const quarterTurn = settings.rotate % 180 !== 0
  const uprightWidth = quarterTurn ? sourceHeight : sourceWidth
  const uprightHeight = quarterTurn ? sourceWidth : sourceHeight

  const inset = settings.fit === 'contain' ? Math.min(settings.margin, Math.floor(Math.min(width, height) / 4)) : 0
  const availableWidth = Math.max(1, width - inset * 2)
  const availableHeight = Math.max(1, height - inset * 2)

  const ratio = settings.fit === 'contain'
    ? Math.min(availableWidth / uprightWidth, availableHeight / uprightHeight)
    : Math.max(width / uprightWidth, height / uprightHeight)

  const drawWidth = uprightWidth * ratio
  const drawHeight = uprightHeight * ratio

  let offsetX: number
  let offsetY: number
  if (settings.fit === 'contain') {
    offsetX = (width - drawWidth) / 2
    offsetY = (height - drawHeight) / 2
  } else {
    offsetX = -(drawWidth - width) * settings.biasX
    offsetY = -(drawHeight - height) * settings.biasY
  }

  const baseWidth = quarterTurn ? drawHeight : drawWidth
  const baseHeight = quarterTurn ? drawWidth : drawHeight

  context.save()
  context.translate(offsetX + drawWidth / 2, offsetY + drawHeight / 2)
  context.rotate((settings.rotate * Math.PI) / 180)
  context.drawImage(source, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight)
  context.restore()

  const imageData = context.getImageData(0, 0, width, height)
  quantiseImageData(imageData, settings)
  context.putImageData(imageData, 0, 0)

  return { width, height, imageData }
}

/** 24-bit uncompressed BMP (BI_RGB, bottom-up). Deterministic byte layout. */
export function encodeBmp24(imageData: ImageData): Uint8Array<ArrayBuffer> {
  const { data, width, height } = imageData
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowSize * height
  const buffer = new ArrayBuffer(54 + pixelBytes)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  bytes[0] = 0x42 // 'B'
  bytes[1] = 0x4d // 'M'
  view.setUint32(2, 54 + pixelBytes, true)
  view.setUint32(6, 0, true)
  view.setUint32(10, 54, true)

  view.setUint32(14, 40, true) // BITMAPINFOHEADER
  view.setInt32(18, width, true)
  view.setInt32(22, height, true) // positive height = bottom-up rows
  view.setUint16(26, 1, true) // planes
  view.setUint16(28, 24, true) // bits per pixel
  view.setUint32(30, 0, true) // BI_RGB, no compression
  view.setUint32(34, pixelBytes, true)
  view.setInt32(38, 2835, true) // 72 dpi
  view.setInt32(42, 2835, true)
  view.setUint32(46, 0, true)
  view.setUint32(50, 0, true)

  for (let y = 0; y < height; y++) {
    const sourceRow = (height - 1 - y) * width * 4
    let target = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const index = sourceRow + x * 4
      bytes[target++] = data[index + 2]!
      bytes[target++] = data[index + 1]!
      bytes[target++] = data[index]!
    }
  }

  return bytes
}

/**
 * A synthetic plate that exercises the pipeline: grey wedge, gradient, hairline
 * rules and a dark mass. Used as "Load Sample" so the tool demos without a file.
 */
export function renderSamplePlate(width = 640, height = 900): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return canvas

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  const wedgeTop = height * 0.08
  const wedgeHeight = height * 0.16
  const steps = 8
  for (let i = 0; i < steps; i++) {
    const value = Math.round((i / (steps - 1)) * 255)
    context.fillStyle = `rgb(${value}, ${value}, ${value})`
    context.fillRect((width / steps) * i, wedgeTop, width / steps + 1, wedgeHeight)
  }

  const gradientTop = wedgeTop + wedgeHeight + 24
  const gradient = context.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(1, '#000000')
  context.fillStyle = gradient
  context.fillRect(0, gradientTop, width, height * 0.08)

  const lineTop = gradientTop + height * 0.12
  context.strokeStyle = '#111111'
  for (let i = 0; i < 6; i++) {
    context.lineWidth = 1 + i
    context.beginPath()
    context.moveTo(width * 0.08, lineTop + i * 26)
    context.lineTo(width * 0.92, lineTop + i * 26)
    context.stroke()
  }

  const centreX = width / 2
  const centreY = height * 0.72
  const halo = context.createRadialGradient(centreX, centreY, 10, centreX, centreY, width * 0.4)
  halo.addColorStop(0, '#000000')
  halo.addColorStop(0.55, '#6a6a6a')
  halo.addColorStop(1, '#ffffff')
  context.fillStyle = halo
  context.beginPath()
  context.arc(centreX, centreY, width * 0.4, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#ffffff'
  context.beginPath()
  context.arc(centreX, centreY, width * 0.13, 0, Math.PI * 2)
  context.fill()

  context.strokeStyle = '#000000'
  context.lineWidth = 2
  context.beginPath()
  context.arc(width * 0.78, height * 0.55, width * 0.05, 0, Math.PI * 2)
  context.stroke()

  return canvas
}
