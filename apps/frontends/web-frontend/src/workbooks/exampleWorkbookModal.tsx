import { JSX, useState } from "react";
import "./css/exampleWorkbookModal.css";

function CloseIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

interface ExampleOption {
  id: string;
  label: string;
}

interface LoadExampleModalProps {
  exampleName: string;
  exampleOptions?: ExampleOption[];
  title?: string;
  intro?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (exampleId?: string) => Promise<void>;
}

function LoadExampleModal({ exampleName, exampleOptions, title, intro, confirmLabel, onCancel, onConfirm }: LoadExampleModalProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = exampleOptions ?? [];
  const hasChoice = options.length > 1;
  const [selected, setSelected] = useState<string>(options[0]?.id ?? "");
  const selectedLabel = options.find((o) => o.id === selected)?.label;

  function handleConfirm(): void {
    setBusy(true);
    setError(null);
    onConfirm(hasChoice ? selected : undefined).catch((err: unknown) => {
      setError((err as { message?: string }).message ?? "Could not load the example");
      setBusy(false);
    });
  }

  return (
    <div className="exmodal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="exmodal" role="dialog" aria-modal="true" aria-label={title ?? "Load example workbook"} onClick={(e) => e.stopPropagation()}>
        <header className="exmodal__head">
          <h2 className="exmodal__title">{title ?? "Load example workbook"}</h2>
          <button type="button" className="exmodal__close" onClick={onCancel} disabled={busy} aria-label="Close"><CloseIcon /></button>
        </header>

        <div className="exmodal__body">
          {hasChoice && (
            <label className="exmodal__choice">
              <span className="exmodal__choice-label">Example reactor</span>
              <select className="exmodal__choice-select" value={selected} disabled={busy} onChange={(e) => setSelected(e.target.value)}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
          {intro !== undefined ? (
            <p>{intro}</p>
          ) : (
            <p>
              This will replace the current workbook contents with the <strong>{hasChoice ? (selectedLabel ?? "selected") : "Generic-1"}</strong> {exampleName} example. Any data
              you have entered will be lost. Uploaded documents, comments, and review signoffs will also be cleared.
            </p>
          )}
          <p className="exmodal__hint">
            Useful for exploring the workflow without entering plant data first. You can edit everything after loading.
          </p>
          <div className="exmodal__disclaimer">
            <strong>Disclaimer:</strong> Use with caution. The contents of this example are <strong>LLM-generated</strong> and are <strong>not representative of any real plant or actual PRA data</strong>. The example exists solely to demonstrate how to use the app — every plant identity field, parameter value, frequency, distribution, reviewer comment, and approver remark is illustrative. Do not cite or build on any of it for a real analysis.
            <br /><br />
            <strong>Not recoverable on unload:</strong> uploaded documents and review signoffs are destroyed at load time. If you later click <em>Unload example</em>, your prior MEF contents are restored, but documents you had uploaded and signoffs you had collected before loading the example are <strong>permanently lost</strong>.
          </div>
          {error !== null && <p className="exmodal__error">{error}</p>}
        </div>

        <footer className="exmodal__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" onClick={handleConfirm} disabled={busy}>
            {busy ? "Loading…" : (confirmLabel ?? "Replace with example")}
          </button>
        </footer>
      </div>
    </div>
  );
}

interface UnloadExampleModalProps {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function UnloadExampleModal({ onCancel, onConfirm }: UnloadExampleModalProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm(): void {
    setBusy(true);
    setError(null);
    onConfirm().catch((err: unknown) => {
      setError((err as { message?: string }).message ?? "Could not unload the example");
      setBusy(false);
    });
  }

  return (
    <div className="exmodal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="exmodal" role="dialog" aria-modal="true" aria-label="Unload example workbook" onClick={(e) => e.stopPropagation()}>
        <header className="exmodal__head">
          <h2 className="exmodal__title">Unload example workbook</h2>
          <button type="button" className="exmodal__close" onClick={onCancel} disabled={busy} aria-label="Close"><CloseIcon /></button>
        </header>

        <div className="exmodal__body">
          <p>
            This will discard the loaded example and restore the workbook contents that existed before you loaded the example.
          </p>
          <p className="exmodal__hint">
            Anything you have edited <strong>since</strong> loading the example will be lost. Documents and signoffs cleared at load time will not be restored.
          </p>
          {error !== null && <p className="exmodal__error">{error}</p>}
        </div>

        <footer className="exmodal__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" onClick={handleConfirm} disabled={busy}>
            {busy ? "Unloading…" : "Restore prior contents"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export { LoadExampleModal, UnloadExampleModal };
