<script setup lang="ts">
import { examplePopulation, dominates, fastNonDominatedSort, crowdingDistanceAssignment, environmentalSelection, type Individual } from '~/utils/nsga-ii'

const props = withDefaults(defineProps<{ mode?: 'dominance' | 'sorting' | 'crowding' | 'selection' }>(), { mode: 'dominance' })
const uid = useId()
const step = ref(0)
const pId = ref('A'), qId = ref('F'), inspected = ref('G')
const movingF = ref(4), scaled = ref(false)
const ready = ref(false)
onMounted(() => { ready.value = true })
const titles = { dominance: '01 / 占优关系：谁支配谁？', sorting: '02 / 快速非劣排序：逐层更新 n_p', crowding: '03 / 拥挤距离：把邻居间隔算出来', selection: '04 / 精英策略：从 2N 个体留下 N 个' }
const population = computed(() => examplePopulation.map(p => ({ ...p, f: [...p.f] })))
const sorting = computed(() => fastNonDominatedSort(population.value))
const frontI = computed(() => sorting.value.fronts[1]!.map(p => ({ ...p, f: [p.id === 'F' ? movingF.value : p.f[0]!, p.f[1]! * (scaled.value ? 1000 : 1)] })))
const crowding = computed(() => crowdingDistanceAssignment(frontI.value))
const selection = computed(() => environmentalSelection(population.value, 6))
const plotPopulation = computed(() => props.mode === 'crowding' ? frontI.value : population.value)
const p = computed(() => population.value.find(x => x.id === pId.value)!)
const q = computed(() => population.value.find(x => x.id === qId.value)!)
const relation = computed(() => pId.value === qId.value ? '同一个体不支配自己：缺少“至少一项严格更好”。' : dominates(p.value, q.value) ? `${pId.value} 支配 ${qId.value}：所有目标不差，且至少一个严格更小。` : dominates(q.value, p.value) ? `${qId.value} 支配 ${pId.value}：所有目标不差，且至少一个严格更小。` : '二者互不支配：各有优势，不能只按某一个目标定胜负。')
const chosen = computed(() => frontI.value.find(x => x.id === inspected.value)!)
const terms = computed(() => crowding.value.terms[inspected.value]!)
const xPixel = (x: number) => 45 + x * 42
const yPixel = (y: number) => 340 - y * 32
const yValue = (point: Individual) => point.f[1]! / (props.mode === 'crowding' && scaled.value ? 1000 : 1)
const number = (n: number) => n === Infinity ? '∞' : Number(n.toFixed(3)).toString()
const ids = (points: Individual[]) => points.map(x => x.id).join('、') || '∅'
const frontLines = computed(() => (props.mode === 'crowding' ? [frontI.value] : sorting.value.fronts).map(front => [...front].sort((a, b) => a.f[0]! - b.f[0]!).map(p => `${xPixel(p.f[0]!)},${yPixel(yValue(p))}`).join(' ')))
const selectionSteps = [
  '合并 R_t = P_t ∪ Q_t：父代 6 个、子代 6 个，共 12 个候选；每个个体保留独立身份。',
  'fast-non-dominated-sort(R_t)：F₁ = {A, B, C}，F₂ = {D, E, F, G, H}，F₃ = {I, J, K, L}。',
  '整层装入 F₁：|P_(t+1)| = 3。下一层有 5 个，但只剩 3 个位置，因此不能整层装入。',
  'crowding-distance-assignment(F₂)：D、H 为 ∞，G 为 7/6，E、F 为 5/6。按拥挤距离从大到小选 D、H、G。',
  'P_(t+1) = {A, B, C, D, H, G}：6 个位置已满。E、F 与整个 F₃ 被淘汰；随后用新父代生成 Q_(t+1)。',
]
const maxStep = computed(() => props.mode === 'sorting' ? sorting.value.fronts.length : selectionSteps.length - 1)
const status = computed(() => {
  if (props.mode === 'dominance') return relation.value
  if (props.mode === 'crowding') return `${chosen.value.id} 的拥挤距离 d_i = ${number(crowding.value.distance[chosen.value.id]!)}。当前仅在同一层 F₂ 内计算。`
  if (props.mode === 'selection') return selectionSteps[step.value]
  if (!step.value) return '先两两比较。表中 n_p 是支配 p 的个体数；n_p = 0 的 A、B、C 进入 F₁。'
  const current = sorting.value.fronts[step.value - 1]!
  const next = sorting.value.fronts[step.value]
  return `已处理 F${step.value} = {${ids(current)}}：对每个 p 的 S_p 中的 q 执行 n_q = n_q − 1。${next ? `新变成 0 的 {${ids(next)}} 进入 F${step.value + 1}。` : '所有层均已找到。最终 n_p 都为 0，但 rank 保留各自层号。'}`
})
function selectedPoint(point: Individual) {
  if (props.mode === 'dominance') return point.id === pId.value || point.id === qId.value
  if (props.mode === 'crowding') return point.id === inspected.value
  if (props.mode === 'sorting') return sorting.value.rank[point.id] === step.value + 1
  return step.value >= 3 ? selection.value.selected.some(p => p.id === point.id) : step.value === 2 && sorting.value.rank[point.id] === 1
}
function mutedPoint(point: Individual) {
  return (props.mode === 'sorting' && sorting.value.rank[point.id]! <= step.value) || (props.mode === 'selection' && step.value >= 3 && !selectedPoint(point))
}
function reset() { step.value = 0; pId.value = 'A'; qId.value = 'F'; inspected.value = 'G'; movingF.value = 4; scaled.value = false }
</script>

