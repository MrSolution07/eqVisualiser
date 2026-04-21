import type { ProjectFileV1, PropertyTrack } from "../core/ir";
import { analyzePeriodicity } from "../core/math/analyzePeriodicity";

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

/** Director hints from the primary function plot (period for pans / outro framing). */
export interface DirectorContext {
  period: number | null;
}

const easeOut: [number, number, number, number] = [0, 0, 0.58, 1];
const easeInOutSmooth: [number, number, number, number] = [0.42, 0, 0.58, 1];

export function analyzeDirectorContext(project: ProjectFileV1): DirectorContext {
  const plotNode = project.scene.find((s) => s.type === "plot2d" && s.plot.kind === "function");
  if (!plotNode || plotNode.type !== "plot2d") return { period: null };
  const plot = plotNode.plot;
  if (plot.kind !== "function") return { period: null };
  const a = analyzePeriodicity(plot.expression);
  if (a.kind === "periodic") return { period: a.period };
  return { period: null };
}

/**
 * Map high-level story beats to concrete property tracks.
 * `compositionDuration` — total timeline length; used for final “hold” keyframes on outro.
 */
export function tracksForShots(
  project: ProjectFileV1,
  shots: ShotSpec[],
  ctx?: DirectorContext,
  compositionDuration?: number,
): PropertyTrack[] {
  const tracks: PropertyTrack[] = [];
  const findCam = project.scene.find((s) => s.type === "camera2d");
  const findPlot = project.scene.find((s) => s.type === "plot2d");
  const cameraId = findCam?.id ?? "main-cam";
  const plotId = findPlot?.id ?? "main-plot";

  const defaultHw = findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth : 8;
  const wideHw = findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth * 1.45 : 12;

  const period = ctx?.period ?? null;
  const connectDeltaX = period != null ? Math.min(period * 2.35, 16) : 1.2;
  const outroTargetHw = period != null ? Math.max(defaultHw * 1.62, period * 1.78) : defaultHw * 1.38;

  const storyEnd = compositionDuration ?? project.timeline.duration;

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
          { t: t0, value: 0, easing: easeInOutSmooth },
          { t: t1, value: 1, easing: "linear" },
        ],
      });
      tracks.push({
        id: `cam-${s.at}-reveal-hw`,
        target: `${s.cameraId ?? cameraId}.halfWidth`,
        keyframes: [
          { t: t0, value: wideHw, easing: easeInOutSmooth },
          { t: t1, value: defaultHw, easing: easeInOutSmooth },
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
            { t: t0, value: cx0, easing: easeInOutSmooth },
            { t: t1, value: cx0 + connectDeltaX, easing: easeOut },
          ],
        },
        {
          id: `cam-${s.at}-pany`,
          target: `${s.cameraId ?? cameraId}.centerY`,
          keyframes: [
            { t: t0, value: cy0, easing: easeInOutSmooth },
            { t: t1, value: cy0 + 0.15, easing: easeOut },
          ],
        },
      );
    } else {
      const t0 = s.at;
      const t1 = s.at + s.duration;
      const lw0 = findPlot && findPlot.type === "plot2d" ? findPlot.lineWidth : 2.5;

      const hwKeys: PropertyTrack["keyframes"] = [
        { t: t0, value: defaultHw, easing: easeInOutSmooth },
        { t: t1, value: outroTargetHw, easing: easeOut },
      ];
      if (storyEnd > t1 + 1e-6) {
        hwKeys.push({ t: storyEnd, value: outroTargetHw, easing: "linear" });
      }

      const lwKeys: PropertyTrack["keyframes"] = [
        { t: t0, value: lw0, easing: easeInOutSmooth },
        { t: t1, value: 1.2, easing: easeOut },
      ];
      if (storyEnd > t1 + 1e-6) {
        lwKeys.push({ t: storyEnd, value: 1.2, easing: "linear" });
      }

      tracks.push(
        {
          id: `plot-${s.at}-fade-line`,
          target: `${s.plotId ?? plotId}.lineWidth`,
          keyframes: lwKeys,
        },
        {
          id: `cam-${s.at}-outro-hw`,
          target: `${s.cameraId ?? cameraId}.halfWidth`,
          keyframes: hwKeys,
        },
      );
    }
  }
  return tracks;
}

const STORY_DURATION = 19;

/**
 * Preset: draw + zoom-in, pan, outro with zoom-out + line soften + ending hold
 */
export function defaultStoryboard(project: ProjectFileV1): ProjectFileV1 {
  const shots: ShotSpec[] = [
    { kind: "reveal", at: 0, duration: 6 },
    { kind: "connect", at: 6, duration: 5 },
    { kind: "outro", at: 11, duration: 7 },
  ];
  const withDuration = { ...project, timeline: { ...project.timeline, duration: STORY_DURATION } };
  const ctx = analyzeDirectorContext(withDuration);
  const tr = tracksForShots(withDuration, shots, ctx, STORY_DURATION);
  return {
    ...withDuration,
    timeline: { ...withDuration.timeline, duration: STORY_DURATION, fps: 30, tracks: tr },
  };
}
