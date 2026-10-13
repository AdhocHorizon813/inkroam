// Offline trace inspection. Does not connect to or control a browser.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const round = n => +n.toFixed(3)
const stats = a => {
  a.sort((x,y)=>x-y)
  return { n:a.length, sum:round(a.reduce((x,y)=>x+y,0)), median:a.length?round(a[Math.floor(a.length/2)]):null, p95:a.length?round(a[Math.floor(a.length*.95)]):null, max:a.length?round(a.at(-1)):null }
}
for (const file of process.argv.slice(2)) {
  const d=JSON.parse(gunzipSync(readFileSync(file))), e=d.traceEvents
  const frames=e.filter(x=>x.name==='TracingStartedInBrowser').flatMap(x=>x.args?.data?.frames??[])
  const pid=frames.find(x=>x.isOutermostMainFrame&&x.url==='http://localhost:3000/')?.processId
  if(pid==null) throw Error('No unambiguous local homepage renderer')
  const thread=e.find(x=>x.ph==='M'&&x.name==='thread_name'&&x.pid===pid&&x.args?.name==='CrRendererMain')
  const scroll=e.filter(x=>x.pid===pid&&x.name==='EventDispatch'&&x.args?.data?.type==='scroll').sort((a,b)=>a.ts-b.ts)
  const groups=[]
  for(const x of scroll){if(!groups.length||x.ts-groups.at(-1).at(-1).ts>500000)groups.push([]);groups.at(-1).push(x)}
  const origin=scroll[0]?.ts
  const windows=groups.map(g=>[g[0].ts,g.at(-1).ts+1500000])
  const inside=x=>windows.some(([a,b])=>x.ts>=a&&x.ts<b)
  const names=['RunTask','FunctionCall','FireAnimationFrame','UpdateLayoutTree','Layout','PrePaint','Paint','Layerize','RasterTask','GPUTask']
  const measures={}
  for(const name of names){const xs=e.filter(x=>x.ph==='X'&&x.name===name&&inside(x)&&(name==='GPUTask'||(x.pid===pid&&(name==='RasterTask'||x.tid===thread.tid))))
    measures[name]=stats(xs.filter(x=>name!=='GPUTask'||x.args?.data?.renderer_pid===pid).map(x=>x.dur/1000))}
  const phases={}
  const phaseBins={}
  for(const name of ['SendBeginMainFrameToCommit','SubmitCompositorFrameToPresentationCompositorFrame','ReceiveCompositorFrameToStartDraw','StartDrawToSwapStart','SwapEndToPresentationCompositorFrame']){
    const pending=new Map(), out=[], bins=[[],[],[]]
    for(const x of e.filter(x=>x.pid===pid&&x.name===name).sort((a,b)=>a.ts-b.ts)){
      const key=JSON.stringify([x.cat,x.id2??x.id]); if(x.ph==='b')pending.set(key,x)
      else if(x.ph==='e'&&pending.has(key)){const a=pending.get(key);if(inside(a)&&x.ts>=a.ts){out.push((x.ts-a.ts)/1000);const g=groups.find(g=>a.ts>=g[0].ts&&a.ts<g.at(-1).ts+1500000);const offset=(a.ts-g[0].ts)/1000;bins[offset<440?0:offset<1000?1:2].push((x.ts-a.ts)/1000)}pending.delete(key)}
    }phases[name]=stats(out);phaseBins[name]=bins.map(stats)
  }
  const animationWarnings=e.filter(x=>x.name==='Animation'&&x.ph==='n'&&x.args?.data&&Object.keys(x.args.data).some(k=>k!=='state')).slice(0,12)
  console.log(JSON.stringify({file,start:d.metadata?.startTime,dpr:d.metadata?.hostDPR,pid,frames,scrollGroups:groups.map(g=>({start:round((g[0].ts-origin)/1e6),span:round((g.at(-1).ts-g[0].ts)/1e6),count:g.length})),measures,phases,phaseBins,animationWarnings},null,2))
}
