/**
 * Maps compiler/classifier messages to short, non-technical copy.
 */
export function friendlyExprError(technical: string): string {
  const t = technical.trim();
  if (/Unknown symbol:/i.test(t)) {
    return "That symbol isn’t available here. Use supported math (see the keypad) or * for multiplication.";
  }
  if (/Function not allowed:/i.test(t)) {
    return "That function isn’t supported in this version. Try a different built-in (sin, cos, sqrt, …).";
  }
  if (/Multiple top-level '='/i.test(t)) {
    return "Use only one equals at the top level (e.g. y = … or x^2 + y^2 = 25).";
  }
  if (/Empty side of equation/i.test(t)) {
    return "Both sides of the equation need a value.";
  }
  if (/Unsupported expression:/i.test(t)) {
    return "That kind of expression isn’t supported. Stick to a single formula.";
  }
  if (/Unexpected part/i.test(t) || /SyntaxError/i.test(t) || /char/i.test(t)) {
    return "The formula doesn’t parse yet. Check parentheses, operators, and use * where needed.";
  }
  if (/implicit|implicitly/i.test(t) && /variable/i.test(t)) {
    return "Check that x and y are used the way this plot type expects.";
  }
  return "Something’s off with the formula. Try simplifying or fixing the syntax.";
}
