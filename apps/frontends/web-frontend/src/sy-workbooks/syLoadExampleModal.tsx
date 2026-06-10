import { JSX, useState } from "react";
import { SYIcon } from "./syIcons";
import "./css/syScreens.css";

function SyLoadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sylink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="sylink" role="dialog" aria-modal="true" aria-label="Load example" onClick={(e) => e.stopPropagation()}>
        <header className="sylink__head">
          <div><div className="sylink__eyebrow"><SYIcon.Sparkle /> Example</div><h2 className="sylink__title">Load the Generic-1 example?</h2></div>
          <button type="button" className="sylink__close" onClick={onCancel} disabled={busy} aria-label="Close"><SYIcon.Close /></button>
        </header>
        <div className="sylink__body">
          <p className="possubtle">This replaces the current contents of this workbook with the Generic-1 Systems Analysis example. Your current contents are saved and can be restored with “Unload example”.</p>
        </div>
        <footer className="sylink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}><SYIcon.Sparkle /> {busy ? "Loading…" : "Load example"}</button>
        </footer>
      </div>
    </div>
  );
}

function SyUnloadExampleModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sylink-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="sylink" role="dialog" aria-modal="true" aria-label="Unload example" onClick={(e) => e.stopPropagation()}>
        <header className="sylink__head">
          <div><div className="sylink__eyebrow"><SYIcon.Close /> Example</div><h2 className="sylink__title">Restore previous contents?</h2></div>
          <button type="button" className="sylink__close" onClick={onCancel} disabled={busy} aria-label="Close"><SYIcon.Close /></button>
        </header>
        <div className="sylink__body">
          <p className="possubtle">This removes the loaded example and restores the contents that existed before the example was loaded.</p>
        </div>
        <footer className="sylink__foot">
          <button type="button" className="posnav__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy} onClick={() => { setBusy(true); onConfirm().catch(() => setBusy(false)); }}>{busy ? "Restoring…" : "Unload example"}</button>
        </footer>
      </div>
    </div>
  );
}

export { SyLoadExampleModal, SyUnloadExampleModal };
