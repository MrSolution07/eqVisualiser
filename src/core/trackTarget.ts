import type { Id } from "./ir";

/** Default scene id for the main 2D camera in bundled demos; prefer resolving from project order when possible. */
export const DEFAULT_VIEW_CAMERA_ID = "main-cam" as const satisfies Id;
/** Default plot id used only when the scene has no `plot2d` node for follow context. */
export const DEFAULT_FOLLOW_PLOT_ID = "main-plot" as const satisfies Id;

/** Timeline property path: `"nodeId.propertyName"` (matches `PropertyTrack.target`). */
export function propertyTarget(nodeId: string, property: string): string {
  return `${nodeId}.${property}`;
}
