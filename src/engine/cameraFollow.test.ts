import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../core/schema";
import { evaluateAtTime } from "./evaluateProject";
import { exponentialSmoothWeights, followDrawEndFalloff } from "./cameraFollow";
import type { ProjectFileV1 } from "../core/ir";

describe("followDrawEndFalloff", () => {
  it("is 1 when falloff is disabled (start >= 1)", () => {
    expect(followDrawEndFalloff(0, 1)).toBe(1);
    expect(followDrawEndFalloff(0.99, 1)).toBe(1);
  });
  it("ramps to 0 toward draw=1 when start < 1", () => {
    expect(followDrawEndFalloff(0, 0.9)).toBe(1);
    expect(followDrawEndFalloff(1, 0.9)).toBe(0);
    const mid = followDrawEndFalloff(0.95, 0.9);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("exponentialSmoothWeights", () => {
  it("sums to 1 and favors the last sample", () => {
    const w = exponentialSmoothWeights(8);
    expect(w.length).toBe(8);
    const sum = w.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(w[w.length - 1]! > w[0]!).toBe(true);
  });
  it("returns [1] for a single sample", () => {
    expect(exponentialSmoothWeights(1)).toEqual([1]);
  });
});

function projectNoFollowSmoothing(p: ProjectFileV1): ProjectFileV1 {
  const scene = p.scene.map((n) => {
    if (n.type === "camera2d") {
      return {
        ...n,
        initial: {
          ...n.initial,
          followSmoothSeconds: 0,
          followDrawFalloffStart: 1,
          followVelocityLeadGain: 0,
        },
      };
    }
    return n;
  });
  return { ...p, scene };
}

describe("resolveCameraWithFollow integration", () => {
  it("produces finite camera for default project", () => {
    const p = createDefaultProject();
    const st = evaluateAtTime(p, 3);
    const cam = st.cameras["main-cam"];
    expect(cam).toBeDefined();
    expect(Number.isFinite(cam!.centerX)).toBe(true);
    expect(Number.isFinite(cam!.centerY)).toBe(true);
  });

  it("differs from unsmoothed follow when default smoothing and falloff are on", () => {
    const unsm = projectNoFollowSmoothing(createDefaultProject());
    const full = createDefaultProject();
    const t = 2.2;
    const c0 = evaluateAtTime(unsm, t).cameras["main-cam"]!;
    const c1 = evaluateAtTime(full, t).cameras["main-cam"]!;
    const d = Math.hypot(c0.centerX - c1.centerX, c0.centerY - c1.centerY);
    expect(d).toBeGreaterThan(1e-4);
  });
});
