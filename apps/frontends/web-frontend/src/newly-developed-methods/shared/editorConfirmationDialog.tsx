import { type JSX, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import "./css/editorConfirmationDialog.css";

type EditorConfirmationTone = "warning" | "danger";

interface EditorConfirmationOptions {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: EditorConfirmationTone;
}

interface PendingEditorConfirmation extends EditorConfirmationOptions {
  onConfirm: () => void;
}

function WarningIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" />
      <path d="M12 9v5M12 17.5h.01" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function EditorConfirmationDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: EditorConfirmationOptions;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const titleId = useId();
  const descriptionId = useId();
  const tone = request.tone ?? "warning";

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  return createPortal(
    <div className="editor-confirm__backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section
        className={`editor-confirm editor-confirm--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="editor-confirm__header">
          <span className="editor-confirm__icon"><WarningIcon /></span>
          <div className="editor-confirm__heading">
            <span className="editor-confirm__eyebrow">Confirmation required</span>
            <h2 id={titleId}>{request.title}</h2>
          </div>
          <button type="button" className="editor-confirm__close" aria-label="Close confirmation" onClick={onCancel}><CloseIcon /></button>
        </header>
        <div className="editor-confirm__body" id={descriptionId}>
          {request.message.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <footer className="editor-confirm__footer">
          <button type="button" className="editor-confirm__button editor-confirm__button--cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className={`editor-confirm__button editor-confirm__button--${tone}`} onClick={onConfirm} autoFocus>{request.confirmLabel}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function useEditorConfirmation(): {
  requestConfirmation: (options: EditorConfirmationOptions, onConfirm: () => void) => void;
  confirmationDialog: JSX.Element | null;
} {
  const [pending, setPending] = useState<PendingEditorConfirmation | null>(null);
  const cancel = (): void => setPending(null);
  const confirm = (): void => {
    const action = pending?.onConfirm;
    setPending(null);
    action?.();
  };
  return {
    requestConfirmation: (options, onConfirm) => setPending({ ...options, onConfirm }),
    confirmationDialog: pending === null
      ? null
      : <EditorConfirmationDialog request={pending} onCancel={cancel} onConfirm={confirm} />,
  };
}

export { EditorConfirmationDialog, useEditorConfirmation };
export type { EditorConfirmationOptions, EditorConfirmationTone };
