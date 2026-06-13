import { JSX, useState } from "react";
import { RIIcon } from "./riIcons";
import "./css/riScreens.css";

function RiLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rilink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="rilink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="rilink__head">
          <div><div className="rilink__eyebrow"><RIIcon.Sparkle /> Example</div><h2 className="rilink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="rilink__close" onClick={onCancel} disabled={busy} aria-label="Close"><RIIcon.Close /></button>
        </header>
        <div className="rilink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Risk Integration example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="rilink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><RIIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function RiUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rilink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="rilink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="rilink__head">
          <div><div className="rilink__eyebrow"><RIIcon.Close /> Example</div><h2 className="rilink__title">Restore previous contents?</h2></div>
          <button type="button" className="rilink__close" onClick={onCancel} disabled={busy} aria-label="Close"><RIIcon.Close /></button>
        </header>
        <div className="rilink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="rilink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { RiLoadExampleModal, RiUnloadExampleModal };
