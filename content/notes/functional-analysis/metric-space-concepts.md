---
title: 度量空间概念关系图：紧、列紧、全有界与完备
description: 用关系图、定义、条件切换与反例，整理紧、列紧、全有界、有界、完备、可分、稠密和 ε 网之间的推导。
date: 2026-11-05
tags: [度量空间, 可视化]
readingTime: 18 分钟
aiGenerated: true
aiAssisted: true
pinned: false
featured: false
draft: false
readingLinks:
  - path: /notes/functional-analysis/six-methods-to-prove-closed-sets
    kind: next
    reason: 用六种闭集证明方法与完整证明，进一步理解教材中的紧等于列紧加闭，以及闭性和完备性的区别。
---

这些概念分别在回答几类问题：点列能否找到收敛子列，Cauchy 列的极限是否仍在空间中，以及能否用少量网点逼近整个集合。先分清问题，再记箭头，会比逐条背诵更容易。

**术语约定**：本文沿用本课程试卷的用法，称 $A$ **列紧**，是指 $A$ 中任意点列都有在环境空间 $X$ 中收敛的子列，极限可以不属于 $A$；称 $A$ **紧**，则任意点列都能选出极限属于 $A$ 的收敛子列。在度量空间中，后一性质等价于开覆盖的有限子覆盖性质。有些教材把本文的“列紧”称为“相对紧”，阅读时应先核对定义。

以下 $A\subseteq X$，闭集与闭包均相对于 $X$；$A$ 的完备性使用限制距离。讨论点到集合的距离时，集合取非空。

## 1. 先看总图

[打开交互概念图](/visualizations/notes/functional-analysis/metric-space-concepts.html)：可切换“一般度量空间”“完备度量空间”和“欧氏空间”，查看附加条件带来的逆向箭头；另有 ε 网关系图和反例页。

![一般度量空间中的概念关系：紧推出闭、完备和列紧；列紧等价于闭包紧，并推出全有界；全有界推出有界和可分。](/images/notes/functional-analysis/metric-space-concepts/implications.svg)

图中的实线均不需要额外假设。底部的“加号”表示两个条件同时成立，不能把“完备且全有界”拆成两个各自充分的条件。

最重要的两个等价关系是

$$
\boxed{A\text{ 紧}\iff A\text{ 完备且全有界}},
$$

$$
\boxed{A\text{ 紧}\iff A\text{ 在 }X\text{ 中闭且列紧}}.
$$

## 2. 每个概念究竟要求什么

| 概念 | 准确定义 | 应关注的部分 |
| --- | --- | --- |
| 有界 | 存在 $x_0\in X$ 与有限的 $R>0$，使 $A\subseteq B(x_0,R)$ | 一个足够大的球能覆盖 |
| 全有界 | 对每个 $\varepsilon>0$，$A$ 都有有限的 $\varepsilon$ 网 | 任意小尺度，都只需有限个球 |
| 完备 | $A$ 中每个 Cauchy 列都收敛于 $A$ 中的点 | Cauchy 列的极限仍在集合内 |
| 列紧 | $A$ 中每个点列都有在 $X$ 中收敛的子列 | 极限允许在 $A$ 外、$X$ 内 |
| 紧 | $A$ 的任意开覆盖都有有限子覆盖；等价地，每个点列都有在 $A$ 中收敛的子列 | 子列极限必须属于 $A$ |
| 可分 | 存在至多可数的 $D\subseteq A$，在 $A$ 中稠密 | 一个至多可数的集合能任意精确地逼近所有点 |
| 闭 | $A=\overline A$；等价地，$A$ 中点列若在 $X$ 中收敛，其极限必属于 $A$ | 保留已经存在于 $X$ 中的极限 |

**有界与全有界的差别在尺度。** 有界只要求找到一个大球；全有界要求无论把半径缩得多小，都仍能用有限个球覆盖。一般度量空间中，这两者不等价。

