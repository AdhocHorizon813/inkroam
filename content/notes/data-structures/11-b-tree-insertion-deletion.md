---
title: 第十一讲：B 树完整插删——键与孩子怎样一起移动
description: 固定四阶B树口径，逐步理解预分裂、删除前补足、借位、合并与根收缩，用C17实现并验证有序性、占用量和叶层一致。
date: 2026-10-04
order: 11
tags: [算法与数据结构]
readingTime: 60 分钟
aiGenerated: true
draft: false
---

## 本讲解决什么问题

[第六讲](/notes/data-structures/06-search-trees-and-hashing)已经介绍B树定义和小规模手推。本讲继续回答：“纸上说分裂、借一个键、合并，C里面到底改哪几个对象？”先固定一种小容量，再把所有分支走通，不同时混进B+树。

这是**四阶B树**，阶指最大孩子数4，又称2-3-4树；每个结点最多3个键。非根至少1个键，内部结点的孩子数始终比键数多1。空树root为NULL；非空根至少1个键；所有实际叶子同层。这里的“叶子”是存放键但没有孩子的结点，不是最下方的空指针。

一个结点[10,20,30]把孩子的键域分成四段：小于10、10与20之间、20与30之间、大于30。键互异，等于某个键时直接在该结点命中。这与B+树的“内部键只是导航，记录仍在叶子”不同。

第六讲的3阶例子采用插入后处理溢出；这里4阶采用**下降之前预分裂**。两种算法的时机与容量不同，不能只把代码里的3改成2，就称为3阶版本。

## 先把结点看成两个平行数组

一个内部结点有n个有效键key[0..n)，有效孩子child[0..n]。例如n=2时：

```text
孩子入口： child[0]     child[1]     child[2]
键的边界：          key[0]      key[1]
示例区间：  x < 20     20 < x < 40     x > 40
```

child[i]不是key[i]的“左孩子对象”，而是第i个区间里**整棵子树的入口**。key数组搬动后，区间边界变了，child数组也必须同步整理。B树代码难读，往往不是因为比较规则难，而是把这两组数组当成互不相关。

查找时先令i为结点中第一个不小于目标的位置：若i<n且key[i]等于目标，成功；否则叶子报告失败，内部结点下降到child[i]。当目标大于所有键时i=n，对应最右孩子，仍是合法下标。

## 插入：先给将要进入的结点留出位置

假设一个孩子已经满了，里面是[10,20,30]。若其父亲有空间，可以先把20提升到父亲，将左右拆成[10]与[30]；然后根据待插键与20的大小，选择左半或右半继续。此时还没有插入新的键，总键数不变。

内部结点分裂时，原来的四个孩子不能消失：左侧两个给[10]，右侧两个给[30]。三个键拆成1+提升1+1，四个孩子拆成2+2，各新结点仍满足孩子数＝键数+1。

若满的是根，先创建一个没有键、只有原根这一个孩子的新根，再分裂它的孩子；新根得到中位键，树高增加1。这个临时零键根只在函数执行期间存在，接口返回时必须合法。

### 插入10、20、30、40、50、60、70、80、90

| 新插入 | 关键动作 | 操作完成后的结构 |
| --- | --- | --- |
| 10、20、30 | 直接并入根 | 根[10,20,30] |
| 40 | 先分裂满根，再进入右叶 | 根[20]；叶[10]、[30,40] |
| 50 | 右叶还有空间 | 根[20]；叶[10]、[30,40,50] |
| 60 | 先分裂右叶，40上移 | 根[20,40]；叶[10]、[30]、[50,60] |
| 70 | 进入最右叶 | 根[20,40]；叶[10]、[30]、[50,60,70] |
| 80 | 分裂最右叶，60上移 | 根[20,40,60]；叶[10]、[30]、[50]、[70,80] |
| 90 | 先分裂满根，40成为新根，再下降 | 根[40]；下一层[20]、[60]；叶[10]、[30]、[50]、[70,80,90] |

下行循环的不变量是：**当前父结点不满**。因此若选中的孩子满了，父亲一定有位置接住提升键；分裂后新孩子只有1个键，也不满。无需递归返回时层层处理溢出。

## 删除：不是先挖空，再猜怎么补

