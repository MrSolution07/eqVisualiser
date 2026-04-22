import { describe, expect, it } from "vitest";
import { buildCumLen } from "./buildCumLen";

describe("buildCumLen", () => {
  it("accumulates length along a polyline", () => {
    const pts = new Float32Array([0, 0, 3, 4, 3, 4, 3, 8]);
    const { cumLen, totalLen } = buildCumLen(pts);
    expect(cumLen[0]).toBe(0);
    expect(cumLen[1]).toBe(5);
    expect(cumLen[2]).toBe(5);
    expect(cumLen[3]).toBe(9);
    expect(totalLen).toBe(9);
  });
});
