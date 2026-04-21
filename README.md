# Equation Visualiser — Cinematic Math

EQ Visualiser is a small web application for turning mathematical functions into **time-driven, cinematic visualizations**. You write a formula in standard math notation (via [mathjs](https://mathjs.org/)), and the app samples the curve, animates how it is drawn, moves a virtual 2D camera with easing, and can **export** the result as a video file from the same render path as the on-screen preview.

The goal is to treat a graph less like a static plot and more like a **composed shot**: progressive line reveal, zoom, pan, and an ending frame that shows broader context—especially for **periodic** behavior (sine-like rhythms), where sampling and framing are tuned so the curve does not clip awkwardly at the edges of a fixed domain.

---

## Features

### Interactive expression editing

- Edit `**f(x)`** using mathjs syntax in the sidebar (e.g. `sin(x)`, `sin(x) * exp(-0.15 * x)`, polynomials, compositions of whitelisted functions).
- **Apply** updates the function on the main plot layer. Your **timeline tracks are not overwritten**; only the expression in the scene changes.
- **Reset story** reapplies the built-in cinematic storyboard (duration, camera/plot keyframes). Use this after changing the expression if you want a fresh default “director” pass tuned to the new formula.

### Playback and timeline

- **Play / Pause** drives global time `t` from the current scrub position to the end of the composition.
- A **scrubber** lets you inspect any instant; scrubbing stops playback.
- The default project runs at **30 fps** with a **19 s** timeline (after storyboard); duration and tracks live in the project file shape (`ProjectFileV1`).

### Cinematic behavior (high level)

- **Progressive draw**: the visible stroke is controlled by a normalized `**draw`** property (0…1) on the plot layer, interpreted as progress along **arc length** of the sampled polyline. This produces a continuous “unfolding” line rather than a fade of the whole curve.
- **Camera**: 2D orthographic-style framing with `**centerX`**, `**centerY**`, and `**halfWidth**` (world units per half-width of the view; larger values show more of the plane—i.e. zoomed out).
- **Easing**: keyframed properties interpolate with **linear** segments or **cubic Bézier** curves (CSS-style `(x1,y1,x2,y2)` control points), similar in spirit to easing in non-linear editors.
- **Tip follow** (optional on the camera): the camera can **nudge** toward the current draw tip, with clamping and a smooth ramp so follow does not snap when `draw` is near zero.
- **Periodic-aware sampling**: for many trig-heavy expressions, the engine estimates a period (heuristic AST analysis) and extends the **right** side of the sampling interval so pans and zoom-outs still read as a continuous wave. The **left** side is kept tight to the viewport envelope so the **start of playback** is not an empty frame of off-screen arc length.
- **Timeline-union sampling**: for a given function plot, the world `**xMin` / `xMax`** used for sampling are computed **once** from an envelope of the camera over all relevant keyframe times (plus margins). That keeps `**draw`** stable over time: the polyline does not “reshuffle” every frame, which would break arc-length animation.

### Video export

- **Export video** renders the composition off-screen with the same `evaluateAtTime` → WebGL path as the preview, then encodes with `**MediaRecorder`** (typically **WebM** with VP8/VP9, depending on the browser).
- Export uses the timeline **duration** and **fps** from the project; preview and file are intended to match for the same `t`.

### Rendering stack

- **WebGL 2** line rendering: polylines are extruded into triangles in the CPU (miter-style quads per segment), then drawn with a simple shader stack (`Plot2DWebGL`).
- **Grid and axes** are drawn in world space in the same pass for consistent framing.

---

## Requirements

- **Node.js** (current LTS recommended) for install and build.
- A **modern browser** with **WebGL 2** for the canvas.
- **Video export** requires a browser that supports `canvas.captureStream` and a supported **MediaRecorder** MIME type (often WebM).

---

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Use the sidebar to edit the expression, **Apply**, then **Play**. Use **Reset story** if you want the default camera/plot animation regenerated.

### Other scripts


| Command           | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start Vite dev server with HMR              |
| `npm run build`   | Typecheck (`tsc`) and production bundle     |
| `npm run preview` | Serve the production build locally          |
| `npm test`        | Run **Vitest** unit tests (non-interactive) |


---

## How to use the UI

1. **Expression** — Enter `f(x)` in the textarea. Only a **whitelist** of mathjs functions is allowed (see [Math and safety](#math-and-safety)). Use `*` for multiplication where needed.
2. **Apply** — Pushes the expression into the scene’s main function plot. Does **not** replace custom timeline edits.
3. **Play / Pause** — Animates `t`. Playback resumes from the current scrub time.
4. **Scrubber** — Jumps to a time; stops playback.
5. **Export video** — Renders every frame and downloads a `.webm` (or available container). Disabled while playing in the current UI.
6. **Reset story** — Replaces the timeline with the default storyboard tracks and duration (cinematic preset).

---

## Math and safety

Expressions are parsed and compiled through **mathjs** with a **strict allowlist** of functions and symbols (see `src/core/math/compileExpr.ts`). Unsupported constructs include:

- User-defined functions and assignments
- Arbitrary identifiers that are not `x` (for function plots) or the parametric parameter name
- Functions not present in the whitelist

This reduces the surface area for malicious or surprising evaluation in the browser. If you need a function that is missing, you must extend the whitelist and any safety checks deliberately.

**Parametric plots** (`x(u)`, `y(u)`) are supported in the type system and sampler, but the default demo and director logic focus on **function** plots `y = f(x)`.

**Periodicity** (`src/core/math/analyzePeriodicity.ts`) is **heuristic**: it looks for trig functions whose argument is **affine in `x`** (e.g. `sin(2*x+1)`). Nested or non-linear arguments (e.g. `sin(x^2)`) are treated as **unknown** for period-based director/sampling hints. Sums of trig terms only get a combined period when their periods are **commensurate** within a numerical tolerance; otherwise the analysis returns **unknown** so the system does not invent a wrong fundamental period.

---

## Architecture (where things live)

```
src/
  App.tsx                 # React shell: canvas, controls, export, animation loop
  store.ts                # Zustand: project, time, play state, Apply / Reset story
  core/
    ir.ts                 # Scene graph + timeline types (cameras, plots, tracks)
    schema.ts             # Default project factory
    math/
      compileExpr.ts      # Safe mathjs compile for plotting
      samplePlot.ts       # Sample function / parametric → Polyline2D + arc lengths
      analyzePeriodicity.ts
  director/
    shots.ts              # Storyboard presets → concrete PropertyTracks
  engine/
    evaluateAtTime        # evaluateProject.ts — pure render state at time t
    keyframes.ts          # Merge tracks, interpolate with easing
    easing.ts             # Cubic Bézier easing
    cameraEnvelope.ts     # Min/max camera pose over the timeline
    plotSampling.ts       # Timeline-union x extent for stable arc-length draw
    cameraFollow.ts       # Optional tip-following offset on top of keyframes
    renderState.ts        # ResolvedCamera2D / ResolvedPlot2D / RenderStateV1
    timelineUtils.ts      # Track collection helpers
  render/
    trimPolyline.ts       # Arc-length trim + tipAtDraw
    lineExtrude.ts        # Polyline → triangle strip for GPU
    webgl2/Plot2DWebGL.ts # Clear, grid, axes, thick lines
  export/
    webCodecsVideo.ts     # Frame loop + MediaRecorder export
```

**Data flow in one sentence:** the **timeline** animates numeric properties on **scene nodes**; `evaluateAtTime` samples plots (with envelope-aware bounds), resolves cameras (including follow), and returns a `**RenderStateV1`** that `**Plot2DWebGL**` draws.

---

## Project model (v1 IR)

The app is built around `**ProjectFileV1**` (`src/core/ir.ts`):

- **Scene nodes**
  - `**camera2d`**: initial pan/zoom; optional **follow** fields (`followPlotId`, `followWeight`, limits, lead bias, draw ramp).
  - `**plot2d`**: function or parametric definition, `initialDraw`, line width, link to a camera id.
  - `**equation**`: decorative text strip (e.g. LaTeX-like label); opacity/position can be keyed over time.
- **Timeline**
  - `**duration`**, `**fps**`
  - `**tracks**`: list of `**PropertyTrack**` items, each targeting a string path such as `main-plot.draw` or `main-cam.halfWidth`, with time **keyframes** and optional **easing** on the leading key of each segment.

Multiple tracks with the same **target** are merged by time; duplicate times keep the **last** keyframe.

---

## Testing

Tests live next to modules (e.g. `*.test.ts`) and run with **Vitest**. They cover easing, keyframe merging, expression safety/sampling, periodicity heuristics, and polyline trim/tip consistency.

```bash
npm test
```

---

## Limitations and caveats

- **Export format** depends on the browser; there is no guaranteed MP4 path in the stock codebase.
- **Discontinuous functions** (e.g. `tan` near asymptotes) may drop non-finite samples; the polyline can have gaps or odd segments.
- **Very wide** timeline-union domains increase sample count (capped) and can cost more GPU/CPU on export.
- **Director presets** in `shots.ts` are opinionated; custom timelines require manual track authoring or future UI.

---

## License

This repository does not ship a default `LICENSE` file in the described tree; add one if you intend to distribute or open-source the project.

---

## Package name

The npm package is `**eq-visualiser`** (see `package.json`).