<script setup lang="ts">
import {
  EINK_DITHERS,
  EINK_LIMITS,
  EINK_PRESETS,
  bmpByteSize,
  clampNumber,
  drawEinkBitmap,
  einkFileName,
  encodeBmp24,
  formatBytes,
  renderSamplePlate,
  type EinkRender,
  type EinkSettings
} from '~/utils/einkBitmap'
import type { CSSProperties } from 'vue'
import { useToolDraft } from '~/composables/useToolDraft'

interface EinkDraft extends EinkSettings {
  fileName: string
}

const DEFAULT_DRAFT: EinkDraft = {
  preset: 'x4',
  width: 480,
  height: 800,
  fit: 'cover',
  biasX: 0.5,
  biasY: 0.35,
  margin: 8,
  rotate: 0,
  levels: 4,
  dither: 'floyd-steinberg',
  brightness: 0,
  contrast: 10,
  whitePoint: 97,
  invert: false,
  fileName: ''
}

const DRAFT_STORAGE_KEY = 'quoin:draft:image-eink-bitmap'

const { state: draft, clearDraft } = useToolDraft<EinkDraft>('image-eink-bitmap', () => ({ ...DEFAULT_DRAFT }))
const toast = useToast()

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const sourceBitmap = shallowRef<ImageBitmap | HTMLCanvasElement | null>(null)
const sourceUrl = ref('')
const sourceName = ref('')
const sourcePixels = ref({ width: 0, height: 0 })
const sourceBytes = ref(0)
const rendering = ref(false)
const busyAction = ref<'bmp' | 'png' | null>(null)
const errorMessage = ref('')
const zoom = ref(1)
const dragging = ref(false)

const presetItems = EINK_PRESETS.map(preset => ({
  label: preset.id === 'custom' ? preset.label : `${preset.label} — ${preset.width}×${preset.height}`,
  value: preset.id
}))
const fitItems = [
  { label: 'Cover — fill the panel, crop the rest', value: 'cover' },
  { label: 'Contain — fit whole image, add margins', value: 'contain' }
]
const levelItems = [
  { label: '4 greys (0/85/170/255)', value: 4 },
  { label: '2 tones (black & white)', value: 2 }
]
const ditherItems = EINK_DITHERS.map(option => ({ label: option.label, value: option.id }))
const rotateItems = [
  { label: '0°', value: 0 },
  { label: '90°', value: 90 },
  { label: '180°', value: 180 },
  { label: '270°', value: 270 }
]

const activePreset = computed(() => EINK_PRESETS.find(preset => preset.id === draft.value.preset) ?? EINK_PRESETS[0]!)
const isCustom = computed(() => activePreset.value.id === 'custom')
const activeDither = computed(() => EINK_DITHERS.find(option => option.id === draft.value.dither) ?? EINK_DITHERS[0]!)
const hasSource = computed(() => sourceBitmap.value !== null)

const settings = computed<EinkSettings>(() => ({
  preset: draft.value.preset,
  width: draft.value.width,
  height: draft.value.height,
  fit: draft.value.fit,
  biasX: draft.value.biasX,
  biasY: draft.value.biasY,
  margin: draft.value.margin,
  rotate: draft.value.rotate,
  levels: draft.value.levels,
  dither: draft.value.dither,
  brightness: draft.value.brightness,
  contrast: draft.value.contrast,
  whitePoint: draft.value.whitePoint,
  invert: draft.value.invert
}))

const outputBytes = computed(() => bmpByteSize(Math.round(draft.value.width), Math.round(draft.value.height)))
const previewStyle = computed<CSSProperties>(() => ({
  width: `${Math.round(draft.value.width) * zoom.value}px`,
  imageRendering: zoom.value > 1 ? 'pixelated' : 'auto'
}))

let lastRender: EinkRender | null = null

function clamp(value: number, min: number, max: number, fallback: number): number {
  return clampNumber(value, min, max, fallback)
}

