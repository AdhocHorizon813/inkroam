---
title: 第十四讲：堆式置换选择、任意路败者树与真实文件归并
description: 把外排序从数组模拟推进到临时文件流，实现可配置内存堆、非二次幂路数归并、缓冲I/O与失败清理。
date: 2026-10-04
order: 14
tags: [算法与数据结构]
readingTime: 55 分钟
aiGenerated: true
draft: false
---

## 先区分三个层次

第七讲已有三槽扫描式置换选择与四路败者树。本章不是重复那两段，而是把选择结构改为堆，让路数可配置，并且真的通过C标准文件接口读写临时文件。

**顺串（初始归并段）**是文件中已经按非降序排列的一段记录；**置换选择**用M个候选不断输出当前段的最小记录，新读入且小于刚输出值的记录冻结到下一段；**k路归并**同时保留k个有序输入流的首记录，每次输出最小的那一个，然后只更新这一路。

本章记录只有一个int，重复值保留。二进制文件只用于同一程序、同一平台的临时交换，不是跨平台存储格式。程序用tmpfile创建临时文件，关闭即删除，不修改用户文件。没有声称实现数据库、崩溃恢复或异步磁盘引擎。

## 用“段号、值”二元组解除冻结

堆按(段号,值)字典序比较：段号小的先输出，同段中值小的先输出。新记录x≥刚输出值，段号等于当前段；否则等于当前段+1。当前段全部输出后，堆顶自然变为下一段，**无需扫描整个堆解冻**。

M=3，输入5,1,4,2,3,0：先装5/1/4，输出1后读2，仍属本段；输出2后读3，仍属本段；输出3后读0，因为0<3，标成下一段。第一段剩4/5，输出完才轮到0。两段分别1,2,3,4,5和0。逆序输入时段可能只有M长，“平均约2M”依赖输入分布，不是保证。

```mermaid
flowchart LR
    accTitle: 外排序文件流水线
    accDescr: 顺序输入进入M记录堆，形成多个临时有序段，多轮有限路数归并形成结果
    I["输入文件：逐条读取"] --> H["M记录堆：段号、值"]
    H --> R["临时顺串文件"]
    R --> K["最多k路：首记录与败者树"]
    K --> O["更长顺串；必要时再一轮"]
```

## 非二次幂路数怎么比赛

### 段号为何比数值更优先

先不用堆，只比较三个候选(0,4)、(1,0)、(0,5)。第一分量为段号。冻结的0虽然最小，却不能抢在本段的4和5之前；下例输出完整优先级，之后的堆只是把这种比较加速。

```c
#include <assert.h>
#include <stdio.h>
int main(void) {
    int generation[]={0,1,0},value[]={4,0,5};
    int used[3]={0},order[3];
    for(int step=0;step<3;++step) {
        int best=-1;
        for(int i=0;i<3;++i) if(!used[i])
            if(best<0 || generation[i]<generation[best]
               || (generation[i]==generation[best] && value[i]<value[best])) best=i;
        order[step]=best; used[best]=1;
        printf("run=%d value=%d\n",generation[best],value[best]);
    }
    assert(order[0]==0 && order[1]==2 && order[2]==1);
    return 0;
}
```

