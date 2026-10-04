---
title: 第十三讲：AVL删除、零平衡因子与多层修复
description: 从高度减少解释删除与插入的区别，用完整C程序实现AVL插入删除、内存释放和集合模型核对。
date: 2026-10-04
order: 13
tags: [算法与数据结构]
readingTime: 35 分钟
aiGenerated: true
draft: false
---

## 从BST删除多出来的要求

AVL首先是二叉搜索树，本讲不允许重复键。再定义空树高度0，叶高度1，结点高度为1加左右高度较大者；平衡因子BF=左高度−右高度。每个结点都必须满足|BF|≤1。不是只检查根，也不是“左右结点数差不超过1”。

删除首先按BST规则定位：无孩子直接释放；一个孩子用孩子接替；两个孩子把右子树最小键复制到当前结点，再到右子树删除那条记录。**复制键没有减少结点数，第二次递归删除才减少。** 随后沿返回路径更新高度并修复失衡。

## 为什么插入的记忆口诀不足以处理删除

假设z左高右低，BF(z)=2，左孩子y的BF有三种情况：

| BF(y) | 修复 | 不能省略的判断 |
| --- | --- | --- |
| 1 | 对z右旋 | 左左方向更高 |
| 0 | 对z右旋 | 删除特有的重要边界，不能误判为双旋 |
| -1 | 先对y左旋，再对z右旋 | 左右折线更高 |

右高时完全对称。因此判断双旋用严格小于0或大于0；等于0归单旋。单旋后的高度可能不再降低，也可能降低。为便于理解，本程序不提前停，始终返回根，最多多做沿路径的常数次高度计算。

### 把BF=0的情形算一次

树的根4，左孩子2下面有1和3，右孩子5。删除5之前左右高度2和1，根高3；删后左右2和0，根BF=2，而左孩子2的BF=0。右旋后2为根，左叶1，右子树4的左叶3。新根左右高度1和2，高度仍为3。这个例子说明“失衡修复后整棵子树一定再矮一层”是错的。

```mermaid
flowchart LR
    accTitle: 删除引发的单旋转
    accDescr: 删除5使4失衡，右旋后2成为根，3从2的右边转接到4的左边
    B["删除5后：4左高，2的BF为0"] --> R["右旋4"]
    R --> A["新根2；左1；右4且4左为3"]
```

反过来，某些修复确实使子树高度降低，于是它的父亲又可能失衡；AVL删除可以修复多个祖先，不能像某些插入实现一样第一次旋转后直接跳出所有回溯。

## 代码：先看接口，再看旋转

### 先单独核对上面那次高度计算

下面没有操作指针，只把同一示例的高度关系算出来。空树高0是约定，不能中途换成-1。先算旧根4在旋转后的高度，再算新根2，正好对应后面update的顺序。

```c
#include <assert.h>
#include <stdio.h>
static int parent_height(int l,int r) { return 1+(l>r?l:r); }
int main(void) {
    int left_subtree=parent_height(1,1);
    int before=parent_height(left_subtree,1);
    int after_delete=parent_height(left_subtree,0);
    int old_root_after_rotation=parent_height(1,0);
    int new_root=parent_height(1,old_root_after_rotation);
    printf("before=%d deleted=%d rotated=%d\n",before,after_delete,new_root);
    assert(left_subtree-0==2 && before==3 && new_root==3);
    return 0;
}
```