### 把分裂中的键守恒单独运行一次

四阶B树一个结点最多三个键、四个孩子。预分裂把满孩子的三个键拆成左键、中键、右键：中键提升到父亲，并非在原孩子中再保留一份。本例只演示叶子的键分配；内部结点还必须同步分配孩子指针，见完整实现，不能只复制这几行便认为实现了分裂。

```c
#include <assert.h>
#include <stdio.h>
int main(void) {
    const int full[] = {10, 20, 30};
    int left = full[0], promoted = full[1], right = full[2];
    printf("left=[%d], parent receives=%d, right=[%d]\n",
           left, promoted, right);
    assert(left < promoted && promoted < right);
    assert(left == full[0] && promoted == full[1] && right == full[2]);
    puts("keys before=3; keys after=1+1+1=3");
    return 0;
}
```

<!-- study-run:BEGIN sha256=9fb8c306f3ceef0608fb6bd92b9866cd5cc7f37fb870be07d04490a445c3bbb1 -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
left=[10], parent receives=20, right=[30]
keys before=3; keys after=1+1+1=3
```
<!-- study-run:END -->

数量核对是3=1+1+1，区间核对是左<20<右。若原结点是内部结点且孩子为c0、c1、c2、c3，那么左结点继承c0/c1，右结点继承c2/c3。父结点新增一个键，孩子数量也新增一个，两种数量必须一起变化。B+树的叶子分裂可能复制分隔键，这正是不能混用两种算法的原因。

本讲用自顶向下删除：进入某个非根孩子之前，若它只有最低的1个键，就先借位或合并，让它至少有2个键，再进入。这样在叶子删除一个键以后仍至少剩1个键，不会出现非根空结点。

这是比B树最终定义更强的**操作前提**。最终允许一个非根结点只有1个键，但算法不允许带着它直接下降去删除。

### 从左兄弟借：父键下来，兄弟最大键上去

父亲[30]，左孩子[10,20]，右孩子[40]。现在要进入右孩子删除40，它只有1个键，先借：左兄弟最大键20替换父键30；原父键30放进右孩子的最前面，得到父亲[20]、左[10]、右[30,40]。再删40，右叶剩[30]。

对内部孩子，还要把左兄弟的最右子树挪到右孩子的最左侧。那棵子树所有键介于20和30之间：父亲分隔线从30降到了20，子树随边界一起转移才合法。只移动整数、不移动孩子指针，会让记录找不到或落在错误区间。

### 从右兄弟借：完全对称，但数组移动方向不同

父亲[30]，左[10]，右[40,50]。父键30追加到左孩子末尾；右兄弟最小键40替换父键；右兄弟删去首键，剩[50]。内部情形把右兄弟最左子树接到左孩子的新最右位置。

左借需要给目标结点的开头腾位置，数组从后往前搬；右借需要从兄弟开头移除一个位置，数组从前往后搬。先确定读写重叠关系，再决定for循环方向，不要把两段循环机械复制。

### 都不能借：两个最小孩子与父分隔键合并

父亲[30]、孩子[10]和[40]。两个孩子都只有1个键，没有富余。合并为[10,30,40]，父亲删除30以及一个孩子入口。1+1+1=3，刚好不超过本讲容量。

若两个孩子是内部结点，各有2个孩子，合并后需要4个孩子，仍等于3个键加1。右侧结点的链接已经转移给左侧，右侧的结点槽可回收；不能顺手递归销毁它的子树，那些子树现在属于合并后的结点。

合并可能让根没有键且只剩一个孩子，此时唯一孩子成为新根，旧根回收，树高下降。若空根原本是叶子，则整棵树变空。

### 目标恰好在内部结点怎么办

设命中key[i]，它两边的孩子为child[i]和child[i+1]：

1. 左孩子至少2个键：找左子树最大键，即前驱，用它替换命中键，再去左子树删除那份前驱。
2. 否则右孩子至少2个键：对称地使用右子树最小键，即后继。
3. 两边都只有1个键：把左孩子、命中键、右孩子合并，再进入合并后的结点删除原目标。

第一种情况下，前驱可能在更深的叶子，而不是左孩子的最后一个键；所以要沿最右孩子一直走。递归删除那份前驱时，仍执行删除前补足规则。题目若是完整记录而非整数集合，替换必须带上记录值，不能只换键导致键值错配。

代码在删除前先查找一次。如果不存在，立即false，树形也保持不变；否则一个标准的预合并过程即使最终没找到键，也可能改变形状。提前查找让本教学接口的“失败不改树”容易理解，多走一次O(log n)不改变数量级。

## 代码的内存约定：可回收结点池，不混入malloc错误处理

为把重点放在插删，本例最多保存32个不同整数，使用64个Node对象构成的固定结点池。new_node选一个未使用槽，drop_node只将一个槽回收；它们不是malloc/free。键可取任意int，测试用INT_MIN/MAX确认没有靠越界哨兵表达区间。

Tree里面的root、child指向它自身pool数组里的对象。因此**初始化后不能按值复制或移动Tree**，否则指针仍指向原对象的池；应始终通过Tree*操作。每轮测试重新创建局部Tree，旧树整个生命周期结束，不需要逐个free。

为什么64个槽足够？接口至多32个键，每个完成状态下的非空结点至少1个键，所以结点数不超过键数；插入前满根分裂最多额外暂时创建2个结点，其他分裂提升键后各结点仍非空。余量足够，不会因正常容量内操作用尽池。插入第33个不同键会在任何修改前拒绝；重复键则报告EXISTS。

这不是任意大数据的动态B树库，也不是磁盘页管理。固定上限让内存策略可解释、可验证，后续换成动态分配时必须另设计分配失败如何回滚，不能把assert替换成返回NULL就完事。

## 完整 C17 程序

建议分四次读：先contains与接口，再split_child，接着两种borrow与merge_children，最后erase_from。后半段validate是验证器，不是维护B树所必需的算法。

```c
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <limits.h>

