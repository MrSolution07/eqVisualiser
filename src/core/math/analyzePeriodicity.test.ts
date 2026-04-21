import { describe, expect, it } from "vitest";
import { analyzePeriodicity, parseAffineInX } from "./analyzePeriodicity";
import { math } from "./compileExpr";

describe("parseAffineInX", () => {
  it("parses linear expressions", () => {
    expect(parseAffineInX(math.parse("2*x+3"))).toEqual({ a: 2, b: 3 });
    expect(parseAffineInX(math.parse("x"))).toEqual({ a: 1, b: 0 });
  });
  it("rejects quadratics", () => {
    expect(parseAffineInX(math.parse("x^2"))).toBeNull();
  });
});

describe("analyzePeriodicity", () => {
  it("detects cos sums in t after LaTeX normalize", () => {
    const raw = String.raw`13 \cos(t) - 5 \cos(2t) - 2 \cos(3t) - \cos(4t)`;
    const a = analyzePeriodicity(raw);
    expect(a.kind).toBe("periodic");
    if (a.kind === "periodic") expect(a.period).toBeCloseTo(2 * Math.PI, 5);
  });
  it("detects sin(ax+b)", () => {
    const a = analyzePeriodicity("sin(2*x+1)");
    expect(a.kind).toBe("periodic");
    if (a.kind === "periodic") expect(a.period).toBeCloseTo(Math.PI, 5);
  });
  it("detects commensurate sum", () => {
    const a = analyzePeriodicity("sin(x)+cos(x)");
    expect(a.kind).toBe("periodic");
    if (a.kind === "periodic") expect(a.period).toBeCloseTo(2 * Math.PI, 5);
  });
  it("returns none for polynomials", () => {
    expect(analyzePeriodicity("x^2+1").kind).toBe("none");
  });
  it("returns unknown for sin(x^2)", () => {
    expect(analyzePeriodicity("sin(x^2)").kind).toBe("unknown");
  });
  it("returns unknown for incommensurate trig sum", () => {
    expect(analyzePeriodicity("sin(x)+sin(sqrt(2)*x)").kind).toBe("unknown");
  });
});
