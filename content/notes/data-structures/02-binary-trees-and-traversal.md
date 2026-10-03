---
title: 第二讲：二叉树的性质、四种遍历与递归转栈
description: 推导结点计数公式、完全二叉树编号，手推遍历过程，并用完整 C 程序实现递归、非递归和层序遍历。
date: 2026-10-03
order: 2
tags: [算法与数据结构]
readingTime: 40 分钟
aiGenerated: true
draft: false
---

## 二叉树不是“度为 2 的普通树”

### 先定义一般的有根树

**树**是具有层次关系的结构：非空树有唯一的根，其余结点分成若干互不相交的子树。**结点**是保存数据和关系的单位；**边**连接父结点与孩子。除根外每个结点恰有一个父亲，不允许环，也不允许两个父亲共享同一个孩子。森林是若干互不相交树的集合，可以为空。

| 概念 | 精确定义 | 例子与边界 |
| --- | --- | --- |
| 根 | 没有父亲的结点 | 非空有根树唯一 |
| 父亲/双亲与孩子 | 一条向下的边两端的直接上下级 | 祖父不是直接父亲 |
| 兄弟 | 具有相同父亲的结点 | 不要求相邻绘制 |
| 祖先/后代 | 沿父链向上/孩子链向下可到达的严格上下级 | 本文不把自己算进祖先或后代 |
| 子树 | 某结点连同其全部后代及相关边 | 不可任意删掉它的一部分孩子再称原树对应子树 |
| 结点的度 | 孩子数 | 不是无向图中邻接边数 |
| 树的度 | 全部结点度的最大值 | 单结点树为 0 |
| 叶子/终端结点 | 度为 0 的结点 | 根也可能是叶子 |
| 内部/非终端结点 | 至少一个孩子的结点 | 不等于“非根结点” |

**路径**是一串按相邻边连接的结点；路径长度按边数计。有根树中根到某结点的路径唯一。本文**深度**取根到结点的边数，根深度 0；**层次**为深度加一，根第 1 层；**子树高度**为从其根向下的最长路径边数加一。于是树高是最大层数，叶子子树高 1。教材若把高度也按边数计，要整体换算，不能只改一个公式。

**有序树**规定同一父亲的孩子顺序；二叉树进一步规定左右两个位置。交换左右子树通常得到另一棵二叉树，即使交换前后所有结点的度都没变。

二叉树允许空树；每个结点有至多两个孩子，且左右位置有区别。只有左孩子与只有右孩子是两种不同形态。一般树的“度为 2”意味着至少存在一个度为 2 的结点，二叉树却可以只有一条单链，最大度为 1，甚至为空。

本文根在第 1 层，高度按层数算。空树高 0，叶子高 1。若教材采用按边计高，非空树高度会相差 1，公式必须整体调整。

## 结点数公式从哪里来

### 慢读：公式是在把同一批边数两遍

数学专业可以先抓住“双计数”，不用单独死记叶子公式。设非空二叉树有5个叶子、3个单孩子结点、4个双孩子结点。总数是12；按“每个非根结点有一条父边”数，边有11条；按“每个父结点发出多少条孩子边”数，边有 $0\times5+1\times3+2\times4=11$ 条。两个式子消去总数，就剩叶子比双孩子结点多1。

为什么单孩子项被消掉？在任意边中间插一个单孩子结点，相当于把一条边拆成两条，总结点和总边都加1，分叉结构不变，叶子数也不变。这是公式消元在图上的含义。

反过来，知道 $n_0=n_2+1$ 不能唯一还原树。例如三个结点可排成链，也可为根加两个孩子；结点总数相同而两类计数不同。即使固定所有度数，左右位置仍可能变化。计数公式是必要性质，不是完整结构编码。

### 一般树的边数统计

非空树每个非根结点恰有一个父亲，所以边数为 $n-1$；另一方面，一条边恰好算在父结点的度中一次。于是：

$$
\sum_{v\in V}\deg(v)=n-1.
$$

这里的度是孩子数，不是无向图的邻接边数。设度为 $i$ 的结点有 $n_i$ 个：

