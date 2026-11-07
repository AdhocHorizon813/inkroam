---
title: 解析几何第四章：向量及其运算
description: 从自由向量与坐标分解出发，讲清射影、方向余弦、数量积、向量积、混合积和二重外积，并用面积、体积与三角恒等式串联竞赛解题方法。
date: 2026-11-07
order: 4
tags: [数学竞赛, 解析几何, 向量]
readingTime: 50 分钟
aiGenerated: true
aiAssisted: false
draft: false
readingLinks:
  - path: /notes/mathematics-competition/02-advanced-algebra-linear-spaces-and-quadratic-forms
    kind: review
    reason: 复习基、坐标、内积和 Gram 矩阵，理解斜交坐标中长度与夹角为何需要度量矩阵。
  - path: /notes/mathematics-competition/05-analytic-geometry-planes-and-lines
    kind: next
    reason: 把本章的点积、叉积和混合积用于平面、直线的位置关系与距离。
---

解析几何的第一步，是把图形中的“平行、垂直、面积、体积”翻译成向量等式。真正需要掌握的不是公式数量，而是知道每种乘积保存了什么几何信息，以及何时可以把几何条件变成线性方程。

**统一约定。** 本章主要讨论三维实欧氏空间，向量记为 $\mathbf a,\mathbf b$，点记为 $A,B$，位置向量为 $\mathbf r_A=\overrightarrow{OA}$。除特别注明外，坐标公式均采用**右手标准正交坐标系**。长度记作 $\|\mathbf a\|$。零向量没有确定方向，也不能与其他向量定义夹角。外积在本章指三维向量积（叉积）。

## 4.1 竞赛要点与难点

| 问题信号 | 优先工具 | 必须检查的条件 |
| --- | --- | --- |
| 分点、重心、共线、共面 | 线性组合与仿射组合 | 系数和是否为 $1$；基是否无关 |
| 垂直、夹角、长度最值 | 数量积与正交分解 | 夹角中的两个向量必须非零 |
| 平行、法向、三角形面积 | 向量积 | 叉积顺序决定方向 |
| 四点共面、四面体体积 | 混合积 | 体积取绝对值，并除以 $6$ |
| 多重叉积化简 | 二重外积公式 | 叉积没有结合律 |
| 斜交坐标中的长度与夹角 | Gram 矩阵 | 坐标点积不一定等于几何内积 |

解题时先画出“已知向量从哪里指向哪里”，再写坐标；先检查退化情形，再除以长度、叉积模或行列式。几何图像帮助选方法，代数条件负责给出证明。

## 4.2 向量的概念、表示与线性运算

### 4.2.1 自由向量与有向线段

有向线段 $\overrightarrow{AB}$ 有长度与方向。允许平行移动而不改变长度和方向，把这样的有向线段看成同一个对象，就得到自由向量。因此

$$
\overrightarrow{AB}=\overrightarrow{CD}
$$

不要求 $A=C$，只要求两条有向线段同长同向。$\overrightarrow{AA}=\mathbf0$；反向量满足 $\overrightarrow{BA}=-\overrightarrow{AB}$。长度为 $1$ 的向量称单位向量，非零向量 $\mathbf a$ 的同向单位向量是 $\mathbf a/\|\mathbf a\|$。

**点与向量应当区分。** 两点之差表示向量；点加向量表示平移后的点。两个点相加本身依赖所选原点，但系数和为 $1$ 的点的仿射组合有与原点无关的意义。

### 4.2.2 加法、数乘与运算律

三角形法则给出

$$
\overrightarrow{AB}+\overrightarrow{BC}=\overrightarrow{AC}.
$$

把两个向量移到共同起点，和向量是平行四边形的对角线。差向量 $\mathbf a-\mathbf b$ 从 $\mathbf b$ 的终点指向 $\mathbf a$ 的终点。

数乘 $t\mathbf a$ 的长度为 $|t|\|\mathbf a\|$；$t>0$ 同向，$t<0$ 反向。线性运算满足

