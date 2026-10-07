# Christoph’s Deep-Sky Planner

Observation and framing planner for all 110 Messier objects and 180 additional NGC/IC targets. The source is
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

## Extended photo selection and night planning

The catalog has 290 distinct records: all 110 Messier objects and 180 northern
NGC/IC additions. The derived OpenNGC data is CC BY-SA 4.0 (attribution and
download linked in the Site). The raw source snapshot is tracked at
`data/OpenNGC.csv`; `python scripts/select-deep-sky.py` regenerates the shortlist.
The payload records the source SHA-256. Northern NGC/IC Caldwell entries seed
the list, including explicitly marked compact/challenging exceptions. Other
objects follow size, published optical brightness and galaxy surface-brightness
criteria, with quotas balancing galaxies, clusters and nebulae. This is a fixed
Zürich-accessible shortlist (culmination >=30° at 47.411° N), independent of
the selected night. It is not a complete Caldwell catalog or a detectability
guarantee. Source nulls remain unknown and B and V magnitudes are labelled.

`catalog-setup.js` adds records before the original catalog/images initialize,
using stable numeric IDs distinct from Messier. Object names and aliases are
searchable, while duplicate Messier identities and OpenNGC duplicate records
are excluded. `deep-planner.mjs` adds collection/type selection, shared filters,
photo-window cells, chart shading, and mobile details/cards. The same selection
drives 3D markers and Go to object; extra labels appear only when zoomed in.

`night-math.mjs` samples the actual local noon-to-noon interval every 5 minutes.
A candidate sample requires Sun <= -18° and target altitude >= configured
minimum (default 30°). Verified samples additionally require known Sonny
terrain strictly below the target centre. Adjacent qualifying samples define
intervals for the regular dark-night chart. The tonight filter separately anchors
visibility to the evening Sun = -12° crossing (start of astronomical twilight),
located to within one millisecond and inserted into the grid. The target must
already meet the altitude and optional terrain criteria then and keep meeting
them, while Sun <= -12°, for the default two hours. Later starts and recovery
after a gap do not qualify; a date without an evening crossing cannot qualify.
The row states the dusk time and uninterrupted duration separately from its
dark-night window. Duration ends are conservative to one sample step. Terrain
gaps and missing profiles cannot pass the strict filter. Users may explicitly turn off the terrain requirement (labelled
geometry only). Weather, lunar brightness, buildings, trees, fine obstructions
between samples, and camera-edge visibility are outside this filter.

Terrain loads from either view on request; its profile, loading/error state,
observer height and location invalidation are shared with the night planner.
Changes to date and criteria recalculate intervals without redownloading the
terrain. Green chart bands indicate verified intervals, amber bands geometric
candidates. Sort by longest window, earliest best-window midpoint, name, or
the original magnitude/size/altitude options.
