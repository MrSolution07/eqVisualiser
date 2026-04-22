import type { ProjectFileV1 } from "../core/ir";
import { analyzePeriodicity } from "../core/math/analyzePeriodicity";
import { sampleFunctionPlotInRange } from "../core/math/samplePlot";
import { computeCameraEnvelope } from "../engine/cameraEnvelope";
import { computeTimelineUnionSampling } from "../engine/plotSampling";

/** Match typical canvas aspect for framed halfWidth (world units per half screen width; view height 2*halfW/aspect). */
const PREVIEW_ASPECT = 16 / 9;
const PADDING = 1.1;

/**
 * Bbox the sampled polyline and compute a camera that fits the curve with padding
 * (same x-extent policy as the runtime plot sampler: union envelope + timeline duration).
 */
export function computeHeroOutroFraming(
  project: ProjectFileV1,
  compositionDuration: number,
): { centerX: number; centerY: number; halfWidth: number } | null {
  const cam = project.scene.find((s) => s.type === "camera2d");
  const plotN = project.scene.find((s) => s.type === "plot2d" && s.plot.kind === "function");
  if (!cam || cam.type !== "camera2d" || !plotN || plotN.type !== "plot2d" || plotN.plot.kind !== "function") {
    return null;
  }
  const p: ProjectFileV1 = { ...project, timeline: { ...project.timeline, duration: compositionDuration } };
  const env = computeCameraEnvelope(p, cam.id, cam.initial, compositionDuration);
  const periodic = analyzePeriodicity(plotN.plot.expression);
  const b = computeTimelineUnionSampling(plotN.plot, env, periodic);
  const poly = sampleFunctionPlotInRange(plotN.plot, b.xMin, b.xMax, b.samples);
  const pts = poly.points;
  if (pts.length < 2) return null;
  let minX = pts[0]!;
  let minY = pts[1]!;
  let maxX = minX;
  let maxY = minY;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i]!;
    const y = pts[i + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = (maxX - minX) * PADDING;
  const h = (maxY - minY) * PADDING;
  const needHalf = Math.max(w / 2, (h * PREVIEW_ASPECT) / 2);
  return { centerX: cx, centerY: cy, halfWidth: needHalf };
}
