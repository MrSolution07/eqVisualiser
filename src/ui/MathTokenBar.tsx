import { type RefObject, type ReactElement } from "react";

const TOKENS: { label: string; insert: string }[] = [
  { label: "+", insert: "+" },
  { label: "−", insert: "-" },
  { label: "×", insert: "*" },
  { label: "/", insert: "/" },
  { label: "^", insert: "^" },
  { label: "√", insert: "sqrt(" },
  { label: "π", insert: "pi" },
  { label: "( )", insert: "()" },
  { label: "sin", insert: "sin(" },
  { label: "cos", insert: "cos(" },
  { label: "tan", insert: "tan(" },
  { label: "exp", insert: "exp(" },
  { label: "ln", insert: "log(" },
  { label: "x", insert: "x" },
  { label: "y", insert: "y" },
];

function insertAtCaret(el: HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const v = el.value;
  if (text === "()") {
    const next = `${v.slice(0, start)}(${v.slice(start, end)})${v.slice(end)}`;
    el.value = next;
    const caret = start + 1;
    el.setSelectionRange(caret, caret);
    return;
  }
  const next = `${v.slice(0, start)}${text}${v.slice(end)}`;
  el.value = next;
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
}

export type MathTokenBarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
};

export function MathTokenBar({ textareaRef, onChange }: MathTokenBarProps): ReactElement {
  return (
    <div className="mathTokenBar" role="toolbar" aria-label="Math symbols">
      {TOKENS.map((t) => (
        <button
          key={t.label}
          type="button"
          className="mathTokenBtn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const el = textareaRef.current;
            if (!el) return;
            insertAtCaret(el, t.insert);
            onChange(el.value);
            el.focus();
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
