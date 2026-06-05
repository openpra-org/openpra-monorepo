import { JSX, useEffect, useState } from "react";
import { ESIcon } from "./esIcons";
import { getAvailablePosWorkbooks, type AvailablePosWorkbook } from "./esWorkbookApi";
import "./css/esLinkModal.css";

function EsPosLinkModal({ workbookId, currentLinkedId, onClose, onConfirm }: {
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
    <div className="eslink-backdrop" onClick={busy ? undefined : onClose}>
      <div className="eslink" role="dialog" aria-modal="true" aria-label="Link a POS workbook" onClick={(e) => e.stopPropagation()}>
        <header className="eslink__head">
          <div>
            <div className="eslink__eyebrow"><ESIcon.Link /> Import upstream data</div>
            <h2 className="eslink__title">Link a POS workbook</h2>
          </div>
          <button type="button" className="eslink__close" onClick={onClose} disabled={busy} aria-label="Close"><ESIcon.Close /></button>
        </header>

        <div className="eslink__body">
          <div className="eslink__col-h"><span>Choose a POS workbook</span></div>
          {available === null && error === null && <p className="possubtle">Loading POS workbooks…</p>}
          {available !== null && available.length === 0 && <p className="possubtle">No POS workbooks in this project yet. Create and fill a POS workbook first.</p>}
          {available !== null && available.length > 0 && (
            <div className="eslink__list">
              {available.map((w) => {
                const active = w.workbookId === picked;
                return (
                  <button key={w.workbookId} type="button" className={`eslink__pick${active ? " eslink__pick--active" : ""}`} onClick={() => setPicked(w.workbookId)}>
                    <span className={`eslink__pick-radio${active ? " eslink__pick-radio--on" : ""}`} />
                    <span className="eslink__pick-main">
                      <span className="eslink__pick-name">{w.name}</span>
                      <span className="eslink__pick-meta">
                        <span className="poschip">{w.workflowState}</span>
                        <span className="possubtle">{w.stateCount} states · {w.sourceCount} sources</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error !== null && <p className="eslink__error">{error}</p>}

        <footer className="eslink__foot">
          <button type="button" className="posnav__btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy || picked === null} onClick={handleConfirm}>
            <ESIcon.Download /> {busy ? "Importing…" : "Import & link"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export { EsPosLinkModal };
