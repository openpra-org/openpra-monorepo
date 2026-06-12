import { JSX, useState } from "react";
import { MSIcon } from "./msIcons";
import "./css/msScreens.css";

function MsLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mslink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="mslink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="mslink__head">
          <div><div className="mslink__eyebrow"><MSIcon.Sparkle /> Example</div><h2 className="mslink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="mslink__close" onClick={onCancel} disabled={busy} aria-label="Close"><MSIcon.Close /></button>
        </header>
        <div className="mslink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Mechanistic Source Term Analysis example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="mslink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><MSIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function MsUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mslink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="mslink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="mslink__head">
          <div><div className="mslink__eyebrow"><MSIcon.Close /> Example</div><h2 className="mslink__title">Restore previous contents?</h2></div>
          <button type="button" className="mslink__close" onClick={onCancel} disabled={busy} aria-label="Close"><MSIcon.Close /></button>
        </header>
        <div className="mslink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="mslink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { MsLoadExampleModal, MsUnloadExampleModal };
