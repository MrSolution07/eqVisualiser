import type { ProjectFileV1, SceneNode } from "../core/ir";

export function getExprFromProject(project: ProjectFileV1): string {
  const n = project.scene.find((x): x is Extract<SceneNode, { type: "plot2d" }> => x.type === "plot2d");
  if (!n) return "sin(x)";
  const p = n.plot;
  if (p.kind === "function") return p.expression;
  if (p.kind === "implicit") return p.expression;
  if (p.kind === "parametric") return `${p.xExpression}; ${p.yExpression}`;
  return "sin(x)";
}
