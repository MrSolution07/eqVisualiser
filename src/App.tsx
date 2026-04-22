import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useStore } from "./store";
import { Plot2DWebGL } from "./render/webgl2/Plot2DWebGL";
import { evaluateAtTime } from "./engine/evaluateProject";
import type { Polyline2D } from "./core/math/samplePlot";
import { exportProjectVideo } from "./export/webCodecsVideo";
import { EquationEditor } from "./ui/EquationEditor";
import { EquationSheet } from "./ui/EquationSheet";
import { MobileChrome } from "./ui/MobileChrome";
import { mergeInspectIntoRenderState, resetInspect, type InspectOffset } from "./ui/mergeInspectCamera";
import { useCanvasInspectGestures } from "./ui/useCanvasInspectGestures";
import { useCoarsePointer } from "./ui/useCoarsePointer";
import { useIsMobileLayout } from "./ui/useIsMobileLayout";
import { usePrefersReducedMotion } from "./ui/usePrefersReducedMotion";
import { getExprFromProject } from "./ui/projectExpr";
import "./App.css";

function useAnimationLoop(
  playing: boolean,
  startT: number,
  duration: number,
  onTick: (t: number) => void,
  onEnd: () => void,
): void {
  const onTickRef = useRef(onTick);
  const onEndRef = useRef(onEnd);
  onTickRef.current = onTick;
  onEndRef.current = onEnd;
  useEffect(() => {
    if (!playing) return;
    const startT0 = startT;
    let raf = 0;
    let t0: number | null = null;
    const loop = (now: number) => {
      if (t0 === null) t0 = now;
      const elapsed = (now - t0) / 1000;
      const time = Math.min(startT0 + elapsed, duration);
      onTickRef.current(time);
      if (time < duration) {
        raf = requestAnimationFrame(loop);
      } else {
        onEndRef.current();
      }
    };
    t0 = null;
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, startT, duration]);
}

