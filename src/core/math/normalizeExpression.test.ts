import { describe, expect, it } from "vitest";
import { normalizeFunctionPlotExpression } from "./normalizeExpression";

describe("normalizeFunctionPlotExpression", () => {
  it("strips y= and converts \\cos to cos", () => {
    const raw = String.raw`y = 13 \cos(t) - 5 \cos(2t)`;
    expect(normalizeFunctionPlotExpression(raw)).toBe("13 cos(t) - 5 cos(2t)");
  });
  it("maps \\cdot and unicode ×", () => {
    expect(normalizeFunctionPlotExpression("a \\cdot b")).toBe("a * b");
    expect(normalizeFunctionPlotExpression("a × b")).toBe("a * b");
  });
});
