import { describe, expect, it } from "vitest";
import { sampleImplicitPlotInRange } from "./implicitPlot";

describe("sampleImplicitPlotInRange", () => {
  it("approximates a circle x^2+y^2=25 (radius 5) within grid slack", () => {
    const poly = sampleImplicitPlotInRange(
      {
        kind: "implicit",
        expression: "(x^2 + y^2) - (25)",
        xMin: -10,
        xMax: 10,
        yMin: -10,
        yMax: 10,
        samples: 128,
      },
      -10,
      10,
      -10,
      10,
      80,
      80,
    );
    const p = poly.points;
    expect(p.length).toBeGreaterThan(8);
    let maxR = 0;
    for (let i = 0; i < p.length; i += 2) {
      const r = Math.hypot(p[i]!, p[i + 1]!);
      if (r > maxR) maxR = r;
    }
    expect(maxR).toBeGreaterThan(4.2);
    expect(maxR).toBeLessThan(5.5);
  });
});
