/**
 * Extrude a 2D polyline to triangles (miter-approx: per-segment quads in normal direction).
 * Returns interleaved [x0,y0, x1,y1, x2,y2, ...] for gl.TRIANGLES
 */
export function extrudeLineToTriangles(points: Float32Array, lineWidth: number): Float32Array {
  const n = points.length / 2;
  if (n < 2) return new Float32Array(0);
  const out: number[] = [];
  const half = lineWidth * 0.5;
  for (let i = 0; i < n - 1; i++) {
    const p0x = points[i * 2]!;
    const p0y = points[i * 2 + 1]!;
    const p1x = points[(i + 1) * 2]!;
    const p1y = points[(i + 1) * 2 + 1]!;
    const dx = p1x - p0x;
    const dy = p1y - p0y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const oax = nx * half;
    const oay = ny * half;
    // quad: p0-o, p0+o, p1+o, p1-o
    out.push(
      p0x - oax, p0y - oay,
      p0x + oax, p0y + oay,
      p1x + oax, p1y + oay,
      p0x - oax, p0y - oay,
      p1x + oax, p1y + oay,
      p1x - oax, p1y - oay,
    );
  }
  return new Float32Array(out);
}
