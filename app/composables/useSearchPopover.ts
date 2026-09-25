import type { Ref } from 'vue'

/** Top-layer positioning avoids the content panel's backdrop-filter boundary. */
export function useSearchPopover(root: Ref<HTMLElement | null>, popup: Ref<HTMLElement | null>, open: Ref<boolean>, minimumWidth = 0) {
  let timer: ReturnType<typeof setTimeout> | undefined
  function position() {
    const anchor = root.value
    const layer = popup.value
    if (!anchor || !layer || !open.value) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, minimumWidth), document.documentElement.clientWidth - 24)
    const left = Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12))
    layer.style.setProperty('--popup-left', `${left}px`)
    layer.style.setProperty('--popup-width', `${width}px`)
    const height = layer.firstElementChild?.scrollHeight || 320
    const below = window.innerHeight - rect.bottom - 18
    const above = rect.top - 18
    const flip = below < height && above > below
    layer.style.setProperty('--popup-top', flip ? 'auto' : `${rect.bottom + 6}px`)
    layer.style.setProperty('--popup-bottom', flip ? `${window.innerHeight - rect.top + 6}px` : 'auto')
    layer.style.setProperty('--popup-height', `${Math.max(80, flip ? above : below)}px`)
  }
  watch(open, async value => {
    clearTimeout(timer)
    await nextTick()
    if (value && open.value) {
      popup.value?.showPopover?.()
      position()
    } else if (!open.value) {
      timer = setTimeout(() => popup.value?.hidePopover?.(), 190)
    }
  }, { flush: 'post' })
  onMounted(() => {
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    popup.value?.hidePopover?.()
    window.removeEventListener('resize', position)
    window.removeEventListener('scroll', position, true)
  })
}
