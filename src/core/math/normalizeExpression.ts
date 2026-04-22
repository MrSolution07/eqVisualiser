/**
 * Turn pasted LaTeX-ish / calculator text into mathjs-friendly input for y = f(x).
 * Does not evaluate; only string cleanup so parse() does not throw on common patterns.
 */

const LATEX_CMD: Record<string, string> = {
  cdot: "*",
  cdotp: "*",
  times: "*",
  bullet: "*",
  pi: "pi",
  ln: "log",
  exp: "exp",
  sqrt: "sqrt",
  abs: "abs",
  cos: "cos",
  sin: "sin",
  tan: "tan",
  cot: "cot",
  sec: "sec",
  csc: "csc",
  log: "log",
  left: "",
  right: "",
  quad: " ",
  qquad: " ",
  cdots: " ",
  ldots: " ",
};

function mapLatexCommand(cmd: string): string {
  const key = cmd.toLowerCase();
  if (key in LATEX_CMD) return LATEX_CMD[key]!;
  return key;
}

/** LaTeX / unicode cleanup only (no `y =` strip). Use before top-level `=` split for implicit equations. */
export function normalizeLatexSurface(input: string): string {
  let s = input.trim();
  s = s.replace(/\u00d7/g, "*");
  s = s.replace(/\u22c5|\u00b7/g, "*");
  s = s.replace(/\\cdotp?/g, "*");
  s = s.replace(/\\times/g, "*");
  s = s.replace(/\\pi\b/gi, " pi ");
  s = s.replace(/\\([a-zA-Z]+)/g, (_, cmd: string) => mapLatexCommand(cmd));
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function normalizeFunctionPlotExpression(input: string): string {
  let s = input.trim();
  s = s.replace(/^\s*f\s*\(\s*x\s*\)\s*=\s*/i, "");
  s = s.replace(/^\s*y\s*=\s*/i, "");
  return normalizeLatexSurface(s);
}
