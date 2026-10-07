# Christoph’s Messier Planner

Static observation and framing planner for all 110 Messier objects. The source is
served directly from `dist/`; there is no build or external JavaScript dependency.
Site identity and the static output directory are in `.openai/hosting.json`.

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
Catalogue positions are precessed to the date. Refraction, terrain, nutation,
proper motions, and precise ephemerides are outside this approximate planning
view. Marker sizes do not represent angular object size. The globe represents
directions, not physical distances. Sky brightness is illustrative.

## Verification

Run `node --test tests/sky-math.test.mjs` for analytical geometry, agreement with
the existing altitude charts, polar and RA-wrap cases, camera dimensions,
solar illumination, DST intervals, and static source checks.

Survey image sources and coordinate lookups remain external services. They are
independent of the self-contained 3D view. Astronomy and catalogue source credits
remain in the page.
