---
title: 第九讲：把二级指针用起来——二叉搜索树的插入与删除
description: 从键区间和可写链接出发，逐步推导BST三类删除，给出支持完整整数边界的C程序、断言与面试追问。
date: 2026-10-04
order: 9
readingLinks: [
  { "path": "/notes/data-structures/01-pointers-and-ownership", "kind": "review", "reason": "删除根结点需要修改调用者保存的链接；若 Node ** 的含义仍不清楚，可先回顾二级指针的逐步示例。" },
  { "path": "/notes/data-structures/06-search-trees-and-hashing", "kind": "review", "reason": "回顾二叉搜索树的键区间与查找过程，区分保持有序和保持平衡这两个要求。" },
  { "path": "/notes/data-structures/13-avl-deletion", "kind": "next", "reason": "掌握普通BST删除后，再研究高度下降如何触发AVL旋转，以及为什么可能需要沿祖先链继续调整。" }
]
tags: [算法与数据结构]
readingTime: 45 分钟
aiGenerated: true
draft: false
---

## 一、这一讲补上什么

第六讲讲过BST删除原理，但没有给完整删除程序。本讲保留那里的内容，沿第一讲“指向链接的指针”写一个可独立编译的集合型BST。它不是AVL，不自动平衡；先学会维护键的区间和内存所有权，再讨论旋转，认知负担会小一些。

前置知识：一级/二级指针、结构体字段、malloc/free、中序遍历。可以先读[第八讲](/notes/data-structures/08-recursion-invariants-and-proof)的状态和不变量，再回来看代码。

## 二、从集合语义到树的不变量

我们存储互异整数键，逻辑上表示一个有限集合S。查找返回key是否属于S；插入把S变成 $S\cup\{key\}$；删除把S变成 $S\setminus\{key\}$。重复插入和删除不存在键，都不能意外改变集合中的其他元素。

存储上每个结点有key、left、right。非空结点的左子树**所有键**小于它，右子树**所有键**大于它，两棵子树也满足同样条件。这个约束保证一次比较可以排除整棵子树。

例如根8的右孩子12合法，但12的左孩子若为6，仍然非法：6虽然小于父亲12，却违反整个右子树必须大于8。检查BST不能只检查每一对父子。

本例明确不保存重复键计数，不借树结点长期对外提供稳定身份。稍后“两孩子删除复制后继键”依赖这个约定；若结点包含姓名、学号等完整记录，就必须处理整条记录的对应关系。

## 三、查找和插入：slot保存“可以改写的入口”

### 先验证“整棵子树”，再讨论怎么修改它

仅检查父亲和直接孩子是不够的：根10的左孩子5，5的右孩子12，每条直接边似乎都满足方向要求，但12落在10的左子树，违反BST定义。下面用开区间传递祖先约束，NULL表示空子树。示例键均为int，用long long上下界覆盖INT_MIN和INT_MAX；这是本程序的平台前提，并用静态断言检查。

```c
#include <assert.h>
#include <limits.h>
#include <stdbool.h>
#include <stdio.h>
_Static_assert(LLONG_MIN < INT_MIN && LLONG_MAX > INT_MAX,
               "long long must strictly contain int range");
typedef struct Node { int key; struct Node *left, *right; } Node;
static bool valid(const Node *p, long long low, long long high) {
    if (!p) return true;
    return low < p->key && p->key < high
        && valid(p->left, low, p->key)
        && valid(p->right, p->key, high);
}
int main(void) {
    Node bad = {12, NULL, NULL};
    Node left = {5, NULL, &bad};
    Node root = {10, &left, NULL};
    printf("before: %d\n", valid(&root, LLONG_MIN, LLONG_MAX));
    assert(!valid(&root, LLONG_MIN, LLONG_MAX));
    bad.key = 7;
    printf("after: %d\n", valid(&root, LLONG_MIN, LLONG_MAX));
    assert(valid(&root, LLONG_MIN, LLONG_MAX));
    return 0;
}
```

