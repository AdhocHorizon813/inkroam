---
title: 解析几何第五章：平面与直线
description: 用点、方向向量和法向量建立平面与直线方程，统一判断位置关系、距离和交角，推导异面直线公垂线的方程与最短距离。
date: 2026-11-07
order: 5
tags: [数学竞赛, 解析几何, 平面与直线]
readingTime: 55 分钟
aiGenerated: true
aiAssisted: false
draft: false
readingLinks:
  - path: /notes/mathematics-competition/04-analytic-geometry-vectors
    kind: review
    reason: 本章的法向量、共面判定与距离公式都来自点积、叉积和混合积。
  - path: /notes/mathematics-competition/06-analytic-geometry-surfaces-and-curves
    kind: next
    reason: 从一次方程表示的平面与直线，过渡到曲面交线、直纹面和二次曲线。
---

平面由“一个点加两个独立方向”确定，直线由“一个点加一个非零方向”确定。前者也可以用一个法向量描述。掌握这两种表示之间的转换，位置关系、距离、夹角就都能统一为少量向量运算。

**统一约定。** 使用三维右手标准正交坐标系。点的位置向量记为 $\mathbf r$。直线方向向量 $\mathbf u,\mathbf v$ 均非零，平面法向量 $\mathbf n$ 非零。两条无向直线的夹角、直线与平面的交角、两平面的锐二面角均取 $[0,\pi/2]$；若题目指定有向角或某个二面角，需要另行判断符号和范围。

## 5.1 竞赛要点与难点

| 已知或所求 | 建议表示 | 常见失误 |
| --- | --- | --- |
| 过一点且平行两方向的平面 | 参数式或叉积求法向量 | 两方向平行，不能唯一确定平面 |
| 过三点的平面 | 三点式、混合积 | 三点共线仍机械展开 |
| 两平面交线 | 联立方程，方向取法向量叉积 | 平面平行或重合时叉积为零 |
| 两条直线是否相交 | 联立参数，或先验共面 | 只看方向不平行，忘记可能异面 |
| 点到平面、直线的距离 | 点积投影、叉积面积 | 分母忘记归一化 |
| 异面直线最短距离 | 混合积除以叉积模 | 将非平行公式用于平行线 |
| 公垂线方程 | 两垂足参数方程 | 只写方向，没有求公垂线的位置 |
| 角度 | 法向量、方向向量 | 线面角应使用正弦关系 |

本章中“方程的一种形式”不等于“所有情况下都能使用的形式”。对称式可能含零分母，截距式要求三个截距都存在且非零，法式则必须归一化。

## 5.2 平面方程的各种形式

### 5.2.1 点法式与一般式

设平面经过 $P_0=(x_0,y_0,z_0)$，法向量为 $\mathbf n=(A,B,C)\ne\mathbf0$。平面内任意点 $P$ 满足 $\overrightarrow{P_0P}\perp\mathbf n$，所以

$$
\boxed{\mathbf n\cdot(\mathbf r-\mathbf r_0)=0.}
$$

展开为

$$
A(x-x_0)+B(y-y_0)+C(z-z_0)=0,
$$

或一般式

$$
\boxed{Ax+By+Cz+D=0,\qquad (A,B,C)\ne(0,0,0).}
$$

这里 $D=-Ax_0-By_0-Cz_0$。四个系数同时乘非零常数不改变平面；只有前三个系数构成法向量。

### 5.2.2 参数式与三点式

过 $P_0$、平行于两个线性无关向量 $\mathbf a,\mathbf b$ 的平面为

$$
\boxed{\mathbf r=\mathbf r_0+s\mathbf a+t\mathbf b,\qquad s,t\in\mathbb R.}
$$

其法向量可取 $\mathbf a\times\mathbf b$。

若平面经过不共线的三点 $P_0,P_1,P_2$，则取 $\mathbf a=\overrightarrow{P_0P_1}$、$\mathbf b=\overrightarrow{P_0P_2}$，得到

$$
[\mathbf r-\mathbf r_0,\mathbf r_1-\mathbf r_0,\mathbf r_2-\mathbf r_0]=0.
$$

坐标形式是三阶行列式：

