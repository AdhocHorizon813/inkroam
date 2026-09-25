<script setup lang="ts">
import { supportsEmbeddedPdf } from '~/utils/pdf-embed'

type VisualMode = 'modern' | 'classic'
type ColorMode = 'dark' | 'light' | 'auto'
type MaterialMode = 'liquid' | 'acrylic' | 'mica'
/* 'auto' 不是画布，而是「没选过」：解析成当前明暗模式下的默认画布。 */
type BackgroundMode = 'auto' | 'flat' | 'theme' | 'aurora' | 'art' | 'dusk' | 'custom'
type ResolvedBackground = Exclude<BackgroundMode, 'auto'>
type LatestPostCount = 5 | 10 | 'all'
type PdfFallbackMode = 'card' | 'reader'

interface AppearanceState {
  visual: VisualMode
  colorMode: ColorMode
  /* 「默认设置」开关：受管项（四组材质、四条模糊、遮罩透明度、背景氛围）是否跟随明暗自动取值。 */
  defaultSettings: boolean
  navMaterial: MaterialMode
  contentMaterial: MaterialMode
  dropdownMaterial: MaterialMode
  backgroundMaterial: MaterialMode
  background: BackgroundMode
  /* 用户是否显式点过背景氛围。老存储没有这个字段，因此「没选过」是可判定的。 */
  backgroundPicked?: boolean
  navBlur: number
  contentBlur: number
  dropdownBlur: number
  backgroundBlur: number
  backgroundOverlay: number
  accent: string
  latestPostCount: LatestPostCount
  latestNoteCount: LatestPostCount
  pdfFallback: PdfFallbackMode
}

/* 出厂默认分两套，按解析后的明暗取。
   浅色这一套是用户在面板上逐条定下来的：四组材质都用液态玻璃，模糊 14 / 5 / 4 / 0 px，遮罩 40%。
   深色沿用 v5 原来的云母与 12 / 10 / 12 / 4 px —— 深浅不必对称：浅色底图的明暗落差本来就小，
   同一档模糊在浅色上更容易把正文糊成一层灰雾，所以浅色要更轻。
   两套都保留 40% 遮罩。 */
type AppearanceDefaults = Pick<
  AppearanceState,
  'navMaterial' | 'contentMaterial' | 'dropdownMaterial' | 'backgroundMaterial'
  | 'navBlur' | 'contentBlur' | 'dropdownBlur' | 'backgroundBlur' | 'backgroundOverlay'
>

const LIGHT_DEFAULTS: AppearanceDefaults = {
  navMaterial: 'liquid',
  contentMaterial: 'liquid',
  dropdownMaterial: 'liquid',
  backgroundMaterial: 'liquid',
  navBlur: 14,
  contentBlur: 5,
  dropdownBlur: 4,
  backgroundBlur: 0,
  backgroundOverlay: 40,
}

/* v5 时代的出厂值（云母 + 12 / 10 / 12 / 4、遮罩 40%）：它是 state 的初值，也是老访客缺键时的兜底。
   老访客「从没设置过」的项因此保持改动前的观感，新默认不会被偷偷塞给他。 */
const LEGACY_DEFAULTS: AppearanceDefaults = {
  navMaterial: 'mica',
  contentMaterial: 'mica',
  dropdownMaterial: 'mica',
  backgroundMaterial: 'mica',
  navBlur: 12,
  contentBlur: 10,
  dropdownBlur: 12,
  backgroundBlur: 4,
  backgroundOverlay: 40,
}

/* 深色那一套沿用 v5 的值（所以与 LEGACY_DEFAULTS 同值）：只有浅色是新定的那套。 */
const DARK_DEFAULTS: AppearanceDefaults = {
  navMaterial: 'mica',
  contentMaterial: 'mica',
  dropdownMaterial: 'mica',
  backgroundMaterial: 'mica',
  navBlur: 12,
  contentBlur: 10,
  dropdownBlur: 12,
  backgroundBlur: 4,
  backgroundOverlay: 40,
}

function appearanceDefaults(mode: 'dark' | 'light'): AppearanceDefaults {
  return mode === 'dark' ? DARK_DEFAULTS : LIGHT_DEFAULTS
}

const STORAGE_KEY = 'paper-trail-appearance-v5'
const LEGACY_STORAGE_KEY = 'paper-trail-appearance-v4'
const CUSTOM_BG_KEY = 'paper-trail-custom-background'
const CUSTOM_BG_NAME_KEY = 'paper-trail-custom-background-name'

