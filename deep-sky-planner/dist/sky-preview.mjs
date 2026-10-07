const CDS='https://alasky.cds.unistra.fr/hips-image-services/hips2fits';
const MIRROR='https://alaskybis.cds.unistra.fr/hips-image-services/hips2fits';
export const normalPA=pa=>((pa%360)+360)%360;
// FITS y increases upward; image x increases westward at PA 0.
// This tangent-plane basis matches cameraFrame's footprint at every PA.
export function cameraWCS(d,pa,width,height,pixelsX=940,pixelsY=628){
  const a=normalPA(pa)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const dx=2*Math.tan(width*Math.PI/360)*180/Math.PI/pixelsX,dy=2*Math.tan(height*Math.PI/360)*180/Math.PI/pixelsY;
  return {NAXIS:2,NAXIS1:pixelsX,NAXIS2:pixelsY,CTYPE1:'RA---TAN',CTYPE2:'DEC--TAN',CUNIT1:'deg',CUNIT2:'deg',CRPIX1:(pixelsX+1)/2,CRPIX2:(pixelsY+1)/2,CRVAL1:d.ra_deg,CRVAL2:d.dec_deg,CD1_1:-dx*c,CD1_2:dy*s,CD2_1:dx*s,CD2_2:dy*c,RADESYS:'ICRS'};
}
export function previewCandidates(api,d,pa,source){
  if(normalPA(pa)===0)return api.imageCandidates(d.id);
  const wcs=JSON.stringify(cameraWCS(d,pa,api.fieldWidth,api.fieldHeight));
  const surveys=source==='PANSTARRS'?['CDS/P/PanSTARRS/DR1/color-i-r-g','CDS/P/DSS2/color']:source.includes('skyview.gsfc')?['CDS/P/DSS2/red']:['CDS/P/DSS2/color'];
  const servers=source===CDS||source==='PANSTARRS'?[CDS,MIRROR]:[MIRROR,CDS];
  return surveys.flatMap(hips=>servers.map(server=>server+'?'+new URLSearchParams({hips,wcs,format:'jpg'})));
}
export function createPreviewLoader(request,render,delay=180){
  let generation=0,key=null,job=null,timer=null;const cache=new Map();
  function cancel(){generation++;clearTimeout(timer);job?.cancel();job=null;key=null;}
  return {cancel,load(next,urls){
    if(next===key)return;
    cancel();key=next;const current=generation;
    render({phase:'loading'});
    if(cache.has(key)){render({phase:'ready',image:cache.get(key)});return;}
    timer=setTimeout(()=>{
      if(current!==generation)return;
      job=request(urls,()=>{});
      job.promise.then(image=>{
        if(current!==generation)return;
        cache.set(next,image);if(cache.size>24)cache.delete(cache.keys().next().value);
        render({phase:'ready',image});
      }).catch(()=>{if(current===generation){key=null;render({phase:'error'});}}).finally(()=>{if(current===generation)job=null;});
    },delay);
  }};
}
export function initSkyPreview(api){
  const $=id=>document.getElementById(id),button=$('sky-preview'),img=$('sky-preview-image'),status=$('sky-preview-status'),retry=$('sky-preview-retry');
  let target=null,pa=0,enabled=false,previewDialog=false;
  function surveyName(src){const q=new URL(src).searchParams;return src.includes('skyview.gsfc')?'DSS2 red':q.get('hips')?.includes('PanSTARRS')?'Pan-STARRS':q.get('hips')?.endsWith('/red')?'DSS2 red':'DSS2';}
  const loader=createPreviewLoader(api.requestSurveyImage,state=>{
    if(state.phase==='loading'){
      if(previewDialog&&$('detail').open)$('detail').close();previewDialog=false;
      img.hidden=true;img.removeAttribute('src');button.disabled=true;status.hidden=false;status.textContent='Loading image…';retry.hidden=true;$('sky-preview-source').textContent='';
    }else if(state.phase==='ready'){
      img.src=state.image.src;img.alt=`${target.designation}, camera field 2.82° × 1.89°, PA ${normalPA(pa)}°`;img.hidden=false;button.disabled=false;status.hidden=true;
      $('sky-preview-source').textContent=surveyName(state.image.src);
    }else{status.hidden=false;status.textContent='Image unavailable';retry.hidden=false;}
  });
  function update(d,angle,visible){
    target=d;pa=angle;enabled=visible;
    if(!enabled){loader.cancel();return;}
    $('sky-preview-target').textContent=d.designation;
    $('sky-camera-info').textContent=`2.82° × 1.89° · PA ${normalPA(pa)}°`;
    const orientation=$('sky-preview-orientation');orientation.textContent=normalPA(pa)===0?'N ↑  E ←':'';
    button.setAttribute('aria-label',`Enlarge camera view of ${d.designation}`);
    const source=$('server').value,key=JSON.stringify([d.id,normalPA(pa),source]);
    loader.load(key,previewCandidates(api,d,pa,source));
  }
  retry.addEventListener('click',()=>{loader.cancel();if(target)update(target,pa,enabled);});
  button.addEventListener('click',()=>{
    if(button.disabled||img.hidden||!target)return;
    $('detailTitle').textContent=`${target.designation}${target.name?' · '+target.name:''} · PA ${normalPA(pa)}°`;
    $('detail').querySelector('.dialog-field').replaceChildren(img.cloneNode());
    $('detail').showModal();previewDialog=true;
  });
  $('server').addEventListener('change',()=>{if(target)update(target,pa,enabled);});
  return {update};
}
