import { describe, expect, it } from "vitest";
import { plotDefinitionFromUserInput, splitTopLevelEqual } from "./equationClassifier";
import type { PlotDefinition } from "../ir";

const baseFn: PlotDefinition = {
  kind: "function",
  expression: "sin(x)",
  xMin: -4,
  xMax: 7,
  samples: 256,
};

describe("splitTopLevelEqual", () => {
  it("splits a single top-level = and ignores <=, >=, ==", () => {
    expect(splitTopLevelEqual("x^2 + y^2 = 25")).toEqual({ left: "x^2 + y^2", right: "25" });
    expect(splitTopLevelEqual("a <= b")).toBeNull();
    expect(splitTopLevelEqual("a >= b")).toBeNull();
    expect(splitTopLevelEqual("a == b")).toBeNull();
  });
});

describe("plotDefinitionFromUserInput", () => {
  it("prefers explicit y = f(x) over = split (y = x)", () => {
    const p = plotDefinitionFromUserInput("y = x", baseFn);
    expect(p.kind).toBe("function");
    if (p.kind === "function") expect(p.expression.trim()).toBe("x");
  });

  it("classifies x^2+y^2 = 25 as implicit", () => {
    const p = plotDefinitionFromUserInput("x^2 + y^2 = 25", baseFn);
    expect(p.kind).toBe("implicit");
    if (p.kind === "implicit") {
      expect(p.expression.replace(/\s/g, "")).toContain("x^2+y^2");
      expect(p.expression.replace(/\s/g, "")).toContain("-");
    }
  });

  it("classifies scalar as constant function", () => {
    const p = plotDefinitionFromUserInput("3*sin(2*pi)", baseFn);
    expect(p.kind).toBe("function");
    if (p.kind === "function") expect(Number(p.expression)).toBeCloseTo(0, 10);
  });

  it("treats sin(t) as explicit function, not scalar", () => {
    const p = plotDefinitionFromUserInput("sin(t)", baseFn);
    expect(p.kind).toBe("function");
    if (p.kind === "function") {
      const c = p.expression.replace(/\s/g, "");
      expect(c === "sin(t)" || c === "sin(x)").toBe(true);
    }
  });

  it("y = with free y on rhs falls through to implicit (left)−(right)", () => {
    const p = plotDefinitionFromUserInput("y = x^2 + y^2", baseFn);
    expect(p.kind).toBe("implicit");
  });
});