const isOpen = ref(false)
const status = ref('')
/* 能内嵌 PDF 的浏览器上，PDF 附件这一项没有意义：禁用并按「支持内嵌」标注。
   null 表示还没判断（SSR 与首次渲染），此时保持可用、不做出任何断言。 */
const pdfEmbedSupported = ref<boolean | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const panelScroll = ref<HTMLDivElement | null>(null)
const customBackgroundPreview = ref('')
const customBackgroundName = ref('')
const sharedLatestPostCount = useState<LatestPostCount>('latest-post-count', () => 10)
const sharedLatestNoteCount = useState<LatestPostCount>('latest-note-count', () => 10)
const sharedPdfFallback = useState<PdfFallbackMode>('pdf-fallback', () => 'card')
const state = reactive<AppearanceState>({
  visual: 'modern',
  /* 新访客默认「启用」：一进来就是当前明暗的出厂值。老访客在 onMounted 的迁移里被改成「禁用」。 */
  defaultSettings: true,
  colorMode: 'auto',
  /* 初值取 v5 时代的值：老访客缺的键就落在这里（观感与改动前一致），真·新访客会在 onMounted 里
     被 commitManagedDefaults() 换成当前明暗的新默认。SSR 首帧的面板内容也按这套渲染，与
     systemPrefersDark 的初值（浅色）同一口径。 */
  ...LEGACY_DEFAULTS,
  /* 默认跟随明暗：深色暮色都市，浅色夕空町市。 */
  background: 'auto',
  backgroundPicked: false,
  accent: '#7892b2',
  latestPostCount: 10,
  latestNoteCount: 10,
  pdfFallback: 'card',
})

const accents = [
  { name: '岩层蓝', value: '#7892b2' },
  { name: '钴蓝', value: '#4f72c9' },
  { name: '湖水青', value: '#4f9d91' },
  { name: '青绿', value: '#3f8f7a' },
  { name: '琥珀', value: '#c18b48' },
  { name: '金黄', value: '#c29a3d' },
  { name: '陶橙', value: '#b8734f' },
  { name: '朱砂', value: '#c45b45' },
  { name: '柔红', value: '#b96068' },
  { name: '莓红', value: '#a95a78' },
  { name: '雾霭紫', value: '#8d839f' },
  { name: '鸢尾紫', value: '#7666b3' },
]

const prefersDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
/* 系统明暗要参与响应式判断：背景氛围的默认画布（深色暮色都市 / 浅色夕空町市）得跟着系统一起换，
   所以把它提成一个 ref，而不是每次现读 matchMedia——否则面板高亮不会跟着系统变化走。
   初值必须是 false：服务端拿不到系统明暗，只能按浅色算。客户端若在 setup 里就读真值，
   深色系统下首帧画布与 SSR 输出的选中态不一致，Vue 不会回改这批属性，面板就会一直高亮错卡片。
   真实值在 onMounted 里补齐；面板默认关闭，这一帧用户看不到。 */
const systemPrefersDark = ref(false)

const resolvedMode = computed<'dark' | 'light'>(() => (
  state.colorMode === 'auto' ? (systemPrefersDark.value ? 'dark' : 'light') : state.colorMode
))

function resolveBackground(background: BackgroundMode, mode: 'dark' | 'light'): ResolvedBackground {
  if (background !== 'auto') return background
  return mode === 'dark' ? 'art' : 'dusk'
}

/* 面板高亮与 data-background 都用解析后的值：跟随状态下亮色显示夕空町市、深色显示暮色都市。 */
const resolvedBackground = computed(() => resolveBackground(state.background, resolvedMode.value))

/* 受管项在纸媒下本来就禁用；「默认设置」启用时同样禁用——值由明暗决定，手调没有意义。 */
const managedDisabled = computed(() => state.visual === 'classic' || state.defaultSettings)

type StoredAppearance = Partial<AppearanceState>

/* v5 之前只有一条 blur（导航与内容共用）：迁移时铺给三条通道，其余字段原样带回。 */
function readStoredAppearance(): StoredAppearance | null {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) return JSON.parse(saved)
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacy) return null
  const { blur, ...previous } = JSON.parse(legacy)
  if (typeof blur !== 'number') return previous
  return { ...previous, navBlur: blur, contentBlur: blur, dropdownBlur: blur }
}

/* 受管项 = 四组材质 + 四条模糊 + 遮罩透明度 + 背景氛围：跟随明暗、由「默认设置」开关统一管。
   启用时把它们收回到厂值（画布同时回到「跟随」），禁用时一律不碰。 */