<!-- study-run:BEGIN sha256=dfec411c10030c2608506ee17259142736ec629435310333a70628e2e0f07c4f -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
before=3 deleted=3 rotated=3
```
<!-- study-run:END -->

insert通过bool指针报告内存不足，已有树保持原记录；重复插入不是失败。erase用bool报告是否找到，返回值始终是新的子树根，所以调用者必须接住。所有结点由本程序分配，不接受共享孩子或外部栈结点。

```c
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <limits.h>
typedef struct Node { int key, h; struct Node *l, *r; } Node;
static int height(const Node *p) { return p ? p->h : 0; }
static void update(Node *p) {
    int a = height(p->l), b = height(p->r); p->h = 1 + (a > b ? a : b);
}
static int bf(const Node *p) { return height(p->l) - height(p->r); }
static Node *right(Node *p) {
    Node *q = p->l; p->l = q->r; q->r = p;
    update(p); update(q); return q;
}
static Node *left(Node *p) {
    Node *q = p->r; p->r = q->l; q->l = p;
    update(p); update(q); return q;
}
static unsigned repairs, zero_child;
static Node *balance(Node *p) {
    if (!p) return NULL;
    update(p);
    if (bf(p) > 1) {
        ++repairs; if (bf(p->l) == 0) ++zero_child;
        if (bf(p->l) < 0) p->l = left(p->l);
        return right(p);
    }
    if (bf(p) < -1) {
        ++repairs; if (bf(p->r) == 0) ++zero_child;
        if (bf(p->r) > 0) p->r = right(p->r);
        return left(p);
    }
    return p;
}
static Node *insert(Node *p, int x, bool *ok) {
    if (!p) {
        Node *q = malloc(sizeof *q);
        if (!q) { *ok = false; return NULL; }
        *q = (Node){x, 1, NULL, NULL}; return q;
    }
    if (x < p->key) p->l = insert(p->l, x, ok);
    else if (x > p->key) p->r = insert(p->r, x, ok);
    return balance(p);
}
static Node *erase(Node *p, int x, bool *found) {
    if (!p) return NULL;
    if (x < p->key) p->l = erase(p->l, x, found);
    else if (x > p->key) p->r = erase(p->r, x, found);
    else {
        *found = true;
        if (!p->l || !p->r) {
            Node *child = p->l ? p->l : p->r; free(p); return child;
        }
        Node *q = p->r; while (q->l) q = q->l;
        p->key = q->key; p->r = erase(p->r, q->key, found);
    }
    return balance(p);
}
static void destroy(Node *p) { if (p) { destroy(p->l); destroy(p->r); free(p); } }
static int audit(const Node *p, int *out, int *n) {
    if (!p) return 0;
    int a = audit(p->l, out, n); out[(*n)++] = p->key;
    int b = audit(p->r, out, n);
    assert(a-b >= -1 && a-b <= 1 && p->h == 1+(a>b?a:b));
    return p->h;
}
static void check(const Node *p, const bool model[128]) {
    int out[128], n = 0, k = 0; audit(p, out, &n);
    for (int i = 1; i < n; ++i) assert(out[i-1] < out[i]);
    for (int i = 0; i < 128; ++i) if (model[i]) { assert(k<n && out[k]==i); ++k; }
    assert(k == n);
}
int main(void) {
    Node *root = NULL; bool ok = true, found = false;
    const int demo[] = {4,2,5,1,3};
    for (int i = 0; i < 5; ++i) root = insert(root, demo[i], &ok);
    assert(ok); root = erase(root, 5, &found);
    assert(found && root->key == 2 && zero_child > 0);
    printf("delete 5: root=%d, height=%d, right=%d\n", root->key, root->h, root->r->key);
    destroy(root); root = NULL;
    bool model[128] = {false}; uint32_t state = 9; bool multi = false;
    for (int step = 0; step < 30000; ++step) {
        state = state * UINT32_C(1664525) + UINT32_C(1013904223);
        int x = (int)((state >> 8) % 128);
        if (state & UINT32_C(0x80000000)) {
            root = insert(root, x, &ok); assert(ok); model[x] = true;
        } else {
            found = false; unsigned before = repairs;
            root = erase(root, x, &found); assert(found == model[x]); model[x] = false;
            if (repairs - before >= 2) multi = true;
        }
        check(root, model);
    }
    assert(multi); destroy(root); root = NULL;
    root = insert(root, INT_MIN, &ok); root = insert(root, INT_MAX, &ok); assert(ok);
    found = false; root = erase(root, INT_MIN, &found); assert(found);
    found = false; root = erase(root, INT_MAX, &found); assert(found && !root);
    found = false; root = erase(root, 0, &found); assert(!found && !root);
    puts("30000 model operations passed; multi-ancestor repair and zero-child case covered");
    return 0;
}
```

<!-- study-run:BEGIN sha256=9f97620e4934e179d9375e58e3b05956a45b318fef26a71d5dc63194d0b4b584 -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
delete 5: root=2, height=3, right=4
30000 model operations passed; multi-ancestor repair and zero-child case covered
```
<!-- study-run:END -->

## 逐行理解右旋的高度更新

右旋前p是旧根，q=p->l是新根候选。p->l=q->r把中间子树接到旧根左边，再用q->r=p完成提升。必须先update(p)，因为它的孩子已经确定；再update(q)，才能读到p的新高度。反着更新会把旧缓存写回新根，后续BF判断可能悄悄出错。

erase释放旧结点前保存child，释放以后只使用child，不读取p。返回一个孩子时不需要重算child的高度，因为它内部并未改变；父亲仍会在自己的回溯阶段balance。

## 证明、代价与练习

旋转保持中序序列，因此保持BST键序；局部修复使高度差回到允许范围，回溯逐层检查所有受影响祖先。AVL的最少结点数满足N(h)=1+N(h−1)+N(h−2)，基值N(0)=0、N(1)=1，增长至少为指数，因此h=O(log(n+1))。删除只走一条查找路径加后继路径，每层常数次旋转，总时间O(log(n+1))，递归辅助空间同阶。测试中的audit是O(n)，不计入删除接口本身。

练习：把示例镜像成根2、左1、右4且4下有3/5，删除1，手算新根与高度；再解释为什么双旋条件不能写成BF≤0。答案：新根4，高仍3；等于0应单旋，包含等号会选择错误的修复分支。

可交叉阅读[Cornell的AVL课程讲义](https://courses.cs.cornell.edu/cs2112/2021fa/lectures/avl/index.html)中删除后向上修复的说明。本章高度约定、数据和C实现独立给出，不能直接混用其他讲义的BF正负号。