$$
\begin{aligned}
\mathbf a+\mathbf b&=\mathbf b+\mathbf a,\\
(\mathbf a+\mathbf b)+\mathbf c&=\mathbf a+(\mathbf b+\mathbf c),\\
s(\mathbf a+\mathbf b)&=s\mathbf a+s\mathbf b,\\
(s+t)\mathbf a&=s\mathbf a+t\mathbf a,\qquad
s(t\mathbf a)=(st)\mathbf a.
\end{aligned}
$$

这些规律使几何中首尾相接的路径可以自由整理。例如闭合多边形的边向量之和为零。

### 4.2.3 分解、基与唯一性

平面内两个不平行向量 $\mathbf e_1,\mathbf e_2$ 构成一组基，每个平面向量都能唯一表示为

$$
\mathbf a=x\mathbf e_1+y\mathbf e_2.
$$

空间内三个不共面的向量构成一组基，每个向量都能唯一表示为

$$
\mathbf a=x\mathbf e_1+y\mathbf e_2+z\mathbf e_3.
$$

唯一性的证明很短：若有两种表示，相减后得到基向量的一个零线性组合，线性无关迫使各系数差全为零。若选的“基”共面，就可能无解或表示不唯一。

**分点公式。** 令 $P=A+t(B-A)$，则

$$
\mathbf r_P=(1-t)\mathbf r_A+t\mathbf r_B.
$$

$t\in[0,1]$ 表示线段上的点；$t<0$ 或 $t>1$ 表示延长线上的点。若 $AP:PB=m:n$ 为内部长度比，$m,n>0$，则

$$
\mathbf r_P=\frac{n\mathbf r_A+m\mathbf r_B}{m+n}.
$$

注意 $A$ 前的系数是 $n$。三角形重心为 $(\mathbf r_A+\mathbf r_B+\mathbf r_C)/3$；四面体重心为四个顶点位置向量的平均。

## 4.3 坐标系与向量的代数运算

### 4.3.1 点坐标与向量坐标

选定原点 $O$ 和基 $\mathbf e_1,\mathbf e_2,\mathbf e_3$，就确定仿射坐标系。点 $P=(x,y,z)$ 的含义是

$$
\overrightarrow{OP}=x\mathbf e_1+y\mathbf e_2+z\mathbf e_3.
$$

若 $A=(a_1,a_2,a_3),B=(b_1,b_2,b_3)$，则

$$
\overrightarrow{AB}=(b_1-a_1,b_2-a_2,b_3-a_3).
$$

向量加法与数乘逐坐标进行：

$$
\mathbf a+\mathbf b=(a_1+b_1,a_2+b_2,a_3+b_3),\qquad
t\mathbf a=(ta_1,ta_2,ta_3).
$$

平移原点改变点坐标，不改变同一基下的自由向量坐标。

### 4.3.2 直角坐标与斜交坐标的边界

若基向量两两垂直且都是单位向量，就得到标准正交坐标系。此时

$$
\|\mathbf a\|^2=a_1^2+a_2^2+a_3^2,\qquad
|AB|=\sqrt{\sum_{i=1}^3(b_i-a_i)^2}.
$$

一般基下，令 $G=(\mathbf e_i\cdot\mathbf e_j)$，则

$$
\mathbf a\cdot\mathbf b=[\mathbf a]^T G[\mathbf b],\qquad
\|\mathbf a\|^2=[\mathbf a]^T G[\mathbf a].
$$

例如两根单位基向量夹角 $60^\circ$，向量 $\mathbf e_1+\mathbf e_2$ 的坐标为 $(1,1)$，长度平方却是 $1+1+2\cos60^\circ=3$，不是 $2$。

若新基在旧基中的列向量组成矩阵 $P$，则 $[\mathbf a]_{\rm old}=P[\mathbf a]_{\rm new}$。正交坐标之间的基变换矩阵满足 $P^TP=I$，从而保持点积与长度。

## 4.4 射影、方向余弦与夹角

### 4.4.1 标量射影与向量射影

给定有向轴的单位方向向量 $\mathbf e$，向量 $\mathbf a$ 在轴上的**标量射影**定义为

