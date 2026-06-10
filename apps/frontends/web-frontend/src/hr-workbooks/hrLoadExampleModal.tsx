import { JSX, useState } from "react";
import { HRIcon } from "./hrIcons";
import "./css/hrScreens.css";

function HrLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="hrlink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="hrlink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="hrlink__head">
          <div><div className="hrlink__eyebrow"><HRIcon.Sparkle /> Example</div><h2 className="hrlink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="hrlink__close" onClick={onCancel} disabled={busy} aria-label="Close"><HRIcon.Close /></button>
        </header>
        <div className="hrlink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Human Reliability Analysis example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="hrlink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><HRIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function HrUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="hrlink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="hrlink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="hrlink__head">
          <div><div className="hrlink__eyebrow"><HRIcon.Close /> Example</div><h2 className="hrlink__title">Restore previous contents?</h2></div>
          <button type="button" className="hrlink__close" onClick={onCancel} disabled={busy} aria-label="Close"><HRIcon.Close /></button>
        </header>
        <div className="hrlink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="hrlink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { HrLoadExampleModal, HrUnloadExampleModal };