$$
\sum_i n_i=n,\qquad\sum_i i n_i=n-1,
\qquad n_0=1+\sum_{i\ge2}(i-1)n_i.
$$

度为 1 的结点不出现在最后一式中。沿边插入一个单孩子结点，会增加高度和总数，却不改变叶子数。

例：度为 4、3、2、1 的结点分别有 20、10、1、10 个，则叶子为 $1+3\times20+2\times10+1=82$。不必先求总数，也不要把度为 1 的 10 个结点加进去。

### 二叉树的核心恒等式

非空二叉树只有 $n_0,n_1,n_2$：

$$
n=n_0+n_1+n_2,\quad n-1=n_1+2n_2
\quad\Longrightarrow\quad n_0=n_2+1.
$$

它对任意非空二叉树成立，不要求满、完全或平衡。空树不能直接套用，因为 $0\ne0+1$。

### 层数与高度

第 $i$ 层至多 $2^{i-1}$ 个结点。高度为 $h$ 的非空二叉树满足：

$$
h\le n\le 2^h-1.
$$

左端由链取得，右端由每层填满取得。给定 $n\ge1$，最小高度为 $\lceil\log_2(n+1)\rceil$，最大高度为 $n$。

## 满、完全、严格二叉树别混用

本系列采用常见中文考试口径：**满二叉树**每层填满，$n=2^h-1$；**完全二叉树**除末层外都满，末层从左到右连续填入。“每个非叶结点都有两个孩子”另称严格/正则二叉树，不保证每层满。英文 full binary tree 常指后者，perfect binary tree 才对应每层填满，阅读英文材料要留心。

完全二叉树层序按 1 开始编号，结点 i 的父亲为 $\lfloor i/2\rfloor$，左、右孩子分别为 $2i,2i+1$，但必须判断是否超过 n。最后一个非叶结点为 $\lfloor n/2\rfloor$，叶子数为 $\lceil n/2\rceil$。高度为 $\lfloor\log_2 n\rfloor+1$。

0 基数组改为父亲 $(i-1)/2$（i>0）、孩子 $2i+1,2i+2$。这些编号关系用于**完全树的连续存储**；普通稀疏树也能按位置留空存储，但可能极浪费空间，不能把紧凑无空位数组直接套任意树。

## 用同一棵树看四种遍历

**遍历**是在规定规则下访问每个结点且恰好一次；访问可以是输出、计数或更新结果。**递归**是函数通过调用自身解决更小的同类问题；必须有终止情形。**栈**是后进先出结构，适合保存待返回的祖先；**队列**是先进先出结构，适合保存按层发现的待访问结点。递归调用栈是运行时机制，程序中的显式栈是用数据结构模拟这种待处理关系。

```text
        A
       / \
      B   C
     / \   \
    D   E   F
```

| 遍历 | 访问顺序规则 | 输出 |
| --- | --- | --- |
| 前序 | 根、左、右 | A B D E C F |
| 中序 | 左、根、右 | D B E A C F |
| 后序 | 左、右、根 | D E B F C A |
| 层序 | 按层从左到右 | A B C D E F |

“访问”是输出、计数或处理数据，不是指第一次遇到指针。递归函数对一个结点可经历进入、左返回、右返回三个时刻；把处理动作分别放在这三个位置，就得到前、中、后序。

## 完整 C 程序：递归、显式栈与队列

### 先认清这段程序里的对象

这里的Node和第一讲的链表结点不是同一个类型定义：data仍保存数据，但next换成left、right两个孩子地址。`const Node *t`表示函数通过t只读取当前结点；`t->left`是左孩子的地址，并不是左孩子的数据。若要读左孩子的数据，必须先确认左孩子存在，再访问`t->left->data`。

Output是另一种结构体，用来保存已经访问的字符序列。它包含字符数组text和已写字符数n。`Output *out`让函数能修改调用者的输出缓冲；树用只读指针、输出用可写指针，是因为二者承担不同任务，不是因为结构体名字不同。

