# Example equations with “infinite” progression

Functions where behavior is naturally **unbounded**, **repeats forever**, or **never settles** in a finite sense. Use as `f(x)` in mathjs-style expressions (as in this project’s plotter).

## Endless oscillation (periodic — repeats forever)

- `sin(x)`
- `cos(x)`
- `tan(x)` — vertical asymptotes repeat forever
- `sin(1/x)` — oscillates infinitely often as x \to 0^+
- `x * sin(x)` — amplitude grows without bound as |x| \to \infty

## Unbounded growth / decay along the axis

- `exp(x)`
- `exp(-x)`
- `x^2`, `x^3`
- `sqrt(abs(x))`
- `log(x)` on (0, \infty); `log(abs(x))` (careful near 0)

## Asymptotic / “limit at infinity” behavior

- `1/x`
- `1/(x^2+1)` — tail continues forever, horizontal asymptote
- `atan(x)` — approaches \pm\pi/2 as x \to \pm\infty
- `x / (1 + abs(x))` — approaches \pm1

## Infinitely many features (faster/denser structure)

- `sin(x^2)` — oscillation frequency increases without bound as |x| grows
- `x * sin(x^2)` — same idea with growing envelope

## Note for plotting

On any **finite** `[xMin, xMax]` the curve is clipped. For a _feeling_ of infinity, use a **wide x-range** with `sin` / `cos` / `tan` or `x*sin(x)` so motion keeps going when you zoom or pan.

## Quick “demo” subset

Short list that tends to look good in cinematic plots:

- `sin(x) * exp(-0.15 * x)` (default in this project — damped oscillation)
- `sin(x)`
- `x * sin(x)`
- `sin(x^2)`
- `1/(1 + x^2)`
- `exp(-x) * sin(3*x)`
- (x^2 + y^2)^2 = 50\*(x^2 - y^2)