$$
\operatorname{pr}_{\mathbf e}\mathbf a=\|\mathbf a\|\cos\theta=\mathbf a\cdot\mathbf e.
$$

它是有正负号的实数；反转轴的方向，射影变号。零向量的射影定义为零。

沿非零向量 $\mathbf b$ 的**向量射影**为

$$
\boxed{\operatorname{proj}_{\mathbf b}\mathbf a
=\frac{\mathbf a\cdot\mathbf b}{\|\mathbf b\|^2}\mathbf b.}
$$

因此

$$
\mathbf a=\mathbf a_\parallel+\mathbf a_\perp,\qquad
\mathbf a_\parallel=\operatorname{proj}_{\mathbf b}\mathbf a,\qquad
\mathbf a_\perp\cdot\mathbf b=0.
$$

射影是线性的：

$$
\operatorname{pr}_{\mathbf e}(s\mathbf a+t\mathbf b)
=s\operatorname{pr}_{\mathbf e}\mathbf a+t\operatorname{pr}_{\mathbf e}\mathbf b.
$$

这解释了为什么“折线路径在某一方向上的总位移”只取决于起点和终点。

![向量正交分解与有向面积：a 等于平行分量与垂直分量之和，交换两向量使行列式变号](/images/notes/mathematics-competition/04-vector-projection.svg)

*左图取 $\mathbf a=(3,2)$、$\mathbf b=(4,0)$，蓝色水平分量为 $(3,0)$，橙色垂直分量为 $(0,2)$。右图的平行四边形面积是 $8$，有向面积则由向量顺序决定。*

### 4.4.2 方向余弦与方向角

设非零向量 $\mathbf a=(a_1,a_2,a_3)$ 与三个正半轴夹角分别为 $\alpha,\beta,\gamma$。则

$$
\cos\alpha=\frac{a_1}{\|\mathbf a\|},\quad
\cos\beta=\frac{a_2}{\|\mathbf a\|},\quad
\cos\gamma=\frac{a_3}{\|\mathbf a\|},
$$

从而

$$
\cos^2\alpha+\cos^2\beta+\cos^2\gamma=1.
$$

方向角并不满足一般的“三角形内角和为 $\pi$”；它们只是同一个单位向量的三个坐标所对应的角。

两非零向量的夹角 $\theta\in[0,\pi]$ 满足

$$
\cos\theta=\frac{\mathbf a\cdot\mathbf b}{\|\mathbf a\|\|\mathbf b\|}.
$$

若要求两条**无向直线**的锐角或直角，应对分子取绝对值，角的范围变为 $[0,\pi/2]$。

## 4.5 数量积：长度、角度与最值

### 4.5.1 定义与运算性质

数量积又称点积，是标量：

$$
\mathbf a\cdot\mathbf b=\|\mathbf a\|\|\mathbf b\|\cos\theta.
$$

在标准正交基下，

$$
\mathbf a\cdot\mathbf b=a_1b_1+a_2b_2+a_3b_3.
$$

它对两个变量均线性，具有交换律，并且 $\mathbf a\cdot\mathbf a=\|\mathbf a\|^2\ge0$，等号仅在 $\mathbf a=\mathbf0$ 时成立。由此得到

$$
\|\mathbf a\pm\mathbf b\|^2
=\|\mathbf a\|^2+\|\mathbf b\|^2\pm2\mathbf a\cdot\mathbf b.
$$

非零向量垂直当且仅当点积为零。零向量的点积也为零，但不能据此给它定义方向角。

### 4.5.2 Cauchy 不等式与三角不等式

用正交分解，$\|\mathbf a_\perp\|^2\ge0$ 给出

$$
\boxed{|\mathbf a\cdot\mathbf b|\le\|\mathbf a\|\|\mathbf b\|.}
$$

等号当且仅当两向量线性相关。于是

$$
\|\mathbf a+\mathbf b\|\le\|\mathbf a\|+\|\mathbf b\|.
$$