比如输出为空时n=0。`emit(out, 'A')`把A写入text[0]，然后把n改为1，再在text[1]写字符串结束标记`'\0'`。这个标记不是字符`'0'`，也不是空指针NULL：它是值为零的字符，用来告诉字符串函数文本到哪里结束。数组多留一个位置，就是为它准备的。

### 数组怎样临时充当栈

`const Node *stack[CAP]`表示一个数组，每个元素保存一个结点地址。它不复制结点，也不拥有这些结点；原树仍在原位置。top表示数组前面已有多少个有效地址，所以有效区间是`[0,top)`。

| 动作 | 拆开后的含义 | 例子 |
| --- | --- | --- |
| `stack[top++] = t` | 先在原top位置写t，再把top加1 | top为0时写stack[0]，然后top为1 |
| `p = stack[--top]` | 先把top减1，再取该位置 | top为3时减到2，取stack[2] |
| `stack[top - 1]` | 只查看栈顶，不删除 | top为3时看stack[2]，top仍为3 |

为什么弹出要先减？因为top指的是下一个空位，而不是最后一个有效元素。top=0时不能弹出；top=CAP时不能再压入。程序中的条件检查是在保护数组访问，不是可有可无的冗余代码。

前序先压右孩子、再压左孩子，所以左孩子位于栈顶，会先弹出。假设先处理A，栈先变成[C]，再变成[C,B]；下一次弹的是B。栈里排列的先后和最终访问顺序不相同，原因就是后进先出。

### 返回true究竟表示什么

本程序的bool返回值表示“是否顺利完成”，不是“有没有结点”。遍历空树没有数据需要输出，但任务合法完成，所以返回true。输出容量不足才返回false。把空树返回false，会让调用者误判成执行失败。

`if (!recursive(...)) return false`读成：先让子树完成任务，若返回失败，立即把失败传回上层。最后的`order != 2 || emit(...)`利用逻辑或的短路：不是后序时左边已为真，不执行emit；是后序时才调用emit并返回其结果。初读时可以在纸上展开为“若为后序就输出根，否则成功返回”，不要让紧凑语法挡住遍历顺序。

### 队列与栈只差两行吗

队列用head指向下一个待取位置，tail指向下一个可写位置，有效等待区间为`[head,tail)`。`q[tail++]=孩子`加到末尾，`q[head++]`从前端取出。这与每次从末端取的栈不同，决定了它能先处理同层的老任务，再处理下一层的新任务。

本例没有循环利用已经出队的数组前端，因此tail累计增加，容量限制对应整棵树的结点数。别把这段教学队列误当成已经实现了循环队列。

下例固定最大 64 个结点，所有输出缓冲区也以此为界。使用栈上结点拼测试树，不调用 free；换成 malloc 构建时才需要所有权释放。所有函数均只借用树，不修改链接。

输入为根指针与初始为空的 Output，输出序列存入 `out.text`，容量不足返回 false，可能保留已输出的前缀。`top` 是栈内元素个数，队列的 `[head,tail)` 是尚未处理区域，`last` 是后序中最近完成的结点。对样例，中序栈先压 A、B、D，D 的左边为空，第一次弹出并输出 D；然后输出 B，转向 E，这对应正文的 `DBEACF`。