function commitManagedDefaults() {
  Object.assign(state, appearanceDefaults(resolvedMode.value))
  state.background = 'auto'
  state.backgroundPicked = false
}

function onSystemThemeChange() {
  systemPrefersDark.value = !!prefersDark?.matches
  if (state.colorMode !== 'auto') return
  /* 启用「默认设置」时受管项跟着换一套（浅色 14 / 5 / 4 / 0，深色 12 / 10 / 12 / 4）；
     禁用时这里什么都不做——用户自己调的材质与模糊不会因为切系统深浅色被改掉。 */
  if (state.defaultSettings) commitManagedDefaults()
  applyAppearance()
}

onMounted(() => {
  /* 先补齐系统明暗，再读偏好、再 applyAppearance：顺序反了会让首帧画布按浅色写一次。 */
  systemPrefersDark.value = !!prefersDark?.matches
  pdfEmbedSupported.value = supportsEmbeddedPdf()
  try {
    customBackgroundPreview.value = localStorage.getItem(CUSTOM_BG_KEY) || ''
    customBackgroundName.value = localStorage.getItem(CUSTOM_BG_NAME_KEY) || ''
    const stored = readStoredAppearance()
    if (stored) {
      /* 老访客（存储里哪怕只有一个键）：他自己的值一个都不动，缺的键保持 state 初值（v5 时代的值），
         于是「他从没设置过」的项观感与改动前一模一样；开关只有他显式打开过才算启用。 */
      Object.assign(state, stored)
      state.defaultSettings = stored.defaultSettings === true
    } else {
      /* 真·新访客：一进来就用当前明暗的新默认（浅色 14 / 5 / 4 / 0、深色 12 / 10 / 12 / 4）。 */
      state.defaultSettings = true
    }
    if (state.defaultSettings) commitManagedDefaults()
    if (!['liquid', 'acrylic', 'mica'].includes(state.dropdownMaterial)) state.dropdownMaterial = LEGACY_DEFAULTS.dropdownMaterial
    if (!Number.isFinite(state.dropdownBlur)) state.dropdownBlur = LEGACY_DEFAULTS.dropdownBlur
    state.dropdownBlur = Math.max(0, Math.min(48, state.dropdownBlur))
    if (state.latestPostCount !== 5 && state.latestPostCount !== 10 && state.latestPostCount !== 'all') {
      state.latestPostCount = 10
    }
    sharedLatestPostCount.value = state.latestPostCount
    if (state.latestNoteCount !== 5 && state.latestNoteCount !== 10 && state.latestNoteCount !== 'all') {
      state.latestNoteCount = 10
    }
    if (state.pdfFallback !== 'card' && state.pdfFallback !== 'reader') {
      state.pdfFallback = 'card'
    }
    sharedPdfFallback.value = state.pdfFallback
    sharedLatestNoteCount.value = state.latestNoteCount
    /* v5 的默认背景就是 art，旧存储里区分不出「没选过」与「手选暮色都市」。
       没有 backgroundPicked 字段的一律按「没选过」处理：深色仍是暮色都市，
       浅色换成新的夕空町市。此后手选过的存储会带上标记，不再被改写。 */
    if (!state.backgroundPicked && state.background === 'art') state.background = 'auto'
    if (!['auto', 'flat', 'theme', 'aurora', 'art', 'dusk', 'custom'].includes(state.background)) {
      state.background = 'auto'
    }
  } catch {
    status.value = '外观偏好未能读取，已使用默认设置。'
  }
  applyAppearance()
  prefersDark?.addEventListener('change', onSystemThemeChange)
})

onUnmounted(() => {
  prefersDark?.removeEventListener('change', onSystemThemeChange)
})

let vtSeq = 0

const DISCRETE_FIELDS = ['visual', 'colorMode', 'defaultSettings', 'navMaterial', 'contentMaterial', 'dropdownMaterial', 'backgroundMaterial', 'background', 'accent'] as const