当两向量非零时，后者等号要求同向，而不是仅仅共线。这一区别常影响最值题的取等条件。

### 4.5.3 例：最短分解与垂足

求 $\mathbf a=(2,1,2)$ 到由 $\mathbf b=(1,2,2)$ 张成的直线的距离。因为

$$
\mathbf a\cdot\mathbf b=8,\qquad \|\mathbf a\|^2=\|\mathbf b\|^2=9,
$$

垂足向量为 $\frac89\mathbf b$，距离平方为

$$
\left\|\mathbf a-\frac89\mathbf b\right\|^2
=9-\frac{64}{9}=\frac{17}{9}.
$$

所以距离为 $\sqrt{17}/3$。也可把 $\|\mathbf a-t\mathbf b\|^2=9t^2-16t+9$ 配方；“正交投影”和“二次函数最小值”是同一结构的两种写法。

## 4.6 向量积：方向与面积

### 4.6.1 定义、右手法则与坐标式

$\mathbf a\times\mathbf b$ 是向量，垂直于 $\mathbf a,\mathbf b$ 所在平面，方向由右手法则确定，长度为

$$
\|\mathbf a\times\mathbf b\|=\|\mathbf a\|\|\mathbf b\|\sin\theta.
$$

若两向量线性相关，叉积为零。在右手标准正交坐标系中，

$$
\mathbf a\times\mathbf b=
\begin{vmatrix}
\mathbf i&\mathbf j&\mathbf k\\
a_1&a_2&a_3\\
b_1&b_2&b_3
\end{vmatrix}
=(a_2b_3-a_3b_2,\ a_3b_1-a_1b_3,\ a_1b_2-a_2b_1).
$$

第一行含向量，这是一种方便记忆的展开记号。换成左手坐标系时不能原样套用右手公式。

### 4.6.2 性质及应用

叉积满足双线性与反交换律：

$$
\mathbf a\times\mathbf b=-\mathbf b\times\mathbf a,\qquad
\mathbf a\times(\mathbf b+\mathbf c)=\mathbf a\times\mathbf b+\mathbf a\times\mathbf c.
$$

但它**不满足结合律**。$\mathbf a\times\mathbf b=\mathbf0$ 当且仅当 $\mathbf a,\mathbf b$ 线性相关。

由两边张成的平行四边形面积为 $\|\mathbf a\times\mathbf b\|$，三角形面积为其一半。关键恒等式是

$$
\boxed{\|\mathbf a\times\mathbf b\|^2
=\|\mathbf a\|^2\|\mathbf b\|^2-(\mathbf a\cdot\mathbf b)^2.}
$$

右边是二阶 Gram 行列式，因此面积平方可以只用边长和夹角求出，不必写出叉积的每个分量。

**例。** $A=(1,0,0),B=(0,1,0),C=(0,0,1)$。有

$$
\overrightarrow{AB}=(-1,1,0),\quad
\overrightarrow{AC}=(-1,0,1),\quad
\overrightarrow{AB}\times\overrightarrow{AC}=(1,1,1).
$$

故三角形面积为 $\sqrt3/2$，所在平面的法向量可取 $(1,1,1)$。

## 4.7 混合积：有向体积与共面判定

定义

$$
[\mathbf a,\mathbf b,\mathbf c]
=(\mathbf a\times\mathbf b)\cdot\mathbf c
=\det\begin{pmatrix}a_1&a_2&a_3\\b_1&b_2&b_3\\c_1&c_2&c_3\end{pmatrix}.
$$

它是标量，绝对值是平行六面体体积，符号反映三向量的取向。循环置换不改变值，交换任意两项变号：

$$
[\mathbf a,\mathbf b,\mathbf c]
=[\mathbf b,\mathbf c,\mathbf a]
=-[\mathbf b,\mathbf a,\mathbf c].
$$

同时

$$
(\mathbf a\times\mathbf b)\cdot\mathbf c
=\mathbf a\cdot(\mathbf b\times\mathbf c).
$$

这是标量三重积的循环性质，不是叉积结合律。