enum { LIMIT = 32, POOL = 64, MAX_KEYS = 3 };
enum { ADDED, EXISTS, FULL };
typedef struct Node {
    bool used, leaf;
    int n, key[MAX_KEYS];
    struct Node *child[MAX_KEYS + 1];
} Node;
typedef struct { Node pool[POOL]; Node *root; size_t size; } Tree;
typedef struct { unsigned split, left, right, merge, pred, succ, shrink; } Stats;
static Stats stats;

Node *new_node(Tree *t, bool leaf) {
    for (size_t i = 0; i < POOL; ++i) {
        if (!t->pool[i].used) {
            t->pool[i] = (Node){.used = true, .leaf = leaf};
            return &t->pool[i];
        }
    }
    abort(); /* 接口容量约束正确时不可到达。 */
}
void drop_node(Node *p) { *p = (Node){0}; }
int position(const Node *p, int key) {
    int i = 0;
    while (i < p->n && p->key[i] < key) ++i;
    return i;
}
bool contains(const Tree *t, int key) {
    const Node *p = t->root;
    while (p != NULL) {
        int i = position(p, key);
        if (i < p->n && p->key[i] == key) return true;
        if (p->leaf) return false;
        p = p->child[i];
    }
    return false;
}
void split_child(Tree *t, Node *parent, int i) {
    Node *left = parent->child[i];
    assert(parent->n < MAX_KEYS && left->n == MAX_KEYS);
    Node *right = new_node(t, left->leaf);
    int middle = left->key[1];
    right->n = 1; right->key[0] = left->key[2];
    if (!left->leaf) {
        right->child[0] = left->child[2];
        right->child[1] = left->child[3];
        left->child[2] = left->child[3] = NULL;
    }
    left->n = 1;
    for (int j = parent->n; j > i; --j) parent->child[j + 1] = parent->child[j];
    parent->child[i + 1] = right;
    for (int j = parent->n; j > i; --j) parent->key[j] = parent->key[j - 1];
    parent->key[i] = middle;
    ++parent->n; ++stats.split;
}
int insert(Tree *t, int key) {
    if (contains(t, key)) return EXISTS;
    if (t->size == LIMIT) return FULL;
    if (t->root == NULL) t->root = new_node(t, true);
    if (t->root->n == MAX_KEYS) {
        Node *r = new_node(t, false);
        r->child[0] = t->root; t->root = r;
        split_child(t, r, 0);
    }
    Node *p = t->root;
    while (!p->leaf) {
        int i = position(p, key);
        if (p->child[i]->n == MAX_KEYS) {
            split_child(t, p, i);
            if (key > p->key[i]) ++i;
        }
        p = p->child[i];
    }
    int i = position(p, key);
    for (int j = p->n; j > i; --j) p->key[j] = p->key[j - 1];
    p->key[i] = key; ++p->n; ++t->size;
    return ADDED;
}
void borrow_left(Node *p, int i) {
    Node *x = p->child[i], *left = p->child[i - 1];
    assert(x->n == 1 && left->n >= 2);
    for (int j = x->n; j > 0; --j) x->key[j] = x->key[j - 1];
    if (!x->leaf) {
        for (int j = x->n + 1; j > 0; --j) x->child[j] = x->child[j - 1];
        x->child[0] = left->child[left->n];
        left->child[left->n] = NULL;
    }
    x->key[0] = p->key[i - 1];
    p->key[i - 1] = left->key[left->n - 1];
    --left->n; ++x->n; ++stats.left;
}
void borrow_right(Node *p, int i) {
    Node *x = p->child[i], *right = p->child[i + 1];
    assert(x->n == 1 && right->n >= 2);
    x->key[x->n] = p->key[i];
    if (!x->leaf) x->child[x->n + 1] = right->child[0];
    p->key[i] = right->key[0];
    for (int j = 0; j < right->n - 1; ++j) right->key[j] = right->key[j + 1];
    if (!right->leaf) {
        for (int j = 0; j < right->n; ++j) right->child[j] = right->child[j + 1];
        right->child[right->n] = NULL;
    }
    --right->n; ++x->n; ++stats.right;
}
Node *merge_children(Node *p, int i) {
    Node *left = p->child[i], *right = p->child[i + 1];
    assert(left->n == 1 && right->n == 1);
    left->key[1] = p->key[i]; left->key[2] = right->key[0];
    if (!left->leaf) {
        left->child[2] = right->child[0];
        left->child[3] = right->child[1];
    }
    left->n = MAX_KEYS;
    for (int j = i; j < p->n - 1; ++j) p->key[j] = p->key[j + 1];
    for (int j = i + 1; j < p->n; ++j) p->child[j] = p->child[j + 1];
    p->child[p->n] = NULL; --p->n;
    drop_node(right); ++stats.merge;
    return left;
}
int extreme(const Node *p, bool maximum) {
    while (!p->leaf) p = p->child[maximum ? p->n : 0];
    return p->key[maximum ? p->n - 1 : 0];
}
void erase_from(Node *p, int key) {
    int i = position(p, key);
    if (i < p->n && p->key[i] == key) {
        if (p->leaf) {
            for (int j = i; j < p->n - 1; ++j) p->key[j] = p->key[j + 1];
            --p->n;
        } else if (p->child[i]->n >= 2) {
            int pred = extreme(p->child[i], true);
            p->key[i] = pred; ++stats.pred;
            erase_from(p->child[i], pred);
        } else if (p->child[i + 1]->n >= 2) {
            int succ = extreme(p->child[i + 1], false);
            p->key[i] = succ; ++stats.succ;
            erase_from(p->child[i + 1], succ);
        } else {
            erase_from(merge_children(p, i), key);
        }
        return;
    }
    assert(!p->leaf); /* 对外接口已经确认key存在。 */
    if (p->child[i]->n == 1) {
        if (i > 0 && p->child[i - 1]->n >= 2) borrow_left(p, i);
        else if (i < p->n && p->child[i + 1]->n >= 2) borrow_right(p, i);
        else if (i < p->n) (void)merge_children(p, i);
        else { (void)merge_children(p, i - 1); --i; }
    }
    erase_from(p->child[i], key);
}
bool erase(Tree *t, int key) {
    if (!contains(t, key)) return false;
    erase_from(t->root, key); --t->size;
    if (t->root->n == 0) {
        Node *old = t->root;
        t->root = old->leaf ? NULL : old->child[0];
        drop_node(old); ++stats.shrink;
    }
    return true;
}

