import type { ProjectFileV1, SceneNode } from "../core/ir";
import type { PropertyTrack } from "../core/ir";
import { valueAtTime } from "./keyframes";
import { samplePlot, sampleFunctionPlotInRange } from "../core/math/samplePlot";
import type { Polyline2D } from "../core/math/samplePlot";
import { analyzePeriodicity } from "../core/math/analyzePeriodicity";
import { collectTracks } from "./timelineUtils";
import { computeCameraEnvelope } from "./cameraEnvelope";
import { computeTimelineUnionSampling, functionPlotSamplingKey } from "./plotSampling";
import { resolveCameraWithFollow } from "./cameraFollow";
import type { RenderStateV1, ResolvedCamera2D, ResolvedPlot2D, ResolvedEquation } from "./renderState";

export type { RenderStateV1, ResolvedCamera2D, ResolvedPlot2D, ResolvedEquation } from "./renderState";

function getNum(
  tracks: Map<string, PropertyTrack>,
  target: string,
  t: number,
  initial: number,
): number {
  const tr = tracks.get(target);
  if (!tr) return initial;
  return valueAtTime(tr, t, initial);
}

function getCamera(node: Extract<SceneNode, { type: "camera2d" }>, tracks: Map<string, PropertyTrack>, t: number): ResolvedCamera2D {
  const p = node.initial;
  return {
    id: node.id,
    centerX: getNum(tracks, `${node.id}.centerX`, t, p.centerX),
    centerY: getNum(tracks, `${node.id}.centerY`, t, p.centerY),
    halfWidth: getNum(tracks, `${node.id}.halfWidth`, t, p.halfWidth),
  };
}

function plotKey(plot: { kind: string } & Record<string, unknown>): string {
  return JSON.stringify(plot);
}

/**
 * Pure: full render state for time t (clamped to [0, duration]).
 * When `plotCache` is provided, reuses polylines when the plot sampling key is unchanged.
 *
 * Sampling uses **timeline-union** x-extent for function plots so `draw` (arclength) stays stable.
 */
export function evaluateAtTime(project: ProjectFileV1, tIn: number, plotCache?: Map<string, { hash: string; poly: Polyline2D }>): RenderStateV1 {
  const duration = project.timeline.duration;
  const t = Math.max(0, Math.min(tIn, duration));
  const tracks = collectTracks(project.timeline);
  const periodicByExpr = new Map<string, ReturnType<typeof analyzePeriodicity>>();
  const periodicCached = (expression: string) => {
    let p = periodicByExpr.get(expression);
    if (!p) {
      p = analyzePeriodicity(expression);
      periodicByExpr.set(expression, p);
    }
    return p;
  };

  const camerasBase: Record<string, ResolvedCamera2D> = {};
  const envelopes: Record<string, ReturnType<typeof computeCameraEnvelope>> = {};

  for (const node of project.scene) {
    if (node.type === "camera2d") {
      camerasBase[node.id] = getCamera(node, tracks, t);
      envelopes[node.id] = computeCameraEnvelope(project, node.id, node.initial, duration);
    }
  }

  const plots: Record<string, ResolvedPlot2D> = {};
  const equations: Record<string, ResolvedEquation> = {};

  for (const node of project.scene) {
    if (node.type === "plot2d") {
      const draw0 = node.initialDraw;
      const draw = getNum(tracks, `${node.id}.draw`, t, draw0);
      const lw = getNum(tracks, `${node.id}.lineWidth`, t, node.lineWidth);

      let poly: Polyline2D;
      let ph: string;

      if (node.plot.kind === "function") {
        let env = envelopes[node.cameraId];
        if (!env) {
          const firstCam = project.scene.find((s) => s.type === "camera2d");
          if (firstCam) env = envelopes[firstCam.id];
        }
        if (!env) {
          const mid = (node.plot.xMin + node.plot.xMax) / 2;
          env = {
            minCenterX: mid,
            maxCenterX: mid,
            minCenterY: 0,
            maxCenterY: 0,
            maxHalfWidth: 8,
            minViewLeft: mid - 8,
            maxViewRight: mid + 8,
          };
        }
        const periodic = periodicCached(node.plot.expression);
        const bounds = computeTimelineUnionSampling(node.plot, env, periodic);
        ph = functionPlotSamplingKey(node.plot, bounds);
        const cached = plotCache?.get(node.id);
        poly = cached && cached.hash === ph ? cached.poly : sampleFunctionPlotInRange(node.plot, bounds.xMin, bounds.xMax, bounds.samples);
        if (plotCache) plotCache.set(node.id, { hash: ph, poly });
      } else {
        ph = plotKey(node.plot as unknown as { kind: string } & Record<string, unknown>);
        const cached = plotCache?.get(node.id);
        poly = cached && cached.hash === ph ? cached.poly : samplePlot(node.plot);
        if (plotCache) plotCache.set(node.id, { hash: ph, poly });
      }

      plots[node.id] = {
        id: node.id,
        cameraId: node.cameraId,
        draw: Math.max(0, Math.min(1, draw)),
        lineWidth: Math.max(0.5, lw),
        polyline: poly,
        plotHash: ph,
      };
    } else if (node.type === "equation") {
      const op0 = node.initialOpacity;
      const opacity = getNum(tracks, `${node.id}.opacity`, t, op0);
      const x = getNum(tracks, `${node.id}.x`, t, node.position.x);
      const y = getNum(tracks, `${node.id}.y`, t, node.position.y);
      const fontSize = getNum(tracks, `${node.id}.fontSize`, t, node.fontSize);
      equations[node.id] = {
        id: node.id,
        opacity: Math.max(0, Math.min(1, opacity)),
        position: { x, y },
        fontSize,
        latex: node.latex,
      };
    }
  }

  const cameras: Record<string, ResolvedCamera2D> = { ...camerasBase };
  for (const node of project.scene) {
    if (node.type === "camera2d") {
      const base = camerasBase[node.id];
      if (base) {
        cameras[node.id] = resolveCameraWithFollow(node, base, plots);
      }
    }
  }

  return {
    t,
    duration,
    style: project.style,
    cameras,
    plots,
    equations,
  };
}

export function evaluateAtTimeWithCache(
  project: ProjectFileV1,
  tIn: number,
  cache: Map<string, { hash: string; poly: Polyline2D }>,
): RenderStateV1 {
  return evaluateAtTime(project, tIn, cache);
}
