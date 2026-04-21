import type { ProjectFileV1, PropertyTrack } from "../core/ir";

export type ShotKind = "intro" | "reveal" | "connect" | "outro";

export interface ShotSpec {
  kind: ShotKind;
  at: number;
  duration: number;
  /** Ids in default project */
  cameraId?: string;
  plotId?: string;
  equationId?: string;
}

const easeIn: [number, number, number, number] = [0.42, 0, 1, 1];
const easeOut: [number, number, number, number] = [0, 0, 0.58, 1];
const easeIO: [number, number, number, number] = [0.45, 0, 0.55, 1];

/**
 * Map high-level story beats to concrete property tracks.
 */
export function tracksForShots(project: ProjectFileV1, shots: ShotSpec[]): PropertyTrack[] {
  const tracks: PropertyTrack[] = [];
  const findCam = project.scene.find((s) => s.type === "camera2d");
  const findPlot = project.scene.find((s) => s.type === "plot2d");
  const findEq = project.scene.find((s) => s.type === "equation");
  const cameraId = findCam?.id ?? "main-cam";
  const plotId = findPlot?.id ?? "main-plot";
  const eqId = findEq?.id ?? "eq-title";

  for (const s of shots) {
    if (s.kind === "intro") {
      const t0 = s.at;
      const t1 = s.at + s.duration * 0.35;
      tracks.push({
        id: `eq-${s.at}-op`,
        target: `${s.equationId ?? eqId}.opacity`,
        keyframes: [
          { t: t0, value: 0, easing: "linear" },
          { t: t1, value: 1, easing: easeOut },
        ],
      });
      const cam0 = t0;
      const cam1 = s.at + s.duration;
      tracks.push({
        id: `cam-${s.at}-hw`,
        target: `${s.cameraId ?? cameraId}.halfWidth`,
        keyframes: [
          { t: cam0, value: findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth * 1.45 : 12, easing: "linear" },
          { t: cam1, value: findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth : 8, easing: easeIO },
        ],
      });
    } else if (s.kind === "reveal") {
      const t0 = s.at;
      const t1 = s.at + s.duration;
      tracks.push({
        id: `plot-${s.at}-draw`,
        target: `${s.plotId ?? plotId}.draw`,
        keyframes: [
          { t: t0, value: 0, easing: "linear" },
          { t: t1, value: 1, easing: easeIO },
        ],
      });
    } else if (s.kind === "connect") {
      const t0 = s.at;
      const t1 = s.at + s.duration;
      const cx0 = findCam && findCam.type === "camera2d" ? findCam.initial.centerX : 0;
      const cy0 = findCam && findCam.type === "camera2d" ? findCam.initial.centerY : 0;
      tracks.push(
        {
          id: `cam-${s.at}-panx`,
          target: `${s.cameraId ?? cameraId}.centerX`,
          keyframes: [
            { t: t0, value: cx0, easing: "linear" },
            { t: t1, value: cx0 + 1.2, easing: easeOut },
          ],
        },
        {
          id: `cam-${s.at}-pany`,
          target: `${s.cameraId ?? cameraId}.centerY`,
          keyframes: [
            { t: t0, value: cy0, easing: "linear" },
            { t: t1, value: cy0 + 0.15, easing: easeOut },
          ],
        },
        {
          id: `cam-${s.at}-z`,
          target: `${s.cameraId ?? cameraId}.halfWidth`,
          keyframes: [
            { t: t0, value: findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth : 8, easing: "linear" },
            { t: t1, value: (findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth : 8) * 0.75, easing: easeIn },
          ],
        },
      );
    } else {
      // outro: hold title, soften plot
      const t0 = s.at;
      const t1 = s.at + s.duration;
      tracks.push(
        {
          id: `plot-${s.at}-fade-line`,
          target: `${s.plotId ?? plotId}.lineWidth`,
          keyframes: [
            { t: t0, value: findPlot && findPlot.type === "plot2d" ? findPlot.lineWidth : 2.5, easing: "linear" },
            { t: t1, value: 1.2, easing: easeOut },
          ],
        },
        {
          id: `eq-${s.at}-end`,
          target: `${s.equationId ?? eqId}.y`,
          keyframes: [
            { t: t0, value: findEq && findEq.type === "equation" ? findEq.position.y : 0.35, easing: "linear" },
            { t: t1, value: 0.42, easing: easeIO },
          ],
        },
      );
    }
  }
  return tracks;
}

/**
 * Preset used by the default demo: four beats in ~18s
 */
export function defaultStoryboard(project: ProjectFileV1): ProjectFileV1 {
  const shots: ShotSpec[] = [
    { kind: "intro", at: 0, duration: 4 },
    { kind: "reveal", at: 3.2, duration: 6 },
    { kind: "connect", at: 8.5, duration: 5 },
    { kind: "outro", at: 13, duration: 4 },
  ];
  const tr = tracksForShots(project, shots);
  return {
    ...project,
    timeline: { ...project.timeline, duration: 18, fps: 30, tracks: tr },
  };
}