三个向量共面当且仅当混合积为零；四点 $A,B,C,D$ 共面当且仅当

$$
[\overrightarrow{AB},\overrightarrow{AC},\overrightarrow{AD}]=0.
$$

相应四面体体积为

$$
V=\frac16\left|[\overrightarrow{AB},\overrightarrow{AC},\overrightarrow{AD}]\right|.
$$

**例。** $A=(1,0,0),B=(0,2,0),C=(0,0,3)$ 与原点 $O$ 构成四面体。混合积为 $6$，所以体积为 $1$；不是 $6$，也不是 $3$。

若 $[\mathbf e_1,\mathbf e_2,\mathbf e_3]\ne0$，对 $\mathbf a=x\mathbf e_1+y\mathbf e_2+z\mathbf e_3$ 两侧取混合积，可直接提取坐标：

$$
x=\frac{[\mathbf a,\mathbf e_2,\mathbf e_3]}{[\mathbf e_1,\mathbf e_2,\mathbf e_3]},\quad
y=\frac{[\mathbf e_1,\mathbf a,\mathbf e_3]}{[\mathbf e_1,\mathbf e_2,\mathbf e_3]},\quad
z=\frac{[\mathbf e_1,\mathbf e_2,\mathbf a]}{[\mathbf e_1,\mathbf e_2,\mathbf e_3]}.
$$

这是 Cramer 法则的几何版本。

## 4.8 二重外积及常用恒等式

核心公式为

$$
\boxed{\mathbf a\times(\mathbf b\times\mathbf c)
=(\mathbf a\cdot\mathbf c)\mathbf b-(\mathbf a\cdot\mathbf b)\mathbf c.}
$$

结果落在 $\mathbf b,\mathbf c$ 张成的平面内；系数是点积。另一种括号位置给出

$$
(\mathbf a\times\mathbf b)\times\mathbf c
=(\mathbf a\cdot\mathbf c)\mathbf b-(\mathbf b\cdot\mathbf c)\mathbf a.
$$

两式不能混用。例如 $\mathbf i\times(\mathbf i\times\mathbf j)=-\mathbf j$，而 $(\mathbf i\times\mathbf i)\times\mathbf j=\mathbf0$。

公式可直接按坐标展开证明。其第一分量为

$$
a_2(b_1c_2-b_2c_1)-a_3(b_3c_1-b_1c_3)
=b_1(\mathbf a\cdot\mathbf c)-c_1(\mathbf a\cdot\mathbf b),
$$

其中补入的 $a_1b_1c_1$ 项相消，其余两分量同理。

由二重外积可推出 Lagrange 恒等式

$$
(\mathbf a\times\mathbf b)\cdot(\mathbf c\times\mathbf d)
=(\mathbf a\cdot\mathbf c)(\mathbf b\cdot\mathbf d)
-(\mathbf a\cdot\mathbf d)(\mathbf b\cdot\mathbf c).
$$

取 $\mathbf c=\mathbf a,\mathbf d=\mathbf b$ 就回到面积平方公式。

另一个实用结果是

$$
\mathbf a\times(\mathbf b\times\mathbf a)
=\|\mathbf a\|^2\mathbf b-(\mathbf a\cdot\mathbf b)\mathbf a.
$$

除以 $\|\mathbf a\|^2$ 后，得到 $\mathbf b$ 垂直于 $\mathbf a$ 的分量。它把“投影”与“二重叉积”联系了起来。

## 4.9 向量解几何与三角问题

### 4.9.1 中线长公式与重心

设 $M$ 为 $BC$ 中点，以 $A$ 为原点，记 $\mathbf b=\overrightarrow{AB},\mathbf c=\overrightarrow{AC}$。则

$$
\overrightarrow{AM}=\frac{\mathbf b+\mathbf c}{2}.
$$

利用平方展开与 $BC^2=\|\mathbf b-\mathbf c\|^2$，得到

$$
\boxed{AM^2=\frac{2AB^2+2AC^2-BC^2}{4}.}
$$