**闭与完备的差别在环境。** 闭只要求保留在 $X$ 中已经存在的极限；如果一个 Cauchy 列的极限根本不在 $X$ 中，闭集条件无法把它补出来。

## 3. ε 网、稠密与可分

### 3.1 ε 网：先固定一个精度

给定 $\varepsilon>0$，若 $N\subseteq X$ 满足

$$
\forall a\in A,\ \exists n\in N,\quad d(a,n)<\varepsilon,
$$

就称 $N$ 是 $A$ 的一个 **$\varepsilon$ 网**。等价地，

$$
A\subseteq\bigcup_{n\in N}B(n,\varepsilon).
$$

这个定义本身不要求 $N$ 有限，也不要求 $N\subseteq A$。讨论全有界性时，可以把有限网取在 $A$ 中：先取半径 $\varepsilon/2$ 的有限覆盖，再从每个与 $A$ 相交的球中选一个 $A$ 内的点，以它们为中心取半径 $\varepsilon$ 的球即可。

### 3.2 稠密：同一个集合适用于所有精度

本文称“$N$ 在 $A$ 中稠密”，指

$$
A\subseteq\overline N.
$$

这等价于

$$
\forall\varepsilon>0,\quad N\text{ 是 }A\text{ 的 }\varepsilon\text{ 网}.
$$

因为 $a\in\overline N$ 的含义正是：$a$ 的每个开球都与 $N$ 相交。这里始终使用**同一个 $N$**，只是逼近精度不断变化。

“$N$ 在 $A$ 中稠密”按此约定不额外要求 $N\subseteq A$。例如在 $X=\mathbb R$ 中，$N=\mathbb Q$ 在 $A=\mathbb R\setminus\mathbb Q$ 中稠密，但 $N\cap A=\varnothing$。

### 3.3 两个量词结构不要混淆

| 性质 | 量词结构 | 网点集合的限制 |
| --- | --- | --- |
| 全有界 | 对每个 $\varepsilon>0$，存在一个有限 $\varepsilon$ 网 $N_\varepsilon$ | 每次有限；不同精度可取不同的网 |
| $N$ 在 $A$ 中稠密 | 同一个 $N$，对每个 $\varepsilon>0$ 都是 $\varepsilon$ 网 | 不要求有限或可数 |
| $A$ 可分 | 存在一个至多可数的 $D\subseteq A$，对每个 $\varepsilon>0$ 都是 $\varepsilon$ 网 | 同一个至多可数稠密子集 |

![ε网关系图：全有界要求每个精度存在有限网；稠密要求同一个集合在所有精度下都是网；全有界可以推出可分。](/images/notes/functional-analysis/metric-space-concepts/epsilon-nets.svg)

### 3.4 为什么全有界能推出可分

对每个正整数 $k$，取一个有限的 $1/k$ 网 $N_k\subseteq A$，令

$$
D=\bigcup_{k=1}^{\infty}N_k.
$$

可数个有限集之并至多可数。任取 $a\in A$ 与 $\varepsilon>0$，选择 $k$ 使 $1/k<\varepsilon$；由 $N_k$ 的网性质，存在 $n\in N_k\subseteq D$ 满足

$$
d(a,n)<\frac1k<\varepsilon.
$$

所以 $D$ 在 $A$ 中稠密，$A$ 可分。

## 4. 怎样理解主要箭头

### 4.1 列紧推出全有界

反设 $A$ 不全有界，则存在 $\varepsilon_0>0$，使任何有限个半径为 $\varepsilon_0$ 的开球都不能覆盖 $A$。

先取 $x_1\in A$。已选出 $x_1,\ldots,x_n$ 后，仍能选取

$$
x_{n+1}\in A\setminus\bigcup_{j=1}^{n}B(x_j,\varepsilon_0).
$$

于是任意两项都满足

$$
d(x_m,x_n)\ge\varepsilon_0\qquad(m\ne n).
$$