export function App(): ReactElement {
  const project = useStore((s) => s.project);
  const t = useStore((s) => s.t);
  const playing = useStore((s) => s.playing);
  const setT = useStore((s) => s.setT);
  const setPlaying = useStore((s) => s.setPlaying);
  const setExpression = useStore((s) => s.setExpression);
  const applyStoryboard = useStore((s) => s.applyStoryboard);
  const expressionError = useStore((s) => s.expressionError);

  const isMobile = useIsMobileLayout();
  const reducedMotion = usePrefersReducedMotion();
  const coarsePointer = useCoarsePointer();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const glRef = useRef<Plot2DWebGL | null>(null);
  const cache = useRef(new Map<string, { hash: string; poly: Polyline2D }>());

  const [expr, setExpr] = useState(() => getExprFromProject(useStore.getState().project));
  const [exporting, setExporting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [inspect, setInspect] = useState<InspectOffset>(() => resetInspect());

  const exportDpr = useMemo(
    () => (typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1),
    [],
  );
  const playDpr = isMobile && coarsePointer && playing ? 1 : exportDpr;

  const lastPlotExprRef = useRef(getExprFromProject(project));
  useEffect(() => {
    const next = getExprFromProject(project);
    if (next !== lastPlotExprRef.current) {
      lastPlotExprRef.current = next;
      setExpr(next);
    }
  }, [project]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const gl = new Plot2DWebGL(c);
    glRef.current = gl;
    return () => {
      glRef.current = null;
    };
  }, []);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    const gl = glRef.current;
    const host = hostRef.current;
    if (!c || !gl || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    gl.resizeCssPixels(w, h, playDpr);
  }, [playDpr]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (hostRef.current) ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [resize]);

  const getEvalCam = useCallback(
    () => evaluateAtTime(project, t, cache.current).cameras["main-cam"],
    [project, t],
  );

  const onTapWhilePlaying = useCallback(() => {
    setChromeVisible((v) => !v);
  }, []);

  useCanvasInspectGestures({
    hostRef,
    inspect,
    gesturesEnabled: !playing && !sheetOpen,
    playing,
    sheetOpen,
    getEvalCam,
    setInspect,
    onTapWhilePlaying,
  });

  const renderFrame = useCallback(
    (time: number) => {
      const gl = glRef.current;
      if (!gl) return;
      let st = evaluateAtTime(project, time, cache.current);
      st = mergeInspectIntoRenderState(st, inspect);
      gl.render(st);
    },
    [project, inspect],
  );

  useEffect(() => {
    renderFrame(t);
  }, [t, renderFrame]);

  const startRef = useRef(0);
  useAnimationLoop(playing, startRef.current, project.timeline.duration, setT, () => {
    setPlaying(false);
  });

  useEffect(() => {
    if (!isMobile || !playing || reducedMotion) {
      setChromeVisible(true);
      return;
    }
    setChromeVisible(true);
    const id = window.setTimeout(() => setChromeVisible(false), 2600);
    return () => clearTimeout(id);
  }, [isMobile, playing, reducedMotion, t]);

  useEffect(() => {
    if (!chromeVisible) setMenuOpen(false);
  }, [chromeVisible]);

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const host = hostRef.current;
      const w = host?.clientWidth ?? 1280;
      const h = host?.clientHeight ?? 720;
      const { blob, mime } = await exportProjectVideo(project, {
        width: w,
        height: h,
        dpr: exportDpr,
        fps: project.timeline.fps,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eq-visualiser-export.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [exportDpr, project]);

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
    } else {
      setInspect(resetInspect());
      startRef.current = t;
      setPlaying(true);
    }
  }, [playing, setPlaying, t]);

  const onRestart = useCallback(() => {
    setInspect(resetInspect());
    setT(0);
    setPlaying(false);
  }, [setT, setPlaying]);

  const onScrub = useCallback(
    (next: number) => {
      setT(next);
      setPlaying(false);
    },
    [setT, setPlaying],
  );

  const applyExpr = useCallback(() => {
    setExpression(expr);
  }, [expr, setExpression]);

  const gestureTouchAction = !playing && !sheetOpen;

  return (
    <div className="app">
      {!isMobile ? (
        <div className="toolbar toolbar--desktop">
          <span className="title">{project.meta.title}</span>
          <button
            type="button"
            className="btn"
            onClick={togglePlay}
            disabled={exporting}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            className="scribe"
            type="range"
            min={0}
            max={project.timeline.duration}
            step={0.01}
            value={t}
            onChange={(e) => onScrub(Number(e.target.value))}
          />
          <span className="timeLabel">
            {t.toFixed(2)}s / {project.timeline.duration.toFixed(1)}s
          </span>
          <button type="button" className="btn" onClick={onExport} disabled={exporting || playing}>
            {exporting ? "Exporting…" : "Export video"}
          </button>
          <span className="timeLabel">{project.timeline.fps} fps</span>
        </div>
      ) : null}

      <div className="body">
        {!isMobile ? (
          <aside className="sidebar">
            <EquationEditor
              project={project}
              expr={expr}
              setExpr={setExpr}
              committedError={expressionError}
              onApply={applyExpr}
              onResetStory={applyStoryboard}
              textareaId="expr"
              variant="sidebar"
            />
          </aside>
        ) : null}

        <div className="stageWrap">
          {isMobile ? (
            <MobileChrome
              visible={chromeVisible}
              title={project.meta.title}
              t={t}
              duration={project.timeline.duration}
              fps={project.timeline.fps}
              playing={playing}
              exporting={exporting}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              onScrub={onScrub}
              onPlayPause={togglePlay}
              onRestart={onRestart}
              onOpenEquation={() => setSheetOpen(true)}
              onExport={onExport}
              onResetStory={applyStoryboard}
            />
          ) : null}

          <div
            className={`canvasHost${gestureTouchAction ? " canvasHost--gesture" : ""}`}
            ref={hostRef}
          >
            <canvas ref={canvasRef} />
          </div>

          {isMobile ? (
            <EquationSheet
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              project={project}
              expr={expr}
              setExpr={setExpr}
              committedError={expressionError}
              onApply={applyExpr}
              onResetStory={applyStoryboard}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