重心 $G=(A+B+C)/3$ 满足 $\overrightarrow{AG}=\frac23\overrightarrow{AM}$，因此三条中线交于同一点，并按 $2:1$ 分割。

### 4.9.2 用点积证明三条高共点

令 $A$ 为原点，$\mathbf b,\mathbf c$ 为另外两个顶点位置向量，且三点不共线。设前两条高交于位置向量 $\mathbf h$ 的点 $H$：

$$
\mathbf h\cdot(\mathbf c-\mathbf b)=0,\qquad
(\mathbf h-\mathbf b)\cdot\mathbf c=0.
$$

第二式给出 $\mathbf h\cdot\mathbf c=\mathbf b\cdot\mathbf c$，第一式使 $\mathbf h\cdot\mathbf b$ 与它相等。因此

$$
(\mathbf h-\mathbf c)\cdot\mathbf b=0,
$$

这正是第三条高的条件。向量法把几何共点转化成线性等式间的依赖关系。

### 4.9.3 余弦定理、和差角公式与面积

三角形中取同一起点的两边向量，则第三边是它们的差，平方展开立即得到

$$
a^2=b^2+c^2-2bc\cos A.
$$

平面单位向量 $\mathbf u=(\cos\alpha,\sin\alpha)$、$\mathbf v=(\cos\beta,\sin\beta)$ 的点积为

$$
\cos(\alpha-\beta)=\cos\alpha\cos\beta+\sin\alpha\sin\beta.
$$

其二维行列式为

$$
\det(\mathbf u,\mathbf v)
=\cos\alpha\sin\beta-\sin\alpha\cos\beta
=\sin(\beta-\alpha).
$$

点积对应无向夹角的余弦，行列式记录有向角的正弦；这样记忆可以减少符号错误。

由三角形面积 $S=\frac12bc\sin A=\frac12ca\sin B=\frac12ab\sin C$，除以 $abc/2$ 得到正弦定理中的比值关系。

## 4.10 方法清单与自测

解向量竞赛题可遵循：选原点与基 → 把条件译成线性关系、点积或混合积 → 消元或配方 → 检查退化与取等条件 → 回译几何结论。

**题 1。** $\mathbf a=(1,2,2)$ 在 $\mathbf b=(2,0,0)$ 方向上的标量射影、向量射影分别是什么？

**解。** 单位方向是 $(1,0,0)$，故标量射影为 $1$，向量射影为 $(1,0,0)$。直接用 $\mathbf a\cdot\mathbf b=2$ 作为射影会漏除 $\|\mathbf b\|$。

**题 2。** 设 $\|\mathbf a\|=2,\|\mathbf b\|=3,\mathbf a\cdot\mathbf b=3$，求两向量夹角与所张成三角形面积。

**解。** $\cos\theta=1/2$，所以 $\theta=\pi/3$；叉积模为 $\sqrt{36-9}=3\sqrt3$，面积为 $3\sqrt3/2$。

**题 3。** $A=(1,0,0),B=(0,1,0),C=(0,0,1),D=(t,t,t)$，何时四点共面？

**解。** 前三点所在平面为 $x+y+z=1$，所以 $3t=1$。也可计算 $[\overrightarrow{AB},\overrightarrow{AC},\overrightarrow{AD}]=3t-1$。

**题 4。** 非零向量 $\mathbf a$ 满足 $\mathbf a\times(\mathbf b\times\mathbf a)=\mathbf0$，能得到什么？

**解。** 二重外积等于 $\|\mathbf a\|^2\mathbf b-(\mathbf a\cdot\mathbf b)\mathbf a$，因此 $\mathbf b$ 是 $\mathbf a$ 的倍数。允许 $\mathbf b=\mathbf0$，不能无条件谈两者的夹角。

**题 5。** 证明平行四边形两条对角线的平方和等于四边平方和。

**解。** 对角线为 $\mathbf a+\mathbf b,\mathbf a-\mathbf b$。两式平方相加，交叉项消去，得到 $2\|\mathbf a\|^2+2\|\mathbf b\|^2$。这也是内积空间的平行四边形恒等式。
