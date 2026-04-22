import type { ProjectFileV1, PropertyTrack } from "../core/ir";
import { analyzePeriodicity } from "../core/math/analyzePeriodicity";
import { computeHeroOutroFraming } from "./outroFraming";

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

/** Bbox / aspect fit from the main function plot (baked at story time). */
export type HeroOutroFraming = { centerX: number; centerY: number; halfWidth: number };

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
 * `heroOutro` — if set, outro keyframes re-center to the bbox hero and use max(hero, period-based) halfWidth.
 */
export function tracksForShots(
  project: ProjectFileV1,
  shots: ShotSpec[],
  ctx?: DirectorContext,
  compositionDuration?: number,
  heroOutro?: HeroOutroFraming | null,
): PropertyTrack[] {
  const tracks: PropertyTrack[] = [];
  const findCam = project.scene.find((s) => s.type === "camera2d");
  const findPlot = project.scene.find((s) => s.type === "plot2d");
  const cameraId = findCam?.id ?? "main-cam";
  const plotId = findPlot?.id ?? "main-plot";

  const defaultHw = findCam && findCam.type === "camera2d" ? findCam.initial.halfWidth : 8;

  const period = ctx?.period ?? null;
  const connectDeltaX = period != null ? Math.min(period * 2.35, 16) : 1.2;
  const outroTargetHw =
    period != null ? Math.max(defaultHw * 1.62, period * 1.78) : defaultHw * 1.38;

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
          { t: t0, value: 0, easing: "linear" },
          { t: t1, value: 1, easing: "linear" },
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
      const cx0 = findCam && findCam.type === "camera2d" ? findCam.initial.centerX : 0;
      const cy0 = findCam && findCam.type === "camera2d" ? findCam.initial.centerY : 0;
      const endConnectX = cx0 + connectDeltaX;
      const endConnectY = cy0 + 0.15;

      const outroW = Math.max(heroOutro != null ? heroOutro.halfWidth : 0, outroTargetHw);

      const hwKeys: PropertyTrack["keyframes"] = [
        { t: t0, value: defaultHw, easing: easeInOutSmooth },
        { t: t1, value: outroW, easing: easeOut },
      ];
      if (storyEnd > t1 + 1e-6) {
        hwKeys.push({ t: storyEnd, value: outroW, easing: "linear" });
      }

      const lwKeys: PropertyTrack["keyframes"] = [
        { t: t0, value: lw0, easing: easeInOutSmooth },
        { t: t1, value: 1.2, easing: easeOut },
      ];
      if (storyEnd > t1 + 1e-6) {
        lwKeys.push({ t: storyEnd, value: 1.2, easing: "linear" });
      }

      const outroTracks: PropertyTrack[] = [
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
      ];

      if (heroOutro) {
        const cxKf: PropertyTrack["keyframes"] = [
          { t: t0, value: endConnectX, easing: easeInOutSmooth },
          { t: t1, value: heroOutro.centerX, easing: easeOut },
        ];
        const cyKf: PropertyTrack["keyframes"] = [
          { t: t0, value: endConnectY, easing: easeInOutSmooth },
          { t: t1, value: heroOutro.centerY, easing: easeOut },
        ];
        if (storyEnd > t1 + 1e-6) {
          cxKf.push({ t: storyEnd, value: heroOutro.centerX, easing: "linear" });
          cyKf.push({ t: storyEnd, value: heroOutro.centerY, easing: "linear" });
        }
        outroTracks.push(
          {
            id: `cam-${s.at}-outro-cx`,
            target: `${s.cameraId ?? cameraId}.centerX`,
            keyframes: cxKf,
          },
          {
            id: `cam-${s.at}-outro-cy`,
            target: `${s.cameraId ?? cameraId}.centerY`,
            keyframes: cyKf,
          },
        );
      }

      tracks.push(...outroTracks);
    }
  }
  return tracks;
}

/** Total composition length (seconds). Single source for default story + schema default duration. */
export const STORY_DURATION = 24;

/** Draw track reaches 1 at this time (seconds) in the default storyboard. */
export const DEFAULT_STORY_DRAW_END_T = 17;

/**
 * Preset: long linear draw overlapping a slow pan, then outro zoom/re-center while draw may still be in progress, then hold.
 */
export function defaultStoryboard(project: ProjectFileV1): ProjectFileV1 {
  const drawSpan = DEFAULT_STORY_DRAW_END_T;
  const connectAt = 4;
  const connectDur = 5;
  const outroAt = 12;
  const outroDur = 8;
  const shots: ShotSpec[] = [
    { kind: "reveal", at: 0, duration: drawSpan },
    { kind: "connect", at: connectAt, duration: connectDur },
    { kind: "outro", at: outroAt, duration: outroDur },
  ];
  const withDuration = { ...project, timeline: { ...project.timeline, duration: STORY_DURATION } };
  const ctx = analyzeDirectorContext(withDuration);
  const hero = computeHeroOutroFraming(withDuration, STORY_DURATION);
  const tr = tracksForShots(withDuration, shots, ctx, STORY_DURATION, hero);
  return {
    ...withDuration,
    timeline: { ...withDuration.timeline, duration: STORY_DURATION, fps: 30, tracks: tr },
  };
}
