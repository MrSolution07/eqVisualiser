import { describe, expect, it } from "vitest";
import { evaluateAtTime } from "./evaluateProject";
import { createDefaultProject } from "../core/schema";
import type { ProjectFileV1 } from "../core/ir";

function projectWithImplicitCircle(): ProjectFileV1 {
  const p = createDefaultProject();
  return {
    ...p,
    scene: p.scene.map((n) => {
      if (n.type !== "plot2d") return n;
      return {
        ...n,
        plot: {
          kind: "implicit" as const,
          expression: "(x^2 + y^2) - (25)",
          xMin: -8,
          xMax: 8,
          yMin: -8,
          yMax: 8,
          samples: 64,
        },
      };
    }),
  };
}

describe("evaluateAtTime implicit plot", () => {
  it("returns stable plotHash for cache when t changes", () => {
    const p = projectWithImplicitCircle();
    const cache = new Map<string, { hash: string; poly: import("../core/math/samplePlot").Polyline2D }>();
    const a = evaluateAtTime(p, 0, cache);
    const h0 = a.plots["main-plot"]?.plotHash;
    const b = evaluateAtTime(p, 3, cache);
    const h1 = b.plots["main-plot"]?.plotHash;
    expect(h0).toBeDefined();
    expect(h0).toBe(h1);
  });
});
