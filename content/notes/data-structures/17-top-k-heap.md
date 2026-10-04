---
title: 第十七讲：用大小为k的小根堆求最大的k个数
description: 明确重复值与输出顺序语义，从归纳不变量实现top-k，并用完整排序作独立对照。
date: 2026-10-04
order: 17
tags: [算法与数据结构]
readingTime: 25 分钟
aiGenerated: true
draft: false
---

## 先确定“k个”是什么意思

输入是长度n的整数序列，重复出现的值按多重集合计数。例如[5,5,1]最大的两个数是[5,5]，不是[5,1]。本章要求结果最终升序排列，k=0返回空结果，k>n拒绝。若题目要求不同的k个值，必须另加去重；若要返回原始下标，堆元素应保存值与下标以及同值的选择规则。

## 为什么保留最大值却用小根堆

堆里是已经选中的k个候选，最容易被新元素淘汰的是其中最小的一个，因此让它在根。处理前t个输入后，不变量是：当t≥k时，堆包含这t个数中最大的k个值（计重数）。新值x不大于根，可以舍弃；否则用x替根，向下恢复堆序。相等时不替换仍保持数值多重集合正确，不代表固定选择了哪一个原始位置。

手推k=3、输入4,1,7,2,9：前三个形成候选{1,4,7}；2替换1得到{2,4,7}；9替换2得到{4,7,9}。花括号表示候选集合，不是堆数组的实际顺序。

```mermaid
flowchart LR
    accTitle: top-k候选集合更新
    accDescr: 三个候选中最小的1被2替换，然后最小的2被9替换
    A["候选1、4、7；门槛1"] -->|"读到2"| B["候选2、4、7；门槛2"]
    B -->|"读到9"| C["候选4、7、9；门槛4"]
```

## 完整实现与独立排序对照

### 先用慢方法打印候选变化

每来一个元素扫描k个候选找最小位置，是O(nk)的基线；结果语义与堆版相同。候选数组不要求有序，打印它能防止把“最大的k个值”和“已经排好序”混为一谈。

```c
#include <assert.h>
#include <stdio.h>
int main(void) {
    int candidate[]={4,1,7}; const int next[]={2,9};
    for(int i=0;i<2;++i) {
        int smallest=0;
        for(int j=1;j<3;++j) if(candidate[j]<candidate[smallest]) smallest=j;
        if(next[i]>candidate[smallest]) candidate[smallest]=next[i];
        printf("read %d: candidates=%d,%d,%d\n",next[i],candidate[0],candidate[1],candidate[2]);
    }
    assert(candidate[0]==4 && candidate[1]==9 && candidate[2]==7);
    return 0;
}
```

<!-- study-run:BEGIN sha256=51c2d13a3be9361c94a0a82dce6ee99db4f01d4bd9ed92d460dd5c4a9e05325f -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
read 2: candidates=4,2,7
read 9: candidates=4,9,7
```
<!-- study-run:END -->

为突出算法，接口规定n≤64，输出缓冲至少k个int，且输入和输出不重叠。程序没有动态分配，也不拿减法当比较器：INT_MIN−INT_MAX会溢出。

```c
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <limits.h>
static void down(int *h,size_t n,size_t i) {
    for(;;) {
        size_t child=2*i+1; if(child>=n) return;
        if(child+1<n && h[child+1]<h[child]) ++child;
        if(h[i]<=h[child]) return;
        int x=h[i]; h[i]=h[child]; h[child]=x; i=child;
    }
}
static bool topk(const int *a,size_t n,size_t k,int *out) {
    if(n>64 || k>n || (n && !a) || (k && !out)) return false;
    if(!k) return true;
    int heap[64]; for(size_t i=0;i<k;++i) heap[i]=a[i];
    for(size_t i=k/2;i>0;--i) down(heap,k,i-1);
    for(size_t i=k;i<n;++i) if(a[i]>heap[0]) { heap[0]=a[i]; down(heap,k,0); }
    size_t used=k;
    for(size_t i=0;i<k;++i) {
        out[i]=heap[0]; heap[0]=heap[--used]; if(used) down(heap,used,0);
    }
    return true;
}
static int compare(const void *a,const void *b) {
    int x=*(const int *)a,y=*(const int *)b; return (x>y)-(x<y);
}
static void verify(const int *a,size_t n) {
    int sorted[64],out[64]; for(size_t i=0;i<n;++i) sorted[i]=a[i];
    qsort(sorted,n,sizeof *sorted,compare);
    for(size_t k=0;k<=n;++k) {
        assert(topk(a,n,k,out));
        for(size_t j=0;j<k;++j) assert(out[j]==sorted[n-k+j]);
    }
    assert(!topk(a,n,n+1,out));
}
int main(void) {
    const int demo[]={4,1,7,2,9}; int out[64]; assert(topk(demo,5,3,out));
    printf("top 3 ascending: %d %d %d\n",out[0],out[1],out[2]);
    unsigned cases=0,power=1; int a[64];
    for(size_t n=0;n<=6;++n) {
        for(unsigned v=0;v<power;++v) {
            unsigned x=v; for(size_t i=0;i<n;++i) { a[i]=(int)(x%3)-1; x/=3; }
            verify(a,n); ++cases;
        }
        power*=3;
    }
    const int extremes[]={INT_MIN,INT_MAX,INT_MAX,0}; verify(extremes,4);
    assert(topk(NULL,0,0,NULL));
    assert(!topk(NULL,1,1,out) && !topk(demo,5,1,NULL));
    printf("%u arrays, all legal k, duplicates and extreme keys passed\n",cases);
    return 0;
}
```

<!-- study-run:BEGIN sha256=98b843e608dc09e11845d3da8af847bdc0862799baaf5ef60af2b50a679df819 -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
top 3 ascending: 4 7 9
1093 arrays, all legal k, duplicates and extreme keys passed
```
<!-- study-run:END -->

## 证明与精确成本

初始化k个候选可以任意成堆，候选集合正确；堆化不改变成员。归纳步：新x≤最小候选时，已经有k个值≥x，不必收下；x>最小候选时，丢掉最小值、保留x恰好得到新的最大k个。结束后反复取小根，才获得要求的升序结果。

初始自底向上建堆O(k)，扫描O((n−k)log k)，升序输出O(k log k)。统一写成O(n log(k+1))可覆盖k=1；k=0提前返回。逻辑辅助空间O(k)，当前固定数组实际预留64个int。若只需候选、不要求排序，可以省掉最后输出阶段，但不能把堆数组说成已排序数组。

第十讲的“先问输出要什么”在这里落实：需要全部有序时排序合适；k很小时候选堆节省工作；流式输入时保留k个候选即可，不必保存已经处理的全部数据。
