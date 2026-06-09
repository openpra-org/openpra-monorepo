import { JSX, useState } from "react";
import { SCIcon } from "./scIcons";
import "./css/scScreens.css";

function ScLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sclink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="sclink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="sclink__head">
          <div><div className="sclink__eyebrow"><SCIcon.Sparkle /> Example</div><h2 className="sclink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="sclink__close" onClick={onCancel} disabled={busy} aria-label="Close"><SCIcon.Close /></button>
        </header>
        <div className="sclink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Success Criteria Development example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="sclink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><SCIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function ScUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sclink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="sclink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="sclink__head">
          <div><div className="sclink__eyebrow"><SCIcon.Close /> Example</div><h2 className="sclink__title">Restore previous contents?</h2></div>
          <button type="button" className="sclink__close" onClick={onCancel} disabled={busy} aria-label="Close"><SCIcon.Close /></button>
        </header>
        <div className="sclink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="sclink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { ScLoadExampleModal, ScUnloadExampleModal };
