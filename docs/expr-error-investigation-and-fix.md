# Investigation: `x^2 + y^2 = 25` → flat line on the x-axis

## Error identified (not a draw bug)

The line along the **x-axis** is the **intentional fallback** in [`src/core/math/samplePlot.ts`](src/core/math/samplePlot.ts): on compile failure, `sampleFunctionPlotInRange` returns `fallbackPolyline(xMin, xMax)` — two points at **y = 0**. The UI shows no message, so it reads as a render bug.

## Root causes

| Input | What happens |
|-------|----------------|
| `x^2 + y^2 = 25` | `math.parse` **throws** (mathjs: `=` is assignment; invalid in this form). Caught; fallback line. |
| `x^2 + y^2 - 25` (or any `y`) | Parse succeeds, but [`assertSafeNode`](src/core/math/compileExpr.ts) allows only `x` and `t` as free variables. **`y` → "Unknown symbol: y"**; caught; same fallback. |

The app is **y = f(x)** only. Implicit curves `F(x,y)=0` are **not** implemented.

## Fix (implemented in codebase)

1. **Export a validator** in [`src/core/math/compileExpr.ts`](src/core/math/compileExpr.ts):

   - `getFunctionPlotCompileError(def: FunctionPlotDef): string | null` — `try { compileFunctionPlot(def); return null } catch (e) { return e instanceof Error ? e.message : String(e) }`

2. **Zustand store** [`src/store.ts`](src/store.ts):

   - Add `expressionError: string | null` to the store type and initial state.
   - In `setExpression`, after building the new scene, resolve the `function` plot node and set `expressionError: getFunctionPlotCompileError({ kind: "function", expression, ...plot })`.
   - In `applyStoryboard`, after `defaultStoryboard(s.project)`, recompute `expressionError` from the function plot in the new project.
   - Initial state: set `expressionError` from the default function plot, or `null` if the demo expression always compiles.

3. **UI** [`src/App.tsx`](src/App.tsx):

   - `const expressionError = useStore(s => s.expressionError)`.
   - Below the textarea, if `expressionError`, render a dedicated element (e.g. `<p className="exprError" role="alert">` with the text). Short hint: *Function plots are y in terms of x only. For a circle, use* `sqrt(25-x^2)` *on |x|≤5, or a parametric plot in the scene.*

4. **Styles** [`src/App.css`](src/App.css): `.exprError` — readable contrast (e.g. error/signal color, small type).

5. **Tests** [`src/core/math/compileExpr.test.ts`](src/core/math/compileExpr.test.ts): `getFunctionPlotCompileError` returns a non-empty string for `x^2 + y^2 = 25` and for a string with `y`; `null` for `sin(x)`.

**Status:** Items 1–5 are implemented (`getFunctionPlotCompileError`, `getFirstFunctionPlotCompileError`, Zustand `expressionError`, App alert + `.exprError` styles, tests).

## Plan review (enhancements to the original investigation)

- The original conclusion (“fallback polyline at y=0”) is **correct and complete** for the symptom.
- **Product gap:** silent failure; the fix is **user-visible error state**, not changing the math model.
- **Out of scope for this fix:** parametric/implicit plot UI; optional future work.
- **README:** one sentence under “Expression” is optional; avoid duplicating this doc in full in README if the in-app error is clear.

## Verification

- Apply `x^2 + y^2 = 25` → error text visible, optional: still see fallback on canvas (or clear canvas) — spec above keeps current render; only adds messaging.
- Apply `sqrt(25 - x^2)` with valid domain → `expressionError` is `null`, curve normal.
