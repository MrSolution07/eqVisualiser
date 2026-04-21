import type { ProjectFileV1 } from "./ir";
import { DEFAULT_STYLE } from "./ir";
import { defaultStoryboard } from "../director/shots";

const DEMO_EXPR = "sin(x) * exp(-0.15 * x)";

export function createDefaultProject(): ProjectFileV1 {
  const p: ProjectFileV1 = {
    version: 1,
    meta: { title: "Cinematic demo" },
    style: { ...DEFAULT_STYLE },
    scene: [
      {
        type: "camera2d",
        id: "main-cam",
        name: "Main",
        initial: { centerX: 0, centerY: 0, halfWidth: 8 },
      },
      {
        type: "plot2d",
        id: "main-plot",
        name: "Plot",
        cameraId: "main-cam",
        plot: {
          kind: "function",
          expression: DEMO_EXPR,
          xMin: -4,
          xMax: 7,
          samples: 512,
        },
        initialDraw: 0,
        lineWidth: 2.5,
      },
      {
        type: "equation",
        id: "eq-title",
        name: "Equation",
        latex: `y = ${DEMO_EXPR.replace(/\*/g, " \\cdot ")}`,
        position: { x: 0, y: 0.35 },
        initialOpacity: 0,
        fontSize: 22,
      },
    ],
    timeline: {
      duration: 18,
      fps: 30,
      tracks: [],
    },
  };
  return defaultStoryboard(p);
}

export function projectWithTimeline(project: ProjectFileV1, next: ProjectFileV1["timeline"]): ProjectFileV1 {
  return { ...project, timeline: next };
}
