// Version the key whenever the Sonny snapshot or ray-scanning geometry changes.
const HORIZON_VERSION='sonny-2024-rays-v1';
const MAX_PROFILE_BYTES=256000;
function cacheReply(body,status=200){return new Response(body,{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});}
function horizonInput(url){
  const q=url.searchParams;
  if(['lat','lon','eye','fine'].some(k=>!q.has(k)||q.get(k)===''))return null;
  const latitude=Number(q.get('lat')),longitude=Number(q.get('lon')),eyeHeight=Number(q.get('eye')),fine=q.get('fine');
  if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(eyeHeight)||eyeHeight<0||eyeHeight>10000||!['0','1'].includes(fine))return null;
  return {latitude,longitude,eyeHeight,fine:fine==='1'};
}
function validHorizon(p,input){
  const numbers=(a,min,max)=>Array.isArray(a)&&a.length===3600&&a.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max);
  return p&&p.latitude===input.latitude&&p.longitude===input.longitude&&p.eyeHeight===input.eyeHeight&&p.radius===150&&['0.5','1'].includes(String(p.resolution))&&
    (input.fine||String(p.resolution)==='1')&&Number.isFinite(p.ground)&&p.ground>=-1000&&p.ground<=10000&&numbers(p.altitudes,-90,90)&&numbers(p.distances,0,150000)&&
    Array.isArray(p.valid)&&p.valid.length===3600&&p.valid.every(v=>v===0||v===1)&&Array.isArray(p.missing)&&p.missing.length<=256&&p.missing.every(v=>typeof v==='string'&&/^(0\.5|1|3)\/[NS]\d{2}[EW]\d{3}$/.test(v));
}
async function horizonCache(request,env){
  const url=new URL(request.url),input=horizonInput(url);
  if(!['GET','PUT'].includes(request.method))return cacheReply('{"error":"Method not allowed"}',405);
  // Identity headers are supplied by the Sites dispatcher, never by the app UI.
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return cacheReply('{"error":"Sign in to use your terrain cache"}',401);
  if(!input)return cacheReply('{"error":"Invalid location or settings"}',400);
  if(!env?.HORIZONS)return cacheReply('{"error":"Cache unavailable"}',503);
  if(request.method==='PUT'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return cacheReply('{"error":"Invalid request origin or content type"}',403);
  const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
  const key=`${HORIZON_VERSION}/${await hash(user)}/${await hash(JSON.stringify(input))}.json`;
  try{
    if(request.method==='GET'){
      const object=await env.HORIZONS.get(key);
      if(!object)return cacheReply('{"error":"Cache miss"}',404);
      const p=await object.json();
      if(!validHorizon(p,input))return cacheReply('{"error":"Invalid cached profile"}',404);
      const complete=p.valid.every(v=>v===1)&&p.missing.length===0;
      const maxAge=(complete?90:7)*86400000;
      if(Date.now()-object.uploaded.getTime()>maxAge)return cacheReply('{"error":"Cache expired"}',404);
      return cacheReply(JSON.stringify(p));
    }
    if(Number(request.headers.get('Content-Length'))>MAX_PROFILE_BYTES)return cacheReply('{"error":"Profile too large"}',413);
    const reader=request.body?.getReader();if(!reader)return cacheReply('{"error":"Missing profile"}',400);
    const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_PROFILE_BYTES){await reader.cancel();return cacheReply('{"error":"Profile too large"}',413);}chunks.push(value);}
    let p;try{p=JSON.parse(await new Blob(chunks).text());}catch{return cacheReply('{"error":"Invalid JSON"}',400);}
    if(!validHorizon(p,input))return cacheReply('{"error":"Invalid horizon profile"}',422);
    // Store only the expected fields, never arbitrary client metadata.
    const clean={latitude:p.latitude,longitude:p.longitude,eyeHeight:p.eyeHeight,resolution:p.resolution,radius:150,ground:p.ground,altitudes:p.altitudes,distances:p.distances,valid:p.valid,missing:p.missing};
    await env.HORIZONS.put(key,JSON.stringify(clean),{httpMetadata:{contentType:'application/json'}});
    return cacheReply('{"saved":true}');
  }catch(error){console.error('Horizon cache unavailable',error.name);return cacheReply('{"error":"Cache unavailable"}',503);}
}
