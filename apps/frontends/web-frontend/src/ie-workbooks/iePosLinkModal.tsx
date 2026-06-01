import { JSX, useEffect, useState } from "react";
import { IEIcon } from "./ieIcons";
import { getAvailablePosWorkbooks, type AvailablePosWorkbook } from "./ieWorkbookApi";
import "./css/iePosLinkModal.css";

function IePosLinkModal({ workbookId, currentLinkedId, onClose, onConfirm }: {
  workbookId: string;
  currentLinkedId: string | null;
  onClose: () => void;
  onConfirm: (posWorkbookId: string) => Promise<void>;
}): JSX.Element {
  const [available, setAvailable] = useState<AvailablePosWorkbook[] | null>(null);
  const [picked, setPicked] = useState<string | null>(currentLinkedId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAvailablePosWorkbooks(workbookId)
      .then((res) => { if (!cancelled) { setAvailable(res); if (currentLinkedId === null && res.length > 0) setPicked(res[0].workbookId); } })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load POS workbooks"); });
    return () => { cancelled = true; };
  }, [workbookId, currentLinkedId]);

  function handleConfirm(): void {
    if (picked === null) return;
    setBusy(true);
    setError(null);
    onConfirm(picked).catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not link"); setBusy(false); });
  }

  return (
    <div className="ieimport-backdrop" onClick={busy ? undefined : onClose}>
      <div className="ieimport" role="dialog" aria-modal="true" aria-label="Import from POS workbook" onClick={(e) => e.stopPropagation()}>
        <header className="ieimport__head">
          <div>
            <div className="ieimport__eyebrow"><IEIcon.Link /> Import upstream data</div>
            <h2 className="ieimport__title">Import from a POS workbook</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose} disabled={busy} aria-label="Close"><IEIcon.Close /></button>
        </header>

        <div className="ieimport__body">
          <div className="ieimport__col ieimport__col--pick">
            <div className="ieimport__col-h"><span className="ieimport__step-n">1</span> Choose a POS workbook</div>
            {available === null && error === null && <p className="possubtle">Loading POS workbooks…</p>}
            {available !== null && available.length === 0 && <p className="possubtle">No POS workbooks in this project yet. Create and fill a POS workbook first.</p>}
            {available !== null && available.length > 0 && (
              <div className="ieimport__pick-list">
                {available.map((w) => {
                  const active = w.workbookId === picked;
                  return (
                    <button key={w.workbookId} type="button" className={`ieimport__pick${active ? " ieimport__pick--active" : ""}`} onClick={() => setPicked(w.workbookId)}>
                      <span className={`ieimport__pick-radio${active ? " ieimport__pick-radio--on" : ""}`} />
                      <span className="ieimport__pick-main">
                        <span className="ieimport__pick-name">{w.name}</span>
                        <span className="ieimport__pick-meta">
                          {w.workflowState === "FINAL" ? <span className="poschip poschip--ok-soft">Approved</span> : <span className="poschip">{w.workflowState}</span>}
                          <span className="possubtle">{w.stateCount} states · {w.sourceCount} sources</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error !== null && <p className="ieimport__error">{error}</p>}

        <footer className="ieimport__foot">
          <span className="poscomment__foot-spacer" />
          <button type="button" className="posnav__btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy || picked === null} onClick={handleConfirm}>
            <IEIcon.Download /> {busy ? "Importing…" : "Import & link"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export { IePosLinkModal };
