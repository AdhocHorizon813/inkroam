---
title: 位势方程的基本解、Green 表示与调和函数的平均值公式
description: 从径向求导开始，追踪单位通量、挖孔后的法向与两个小球面积分，再用两种方法证明平均值公式，判断上、下调和函数的不等号。
date: 2026-11-21
tags: [数学物理方程, 位势方程, 基本解, Green公式, 调和函数]
readingTime: 45 分钟
aiGenerated: true
aiAssisted: false
draft: false
---

吴事良《数学物理方程》第五章《位势方程》，§5.1，第 21—32 页。第 21—22 页寻找基本解，第 23—28 页用它表示内点的函数值，第 29—32 页讨论球面平均、球内平均及其不等式。可以带着一个问题读完整节：**在一块材料的内部只量一个点的温度，什么时候等价于沿着周围一整圈取平均？** 在均匀各向同性的材料中，稳态、无热源时的温度满足 Laplace 方程。二维的“一整圈”是圆周，三维对应球面。

## 开始前把点、球和法向分清

本节取 $n\ge 2$。在 $n$ 维空间中，$\Delta u=\sum_{i=1}^n \partial^2 u/\partial x_i^2$，即沿每条坐标轴取二阶偏导，再相加。本节统一用课件的号数：Poisson 方程写为 $\Delta u=f$，基本解 $\Gamma$ 归一化为 $-\Delta\Gamma=\delta_0$。这个负号决定后面体积分的符号。

| 记号 | 如何读、如何用 |
| --- | --- |
| $\Omega,\partial\Omega$ | 开区域和它的边界。写全域的边界积分时，取有界、边界足够光滑的区域。 |
| $x_0,x,r$ | $x_0$ 是固定的观察点，$x$ 是移动的积分点，$r=\lvert x-x_0\rvert$ 是它们的距离。 |
| $B_a(x_0),S_a(x_0)$ | 半径为 $a$ 的开球和它的边界球面。课件也写作 $B^a_{x_0},S^a_{x_0}$。二维中开球是圆盘，球面是圆周。 |
| $dx,dS$ | 分别对区域的体积和边界的面积积分；二维时分别是面积元和弧长元。 |
| $\partial_\nu u=\nabla u\cdot\nu$ | 沿所选单位法向 $\nu$ 的方向导数。外法向总是相对于**正在积分的区域**来取。 |
| $\alpha(n),\omega(n)$ | 依课件，分别为单位球的**表面积**和**体积**。特别地，$\alpha(2)=2\pi,\ \alpha(3)=4\pi$。 |

把单位球面按比例 $a$ 放大，它的 $n-1$ 个切向长度各放大 $a$ 倍，故 $|S_a|=\alpha(n)a^{n-1}$。把球分成半径 $r$、厚度 $dr$ 的薄壳，再对半径积分，得到

$$
|B_a|=\int_0^a |S_r|\,dr
=\int_0^a\alpha(n)r^{n-1}\,dr
=\frac{\alpha(n)}{n}a^n=\omega(n)a^n.
$$

所以 $\alpha(n)=n\omega(n)$。二维检查一遍：半径为 $a$ 的圆周长是 $2\pi a$，面积是 $\pi a^2$。下面看到“平均”时就问：积分覆盖的是边界还是内部？对应的分母分别是这两个量。

## 二．基本解（第 21—22 页）

### 为什么从只依赖距离的函数找起

先把中心设为原点。点源没有偏爱的方向，Laplace 算子在旋转下也保持形式。来做第 21 页的作业：设 $O$ 是正交矩阵，$y=Ox$，$v(x)=u(y)$。由于 $y_j=\sum_i O_{ji}x_i$，故 $\partial y_j/\partial x_i=O_{ji}$。对同一个 $x_i$ 连用两次链式法则，

$$
\partial_{x_i}v=\sum_j u_{y_j}(y)O_{ji},\qquad
\partial_{x_ix_i}v=\sum_{j,k}u_{y_jy_k}(y)O_{ji}O_{ki}.
$$

现在对 $i$ 求和。正交矩阵的第 $j$ 行与第 $k$ 行的内积 $\sum_i O_{ji}O_{ki}$ 在 $j=k$ 时为 $1$，其余为 $0$，所以混合二阶偏导全部消掉：

