import type { Camera2DNode } from "../core/ir";
import type { ResolvedCamera2D, ResolvedPlot2D } from "./renderState";
import { tipAtDraw } from "../render/trimPolyline";

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function resolveCameraWithFollow(
  node: Camera2DNode,
  base: ResolvedCamera2D,
  plots: Record<string, ResolvedPlot2D>,
): ResolvedCamera2D {
  const p = node.initial;
  const weight = p.followWeight ?? 0;
  if (weight <= 0) return base;

  let plotId = p.followPlotId;
  if (!plotId) {
    const first = Object.keys(plots)[0];
    if (!first) return base;
    plotId = first;
  }

  const pl = plots[plotId];
  if (!pl) return base;

  const ramp = smoothstep(0, p.followRampDrawMin ?? 0.06, pl.draw);
  const w = weight * ramp;
  if (w <= 0) return base;

  const tip = tipAtDraw(pl.polyline, pl.draw);
  const bias = p.followLeadBias ?? 0.12;
  const leadX = base.centerX + bias * base.halfWidth;
  const leadY = base.centerY;
  const maxX = p.followMaxX ?? 2;
  const maxY = p.followMaxY ?? 0.55;

  let dx = w * (tip.x - leadX);
  let dy = w * (tip.y - leadY) * 0.35;
  dx = Math.max(-maxX, Math.min(maxX, dx));
  dy = Math.max(-maxY, Math.min(maxY, dy));

  return {
    ...base,
    centerX: base.centerX + dx,
    centerY: base.centerY + dy,
  };
}
