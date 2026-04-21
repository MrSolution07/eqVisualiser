import { describe, expect, it } from "vitest";
import { compileFunctionPlot } from "./compileExpr";
import { evaluateAtTime } from "../../engine/evaluateProject";
import { createDefaultProject } from "../schema";

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
  it("accepts LaTeX \\cos, y= prefix, and t as alias for x", () => {
    const expression = String.raw`y = 13 \cos(t) - 5 \cos(2t) - 2 \cos(3t) - \cos(4t)`;
    const c = compileFunctionPlot({
      kind: "function",
      expression,
      xMin: 0,
      xMax: 1,
      samples: 8,
    });
    const f = c.compile();
    expect(f(0)).toBeCloseTo(13 - 5 - 2 - 1, 5);
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
  it("is deterministic for the same project and t", () => {
    const p0 = createDefaultProject();
    const a = evaluateAtTime(p0, 4, new Map());
    const b = evaluateAtTime(p0, 4, new Map());
    expect(a).toEqual(b);
  });
});
