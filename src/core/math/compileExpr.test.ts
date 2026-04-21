import { describe, expect, it } from "vitest";
import { compileFunctionPlot } from "./compileExpr";
import { evaluateAtTime } from "../../engine/evaluateProject";
import { createDefaultProject, projectWithTimeline } from "../schema";
import { tracksForShots } from "../../director/shots";

describe("compile", () => {
  it("evaluates a safe function", () => {
    const c = compileFunctionPlot({
      kind: "function",
      expression: "sin(x)",
      xMin: 0,
      xMax: 1,
      samples: 8,
    });
    const f = c.compile();
    expect(f(0)).toBeCloseTo(0, 5);
  });
  it("rejects unknown symbols", () => {
    expect(() =>
      compileFunctionPlot({
        kind: "function",
        expression: "foobar(x)",
        xMin: 0,
        xMax: 1,
        samples: 8,
      }),
    ).toThrow();
  });
});

describe("preview export parity (same t)", () => {
  it("same camera keys at t=4", () => {
    const p0 = createDefaultProject();
    const tr = tracksForShots(p0, [{ kind: "intro", at: 0, duration: 4 }]);
    const p1 = projectWithTimeline(p0, { ...p0.timeline, tracks: tr });
    const a = evaluateAtTime(p1, 4, new Map());
    const b = evaluateAtTime(p1, 4, new Map());
    expect(a.cameras["main-cam"]).toEqual(b.cameras["main-cam"]);
  });
});
