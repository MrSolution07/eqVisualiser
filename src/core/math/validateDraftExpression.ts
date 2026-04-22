import type { ProjectFileV1 } from "../ir";
import { getPlotCompileError } from "./compileExpr";
import { plotDefinitionFromUserInput } from "./equationClassifier";

/**
 * Validates draft text without mutating project. Uses the same classification + compile path as Apply.
 */
export function validateDraftExpression(project: ProjectFileV1, draft: string): string | null {
  const plotNode = project.scene.find((n) => n.type === "plot2d");
  if (!plotNode || plotNode.type !== "plot2d") return null;
  try {
    const nextPlot = plotDefinitionFromUserInput(draft, plotNode.plot);
    return getPlotCompileError(nextPlot);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
