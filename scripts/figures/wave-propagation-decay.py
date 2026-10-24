from pathlib import Path
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Wedge
from matplotlib import font_manager
root=Path(__file__).resolve().parents[2];out=root/'public/images/notes/equations-of-mathematical-physics/wave-propagation-and-decay';out.mkdir(parents=True,exist_ok=True)
font=os.environ.get('WAVE_NOTE_CJK_FONT')
if font:font_manager.fontManager.addfont(font)
plt.rcParams.update({'font.family':font_manager.FontProperties(fname=font).get_name() if font else 'sans-serif','font.size':12,'axes.spines.top':False,'axes.spines.right':False,'axes.unicode_minus':False,'svg.fonttype':'path','figure.facecolor':'#fbfcfe','axes.facecolor':'#fbfcfe','text.color':'#18324b','axes.labelcolor':'#18324b'})
blue='#287cb8';teal='#118b80';gold='#c98223'
def save(fig,n):
 fig.savefig(out/(n+'.svg'),bbox_inches='tight',pad_inches=.25)
 fig.savefig(out/(n+'.png'),dpi=180,bbox_inches='tight',pad_inches=.25)
 plt.close(fig)
def clean(ax,lim):
 ax.set_aspect('equal');ax.set_xlim(-lim,lim);ax.set_ylim(-lim,lim);ax.axis('off')
f,axs=plt.subplots(1,2,figsize=(10,4.5),layout='constrained')
for i,ax in enumerate(axs):
 clean(ax,1.5);ax.add_patch(Circle((0,0),1,fill=bool(i),facecolor='#d8ecf8',edgecolor=blue,lw=3));ax.scatter(0,0,c=teal,s=35);ax.text(-.1,-.2,'x');ax.annotate('',xy=(.8,.6),xytext=(0,0),arrowprops={'arrowstyle':'->','color':gold,'lw':2});ax.text(.3,.42,'at',color=gold);ax.set_title(['三维：球面依赖（截面示意）','二维：整个圆盘依赖'][i]);ax.text(0,-1.35,['严格内部不参与此刻的球面积分','内部初值一般仍参与积分'][i],ha='center',fontsize=11)
save(f,'01-dependence')
f,axs=plt.subplots(2,3,figsize=(11,7),layout='constrained')
for j,t in enumerate([.5,1.5,3.]):
 for i in range(2):
  ax=axs[i,j];clean(ax,4.5);outer=t+1;inner=max(0,t-1) if i==0 else 0
  ax.add_patch(Wedge((0,0),outer,0,360,width=outer-inner,facecolor='#d8ecf8',edgecolor=blue,lw=1.8));ax.add_patch(Circle((0,0),1,fill=False,edgecolor=gold,ls='--',lw=1.5));ax.scatter(0,0,c=teal,s=10);ax.set_title(f'{"三维球壳截面" if i==0 else "二维影响圆盘"}  t={t:g}',fontsize=12)
  ax.text(0,-4.25,f'外半径 {outer:g}'+(f'；内半径 {inner:g}' if i==0 else '；不保证内部为空'),ha='center',fontsize=10)
save(f,'02-shells')
R=3.;rho=1.;d=3.;cx=d;cut=(d*d+rho*rho-R*R)/(2*d);b=np.sqrt(rho*rho-cut*cut);h=cut-(d-R)
f,axs=plt.subplots(1,2,figsize=(11,4.8),layout='constrained')
th=np.linspace(0,2*np.pi,500);theta=np.arccos((d*d+R*R-rho*rho)/(2*d*R));z=np.linspace(-theta,theta,250)
for ax in axs:
 ax.plot(d+R*np.cos(th),R*np.sin(th),color=blue,lw=1.5);ax.plot(rho*np.cos(th),rho*np.sin(th),color=gold,lw=2);ax.plot(d-R*np.cos(z),R*np.sin(z),color=teal,lw=4);ax.scatter([0,d],[0,0],c=[gold,blue],s=25);ax.set_aspect('equal');ax.axhline(0,color='#c4d1dd',lw=.8)
axs[0].set(xlim=(-1.3,6.4),ylim=(-3.3,3.3),title='固定小球与移动积分球面');axs[0].text(-.4,-.45,'0');axs[0].text(d,-.45,'x');axs[0].axis('off')
ax=axs[1];ax.set(xlim=(-.4,.6),ylim=(-1.2,1.2),title='放大有效球冠的截面');ax.plot([cut,cut],[-b,b],ls='--',color=gold);ax.annotate('',xy=(cut,b),xytext=(cut,0),arrowprops={'arrowstyle':'<->','color':gold});ax.text(cut+.04,b*.5,'b',color=gold);ax.annotate('',xy=(cut,-.25),xytext=(d-R,-.25),arrowprops={'arrowstyle':'<->','color':teal});ax.text((cut+d-R)/2,-.37,'h',ha='center',color=teal);ax.text(-.35,-1.1,r'$b^2=2Rh-h^2$',fontsize=12);ax.axis('off');save(f,'03-cap-bound')
s=np.linspace(0,1,12001);g=np.zeros_like(s);g[:-1]=np.exp(-1/(1-s[:-1]**2));integrand=s*g;F=np.r_[0,np.cumsum((integrand[1:]+integrand[:-1])*np.diff(s)/2)]
def integ(q):return np.interp(q,s,F,left=0,right=F[-1])
def u(r,t):
 r=np.asarray(r);safe=np.maximum(r,1e-8);res=(integ(safe+t)-integ(np.abs(safe-t)))/(2*safe)
 gt=np.exp(-1/(1-t*t)) if 0<=t<1 else 0
 return np.where(r<1e-8,t*gt,res)
f,axs=plt.subplots(1,2,figsize=(11,4.6),layout='constrained');r=np.linspace(0,5,1000)
for t,c in zip([.5,1.5,3.],[gold,teal,blue]):axs[0].plot(r,u(r,t),label=f't={t:g}',lw=2.2,color=c)
axs[0].set(xlabel='观察半径 r',ylabel='振幅 u(r,t)',title='波包向外移动，同时变低');axs[0].legend(frameon=False);axs[0].grid(alpha=.15)
t=np.linspace(.1,5,800);fixed=np.array([u(2.,x) for x in t]);moving=np.array([u(x,x) for x in t]);axs[1].plot(t,fixed,label='固定位置 r=2',color=teal,lw=2.3);axs[1].plot(t,moving,label='移动位置 r=t',color=blue,lw=2.3);late=t>=.5;axs[1].plot(t[late],F[-1]/(2*t[late]),color=gold,ls='--',label=r'$c_0/t$（t≥0.5）');axs[1].axvline(3,ls=':',color=teal);axs[1].set(xlabel='时间 t',ylabel='振幅',title='局部归零与移动波峰的衰减');axs[1].legend(frameon=False,fontsize=10);axs[1].grid(alpha=.15);save(f,'04-moving-observer')
print('Created 4 SVG and 4 PNG figures.')
