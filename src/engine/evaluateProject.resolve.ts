import type { ProjectFileV1, SceneNode } from "../core/ir";
import type { PropertyTrack } from "../core/ir";
import { DEFAULT_FOLLOW_PLOT_ID, propertyTarget } from "../core/trackTarget";
import { getNum } from "./trackValue";
import { samplePlot, sampleFunctionPlotInRange, type Polyline2D } from "../core/math/samplePlot";
import { sampleImplicitPlotInRange } from "../core/math/implicitPlot";
import { analyzePeriodicity } from "../core/math/analyzePeriodicity";
import { computeCameraEnvelope, CAMERA_PREVIEW_ASPECT } from "./cameraEnvelope";
import {
  computeTimelineUnionSampling,
  functionPlotSamplingKey,
  computeTimelineUnionSampling2D,
  implicitPlotSamplingKey,
} from "./plotSampling";
import { resolveCameraWithFollow } from "./cameraFollow";
import type {
  ResolvedCamera2D,
  ResolvedPlot2D,
  ResolvedEquation,
  RenderStateV1,
} from "./renderState";

function getCamera(
  node: Extract<SceneNode, { type: "camera2d" }>,
  tracks: Map<string, PropertyTrack>,
  t: number,
): ResolvedCamera2D {
  const p = node.initial;
  return {
    id: node.id,
    centerX: getNum(tracks, propertyTarget(node.id, "centerX"), t, p.centerX),
    centerY: getNum(tracks, propertyTarget(node.id, "centerY"), t, p.centerY),
    halfWidth: getNum(tracks, propertyTarget(node.id, "halfWidth"), t, p.halfWidth),
  };
}

function plotKey(plot: { kind: string } & Record<string, unknown>): string {
  return JSON.stringify(plot);
}

type Envelope = ReturnType<typeof computeCameraEnvelope>;

function firstCameraEnvelope(
  project: ProjectFileV1,
  envelopes: Record<string, Envelope>,
  cameraId: string,
): Envelope | undefined {
  const env = envelopes[cameraId];
  if (env) return env;
  const firstCam = project.scene.find((s) => s.type === "camera2d");
  if (firstCam) return envelopes[firstCam.id];
  return undefined;
}

function fallbackEnvelopeForFunction(xMin: number, xMax: number): Envelope {
  const mid = (xMin + xMax) / 2;
  const hw = 8;
  const hH = hw / CAMERA_PREVIEW_ASPECT;
  return {
    minCenterX: mid,
    maxCenterX: mid,
    minCenterY: 0,
    maxCenterY: 0,
    maxHalfWidth: hw,
    minViewLeft: mid - hw,
    maxViewRight: mid + hw,
    minViewBottom: -hH,
    maxViewTop: hH,
  };
}

function fallbackEnvelopeForImplicit(pl: {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}): Envelope {
  const midx = (pl.xMin + pl.xMax) * 0.5;
  const midy = (pl.yMin + pl.yMax) * 0.5;
  const hw = 8;
  const hH = hw / CAMERA_PREVIEW_ASPECT;
  return {
    minCenterX: midx,
    maxCenterX: midx,
    minCenterY: midy,
    maxCenterY: midy,
    maxHalfWidth: hw,
    minViewLeft: midx - hw,
    maxViewRight: midx + hw,
    minViewBottom: midy - hH,
    maxViewTop: midy + hH,
  };
}

export function resolveBaseCamerasAndEnvelopes(
  project: ProjectFileV1,
  tracks: Map<string, PropertyTrack>,
  t: number,
  duration: number,
): {
  camerasBase: Record<string, ResolvedCamera2D>;
  envelopes: Record<string, Envelope>;
} {
  const camerasBase: Record<string, ResolvedCamera2D> = {};
  const envelopes: Record<string, Envelope> = {};
  for (const node of project.scene) {
    if (node.type === "camera2d") {
      camerasBase[node.id] = getCamera(node, tracks, t);
      envelopes[node.id] = computeCameraEnvelope(project, node.id, node.initial, duration);
    }
  }
  return { camerasBase, envelopes };
}

type PeriodicCache = Map<string, ReturnType<typeof analyzePeriodicity>>;

function makePeriodicCached(periodicByExpr: PeriodicCache) {
  return (expression: string) => {
    let p = periodicByExpr.get(expression);
    if (!p) {
      p = analyzePeriodicity(expression);
      periodicByExpr.set(expression, p);
    }
    return p;
  };
}

