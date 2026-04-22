import type { ProjectFileV1 } from "../core/ir";
import type { Polyline2D } from "../core/math/samplePlot";
import { DEFAULT_VIEW_CAMERA_ID } from "../core/trackTarget";

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

/** Primary camera for preview/export: `main-cam` if present, else the first key in the record. */
export function getViewCameraId(cameras: Record<string, ResolvedCamera2D>): string | undefined {
  const keys = Object.keys(cameras);
  if (keys.length === 0) return undefined;
  if (cameras[DEFAULT_VIEW_CAMERA_ID]) return DEFAULT_VIEW_CAMERA_ID;
  return keys[0];
}

export function getViewCamera(
  cameras: Record<string, ResolvedCamera2D>,
): ResolvedCamera2D | undefined {
  const id = getViewCameraId(cameras);
  return id ? cameras[id] : undefined;
}
