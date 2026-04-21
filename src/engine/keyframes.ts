import type { Easing, TimeKeyframe, PropertyTrack } from "../core/ir";
import { applyEasing } from "./easing";

function sortByT(kfs: TimeKeyframe<number>[]): TimeKeyframe<number>[] {
  return [...kfs].sort((a, b) => a.t - b.t);
}

/**
 * Keyframes from multiple `PropertyTrack`s with the same `target`, combined and deduped by `t`
 * (last wins at identical times).
 */
export function mergeKeyframesByTime(frames: TimeKeyframe<number>[]): TimeKeyframe<number>[] {
  if (frames.length === 0) return [];
  const sorted = sortByT(frames);
  const atT = new Map<number, TimeKeyframe<number>>();
  for (const kf of sorted) {
    atT.set(kf.t, kf);
  }
  return [...atT.keys()]
    .sort((a, b) => a - b)
    .map((t) => atT.get(t)!);
}

/**
 * Interpolate a numeric property at time t from a track. Easing is taken from the
 * *leading* keyframe of the active segment.
 */
export function valueAtTime(track: PropertyTrack, t: number, initial: number): number {
  const kf = sortByT(track.keyframes);
  if (kf.length === 0) return initial;
  if (t <= kf[0]!.t) return kf[0]!.value;
  if (t >= kf[kf.length - 1]!.t) return kf[kf.length - 1]!.value;
  let i = 0;
  for (; i < kf.length - 1; i++) {
    if (t >= kf[i]!.t && t < kf[i + 1]!.t) break;
  }
  if (i >= kf.length - 1) {
    return kf[kf.length - 1]!.value;
  }
  const a = kf[i]!;
  const b = kf[i + 1]!;
  const span = b.t - a.t;
  if (span <= 0) return b.value;
  const raw = (t - a.t) / span;
  const e = a.easing as Easing | undefined;
  const w = applyEasing(raw, e);
  return a.value + (b.value - a.value) * w;
}