$$
\Delta_x v(x)=\sum_j u_{y_jy_j}(Ox)=(\Delta u)(Ox).
$$

于是旋转一个调和函数，仍得调和函数。寻找点源对应的一个特殊解时，可以试 $u(x)=v(r)$，其中 $r=|x|$。一般的调和函数可以有方向性，比如 $u(x)=x_1$。

### 从偏导逐项算出径向方程

在 $r>0$ 时，$r=(x_1^2+\cdots+x_n^2)^{1/2}$。先后求导：

$$
\partial_{x_i}r=\frac{x_i}{r},\qquad
\partial_{x_ix_i}r
=\partial_{x_i}(x_i r^{-1})
=\frac1r-\frac{x_i^2}{r^3}.
$$

再对复合函数 $v(r)$ 求导。第一项记录 $v'$ 随 $r$ 改变，第二项记录 $x_i/r$ 随 $x_i$ 改变：

$$
\partial_{x_i}u=v'(r)\frac{x_i}{r},\qquad
\partial_{x_ix_i}u
=v''(r)\frac{x_i^2}{r^2}
+v'(r)\left(\frac1r-\frac{x_i^2}{r^3}\right).
$$

将 $i=1,\ldots,n$ 全部加起来，利用 $\sum_i x_i^2=r^2$，$v''$ 的系数为 $1$，$v'$ 的系数为 $n/r-r^2/r^3=(n-1)/r$。这就得到课件式 (10)：

$$
\Delta u=v''(r)+\frac{n-1}{r}v'(r)=0,\qquad r>0.
$$

设 $w=v'$。乘以 $r^{n-1}$，左边恰好是乘积 $r^{n-1}w$ 的导数：

$$
(r^{n-1}w)'=r^{n-1}w'+(n-1)r^{n-2}w=0.
$$

所以 $r^{n-1}v'(r)=C$，即 $v'(r)=Cr^{1-n}$。积分时要分维数，因为 $r^{-1}$ 的原函数是对数：

$$
v(r)=
\begin{cases}
C\ln r+D, & n=2,\\[2pt]
\dfrac{C}{2-n}r^{2-n}+D, & n\ge 3 .
\end{cases}
$$

这里 $C,D$ 都是任意常数。$C=0$ 得到常数解；$C\ne0$ 时，这一族在原点有奇性。把原点移到 $x_0$，只须把 $|x|$ 换成 $|x-x_0|$，因为平移对各坐标的偏导没有影响。

### 为什么选择这个系数，尤其是二维的负号

先以小球本身为积分区域，球的外法向 $e_r=(x-x_0)/r$ 指向远离球心的方向。径向函数的法向导数在 $S_r$ 上处处等于 $\Gamma'(r)$。要求从包围点源的任一球面算得单位源强，即 $-\nabla\Gamma$ 的总外向通量为 $1$，便有

$$
1=-\int_{S_r}\partial_{e_r}\Gamma\,dS
=-\Gamma'(r)\alpha(n)r^{n-1},
\qquad
\Gamma'(r)=-\frac1{\alpha(n)r^{n-1}}.
$$

这个条件固定了乘法常数；加法常数不影响通量。按课件取加法常数为零，积分得到定义 5：

$$
\boxed{
\Gamma(x)=
\begin{cases}
-\dfrac{1}{2\pi}\ln |x|, & n=2,\\[4pt]
\dfrac{|x|^{2-n}}{(n-2)\alpha(n)}, & n\ge 3,
\end{cases}
\quad x\ne0.}
$$

例如三维 $\Gamma=1/(4\pi r)$，$-\Gamma'=1/(4\pi r^2)$。半径加倍，单位面积的通量只剩四分之一，球面面积正好变成四倍，总量仍为一。二维则是 $\Gamma'(r)=-1/(2\pi r)$ 乘圆周长 $2\pi r$，外向导数的积分等于 $-1$。因此 $\Delta\Gamma=0$ 在每个 $r>0$ 都成立，而原点的贡献会在挖孔取极限时留下来。

## 三．Green 等式与内点表示（第 23—28 页）

### 先在没有奇点的区域写 Green 第二公式

取光滑的 $u,v$，计算向量场 $F=u\nabla v-v\nabla u$ 的散度。乘积法则给出两项相同的内积，正好抵消：

