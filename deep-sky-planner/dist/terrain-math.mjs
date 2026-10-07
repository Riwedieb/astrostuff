export const R=6371008.8, DEG=Math.PI/180, BIN_COUNT=3600, NEAR=25000, FAR=150000;
export function destination(lat,lon,az,distance) {
  const p=lat*DEG,a=az*DEG,s=distance/R;
  const q=Math.asin(Math.sin(p)*Math.cos(s)+Math.cos(p)*Math.sin(s)*Math.cos(a));
  const l=lon+Math.atan2(Math.sin(a)*Math.sin(s)*Math.cos(p),Math.cos(s)-Math.sin(p)*Math.sin(q))/DEG;
  return {lat:q/DEG,lon:((l+540)%360)-180};
}
export function tileName(lat,lon) {
  const y=Math.floor(lat),x=Math.floor(lon);
  return `${y<0?'S':'N'}${String(Math.abs(y)).padStart(2,'0')}${x<0?'W':'E'}${String(Math.abs(x)).padStart(3,'0')}`;
}
export function tileOrigin(name) {
  return {lat:Number(name.slice(1,3))*(name[0]==='S'?-1:1),lon:Number(name.slice(4,7))*(name[3]==='W'?-1:1)};
}
export function elevationAngle(ground,observer,distance) {
  const a=distance/R;
  return Math.atan2((R+ground)*Math.cos(a)-(R+observer),(R+ground)*Math.sin(a))/DEG;
}
// HGT rows run north to south; signed, big-endian metres, -32768 is void.
export function sampleHgt(view,size,origin,lat,lon) {
  let x=(lon-origin.lon)*(size-1),y=(origin.lat+1-lat)*(size-1);
  if(x<-.00001||y<-.00001||x>size-1+.00001||y>size-1+.00001)return null;
  x=Math.max(0,Math.min(size-1,x));y=Math.max(0,Math.min(size-1,y));
  const ix=Math.min(size-2,Math.floor(x)),iy=Math.min(size-2,Math.floor(y)),dx=x-ix,dy=y-iy;
  const values=[view.getInt16((iy*size+ix)*2),view.getInt16((iy*size+ix+1)*2),view.getInt16(((iy+1)*size+ix)*2),view.getInt16(((iy+1)*size+ix+1)*2)];
  if(values.some(v=>v===-32768))return null;
  return values[0]*(1-dx)*(1-dy)+values[1]*dx*(1-dy)+values[2]*(1-dx)*dy+values[3]*dx*dy;
}
export function horizonAt(profile,az) {
  if(!profile)return null;
  const f=((az%360+360)%360)/360*profile.altitudes.length,i=Math.floor(f),j=(i+1)%profile.altitudes.length;
  if(!profile.valid[i]||!profile.valid[j])return null;
  return profile.altitudes[i]*(1-(f-i))+profile.altitudes[j]*(f-i);
}
// Coarse segment planning is padded on each side. Exact positions and tile/radius
// membership are checked during fine sampling, including at tile boundaries.
export function planTerrain(lat,lon,tiles,fine=true) {
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>75||Math.abs(lon)>180)throw Error('Terrain coverage is limited to European latitudes.');
  const sets=Object.fromEntries(Object.entries(tiles).map(([r,n])=>[r,new Set(n)]));
  const nearResolution=name=>fine&&sets['0.5'].has(name)?'0.5':'1';
  const origin=tileName(lat,lon),originRes=nearResolution(origin);
  if(!sets[originRes].has(origin))throw Error('No Sonny terrain tile is available for this location.');
  const tasks=new Map();
  for(let bin=0;bin<BIN_COUNT;bin++) {
    let segment=null;
    for(let d=1;d<=FAR+250;d+=250) {
      const p=destination(lat,lon,bin/10,Math.min(d,FAR)),name=tileName(p.lat,p.lon),res=d<=NEAR?nearResolution(name):'3',key=res+'/'+name;
      if(!segment||segment.key!==key) {
        if(segment)segment.end=Math.min(FAR,d+250);
        if(!tasks.has(key))tasks.set(key,{name,res,available:sets[res].has(name),segments:[]});
        segment={key,bin,start:Math.max(1,d-250),end:FAR};tasks.get(key).segments.push(segment);
      }
    }
  }
  return {origin,originRes,tasks:[...tasks.values()].sort((a,b)=>Number(a.res)-Number(b.res))};
}
export function scanTile(view,size,task,latitude,longitude,observer,profile) {
  const origin=tileOrigin(task.name),step=Number(task.res)*15;
  for(const seg of task.segments) {
    for(let d=seg.start;d<=seg.end;d+=step) {
      if(task.res==='3'?d<=NEAR:d>NEAR)continue;
      const p=destination(latitude,longitude,seg.bin/10,d);
      if(tileName(p.lat,p.lon)!==task.name)continue;
      const z=sampleHgt(view,size,origin,p.lat,p.lon);
      if(z===null){profile.valid[seg.bin]=0;continue;}
      const h=elevationAngle(z,observer,d);
      if(h>profile.altitudes[seg.bin]){profile.altitudes[seg.bin]=h;profile.distances[seg.bin]=d;}
    }
  }
}
