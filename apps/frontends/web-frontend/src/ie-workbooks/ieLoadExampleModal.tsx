import { JSX, useState } from "react";
import { IEIcon } from "./ieIcons";
import "../pos-workbooks/css/posLoadExampleModal.css";

function IeLoadExampleModal({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm(): void {
    setBusy(true);
    setError(null);
    onConfirm().catch((err: unknown) => {
      setError((err as { message?: string }).message ?? "Could not load the example");
      setBusy(false);
    });
  }

  return (
    <div className="posloadex-overlay" onClick={busy ? undefined : onCancel}>
      <div className="posloadex-modal" onClick={(e) => e.stopPropagation()}>
        <header className="posloadex__head">
          <h2 className="posloadex__title">Load example workbook</h2>
          <button type="button" className="posloadex__close" onClick={onCancel} disabled={busy} aria-label="Close"><IEIcon.Close /></button>
        </header>
        <div className="posloadex__body">
          <p>
            This will replace the current workbook contents with the <strong>Generic-1</strong> IE example. Any data
            you have entered will be lost. Uploaded documents, comments, and review signoffs will also be cleared.
          </p>
          <div className="posloadex__disclaimer">
            <strong>Disclaimer:</strong> Use with caution. The contents of this example are <strong>LLM-generated</strong> and are <strong>not representative of any real plant or actual PRA data</strong>. The example exists solely to demonstrate how to use the app. Do not cite or build on any of it for a real analysis.
          </div>
          {error !== null && <p className="posloadex__error">{error}</p>}
        </div>
        <footer className="posloadex__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" onClick={handleConfirm} disabled={busy}>
            {busy ? "Loading…" : "Replace with example"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function IeUnloadExampleModal({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}): JSX.Element {
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
    <div className="posloadex-overlay" onClick={busy ? undefined : onCancel}>
      <div className="posloadex-modal" onClick={(e) => e.stopPropagation()}>
        <header className="posloadex__head">
          <h2 className="posloadex__title">Unload example workbook</h2>
          <button type="button" className="posloadex__close" onClick={onCancel} disabled={busy} aria-label="Close"><IEIcon.Close /></button>
        </header>
        <div className="posloadex__body">
          <p>This will discard the loaded example and restore the workbook contents that existed before you loaded the example.</p>
          <p className="posloadex__hint">Anything you have edited <strong>since</strong> loading the example will be lost. Documents and signoffs cleared at load time will not be restored.</p>
          {error !== null && <p className="posloadex__error">{error}</p>}
        </div>
        <footer className="posloadex__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" onClick={handleConfirm} disabled={busy}>
            {busy ? "Unloading…" : "Restore prior contents"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export { IeLoadExampleModal, IeUnloadExampleModal };