$$
\nabla\cdot F
=\nabla u\cdot\nabla v+u\Delta v
-\nabla v\cdot\nabla u-v\Delta u=u\Delta v-v\Delta u.
$$

散度定理把内部的散度积分变成边界的外向通量。把 $F\cdot\nu$ 展开就是 Green 第二公式：

$$
\int_D(u\Delta v-v\Delta u)\,dx
=\int_{\partial D}(u\partial_\nu v-v\partial_\nu u)\,dS .
$$

接下来要代 $v(x)=\Gamma(x-x_0)$。这里 $x_0$ 是我们想读出 $u(x_0)$ 的内点。核在这个点发散，必须先把它挖掉。课件定理 6 记 $u\in C^1(\overline\Omega)\cap C^2(\Omega)$。以下经典推导可先取 $u\in C^2(\overline\Omega)$、边界光滑；在课件的正则性下，边界公式按相应的 Green 公式和积分存在条件理解。挖孔引起的极限只用到 $x_0$ 附近的光滑性。

### 挖掉一个小球，出现两种外法向

取 $0<\varepsilon<\operatorname{dist}(x_0,\partial\Omega)$，令 $D=\Omega_\varepsilon=\Omega\setminus\overline{B_\varepsilon(x_0)}$。它的外边界是原来的 $\partial\Omega$，内边界是 $S_\varepsilon(x_0)$。站在剩下的材料里，跨过内边界要走**向球心**才能离开材料，因此那里 $\nu=-e_r$。

![挖孔区域的二维剖面。圆孔右端同一点的径向箭头向右，剩余区域的外法向箭头向左；外轮廓上的外法向指向材料外部。](/images/notes/equations-of-mathematical-physics/laplace-fundamental-solution-and-mean-value/punctured-domain.png)

固定 $x_0$，有 $\nabla_x r=e_r$、$\nabla_x\Gamma=\Gamma'(r)e_r$。于是内边界上的法向导数为

$$
\partial_\nu\Gamma
=\Gamma'(\varepsilon)e_r\cdot(-e_r)
=-\Gamma'(\varepsilon)
=\frac1{\alpha(n)\varepsilon^{n-1}}.
$$

在 $\Omega_\varepsilon$ 内 $\Delta\Gamma=0$。记 $K(x)=\Gamma(x-x_0)$，对 $u,K$ 应用刚才的 Green 公式，得到课件式 (12) 的展开：

$$
-\int_{\Omega_\varepsilon}K\Delta u\,dx
=\int_{\partial\Omega}(u\partial_\nu K-K\partial_\nu u)\,dS
+\int_{S_\varepsilon}u\partial_\nu K\,dS
-\int_{S_\varepsilon}K\partial_\nu u\,dS .
$$

等式右边最后两项都积在越来越小的球面上；有一项仍保留有限的值。下面分别计算。

### 小球面第一项为什么恰好留下函数值

把刚算出的常数 $\partial_\nu K$ 提到积分号外：

$$
\int_{S_\varepsilon}u\partial_\nu K\,dS
=\frac1{\alpha(n)\varepsilon^{n-1}}\int_{S_\varepsilon}u(x)\,dS.
$$

右边是球面平均值。此处还不能使用后面的调和平均值定理，而且这里的 $u$ 也未必调和。所需的只有连续性：减去 $u(x_0)$，用三角不等式得

$$
\left|\frac1{|S_\varepsilon|}\int_{S_\varepsilon}u\,dS-u(x_0)\right|
\le \sup_{x\in S_\varepsilon}|u(x)-u(x_0)|\longrightarrow0 .
$$

分母随球缩小正好抵消了面积。这就是内点的值进入公式的那一步。

### 第二项为什么消失，体积分为什么能补回原点

固定一个包含小球的闭球 $\overline{B_b(x_0)}\subset\Omega$。令 $M=\sup_{\overline{B_b}}|\nabla u|$。因为 $\nu$ 是单位向量，所以 $|\partial_\nu u|\le M$。在 $S_\varepsilon$ 上 $K$ 是常数，因而可估计积分的绝对值。对 $n\ge3$，

$$
\left|\int_{S_\varepsilon}K\partial_\nu u\,dS\right|
\le M\frac{\varepsilon^{2-n}}{(n-2)\alpha(n)}
       \alpha(n)\varepsilon^{n-1}
