import { describe, expect, it } from "vitest";
import { mergeKeyframesByTime } from "./keyframes";
import { evaluateAtTime } from "./evaluateProject";
import { createDefaultProject, projectWithTimeline } from "../core/schema";
import type { PropertyTrack } from "../core/ir";

describe("mergeKeyframesByTime", () => {
  it("sorts by t and last wins for duplicate t", () => {
    const a = mergeKeyframesByTime([
      { t: 0, value: 1 },
      { t: 2, value: 5 },
      { t: 0, value: 2 },
    ]);
    expect(a).toEqual([
      { t: 0, value: 2 },
      { t: 2, value: 5 },
    ]);
  });
});

describe("collectTracks merge (via evaluateAtTime)", () => {
  it("applies two halfWidth segments in order", () => {
    const p0 = createDefaultProject();
    const tr: PropertyTrack[] = [
      {
        id: "a",
        target: "main-cam.halfWidth",
        keyframes: [
          { t: 0, value: 20, easing: "linear" },
          { t: 1, value: 10, easing: "linear" },
        ],
      },
      {
        id: "b",
        target: "main-cam.halfWidth",
        keyframes: [
          { t: 1, value: 10, easing: "linear" },
          { t: 2, value: 15, easing: "linear" },
        ],
      },
    ];
    const p1 = projectWithTimeline(p0, { ...p0.timeline, tracks: tr });
    const mid = evaluateAtTime(p1, 0.5, new Map());
    const end = evaluateAtTime(p1, 2, new Map());
    expect(mid.cameras["main-cam"]?.halfWidth).toBeCloseTo(15, 5);
    expect(end.cameras["main-cam"]?.halfWidth).toBe(15);
  });
});
