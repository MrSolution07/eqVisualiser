import { describe, expect, it } from "vitest";
import type { Polyline2D } from "../core/math/samplePlot";
import { tipAtDraw, trimPolyline } from "./trimPolyline";

function segPoly(): Polyline2D {
  const points = new Float32Array([0, 0, 1, 0, 1, 1]);
  const cumLen = new Float32Array([0, 1, 2]);
  return { points, cumLen, totalLen: 2 };
}

describe("tipAtDraw", () => {
  const poly = segPoly();
  it("returns start when draw is 0", () => {
    expect(tipAtDraw(poly, 0)).toEqual({ x: 0, y: 0 });
  });
  it("returns end when draw is 1", () => {
    expect(tipAtDraw(poly, 1)).toEqual({ x: 1, y: 1 });
  });
  it("interpolates mid-segment", () => {
    const p = tipAtDraw(poly, 0.25);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBe(0);
  });
});

describe("trimPolyline vs tipAtDraw", () => {
  it("tip matches last point of trim (draw > 0)", () => {
    const poly = segPoly();
    for (const d of [0.1, 0.33, 0.77, 1]) {
      const trimmed = trimPolyline(poly, d);
      const tip = tipAtDraw(poly, d);
      const n = trimmed.length;
      expect(trimmed[n - 2]).toBeCloseTo(tip.x);
      expect(trimmed[n - 1]).toBeCloseTo(tip.y);
    }
  });
  it("draw 0 still yields a drawable segment (visible curve head)", () => {
    const poly = segPoly();
    const trimmed = trimPolyline(poly, 0);
    expect(trimmed.length).toBe(4);
  });
});
