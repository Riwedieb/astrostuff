import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const assets={'/index.html':'<main>Planner</main>','/terrain/coverage.json':readFileSync(new URL('../dist/terrain/coverage.json',import.meta.url),'utf8'),'/terrain-worker.mjs':'export {};'};
const source='const ASSETS='+JSON.stringify(assets)+';\n'+readFileSync(new URL('../worker/gateway.mjs',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('gateway serves app and module MIME types and rejects arbitrary proxy paths',async()=>{
  const request=p=>new Request('https://example.test'+p);
  assert.equal(await (await worker.fetch(request('/'))).text(),assets['/index.html']);
  assert.match((await worker.fetch(request('/terrain-worker.mjs'))).headers.get('Content-Type'),/javascript/);
  for(const p of ['/api/terrain/1/N00E000.zip','/api/terrain/1/https://evil.test.zip','/missing'])assert.equal((await worker.fetch(request(p))).status,404);
  assert.equal((await worker.fetch(new Request('https://example.test/',{method:'POST'}))).status,405);
});
test('terrain gateway streams the exact allowlisted upstream and reports failures',async()=>{
  const original=globalThis.fetch;let requested;
  try{
    globalThis.fetch=async(url,options)=>{requested=url;assert.equal(options.redirect,'error');return new Response('zip bytes',{headers:{'Content-Length':'9'}});};
    const response=await worker.fetch(new Request('https://example.test/api/terrain/0.5/N47E008.zip'));
    assert.equal(requested,'https://static.routeconverter.com/sonny/dtm-0.5s/N47E008.zip');assert.equal(await response.text(),'zip bytes');assert.equal(response.headers.get('Content-Type'),'application/zip');
    globalThis.fetch=async()=>new Response('unavailable',{status:503});
    assert.equal((await worker.fetch(new Request('https://example.test/api/terrain/0.5/N47E008.zip'))).status,502);
  }finally{globalThis.fetch=original;}
});
