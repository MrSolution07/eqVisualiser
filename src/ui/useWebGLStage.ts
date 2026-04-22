import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Plot2DWebGL } from "../render/webgl2/Plot2DWebGL";

type WebGLStageRefs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  glRef: RefObject<Plot2DWebGL | null>;
};

/**
 * Owns the canvas element, `Plot2DWebGL` instance, and layout resize for CSS pixel + DPR sizing.
 */
export function useWebGLStage(playDpr: number): WebGLStageRefs {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const glRef = useRef<Plot2DWebGL | null>(null);

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

  return { canvasRef, hostRef, glRef };
}
