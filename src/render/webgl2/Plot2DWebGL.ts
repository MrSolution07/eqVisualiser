import type { RenderStateV1 } from "../../engine/evaluateProject";
import { createProgram } from "./glUtils";
import { lineFS, lineVS, solidFS, solidVS } from "./shaders";
import { extrudeLineToTriangles } from "../lineExtrude";
import { trimPolyline } from "../trimPolyline";
import type { Polyline2D } from "../../core/math/samplePlot";

export class Plot2DWebGL {
  private gl: WebGL2RenderingContext;
  private solid: WebGLProgram;
  private line: WebGLProgram;
  private solidBuffer: WebGLBuffer;
  private lineBuffer: WebGLBuffer;
  private vaoSolid: WebGLVertexArrayObject;
  private vaoLine: WebGLVertexArrayObject;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 required");
    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.solid = createProgram(gl, solidVS, solidFS);
    this.line = createProgram(gl, lineVS, lineFS);
    this.solidBuffer = gl.createBuffer()!;
    this.lineBuffer = gl.createBuffer()!;
    this.vaoSolid = gl.createVertexArray()!;
    this.vaoLine = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoSolid);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(this.vaoLine);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  resizeCssPixels(width: number, height: number, dpr: number): void {
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  render(state: RenderStateV1): void {
    const gl = this.gl;
    const bg = state.style.background;
    const m = /^#?([0-9a-f]{6})$/i.exec(bg);
    if (m) {
      const h = m[1]!;
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      gl.clearColor(r, g, b, 1);
    } else {
      gl.clearColor(0.05, 0.05, 0.06, 1);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    const cam = state.cameras["main-cam"];
    if (!cam) return;
    const aspect = this.canvas.width / this.canvas.height;
    const halfW = cam.halfWidth;
    const halfH = cam.halfWidth / aspect;

    const parseRgba = (
      s: string,
      fallback: [number, number, number, number],
    ): [number, number, number, number] => {
      const rgba = /^rgba?\(([^)]+)\)/i.exec(s);
      if (!rgba) return fallback;
      const parts = rgba[1]!.split(",").map((x) => parseFloat(x.trim()));
      if (parts.length >= 3) {
        const r0 = parts[0] ?? 0;
        const g0 = parts[1] ?? 0;
        const b0 = parts[2] ?? 0;
        const a = parts[3] ?? 1;
        const to01 = (v: number) => (v > 1 ? v / 255 : v);
        return [to01(r0), to01(g0), to01(b0), a];
      }
      return fallback;
    };

    const gridColor = parseRgba(state.style.grid, [0.15, 0.15, 0.18, 0.4]);
    const axisColor = parseRgba(state.style.axis, [0.4, 0.4, 0.45, 0.9]);
    const curveColor = state.style.curve.startsWith("#")
      ? (() => {
          const h = state.style.curve.replace("#", "");
          const v = h.length === 6 ? h : "66eeff";
          return [
            parseInt(v.slice(0, 2), 16) / 255,
            parseInt(v.slice(2, 4), 16) / 255,
            parseInt(v.slice(4, 6), 16) / 255,
            1,
          ] as [number, number, number, number];
        })()
      : parseRgba(state.style.curve, [0.4, 0.9, 1, 1]);

    this.drawGrid(cam.centerX, cam.centerY, halfW, halfH, gridColor, axisColor);
    for (const pid of Object.keys(state.plots)) {
      const plot = state.plots[pid]!;
      if (plot.cameraId !== cam.id) continue;
      const trimmed = trimPolyline(plot.polyline as Polyline2D, plot.draw);
      const wWorld = (plot.lineWidth * (2 * halfW)) / this.canvas.width;
      const tri = extrudeLineToTriangles(trimmed, wWorld);
      if (tri.length < 6) continue;
      this.uploadAndDrawTriangles(tri, cam.centerX, cam.centerY, halfW, halfH, curveColor);
    }
  }

  private drawGrid(
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    grid: [number, number, number, number],
    axis: [number, number, number, number],
  ): void {
    const step = niceStep(halfW);
    const verts: number[] = [];
    const xmin = cx - halfW;
    const xmax = cx + halfW;
    const ymin = cy - halfH;
    const ymax = cy + halfH;
    for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) {
      verts.push(x, ymin, x, ymax);
    }
    for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) {
      verts.push(xmin, y, xmax, y);
    }
    const gline = new Float32Array(verts);
    this.uploadAndDrawLines(gline, cx, cy, halfW, halfH, grid);
    const ax = new Float32Array([xmin, 0, xmax, 0, 0, ymin, 0, ymax]);
    this.uploadAndDrawLines(ax, cx, cy, halfW, halfH, axis);
  }

  private uploadAndDrawLines(
    data: Float32Array,
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    col: [number, number, number, number],
  ): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vaoLine);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const pr = this.line;
    gl.useProgram(pr);
    const uCenter = gl.getUniformLocation(pr, "u_center");
    const uHalf = gl.getUniformLocation(pr, "u_half");
    const uColor = gl.getUniformLocation(pr, "u_color");
    gl.uniform2f(uCenter, cx, cy);
    gl.uniform2f(uHalf, halfW, halfH);
    gl.uniform4f(uColor, col[0], col[1], col[2], col[3]);
    gl.drawArrays(gl.LINES, 0, data.length / 2);
  }

  private uploadAndDrawTriangles(
    data: Float32Array,
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    col: [number, number, number, number],
  ): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vaoSolid);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const pr = this.solid;
    gl.useProgram(pr);
    const uCenter = gl.getUniformLocation(pr, "u_center");
    const uHalf = gl.getUniformLocation(pr, "u_half");
    const uColor = gl.getUniformLocation(pr, "u_color");
    gl.uniform2f(uCenter, cx, cy);
    gl.uniform2f(uHalf, halfW, halfH);
    gl.uniform4f(uColor, col[0], col[1], col[2], col[3]);
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 2);
  }
}

function niceStep(halfW: number): number {
  const raw = (2 * halfW) / 10;
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow10;
  let nf = 1;
  if (f < 1.5) nf = 1;
  else if (f < 3) nf = 2;
  else if (f < 7) nf = 5;
  else nf = 10;
  return nf * pow10;
}
