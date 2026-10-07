// ASSETS is supplied by the build. No arbitrary proxy URLs or credentials.
const directories={'0.5':'dtm-0.5s','1':'dtm-all-1s','3':'dtm-all-3s'};
const coverage=JSON.parse(ASSETS['/terrain/coverage.json']).tiles;
export default {
  async fetch(request) {
    const url=new URL(request.url),path=url.pathname;
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    if(path.startsWith('/api/terrain/')) {
      const match=/^\/api\/terrain\/(0\.5|1|3)\/([NS]\d{2}[EW]\d{3})\.zip$/.exec(path);
      if(!match||!coverage[match[1]].includes(match[2]))return new Response('Terrain tile unavailable',{status:404});
      try {
        const upstream=await fetch(`https://static.routeconverter.com/sonny/${directories[match[1]]}/${match[2]}.zip`,{
          method:request.method,redirect:'error',signal:AbortSignal.timeout(120000),cf:{cacheTtl:604800,cacheEverything:true}
        });
        if(!upstream.ok)return new Response('Terrain provider temporarily unavailable',{status:502});
        const headers=new Headers({'Content-Type':'application/zip','Cache-Control':'public, max-age=604800','X-Content-Type-Options':'nosniff'});
        const length=upstream.headers.get('Content-Length');if(length)headers.set('Content-Length',length);
        return new Response(upstream.body,{headers}); // Stream: never inflate or buffer HGT on the server.
      }catch{return new Response('Terrain download failed; please retry',{status:502});}
    }
    const key=path==='/'?'/index.html':path,body=ASSETS[key];
    if(body===undefined)return new Response('Not found',{status:404});
    const ext=key.split('.').pop(),type={html:'text/html',css:'text/css',mjs:'text/javascript',json:'application/json',txt:'text/plain'}[ext]||'application/octet-stream';
    return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  }
};
