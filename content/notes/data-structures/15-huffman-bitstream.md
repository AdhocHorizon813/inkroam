---
title: 第十五讲：Huffman从权值到真正的位流编码与解码
description: 明确码树、码字、字节与有效位数的区别，实现小字母表建树、码表、位打包、解码及截断检查。
date: 2026-10-04
order: 15
tags: [算法与数据结构]
readingTime: 35 分钟
aiGenerated: true
draft: false
---

## WPL不是一个压缩文件

第三讲已经计算加权路径长度WPL，但仅有长度不能还原消息。**码字**是一个符号对应的有限0/1序列；**前缀码**要求任一符号码字不是真前缀于其他符号码字，所以可以读到叶子就输出符号。Huffman每次合并最小的两个权值，得到使给定频次下WPL最小的一类二叉前缀码；同权时码树可能不同，最优不等于唯一。

一个可解码协议还要约定：码树或等价码表从哪里来、左右边对应哪个位、字节内位顺序、有效位数和原文符号数。本章实现内存中的编解码：调用双方共享同一棵树；左0右1、每字节高位先存，单独传bit_count和expected_count。**不是自描述磁盘文件格式**，不能只保存字节数组便指望另一个程序猜出码表。

## 慢算一个位流

如果A编码0，B编码10，C编码11，则ABCA得到0|10|11|0，即010110，6个有效位。装进一个字节得到01011000，十进制88；末尾两位0仅用于填满字节，不能当作两个额外A。

```mermaid
flowchart LR
    accTitle: Huffman编码数据层次
    accDescr: 符号通过码表成为有效位，再按八位打包为字节，解码需要共享码树和有效长度
    S["符号 ABCA"] --> C["码字拼接 010110"]
    C --> B["字节 01011000；有效6位"]
    B --> D["共享码树；预期4符号"]
```

单符号字母表常被忽略：一棵只有根的树没有边，若约定空码字，解码必须完全依赖原文长度。本章选择更直观的协议：唯一符号的码字为0，收到1拒绝。空消息采用空树、0有效位、0符号。

## 完整实现：范围小，但不是只计算WPL

### 先把六个位真正装入一个字节

不要把字符串"010110"的六个字符等同于六个位：通常每个字符至少占一个字节。下面只用一个unsigned char存储本例的位，逐步打印字节的十进制值；解包时只读6个有效位。

```c
#include <assert.h>
#include <stdio.h>
int main(void) {
    const unsigned bit[]={0,1,0,1,1,0}; unsigned char byte=0;
    for(unsigned p=0;p<6;++p) {
        byte|=(unsigned char)(bit[p]<<(7-p));
        printf("after bit %u: byte=%u\n",p,(unsigned)byte);
    }
    assert(byte==88);
    for(unsigned p=0;p<6;++p) assert(((byte>>(7-p))&1u)==bit[p]);
    return 0;
}
```

