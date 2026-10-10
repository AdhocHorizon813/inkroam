---
title: 傅里叶变换练习：参数求导、递推与零频点
description: 从指数函数的傅里叶变换出发，严格推导有理函数族的递推公式，处理乘以 x 的变换与 λ=0 的收敛性。
date: 2026-10-10
tags: [傅里叶变换, 参数求导, 递推关系]
readingTime: 12 分钟
aiGenerated: false
aiAssisted: true
pinned: false
featured: false
draft: false
---

> [!NOTE]
> **本题的真正难点**不是积分运算，而是发现参数求导可以提高分母的幂次，并证明这一方法合法。本文保留推导过程，不把「观察前几项」当作通项证明。

## 题目与约定

设 $a>0$，$k\in\mathbb N^+$，求

$$
f_k(x,a)=\frac{1}{(a^2+x^2)^k},\qquad
g_k(x,a)=\frac{x}{(a^2+x^2)^k}
$$

的傅里叶变换。采用约定

$$
\hat f(\lambda)=\int_{-\infty}^{+\infty}f(x)e^{-i\lambda x}\,dx,
\qquad
f(x)=\frac1{2\pi}\int_{-\infty}^{+\infty}\hat f(\lambda)e^{i\lambda x}\,d\lambda.
$$

其中 $\lambda$ 是频率变量，$a$ 是正参数。

## 解题路线

下面的流程图把「已知的指数函数变换」和「本题所求的有理函数变换」连接起来。

