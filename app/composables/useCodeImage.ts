import { createHighlighterCore, type HighlighterCore, type ThemedToken } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import {
  CODE_LANGUAGE_LOADERS,
  CODE_THEME_LOADERS,
  CODE_FONT_FAMILY,
  drawCodeImage,
  normalizeCode,
  type CodeBackgroundOption,
  type CodeImageResult
} from '~/utils/codeImage'

let highlighterPromise: Promise<HighlighterCore> | null = null
let fontPromise: Promise<boolean> | null = null

async function getHighlighter(theme: string, lang: string): Promise<HighlighterCore> {
  const themeLoader = CODE_THEME_LOADERS[theme] ?? CODE_THEME_LOADERS['github-dark-default']!
  // `text`/`plaintext` are built into shiki core and have no grammar module, and
  // `langs` at construction only accepts grammar modules — so load lazily below.
  const langLoader = CODE_LANGUAGE_LOADERS[lang]

  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [themeLoader()],
      langs: [],
      engine: createJavaScriptRegexEngine()
    })
  }

  let highlighter: HighlighterCore
  try {
    highlighter = await highlighterPromise
  } catch {
    // A failed first build would poison the singleton for the whole session.
    highlighterPromise = null
    throw new Error('Syntax highlighter failed to load')
  }

  if (!highlighter.getLoadedThemes().includes(theme)) {
    await highlighter.loadTheme(themeLoader())
  }
  if (langLoader && !highlighter.getLoadedLanguages().includes(lang)) {
    await highlighter.loadLanguage(langLoader())
  }

  return highlighter
}

/**
 * JetBrains Mono ships locally (public/fonts) so a shared image is not at the
 * mercy of the viewer's OS fonts. Canvas only paints a webfont once the browser
 * has actually loaded it — hence the explicit FontFace + await.
 */
async function ensureCodeFont(): Promise<boolean> {
  if (!fontPromise) {
    fontPromise = (async () => {
      if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') {
        return false
      }
      try {
        const faces = [
          new FontFace('JetBrains Mono', 'url(/fonts/jetbrains-mono-latin.woff2) format("woff2")', { weight: '400 800' }),
          new FontFace('JetBrains Mono', 'url(/fonts/jetbrains-mono-latin-italic.woff2) format("woff2")', { weight: '400 800', style: 'italic' })
        ]
        await Promise.all(faces.map(async (face) => {
          document.fonts.add(face)
          await face.load()
        }))
        return true
      } catch {
        return false
      }
    })()
  }
  return fontPromise
}

export interface CodeImageSettings {
  code: string
  lang: string
  theme: string
  background: CodeBackgroundOption
  fontSize: number
  lineHeight: number
  padding: number
  radius: number
  showLineNumbers: boolean
  showWindowControls: boolean
  title: string
  watermark: string
}

export function useCodeImage() {
  async function render(canvas: HTMLCanvasElement, settings: CodeImageSettings, scale: number): Promise<CodeImageResult> {
    await ensureCodeFont()

    const code = normalizeCode(settings.code)
    const lang = CODE_LANGUAGE_LOADERS[settings.lang] ? settings.lang : 'text'
    const highlighter = await getHighlighter(settings.theme, lang)
    const highlighted = highlighter.codeToTokens(code, { lang, theme: settings.theme })

    return drawCodeImage(
      canvas,
      {
        tokens: highlighted.tokens as ThemedToken[][],
        background: settings.background,
        themeBg: highlighted.bg ?? '#0d1117',
        themeFg: highlighted.fg ?? '#e6edf3',
        fontFamily: CODE_FONT_FAMILY,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        padding: settings.padding,
        radius: settings.radius,
        showLineNumbers: settings.showLineNumbers,
        showWindowControls: settings.showWindowControls,
        title: settings.title,
        watermark: settings.watermark
      },
      scale
    )
  }

  return { render }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas could not be encoded as PNG'))
    }, 'image/png')
  })
}

/** Writes the canvas to the image clipboard. Returns false when the browser refuses. */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
    // Passing the promise (not the awaited blob) keeps Safari's user-gesture check happy.
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': canvasToBlob(canvas) })
    ])
    return true
  } catch {
    return false
  }
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
