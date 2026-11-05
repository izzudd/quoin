import type { LanguageRegistration, ThemedToken, ThemeRegistrationRaw } from 'shiki/core'

/**
 * Code-to-image rendering.
 *
 * Shiki is only used for tokenising: the tokens are painted onto a canvas
 * ourselves (one fillText per token) instead of rasterising DOM. That keeps the
 * export pixel-exact, avoids the SVG/foreignObject canvas-taint trap, and lets
 * the preview canvas *be* the exported bitmap.
 */

export const CODE_FONT_FAMILY = '\'JetBrains Mono\', ui-monospace, SFMono-Regular, Menlo, Consolas, \'Liberation Mono\', monospace'

export interface CodeThemeOption {
  id: string
  label: string
  type: 'dark' | 'light'
}

export const CODE_THEMES: CodeThemeOption[] = [
  { id: 'github-dark-default', label: 'GitHub Dark', type: 'dark' },
  { id: 'github-light-default', label: 'GitHub Light', type: 'light' },
  { id: 'one-dark-pro', label: 'One Dark Pro', type: 'dark' },
  { id: 'one-light', label: 'One Light', type: 'light' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', type: 'dark' },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', type: 'light' },
  { id: 'tokyo-night', label: 'Tokyo Night', type: 'dark' },
  { id: 'nord', label: 'Nord', type: 'dark' },
  { id: 'dracula', label: 'Dracula', type: 'dark' },
  { id: 'synthwave-84', label: 'Synthwave \'84', type: 'dark' },
  { id: 'rose-pine', label: 'Rosé Pine', type: 'dark' },
  { id: 'kanagawa-wave', label: 'Kanagawa Wave', type: 'dark' },
  { id: 'everforest-dark', label: 'Everforest', type: 'dark' },
  { id: 'min-light', label: 'Min Light', type: 'light' },
  { id: 'vesper', label: 'Vesper', type: 'dark' },
  { id: 'vitesse-dark', label: 'Vitesse Dark', type: 'dark' }
]

export type CodeThemeLoader = () => Promise<{ default: ThemeRegistrationRaw }>

export const CODE_THEME_LOADERS: Record<string, CodeThemeLoader> = {
  'github-dark-default': () => import('shiki/themes/github-dark-default.mjs'),
  'github-light-default': () => import('shiki/themes/github-light-default.mjs'),
  'one-dark-pro': () => import('shiki/themes/one-dark-pro.mjs'),
  'one-light': () => import('shiki/themes/one-light.mjs'),
  'catppuccin-mocha': () => import('shiki/themes/catppuccin-mocha.mjs'),
  'catppuccin-latte': () => import('shiki/themes/catppuccin-latte.mjs'),
  'tokyo-night': () => import('shiki/themes/tokyo-night.mjs'),
  'nord': () => import('shiki/themes/nord.mjs'),
  'dracula': () => import('shiki/themes/dracula.mjs'),
  'synthwave-84': () => import('shiki/themes/synthwave-84.mjs'),
  'rose-pine': () => import('shiki/themes/rose-pine.mjs'),
  'kanagawa-wave': () => import('shiki/themes/kanagawa-wave.mjs'),
  'everforest-dark': () => import('shiki/themes/everforest-dark.mjs'),
  'min-light': () => import('shiki/themes/min-light.mjs'),
  'vesper': () => import('shiki/themes/vesper.mjs'),
  'vitesse-dark': () => import('shiki/themes/vitesse-dark.mjs')
}

export interface CodeLanguageOption {
  id: string
  label: string
}

