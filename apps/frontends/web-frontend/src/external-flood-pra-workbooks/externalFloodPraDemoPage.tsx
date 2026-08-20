import { type ExternalFloodPRA } from "interfaces-mef-types/external-flood/external-flood-pra";
import { type JSX, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../api/client";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { type ExternalFloodPraExampleOption } from "./externalFloodPraWorkbookApi";
import { ExternalFloodPraWorkbookProvider } from "./externalFloodPraWorkbookContext";
import { ExternalFloodPraWorkbench, type ExternalFloodPraPersona } from "./externalFloodPraWorkbench";

export type ExternalFloodPraVariant = "htgr" | "sfr";
interface BundleResponse { externalFloodPra: { mef: ExternalFloodPRA } }

export function ExternalFloodPraDemoPage(): JSX.Element {
  const [mef, setMef] = useState<ExternalFloodPRA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<ExternalFloodPraPersona>("preparer");
  const [examples, setExamples] = useState<ExternalFloodPraExampleOption[]>([]);
  const [selected, setSelected] = useState<ExternalFloodPraVariant>("htgr");

  useEffect(() => {
    let cancelled = false;
    setMef(null);
    setError(null);
    Promise.all([
      fetchJson<BundleResponse>(`/api/example-workbooks/external-flood-pra-bundle?example=${encodeURIComponent(selected)}`),
      fetchJson<ExternalFloodPraExampleOption[]>("/api/example-workbooks/external-flood-pra-examples"),
    ]).then(([response, options]) => {
      if (!cancelled) { setMef(response.externalFloodPra.mef); setExamples(options); }
    }).catch((caught: unknown) => {
      if (!cancelled) setError((caught as { message?: string }).message ?? "Could not load the External Flood PRA example");
    });
    return () => { cancelled = true; };
  }, [selected]);

  const mutate = useCallback((mutator: (current: ExternalFloodPRA) => ExternalFloodPRA): void => setMef((current) => current === null ? current : mutator(current)), []);
  const selectExample = useCallback((value: string): void => { setMef(null); setSelected(value as ExternalFloodPraVariant); }, []);
  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null) return <div className="posw"><main className="posmain"><p className="pws-status">Loading External Flood PRA example…</p></main></div>;
  const myOpenComments = mef.internalReviewComments.comments.filter((comment) => !comment.resolved && (persona === "reviewer" ? comment.authorRole === "INTERNAL_REVIEWER" : persona === "approver" ? comment.authorRole === "INTERNAL_APPROVER" : false)).length;
  const submitted = mef.workflowState === "INTERNAL_APPROVAL" || mef.workflowState === "FINAL";
  return <ExternalFloodPraWorkbookProvider mef={mef} editable={persona === "preparer"} mutate={mutate}><ExternalFloodPraWorkbench persona={persona} setPersona={setPersona} headerMeta={{ projectName: mef.metadata.plantIdentity?.name ?? "Reference plant", workbookName: mef.name, workbookVersion: mef.version }} renderSignCard={() => <WorkbookDemoSignCard persona={persona} myOpenComments={myOpenComments} submitted={submitted} preparerPhase={false} onReviewerApproverSigned={() => { if (persona === "approver") mutate((current) => ({ ...current, workflowState: "FINAL", workflowHistory: [...current.workflowHistory, { state: "FINAL", enteredAt: new Date().toISOString(), actor: "External Flood PRA approver" }] })); }} onPreparerSigned={() => undefined} />} exampleOptions={examples} selectedExample={selected} onSelectExample={selectExample} /></ExternalFloodPraWorkbookProvider>;
}
