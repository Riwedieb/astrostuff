export async function cachedTerrain(input,compute,report,fetcher=fetch){
  const url='/api/horizon?'+new URLSearchParams({lat:input.latitude,lon:input.longitude,eye:input.eyeHeight,fine:input.fine?'1':'0'});
  const status=text=>report({type:'cache',text});
  let canSave=false;
  try{
    status('Checking saved terrain…');
    const r=await fetcher(url,{credentials:'same-origin',signal:AbortSignal.timeout(4000)});
    if(r.status===401)status('Sign in to save terrain');
    else if(r.ok){
      canSave=true;
      if(!input.refresh){const p=await r.json();status('Saved terrain');return p;}
    }else if(r.status===404)canSave=true;
    else status('Cache unavailable · computing locally');
  }catch{status('Cache unavailable · computing locally');}
  const profile=await compute(input,report);
  if(canSave){
    if(profile.valid.every(v=>v===1)&&profile.missing.length===0){
      try{
        const r=await fetcher(url,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile),signal:AbortSignal.timeout(5000)});
        status(r.ok?'Terrain saved':r.status===401?'Sign in to save terrain':'Terrain ready · cache save failed');
      }catch{status('Terrain ready · cache save failed');}
    }else status('Incomplete terrain · not cached');
  }
  return profile;
}
