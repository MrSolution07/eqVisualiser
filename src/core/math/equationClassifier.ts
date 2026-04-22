import type { FunctionPlotDef, ImplicitPlotDef, PlotDefinition } from "../ir";
import { compileFunctionPlot, compileImplicitPlot, tryCompileScalarToNumber } from "./compileExpr";
import { normalizeFunctionPlotExpression, normalizeLatexSurface } from "./normalizeExpression";

const DEFAULT_FN: Pick<FunctionPlotDef, "xMin" | "xMax" | "samples"> = {
  xMin: -4,
  xMax: 7,
  samples: 512,
};

const DEFAULT_Y: Pick<ImplicitPlotDef, "yMin" | "yMax"> = {
  yMin: -6,
  yMax: 6,
};

function tryCompileFunctionExpression(expression: string): boolean {
  try {
    compileFunctionPlot({
      kind: "function",
      expression,
      xMin: -1,
      xMax: 1,
      samples: 16,
    });
    return true;
  } catch {
    return false;
  }
}

function tryImplicitF(expression: string): boolean {
  try {
    compileImplicitPlot(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * `=` at parenthesis depth 0, not part of `<=`, `>=`, or `==`.
 * Multiple such `=` — error (v1: ambiguous).
 */
export function splitTopLevelEqual(s: string): { left: string; right: string } | null {
  let depth = 0;
  const splitAt: number[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === ")") {
      depth--;
      i++;
      continue;
    }
    if (depth !== 0) {
      i++;
      continue;
    }
    if (c === "<" && s[i + 1] === "=") {
      i += 2;
      continue;
    }
    if (c === ">" && s[i + 1] === "=") {
      i += 2;
      continue;
    }
    if (c === "=" && s[i + 1] === "=") {
      i += 2;
      continue;
    }
    if (c === "=") {
      if (i > 0 && s[i - 1]! === "<") {
        i++;
        continue;
      }
      if (i > 0 && s[i - 1]! === ">") {
        i++;
        continue;
      }
      if (i > 0 && s[i - 1]! === "=") {
        i++;
        continue;
      }
      splitAt.push(i);
    }
    i++;
  }
  if (splitAt.length === 0) return null;
  if (splitAt.length > 1) {
    throw new Error("Multiple top-level '=' in equation (ambiguous)");
  }
  const j = splitAt[0]!;
  const left = s.slice(0, j).trim();
  const right = s.slice(j + 1).trim();
  if (!left || !right) {
    throw new Error("Empty side of equation");
  }
  return { left, right };
}

function carryBounds(base: PlotDefinition): {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: number;
} {
  if (base.kind === "function") {
    return {
      xMin: base.xMin,
      xMax: base.xMax,
      yMin: DEFAULT_Y.yMin,
      yMax: DEFAULT_Y.yMax,
      samples: base.samples,
    };
  }
  if (base.kind === "implicit") {
    return {
      xMin: base.xMin,
      xMax: base.xMax,
      yMin: base.yMin,
      yMax: base.yMax,
      samples: base.samples,
    };
  }
  return {
    xMin: DEFAULT_FN.xMin,
    xMax: DEFAULT_FN.xMax,
    yMin: DEFAULT_Y.yMin,
    yMax: DEFAULT_Y.yMax,
    samples: base.samples,
  };
}

/**
 * Classify a single user string into a plot definition (function, implicit, or constant function).
 * Fixed precedence: (1) leading `y =` and compile as f(x), (2) top-level `=` → F = left−right, (3) F(x) or F(x,y) without =, (4) constant → y = c.
 * @param input — raw user text
 * @param base — previous plot to preserve x/y windows and sample budget when kind changes
 */
export function plotDefinitionFromUserInput(
  input: string,
  base: PlotDefinition,
): FunctionPlotDef | ImplicitPlotDef {
  const b = carryBounds(base);
  const s0 = normalizeLatexSurface(input);

  const leadingY = /^\s*y\s*=\s*(.+)$/is;
  const mY = leadingY.exec(s0);
  if (mY) {
    const rhs = mY[1]!.trim();
    if (tryCompileFunctionExpression(rhs)) {
      return { kind: "function", expression: rhs, xMin: b.xMin, xMax: b.xMax, samples: b.samples };
    }
  }

  let split: { left: string; right: string } | null = null;
  try {
    split = splitTopLevelEqual(s0);
  } catch {
    split = null;
  }
  if (split) {
    const fExpr = `(${split.left})-(${split.right})`;
    if (tryImplicitF(fExpr)) {
      return {
        kind: "implicit",
        expression: fExpr,
        xMin: b.xMin,
        xMax: b.xMax,
        yMin: b.yMin,
        yMax: b.yMax,
        samples: b.samples,
      };
    }
  }

  const scalarS0 = tryCompileScalarToNumber(s0);
  if (scalarS0 != null) {
    return {
      kind: "function",
      expression: String(scalarS0),
      xMin: b.xMin,
      xMax: b.xMax,
      samples: b.samples,
    };
  }

  const s1 = normalizeFunctionPlotExpression(input);
  const scalarS1 = tryCompileScalarToNumber(s1);
  if (scalarS1 != null) {
    return {
      kind: "function",
      expression: String(scalarS1),
      xMin: b.xMin,
      xMax: b.xMax,
      samples: b.samples,
    };
  }

  if (tryCompileFunctionExpression(s1)) {
    return { kind: "function", expression: s1, xMin: b.xMin, xMax: b.xMax, samples: b.samples };
  }

  if (tryImplicitF(s0)) {
    return {
      kind: "implicit",
      expression: s0,
      xMin: b.xMin,
      xMax: b.xMax,
      yMin: b.yMin,
      yMax: b.yMax,
      samples: b.samples,
    };
  }
  if (s1 !== s0 && tryImplicitF(s1)) {
    return {
      kind: "implicit",
      expression: s1,
      xMin: b.xMin,
      xMax: b.xMax,
      yMin: b.yMin,
      yMax: b.yMax,
      samples: b.samples,
    };
  }

  // Fallback: keep as function so the UI can show a concrete compile error; prefer normalized explicit form
  return { kind: "function", expression: s1, xMin: b.xMin, xMax: b.xMax, samples: b.samples };
}