```c
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>

enum { CAP = 64 };
typedef struct Node {
    char data;
    struct Node *left, *right;
} Node;
typedef struct { char text[CAP + 1]; size_t n; } Output;

bool emit(Output *out, char value) {
    if (out->n == CAP) return false;
    out->text[out->n++] = value;
    out->text[out->n] = '\0';
    return true;
}

/* order: 0 前序，1 中序，2 后序；调用者保证取值有效。 */
bool recursive(const Node *t, int order, Output *out) {
    if (t == NULL) return true;
    if (order == 0 && !emit(out, t->data)) return false;
    if (!recursive(t->left, order, out)) return false;
    if (order == 1 && !emit(out, t->data)) return false;
    if (!recursive(t->right, order, out)) return false;
    return order != 2 || emit(out, t->data);
}

bool preorder(const Node *t, Output *out) {
    const Node *stack[CAP]; size_t top = 0;
    if (t != NULL) stack[top++] = t;
    while (top != 0) {
        const Node *p = stack[--top];
        if (!emit(out, p->data)) return false;
        if (p->right != NULL) {
            if (top == CAP) return false;
            stack[top++] = p->right;
        }
        if (p->left != NULL) {
            if (top == CAP) return false;
            stack[top++] = p->left;
        }
    }
    return true;
}

bool inorder(const Node *p, Output *out) {
    const Node *stack[CAP]; size_t top = 0;
    while (p != NULL || top != 0) {
        while (p != NULL) {
            if (top == CAP) return false;
            stack[top++] = p;
            p = p->left;
        }
        p = stack[--top];
        if (!emit(out, p->data)) return false;
        p = p->right;
    }
    return true;
}

bool postorder(const Node *p, Output *out) {
    const Node *stack[CAP], *last = NULL; size_t top = 0;
    while (p != NULL || top != 0) {
        if (p != NULL) {
            if (top == CAP) return false;
            stack[top++] = p;
            p = p->left;
        } else {
            const Node *peek = stack[top - 1];
            if (peek->right != NULL && last != peek->right) {
                p = peek->right;
            } else {
                if (!emit(out, peek->data)) return false;
                last = peek;
                --top;
            }
        }
    }
    return true;
}

bool levelorder(const Node *t, Output *out) {
    const Node *queue[CAP]; size_t head = 0, tail = 0;
    if (t != NULL) queue[tail++] = t;
    while (head < tail) {
        const Node *p = queue[head++];
        if (!emit(out, p->data)) return false;
        if (p->left != NULL) {
            if (tail == CAP) return false;
            queue[tail++] = p->left;
        }
        if (p->right != NULL) {
            if (tail == CAP) return false;
            queue[tail++] = p->right;
        }
    }
    return true;
}

size_t height(const Node *t) {
    if (t == NULL) return 0;
    size_t l = height(t->left), r = height(t->right);
    return 1 + (l > r ? l : r);
}

int main(void) {
    Node d = {'D', NULL, NULL}, e = {'E', NULL, NULL};
    Node f = {'F', NULL, NULL}, b = {'B', &d, &e};
    Node c = {'C', NULL, &f}, a = {'A', &b, &c};
    const char *expected[] = {"ABDECF", "DBEACF", "DEBFCA"};
    for (int order = 0; order < 3; ++order) {
        Output out = {{0}, 0};
        assert(recursive(&a, order, &out));
        assert(strcmp(out.text, expected[order]) == 0);
    }
    Output pre = {{0}, 0}, in = {{0}, 0}, post = {{0}, 0}, level = {{0}, 0};
    assert(preorder(&a, &pre) && strcmp(pre.text, expected[0]) == 0);
    assert(inorder(&a, &in) && strcmp(in.text, expected[1]) == 0);
    assert(postorder(&a, &post) && strcmp(post.text, expected[2]) == 0);
    assert(levelorder(&a, &level) && strcmp(level.text, "ABCDEF") == 0);
    assert(height(&a) == 3 && height(NULL) == 0);
    Output empty = {{0}, 0};
    assert(postorder(NULL, &empty) && empty.n == 0);
    puts("tree traversal tests passed");
    return 0;
}
```

## 非递归代码背后的状态

### 把递归当作“留下一张未完成的便条”

对样例树做中序，进入A时暂不输出A，而是记住“B处理完后回来输出A，再处理C”。进入B时又记住“D处理完后回来输出B，再处理E”。这些未完成事项按后进先出保存，正好是栈。函数返回不是从整段程序重新开始，而是回到上一次暂停的位置。

下面的栈从左到右为栈底到栈顶；输出只在弹出时发生：