typedef struct {
    bool seen[POOL], have_previous;
    int previous, leaf_depth;
    size_t count;
} Check;
void check_node(const Tree *t, const Node *p, int depth, Check *c) {
    ptrdiff_t index = p - t->pool;
    assert(index >= 0 && index < POOL && p->used && !c->seen[index]);
    c->seen[index] = true;
    assert(p->n >= 1 && p->n <= MAX_KEYS);
    if (p->leaf) {
        for (int i = 0; i <= MAX_KEYS; ++i) assert(p->child[i] == NULL);
        if (c->leaf_depth == -1) c->leaf_depth = depth;
        assert(c->leaf_depth == depth);
    } else {
        for (int i = 0; i <= p->n; ++i) assert(p->child[i] != NULL);
        for (int i = p->n + 1; i <= MAX_KEYS; ++i) assert(p->child[i] == NULL);
    }
    for (int i = 0; i < p->n; ++i) {
        if (!p->leaf) check_node(t, p->child[i], depth + 1, c);
        if (c->have_previous) assert(c->previous < p->key[i]);
        c->previous = p->key[i]; c->have_previous = true; ++c->count;
    }
    if (!p->leaf) check_node(t, p->child[p->n], depth + 1, c);
}
void validate(const Tree *t) {
    Check c = {.leaf_depth = -1};
    if (t->root != NULL) check_node(t, t->root, 0, &c);
    assert(c.count == t->size && t->size <= LIMIT);
    assert((t->root == NULL) == (t->size == 0));
    for (size_t i = 0; i < POOL; ++i) assert(c.seen[i] == t->pool[i].used);
}
void check_model(const Tree *t, const bool expected[LIMIT]) {
    validate(t);
    size_t count = 0;
    for (int i = 0; i < LIMIT; ++i) {
        assert(contains(t, i - 16) == expected[i]);
        if (expected[i]) ++count;
    }
    assert(count == t->size);
}
void permutations(int a[], int begin, unsigned *cases) {
    if (begin == 6) {
        Tree t = {0};
        for (int i = 0; i < 6; ++i) { assert(insert(&t, a[i]) == ADDED); validate(&t); }
        for (int key = 0; key < 6; ++key) {
            assert(erase(&t, key)); validate(&t);
            for (int j = 0; j < 6; ++j) assert(contains(&t, j) == (j > key));
        }
        ++*cases;
        return;
    }
    for (int i = begin; i < 6; ++i) {
        int tmp = a[begin]; a[begin] = a[i]; a[i] = tmp;
        permutations(a, begin + 1, cases);
        tmp = a[begin]; a[begin] = a[i]; a[i] = tmp;
    }
}
int main(void) {
    Tree t = {0};
    assert(!erase(&t, 10)); validate(&t);
    for (int key = 0; key < LIMIT; ++key) { assert(insert(&t, key) == ADDED); validate(&t); }
    Node *old_root = t.root;
    assert(insert(&t, 100) == FULL && t.root == old_root);
    assert(insert(&t, 10) == EXISTS && t.size == LIMIT);
    for (int key = LIMIT - 1; key >= 0; --key) { assert(erase(&t, key)); validate(&t); }
    assert(insert(&t, INT_MIN) == ADDED && insert(&t, INT_MAX) == ADDED);
    validate(&t); assert(contains(&t, INT_MIN) && contains(&t, INT_MAX));
    assert(erase(&t, INT_MIN) && erase(&t, INT_MAX)); validate(&t);

    bool expected[LIMIT] = {false};
    uint32_t state = UINT32_C(20261004);
    for (unsigned step = 0; step < 20000; ++step) {
        state = state * UINT32_C(1664525) + UINT32_C(1013904223);
        unsigned index = (unsigned)((state >> 16) % LIMIT);
        int key = (int)index - 16;
        if ((state >> 31) != 0) {
            int result = insert(&t, key);
            assert(result == (expected[index] ? EXISTS : ADDED));
            expected[index] = true;
        } else {
            assert(erase(&t, key) == expected[index]);
            expected[index] = false;
        }
        check_model(&t, expected);
    }
    for (int i = 0; i < LIMIT; ++i) if (expected[i]) assert(erase(&t, i - 16));
    validate(&t);
    int a[] = {0,1,2,3,4,5}; unsigned cases = 0;
    permutations(a, 0, &cases); assert(cases == 720);
    assert(stats.split && stats.left && stats.right && stats.merge);
    assert(stats.pred && stats.succ && stats.shrink);
    puts("B-tree: 20000 model operations, 720 insertion orders and all repair branches passed");
    return 0;
}
```

<!-- study-run:BEGIN sha256=16db604b229865d003086d796b2a7424d0b1f42cb7da2a3f4a573f17460753fb -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
B-tree: 20000 model operations, 720 insertion orders and all repair branches passed
```
<!-- study-run:END -->

