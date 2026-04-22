import type { ProjectFileV1 } from "../core/ir";
import { propertyTarget } from "../core/trackTarget";
import { collectTracks, keyframeTimesForTargets } from "./timelineUtils";
import { getNum } from "./trackValue";

/** Same as [`PREVIEW_ASPECT` in plotSampling] / WebGL: vertical half-extent in world = halfWidth / aspect. */
export const CAMERA_PREVIEW_ASPECT = 16 / 9;

export interface CameraEnvelope2D {
  minCenterX: number;
  maxCenterX: number;
  minCenterY: number;
  maxCenterY: number;
  maxHalfWidth: number;
  /** min over timeline of (centerX - halfWidth) — world x at left edge of view */
  minViewLeft: number;
  /** max over timeline of (centerX + halfWidth) — world x at right edge of view */
  maxViewRight: number;
  /**
   * min over timeline of (centerY - halfWidth / aspect) — bottom edge of 16:9 world view
   * (matches `halfH` in [`Plot2DWebGL`]: `halfWidth / (canvasW/canvasH)` with fixed aspect for sampling).
   */
  minViewBottom: number;
  /**
   * max over timeline of (centerY + halfWidth / aspect) — top edge
   */
  maxViewTop: number;
}

/**
 * Timeline-union envelope: min/max camera center and max halfWidth over all keyframe
 * times (plus 0 and `duration`) for a camera node. Used for arclength-stable plot x-extent.
 *
 * **Contract:** pass the same `duration` as `ProjectFileV1.timeline.duration` used in
 * `evaluateAtTime`. That value is included as a sample time; changing the composition
 * length can change the union and therefore `computeTimelineUnionSampling` x-bounds
 * and the function plot’s cached polyline / `plotHash`.
 */
export function computeCameraEnvelope(
  project: ProjectFileV1,
  cameraId: string,
  initial: { centerX: number; centerY: number; halfWidth: number },
  duration: number,
): CameraEnvelope2D {
  const tracks = collectTracks(project.timeline);
  const targets = [
    propertyTarget(cameraId, "centerX"),
    propertyTarget(cameraId, "centerY"),
    propertyTarget(cameraId, "halfWidth"),
  ];
  const times = keyframeTimesForTargets(tracks, targets);
  const sampleTimes = new Set<number>([0, duration, ...times]);
  let minCx = initial.centerX;
  let maxCx = initial.centerX;
  let minCy = initial.centerY;
  let maxCy = initial.centerY;
  let maxHw = initial.halfWidth;
  let minViewLeft = initial.centerX - initial.halfWidth;
  let maxViewRight = initial.centerX + initial.halfWidth;
  const invAspect = 1 / CAMERA_PREVIEW_ASPECT;
  let minViewBottom = initial.centerY - initial.halfWidth * invAspect;
  let maxViewTop = initial.centerY + initial.halfWidth * invAspect;
  for (const t of sampleTimes) {
    const cx = getNum(tracks, propertyTarget(cameraId, "centerX"), t, initial.centerX);
    const cy = getNum(tracks, propertyTarget(cameraId, "centerY"), t, initial.centerY);
    const hw = getNum(tracks, propertyTarget(cameraId, "halfWidth"), t, initial.halfWidth);
    const halfH = hw * invAspect;
    minCx = Math.min(minCx, cx);
    maxCx = Math.max(maxCx, cx);
    minCy = Math.min(minCy, cy);
    maxCy = Math.max(maxCy, cy);
    maxHw = Math.max(maxHw, hw);
    minViewLeft = Math.min(minViewLeft, cx - hw);
    maxViewRight = Math.max(maxViewRight, cx + hw);
    minViewBottom = Math.min(minViewBottom, cy - halfH);
    maxViewTop = Math.max(maxViewTop, cy + halfH);
  }
  return {
    minCenterX: minCx,
    maxCenterX: maxCx,
    minCenterY: minCy,
    maxCenterY: maxCy,
    maxHalfWidth: maxHw,
    minViewLeft,
    maxViewRight,
    minViewBottom,
    maxViewTop,
  };
}