watch(state, (_state, from) => {
  /* 背景氛围比的是解析后的画布：follow 状态下切明暗会换图，而点当前已生效的那一项不该触发空转场。 */
  const discreteChanged =
    !!from && DISCRETE_FIELDS.some((key) => key === 'background'
      ? resolvedBackground.value !== resolveBackground(from.background, resolvedMode.value)
      : state[key] !== from![key])
  const apply = () => {
    sharedLatestPostCount.value = state.latestPostCount
    sharedLatestNoteCount.value = state.latestNoteCount
    sharedPdfFallback.value = state.pdfFallback
    applyAppearance()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      status.value = '浏览器未能保存这次设置。'
    }
  }
  if (
    discreteChanged &&
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    // View Transitions：内容一次性切换，临时禁用 transition 避免主线程逐帧重绘，整页由 GPU 做 opacity 交叉淡入
    // 在快照捕获前禁用 transition，确保旧态为“终态”；切换完成后由 .finished 恢复，
    // 避免中途重新启用 transition 造成二次样式重算。
    const root = document.documentElement
    const seq = ++vtSeq
    root.classList.add('no-transition')
    const transition = document.startViewTransition(() => {
      apply()
    })
    const release = () => {
      // 仅当仍是最近一次切换才处理，防止快速连点时被上一次的收尾干扰。
      if (seq !== vtSeq) return
      // 视图转场结束后再等两帧，确保真实 DOM 已解除伪元素覆盖并静默渲染新主题，
      // 才恢复 transition——否则新主题会被误判为一次样式变化而触发逐帧颜色过渡。
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (seq === vtSeq) root.classList.remove('no-transition')
      }))
    }
    transition.finished.then(release, release)
  } else {
    apply()
  }
}, { deep: true })

/* 卡片上的「始终在页面内阅读」也会改写这份偏好：同步回 state，由上面的 watcher
   统一写入 localStorage，并让分段控件的选中态跟着走。 */
watch(sharedPdfFallback, (value) => {
  if (value !== state.pdfFallback) state.pdfFallback = value
})

watch(isOpen, async (open) => {
  if (!open) return
  await nextTick()
  if (panelScroll.value) panelScroll.value.scrollTop = 0
})

function applyAppearance() {
  if (!import.meta.client) return
  const root = document.documentElement
  const mode = resolvedMode.value
  root.dataset.visual = state.visual
  root.dataset.colorMode = mode
  root.dataset.theme = mode
  root.dataset.navMaterial = state.navMaterial
  root.dataset.material = state.contentMaterial
  root.dataset.dropdownMaterial = state.dropdownMaterial
  root.dataset.backgroundMaterial = state.backgroundMaterial
  /* 写解析后的画布：CSS 只认 flat / theme / aurora / art / dusk / custom。 */
  root.dataset.background = resolvedBackground.value
  root.style.setProperty('--nav-blur', `${state.navBlur}px`)
  root.style.setProperty('--content-blur', `${state.contentBlur}px`)
  root.style.setProperty('--dropdown-blur', `${state.dropdownBlur}px`)
  root.style.setProperty('--background-blur', `${state.backgroundBlur}px`)
  root.style.setProperty('--glass-blur', `${state.contentBlur}px`)
  root.style.setProperty('--modern-accent', state.accent)
  root.style.setProperty('--background-overlay-opacity', String(state.backgroundOverlay / 100))

  if (resolvedBackground.value === 'custom') {
    const custom = localStorage.getItem(CUSTOM_BG_KEY)
    if (custom) root.style.setProperty('--custom-background', `url(${JSON.stringify(custom)})`)
  } else {
    root.style.removeProperty('--custom-background')
  }
}

/* 点过任意背景卡片就算显式选择：此后不再跟着系统明暗自动换画布。 */
function selectBackground(background: Exclude<BackgroundMode, 'auto' | 'custom'>) {
  state.background = background
  state.backgroundPicked = true
}

/* 切换开关会整体改写受管项（启用＝把用户当前的值换成出厂值），所以先弹窗二次确认。 */
const defaultSettingsDialog = ref<HTMLDialogElement | null>(null)
/* null 表示弹窗没开；true / false 是用户点的那一项，确认之后才落到 state。 */
const pendingDefaultSettings = ref<boolean | null>(null)
// Preserve the displayed action while the native dialog finishes its exit transition.
const dialogDefaultSettings = ref(false)

function requestDefaultSettings(enabled: boolean) {
  if (state.defaultSettings === enabled) return
  pendingDefaultSettings.value = enabled
  dialogDefaultSettings.value = enabled
  defaultSettingsDialog.value?.showModal()
}

function closeDefaultSettingsConfirm() {
  pendingDefaultSettings.value = null
  defaultSettingsDialog.value?.close()
}

function confirmDefaultSettings() {
  const enabled = pendingDefaultSettings.value
  closeDefaultSettingsConfirm()
  if (enabled === null || state.defaultSettings === enabled) return
  state.defaultSettings = enabled
  if (enabled) commitManagedDefaults()
}

function selectVisual(visual: VisualMode) {
  state.visual = visual
  status.value = visual === 'classic' ? '已切换到保留的纸媒风格。' : '已切换到现代幻境风格。'
}

