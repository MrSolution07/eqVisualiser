import type { ImplicitPlotDef } from "../ir";
import { compileImplicitPlot } from "./compileExpr";
import type { Polyline2D } from "./samplePlot";

function buildCumLen(points: Float32Array): { cumLen: Float32Array; totalLen: number } {
  const n = points.length / 2;
  const cumLen = new Float32Array(n);
  let acc = 0;
  cumLen[0] = 0;
  for (let i = 1; i < n; i++) {
    const dx = points[i * 2] - points[(i - 1) * 2]!;
    const dy = points[i * 2 + 1] - points[(i - 1) * 2 + 1]!;
    acc += Math.hypot(dx, dy);
    cumLen[i] = acc;
  }
  return { cumLen, totalLen: acc };
}

const INSIDE = (f: number) => f < 0;

function lerp1d(f0: number, f1: number, t0: number, t1: number): number {
  if (Math.abs(f0 - f1) < 1e-15) return (t0 + t1) * 0.5;
  return t0 + (f0 / (f0 - f1)) * (t1 - t0);
}

type Pt = { x: number; y: number };
type Seg = { a: Pt; b: Pt };

function segListForCell(
  f00: number,
  f10: number,
  f11: number,
  f01: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Seg[] {
  if ([f00, f10, f11, f01].some((u) => !Number.isFinite(u))) return [];
  const c0 = INSIDE(f00) ? 1 : 0;
  const c1 = INSIDE(f10) ? 1 : 0;
  const c2 = INSIDE(f11) ? 1 : 0;
  const c3 = INSIDE(f01) ? 1 : 0;
  const id = c0 | (c1 << 1) | (c2 << 2) | (c3 << 3);
  if (id === 0 || id === 15) return [];

  const sB = c0 !== c1;
  const sR = c1 !== c2;
  const sT = c2 !== c3;
  const sL = c3 !== c0;

  const pb = sB ? { x: lerp1d(f00, f10, x0, x1), y: y0 } : null;
  const pr = sR ? { x: x1, y: lerp1d(f10, f11, y0, y1) } : null;
  const pt = sT ? { x: lerp1d(f11, f01, x1, x0), y: y1 } : null;
  const pl = sL ? { x: x0, y: lerp1d(f01, f00, y1, y0) } : null;

  const e = [pb, pr, pt, pl] as (Pt | null)[];

  const segs: Seg[] = [];
  const nEdge = (sB ? 1 : 0) + (sR ? 1 : 0) + (sT ? 1 : 0) + (sL ? 1 : 0);
  if (nEdge === 2) {
    const ptlist = e.filter((q): q is Pt => q != null);
    if (ptlist.length === 2) segs.push({ a: ptlist[0]!, b: ptlist[1]! });
  } else if (nEdge === 4 && (id === 5 || id === 10) && pb && pr && pt && pl) {
    const av = 0.25 * (f00 + f10 + f11 + f01);
    if (av * f00 > 0) {
      segs.push({ a: pb, b: pt }, { a: pr, b: pl });
    } else {
      segs.push({ a: pb, b: pl }, { a: pr, b: pt });
    }
  }
  return segs;
}

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function near(a: Pt, b: Pt, eps2: number): boolean {
  return dist2(a, b) < eps2;
}

function find(parent: number[], i: number): number {
  if (parent[i] !== i) parent[i] = find(parent, parent[i]!);
  return parent[i]!;
}

function union(parent: number[], i: number, j: number): void {
  const ri = find(parent, i);
  const rj = find(parent, j);
  if (ri !== rj) parent[ri] = rj;
}

/**
 * Marching squares; **v1: largest connected segment group** only (no chord between components).
 */
export function sampleImplicitPlotInRange(
  def: ImplicitPlotDef,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  nx: number,
  ny: number,
): Polyline2D {
  let feval: (x: number, y: number) => number;
  try {
    feval = compileImplicitPlot(def.expression).compile();
  } catch {
    return fallback2D(xMin, xMax, yMin, yMax);
  }

  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin || yMax <= yMin) {
    return fallback2D(xMin, xMax, yMin, yMax);
  }

  const dx = (xMax - xMin) / Math.max(1, nx);
  const dy = (yMax - yMin) / Math.max(1, ny);
  const gridX = nx + 1;
  const gridY = ny + 1;
  const F = new Float64Array(gridX * gridY);
  for (let j = 0; j < gridY; j++) {
    for (let i = 0; i < gridX; i++) {
      const x = xMin + i * dx;
      const y = yMin + j * dy;
      let v: number;
      try {
        v = feval(x, y);
      } catch {
        v = Number.NaN;
      }
      F[i + j * gridX] = v;
    }
  }

  const segs: Seg[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const f00 = F[i + j * gridX]!;
      const f10 = F[i + 1 + j * gridX]!;
      const f11 = F[i + 1 + (j + 1) * gridX]!;
      const f01 = F[i + (j + 1) * gridX]!;
      const x0 = xMin + i * dx;
      const y0 = yMin + j * dy;
      const x1 = x0 + dx;
      const y1 = y0 + dy;
      for (const s of segListForCell(f00, f10, f11, f01, x0, y0, x1, y1)) {
        if (s.a && s.b) segs.push(s);
      }
    }
  }

  if (segs.length === 0) {
    return fallback2D(xMin, xMax, yMin, yMax);
  }

  const scale = Math.max(xMax - xMin, yMax - yMin, 1e-6);
  const eps2 = (scale * 1e-6) ** 2;
  const n = segs.length;
  const parent = Array.from({ length: n }, (_, k) => k);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = segs[i]!;
      const b = segs[j]!;
      if (
        near(a.a, b.a, eps2) ||
        near(a.a, b.b, eps2) ||
        near(a.b, b.a, eps2) ||
        near(a.b, b.b, eps2)
      ) {
        union(parent, i, j);
      }
    }
  }

  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(parent, i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r)!.push(i);
  }

  let best: number[] | null = null;
  let bestLen = -1;
  for (const inds of byRoot.values()) {
    let L = 0;
    for (const si of inds) {
      const s = segs[si]!;
      L += Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    }
    if (L > bestLen) {
      bestLen = L;
      best = inds;
    }
  }
  if (!best || best.length === 0) {
    return fallback2D(xMin, xMax, yMin, yMax);
  }

  const out = chainSegments(
    best.map((i) => segs[i]!),
    eps2,
  );
  if (out.length < 4) {
    return fallback2D(xMin, xMax, yMin, yMax);
  }
  const pts = new Float32Array(out);
  const o = buildCumLen(pts);
  return { points: pts, cumLen: o.cumLen, totalLen: o.totalLen };
}

