import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraWCS,previewCandidates,normalPA,createPreviewLoader} from '../dist/sky-preview.mjs';
import {cameraFrame,equatorialVector,equatorialAngles,unit,add,scale,dot} from '../dist/sky-math.mjs';
const d={id:31,ra_deg:10.6847083,dec_deg:41.26875},width=2.82217732,height=1.88566571;
test('survey WCS footprint matches the globe camera at zero, oblique, quarter turn and polar coordinates',()=>{
  for(const target of [d,{...d,ra_deg:359.9,dec_deg:89.8}])for(const pa of [0,35,90,-27,360]){
    const w=cameraWCS(target,pa,width,height),r=target.ra_deg*Math.PI/180,de=target.dec_deg*Math.PI/180;
    const east=[-Math.sin(r),Math.cos(r),0],north=[-Math.sin(de)*Math.cos(r),-Math.sin(de)*Math.sin(r),Math.cos(de)],centre=equatorialVector(target.ra_deg,target.dec_deg);
    const corners=cameraFrame(target.ra_deg,target.dec_deg,width,height,pa,1).slice(0,4).map(p=>equatorialVector(p.ra,p.dec));
    for(const x of [-470,470])for(const y of [-314,314]){
      const e=(w.CD1_1*x+w.CD1_2*y)*Math.PI/180,n=(w.CD2_1*x+w.CD2_2*y)*Math.PI/180;
      const v=unit(add(centre,add(scale(east,e),scale(north,n))));assert.ok(corners.some(c=>dot(c,v)>1-1e-12));
    }
    assert.equal(w.CRVAL1,target.ra_deg);assert.equal(w.CRVAL2,target.dec_deg);
  }
  const w=cameraWCS(d,0,width,height);assert.ok(w.CD1_1<0&&w.CD2_2>0,'north up, east left');assert.equal(normalPA(-360),0);
});
test('zero rotation reuses table requests; rotated backups preserve WCS and selected survey',()=>{
  const original=['https://example.test/table-image'],api={imageCandidates:id=>{assert.equal(id,31);return original;},fieldWidth:width,fieldHeight:height};
  assert.equal(previewCandidates(api,d,360,'PANSTARRS'),original);
  const urls=previewCandidates(api,d,35,'PANSTARRS');assert.equal(urls.length,4);
  const all=urls.map(u=>new URL(u).searchParams);assert.ok(all[0].get('hips').includes('PanSTARRS'));assert.equal(all[2].get('hips'),'CDS/P/DSS2/color');
  for(const q of all){assert.deepEqual(JSON.parse(q.get('wcs')),cameraWCS(d,35,width,height));assert.equal(q.get('format'),'jpg');}
  assert.equal(new URL(previewCandidates(api,d,35,'https://skyview.gsfc.nasa.gov/cgi-bin/images')[0]).searchParams.get('hips'),'CDS/P/DSS2/red');
});
const tick=()=>new Promise(r=>setTimeout(r,5));
test('rapid target changes ignore stale completions; cache hits and repeated time updates make no requests',async()=>{
  const pending=[],events=[];const request=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});const job={promise,resolve,reject,cancelled:false,cancel(){this.cancelled=true;}};pending.push(job);return job;};
  const loader=createPreviewLoader(request,s=>events.push(s),0);
  loader.load('M31',['first']);await tick();loader.load('M27',['second']);await tick();assert.equal(pending[0].cancelled,true);
  pending[0].resolve({src:'old'});pending[1].resolve({src:'new'});await tick();assert.deepEqual(events.filter(e=>e.phase==='ready').map(e=>e.image.src),['new']);
  loader.load('M27',['second']);await tick();assert.equal(pending.length,2);
  loader.cancel();loader.load('M27',['second']);assert.equal(events.at(-1).image.src,'new');await tick();assert.equal(pending.length,2);
  loader.load('M31',['first']);await tick();loader.cancel();pending[2].resolve({src:'hidden'});await tick();assert.equal(events.filter(e=>e.phase==='ready').at(-1).image.src,'new');
});
test('image failures permit retry and PA changes replace pending images',async()=>{
  let count=0;const events=[];
  const loader=createPreviewLoader(()=>({promise:++count===1?Promise.reject(Error('offline')):Promise.resolve({src:'rotated'}),cancel(){}}),s=>events.push(s),0);
  loader.load('M31:0',[]);await tick();assert.equal(events.at(-1).phase,'error');
  loader.load('M31:0',[]);await tick();assert.equal(events.at(-1).phase,'ready');
  loader.load('M31:45',[]);await tick();assert.equal(count,3);loader.cancel();
});
