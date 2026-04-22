import type { CubicBezier, Easing } from "../core/ir";
import { DEFAULT_EASING } from "../core/ir";

function bezierX(x1: number, x2: number, t: number): number {
  const omt = 1 - t;
  return 3 * omt * omt * t * x1 + 3 * omt * t * t * x2 + t * t * t;
}

function bezierY(y1: number, y2: number, t: number): number {
  const omt = 1 - t;
  return 3 * omt * omt * t * y1 + 3 * omt * t * t * y2 + t * t * t;
}

const EPS = 1e-5;

export function easeCubicBezier(x: number, b: CubicBezier = DEFAULT_EASING): number {
  const [x1, y1, x2, y2] = b;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let u = x;
  for (let i = 0; i < 24; i++) {
    u = (lo + hi) * 0.5;
    const bx = bezierX(x1, x2, u);
    if (Math.abs(bx - x) < EPS) break;
    if (bx < x) lo = u;
    else hi = u;
  }
  return bezierY(y1, y2, u);
}

export function applyEasing(linearT: number, easing: Easing | undefined): number {
  if (easing === undefined || easing === "linear") return linearT;
  return easeCubicBezier(linearT, easing as CubicBezier);
}