export function resolvePlotsAndEquations(
  project: ProjectFileV1,
  tracks: Map<string, PropertyTrack>,
  t: number,
  envelopes: Record<string, Envelope>,
  plotCache: Map<string, { hash: string; poly: Polyline2D }> | undefined,
  periodicByExpr: PeriodicCache,
): { plots: Record<string, ResolvedPlot2D>; equations: Record<string, ResolvedEquation> } {
  const periodicCached = makePeriodicCached(periodicByExpr);
  const plots: Record<string, ResolvedPlot2D> = {};
  const equations: Record<string, ResolvedEquation> = {};

  for (const node of project.scene) {
    if (node.type === "plot2d") {
      const draw0 = node.initialDraw;
      const draw = getNum(tracks, propertyTarget(node.id, "draw"), t, draw0);
      const lw = getNum(tracks, propertyTarget(node.id, "lineWidth"), t, node.lineWidth);

      let poly: Polyline2D;
      let ph: string;

      if (node.plot.kind === "function") {
        let env = firstCameraEnvelope(project, envelopes, node.cameraId);
        if (!env) env = fallbackEnvelopeForFunction(node.plot.xMin, node.plot.xMax);
        const periodic = periodicCached(node.plot.expression);
        const bounds = computeTimelineUnionSampling(node.plot, env, periodic);
        ph = functionPlotSamplingKey(node.plot, bounds);
        const cached = plotCache?.get(node.id);
        poly =
          cached && cached.hash === ph
            ? cached.poly
            : sampleFunctionPlotInRange(node.plot, bounds.xMin, bounds.xMax, bounds.samples);
        if (plotCache) plotCache.set(node.id, { hash: ph, poly });
      } else if (node.plot.kind === "implicit") {
        let env = firstCameraEnvelope(project, envelopes, node.cameraId);
        if (!env) env = fallbackEnvelopeForImplicit(node.plot);
        const b2 = computeTimelineUnionSampling2D(node.plot, env);
        ph = implicitPlotSamplingKey(node.plot, b2);
        const cached = plotCache?.get(node.id);
        poly =
          cached && cached.hash === ph
            ? cached.poly
            : sampleImplicitPlotInRange(
                node.plot,
                b2.xMin,
                b2.xMax,
                b2.yMin,
                b2.yMax,
                b2.nx,
                b2.ny,
              );
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
      const opacity = getNum(tracks, propertyTarget(node.id, "opacity"), t, op0);
      const x = getNum(tracks, propertyTarget(node.id, "x"), t, node.position.x);
      const y = getNum(tracks, propertyTarget(node.id, "y"), t, node.position.y);
      const fontSize = getNum(tracks, propertyTarget(node.id, "fontSize"), t, node.fontSize);
      equations[node.id] = {
        id: node.id,
        opacity: Math.max(0, Math.min(1, opacity)),
        position: { x, y },
        fontSize,
        latex: node.latex,
      };
    }
  }

  return { plots, equations };
}

export function applyCameraFollow(
  project: ProjectFileV1,
  tracks: Map<string, PropertyTrack>,
  t: number,
  camerasBase: Record<string, ResolvedCamera2D>,
  plots: Record<string, ResolvedPlot2D>,
): Record<string, ResolvedCamera2D> {
  const firstPlot2d = project.scene.find((s) => s.type === "plot2d");
  const cameras: Record<string, ResolvedCamera2D> = { ...camerasBase };
  for (const node of project.scene) {
    if (node.type === "camera2d") {
      const base = camerasBase[node.id];
      if (base) {
        let followPlotId = node.initial.followPlotId;
        if (!followPlotId) {
          if (firstPlot2d) followPlotId = firstPlot2d.id;
        }
        const followPlotNode =
          followPlotId && project.scene.find((s) => s.type === "plot2d" && s.id === followPlotId);
        const plotInitialDraw =
          followPlotNode && followPlotNode.type === "plot2d" ? followPlotNode.initialDraw : 0;
        const followCtx = {
          project,
          t,
          tracks,
          plotId: followPlotId ?? (firstPlot2d ? firstPlot2d.id : DEFAULT_FOLLOW_PLOT_ID),
          plotInitialDraw,
        };
        cameras[node.id] = resolveCameraWithFollow(node, base, plots, followCtx);
      }
    }
  }
  return cameras;
}

export function buildRenderStateV1(
  t: number,
  duration: number,
  style: ProjectFileV1["style"],
  cameras: Record<string, ResolvedCamera2D>,
  plots: Record<string, ResolvedPlot2D>,
  equations: Record<string, ResolvedEquation>,
): RenderStateV1 {
  return { t, duration, style, cameras, plots, equations };
}
