import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { InspectOffset } from "./mergeInspectCamera";

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export type UseCanvasInspectGesturesArgs = {
  hostRef: RefObject<HTMLElement | null>;
  inspect: InspectOffset;
  /** Paused inspect: pan/pinch when true and sheet closed. */
  gesturesEnabled: boolean;
  playing: boolean;
  sheetOpen: boolean;
  /** Baseline camera from timeline (no inspect merge). */
  getEvalCam: () => { centerX: number; centerY: number; halfWidth: number } | undefined;
  setInspect: Dispatch<SetStateAction<InspectOffset>>;
  onTapWhilePlaying: () => void;
};

/**
 * Pointer gestures: paused = pan + pinch zoom (inspect offset); playing = light tap to toggle chrome.
 */
export function useCanvasInspectGestures({
  hostRef,
  inspect,
  gesturesEnabled,
  playing,
  sheetOpen,
  getEvalCam,
  setInspect,
  onTapWhilePlaying,
}: UseCanvasInspectGesturesArgs): void {
  const inspectRef = useRef<InspectOffset>(inspect);
  const getEvalCamRef = useRef(getEvalCam);
  getEvalCamRef.current = getEvalCam;

  useEffect(() => {
    inspectRef.current = inspect;
  }, [inspect]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let panLast: { x: number; y: number } | null = null;
    let pinch: { startDist: number; baseZoom: number } | null = null;
    let tapCandidate: { t: number; x: number; y: number } | null = null;

    const syncInspect = (fn: (prev: InspectOffset) => InspectOffset) => {
      setInspect(fn);
    };

    const onDown = (e: PointerEvent) => {
      if (sheetOpen) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (playing) {
        if (pointers.size === 1) {
          tapCandidate = { t: performance.now(), x: e.clientX, y: e.clientY };
        }
        return;
      }

      if (!gesturesEnabled) return;

      if (e.pointerType === "touch") {
        e.preventDefault();
      }

      if (pointers.size === 1) {
        panLast = { x: e.clientX, y: e.clientY };
        pinch = null;
      } else if (pointers.size === 2) {
        panLast = null;
        const pts = [...pointers.values()];
        const d = distance(pts[0]!, pts[1]!);
        if (d > 1) {
          pinch = { startDist: d, baseZoom: inspectRef.current.zoom };
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      if (sheetOpen || playing || !gesturesEnabled) return;
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2 && pinch) {
        const pts = [...pointers.values()];
        const d = distance(pts[0]!, pts[1]!);
        if (d > 1) {
          const z = pinch.baseZoom * (pinch.startDist / d);
          const clamped = Math.min(8, Math.max(0.25, z));
          syncInspect((prev) => ({ ...prev, zoom: clamped }));
        }
        return;
      }

      if (pointers.size === 1 && panLast) {
        const cam = getEvalCamRef.current();
        const rect = el.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (!cam || w < 8 || h < 8) return;

        const aspect = w / h;
        const halfH = cam.halfWidth / aspect;
        const dx = e.clientX - panLast.x;
        const dy = e.clientY - panLast.y;
        panLast = { x: e.clientX, y: e.clientY };

        const worldPerPxX = (2 * cam.halfWidth) / w;
        const worldPerPxY = (2 * halfH) / h;
        const dPanX = -dx * worldPerPxX;
        const dPanY = -dy * worldPerPxY;
        syncInspect((prev) => ({
          ...prev,
          panX: prev.panX + dPanX,
          panY: prev.panY + dPanY,
        }));
      }
    };

    const onUp = (e: PointerEvent) => {
      const doTap =
        playing && tapCandidate && pointers.size === 1 && pointers.has(e.pointerId);
      let tapOk = false;
      if (doTap && tapCandidate) {
        const dt = performance.now() - tapCandidate.t;
        const dx = e.clientX - tapCandidate.x;
        const dy = e.clientY - tapCandidate.y;
        const moved = Math.hypot(dx, dy);
        tapOk = dt < 450 && moved < 14;
      }
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        pinch = null;
      }
      if (pointers.size === 0) {
        panLast = null;
      } else if (pointers.size === 1 && !playing && gesturesEnabled) {
        const rem = [...pointers.entries()][0];
        if (rem) {
          panLast = { x: rem[1].x, y: rem[1].y };
        }
      }

      if (tapOk) {
        onTapWhilePlaying();
      }
      tapCandidate = null;
    };

    const onCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      tapCandidate = null;
      if (pointers.size === 0) {
        panLast = null;
        pinch = null;
      } else if (pointers.size === 1 && !playing && gesturesEnabled) {
        const rem = [...pointers.entries()][0];
        if (rem) panLast = { x: rem[1].x, y: rem[1].y };
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
    };
  }, [gesturesEnabled, playing, sheetOpen, hostRef, setInspect, onTapWhilePlaying]);
}
