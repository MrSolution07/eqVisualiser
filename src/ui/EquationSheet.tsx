import { type ReactElement } from "react";
import type { ProjectFileV1 } from "../core/ir";
import { EquationEditor } from "./EquationEditor";

export type EquationSheetProps = {
  open: boolean;
  onClose: () => void;
  project: ProjectFileV1;
  expr: string;
  setExpr: (v: string) => void;
  committedError: string | null;
  onApply: () => void;
  onResetStory: () => void;
};

export function EquationSheet({
  open,
  onClose,
  project,
  expr,
  setExpr,
  committedError,
  onApply,
  onResetStory,
}: EquationSheetProps): ReactElement {
  return (
    <>
      {open ? (
        <button
          type="button"
          className="equationSheetBackdrop equationSheetBackdrop--open"
          aria-label="Close equation editor"
          onClick={onClose}
        />
      ) : null}
      <div
        className={`equationSheet ${open ? "equationSheet--open" : ""}`}
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
      >
        <div className="equationSheet__handleWrap">
          <div className="equationSheet__handle" />
        </div>
        <EquationEditor
          project={project}
          expr={expr}
          setExpr={setExpr}
          committedError={committedError}
          onApply={() => {
            onApply();
            onClose();
          }}
          onResetStory={onResetStory}
          textareaId="expr-mobile"
          showResetStory={false}
          variant="sheet"
        />
      </div>
    </>
  );
}
