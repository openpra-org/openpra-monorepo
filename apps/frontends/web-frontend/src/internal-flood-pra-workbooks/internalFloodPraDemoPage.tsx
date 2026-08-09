import { type InternalFloodPRA } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { type JSX, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../api/client";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { InternalFloodPraWorkbookProvider, type InternalFloodPraVariant } from "./internalFloodPraWorkbookContext";
import { InternalFloodPraWorkbench, type InternalFloodPraPersona } from "./internalFloodPraWorkbench";
import { type InternalFloodPraExampleOption } from "./internalFloodPraWorkbookApi";

interface BundleResponse { internalFloodPra: { mef: InternalFloodPRA } }

export function InternalFloodPraDemoPage(): JSX.Element {
  const [mef, setMef] = useState<InternalFloodPRA | null>(null); const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<InternalFloodPraPersona>("preparer"); const [examples, setExamples] = useState<InternalFloodPraExampleOption[]>([]); const [selected, setSelected] = useState<InternalFloodPraVariant>("htgr");
  useEffect(() => { let cancelled = false; setMef(null); setError(null); Promise.all([fetchJson<BundleResponse>(`/api/example-workbooks/internal-flood-pra-bundle?example=${encodeURIComponent(selected)}`), fetchJson<InternalFloodPraExampleOption[]>("/api/example-workbooks/internal-flood-pra-examples")]).then(([response, options]) => { if (!cancelled) { setMef(response.internalFloodPra.mef); setExamples(options); } }).catch((caught: unknown) => { if (!cancelled) setError((caught as { message?: string }).message ?? "Could not load the Internal Flood PRA example"); }); return () => { cancelled = true; }; }, [selected]);
  const mutate = useCallback((mutator: (current: InternalFloodPRA) => InternalFloodPRA): void => setMef((current) => current === null ? current : mutator(current)), []);
  const selectExample = useCallback((value: string): void => { setMef(null); setSelected(value as InternalFloodPraVariant); }, []);
  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null) return <div className="posw"><main className="posmain"><p className="pws-status">Loading Internal Flood PRA example…</p></main></div>;
  const myOpenComments = mef.internalReviewComments.comments.filter((comment) => !comment.resolved && (persona === "reviewer" ? comment.authorRole === "INTERNAL_REVIEWER" : persona === "approver" ? comment.authorRole === "INTERNAL_APPROVER" : false)).length;
  const submitted = mef.workflowState === "INTERNAL_APPROVAL" || mef.workflowState === "FINAL";
  return <InternalFloodPraWorkbookProvider mef={mef} editable={persona === "preparer"} mutate={mutate}><InternalFloodPraWorkbench persona={persona} setPersona={setPersona} headerMeta={{ projectName: mef.metadata.plantIdentity?.name ?? "Reference plant", workbookName: mef.name, workbookVersion: mef.version }} renderSignCard={() => <WorkbookDemoSignCard persona={persona} myOpenComments={myOpenComments} submitted={submitted} preparerPhase={false} onReviewerApproverSigned={() => { if (persona === "approver") mutate((current) => ({ ...current, workflowState: "FINAL", workflowHistory: [...current.workflowHistory, { state: "FINAL", enteredAt: new Date().toISOString(), actor: "Internal Flood PRA approver" }] })); }} onPreparerSigned={() => undefined} />} exampleOptions={examples} selectedExample={selected} onSelectExample={selectExample} /></InternalFloodPraWorkbookProvider>;
}
