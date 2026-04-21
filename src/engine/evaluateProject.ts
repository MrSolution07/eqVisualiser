import type { ProjectFileV1, SceneNode } from "../core/ir";
import type { PropertyTrack } from "../core/ir";
import { valueAtTime } from "./keyframes";
import { samplePlot } from "../core/math/samplePlot";
import type { Polyline2D } from "../core/math/samplePlot";

export interface ResolvedCamera2D {
  id: string;
  centerX: number;
  centerY: number;
  halfWidth: number;
}

export interface ResolvedPlot2D {
  id: string;
  cameraId: string;
  /** 0-1 how much of the curve to draw (by arclength) */
  draw: number;
  lineWidth: number;
  polyline: Polyline2D;
  plotHash: string;
}

export interface ResolvedEquation {
  id: string;
  opacity: number;
  position: { x: number; y: number };
  fontSize: number;
  latex: string;
}

export interface RenderStateV1 {
  t: number;
  duration: number;
  style: ProjectFileV1["style"];
  cameras: Record<string, ResolvedCamera2D>;
  plots: Record<string, ResolvedPlot2D>;
  equations: Record<string, ResolvedEquation>;
}

function collectTracks(timeline: ProjectFileV1["timeline"]): Map<string, PropertyTrack> {
  const m = new Map<string, PropertyTrack>();
  for (const tr of timeline.tracks) {
    m.set(tr.target, tr);
  }
  return m;
}

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
 * When `plotCache` is provided, reuses polylines when the plot expression is unchanged.
 */
export function evaluateAtTime(project: ProjectFileV1, tIn: number, plotCache?: Map<string, { hash: string; poly: Polyline2D }>): RenderStateV1 {
  const duration = project.timeline.duration;
  const t = Math.max(0, Math.min(tIn, duration));
  const tracks = collectTracks(project.timeline);
  const cameras: Record<string, ResolvedCamera2D> = {};
  const plots: Record<string, ResolvedPlot2D> = {};
  const equations: Record<string, ResolvedEquation> = {};

  for (const node of project.scene) {
    if (node.type === "camera2d") {
      cameras[node.id] = getCamera(node, tracks, t);
    } else if (node.type === "plot2d") {
      const ph = plotKey(node.plot as unknown as { kind: string } & Record<string, unknown>);
      const cached = plotCache?.get(node.id);
      const poly = cached && cached.hash === ph ? cached.poly : samplePlot(node.plot);
      if (plotCache) plotCache.set(node.id, { hash: ph, poly });
      const draw0 = node.initialDraw;
      const draw = getNum(tracks, `${node.id}.draw`, t, draw0);
      const lw = getNum(tracks, `${node.id}.lineWidth`, t, node.lineWidth);
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
