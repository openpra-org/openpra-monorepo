import { type OtherHazardsPRA } from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { type JSX, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../api/client";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { type OtherHazardsPraExampleOption } from "./otherHazardsPraWorkbookApi";
import { OtherHazardsPraWorkbookProvider } from "./otherHazardsPraWorkbookContext";
import { OtherHazardsPraWorkbench, type OtherHazardsPraPersona } from "./otherHazardsPraWorkbench";

export type OtherHazardsPraVariant = "htgr" | "sfr";
interface BundleResponse { otherHazardsPra: { mef: OtherHazardsPRA } }

export function OtherHazardsPraDemoPage(): JSX.Element {
  const [mef, setMef] = useState<OtherHazardsPRA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<OtherHazardsPraPersona>("preparer");
  const [examples, setExamples] = useState<OtherHazardsPraExampleOption[]>([]);
  const [selected, setSelected] = useState<OtherHazardsPraVariant>("htgr");

  useEffect(() => {
    let cancelled = false;
    setMef(null);
    setError(null);
    Promise.all([
      fetchJson<BundleResponse>(`/api/example-workbooks/other-hazards-pra-bundle?example=${encodeURIComponent(selected)}`),
      fetchJson<OtherHazardsPraExampleOption[]>("/api/example-workbooks/other-hazards-pra-examples"),
    ]).then(([response, options]) => {
      if (!cancelled) { setMef(response.otherHazardsPra.mef); setExamples(options); }
    }).catch((caught: unknown) => {
      if (!cancelled) setError((caught as { message?: string }).message ?? "Could not load the Other Hazards PRA example");
    });
    return () => { cancelled = true; };
  }, [selected]);

  const mutate = useCallback((mutator: (current: OtherHazardsPRA) => OtherHazardsPRA): void => setMef((current) => current === null ? current : mutator(current)), []);
  const selectExample = useCallback((value: string): void => { setMef(null); setSelected(value as OtherHazardsPraVariant); }, []);
  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null) return <div className="posw"><main className="posmain"><p className="pws-status">Loading Other Hazards PRA example…</p></main></div>;
  const myOpenComments = mef.internalReviewComments.comments.filter((comment) => !comment.resolved && (persona === "reviewer" ? comment.authorRole === "INTERNAL_REVIEWER" : persona === "approver" ? comment.authorRole === "INTERNAL_APPROVER" : false)).length;
  const submitted = mef.workflowState === "INTERNAL_APPROVAL" || mef.workflowState === "FINAL";
  return <OtherHazardsPraWorkbookProvider mef={mef} editable={persona === "preparer"} mutate={mutate}><OtherHazardsPraWorkbench persona={persona} setPersona={setPersona} headerMeta={{ projectName: mef.metadata.plantIdentity?.name ?? "Reference plant", workbookName: mef.name, workbookVersion: mef.version }} renderSignCard={() => <WorkbookDemoSignCard persona={persona} myOpenComments={myOpenComments} submitted={submitted} preparerPhase={false} onReviewerApproverSigned={() => { if (persona === "approver") mutate((current) => ({ ...current, workflowState: "FINAL", workflowHistory: [...current.workflowHistory, { state: "FINAL", enteredAt: new Date().toISOString(), actor: "Other Hazards PRA approver" }] })); }} onPreparerSigned={() => undefined} />} exampleOptions={examples} selectedExample={selected} onSelectExample={selectExample} /></OtherHazardsPraWorkbookProvider>;
}
