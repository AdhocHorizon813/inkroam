<script setup lang="ts">
interface LightboxImage {
  src: string
  alt: string
}

const props = defineProps<{
  open: boolean
  images: LightboxImage[]
  index: number
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'update:index', value: number): void
}>()

/* Zoom limits, the anchor used by a double click and the wheel step size. */
const MIN_SCALE = 1
const MAX_SCALE = 6
const DOUBLE_CLICK_SCALE = 2.5
const WHEEL_SENSITIVITY = 0.0022
/* Keeps at least this much of the image on screen while panning. */
const PAN_MARGIN = 64
/* A single click closes the viewer, but only after this delay so that a
   double click can cancel it and zoom instead. */
const CLOSE_DELAY = 240

const dialog = ref<HTMLElement | null>(null)
const imageEl = ref<HTMLImageElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isPanning = ref(false)
const isAnimating = ref(false)

let restoreFocus: HTMLElement | null = null
let previousPaddingRight = ''
let closeTimer: number | null = null
let animationTimer: number | null = null

/* Pointer bookkeeping for drag-to-pan and two-finger pinch. */
const pointers = new Map<number, { x: number, y: number }>()
let dragStart: { x: number, y: number, tx: number, ty: number } | null = null
let pinchStart: {
  distance: number
  scale: number
  tx: number
  ty: number
  x: number
  y: number
} | null = null
let movedDuringDrag = false

const total = computed(() => props.images.length)
const current = computed(() => props.images[props.index])
const hasMultiple = computed(() => total.value > 1)
const isZoomed = computed(() => scale.value > MIN_SCALE + 0.001)
const zoomLabel = computed(() => `${Math.round(scale.value * 100)}%`)
const imageStyle = computed(() => ({
  transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
}))

function close() {
  cancelPendingClose()
  emit('update:open', false)
}

function cancelPendingClose() {
  if (closeTimer === null) return
  window.clearTimeout(closeTimer)
  closeTimer = null
}

function go(step: number) {
  if (!hasMultiple.value) return
  emit('update:index', (props.index + step + total.value) % total.value)
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

/* Layout box of the image, ignoring the zoom transform. offsetLeft/offsetTop
   are not affected by transforms, so the anchor point stays stable while the
   scale changes. */
function layoutBox() {
  const el = imageEl.value
  if (!el) return null
  const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent : null
  const base = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 }
  return {
    centerX: base.left + el.offsetLeft + el.offsetWidth / 2,
    centerY: base.top + el.offsetTop + el.offsetHeight / 2,
    width: el.offsetWidth,
    height: el.offsetHeight,
  }
}

/* Keep part of the image inside the viewport so it can always be dragged back. */
function clampTranslation(x: number, y: number, nextScale: number) {
  const box = layoutBox()
  if (!box) return { x, y }
  const limit = (center: number, size: number, viewport: number) => {
    const low = PAN_MARGIN - size / 2
    const high = viewport - PAN_MARGIN + size / 2
    return Math.min(Math.max(center, Math.min(low, high)), Math.max(low, high))
  }
  return {
    x: limit(box.centerX + x, box.width * nextScale, window.innerWidth) - box.centerX,
    y: limit(box.centerY + y, box.height * nextScale, window.innerHeight) - box.centerY,
  }
}

/* Scale so that the image point under (clientX, clientY) stays under it. */
function zoomAt(nextScale: number, clientX: number, clientY: number) {
  const box = layoutBox()
  if (!box) return
  const from = scale.value
  const target = clampScale(nextScale)
  if (Math.abs(target - from) < 0.0005) return
  const ratio = target / from
  const localX = clientX - box.centerX - translateX.value
  const localY = clientY - box.centerY - translateY.value
  const x = clientX - box.centerX - ratio * localX
  const y = clientY - box.centerY - ratio * localY
  scale.value = target
  if (target <= MIN_SCALE) {
    translateX.value = 0
    translateY.value = 0
    return
  }
  const clamped = clampTranslation(x, y, target)
  translateX.value = clamped.x
  translateY.value = clamped.y
}