该点列的任何子列都不是 Cauchy 列，因此不可能收敛。这与列紧矛盾。

### 4.2 全有界保证 Cauchy 子列，完备保证它收敛

在全有界的 $A$ 中，先用有限个半径 $1/2$ 的球覆盖。任意点列至少有一个球包含无穷多项；在这些项中，再用半径 $1/4$ 的有限覆盖选出仍包含无穷多项的一部分，依次继续。

保持所选指标集合逐层包含，并从第 $j$ 层选取指标严格递增的一项。得到的子列在第 $j$ 层之后都落在同一个半径 $2^{-j}$ 的球内，因而任意两项的距离小于 $2^{1-j}$，所以是 Cauchy 列。

因此，全有界提供的是 **Cauchy 子列**。若再有 $A$ 完备，这个子列就在 $A$ 中收敛，得到紧性。

反过来，紧集当然列紧，因此全有界；紧集中的 Cauchy 列有一个在 $A$ 中收敛的子列，而 Cauchy 性会使原点列收敛到同一极限，所以紧集完备。这就解释了

$$
A\text{ 紧}\iff A\text{ 完备且全有界}.
$$

### 4.3 列紧等价于闭包紧

若 $\overline A$ 紧，则 $A$ 中的任意点列也是 $\overline A$ 中的点列，存在收敛子列，极限属于 $\overline A\subseteq X$，所以 $A$ 列紧。

反过来，设 $A$ 列紧。任取 $\overline A$ 中的点列 $\{z_n\}$，由于 $z_n\in\overline A$，可选取 $a_n\in A$，使

$$
d(z_n,a_n)<\frac1n.
$$

列紧性保证存在子列 $a_{n_k}\to x\in X$。于是

$$
d(z_{n_k},x)\le d(z_{n_k},a_{n_k})+d(a_{n_k},x)\longrightarrow0.
$$

又因 $\overline A$ 闭，$x\in\overline A$，因此 $\overline A$ 紧。故

$$
\boxed{A\text{ 列紧}\iff\overline A\text{ 紧}}.
$$

若再有 $A$ 闭，便有 $A=\overline A$，所以“闭且列紧”等价于紧。

## 5. 加上环境条件后，哪些箭头能反过来

| 环境条件 | 可以保证的等价关系 |
| --- | --- |
| 任意度量空间 $X$ | 紧 $\iff$ 完备且全有界；紧 $\iff$ 闭且列紧；列紧 $\iff$ 闭包紧 |
| $X$ 完备 | 列紧 $\iff$ 全有界；$A$ 闭 $\iff$ $A$ 完备 |
| $X=\mathbb R^n$，使用欧氏距离 | 有界 $\iff$ 全有界 $\iff$ 列紧；紧 $\iff$ 闭且有界 |

### 5.1 为什么完备子集一定闭

设 $A$ 完备，$a_n\in A$ 且 $a_n\to x\in X$。收敛列是 Cauchy 列，因此由 $A$ 完备，存在 $a\in A$ 使 $a_n\to a$。度量空间中极限唯一，故 $x=a\in A$，所以 $A$ 闭。

这个方向**不要求 $X$ 完备**。

### 5.2 为什么闭集要配合环境完备

若 $X$ 完备且 $A$ 在 $X$ 中闭，取 $A$ 中任意 Cauchy 列。由 $X$ 完备，它先在 $X$ 中收敛；再由 $A$ 闭，极限属于 $A$，所以 $A$ 完备。

同样，若 $X$ 完备且 $A$ 全有界，则 $A$ 的任意点列都有 Cauchy 子列；这个子列在 $X$ 中收敛，因此 $A$ 列紧。此时子列极限仍可能位于 $A$ 外，所以还不能直接说 $A$ 紧。

### 5.3 为什么欧氏空间中有界就够推出全有界