<!-- study-run:BEGIN sha256=81a299796b8bdfb937115842352242ea3d32e41690fd0269d8a2ea249fdc7002 -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
run=0 value=4
run=0 value=5
run=1 value=0
```
<!-- study-run:END -->

例如k=5，将叶槽数补到P=8。第5、6、7号选手是永久耗尽的虚拟路；耗尽状态由布尔值表示，不用INT_MAX冒充无穷，因为INT_MAX本身可能是合法输入。

初始化时用一棵临时胜者数组自底向上比赛，每个内部结点记下败者，最终得到总冠军。输出冠军后只有冠军那一路的新首记录改变，所以它沿原路径与保存的败者逐层重赛：若挑战者输，交换身份，赢家继续往上。这才是**败者回放**，不是每次重新扫描k个头，也不是保留整棵胜者树每轮重算。

相等时较小路号胜出，保证确定性；本程序没有附加原始位置的记录，故不额外承诺整个外排序对业务同键记录稳定。单路k=1时P=1，无内部比赛；零路输出空文件。多轮归并的fan-in必须至少2，否则段数不能下降。

## 代码前先看资源协议

- runs生成函数拥有新建的顺串；失败时全部关闭，返回空集合；输入文件仍归调用者。
- merge_group只借用输入，返回新建输出；失败时关闭自己的输出，不擅自关闭借入输入。
- sort_files接收已生成顺串的所有权，逐组归并并关闭消费过的旧文件；失败时清理当轮所有中间文件。
- 所有读、写、定位、刷新及关闭都检查返回值。故障注入模拟读取/写入失败，真实tmpfile失败也会走清理路径；不声称能模拟每种设备故障。

M可设1–32，单轮路数最多32，总临时段数最多512，超出明确失败。固定的文件指针目录不是把所有记录装进内存；每个stdio流还通过setvbuf请求4KiB缓冲，库实现可能调整实际大小。内存预算必须加上缓冲、堆、比赛树和目录；操作系统允许同时打开的文件数也可能更低，此时建文件失败并清理，不能把512当跨平台保证。

```c
#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <limits.h>
enum { HM=32, KM=32, RUNS=512 };
typedef struct { FILE *f[RUNS]; int n; } Runs;
typedef struct { unsigned generation; int value; } Item;
static int open_files, read_budget=-1, write_budget=-1;
static FILE *temporary(void) {
    FILE *f=tmpfile(); if(!f) return NULL;
    if(setvbuf(f,NULL,_IOFBF,4096)!=0) { fclose(f); return NULL; }
    ++open_files; return f;
}
static bool close_file(FILE *f) { if(!f) return true; --open_files; return fclose(f)==0; }
static bool clear(Runs *r) {
    bool ok=true;
    for(int i=0;i<r->n;++i) { if(!close_file(r->f[i])) ok=false; r->f[i]=NULL; }
    r->n=0; return ok;
}
/* 1 record, 0 clean EOF, -1 I/O or truncated record. */
static int read_int(FILE *f,int *x) {
    if(read_budget==0) return -1;
    if(read_budget>0) --read_budget;
    size_t got=fread(x,1,sizeof *x,f);
    if(got==sizeof *x) return 1;
    if(got==0 && feof(f) && !ferror(f)) return 0;
    return -1;
}
static bool write_int(FILE *f,int x) {
    if(write_budget==0) return false;
    if(write_budget>0) --write_budget;
    return fwrite(&x,sizeof x,1,f)==1;
}
static bool before(Item a,Item b) {
    return a.generation<b.generation || (a.generation==b.generation && a.value<b.value);
}
static void push(Item *h,int *n,Item x) {
    int i=(*n)++;
    while(i>0) { int p=(i-1)/2; if(!before(x,h[p])) break; h[i]=h[p]; i=p; }
    h[i]=x;
}
static Item pop(Item *h,int *n) {
    Item out=h[0],x=h[--*n]; int i=0;
    while(2*i+1<*n) {
        int c=2*i+1; if(c+1<*n && before(h[c+1],h[c])) ++c;
        if(!before(h[c],x)) break;
        h[i]=h[c]; i=c;
    }
    if(*n) h[i]=x;
    return out;
}
static bool make_runs(FILE *input,int memory,Runs *r) {
    *r=(Runs){0}; if(memory<1 || memory>HM) return false;
    Item heap[HM]; int size=0;
    for(int i=0;i<memory;++i) {
        int x,status=read_int(input,&x); if(status<0) goto fail;
        if(status==0) break;
        push(heap,&size,(Item){0,x});
    }
    unsigned current=0; FILE *out=NULL;
    while(size) {
        Item x=pop(heap,&size);
        if(!out || x.generation!=current) {
            if(out && fflush(out)!=0) goto fail;
            if(r->n==RUNS) goto fail;
            out=temporary(); if(!out) goto fail;
            r->f[r->n++]=out; current=x.generation;
        }
        if(!write_int(out,x.value)) goto fail;
        int value,status=read_int(input,&value); if(status<0) goto fail;
        if(status>0) push(heap,&size,(Item){current+(value<x.value?1u:0u),value});
    }
    if(out && fflush(out)!=0) goto fail;
    return true;
fail:
    clear(r); return false;
}
typedef struct { int head[KM]; bool live[KM]; int k; } Players;
static bool wins(const Players *p,int a,int b) {
    bool aa=a<p->k && p->live[a],bb=b<p->k && p->live[b];
    if(aa!=bb) return aa;
    if(aa && p->head[a]!=p->head[b]) return p->head[a]<p->head[b];
    return a<b;
}
static FILE *merge_group(FILE **input,int k) {
    if(k<0 || k>KM) return NULL;
    FILE *out=temporary(); if(!out) return NULL;
    if(!k) return out;
    Players players={0}; players.k=k;
    for(int i=0;i<k;++i) {
        if(fseek(input[i],0,SEEK_SET)!=0) goto fail;
        int s=read_int(input[i],&players.head[i]); if(s<0) goto fail;
        players.live[i]=s>0;
    }
    int p=1; while(p<k) p*=2;
    int winner[2*KM],loser[KM];
    for(int i=0;i<p;++i) winner[p+i]=i;
    for(int i=p-1;i>0;--i) {
        int a=winner[2*i],b=winner[2*i+1];
        bool first=wins(&players,a,b); winner[i]=first?a:b; loser[i]=first?b:a;
    }
    int champion=winner[1];
    while(champion<k && players.live[champion]) {
        if(!write_int(out,players.head[champion])) goto fail;
        int s=read_int(input[champion],&players.head[champion]); if(s<0) goto fail;
        players.live[champion]=s>0;
        int contender=champion;
        for(int at=(p+champion)/2;at>0;at/=2) {
            if(!wins(&players,contender,loser[at])) {
                int old=loser[at]; loser[at]=contender; contender=old;
            }
        }
        champion=contender;
    }
    if(fflush(out)!=0 || fseek(out,0,SEEK_SET)!=0) goto fail;
    return out;
fail:
    close_file(out); return NULL;
}
/* Takes ownership of runs, even on failure. */
static FILE *sort_files(Runs *runs,int fanin) {
    if(fanin<2 || fanin>KM) { clear(runs); return NULL; }
    if(!runs->n) return temporary();
    while(runs->n>1) {
        Runs next={0};
        for(int i=0;i<runs->n;i+=fanin) {
            int k=runs->n-i; if(k>fanin) k=fanin;
            FILE *f=merge_group(&runs->f[i],k);
            if(!f) { clear(&next); clear(runs); return NULL; }
            next.f[next.n++]=f;
            for(int j=0;j<k;++j) {
                bool ok=close_file(runs->f[i+j]); runs->f[i+j]=NULL;
                if(!ok) { clear(&next); clear(runs); return NULL; }
            }
        }
        *runs=next;
    }
    FILE *out=runs->f[0]; runs->f[0]=NULL; runs->n=0;
    if(fflush(out)!=0 || fseek(out,0,SEEK_SET)!=0) { close_file(out); return NULL; }
    return out;
}
static int compare(const void *a,const void *b) {
    int x=*(const int *)a,y=*(const int *)b; return (x>y)-(x<y);
}
static FILE *source(const int *a,int n) {
    FILE *f=temporary(); if(!f) return NULL;
    for(int i=0;i<n;++i) if(!write_int(f,a[i])) { close_file(f); return NULL; }
    if(fflush(f)!=0 || fseek(f,0,SEEK_SET)!=0) { close_file(f); return NULL; }
    return f;
}
static void verify(const int *a,int n,int memory,int fanin) {
    int sorted[80]; assert(n<=80);
    for(int i=0;i<n;++i) sorted[i]=a[i];
    qsort(sorted,(size_t)n,sizeof *sorted,compare);
    FILE *in=source(a,n); assert(in); Runs r;
    assert(make_runs(in,memory,&r)); assert(close_file(in));
    FILE *out=sort_files(&r,fanin); assert(out);
    for(int i=0;i<n;++i) { int x; assert(read_int(out,&x)==1 && x==sorted[i]); }
    int x; assert(read_int(out,&x)==0); assert(close_file(out) && open_files==0);
}
int main(void) {
    const int demo[]={5,1,4,2,3,0}; FILE *in=source(demo,6); assert(in); Runs r;
    assert(make_runs(in,3,&r)); assert(r.n==2); assert(close_file(in));
    FILE *out=sort_files(&r,3); assert(out); printf("sorted:");
    int x,status; while((status=read_int(out,&x))==1) printf(" %d",x);
    assert(status==0 && close_file(out)); puts("");
    int a[80]; unsigned cases=0;
    for(int n=0;n<=80;n+=5) for(int memory=1;memory<=7;memory+=3)
        for(int fanin=2;fanin<=5;++fanin) {
            for(int i=0;i<n;++i) a[i]=(i*37+n*11)%23-11;
            verify(a,n,memory,fanin); ++cases;
        }
    const int extreme[]={INT_MAX,INT_MIN,INT_MAX,0}; verify(extreme,4,1,3);
    /* Empty inputs and arbitrary k, including non-powers of two and k=1. */
    for(int k=0;k<=KM;++k) {
        FILE *inputs[KM]; int expected[KM],count=0;
        for(int i=0;i<k;++i) {
            int v=k-i; inputs[i]=source(&v,i%3?1:0); assert(inputs[i]);
            if(i%3) expected[count++]=v;
        }
        qsort(expected,(size_t)count,sizeof *expected,compare); int got=0;
        out=merge_group(inputs,k); assert(out); bool first=true; int last=0;
        while((status=read_int(out,&x))==1) {
            assert(first || last<=x); assert(got<count && x==expected[got++]); first=false; last=x;
        }
        assert(got==count && status==0 && close_file(out));
        for(int i=0;i<k;++i) assert(close_file(inputs[i]));
        assert(open_files==0);
    }
    in=source(demo,6); assert(in); read_budget=1;
    assert(!make_runs(in,3,&r) && r.n==0); read_budget=-1; assert(close_file(in));
    in=source(demo,6); assert(in); write_budget=1;
    assert(!make_runs(in,3,&r) && r.n==0); write_budget=-1; assert(close_file(in));
    in=source(demo,6); assert(in); assert(make_runs(in,1,&r)); assert(close_file(in));
    write_budget=1; out=sort_files(&r,3); assert(!out && !r.n); write_budget=-1;
    in=source(demo,6); assert(in); assert(make_runs(in,1,&r)); assert(close_file(in));
    read_budget=1; out=sort_files(&r,3); assert(!out && !r.n); read_budget=-1;
    if(sizeof(int)>1) {
        in=temporary(); assert(in); int broken=7;
        assert(fwrite(&broken,1,sizeof broken-1,in)==sizeof broken-1);
        assert(fflush(in)==0 && fseek(in,0,SEEK_SET)==0);
        assert(!make_runs(in,3,&r) && !r.n); assert(close_file(in));
    }
    assert(open_files==0);
    printf("%u file-sort cases; k=0..32; read/write failure cleanup passed\n",cases);
    return 0;
}
```

<!-- study-run:BEGIN sha256=2f82aa22667e5f58118340777af0ba41a959ac0a771b399ddb8f8ec191fb4361 -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
sorted: 0 1 2 3 4 5
204 file-sort cases; k=0..32; read/write failure cleanup passed
```
<!-- study-run:END -->

