import type { ProjectFileV1 } from "../core/ir";
import { collectTracks } from "./timelineUtils";
import type { Polyline2D } from "../core/math/samplePlot";
import type { RenderStateV1 } from "./renderState";
import {
  applyCameraFollow,
  buildRenderStateV1,
  resolveBaseCamerasAndEnvelopes,
  resolvePlotsAndEquations,
} from "./evaluateProject.resolve";
import { analyzePeriodicity } from "../core/math/analyzePeriodicity";

export type {
  RenderStateV1,
  ResolvedCamera2D,
  ResolvedPlot2D,
  ResolvedEquation,
} from "./renderState";
export { getNum } from "./trackValue";

/**
 * Pure: full render state for time t (clamped to [0, duration]).
 * When `plotCache` is provided, reuses polylines when the plot sampling key is unchanged.
 *
 * **Pipeline:** base cameras + envelopes → plots + text equations → follow offsets on cameras.
 * Sampling uses **timeline-union** x-extent for function plots so `draw` (arclength) stays stable.
 */
export function evaluateAtTime(
  project: ProjectFileV1,
  tIn: number,
  plotCache?: Map<string, { hash: string; poly: Polyline2D }>,
): RenderStateV1 {
  const duration = project.timeline.duration;
  const t = Math.max(0, Math.min(tIn, duration));
  const tracks = collectTracks(project.timeline);
  const periodicByExpr = new Map<string, ReturnType<typeof analyzePeriodicity>>();

  const { camerasBase, envelopes } = resolveBaseCamerasAndEnvelopes(project, tracks, t, duration);
  const { plots, equations } = resolvePlotsAndEquations(
    project,
    tracks,
    t,
    envelopes,
    plotCache,
    periodicByExpr,
  );
  const cameras = applyCameraFollow(project, tracks, t, camerasBase, plots);
  return buildRenderStateV1(t, duration, project.style, cameras, plots, equations);
}

export function evaluateAtTimeWithCache(
  project: ProjectFileV1,
  tIn: number,
  cache: Map<string, { hash: string; poly: Polyline2D }>,
): RenderStateV1 {
  return evaluateAtTime(project, tIn, cache);
}
