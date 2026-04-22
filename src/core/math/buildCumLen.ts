/**
 * Cumulative Euclidean length along a 2D polyline stored as [x0,y0,x1,y1,...].
 */
export function buildCumLen(points: Float32Array): { cumLen: Float32Array; totalLen: number } {
  const n = points.length / 2;
  const cumLen = new Float32Array(n);
  let acc = 0;
  cumLen[0] = 0;
  for (let i = 1; i < n; i++) {
    const dx = points[i * 2]! - points[(i - 1) * 2]!;
    const dy = points[i * 2 + 1]! - points[(i - 1) * 2 + 1]!;
    acc += Math.hypot(dx, dy);
    cumLen[i] = acc;
  }
  return { cumLen, totalLen: acc };
}
