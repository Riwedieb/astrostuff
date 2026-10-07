import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horizonAt} from '../dist/terrain-math.mjs';
import {cachedTerrain} from '../dist/horizon-cache.mjs';
const source=readFileSync(new URL('../worker/horizon-cache.mjs',import.meta.url),'utf8');
const {horizonCache}=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {horizonCache};').toString('base64'));
const input={latitude:46.154,longitude:8.77,eyeHeight:2,fine:true};
const profile={...input,resolution:'0.5',radius:150,ground:200,altitudes:Array(3600).fill(8),distances:Array(3600).fill(1000),valid:Array(3600).fill(1),missing:[]};
const path='https://site.test/api/horizon?lat=46.154&lon=8.77&eye=2&fine=1';
function req(user='alice',method='GET',p=profile,url=path){return new Request(url,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:'https://site.test','Content-Type':'application/json'},...(method==='PUT'?{body:JSON.stringify(p)}:{})});}
function storage(){const map=new Map();return {map,HORIZONS:{get:async key=>map.get(key),put:async(key,body)=>map.set(key,{uploaded:new Date(),json:async()=>JSON.parse(body)})}};}
test('durable cache round trip is private, exact-settings keyed and expires',async()=>{
  const env=storage();
  assert.equal((await horizonCache(req(),env)).status,404);
  assert.equal((await horizonCache(req('alice','PUT'),env)).status,200);
  const response=await horizonCache(req(),env);assert.equal(response.status,200);assert.equal((await response.json()).ground,200);assert.match(response.headers.get('Cache-Control'),/private, no-store/);
  assert.equal((await horizonCache(req('bob'),env)).status,404);
  assert.equal((await horizonCache(req('', 'PUT'),env)).status,401);
  for(const url of [path.replace('eye=2','eye=3'),path.replace('fine=1','fine=0'),path.replace('lat=46.154','lat=46.155')])assert.equal((await horizonCache(req('alice','GET',null,url),env)).status,404);
  env.map.values().next().value.uploaded=new Date(0);assert.equal((await horizonCache(req(),env)).status,404);
});
test('cache rejects cross-origin, malformed and oversized profiles',async()=>{
  const env=storage();const foreign=req('alice','PUT');foreign.headers.set('Origin','https://foreign.test');assert.equal((await horizonCache(foreign,env)).status,403);
  for(const invalid of [{...profile,valid:[2,...profile.valid.slice(1)]},{...profile,latitude:0},{...profile,altitudes:[100,...profile.altitudes.slice(1)]},{...profile,missing:['tile']}])assert.equal((await horizonCache(req('alice','PUT',invalid),env)).status,422);
  assert.equal((await horizonCache(req('alice','PUT',{extra:'a'.repeat(256001)}),env)).status,413);
  assert.equal((await horizonCache(req(),{})).status,503);
  const bad=storage();bad.HORIZONS.get=async()=>{throw Error('outage');};assert.equal((await horizonCache(req(),bad)).status,503);
  assert.equal(env.map.size,0);
});
test('browser uses hit without computing; miss computes and saves; refresh bypasses hit',async()=>{
  let computed=0,puts=0;const compute=async()=>{computed++;return profile;};const report=()=>{};
  const fetcher=async(url,options)=>{if(options.method==='PUT'){puts++;return new Response('{}');}return new Response(JSON.stringify(profile));};
  assert.deepEqual(await cachedTerrain(input,compute,report,fetcher),profile);assert.equal(computed,0);
  await cachedTerrain({...input,refresh:true},compute,report,fetcher);assert.equal(computed,1);assert.equal(puts,1);
  await cachedTerrain(input,compute,report,async(url,o)=>o.method==='PUT'?(puts++,new Response('{}')):new Response('{}',{status:404}));assert.equal(computed,2);assert.equal(puts,2);
});
test('anonymous, unavailable cache never blocks local terrain',async()=>{
  for(const status of [401,503]){let calls=0;const value=await cachedTerrain(input,async()=>profile,()=>{},async()=>{calls++;return new Response('{}',{status});});assert.equal(value,profile);assert.equal(calls,1);}

  assert.equal(await cachedTerrain(input,async()=>profile,()=>{},async()=>{throw Error('offline');}),profile);
});

test('partial profiles preserve unknown directions and missing tiles through storage',async()=>{
  const env=storage(),partial={...profile,valid:[0,...profile.valid.slice(1)],missing:['3/N46E009']};
  assert.equal((await horizonCache(req('alice','PUT',partial),env)).status,200);
  const result=await (await horizonCache(req(),env)).json();
  assert.deepEqual(result.valid,partial.valid);assert.deepEqual(result.missing,partial.missing);
  assert.equal(horizonAt(result,0),null);assert.equal(horizonAt(result,90),8);
  const stored=env.map.values().next().value;
  stored.uploaded=new Date(Date.now()-6*86400000);assert.equal((await horizonCache(req(),env)).status,200);
  stored.uploaded=new Date(Date.now()-8*86400000);assert.equal((await horizonCache(req(),env)).status,404);
  await horizonCache(req('alice','PUT'),env);env.map.values().next().value.uploaded=new Date(Date.now()-8*86400000);assert.equal((await horizonCache(req(),env)).status,200);
});
test('browser saves and reuses partial profiles without recomputing or hiding gaps',async()=>{
  const env=storage(),partial={...profile,valid:[0,...profile.valid.slice(1)],missing:['1/N46E009']};let computed=0;const messages=[];
  const fetcher=async(url,options)=>horizonCache(new Request('https://site.test'+url,{...options,headers:{...options.headers,'oai-authenticated-user-id':'alice',Origin:'https://site.test'}}),env);
  const compute=async()=>{computed++;return partial;},report=m=>messages.push(m.text);
  await cachedTerrain(input,compute,report,fetcher);assert.ok(messages.includes('Terrain saved · incomplete'));
  const result=await cachedTerrain(input,compute,report,fetcher);assert.equal(computed,1);assert.ok(messages.includes('Saved terrain · incomplete'));assert.equal(horizonAt(result,0),null);
  await cachedTerrain({...input,refresh:true},compute,report,fetcher);assert.equal(computed,2);
});
