import { useCallback, useEffect, useRef, useState, type ReactNode, type ReactElement } from "react";
import katex from "katex";
import { useStore } from "./store";
import { Plot2DWebGL } from "./render/webgl2/Plot2DWebGL";
import { evaluateAtTime } from "./engine/evaluateProject";
import type { Polyline2D } from "./core/math/samplePlot";
import { exportProjectVideo } from "./export/webCodecsVideo";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const glRef = useRef<Plot2DWebGL | null>(null);
  const cache = useRef(new Map<string, { hash: string; poly: Polyline2D }>());
  const [expr, setExpr] = useState("sin(x) * exp(-0.15 * x)");
  const [exporting, setExporting] = useState(false);
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

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
    gl.resizeCssPixels(w, h, dpr);
  }, [dpr]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (hostRef.current) ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [resize]);

  const renderFrame = useCallback(
    (time: number) => {
      const gl = glRef.current;
      if (!gl) return;
      const st = evaluateAtTime(project, time, cache.current);
      gl.render(st);
    },
    [project],
  );

  useEffect(() => {
    renderFrame(t);
  }, [t, renderFrame]);

  const startRef = useRef(0);
  useAnimationLoop(playing, startRef.current, project.timeline.duration, setT, () => {
    setPlaying(false);
  });

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const host = hostRef.current;
      const w = host?.clientWidth ?? 1280;
      const h = host?.clientHeight ?? 720;
      const { blob, mime } = await exportProjectVideo(project, { width: w, height: h, dpr, fps: project.timeline.fps });
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
  }, [dpr, project]);

  return (
    <div className="app">
      <div className="toolbar">
        <span className="title">{project.meta.title}</span>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (playing) {
              setPlaying(false);
            } else {
              startRef.current = t;
              setPlaying(true);
            }
          }}
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
          onChange={(e) => {
            setT(Number(e.target.value));
            setPlaying(false);
          }}
        />
        <span className="timeLabel">
          {t.toFixed(2)}s / {project.timeline.duration.toFixed(1)}s
        </span>
        <button type="button" className="btn" onClick={onExport} disabled={exporting || playing}>
          {exporting ? "Exporting…" : "Export video"}
        </button>
        <span className="timeLabel">{project.timeline.fps} fps</span>
      </div>
      <div className="body">
        <aside className="sidebar">
          <h2>Expression</h2>
          <div className="field">
            <label htmlFor="expr">f(x) — mathjs syntax</label>
            <textarea
              id="expr"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              spellCheck={false}
            />
            <div className="hint">Apply updates the function plot. “Story” reapplies director shots + timeline.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setExpression(expr);
                }}
              >
                Apply
              </button>
              <button type="button" className="btn" onClick={applyStoryboard}>
                Reset story
              </button>
            </div>
          </div>
        </aside>
        <div className="stageWrap">
          <div className="canvasHost" ref={hostRef}>
            <canvas ref={canvasRef} />
            <EquationOverlays project={project} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EquationOverlays({ project }: { project: import("./core/ir").ProjectFileV1 }): ReactElement {
  const t = useStore((s) => s.t);
  const cache = useRef(new Map<string, { hash: string; poly: Polyline2D }>());
  const st = evaluateAtTime(project, t, cache.current);
  const out: ReactNode[] = [];
  for (const n of project.scene) {
    if (n.type !== "equation") continue;
    const r = st.equations[n.id];
    if (!r) continue;
    const left = 50 + r.position.x * 42;
    const top = 50 - r.position.y * 42;
    let html = "";
    try {
      html = katex.renderToString(r.latex, { displayMode: true, throwOnError: false });
    } catch {
      html = r.latex;
    }
    out.push(
      <div
        key={n.id}
        className="katexItem"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          opacity: r.opacity,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />,
    );
  }
  return <div className="katexHost">{out}</div>;
}
