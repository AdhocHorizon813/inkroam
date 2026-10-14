<script setup lang="ts">
import { matrixFacts, transformPoint, symmetricSpectrum, quadraticContour, polynomialValue, polynomialDerivative, polynomialRootFacts, type Point } from '~/utils/algebra-explorer'

const props = withDefaults(defineProps<{ mode?: 'matrix' | 'quadratic' | 'polynomial' }>(), { mode: 'matrix' })
const uid = useId()
const a = ref(props.mode === 'quadratic' ? 2 : 1)
const b = ref(1)
const c = ref(0)
const d = ref(props.mode === 'quadratic' ? 2 : 1)
const t = ref(-1)
const title = computed(() => props.mode === 'matrix' ? '矩阵变换与有向面积' : props.mode === 'quadratic' ? '二次型等值线与主轴' : '重根合并与导数')
const facts = computed(() => matrixFacts(a.value, b.value, c.value, d.value))
const spectrum = computed(() => symmetricSpectrum(a.value, b.value, d.value))
const roots = computed(() => polynomialRootFacts(t.value))
const square: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
const mapped = computed(() => square.map(p => transformPoint(a.value, b.value, c.value, d.value, p)))
const positiveContour = computed(() => quadraticContour(a.value, b.value, d.value, 1))
const negativeContour = computed(() => quadraticContour(a.value, b.value, d.value, -1))
const xPixel = (x: number) => props.mode === 'polynomial' ? 40 + (x + 2) * 400 / 6 : 240 + x * 48
const yPixel = (y: number) => props.mode === 'polynomial' ? 240 - y * 16 : 240 - y * 48
const gridX = computed(() => props.mode === 'polynomial' ? Array.from({ length: 7 }, (_, i) => xPixel(i - 2)) : Array.from({ length: 9 }, (_, i) => xPixel(i - 4)))
const gridY = computed(() => props.mode === 'polynomial' ? Array.from({ length: 9 }, (_, i) => yPixel(3 * (i - 4))) : Array.from({ length: 9 }, (_, i) => yPixel(i - 4)))
const points = (list: Point[]) => list.map(p => `${xPixel(p.x)},${yPixel(p.y)}`).join(' ')
const curve = (derivative: boolean) => Array.from({ length: 361 }, (_, index) => {
  const x = -2 + index / 60
  return { x, y: derivative ? polynomialDerivative(t.value, x) : polynomialValue(t.value, x) }
})
const polynomialCurve = computed(() => points(curve(false)))
const derivativeCurve = computed(() => points(curve(true)))
const number = (value: number) => Math.abs(value) < 1e-10 ? '0' : Number(value.toFixed(3)).toString()
const summary = computed(() => props.mode === 'matrix'
  ? `行列式 ${number(facts.value.determinant)}；面积倍率 ${number(Math.abs(facts.value.determinant))}；秩 ${facts.value.rank}。`
  : props.mode === 'quadratic'
    ? `特征值 ${spectrum.value.values.map(number).join('、')}；${spectrum.value.classification}。`
    : `t = ${number(t.value)}；根 1 的重数 ${roots.value.repeatedRootMultiplicity}；最大公因式次数 ${roots.value.gcdDegree}。`)
const matrixControls = computed(() => props.mode === 'quadratic' ? ['a', 'b', 'd'] : ['a', 'b', 'c', 'd'])
function coefficient(key: string) { return key === 'a' ? a.value : key === 'b' ? b.value : key === 'c' ? c.value : d.value }
function updateCoefficient(key: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (key === 'a') a.value = value
  else if (key === 'b') b.value = value
  else if (key === 'c') c.value = value
  else d.value = value
}
function preset(values: number[]) { [a.value, b.value, c.value, d.value] = values as [number, number, number, number] }
</script>

