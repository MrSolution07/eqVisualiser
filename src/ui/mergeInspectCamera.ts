import type { RenderStateV1 } from "../engine/renderState";

const MAIN_CAM = "main-cam";

export type InspectOffset = {
  /** Additive pan in world units (applied to evaluated camera). */
  panX: number;
  panY: number;
  /** Multiplier for halfWidth; values > 1 zoom out. */
  zoom: number;
};

export function mergeInspectIntoRenderState(state: RenderStateV1, inspect: InspectOffset | null): RenderStateV1 {
  if (!inspect || (inspect.panX === 0 && inspect.panY === 0 && inspect.zoom === 1)) {
    return state;
  }
  const cam = state.cameras[MAIN_CAM];
  if (!cam) return state;
  const next = {
    ...cam,
    centerX: cam.centerX + inspect.panX,
    centerY: cam.centerY + inspect.panY,
    halfWidth: Math.max(1e-6, cam.halfWidth * inspect.zoom),
  };
  return {
    ...state,
    cameras: { ...state.cameras, [MAIN_CAM]: next },
  };
}

export function resetInspect(): InspectOffset {
  return { panX: 0, panY: 0, zoom: 1 };
}
