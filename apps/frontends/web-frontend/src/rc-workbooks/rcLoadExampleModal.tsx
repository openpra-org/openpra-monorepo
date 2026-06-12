import { JSX, useState } from "react";
import { RCIcon } from "./rcIcons";
import "./css/rcScreens.css";

function RcLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rclink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="rclink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="rclink__head">
          <div><div className="rclink__eyebrow"><RCIcon.Sparkle /> Example</div><h2 className="rclink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="rclink__close" onClick={onCancel} disabled={busy} aria-label="Close"><RCIcon.Close /></button>
        </header>
        <div className="rclink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Radiological Consequence Analysis example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="rclink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><RCIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function RcUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rclink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="rclink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="rclink__head">
          <div><div className="rclink__eyebrow"><RCIcon.Close /> Example</div><h2 className="rclink__title">Restore previous contents?</h2></div>
          <button type="button" className="rclink__close" onClick={onCancel} disabled={busy} aria-label="Close"><RCIcon.Close /></button>
        </header>
        <div className="rclink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="rclink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { RcLoadExampleModal, RcUnloadExampleModal };
