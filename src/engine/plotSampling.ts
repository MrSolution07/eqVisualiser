/**
 * Timeline-union x extent for function plots (arclength-stable draw).
 * See plan: never use unconstrained per-frame symmetric extent with draw 0..1.
 */

import type { FunctionPlotDef, ImplicitPlotDef } from "../core/ir";
import type { PeriodicAnalysis } from "../core/math/analyzePeriodicity";
import { CAMERA_PREVIEW_ASPECT, type CameraEnvelope2D } from "./cameraEnvelope";

/** Past the rightmost viewport edge (pan + periodic continuation). */
const K_RIGHT_MARGIN_HW = 2.25;
const K2_MARGIN_PERIODS = 2;
/** Small pad past the leftmost viewport edge so the curve head enters the frame at draw≈0. */
const K_LEFT_MARGIN_HW = 0.12;

const MAX_SAMPLES = 4096;
const MIN_SAMPLES = 64;
const QUANT_STEP_MIN = 0.25;
/** Marching-rect cell cap (nx*ny) for implicit 2D sampling. */
const MAX_CELLS = 150_000;
const MIN_IMPLICIT_GRID = 8;
const MAX_IMPLICIT_GRID = 512;

export interface SamplingBounds {
  xMin: number;
  xMax: number;
  samples: number;
}

function quantizeStep(maxHalfWidth: number): number {
  return Math.max(QUANT_STEP_MIN, maxHalfWidth / 24);
}

export function quantizeExtent(
  xMin: number,
  xMax: number,
  step: number,
): { xMin: number; xMax: number } {
  return {
    xMin: Math.floor(xMin / step) * step,
    xMax: Math.ceil(xMax / step) * step,
  };
}

/**
 * Compute fixed world x-bounds for sampling a function plot over the whole timeline,
 * plus margin from camera envelope and optional fundamental period.
 * The `envelope` must come from `computeCameraEnvelope(..., project.timeline.duration)`
 * (same project instance `evaluateAtTime` uses) so the drawn polyline matches arclength `draw`.
 */
export function computeTimelineUnionSampling(
  def: FunctionPlotDef,
  envelope: CameraEnvelope2D,
  periodic: PeriodicAnalysis,
): SamplingBounds {
  const sceneXMin = def.xMin;
  const sceneXMax = def.xMax;
  const hw = envelope.maxHalfWidth;
  const marginLeft = K_LEFT_MARGIN_HW * hw;
  let marginRight = K_RIGHT_MARGIN_HW * hw;
  if (periodic.kind === "periodic") {
    marginRight += K2_MARGIN_PERIODS * periodic.period;
  }

  // Anchor sampling to actual viewport bounds over the shot (not center ± huge symmetric margin),
  // so early arclength isn’t entirely off-screen to the left.
  const viewXMin = envelope.minViewLeft - marginLeft;
  const viewXMax = envelope.maxViewRight + marginRight;

  let xMin = Math.min(sceneXMin, viewXMin);
  let xMax = Math.max(sceneXMax, viewXMax);

  const step = quantizeStep(hw);
  const q = quantizeExtent(xMin, xMax, step);
  xMin = q.xMin;
  xMax = q.xMax;

  const baseWidth = sceneXMax - sceneXMin;
  const newWidth = xMax - xMin;
  let ratio = 1;
  if (Math.abs(baseWidth) > 1e-9) {
    ratio = newWidth / baseWidth;
  }
  const scaled = Math.round(Math.max(MIN_SAMPLES, def.samples * ratio));
  const samples = Math.min(MAX_SAMPLES, Math.max(16, scaled));

  return { xMin, xMax, samples };
}

/** Stable cache key for sampled polyline (includes derived extent). */
export function functionPlotSamplingKey(def: FunctionPlotDef, bounds: SamplingBounds): string {
  return JSON.stringify({
    kind: def.kind,
    expression: def.expression,
    xMin: bounds.xMin,
    xMax: bounds.xMax,
    samples: bounds.samples,
  });
}

export interface SamplingBounds2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  nx: number;
  ny: number;
}