=\frac{M\varepsilon}{n-2}\longrightarrow0.
$$

对 $n=2$，相同的计算给出 $M|\ln\varepsilon|(2\pi\varepsilon)/(2\pi)=M\varepsilon|\ln\varepsilon|\to0$。例如写 $\varepsilon=e^{-t}$，就得到 $Mte^{-t}\to0$。少一次求导，便少一阶奇性，这解释了两个球面积分为什么有不同的极限。

体积分还缺少 $B_\varepsilon$。由内点附近 $\Delta u$ 连续可取 $L=\sup_{\overline{B_b}}|\Delta u|<\infty$。对缺少的项取绝对值，按球壳积分，在 $0<\varepsilon<\min(b,1)$ 时有

$$
\left|\int_{B_\varepsilon}K\Delta u\,dx\right|
\le L\int_{B_\varepsilon}|K|\,dx
=
\begin{cases}
L\displaystyle\int_0^\varepsilon r(-\ln r)\,dr, & n=2,\\[4pt]
\dfrac{L}{n-2}\displaystyle\int_0^\varepsilon r\,dr, & n\ge3 .
\end{cases}
$$

二维积分分部得 $-\varepsilon^2\ln\varepsilon/2+\varepsilon^2/4$，高维积分是 $\varepsilon^2/2$，两者都趋于零。因此原点附近的核虽然无界，却是局部可积的，去掉的小球可以补回。

### 定理 6 以及 Poisson、Laplace 两个推论

在式 (12) 中令 $\varepsilon\downarrow0$，右边最后两项合起来趋于 $u(x_0)$。将外边界积分移项，得到课件式 (11)：

$$
\boxed{
u(x_0)=-\int_\Omega K\Delta u\,dx
+\int_{\partial\Omega}
       (K\partial_\nu u-u\partial_\nu K)\,dS .}
$$

可以用一个常数函数检查正负号。令 $u\equiv1$，体积分消失，$\partial_\nu u=0$，剩下 $1=-\int_{\partial\Omega}\partial_\nu K\,dS$。在以 $x_0$ 为中心的球上，这正是基本解归一化时算出的单位通量。

**Poisson 方程（推论 7）。** 现在把观察点重命名为 $x$、积分变量改为 $y$，再将 $\Delta u(y)=f(y)$ 代入。核是偶函数，$\Gamma(y-x)=\Gamma(x-y)$；取法向导数时务必对移动的边界点 $y$ 求导。得到

$$
\begin{aligned}
u(x)={}&-\int_\Omega \Gamma(y-x)f(y)\,dy\\
&+\int_{\partial\Omega}\!
\bigl[\Gamma(y-x)\partial_{\nu_y}u(y)
-u(y)\partial_{\nu_y}\Gamma(y-x)\bigr]\,dS(y).
\end{aligned}
$$

**Laplace 方程（推论 8）。** 令 $f=0$，同一个公式的体积分为零，只剩下边界上的两项。这就是调和函数的基本积分公式。它说明，已知边界上的 $u$ 和 $\partial_\nu u$，就能计算任一内点的值。做 Dirichlet 问题时通常只给 $u$，另一项仍有未知量；这里得到的是表示公式，尚不能直接把未知的法向导数略去。

**带源项的算例。** 为了检验边界项和体积项的相对符号，取三维单位球、观察点 $x=0$、$u(y)=1+|y|^2$。每个坐标的二阶导数都是 $2$，所以 $f=6$。用 $K=1/(4\pi r)$ 和球壳体积 $4\pi r^2\,dr$ 算体积项：

$$
-\int_{B_1}Kf\,dy
=-\int_0^1\frac{6}{4\pi r}\,4\pi r^2\,dr
=-6\int_0^1r\,dr=-3 .
$$

在外球面 $r=1$ 上，$u=2$、$\partial_\nu u=2r=2$、$K=1/(4\pi)$、$\partial_\nu K=-1/(4\pi)$。这四个量沿球面恒定，边界项等于

$$
4\pi\left(\frac{2}{4\pi}-2\cdot\frac{-1}{4\pi}\right)=4.
$$

两项相加是 $-3+4=1$，正好等于直接代入得到的 $u(0)$。若漏掉体积项，球心的值会被算成 $4$。

