/**
 * Scene + math intermediate representation (v1).
 * All animatable values are resolved at time t via the timeline (see engine).
 */

export type Id = string;

/** CSS-like cubic-bezier control points (x1,y1,x2,y2) in 0..1 */
export type CubicBezier = readonly [number, number, number, number];

export const DEFAULT_EASING: CubicBezier = [0.4, 0, 0.2, 1];

export type Easing = CubicBezier | "linear";

export interface TimeKeyframe<T> {
  t: number;
  value: T;
  /** default: DEFAULT_EASING (used when interpolating to the *next* key) */
  easing?: Easing;
}

export type TrackId = string;

export interface PropertyTrack {
  id: TrackId;
  /** property path, e.g. "main-cam.centerX" */
  target: string;
  keyframes: TimeKeyframe<number>[];
}

export interface TimelineV1 {
  /** Global duration in seconds */
  duration: number;
  /** Composition frame rate (preview + export) */
  fps: number;
  /** Same `PropertyTrack.target` is merged: keyframes are union-sorted, duplicate `t` uses last keyframe. */
  tracks: PropertyTrack[];
}

export type PlotKind = "function" | "parametric" | "implicit";

/** y = f(x) */
export interface FunctionPlotDef {
  kind: "function";
  /** mathjs expression using variable `x` */
  expression: string;
  xMin: number;
  xMax: number;
  samples: number;
}

/** F(x, y) = 0, sampled in a 2D window (marching squares). */
export interface ImplicitPlotDef {
  kind: "implicit";
  /** mathjs expression; zero set F = 0 is drawn */
  expression: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: number;
}

/** x = x(t), y = y(t) with parameter u */
export interface ParametricPlotDef {
  kind: "parametric";
  xExpression: string;
  yExpression: string;
  uMin: number;
  uMax: number;
  samples: number;
  /** name of parameter in both expressions */
  param: string;
}

export type PlotDefinition = FunctionPlotDef | ParametricPlotDef | ImplicitPlotDef;

export interface StyleTokensV1 {
  background: string;
  grid: string;
  axis: string;
  curve: string;
  text: string;
  accent: string;
}

export const DEFAULT_STYLE: StyleTokensV1 = {
  background: "#0c0d10",
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.35)",
  curve: "#6ee7ff",
  text: "rgba(255,255,255,0.9)",
  accent: "#a78bfa",
};

export interface Camera2DProps {
  /** world-space pan */
  centerX: number;
  centerY: number;
  /** scale: world units per half-width of view (higher = more zoomed out) */
  halfWidth: number;
  /** 0 = full opacity UI overlay, 1 = only plot */
  letterbox?: number;
  /** Optional: follow the drawn tip of this plot (layered on keyframed camera). 0 = off. */
  followPlotId?: string;
  followWeight?: number;
  followMaxX?: number;
  followMaxY?: number;
  /** Tip is framed near centerX + followLeadBias * halfWidth */
  followLeadBias?: number;
  /** Ramp follow in as draw passes this threshold (0..1). */
  followRampDrawMin?: number;
  /**
   * Backward-time smoothing of follow offset (seconds). 0 = single-step (legacy behavior).
   * Deterministic: weighted blend of offsets over [t-τ, t].
   */
  followSmoothSeconds?: number;
  /** Number of time samples in the smoothing window (2–32). */
  followSmoothSampleCount?: number;
  /**
   * When draw is above this (0..1), follow tapers to zero toward draw=1 (seamless handoff to outro keyframes). 1 = no end falloff.
   */
  followDrawFalloffStart?: number;
  /** Extra lead along tip motion (0 = off). Tip offset by gain × (tip(t) - tip(t-ε)). */
  followVelocityLeadGain?: number;
}

export interface Camera2DNode {
  type: "camera2d";
  id: Id;
  name?: string;
  initial: Camera2DProps;
}

export interface PlotLayerNode {
  type: "plot2d";
  id: Id;
  name?: string;
  /** Which camera frames this layer (v1: single main camera) */
  cameraId: Id;
  plot: PlotDefinition;
  /** 0..1 line draw for “story” reveal */
  initialDraw: number;
  lineWidth: number;
}

export interface EquationStripNode {
  type: "equation";
  id: Id;
  name?: string;
  /** LaTeX-like or plain string for v1 (display only; math is in plot) */
  latex: string;
  position: { x: number; y: number };
  initialOpacity: number;
  fontSize: number;
}

export type SceneNode = Camera2DNode | PlotLayerNode | EquationStripNode;

export interface ProjectMetaV1 {
  title: string;
}

export interface ProjectFileV1 {
  version: 1;
  meta: ProjectMetaV1;
  style: StyleTokensV1;
  scene: SceneNode[];
  timeline: TimelineV1;
}

export function isProjectFileV1(x: unknown): x is ProjectFileV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.version === 1 && Array.isArray(o.scene) && o.timeline != null && typeof o.timeline === "object";
}