<template>
  <figure class="nsga-explorer" :data-mode="mode" :aria-labelledby="`${uid}-title`">
    <figcaption :id="`${uid}-title`">{{ titles[mode] }}</figcaption>
    <p class="nsga-hint">两个目标均最小化，左下方更好。圆点来自 P_t，方点来自 Q_t；字母是个体编号。</p>
    <div class="nsga-plot-wrap">
      <svg viewBox="0 0 490 395" class="nsga-plot" role="img" :aria-labelledby="`${uid}-plot-title ${uid}-plot-desc`">
        <title :id="`${uid}-plot-title`">{{ titles[mode] }}</title>
        <desc :id="`${uid}-plot-desc`">{{ status }} 坐标与计算结果可在下方表格中阅读。</desc>
        <g class="nsga-grid">
          <template v-for="n in [2, 4, 6, 8, 10]" :key="n">
            <line :x1="xPixel(n)" y1="20" :x2="xPixel(n)" y2="340" />
            <line x1="45" :y1="yPixel(n)" x2="465" :y2="yPixel(n)" />
            <text :x="xPixel(n)" y="361" text-anchor="middle">{{ n }}</text>
            <text x="37" :y="yPixel(n) + 4" text-anchor="end">{{ mode === 'crowding' && scaled ? n * 1000 : n }}</text>
          </template>
        </g>
        <path d="M45 15 V340 H475" class="nsga-axis" />
        <text x="51" y="24">f₂ ↓</text><text x="421" y="386">f₁ ←</text><text x="31" y="356">0</text>
        <rect v-if="mode === 'dominance'" :x="xPixel(p.f[0]!)" y="20" :width="xPixel(10) - xPixel(p.f[0]!)" :height="yPixel(p.f[1]!) - 20" class="nsga-region" />
        <template v-if="mode !== 'dominance' && !(mode === 'selection' && step === 0)">
          <polyline v-for="(line, index) in frontLines" :key="index" :points="line" :class="['nsga-front', `nsga-rank-${mode === 'crowding' ? 2 : index + 1}`]" />
        </template>
        <template v-if="mode === 'crowding'">
          <template v-for="term in terms" :key="term.m">
            <line v-if="term.previous && term.next && term.m === 0" :x1="xPixel(term.previous.f[0]!)" :x2="xPixel(term.next.f[0]!)" :y1="yPixel(yValue(chosen))" :y2="yPixel(yValue(chosen))" class="nsga-gap" />
            <line v-if="term.previous && term.next && term.m === 1" :x1="xPixel(chosen.f[0]!)" :x2="xPixel(chosen.f[0]!)" :y1="yPixel(yValue(term.previous))" :y2="yPixel(yValue(term.next))" class="nsga-gap" />
          </template>
        </template>
        <g v-for="point in plotPopulation" :key="point.id" :class="['nsga-point', `nsga-rank-${sorting.rank[point.id]}`, { 'is-muted': mutedPoint(point) }]">
          <circle v-if="selectedPoint(point)" :cx="xPixel(point.f[0]!)" :cy="yPixel(yValue(point))" r="13" class="nsga-ring" />
          <circle v-if="point.source === 'P_t'" :cx="xPixel(point.f[0]!)" :cy="yPixel(yValue(point))" r="6" />
          <rect v-else :x="xPixel(point.f[0]!) - 6" :y="yPixel(yValue(point)) - 6" width="12" height="12" rx="1" />
          <text :x="xPixel(point.f[0]!) + 10" :y="yPixel(yValue(point)) - 10">{{ point.id }}</text>
        </g>
      </svg>
    </div>
    <p class="nsga-hint">{{ mode === 'dominance' ? '阴影是相对 p 各项均不更小的区域；排除与 p 完全相同的目标向量后，才是 p 支配的区域。' : mode === 'crowding' ? '粗虚线是所选个体在两个目标上的邻居间隔；逐目标排序，所以两轴的前后顺序不同。' : '连线仅帮助看清非劣层，不代表连续的真实 Pareto 前沿。F₁ 蓝色，F₂ 橙色，F₃ 紫色；表格也标明层号。' }}</p>
    <fieldset :disabled="!ready" class="nsga-controls">
      <legend>动手试一试</legend>
      <template v-if="mode === 'dominance'">
        <label :for="`${uid}-p`">个体 p <select :id="`${uid}-p`" v-model="pId"><option v-for="point in population" :key="point.id" :value="point.id">{{ point.id }} ({{ point.f.join(', ') }})</option></select></label>
        <label :for="`${uid}-q`">个体 q <select :id="`${uid}-q`" v-model="qId"><option v-for="point in population" :key="point.id" :value="point.id">{{ point.id }} ({{ point.f.join(', ') }})</option></select></label>
        <button type="button" @click="pId = 'A'; qId = 'B'">看互不支配</button>
        <button type="button" @click="pId = 'A'; qId = 'F'">看相等的一项</button>
      </template>
      <template v-else-if="mode === 'crowding'">
        <label :for="`${uid}-inspect`">个体 i <select :id="`${uid}-inspect`" v-model="inspected"><option v-for="point in frontI" :key="point.id" :value="point.id">{{ point.id }}</option></select></label>
        <label :for="`${uid}-moving`" class="nsga-slider">移动 F 的 f₁：{{ number(movingF) }} <input :id="`${uid}-moving`" v-model.number="movingF" type="range" min="3.25" max="5.75" step="0.25"></label>
        <label class="nsga-check"><input v-model="scaled" type="checkbox">f₂ 单位放大 1000 倍</label>
      </template>
      <template v-else>
        <button type="button" :disabled="step === 0" @click="step--">上一步</button>
        <span>步骤 {{ step + 1 }} / {{ maxStep + 1 }}</span>
        <button type="button" :disabled="step === maxStep" @click="step++">{{ mode === 'sorting' ? '处理这一层' : '下一步' }}</button>
      </template>
      <button type="button" @click="reset">重置</button>
    </fieldset>
    <p class="nsga-status" aria-live="polite" aria-atomic="true">{{ status }}</p>
    <template v-if="mode === 'dominance'">
      <div class="nsga-table-wrap" tabindex="0" role="region" aria-label="逐目标比较表，可横向滚动">
        <table><caption>直接比较目标值，越小越好</caption><thead><tr><th scope="col">目标</th><th scope="col">p = {{ pId }}</th><th scope="col">q = {{ qId }}</th><th scope="col">比较</th></tr></thead><tbody>
          <tr v-for="(value, m) in p.f" :key="m"><th scope="row">f{{ m + 1 }}</th><td>{{ value }}</td><td>{{ q.f[m] }}</td><td>{{ value < q.f[m]! ? 'p 更好' : value > q.f[m]! ? 'q 更好' : '相等' }}</td></tr>
        </tbody></table>
      </div>
    </template>
    <template v-else-if="mode === 'crowding'">
      <div class="nsga-calculation">
        <p v-for="term in terms" :key="term.m">f{{ term.m + 1 }}：{{ term.boundary ? '边界点 → ∞' : term.range === 0 ? '该目标极差为 0 → 跳过' : `前邻 ${term.previous!.id}、后邻 ${term.next!.id}：( ${number(term.next!.f[term.m]!)} − ${number(term.previous!.f[term.m]!)} ) / ${number(term.range)} = ${number(term.value)}` }}</p>
        <p>d_i = {{ terms.map(term => number(term.value)).join(' + ') }} = {{ number(crowding.distance[inspected]!) }}</p>
      </div>
      <div class="nsga-table-wrap" tabindex="0" role="region" aria-label="同层拥挤距离表，可横向滚动"><table><caption>I = F₂，逐目标归一化后相加</caption><thead><tr><th scope="col">个体</th><th scope="col">f₁</th><th scope="col">f₂</th><th scope="col">d_i</th></tr></thead><tbody>
        <tr v-for="point in frontI" :key="point.id" :class="{ 'is-active': point.id === inspected }"><th scope="row">{{ point.id }}</th><td>{{ number(point.f[0]!) }}</td><td>{{ number(point.f[1]!) }}</td><td>{{ number(crowding.distance[point.id]!) }}</td></tr>
      </tbody></table></div>
      <p class="nsga-hint">移动 F 会改变邻居的间隔；F 自己的两侧邻居没换，因此自己的 d_i 可以保持不变。放大 f₂ 的单位不会改变归一化结果。</p>
    </template>
    <template v-else>
      <div class="nsga-table-wrap" tabindex="0" role="region" aria-label="非劣排序状态表，可横向滚动"><table><caption>{{ mode === 'sorting' ? 'n_p 会递减，S_p 始终记录初始支配集合' : '环境选择记录（N = 6）' }}</caption><thead><tr><th scope="col">个体 (f₁, f₂)</th><th scope="col">来源</th><th v-if="mode === 'sorting'" scope="col">n_p</th><th v-if="mode === 'sorting'" scope="col">S_p</th><th scope="col">rank</th><th v-if="mode === 'selection'" scope="col">去向</th></tr></thead><tbody>
        <tr v-for="point in population" :key="point.id" :class="{ 'is-active': selectedPoint(point) }">
          <th scope="row">{{ point.id }} ({{ point.f.join(', ') }})</th><td>{{ point.source }}</td>
          <template v-if="mode === 'sorting'"><td>{{ sorting.snapshots[step]![point.id] }}</td><td>{ {{ sorting.S_p[point.id]!.join(', ') || '∅' }} }</td></template>
          <td>{{ mode === 'sorting' ? (sorting.rank[point.id]! <= step + 1 ? sorting.rank[point.id] : '待定') : step >= 1 ? sorting.rank[point.id] : '待定' }}</td>
          <td v-if="mode === 'selection'">{{ step >= 3 ? selectedPoint(point) ? '保留' : '淘汰' : step === 2 && selectedPoint(point) ? '整层保留' : '待定' }}</td>
        </tr>
      </tbody></table></div>
    </template>
    <noscript><p>当前显示初始图与数据。启用 JavaScript 可操作；下方正文保留完整手算过程。</p></noscript>
  </figure>