欧氏空间中的有界集被某个有限边长的立方体包含。给定 $\varepsilon>0$，把它分成有限个直径小于 $\varepsilon$ 的小立方体，从每个与 $A$ 相交的小立方体中选一个 $A$ 内的点，就得到有限 $\varepsilon$ 网。

所以在 $\mathbb R^n$ 中，“闭且有界”足以推出紧；一般度量空间中则必须保留“全有界”这一条件。

## 6. 用反例阻止错误倒推

| 错误倒推 | 反例 | 失效原因 |
| --- | --- | --- |
| 列紧就紧 | $(0,1)\subseteq\mathbb R$ | 子列可以趋向端点，而端点不在集合内 |
| 全有界就列紧 | $A=\mathbb Q\cap[0,1]$，环境为 $X=\mathbb Q$ | 可取有理数列趋于 $\sqrt2/2$，在 $X$ 中没有收敛子列 |
| 有界就全有界 | 无限离散度量空间 $(\mathbb N,d_0)$ | 距离不超过 $1$，但半径 $1/2$ 的球每个只含一点 |
| 完备且有界就紧 | 同一个 $(\mathbb N,d_0)$ | Cauchy 列最终常值，所以完备；点列 $1,2,3,\ldots$ 没有收敛子列 |
| 可分就有界 | $\mathbb R$ | $\mathbb Q$ 是至多可数稠密子集，但 $\mathbb R$ 无界 |
| 有界就可分 | 不可数集合上的离散度量 | 全空间有界；唯一的稠密子集是全空间本身，不可数 |
| 闭就完备 | $A=X=\mathbb Q$ | 全空间在自身中闭，但有理 Cauchy 列可能趋向无理数 |

特别注意环境的作用：同一个集合 $A=\mathbb Q\cap[0,1]$，放在 $X=\mathbb R$ 中是列紧的，放在 $X=\mathbb Q$ 中却不是。它的全有界性没有变化，变化的是允许极限落入的空间。

## 7. 闭包、稠密与点到集合的距离

对非空 $D\subseteq X$，定义

$$
d(x,D)=\inf_{y\in D}d(x,y).
$$

则

$$
\boxed{d(x,D)=0\iff x\in\overline D}.
$$

因此，“$D$ 在 $A$ 中稠密”还可写成

$$
\forall a\in A,\quad d(a,D)=0.
$$

这里距离为零只保证 $a\in\overline D$，不保证 $a\in D$。例如 $d(0,(0,1))=0$。

点到集合的距离函数满足

$$
|d(x,D)-d(y,D)|\le d(x,y),
$$

所以它是 $1$-Lipschitz 连续函数。若 $D$ 闭且 $x\notin D$，才可由上面的等价关系推出 $d(x,D)>0$。

包含关系与闭包的正确搭配是

$$
A\subseteq B\quad\Longrightarrow\quad\overline A\subseteq\overline B.
$$

若要进一步保证 $\overline A\subseteq B$，可以补充 $B$ 闭。只知道 $A\subseteq B$ 时，取 $A=(0,1)$、$B=(0,2)$，便有 $0\in\overline A$ 但 $0\notin B$。

## 8. 做题时怎样选路线

- **要证明紧**：检查“完备且全有界”，或者“闭且列紧”；在欧氏空间中可改查“闭且有界”。
- **要证明列紧**：可证明闭包紧；若环境完备，也可直接证明全有界。
- **要证明全有界**：给定任意 $\varepsilon>0$，构造有限 $\varepsilon$ 网；要否定它，则构造某个固定尺度下两两分离的无穷点列。
- **要证明可分**：找一个至多可数稠密子集；已知全有界时，可取各尺度有限网的并。
- **要处理 Cauchy 列**：全有界帮助选出 Cauchy 子列，完备帮助得到集合内的极限；原列已有 Cauchy 性时，只要找到一个收敛子列，就能确定原列收敛。
- **遇到稠密**：先写成目标集合包含于网点集合的闭包，再换成“每个正精度都能逼近”的表述。
