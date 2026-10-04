<script setup lang="ts">
import { studyTree, treeWalkFrames } from '~/utils/tree-walk.mjs'
const mode = ref('pre')
const step = ref(0)
const modes = [{ id: 'pre', name: '先序' }, { id: 'in', name: '中序' },
  { id: 'post', name: '后序' }, { id: 'level', name: '层序' }]
const frames = computed(() => treeWalkFrames(mode.value))
const frame = computed(() => frames.value[step.value]!)
const edges = studyTree.flatMap(node => [node.left, node.right].filter(Boolean)
  .map(id => ({ from: node, to: studyTree.find(child => child.id === id)! })))
function choose(value: string) { step.value = 0; mode.value = value }
</script>

<template>
  <figure class="tree-walk" aria-label="二叉树遍历逐步演示">
    <figcaption>一步一步遍历同一棵树</figcaption>
    <div class="tree-walk__controls" role="group" aria-label="选择遍历方式">
      <button v-for="item in modes" :key="item.id" type="button"
        :aria-pressed="mode === item.id" @click="choose(item.id)">{{ item.name }}</button>
    </div>
    <svg viewBox="0 0 480 238" role="img" aria-label="A的孩子是B和C，B的孩子是D和E，C只有右孩子F">
      <line v-for="edge in edges" :key="edge.to.id" :x1="edge.from.x" :y1="edge.from.y"
        :x2="edge.to.x" :y2="edge.to.y" />
      <g v-for="node in studyTree" :key="node.id"
        :class="{ current: frame.current === node.id, visited: frame.visited.includes(node.id) }">
        <circle :cx="node.x" :cy="node.y" r="22" />
        <text :x="node.x" :y="node.y" dy=".35em" text-anchor="middle">{{ node.id }}</text>
        <text v-if="frame.visited.includes(node.id)" class="tree-walk__order"
          :x="node.x + 29" :y="node.y - 17">{{ frame.visited.indexOf(node.id) + 1 }}</text>
      </g>
    </svg>
    <div class="tree-walk__status" aria-live="polite" aria-atomic="true">
      <p>第 {{ step }} / {{ frames.length - 1 }} 步 · {{ frame.explanation }}</p>
      <p>访问结果：<strong>{{ frame.visited.join(' → ') || '尚未访问' }}</strong></p>
      <p>{{ mode === 'level' ? '队列（左侧是队首）' : '任务栈（右侧是栈顶）' }}：
        {{ frame.pending.join(' · ') || '空，遍历完成' }}</p>
    </div>
    <div class="tree-walk__controls" role="group" aria-label="控制演示进度">
      <button type="button" :disabled="step === 0" @click="step--">上一步</button>
      <button type="button" :disabled="step === frames.length - 1" @click="step++">下一步</button>
      <button type="button" :disabled="step === 0" @click="step = 0">重新开始</button>
    </div>
    <p class="tree-walk__hint">圆圈描边表示当前操作，右上角数字表示访问次序。手动推进，不自动播放。任务栈是显式调度模型，不是C调用栈的逐字复刻。</p>
  </figure>
</template>

<style scoped>
.tree-walk { margin: 2em 0; padding: clamp(16px, 3vw, 28px); border: 1px solid var(--line); border-radius: 12px; color: var(--ink); }
.tree-walk figcaption { font-weight: 600; margin-bottom: 16px; }
.tree-walk__controls { display: flex; flex-wrap: wrap; gap: 8px; }
.tree-walk button { padding: 7px 14px; border: 1px solid var(--line); border-radius: 8px; color: inherit; background: transparent; font: inherit; font-size: .85em; cursor: pointer; }
.tree-walk button[aria-pressed='true'] { color: var(--accent); border-color: var(--accent); }
.tree-walk button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.tree-walk button:disabled { opacity: .45; cursor: default; }
.tree-walk svg { display: block; width: 100%; max-width: 560px; margin: 20px auto; overflow: visible; }
.tree-walk line { stroke: var(--line); stroke-width: 2; }
.tree-walk circle { fill: var(--paper); stroke: var(--line); stroke-width: 2; transition: stroke 180ms ease, fill 180ms ease; }
.tree-walk text { fill: var(--ink); font: 16px var(--sans); }
.tree-walk .visited circle { fill: color-mix(in srgb, var(--accent) 12%, var(--paper)); }
.tree-walk .current circle { stroke: var(--accent); stroke-width: 4; }
.tree-walk .tree-walk__order { fill: var(--accent); font-size: 12px; }
.tree-walk__status { min-height: 10em; overflow-wrap: anywhere; }
.tree-walk__status p { margin: .6em 0; font-size: .9em; }
.tree-walk .tree-walk__hint { color: var(--muted); font-size: .8em; margin-bottom: 0; }
@media (prefers-reduced-motion: reduce) { .tree-walk circle { transition: none; } }
</style>