<!-- study-run:BEGIN sha256=ffa9455656147ce7793adb7ea8e50e55a6d8e65e42ed44eec3c2a0ee567e96b3 -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
after bit 0: byte=0
after bit 1: byte=64
after bit 2: byte=64
after bit 3: byte=80
after bit 4: byte=88
after bit 5: byte=88
```
<!-- study-run:END -->

这里以及完整程序的协议使用每组8位；C只保证char至少8位。若运行在CHAR_BIT不是8的特殊平台，应为文件格式另定八位组表示，不直接把C字节大小与网络八位组等同。

字母表是整数0–7，消息最长256符号。不是UTF-8文本压缩器。最多15个结点，最长码字7位，unsigned保存得下。建树用扫描找两个最小项，复杂度O(s²)，s为出现过的符号数；这里固定s≤8，不伪称用了优先队列。编码与解码成本与有效位数成正比。

```c
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
enum { ALPHABET=8, MAX_MESSAGE=256, MAX_BYTES=224 };
typedef struct { unsigned weight; int left, right, symbol; bool active; } Node;
typedef struct { Node node[15]; int count, root; unsigned code[8], length[8]; } Codec;
static void codes(Codec *c, int p, unsigned bits, unsigned length) {
    const Node *n = &c->node[p];
    if (n->symbol >= 0) { c->code[n->symbol]=bits; c->length[n->symbol]=length?length:1; return; }
    codes(c,n->left,bits<<1,length+1); codes(c,n->right,(bits<<1)|1u,length+1);
}
static int smallest(const Codec *c) {
    int best=-1;
    for(int i=0;i<c->count;++i) if(c->node[i].active)
        if(best<0 || c->node[i].weight<c->node[best].weight) best=i;
    return best;
}
static bool build(Codec *c, const unsigned char *src, size_t n) {
    if(n>MAX_MESSAGE || (n && !src)) return false;
    unsigned freq[8]={0};
    for(size_t i=0;i<n;++i) { if(src[i]>=8) return false; ++freq[src[i]]; }
    *c=(Codec){0}; c->root=-1;
    for(int s=0;s<8;++s) if(freq[s]) c->node[c->count++]=(Node){freq[s],-1,-1,s,true};
    if(!c->count) return true;
    for(;;) {
        int a=smallest(c); c->node[a].active=false;
        int b=smallest(c);
        if(b<0) { c->root=a; break; }
        c->node[b].active=false;
        c->node[c->count++]=(Node){c->node[a].weight+c->node[b].weight,a,b,-1,true};
    }
    codes(c,c->root,0,0); return true;
}
static bool encode(const Codec *c,const unsigned char *src,size_t n,
                   unsigned char *bytes,size_t capacity,size_t *bits) {
    if(n>MAX_MESSAGE || (n && !src) || !bytes || !bits) return false;
    size_t total=0;
    for(size_t i=0;i<n;++i) {
        if(src[i]>=8 || !c->length[src[i]]) return false;
        total+=c->length[src[i]];
    }
    if((total+7)/8>capacity) return false;
    memset(bytes,0,(total+7)/8); size_t p=0;
    for(size_t i=0;i<n;++i) for(unsigned j=c->length[src[i]];j>0;--j) {
        unsigned bit=(c->code[src[i]]>>(j-1))&1u;
        bytes[p/8]|=(unsigned char)(bit<<(7-p%8)); ++p;
    }
    *bits=total; return true;
}
static bool decode(const Codec *c,const unsigned char *bytes,size_t size,size_t bits,
                   size_t expected,unsigned char *out,size_t capacity) {
    if(size>MAX_BYTES || bits>size*8 || expected>MAX_MESSAGE || expected>capacity
       || (bits && !bytes) || (expected && !out)) return false;
    if(c->root<0) return bits==0 && expected==0;
    int p=c->root; size_t used=0;
    for(size_t i=0;i<bits;++i) {
        unsigned bit=(bytes[i/8]>>(7-i%8))&1u;
        if(c->node[c->root].symbol>=0) {
            if(bit || used==expected) return false;
            out[used++]=(unsigned char)c->node[c->root].symbol;
        } else {
            p=bit?c->node[p].right:c->node[p].left;
            if(c->node[p].symbol>=0) {
                if(used==expected) return false;
                out[used++]=(unsigned char)c->node[p].symbol; p=c->root;
            }
        }
    }
    return p==c->root && used==expected;
}
static void roundtrip(const unsigned char *src,size_t n) {
    Codec c; unsigned char bytes[MAX_BYTES],out[MAX_MESSAGE]; size_t bits;
    assert(build(&c,src,n)); assert(encode(&c,src,n,bytes,sizeof bytes,&bits));
    assert(decode(&c,bytes,(bits+7)/8,bits,n,out,sizeof out));
    assert(!n || memcmp(src,out,n)==0);
    if(bits) assert(!decode(&c,bytes,(bits+7)/8,bits-1,n,out,sizeof out));
    if(n) assert(!decode(&c,bytes,(bits+7)/8,bits,n,out,n-1));
}
int main(void) {
    unsigned char src[MAX_MESSAGE]={0,1,2,0}, bytes[MAX_BYTES],out[MAX_MESSAGE];
    Codec c; size_t bits; assert(build(&c,src,4));
    assert(encode(&c,src,4,bytes,sizeof bytes,&bits));
    for(int s=0;s<3;++s) printf("symbol=%d code=%u length=%u\n",s,c.code[s],c.length[s]);
    printf("effective bits=%u first byte=%u\n",(unsigned)bits,(unsigned)bytes[0]);
    assert(bits==6 && bytes[0]==88); roundtrip(src,4);
    assert(!encode(&c,src,4,bytes,0,&bits));
    const unsigned char absent[]={7}; assert(!encode(&c,absent,1,bytes,sizeof bytes,&bits));
    assert(!decode(&c,bytes,1,9,4,out,sizeof out));
    unsigned cases=0, power=1;
    for(size_t n=0;n<=6;++n) {
        for(unsigned value=0;value<power;++value) {
            unsigned x=value; for(size_t i=0;i<n;++i) { src[i]=(unsigned char)(x%3); x/=3; }
            roundtrip(src,n); ++cases;
        }
        power*=3;
    }
    for(size_t i=0;i<MAX_MESSAGE;++i) src[i]=(unsigned char)(i%8);
    roundtrip(src,MAX_MESSAGE);
    memset(src,3,sizeof src); roundtrip(src,MAX_MESSAGE); assert(build(&c,src,1));
    bytes[0]=128; assert(!decode(&c,bytes,1,1,1,out,sizeof out));
    src[0]=8; assert(!build(&c,src,1));
    assert(!build(&c,src,MAX_MESSAGE+1));
    printf("%u exhaustive messages plus empty/single/full/truncated cases passed\n",cases);
    return 0;
}
```

<!-- study-run:BEGIN sha256=46cc0cffabc6669c8b4ec1c1c52a4a4d2b3f2f9fe0a7a3e04aa904c33edee74f -->
本段代码的实测输出（GCC，C17；不代表所有输入）：

```text
symbol=0 code=0 length=1
symbol=1 code=2 length=2
symbol=2 code=3 length=2
effective bits=6 first byte=88
1093 exhaustive messages plus empty/single/full/truncated cases passed
```
<!-- study-run:END -->

## 位运算为什么这样写

全局第p个位属于bytes[p/8]；它在字节内从高到低的位置是7−p%8。把0或1左移这个位置，再按位或进去。编码前清零字节，否则上次残留的1不会被“或0”清掉。取码字时j从length降到1，读第j−1位，避免把码字倒序写入。

解码每读一个位走一条边，遇叶输出并回根。读完仍在内部结点表示末尾码字不完整；即使回根，也要核对符号数，防止恰好截掉一个完整码字却被误判成功。输出容量不足直接拒绝；失败后输出缓冲可能已有部分数据，调用者不能把它当有效消息。

## 能发现什么，不能发现什么

样例覆盖1093个长度0–6、三符号消息及空消息、单符号、最大长度、截断、输出容量不足。树来自受信任的build，不接受任意外部损坏结点数组。某个位翻转后仍可能形成同样长度的合法符号序列，**Huffman不是校验码**；要检测传输损坏还需要校验和等协议机制。本章没有发明一个文件头后便声称具备生产压缩格式的兼容性。

练习：为什么十进制码值2不能独自表示码字？因为二进制10与0010数值相同但长度不同，必须同时保存length。再算ABCA末尾填充的两位如果也被解码，会多得到几个符号？本例会多两个A。

Huffman建树和前缀性质可对照[OpenDSA的Huffman章节](https://opendsa.org/OpenDSA/Books/Catalog/html/Huffman.html)。本讲的8符号范围、单符号码0与共享树位流协议是明确的教学选择，不代表所有Huffman文件格式。
