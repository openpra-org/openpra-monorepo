import { JSX, useState } from "react";
import { POSIcon } from "./posIcons";
import "./css/posLoadExampleModal.css";

function PosUnloadExampleModal({ onCancel, onConfirm }: {
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
        setError((err as { message?: string }).message ?? "Could not unload the example");
        setBusy(false);
      });
  }

  return (
    <div className="posloadex-overlay" onClick={busy ? undefined : onCancel}>
      <div className="posloadex-modal" onClick={(e) => e.stopPropagation()}>
        <header className="posloadex__head">
          <h2 className="posloadex__title">Unload example workbook</h2>
          <button type="button" className="posloadex__close" onClick={onCancel} disabled={busy} aria-label="Close"><POSIcon.Close /></button>
        </header>

        <div className="posloadex__body">
          <p>
            This will discard the loaded example and restore the workbook contents that existed before you loaded the example.
          </p>
          <p className="posloadex__hint">
            Anything you have edited <strong>since</strong> loading the example will be lost. Documents and signoffs cleared at load time will not be restored.
          </p>
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

export { PosUnloadExampleModal };