function flashAnimation() {
  isAnimating.value = true
  if (animationTimer !== null) window.clearTimeout(animationTimer)
  animationTimer = window.setTimeout(() => {
    isAnimating.value = false
    animationTimer = null
  }, 320)
}

function resetZoom(animate = false) {
  pointers.clear()
  dragStart = null
  pinchStart = null
  isPanning.value = false
  movedDuringDrag = false
  if (scale.value === MIN_SCALE && translateX.value === 0 && translateY.value === 0) return
  if (animate) flashAnimation()
  scale.value = MIN_SCALE
  translateX.value = 0
  translateY.value = 0
}

/* --- wheel / double click / click -------------------------------------- */

function onWheel(event: WheelEvent) {
  event.preventDefault()
  /* Normalise line/page delta modes so wheels, trackpads and browsers feel alike. */
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
  const factor = Math.exp(-event.deltaY * unit * WHEEL_SENSITIVITY)
  zoomAt(scale.value * factor, event.clientX, event.clientY)
}

function onDoubleClick(event: MouseEvent) {
  event.preventDefault()
  cancelPendingClose()
  if (isZoomed.value) {
    resetZoom(true)
    return
  }
  flashAnimation()
  zoomAt(DOUBLE_CLICK_SCALE, event.clientX, event.clientY)
}

function onImageClick() {
  if (isZoomed.value) return
  if (movedDuringDrag) {
    movedDuringDrag = false
    return
  }
  if (closeTimer !== null) return
  closeTimer = window.setTimeout(() => {
    closeTimer = null
    close()
  }, CLOSE_DELAY)
}

/* --- drag to pan and pinch to zoom ------------------------------------- */

function onPointerDown(event: PointerEvent) {
  const el = imageEl.value
  if (!el) return
  try {
    el.setPointerCapture(event.pointerId)
  } catch {
    /* Pointer capture is best effort. */
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  movedDuringDrag = false

  if (pointers.size >= 2) {
    const [first, second] = [...pointers.values()]
    if (!first || !second) return
    pinchStart = {
      distance: Math.hypot(first.x - second.x, first.y - second.y),
      scale: scale.value,
      tx: translateX.value,
      ty: translateY.value,
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    }
    dragStart = null
    isPanning.value = true
    return
  }

  if (isZoomed.value) {
    dragStart = { x: event.clientX, y: event.clientY, tx: translateX.value, ty: translateY.value }
    isPanning.value = true
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.size >= 2 && pinchStart) {
    const box = layoutBox()
    const [first, second] = [...pointers.values()]
    if (!box || !first || !second) return
    const distance = Math.hypot(first.x - second.x, first.y - second.y)
    const target = clampScale(pinchStart.scale * (distance / (pinchStart.distance || 1)))
    const ratio = target / pinchStart.scale
    /* Image-local point that was under the initial midpoint. */
    const localX = (pinchStart.x - box.centerX - pinchStart.tx) / pinchStart.scale
    const localY = (pinchStart.y - box.centerY - pinchStart.ty) / pinchStart.scale
    const midX = (first.x + second.x) / 2
    const midY = (first.y + second.y) / 2
    scale.value = target
    if (target <= MIN_SCALE) {
      translateX.value = 0
      translateY.value = 0
    } else {
      const clamped = clampTranslation(
        midX - box.centerX - ratio * localX,
        midY - box.centerY - ratio * localY,
        target,
      )
      translateX.value = clamped.x
      translateY.value = clamped.y
    }
    movedDuringDrag = true
    return
  }

  if (!dragStart) return
  const dx = event.clientX - dragStart.x
  const dy = event.clientY - dragStart.y
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedDuringDrag = true
  const clamped = clampTranslation(dragStart.tx + dx, dragStart.ty + dy, scale.value)
  translateX.value = clamped.x
  translateY.value = clamped.y
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  const el = imageEl.value
  if (el) {
    try {
      el.releasePointerCapture(event.pointerId)
    } catch {
      /* Already released. */
    }
  }
  if (pointers.size < 2) pinchStart = null
  if (pointers.size === 0) {
    dragStart = null
    isPanning.value = false
    return
  }
  /* A finger left over after a pinch keeps panning from its new position. */
  const remaining = [...pointers.values()][0]
  dragStart = remaining && isZoomed.value
    ? { x: remaining.x, y: remaining.y, tx: translateX.value, ty: translateY.value }
    : null
}
/* --- keyboard ----------------------------------------------------------- */

/* Keep Tab focus inside the viewer while it is open. */
function trapFocus(event: KeyboardEvent) {
  const container = dialog.value
  if (!container) return
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>('button:not([tabindex="-1"])'),
  )
  if (!focusable.length) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    go(1)
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    go(-1)
    return
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomAt(scale.value * 1.25, window.innerWidth / 2, window.innerHeight / 2)
    return
  }
  if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    zoomAt(scale.value / 1.25, window.innerWidth / 2, window.innerHeight / 2)
    return
  }
  if (event.key === '0') {
    event.preventDefault()
    resetZoom(true)
    return
  }
  if (event.key === 'Tab') trapFocus(event)
}

