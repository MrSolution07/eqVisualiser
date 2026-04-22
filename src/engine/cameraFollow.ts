import type { ProjectFileV1, PropertyTrack } from "../core/ir";
import type { Camera2DNode } from "../core/ir";
import type { Polyline2D } from "../core/math/samplePlot";
import type { ResolvedCamera2D, ResolvedPlot2D } from "./renderState";
import { valueAtTime } from "./keyframes";
import { tipAtDraw } from "../render/trimPolyline";

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t2 = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t2 * t2 * (3 - 2 * t2);
}

function getNum(
  tracks: Map<string, PropertyTrack>,
  target: string,
  time: number,
  initial: number,
): number {
  const tr = tracks.get(target);
  if (!tr) return initial;
  return valueAtTime(tr, time, initial);
}

function getCamera2D(
  node: Camera2DNode,
  tracks: Map<string, PropertyTrack>,
  time: number,
): ResolvedCamera2D {
  const p = node.initial;
  return {
    id: node.id,
    centerX: getNum(tracks, `${node.id}.centerX`, time, p.centerX),
    centerY: getNum(tracks, `${node.id}.centerY`, time, p.centerY),
    halfWidth: getNum(tracks, `${node.id}.halfWidth`, time, p.halfWidth),
  };
}

/**
 * 1 for draw up to the falloff start, 0 at draw=1, smooth between. `falloffStart >= 1` = no end falloff.
 */
export function followDrawEndFalloff(draw: number, falloffStart: number): number {
  if (falloffStart >= 1) return 1;
  return 1 - smoothstep(falloffStart, 1, draw);
}

/**
 * Normalized weights for backward blend (j=0 oldest sample, j=n-1 = time t, highest weight).
 */
export function exponentialSmoothWeights(sampleCount: number): number[] {
  if (sampleCount < 2) {
    return [1];
  }
  const w: number[] = [];
  for (let j = 0; j < sampleCount; j++) {
    const u = (sampleCount - 1 - j) / Math.max(1, sampleCount - 1);
    w.push(Math.exp(-3 * u));
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

type VelocityContext = {
  plotId: string;
  tracks: Map<string, PropertyTrack>;
  initialDraw: number;
  duration: number;
};

function leadTip(
  _p: Camera2DNode["initial"],
  _base: ResolvedCamera2D,
  poly: Polyline2D,
  draw: number,
  tNow: number,
  vGain: number,
  vctx: VelocityContext | undefined,
): { x: number; y: number } {
  const tip0 = tipAtDraw(poly, draw);
  if (vGain <= 1e-9 || !vctx) return tip0;

  const epsT = 1 / 30;
  const tPrev = Math.max(0, tNow - epsT);
  const drawPrev = getNum(vctx.tracks, `${vctx.plotId}.draw`, tPrev, vctx.initialDraw);
  const dP = Math.max(0, Math.min(1, drawPrev));
  const prev = tipAtDraw(poly, dP);
  const maxB = 2.2;
  const tx = tip0.x + Math.max(-maxB, Math.min(maxB, vGain * (tip0.x - prev.x)));
  const ty = tip0.y + Math.max(-maxB, Math.min(maxB, vGain * (tip0.y - prev.y)));
  return { x: tx, y: ty };
}

/**
 * One instant of follow: weight already includes followWeight, ramp, and end falloff.
 */
function followOffsetAtTime(
  p: Camera2DNode["initial"],
  base: ResolvedCamera2D,
  poly: Polyline2D,
  draw: number,
  w: number,
  tForVel: number,
  vctx: VelocityContext | undefined,
  vGain: number,
): { dx: number; dy: number } {
  if (w <= 0) return { dx: 0, dy: 0 };
  const tip = leadTip(p, base, poly, draw, tForVel, vGain, vctx);
  const bias = p.followLeadBias ?? 0.12;
  const leadX = base.centerX + bias * base.halfWidth;
  const leadY = base.centerY;
  const maxX = p.followMaxX ?? 2;
  const maxY = p.followMaxY ?? 0.55;

  let dx = w * (tip.x - leadX);
  let dy = w * (tip.y - leadY) * 0.35;
  dx = Math.max(-maxX, Math.min(maxX, dx));
  dy = Math.max(-maxY, Math.min(maxY, dy));
  return { dx, dy };
}

export type FollowTimeContext = {
  project: ProjectFileV1;
  t: number;
  tracks: Map<string, PropertyTrack>;
  plotId: string;
  plotInitialDraw: number;
};

/**
 * Resolves final camera: backward-smoothed follow offset, draw end falloff, optional velocity lead.
 * `followSmoothSeconds === 0` recovers the legacy one-step (no time blend) behavior when falloff/velocity match legacy defaults.
 */
export function resolveCameraWithFollow(
  node: Camera2DNode,
  base: ResolvedCamera2D,
  plots: Record<string, ResolvedPlot2D>,
  ctx: FollowTimeContext,
): ResolvedCamera2D {
  const p = node.initial;
  const followWeight = p.followWeight ?? 0;
  if (followWeight <= 0) return base;

  let plotId = p.followPlotId;
  if (!plotId) {
    const first = Object.keys(plots)[0];
    if (!first) return base;
    plotId = first;
  }

  const pl = plots[plotId];
  if (!pl) return base;

  const poly = pl.polyline;
  const { project, t, tracks, plotInitialDraw } = ctx;
  const duration = project.timeline.duration;
  const falloffStart = p.followDrawFalloffStart ?? 1;
  const vGain = p.followVelocityLeadGain ?? 0;
  const vctx: VelocityContext | undefined =
    vGain > 1e-9 ? { plotId, tracks, initialDraw: plotInitialDraw, duration } : undefined;

  const tau = p.followSmoothSeconds ?? 0;
  const n = Math.max(2, Math.min(32, Math.round(p.followSmoothSampleCount ?? 12)));

  if (tau <= 1e-9) {
    const drawT = pl.draw;
    const rIn = smoothstep(0, p.followRampDrawMin ?? 0.06, drawT);
    const w0 = followWeight * rIn * followDrawEndFalloff(drawT, falloffStart);
    const { dx, dy } = followOffsetAtTime(p, base, poly, drawT, w0, t, vctx, vGain);
    return { ...base, centerX: base.centerX + dx, centerY: base.centerY + dy };
  }

  const weights = exponentialSmoothWeights(n);
  let accDx = 0;
  let accDy = 0;

  for (let j = 0; j < n; j++) {
    const uSpan = (tau * (n - 1 - j)) / Math.max(1, n - 1);
    const u = Math.max(0, Math.min(duration, t - uSpan));
    const baseU = getCamera2D(node, tracks, u);
    const drawU = getNum(tracks, `${plotId}.draw`, u, plotInitialDraw);
    const dU = Math.max(0, Math.min(1, drawU));
    const rU = smoothstep(0, p.followRampDrawMin ?? 0.06, dU);
    const wBase = followWeight * rU * followDrawEndFalloff(dU, falloffStart);
    const { dx, dy } = followOffsetAtTime(p, baseU, poly, dU, wBase, u, vctx, vGain);
    const wJ = weights[j] ?? 0;
    accDx += wJ * dx;
    accDy += wJ * dy;
  }

  return { ...base, centerX: base.centerX + accDx, centerY: base.centerY + accDy };
}
