import { type HighWindsPRA } from "interfaces-mef-types/high-winds/high-winds-pra";
import { type JSX, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../api/client";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { type HighWindsPraExampleOption } from "./highWindsPraWorkbookApi";
import { HighWindsPraWorkbookProvider } from "./highWindsPraWorkbookContext";
import { HighWindsPraWorkbench, type HighWindsPraPersona } from "./highWindsPraWorkbench";

export type HighWindsPraVariant = "htgr" | "sfr";
interface BundleResponse { highWindsPra: { mef: HighWindsPRA } }

export function HighWindsPraDemoPage(): JSX.Element {
  const [mef, setMef] = useState<HighWindsPRA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<HighWindsPraPersona>("preparer");
  const [examples, setExamples] = useState<HighWindsPraExampleOption[]>([]);
  const [selected, setSelected] = useState<HighWindsPraVariant>("htgr");

  useEffect(() => {
    let cancelled = false;
    setMef(null);
    setError(null);
    Promise.all([
      fetchJson<BundleResponse>(`/api/example-workbooks/high-winds-pra-bundle?example=${encodeURIComponent(selected)}`),
      fetchJson<HighWindsPraExampleOption[]>("/api/example-workbooks/high-winds-pra-examples"),
    ]).then(([response, options]) => {
      if (!cancelled) { setMef(response.highWindsPra.mef); setExamples(options); }
    }).catch((caught: unknown) => {
      if (!cancelled) setError((caught as { message?: string }).message ?? "Could not load the High Winds PRA example");
    });
    return () => { cancelled = true; };
  }, [selected]);

  const mutate = useCallback((mutator: (current: HighWindsPRA) => HighWindsPRA): void => setMef((current) => current === null ? current : mutator(current)), []);
  const selectExample = useCallback((value: string): void => { setMef(null); setSelected(value as HighWindsPraVariant); }, []);
  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null) return <div className="posw"><main className="posmain"><p className="pws-status">Loading High Winds PRA example…</p></main></div>;
  const myOpenComments = mef.internalReviewComments.comments.filter((comment) => !comment.resolved && (persona === "reviewer" ? comment.authorRole === "INTERNAL_REVIEWER" : persona === "approver" ? comment.authorRole === "INTERNAL_APPROVER" : false)).length;
  const submitted = mef.workflowState === "INTERNAL_APPROVAL" || mef.workflowState === "FINAL";
  return <HighWindsPraWorkbookProvider mef={mef} editable={persona === "preparer"} mutate={mutate}><HighWindsPraWorkbench persona={persona} setPersona={setPersona} headerMeta={{ projectName: mef.metadata.plantIdentity?.name ?? "Reference plant", workbookName: mef.name, workbookVersion: mef.version }} renderSignCard={() => <WorkbookDemoSignCard persona={persona} myOpenComments={myOpenComments} submitted={submitted} preparerPhase={false} onReviewerApproverSigned={() => { if (persona === "approver") mutate((current) => ({ ...current, workflowState: "FINAL", workflowHistory: [...current.workflowHistory, { state: "FINAL", enteredAt: new Date().toISOString(), actor: "High Winds PRA approver" }] })); }} onPreparerSigned={() => undefined} />} exampleOptions={examples} selectedExample={selected} onSelectExample={selectExample} /></HighWindsPraWorkbookProvider>;
}
