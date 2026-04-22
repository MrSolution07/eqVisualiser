import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../core/schema";
import type { CameraEnvelope2D } from "./cameraEnvelope";
import { computeCameraEnvelope } from "./cameraEnvelope";
import { computeTimelineUnionSampling, functionPlotSamplingKey } from "./plotSampling";
import { analyzePeriodicity } from "../core/math/analyzePeriodicity";
import { evaluateAtTime } from "./evaluateProject";

describe("computeCameraEnvelope", () => {
  it("produces ordered finite view bounds; pass project.timeline.duration to match evaluateAtTime", () => {
    const p = createDefaultProject();
    const cam = p.scene.find((s) => s.type === "camera2d");
    expect(cam?.type).toBe("camera2d");
    if (cam?.type !== "camera2d") return;
    const env = computeCameraEnvelope(p, cam.id, cam.initial, p.timeline.duration);
    expect(env.maxViewRight).toBeGreaterThan(env.minViewLeft);
    expect(env.maxHalfWidth).toBeGreaterThan(0);
  });

  it("feeds x-sampling: different envelope unions yield different functionPlotSamplingKey", () => {
    const def = { kind: "function" as const, expression: "x", xMin: 0, xMax: 1, samples: 16 };
    const per = analyzePeriodicity(def.expression);
    const smallEnv: CameraEnvelope2D = {
      minCenterX: 0,
      maxCenterX: 0,
      minCenterY: 0,
      maxCenterY: 0,
      maxHalfWidth: 1,
      minViewLeft: -1,
      maxViewRight: 1,
      minViewBottom: -1 / (16 / 9),
      maxViewTop: 1 / (16 / 9),
    };
    const bigEnv: CameraEnvelope2D = {
      minCenterX: 0,
      maxCenterX: 0,
      minCenterY: 0,
      maxCenterY: 0,
      maxHalfWidth: 20,
      minViewLeft: -20,
      maxViewRight: 20,
      minViewBottom: -20 / (16 / 9),
      maxViewTop: 20 / (16 / 9),
    };
    const a = functionPlotSamplingKey(def, computeTimelineUnionSampling(def, smallEnv, per));
    const b = functionPlotSamplingKey(def, computeTimelineUnionSampling(def, bigEnv, per));
    expect(a).not.toBe(b);
  });

  it("evaluateAtTime with altered timeline.duration still returns a resolvable plot (duration must match across envelope + time clamp)", () => {
    const p0 = createDefaultProject();
    const p1 = { ...p0, timeline: { ...p0.timeline, duration: 0.2 } };
    const a = evaluateAtTime(p0, 0, new Map());
    const b = evaluateAtTime(p1, 0, new Map());
    expect(a.plots["main-plot"]?.plotHash).toBeDefined();
    expect(b.plots["main-plot"]?.plotHash).toBeDefined();
  });
});