\`\`\`mermaid
flowchart TD
    A["先求 exp(-a|x|) 的傅里叶变换"] --> B["利用傅里叶反演，得到 f₁ 的变换"]
    B --> C["对参数 a 求导：分母幂次增加 1"]
    C --> D["建立 fₖ 到 fₖ₊₁ 的递推"]
    D --> E["用数学归纳法证明任意 k 的表达式"]
    E --> F["对频率 λ 求导：得到 x·fₖ 的变换"]
    F --> G{"频率 λ 是否为 0？"}
    G -->|"否"| H["使用绝对值的分段导数"]
    G -->|"是"| I["回到积分定义，检查收敛性"]
\`\`\`

## 一、求出初始项 $\hat f_1$

先从较容易的函数 $h(x)=e^{-a|x|}$ 出发。将积分在 $x=0$ 处分开：

$$
\begin{aligned}
\hat h(\lambda)
&=\int_{-\infty}^{0}e^{(a-i\lambda)x}\,dx
+\int_0^{+\infty}e^{-(a+i\lambda)x}\,dx\\
&=\frac1{a-i\lambda}+\frac1{a+i\lambda}\\
&=\frac{2a}{a^2+\lambda^2}.
\end{aligned}
$$

由傅里叶反演公式（此处 $h,\hat h$ 均可积），

$$
e^{-a|x|}
=\frac1{2\pi}\int_{-\infty}^{+\infty}
\frac{2a}{a^2+\lambda^2}e^{i\lambda x}\,d\lambda.
$$

整理并交换哑变量名称，再利用被积函数关于积分变量的对称性：

$$
\boxed{\displaystyle
\hat f_1(\lambda,a)
=\int_{-\infty}^{+\infty}\frac{e^{-i\lambda x}}{a^2+x^2}\,dx
=\frac{\pi}{a}e^{-a|\lambda|}.}
$$

> [!TIP]
> **这里不是直接引用一个「已知积分」**：它由上一题的指数函数变换与傅里叶反演推导得到。傅里叶变换的归一化约定不同，系数也会不同。

## 二、为什么对参数 $a$ 求导？

观察原函数：

$$
f_k(x,a)=(a^2+x^2)^{-k}.
$$

目标是将分母指数 $k$ 提高到 $k+1$。对 $a$ 使用链式法则：

$$
\begin{aligned}
\frac{\partial f_k}{\partial a}
&=-k(a^2+x^2)^{-k-1}(2a)\\
&=-2ka\,f_{k+1}(x,a).
\end{aligned}
$$

所以有**原函数层面**的严格恒等式：

$$
f_{k+1}(x,a)=-\frac1{2ka}\frac{\partial f_k(x,a)}{\partial a}.
$$

在 $a>0$ 的任意紧邻域内，对 $a$ 的导数可由可积函数控制，因此允许把参数求导移入傅里叶积分。于是

$$
\boxed{\displaystyle
\hat f_{k+1}(\lambda,a)
=-\frac1{2ka}\frac{\partial\hat f_k(\lambda,a)}{\partial a}.}
$$

注意这里**对 $x$ 做傅里叶变换，对 $a$ 求导**，两种运算在上述条件下可以交换。

### 微分规则对照

| 操作 | 变换后的对应关系 | 适用提醒 |
| --- | --- | --- |
| 对参数 $a$ 求导 | $\widehat{\partial_a f}=\partial_a\hat f$ | 需要积分号下求导的条件 |
| 对空间变量 $x$ 求导 | $\widehat{\partial_x f}=i\lambda\hat f$ | 需要适当衰减、边界条件 |
| 原函数乘以 $x$ | $\widehat{xf}=i\,\partial_\lambda\hat f$ | 例如要求 $xf\in L^1$ |

## 三、任意 $k$ 的表达式：用归纳法，不靠猜测

记微分算子

$$
D=\frac1{2a}\frac{\partial}{\partial a}.
$$

则递推关系变为

$$
\hat f_{k+1}=-\frac1kD\hat f_k.
$$

**命题：** 对所有正整数 $k$，

$$
\boxed{\displaystyle
\hat f_k(\lambda,a)=
\frac{(-1)^{k-1}}{(k-1)!}
D^{k-1}\left(\frac{\pi}{a}e^{-a|\lambda|}\right).}
$$

**证明（数学归纳法）。** 当 $k=1$ 时，$D^0$ 为恒等算子，命题就是已经求出的初始项。

假设对 $k=n$ 成立，则由递推式，

$$
\begin{aligned}
\hat f_{n+1}
&=-\frac1nD\hat f_n\\
&=-\frac1nD\left[
\frac{(-1)^{n-1}}{(n-1)!}D^{n-1}\hat f_1
\right]\\
&=\frac{(-1)^n}{n!}D^n\hat f_1.
\end{aligned}
$$

故对 $n+1$ 也成立。由数学归纳法，命题得证。

> [!WARNING]
> $D^2$ 表示**算子连续作用两次**，不是简单地把系数平方：
>
> $$
> D^2u=\frac1{2a}\frac{\partial}{\partial a}
> \left(\frac1{2a}\frac{\partial u}{\partial a}\right).
> $$
>
> 因为 $1/(2a)$ 也依赖于 $a$，求导时不能忽略它。

### 用 $k=2,3$ 核验

从初始项计算：

$$
\hat f_2(\lambda,a)=
-\frac1{2a}\frac{\partial}{\partial a}
\left(\frac{\pi}{a}e^{-a|\lambda|}\right)
=\frac{\pi}{2a^3}(1+a|\lambda|)e^{-a|\lambda|}.
$$

继续递推：

$$
\hat f_3(\lambda,a)=
\frac{\pi}{8a^5}
(3+3a|\lambda|+a^2\lambda^2)e^{-a|\lambda|}.
$$

这两项只是**核验**，一般结论的证明仍然是上面的数学归纳法。

## 四、求 $\hat g_k$：频率求导

由于 $g_k=xf_k$，当 $k\ge2$ 时，$xf_k$ 绝对可积，可以在积分号下对 $\lambda$ 求导：

$$
\frac{\partial\hat f_k}{\partial\lambda}
=\int_{-\infty}^{+\infty}(-ix)f_k(x,a)e^{-i\lambda x}\,dx
=-i\hat g_k(\lambda,a).
$$

因此

$$
\hat g_k(\lambda,a)=i\frac{\partial\hat f_k(\lambda,a)}{\partial\lambda}.
$$

对于 $\lambda\ne0$，$a$ 与 $\lambda$ 的求导可交换，且

$$
\frac{d}{d\lambda}e^{-a|\lambda|}
=-a\,\operatorname{sgn}(\lambda)e^{-a|\lambda|}.
$$

代入上一节的算子表达式：

$$
\boxed{\displaystyle
\hat g_k(\lambda,a)=
\frac{i(-1)^k\pi\,\operatorname{sgn}(\lambda)}{(k-1)!}
D^{k-1}\bigl(e^{-a|\lambda|}\bigr),
\quad \lambda\ne0,\ k\ge2.}
$$

例如 $k=2$：

$$
\boxed{\displaystyle
\hat g_2(\lambda,a)=
-\frac{i\pi\lambda}{2a}e^{-a|\lambda|}.}
$$

## 五、$\lambda=0$ 为什么必须单独处理？

因为 $|\lambda|$ 在 $\lambda=0$ 处不可导，不能直接套用上一节的符号函数公式。

### 情况 A：$k\ge2$

此时

$$
g_k(x,a)=\frac{x}{(a^2+x^2)^k}
$$

是**绝对可积的奇函数**：在无穷远处，其绝对值的衰减阶为 $|x|^{-(2k-1)}$，且 $2k-1>1$。

因此可直接由定义计算：

$$
\boxed{\displaystyle
\hat g_k(0,a)=\int_{-\infty}^{+\infty}
\frac{x}{(a^2+x^2)^k}\,dx=0,\qquad k\ge2.}
$$

此外，$g_k\in L^1$ 也保证 $\hat g_k$ 连续，所以零频点的值与两侧极限一致。

### 情况 B：$k=1$

$$
g_1(x,a)=\frac{x}{a^2+x^2}.
$$

虽然它仍是奇函数，但正半轴积分

$$
\int_0^R\frac{x}{a^2+x^2}\,dx
=\frac12\log\frac{a^2+R^2}{a^2}
\longrightarrow+\infty.
$$

因此 $\lambda=0$ 时的**通常反常积分不收敛**，不能直接说其傅里叶变换等于零。

若采用**对称柯西主值**，则

$$
\operatorname{PV}\int_{-\infty}^{+\infty}
\frac{x}{a^2+x^2}\,dx
=\lim_{R\to\infty}\int_{-R}^{R}
\frac{x}{a^2+x^2}\,dx=0.
$$

而在 $\lambda\ne0$ 时，相应振荡积分按两侧反常积分收敛，其值为

$$
\hat g_1(\lambda,a)
=-i\pi\operatorname{sgn}(\lambda)e^{-a|\lambda|}.
$$

这里可以由分部积分或 Dirichlet 判别法验证收敛，再通过适当的正则化或已知变换求值；**不能**直接用 $xf_1\in L^1$ 的微分定理，因为该条件不成立。它在零点的左右极限分别为 $i\pi$ 与 $-i\pi$，不存在共同极限。

### 零频点结论表

| 函数 | $\lambda\ne0$ | $\lambda=0$ |
| --- | --- | --- |
| $f_k,\ k\ge1$ | 递推算子公式 | 同一公式可直接代入 |
| $g_k,\ k\ge2$ | 频率求导公式 | 普通积分收敛，值为 $0$ |
| $g_1$ | 条件收敛的振荡积分 | 普通积分发散；对称主值为 $0$ |

## 六、最终答题整理

令 $D=(2a)^{-1}\partial_a$，则对 $a>0$、$k\in\mathbb N^+$：

$$
\boxed{\displaystyle
\widehat{\frac1{(a^2+x^2)^k}}(\lambda)
=\frac{(-1)^{k-1}}{(k-1)!}
D^{k-1}\left(\frac{\pi}{a}e^{-a|\lambda|}\right).}
$$

对 $k\ge2$，有

$$
\boxed{\displaystyle
\widehat{\frac{x}{(a^2+x^2)^k}}(\lambda)
=\begin{cases}
\displaystyle\frac{i(-1)^k\pi\operatorname{sgn}(\lambda)}{(k-1)!}
D^{k-1}e^{-a|\lambda|},&\lambda\ne0,\\[6pt]
0,&\lambda=0.
\end{cases}}
$$

对 $k=1$，需单独注明通常积分与主值的区别。

---

## 复盘：这道题究竟用了什么？

- **傅里叶反演**：把 $e^{-a|x|}$ 的变换结果转换为 $1/(a^2+x^2)$ 的变换。
- **参数求导**：利用 $\partial_a(a^2+x^2)^{-k}=-2ka(a^2+x^2)^{-k-1}$ 建立递推。
- **数学归纳法**：从初始项和递推关系严格证明任意 $k$ 的算子表达式。
- **频率求导**：由 $\partial_\lambda e^{-i\lambda x}=-ix e^{-i\lambda x}$ 处理分子中的 $x$。
- **收敛性与奇偶性**：在 $\lambda=0$ 时区分普通反常积分和柯西主值。

> **记住：** 观察规律是发现方法；递推关系加数学归纳法，才是证明。 
