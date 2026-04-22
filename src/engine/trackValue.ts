import type { PropertyTrack } from "../core/ir";
import { valueAtTime } from "./keyframes";

/** Resolves a numeric property at time `t` from merged timeline tracks, or `initial` if no track. */
export function getNum(
  tracks: Map<string, PropertyTrack>,
  target: string,
  t: number,
  initial: number,
): number {
  const tr = tracks.get(target);
  if (!tr) return initial;
  return valueAtTime(tr, t, initial);
}
