import type { FunctionPlotDef, PlotDefinition, ImplicitPlotDef } from "../ir";
import { buildCumLen } from "./buildCumLen";
import { compileFunctionPlot, compileParametric } from "./compileExpr";
import { sampleImplicitPlotInRange } from "./implicitPlot";

export interface Polyline2D {
  points: Float32Array;
  /** cumulative length along polyline for draw-along */
  cumLen: Float32Array;
  totalLen: number;
}

export { buildCumLen } from "./buildCumLen";

function fallbackPolyline(xMin: number, xMax: number): Polyline2D {
  const pts = new Float32Array([xMin, 0, xMax, 0]);
  const { cumLen, totalLen } = buildCumLen(pts);
  return { points: pts, cumLen, totalLen };
}

/** Fallback grid resolution for implicit plots when 2D timeline-union is not used (e.g. tests). */
function defaultImplicitGridN(def: ImplicitPlotDef): number {
  const s = def.samples;
  return Math.max(8, Math.min(256, Math.floor(Math.sqrt(Math.max(64, s)))));
}

/**
 * Sample y=f(x) on [xMin,xMax]; drops non-finite y so tan spikes do not poison the strip.
 * On compile/parse errors, returns a short horizontal segment instead of throwing (keeps UI alive).
 */
export function sampleFunctionPlotInRange(
  def: FunctionPlotDef,
  xMin: number,
  xMax: number,
  samples: number,
): Polyline2D {
  let compileFn: () => (x: number) => number;
  try {
    compileFn = compileFunctionPlot(def).compile;
  } catch {
    return fallbackPolyline(xMin, xMax);
  }
  const f = compileFn();
  const n = Math.max(16, samples);
  const buf: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const x = xMin + t * (xMax - xMin);
    let y: number;
    try {
      y = f(x);
    } catch {
      return fallbackPolyline(xMin, xMax);
    }
    if (Number.isFinite(x) && Number.isFinite(y)) {
      buf.push(x, y);
    }
  }
  if (buf.length < 4) {
    let y0: number;
    let y1: number;
    try {
      y0 = f(xMin);
      y1 = f(xMax);
    } catch {
      return fallbackPolyline(xMin, xMax);
    }
    const a = Number.isFinite(y0) ? y0 : 0;
    const b = Number.isFinite(y1) ? y1 : a;
    buf.length = 0;
    buf.push(xMin, a, xMax, b);
  }
  const pts = new Float32Array(buf);
  const { cumLen, totalLen } = buildCumLen(pts);
  return { points: pts, cumLen, totalLen };
}

export function samplePlot(def: PlotDefinition): Polyline2D {
  if (def.kind === "function") {
    return sampleFunctionPlotInRange(def, def.xMin, def.xMax, def.samples);
  }
  if (def.kind === "implicit") {
    const n = defaultImplicitGridN(def);
    return sampleImplicitPlotInRange(def, def.xMin, def.xMax, def.yMin, def.yMax, n, n);
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
