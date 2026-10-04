// Small, deterministic teaching model. Snapshots never share mutable arrays.
export const studyTree = [
  { id: 'A', left: 'B', right: 'C', x: 240, y: 38 },
  { id: 'B', left: 'D', right: 'E', x: 125, y: 118 },
  { id: 'C', left: null, right: 'F', x: 355, y: 118 },
  { id: 'D', left: null, right: null, x: 65, y: 198 },
  { id: 'E', left: null, right: null, x: 180, y: 198 },
  { id: 'F', left: null, right: null, x: 410, y: 198 },
]

export function treeWalkFrames(mode) {
  if (!['pre', 'in', 'post', 'level'].includes(mode)) throw new Error('Unknown traversal')
  const nodes = new Map(studyTree.map(node => [node.id, node]))
  const visited = [], frames = []
  const pending = [{ id: 'A', visit: false }]
  function save(current, explanation) {
    frames.push({ current, explanation, visited: [...visited],
      pending: pending.map(task => `${task.visit ? '访问' : '展开'} ${task.id}`) })
  }
  save(null, '从根 A 开始。展开是安排任务，访问才是把结点写入结果。')
  while (pending.length) {
    const task = mode === 'level' ? pending.shift() : pending.pop()
    const node = nodes.get(task.id)
    if (mode === 'level') {
      visited.push(node.id)
      for (const id of [node.left, node.right]) if (id) pending.push({ id, visit: false })
      save(node.id, `取出队首 ${node.id} 并访问；存在的左、右孩子依次入队。`)
    } else if (task.visit) {
      visited.push(node.id)
      save(node.id, `访问 ${node.id}，将它追加到结果；不再展开它。`)
    } else {
      const left = node.left ? [{ id: node.left, visit: false }] : []
      const right = node.right ? [{ id: node.right, visit: false }] : []
      const visit = [{ id: node.id, visit: true }]
      const order = mode === 'pre' ? [...visit, ...left, ...right]
        : mode === 'in' ? [...left, ...visit, ...right] : [...left, ...right, ...visit]
      pending.push(...order.reverse())
      save(node.id, `展开 ${node.id}：按所选遍历安排访问和子树任务，逆序压栈使下一项先执行。`)
    }
  }
  return frames
}
