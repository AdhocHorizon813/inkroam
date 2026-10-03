---
title: 第四讲：图的存储、DFS/BFS 与最小生成树
description: 区分图的基本概念与存储代价，推导遍历和 Prim/Kruskal 的不变量，用 C 实现并验证最小生成树。
date: 2026-10-03
order: 4
tags: [算法与数据结构]
readingTime: 40 分钟
aiGenerated: true
draft: false
---

## 从树到图，多了什么问题

### 图的语言先于算法

**图**由顶点集合 V 和边集合 E 组成。**顶点**代表对象，**边**代表两对象之间的关系；无向边 `{u,v}` 不区分方向，有向边 `(u,v)` 也称**弧**，从弧尾 u 指向弧头 v。带权图为边附加距离、成本等数值，权的实际含义由问题决定。

| 概念 | 定义 | 需要避免的混淆 |
| --- | --- | --- |
| 邻接 | 两顶点之间存在相应的边 | 有向图要说明方向 |
| 关联 | 边与它的端点之间的关系 | 邻接讲顶点之间，关联讲边与顶点 |
| 度 | 无向顶点关联的边端数 | 自环贡献 2；下文默认无自环 |
| 入度/出度 | 以顶点为弧头/弧尾的弧数 | 两者不必相等 |
| 简单图 | 无自环、无平行边的图 | 简单图仍可有长度大于 1 的环 |
| 路径 | 按连续边连接的顶点序列 | 有向图须顺着弧方向走 |
| 简单路径 | 顶点不重复的路径 | 一般路径可允许重复，先读题目口径 |
| 环/回路 | 起点与终点相同的闭合路径 | 简单环除首尾外不重复顶点 |
| 子图 | 取原图部分顶点与部分边构成的图 | 所取边的端点必须保留 |

**连通**指无向图任意两顶点间存在路径。**连通分量**是不能再扩大的连通顶点集合及对应子图；“极大”是不能加入更多顶点继续连通，不是所有分量里规模最大。**强连通**指有向图每对顶点均相互可达，强连通分量是极大强连通子图；忽略方向后连通只叫弱连通，不保证可相互到达。

**生成子图**保留原图全部顶点；**生成树**是连通无向图的、保留全部顶点且本身为树的子图；非连通图对每个分量各选一棵树得到生成森林。它们不包含新顶点，也不是“从一个源点挑出所有邻居”。

图 $G=(V,E)$ 允许一顶点被多个顶点指向，也允许环和多个连通部分。因此“沿所有孩子递归”不再天然终止，必须记录访问状态。以下公式默认简单图，无自环、无平行边；若题目允许多重边，自环对度的贡献应另算。

无向图每条边贡献两次度，$\sum_v\deg(v)=2|E|$；有向图每条弧贡献一次出度和一次入度，因此两种度的和分别为 $|E|$。n 顶点简单无向图最多 $n(n-1)/2$ 条边，有向图最多 $n(n-1)$ 条弧。

路径长度在无权语境中常指边数，有权语境中可能指权值和，解题须先明确。无向图的连通分量是极大连通子图；有向图的强连通要求任意两顶点相互可达，弱连通只要求忽略方向后连通。

n 顶点无向图的生成树含 n-1 条边，但“有 n-1 条边”单独不能证明它是树，还需连通或无环条件。具有 c 个连通分量的生成森林含 n-c 条边。

## 存储方式决定很多复杂度

**邻接矩阵**用二维表按一对顶点索引关系；**邻接表**为每个顶点保存它的邻居列表；**边集数组**逐条存端点及权值。三者是同一张图的不同存储方式，不是三种不同数学图。下表的 V、E 在复杂度中分别表示顶点数和边数。

| 存储 | 空间 | 判断 u 到 v 是否有边 | 枚举 u 的邻居 | 适合 |
| --- | --- | --- | --- | --- |
| 邻接矩阵 | $O(V^2)$ | $O(1)$ | $O(V)$ | 稠密图、矩阵算法 |
| 邻接表 | $O(V+E)$ | 通常 $O(\deg u)$ | $O(\deg u)$ | 稀疏图、遍历 |
| 边集数组 | $O(E)$ | 通常 $O(E)$ | 通常 $O(E)$ | Kruskal、Bellman-Ford |

无向邻接表一般一条边存两个邻接项，但边集数组只需存一次。普通有向邻接表便于枚举出边，不直接提供所有入边；若频繁处理入边，可建逆邻接表或十字链表。无向邻接多重表让一个边结点同时连入两个端点的边链，适合从边角度管理；不要把它与“一条边复制两份”的普通邻接表混为一谈。

