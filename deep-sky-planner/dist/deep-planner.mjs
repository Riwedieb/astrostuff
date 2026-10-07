import {buildNightGrid,objectWindows} from './night-math.mjs';
export function initDeepPlanner(api){
  const $=id=>document.getElementById(id),controls=document.querySelector('.controls'),meta=document.querySelector('.astro-meta');
  meta.after(controls);
  $('search').placeholder='M31, NGC 224, IC 1805, Crescent…';
  $('type').innerHTML='<option value="">All types</option>'+[['galaxy','Galaxies'],['emission','Emission nebulae / remnants'],['reflection','Reflection nebulae'],['nebula','Other / mixed nebulae'],['cluster','Star clusters'],['planetary','Planetary nebulae'],['other','Other objects']].map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
  const collection=document.createElement('label');collection.innerHTML='Collection<select id="collection"><option value="">All targets</option><option value="messier">Messier · 110</option><option value="extended">NGC / IC · 180</option></select>';$('search').parentElement.after(collection);
  $('sort').insertAdjacentHTML('beforeend','<option value="window">Photo window · longest</option><option value="best">Photo window · earliest</option><option value="name">Object name</option>');
  const settings=document.createElement('div');settings.className='night-controls';settings.innerHTML=`<label class="night-toggle"><input type="checkbox" id="tonight">Good to photograph tonight</label><details><summary>Criteria &amp; legend</summary><div class="night-settings"><label>Min. altitude (°)<input id="night-alt" type="number" min="0" max="85" step="1" value="30"></label><label>Min. duration (h)<input id="night-duration" type="number" min="0.25" max="12" step="0.25" value="2"></label><label class="night-toggle"><input id="night-terrain" type="checkbox" checked>Check terrain</label></div><p>Visible continuously from astronomical dusk (Sun −12°). Chart windows show full darkness (Sun below −18°).</p><p>Green: terrain checked · amber: geometry only. Sampled every 5 min; short obstructions may be missed. Weather, Moon, trees and buildings excluded.</p></details><div class="night-terrain-row"><span id="night-terrain-status" role="status">Terrain unchecked</span><button id="night-load-terrain" class="action">Check terrain</button></div><span id="night-cache-status" role="status"></span><a id="terrain-signin" href="/signin-with-chatgpt?return_to=%2F" target="_top" hidden>Sign in to save terrain across devices</a>`;
  controls.after(settings);
  for(const id of ['server','markers','loadAll','print'])$(id).closest('label')?.classList.add('catalog-only');
  for(const id of ['markers','loadAll','print'])$(id).classList.add('catalog-only');
  const imageOptions=document.createElement('details');imageOptions.className='image-options catalog-only';imageOptions.innerHTML='<summary>Image options</summary><div class="options-fields"></div>';controls.append(imageOptions);
  imageOptions.lastElementChild.append($('server').closest('label'),$('markers'),$('loadAll'),$('print'));
  const astro=document.querySelector('.astro-controls'),coordinates=document.createElement('details');coordinates.className='coordinate-options';coordinates.innerHTML='<summary>Coordinates &amp; time zone</summary><div class="options-fields"></div>';
  for(const label of [...astro.querySelectorAll(':scope > label')].slice(2))coordinates.lastElementChild.append(label);
  coordinates.lastElementChild.prepend(astro.querySelector('.location-summary'));astro.append(coordinates);
  const table=document.querySelector('table'),header=table.querySelector('thead tr');
  header.children[2].textContent='Properties';header.children[3].remove();header.querySelector('.elevation-heading').textContent='Altitude · local time';header.insertAdjacentHTML('beforeend','<th scope="col">Photo window</th>');
  table.querySelector('colgroup').innerHTML='<col><col><col><col><col>';
  const cells=new Map();
  for(const d of api.catalog){const row=$(`m${d.id}`),props=row.querySelector('.description'),angular=row.querySelector('.angular');angular.querySelector('small:not(.sort-facts)')?.remove();props.append(...angular.childNodes);angular.remove();const cell=document.createElement('td');cell.className='photo-window';row.append(cell);cells.set(d.id,cell);}
  let results=new Map(),terrain=null,context=api.getContext(),timer=null;
  const validInput=(id,fallback)=>$(id).value&&$(id).checkValidity()?Number($(id).value):fallback;
  const chosen=r=>$('night-terrain').checked?r.verified:r.geometry;
  const duration=()=>validInput('night-duration',2)*3600000;
  const fmt=t=>api.localTime(t);
  const hours=ms=>(ms/3600000).toFixed(1)+' h';
  function matches(id){const d=api.catalog.find(d=>d.id===id);if($('collection').value&&d.collection!==$('collection').value)return false;if(!$('tonight').checked)return true;const r=results.get(id);return !!r&&chosen(r).fromDusk.continuous>=duration();}
  function recompute(){
    context=api.getContext();if(terrain&&(terrain.latitude!==context.latitude||terrain.longitude!==context.longitude))terrain=null;
    const grid=buildNightGrid(api,context),alt=validInput('night-alt',30);results=new Map();
    for(const d of api.catalog){
      const r=objectWindows(api,d,context,grid,alt,terrain);results.set(d.id,r);
      const use=chosen(r),display=use.windows.length?use:r.geometry,verified=$('night-terrain').checked&&use.windows.length>0;
      const cell=cells.get(d.id);cell.replaceChildren();
      const main=document.createElement('b');main.textContent=display.longest?`${fmt(display.longest.start)}–${fmt(display.longest.end)}`:'No photo window';cell.append(main);
      const info=document.createElement('span');info.textContent=display.longest?hours(display.continuous):'';cell.append(info);
      const duskInfo=document.createElement('span');duskInfo.textContent=r.dusk===null?'No evening dusk':`${hours(use.fromDusk.continuous)} from dusk · ${fmt(r.dusk)}${!$('night-terrain').checked?' · terrain off':''}`;const details=document.createElement('details');details.innerHTML='<summary>Details</summary>';details.append(duskInfo);
      const qualifies=use.fromDusk.continuous>=duration();
      const badge=document.createElement('span');badge.className='window-badge '+(qualifies&&$('night-terrain').checked?'verified':'unchecked');badge.textContent=qualifies?($('night-terrain').checked?'Ready at dusk':'Ready · terrain off'):r.dusk===null?'No dusk start':r.geometry.fromDusk.continuous===0?'Too low at dusk':$('night-terrain').checked&&r.unknown&&use.fromDusk.continuous<r.geometry.fromDusk.continuous?'Terrain unchecked':use.fromDusk.continuous===0?'Obscured at dusk':'Too short from dusk';cell.append(badge,details);
      if(display.windows.length>1){for(const w of display.windows){const p=document.createElement('p');p.textContent=`${fmt(w.start)}–${fmt(w.end)} · ${hours(w.end-w.start)}`;details.append(p);}}
      const svg=$(`m${d.id}`).querySelector('.elevation-chart');if(svg){svg.querySelector('.photo-bands')?.remove();const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('class','photo-bands');for(const w of display.windows){const rect=document.createElementNS(group.namespaceURI,'rect');rect.setAttribute('x',38+(w.start-context.start)/(context.end-context.start)*592);rect.setAttribute('y','13');rect.setAttribute('width',(w.end-w.start)/(context.end-context.start)*592);rect.setAttribute('height','147');rect.setAttribute('fill',verified?'#8ad6ae':'#d7bb79');rect.setAttribute('opacity','.20');group.append(rect);}svg.append(group);}
    }
    api.sortRows();api.filter();
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(recompute,0);};
  window.DeepSkyPlanner={matches,sortValue(id,key){const r=results.get(id),w=r&&chosen(r);return key==='best'?(w?.longest?(w.longest.start+w.longest.end)/2:Infinity):(w?.continuous??0);},resetFilters(){ $('collection').value='';$('tonight').checked=false;api.filter();}};
  $('collection').addEventListener('change',()=>api.filter());
  $('tonight').addEventListener('change',()=>{api.filter();if($('tonight').checked&&$('night-terrain').checked)window.dispatchEvent(new CustomEvent('deep:terrain-request'));});
  for(const id of ['night-alt','night-duration','night-terrain'])$(id).addEventListener('change',()=>{if(!$(id).checkValidity()){ $(id).reportValidity();return;}schedule();if($('tonight').checked&&$('night-terrain').checked)window.dispatchEvent(new CustomEvent('deep:terrain-request'));});
  $('night-load-terrain').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('deep:terrain-request',{detail:{retry:true}})));
  window.addEventListener('messier:context',()=>{const next=api.getContext();if(next.latitude!==context.latitude||next.longitude!==context.longitude){terrain=null;$('night-terrain-status').textContent='Terrain unchecked';}schedule();if($('tonight').checked&&$('night-terrain').checked)setTimeout(()=>window.dispatchEvent(new CustomEvent('deep:terrain-request')),0);});
  window.addEventListener('deep:terrain-progress',({detail})=>{$('night-terrain-status').textContent=detail;});
  window.addEventListener('deep:terrain',({detail})=>{terrain=detail.profile||null;$('night-terrain-status').textContent=detail.text;schedule();});
  window.addEventListener('deep:terrain-cache',({detail})=>{$('night-cache-status').textContent=detail==='Sign in to save terrain'?'':detail;$('terrain-signin').hidden=detail!=='Sign in to save terrain';});
  recompute();
}
