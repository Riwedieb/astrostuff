import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {destination,tileName,tileOrigin,elevationAngle,sampleHgt,horizonAt,planTerrain,scanTile,BIN_COUNT} from '../dist/terrain-math.mjs';
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
function raster(n,fn){const view=new DataView(new ArrayBuffer(n*n*2));for(let y=0;y<n;y++)for(let x=0;x<n;x++)view.setInt16((y*n+x)*2,fn(x,y));return view;}
test('HGT coordinates, signed elevations, interpolation and voids',()=>{
  assert.equal(tileName(-.1,-.1),'S01W001');assert.deepEqual(tileOrigin('S01W001'),{lat:-1,lon:-1});
  const v=raster(3,(x,y)=>x*100-y*200),o={lat:47,lon:8};
  close(sampleHgt(v,3,o,48,8),0);close(sampleHgt(v,3,o,47,9),-200);close(sampleHgt(v,3,o,47.75,8.25),-50);
  assert.equal(sampleHgt(v,3,o,46.9,8),null);v.setInt16(0,-32768);assert.equal(sampleHgt(v,3,o,47.75,8.25),null);
});
test('great-circle directions, longitude wrap and Earth curvature',()=>{
  close(destination(0,0,90,100000).lat,0);assert.ok(destination(0,179.99,90,100000).lon<0);
  close(destination(47,8,0,0).lat,47);close(elevationAngle(100,100,100000),-100000/6371008.8/2*180/Math.PI);
  assert.ok(elevationAngle(1000,100,10000)>5);assert.ok(elevationAngle(0,2,5000)<0);
});
test('horizon interpolates across north and keeps incomplete directions unknown',()=>{
  const p={altitudes:[0,10,20,30],valid:[1,1,1,1]};close(horizonAt(p,315),15);close(horizonAt(p,-45),15);
  p.valid[0]=0;assert.equal(horizonAt(p,315),null);
});
test('terrain plan follows location and resolution, retaining unavailable tiles',()=>{
  const tiles=JSON.parse(readFileSync(new URL('../dist/terrain/coverage.json',import.meta.url))).tiles;
  const zurich=planTerrain(47.411,8.544,tiles),ascona=planTerrain(46.154,8.773,tiles);
  assert.equal(zurich.origin,'N47E008');assert.equal(ascona.origin,'N46E008');assert.equal(zurich.originRes,'0.5');
  assert.ok(zurich.tasks.some(t=>t.res==='3'));assert.equal(planTerrain(47.411,8.544,tiles,false).originRes,'1');
  const sparse=planTerrain(47.411,8.544,{'0.5':[],'1':['N47E008'],'3':[]},false);assert.ok(sparse.tasks.some(t=>!t.available));
  assert.throws(()=>planTerrain(-33.8,151.2,tiles),/No Sonny/);
});
test('ray scan resolves a ridge and does not mistake missing heights for flat ground',()=>{
  const n=1001,view=raster(n,(x,y)=>y===400?1000:100),profile={altitudes:Array(BIN_COUNT).fill(-90),distances:Array(BIN_COUNT).fill(0),valid:Array(BIN_COUNT).fill(1)};
  const task={name:'N47E008',res:'0.5',segments:[{bin:0,start:1,end:24000}]};
  scanTile(view,n,task,47.5,8.5,102,profile);
  // A thin, linearly interpolated ridge can peak between radial samples.
  assert.ok(profile.altitudes[0]>4.3&&profile.altitudes[0]<4.7);assert.ok(profile.distances[0]>11000&&profile.distances[0]<11200);
  view.setInt16((400*n+500)*2,-32768);scanTile(view,n,task,47.5,8.5,102,profile);assert.equal(profile.valid[0],0);
});
