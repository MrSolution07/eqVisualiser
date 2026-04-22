# Contributing

## Prerequisites

- **Node.js** >= 20 (see `package.json` `engines`).
- npm (lockfile: `package-lock.json`).

## Commands

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Dev server with HMR |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm test` | Vitest (unit tests) |
| `npm run build` | Production build |

CI runs: `typecheck`, `lint`, `format:check`, `test`, `build` (see `.github/workflows/ci.yml`).

## Code style

- **Formatting:** Prettier is authoritative; run `npm run format` before pushing.
- **Linting:** Fix ESLint issues; avoid disabling rules unless justified in a short comment.
- **TypeScript:** Strict mode is on; prefer explicit types at module boundaries.

## Comments and documentation

- Prefer **why** over **what** when the code is not self-explanatory.
- **JSDoc** on exported functions and non-obvious modules (especially math, engine, WebGL).
- If behavior or supported expression forms change, update:
  - [`README.md`](README.md) user-facing notes, and
  - any relevant file under [`docs/`](docs/) so investigation notes stay **aligned with current behavior** (no stale “not implemented” claims).

## Tests

- Add or extend **colocated** `*.test.ts` next to the code for logic changes (engine, math, render utilities).
- Run `npm test` locally; keep new code covered when it affects correctness or regression-prone paths.

## Pull requests

- Keep changes focused; note any **intentional** behavior or export-output changes in the PR description.
- Ensure `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` pass before merge.
