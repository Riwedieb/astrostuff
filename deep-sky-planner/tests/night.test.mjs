import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intervals,summarizeWindows,objectWindows,buildNightGrid} from '../dist/night-math.mjs';
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
