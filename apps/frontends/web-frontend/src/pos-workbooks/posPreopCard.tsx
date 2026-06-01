import { JSX, useState } from "react";
import { type PreOpAssumptionView } from "./posSelectors";

function PreopAssumptionCard({ assumption }: { assumption: PreOpAssumptionView | undefined }): JSX.Element {
  const has = assumption !== undefined;
  const [enabled, setEnabled] = useState(has);
  return (
    <div className="poscard poscard--preop">
      <div className="poscard__head">
        <h3 className="poscard__title">Pre-operational assumption</h3>
        <label className="posswitch">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="posswitch__slider" />
          <span className="posswitch__label">{enabled ? "Flagged" : "Not flagged"}</span>
        </label>
      </div>
      {enabled ? (
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label">Assumption</label>
            <textarea className="posfield__textarea" defaultValue={assumption?.description ?? ""} placeholder="Describe the pre-operational assumption…" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Applies to</label>
            <input className="posfield__input" defaultValue={assumption?.appliesTo ?? ""} placeholder="e.g. Mean duration" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Source / basis</label>
            <input className="posfield__input" defaultValue={assumption?.source ?? ""} placeholder="Vendor data, prototype test, assumed cycle plan…" />
          </div>
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label">Closure plan</label>
            <textarea className="posfield__textarea" defaultValue={assumption?.closurePlan ?? ""} placeholder="When and how this will be replaced by real data…" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Owner</label>
            <input className="posfield__input" defaultValue={assumption?.ownerName ?? ""} placeholder="Closure-plan owner" />
          </div>
        </div>
      ) : (
        <p className="posfield__hint">Toggle on if any field on this record is a pre-operational placeholder. The assumption will roll up into the Draft (Step 10).</p>
      )}
    </div>
  );
}

export { PreopAssumptionCard };
