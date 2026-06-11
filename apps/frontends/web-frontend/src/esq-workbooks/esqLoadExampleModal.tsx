import { JSX, useState } from "react";
import { ESQIcon } from "./esqIcons";
import "./css/esqScreens.css";

function EsqLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="esqlink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="esqlink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="esqlink__head">
          <div><div className="esqlink__eyebrow"><ESQIcon.Sparkle /> Example</div><h2 className="esqlink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="esqlink__close" onClick={onCancel} disabled={busy} aria-label="Close"><ESQIcon.Close /></button>
        </header>
        <div className="esqlink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Event Sequence Quantification example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="esqlink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><ESQIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function EsqUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="esqlink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="esqlink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="esqlink__head">
          <div><div className="esqlink__eyebrow"><ESQIcon.Close /> Example</div><h2 className="esqlink__title">Restore previous contents?</h2></div>
          <button type="button" className="esqlink__close" onClick={onCancel} disabled={busy} aria-label="Close"><ESQIcon.Close /></button>
        </header>
        <div className="esqlink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="esqlink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { EsqLoadExampleModal, EsqUnloadExampleModal };