/** Drafts are user-editable JSON in localStorage — never trust their shape. */
function sanitizeDraft() {
  const current = draft.value
  if (!EINK_PRESETS.some(preset => preset.id === current.preset)) current.preset = DEFAULT_DRAFT.preset
  if (!EINK_DITHERS.some(option => option.id === current.dither)) current.dither = DEFAULT_DRAFT.dither
  if (current.fit !== 'cover' && current.fit !== 'contain') current.fit = DEFAULT_DRAFT.fit
  if (![0, 90, 180, 270].includes(current.rotate)) current.rotate = DEFAULT_DRAFT.rotate
  if (current.levels !== 2 && current.levels !== 4) current.levels = DEFAULT_DRAFT.levels
  current.width = clamp(current.width, EINK_LIMITS.minSize, EINK_LIMITS.maxSize, DEFAULT_DRAFT.width)
  current.height = clamp(current.height, EINK_LIMITS.minSize, EINK_LIMITS.maxSize, DEFAULT_DRAFT.height)
  current.biasX = clamp(current.biasX, 0, EINK_LIMITS.bias, DEFAULT_DRAFT.biasX)
  current.biasY = clamp(current.biasY, 0, EINK_LIMITS.bias, DEFAULT_DRAFT.biasY)
  current.margin = clamp(current.margin, 0, EINK_LIMITS.margin, DEFAULT_DRAFT.margin)
  current.brightness = clamp(current.brightness, -EINK_LIMITS.brightness, EINK_LIMITS.brightness, 0)
  current.contrast = clamp(current.contrast, -EINK_LIMITS.contrast, EINK_LIMITS.contrast, DEFAULT_DRAFT.contrast)
  current.whitePoint = clamp(current.whitePoint, EINK_LIMITS.whitePoint[0], EINK_LIMITS.whitePoint[1], DEFAULT_DRAFT.whitePoint)
  current.invert = current.invert === true
  if (typeof current.fileName !== 'string') current.fileName = ''
}

let renderTimer: ReturnType<typeof setTimeout> | null = null

function disposeSource() {
  // ImageBitmap is an interface, not a class, so `instanceof` cannot narrow the
  // union — duck-type the method that only a bitmap has.
  const current = sourceBitmap.value as (HTMLCanvasElement | ImageBitmap | null)
  if (current) (current as { close?: () => void }).close?.()
  sourceBitmap.value = null
}

function renderPreview() {
  const canvas = previewCanvas.value
  const source = sourceBitmap.value
  if (!canvas || !source) {
    lastRender = null
    rendering.value = false
    return
  }

  rendering.value = true
  try {
    lastRender = drawEinkBitmap(source, source.width, source.height, settings.value, canvas)
    errorMessage.value = ''
  } catch (error) {
    lastRender = null
    errorMessage.value = error instanceof Error ? error.message : 'Rendering failed'
  } finally {
    rendering.value = false
  }
}

function scheduleRender(delay = 120) {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(renderPreview, delay)
}

async function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    toast.add({
      title: 'Not an image',
      description: `${file.name || 'That file'} is not an image the browser can decode.`,
      color: 'warning',
      icon: 'i-lucide-alert-circle'
    })
    return
  }

  try {
    const bitmap = await createImageBitmap(file)
    disposeSource()
    sourceBitmap.value = bitmap
    sourcePixels.value = { width: bitmap.width, height: bitmap.height }
    sourceBytes.value = file.size
    sourceName.value = file.name || 'pasted-image'

    if (sourceUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceUrl.value)
    sourceUrl.value = URL.createObjectURL(file)

    syncAutoFileName(file.name || 'image')
    renderPreview()
  } catch {
    toast.add({
      title: 'Could not read that image',
      description: 'Try a PNG, JPEG or WebP file.',
      color: 'error',
      icon: 'i-lucide-image-off'
    })
  }
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void loadFile(file)
  input.value = ''
}

function handleDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void loadFile(file)
}

