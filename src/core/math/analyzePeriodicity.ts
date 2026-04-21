/**
 * Heuristic periodicity for function plots (mathjs expression in x).
 * Class A: sin/cos/tan/cot/sec/csc of an argument that is affine in x only.
 * Multiple Class A terms: combine only when pairwise period ratios are nearly rational (commensurate).
 */

import type { MathNode, OperatorNode, FunctionNode, SymbolNode, ParenthesisNode } from "mathjs";
import { math } from "./compileExpr";
import { normalizeFunctionPlotExpression } from "./normalizeExpression";

const TRIG_2PI = new Set(["sin", "cos", "sec", "csc"]);
const TRIG_PI = new Set(["tan", "cot"]);

export type PeriodicAnalysis =
  | { kind: "none" }
  | { kind: "periodic"; period: number }
  | { kind: "unknown" };

interface Affine {
  a: number;
  b: number;
}

function unwrap(n: MathNode): MathNode {
  if (n.type === "ParenthesisNode") {
    return unwrap((n as ParenthesisNode).content);
  }
  return n;
}

function evalConstant(node: MathNode): number | null {
  try {
    const v = node.compile().evaluate({}) as unknown;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  } catch {
    return null;
  }
}

/** Returns a*x+b in x, or null if not affine in x. */
export function parseAffineInX(node: MathNode): Affine | null {
  const n = unwrap(node);
  if (n.type === "SymbolNode") {
    const name = (n as SymbolNode).name;
    if (name === "x" || name === "t") return { a: 1, b: 0 };
    return null;
  }
  if (n.type === "ConstantNode") {
    const c = evalConstant(n);
    if (c === null) return null;
    return { a: 0, b: c };
  }
  if (n.type === "OperatorNode") {
    const op = n as OperatorNode;
    const fn = op.fn;
    if (fn === "unaryMinus") {
      const ch = op.args[0];
      if (!ch) return null;
      const inner = parseAffineInX(ch);
      if (!inner) return null;
      return { a: -inner.a, b: -inner.b };
    }
    if (fn === "add") {
      const L = op.args[0];
      const R = op.args[1];
      if (!L || !R) return null;
      const l = parseAffineInX(L);
      const r = parseAffineInX(R);
      if (!l || !r) return null;
      return { a: l.a + r.a, b: l.b + r.b };
    }
    if (fn === "subtract") {
      const L = op.args[0];
      const R = op.args[1];
      if (!L || !R) return null;
      const l = parseAffineInX(L);
      const r = parseAffineInX(R);
      if (!l || !r) return null;
      return { a: l.a - r.a, b: l.b - r.b };
    }
    if (fn === "multiply") {
      const L = op.args[0];
      const R = op.args[1];
      if (!L || !R) return null;
      const l = parseAffineInX(L);
      const r = parseAffineInX(R);
      if (!l || !r) return null;
      if (l.a !== 0 && r.a !== 0) return null;
      if (l.a === 0 && r.a === 0) return { a: 0, b: l.b * r.b };
      if (l.a === 0) return { a: l.b * r.a, b: l.b * r.b };
      return { a: l.a * r.b, b: l.a * r.b };
    }
    if (fn === "divide") {
      const L = op.args[0];
      const R = op.args[1];
      if (!L || !R) return null;
      const num = parseAffineInX(L);
      const den = parseAffineInX(R);
      if (!num || !den || den.a !== 0) return null;
      if (den.b === 0) return null;
      return { a: num.a / den.b, b: num.b / den.b };
    }
    if (fn === "pow" || fn === "nthRoot") {
      const L = op.args[0];
      const R = op.args[1];
      if (!L || !R) return null;
      const base = parseAffineInX(L);
      const expN = evalConstant(R);
      if (!base) return null;
      if (expN === null) return null;
      if (!Number.isInteger(expN)) return null;
      if (expN === 0) return { a: 0, b: 1 };
      if (expN === 1) return base;
      if (base.a === 0) return { a: 0, b: Math.pow(base.b, expN) };
      return null;
    }
  }
  return null;
}

function trigPeriod(name: string, aff: Affine): number | null {
  if (aff.a === 0) return null;
  const a = Math.abs(aff.a);
  if (TRIG_2PI.has(name)) return (2 * Math.PI) / a;
  if (TRIG_PI.has(name)) return Math.PI / a;
  return null;
}

function getTrigName(n: FunctionNode): string | undefined {
  const fn = n.fn;
  if (fn && fn.type === "SymbolNode") {
    return (fn as SymbolNode).name;
  }
  return undefined;
}

function collectTrigPeriods(node: MathNode, out: number[]): "ok" | "unknown" {
  const u = unwrap(node);
  if (u.type === "FunctionNode") {
    const fn = u as FunctionNode;
    const name = getTrigName(fn);
    if (!name) return "unknown";
    if (!TRIG_2PI.has(name) && !TRIG_PI.has(name)) {
      for (const arg of fn.args) {
        if (collectTrigPeriods(arg, out) === "unknown") return "unknown";
      }
      return "ok";
    }
    const arg0 = fn.args[0];
    if (!arg0) return "unknown";
    const aff = parseAffineInX(arg0);
    if (!aff) return "unknown";
    const p = trigPeriod(name, aff);
    if (p === null || !Number.isFinite(p)) return "unknown";
    out.push(p);
    return "ok";
  }
  if (u.type === "OperatorNode") {
    const op = u as OperatorNode;
    for (const ch of op.args) {
      if (collectTrigPeriods(ch, out) === "unknown") return "unknown";
    }
    return "ok";
  }
  if (u.type === "ParenthesisNode") {
    return collectTrigPeriods((u as ParenthesisNode).content, out);
  }
  return "ok";
}

const PERIOD_INT_EPS = 1e-4;

/** Smallest n such that n*base / p is within eps of an integer for all periods p. */
function fundamentalPeriod(periods: number[]): number | null {
  if (periods.length === 0) return null;
  const base = Math.min(...periods);
  if (!(base > 0) || !Number.isFinite(base)) return null;
  for (let n = 1; n <= 4096; n++) {
    const T = n * base;
    let ok = true;
    for (const p of periods) {
      const q = T / p;
      if (!Number.isFinite(q) || Math.abs(q - Math.round(q)) > PERIOD_INT_EPS) {
        ok = false;
        break;
      }
    }
    if (ok) return T;
  }
  return null;
}

/**
 * Analyze a mathjs expression string y = f(x) for periodicity heuristics.
 */
export function analyzePeriodicity(expression: string): PeriodicAnalysis {
  let root: MathNode;
  try {
    root = math.parse(normalizeFunctionPlotExpression(expression));
  } catch {
    return { kind: "unknown" };
  }
  const periods: number[] = [];
  if (collectTrigPeriods(root, periods) === "unknown") {
    return { kind: "unknown" };
  }
  if (periods.length === 0) {
    return { kind: "none" };
  }
  const fund = fundamentalPeriod(periods);
  if (fund === null) {
    return { kind: "unknown" };
  }
  return { kind: "periodic", period: fund };
}
