<script setup lang="ts">
type VisualMode = 'modern' | 'classic'
type ColorMode = 'dark' | 'light' | 'auto'
type MaterialMode = 'liquid' | 'acrylic' | 'mica'
type BackgroundMode = 'flat' | 'art' | 'aurora' | 'custom'
type LatestPostCount = 5 | 10 | 'all'

interface AppearanceState {
  visual: VisualMode
  colorMode: ColorMode
  navMaterial: MaterialMode
  contentMaterial: MaterialMode
  backgroundMaterial: MaterialMode
  background: BackgroundMode
  navBlur: number
  contentBlur: number
  backgroundBlur: number
  backgroundOverlay: number
  accent: string
  latestPostCount: LatestPostCount
}

const STORAGE_KEY = 'paper-trail-appearance-v5'
const LEGACY_STORAGE_KEY = 'paper-trail-appearance-v4'
const CUSTOM_BG_KEY = 'paper-trail-custom-background'
const CUSTOM_BG_NAME_KEY = 'paper-trail-custom-background-name'

const isOpen = ref(false)
const status = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const panelScroll = ref<HTMLDivElement | null>(null)
const customBackgroundPreview = ref('')
const customBackgroundName = ref('')
const sharedLatestPostCount = useState<LatestPostCount>('latest-post-count', () => 10)
const state = reactive<AppearanceState>({
  visual: 'modern',
  colorMode: 'auto',
  navMaterial: 'mica',
  contentMaterial: 'mica',
  backgroundMaterial: 'mica',
  background: 'art',
  navBlur: 12,
  contentBlur: 10,
  backgroundBlur: 4,
  backgroundOverlay: 40,
  accent: '#7892b2',
  latestPostCount: 10,
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

function onSystemThemeChange() {
  if (state.colorMode === 'auto') applyAppearance()
}

onMounted(() => {
  try {
    customBackgroundPreview.value = localStorage.getItem(CUSTOM_BG_KEY) || ''
    customBackgroundName.value = localStorage.getItem(CUSTOM_BG_NAME_KEY) || ''
    const saved = localStorage.getItem(STORAGE_KEY)
    const legacy = !saved ? localStorage.getItem(LEGACY_STORAGE_KEY) : null
    if (saved) {
      Object.assign(state, JSON.parse(saved))
    } else if (legacy) {
      const { blur, ...previous } = JSON.parse(legacy)
      Object.assign(state, previous, {
        navBlur: typeof blur === 'number' ? blur : state.navBlur,
        contentBlur: typeof blur === 'number' ? blur : state.contentBlur,
      })
    }
    if (state.latestPostCount !== 5 && state.latestPostCount !== 10 && state.latestPostCount !== 'all') {
      state.latestPostCount = 10
    }
    sharedLatestPostCount.value = state.latestPostCount
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

const DISCRETE_FIELDS = ['visual', 'colorMode', 'navMaterial', 'contentMaterial', 'backgroundMaterial', 'background', 'accent'] as const

watch(state, (_state, from) => {
  const discreteChanged =
    !!from && DISCRETE_FIELDS.some((key) => state[key] !== from![key])
  const apply = () => {
    sharedLatestPostCount.value = state.latestPostCount
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

watch(isOpen, async (open) => {
  if (!open) return
  await nextTick()
  if (panelScroll.value) panelScroll.value.scrollTop = 0
})

function applyAppearance() {
  if (!import.meta.client) return
  const root = document.documentElement
  const mode = state.colorMode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : state.colorMode
  root.dataset.visual = state.visual
  root.dataset.colorMode = mode
  root.dataset.theme = mode
  root.dataset.navMaterial = state.navMaterial
  root.dataset.material = state.contentMaterial
  root.dataset.backgroundMaterial = state.backgroundMaterial
  root.dataset.background = state.background
  root.style.setProperty('--nav-blur', `${state.navBlur}px`)
  root.style.setProperty('--content-blur', `${state.contentBlur}px`)
  root.style.setProperty('--background-blur', `${state.backgroundBlur}px`)
  root.style.setProperty('--glass-blur', `${state.contentBlur}px`)
  root.style.setProperty('--modern-accent', state.accent)
  root.style.setProperty('--background-overlay-opacity', String(state.backgroundOverlay / 100))

  if (state.background === 'custom') {
    const custom = localStorage.getItem(CUSTOM_BG_KEY)
    if (custom) root.style.setProperty('--custom-background', `url(${JSON.stringify(custom)})`)
  } else {
    root.style.removeProperty('--custom-background')
  }
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
    navMaterial: 'mica',
    contentMaterial: 'mica',
    backgroundMaterial: 'mica',
    background: 'art',
    navBlur: 12,
    contentBlur: 10,
    backgroundBlur: 4,
    backgroundOverlay: 40,
    accent: '#7892b2',
    latestPostCount: 10,
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

        <fieldset class="setting-group">
          <legend class="setting-label">外观模式</legend>
          <div class="segmented-control" :style="segmentStyle(state.colorMode === 'light' ? 0 : state.colorMode === 'dark' ? 1 : 2)">
            <button type="button" :class="{ active: state.colorMode === 'light' }" @click="state.colorMode = 'light'">浅色</button>
            <button type="button" :class="{ active: state.colorMode === 'dark' }" @click="state.colorMode = 'dark'">深色</button>
            <button type="button" :class="{ active: state.colorMode === 'auto' }" @click="state.colorMode = 'auto'">自动</button>
          </div>
        </fieldset>

        <fieldset class="setting-group">
          <legend class="setting-label">最近写下</legend>
          <div class="segmented-control" :style="segmentStyle(state.latestPostCount === 5 ? 0 : state.latestPostCount === 10 ? 1 : 2)">
            <button type="button" :class="{ active: state.latestPostCount === 5 }" @click="state.latestPostCount = 5">5 篇</button>
            <button type="button" :class="{ active: state.latestPostCount === 10 }" @click="state.latestPostCount = 10">10 篇</button>
            <button type="button" :class="{ active: state.latestPostCount === 'all' }" @click="state.latestPostCount = 'all'">所有</button>
          </div>
        </fieldset>

        <fieldset class="setting-group" :disabled="state.visual === 'classic'">
          <legend class="setting-label">导航材质</legend>
          <div class="segmented-control" :style="segmentStyle(state.navMaterial === 'liquid' ? 0 : state.navMaterial === 'acrylic' ? 1 : 2)">
            <button type="button" :class="{ active: state.navMaterial === 'liquid' }" @click="state.navMaterial = 'liquid'">液态玻璃</button>
            <button type="button" :class="{ active: state.navMaterial === 'acrylic' }" @click="state.navMaterial = 'acrylic'">亚克力</button>
            <button type="button" :class="{ active: state.navMaterial === 'mica' }" @click="state.navMaterial = 'mica'">云母</button>
          </div>
        </fieldset>

        <div class="setting-group" :aria-disabled="state.visual === 'classic'">
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
            :disabled="state.visual === 'classic'"
          >
          <div class="range-scale" aria-hidden="true"><span>0 px</span><span>48 px</span></div>
        </div>

        <fieldset class="setting-group" :disabled="state.visual === 'classic'">
          <legend class="setting-label">内容材质</legend>
          <div class="segmented-control" :style="segmentStyle(state.contentMaterial === 'liquid' ? 0 : state.contentMaterial === 'acrylic' ? 1 : 2)">
            <button type="button" :class="{ active: state.contentMaterial === 'liquid' }" @click="state.contentMaterial = 'liquid'">液态玻璃</button>
            <button type="button" :class="{ active: state.contentMaterial === 'acrylic' }" @click="state.contentMaterial = 'acrylic'">亚克力</button>
            <button type="button" :class="{ active: state.contentMaterial === 'mica' }" @click="state.contentMaterial = 'mica'">云母</button>
          </div>
        </fieldset>

        <div class="setting-group" :aria-disabled="state.visual === 'classic'">
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
            :disabled="state.visual === 'classic'"
          >
          <div class="range-scale" aria-hidden="true"><span>0 px</span><span>48 px</span></div>
        </div>

        <fieldset class="setting-group" :disabled="state.visual === 'classic'">
          <legend class="setting-label">背景氛围</legend>
          <div class="background-options">
            <button type="button" :class="{ active: state.background === 'flat' }" @click="state.background = 'flat'">
              <span class="background-swatch background-swatch--flat" />
              <span>静谧纯色</span>
            </button>
            <button type="button" :class="{ active: state.background === 'art' }" @click="state.background = 'art'">
              <span class="background-swatch background-swatch--art" />
              <span>暮色都市</span>
            </button>
            <button type="button" :class="{ active: state.background === 'aurora' }" @click="state.background = 'aurora'">
              <span class="background-swatch background-swatch--aurora" />
              <span>极光渐变</span>
            </button>
            <button type="button" :class="{ active: state.background === 'custom' }" @click="openFilePicker">
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

        <fieldset class="setting-group" :disabled="state.visual === 'classic'">
          <legend class="setting-label">背景材质</legend>
          <div class="segmented-control" :style="segmentStyle(state.backgroundMaterial === 'liquid' ? 0 : state.backgroundMaterial === 'acrylic' ? 1 : 2)">
            <button type="button" :class="{ active: state.backgroundMaterial === 'liquid' }" @click="state.backgroundMaterial = 'liquid'">液态玻璃</button>
            <button type="button" :class="{ active: state.backgroundMaterial === 'acrylic' }" @click="state.backgroundMaterial = 'acrylic'">亚克力</button>
            <button type="button" :class="{ active: state.backgroundMaterial === 'mica' }" @click="state.backgroundMaterial = 'mica'">云母</button>
          </div>
        </fieldset>

        <div class="setting-group" :aria-disabled="state.visual === 'classic'">
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
            :disabled="state.visual === 'classic'"
          >
          <div class="range-scale" aria-hidden="true"><span>0 px</span><span>48 px</span></div>
        </div>

        <div class="setting-group" :aria-disabled="state.visual === 'classic'">
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
            :disabled="state.visual === 'classic'"
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
  </div>
</template>
