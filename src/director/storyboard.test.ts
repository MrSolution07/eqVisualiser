import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../core/schema";
import { valueAtTime } from "../engine/keyframes";
import { collectTracks } from "../engine/timelineUtils";
import { computeCameraEnvelope } from "../engine/cameraEnvelope";
import { STORY_DURATION, DEFAULT_STORY_DRAW_END_T } from "./shots";

describe("defaultStoryboard", () => {
  it("uses linear draw with progress ~ t/T at early frames (not ease-in stalled)", () => {
    const p = createDefaultProject();
    expect(p.timeline.duration).toBe(STORY_DURATION);
    const merged = collectTracks(p.timeline);
    const tr = merged.get("main-plot.draw");
    expect(tr).toBeDefined();
    const fps = p.timeline.fps;
    const tFrame = 1 / fps;
    const d0 = valueAtTime(tr!, 0, 0);
    const d1 = valueAtTime(tr!, tFrame, 0);
    expect(d0).toBe(0);
    expect(d1).toBeCloseTo(tFrame / DEFAULT_STORY_DRAW_END_T, 5);
    expect(d1).toBeGreaterThan(0);
  });

  it("yields finite camera envelope for the baked duration (sampling bounds stable)", () => {
    const p = createDefaultProject();
    const cam = p.scene.find((s) => s.type === "camera2d");
    expect(cam?.type).toBe("camera2d");
    if (cam?.type !== "camera2d") return;
    const env = computeCameraEnvelope(p, cam.id, cam.initial, STORY_DURATION);
    expect(Number.isFinite(env.maxHalfWidth)).toBe(true);
    expect(env.maxViewRight).toBeGreaterThan(env.minViewLeft);
  });

  it("has outro starting before draw completes (overlap)", () => {
    const p = createDefaultProject();
    const merged = collectTracks(p.timeline);
    const tr = merged.get("main-cam.halfWidth");
    expect(tr).toBeDefined();
    const outroStart = 12;
    const hwAt = (t: number) => valueAtTime(tr!, t, 8);
    const dAt = (t: number) => {
      const dtr = merged.get("main-plot.draw");
      return valueAtTime(dtr!, t, 0);
    };
    expect(dAt(outroStart)).toBeLessThan(1);
    expect(hwAt(outroStart)).toBe(8);
    const hwLate = hwAt(18);
    expect(hwLate).toBeGreaterThan(8);
  });
});