**体积势（第 27 页）。** 为什么 $\displaystyle \omega(x)=-\int_\Omega\Gamma(y-x)f(y)\,dy$ 单独就是 $\Delta\omega=f$ 的一个特解？先用一个光滑且支集紧含于 $\Omega$ 的测试函数 $\varphi$ 代替表示公式里的 $u$。它在靠近边界的地方恒为零，两个边界项都消失。因而对每个内点 $y$ 有

$$
-\int_\Omega \Gamma(x-y)\Delta\varphi(x)\,dx=\varphi(y).
$$

这正是 $-\Delta\Gamma(\,\cdot-y)=\delta_y$ 的含义：点源作用到 $\varphi$ 上，读出的就是 $\varphi(y)$。用它检查体积势，先取 $f$ 光滑有界；核局部可积，积分可交换次序，于是

$$
\begin{aligned}
\int_\Omega\omega(x)\Delta\varphi(x)\,dx
&=\int_\Omega f(y)
\left[-\int_\Omega\Gamma(x-y)\Delta\varphi(x)\,dx\right]dy\\
&=\int_\Omega f(y)\varphi(y)\,dy .
\end{aligned}
$$

这对每个这样的 $\varphi$ 都成立，就是 $\Delta\omega=f$ 的分布意义。若想先看一个完全经典的情形，可取 $f$ 光滑且紧支撑，向全空间作零延拓并令 $z=x-y$。此时 $\omega(x)=-\int\Gamma(z)f(x-z)\,dz$，对 $x$ 的导数可落在光滑的 $f$ 上，故 $\omega$ 光滑；上面的恒等式便给出逐点的 $\Delta\omega=f$。这样也避开了直接把有奇点的核放在积分号下求二阶导数。任意解 $u$ 减去这个特解后，满足 $\Delta(u-\omega)=f-f=0$。这里的 $\omega(x)$ 是函数，开头的 $\omega(n)$ 是单位球体积，两者按课件共用字母。

### 调和函数零通量与 Neumann 相容条件（第 28 页）

取向量场 $\nabla u$，其散度是 $\Delta u$。于是散度定理直接给出

$$
\int_{\partial\Omega}\partial_\nu u\,dS
=\int_\Omega\Delta u\,dx .
$$

若 $u$ 调和，右边为零，这就是定理 9。若还规定边界上 $\partial_\nu u=g$（Neumann 边界条件），左边就等于 $\int_{\partial\Omega}g\,dS$。所以问题有解的**必要条件**为

$$
\int_{\partial\Omega}g\,dS=0 .
$$

例如在单位圆周上处处指定 $g=1$，总通量是 $2\pi$，不可能对应圆盘内处处调和的函数。零总量允许边界各处的导数不为零，只须正负抵消。若内部有源 $\Delta u=f$，同一步给出 $\int_{\partial\Omega}g\,dS=\int_\Omega f\,dx$。另外，给解加一个常数不会改变 $\Delta u$ 或法向导数，所以单凭 Neumann 数据无法确定这个常数。

## 四．调和函数的平均值公式（第 29—31 页）

设 $u$ 在 $\Omega$ 内调和，选取满足 $\overline{B_a(x_0)}\subset\Omega$ 的半径 $a>0$。以后只在这个内球附近计算，不要求整个 $\partial\Omega$ 上有数据。定理 11 给出两个等式：

$$
u(x_0)
=\frac1{\alpha(n)a^{n-1}}\int_{S_a(x_0)}u(x)\,dS(x)
=\frac1{\omega(n)a^n}\int_{B_a(x_0)}u(x)\,dx.
$$

这个结论比“半径很小时平均值接近中心值”强得多。只要闭球仍在调和区域内，每一个这样的半径都精确给出同一个数。先证明球面版本，再把各个半径的球壳加起来。

### 第一步：固定积分区域，让半径只出现在被积函数里

记球面平均为 $g(a)$。若直接对移动的球面求导，既要处理函数值的变化，又要处理面积的变化。写成 $x=x_0+a\theta$，把方向 $\theta$ 固定在单位球面 $S_1(0)$ 上。因为 $dS(x)=a^{n-1}dS(\theta)$，所以

$$
g(a)=\frac1{\alpha(n)a^{n-1}}\int_{S_a(x_0)}u(x)\,dS(x)
=\frac1{\alpha(n)}\int_{S_1(0)}u(x_0+a\theta)\,dS(\theta).
$$

