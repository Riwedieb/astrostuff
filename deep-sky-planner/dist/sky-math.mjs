// Pure spherical geometry. Vectors use local east / up / north axes.
export const DEG = Math.PI / 180;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const wrap = x => (x % 360 + 360) % 360;
export const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export const scale = (v, s) => v.map(x => x * s);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const unit = v => scale(v, 1 / Math.hypot(...v));
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

export function horizontalVector(ra, dec, latitude, sidereal) {
  const h = (sidereal - ra) * DEG, d = dec * DEG, p = latitude * DEG;
  return [-Math.cos(d)*Math.sin(h),
    Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos(h),
    Math.cos(p)*Math.sin(d)-Math.sin(p)*Math.cos(d)*Math.cos(h)];
}
export function direction(az, alt) {
  return [Math.sin(az*DEG)*Math.cos(alt*DEG), Math.sin(alt*DEG), Math.cos(az*DEG)*Math.cos(alt*DEG)];
}
export function angles(v) {
  return {az:wrap(Math.atan2(v[0],v[2])/DEG),alt:Math.asin(clamp(v[1]/Math.hypot(...v),-1,1))/DEG};
}
export function equatorialVector(ra, dec) {
  return [Math.cos(dec*DEG)*Math.cos(ra*DEG),Math.cos(dec*DEG)*Math.sin(ra*DEG),Math.sin(dec*DEG)];
}
export function equatorialAngles(v) {
  return {ra:wrap(Math.atan2(v[1],v[0])/DEG),dec:Math.asin(clamp(v[2]/Math.hypot(...v),-1,1))/DEG};
}
// A sensor rectangle is straight in the tangent plane, not in RA/Dec.
// Position angle is measured from celestial north towards east (J2000).
export function cameraFrame(ra, dec, width, height, positionAngle=0, segments=12) {
  const centre=equatorialVector(ra,dec);
  const east=[-Math.sin(ra*DEG),Math.cos(ra*DEG),0];
  const north=[-Math.sin(dec*DEG)*Math.cos(ra*DEG),-Math.sin(dec*DEG)*Math.sin(ra*DEG),Math.cos(dec*DEG)];
  const a=positionAngle*DEG;
  const right=add(scale(east,Math.cos(a)),scale(north,-Math.sin(a)));
  const up=add(scale(north,Math.cos(a)),scale(east,Math.sin(a)));
  const x=Math.tan(width*DEG/2),y=Math.tan(height*DEG/2);
  const corners=[[-x,-y],[x,-y],[x,y],[-x,y],[-x,-y]],points=[];
  for(let edge=0;edge<4;edge++)for(let i=0;i<segments;i++){
    const t=i/segments,p=corners[edge],q=corners[edge+1];
    points.push(equatorialAngles(unit(add(centre,add(scale(right,p[0]+(q[0]-p[0])*t),scale(up,p[1]+(q[1]-p[1])*t))))));
  }
  points.push(points[0]);return points;
}
export function projection(mode, az, alt, zoom, width, height) {
  const forward=direction(az,alt);
  const right=direction(az+90,0);
  const up=cross(forward,right);
  const radius=Math.min(width,height)*0.405*zoom;
  const focal=height/(2*Math.tan(clamp(zoom,3,110)*DEG/2));
  return {
    forward, radius,
    project(v) {
      const z=dot(v,forward),x=dot(v,right),y=dot(v,up);
      if(mode==='observer') {
        if(z<=0.02)return null;
        return {x:width/2+x*focal/z,y:height/2-y*focal/z,z};
      }
      return {x:width/2-x*radius,y:height/2-y*radius,z};
    }
  };
}
// Earth surface normal expressed in the observer's east/up/north frame.
export function earthNormal(lat, lon, observerLat, observerLon) {
  const p=lat*DEG,d=(lon-observerLon)*DEG,o=observerLat*DEG;
  return [Math.cos(p)*Math.sin(d),Math.sin(o)*Math.sin(p)+Math.cos(o)*Math.cos(p)*Math.cos(d),Math.cos(o)*Math.sin(p)-Math.sin(o)*Math.cos(p)*Math.cos(d)];
}
