import {BIN_COUNT,planTerrain,tileOrigin,sampleHgt,scanTile} from './terrain-math.mjs';
const CACHE='messier-sonny-2024-v1';

export async function unzipHgt(buffer,name,res) {
  const v=new DataView(buffer),expected=(3600/Number(res)+1)**2*2;
  let end=-1;
  for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw Error('Invalid terrain ZIP.');
  let pos=v.getUint32(end+16,true),found=null;
  for(let i=0;i<v.getUint16(end+10,true);i++) {
    if(v.getUint32(pos,true)!==0x02014b50)throw Error('Invalid ZIP directory.');
    const n=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true);
    const filename=new TextDecoder().decode(new Uint8Array(buffer,pos+46,n));
    if(filename.split('/').pop().toUpperCase()===name+'.HGT')found={method:v.getUint16(pos+10,true),compressed:v.getUint32(pos+20,true),size:v.getUint32(pos+24,true),offset:v.getUint32(pos+42,true),crc:v.getUint32(pos+16,true)};
    pos+=46+n+extra+comment;
  }
  if(!found||found.size!==expected)throw Error('Unexpected terrain grid size.');
  const o=found.offset;if(v.getUint32(o,true)!==0x04034b50)throw Error('Invalid ZIP entry.');
  const start=o+30+v.getUint16(o+26,true)+v.getUint16(o+28,true);
  const compressed=new Blob([new Uint8Array(buffer,start,found.compressed)]);
  const stream=found.method===8?compressed.stream().pipeThrough(new DecompressionStream('deflate-raw')):found.method===0?compressed.stream():null;
  if(!stream)throw Error('Unsupported terrain compression.');
  // Fixed-sized destination bounds decompression memory and rejects malformed files.
  const bytes=new Uint8Array(expected),reader=stream.getReader();let count=0;
  while(true){const {done,value}=await reader.read();if(done)break;if(count+value.length>expected){await reader.cancel();throw Error('Oversized terrain grid.');}bytes.set(value,count);count+=value.length;}
  if(count!==expected)throw Error('Incomplete terrain grid.');
  const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c;}
  let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);
  if(((crc^0xffffffff)>>>0)!==found.crc)throw Error('Terrain checksum failed.');
  return {view:new DataView(bytes.buffer),size:Math.sqrt(expected/2)};
}

async function tile(task,progress) {
  const url=`/api/terrain/${task.res}/${task.name}.zip`;let cache,cached;
  try{cache=await caches.open(CACHE);cached=await cache.match(url);}catch{}
  let response=cached||await fetch(url,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error('Terrain download failed.');
  let count=0;const chunks=[],reader=response.body.getReader(),total=Number(response.headers.get('Content-Length'));
  while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>85000000){await reader.cancel();throw Error('Terrain tile is too large.');}chunks.push(value);progress(count,total,!!cached);}
  const blob=new Blob(chunks),buffer=await blob.arrayBuffer();
  const result=await unzipHgt(buffer,task.name,task.res);
  if(cache&&!cached)try{
    // Best-effort device cache, limited to 100 MB. Failure never blocks terrain.
    let entries=await cache.keys(),used=0;
    for(const key of entries)used+=Number((await cache.match(key)).headers.get('Content-Length'))||0;
    while(entries.length&&used+count>100000000){const key=entries.shift();used-=Number((await cache.match(key)).headers.get('Content-Length'))||0;await cache.delete(key);}
    await cache.put(url,new Response(blob,{headers:{'Content-Length':String(count)}}));
  }catch{}
  return result;
}

export async function runTerrain(input,report,load=tile,coverage=null) {
  // This measured preset uses the identical ray scanner. Other locations and
  // heights always load their own tiles, never reuse the default skyline.
  if(!coverage&&input.fine&&input.eyeHeight===2&&Math.abs(input.latitude-47.411)<1e-9&&Math.abs(input.longitude-8.544)<1e-9)try{
    const response=await fetch('/terrain/zurich-oerlikon.json');
    if(response.ok){const preset=await response.json();if(preset.latitude===input.latitude&&preset.longitude===input.longitude&&preset.valid.length===BIN_COUNT)return preset;}
  }catch{}
  if(!coverage){const response=await fetch('/terrain/coverage.json');if(!response.ok)throw Error('Terrain coverage list unavailable.');coverage=(await response.json()).tiles;}
  report({type:'progress',text:'Planning terrain rays…'});
  const plan=planTerrain(input.latitude,input.longitude,coverage,input.fine);
  const profile={altitudes:Array(BIN_COUNT).fill(-90),distances:Array(BIN_COUNT).fill(0),valid:Array(BIN_COUNT).fill(1),missing:[],resolution:plan.originRes,eyeHeight:input.eyeHeight,radius:150,latitude:input.latitude,longitude:input.longitude};
  const originTask=plan.tasks.find(t=>t.name===plan.origin&&t.res===plan.originRes);
  plan.tasks.splice(plan.tasks.indexOf(originTask),1);plan.tasks.unshift(originTask);
  let observer=null;
  for(let i=0;i<plan.tasks.length;i++) {
    const task=plan.tasks[i];
    try {
      if(!task.available)throw Error('Tile not available.');
      let last=0;
      const data=await load(task,(bytes,total,cached)=>{
        if(Date.now()-last<300)return;last=Date.now();
        report({type:'progress',text:`Terrain ${i+1}/${plan.tasks.length} · ${task.name} · ${cached?'cached · ':''}${(bytes/1e6).toFixed(1)}${total?'/'+(total/1e6).toFixed(1):''} MB`});
      });
      if(i===0){const z=sampleHgt(data.view,data.size,tileOrigin(task.name),input.latitude,input.longitude);if(z===null)throw Error('No elevation at the observing location.');profile.ground=z;observer=z+input.eyeHeight;}
      report({type:'progress',text:`Calculating horizon · tile ${i+1}/${plan.tasks.length}…`});
      scanTile(data.view,data.size,task,input.latitude,input.longitude,observer,profile);
    }catch(error){
      if(i===0)throw Error(`Terrain unavailable: ${error.message}`);
      profile.missing.push(task.res+'/'+task.name);for(const seg of task.segments)profile.valid[seg.bin]=0;
    }
  }
  for(let i=0;i<BIN_COUNT;i++)if(profile.altitudes[i]===-90)profile.valid[i]=0;
  return profile;
}
if(typeof self!=='undefined')self.onmessage=async({data})=>{
  try{self.postMessage({type:'done',profile:await runTerrain(data,message=>self.postMessage(message))});}
  catch(error){self.postMessage({type:'error',text:error.message||'Terrain could not be loaded.'});}
};
