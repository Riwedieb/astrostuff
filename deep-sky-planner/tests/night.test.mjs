import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intervals,summarizeWindows,objectWindows,buildNightGrid,fromDusk} from '../dist/night-math.mjs';
const extras=JSON.parse(readFileSync(new URL('../dist/deep-catalog.json',import.meta.url))).objects;
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const messier=JSON.parse(html.match(/const CATALOG=(\[.*?\]);/s)[1]);
test('shortlist adds 100–200 unique real targets without duplicating Messier identities',()=>{
  assert.ok(extras.length>=100&&extras.length<=200);assert.equal(new Set([...extras,...messier].map(d=>d.id)).size,extras.length+110);
  const messierNGC=new Set(messier.map(d=>Number(d.ngc)));
  for(const d of extras){assert.ok(Number.isFinite(d.ra_deg)&&d.ra_deg>=0&&d.ra_deg<360);assert.ok(d.dec_deg>=-12.589&&d.dec_deg<=90);assert.ok(d.mag===null||Number.isFinite(d.mag));if(d.ngc)assert.ok(!messierNGC.has(Number(d.ngc)));}
  for(const name of ['NGC 7000','NGC 6888','NGC 7023','IC 1805'])assert.ok(extras.some(d=>d.designation===name),name);
});
test('continuous criterion never adds disconnected windows to reach two hours',()=>{
  const samples=Array.from({length:8},(_,i)=>({t:i*1800000,ok:i!==3}));
  const r=summarizeWindows(intervals(samples,s=>s.ok));assert.equal(r.total,2.5*3600000);assert.equal(r.continuous,1.5*3600000);assert.equal(r.windows.length,2);
});
test('missing terrain cannot produce verified windows; high ridges block a target',()=>{
  const context={latitude:45,longitude:0,start:0,end:3*3600000};
  const api={precess:(ra,dec)=>({ra,dec})},d={ra_deg:0,dec_deg:45};
  const grid=Array.from({length:37},(_,i)=>({t:i*300000,sidereal:60,sun:-25}));
  const empty=objectWindows(api,d,context,grid,30,null);assert.equal(empty.geometry.continuous,context.end);assert.equal(empty.verified.continuous,0);assert.equal(empty.unknown,true);
  const terrain=h=>({altitudes:Array(3600).fill(h),valid:Array(3600).fill(1)});
  assert.equal(objectWindows(api,d,context,grid,30,terrain(0)).verified.continuous,context.end);
  assert.equal(objectWindows(api,d,context,grid,30,terrain(80)).verified.continuous,0);
  const broken=terrain(0);broken.valid.fill(0);assert.equal(objectWindows(api,d,context,grid,30,broken).verified.continuous,0);
  assert.equal(objectWindows(api,d,context,grid.map(s=>({...s,sun:-10})),30,terrain(0)).geometry.continuous,0);
});
test('time grid honors actual DST interval length and includes its final endpoint',()=>{
  const api={sunRaDec:()=>({ra:0,dec:0}),gmst:()=>0};
  for(const hours of [23,24,25]){const grid=buildNightGrid(api,{start:0,end:hours*3600000,latitude:47,longitude:8});assert.equal(grid.at(-1).t,hours*3600000);assert.equal(grid.length,hours*12+1);}
});

test('dusk criterion excludes later starts and never resumes after a gap',()=>{
  const step=5*60000,dusk=step;
  const samples=Array.from({length:50},(_,i)=>({t:i*step,ok:true}));
  assert.equal(fromDusk(samples,s=>s.ok,dusk).continuous,4*3600000);
  samples[1].ok=false;
  assert.equal(fromDusk(samples,s=>s.ok,dusk).continuous,0,'later rising does not qualify');
  samples[1].ok=true;samples[24].ok=false;
  assert.equal(fromDusk(samples,s=>s.ok,dusk).continuous,110*60000,'later recovery cannot supply two hours');
  samples[24].ok=true;samples[26].ok=false;
  assert.equal(fromDusk(samples,s=>s.ok,dusk).continuous,2*3600000,'exactly two continuous hours qualify');
  assert.equal(fromDusk(samples,s=>s.ok,null).continuous,0,'polar day or night has no invented start');
});
test('night grid inserts the evening −12 degree crossing, not morning or −18 degrees',()=>{
  const hour=3600000,dusk=12*hour+123456;
  const context={start:0,end:24*hour,latitude:0,longitude:0};
  const api={sunRaDec:t=>({ra:102+(t-dusk)/hour,dec:0}),gmst:()=>0};
  const grid=buildNightGrid(api,context);
  assert.ok(Math.abs(grid.dusk-dusk)<=1);
  assert.ok(grid.some(s=>s.t===grid.dusk));
  assert.ok(Math.abs(grid.find(s=>s.t===grid.dusk).sun+12)<0.000001);
  const morning=buildNightGrid({...api,sunRaDec:t=>({ra:102-(t-dusk)/hour,dec:0})},context);
  assert.equal(morning.dusk,null);
});
test('anchored twilight visibility honors altitude and verified terrain independently of dark windows',()=>{
  const context={latitude:45,longitude:0,start:0,end:3*3600000};
  const api={precess:(ra,dec)=>({ra,dec})},d={ra_deg:0,dec_deg:45};
  const grid=Array.from({length:37},(_,i)=>({t:i*300000,sidereal:60,sun:i<12?-12:-25}));grid.dusk=0;
  const profile=h=>({altitudes:Array(3600).fill(h),valid:Array(3600).fill(1)});
  const clear=objectWindows(api,d,context,grid,30,profile(0));
  assert.equal(clear.geometry.continuous,2*3600000);
  assert.equal(clear.verified.fromDusk.continuous,3*3600000);
  assert.equal(objectWindows(api,d,context,grid,30,null).verified.fromDusk.continuous,0);
  assert.equal(objectWindows(api,d,context,grid,30,profile(80)).verified.fromDusk.continuous,0);
  const rising=grid.map((s,i)=>({...s,sidereal:i<6?180:60}));rising.dusk=0;
  assert.equal(objectWindows(api,d,context,rising,30,profile(0)).geometry.fromDusk.continuous,0);
});
