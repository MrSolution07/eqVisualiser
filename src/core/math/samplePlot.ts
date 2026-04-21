import type { FunctionPlotDef, PlotDefinition } from "../ir";
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

function fallbackPolyline(xMin: number, xMax: number): Polyline2D {
  const pts = new Float32Array([xMin, 0, xMax, 0]);
  const { cumLen, totalLen } = buildCumLen(pts);
  return { points: pts, cumLen, totalLen };
}

/**
 * Sample y=f(x) on [xMin,xMax]; drops non-finite y so tan spikes do not poison the strip.
 * On compile/parse errors, returns a short horizontal segment instead of throwing (keeps UI alive).
 */
export function sampleFunctionPlotInRange(def: FunctionPlotDef, xMin: number, xMax: number, samples: number): Polyline2D {
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