export const CODE_LANGUAGES: CodeLanguageOption[] = [
  { id: 'text', label: 'Plain text' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'tsx', label: 'TSX' },
  { id: 'jsx', label: 'JSX' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' },
  { id: 'dart', label: 'Dart' },
  { id: 'csharp', label: 'C#' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'sql', label: 'SQL' },
  { id: 'bash', label: 'Bash' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'toml', label: 'TOML' },
  { id: 'html', label: 'HTML' },
  { id: 'xml', label: 'XML' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'vue', label: 'Vue' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'prisma', label: 'Prisma' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'makefile', label: 'Makefile' },
  { id: 'diff', label: 'Diff' },
  { id: 'ini', label: 'INI' },
  { id: 'lua', label: 'Lua' },
  { id: 'r', label: 'R' },
  { id: 'scala', label: 'Scala' },
  { id: 'elixir', label: 'Elixir' },
  { id: 'haskell', label: 'Haskell' },
  { id: 'zig', label: 'Zig' }
]

export const CODE_LANGUAGE_LOADERS: Record<string, () => Promise<{ default: LanguageRegistration[] }>> = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  prisma: () => import('shiki/langs/prisma.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  makefile: () => import('shiki/langs/makefile.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  scala: () => import('shiki/langs/scala.mjs'),
  elixir: () => import('shiki/langs/elixir.mjs'),
  haskell: () => import('shiki/langs/haskell.mjs'),
  zig: () => import('shiki/langs/zig.mjs')
}

export type CodeBackgroundKind = 'theme' | 'gradient' | 'transparent'

export interface CodeBackgroundOption {
  id: string
  label: string
  kind: CodeBackgroundKind
  stops?: [string, string]
}

export const CODE_BACKGROUNDS: CodeBackgroundOption[] = [
  { id: 'theme', label: 'Theme surface', kind: 'theme' },
  { id: 'graphite', label: 'Graphite', kind: 'gradient', stops: ['#0f172a', '#1f2937'] },
  { id: 'emerald', label: 'Emerald', kind: 'gradient', stops: ['#042f2e', '#065f46'] },
  { id: 'ocean', label: 'Ocean', kind: 'gradient', stops: ['#0c1a3a', '#0e7490'] },
  { id: 'violet', label: 'Violet', kind: 'gradient', stops: ['#1e1b4b', '#7c3aed'] },
  { id: 'sunset', label: 'Sunset', kind: 'gradient', stops: ['#7c2d12', '#be123c'] },
  { id: 'midnight', label: 'Midnight', kind: 'gradient', stops: ['#020617', '#312e81'] },
  { id: 'paper', label: 'Paper', kind: 'gradient', stops: ['#f8fafc', '#dbeafe'] },
  { id: 'peach', label: 'Peach', kind: 'gradient', stops: ['#fff1f2', '#fde68a'] },
  { id: 'transparent', label: 'Transparent', kind: 'transparent' }
]

export interface CodeImageRenderOptions {
  tokens: ThemedToken[][]
  background: CodeBackgroundOption
  themeBg: string
  themeFg: string
  fontFamily?: string
  fontSize: number
  lineHeight: number
  padding: number
  radius: number
  showLineNumbers: boolean
  showWindowControls: boolean
  title: string
  watermark: string
}

export interface CodeImageResult {
  width: number
  height: number
  scale: number
}

const FONT_STYLE_ITALIC = 1
const FONT_STYLE_BOLD = 2
const FONT_STYLE_UNDERLINE = 4

const MAX_CANVAS_DIMENSION = 12000

interface Segment {
  text: string
  color: string
  italic: boolean
  bold: boolean
  underline: boolean
  width: number
}

/** Tabs collapse to two spaces: a canvas has no tab stops of its own. */
export function normalizeCode(code: string): string {
  return code
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\s+$/, '')
}

function fontString(size: number, italic: boolean, bold: boolean, family: string): string {
  return `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${size}px ${family}`
}

