import { type InternalFirePRA } from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { type JSX, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../api/client";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { type InternalFirePraExampleOption } from "./internalFirePraWorkbookApi";
import { InternalFirePraWorkbookProvider, type InternalFirePraVariant } from "./internalFirePraWorkbookContext";
import { InternalFirePraWorkbench, type InternalFirePraPersona } from "./internalFirePraWorkbench";

interface BundleResponse { internalFirePra: { mef: InternalFirePRA } }
export function InternalFirePraDemoPage(): JSX.Element {
  const [mef, setMef] = useState<InternalFirePRA | null>(null); const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<InternalFirePraPersona>("preparer"); const [examples, setExamples] = useState<InternalFirePraExampleOption[]>([]); const [selected, setSelected] = useState<InternalFirePraVariant>("htgr");
  useEffect(() => { let cancelled = false; setMef(null); setError(null); Promise.all([fetchJson<BundleResponse>(`/api/example-workbooks/internal-fire-pra-bundle?example=${encodeURIComponent(selected)}`), fetchJson<InternalFirePraExampleOption[]>("/api/example-workbooks/internal-fire-pra-examples")]).then(([response, options]) => { if (!cancelled) { setMef(response.internalFirePra.mef); setExamples(options); } }).catch((caught: unknown) => { if (!cancelled) setError((caught as { message?: string }).message ?? "Could not load the Internal Fire PRA example"); }); return () => { cancelled = true; }; }, [selected]);
  const mutate = useCallback((mutator: (current: InternalFirePRA) => InternalFirePRA): void => setMef((current) => current === null ? current : mutator(current)), []);
  const selectExample = useCallback((value: string): void => { setMef(null); setSelected(value as InternalFirePraVariant); }, []);
  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null) return <div className="posw"><main className="posmain"><p className="pws-status">Loading Internal Fire PRA example…</p></main></div>;
  const myOpenComments = mef.internalReviewComments.comments.filter((comment) => !comment.resolved && (persona === "reviewer" ? comment.authorRole === "INTERNAL_REVIEWER" : persona === "approver" ? comment.authorRole === "INTERNAL_APPROVER" : false)).length;
  const submitted = mef.workflowState === "INTERNAL_APPROVAL" || mef.workflowState === "FINAL";
  return <InternalFirePraWorkbookProvider mef={mef} editable={persona === "preparer"} mutate={mutate}><InternalFirePraWorkbench persona={persona} setPersona={setPersona} headerMeta={{ projectName: mef.metadata.plantIdentity?.name ?? "Reference plant", workbookName: mef.name, workbookVersion: mef.version }} renderSignCard={() => <WorkbookDemoSignCard persona={persona} myOpenComments={myOpenComments} submitted={submitted} preparerPhase={false} onReviewerApproverSigned={() => { if (persona === "approver") mutate((current) => ({ ...current, workflowState: "FINAL", workflowHistory: [...current.workflowHistory, { state: "FINAL", enteredAt: new Date().toISOString(), actor: "Internal Fire PRA approver" }] })); }} onPreparerSigned={() => undefined} />} exampleOptions={examples} selectedExample={selected} onSelectExample={selectExample} /></InternalFirePraWorkbookProvider>;
}