function segmentStyle(index: number) {
  return {
    '--segment-transform': `translate3d(calc(${index * 100}% + ${index * 5}px), 0, 0)`,
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function handleBackgroundUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    status.value = '请选择图片文件。'
    return
  }

  try {
    status.value = '正在处理背景图片…'
    const dataUrl = await compressImage(file)
    localStorage.setItem(CUSTOM_BG_KEY, dataUrl)
    localStorage.setItem(CUSTOM_BG_NAME_KEY, file.name)
    customBackgroundPreview.value = dataUrl
    customBackgroundName.value = file.name
    state.background = 'custom'
    state.backgroundPicked = true
    applyAppearance()
    status.value = '自定义背景已应用，并保存在当前浏览器。'
  } catch (error) {
    status.value = error instanceof Error ? error.message : '背景图片处理失败。'
  } finally {
    input.value = ''
  }
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const maxEdge = 1920
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('浏览器无法处理这张图片。'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/webp', .82)
      URL.revokeObjectURL(objectUrl)
      if (dataUrl.length > 4_200_000) {
        reject(new Error('图片仍然过大，请选择小于约 8MB 的背景图。'))
        return
      }
      resolve(dataUrl)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法读取这张图片。'))
    }
    image.src = objectUrl
  })
}

function resetAppearance() {
  Object.assign(state, {
    visual: 'modern',
    colorMode: 'auto',
    /* 「恢复默认」＝回到新访客那种状态：开关启用 + 当前明暗的出厂值（colorMode 同时重置成自动，口径一致）。 */
    defaultSettings: true,
    ...appearanceDefaults(systemPrefersDark.value ? 'dark' : 'light'),
    background: 'auto',
    backgroundPicked: false,
    accent: '#7892b2',
    latestPostCount: 10,
    latestNoteCount: 10,
    pdfFallback: 'card',
  })
  localStorage.removeItem(CUSTOM_BG_KEY)
  localStorage.removeItem(CUSTOM_BG_NAME_KEY)
  customBackgroundPreview.value = ''
  customBackgroundName.value = ''
  status.value = '已恢复现代幻境默认设置。'
}
</script>