$$
\begin{vmatrix}
x-x_0&y-y_0&z-z_0\\
x_1-x_0&y_1-y_0&z_1-z_0\\
x_2-x_0&y_2-y_0&z_2-z_0
\end{vmatrix}=0.
$$

若三点共线，这个行列式恒为零，表示的是恒等式，不能说它给出了一个确定的平面。

### 5.2.3 截距式与法式

若平面在三坐标轴上的截距为非零数 $a,b,c$，则

$$
\frac xa+\frac yb+\frac zc=1.
$$

$a,b,c$ 是带符号的坐标截距，允许负数；若平面平行于某坐标轴，不能使用具有三个有限非零截距的形式。

若 $\widehat{\mathbf n}=(\cos\alpha,\cos\beta,\cos\gamma)$ 是单位法向量，平面可写成

$$
x\cos\alpha+y\cos\beta+z\cos\gamma=p.
$$

按合适方向选取单位法向量，可令 $p\ge0$，此时 $p$ 是原点到平面的距离。过原点时 $p=0$，法向量的正负仍有选择。

### 5.2.4 平面束

两相交平面 $F_1=0,F_2=0$ 的交线所经过的所有平面可表示为

$$
\lambda F_1+\mu F_2=0,\qquad (\lambda,\mu)\ne(0,0).
$$

写成 $F_1+kF_2=0$ 会漏掉 $F_2=0$。齐次参数 $(\lambda,\mu)$ 能完整覆盖整个平面束。

例如求过交线 $x+y=1,\ z=0$ 且经过 $Q=(0,0,1)$ 的平面。令 $\lambda(x+y-1)+\mu z=0$，代入 $Q$ 得 $\mu=\lambda$，于是平面是 $x+y+z=1$。

## 5.3 直线方程的各种形式

### 5.3.1 向量式与参数式

过点 $P_0$、方向向量为 $\mathbf u=(l,m,n)\ne\mathbf0$ 的直线为

$$
\boxed{\mathbf r=\mathbf r_0+t\mathbf u,\qquad t\in\mathbb R.}
$$

即

$$
x=x_0+lt,\qquad y=y_0+mt,\qquad z=z_0+nt.
$$

$l,m,n$ 是方向数；只有归一化后才是方向余弦。$\mathbf u$ 与非零倍数 $k\mathbf u$ 表示同一直线方向。

过不同两点 $A,B$ 的直线可写为

$$
\mathbf r=\mathbf r_A+t(\mathbf r_B-\mathbf r_A).
$$

### 5.3.2 对称式及零方向数

若 $lmn\ne0$，消去参数得

$$
\frac{x-x_0}{l}=\frac{y-y_0}{m}=\frac{z-z_0}{n}.
$$

若 $l=0$ 而 $m,n\ne0$，应写成

$$
x=x_0,\qquad \frac{y-y_0}{m}=\frac{z-z_0}{n}.
$$

“$\frac{x-x_0}{0}$”只能作为某些教材的形式化缩写，实际推导中应改成 $x=x_0$。参数式总能避开这个问题。

### 5.3.3 一般式：两个平面的交线

若 $\mathbf n_1,\mathbf n_2$ 线性无关，方程组

$$
\begin{cases}
A_1x+B_1y+C_1z+D_1=0,\\
A_2x+B_2y+C_2z+D_2=0
\end{cases}
$$

表示一条直线，其方向可取

$$
\mathbf u=\mathbf n_1\times\mathbf n_2.
$$

找一个公共点后就能改成参数式。若法向量相关，方程组可能表示一个平面，也可能无解。

反过来，过 $P_0$、方向为 $\mathbf u$ 的直线可取两个独立的垂直于 $\mathbf u$ 的向量 $\mathbf n_1,\mathbf n_2$，写成两点法式的联立。

**二维补充。** 平面内的直线 $Ax+By+C=0$ 的法向量为 $(A,B)$，方向向量为 $(-B,A)$。斜截式 $y=kx+b$ 漏掉垂直直线，而一般式和参数式没有这个限制。

## 5.4 如何从几何条件建立方程

### 5.4.1 先检查“是否唯一确定”

