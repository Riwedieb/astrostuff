import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Preserve the authored static application; add only a streaming terrain gateway.
const assets={};
async function collect(dir,prefix='') {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if(entry.name==='server'||entry.name.startsWith('.'))continue;
    const path=dir+'/'+entry.name,url=prefix+'/'+entry.name;
    if(entry.isDirectory())await collect(path,url);
    else assets[url]=await readFile(path,'utf8');
  }
}
await collect('dist');
// One release identifier across HTML, imports and worker dependencies prevents
// an old cached module from being combined with a newly deployed application.
const revision=createHash('sha256').update(JSON.stringify(Object.entries(assets).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,16);
for(const key of Object.keys(assets)){
  if(/\.(html|m?js)$/.test(key))assets[key]=assets[key].replace(/(['"])(\.\/[^'"\s?]+\.(?:m?js|css))\1/g,(_,quote,path)=>`${quote}${path}?v=${revision}${quote}`);
}
assets['/index.html']=assets['/index.html'].replace('</head>',`<meta name="app-build" content="${revision}"></head>`);
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+await readFile('worker/horizon-cache.mjs','utf8')+'\n'+await readFile('worker/gateway.mjs','utf8'));
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log(`Built Worker with ${Object.keys(assets).length} assets.`);
