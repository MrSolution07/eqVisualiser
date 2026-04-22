import { evaluateAtTime } from "../engine/evaluateProject";
import type { ProjectFileV1 } from "../core/ir";
import type { Polyline2D } from "../core/math/samplePlot";

/** Compare preview vs. export: same t must yield the same camera numbers (and plot draw). */
export function snapshotKey(
  project: ProjectFileV1,
  t: number,
  cache: Map<string, { hash: string; poly: Polyline2D }>,
): string {
  const s = evaluateAtTime(project, t, cache);
  const c = s.cameras["main-cam"];
  const p = s.plots["main-plot"];
  return JSON.stringify({
    cx: c?.centerX,
    cy: c?.centerY,
    hw: c?.halfWidth,
    d: p?.draw,
  });
}