当 $a\downarrow0$ 时，每个方向上的点都回到 $x_0$。用前面估计小球面平均的同一个上确界，就得到 $g(a)\to u(x_0)$。这一步只用了连续性。现在还需说明从一个半径换到另一个半径，$g$ 根本不变。

### 第二步：球面平均对半径的导数等于什么

在任意一个允许的正半径附近，$\nabla u$ 在相应的闭球壳上连续有界，因而可在固定的单位球面积分内对 $a$ 求导。对固定方向 $\theta$，链式法则给出

$$
\frac{d}{da}u(x_0+a\theta)
=\sum_{i=1}^n u_{x_i}(x_0+a\theta)\theta_i
=\nabla u(x_0+a\theta)\cdot\theta.
$$

换回半径为 $a$ 的球面，$\theta=(x-x_0)/a$ 恰是**整球**的外法向，且 $dS(\theta)=a^{1-n}dS(x)$。一步步代入得

$$
\begin{aligned}
g'(a)
&=\frac1{\alpha(n)}\int_{S_1(0)}
        \nabla u(x_0+a\theta)\cdot\theta\,dS(\theta)\\
&=\frac1{\alpha(n)a^{n-1}}\int_{S_a(x_0)}
        \nabla u(x)\cdot\frac{x-x_0}{a}\,dS(x)\\
&=\frac1{\alpha(n)a^{n-1}}\int_{S_a(x_0)}
        \partial_\nu u\,dS\\
&=\frac1{\alpha(n)a^{n-1}}\int_{B_a(x_0)}\Delta u\,dx .
\end{aligned}
$$

最后一行才用散度定理。到这里甚至还没用调和性，所以这个导数公式在第 32 页仍有用。现在用 $\Delta u=0$，就有 $g'(a)=0$，所以 $g$ 在允许的半径区间内是常数。让 $a\downarrow0$，刚才已求出这个常数为 $u(x_0)$。球面平均值公式得证。

### 第三步：把同心球面逐层叠成球体

在半径 $r$ 的球面上，刚证明的公式说 $\int_{S_r}u\,dS=\alpha(n)r^{n-1}u(x_0)$。把等式在 $0<r<a$ 上积分：

$$
\begin{aligned}
\int_{B_a(x_0)}u(x)\,dx
&=\int_0^a\left(\int_{S_r(x_0)}u(x)\,dS(x)\right)dr\\
&=\alpha(n)u(x_0)\int_0^a r^{n-1}\,dr\\
&=\frac{\alpha(n)}n a^n u(x_0)=\omega(n)a^n u(x_0).
\end{aligned}
$$

第一行已经用了真实球面 $S_r$ 的面积元，不能再额外乘 $r^{n-1}$。若改在**单位**球面上积分，才要显式写 $dx=r^{n-1}dr\,dS(\theta)$。将末行除以球体积，球内平均值公式就出来了。

### 课件作业：直接由基本积分公式再证一次

把推论 8 的区域取为 $B_a(x_0)$，观察点取为球心。球面上的核恒等于 $\Gamma(a)$，外法向与 $e_r$ 相同，故 $\partial_\nu K=\Gamma'(a)=-1/|S_a|$。代入推论 8 的两个边界项，得到

$$
u(x_0)=
\Gamma(a)\int_{S_a}\partial_\nu u\,dS
+\frac1{|S_a|}\int_{S_a}u\,dS .
$$

第一项中的积分由定理 9 等于 $\int_{B_a}\Delta u\,dx=0$。剩下的就是球面平均值。再按上一步沿 $r$ 积分得到球内平均值。这个证明里出现的是通常的整球外法向；若误用挖孔域的内边界法向，最后连常数函数 $u=1$ 都验不过。

### 算一遍：圆心处函数值为 3，圆周上的值却有高有低

取二维函数 $u(x_1,x_2)=3+x_1^2-x_2^2$。直接求导，$\Delta u=2-2=0$，原点的函数值是 $3$。半径为 $a$ 的圆周上取 $x_1=a\cos\theta,\ x_2=a\sin\theta$，于是

$$
u=3+a^2(\cos^2\theta-\sin^2\theta)=3+a^2\cos(2\theta).
$$

