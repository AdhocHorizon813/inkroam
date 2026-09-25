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
    /* 内容高度取面层自己的高度。不要用裁剪窗的 scrollHeight：向上展开时内容贴的是下沿，
       会溢到裁剪窗上沿之外，而 scrollHeight 不计反方向溢出，展开判断会量到 0。 */
    const height = layer.querySelector<HTMLElement>('.dropdown-surface')?.offsetHeight || 320
    const below = window.innerHeight - rect.bottom - 18
    const above = rect.top - 18
    const flip = below < height && above > below
    /* 收起动画由裁剪窗从远边切内容。内容贴哪条边由 CSS 按这个标记决定：
       向上展开贴下沿（触发框那一侧），向下展开贴上沿，两边镜像。 */
    layer.dataset.flip = flip ? 'up' : 'down'
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