<template>
  <figure class="algebra-explorer" :aria-labelledby="`${uid}-title`">
    <figcaption :id="`${uid}-title`">{{ title }}</figcaption>
    <p v-if="mode === 'matrix'" class="algebra-formula">A = [ {{ number(a) }}, {{ number(b) }} ; {{ number(c) }}, {{ number(d) }} ]</p>
    <p v-else-if="mode === 'quadratic'" class="algebra-formula">q(x, y) = ax² + 2bxy + dy²；A = [ {{ number(a) }}, {{ number(b) }} ; {{ number(b) }}, {{ number(d) }} ]</p>
    <p v-else class="algebra-formula">pₜ(x) = (x − 1)²(x − t)；p′ₜ(x) = (x − 1)(3x − 2t − 1)</p>
    <div class="algebra-layout">
      <svg viewBox="0 0 480 480" class="algebra-plot" role="img" :aria-labelledby="`${uid}-svg-title ${uid}-svg-desc`">
        <title :id="`${uid}-svg-title`">{{ title }}</title>
        <desc :id="`${uid}-svg-desc`">{{ summary }}{{ mode === 'matrix' ? '原单位正方形与其矩阵像。' : mode === 'quadratic' ? '蓝色为等值线 q=1，橙色为 q=-1，虚线为主轴；曲线为网格近似。' : '蓝色为多项式，橙色为导数，圆点标记实根；纵向超出视窗的部分被裁切。' }}</desc>
        <defs><clipPath :id="`${uid}-clip`"><rect x="40" y="40" width="400" height="400" /></clipPath></defs>
        <g class="algebra-grid">
          <line v-for="(x, index) in gridX" :key="`x-${index}`" :x1="x" y1="40" :x2="x" y2="440" />
          <line v-for="(y, index) in gridY" :key="`y-${index}`" x1="40" :y1="y" x2="440" :y2="y" />
        </g>
        <g class="algebra-axes">
          <line x1="40" y1="240" x2="440" y2="240" />
          <line :x1="xPixel(0)" y1="40" :x2="xPixel(0)" y2="440" />
        </g>
        <text x="447" y="244">x</text><text :x="xPixel(0) + 5" y="31">y</text>
        <text :x="xPixel(0) + 5" y="257">0</text>
        <text :x="xPixel(1) - 4" y="257">1</text>
        <template v-if="mode !== 'polynomial'"><text x="424" y="257">4</text><text x="221" y="54">4</text><text x="41" y="257">−4</text></template>
        <template v-else><text x="32" y="257">−2</text><text x="435" y="257">4</text><text :x="xPixel(0) + 5" y="53">12</text><text :x="xPixel(0) + 5" y="433">−12</text></template>
        <g :clip-path="`url(#${uid}-clip)`">
          <template v-if="mode === 'matrix'">
            <polygon :points="points(square)" class="algebra-original" />
            <polygon :points="points(mapped)" class="algebra-image" />
            <line :x1="xPixel(0)" :y1="yPixel(0)" :x2="xPixel(a)" :y2="yPixel(c)" class="algebra-positive" />
            <line :x1="xPixel(0)" :y1="yPixel(0)" :x2="xPixel(b)" :y2="yPixel(d)" class="algebra-negative" />
            <circle :cx="xPixel(a)" :cy="yPixel(c)" r="4" class="algebra-root" /><circle :cx="xPixel(b)" :cy="yPixel(d)" r="4" class="algebra-root" />
            <text :x="xPixel(a) + 7" :y="yPixel(c) - 7">Ae₁</text><text :x="xPixel(b) + 7" :y="yPixel(d) - 7">Ae₂</text>
          </template>
          <template v-else-if="mode === 'quadratic'">
            <line v-for="(vector, index) in spectrum.vectors" :key="`axis-${index}`" :x1="xPixel(-4 * vector.x)" :y1="yPixel(-4 * vector.y)" :x2="xPixel(4 * vector.x)" :y2="yPixel(4 * vector.y)" class="algebra-eigenaxis" />
            <line v-for="(segment, index) in positiveContour" :key="`positive-${index}`" :x1="xPixel(segment[0].x)" :y1="yPixel(segment[0].y)" :x2="xPixel(segment[1].x)" :y2="yPixel(segment[1].y)" class="algebra-positive" />
            <line v-for="(segment, index) in negativeContour" :key="`negative-${index}`" :x1="xPixel(segment[0].x)" :y1="yPixel(segment[0].y)" :x2="xPixel(segment[1].x)" :y2="yPixel(segment[1].y)" class="algebra-negative" />
          </template>
          <template v-else>
            <polyline :points="polynomialCurve" class="algebra-positive" />
            <polyline :points="derivativeCurve" class="algebra-negative" />
            <circle :cx="xPixel(1)" cy="240" r="5" class="algebra-root" /><circle v-if="t !== 1" :cx="xPixel(t)" cy="240" r="5" class="algebra-root" />
            <text :x="xPixel(t) + 7" y="225">t = {{ number(t) }}</text>
          </template>
        </g>
      </svg>
      <div class="algebra-controls">
        <template v-if="mode !== 'polynomial'">
          <label v-for="key in matrixControls" :key="key" :for="`${uid}-${key}`">
            <span>{{ key }} <output :for="`${uid}-${key}`">{{ number(coefficient(key)) }}</output></span>
            <input :id="`${uid}-${key}`" type="range" min="-2" :max="mode === 'matrix' ? 2 : 3" step="0.25" :value="coefficient(key)" @input="updateCoefficient(key, $event)">
          </label>
          <div v-if="mode === 'matrix'" class="algebra-presets" aria-label="矩阵预设">
            <button type="button" @click="preset([1, 0, 0, 1])">单位阵</button><button type="button" @click="preset([1, 1, 0, 1])">剪切</button>
            <button type="button" @click="preset([0, 1, 1, 0])">交换两轴</button><button type="button" @click="preset([1, 1, 1, 1])">两列相同</button>
          </div>
          <div v-else class="algebra-presets" aria-label="二次型预设">
            <button type="button" @click="preset([2, 1, 0, 2])">正定</button><button type="button" @click="preset([1, 0, 0, -1])">不定</button>
            <button type="button" @click="preset([1, 0, 0, 0])">半正定</button><button type="button" @click="preset([0, 0, 0, 0])">零二次型</button>
          </div>
        </template>
        <template v-else>
          <label :for="`${uid}-t`"><span>t <output :for="`${uid}-t`">{{ number(t) }}</output></span><input :id="`${uid}-t`" v-model.number="t" type="range" min="-1" max="3" step="0.1"></label>
          <div class="algebra-presets"><button type="button" @click="t = -1">分离的根</button><button type="button" @click="t = 1">合并为三重根</button></div>
        </template>
        <p class="algebra-result">{{ summary }}</p>
        <p class="algebra-legend">{{ mode === 'matrix' ? '橙框：单位正方形；蓝面：变换后的像。蓝线与橙线分别标记两列。' : mode === 'quadratic' ? '蓝线：q = 1；橙线：q = −1；虚线：特征向量方向。' : '蓝线：pₜ；橙线：p′ₜ；圆点：实根。' }}</p>
        <p class="algebra-legend">滑块可用方向键调整。关闭 JavaScript 时仍可阅读初始图与正文推导。</p>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.algebra-explorer { --algebra-blue: #4f72c9; --algebra-orange: #b8734f; margin: 2em 0; padding: 18px; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); font-family: var(--sans); }
:global(:root[data-color-mode='dark'] .algebra-explorer) { --algebra-blue: #9cb9ff; --algebra-orange: #f2ac77; }
.algebra-explorer figcaption { font-size: 16px; font-weight: 600; }
.algebra-formula { font-size: 14px; overflow-wrap: anywhere; }
.algebra-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.algebra-plot { display: block; width: 100%; max-width: 480px; height: auto; margin-inline: auto; overflow: hidden; }
.algebra-plot text { fill: var(--ink); font-size: 14px; font-family: var(--sans); }
.algebra-grid line { stroke: var(--line); stroke-opacity: .35; }
.algebra-axes line { stroke: var(--muted); stroke-width: 1.5; }
.algebra-original { fill: none; stroke: var(--algebra-orange); stroke-width: 2; stroke-dasharray: 6 4; }
.algebra-image { fill: var(--algebra-blue); fill-opacity: .16; stroke: var(--algebra-blue); stroke-width: 2; }
.algebra-positive { fill: none; stroke: var(--algebra-blue); stroke-width: 2.5; stroke-linecap: round; }
.algebra-negative { fill: none; stroke: var(--algebra-orange); stroke-width: 2.5; stroke-linecap: round; }
.algebra-eigenaxis { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 6 5; }
.algebra-root { fill: var(--ink); }
.algebra-controls { min-width: 0; }
.algebra-controls label { display: block; margin-bottom: 12px; font-size: 14px; }
.algebra-controls label span { display: flex; justify-content: space-between; }
.algebra-controls input { width: 100%; min-height: 28px; accent-color: var(--accent); }
.algebra-presets { display: flex; flex-wrap: wrap; gap: 8px; }
.algebra-presets button { min-height: 44px; padding: 7px 12px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: var(--ink); font: 13px var(--sans); cursor: pointer; }
.algebra-presets button:hover { border-color: var(--accent); }
.algebra-presets button:focus-visible, .algebra-controls input:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.algebra-result { font-size: 14px; line-height: 1.8; }
.algebra-legend { color: var(--muted); font-size: 12px; line-height: 1.8; }
@media (min-width: 1100px) { .algebra-layout { grid-template-columns: minmax(0, 1fr) minmax(140px, .5fr); align-items: center; } }
</style>
