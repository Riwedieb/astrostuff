import {buildNightGrid,objectWindows} from './night-math.mjs';
export function initDeepPlanner(api){
  const $=id=>document.getElementById(id),controls=document.querySelector('.controls'),meta=document.querySelector('.astro-meta');
  meta.after(controls);
  $('search').placeholder='M31, NGC 224, IC 1805, Crescent…';
  $('type').innerHTML='<option value="">All types</option>'+[['galaxy','Galaxies'],['emission','Emission nebulae / remnants'],['reflection','Reflection nebulae'],['nebula','Other / mixed nebulae'],['cluster','Star clusters'],['planetary','Planetary nebulae'],['other','Other objects']].map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
  const collection=document.createElement('label');collection.innerHTML='Collection<select id="collection"><option value="">All targets</option><option value="messier">Messier · 110</option><option value="extended">Extended photo selection · 180</option></select>';$('search').parentElement.after(collection);
  $('sort').insertAdjacentHTML('beforeend','<option value="window">Photo window · longest first</option><option value="best">Best window · earliest first</option><option value="name">Object name</option>');
  const settings=document.createElement('div');settings.className='night-controls';settings.innerHTML=`<label class="night-toggle"><input type="checkbox" id="tonight">Good to photograph tonight</label><details><summary>Photo-window criteria</summary><div class="night-settings"><label>Minimum altitude (°)<input id="night-alt" type="number" min="0" max="85" step="1" value="30"></label><label>Continuous window (hours)<input id="night-duration" type="number" min="0.25" max="12" step="0.25" value="2"></label><label class="night-toggle"><input id="night-terrain" type="checkbox" checked>Require verified terrain clearance</label></div><p>Sun below −18° · continuous time above the minimum altitude · target centre above terrain when required. Sampled every 5 minutes; boundaries are conservative to roughly 5 minutes per edge. Weather, moonlight, trees and buildings are not evaluated. Camera-edge clearance is available in 3D Sky.</p></details><p class="window-legend"><span>Green shading: terrain checked</span> · <span>Amber shading: geometric candidate</span></p><div class="night-terrain-row"><span id="night-terrain-status" role="status">Terrain unchecked. Load it to verify photo windows.</span><button id="night-load-terrain" class="action">Check terrain</button></div>`;
  controls.after(settings);
  for(const id of ['server','markers','loadAll','print'])$(id).closest('label')?.classList.add('catalog-only');
  for(const id of ['markers','loadAll','print'])$(id).classList.add('catalog-only');
  const table=document.querySelector('table'),header=table.querySelector('thead tr');
  header.children[2].textContent='Properties';header.children[3].remove();header.querySelector('.elevation-heading').textContent='This night · local time';header.insertAdjacentHTML('beforeend','<th scope="col">Photo window</th>');
  table.querySelector('colgroup').innerHTML='<col><col><col><col><col>';
  const cells=new Map();
  for(const d of api.catalog){const row=$(`m${d.id}`),props=row.querySelector('.description'),angular=row.querySelector('.angular');props.append(...angular.childNodes);angular.remove();const cell=document.createElement('td');cell.className='photo-window';row.append(cell);cells.set(d.id,cell);}
  let results=new Map(),terrain=null,context=api.getContext(),timer=null;
  const validInput=(id,fallback)=>$(id).value&&$(id).checkValidity()?Number($(id).value):fallback;
  const chosen=r=>$('night-terrain').checked?r.verified:r.geometry;
  const duration=()=>validInput('night-duration',2)*3600000;
  const fmt=t=>api.localTime(t);
  const hours=ms=>(ms/3600000).toFixed(1)+' h';
  function matches(id){const d=api.catalog.find(d=>d.id===id);if($('collection').value&&d.collection!==$('collection').value)return false;if(!$('tonight').checked)return true;const r=results.get(id);return !!r&&chosen(r).continuous>=duration();}
  function recompute(){
    context=api.getContext();if(terrain&&(terrain.latitude!==context.latitude||terrain.longitude!==context.longitude))terrain=null;
    const grid=buildNightGrid(api,context),alt=validInput('night-alt',30);results=new Map();
    for(const d of api.catalog){
      const r=objectWindows(api,d,context,grid,alt,terrain);results.set(d.id,r);
      const use=chosen(r),display=use.windows.length?use:r.geometry,verified=$('night-terrain').checked&&use.windows.length>0;
      const cell=cells.get(d.id);cell.replaceChildren();
      const main=document.createElement('b');main.textContent=display.longest?`${fmt(display.longest.start)}–${fmt(display.longest.end)}`:'No photo window';cell.append(main);
      const info=document.createElement('span');info.textContent=display.longest?`${hours(display.continuous)} continuous · ${hours(display.total)} total`:'No interval meets altitude and darkness criteria.';cell.append(info);
      const badge=document.createElement('span');badge.className='window-badge '+(verified?'verified':'unchecked');badge.textContent=verified?(use.continuous>=duration()?'Meets criteria':'Window too short'):r.geometry.windows.length?(!$('night-terrain').checked?'Geometry only · terrain ignored':r.unknown?'Terrain unchecked':'Obscured by terrain'):'No suitable interval';cell.append(badge);
      if(display.windows.length>1){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='All intervals';details.append(summary);for(const w of display.windows){const p=document.createElement('p');p.textContent=`${fmt(w.start)}–${fmt(w.end)} · ${hours(w.end-w.start)}`;details.append(p);}cell.append(details);}
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
  window.addEventListener('messier:context',()=>{const next=api.getContext();if(next.latitude!==context.latitude||next.longitude!==context.longitude){terrain=null;$('night-terrain-status').textContent='New location · terrain unchecked.';}schedule();if($('tonight').checked&&$('night-terrain').checked)setTimeout(()=>window.dispatchEvent(new CustomEvent('deep:terrain-request')),0);});
  window.addEventListener('deep:terrain-progress',({detail})=>{$('night-terrain-status').textContent=detail;});
  window.addEventListener('deep:terrain',({detail})=>{terrain=detail.profile||null;$('night-terrain-status').textContent=detail.text;schedule();});
  recompute();
}