## 失败路径也要能读懂

read_int用字节数检查：读满sizeof(int)才算一条；零字节且正常EOF才算结束；只读到半个整数属于截断，不能把未初始化的剩余字节当记录。write_int成功也不代表已经落盘，缓冲区最后还可能刷新失败，因此fflush和fclose同样检查。清理函数尽力关闭全部文件，不能第一个关闭失败就提前返回而泄漏后面的句柄。

测试先用普通数组排序生成独立答案，再将原数据写入真正临时文件，生成顺串、归并、从结果文件逐条读取核对。它不是“把数组排序完再假装写过文件”。所有文件是临时教学数据；实际业务文件还需要输出原子替换、元数据、校验和、磁盘空间预算等额外协议，本章不操作这些外部状态。

## 成本按CPU和I/O分别算

处理N条输入，置换选择堆维护O(N log(M+1))。合并一组k路初始化O(k)，每条输出O(log(k+1))；P是补齐后的二次幂，P<2k，所以不会因补齐而改变阶。若有R段且每轮最多k≥2路，归并轮数至多ceil(log_k R)，每轮把全部记录读取一次、写出一次。初始分段另有一次读写。

文件缓冲块大小B按记录数衡量时，理想顺序I/O数量约为O((N/B)(1+ceil(log_k R)))，最后不足一块、多个段尾、缓冲数及系统缓存都会影响常数。这里通过stdio实际读写，但没有测量物理磁盘寻道次数，不能把fread调用次数等同于硬盘读次数。

## 自检

1. 为什么堆里新来的小值不会破坏当前段？段号优先，它等下一段才参与值竞争。
2. 为什么败者回放只能这样更新当前冠军一路？路径上保存的是它以前击败的对手；随便修改其他一路不能直接套相同协议。
3. k=5补成8为什么不会输出“假无穷”？虚拟路live为false，获胜也会使循环结束，不会写出一个伪造整数。
4. 为什么总内存不是只有M个int？还包括每个流的缓冲、文件对象、比赛数组和段目录。
5. 512个临时段满了怎么办？当前接口明确失败并清理；需要超大规模时设计分批段目录或分阶段归并，不能默默覆盖旧文件指针。
