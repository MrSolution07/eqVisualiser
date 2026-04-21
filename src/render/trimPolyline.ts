import type { Polyline2D } from "../core/math/samplePlot";

/** Returns a sub-polyline ending at draw * total arclength (0-1). */
export function trimPolyline(poly: Polyline2D, draw: number): Float32Array {
  const p = poly.points;
  const c = poly.cumLen;
  if (draw <= 0) return new Float32Array(0);
  if (draw >= 1) return p;
  const target = draw * poly.totalLen;
  const n = p.length / 2;
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
