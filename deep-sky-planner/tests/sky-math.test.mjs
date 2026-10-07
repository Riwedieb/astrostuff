import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DEG,dot,unit,horizontalVector,direction,angles,cameraFrame,equatorialVector,projection,earthNormal} from '../dist/sky-math.mjs';
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const catalog=JSON.parse(html.match(/const CATALOG=(\[.*?\]);/s)[1]);
function originalFunction(name){return html.match(new RegExp(`  function ${name}\\([^]*?\\n  }`))[0];}
function astronomy(lat,lon,tz='Europe/Zurich'){
  return new Function(`const DEG=Math.PI/180,DAY=86400000,LAT=${lat},LON=${lon},TZ=${JSON.stringify(tz)};
    const sin=x=>Math.sin(x*DEG),cos=x=>Math.cos(x*DEG),asin=x=>Math.asin(x)/DEG,atan2=(y,x)=>Math.atan2(y,x)/DEG;
    const norm360=x=>((x%360)+360)%360,norm180=x=>{const y=norm360(x);return y>180?y-360:y;};
    function jd(ms){return ms/DAY+2440587.5;}
    ${['precess','gmst','sunRaDec','altitude','tzOffsetMs','zonedHour','localParts'].map(originalFunction).join('\n')}
    return {precess,gmst,sunRaDec,altitude,zonedHour,localParts};`)();
}

test('horizontal axes: rising east, setting west, zenith and both poles',()=>{
  close(angles(horizontalVector(90,0,0,0)).az,90);
  close(angles(horizontalVector(270,0,0,0)).az,270);
  close(angles(horizontalVector(0,47,47,0)).alt,90);
  close(angles(horizontalVector(0,90,47,0)).alt,47);
  close(angles(horizontalVector(0,-90,-34,0)).alt,34);
  for(const lat of [-90,0,90])close(Math.hypot(...horizontalVector(12,45,lat,30)),1);
});
test('all 110 objects agree with existing altitude charts in both hemispheres',()=>{
  assert.equal(catalog.length,110);assert.equal(new Set(catalog.map(d=>d.id)).size,110);
  for(const [lat,lon]of [[47.411,8.544],[-33.87,151.21],[0,-70]]){
    const a=astronomy(lat,lon);
    for(const date of ['2000-01-01T12:00Z','2026-09-05T22:00Z','2100-06-21T06:00Z']){
      const ms=Date.parse(date);
      for(const d of catalog){const p=a.precess(d.ra_deg,d.dec_deg,ms),v=horizontalVector(p.ra,p.dec,lat,a.gmst(ms)+lon);close(angles(v).alt,a.altitude(p.ra,p.dec,ms),1e-7);close(Math.hypot(...v),1);}
    }
  }
});
test('camera edges retain sensor angles across RA zero and near celestial poles',()=>{
  const width=2.82217732,height=1.88566571;
  for(const [ra,dec]of [[10.675,41.26666667],[359.9,-20],[0,89.99],[180,-89.99]])for(const pa of [0,37,90,180]){
    const points=cameraFrame(ra,dec,width,height,pa,12).map(p=>equatorialVector(p.ra,p.dec));
    const separation=(a,b)=>Math.acos(Math.min(1,dot(a,b)))/DEG;
    close(separation(points[18],points[42]),width,1e-7);
    close(separation(points[6],points[30]),height,1e-7);
    close(dot(points[0],points.at(-1)),1);
  }
});
test('camera projection centres targets and keeps observer east to the right',()=>{
  for(const mode of ['globe','observer']){
    const p=projection(mode,27,45,mode==='globe'?1:65,1000,600),v=direction(27,45),c=p.project(v);close(c.x,500);close(c.y,300);
  }
  const p=projection('observer',0,0,65,1000,600);
  assert.ok(p.project(direction(10,0)).x>500);assert.ok(p.project(direction(0,10)).y<300);assert.equal(p.project(direction(180,0)),null);
});
test('Earth observer illumination agrees with solar altitude, including polar day',()=>{
  const t=Date.parse('2026-06-21T12:00Z');
  for(const [lat,lon]of [[47,8],[-34,151],[80,0],[-80,0]]){
    const a=astronomy(lat,lon),s=a.sunRaDec(t),v=horizontalVector(s.ra,s.dec,lat,a.gmst(t)+lon),observer=earthNormal(lat,lon,lat,lon);
    close(dot(observer,v),Math.sin(a.altitude(s.ra,s.dec,t)*DEG));close(observer[1],1);
    if(lat===80)assert.ok(v[1]>0);if(lat===-80)assert.ok(v[1]<0);
  }
});
test('time interval uses actual local noon across 23-hour and 25-hour nights',()=>{
  const a=astronomy(47,8);
  close((a.zonedHour('2026-03-29',12)-a.zonedHour('2026-03-28',12))/3600000,23);
  close((a.zonedHour('2026-10-25',12)-a.zonedHour('2026-10-24',12))/3600000,25);
  close((a.zonedHour('2026-09-06',12)-a.zonedHour('2026-09-05',12))/3600000,24);
  const p=a.localParts(a.zonedHour('2026-09-05',24));assert.equal(p.hour,'00');assert.equal(p.day,'06');
});
test('static entrypoint and imports resolve, inline scripts parse, baseline catalog remains',()=>{
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new Function(m[1]);
  for(const asset of ['sky-view.mjs','sky-math.mjs','sky-view.css'])assert.ok(existsSync(new URL('../dist/'+asset,import.meta.url)));
  assert.equal((html.match(/<tr id="m\d+"/g)||[]).length,110);
  assert.ok(html.includes('window.MessierPlanner=Object.freeze'));
  assert.ok(!html.includes('Regensbergstrasse'));
});
