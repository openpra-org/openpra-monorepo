import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type {
  HclFaultTreeCutSetSettings,
  HclFaultTreeDependencyCutSets,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { jsonView } from "../../workbooks/workbookViewMemory";
import { PagedResults } from "../shared/resultPresentation";
import type { HclFaultTreeOption } from "./hclBindingTypes";
import { formatScientific } from "./hclResultMetrics";
import "./css/hclFaultTreeCutSets.css";

interface HclCutSetChoice {
  ranked: boolean;
  keep: number;
  limitOrder: number | null;
  cutOff: number | null;
}

const KEEP_LIMIT = 1000;
const START_CUT_SET_CHOICE: HclCutSetChoice = { ranked: false, keep: 100, limitOrder: null, cutOff: null };
const CUT_OFF_EXPONENTS = Array.from({ length: 20 }, (_, index) => -(index + 1));

const CUT_SET_CHOICE_VIEW = jsonView<HclCutSetChoice>(
  z.object({
    ranked: z.boolean(),
    keep: z.number().int().min(1).max(KEEP_LIMIT),
    limitOrder: z.number().int().positive().nullable(),
    cutOff: z.number().int().negative().nullable(),
  }),
);

function cutSetSettingsOf(choice: HclCutSetChoice): HclFaultTreeCutSetSettings | undefined {
  if (!choice.ranked) return undefined;
  return {
    keep: choice.keep,
    ...(choice.limitOrder === null ? {} : { limitOrder: choice.limitOrder }),
    ...(choice.cutOff === null ? {} : { cutOff: Number(`1e${choice.cutOff}`) }),
  };
}

function HclCutSetControls({ choice, onChange }: { choice: HclCutSetChoice; onChange: (next: HclCutSetChoice) => void }) {
  return (
    <div className="hcleditor__cut-set-row" role="group" aria-label="Ranked cut set settings">
      <label className="hcleditor__run-field">
        <span>Ranked cut sets</span>
        <select
          aria-label="Ranked cut sets"
          value={choice.ranked ? "ON" : "OFF"}
          onChange={(event) => onChange({ ...choice, ranked: event.target.value === "ON" })}
        >
          <option value="OFF">Off</option>
          <option value="ON">Failed events</option>
        </select>
      </label>
      {choice.ranked && (
        <>
          <label className="hcleditor__run-field">
            <span>Cut sets kept</span>
            <input
              aria-label="Cut sets kept"
              type="number"
              min={1}
              max={KEEP_LIMIT}
              step={1}
              value={choice.keep}
              onChange={(event) => {
                const value = Math.round(Number(event.target.value));
                if (value >= 1) onChange({ ...choice, keep: Math.min(value, KEEP_LIMIT) });
              }}
            />
          </label>
          <label className="hcleditor__run-field">
            <span>Maximum cut set order</span>
            <input
              aria-label="Maximum cut set order"
              type="number"
              min={1}
              step={1}
              placeholder="No limit"
              value={choice.limitOrder ?? ""}
              onChange={(event) => {
                const value = Math.round(Number(event.target.value));
                onChange({ ...choice, limitOrder: event.target.value.trim().length === 0 || !(value >= 1) ? null : value });
              }}
            />
          </label>
          <label className="hcleditor__run-field">
            <span>Cut set cutoff</span>
            <select
              aria-label="Cut set cutoff"
              value={choice.cutOff ?? ""}
              onChange={(event) => onChange({ ...choice, cutOff: event.target.value === "" ? null : Number(event.target.value) })}
            >
              <option value="">None</option>
              {CUT_OFF_EXPONENTS.map((exponent) => (
                <option key={exponent} value={exponent}>{`1E${exponent}`}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}

function CutSetsWindow({
  cutSets,
  faultTree,
  title,
  evidence,
  weighted,
  onClose,
}: {
  cutSets: HclFaultTreeDependencyCutSets;
  faultTree: HclFaultTreeOption | undefined;
  title: string;
  evidence: string | undefined;
  weighted: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const codes = new Map((faultTree?.basicEvents ?? []).map((event) => [event.id, event.code]));
  const rows = cutSets.items.map((item, index) => ({ key: `${index}:${item.basicEventIds.join("+")}`, rank: index + 1, item }));
  const facts: (readonly [string, string])[] = [
    ...(evidence === undefined ? [] : [["Evidence", evidence] as const]),
    ["Probability of", "Failed events"],
    ["Cut sets found", String(cutSets.count)],
    ["Cut sets shown", String(cutSets.items.length)],
  ];
  return (
    <div
      className="modal__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialog} className="modal hcl-cut-sets" role="dialog" aria-modal="true" aria-label="Dependency cut sets" tabIndex={-1}>
        <div className="modal__head">
          <div>
            <div className="posdrawer__cap">Ranked cut sets</div>
            <h2 className="modal__title">{title}</h2>
          </div>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal__body">
          <table className="postable hcl-cut-sets__facts" aria-label={title}>
            <tbody>
              {facts.map(([name, value]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 0 && (
            <PagedResults items={rows} label="Dependency cut sets" resetKey={`${title}:${evidence ?? ""}`}>
              {(page) => (
                <table className="postable hcl-cut-sets__table" aria-label="Ranked cut sets">
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Cut set</th>
                      <th scope="col">Order</th>
                      <th scope="col">{weighted ? "Convolved probability" : "Probability"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.map((row) => (
                      <tr key={row.key}>
                        <td className="hcl-cut-sets__number">{row.rank}</td>
                        <td>{row.item.basicEventIds.map((eventId) => codes.get(eventId) ?? "Unlisted event").join(" · ")}</td>
                        <td className="hcl-cut-sets__number">{row.item.order}</td>
                        <td className="hcl-cut-sets__number">{formatScientific(row.item.probability)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PagedResults>
          )}
        </div>
      </div>
    </div>
  );
}

function HclCutSetsButton({
  cutSets,
  faultTree,
  title,
  evidence,
  weighted = false,
}: {
  cutSets: HclFaultTreeDependencyCutSets | undefined;
  faultTree: HclFaultTreeOption | undefined;
  title: string;
  evidence?: string;
  weighted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (cutSets === undefined) return null;
  return (
    <>
      <button
        type="button"
        className="posnav__btn posnav__btn--sm"
        aria-label={evidence === undefined ? `Cut sets of ${title}` : `Cut sets of ${title} for ${evidence}`}
        onClick={() => setOpen(true)}
      >
        Ranked cut sets
      </button>
      {open && (
        <CutSetsWindow
          cutSets={cutSets}
          faultTree={faultTree}
          title={title}
          evidence={evidence}
          weighted={weighted}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export { CUT_SET_CHOICE_VIEW, HclCutSetControls, HclCutSetsButton, START_CUT_SET_CHOICE, cutSetSettingsOf };
export type { HclCutSetChoice };
