<script setup lang="ts">
import {
  useCodeImage,
  copyCanvasToClipboard,
  downloadCanvas,
  type CodeImageSettings
} from '~/composables/useCodeImage'
import { useToolDraft } from '~/composables/useToolDraft'
import {
  CODE_BACKGROUNDS,
  CODE_LANGUAGES,
  CODE_THEMES,
  codeImageFileName,
  type CodeBackgroundOption
} from '~/utils/codeImage'

interface CodeImageDraft {
  code: string
  lang: string
  theme: string
  background: string
  fontSize: number
  lineHeight: number
  padding: number
  radius: number
  showLineNumbers: boolean
  showWindowControls: boolean
  title: string
  watermark: string
  scale: number
}

const SAMPLE_CODE = `// Snapshot any snippet as a PNG — no upload, no server.
type Snippet = { lang: string, code: string }

export function snapshot({ lang, code }: Snippet) {
  const padding = 40
  const lines = code.split('\\n')

  return {
    lang,
    padding,
    lines: lines.length,
    ready: padding > 0 && lang !== ''
  }
}

snapshot({ lang: 'typescript', code: 'const answer = 42' })`

const DEFAULT_DRAFT: CodeImageDraft = {
  code: '',
  lang: 'typescript',
  theme: 'github-dark-default',
  background: 'theme',
  fontSize: 14,
  lineHeight: 1.6,
  padding: 40,
  radius: 14,
  showLineNumbers: true,
  showWindowControls: true,
  title: '',
  watermark: 'quoin.izzudd.my.id',
  scale: 2
}

const DRAFT_STORAGE_KEY = 'quoin:draft:code-image'
const LEGACY_DRAFT_STORAGE_KEY = 'devpocket:draft:code-image'
const PREVIEW_SCALE = 2

const { state: draft, clearDraft } = useToolDraft<CodeImageDraft>('code-image', () => ({ ...DEFAULT_DRAFT }))
const { render } = useCodeImage()
const toast = useToast()

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const logicalSize = ref({ width: 0, height: 0 })
const rendering = ref(false)
const busyAction = ref<'copy' | 'download' | null>(null)
const errorMessage = ref('')

const themeItems = CODE_THEMES.map(theme => ({ label: theme.label, value: theme.id }))
const languageItems = CODE_LANGUAGES.map(language => ({ label: language.label, value: language.id }))
const qualityItems = [
  { label: '1x — quick', value: 1 },
  { label: '2x — retina', value: 2 },
  { label: '3x — print', value: 3 }
]

const background = computed<CodeBackgroundOption>(() => {
  return CODE_BACKGROUNDS.find(option => option.id === draft.value.background) ?? CODE_BACKGROUNDS[0]!
})

const settings = computed<CodeImageSettings>(() => ({
  code: draft.value.code,
  lang: draft.value.lang,
  theme: draft.value.theme,
  background: background.value,
  fontSize: draft.value.fontSize,
  lineHeight: draft.value.lineHeight,
  padding: draft.value.padding,
  radius: draft.value.radius,
  showLineNumbers: draft.value.showLineNumbers,
  showWindowControls: draft.value.showWindowControls,
  title: draft.value.title,
  watermark: draft.value.watermark
}))

const stats = computed(() => {
  const code = draft.value.code.replace(/\s+$/, '')
  return {
    lines: code ? code.split('\n').length : 0,
    chars: code.length
  }
})

const exportSize = computed(() => ({
  width: Math.round(logicalSize.value.width * draft.value.scale),
  height: Math.round(logicalSize.value.height * draft.value.scale)
}))

const hasCode = computed(() => draft.value.code.trim().length > 0)

function clamp(value: number, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, parsed))
}

/** Drafts are user-editable JSON in localStorage — never trust their shape. */
function sanitizeDraft() {
  const current = draft.value
  if (!CODE_THEMES.some(theme => theme.id === current.theme)) current.theme = DEFAULT_DRAFT.theme
  if (!CODE_LANGUAGES.some(language => language.id === current.lang)) current.lang = DEFAULT_DRAFT.lang
  if (!CODE_BACKGROUNDS.some(option => option.id === current.background)) current.background = DEFAULT_DRAFT.background
  current.fontSize = clamp(current.fontSize, 10, 26, DEFAULT_DRAFT.fontSize)
  current.lineHeight = clamp(current.lineHeight, 1.2, 2.2, DEFAULT_DRAFT.lineHeight)
  current.padding = clamp(current.padding, 12, 96, DEFAULT_DRAFT.padding)
  current.radius = clamp(current.radius, 0, 40, DEFAULT_DRAFT.radius)
  current.scale = [1, 2, 3].includes(current.scale) ? current.scale : DEFAULT_DRAFT.scale
  current.showLineNumbers = current.showLineNumbers !== false
  current.showWindowControls = current.showWindowControls !== false
  if (typeof current.code !== 'string') current.code = ''
  if (typeof current.title !== 'string') current.title = DEFAULT_DRAFT.title
  if (typeof current.watermark !== 'string') current.watermark = DEFAULT_DRAFT.watermark
}

