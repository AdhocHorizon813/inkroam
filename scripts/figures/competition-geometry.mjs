// Deterministic SVG plots for analytic geometry notes. No third-party packages.
const colors = { ink:'#172b4d', blue:'#2166b5', orange:'#c45a18', green:'#16806a', grid:'#d8e1eb', muted:'#526479' };
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const text = (x,y,s,size=18,color=colors.ink) => '<text x="'+x+'" y="'+y+'" font-size="'+size+'" fill="'+color+'">'+esc(s)+'</text>';
const line = (a,b,color=colors.ink,dash='') => '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="'+color+'" stroke-width="2"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
const path = (points,color=colors.blue,width=2.5) => '<polyline points="'+points.map(p=>p.map(x=>x.toFixed(2)).join(',')).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linejoin="round"/>';
const dot = (p,color=colors.ink,r=4) => '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+r+'" fill="'+color+'"/>';
const arrow = (a,b,color=colors.blue) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy),ux=dx/n,uy=dy/n;
  return line(a,b,color)+'<polygon points="'+[b,[b[0]-10*ux+4*uy,b[1]-10*uy-4*ux],[b[0]-10*ux-4*uy,b[1]-10*uy+4*ux]].map(p=>p.join(',')).join(' ')+'" fill="'+color+'"/>';
};
const svg = (title,desc,w,h,body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-labelledby="title desc"><title id="title">'+esc(title)+'</title><desc id="desc">'+esc(desc)+'</desc><rect width="'+w+'" height="'+h+'" rx="16" fill="#f8fafc"/><g font-family="system-ui, sans-serif">'+body+'</g></svg>\n';
const sample = (fn,n=160) => Array.from({length:n+1},(_,i)=>fn(i/n));
const files = [];
const base='public/images/notes/mathematics-competition/';
{
  const map=(x,y)=>[65+70*x,285-70*y];
  let b=text(35,40,'正交分解：沿方向与垂直方向',21);
  b+=arrow(map(0,0),map(4.4,0),colors.muted)+arrow(map(0,0),map(0,2.8),colors.muted);
  b+=arrow(map(0,0),map(3,2))+arrow(map(0,0),map(3,0),colors.green)+arrow(map(3,0),map(3,2),colors.orange);
  b+=path([map(2.8,0),map(2.8,.2),map(3,.2)],colors.muted,1.5);
  b+=text(150,120,'a = (3, 2)',18,colors.blue)+text(142,314,'a∥ = (3, 0)',17,colors.green)+text(285,208,'a⊥',18,colors.orange);
  b+=text(365,280,'b',18)+text(50,310,'O',16);
  b+=text(470,40,'面积与取向',21);
  const p=(x,y)=>[470+60*x,285-60*y];
  const verts=[p(0,0),p(4,0),p(7,2),p(3,2)];
  b+='<polygon points="'+verts.map(p=>p.join(',')).join(' ')+'" fill="#deebf8" stroke="'+colors.blue+'" stroke-width="2"/>';
  b+=arrow(p(0,0),p(4,0),colors.green)+arrow(p(0,0),p(3,2),colors.blue);
  b+=text(580,310,'b = (4, 0)',17,colors.green)+text(525,140,'a = (3, 2)',17,colors.blue);
  b+=text(620,238,'面积 = 8',20)+text(470,350,'det(b, a) = 8；det(a, b) = −8',18);
  files.push({path:base+'04-vector-projection.svg',content:svg('向量分解与有向面积','向量 a 等于其水平投影与垂直分量之和；右侧平行四边形面积为八，交换两边顺序使有向面积变号。',950,380,b)});
}
{
  // Oblique projection (x,y,z) -> (x + .55y, -.28y - 1.5z).
  const p=(x,y,z)=>[330+80*(x+.55*y),330-80*(.28*y+1.5*z)];
  let b=text(35,40,'异面直线：求方向，也要求垂足',23);
  b+=line(p(-2.5,0,0),p(3.5,0,0),colors.blue);
  b+=line(p(-2,-2,1),p(2.5,2.5,1),colors.green);
  b+=line(p(0,0,0),p(0,0,1),colors.orange)+line(p(0,0,-.4),p(0,0,1.4),colors.orange,'5 6');
  b+=dot(p(0,0,0))+dot(p(0,0,1));
  b+=text(350,355,'H₁ = (0, 0, 0)',18)+text(350,200,'H₂ = (0, 0, 1)',18);
  b+=text(60,375,'L₁ = (t, 0, 0)',19,colors.blue)+text(540,135,'L₂ = (1+s, 1+s, 1)',18,colors.green);
  b+=text(350,270,'距离 = 1',19,colors.orange);
  b+=text(35,430,'u × v = (0, 0, 1)；公垂线：x = 0，y = 0',20);
  b+=text(35,465,'斜投影示意；空间中的直角不一定在图上显示为直角。',16,colors.muted);
  files.push({path:base+'05-common-perpendicular.svg',content:svg('异面直线的公垂线','两条直线方向分别为一零零和一一零，分别位于高度零和一；两垂足在 z 轴上，相距一。',920,500,b)});
}
{
  let b=text(30,36,'用水平截面读懂二次曲面',24);
  const palettes=[colors.blue,colors.orange,colors.green];
  const panels=[
    {x:25,y:65,title:'椭球：x²/4 + y² + z²/4 = 1',sub:'z = 0, 1, 1.8；|z| > 2 无实点',kind:0},
    {x:505,y:65,title:'单叶：x² + y² − z² = 1',sub:'z = 0, 0.7, 1.2；每层都有截线',kind:1},
    {x:25,y:415,title:'双叶：z² − x² − y² = 1',sub:'|z| = 1.1, 1.4, 1.8；|z| < 1 无点',kind:2},
    {x:505,y:415,title:'鞍面：z = x² − y²',sub:'z = −1, 0, 1；零层为两相交直线',kind:3}
  ];
  for(const q of panels){
    b+='<rect x="'+q.x+'" y="'+q.y+'" width="460" height="330" rx="12" fill="white" stroke="'+colors.grid+'"/>';
    b+=text(q.x+14,q.y+28,q.title,18)+text(q.x+14,q.y+53,q.sub,15,colors.muted);
    const p=(x,y)=>[q.x+230+66*x,q.y+194-66*y];
    b+=line(p(-2.9,0),p(2.9,0),colors.grid)+line(p(0,-1.8),p(0,1.8),colors.grid);
    b+=text(q.x+428,q.y+190,'x',14)+text(q.x+238,q.y+82,'y',14);
    if(q.kind===0) [0,1,1.8].forEach((z,i)=>{
      const r=Math.sqrt(1-z*z/4);
      b+=path(sample(t=>p(2*r*Math.cos(2*Math.PI*t),r*Math.sin(2*Math.PI*t))),palettes[i]);
    });
    if(q.kind===1) [0,.7,1.2].forEach((z,i)=>{
      const r=Math.sqrt(1+z*z);
      b+=path(sample(t=>p(r*Math.cos(2*Math.PI*t),r*Math.sin(2*Math.PI*t))),palettes[i]);
    });
    if(q.kind===2) [1.1,1.4,1.8].forEach((z,i)=>{
      const r=Math.sqrt(z*z-1);
      b+=path(sample(t=>p(r*Math.cos(2*Math.PI*t),r*Math.sin(2*Math.PI*t))),palettes[i]);
    });
    if(q.kind===3){
      for(const sign of [-1,1]){
        b+=path(sample(t=>{const u=-1.05+2.1*t;return p(Math.sinh(u),sign*Math.cosh(u));}),palettes[0]);
        b+=path([p(-1.65,sign*-1.65),p(1.65,sign*1.65)],palettes[1]);
        b+=path(sample(t=>{const u=-1.05+2.1*t;return p(sign*Math.cosh(u),Math.sinh(u));}),palettes[2]);
      }
    }
    [0,1,2].forEach(i=>{b+=line([q.x+30+i*143,q.y+306],[q.x+54+i*143,q.y+306],palettes[i]);b+=text(q.x+60+i*143,q.y+311,['第一层','第二层','第三层'][i],13,colors.muted);});
  }
  files.push({path:base+'06-quadric-sections.svg',content:svg('二次曲面水平截面对比','四幅图依次显示椭球、单叶双曲面、双叶双曲面、双曲抛物面的水平截线，标注对应高度和存在范围。各小图独立取尺度。',990,770,b)});
}
{
  let b=text(30,38,'同一椭圆：原坐标与主轴坐标',24);
  const p=(x,y)=>[195+65*x,350-65*y],q=(u,v)=>[705+65*u,285-65*v];
  b+=text(30,75,'5x² − 6xy + 5y² − 4x − 4y − 4 = 0',18);
  b+=text(525,75,'U²/4 + V² = 1',21);
  for(let i=-2;i<=3;i++){
    b+=line(p(i,-1),p(i,3),colors.grid)+line(p(-2,i),p(3,i),colors.grid);
  }
  b+=arrow(p(-2,0),p(3.3,0),colors.muted)+arrow(p(0,-1),p(0,3.3),colors.muted);
  b+=text(415,367,'x',16)+text(200,125,'y',16);
  b+=line(p(-1,-1),p(3,3),colors.orange,'6 5')+line(p(-1,3),p(3,-1),colors.green,'6 5');
  b+=path(sample(t=>{const U=2*Math.cos(t*2*Math.PI),V=Math.sin(t*2*Math.PI);return p(1+(U+V)/Math.sqrt(2),1+(U-V)/Math.sqrt(2));}),colors.blue,3);
  b+=dot(p(1,1))+text(275,292,'C = (1, 1)',16);
  for(const [U,V] of [[2,0],[-2,0],[0,1],[0,-1]]) b+=dot(p(1+(U+V)/Math.sqrt(2),1+(U-V)/Math.sqrt(2)),colors.blue,3);
  b+=arrow(q(-2.6,0),q(2.6,0),colors.orange)+arrow(q(0,-1.7),q(0,1.7),colors.green);
  b+=path(sample(t=>q(2*Math.cos(t*2*Math.PI),Math.sin(t*2*Math.PI))),colors.blue,3);
  b+=text(880,290,'U',16)+text(710,162,'V',16)+dot(q(0,0));
  b+=text(832,309,'2',15)+text(714,221,'1',15);
  b+=text(525,385,'长轴：y = x；短轴：y = −x + 2',18);
  b+=text(30,465,'U = (x + y − 2)/√2，V = (x − y)/√2；正交变换保持长度和角度。',19);
  files.push({path:base+'06-conic-principal-axes.svg',content:svg('旋转椭圆的主轴化简','原坐标中椭圆中心为一一，长轴沿 y 等于 x，半轴长二和一；右侧为同一比例尺的主轴坐标标准椭圆。',950,500,b)});
}

const { mkdir, writeFile } = await import('node:fs/promises');
for (const file of files) {
  await mkdir(file.path.slice(0, file.path.lastIndexOf('/')), { recursive: true });
  await writeFile(file.path, file.content);
}