</template>

<style scoped>
.nsga-explorer { --nsga-blue: #3c64ab; --nsga-orange: #9b5c22; --nsga-purple: #8654a8; margin: 2em 0; padding: clamp(12px, 3vw, 24px); border: 1px solid var(--line); border-radius: 12px; color: var(--ink); font-family: var(--sans); }
:global(:root[data-color-mode='dark'] .nsga-explorer) { --nsga-blue: #a5c5ff; --nsga-orange: #f5bd85; --nsga-purple: #d8aff2; }
.nsga-explorer figcaption { font-size: 17px; font-weight: 650; line-height: 1.7; }
.nsga-explorer .nsga-hint { font-size: 13px; color: var(--muted); line-height: 1.8; margin: 12px 0; }
.nsga-plot-wrap { overflow-x: auto; }
.nsga-plot { display: block; width: 100%; min-width: 290px; max-width: 560px; height: auto; margin-inline: auto; }
.nsga-plot text { font: 14px var(--sans); fill: var(--ink); }
.nsga-grid line { stroke: var(--line); opacity: .5; }
.nsga-grid text { font-size: 12px; }
.nsga-axis { fill: none; stroke: var(--muted); stroke-width: 1.5; }
.nsga-region { fill: var(--nsga-blue); opacity: .12; }
.nsga-rank-1 { color: var(--nsga-blue); }
.nsga-rank-2 { color: var(--nsga-orange); }
.nsga-rank-3 { color: var(--nsga-purple); }
.nsga-front { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-dasharray: 4 5; opacity: .65; }
.nsga-point { fill: currentColor; }
.nsga-point .nsga-ring { fill: none; stroke: var(--ink); stroke-width: 1.6; }
.nsga-point.is-muted { opacity: .33; }
.nsga-gap { stroke: var(--ink); stroke-width: 3; stroke-dasharray: 7 4; }
.nsga-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; border: 0; padding: 0; margin: 18px 0; min-width: 0; font-size: 14px; }
.nsga-controls legend { font-weight: 600; margin-bottom: 10px; }
.nsga-controls label { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.nsga-controls select, .nsga-controls button { min-height: 44px; border: 1px solid var(--line); border-radius: 6px; padding: 7px 11px; font: inherit; background: transparent; color: var(--ink); }
.nsga-controls select { background: var(--paper, #fff); }
.nsga-controls option { background: var(--bg, #fff); color: var(--ink); }
.nsga-controls button { cursor: pointer; }
.nsga-controls button:disabled { opacity: .45; cursor: default; }
.nsga-controls button:hover:not(:disabled) { border-color: var(--accent); }
.nsga-controls input { accent-color: var(--accent); min-height: 32px; }
.nsga-controls .nsga-slider { width: 100%; }
.nsga-slider input { flex: 1; min-width: 100px; }
.nsga-controls .nsga-check { min-height: 44px; }
.nsga-explorer :is(button, input, select, .nsga-table-wrap):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.nsga-explorer .nsga-status { border-left: 3px solid var(--accent); padding: 10px 14px; margin: 18px 0; font-size: 14px; line-height: 1.9; }
.nsga-calculation { font-size: 14px; overflow-wrap: anywhere; }
.nsga-calculation p { margin: 8px 0; }
.nsga-table-wrap { overflow-x: auto; max-width: 100%; }
.nsga-explorer table { width: 100%; border-collapse: collapse; font: 13px/1.8 var(--sans); margin: 0; }
.nsga-explorer caption { text-align: left; color: var(--muted); font-size: 12px; padding: 8px 0; }
.nsga-explorer :is(td, th) { text-align: left; border-bottom: 1px solid var(--line); padding: 8px 10px; white-space: nowrap; }
.nsga-explorer tr.is-active { background: color-mix(in srgb, var(--accent) 10%, transparent); }
</style>