<!-- study-run:BEGIN sha256=04a5268d38ef877979dd659b47193c6a4654b4b9e3b183720f31f84e7abcf752 -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
before: 0
after: 1
```
<!-- study-run:END -->

进入根的左子树，上界从正无穷的替代边界收紧为10；再进入5的右子树，下界变成5，但上界仍是10。因此需要5<key<10，12被拒绝，7被接受。前提是输入真的是有限、无环、没有共享孩子的树；这个检查器不负责检测指针环或悬空指针。

只读查找用 `const Node *p` 即可：key小就向左，大就向右，相等成功，走空失败。

插入要修改一条原本为空的链接。它可能是调用者的root，也可能是某个left/right字段，类型都是 `Node *` 对象。因此用 `Node **slot` 保存该对象的地址，可以统一处理空树和非空树。

插入11到根8、右孩子12的树：

| 步骤 | slot指向 | `*slot` | 判断 |
| --- | --- | --- | --- |
| 初始 | root变量 | 键8结点 | 11>8，改走右入口 |
| 第二步 | 8.right字段 | 键12结点 | 11<12，改走左入口 |
| 第三步 | 12.left字段 | NULL | 正是应放11的位置 |

分配成功、字段初始化完成后，才执行 `*slot=node`。在此之前不修改旧树，所以分配失败时旧集合不变。这是一个小型“先准备、后提交”的操作顺序，不需要重建整棵树来回滚。

## 四、删除的三种形态，其实只有两段代码

### 叶子与一个孩子

先找到指向待删结点的slot。若结点只有左孩子，用左孩子接替；否则在没有左孩子的分支中用右孩子接替。叶子左右皆空，接替者自然就是NULL。

比如8的左孩子3只有右孩子6，删除3时把8.left从3改成6，再释放3。为什么整个6子树都能接上？原来其中每个键都大于3且小于8，删掉3后它们仍全部小于8，BST的全局范围没有被破坏。

### 两个孩子：把困难转移到一个更简单的位置

令目标为8，右子树根12、12的左孩子10、10的右孩子11。8的后继是右子树最小键10，不是右孩子12。先把目标结点的键8改成10，再删掉原本存10的结点。

后继为什么没有左孩子？若有，其左子树里还有更小的键，就与“右子树最小”矛盾。它可以有右孩子11，删除时需把12.left改成11，不能直接写NULL。

删除过程中的两个位置应分清：目标结点仍在原内存位置，只是键变了；最终free的是后继结点。若外部保存了目标地址，它会看到新键；若外部保存了后继地址，它会悬空。这也是不应随意让调用者长期持有内部结点指针的原因。

### 局部正确性的区间解释

设目标键为x，后继为y。原左子树所有键小于x，小于y；原右子树中除y之外的键都大于y。把x替换为y并从右子树删除原y后，左右范围仍正确，且集合恰好少了x。这个论证还需要关键字互异；重复键语义不同，应先重新规定不等号和删除数量。

## 五、完整C实现

### 先分清两种空：root为空，还是*root为空

main执行`Node *root=NULL`时，root这个变量确实存在，只是里面暂时没有结点地址。调用insert(&root,8)时，函数的Node**参数保存这个变量的位置，因此参数本身不为空，但`*参数`为空。这是合法的空树，应创建首结点。

若调用insert(NULL,8)，连“写回根地址的位置”都没有提供；函数无法知道应修改谁，所以返回BAD_ARGUMENT。把这两种情况都写成一句“root为空”会掩盖重要区别。阅读时可以把形参暂时念成“根变量的地址”，把`*root`念成“当前根结点地址”。

### slot移动与树链接改写是两个时刻

`slot=&(*slot)->left`只是让局部变量slot转向另一个字段，并没有改变那个字段保存的地址。只有执行`*slot=node`或`*slot=某个孩子`时，才真正改写树中入口。这一区别解释了为什么查找失败不会把树走坏：沿途移动的是观察入口的位置，不是拆掉走过的边。

可以类比你沿一个目录逐层找到要修改的条目：找到条目与改写条目是两件事。但最终仍应落回C对象解释，不把类比当内存模型。

### 两孩子删除：给指针变量列一张过程表

沿用键8的目标结点A，右子树根12，12.left为键10的结点B，B.right为键11的结点C。假设待删8就是整棵树的根：

| 时刻 | slot指向哪个字段/变量 | dead保存谁的地址 | 实际修改 |
| --- | --- | --- | --- |
| 找到8 | main里的root | A | 尚未修改 |
| 找到后继 | slot仍指root，successor指12.left | A | 尚未修改 |
| 复制后继键 | root | A | A.key由8变10 |
| 转移删除位置 | 12.left | B | 只更新局部slot、dead |
| 重接 | 12.left | B | 12.left改为C的地址 |
| 释放B | 12.left | B已失效，不再读取 | 原存10的结点内存被释放 |

最终A仍是根，键为10；12的左边为11；集合中8消失，10保留一份。这里“两个孩子”描述A，但最终释放的B最多有一个孩子，所以统一重接语句才成立。

### 验证器的previous、seen与count分别是什么意思

ordered做中序检查。previous保存刚刚访问的键；seen表示是否已经有“前一个键”；count累计访问数。这三个变量在check中创建，再通过地址传入递归，所以所有递归层共同更新同一份扫描状态，而不是每个子树从头计数。

初始previous虽然写0，但seen=false，所以第一次访问不与0比较；否则遇到INT_MIN会被错误判为无序。第一次访问后seen=true，以后每个新键必须严格大于previous。`++*count`等价于`++(*count)`，增加的是调用者的计数值，不是移动count指针。

destroy同样接受Node**，释放子树后将对应入口置NULL。它的名字表示销毁，不表示只移除树根：每个动态结点都要恰好释放一次。没有共享孩子和环是前提，不满足就不能安全复用这个函数。

`insert`返回枚举以区分新增、已有键、分配失败和无效输出参数；`erase`返回是否确实删除。它们通过二级指针更新调用者根。树拥有由malloc分配的所有结点，调用者不得把栈上结点或共享子树交给destroy。

辅助验证器按中序检查严格递增，使用布尔标记判断“有没有前一个键”，不拿INT_MIN当无效哨兵，因此允许INT_MIN和INT_MAX本身成为合法键。测试规模很小；验证和释放使用递归，退化大树仍有栈溢出风险。

```c
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int key;
    struct Node *left, *right;
} Node;