| 步骤 | p或动作 | 栈 | 已输出 |
| --- | --- | --- | --- |
| 沿左路下降 | 依次压A、B、D，最后p为空 | A B D | 空 |
| 弹D | D无右孩子 | A B | D |
| 弹B | 转向B的右孩子E | A | D B |
| 压E再弹E | E左右都空 | A | D B E |
| 弹A | 转向C | 空 | D B E A |
| 处理C及其右孩子F | C先于F输出 | 空 | D B E A C F |

后序为什么多一个last？中序弹根时只需确认左边结束；后序还要知道右边是否结束。`last`记录刚完成的子树根，而不是“刚碰到的结点”。样例在B的左边D结束后，必须先去E；E作为B的右子树根完成后，B才允许弹出。后序中右子树根最后输出，所以这一判断能代表整棵右子树已完成。

### 高度函数和结构归纳是一回事

空树返回0是基例。假设两个更小子树的高度已正确求出，从当前根到最深叶子的路必须先进入其中一侧，于是取两者最大值再加当前这一层。这里的“假设正确”是对子问题使用归纳假设，不是凭信心省略证明。终止理由是沿真实孩子递归时结点数严格下降；含环的结构不满足这个前提。

前序栈必须先压右再压左，因为后进先出。中序栈保存“左子树尚未处理完、自己还没访问”的祖先，左路走空后，栈顶就是下一个可访问结点。

后序的难点是：左子树结束后不能立即输出根，还要判断右子树是否处理过。`last` 保存最近完成的结点。当 `last == peek->right` 时，说明右子树根刚输出，整棵右子树已完成。若没有 last 或状态位，可能反复进入右子树。

层序队列维持“已发现但尚未处理”的结点。按左、右顺序入队，就得到同层从左到右的顺序。示例队列不循环复用槽位，使用容量是累计结点数；抽象 BFS 的活动队列占用则与最大宽度同阶。

## 复杂度必须区分高度与宽度

每结点只处理常数次，四种遍历时间均为 $O(n)$。递归与常见深度优先栈的空间为 $O(h)$，退化树可达 $O(n)$，不能统一写 $O(\log n)$。层序活动队列空间为 $O(w)$，w 是最大层宽，最坏为 $O(n)$。

若把完整输出序列也保存，输出本身额外需要 $O(n)$。上面固定数组实际预留 CAP 大小，这是教学实现细节，不要把“CAP 固定”当作所有输入下算法只需常数空间。

## 综合题：选择哪种遍历

**求高度**：后序，先拿到左右高度再算 `1 + max`。**释放树**：后序，子树释放后才能释放父结点。**复制树**：先创建当前结点，再递归复制孩子，同时处理部分失败回滚。**表达式求值**：后序，操作数先于操作符就绪。**逐层最大值**：层序，每轮固定当前队列层长。

判断完全二叉树可层序扫描：首次遇到缺失孩子后，后续不允许再出现非空孩子；如果右孩子存在而左孩子为空，立即失败。不能只检查每个结点“没有右独子”，因为末层还可能出现全局空洞。

求最近公共祖先的递归：当前为空或等于目标就返回；左右均找到则当前为祖先；否则返回非空结果。但这个常见模板默认两个目标确实存在，若一个不存在却要求报失败，需要额外记录两个目标是否被找到。

## 自编练习

**1. 叶子 12、单孩子结点 7，共多少结点？** $n_2=11$，总数 $12+7+11=30$。

**2. 完全二叉树有 100 个结点，高度与叶子数？** 高度 7，叶子 50；最后一个非叶结点编号 50，只有左孩子 100。

**3. 前序与中序相同且关键字互异，树是什么形态？** 每个根在中序中都排在其子树最前，所有左子树为空，因此是右链。中序与后序相同则是左链。

**4. 前序遍历是否天然适合删除树？** 直接 free 根后再访问根的孩子会非法访问。可以预存孩子地址再释放，但规范而自然的做法是后序释放；关键是指针读取发生在对象生命周期内。

**5. 遍历题答案为什么可能不唯一？** 二叉树的左右已确定时序列唯一；一般图 DFS/BFS 若没有规定邻接访问顺序，序列可能多个。不要把图的邻接顺序不确定性带到给定二叉树里。
