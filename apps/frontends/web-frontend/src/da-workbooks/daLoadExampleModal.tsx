import { JSX, useState } from "react";
import { DAIcon } from "./daIcons";
import "./css/daScreens.css";

function DaLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="dalink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="dalink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="dalink__head">
          <div><div className="dalink__eyebrow"><DAIcon.Sparkle /> Example</div><h2 className="dalink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="dalink__close" onClick={onCancel} disabled={busy} aria-label="Close"><DAIcon.Close /></button>
        </header>
        <div className="dalink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Data Analysis example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="dalink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><DAIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function DaUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="dalink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="dalink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="dalink__head">
          <div><div className="dalink__eyebrow"><DAIcon.Close /> Example</div><h2 className="dalink__title">Restore previous contents?</h2></div>
          <button type="button" className="dalink__close" onClick={onCancel} disabled={busy} aria-label="Close"><DAIcon.Close /></button>
        </header>
        <div className="dalink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="dalink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { DaLoadExampleModal, DaUnloadExampleModal };