## 代码里最容易跳过的四处

### 为什么合并最右孩子以后要执行--i

如果目标在最右孩子child[n]，它没有右兄弟，必须与左兄弟合并。merge_children(p,n−1)把合并结果保存在原左孩子child[n−1]，并删除原最右入口。因此继续下降的位置从n变为n−1。这里不是把目标键减1，而是调整入口数组的下标。

### 为什么drop_node不递归清空孩子

合并时已将右结点的孩子入口复制到左结点对应区间，孩子对象仍活着。drop_node只回收右结点自己；它把右槽置零不会把通过该槽曾经指向的对象一同置零。指针字段与它指向的对象是两层东西，正如第一讲中修改指针不等于修改结点。

### 为什么检查有序不能只检查每个结点内部

根[20]左右孩子各自有序，不代表左子树所有键都小于20。验证器按“child[0]、key[0]、child[1]、key[1]……”的广义中序访问所有键，并要求整个输出严格递增，才同时约束各子树区间。叶层、占用量、孩子数则另行检查，任何一条不能替代其余条件。

seen数组检查一个结点是否被访问两次，最后与池中used比对，检查是否有“标记占用但根到不了”的孤立槽。指针相减只适用于同一pool内的合法指针，这个验证器检查本程序维护的树，不是用来安全解析任意损坏内存的工具。

