# Equation Visualiser — Cinematic Math

EQ Visualiser is a small web application for turning mathematical functions into **time-driven, cinematic visualizations**. You write a formula in standard math notation (via [mathjs](https://mathjs.org/)), and the app samples the curve, animates how it is drawn, moves a virtual 2D camera with easing, and can **export** the result as a video file from the same render path as the on-screen preview.

The goal is to treat a graph less like a static plot and more like a **composed shot**: progressive line reveal, zoom, pan, and an ending frame that shows broader context—especially for **periodic** behavior (sine-like rhythms), where sampling and framing are tuned so the curve does not clip awkwardly at the edges of a fixed domain.

---

## Features

### Interactive expression editing

- Enter a single expression in the sidebar; the app **classifies** it and updates the main `plot2d` layer (your **timeline tracks are not overwritten**).
- **Explicit functions** `y = f(x)` (or `f(x)=…` / leading `y =` stripped): usual mathjs syntax, e.g. `sin(x)`, `sqrt(25 - x^2)`. The independent variable is `x`; `t` is allowed as an alias for `x` on function plots.
- **Implicit curves** `F(x, y) = 0`: use a **top-level** `=` so the engine builds `F = left − right`, e.g. `x^2 + y^2 = 25`, or type `F` alone when it already has `x` and `y` (e.g. heart-style equations). These are drawn with **marching squares** on a 2D window; only the **largest** contour component is shown so arc-length `draw` and camera follow stay well-defined.
- **Constants** (no variables), e.g. `3*sin(2*pi)`, collapse to a **horizontal line** `y = c` over the plot’s x-range.
- **Apply** commits the expression. **Reset story** reapplies the built-in cinematic storyboard (duration, camera/plot keyframes)—useful after a big formula change if you want a fresh default “director” pass.

### Playback and timeline

- **Play / Pause** drives global time `t` from the current scrub position to the end of the composition.
- A **scrubber** lets you inspect any instant; scrubbing stops playback.
- The default project runs at **30 fps** with a **19 s** timeline (after storyboard); duration and tracks live in the project file shape (`ProjectFileV1`).

### Cinematic behavior (high level)

- **Progressive draw**: the visible stroke is controlled by a normalized `**draw`** property (0…1) on the plot layer, interpreted as progress along **arc length\*\* of the sampled polyline. This produces a continuous “unfolding” line rather than a fade of the whole curve.
- **Camera**: 2D orthographic-style framing with `**centerX`**, `**centerY**`, and `**halfWidth\*\*` (world units per half-width of the view; larger values show more of the plane—i.e. zoomed out).
- **Easing**: keyframed properties interpolate with **linear** segments or **cubic Bézier** curves (CSS-style `(x1,y1,x2,y2)` control points), similar in spirit to easing in non-linear editors.
- **Tip follow** (optional on the camera): the camera can **nudge** toward the current draw tip, with clamping and a smooth ramp so follow does not snap when `draw` is near zero.
- **Periodic-aware sampling**: for many trig-heavy expressions, the engine estimates a period (heuristic AST analysis) and extends the **right** side of the sampling interval so pans and zoom-outs still read as a continuous wave. The **left** side is kept tight to the viewport envelope so the **start of playback** is not an empty frame of off-screen arc length.
- **Timeline-union sampling**: sampling bounds are fixed over the shot so `**draw`** does not “reshuffle” every frame. For **function** plots, world `**xMin**`/`**xMax**` come from the camera envelope (plus margins and optional periodic extension). For **implicit** plots, the same idea applies in **2D** (`x` and `y` ranges from the union of the camera’s view rect and the plot’s scene box), using a fixed **preview aspect\*\* (16∶9) for vertical extent when the engine has no live canvas size.

### Video export

- **Export video** renders the composition off-screen with the same `evaluateAtTime` → WebGL path as the preview, then encodes with `**MediaRecorder`** (typically **WebM\*\* with VP8/VP9, depending on the browser).
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

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start Vite dev server with HMR              |
| `npm run build`     | Typecheck (`tsc`) and production bundle     |
| `npm run preview`   | Serve the production build locally          |
| `npm test`          | Run **Vitest** unit tests (non-interactive) |
| `npm run typecheck` | TypeScript only (`tsc --noEmit`)            |
| `npm run lint`      | ESLint                                      |
| `npm run format`    | Prettier (write)                            |

**Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md) for CI expectations, code style, and documentation practices.

---

## How to use the UI

1. **Expression** — Enter a formula (see [Math and safety](#math-and-safety)). Use `*` for multiplication where needed; LaTeX-style fragments like `\cdot`, `\pi` are normalized where supported.
2. **Apply** — Classifies the string and updates the main plot (function, implicit, or constant). Does **not** replace custom timeline edits.
3. **Play / Pause** — Animates `t`. Playback resumes from the current scrub time.
4. **Scrubber** — Jumps to a time; stops playback.
5. **Export video** — Renders every frame and downloads a `.webm` (or available container). Disabled while playing in the current UI.
6. **Reset story** — Replaces the timeline with the default storyboard tracks and duration (cinematic preset).

---

## Math and safety

Expressions are parsed and compiled through **mathjs** with a **strict allowlist** of functions and a fixed set of **free variables** per plot kind (see `src/core/math/compileExpr.ts`):

- **Function** plots: `x` and `t` (treated as the abscissa)
- **Implicit** plots: `x` and `y` (no `t` in the implicit `F` in v1)
- **Parametric** plots: a single parameter name of your choice in both `x` and `y` expressions

Unsupported constructs include: user-defined functions, assignment blocks, arbitrary identifiers outside the allowed variables, and functions not on the allowlist. This keeps evaluation predictable in the browser. Extending the allowlist is intentional code change.

**Classification** (order matters: e.g. `y = x` is explicit, not an implicit `=` split) lives in `src/core/math/equationClassifier.ts`. **Inequalities** as regions (`<`, `>`) are not implicit curves in v1.

**Parametric plots** (`x(u)`, `y(u)`) are supported in the IR and sampler, but the **sidebar** only edits a **single** expression string, so you cannot select parametric from that field without changing the project elsewhere. The default demo and director heuristics (period, etc.) still center on the main function-style workflow.

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
      compileExpr.ts      # Safe mathjs compile (function / implicit / parametric)
      equationClassifier.ts  # String → function | implicit | constant
      samplePlot.ts       # Sample function / parametric / implicit fallback → Polyline2D
      implicitPlot.ts     # Marching squares for F(x,y)=0 (largest component)
      normalizeExpression.ts
      analyzePeriodicity.ts
  director/
    shots.ts              # Storyboard presets → concrete PropertyTracks
  engine/
    evaluateAtTime        # evaluateProject.ts — pure render state at time t
    keyframes.ts          # Merge tracks, interpolate with easing
    easing.ts             # Cubic Bézier easing
    cameraEnvelope.ts     # Min/max camera pose over the timeline
    plotSampling.ts       # Timeline-union x (function) and 2D bounds (implicit)
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

**Data flow in one sentence:** the **timeline** animates numeric properties on **scene nodes**; `evaluateAtTime` samples plots (with envelope-aware bounds), resolves cameras (including follow), and returns a `**RenderStateV1`** that `**Plot2DWebGL\*\*` draws.

---

## Project model (v1 IR)

The app is built around `**ProjectFileV1**` (`src/core/ir.ts`):

- **Scene nodes**
  - `**camera2d`**: initial pan/zoom; optional **follow\*\* fields (`followPlotId`, `followWeight`, limits, lead bias, draw ramp).
  - `**plot2d`**: **function**, **implicit** (`F(x,y)=0`), or **parametric\*\* definition, `initialDraw`, line width, link to a camera id.
  - `**equation**`: decorative text strip (e.g. LaTeX-like label); opacity/position can be keyed over time.
- **Timeline**
  - `**duration`**, `**fps\*\*`
  - `**tracks**`: list of `**PropertyTrack**` items, each targeting a string path such as `main-plot.draw` or `main-cam.halfWidth`, with time **keyframes** and optional **easing** on the leading key of each segment.

Multiple tracks with the same **target** are merged by time; duplicate times keep the **last** keyframe.

---

## Testing

Tests live next to modules (e.g. `*.test.ts`) and run with **Vitest**. They cover easing, keyframe merging, expression classification, implicit sampling, function safety, periodicity heuristics, and polyline trim/tip consistency.

```bash
npm test
```

---

## Limitations and caveats

- **Export format** depends on the browser; there is no guaranteed MP4 path in the stock codebase.
- **Discontinuous functions** (e.g. `tan` near asymptotes) may drop non-finite samples; the polyline can have gaps or odd segments.
- **Implicit** curves use a **fixed grid** and **largest** contour only; very thin features, high curvature, or **multiple** separate loops may look incomplete. **Time-varying** `F(x,y,t)` is not supported in v1. Preview sampling uses a fixed 16∶9 world aspect for vertical bounds, which can differ slightly from a resized browser window.
- **Very wide** timeline-union domains increase sample / cell count (capped) and can cost more GPU/CPU on export.
- **Director presets** in `shots.ts` are opinionated; custom timelines require manual track authoring or future UI.

---

## License

This repository does not ship a default `LICENSE` file in the described tree; add one if you intend to distribute or open-source the project.

---

## Package name

The npm package is `**eq-visualiser`\*\* (see `package.json`).
