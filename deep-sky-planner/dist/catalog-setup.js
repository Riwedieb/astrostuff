window.prepareDeepCatalog=function(catalog){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  catalog.forEach(d=>{d.designation=`M${d.id}`;d.collection='messier';d.mag_band='V';d.aliases=[d.designation,...(d.ngc?[`NGC ${d.ngc}`]:[])];d.reason='Complete Messier collection; retained regardless of size or observing latitude.';});
  const template=document.querySelector('tbody tr');
  for(const d of window.DEEP_SKY_CATALOG||[]){
    const row=template.cloneNode(true);row.id=`m${d.id}`;row.dataset.id=d.id;
    row.querySelector('.object').innerHTML=`<a class="number" href="#m${d.id}">${esc(d.designation)}</a><strong>${esc(d.name)}</strong><span>${esc(d.aliases.slice(1).join(' · '))}</span><small>${esc(d.note)}</small>`;
    const field=row.querySelector('.field');field.setAttribute('aria-label',`Enlarge ${d.designation} at the same field of view`);field.querySelector('img').alt=`${d.designation}, full camera field`;
    row.querySelector('.description').innerHTML=`${esc(d.label)}<span>${esc(d.con)}</span>`;
    row.querySelector('.angular').innerHTML=`${esc(d.size_display)}<small>Approximate extent</small>`;
    document.querySelector('tbody').append(row);catalog.push(d);
  }
  for(const d of catalog){
    const label=d.label.toLowerCase();
    d.group=label.includes('galaxy')?'galaxy':label.includes('planetary')?'planetary':label.includes('reflection')||d.id===78?'reflection':label.includes('emission')||label.includes('supernova')||label.includes('diffuse')?'emission':label.includes('nebula')?'nebula':label.includes('cluster')?'cluster':'other';
    d.group=d.photo_group||d.group;
    const row=document.getElementById(`m${d.id}`);row.dataset.type=d.group;row.dataset.collection=d.collection;
    row.dataset.search=[...d.aliases,d.name,d.label,d.con].join(' ').toLowerCase().replace(/\b(m|ngc|ic|caldwell|c)\s*0*(\d+)/g,'$1$2');
    const dims=String(d.size).match(/[\d.]+/g)?.map(Number)||[];const major=dims[0]||0,minor=dims[1]||major;
    const framing=!major?'Framing extent unknown.':major>169.3*.9||minor>113.1*.9?'Large field: inspect the preview for cropping or mosaic framing.':major<5?'Compact target: little of the sensor is filled.':'Catalog extent fits the sensor with margin at a suitable rotation.';
    const filter=d.group==='emission'||d.group==='planetary'?'Dualband Hα/OIII is worth considering; line strengths vary.':d.group==='galaxy'||d.group==='reflection'||d.group==='cluster'?'Broadband target: use without the dualband filter.':'Mixed or unspecified nebula spectrum: check the target before choosing a filter.';
    const details=document.createElement('details');details.className='object-details';details.innerHTML=`<summary>Details</summary><p>${esc(d.label)} · ${esc(d.con)} · ${esc(d.size_display)} · ${esc(d.mag_band||'Optical')} mag ${d.mag==null?'unknown':d.mag.toFixed(1)}</p><p>${esc(d.reason)}</p><p>${esc(framing)}</p><p>${esc(filter)}</p>${d.surface_brightness!=null?`<p>Mean B surface brightness: ${d.surface_brightness.toFixed(2)} mag/arcsec².</p>`:''}${d.collection==='extended'?'<p>Data: OpenNGC · CC BY-SA 4.0. Missing values remain unknown; catalog sizes may trace different wavelengths or brightness limits.</p>':''}`;
    for(const note of row.querySelectorAll('.object > small')){if(note.textContent.trim())details.append(note);else note.remove();}row.querySelector('.object').append(details);
  }
};