/* Compensate the removed scrollbar so locking the page does not shift layout. */
function lockScroll() {
  const root = document.documentElement
  const gap = window.innerWidth - root.clientWidth
  previousPaddingRight = root.style.paddingRight
  if (gap > 0) root.style.paddingRight = `${gap}px`
  root.style.overflow = 'hidden'
}

function unlockScroll() {
  const root = document.documentElement
  root.style.overflow = ''
  root.style.paddingRight = previousPaddingRight
  previousPaddingRight = ''
}

watch(() => props.open, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    resetZoom()
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lockScroll()
    window.addEventListener('keydown', onKeydown)
    await nextTick()
    closeButton.value?.focus()
  } else {
    cancelPendingClose()
    if (animationTimer !== null) {
      window.clearTimeout(animationTimer)
      animationTimer = null
    }
    isAnimating.value = false
    resetZoom()
    window.removeEventListener('keydown', onKeydown)
    unlockScroll()
    restoreFocus?.focus()
    restoreFocus = null
  }
})

/* Switching images always starts from the fitted view. */
watch(() => props.index, () => resetZoom())

onBeforeUnmount(() => {
  if (!import.meta.client) return
  cancelPendingClose()
  if (animationTimer !== null) window.clearTimeout(animationTimer)
  window.removeEventListener('keydown', onKeydown)
  unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="open && current"
        ref="dialog"
        class="image-lightbox"
        :class="{ 'is-zoomed': isZoomed, 'is-panning': isPanning, 'is-animating': isAnimating }"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
      >
        <div class="image-lightbox__backdrop" @click="close" />

        <div class="image-lightbox__hud">
          <span class="image-lightbox__count">{{ index + 1 }} / {{ total }}</span>
          <span v-if="isZoomed" class="image-lightbox__zoom">{{ zoomLabel }}</span>
          <span v-else class="image-lightbox__hint">双击或滚轮缩放</span>
        </div>

        <button
          ref="closeButton"
          class="image-lightbox__close"
          type="button"
          aria-label="关闭图片预览"
          @click="close"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m6 6 12 12" />
            <path d="m18 6-12 12" />
          </svg>
        </button>

        <button
          v-if="hasMultiple"
          class="image-lightbox__nav image-lightbox__nav--prev"
          type="button"
          aria-label="上一张图片"
          @click="go(-1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m14.5 5.5-7 6.5 7 6.5" />
          </svg>
        </button>

        <figure class="image-lightbox__figure">
          <img
            ref="imageEl"
            class="image-lightbox__image"
            :src="current.src"
            :alt="current.alt"
            :style="imageStyle"
            draggable="false"
            @click="onImageClick"
            @dblclick="onDoubleClick"
            @wheel="onWheel"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
          <figcaption v-if="current.alt" class="image-lightbox__caption">{{ current.alt }}</figcaption>
        </figure>

        <button
          v-if="hasMultiple"
          class="image-lightbox__nav image-lightbox__nav--next"
          type="button"
          aria-label="下一张图片"
          @click="go(1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m9.5 5.5 7 6.5-7 6.5" />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
