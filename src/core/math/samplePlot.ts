import type { PlotDefinition } from "../ir";
import { compileFunctionPlot, compileParametric } from "./compileExpr";

export interface Polyline2D {
  points: Float32Array;
  /** cumulative length along polyline for draw-along */
  cumLen: Float32Array;
  totalLen: number;
}

function buildCumLen(points: Float32Array): { cumLen: Float32Array; totalLen: number } {
  const n = points.length / 2;
  const cumLen = new Float32Array(n);
  let acc = 0;
  cumLen[0] = 0;
  for (let i = 1; i < n; i++) {
    const dx = points[i * 2] - points[(i - 1) * 2];
    const dy = points[i * 2 + 1] - points[(i - 1) * 2 + 1];
    acc += Math.hypot(dx, dy);
    cumLen[i] = acc;
  }
  return { cumLen, totalLen: acc };
}

export function samplePlot(def: PlotDefinition): Polyline2D {
  if (def.kind === "function") {
    const { compile } = compileFunctionPlot(def);
    const f = compile();
    const n = Math.max(16, def.samples);
    const pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = def.xMin + t * (def.xMax - def.xMin);
      const y = f(x);
      pts[i * 2] = x;
      pts[i * 2 + 1] = y;
    }
    const { cumLen, totalLen } = buildCumLen(pts);
    return { points: pts, cumLen, totalLen };
  }
  const { compile } = compileParametric(def);
  const f = compile();
  const n = Math.max(16, def.samples);
  const pts = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const u = def.uMin + t * (def.uMax - def.uMin);
    const p = f(u);
    pts[i * 2] = p.x;
    pts[i * 2 + 1] = p.y;
  }
  const { cumLen, totalLen } = buildCumLen(pts);
  return { points: pts, cumLen, totalLen };
}