typedef enum { INSERTED, EXISTS, NO_MEMORY, BAD_ARGUMENT } InsertResult;

bool contains(const Node *p, int key) {
    while (p != NULL) {
        if (key == p->key) return true;
        p = key < p->key ? p->left : p->right;
    }
    return false;
}

InsertResult insert(Node **root, int key) {
    if (root == NULL) return BAD_ARGUMENT;
    Node **slot = root;
    while (*slot != NULL) {
        if (key == (*slot)->key) return EXISTS;
        slot = key < (*slot)->key ? &(*slot)->left : &(*slot)->right;
    }
    Node *node = malloc(sizeof *node);
    if (node == NULL) return NO_MEMORY;
    node->key = key;
    node->left = node->right = NULL;
    *slot = node;
    return INSERTED;
}

bool erase(Node **root, int key) {
    if (root == NULL) return false;
    Node **slot = root;
    while (*slot != NULL && (*slot)->key != key)
        slot = key < (*slot)->key ? &(*slot)->left : &(*slot)->right;
    if (*slot == NULL) return false;
    Node *dead = *slot;
    if (dead->left != NULL && dead->right != NULL) {
        Node **successor = &dead->right;
        while ((*successor)->left != NULL)
            successor = &(*successor)->left;
        dead->key = (*successor)->key;
        slot = successor;
        dead = *slot;
    }
    /* The node now has at most one child. Read it before free. */
    *slot = dead->left != NULL ? dead->left : dead->right;
    free(dead);
    return true;
}

void destroy(Node **root) {
    if (root == NULL || *root == NULL) return;
    Node *p = *root;
    destroy(&p->left);
    destroy(&p->right);
    free(p);
    *root = NULL;
}

bool ordered(const Node *p, bool *seen, int *previous, size_t *count) {
    if (p == NULL) return true;
    if (!ordered(p->left, seen, previous, count)) return false;
    if (*seen && p->key <= *previous) return false;
    *seen = true;
    *previous = p->key;
    ++*count;
    return ordered(p->right, seen, previous, count);
}

void check(const Node *root, size_t expected) {
    bool seen = false;
    int previous = 0;
    size_t count = 0;
    assert(ordered(root, &seen, &previous, &count));
    assert(count == expected);
}