| 几何条件 | 建立方法 | 唯一性条件 |
| --- | --- | --- |
| 一点与一个法向量 | 平面点法式 | 法向量非零 |
| 三点 | 两边叉积作法向量 | 三点不共线 |
| 一点与一条直线 | 点差与方向叉积 | 点不在直线上 |
| 两条相交直线 | 两方向叉积 | 两直线不同 |
| 两条不同平行直线 | 方向与连接向量叉积 | 两线确实不同 |
| 一点与一方向 | 直线参数式 | 方向非零 |
| 两点 | 点差作方向 | 两点不同 |

两条异面直线不能同处一个平面，因此“过两条给定直线作平面”首先要判断共面。

### 5.4.2 例：过直线及线外点的平面

直线 $\mathbf r=(1,0,0)+t(1,1,0)$，点 $Q=(0,0,1)$。取

$$
\mathbf u=(1,1,0),\qquad \overrightarrow{P_0Q}=(-1,0,1),
$$

则

$$
\mathbf n=\mathbf u\times\overrightarrow{P_0Q}=(1,-1,1).
$$

点法式为 $(x-1)-y+z=0$，即 $x-y+z=1$。代入直线参数恒成立，代入 $Q$ 也成立，这两次代入是最便宜的核验。

### 5.4.3 例：两平面的交线

求 $x+y+z=1,\ x-y=0$ 的交线。法向量叉积为

$$
(1,1,1)\times(1,-1,0)=(1,1,-2).
$$

取公共点 $(0,0,1)$，故

$$
(x,y,z)=(0,0,1)+t(1,1,-2).
$$

直接联立也得到 $x=y=t,z=1-2t$。向量法和消元法应当相互印证。

## 5.5 位置关系的统一判定

### 5.5.1 点与平面、点与直线

点 $Q$ 在平面上，当且仅当代入平面方程为零。若两个点代入 $F=Ax+By+Cz+D$ 的值乘积为正，它们位于平面同侧；乘积为负则异侧。

点 $Q$ 在 $\mathbf r=\mathbf r_0+t\mathbf u$ 上，当且仅当

$$
(\mathbf r_Q-\mathbf r_0)\times\mathbf u=\mathbf0.
$$

也可以求是否存在同一个 $t$ 同时满足三坐标方程。

### 5.5.2 平面与平面

设两平面为 $\mathbf n_i\cdot\mathbf r+D_i=0$：

- 若 $\mathbf n_1\times\mathbf n_2\ne\mathbf0$，相交于一直线。
- 若 $\mathbf n_2=k\mathbf n_1$，并且 $D_2=kD_1$，两平面重合。
- 若法向量成比例而常数项不按同一比例变化，两平面平行且不重合。

不能只比较 $(A,B,C)$ 就断言重合。

### 5.5.3 直线与平面

把直线 $\mathbf r=\mathbf p+t\mathbf u$ 代入平面 $\mathbf n\cdot\mathbf r+D=0$，得到

$$
(\mathbf n\cdot\mathbf u)t+\mathbf n\cdot\mathbf p+D=0.
$$

于是：

- $\mathbf n\cdot\mathbf u\ne0$：唯一交点，$t=-(\mathbf n\cdot\mathbf p+D)/(\mathbf n\cdot\mathbf u)$。
- $\mathbf n\cdot\mathbf u=0$ 且 $\mathbf n\cdot\mathbf p+D=0$：整条直线在平面内。
- $\mathbf n\cdot\mathbf u=0$ 且常数项不为零：直线与平面平行且不相交。

直线垂直于平面的条件是 $\mathbf u$ 与 $\mathbf n$ 平行，不能把它误写为点积为零。

### 5.5.4 直线与直线

设

$$
L_1:\mathbf r=\mathbf p+t\mathbf u,\qquad
L_2:\mathbf r=\mathbf q+s\mathbf v,\qquad
\mathbf w=\mathbf q-\mathbf p.
$$

先计算 $\mathbf u\times\mathbf v$：

- 若它为零，再看 $\mathbf w\times\mathbf u$：为零则重合，否则平行且不同。
- 若它非零，再看 $[\mathbf w,\mathbf u,\mathbf v]$：为零则相交，否则异面。

