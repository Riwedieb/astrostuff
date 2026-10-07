import {initDeepPlanner} from './deep-planner.mjs';
import {DEG,clamp,wrap,dot,scale,add,unit,cross,horizontalVector,direction,angles,cameraFrame,projection,earthNormal} from './sky-math.mjs';
import {horizonAt} from './terrain-math.mjs';

const planner=window.MessierPlanner;
if(planner) initSky(planner);

function initSky(api){
  const $=id=>document.getElementById(id);
  const table=document.querySelector('table');
  const main=document.querySelector('main');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const tabbar=document.createElement('div');
  tabbar.className='view-switch';tabbar.setAttribute('role','tablist');tabbar.setAttribute('aria-label','Planner view');
  tabbar.innerHTML='<button id="catalog-tab" role="tab" aria-selected="true" aria-controls="catalog-view">Catalog</button><button id="sky-tab" role="tab" aria-selected="false" aria-controls="sky-panel" tabindex="-1">3D Sky</button>';
  document.querySelector('.setup').after(tabbar);
  // The location and date controls are shared by both views.
  const astroControls=document.querySelector('.astro-controls'),meta=document.querySelector('.astro-meta');
  tabbar.after(astroControls);astroControls.after(meta);
  const catalogPanel=document.createElement('section');catalogPanel.id='catalog-view';catalogPanel.setAttribute('role','tabpanel');catalogPanel.setAttribute('aria-labelledby','catalog-tab');
  const catalogElements=[...main.children].filter(el=>el===table||el.matches('.lead,.note,.notice,.controls,#counts,.print-note,noscript,#empty,details,.refs'));
  meta.after(catalogPanel);catalogElements.forEach(el=>catalogPanel.append(el));
  const panel=document.createElement('section');panel.id='sky-panel';panel.className='sky-panel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','sky-tab');
  panel.innerHTML=`
    <div class="sky-toolbar">
      <label class="sky-target">Go to object<select id="sky-target"></select></label>
      <button class="action" id="sky-globe" aria-pressed="true">Sky globe</button>
      <button class="action" id="sky-observer" aria-pressed="false">Observer view</button>
      <button class="action" id="sky-frame">Zoom to camera</button>
      <label>Camera PA (°)<input id="sky-pa" type="number" min="-360" max="360" step="1" value="0"></label>
    </div>
    <div class="sky-terrain-controls">
      <label class="sky-check"><input id="sky-terrain" type="checkbox" checked>Sonny terrain</label>
      <label>Detail<select id="sky-terrain-detail"><option value="fine">Fine · up to 0.5″</option><option value="standard">Standard · 1″</option></select></label>
      <label>Observer height (m)<input id="sky-eye-height" type="number" value="2" min="0" max="10000" step="0.5"></label>
      <button class="action" id="sky-terrain-retry" hidden>Retry terrain</button>
      <span id="sky-cache-status"></span><p id="sky-terrain-status" role="status">Terrain not loaded</p>
    </div>
    <div class="sky-workspace">
      <div class="sky-stage">
        <canvas id="sky-canvas" tabindex="0" aria-label="Interactive 3D sky. Drag or use arrow keys to rotate; scroll or use plus and minus to zoom. Select a deep-sky object using Go to object." aria-describedby="sky-instructions">Use the object selector for altitude and azimuth of all selected deep-sky objects.</canvas>
        <div class="sky-stage-head"><span><b id="sky-view-name">Sky globe</b><br><span id="sky-view-direction"></span></span><span id="sky-day-state"></span></div>
        <div class="sky-canvas-tools"><button class="action" id="sky-zoom-in" aria-label="Zoom in">+</button><button class="action" id="sky-zoom-out" aria-label="Zoom out">−</button><button class="action" id="sky-reset">Reset view</button></div>
      </div>
      <aside class="sky-side" aria-label="Selected object">
        <div><h2 id="sky-object-id">M31</h2><div class="sky-object-name" id="sky-object-name"></div><div class="sky-object-type" id="sky-object-type"></div></div>
        <dl class="sky-stats"><div><dt>Altitude</dt><dd id="sky-alt"></dd></div><div><dt>Azimuth</dt><dd id="sky-az"></dd></div></dl>
        <p id="sky-visibility" class="sky-visibility" role="status"></p>
        <div><p id="sky-size"></p><p id="sky-camera-info" class="note">Camera · 2.82° × 1.89°</p></div>
        <button class="action" id="sky-catalog-object">Open in catalog</button>
        <label class="sky-check"><input id="sky-below" type="checkbox" checked>Show obscured objects</label>
        <details><summary>Terrain clearance</summary><p id="sky-terrain-clearance" class="note"></p></details>
        <div class="sky-earth"><h3>Earth · day / night</h3><canvas id="sky-earth" width="176" height="176" role="img" aria-label="Earth day and night boundary, centred on the observer"></canvas></div>
      </aside>
    </div>
    <div class="sky-timeline">
      <div class="sky-time-row"><output id="sky-time-label" for="sky-time"></output><button class="action" id="sky-now">Now</button><button class="action" id="sky-play" aria-pressed="false">▶ Play</button><label>Speed<select id="sky-speed"><option value="10">10 min / s</option><option value="30" selected>30 min / s</option><option value="60">1 hour / s</option></select></label></div>
      <div id="sky-night-track" class="sky-night-track" aria-hidden="true"></div>
      <label for="sky-time" class="sky-time-label">Time</label><input id="sky-time" type="range" min="0" max="1440" step="1" value="720">
      <div class="sky-time-ticks" id="sky-time-ticks" aria-hidden="true"></div>
    </div>
    <div class="sky-foot"><div class="sky-legend"><span class="galaxy">Galaxies</span><span class="nebula">Nebulae</span><span class="cluster">Clusters / other</span><span class="camera">Camera</span></div><span id="sky-count"></span></div>
    <div class="sky-help"><details><summary>Controls &amp; accuracy</summary><p id="sky-instructions">Drag to rotate · pinch or scroll to zoom · click a target to centre. Keyboard: arrows and + / −. Dashed targets are obscured. Earth inset: observer at centre, amber line marks day / night.</p><p>The globe shows sky directions, not object distances. The turquoise disc is the geometric horizon; the green silhouette is the calculated terrain. The camera rectangle uses your 477 mm focal length and 23.5 × 15.7 mm sensor, projected onto the celestial sphere. PA is measured from J2000 celestial north towards east; PA 0 matches the catalog images. “Zoom to camera” preserves the camera’s true angular size.</p><p>Terrain: <a href="https://sonny.4lima.de/" target="_blank" rel="noopener">Sonny’s Digital Terrain Models</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, via the <a href="https://static.routeconverter.com/sonny/" target="_blank" rel="noopener">RouteConverter mirror</a> (2024 files). This app derives a horizon sampled every 0.1°: 0.5″ where available, otherwise 1″, within 25 km; 3″ from 25–150 km. 0.5″ is about 10 × 15 m in Switzerland. Tiles may contain coarser source data outside LiDAR coverage. Earth curvature is included; atmospheric refraction, buildings and trees are not. Mountains beyond 150 km and narrow features between samples can be missed. Incomplete directions remain unknown. The first load can download tens of MB; terrain tiles are cached on this device when possible. Choose Standard for smaller downloads.</p><p>Positions use the catalog’s J2000 coordinates, precessed to the selected date, and the same sidereal-time and solar calculations as the altitude charts. Refraction, nutation and stellar proper motions are not included. Catalog altitude charts retain the geometric horizon. The small Earth is a schematic globe with the geometric solar terminator; sky brightness is illustrative. Azimuth runs clockwise from north: N 0°, E 90°, S 180°, W 270°.</p></details></div>`;
  catalogPanel.after(panel);
  api.catalog.forEach(d=>{
    const option=document.createElement('option');option.value=d.id;option.textContent=`${d.designation}${d.name?' · '+d.name:''}`;$('sky-target').append(option);
    const button=document.createElement('button');button.className='action sky-row-button';button.type='button';button.textContent='3D Sky';button.setAttribute('aria-label',`View ${d.designation} in 3D Sky`);
    button.addEventListener('click',()=>{setTab(true);select(d.id);panel.scrollIntoView({block:'start',behavior:reducedMotion.matches?'instant':'smooth'});});
    $(`m${d.id}`).querySelector('.object').append(button);
  });
  const canvas=$('sky-canvas'),ctx=canvas.getContext('2d'),earthCanvas=$('sky-earth'),earthCtx=earthCanvas.getContext('2d');
  if(!ctx){panel.innerHTML='<p class="notice">This browser cannot draw the 3D sky. Please open the planner in a browser with canvas support. The catalog remains available.</p>';tabbar.querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{panel.hidden=!i;catalogPanel.hidden=!!i;}));return;}
  let context=api.getContext(),ms=context.midnight,selected=31,mode='globe',az=25,alt=25,zoom=1,fov=65,pa=0;
  let active=false,playing=false,frameId=0,lastTime=0,tween=null,trackTarget=false,dirty=true,earthDirty=true;
  let w=900,h=600,objects=[],sun=[],hitTargets=[],cameraPoints=[],equator=[],northPole=[];
  let filteredIds=new Set(api.catalog.map(d=>d.id));
  let terrain=null,terrainWorker=null,terrainKey='',terrainMaskKey='',terrainPoints=[];
  const terrainCache=new Map(),terrainMask=document.createElement('canvas');
  const terrainEnabled=()=>$('sky-terrain').checked;
  const publishTerrain=()=>window.dispatchEvent(new CustomEvent('deep:terrain',{detail:{profile:terrainEnabled()?terrain:null,text:$('sky-terrain-status').textContent}}));
  const terrainLimit=v=>{const a=angles(v);return terrainEnabled()&&terrain?horizonAt(terrain,a.az):null;};
  const obscured=v=>{const limit=terrainLimit(v);return angles(v).alt<(limit??0);};
  function startTerrain(force=false){
    if(!terrainEnabled())return;
    const input={latitude:context.latitude,longitude:context.longitude,fine:$('sky-terrain-detail').value==='fine',eyeHeight:Number($('sky-eye-height').value)};
    const key=JSON.stringify(input);if(!force&&key===terrainKey)return;
    terrainWorker?.terminate();terrainWorker=null;terrain=null;terrainPoints=[];terrainMaskKey='';terrainKey=key;
    $('sky-terrain-retry').hidden=true;
    function accept(profile){
      terrain=profile;terrainPoints=Array.from({length:3601},(_,i)=>profile.valid[i%3600]?direction(i/10,profile.altitudes[i%3600]):null);
      terrainCache.set(key,profile);if(terrainCache.size>12)terrainCache.delete(terrainCache.keys().next().value);
      const complete=profile.valid.filter(Boolean).length===3600;
      $('sky-terrain-status').textContent=complete?'Terrain ready':'Terrain incomplete · gaps unknown';
      $('sky-terrain-retry').hidden=complete;publishTerrain();updateData();requestDraw();
    }
    if(!force&&terrainCache.has(key)){accept(terrainCache.get(key));return;}
    $('sky-terrain-status').textContent='Loading terrain…';publishTerrain();updateData();requestDraw();
    try{
      terrainWorker=new Worker(new URL('./terrain-worker.mjs',import.meta.url),{type:'module'});
      const worker=terrainWorker;
      const failed=text=>{if(worker!==terrainWorker)return;worker.terminate();terrainWorker=null;$('sky-terrain-status').textContent=`${text} Geometric horizon shown.`;$('sky-terrain-retry').hidden=false;publishTerrain();};
      worker.onmessage=({data})=>{if(worker!==terrainWorker)return;if(data.type==='progress'){$('sky-terrain-status').textContent=data.text;window.dispatchEvent(new CustomEvent('deep:terrain-progress',{detail:data.text}));}else if(data.type==='cache'){$('sky-cache-status').textContent=data.text;window.dispatchEvent(new CustomEvent('deep:terrain-cache',{detail:data.text}));}else if(data.type==='done'){worker.terminate();terrainWorker=null;accept(data.profile);}else failed(data.text);};
      worker.onerror=()=>failed('Terrain calculation failed.');worker.postMessage({...input,refresh:force});
    }catch{$('sky-terrain-status').textContent='Terrain requires a browser with module workers and decompression support. Geometric horizon shown.';$('sky-terrain-retry').hidden=false;publishTerrain();}
  }
  $('sky-terrain').addEventListener('change',()=>{terrainMaskKey='';if(!terrainEnabled()){terrainWorker?.terminate();terrainWorker=null;terrainKey='';$('sky-terrain-status').textContent='Terrain off · geometric horizon';}else startTerrain();publishTerrain();updateData();requestDraw();});
  $('sky-terrain-detail').addEventListener('change',()=>startTerrain());
  $('sky-eye-height').addEventListener('change',()=>{if($('sky-eye-height').value&&$('sky-eye-height').checkValidity())startTerrain();else{$('sky-eye-height').reportValidity();$('sky-eye-height').value=String(terrain?.eyeHeight??2);}});
  $('sky-terrain-retry').addEventListener('click',()=>startTerrain(true));
  window.addEventListener('deep:terrain-request',e=>{$('sky-terrain').checked=true;startTerrain(!!e.detail?.retry);publishTerrain();});
  const grid=[];
  for(const a of [-60,-30,0,30,60])grid.push({points:Array.from({length:121},(_,i)=>direction(i*3,a)),horizon:a===0});
  for(let a=0;a<360;a+=30)grid.push({points:Array.from({length:61},(_,i)=>direction(a,i*3-90)),horizon:false});
  const horizon=Array.from({length:121},(_,i)=>direction(i*3,0));
  const lookup=new Map(api.catalog.map(d=>[d.id,d]));
  const color=d=>/galaxy/i.test(d.label)?'#aebaf7':/nebula|remnant/i.test(d.label)?'#7ed5ce':'#e7c780';
  const local=v=>horizontalVector(v.ra,v.dec,context.latitude,api.gmst(ms)+context.longitude);
  const targetVector=d=>local(api.precess(d.ra_deg,d.dec_deg,ms));
  const skyState=solarAlt=>solarAlt>=-.833?'Daylight':solarAlt>=-6?'Civil twilight':solarAlt>=-12?'Nautical twilight':solarAlt>=-18?'Astronomical twilight':'Astronomical night';

  function setTab(sky){
    active=sky;panel.hidden=!sky;catalogPanel.hidden=sky;document.body.classList.toggle('sky-active',sky);
    for(const [id,isSelected]of [['catalog-tab',!sky],['sky-tab',sky]]){$(id).setAttribute('aria-selected',String(isSelected));$(id).tabIndex=isSelected?0:-1;}
    if(!sky){playing=false;tween=null;$('sky-play').textContent='▶ Play';$('sky-play').setAttribute('aria-pressed','false');cancelAnimationFrame(frameId);frameId=0;}
    else{resize();startTerrain();requestDraw();}
  }
  $('catalog-tab').addEventListener('click',()=>setTab(false));$('sky-tab').addEventListener('click',()=>setTab(true));
  tabbar.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setTab(e.key==='End'||(e.key!=='Home'&&!active));$(active?'sky-tab':'catalog-tab').focus();}});
  function select(id){
    if(!lookup.has(+id))return;selected=+id;$('sky-target').value=String(id);trackTarget=false;updateData();trackTarget=true;
    if(obscured(objects.find(o=>o.d.id===selected).v))$('sky-below').checked=true;
    const dest=angles(objects.find(o=>o.d.id===selected).v);
    const toAz=az+((dest.az-az+540)%360-180),toAlt=clamp(dest.alt,-89.5,89.5);
    tween=reducedMotion.matches?null:{fromAz:az,fromAlt:alt,toAz,toAlt,start:performance.now(),duration:650};
    if(!tween){az=toAz;alt=toAlt;}
    requestDraw();
  }
  function setMode(next){mode=next;$('sky-globe').setAttribute('aria-pressed',String(mode==='globe'));$('sky-observer').setAttribute('aria-pressed',String(mode==='observer'));select(selected);}
  $('sky-globe').addEventListener('click',()=>setMode('globe'));
  $('sky-observer').addEventListener('click',()=>{fov=65;setMode('observer');});
  $('sky-frame').addEventListener('click',()=>{fov=7;setMode('observer');});
  $('sky-target').addEventListener('change',e=>select(+e.target.value));
  $('sky-pa').addEventListener('input',e=>{if(!e.target.value||!e.target.checkValidity())return;pa=+e.target.value;updateData();requestDraw();});
  $('sky-below').addEventListener('change',()=>requestDraw());
  $('sky-catalog-object').addEventListener('click',()=>{
    window.DeepSkyPlanner?.resetFilters();$('search').value='';$('type').value='';$('search').dispatchEvent(new Event('input'));setTab(false);
    const row=$(`m${selected}`);row.scrollIntoView({block:'start',behavior:reducedMotion.matches?'instant':'smooth'});row.querySelector('.number').focus({preventScroll:true});
  });
  $('sky-reset').addEventListener('click',()=>{mode='globe';zoom=1;az=25;alt=25;tween=null;trackTarget=false;$('sky-globe').setAttribute('aria-pressed','true');$('sky-observer').setAttribute('aria-pressed','false');requestDraw();});
  function zoomBy(factor){if(mode==='globe')zoom=clamp(zoom*factor,.65,2.8);else fov=clamp(fov/factor,3,110);requestDraw();}
  $('sky-zoom-in').addEventListener('click',()=>zoomBy(1.25));$('sky-zoom-out').addEventListener('click',()=>zoomBy(.8));
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-clamp(e.deltaY,-100,100)*.002));},{passive:false});
  const pointers=new Map();let pointerStart=null,moved=false,lastPinch=0;
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pointerStart={x:e.clientX,y:e.clientY};moved=false;tween=null;canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)zoomBy(distance/lastPinch);lastPinch=distance;moved=true;}
    else{const sensitivity=mode==='globe'?.28:fov/h;az+=(e.clientX-prev.x)*sensitivity*(mode==='globe'?-1:1);alt=clamp(alt+(e.clientY-prev.y)*sensitivity,-89.5,89.5);if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>4)moved=true;}
    if(moved)trackTarget=false;requestDraw();
  });
  function endPointer(e){
    if(!pointers.has(e.pointerId))return;
    const isClick=!moved&&pointers.size===1&&e.type==='pointerup';pointers.delete(e.pointerId);lastPinch=0;
    if(isClick){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
      const hits=hitTargets.filter(p=>Math.hypot(p.x-x,p.y-y)<14||(x>=p.labelX&&x<=p.labelX+p.labelWidth&&Math.abs(y-p.labelY)<11));
      hits.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));if(hits.length)select(hits[0].id);
    }
    moved=true;
  }
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);lastPinch=0;});
  canvas.addEventListener('keydown',e=>{
    const step=mode==='globe'?5:fov/12;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();tween=null;trackTarget=false;if(e.key==='ArrowLeft')az-=step;if(e.key==='ArrowRight')az+=step;if(e.key==='ArrowUp')alt+=step;if(e.key==='ArrowDown')alt-=step;alt=clamp(alt,-89.5,89.5);requestDraw();}
    if(['+','=','-','_'].includes(e.key)){e.preventDefault();zoomBy(['+','='].includes(e.key)?1.25:.8);}
  });

  function updateData(){
    objects=api.catalog.map(d=>({d,v:targetVector(d)}));sun=local(api.sunRaDec(ms));
    const d=lookup.get(selected),v=objects.find(o=>o.d.id===selected).v,a=angles(v);
    cameraPoints=cameraFrame(d.ra_deg,d.dec_deg,api.fieldWidth,api.fieldHeight,pa).map(p=>local(api.precess(p.ra,p.dec,ms)));
    equator=Array.from({length:121},(_,i)=>local({ra:i*3,dec:0}));northPole=local({ra:0,dec:90});
    $('sky-target').value=String(selected);$('sky-object-id').textContent=d.designation;$('sky-object-name').textContent=d.name||d.designation;$('sky-object-type').textContent=`${d.label} · ${d.con}`;
    $('sky-alt').textContent=`${a.alt.toFixed(1)}°`;$('sky-az').textContent=`${a.az.toFixed(1)}°`;
    const terrainAltitude=terrainLimit(v),clearance=terrainAltitude===null?null:a.alt-terrainAltitude;
    $('sky-visibility').textContent=clearance===null?(terrainEnabled()&&terrain?'Terrain visibility unknown':a.alt>=0?'Above the geometric horizon':`Below geometric horizon by ${(-a.alt).toFixed(1)}°`):clearance>=0?`${clearance.toFixed(2)}° above terrain`:`Behind terrain by ${(-clearance).toFixed(2)}°`;
    $('sky-visibility').classList.toggle('below',clearance===null?a.alt<0:clearance<0);
    const edgeClearances=cameraPoints.map(p=>{const limit=terrainLimit(p);return limit===null?null:angles(p).alt-limit;});
    $('sky-terrain-clearance').textContent=clearance===null?'':`Terrain at target: ${terrainAltitude.toFixed(2)}°. ${edgeClearances.some(c=>c===null)?'Camera edge: terrain coverage incomplete.':`Lowest camera-edge clearance: ${Math.min(...edgeClearances).toFixed(2)}°.`}`;
    $('sky-size').textContent=`${d.size_display} · ${d.mag_band||'Optical'} mag ${(d.mag==null?'unknown':d.mag.toFixed(1))}`;
    $('sky-camera-info').textContent=`Camera · 2.82° × 1.89° · PA ${pa}°`;
    const p=api.localParts(ms);const offset=new Intl.DateTimeFormat('en',{timeZone:context.timeZone,timeZoneName:'shortOffset'}).formatToParts(ms).find(p=>p.type==='timeZoneName')?.value;
    $('sky-time-label').textContent=`${p.day}.${p.month}.${p.year} · ${p.hour}:${p.minute} · ${context.timeZone} (${offset})`;
    $('sky-time').value=String((ms-context.start)/60000);$('sky-time').setAttribute('aria-valuetext',$('sky-time-label').textContent);
    const solarAlt=angles(sun).alt;$('sky-day-state').textContent=`${skyState(solarAlt)} · Sun ${solarAlt.toFixed(1)}°`;
    const shown=objects.filter(o=>filteredIds.has(o.d.id)),known=shown.filter(o=>terrainLimit(o.v)!==null);
    $('sky-count').textContent=terrainEnabled()&&terrain?`${known.filter(o=>!obscured(o.v)).length} above terrain · ${shown.length-known.length} unknown`:`${shown.filter(o=>o.v[1]>=0).length} / ${shown.length} above geometric horizon`;
    if(trackTarget&&!tween){az=a.az;alt=clamp(a.alt,-89.5,89.5);}
    dirty=true;earthDirty=true;
  }
  function rebuildTime(){
    const duration=context.end-context.start;$('sky-time').max=String(duration/60000);
    const colors=['#07101d','#24364a','#46516a','#846c68','#d0a66f'];
    const stops=[];
    for(let i=0;i<=96;i++){
      const t=context.start+duration*i/96,s=api.sunRaDec(t),v=horizontalVector(s.ra,s.dec,context.latitude,api.gmst(t)+context.longitude),a=angles(v).alt;
      stops.push(`${colors[a>=-.833?4:a>=-6?3:a>=-12?2:a>=-18?1:0]} ${i/96*100}%`);
    }
    $('sky-night-track').style.background=`linear-gradient(to right, ${stops.join(',')})`;
    $('sky-time-ticks').replaceChildren();
    for(let i=0;i<=4;i++){const span=document.createElement('span');span.textContent=api.localTime(context.start+duration*i/4);$('sky-time-ticks').append(span);}
  }
  $('sky-time').addEventListener('input',()=>{ms=context.start+Number($('sky-time').value)*60000;updateData();requestDraw();});
  $('sky-play').addEventListener('click',()=>{playing=!playing;$('sky-play').textContent=playing?'❚❚ Pause':'▶ Play';$('sky-play').setAttribute('aria-pressed',String(playing));lastTime=0;requestDraw();});
  $('sky-now').addEventListener('click',()=>{
    const now=Date.now(),p=api.localParts(now);let date=api.dateAt(now);
    if(+p.hour<12){const [y,m,d]=date.split('-').map(Number);date=new Date(Date.UTC(y,m-1,d-1,12)).toISOString().slice(0,10);}
    api.setNightDate(date);ms=now;updateData();requestDraw();
  });
  window.addEventListener('messier:context',()=>{const previous=context;context=api.getContext();if(context.date!==previous.date||context.timeZone!==previous.timeZone)ms=context.midnight;ms=clamp(ms,context.start,context.end);if(context.latitude!==previous.latitude||context.longitude!==previous.longitude){terrainWorker?.terminate();terrainWorker=null;terrain=null;terrainKey='';terrainPoints=[];terrainMaskKey='';publishTerrain();if(active||document.getElementById('tonight')?.checked)startTerrain();}rebuildTime();updateData();requestDraw();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);frameId=0;lastTime=0;}else requestDraw();});

  function resize(){
    if(!active)return;const rect=canvas.getBoundingClientRect();w=rect.width;h=rect.height;
    const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);requestDraw();
  }
  new ResizeObserver(resize).observe(canvas);
  function requestDraw(){dirty=true;if(active&&!document.hidden&&!frameId)frameId=requestAnimationFrame(tick);}
  function tick(t){
    frameId=0;if(!active||document.hidden)return;
    const dt=lastTime?Math.min((t-lastTime)/1000,.1):0;lastTime=t;
    if(playing){ms+=dt*Number($('sky-speed').value)*60000;if(ms>context.end)ms=context.start+(ms-context.start)%(context.end-context.start);updateData();}
    if(tween){const f=clamp((t-tween.start)/tween.duration,0,1),e=f*f*(3-2*f);az=tween.fromAz+(tween.toAz-tween.fromAz)*e;alt=tween.fromAlt+(tween.toAlt-tween.fromAlt)*e;dirty=true;if(f===1)tween=null;}
    if(dirty){draw();dirty=false;}if(playing||tween)frameId=requestAnimationFrame(tick);else lastTime=0;
  }
  function draw(){
    if(!w||!h)return;
    const pr=projection(mode,az,alt,mode==='globe'?zoom:fov,w,h),proj=v=>pr.project(v);
    const solarAlt=angles(sun).alt,day=clamp((solarAlt+18)/30,0,1);
    ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,`rgb(${7+day*7},${14+day*16},${25+day*22})`);bg.addColorStop(1,`rgb(${8+day*16},${17+day*22},${28+day*26})`);ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    if(mode==='globe'){
      const glow=ctx.createRadialGradient(w/2-pr.radius*.25,h/2-pr.radius*.3,0,w/2,h/2,pr.radius);glow.addColorStop(0,'#1a31484d');glow.addColorStop(.85,'#15344b44');glow.addColorStop(1,'#6bacba2b');
      ctx.beginPath();ctx.arc(w/2,h/2,pr.radius,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();ctx.strokeStyle='#55798b80';ctx.lineWidth=1;ctx.stroke();
      const pts=horizon.map(proj);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#5ea9a520';ctx.fill();
    }
    function curve(points,color,width=1,dashed=false,frontOnly=false){
      ctx.save();ctx.lineWidth=width;ctx.strokeStyle=color;
      let previous=null;
      for(const v of points){const p=v?proj(v):null;if(p&&previous&&(!frontOnly||(p.z>=0&&previous.z>=0))&&Math.abs(p.x-previous.x)<w*1.5&&Math.abs(p.y-previous.y)<h*1.5){
        const behind=mode==='globe'&&(p.z+previous.z)<0;ctx.globalAlpha=behind?.28:1;ctx.setLineDash(dashed?[4,5]:behind?[2,5]:[]);ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(p.x,p.y);ctx.stroke();
      }previous=p;}
      ctx.restore();
    }
    if(terrainEnabled()&&terrain){
      const key=[terrainKey,mode,az,alt,zoom,fov,w,h].join('|');
      if(key!==terrainMaskKey){
        terrainMaskKey=key;terrainMask.width=Math.ceil(w/3);terrainMask.height=Math.ceil(h/3);
        const maskCtx=terrainMask.getContext('2d'),img=maskCtx.createImageData(terrainMask.width,terrainMask.height);
        const forward=direction(az,alt),right=direction(az+90,0),up=cross(forward,right),focal=h/(2*Math.tan(fov*DEG/2));
        for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
          const sx=(x+.5)*w/img.width-w/2,sy=h/2-(y+.5)*h/img.height;let v;
          if(mode==='globe'){
            const ex=-sx/pr.radius,ey=sy/pr.radius,q=ex*ex+ey*ey;if(q>1)continue;
            v=add(scale(forward,Math.sqrt(1-q)),add(scale(right,ex),scale(up,ey)));
          }else v=unit(add(forward,add(scale(right,sx/focal),scale(up,sy/focal))));
          const a=angles(v),limit=horizonAt(terrain,a.az);
          if(limit!==null&&a.alt<limit){const i=(y*img.width+x)*4;img.data[i]=42;img.data[i+1]=62;img.data[i+2]=53;img.data[i+3]=225;}
        }
        maskCtx.putImageData(img,0,0);
      }
      ctx.drawImage(terrainMask,0,0,w,h);
    }
    for(const line of grid)curve(line.points,line.horizon?'#81cfc9':'#466075',line.horizon?1.7:.7);
    curve(equator,'#9aacc171',1,true);
    if(terrainEnabled()&&terrain)curve(terrainPoints,'#b1cf9b',1.7);
    const labels=[];
    function label(text,v,color='#9eb9c9',offset=0,force=false){
      const p=proj(v);if(!p||p.x<8||p.x>w-8||p.y<55||p.y>h-30)return;
      if(mode==='globe'&&p.z<-.15&&!force)return;
      ctx.font='14px system-ui';const width=ctx.measureText(text).width;
      const box={x:p.x+offset,y:p.y-9,width,height:19};
      if(!force&&labels.some(b=>Math.abs(b.x+ b.width/2-box.x-box.width/2)<(b.width+box.width)/2+6&&Math.abs(b.y-box.y)<21))return;
      ctx.fillStyle='#08111dc9';ctx.fillRect(box.x-3,box.y-3,width+6,20);ctx.fillStyle=color;ctx.fillText(text,box.x,p.y+4);labels.push(box);return box;
    }
    ['N','E','S','W'].forEach((text,i)=>label(`${text} · ${i*90}°`,scale(direction(i*90,0),mode==='globe'?1.06:1),'#c6f0ea',0));
    label('Zenith',scale([0,1,0],mode==='globe'?1.06:1));label('NCP',northPole,'#91a6c0',8);
    if(mode==='observer'&&alt<0){ctx.fillStyle='#d3b7a3';ctx.font='14px system-ui';ctx.fillText('Below your geometric horizon',18,h-21);}
    // Markers have constant screen size; only the camera field has angular size.
    const visible=objects.filter(o=>filteredIds.has(o.d.id)).map(o=>({...o,p:proj(o.v)})).filter(o=>o.p&&o.p.x>=-10&&o.p.x<=w+10&&o.p.y>=50&&o.p.y<=h-10&&($('sky-below').checked||!obscured(o.v)));
    visible.sort((a,b)=>(a.d.id===selected?1:b.d.id===selected?-1:a.p.z-b.p.z));hitTargets=[];
    for(const o of visible){
      const isSelected=o.d.id===selected,r=isSelected?5:3.3;ctx.save();ctx.globalAlpha=mode==='globe'&&o.p.z<0?.35:1;
      ctx.beginPath();ctx.arc(o.p.x,o.p.y,r,0,Math.PI*2);ctx.strokeStyle=isSelected?'#f3aa77':color(o.d);ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=isSelected?2:1.3;
      if(obscured(o.v)){ctx.setLineDash([2,2]);ctx.stroke();}else ctx.fill();
      if(isSelected){ctx.setLineDash([]);ctx.beginPath();ctx.arc(o.p.x,o.p.y,11,0,Math.PI*2);ctx.stroke();}ctx.restore();
      hitTargets.push({x:o.p.x,y:o.p.y,id:o.d.id,labelX:-999,labelY:-999,labelWidth:0});
    }
    if(filteredIds.has(selected)&&($('sky-below').checked||!obscured(objects.find(o=>o.d.id===selected).v)))curve(cameraPoints,'#f3aa77',1.8);
    // Prefer the selected object, then foreground labels, during collision removal.
    visible.sort((a,b)=>(a.d.id===selected?-1:b.d.id===selected?1:b.p.z-a.p.z));
    for(const o of visible){if(o.d.collection==='extended'&&o.d.id!==selected&&(mode==='globe'?zoom<1.6:fov>35))continue;const box=label(o.d.designation,o.v,o.d.id===selected?'#ffc79f':color(o.d),10,o.d.id===selected);if(box){const hit=hitTargets.find(p=>p.id===o.d.id);hit.labelX=box.x;hit.labelY=box.y+9;hit.labelWidth=box.width;}}
    const sp=proj(sun);if(sp&&sp.x>0&&sp.x<w&&sp.y>55&&sp.y<h){ctx.globalAlpha=mode==='globe'&&sp.z<0?.4:1;ctx.beginPath();ctx.arc(sp.x,sp.y,6,0,2*Math.PI);ctx.fillStyle='#ffd48a';ctx.shadowColor='#ffc06a';ctx.shadowBlur=16;ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;label('Sun',sun,'#ffcf8c',11);}
    if(mode==='globe'){const origin=proj([0,0,0]);ctx.fillStyle='#b1e8e4';ctx.beginPath();ctx.arc(origin.x,origin.y,3,0,Math.PI*2);ctx.fill();}
    $('sky-view-name').textContent=mode==='globe'?'Sky globe':'Observer view';$('sky-view-direction').textContent=mode==='globe'?'Horizon disc · all sky directions':`Az ${wrap(az).toFixed(0)}° · Alt ${alt.toFixed(0)}° · vertical field ${fov.toFixed(1)}°`;
    if(earthDirty){drawEarth();earthDirty=false;}
  }
  function drawEarth(){
    if(!earthCtx)return;const size=176,r=76,c=size/2;earthCtx.clearRect(0,0,size,size);
    const img=earthCtx.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const e=(x-c)/r,n=(c-y)/r,q=e*e+n*n;if(q>1)continue;
      const u=Math.sqrt(1-q),s=dot([e,u,n],sun),lit=s>0;
      const bright=lit?.55+.45*Math.sqrt(s):.55;
      const base=lit?[64,113,135]:[18,31,53],i=(y*size+x)*4;
      for(let k=0;k<3;k++)img.data[i+k]=base[k]*bright;
      img.data[i+3]=255;
    }
    earthCtx.putImageData(img,0,0);
    function earthLine(vectors,color,width=1){earthCtx.beginPath();let open=false;for(const v of vectors){if(v[1]<0){open=false;continue;}const x=c+v[0]*r,y=c-v[2]*r;if(!open)earthCtx.moveTo(x,y);else earthCtx.lineTo(x,y);open=true;}earthCtx.strokeStyle=color;earthCtx.lineWidth=width;earthCtx.stroke();}
    for(const lat of [-60,-30,0,30,60])earthLine(Array.from({length:181},(_,i)=>earthNormal(lat,i*2,context.latitude,context.longitude)),'#9db9c333');
    for(let lon=0;lon<360;lon+=30)earthLine(Array.from({length:91},(_,i)=>earthNormal(i*2-90,lon,context.latitude,context.longitude)),'#9db9c333');
    const tangent=unit(cross(sun,Math.abs(sun[1])<.9?[0,1,0]:[1,0,0])),other=cross(sun,tangent);
    earthLine(Array.from({length:181},(_,i)=>add(scale(tangent,Math.cos(i*2*DEG)),scale(other,Math.sin(i*2*DEG)))),'#f3bc83',1.7);
    earthCtx.beginPath();earthCtx.arc(c,c,r,0,Math.PI*2);earthCtx.strokeStyle='#63899b';earthCtx.lineWidth=1;earthCtx.stroke();
    earthCtx.fillStyle='#d8ffff';earthCtx.beginPath();earthCtx.arc(c,c,3,0,Math.PI*2);earthCtx.fill();
    const solarAlt=angles(sun).alt;earthCanvas.setAttribute('aria-label',`Earth day and night boundary. Observer at centre, Sun altitude ${solarAlt.toFixed(1)} degrees, ${solarAlt>=0?'day side':'night side'}.`);
  }
  const emptySelection=document.createElement('p');emptySelection.id='sky-selection-empty';emptySelection.hidden=true;emptySelection.textContent='No targets match the filters.';document.querySelector('.sky-side').prepend(emptySelection);
  window.addEventListener('deep:selection',()=>{
    filteredIds=new Set(api.visibleIds());const matches=api.catalog.filter(d=>filteredIds.has(d.id));
    $('sky-target').replaceChildren(...matches.map(d=>{const option=document.createElement('option');option.value=d.id;option.textContent=d.designation+(d.name?' · '+d.name:'');return option;}));
    $('sky-target').disabled=!matches.length;emptySelection.hidden=!!matches.length;document.querySelector('.sky-side').classList.toggle('no-selection',!matches.length);
    if(matches.length&&!filteredIds.has(selected))select(matches[0].id);else{updateData();requestDraw();}
  });
  initDeepPlanner(api);
  rebuildTime();updateData();
  // The first 3D view opens in a stable globe overview; selection then animates.
  if(location.hash==='#3d-sky')setTab(true);
}