function roundRectPath(ctx: CanvasRenderingContext2D, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(width - r, 0)
  ctx.quadraticCurveTo(width, 0, width, r)
  ctx.lineTo(width, height - r)
  ctx.quadraticCurveTo(width, height, width - r, height)
  ctx.lineTo(r, height)
  ctx.quadraticCurveTo(0, height, 0, height - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
}

/** `#rgb` / `#rrggbb` / `rgb()` → `rgba()` at the requested alpha. */
export function withAlpha(color: string, alpha: number): string {
  const value = color.trim()
  if (value.startsWith('#')) {
    let hex = value.slice(1)
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    const int = Number.parseInt(hex.slice(0, 6), 16)
    if (Number.isNaN(int)) return value
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (value.startsWith('rgb(')) {
    return value.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }
  return value
}

/**
 * Paints the highlighted tokens onto `canvas` and returns its logical size.
 * All geometry is computed in CSS pixels and the context is scaled once, so the
 * layout is identical at 1x and 3x.
 */
export function drawCodeImage(
  canvas: HTMLCanvasElement,
  options: CodeImageRenderOptions,
  scale: number
): CodeImageResult {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: 0, height: 0, scale }

  const family = options.fontFamily ?? CODE_FONT_FAMILY
  const fontSize = Math.max(8, options.fontSize)
  const lineHeight = fontSize * Math.max(1, options.lineHeight)
  const padding = Math.max(0, options.padding)
  const lines = options.tokens.length > 0 ? options.tokens : [[]]

  const segments: Segment[][] = lines.map(line => line.map((token) => {
    const style = token.fontStyle ?? 0
    return {
      text: token.content,
      color: token.color ?? options.themeFg,
      italic: (style & FONT_STYLE_ITALIC) !== 0,
      bold: (style & FONT_STYLE_BOLD) !== 0,
      underline: (style & FONT_STYLE_UNDERLINE) !== 0,
      width: 0
    }
  }))

  // Measure every segment once; the widths drive both the layout and the paint.
  for (const line of segments) {
    for (const segment of line) {
      if (!segment.text) continue
      ctx.font = fontString(fontSize, segment.italic, segment.bold, family)
      segment.width = ctx.measureText(segment.text).width
    }
  }

  const lineWidths = segments.map(line => line.reduce((total, segment) => total + segment.width, 0))
  const contentWidth = lineWidths.reduce((max, width) => Math.max(max, width), 0)
  const contentLines = Math.max(1, segments.length)

  ctx.font = fontString(fontSize, false, false, family)
  const charWidth = ctx.measureText('0').width

  const digits = String(contentLines).length
  const gutter = options.showLineNumbers ? Math.round(charWidth * digits + fontSize * 1.4) : 0
  const headerHeight = (options.showWindowControls || options.title.trim())
    ? Math.round(fontSize * 2.9)
    : 0
  const footerHeight = options.watermark.trim() ? Math.round(fontSize * 2) : 0

  const width = Math.max(fontSize * 24, Math.ceil(contentWidth + gutter + padding * 2))
  const height = Math.ceil(padding * 2 + headerHeight + lineHeight * contentLines + footerHeight)

  const largest = Math.max(width, height)
  const finalScale = largest * scale > MAX_CANVAS_DIMENSION
    ? Math.max(1, MAX_CANVAS_DIMENSION / largest)
    : scale

  canvas.width = Math.max(1, Math.round(width * finalScale))
  canvas.height = Math.max(1, Math.round(height * finalScale))

  ctx.setTransform(finalScale, 0, 0, finalScale, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.save()

  if (options.radius > 0 && options.background.kind !== 'transparent') {
    roundRectPath(ctx, width, height, options.radius)
    ctx.clip()
  }

  if (options.background.kind === 'gradient' && options.background.stops) {
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, options.background.stops[0])
    gradient.addColorStop(1, options.background.stops[1])
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  } else if (options.background.kind === 'theme') {
    ctx.fillStyle = options.themeBg
    ctx.fillRect(0, 0, width, height)
  }

  const fg = options.themeFg

  if (headerHeight > 0) {
    let textStart = padding
    if (options.showWindowControls) {
      const radius = Math.max(2, fontSize * 0.3)
      const gap = radius * 2.7
      const dots = ['#ff5f57', '#febc2e', '#28c840']
      dots.forEach((color, index) => {
        ctx.beginPath()
        ctx.arc(padding + radius + index * gap, headerHeight / 2, radius, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })
      textStart = padding + gap * dots.length
    }

    if (options.title.trim()) {
      ctx.font = fontString(fontSize * 0.82, false, false, family)
      ctx.fillStyle = withAlpha(fg, 0.72)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(options.title.trim(), textStart, headerHeight / 2 + fontSize * 0.04)
    }

    ctx.strokeStyle = withAlpha(fg, 0.1)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, headerHeight + 0.5)
    ctx.lineTo(width, headerHeight + 0.5)
    ctx.stroke()
  }

  ctx.textBaseline = 'middle'
  const codeTop = padding + headerHeight

  segments.forEach((line, index) => {
    const y = codeTop + lineHeight * (index + 0.5)

    if (options.showLineNumbers) {
      ctx.font = fontString(fontSize * 0.82, false, false, family)
      ctx.fillStyle = withAlpha(fg, 0.5)
      ctx.textAlign = 'right'
      ctx.fillText(String(index + 1), padding + gutter - fontSize * 0.8, y)
    }

    let x = padding + gutter
    for (const segment of line) {
      if (!segment.text) continue
      ctx.font = fontString(fontSize, segment.italic, segment.bold, family)
      ctx.fillStyle = segment.color
      ctx.textAlign = 'left'
      ctx.fillText(segment.text, x, y)

      if (segment.underline) {
        ctx.fillRect(x, y + fontSize * 0.5, segment.width, Math.max(1, fontSize * 0.06))
      }

      x += segment.width
    }
  })

  if (footerHeight > 0) {
    ctx.font = fontString(fontSize * 0.82, false, false, family)
    ctx.fillStyle = withAlpha(fg, 0.7)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      options.watermark.trim(),
      width - padding,
      height - padding - footerHeight / 2 + fontSize * 0.1
    )
  }

  ctx.restore()

  return { width, height, scale: finalScale }
}

export function codeImageFileName(lang: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
  return `code-${lang || 'snippet'}-${stamp}.png`
}
