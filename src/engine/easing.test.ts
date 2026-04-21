import { describe, expect, it } from "vitest";
import { applyEasing, easeCubicBezier } from "./easing";

describe("easing", () => {
  it("maps 0 and 1", () => {
    const b: [number, number, number, number] = [0.4, 0, 0.2, 1];
    expect(easeCubicBezier(0, b)).toBe(0);
    expect(easeCubicBezier(1, b)).toBe(1);
  });
  it("applyEasing linear", () => {
    expect(applyEasing(0.5, "linear")).toBe(0.5);
  });
  it("applies bezier y range", () => {
    const y = applyEasing(0.5, [0.4, 0, 0.2, 1]);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(1);
  });
});