在圆的右端它取 $3+a^2$，在圆的顶端取 $3-a^2$。由 $dS=a\,d\theta$，整圈的平均是

$$
\frac1{2\pi a}\int_0^{2\pi}(3+a^2\cos2\theta)a\,d\theta
=3+\frac{a^2}{2\pi}
\left[\frac{\sin2\theta}{2}\right]_0^{2\pi}=3.
$$

![沿圆周展开的两条函数值曲线分别对应半径 0.5 和 1。较大的圆上数值在 2 到 4 之间摆动，两条曲线在均值 3 上方和下方的偏差均相互抵消。](/images/notes/equations-of-mathematical-physics/laplace-fundamental-solution-and-mean-value/circle-average.png)

横轴从圆的右端出发，逆时针走一圈。增大半径会放大各方向的差异；调和性固定的是它们的平均。球内平均也可独立验算：圆盘关于交换两坐标对称，故 $\int_{B_a}x_1^2\,dx=\int_{B_a}x_2^2\,dx$，两项相消，只留下 $3|B_a|$。

## 第 32 页：上、下调和函数的平均值不等式

课件沿用 $-\Delta$ 的号数。对二阶连续可微的函数，$-\Delta u\ge0$（即 $\Delta u\le0$）称为**上调和**；$-\Delta u\le0$（即 $\Delta u\ge0$）称为**下调和**。最稳妥的判号方法是把符号代回刚推出的 $g'(a)$。

若 $\Delta u\le0$，则球内 $\Delta u$ 的积分非正，分母 $\alpha(n)a^{n-1}>0$，所以 $g'(a)\le0$。因此 $g(a)\le\lim_{r\downarrow0}g(r)=u(x_0)$。对每个半径 $r$ 都有 $g(r)\le u(x_0)$，于是按正的球壳面积加权得到

$$
\frac1{|B_a|}\int_{B_a}u\,dx
=\frac1{|B_a|}\int_0^a |S_r|g(r)\,dr
\le \frac{u(x_0)}{|B_a|}\int_0^a |S_r|\,dr
=u(x_0).
$$

若 $\Delta u\ge0$，同一导数公式给出 $g'(a)\ge0$，故 $g(r)\ge u(x_0)$；在刚才的球壳积分中乘上正权重，方向仍是 $\ge$。所以**上调和函数的中心值大于等于周围的平均值，下调和函数的中心值小于等于周围的平均值**。这些比较针对平均值，某个特定方向上的单点可以比中心高，也可以比中心低。

用 $u(x)=|x|^2$ 检查一次。因为 $\partial_{x_ix_i}u=2$，所以 $\Delta u=2n>0$，它是下调和函数。在以原点为中心的半径 $a$ 的球上，中心值、球面平均、球内平均分别为

$$
0,\qquad a^2,\qquad
\frac{\alpha(n)\int_0^a r^2 r^{n-1}\,dr}{\omega(n)a^n}
=\frac{n}{n+2}a^2.
$$

两种平均都比中心值大。改取 $u=-|x|^2$ 时，三个数一起变号，$\Delta u=-2n<0$，两种平均都比中心值小。若把 $u$ 换成常数，$\Delta u=0$，两种不等式都取等号。

### 自检：两个容易写错的地方

1. **在三维半径为 $\varepsilon$ 的球面上，$\partial_\nu\Gamma$ 到底是多少？** 先说出积分区域。对整球，$\nu=e_r$，导数为 $-1/(4\pi\varepsilon^2)$；对挖孔域的内边界，$\nu=-e_r$，导数为 $+1/(4\pi\varepsilon^2)$。乘上面积 $4\pi\varepsilon^2$，积分分别为 $-1$ 和 $+1$。
2. **球面上某一条直径的两个端点都比球心热，这与调和性矛盾吗？** 看 $3+x_1^2-x_2^2$ 在 $(a,0)$ 和 $(-a,0)$ 的值，都是 $3+a^2$；沿另一条直径的两个端点值都为 $3-a^2$。定理要求对整圈取平均，检查个别点不足以代替这个积分。

课件对应关系：式 (10) 和定义 5 在第 21—22 页，定理 6、式 (11)—(12) 及推论 7—8 在第 23—27 页，定理 9 和推论 10 在第 28 页，定理 11 与其作业在第 29—31 页，上、下调和函数的平均值不等式在第 32 页。
