import { create, all, type MathNode, type FunctionNode, type SymbolNode } from "mathjs";
import type { ParametricPlotDef, FunctionPlotDef, ProjectFileV1 } from "../ir";
import { normalizeFunctionPlotExpression } from "./normalizeExpression";

const math = create(all);

const CONSTANTS = new Set(["e", "pi", "i", "true", "false", "null", "NaN", "phi", "SQRT1_2", "SQRT2", "Inf", "LN2", "LN10", "LOG2E", "LOG10E", "version"]);

const fnWhitelist = new Set(
  "abs acos acosh asin asinh atan atan2 atanh cbrt ceil cos cosh cot csc sec exp floor log log10 log2 max min mod pow round sign sin sinh sqrt square tan tanh re im arg not bitAnd add subtract multiply divide isNaN isNegative isInteger isZero isPositive isComplex".split(" "),
);

function assertSafeNode(node: MathNode, freeVars: Set<string>): void {
  if (node.type === "BlockNode" || (node as { type: string }).type === "FunctionAssignmentNode") {
    throw new Error("Unsupported expression: assignments or multi-statement blocks");
  }
  node.traverse((n) => {
    if (n.type === "BlockNode" || n.type === "FunctionAssignmentNode") {
      throw new Error("Unsupported expression: assignments or function definitions");
    }
    if (n.type === "FunctionNode") {
      const name = getFunctionName(n as FunctionNode);
      if (name && !fnWhitelist.has(name)) {
        throw new Error(`Function not allowed: ${name}`);
      }
    }
    if (n.type === "SymbolNode") {
      const s = (n as SymbolNode).name;
      if (!s) return;
      if (freeVars.has(s)) return;
      if (fnWhitelist.has(s)) return;
      if (CONSTANTS.has(s) || s === "PI" || s === "E" || s === "Infinity") return;
      if (CONSTANTS.has(s.toLowerCase())) return;
      if (s === "e" || s === "pi") return;
      throw new Error(`Unknown symbol: ${s}`);
    }
    if (n.type === "ConstantNode" || n.type === "AccessNode" || n.type === "IndexNode" || n.type === "ObjectNode" || n.type === "ArrayNode" || n.type === "RangeNode" || n.type === "MatrixNode" || n.type === "ParenthesisNode" || n.type === "ConditionalNode" || n.type === "OperatorNode") {
      // allow
    }
  });
}

function getFunctionName(n: FunctionNode): string | undefined {
  const fn = n.fn;
  if (fn && fn.type === "SymbolNode") {
    return (fn as SymbolNode).name;
  }
  if (fn && (fn as { type: string; name?: string }).name) {
    return (fn as { name: string }).name;
  }
  return undefined;
}

/** Independent variable for function plots: `x` is canonical; `t` is allowed as an alias (many formulas use t). */
const FUNCTION_PLOT_VARS = new Set(["x", "t"]);

export function compileFunctionPlot(def: FunctionPlotDef): { compile: () => (x: number) => number; raw: string } {
  const normalized = normalizeFunctionPlotExpression(def.expression);
  const node = math.parse(normalized);
  assertSafeNode(node, FUNCTION_PLOT_VARS);
  const c = node.compile() as { evaluate: (s: Record<string, number>) => unknown };
  return {
    raw: def.expression,
    compile: () => (x: number) => {
      const v = c.evaluate({ x, t: x });
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (v && typeof v === "object" && "re" in v) {
        const cplx = v as { re: number; im: number };
        if (v && typeof cplx.im === "number" && Math.abs(cplx.im) > 1e-9) {
          return NaN;
        }
        return Number(cplx.re);
      }
      return NaN;
    },
  };
}

/**
 * If the expression cannot be compiled for a function plot, returns a short message; otherwise `null`.
 * Used so the UI can explain the flat y=0 fallback from `sampleFunctionPlotInRange`.
 */
export function getFunctionPlotCompileError(def: FunctionPlotDef): string | null {
  try {
    compileFunctionPlot(def);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
}

export function getFirstFunctionPlotCompileError(project: ProjectFileV1): string | null {
  const node = project.scene.find((s) => s.type === "plot2d" && s.plot.kind === "function");
  if (!node || node.type !== "plot2d" || node.plot.kind !== "function") return null;
  return getFunctionPlotCompileError(node.plot);
}

export function compileParametric(def: ParametricPlotDef): {
  compile: () => (u: number) => { x: number; y: number };
  raw: { x: string; y: string };
} {
  const param = def.param;
  const nx = math.parse(def.xExpression);
  const ny = math.parse(def.yExpression);
  assertSafeNode(nx, new Set([param]));
  assertSafeNode(ny, new Set([param]));
  const cx = nx.compile() as { evaluate: (s: Record<string, number>) => unknown };
  const cy = ny.compile() as { evaluate: (s: Record<string, number>) => unknown };
  return {
    raw: { x: def.xExpression, y: def.yExpression },
    compile: () => (u: number) => {
      const scope = { [param]: u } as Record<string, number>;
      const xv = cx.evaluate(scope);
      const yv = cy.evaluate(scope);
      return {
        x: toNumber(xv),
        y: toNumber(yv),
      };
    },
  };
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "re" in v) return Number((v as { re: number; im: number }).re);
  return NaN;
}

export { math };