<template>
  <div class="appearance-dock">
    <button
      class="appearance-trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="appearance-panel"
      :aria-label="isOpen ? '关闭外观设置' : '打开外观设置'"
      @click="isOpen = !isOpen"
    >
      <span aria-hidden="true">Aa</span>
      <span>显示</span>
    </button>

    <section
      id="appearance-panel"
      class="appearance-panel"
      :class="{ 'is-open': isOpen }"
      :aria-hidden="!isOpen"
      :inert="!isOpen"
      aria-label="外观设置"
    >
      <div ref="panelScroll" class="appearance-panel__scroll">
        <header class="appearance-panel__header">
          <div>
            <span class="panel-kicker">DISPLAY</span>
            <h2>阅读外观</h2>
          </div>
          <button type="button" class="panel-close" aria-label="关闭外观设置" @click="isOpen = false">×</button>
        </header>

        <div class="setting-group">
          <span class="setting-label">视觉风格</span>
          <div class="segmented-control segmented-control--two" :style="segmentStyle(state.visual === 'modern' ? 0 : 1)">
            <button type="button" :class="{ active: state.visual === 'modern' }" @click="selectVisual('modern')">现代幻境</button>
            <button type="button" :class="{ active: state.visual === 'classic' }" @click="selectVisual('classic')">纸媒原版</button>
          </div>
        </div>

        <fieldset class="setting-group" :disabled="state.visual === 'classic'">
          <legend class="setting-label">默认设置</legend>
          <p class="setting-hint">启用后，材质、模糊、遮罩与背景氛围按当前明暗自动取值，不能手动调整。</p>
          <div class="segmented-control segmented-control--two" :style="segmentStyle(state.defaultSettings ? 0 : 1)">
            <button type="button" :aria-pressed="state.defaultSettings" :class="{ active: state.defaultSettings }" @click="requestDefaultSettings(true)">启用</button>
            <button type="button" :aria-pressed="!state.defaultSettings" :class="{ active: !state.defaultSettings }" @click="requestDefaultSettings(false)">禁用</button>
          </div>
        </fieldset>

        <fieldset class="setting-group">
          <legend class="setting-label">外观模式</legend>
          <div class="segmented-control" :style="segmentStyle(state.colorMode === 'light' ? 0 : state.colorMode === 'dark' ? 1 : 2)">
            <button type="button" :class="{ active: state.colorMode === 'light' }" @click="state.colorMode = 'light'">浅色</button>
            <button type="button" :class="{ active: state.colorMode === 'dark' }" @click="state.colorMode = 'dark'">深色</button>
            <button type="button" :class="{ active: state.colorMode === 'auto' }" @click="state.colorMode = 'auto'">自动</button>
          </div>
        </fieldset>

        <fieldset class="setting-group">
          <legend class="setting-label">最近文章</legend>
          <div class="segmented-control" :style="segmentStyle(state.latestPostCount === 5 ? 0 : state.latestPostCount === 10 ? 1 : 2)">
            <button type="button" :class="{ active: state.latestPostCount === 5 }" @click="state.latestPostCount = 5">5 篇</button>
            <button type="button" :class="{ active: state.latestPostCount === 10 }" @click="state.latestPostCount = 10">10 篇</button>
            <button type="button" :class="{ active: state.latestPostCount === 'all' }" @click="state.latestPostCount = 'all'">所有</button>
          </div>
        </fieldset>

        <fieldset class="setting-group">
          <legend class="setting-label">最近笔记</legend>
          <div class="segmented-control" :style="segmentStyle(state.latestNoteCount === 5 ? 0 : state.latestNoteCount === 10 ? 1 : 2)">
            <button type="button" :aria-pressed="state.latestNoteCount === 5" :class="{ active: state.latestNoteCount === 5 }" @click="state.latestNoteCount = 5">5 篇</button>
            <button type="button" :aria-pressed="state.latestNoteCount === 10" :class="{ active: state.latestNoteCount === 10 }" @click="state.latestNoteCount = 10">10 篇</button>
            <button type="button" :aria-pressed="state.latestNoteCount === 'all'" :class="{ active: state.latestNoteCount === 'all' }" @click="state.latestNoteCount = 'all'">所有</button>
          </div>
        </fieldset>

        <fieldset class="setting-group" :disabled="pdfEmbedSupported === true">
          <legend class="setting-label">PDF 附件</legend>
          <!-- 说明行放在选项上方；与本组其它文字一样随 fieldset 的禁用一起淡化，保持与其它设置项一致的禁用观感。 -->
          <p v-if="pdfEmbedSupported !== null" class="setting-hint">
            {{ pdfEmbedSupported ? '当前浏览器支持内嵌，此项不生效' : '浏览器不能内嵌 PDF，此项生效' }}
          </p>
          <div class="segmented-control segmented-control--two" :style="segmentStyle(state.pdfFallback === 'card' ? 0 : 1)">
            <button type="button" :aria-pressed="state.pdfFallback === 'card'" :class="{ active: state.pdfFallback === 'card' }" title="先显示文件卡片，点“在页面内阅读”再打开阅读器" @click="state.pdfFallback = 'card'">显示卡片</button>
            <button type="button" :aria-pressed="state.pdfFallback === 'reader'" :class="{ active: state.pdfFallback === 'reader' }" title="直接打开页面内阅读器，省去一次点击" @click="state.pdfFallback = 'reader'">直接阅读</button>
          </div>
        </fieldset>

        <fieldset class="setting-group" :disabled="managedDisabled">
          <legend class="setting-label">导航材质</legend>
          <div class="segmented-control" :style="segmentStyle(state.navMaterial === 'liquid' ? 0 : state.navMaterial === 'acrylic' ? 1 : 2)">
            <button type="button" :class="{ active: state.navMaterial === 'liquid' }" @click="state.navMaterial = 'liquid'">液态玻璃</button>
            <button type="button" :class="{ active: state.navMaterial === 'acrylic' }" @click="state.navMaterial = 'acrylic'">亚克力</button>
            <button type="button" :class="{ active: state.navMaterial === 'mica' }" @click="state.navMaterial = 'mica'">云母</button>
          </div>
        </fieldset>

        <div class="setting-group" :aria-disabled="managedDisabled">
          <div class="range-heading">
            <span class="setting-label">导航模糊</span>
            <output>{{ state.navBlur }} px</output>
          </div>
          <input
            v-model.number="state.navBlur"
            type="range"
            min="0"
            max="48"
            step="1"
            :style="{ '--range-progress': `${state.navBlur / 48 * 100}%` }"
            :disabled="managedDisabled"
          >
          <div class="range-scale" aria-hidden="true"><span>0 px</span><span>48 px</span></div>
        </div>

        <fieldset class="setting-group" :disabled="managedDisabled">
          <legend class="setting-label">内容材质</legend>
          <div class="segmented-control" :style="segmentStyle(state.contentMaterial === 'liquid' ? 0 : state.contentMaterial === 'acrylic' ? 1 : 2)">
            <button type="button" :class="{ active: state.contentMaterial === 'liquid' }" @click="state.contentMaterial = 'liquid'">液态玻璃</button>
            <button type="button" :class="{ active: state.contentMaterial === 'acrylic' }" @click="state.contentMaterial = 'acrylic'">亚克力</button>
            <button type="button" :class="{ active: state.contentMaterial === 'mica' }" @click="state.contentMaterial = 'mica'">云母</button>
          </div>
        </fieldset>

        <div class="setting-group" :aria-disabled="managedDisabled">
          <div class="range-heading">
            <span class="setting-label">内容模糊</span>
            <output>{{ state.contentBlur }} px</output>
          </div>
          <input
            v-model.number="state.contentBlur"
            type="range"
            min="0"
            max="48"
            step="1"
            :style="{ '--range-progress': `${state.contentBlur / 48 * 100}%` }"
            :disabled="managedDisabled"
          >
          <div class="range-scale" aria-hidden="true"><span>0 px</span><span>48 px</span></div>
        </div>

        <fieldset class="setting-group" :disabled="managedDisabled">
          <legend class="setting-label">下拉框材质</legend>
          <div class="segmented-control" :style="segmentStyle(state.dropdownMaterial === 'liquid' ? 0 : state.dropdownMaterial === 'acrylic' ? 1 : 2)">
            <button type="button" :aria-pressed="state.dropdownMaterial === 'liquid'" :class="{ active: state.dropdownMaterial === 'liquid' }" @click="state.dropdownMaterial = 'liquid'">液态玻璃</button>
            <button type="button" :aria-pressed="state.dropdownMaterial === 'acrylic'" :class="{ active: state.dropdownMaterial === 'acrylic' }" @click="state.dropdownMaterial = 'acrylic'">亚克力</button>
            <button type="button" :aria-pressed="state.dropdownMaterial === 'mica'" :class="{ active: state.dropdownMaterial === 'mica' }" @click="state.dropdownMaterial = 'mica'">云母</button>
          </div>
        </fieldset>

        <div class="setting-group" :aria-disabled="managedDisabled">
          <div class="range-heading">
            <span class="setting-label">下拉框模糊</span>
            <output>{{ state.dropdownBlur }} px</output>
          </div>
          <input
            v-model.number="state.dropdownBlur"
            type="range"
            min="0"
            max="48"
            step="1"
            :style="{ '--range-progress': `${state.dropdownBlur / 48 * 100}%` }"
            :disabled="managedDisabled"
          >
          <div class="range-scale" aria-hidden="true"><span>0 px</span><span>48 px</span></div>
        </div>

        <fieldset class="setting-group" :disabled="managedDisabled">
          <legend class="setting-label">背景氛围</legend>
          <div class="background-options">
            <button type="button" :class="{ active: resolvedBackground === 'flat' }" @click="selectBackground('flat')">
              <span class="background-swatch background-swatch--flat" />
              <span>静谧纯色</span>
            </button>
            <button type="button" :class="{ active: resolvedBackground === 'theme' }" @click="selectBackground('theme')">
              <span class="background-swatch background-swatch--theme" />
              <span>主题纯色</span>
            </button>
            <button type="button" :class="{ active: resolvedBackground === 'aurora' }" @click="selectBackground('aurora')">
              <span class="background-swatch background-swatch--aurora" />
              <span>极光渐变</span>
            </button>
            <button type="button" :class="{ active: resolvedBackground === 'art' }" @click="selectBackground('art')">
              <span class="background-swatch background-swatch--art" />
              <span>暮色都市</span>
            </button>
            <button type="button" :class="{ active: resolvedBackground === 'dusk' }" @click="selectBackground('dusk')">
              <span class="background-swatch background-swatch--dusk" />
              <span>夕空町市</span>
            </button>
            <button type="button" :class="{ active: resolvedBackground === 'custom' }" @click="openFilePicker">
              <span
                class="background-swatch background-swatch--custom"
                :class="{ 'has-image': customBackgroundPreview }"
                :style="customBackgroundPreview ? { backgroundImage: `url(${JSON.stringify(customBackgroundPreview)})` } : undefined"
              >
                <span v-if="!customBackgroundPreview">＋</span>
              </span>
              <span class="background-option-label" :title="customBackgroundName || (customBackgroundPreview ? '已上传图片' : '上传图片')">
                {{ customBackgroundName || (customBackgroundPreview ? '已上传图片' : '上传图片') }}
              </span>
            </button>
          </div>
          <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="handleBackgroundUpload">
        </fieldset>

        <fieldset class="setting-group" :disabled="managedDisabled">
          <legend class="setting-label">背景材质</legend>
          <div class="segmented-control" :style="segmentStyle(state.backgroundMaterial === 'liquid' ? 0 : state.backgroundMaterial === 'acrylic' ? 1 : 2)">
            <button type="button" :class="{ active: state.backgroundMaterial === 'liquid' }" @click="state.backgroundMaterial = 'liquid'">液态玻璃</button>
            <button type="button" :class="{ active: state.backgroundMaterial === 'acrylic' }" @click="state.backgroundMaterial = 'acrylic'">亚克力</button>
            <button type="button" :class="{ active: state.backgroundMaterial === 'mica' }" @click="state.backgroundMaterial = 'mica'">云母</button>
          </div>
        </fieldset>

        <div class="setting-group" :aria-disabled="managedDisabled">
          <div class="range-heading">
            <span class="setting-label">背景模糊</span>
            <output>{{ state.backgroundBlur }} px</output>
          </div>
          <input
            v-model.number="state.backgroundBlur"
            type="range"
            min="0"
            max="48"
            step="1"
            :style="{ '--range-progress': `${state.backgroundBlur / 48 * 100}%` }"
            :disabled="managedDisabled"
          >
          <div class="range-scale" aria-hidden="true"><span>0 px</span><span>48 px</span></div>
        </div>

        <div class="setting-group" :aria-disabled="managedDisabled">
          <div class="range-heading">
            <span class="setting-label">背景遮罩透明度</span>
            <output>{{ state.backgroundOverlay }} %</output>
          </div>
          <input
            v-model.number="state.backgroundOverlay"
            type="range"
            min="0"
            max="100"
            step="1"
            :style="{ '--range-progress': `${state.backgroundOverlay / 100 * 100}%` }"
            :disabled="managedDisabled"
          >
          <div class="range-scale" aria-hidden="true"><span>0 %</span><span>100 %</span></div>
        </div>

        <fieldset class="setting-group accent-setting" :disabled="state.visual === 'classic'">
          <legend class="setting-label">氛围色</legend>
          <div class="accent-options">
            <button
              v-for="accent in accents"
              :key="accent.value"
              type="button"
              :class="{ active: state.accent === accent.value }"
              :style="{ '--swatch': accent.value }"
              :aria-label="accent.name"
              :title="accent.name"
              @click="state.accent = accent.value"
            />
            <label class="accent-custom">
              <input v-model="state.accent" type="color" aria-label="选择自定义氛围色">
              <span>自定义颜色</span>
            </label>
          </div>
        </fieldset>

        <footer class="appearance-panel__footer">
          <span class="visually-hidden" role="status" aria-live="polite">{{ status }}</span>
          <button type="button" @click="resetAppearance">恢复默认</button>
        </footer>
      </div>
    </section>

    <!-- 切换「默认设置」会整体改写受管项，所以用原生 dialog 做二次确认：
         showModal() 自带 top layer、焦点陷阱与 Esc 关闭，不需要自己管层级。 -->
    <dialog
      ref="defaultSettingsDialog"
      class="appearance-confirm"
      aria-labelledby="appearance-confirm-title"
      aria-describedby="appearance-confirm-description"
      @close="pendingDefaultSettings = null"
    >
      <div class="appearance-confirm__symbol" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M5 4v16M12 4v16M19 4v16" /><path d="M3 8h4M10 16h4M17 10h4" class="appearance-confirm__knobs" /></svg>
      </div>
      <h2 id="appearance-confirm-title">{{ dialogDefaultSettings ? '启用默认设置？' : '禁用默认设置？' }}</h2>
      <p id="appearance-confirm-description">{{ dialogDefaultSettings
        ? '材质、模糊、遮罩与背景氛围将替换为当前明暗模式的默认值。'
        : '保留当前的材质、模糊、遮罩与背景氛围，交由你自由调整。' }}</p>
      <p class="appearance-confirm__detail">{{ dialogDefaultSettings
        ? '这些选项会随明暗模式自动调整；禁用默认设置后，可再次手动修改。'
        : '之后切换明暗模式，不会再自动更改这些选项。' }}</p>
      <div class="appearance-confirm__actions">
        <button type="button" class="appearance-confirm__cancel" autofocus @click="closeDefaultSettingsConfirm">取消</button>
        <button type="button" class="appearance-confirm__accept" @click="confirmDefaultSettings">
          {{ dialogDefaultSettings ? '启用默认设置' : '保留并手动调整' }}
        </button>
      </div>
    </dialog>
  </div>
</template>
