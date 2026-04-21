import type { ProjectFileV1 } from "../core/ir";
import { evaluateAtTime } from "../engine/evaluateProject";
import { Plot2DWebGL } from "../render/webgl2/Plot2DWebGL";
import type { Polyline2D } from "../core/math/samplePlot";

export interface ExportResult {
  blob: Blob;
  mime: string;
  method: "mediarecorder";
}

const plotCache = () => new Map<string, { hash: string; poly: Polyline2D }>();

function pickMime(): string | null {
  const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const c of cands) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

/**
 * Renders the same f(t) as the preview, one frame at a time, with fixed dt = 1/fps.
 * Uses `MediaRecorder` on an `HTMLCanvasElement` for broad browser support.
 * (`captureStream(0)` + per-frame `requestFrame` where available.)
 */
export async function exportProjectVideo(
  project: ProjectFileV1,
  options: { width: number; height: number; dpr: number; fps: number; signal?: AbortSignal },
): Promise<ExportResult> {
  const { width, height, dpr, fps, signal } = options;
  const duration = project.timeline.duration;
  const frames = Math.max(1, Math.ceil(duration * fps));
  const cache = plotCache();
  const canvas = document.createElement("canvas");
  const gl = new Plot2DWebGL(canvas);
  gl.resizeCssPixels(width, height, dpr);
  const mime = pickMime();
  if (!mime) {
    throw new Error("No WebM/VP8/VP9 MediaRecorder; cannot export in this environment.");
  }
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onerror = (e) => reject(e);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      resolve({ blob, mime, method: "mediarecorder" });
    };
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    rec.start();
    void (async () => {
      try {
        for (let i = 0; i < frames; i++) {
          if (signal?.aborted) throw new DOMException("aborted", "AbortError");
          const t = i / fps;
          const st = evaluateAtTime(project, t, cache);
          gl.render(st);
          track?.requestFrame?.();
          const ms = 1000 / fps;
          await new Promise((r) => setTimeout(r, Math.max(0, ms)));
        }
        rec.stop();
      } catch (e) {
        try {
          rec.stop();
        } catch {
          // ignore
        }
        reject(e);
      }
    })();
  });
}
