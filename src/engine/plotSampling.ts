/**
 * Timeline-union x extent for function plots (arclength-stable draw).
 * See plan: never use unconstrained per-frame symmetric extent with draw 0..1.
 */

import type { FunctionPlotDef } from "../core/ir";
import type { PeriodicAnalysis } from "../core/math/analyzePeriodicity";
import type { CameraEnvelope2D } from "./cameraEnvelope";

/** Past the rightmost viewport edge (pan + periodic continuation). */
const K_RIGHT_MARGIN_HW = 2.25;
const K2_MARGIN_PERIODS = 2;
/** Small pad past the leftmost viewport edge so the curve head enters the frame at draw≈0. */
const K_LEFT_MARGIN_HW = 0.12;

const MAX_SAMPLES = 4096;
const MIN_SAMPLES = 64;
const QUANT_STEP_MIN = 0.25;

export interface SamplingBounds {
  xMin: number;
  xMax: number;
  samples: number;
}

function quantizeStep(maxHalfWidth: number): number {
  return Math.max(QUANT_STEP_MIN, maxHalfWidth / 24);
}

export function quantizeExtent(xMin: number, xMax: number, step: number): { xMin: number; xMax: number } {
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
