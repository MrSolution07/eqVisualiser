import { create } from "zustand";
import { createDefaultProject } from "./core/schema";
import type { ProjectFileV1 } from "./core/ir";
import { getFirstPlotCompileError } from "./core/math/compileExpr";
import { plotDefinitionFromUserInput } from "./core/math/equationClassifier";
import { defaultStoryboard } from "./director/shots";

type Store = {
  project: ProjectFileV1;
  t: number;
  playing: boolean;
  expressionError: string | null;
  setT: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setExpression: (expr: string) => void;
  applyStoryboard: () => void;
};

const initial = createDefaultProject();

export const useStore = create<Store>((set) => ({
  project: initial,
  t: 0,
  playing: false,
  expressionError: getFirstPlotCompileError(initial),
  setT: (t) => set({ t }),
  setPlaying: (playing) => set({ playing }),
  setExpression: (expression) => {
    set((s) => {
      const scene = s.project.scene.map((n) => {
        if (n.type !== "plot2d") return n;
        const plot = plotDefinitionFromUserInput(expression, n.plot);
        return {
          ...n,
          plot,
        };
      });
      const project = { ...s.project, scene };
      return {
        project,
        expressionError: getFirstPlotCompileError(project),
      };
    });
  },
  applyStoryboard: () => {
    set((s) => {
      const project = defaultStoryboard(s.project);
      return { project, expressionError: getFirstPlotCompileError(project) };
    });
  },
}));