function loadSample() {
  const plate = renderSamplePlate()
  sourceBitmap.value = plate
  sourcePixels.value = { width: plate.width, height: plate.height }
  sourceBytes.value = 0
  sourceName.value = 'tone-plate.png'
  if (sourceUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = plate.toDataURL('image/png')
  syncAutoFileName('tone-plate')
  renderPreview()
}

function clearAll() {
  clearDraft()
  disposeSource()
  sourcePixels.value = { width: 0, height: 0 }
  sourceBytes.value = 0
  sourceName.value = ''
  if (sourceUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
  lastRender = null
  errorMessage.value = ''
}

/**
 * A new source gets a fresh name — but only when the field still holds a name
 * this tool generated (`-480x800.bmp`), so "sleep.bmp" typed by hand survives.
 */
function syncAutoFileName(stem: string) {
  const current = draft.value.fileName
  const autoSuffix = `-${draft.value.width}x${draft.value.height}.bmp`
  if (!current || current.endsWith(autoSuffix)) {
    draft.value.fileName = einkFileName(stem, draft.value.width, draft.value.height, 'bmp')
  }
}

function setDimension(axis: 'width' | 'height', value: string | number) {
  const parsed = Number(value)
  draft.value[axis] = clamp(parsed, EINK_LIMITS.minSize, EINK_LIMITS.maxSize, DEFAULT_DRAFT[axis])
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

async function downloadBitmap() {
  if (!lastRender) {
    toast.add({ title: 'Nothing to export', description: 'Load an image first.', color: 'warning', icon: 'i-lucide-alert-circle' })
    return
  }

  busyAction.value = 'bmp'
  try {
    const bytes = encodeBmp24(lastRender.imageData)
    const name = draft.value.fileName.trim() || einkFileName(sourceName.value, lastRender.width, lastRender.height, 'bmp')
    const fileName = name.toLowerCase().endsWith('.bmp') ? name : `${name}.bmp`
    saveBlob(new Blob([bytes], { type: 'image/bmp' }), fileName)
    toast.add({
      title: 'BMP downloaded',
      description: `${lastRender.width}×${lastRender.height} · 24-bit · ${formatBytes(bytes.length)}`,
      color: 'success',
      icon: 'i-lucide-download'
    })
  } catch (error) {
    toast.add({
      title: 'Could not encode the BMP',
      description: error instanceof Error ? error.message : 'Unknown error',
      color: 'error'
    })
  } finally {
    busyAction.value = null
  }
}

async function downloadPreviewPng() {
  const canvas = previewCanvas.value
  if (!canvas || !lastRender) return

  busyAction.value = 'png'
  try {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('The browser refused to encode a PNG.')
    saveBlob(blob, einkFileName(sourceName.value, lastRender.width, lastRender.height, 'png'))
    toast.add({
      title: 'Preview PNG downloaded',
      description: 'Same pixels as the BMP sidestep — handy for sharing.',
      color: 'success',
      icon: 'i-lucide-image-down'
    })
  } catch (error) {
    toast.add({
      title: 'Could not export the PNG',
      description: error instanceof Error ? error.message : 'Unknown error',
      color: 'error'
    })
  } finally {
    busyAction.value = null
  }
}

watch(() => draft.value.preset, (id) => {
  const preset = EINK_PRESETS.find(option => option.id === id)
  if (preset && preset.id !== 'custom') {
    draft.value.width = preset.width
    draft.value.height = preset.height
  }
})

// Keep an auto-generated file name in step with the panel size, but never
// overwrite a name the user typed (sleep.bmp, moon-mountain, ...).
watch(
  [() => draft.value.width, () => draft.value.height],
  ([width, height], [previousWidth, previousHeight]) => {
    const current = draft.value.fileName
    if (!current) return
    const suffix = `${previousWidth}x${previousHeight}.bmp`
    if (current.endsWith(suffix)) {
      draft.value.fileName = `${current.slice(0, -suffix.length)}${width}x${height}.bmp`
    }
  }
)

watch(draft, () => scheduleRender(), { deep: true })

onMounted(() => {
  sanitizeDraft()
  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (stored === null) loadSample()
  } catch {
    loadSample()
  }
})

onBeforeUnmount(() => {
  disposeSource()
  if (sourceUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceUrl.value)
  if (renderTimer) clearTimeout(renderTimer)
})
</script>

<template>
  <div class="space-y-5">
    <ToolHeader
      title="E-Ink Bitmap"
      description="Turn any image into a dithered 480×800 BMP an e-ink reader can read: pick the panel, choose cover or contain, and export a file whose greys are already the four the screen owns."
      icon="i-lucide-tablet"
      category="Image Tools"
      badge="E-Ink"
      tool-id="image-eink-bitmap"
      :disable-copy="true"
      @load-sample="loadSample"
      @clear="clearAll"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-download"
            label="Download BMP"
            size="sm"
            color="primary"
            variant="solid"
            :loading="busyAction === 'bmp'"
            :disabled="!hasSource"
            @click="downloadBitmap"
          />
          <UButton
            icon="i-lucide-image-down"
            label="PNG preview"
            size="sm"
            color="primary"
            variant="outline"
            :loading="busyAction === 'png'"
            :disabled="!hasSource"
            @click="downloadPreviewPng"
          />
        </div>

        <p class="text-[11px] text-muted font-mono">
          <template v-if="hasSource">
            {{ draft.width }}×{{ draft.height }} px · {{ draft.levels === 2 ? '2-tone' : '4-grey' }} · {{ formatBytes(outputBytes) }}
          </template>
          <template v-else>
            no image yet
          </template>
        </p>
      </template>
    </ToolHeader>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <!-- Source -->
      <div
        class="flex flex-col rounded-xl border border-default bg-neutral-100/30 dark:bg-neutral-900/40 overflow-hidden min-h-[420px] transition-colors"
        :class="dragging ? 'border-primary bg-primary/5' : ''"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-default bg-neutral-100/60 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2 min-w-0">
            <UIcon
              name="i-lucide-file-image"
              class="size-4 text-muted shrink-0"
            />
            <span class="text-xs font-medium text-muted truncate">{{ sourceName || 'Source' }}</span>
          </div>

          <div class="flex items-center gap-2">
            <span
              v-if="sourcePixels.width"
              class="text-[11px] font-mono text-muted hidden sm:inline"
            >
              {{ sourcePixels.width }}×{{ sourcePixels.height }}<template v-if="sourceBytes"> · {{ formatBytes(sourceBytes) }}</template>
            </span>
            <label class="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleFileInput"
              >
              <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted hover:text-highlighted rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                <UIcon
                  name="i-lucide-upload"
                  class="size-3"
                />
                Browse
              </span>
            </label>
          </div>
        </div>

        <div class="relative flex-1 flex items-center justify-center p-5 overflow-auto">
          <img
            v-if="sourceUrl"
            :src="sourceUrl"
            alt="Source image"
            class="max-w-full max-h-[56vh] object-contain rounded-lg shadow-lg"
          >

          <div
            v-else
            class="flex flex-col items-center justify-center gap-3 text-center text-muted px-6"
          >
            <UIcon
              name="i-lucide-image-plus"
              class="size-8 opacity-60"
            />
            <p class="text-xs max-w-[24rem]">
              Drop an image here, browse for one, or hit <span class="font-mono">Load Sample Data</span> for a tone plate.
            </p>
            <p class="text-[11px] opacity-80">
              Nothing is uploaded — the file is decoded in this tab and never leaves it.
            </p>
          </div>
        </div>
      </div>

      <!-- Output -->
      <div class="flex flex-col rounded-xl border border-default bg-neutral-100/30 dark:bg-neutral-900/40 overflow-hidden min-h-[420px]">
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-default bg-neutral-100/60 dark:bg-neutral-900/60">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-tablet"
              class="size-4 text-muted"
            />
            <span class="text-xs font-medium text-muted">Panel preview</span>
            <span
              v-if="rendering"
              class="text-[11px] text-muted"
            >rendering…</span>
          </div>

          <div class="flex items-center gap-1">
            <span class="text-[11px] font-mono text-muted hidden sm:inline">{{ activePreset.label }}</span>
            <UButton
              icon="i-lucide-minus"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="Show at device pixels"
              :disabled="zoom === 1"
              @click="zoom = 1"
            />
            <span class="text-[11px] font-mono text-muted w-6 text-center">{{ zoom }}x</span>
            <UButton
              icon="i-lucide-plus"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="Show at twice the device pixels"
              :disabled="zoom === 2"
              @click="zoom = 2"
            />
          </div>
        </div>

        <div
          class="relative flex-1 flex items-center justify-center p-5 overflow-auto"
          style="background-image: radial-gradient(circle, rgba(115,115,115,0.18) 1px, transparent 1px); background-size: 16px 16px;"
        >
          <canvas
            v-show="hasSource"
            ref="previewCanvas"
            class="max-w-full h-auto shadow-2xl rounded-sm"
            :style="previewStyle"
          />

          <div
            v-if="!hasSource"
            class="flex flex-col items-center justify-center gap-2 text-center text-muted px-6"
          >
            <UIcon
              name="i-lucide-scan-line"
              class="size-8 opacity-60"
            />
            <p class="text-xs">
              Load an image to see the dithered bitmap.
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
          <label class="text-[11px] font-medium text-muted block mb-1.5">Panel</label>
          <USelect
            v-model="draft.preset"
            :items="presetItems"
            size="sm"
            icon="i-lucide-tablet"
            class="w-full"
          />
        </div>

        <div>
          <label class="text-[11px] font-medium text-muted block mb-1.5">Fit</label>
          <USelect
            v-model="draft.fit"
            :items="fitItems"
            size="sm"
            icon="i-lucide-crop"
            class="w-full"
          />
        </div>

        <div>
          <label class="text-[11px] font-medium text-muted block mb-1.5">Greys</label>
          <USelect
            v-model="draft.levels"
            :items="levelItems"
            size="sm"
            icon="i-lucide-contrast"
            class="w-full"
          />
        </div>

        <div>
          <label class="text-[11px] font-medium text-muted block mb-1.5">Dither</label>
          <USelect
            v-model="draft.dither"
            :items="ditherItems"
            size="sm"
            icon="i-lucide-grid-2x2"
            class="w-full"
          />
        </div>
      </div>

      <div
        v-if="isCustom"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label
            for="eink-width"
            class="text-[11px] font-medium text-muted block mb-1.5"
          >Width (px)</label>
          <UInput
            id="eink-width"
            :model-value="draft.width"
            type="number"
            size="sm"
            :min="EINK_LIMITS.minSize"
            :max="EINK_LIMITS.maxSize"
            class="w-full"
            @update:model-value="value => setDimension('width', value)"
          />
        </div>

        <div>
          <label
            for="eink-height"
            class="text-[11px] font-medium text-muted block mb-1.5"
          >Height (px)</label>
          <UInput
            id="eink-height"
            :model-value="draft.height"
            type="number"
            size="sm"
            :min="EINK_LIMITS.minSize"
            :max="EINK_LIMITS.maxSize"
            class="w-full"
            @update:model-value="value => setDimension('height', value)"
          />
        </div>
      </div>

      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Paper white</span>
            <span class="font-mono text-highlighted">{{ draft.whitePoint >= 100 ? 'off' : `p${draft.whitePoint}` }}</span>
          </div>
          <USlider
            v-model="draft.whitePoint"
            :min="80"
            :max="100"
            :step="1"
            size="sm"
            class="mt-2"
          />
        </div>

        <div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Contrast</span>
            <span class="font-mono text-highlighted">{{ draft.contrast > 0 ? `+${draft.contrast}` : draft.contrast }}</span>
          </div>
          <USlider
            v-model="draft.contrast"
            :min="-EINK_LIMITS.contrast"
            :max="EINK_LIMITS.contrast"
            :step="1"
            size="sm"
            class="mt-2"
          />
        </div>

        <div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Brightness</span>
            <span class="font-mono text-highlighted">{{ draft.brightness > 0 ? `+${draft.brightness}` : draft.brightness }}</span>
          </div>
          <USlider
            v-model="draft.brightness"
            :min="-EINK_LIMITS.brightness"
            :max="EINK_LIMITS.brightness"
            :step="1"
            size="sm"
            class="mt-2"
          />
        </div>

        <div :class="draft.fit === 'contain' ? '' : 'opacity-40'">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Margin</span>
            <span class="font-mono text-highlighted">{{ draft.margin }}px</span>
          </div>
          <USlider
            v-model="draft.margin"
            :min="0"
            :max="EINK_LIMITS.margin"
            :step="1"
            :disabled="draft.fit !== 'contain'"
            size="sm"
            class="mt-2"
          />
        </div>
      </div>

      <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <div :class="draft.fit === 'cover' ? '' : 'opacity-40'">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Crop focus X</span>
            <span class="font-mono text-highlighted">{{ Math.round(draft.biasX * 100) }}%</span>
          </div>
          <USlider
            v-model="draft.biasX"
            :min="0"
            :max="1"
            :step="0.05"
            :disabled="draft.fit !== 'cover'"
            size="sm"
            class="mt-2"
          />
        </div>

        <div :class="draft.fit === 'cover' ? '' : 'opacity-40'">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-muted">Crop focus Y</span>
            <span class="font-mono text-highlighted">{{ Math.round(draft.biasY * 100) }}%</span>
          </div>
          <USlider
            v-model="draft.biasY"
            :min="0"
            :max="1"
            :step="0.05"
            :disabled="draft.fit !== 'cover'"
            size="sm"
            class="mt-2"
          />
        </div>

        <div>
          <label class="text-[11px] font-medium text-muted block mb-1.5">Rotate</label>
          <USelect
            v-model="draft.rotate"
            :items="rotateItems"
            size="sm"
            icon="i-lucide-rotate-cw"
            class="w-full"
          />
        </div>

        <div>
          <label
            for="eink-filename"
            class="text-[11px] font-medium text-muted block mb-1.5"
          >File name</label>
          <UInput
            id="eink-filename"
            v-model="draft.fileName"
            size="sm"
            placeholder="sleep.bmp"
            class="w-full"
          />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 pt-1">
        <label class="flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2 text-xs text-muted cursor-pointer hover:text-highlighted transition-colors">
          <span class="flex items-center gap-1.5">
            <UIcon
              name="i-lucide-moon-star"
              class="size-3.5"
            />
            Invert (dark wallpaper)
          </span>
          <USwitch
            v-model="draft.invert"
            size="sm"
          />
        </label>

        <div class="flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-[11px] text-muted">
          <UIcon
            name="i-lucide-info"
            class="size-3.5 shrink-0"
          />
          <span class="truncate">{{ activeDither.hint }}</span>
        </div>
      </div>
    </div>

    <p class="text-[11px] text-muted flex items-start gap-1.5">
      <UIcon
        name="i-lucide-lock"
        class="size-3.5 mt-px shrink-0"
      />
      <span>
        Everything runs in your browser — the image never leaves this tab. On a CrossPoint reader: copy the BMP into <span class="font-mono">/.sleep/</span> on the SD card for a rotating pool, or name it <span class="font-mono">sleep.bmp</span> in the root to pin one. Settings → Display: Sleep Screen = Custom, Cover Mode = Fit, Cover Filter = None so the greys survive.
      </span>
    </p>
  </div>
</template>