int main(void) {
    Node *root = NULL;
    assert(!contains(root, 8) && !erase(&root, 8));
    assert(insert(NULL, 8) == BAD_ARGUMENT);
    const int keys[] = {8, 3, 12, 1, 6, 10, 14, 4, 7, 11, INT_MIN, INT_MAX};
    const size_t n = sizeof keys / sizeof keys[0];
    bool present[sizeof keys / sizeof keys[0]];
    for (size_t i = 0; i < n; ++i) {
        if (insert(&root, keys[i]) != INSERTED) {
            destroy(&root);
            return EXIT_FAILURE;
        }
        present[i] = true;
        check(root, i + 1);
    }
    assert(insert(&root, 8) == EXISTS);
    assert(!erase(&root, 99));
    check(root, n);
    /* Two-child root with a successor that has a right child. */
    const int removals[] = {8, 4, 1, 12, 3, 6, 7, 10, 11, 14, INT_MIN, INT_MAX};
    for (size_t i = 0; i < n; ++i) {
        assert(erase(&root, removals[i]));
        assert(!erase(&root, removals[i]));
        for (size_t j = 0; j < n; ++j) {
            if (keys[j] == removals[i]) present[j] = false;
            assert(contains(root, keys[j]) == present[j]);
        }
        check(root, n - i - 1);
    }
    assert(root == NULL);
    /* Immediate successor and final single-child root replacement. */
    const int small[] = {2, 1, 3};
    for (size_t i = 0; i < 3; ++i) {
        if (insert(&root, small[i]) != INSERTED) {
            destroy(&root);
            return EXIT_FAILURE;
        }
    }
    assert(erase(&root, 2) && root->key == 3);
    assert(erase(&root, 3) && root->key == 1);
    check(root, 1);
    destroy(&root);
    assert(root == NULL);
    destroy(&root);
    puts("BST mutation tests passed");
    return 0;
}
```

<!-- study-run:BEGIN sha256=102ff674ad978d28d1c53a6af87cc8051a46a6c266104188131c50015b855e2b -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
BST mutation tests passed
```
<!-- study-run:END -->

测试使用assert执行部分操作，所以编译教学程序时不要加`-DNDEBUG`；该选项会移除断言及其表达式。正式应用应在断言外执行操作，再检查结果。本程序检查分配失败并清理已有树，但没有故障注入测试，不能宣称实际测过每一次malloc失败。

## 六、最关键的四行代码怎样理解

两孩子分支中，`dead->key = (*successor)->key`只修改目标的数据，尚未解除后继。接着 `slot = successor`让slot指向“拥有后继的那条链接”，`dead = *slot`让dead改为真正要释放的对象。最后统一的重接语句把它的唯一孩子或NULL接上，free才安全。

如果后继就是目标的直接右孩子，successor是目标.right的地址；若后继在更深处，successor是其父亲.left的地址。统一的指针槽恰好消除了这两个分支。

不要写成先free(dead)再读取dead->right，也不要仅执行 `dead=NULL` 并以为树中的入口跟着变空。前者非法读取已释放内存，后者只改局部副本。这两种错误都可以回到第一讲的格子模型解释。

## 七、复杂度与使用边界

查找、插入、删除都沿至多常数条根到叶方向路径前进，时间O(h)，h为树高；这些实现本身迭代，辅助空间O(1)。普通BST可能退化为链，因此最坏O(n)，不能因为名字里有“二叉”就写O(log n)。

destroy和ordered访问全部结点，时间O(n)、调用栈O(h)。示例每次修改后全树验证是测试开销，不是BST操作必须做的一部分；把它放进生产接口会改变接口的总体时间。

我们的验证器假设结构本身是一棵有限树。若程序错误形成环，递归验证可能不终止；若出现共享结点，销毁会重复释放。工业级诊断可另用已访问地址集合，但那会引入额外结构，不能把简单中序断言当作万能内存检查器。

## 八、自编题与解析

**1. 删除根需要单独返回新根吗？** 本接口不需要，因为root形参指向调用者的根变量，`*slot`能直接修改它。若只收一级指针，就通常需要返回新根并让调用者接住。

**2. 后继能有两个孩子吗？** 不能有左孩子，可以有右孩子。不要把“后继最多一个孩子”误记成“后继一定是叶子”。主测试的10带右孩子11就是反例。

**3. 用前驱替代可以吗？** 可以。取左子树最大结点，它没有右孩子，可能有左孩子；对称地修改链接。证明使用的键区间也左右互换。

**4. 删除不存在的键会改变树吗？** 不会。查找阶段只移动局部slot变量，尚未写树中的任何链接；遇空立即返回false。

**5. 能直接把本删除函数用于AVL吗？** 不能保证平衡。BST有序性保住了，但子树高度可能下降，需要沿祖先路径更新高度并按删除规则再平衡。插入只修复某一局部失衡的经验也不能原样代替AVL删除分析。

**6. “键替换”是否就等于“对象替换”？** 不是。内存身份与逻辑键是两种概念。本例只暴露集合操作，因此可接受；若业务需要稳定对象身份，要设计结点移植或间接记录引用，而不是偷偷改掉别人的键。

## 后续进阶路线

完成本讲后，再推进AVL删除、B/B+树分裂合并、Bellman-Ford负环影响传播及外部归并的文件I/O实现。它们仍需要独立讲解与测试，本讲没有用“已讲过原理”冒充“已经完成全部实现”。先能自己重写这份BST删除，并逐次画出slot和dead，再扩展平衡维护会更扎实。
