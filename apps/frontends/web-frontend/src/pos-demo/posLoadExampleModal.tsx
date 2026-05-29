import { JSX, useState } from "react";
import { POSIcon } from "./posIcons";
import "./css/posLoadExampleModal.css";

function PosLoadExampleModal({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm(): void {
    setBusy(true);
    setError(null);
    onConfirm()
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? "Could not load the example");
        setBusy(false);
      });
  }

  return (
    <div className="posloadex-overlay" onClick={busy ? undefined : onCancel}>
      <div className="posloadex-modal" onClick={(e) => e.stopPropagation()}>
        <header className="posloadex__head">
          <h2 className="posloadex__title">Load example workbook</h2>
          <button type="button" className="posloadex__close" onClick={onCancel} disabled={busy} aria-label="Close"><POSIcon.Close /></button>
        </header>

        <div className="posloadex__body">
          <p>
            This will replace the current workbook contents with the <strong>Generic-1</strong> POS example. Any data
            you have entered will be lost. Uploaded documents, comments, and review signoffs will also be cleared.
          </p>
          <p className="posloadex__hint">
            Useful for exploring the workflow without entering plant data first. You can edit everything after loading.
          </p>
          <div className="posloadex__disclaimer">
            <strong>Disclaimer:</strong> Use with caution. The contents of this example are <strong>LLM-generated</strong> and are <strong>not representative of any real plant or actual PRA data</strong>. The example exists solely to demonstrate how to use the app — every plant identity field, operating state, frequency, decay-heat value, reviewer comment, and approver remark is illustrative. Do not cite or build on any of it for a real analysis.
            <br /><br />
            <strong>Not recoverable on unload:</strong> uploaded documents and review signoffs are destroyed at load time. If you later click <em>Unload example</em>, your prior MEF contents are restored, but documents you had uploaded and signoffs you had collected before loading the example are <strong>permanently lost</strong>.
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

export { PosLoadExampleModal };
