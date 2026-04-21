import type { PropertyTrack, TimelineV1 } from "../core/ir";
import { mergeKeyframesByTime } from "./keyframes";

/** Merge timeline tracks by target (same as evaluateProject). */
export function collectTracks(timeline: TimelineV1): Map<string, PropertyTrack> {
  const groups = new Map<string, PropertyTrack[]>();
  for (const tr of timeline.tracks) {
    const list = groups.get(tr.target) ?? [];
    list.push(tr);
    groups.set(tr.target, list);
  }
  const m = new Map<string, PropertyTrack>();
  for (const [target, list] of groups) {
    const keyframes = mergeKeyframesByTime(list.flatMap((tr) => tr.keyframes));
    m.set(target, { id: `merged:${target}`, target, keyframes });
  }
  return m;
}

export function keyframeTimesForTargets(tracks: Map<string, PropertyTrack>, targets: string[]): number[] {
  const s = new Set<number>();
  for (const target of targets) {
    const tr = tracks.get(target);
    if (!tr) continue;
    for (const k of tr.keyframes) {
      s.add(k.t);
    }
  }
  return [...s].sort((a, b) => a - b);
}
