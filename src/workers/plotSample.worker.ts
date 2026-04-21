import { samplePlot } from "../core/math/samplePlot";
import type { PlotDefinition } from "../core/ir";

export type PlotSampleIn = { plot: PlotDefinition; id: string };
export type PlotSampleOut = {
  id: string;
  points: ArrayBuffer;
  cumLen: ArrayBuffer;
  totalLen: number;
  hash: string;
};

self.onmessage = (ev: MessageEvent<PlotSampleIn>) => {
  const { plot, id } = ev.data;
  const p = samplePlot(plot);
  const out: PlotSampleOut = {
    id,
    points: p.points.buffer,
    cumLen: p.cumLen.buffer,
    totalLen: p.totalLen,
    hash: JSON.stringify(plot),
  };
  self.postMessage(out, [out.points, out.cumLen]);
};

export {};
