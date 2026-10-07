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
  const at=t=>{const s=api.sunRaDec(t),sidereal=api.gmst(t)+context.longitude;return {t,sidereal,sun:angles(horizontalVector(s.ra,s.dec,context.latitude,sidereal)).alt};};
  for(let t=context.start;t<context.end+step;t+=step){const time=Math.min(t,context.end);grid.push(at(time));if(time===context.end)break;}
  grid.dusk=null;
  for(let i=1;i<grid.length;i++){
    if(grid[i-1].sun>=-12&&grid[i].sun<-12){
      let lo=grid[i-1].t,hi=grid[i].t;
      while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(at(mid).sun>-12)lo=mid;else hi=mid;}
      grid.dusk=hi;
      if(hi!==grid[i].t)grid.splice(i,0,at(hi));
      break;
    }
  }
  return grid;
}
// Only the uninterrupted interval beginning at dusk qualifies; later recovery does not.
export function fromDusk(samples,predicate,dusk){
  if(dusk===null||dusk===undefined)return summarizeWindows([]);
  return summarizeWindows(intervals(samples.filter(s=>s.t>=dusk),predicate).filter(w=>w.start===dusk));
}
export function objectWindows(api,d,context,grid,minAlt,terrain){
  const p=api.precess(d.ra_deg,d.dec_deg,context.start);
  const samples=grid.map(g=>{const a=angles(horizontalVector(p.ra,p.dec,context.latitude,g.sidereal));return {...g,...a,terrain:horizonAt(terrain,a.az)};});
  const geometry=s=>s.sun<=-18&&s.alt>=minAlt;
  const verified=s=>geometry(s)&&s.terrain!==null&&s.alt>s.terrain;
  const duskGeometry=s=>s.sun<=-12&&s.alt>=minAlt;
  const duskVerified=s=>duskGeometry(s)&&s.terrain!==null&&s.alt>s.terrain;
  return {dusk:grid.dusk??null,geometry:{...summarizeWindows(intervals(samples,geometry)),fromDusk:fromDusk(samples,duskGeometry,grid.dusk)},verified:{...summarizeWindows(intervals(samples,verified)),fromDusk:fromDusk(samples,duskVerified,grid.dusk)},unknown:samples.some(s=>duskGeometry(s)&&s.terrain===null)};
}