非平行时为什么“混合积为零”足以保证相交？因为它说明 $\mathbf w$ 落在 $\mathbf u,\mathbf v$ 张成的平面内，所以能写成 $\mathbf w=t\mathbf u-s\mathbf v$，这恰是交点方程。

因此，**空间中不平行的两条直线未必相交，但共面且不平行就必相交**。

## 5.6 距离：投影、面积与体积

### 5.6.1 点到平面的距离、垂足与对称点

给定 $Q$ 与平面 $\mathbf n\cdot\mathbf r+D=0$，垂足必在法线 $\mathbf r_Q-\lambda\mathbf n$ 上。代入平面方程，得到

$$
\lambda=\frac{\mathbf n\cdot\mathbf r_Q+D}{\|\mathbf n\|^2}.
$$

所以

$$
\boxed{
\mathbf r_H=\mathbf r_Q-
\frac{\mathbf n\cdot\mathbf r_Q+D}{\|\mathbf n\|^2}\mathbf n,
\qquad
d(Q,\Pi)=\frac{|\mathbf n\cdot\mathbf r_Q+D|}{\|\mathbf n\|}.
}
$$

关于平面的对称点为 $\mathbf r_{Q'}=2\mathbf r_H-\mathbf r_Q$。

例如 $Q=(1,2,3)$ 到平面 $x+2y+2z=3$，代入值为 $8$，法向量模为 $3$，故距离 $8/3$，垂足为 $(1/9,2/9,11/9)$。

### 5.6.2 点到直线的距离

记 $\mathbf w=\mathbf r_Q-\mathbf p$，把它沿直线方向分解：

$$
t_0=\frac{\mathbf w\cdot\mathbf u}{\|\mathbf u\|^2},\qquad
\mathbf r_H=\mathbf p+t_0\mathbf u.
$$

从而

$$
\boxed{d(Q,L)=
\sqrt{\|\mathbf w\|^2-\frac{(\mathbf w\cdot\mathbf u)^2}{\|\mathbf u\|^2}}
=\frac{\|\mathbf w\times\mathbf u\|}{\|\mathbf u\|}.}
$$

最后一种形式是“平行四边形面积 ÷ 底边长”。

### 5.6.3 平行对象之间的距离

两平行平面先写成相同法向量的形式：

$$
\mathbf n\cdot\mathbf r+D_1=0,\qquad
\mathbf n\cdot\mathbf r+D_2=0.
$$

距离为 $|D_1-D_2|/\|\mathbf n\|$。若原方程法向量只成比例，必须先调整系数，不能直接减两个常数项。

两平行直线之间的距离，取其中一线任意一点，计算到另一线的距离即可。直线与平面平行时同理。相交对象之间的最短距离为零。

### 5.6.4 两条非平行直线的距离

令 $\mathbf n=\mathbf u\times\mathbf v\ne\mathbf0$。连接两线上任意点的向量为

$$
\mathbf q+s\mathbf v-\mathbf p-t\mathbf u
=\mathbf w+s\mathbf v-t\mathbf u.
$$

它沿 $\mathbf n$ 的分量不依赖 $s,t$，所以最短距离为

$$
\boxed{d(L_1,L_2)=
\frac{|\mathbf w\cdot(\mathbf u\times\mathbf v)|}
{\|\mathbf u\times\mathbf v\|}.}
$$

几何上，这是“平行六面体体积 ÷ 底面积”。非平行共面时分子为零，给出相交距离零；平行时分母为零，必须改用点到直线公式。

## 5.7 交角：区分方向向量和法向量

| 对象 | 交角公式 | 几何解释 |
| --- | --- | --- |
| 两直线 | $\cos\theta=\frac{|\mathbf u\cdot\mathbf v|}{\|\mathbf u\|\|\mathbf v\|}$ | 比较两个方向 |
| 两平面 | $\cos\theta=\frac{|\mathbf n_1\cdot\mathbf n_2|}{\|\mathbf n_1\|\|\mathbf n_2\|}$ | 锐二面角等于法向夹角或其补角 |
| 直线与平面 | $\sin\theta=\frac{|\mathbf u\cdot\mathbf n|}{\|\mathbf u\|\|\mathbf n\|}$ | 线面角与线法向夹角互余 |

若线平行于面，$\theta=0$；若线垂直于面，$\theta=\pi/2$。这两个极端情形能立刻检查正弦、余弦是否写反。

**例。** 方向 $\mathbf u=(1,1,0)$ 的直线与法向量 $\mathbf n=(0,1,1)$ 的平面交角满足 $\sin\theta=1/2$，所以 $\theta=\pi/6$。直接求两向量夹角会得到 $\pi/3$，那是与法向量的角。

对两个相交平面，其两个二面角互补。题目指定某个空间区域对应的二面角时，应选向该区域的法向量，不能只给取绝对值后的锐角。

## 5.8 异面直线的公垂线：完整推导

### 5.8.1 求公垂线必须同时确定位置和方向

$\mathbf u\times\mathbf v$ 只确定公垂线的方向。要得到方程，还要找到它在两条直线上的垂足。

设

$$
H_1=\mathbf p+t\mathbf u,\qquad
H_2=\mathbf q+s\mathbf v,\qquad
\mathbf d=H_2-H_1=\mathbf w+s\mathbf v-t\mathbf u.
$$

要求 $\mathbf d\perp\mathbf u$ 且 $\mathbf d\perp\mathbf v$。引入

$$
a=\mathbf u\cdot\mathbf u,\quad b=\mathbf u\cdot\mathbf v,\quad
c=\mathbf v\cdot\mathbf v,\quad
d=\mathbf w\cdot\mathbf u,\quad e=\mathbf w\cdot\mathbf v.
$$

这里小写 $d$ 是点积标量，距离另写 $d(L_1,L_2)$。垂直条件给出

$$
\begin{cases}
at-bs=d,\\
bt-cs=e.
\end{cases}
$$

由于非平行时 $\Delta=ac-b^2=\|\mathbf u\times\mathbf v\|^2>0$，唯一解为

$$
\boxed{t=\frac{cd-be}{\Delta},\qquad
s=\frac{bd-ae}{\Delta}.}
$$

求出 $H_1,H_2$ 后，公垂线方程为

$$
\boxed{\mathbf r=H_1+\lambda(\mathbf u\times\mathbf v).}
$$

异面时 $H_1\ne H_2$，线段 $H_1H_2$ 就是唯一的最短连接线段。非平行相交时两垂足重合，仍可取经过交点、方向为 $\mathbf u\times\mathbf v$ 的直线。

### 5.8.2 为什么它确实实现全局最短距离？

在垂足处 $\mathbf d\perp\mathbf u,\mathbf v$。任意其他连接向量都可写成 $\mathbf d+\delta s\,\mathbf v-\delta t\,\mathbf u$，于是

$$
\|\mathbf d+\delta s\,\mathbf v-\delta t\,\mathbf u\|^2
=\|\mathbf d\|^2+\|\delta s\,\mathbf v-\delta t\,\mathbf u\|^2
\ge\|\mathbf d\|^2.
$$

两方向线性无关使等号仅在 $\delta s=\delta t=0$ 时成立。这同时证明最短性和唯一性，比只解出一组驻点更完整。

![异面直线的公垂线示意：两条水平但方向不同的直线位于不同高度，连接两垂足的竖直线段同时垂直于两条直线](/images/notes/mathematics-competition/05-common-perpendicular.svg)

*图取下例数据，以斜投影显示空间关系；图上看到的角度不等于真实空间角度。公垂线长度与垂直性由坐标计算确认。*

### 5.8.3 例：求公垂线方程和最短距离

给定

$$
L_1:(x,y,z)=(t,0,0),\qquad
L_2:(x,y,z)=(1+s,1+s,1).
$$

取 $\mathbf p=(0,0,0)$、$\mathbf u=(1,0,0)$、$\mathbf q=(1,1,1)$、$\mathbf v=(1,1,0)$。于是

$$
a=1,\ b=1,\ c=2,\ d=1,\ e=2,\ \Delta=1.
$$

得到 $t=0,s=-1$，故 $H_1=(0,0,0)$、$H_2=(0,0,1)$。公垂线为

$$
x=0,\qquad y=0,
$$

距离为 $1$。再用混合积公式核验：$\mathbf u\times\mathbf v=(0,0,1)$，$\mathbf w$ 在此单位方向上的射影为 $1$。

### 5.8.4 另一种求法：用两个平面夹出公垂线

令 $\mathbf n=\mathbf u\times\mathbf v$。经过 $L_1$ 且平行于 $\mathbf n$ 的平面法向量为 $\mathbf u\times\mathbf n$；经过 $L_2$ 且平行于 $\mathbf n$ 的平面法向量为 $\mathbf v\times\mathbf n$。

两平面的交线就是公垂线：

$$
\begin{cases}
(\mathbf u\times\mathbf n)\cdot(\mathbf r-\mathbf p)=0,\\
(\mathbf v\times\mathbf n)\cdot(\mathbf r-\mathbf q)=0.
\end{cases}
$$

这种方法特别适合题目只要求公垂线的一般式；若还要求垂足坐标，参数法通常更直接。

## 5.9 综合例题：投影与角平分面

### 5.9.1 空间直线在平面上的正交投影

平面为 $\mathbf n\cdot\mathbf r+D=0$，直线为 $\mathbf p+t\mathbf u$。对每一个点套用垂足公式，得到

$$
\mathbf p'=\mathbf p-\frac{\mathbf n\cdot\mathbf p+D}{\|\mathbf n\|^2}\mathbf n,\qquad
\mathbf u'=\mathbf u-\frac{\mathbf n\cdot\mathbf u}{\|\mathbf n\|^2}\mathbf n.
$$

若 $\mathbf u'\ne\mathbf0$，投影直线为 $\mathbf r=\mathbf p'+t\mathbf u'$；若 $\mathbf u'=\mathbf0$，原直线垂直于平面，投影退化成一个点。

例如将 $\mathbf r=(1,0,2)+t(1,1,1)$ 投影到 $z=0$，得到 $(x,y,z)=(1,0,0)+t(1,1,0)$。

### 5.9.2 到两相交平面等距的点集

两平面 $F_i=A_ix+B_iy+C_iz+D_i=0$ 相交。等距条件是

$$
\frac{|F_1|}{\|\mathbf n_1\|}=\frac{|F_2|}{\|\mathbf n_2\|}.
$$

因此轨迹是两个角平分面：

$$
\frac{F_1}{\|\mathbf n_1\|}
=\pm\frac{F_2}{\|\mathbf n_2\|}.
$$

归一化不能省略；方程整体乘一个常数不会改变原平面，但会改变未归一化表达式的大小。

## 5.10 自测与解答

**题 1。** 求过 $(1,0,0),(0,2,0),(0,0,3)$ 的平面，并求原点到它的距离。

**解。** 截距式为 $x+y/2+z/3=1$，整理为 $6x+3y+2z-6=0$。法向量模为 $7$，距离为 $6/7$。

**题 2。** 判断 $L_1=(t,0,0)$ 与 $L_2=(0,1,s)$ 的位置关系并求距离。

**解。** 方向是 $(1,0,0),(0,0,1)$，连接向量是 $(0,1,0)$。混合积非零，所以异面；公垂线沿 $y$ 轴，距离为 $1$。

**题 3。** 直线 $(x,y,z)=(1,0,0)+t(1,1,-1)$ 与平面 $x+y+2z=1$ 是什么关系？

**解。** 法向量与方向点积 $1+1-2=0$，且起点满足平面方程，因此整条直线在平面内。“方向平行于平面”不能单独排除包含关系。

**题 4。** 点 $(2,-1,3)$ 关于平面 $z=1$ 的对称点是什么？

**解。** 垂足为 $(2,-1,1)$，对称点为 $(2,-1,-1)$。一般情况同样使用 $Q'=2H-Q$。

**题 5。** 两平面 $x+y+z=1$ 与 $2x+2y+2z=5$ 的距离是多少？

**解。** 先将第二式除以 $2$，距离为 $|5/2-1|/\sqrt3=\sqrt3/2$。直接把 $5$ 和 $1$ 相减是错误的。

**题 6。** 给定两条不平行直线，其方向点积为零，能否说它们“相交且垂直”？

**解。** 不能。方向正交只确定夹角为 $\pi/2$，两线仍可能异面。若要证明相交垂直，还需验证共面或解出共同点。空间题应把“方向关系”和“位置关系”分别说明。
