import type { ProjectFileV1 } from "../core/ir";
import type { PropertyTrack } from "../core/ir";
import { valueAtTime } from "./keyframes";
import { collectTracks, keyframeTimesForTargets } from "./timelineUtils";

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
}

function getNum(tracks: Map<string, PropertyTrack>, target: string, t: number, initial: number): number {
  const tr = tracks.get(target);
  if (!tr) return initial;
  return valueAtTime(tr, t, initial);
}

/**
 * Timeline-union envelope: min/max camera center and max halfWidth over all keyframe
 * times (plus 0 and duration) for a camera node. Used for arclength-stable plot x-extent.
 */
export function computeCameraEnvelope(
  project: ProjectFileV1,
  cameraId: string,
  initial: { centerX: number; centerY: number; halfWidth: number },
  duration: number,
): CameraEnvelope2D {
  const tracks = collectTracks(project.timeline);
  const targets = [`${cameraId}.centerX`, `${cameraId}.centerY`, `${cameraId}.halfWidth`];
  const times = keyframeTimesForTargets(tracks, targets);
  const sampleTimes = new Set<number>([0, duration, ...times]);
  let minCx = initial.centerX;
  let maxCx = initial.centerX;
  let minCy = initial.centerY;
  let maxCy = initial.centerY;
  let maxHw = initial.halfWidth;
  let minViewLeft = initial.centerX - initial.halfWidth;
  let maxViewRight = initial.centerX + initial.halfWidth;
  for (const t of sampleTimes) {
    const cx = getNum(tracks, `${cameraId}.centerX`, t, initial.centerX);
    const cy = getNum(tracks, `${cameraId}.centerY`, t, initial.centerY);
    const hw = getNum(tracks, `${cameraId}.halfWidth`, t, initial.halfWidth);
    minCx = Math.min(minCx, cx);
    maxCx = Math.max(maxCx, cx);
    minCy = Math.min(minCy, cy);
    maxCy = Math.max(maxCy, cy);
    maxHw = Math.max(maxHw, hw);
    minViewLeft = Math.min(minViewLeft, cx - hw);
    maxViewRight = Math.max(maxViewRight, cx + hw);
  }
  return {
    minCenterX: minCx,
    maxCenterX: maxCx,
    minCenterY: minCy,
    maxCenterY: maxCy,
    maxHalfWidth: maxHw,
    minViewLeft,
    maxViewRight,
  };
}