带权矩阵不能用 0 统一表示无边，因为 0 权边合法。可用独立存在标志或 INF。本讲采用存在矩阵加权值矩阵，能够明确保留零权与负权边。

## DFS 与 BFS 的不变量

DFS 沿一条路径深入，回溯后探索其他邻居。递归进入顶点时就标记，不能等返回才标，否则遇环会反复递归。一次从起点 DFS 只覆盖它能到达的顶点；遍历整个图要在外层枚举所有未访问顶点。

BFS 的队列保存已发现未处理的顶点，**入队时标记**，避免同一顶点被多个前驱重复入队。dist[s]=0，从 u 首次发现 v 时设 dist[v]=dist[u]+1。队列按距离非递减顺序弹出，所以首次发现就是最少边数。

邻接表两者时间 $O(V+E)$；邻接矩阵两者 $O(V^2)$。DFS 栈最坏 $O(V)$；BFS 队列与访问数组 $O(V)$。访问顺序依赖邻接枚举顺序，没有说明“按编号递增”时不应假定唯一答案。

## 最小生成树不等于最短路径树

MST 在无向连通带权图中选择 n-1 条边，使**所有选中边的总权值**最小；不保证根到各顶点距离最短。最短路径树则对指定源点保证每条树路径距离最短，不保证树边总权最小。

负边不妨碍 MST，零边也合法；非连通图没有覆盖全部顶点的单棵生成树，可以求最小生成森林。有相等权边时 MST 可能不唯一；所有边权互异足以保证唯一，但不是必要条件。

### 切分性质给出贪心理由

将顶点分为两个非空集合，跨割的最小权边至少可以属于某棵 MST。若已有 MST 不含它，将它加进去产生环，环上存在另一条跨割边，替换后权值不增。若最小跨割边唯一，可进一步推出它属于所有 MST。

Prim 维护已纳入集合 S，每步选择 S 到外部最小的边。`key[v]` 是 v 到 S 的最小连接边权，**不是从源点到 v 的路径长度**。这与 Dijkstra 最容易混淆。

Kruskal 将全部边按权递增，只有两个端点分属不同连通块时才接受。并查集负责判断加边是否形成环。路径压缩加按秩/大小合并使操作均摊近常数，排序通常主导总时间 $O(E\log E)$。

## 完整 C 程序：遍历与两种 MST 交叉验证

固定至多 16 个顶点；无向简单图，add_edge 检查端点和重复边。示例权值为 int、总和 long long；至多 15 条树边，避免 int 总和溢出。Prim 的无穷值只作状态哨兵，不参与加法。

输入为同一 Graph，BFS 输出到源点的边数距离（-1 为不可达），DFS 写 seen，Prim/Kruskal 输出总边权并返回是否存在生成树。Prim 中 used 表示已经入树，key 表示接入代价；并查集 parent 表示连通块代表的父链接，size 用于按大小合并。两种算法都得到总权 6 是交叉检查，不代表两种算法在所有并列权输入上必然选相同边。

