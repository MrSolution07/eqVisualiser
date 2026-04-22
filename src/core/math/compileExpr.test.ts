import { describe, expect, it } from "vitest";
import { compileFunctionPlot, getFunctionPlotCompileError } from "./compileExpr";
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

  it("getFunctionPlotCompileError reports parse / symbol issues; null when valid", () => {
    const base = { kind: "function" as const, xMin: -1, xMax: 1, samples: 16 };
    expect(getFunctionPlotCompileError({ ...base, expression: "sin(x)" })).toBeNull();
    expect(getFunctionPlotCompileError({ ...base, expression: "x^2 + y^2 = 25" })?.length).toBeGreaterThan(0);
    expect(getFunctionPlotCompileError({ ...base, expression: "x^2 + y^2 - 25" })).toMatch(/Unknown symbol: y/);
  });

  it("sqrt for negative radicand yields NaN (not complex .re) so out-of-domain samples drop", () => {
    const c = compileFunctionPlot({
      kind: "function",
      expression: "sqrt(25 - x^2)",
      xMin: -5,
      xMax: 5,
      samples: 8,
    });
    const f = c.compile();
    expect(f(0)).toBe(5);
    expect(f(3)).toBe(4);
    expect(Number.isNaN(f(6))).toBe(true);
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