### 为什么先测试20,000步，再测试720种排列

混合操作将树与一个独立布尔集合逐步对照，每一步验证结构及成员，不只看最后是否排好序。720种是6!种插入顺序，每种随后按升序删除，**不是所有删除顺序也穷举了**。另有容量拒绝、重复插入、空树、极值测试；分支计数确认两种借位、合并、前驱、后继与根收缩都被实际走到，但不等于完整路径覆盖或形式化证明。

测试里的伪随机种子固定，方便复现；它不是概率性正确性保证。程序没有动态malloc，因而也没有“malloc失败测试已经通过”一说。

## 复杂度与适用边界

在四阶口径下，每个结点最多3个键，一次结点内查找、分裂、借位或合并只移动常数个字段。根到叶高度O(log n)，一次查找/插入/删除都是O(log n)的树操作；递归删除调用栈O(log n)。本例预查重复或存在性只增加常数倍路径长度。

但new_node线性扫描了POOL个槽，因此若把POOL当成可增长参数，本实现还应计入每次分配O(POOL)的额外成本；不能把教学固定池代码直接宣称为任意规模最优实现。用空闲链表可把取回收槽降为O(1)，动态/磁盘版本还需另处理失败与持久化。

从这里迁移到B+树时至少有三项必须重新设计：记录是否留在叶层、父分隔键的更新语义、叶链在分裂合并后的连接。不要复制B树的“中位键上移后从孩子删除”规则到B+叶子上。本讲只完成固定四阶、整数集合的B树，不宣称B+树也已实现。

## 自编复习题

1. 为什么能在删除前把两个最小孩子合成一个满结点？本讲容量下1+父键1+1=3。换成奇数阶的最小占用口径，要重新核对是否仍有足够容量，不能直接套。
2. 从兄弟借位为什么要经过父亲？父键是两子树的区间边界，直接搬兄弟键可能跨到错误区间；内部借位还需转移一棵边界子树。
3. 为什么前驱替换之后还要删前驱的旧位置？替换只复制了值，若保留旧位置就重复，而且总数未减。
4. root变空一定意味着集合为空吗？不一定。内部空根可能还指向唯一非空孩子，要提升它；只有空叶根才意味着整树为空。

基础机制可对照[Open Data Structures：B树](https://opendatastructures.org/ods-cpp/14_2_B_Trees.html)。该资料使用的参数和修复时机不必与本例一致；上面的数值题、实现及测试为本讲自编，不是视频原题。
