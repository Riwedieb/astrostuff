import {horizontalVector,angles} from './sky-math.mjs';
import {horizonAt} from './terrain-math.mjs';
export function intervals(samples,predicate){
  const result=[];let start=null;
  for(let i=0;i<samples.length-1;i++){
    const a=samples[i],b=samples[i+1],ok=predicate(a)&&predicate(b);
    if(ok&&start===null)start=a.t;
    if(start!==null&&(!ok||i===samples.length-2)){const end=ok?b.t:a.t;if(end>start)result.push({start,end});start=null;}
  }
  return result;
}
export function summarizeWindows(windows){
  const longest=windows.reduce((best,w)=>!best||w.end-w.start>best.end-best.start?w:best,null);
  return {windows,longest,total:windows.reduce((sum,w)=>sum+w.end-w.start,0),continuous:longest?longest.end-longest.start:0};
}
export function buildNightGrid(api,context,step=5*60000){
  const grid=[];
  for(let t=context.start;t<context.end+step;t+=step){const time=Math.min(t,context.end),s=api.sunRaDec(time);grid.push({t:time,sidereal:api.gmst(time)+context.longitude,sun:angles(horizontalVector(s.ra,s.dec,context.latitude,api.gmst(time)+context.longitude)).alt});if(time===context.end)break;}
  return grid;
}
export function objectWindows(api,d,context,grid,minAlt,terrain){
  const p=api.precess(d.ra_deg,d.dec_deg,context.start);
  const samples=grid.map(g=>{const a=angles(horizontalVector(p.ra,p.dec,context.latitude,g.sidereal));return {...g,...a,terrain:horizonAt(terrain,a.az)};});
  const geometry=s=>s.sun<=-18&&s.alt>=minAlt;
  const verified=s=>geometry(s)&&s.terrain!==null&&s.alt>s.terrain;
  return {geometry:summarizeWindows(intervals(samples,geometry)),verified:summarizeWindows(intervals(samples,verified)),unknown:samples.some(s=>geometry(s)&&s.terrain===null)};
}