```c
#include <assert.h>
#include <stdbool.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>

enum { MAXV = 16, MAXE = 120 };
typedef struct { int u, v, w; } Edge;
typedef struct {
    int n, m;
    bool has[MAXV][MAXV];
    int w[MAXV][MAXV];
    Edge edges[MAXE];
} Graph;

bool add_edge(Graph *g, int u, int v, int w) {
    if (u < 0 || v < 0 || u >= g->n || v >= g->n || u == v ||
        g->m == MAXE || g->has[u][v]) return false;
    g->has[u][v] = g->has[v][u] = true;
    g->w[u][v] = g->w[v][u] = w;
    g->edges[g->m++] = (Edge){u, v, w};
    return true;
}

void dfs(const Graph *g, int u, bool seen[]) {
    seen[u] = true;
    for (int v = 0; v < g->n; ++v)
        if (g->has[u][v] && !seen[v]) dfs(g, v, seen);
}

void bfs(const Graph *g, int source, int dist[]) {
    int q[MAXV], head = 0, tail = 0;
    for (int i = 0; i < g->n; ++i) dist[i] = -1;
    dist[source] = 0; q[tail++] = source;
    while (head < tail) {
        int u = q[head++];
        for (int v = 0; v < g->n; ++v) {
            if (!g->has[u][v] || dist[v] != -1) continue;
            dist[v] = dist[u] + 1;
            q[tail++] = v;
        }
    }
}

bool prim(const Graph *g, long long *total) {
    if (g->n <= 0 || g->n > MAXV) return false;
    bool used[MAXV] = {false}; long long key[MAXV];
    for (int i = 0; i < g->n; ++i) key[i] = LLONG_MAX;
    key[0] = 0; *total = 0;
    for (int step = 0; step < g->n; ++step) {
        int u = -1;
        for (int v = 0; v < g->n; ++v)
            if (!used[v] && (u == -1 || key[v] < key[u])) u = v;
        if (u == -1 || key[u] == LLONG_MAX) return false;
        used[u] = true; *total += key[u];
        for (int v = 0; v < g->n; ++v)
            if (g->has[u][v] && !used[v] && g->w[u][v] < key[v])
                key[v] = g->w[u][v];
    }
    return true;
}

int find(int parent[], int x) {
    if (parent[x] != x) parent[x] = find(parent, parent[x]);
    return parent[x];
}
int compare_edge(const void *a, const void *b) {
    int x = ((const Edge *)a)->w, y = ((const Edge *)b)->w;
    return (x > y) - (x < y); /* 不用 x-y，避免溢出 */
}
bool kruskal(const Graph *g, long long *total) {
    if (g->n <= 0 || g->n > MAXV) return false;
    Edge e[MAXE]; int parent[MAXV], size[MAXV], taken = 0;
    for (int i = 0; i < g->m; ++i) e[i] = g->edges[i];
    for (int i = 0; i < g->n; ++i) { parent[i] = i; size[i] = 1; }
    qsort(e, (size_t)g->m, sizeof e[0], compare_edge);
    *total = 0;
    for (int i = 0; i < g->m && taken < g->n-1; ++i) {
        int a = find(parent, e[i].u), b = find(parent, e[i].v);
        if (a == b) continue;
        if (size[a] < size[b]) { int t = a; a = b; b = t; }
        parent[b] = a; size[a] += size[b];
        *total += e[i].w; ++taken;
    }
    return taken == g->n-1;
}

int main(void) {
    Graph g = {0}; g.n = 4;
    assert(add_edge(&g, 0, 1, 1)); assert(add_edge(&g, 0, 2, 4));
    assert(add_edge(&g, 1, 2, 2)); assert(add_edge(&g, 1, 3, 5));
    assert(add_edge(&g, 2, 3, 3));
    bool seen[MAXV] = {false}; dfs(&g, 0, seen);
    for (int i = 0; i < g.n; ++i) assert(seen[i]);
    int dist[MAXV]; bfs(&g, 0, dist); assert(dist[3] == 2);
    long long p, k; assert(prim(&g, &p) && kruskal(&g, &k));
    assert(p == 6 && k == 6);
    g.n = 5; /* 顶点 4 孤立 */
    assert(!prim(&g, &p) && !kruskal(&g, &k));
    bfs(&g, 0, dist); assert(dist[4] == -1);
    Graph small = {0}; small.n = 3;
    assert(add_edge(&small, 0, 1, -2));
    assert(add_edge(&small, 1, 2, 0));
    assert(prim(&small, &p) && kruskal(&small, &k) && p == -2 && k == -2);
    puts("graph and MST tests passed");
    return 0;
}
```

dfs/bfs 的调用者保证 `0<=source<n<=MAXV`，访问数组至少 MAXV；示例不是接受不可信输入的完整图解析器。MST 返回 false 时 total 可能只含部分森林权值，调用者不能把它当作成功结果。

## 手推 Prim 与 Kruskal

样例从 0 开始 Prim：先选 0—1（1），再选 1—2（2），最后选 2—3（3），总权 6。Kruskal 按权选同样三条，后面的边会形成环或已无需处理。

Prim 矩阵实现 $O(V^2)$、额外空间 $O(V)$。邻接表配二叉堆通常 $O((V+E)\log V)$。Kruskal 在边集上排序；若图本来以矩阵输入，先枚举边还要 $O(V^2)$，不能假装输入转换免费。

## 自编题与面试追问

**1. 发现一条指向 visited 顶点的边就一定有环吗？** 无向 DFS 中指向父亲的反向存储项不算新环；有向图要区分递归栈中的灰色点和已完成黑色点，仅凭 visited 不够。

**2. BFS 首次发现时为何能定距离？** 若存在更短路径，它的倒数第二个顶点会处在更浅层并更早出队，从而更早发现当前点，矛盾。这个证明依赖每走一条边代价相同。

**3. 哪些边不可能属于 MST？** 一个环上唯一的最大权边不属于任何 MST。若只是并列最大，则不能直接排除；“唯一”不可漏。

**4. 完全相等边权时如何判断 MST 唯一？** 不能只看有相等权就说不唯一。例如图本身是一棵树时，生成树唯一，不论边权是否相同。

**5. 何时停止 Kruskal？** 接受 V-1 条边就可停止；若边处理完仍不足，则不连通。停止依据不是“已经扫描 V-1 条边”。
