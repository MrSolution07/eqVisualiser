/**
 * App shell: project/time store, WebGL stage + evaluate/render loop, video export, and
 * mobile/desktop layout (equation editor, gestures, mobile chrome).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useStore } from "./store";
import { evaluateAtTime } from "./engine/evaluateProject";
import type { Polyline2D } from "./core/math/samplePlot";
import { EquationEditor } from "./ui/EquationEditor";
import { EquationSheet } from "./ui/EquationSheet";
import { MobileChrome } from "./ui/MobileChrome";
import { DesktopToolbar } from "./ui/DesktopToolbar";
import {
  mergeInspectIntoRenderState,
  resetInspect,
  type InspectOffset,
} from "./ui/mergeInspectCamera";
import { useCanvasInspectGestures } from "./ui/useCanvasInspectGestures";
import { useCoarsePointer } from "./ui/useCoarsePointer";
import { useIsMobileLayout } from "./ui/useIsMobileLayout";
import { usePrefersReducedMotion } from "./ui/usePrefersReducedMotion";
import { getExprFromProject } from "./ui/projectExpr";
import { useAnimationLoop } from "./ui/useAnimationLoop";
import { useWebGLStage } from "./ui/useWebGLStage";
import { useProjectVideoExport } from "./ui/useProjectVideoExport";
import { useMobileChromeAutohide } from "./ui/useMobileChromeAutohide";
import "./App.css";

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

  const exportDpr = useMemo(
    () => (typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1),
    [],
  );
  const playDpr = isMobile && coarsePointer && playing ? 1 : exportDpr;

  const { canvasRef, hostRef, glRef } = useWebGLStage(playDpr);
  const cache = useRef(new Map<string, { hash: string; poly: Polyline2D }>());

  const [expr, setExpr] = useState(() => getExprFromProject(useStore.getState().project));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [inspect, setInspect] = useState<InspectOffset>(() => resetInspect());

  const { exporting, onExport } = useProjectVideoExport(project, hostRef, exportDpr);

  const lastPlotExprRef = useRef(getExprFromProject(project));
  useEffect(() => {
    const next = getExprFromProject(project);
    if (next !== lastPlotExprRef.current) {
      lastPlotExprRef.current = next;
      setExpr(next);
    }
  }, [project]);

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
    [project, inspect, glRef],
  );

  useEffect(() => {
    renderFrame(t);
  }, [t, renderFrame]);

  const startRef = useRef(0);
  useAnimationLoop(playing, startRef.current, project.timeline.duration, setT, () => {
    setPlaying(false);
  });

  useMobileChromeAutohide(
    isMobile,
    playing,
    reducedMotion,
    t,
    chromeVisible,
    setChromeVisible,
    setMenuOpen,
  );

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
        <DesktopToolbar
          title={project.meta.title}
          t={t}
          duration={project.timeline.duration}
          fps={project.timeline.fps}
          playing={playing}
          exporting={exporting}
          onPlayPause={togglePlay}
          onScrub={onScrub}
          onExport={onExport}
        />
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
