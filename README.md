

# Equation Visualiser

**Cinematic, interactive math on the canvas.**

Turn formulas into time-driven shots—progressive draws, eased camera moves, periodic-aware sampling—and export the same WebGL path as video.

[Quick start](#quick-start) · [Features](#features) · [Roadmap](#roadmap)



---

## Why this exists

Static plots answer “what does it look like?” **EQ Visualiser** answers “how should we *see* it unfold?” The UI is built around **scrubbing**, **playback**, and a **timeline**: you compose motion on the curve and the virtual 2D camera, then **export** (typically WebM via `MediaRecorder`) from the same render pipeline as the preview.

Today the focus is **2D**: explicit functions, implicit curves $F(x,y)=0$, and parametric paths in the engine—driven by [mathjs](https://mathjs.org/) with a strict, browser-safe evaluation surface.

---

## Features


|            |                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edit**   | One expression in the sidebar; the app classifies it and updates the main `plot2d` layer **without** wiping your custom timeline tracks.                |
| **Play**   | Global time `t`, scrubber, play/pause—inspect any frame of the composition.                                                                             |
| **Direct** | Progressive **arc-length** reveal (`draw`), keyframed **camera** (`centerX`, `centerY`, `halfWidth`), **cubic Bézier** easing, optional **tip follow**. |
| **Ship**   | **WebGL 2** line rendering, grid/axes in world space, **export video** aligned to project duration and fps.                                             |


**Expression modes** (click to expand)

- **Explicit** `y = f(x)` (or `f(x)=…`): `x` is the independent variable; `t` may alias `x` on function plots.
- **Implicit** `F(x,y)=0`: use a top-level `=`, e.g. `x^2 + y^2 = 25`. **Marching squares** on a 2D window; the **largest** contour is used so arc-length draw and camera follow stay well-defined.
- **Constants** (no variables) collapse to a horizontal line over the plot’s x-range.
- **Apply** commits the expression. **Reset story** reapplies the built-in cinematic storyboard after big formula changes.



**Cinematic details**

- **Progressive draw**: stroke visibility follows normalized progress along **arc length** of the sampled polyline—not a whole-curve fade.
- **Periodic-aware sampling**: for many trig-heavy expressions, a heuristic estimates period and extends sampling so pans and zoom-outs still read as a continuous wave, without an empty opening frame.
- **Timeline-union sampling**: bounds are fixed over the shot so `draw` does not reshuffle every frame. Implicit plots use a fixed **16∶9** preview aspect for vertical extent when the engine has no live canvas size.



**Requirements**

- **Node.js** 20+ (see `package.json` `engines`) for install and build.
- A **modern browser** with **WebGL 2**.
- **Video export** needs `canvas.captureStream` and a supported **MediaRecorder** MIME type (often WebM).



---

## Roadmap

**3D integrals and volume** are a natural next act: definite integrals as **signed area** under a curve already fit the 2D story; extending the same timeline and camera language to **surfaces**, **solids of revolution**, and **scalar fields** $z = f(x,y)$ would let some integrals be **felt**—orbit the solid, scrub a slicing plane, or animate Riemann stacks in depth—while keeping the same “one render path for preview and export” philosophy.

Nothing in the current UI promises 3D yet; when it lands, it will likely sit alongside 2D plots in the scene graph and reuse easing, keyframes, and export.

---

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (often `http://localhost:5173`). Edit the expression, **Apply**, then **Play**. Use **Reset story** for a fresh default camera/plot animation.

### Scripts


| Command                | Purpose                         |
| ---------------------- | ------------------------------- |
| `npm run dev`          | Vite dev server (with `--host`) |
| `npm run build`        | Typecheck and production bundle |
| `npm run preview`      | Serve the production build      |
| `npm test`             | Vitest (non-interactive)        |
| `npm run typecheck`    | `tsc --noEmit`                  |
| `npm run lint`         | ESLint                          |
| `npm run lint:fix`     | ESLint with `--fix`             |
| `npm run format`       | Prettier (write)                |
| `npm run format:check` | Prettier (check)                |


**Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## How to use the UI

1. **Expression** — Enter a formula; use `*` where needed. Some LaTeX-style fragments (e.g. `\cdot`, `\pi`) are normalized where supported.
2. **Apply** — Classifies the string and updates the main plot. Does **not** replace custom timeline edits.
3. **Play / Pause** — Animates time from the current scrub position.
4. **Scrubber** — Jump to any instant; stops playback.
5. **Export video** — Full timeline render; often `.webm`. Disabled while playing in the current UI.
6. **Reset story** — Default storyboard tracks and duration.

---

## Math and safety

Expressions go through **mathjs** with a **strict allowlist** and fixed free variables per plot kind (`src/core/math/compileExpr.ts`):

- **Function** plots: `x` and `t` (as abscissa)
- **Implicit** plots: `x` and `y` (no `t` in the implicit `F` in v1)
- **Parametric** plots: one parameter name in both `x` and `y` expressions

Unsupported: user-defined functions, assignment blocks, arbitrary identifiers, and functions not on the allowlist.

**Classification** order matters (e.g. `y = x` is explicit, not implicit). **Inequalities** as filled regions are not implicit curves in v1.

**Parametric** is supported in the IR and sampler; the sidebar still edits a **single** expression string, so parametric workflows need project edits outside that field for now.

**Periodicity** (`analyzePeriodicity.ts`) is **heuristic**: affine trig arguments in `x`, commensurate periods for sums; unknown otherwise so the director does not invent a wrong period.

---

**Architecture** (file map)

```
src/
  App.tsx                 # Shell: canvas, controls, export, animation loop
  store.ts                # Zustand: project, time, play, Apply / Reset story
  core/
    ir.ts                 # Scene graph + timeline types
    schema.ts             # Default project factory
    math/
      compileExpr.ts      # Safe mathjs compile
      equationClassifier.ts
      samplePlot.ts
      implicitPlot.ts     # Marching squares, largest component
      normalizeExpression.ts
      analyzePeriodicity.ts
  director/
    shots.ts              # Storyboard presets → PropertyTracks
  engine/
    evaluateProject.ts    # Pure render state at time t
    keyframes.ts          # Merge tracks, easing
    easing.ts
    cameraEnvelope.ts
    plotSampling.ts
    cameraFollow.ts
    renderState.ts
    timelineUtils.ts
  render/
    trimPolyline.ts       # Arc-length trim + tip
    lineExtrude.ts
    webgl2/Plot2DWebGL.ts
  export/
    webCodecsVideo.ts     # MediaRecorder export
```

**Data flow:** the **timeline** animates numeric properties on **scene nodes**; `evaluateAtTime` samples plots (envelope-aware bounds), resolves cameras (including follow), and returns `RenderStateV1` for `Plot2DWebGL`.



**Project model (v1)**

Built around `**ProjectFileV1`** (`src/core/ir.ts`):

- **Scene nodes**
  - `**camera2d`**: pan/zoom; optional follow (`followPlotId`, `followWeight`, limits, lead bias, draw ramp).
  - `**plot2d**`: function, implicit, or parametric definition; `initialDraw`, line width, camera link.
  - `**equation**`: decorative text strip; opacity/position can be keyed over time.
- **Timeline**
  - `duration`, `fps`
  - `**tracks`**: `PropertyTrack` items targeting paths like `main-plot.draw` or `main-cam.halfWidth`, with keyframes and optional easing per segment.

Multiple tracks on the same **target** merge by time; duplicate times keep the **last** keyframe.



---

## Testing

```bash
npm test
```

Vitest covers easing, keyframes, classification, implicit sampling, compile safety, periodicity heuristics, and polyline trim/tip behavior.

---

## Limitations

- **Export format** depends on the browser; no guaranteed MP4 in stock code.
- **Discontinuous** functions (e.g. `tan` near asymptotes) may drop samples and gap the polyline.
- **Implicit** curves: fixed grid, largest contour only; thin features or multiple loops may look incomplete. **Time-varying** `F(x,y,t)` is not in v1.
- **Wide** timeline-union domains increase work (capped) and cost more on export.
- **Director** presets are opinionated; deep customization means track authoring or future UI.

---

## License

No default `LICENSE` is shipped; add one if you intend to distribute or open-source the project.

---

**Package:** `eq-visualiser` (`package.json`).

well still cooking...