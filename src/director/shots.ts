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

const easeOut: [number, number, number, number] = [0, 0, 0.58, 1];
const easeIO: [number, number, number, number] = [0.45, 0, 0.55, 1];

/**
 * Map high-level story beats to concrete property tracks.
 */
export function tracksForShots(project: ProjectFileV1, shots: ShotSpec[]): PropertyTrack[] {
  const tracks: PropertyTrack[] = [];
  const findCam = project.scene.find((s) => s.type === "camera2d");
  const findPlot = project.scene.find((s) => s.type === "plot2d");
  const cameraId = findCam?.id ?? "main-cam";
  const plotId = findPlot?.id ?? "main-plot";

  const defaultHw = findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth : 8;
  const wideHw = findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth * 1.45 : 12;

  for (const s of shots) {
    if (s.kind === "intro") {
      // Equation/camera title beats are unused when the overlay is off; keep the kind for future use.
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
      tracks.push({
        id: `cam-${s.at}-reveal-hw`,
        target: `${s.cameraId ?? cameraId}.halfWidth`,
        keyframes: [
          { t: t0, value: wideHw, easing: "linear" },
          { t: t1, value: defaultHw, easing: "linear" },
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
      );
    } else {
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
          id: `cam-${s.at}-outro-hw`,
          target: `${s.cameraId ?? cameraId}.halfWidth`,
          keyframes: [
            { t: t0, value: defaultHw, easing: "linear" },
            { t: t1, value: defaultHw * 1.2, easing: easeOut },
          ],
        },
      );
    }
  }
  return tracks;
}

/**
 * Preset: draw + zoom-in, pan, outro with zoom-out + line soften (~18s)
 */
export function defaultStoryboard(project: ProjectFileV1): ProjectFileV1 {
  const shots: ShotSpec[] = [
    { kind: "reveal", at: 0, duration: 6 },
    { kind: "connect", at: 6, duration: 5 },
    { kind: "outro", at: 11, duration: 7 },
  ];
  const tr = tracksForShots(project, shots);
  return {
    ...project,
    timeline: { ...project.timeline, duration: 18, fps: 30, tracks: tr },
  };
}