const K2_Y_MARGIN = 0.12;

/**
 * 2D world window for F(x,y)=0, union of scene box and full camera view (timeline union),
 * plus margins. `aspect` is the fixed preview width/height (same as [`CAMERA_PREVIEW_ASPECT`]).
 */
export function computeTimelineUnionSampling2D(
  def: ImplicitPlotDef,
  envelope: CameraEnvelope2D,
  aspect: number = CAMERA_PREVIEW_ASPECT,
): SamplingBounds2D {
  const hw = envelope.maxHalfWidth;
  const marginLeft = K_LEFT_MARGIN_HW * hw;
  const marginRight = K_RIGHT_MARGIN_HW * hw;
  const halfH = hw / aspect;
  const marginY = K2_Y_MARGIN * halfH;

  const viewXMin = envelope.minViewLeft - marginLeft;
  const viewXMax = envelope.maxViewRight + marginRight;
  const viewYMin = envelope.minViewBottom - marginY;
  const viewYMax = envelope.maxViewTop + marginY;

  let xMin = Math.min(def.xMin, viewXMin);
  let xMax = Math.max(def.xMax, viewXMax);
  let yMin = Math.min(def.yMin, viewYMin);
  let yMax = Math.max(def.yMax, viewYMax);

  const step = quantizeStep(hw);
  const qx = quantizeExtent(xMin, xMax, step);
  xMin = qx.xMin;
  xMax = qx.xMax;
  const stepY = Math.max(QUANT_STEP_MIN, hw / aspect / 24);
  const qy = quantizeExtent(yMin, yMax, stepY);
  yMin = qy.xMin;
  yMax = qy.xMax;

  const baseW = def.xMax - def.xMin;
  const newW = xMax - xMin;
  const baseH = def.yMax - def.yMin;
  const newH = yMax - yMin;
  const ratioW = Math.abs(baseW) > 1e-9 ? newW / baseW : 1;
  const ratioH = Math.abs(baseH) > 1e-9 ? newH / baseH : 1;
  const scaleR = Math.max(1, Math.sqrt(ratioW * ratioH));
  const cellBudget = Math.min(
    MAX_CELLS,
    Math.max(64 * 64, Math.min(def.samples * def.samples, 1_000_000) * scaleR),
  );

  const dx = xMax - xMin;
  const dy = yMax - yMin;
  let nx = MIN_IMPLICIT_GRID;
  let ny = MIN_IMPLICIT_GRID;
  if (dx > 1e-12 && dy > 1e-12) {
    ny = Math.max(
      MIN_IMPLICIT_GRID,
      Math.min(MAX_IMPLICIT_GRID, Math.floor(Math.sqrt((cellBudget * dy) / dx))),
    );
    nx = Math.max(MIN_IMPLICIT_GRID, Math.min(MAX_IMPLICIT_GRID, Math.floor(cellBudget / ny)));
  } else {
    const n0 = Math.max(
      MIN_IMPLICIT_GRID,
      Math.min(MAX_IMPLICIT_GRID, Math.floor(Math.sqrt(cellBudget))),
    );
    nx = n0;
    ny = n0;
  }
  while (nx * ny > MAX_CELLS && (nx > MIN_IMPLICIT_GRID || ny > MIN_IMPLICIT_GRID)) {
    if (nx > ny) nx = Math.max(MIN_IMPLICIT_GRID, nx - 1);
    else ny = Math.max(MIN_IMPLICIT_GRID, ny - 1);
  }

  return { xMin, xMax, yMin, yMax, nx, ny };
}

export function implicitPlotSamplingKey(
  def: ImplicitPlotDef,
  bounds: SamplingBounds2D,
  aspect: number = CAMERA_PREVIEW_ASPECT,
): string {
  return JSON.stringify({
    kind: def.kind,
    expression: def.expression,
    xMin: bounds.xMin,
    xMax: bounds.xMax,
    yMin: bounds.yMin,
    yMax: bounds.yMax,
    nx: bounds.nx,
    ny: bounds.ny,
    aspect,
  });
}
