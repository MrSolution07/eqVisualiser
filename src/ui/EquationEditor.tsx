import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { validateDraftExpression } from "../core/math/validateDraftExpression";
import type { ProjectFileV1 } from "../core/ir";
import { friendlyExprError } from "./friendlyExprError";
import { MathTokenBar } from "./MathTokenBar";

const RECENT_KEY = "eqv-recent-expressions";
const RECENT_MAX = 5;

const SUGGESTIONS = ["sin(x)", "cos(x)", "x^2", "pi", "x^2 + y^2 = 25"];

function loadRecent(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(expr: string): void {
  const t = expr.trim();
  if (!t) return;
  try {
    const prev = loadRecent().filter((x) => x !== t);
    const next = [t, ...prev].slice(0, RECENT_MAX);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export type EquationEditorProps = {
  project: ProjectFileV1;
  expr: string;
  setExpr: (v: string) => void;
  committedError: string | null;
  onApply: () => void;
  onResetStory: () => void;
  textareaId: string;
  /** When false, hide Reset story (e.g. mobile menu duplicate). */
  showResetStory?: boolean;
  variant?: "sidebar" | "sheet";
};

export function EquationEditor({
  project,
  expr,
  setExpr,
  committedError,
  onApply,
  onResetStory,
  textareaId,
  showResetStory = true,
  variant = "sidebar",
}: EquationEditorProps): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draftTechnicalError, setDraftTechnicalError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());

  const runValidation = useCallback(
    (draft: string) => {
      const err = validateDraftExpression(project, draft);
      setDraftTechnicalError(err);
    },
    [project],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runValidation(expr), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [expr, runValidation]);

  const draftFriendly = draftTechnicalError ? friendlyExprError(draftTechnicalError) : null;
  const showCommitted = committedError && !draftTechnicalError;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    pushRecent(expr);
    setRecent(loadRecent());
    onApply();
  };

  return (
    <div className={`equationEditor equationEditor--${variant}`}>
      <h2 className="equationEditor__title">Expression</h2>
      <form className="field" onSubmit={onSubmit}>
        <label htmlFor={textareaId}>Formula (mathjs syntax: explicit y = f(x), implicit with =, or constants)</label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="done"
        />
        <MathTokenBar textareaRef={textareaRef} onChange={setExpr} />
        {draftFriendly ? (
          <p className="exprError" role="alert">
            {draftFriendly}
          </p>
        ) : null}
        {showCommitted ? (
          <p className="exprError" role="alert">
            {friendlyExprError(committedError)}
            <span className="exprErrorHint">
              {" "}
              For a circle you can use <code>x^2 + y^2 = 25</code> or <code>sqrt(25 - x^2)</code> for a half.
            </span>
          </p>
        ) : null}
        <div className="hint">Apply updates the plot. Reset story reapplies the default camera and timeline.</div>
        <div className="equationEditor__actions">
          <button type="submit" className="btn btn--primary">
            Apply
          </button>
          {showResetStory ? (
            <button type="button" className="btn" onClick={onResetStory}>
              Reset story
            </button>
          ) : null}
        </div>
      </form>
      <div className="suggestionRow" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="suggestionChip"
            onClick={() => {
              setExpr(s);
              textareaRef.current?.focus();
            }}
          >
            {s}
          </button>
        ))}
        {recent.map((s) => (
          <button
            key={`r-${s}`}
            type="button"
            className="suggestionChip suggestionChip--recent"
            onClick={() => {
              setExpr(s);
              textareaRef.current?.focus();
            }}
          >
            {s.length > 28 ? `${s.slice(0, 28)}…` : s}
          </button>
        ))}
      </div>
    </div>
  );
}