let renderSequence = 0
let renderTimer: ReturnType<typeof setTimeout> | null = null

async function renderPreview() {
  const canvas = previewCanvas.value
  if (!canvas) return

  const sequence = ++renderSequence
  rendering.value = true

  if (!hasCode.value) {
    canvas.width = 0
    canvas.height = 0
    logicalSize.value = { width: 0, height: 0 }
    errorMessage.value = ''
    if (sequence === renderSequence) rendering.value = false
    return
  }

  try {
    const result = await render(canvas, settings.value, PREVIEW_SCALE)
    if (sequence !== renderSequence) return
    logicalSize.value = { width: result.width, height: result.height }
    errorMessage.value = ''
  } catch (error) {
    if (sequence !== renderSequence) return
    errorMessage.value = error instanceof Error ? error.message : 'Rendering failed'
  } finally {
    if (sequence === renderSequence) rendering.value = false
  }
}

function scheduleRender(delay = 140) {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    void renderPreview()
  }, delay)
}

async function buildExportCanvas(): Promise<HTMLCanvasElement | null> {
  if (!hasCode.value) {
    toast.add({
      title: 'Nothing to render',
      description: 'Paste some code first.',
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return null
  }

  const canvas = document.createElement('canvas')
  await render(canvas, settings.value, draft.value.scale)
  return canvas
}

async function copyImage() {
  busyAction.value = 'copy'
  try {
    const canvas = await buildExportCanvas()
    if (!canvas) return

    const copied = await copyCanvasToClipboard(canvas)

    if (copied) {
      toast.add({
        title: 'Image copied',
        description: 'Paste it straight into chat, docs, or a design tool.',
        color: 'success',
        icon: 'i-lucide-image'
      })
      return
    }

    await downloadCanvas(canvas, codeImageFileName(draft.value.lang))
    toast.add({
      title: 'Clipboard blocked by the browser',
      description: 'The PNG was downloaded instead — you can drag it anywhere.',
      color: 'warning',
      icon: 'i-lucide-download'
    })
  } catch (error) {
    toast.add({
      title: 'Could not export the image',
      description: error instanceof Error ? error.message : 'Unknown error',
      color: 'error'
    })
  } finally {
    busyAction.value = null
  }
}

async function downloadImage() {
  busyAction.value = 'download'
  try {
    const canvas = await buildExportCanvas()
    if (!canvas) return
    await downloadCanvas(canvas, codeImageFileName(draft.value.lang))
    toast.add({
      title: 'PNG downloaded',
      description: `${exportSize.value.width}×${exportSize.value.height} pixels`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not export the image',
      description: error instanceof Error ? error.message : 'Unknown error',
      color: 'error'
    })
  } finally {
    busyAction.value = null
  }
}

function shuffleStyle() {
  const theme = CODE_THEMES[Math.floor(Math.random() * CODE_THEMES.length)]!
  const palette = theme.type === 'light'
    ? ['theme', 'paper', 'peach']
    : ['theme', 'graphite', 'emerald', 'ocean', 'violet', 'sunset', 'midnight']
  const backgroundId = palette[Math.floor(Math.random() * palette.length)]!

  draft.value.theme = theme.id
  draft.value.background = backgroundId
}

function loadSample() {
  draft.value.code = SAMPLE_CODE
  draft.value.lang = 'typescript'
  draft.value.title = 'snapshot.ts'
}

function clearAll() {
  clearDraft()
  scheduleRender(0)
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return
    draft.value.code = text
    toast.add({ title: 'Pasted from clipboard', color: 'success' })
  } catch {
    toast.add({
      title: 'Clipboard permission denied',
      description: 'Paste directly into the editor with Ctrl+V / Cmd+V.',
      color: 'warning'
    })
  }
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (loadEvent) => {
    const content = loadEvent.target?.result
    if (typeof content === 'string') {
      draft.value.code = content
      draft.value.title = file.name
      toast.add({ title: 'File loaded', description: file.name, color: 'success' })
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function swatchStyle(option: CodeBackgroundOption): string {
  if (option.kind === 'gradient' && option.stops) {
    return `linear-gradient(135deg, ${option.stops[0]}, ${option.stops[1]})`
  }
  if (option.kind === 'transparent') {
    return 'repeating-conic-gradient(#d4d4d8 0% 25%, #f4f4f5 0% 50%) 50% / 10px 10px'
  }
  return 'linear-gradient(135deg, #27272a, #18181b)'
}

onMounted(async () => {
  sanitizeDraft()

  // First visit: seed the editor with a sample so the preview is never a void.
  // Later visits (and after Clear) keep whatever the draft holds.
  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY)
    if (stored === null) {
      draft.value.code = SAMPLE_CODE
      draft.value.lang = 'typescript'
      draft.value.title = 'snapshot.ts'
    }
  } catch {
    draft.value.code = SAMPLE_CODE
  }

  // Let the webfont finish before the first paint so the first export is not
  // measured against the fallback metrics.
  try {
    await document.fonts.ready
  } catch {
    // ignore
  }
  await renderPreview()
})

watch(draft, () => scheduleRender(), { deep: true })
</script>

<template>
  <div class="space-y-5">
    <ToolHeader
      title="Code to Image"
      description="Paste a snippet, pick a Shiki theme, and copy a syntax-highlighted PNG straight to your clipboard — sized, padded, and ready to share."
      icon="i-lucide-image"
      category="Code Tools"
      badge="Shiki"
      tool-id="code-image"
      :copy-text="draft.code"
      @load-sample="loadSample"
      @clear="clearAll"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-shuffle"
            label="Shuffle style"
            size="sm"
            color="neutral"
            variant="outline"
            @click="shuffleStyle"
          />
          <UButton
            icon="i-lucide-image-plus"
            label="Copy image"
            size="sm"
            color="primary"
            variant="solid"
            :loading="busyAction === 'copy'"
            :disabled="!hasCode"
            @click="copyImage"
          />
          <UButton
            icon="i-lucide-download"
            label="Download PNG"
            size="sm"
            color="primary"
            variant="outline"
            :loading="busyAction === 'download'"
            :disabled="!hasCode"
            @click="downloadImage"
          />
        </div>

        <p class="text-[11px] text-muted font-mono">
          <template v-if="exportSize.width">
            {{ exportSize.width }}×{{ exportSize.height }} px · {{ draft.scale }}x
          </template>
          <template v-else>
            no image yet
          </template>
        </p>
      </template>
    </ToolHeader>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <!-- Source -->
      <div class="flex flex-col rounded-xl border border-default bg-neutral-100/30 dark:bg-neutral-900/40 overflow-hidden min-h-[420px]">
        <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-default bg-neutral-100/60 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-code-xml"
              class="size-4 text-muted"
            />
            <span class="text-xs font-medium text-muted">Source</span>
            <USelect
              v-model="draft.lang"
              :items="languageItems"
              size="xs"
              class="w-40"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-mono text-muted">{{ stats.lines }} ln · {{ stats.chars }} ch</span>
            <UButton
              icon="i-lucide-clipboard-paste"
              label="Paste"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="pasteFromClipboard"
            />
            <label class="cursor-pointer">
              <input
                type="file"
                class="hidden"
                @change="handleFileUpload"
              >
              <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted hover:text-highlighted rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                <UIcon
                  name="i-lucide-upload"
                  class="size-3"
                />
                Upload
              </span>
            </label>
          </div>
        </div>

        <textarea
          v-model="draft.code"
          placeholder="Paste your code here..."
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          class="w-full flex-1 p-3.5 bg-transparent font-mono text-xs leading-relaxed focus:outline-none resize-none text-highlighted"
        />
      </div>

      <!-- Preview -->
      <div class="flex flex-col rounded-xl border border-default bg-neutral-100/30 dark:bg-neutral-900/40 overflow-hidden min-h-[420px]">
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-default bg-neutral-100/60 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-image"
              class="size-4 text-muted"
            />
            <span class="text-xs font-medium text-muted">Live preview</span>
            <span
              v-if="rendering"
              class="text-[11px] text-muted"
            >rendering…</span>
          </div>

          <div class="flex items-center gap-1">
            <span class="text-[11px] font-mono text-muted hidden sm:inline">{{ logicalSize.width }}×{{ logicalSize.height }}</span>
            <UButton
              icon="i-lucide-copy"
              size="xs"
              color="neutral"
              variant="ghost"
              title="Copy image"
              aria-label="Copy image to clipboard"
              :disabled="!hasCode"
              @click="copyImage"
            />
            <UButton
              icon="i-lucide-download"
              size="xs"
              color="neutral"
              variant="ghost"
              title="Download PNG"
              aria-label="Download PNG"
              :disabled="!hasCode"
              @click="downloadImage"
            />
          </div>
        </div>

        <div
          class="relative flex-1 flex items-center justify-center p-5 overflow-auto"
          style="background-image: radial-gradient(circle, rgba(115,115,115,0.18) 1px, transparent 1px); background-size: 16px 16px;"
        >
          <canvas
            v-show="hasCode"
            ref="previewCanvas"
            class="max-w-full max-h-[64vh] object-contain drop-shadow-2xl"
          />

          <div
            v-if="!hasCode"
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-muted px-6"
          >
            <UIcon
              name="i-lucide-terminal"
              class="size-8 opacity-60"
            />
            <p class="text-xs">
              Paste code on the left to see the image.
            </p>
          </div>

          <p
            v-if="errorMessage"
            class="absolute bottom-3 left-3 right-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-mono"
          >
            {{ errorMessage }}
          </p>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="rounded-xl border border-default bg-neutral-100/40 dark:bg-neutral-900/40 p-4 space-y-5">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="text-[11px] font-medium text-muted block mb-1.5">Theme</label>
          <USelect
            v-model="draft.theme"
            :items="themeItems"
            size="sm"
            icon="i-lucide-palette"
            class="w-full"
          />
        </div>

        <div>
          <label class="text-[11px] font-medium text-muted block mb-1.5">PNG quality</label>
          <USelect
            v-model="draft.scale"
            :items="qualityItems"
            size="sm"
            icon="i-lucide-sparkles"
            class="w-full"
          />
        </div>

        <div>
          <label
            for="code-image-title"
            class="text-[11px] font-medium text-muted block mb-1.5"
          >Window title</label>
          <UInput
            id="code-image-title"
            v-model="draft.title"
            size="sm"
            placeholder="snapshot.ts"
            class="w-full"
          />
        </div>

        <div>
          <label
            for="code-image-watermark"
            class="text-[11px] font-medium text-muted block mb-1.5"
          >Watermark</label>
          <UInput
            id="code-image-watermark"
            v-model="draft.watermark"
            size="sm"
            placeholder="leave empty to hide"
            class="w-full"
          />
        </div>
      </div>

      <div>
        <label class="text-[11px] font-medium text-muted block mb-1.5">Background</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in CODE_BACKGROUNDS"
            :key="option.id"
            type="button"
            :title="option.label"
            class="relative size-9 rounded-lg border transition-all"
            :class="draft.background === option.id
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-default hover:border-primary/40'"
            :style="{ background: swatchStyle(option) }"
            @click="draft.background = option.id"
          >
            <UIcon
              v-if="draft.background === option.id"
              name="i-lucide-check"
              class="size-4 absolute inset-0 m-auto"
              :class="option.id === 'paper' || option.id === 'peach' ? 'text-neutral-900' : 'text-white'"
            />
          </button>
        </div>
      </div>

      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Font size</span>
            <span class="font-mono text-highlighted">{{ draft.fontSize }}px</span>
          </div>
          <USlider
            v-model="draft.fontSize"
            :min="10"
            :max="26"
            :step="1"
            size="sm"
            class="mt-2"
          />
        </div>

        <div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Line height</span>
            <span class="font-mono text-highlighted">{{ draft.lineHeight.toFixed(2) }}</span>
          </div>
          <USlider
            v-model="draft.lineHeight"
            :min="1.2"
            :max="2.2"
            :step="0.05"
            size="sm"
            class="mt-2"
          />
        </div>

        <div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Padding</span>
            <span class="font-mono text-highlighted">{{ draft.padding }}px</span>
          </div>
          <USlider
            v-model="draft.padding"
            :min="12"
            :max="96"
            :step="4"
            size="sm"
            class="mt-2"
          />
        </div>

        <div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Corner radius</span>
            <span class="font-mono text-highlighted">{{ draft.radius }}px</span>
          </div>
          <USlider
            v-model="draft.radius"
            :min="0"
            :max="40"
            :step="2"
            size="sm"
            class="mt-2"
          />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
        <label class="flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2 text-xs text-muted cursor-pointer hover:text-highlighted transition-colors">
          <span class="flex items-center gap-1.5">
            <UIcon
              name="i-lucide-list-ordered"
              class="size-3.5"
            />
            Line numbers
          </span>
          <USwitch
            v-model="draft.showLineNumbers"
            size="sm"
          />
        </label>

        <label class="flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2 text-xs text-muted cursor-pointer hover:text-highlighted transition-colors">
          <span class="flex items-center gap-1.5">
            <UIcon
              name="i-lucide-app-window"
              class="size-3.5"
            />
            Window dots
          </span>
          <USwitch
            v-model="draft.showWindowControls"
            size="sm"
          />
        </label>
      </div>
    </div>

    <p class="text-[11px] text-muted flex items-center gap-1.5">
      <UIcon
        name="i-lucide-lock"
        class="size-3.5"
      />
      Everything runs in your browser — the snippet never leaves this tab. Rendering by Shiki, export by canvas.
    </p>
  </div>
</template>
