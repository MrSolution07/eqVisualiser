import type { Polyline2D } from "../core/math/samplePlot";

/** World-space tip of the curve at draw fraction (by arclength). */
export function tipAtDraw(poly: Polyline2D, draw: number): { x: number; y: number } {
  const p = poly.points;
  const c = poly.cumLen;
  const n = p.length / 2;
  if (n === 0) return { x: 0, y: 0 };
  if (draw <= 0) return { x: p[0]!, y: p[1]! };
  if (draw >= 1 || poly.totalLen <= 0) return { x: p[(n - 1) * 2]!, y: p[(n - 1) * 2 + 1]! };
  const target = draw * poly.totalLen;
  let end = 0;
  for (let i = 0; i < n; i++) {
    if (c[i]! <= target) end = i;
  }
  if (end < n - 1) {
    const t0 = c[end]!;
    const t1 = c[end + 1]!;
    if (t1 > t0 && target > t0) {
      const w = (target - t0) / (t1 - t0);
      const x = p[end * 2]! + w * (p[(end + 1) * 2]! - p[end * 2]!);
      const y = p[end * 2 + 1]! + w * (p[(end + 1) * 2 + 1]! - p[end * 2 + 1]!);
      return { x, y };
    }
  }
  return { x: p[end * 2]!, y: p[end * 2 + 1]! };
}

/** Returns a sub-polyline ending at draw * total arclength (0-1). */
export function trimPolyline(poly: Polyline2D, draw: number): Float32Array {
  const p = poly.points;
  const c = poly.cumLen;
  const n = p.length / 2;
  // draw == 0 would yield no geometry (extruder needs ≥2 points); show the curve head so play starts visible.
  if (draw <= 0) {
    if (n < 1) return new Float32Array(0);
    if (n === 1) {
      const x = p[0]!;
      const y = p[1]!;
      const eps = 1e-4 * (Math.abs(x) + Math.abs(y) + 1);
      return new Float32Array([x, y, x + eps, y]);
    }
    return new Float32Array([p[0]!, p[1]!, p[2]!, p[3]!]);
  }
  if (draw >= 1) return p;
  const target = draw * poly.totalLen;
  let end = 0;
  for (let i = 0; i < n; i++) {
    if (c[i]! <= target) end = i;
  }
  if (end < 1) {
    if (c[0]! >= target) return new Float32Array(0);
  }
  const out: number[] = [];
  for (let i = 0; i <= end; i++) {
    out.push(p[i * 2]!, p[i * 2 + 1]!);
  }
  if (end < n - 1) {
    const t0 = c[end]!;
    const t1 = c[end + 1]!;
    if (t1 > t0 && target > t0) {
      const w = (target - t0) / (t1 - t0);
      const x = p[end * 2]! + w * (p[(end + 1) * 2]! - p[end * 2]!);
      const y = p[end * 2 + 1]! + w * (p[(end + 1) * 2 + 1]! - p[end * 2 + 1]!);
      out.push(x, y);
    }
  }
  return new Float32Array(out);
}