function chainSegments(segs: Seg[], eps2: number): number[] {
  if (segs.length === 0) return [];
  const used = new Array(segs.length).fill(false);
  const pts: Pt[] = [];
  const first = segs[0]!;
  used[0] = true;
  let head = first.a;
  let tail = first.b;
  pts.push(head, tail);

  const growTail = (): boolean => {
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const s = segs[i]!;
      if (near(tail, s.a, eps2)) {
        tail = s.b;
        used[i] = true;
        pts.push(tail);
        return true;
      }
      if (near(tail, s.b, eps2)) {
        tail = s.a;
        used[i] = true;
        pts.push(tail);
        return true;
      }
    }
    return false;
  };
  const growHead = (): boolean => {
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const s = segs[i]!;
      if (near(head, s.a, eps2)) {
        head = s.b;
        used[i] = true;
        pts.unshift(head);
        return true;
      }
      if (near(head, s.b, eps2)) {
        head = s.a;
        used[i] = true;
        pts.unshift(head);
        return true;
      }
    }
    return false;
  };
  for (;;) {
    if (!growTail() && !growHead()) break;
  }

  if (pts.length >= 3) {
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) < Math.sqrt(eps2) * 12) {
      pts.push(pts[0]!);
    }
  }
  const out: number[] = [];
  for (const p of pts) {
    out.push(p.x, p.y);
  }
  return out;
}

function fallback2D(xMin: number, xMax: number, yMin: number, yMax: number): Polyline2D {
  const cx = (xMin + xMax) * 0.5;
  const cy = (yMin + yMax) * 0.5;
  const w = (xMax - xMin) * 0.02 + 1e-3;
  const buf = [cx - w, cy, cx + w, cy];
  const o = buildCumLen(new Float32Array(buf));
  return { points: new Float32Array(buf), cumLen: o.cumLen, totalLen: o.totalLen };
}
