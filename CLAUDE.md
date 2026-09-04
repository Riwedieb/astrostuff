# astrostuff

Processing of astrophotography RAW sequences. Currently one project: aligning
and rendering the **12 August 2026 partial solar eclipse** shot from a
telescope-mounted Canon (`.CR3` RAW files).

## Data

RAW files are **not in this repo** — they live on the Windows side and are read
through the WSL mount:

```
/mnt/c/Users/crueh/Pictures/Raw/2026_08_12/IMG_*.CR3
```

The notebook globs that directory, so the frame count follows whatever is on
disk at run time (see "Dataset quirks").

## Environment

Python venv is `.astro/` (Python 3.12). Key packages:

| Package | Used for |
|---|---|
| `rawpy` | decoding Canon `.CR3` (libraw); also the only working source of ISO/shutter metadata — `exifread` does **not** parse CR3 |
| `opencv-python-headless` | thresholding, contours, convex hull, affine shifts |
| `numpy` | circle fitting, interpolation |
| `Pillow` | GIF export, JPEG thumbnails |
| `imageio` + `imageio-ffmpeg` | mp4 export (bundles its own ffmpeg binary; no system ffmpeg installed) |
| `matplotlib` | the initial sanity-check plot only |

JupyterLab runs on `localhost:8888`. To reach the files from Windows Explorer:
`\\wsl$\Ubuntu\home\crueh\workspace` (WSL interop is disabled, so launching
`.exe` from this shell does not work).

## `eclipse_processor.ipynb`

Run top to bottom. Roughly:

1. **Sanity check** — glob `raw_files`, decode and show the first frame.
2. **First slideshow** — half-resolution thumbnails + an HTML/JS slider.
3. **Exposure audit** — dump ISO/shutter/timestamp per frame via `raw.other`.
4. **Alignment + exposure correction** (the main cell) — produces `frames`,
   the per-frame geometry (`final_cx`, `final_cy`, `r_global`, `crop_r`,
   `confident`), `brightness_scale`, and `aligned`.
5. **Brightness boost** — one uniform multiplier; produces
   `brightness_scale_boosted` and re-builds `aligned`.
6. **Slideshow** of the final aligned frames.
7. **Diagnostics** — how the confidence thresholds were chosen.
8. **Exports** — GIF, full-resolution mp4, CRF re-encode.

Notes on the design (details in the cell comments):

- Alignment fits a circle to the sun's limb using the **convex hull** of the
  thresholded bright region, which discards the concave notch where the moon
  overlaps. The **radius is held fixed** at a global value; only the centre is
  fitted per frame, because a free 3-parameter fit is ill-conditioned on the
  thin arcs near maximum eclipse. Frames with too little visible arc get their
  position **interpolated in time** from confident neighbours instead.
- Brightness is matched from **measured pixel brightness** of the illuminated
  region, not from ISO/shutter metadata. The photographer lengthened the
  shutter deliberately as the crescent thinned, so "correcting" for that
  metadata double-darkens those frames.
- RAW decode uses `no_auto_bright=True` with `gamma=(1,1)` and an explicit
  gamma applied afterwards. libRaw's automatic per-frame brightness causes
  visible flicker/artifacts across the sequence.
- Steps 4–6 decode at `half_size=True` for speed. The mp4 export re-decodes at
  full resolution and streams frames straight into the writer (holding all
  full-res frames in memory would need ~8 GB), scaling the half-size geometry
  by 2.

## Dataset quirks

These are properties of the shoot, not bugs:

- **Slides 56–73 (1-indexed): telescope was covered.** No sun in frame; the
  detector finds only noise there, so they are forced to solid black. Hardcoded
  as `range(55, 73)`.
- **`IMG_0114`–`IMG_0120` were deleted** (sun below the horizon — twilight/star
  frames at 1 s and 30 s exposures, unrelated to the eclipse). The sequence is
  therefore **113 frames**, not the original 120. Anything that reports
  `len(raw_files)` reflects the current directory contents.
- **Exposure changed mid-shoot:** 1/2000 s → 1/40 s → 1/100 s (all ISO 400)
  during the partial phase, then ISO 800 with wildly varying shutter near
  sunset. Hence the brightness-matching step.
- Sun disc is ~293 px radius at half size (~586 px full), cropped to
  1.3× radius → 762 px (half) / 1524 px (full) square output.

## Conventions

- **Strip notebook outputs before committing.** Executed cells embed base64
  images and slideshow thumbnails, which bloat the repo by megabytes.
- **Do not commit generated media** (`eclipse.gif`, `eclipse_full_res*.mp4`)
  or the `.astro/` venv. Note that `.gitignore` does not currently cover
  `.astro/`, `.ipynb_checkpoints/`, or the media files, so they show up as
  untracked noise — stage explicitly rather than using `git add -A`.
- `install.sh` and `std_demo.ipynb` are unrelated scratch files, not part of
  this project.
