import { useEffect, useRef, useState } from "react";
import type {
  HclCutSetCause,
  HclEventImportance,
  HclFaultTreeDependencyCutSets,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { PagedResults } from "../shared/resultPresentation";
import type { HclFaultTreeOption } from "./hclBindingTypes";
import { formatScientific } from "./hclResultMetrics";
import "./css/hclFaultTreeCutSets.css";

interface HclCauseNode {
  id: string;
  code: string;
  states: readonly { id: string; code: string }[];
}

function HclCauseTable({ causes, nodes, label }: { causes: readonly HclCutSetCause[]; nodes: readonly HclCauseNode[]; label: string }) {
  return (
    <table className="postable hcl-cut-sets__table" aria-label={label}>
      <thead>
        <tr>
          <th scope="col">Network node</th>
          <th scope="col">State</th>
          <th scope="col">Without the cut set</th>
          <th scope="col">With the cut set</th>
          <th scope="col">Shift</th>
        </tr>
      </thead>
      <tbody>
        {causes.map((cause) => {
          const node = nodes.find((candidate) => candidate.id === cause.nodeId);
          return (
            <tr key={cause.nodeId}>
              <td>{node?.code ?? "Unlisted node"}</td>
              <td>{node?.states.find((state) => state.id === cause.stateId)?.code ?? "Unlisted state"}</td>
              <td className="hcl-cut-sets__number">{formatScientific(cause.baseline)}</td>
              <td className="hcl-cut-sets__number">{formatScientific(cause.withCutSet)}</td>
              <td className="hcl-cut-sets__number">{formatScientific(cause.shift)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CutSetsWindow({
  cutSets,
  faultTree,
  title,
  evidence,
  weighted,
  nodes,
  onClose,
}: {
  cutSets: HclFaultTreeDependencyCutSets;
  faultTree: HclFaultTreeOption | undefined;
  title: string;
  evidence: string | undefined;
  weighted: boolean;
  nodes: readonly HclCauseNode[];
  onClose: () => void;
}) {
  const [traced, setTraced] = useState<number | null>(null);
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
  const codesOf = (eventIds: readonly string[]): string => eventIds.map((eventId) => codes.get(eventId) ?? "Unlisted event").join(" · ");
  const rows = cutSets.items.map((item, index) => ({ key: `${index}:${item.basicEventIds.join("+")}`, rank: index + 1, item }));
  const withCauses = cutSets.items.some((item) => item.causes !== undefined);
  const tracedItem = traced === null ? undefined : cutSets.items[traced];
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
        {tracedItem !== undefined && (
          <div className="modal__body">
            <table className="postable hcl-cut-sets__facts" aria-label="Traced cut set">
              <tbody>
                <tr>
                  <th scope="row">Cut set</th>
                  <td>{codesOf(tracedItem.basicEventIds)}</td>
                </tr>
                <tr>
                  <th scope="row">Probability</th>
                  <td>{formatScientific(tracedItem.probability)}</td>
                </tr>
              </tbody>
            </table>
            <HclCauseTable causes={tracedItem.causes ?? []} nodes={nodes} label="Causes of the cut set" />
            <div>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setTraced(null)}>Back to cut sets</button>
            </div>
          </div>
        )}
        {tracedItem === undefined && <div className="modal__body">
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
                      {withCauses && <th scope="col">Causes</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {page.map((row) => (
                      <tr key={row.key}>
                        <td className="hcl-cut-sets__number">{row.rank}</td>
                        <td>{codesOf(row.item.basicEventIds)}</td>
                        <td className="hcl-cut-sets__number">{row.item.order}</td>
                        <td className="hcl-cut-sets__number">{formatScientific(row.item.probability)}</td>
                        {withCauses && (
                          <td>
                            {row.item.causes === undefined || row.item.causes.length === 0 ? "None" : (
                              <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Causes of ${codesOf(row.item.basicEventIds)}`} onClick={() => setTraced(row.rank - 1)}>
                                {row.item.causes.length === 1 ? "1 node" : `${String(row.item.causes.length)} nodes`}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PagedResults>
          )}
        </div>}
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
  nodes = [],
}: {
  cutSets: HclFaultTreeDependencyCutSets | undefined;
  faultTree: HclFaultTreeOption | undefined;
  title: string;
  evidence?: string;
  weighted?: boolean;
  nodes?: readonly HclCauseNode[];
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
          nodes={nodes}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function fussellVeselyFirst(rows: readonly HclEventImportance[]): HclEventImportance[] {
  return [...rows].sort(
    (left, right) =>
      (right.fussellVesely ?? Number.NEGATIVE_INFINITY) - (left.fussellVesely ?? Number.NEGATIVE_INFINITY) ||
      left.basicEventId.localeCompare(right.basicEventId),
  );
}

type ImportanceMeasure = "fussellVesely" | "birnbaum" | "riskAchievementWorth" | "riskReductionWorth" | "criticality";

const IMPORTANCE_MEASURES: readonly (readonly [ImportanceMeasure, string])[] = [
  ["fussellVesely", "Fussell-Vesely"],
  ["birnbaum", "Birnbaum"],
  ["riskAchievementWorth", "RAW"],
  ["riskReductionWorth", "RRW"],
  ["criticality", "Criticality"],
];

function measureText(value: number | null): string {
  return value === null ? "—" : formatScientific(value);
}

function ImportanceWindow({
  rows,
  faultTree,
  title,
  evidence,
  onClose,
}: {
  rows: readonly HclEventImportance[];
  faultTree: HclFaultTreeOption | undefined;
  title: string;
  evidence: string | undefined;
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
  const sorted = fussellVeselyFirst(rows);
  const sampled = sorted.filter((row) => row.uncertainty !== undefined);
  const [measure, setMeasure] = useState<ImportanceMeasure>("fussellVesely");
  return (
    <div
      className="modal__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialog} className="modal hcl-cut-sets" role="dialog" aria-modal="true" aria-label="Dependency importance" tabIndex={-1}>
        <div className="modal__head">
          <div>
            <div className="posdrawer__cap">Importance</div>
            <h2 className="modal__title">{title}</h2>
          </div>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onClose}>Close</button>
        </div>
        <div className="modal__body">
          <table className="postable hcl-cut-sets__facts" aria-label={title}>
            <tbody>
              {evidence !== undefined && (
                <tr>
                  <th scope="row">Evidence</th>
                  <td>{evidence}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Events</th>
                <td>{rows.length}</td>
              </tr>
              {sampled.length > 0 && (
                <tr>
                  <th scope="row">Events sampled</th>
                  <td>{sampled.length}</td>
                </tr>
              )}
            </tbody>
          </table>
          {sampled.length > 0 && (
            <>
              <label className="hcleditor__run-field hcl-cut-sets__measure">
                <span>Measure</span>
                <select
                  aria-label="Importance measure"
                  value={measure}
                  onChange={(event) => {
                    const next = IMPORTANCE_MEASURES.find(([value]) => value === event.target.value)?.[0];
                    if (next !== undefined) setMeasure(next);
                  }}
                >
                  {IMPORTANCE_MEASURES.map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </label>
              <PagedResults items={sampled} label="Dependency importance uncertainty" resetKey={`${title}:${evidence ?? ""}:${measure}`}>
                {(page) => (
                  <table className="postable hcl-cut-sets__table" aria-label="Importance uncertainty">
                    <thead>
                      <tr>
                        <th scope="col">Basic event</th>
                        <th scope="col">Point estimate</th>
                        <th scope="col">Mean</th>
                        <th scope="col">5th percentile</th>
                        <th scope="col">Median</th>
                        <th scope="col">95th percentile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.map((row) => {
                        const summary = row.uncertainty?.[measure] ?? null;
                        return (
                          <tr key={row.basicEventId}>
                            <td>{codes.get(row.basicEventId) ?? "Unlisted event"}</td>
                            <td className="hcl-cut-sets__number">{measureText(row[measure])}</td>
                            <td className="hcl-cut-sets__number">{measureText(summary?.mean ?? null)}</td>
                            <td className="hcl-cut-sets__number">{measureText(summary?.percentile05 ?? null)}</td>
                            <td className="hcl-cut-sets__number">{measureText(summary?.median ?? null)}</td>
                            <td className="hcl-cut-sets__number">{measureText(summary?.percentile95 ?? null)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </PagedResults>
            </>
          )}
          {sorted.length > 0 && (
            <PagedResults items={sorted} label="Dependency importance" resetKey={`${title}:${evidence ?? ""}`}>
              {(page) => (
                <table className="postable hcl-cut-sets__table" aria-label="Importance">
                  <thead>
                    <tr>
                      <th scope="col">Basic event</th>
                      <th scope="col">Probability</th>
                      <th scope="col">Fussell-Vesely</th>
                      <th scope="col">Birnbaum</th>
                      <th scope="col">RAW</th>
                      <th scope="col">RRW</th>
                      <th scope="col">Criticality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.map((row) => (
                      <tr key={row.basicEventId}>
                        <td>{codes.get(row.basicEventId) ?? "Unlisted event"}</td>
                        <td className="hcl-cut-sets__number">{formatScientific(row.probability)}</td>
                        <td className="hcl-cut-sets__number">{measureText(row.fussellVesely)}</td>
                        <td className="hcl-cut-sets__number">{measureText(row.birnbaum)}</td>
                        <td className="hcl-cut-sets__number">{measureText(row.riskAchievementWorth)}</td>
                        <td className="hcl-cut-sets__number">{measureText(row.riskReductionWorth)}</td>
                        <td className="hcl-cut-sets__number">{measureText(row.criticality)}</td>
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

function HclImportanceButton({
  rows,
  faultTree,
  title,
  evidence,
}: {
  rows: readonly HclEventImportance[] | undefined;
  faultTree: HclFaultTreeOption | undefined;
  title: string;
  evidence?: string;
}) {
  const [open, setOpen] = useState(false);
  if (rows === undefined) return null;
  return (
    <>
      <button
        type="button"
        className="posnav__btn posnav__btn--sm"
        aria-label={evidence === undefined ? `Importance of ${title}` : `Importance of ${title} for ${evidence}`}
        onClick={() => setOpen(true)}
      >
        Importance
      </button>
      {open && <ImportanceWindow rows={rows} faultTree={faultTree} title={title} evidence={evidence} onClose={() => setOpen(false)} />}
    </>
  );
}

export { HclCutSetsButton, HclImportanceButton };
export type { HclCauseNode };
