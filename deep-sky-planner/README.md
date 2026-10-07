# Christoph’s Messier Planner

Observation and framing planner for all 110 Messier objects. The source is
authored in `dist/`. A small Cloudflare Worker serves these assets and streams
Sonny terrain tiles from an allowlisted mirror (the mirror does not provide
browser CORS). There are no external JavaScript dependencies.
Site identity is in `.openai/hosting.json`. Run `npm run build` for Worker output.

## Git history

`f82ff2a7b0325121a437fd099e3fda40c9d2ac9c` is the public catalog baseline before
the 3D Sky addition, including removal of the street address from the location
placeholder. The 3D implementation is a separate subsequent commit.

## Views

- **Catalog:** survey images, search and type filters, sorting, altitude charts.
- **3D Sky:** an interactive celestial sphere and an observer perspective, all 110
  selectable Messier objects, local horizon, Sun, equator, north celestial pole,
  camera rectangle, position angle, and noon-to-noon time playback.
- The Earth inset shows the geometric solar terminator centred on the selected
  observing location. It is a schematic globe with geographic graticules.

Use the tabs to switch views or “View in 3D Sky” on a catalog row. Select an object
to animate the view towards it; “Zoom to camera” shows the rectangular camera
field at its true angular scale. Drag or use arrow keys to rotate. Scroll, pinch,
or use the buttons to zoom. A selected target is tracked as time advances until
the user manually rotates or resets the view. Playback pauses when leaving 3D.
The location, time zone and selected observing night are shared across both views.
Open with `#3d-sky` to start directly in the sky view.

## Geometry and scope

`sky-math.mjs` contains vector transformations and tangent-plane camera geometry.
`sky-view.mjs` projects 3D vectors onto Canvas 2D using an orthographic globe view
or a perspective observer view. The sky functionality has no CDN dependency.
`index.html` exposes its original astronomical calculations through
`window.MessierPlanner`; location/date updates emit `messier:context`.

The 477 mm focal length and nominal 23.5 × 15.7 mm sensor produce a field of
2.82217732° × 1.88566571°. PA is measured from J2000 north towards east.
Catalogue positions are precessed to the date. Refraction, nutation,
proper motions, and precise ephemerides are outside this approximate planning
view. Marker sizes do not represent angular object size. The globe represents
directions, not physical distances. Sky brightness is illustrative.

## Verification

Run `node --test tests/sky-math.test.mjs` for analytical geometry, agreement with
the existing altitude charts, polar and RA-wrap cases, camera dimensions,
solar illumination, DST intervals, and static source checks.

Survey image sources and coordinate lookups remain external services. They are
independent of terrain loading. Astronomy and catalogue source credits
remain in the page.

## Sonny terrain

Opening 3D Sky loads a location-dependent terrain silhouette. Changing the
location, observer height or detail cancels stale work and rebuilds the horizon;
changing time only moves celestial objects. Device tile caching is best-effort,
limited to 100 MB; up to 12 calculated profiles stay in session memory.
The default Zurich Oerlikon profile (47.411, 8.544, Fine, eye height 2 m) is
precomputed from real tiles with the same scanner and bundled for instant loading.
Other coordinates, heights and detail settings trigger their own calculation.

- Data: [Sonny](https://sonny.4lima.de/), CC BY 4.0; redistributed unmodified via
  [RouteConverter](https://static.routeconverter.com/sonny/), 2024 mirror files.
  Availability snapshot: 2026-09-06, 33 half-arcsecond, 485 one-arcsecond and
  1056 three-arcsecond tiles. This mirror is not complete European coverage and
  does not necessarily contain Sonny’s latest releases.
- Near field (0–25 km): 0.5 arcsecond where available in Fine mode, otherwise
  1 arcsecond. Standard always uses 1 arcsecond. Far field (25–150 km):
  3 arcseconds. Some cross-country tiles use SRTM outside LiDAR coverage.
- 3600 great-circle rays, 0.1° azimuth spacing; bilinear elevation samples at
  7.5/15/45 m radial spacing respectively. Spherical Earth R=6371008.8 m;
  vertical heights use the source’s national mean-sea-level datum. The eye is
  ground elevation plus an adjustable height, initially 2 m. No refraction.
- HGT signed big-endian values, void handling, ZIP size and CRC validation.
  Only one tile is inflated at a time in a browser worker; the server streams
  compressed data without inflating it. Initial downloads can be tens of MB;
  Fine tiles alone can exceed 50 MB in mountainous areas.
- Missing tiles/voids make the affected directions unknown, never flat terrain.
  No buildings, trees, terrain beyond 150 km, or guarantee that all narrow
  features between samples are captured. The catalog keeps geometric heights.
- Green terrain fill and ridge line use the same horizontal coordinate frame
  as the Messier objects and camera. Centre and sampled camera-edge clearances
  are displayed; daylight and weather are separate from terrain clearance.

`terrain-math.mjs` implements terrain geometry; `terrain-worker.mjs` downloads,
checks and scans tiles. `worker/gateway.mjs` has a strictly allowlisted tile
route; `scripts/build.mjs` embeds the static app into its Worker build.

Run `npm test` for sky and terrain checks.

Real-data verification: all 16 tiles for Zurich Oerlikon decoded and passed ZIP
CRC checks; all 3600 directions complete. Ground elevation 442 m, horizon range
0.286664°–4.754890°. Calculation took about 9 s locally after download.
