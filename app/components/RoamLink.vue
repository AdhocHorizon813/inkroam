<script setup lang="ts">
import { chooseRoamPath, readRoamHistory, rememberRoamPath, roamPaths, type RoamEntry } from '~/utils/roam'

const props = defineProps<{ entries: RoamEntry[] }>()
const paths = computed(() => roamPaths(props.entries))
const history = useState<string[]>('roam-history', () => [])
const selected = ref<string>()
// Stable SSR/hydration and a useful ordinary link when JavaScript is disabled.
const target = computed(() => selected.value && paths.value.includes(selected.value) ? selected.value : paths.value[0])
const STORAGE_KEY = 'inkroam-roam-history-v1'
let mounted = false

function choose() {
  selected.value = chooseRoamPath(paths.value, history.value)
}

onMounted(() => {
  mounted = true
  try { history.value = readRoamHistory(sessionStorage.getItem(STORAGE_KEY)) ?? history.value } catch {}
  choose()
})
watch(paths, () => { if (mounted) choose() })

function remember(event: MouseEvent) {
  if (event.defaultPrevented || event.button > 1 || !target.value) return
  history.value = rememberRoamPath(paths.value, history.value, target.value)
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.value)) } catch {}
  // Do not replace the href during activation: modified clicks/new tabs stay native.
}
</script>

<template>
  <NuxtLink v-if="target" class="text-link" :to="target" :prefetch="false" @click.capture="remember" @auxclick.capture="remember">
    随手翻一页 <span aria-hidden="true">↗</span>
  </NuxtLink>
</template>
