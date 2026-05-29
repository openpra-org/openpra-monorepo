import { JSX, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPosAwaitingMe, type PosAwaitingMeEntry } from "../pos-demo/posWorkbookApi";
import "./css/posAwaitingMeSection.css";

const STATE_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  INTERNAL_TECHNICAL_REVIEW: "In review",
  INTERNAL_APPROVAL: "Awaiting approval",
  REVISION_REQUIRED: "Revision requested",
  AWAITING_EXTERNAL_REVIEW: "External review",
  FINAL: "Final",
  DEPRECATED: "Deprecated",
};

function PosAwaitingMeSection(): JSX.Element | null {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PosAwaitingMeEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPosAwaitingMe()
      .then((res) => { if (!cancelled) { setEntries(res); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  if (!loaded || entries.length === 0) return null;

  return (
    <section className="wp__section paws" aria-label="Awaiting your action">
      <div className="wp__section-h">
        <h2>Awaiting your action</h2>
        <span className="wp__section-h-meta">{entries.length} POS workbook{entries.length === 1 ? "" : "s"}</span>
      </div>
      <ul className="paws__list">
        {entries.map((entry) => (
          <li key={entry.workbookId} className="paws__row">
            <button type="button" className="paws__open" onClick={() => navigate(`/pos-workbooks/${entry.workbookId}`)}>
              <span className="paws__action">{entry.pendingAction}</span>
              <span className={`paws__state paws__state--${entry.workflowState}`}>{STATE_LABEL[entry.workflowState] ?? entry.workflowState}</span>
              <span className="paws__chevron">→</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { PosAwaitingMeSection };
