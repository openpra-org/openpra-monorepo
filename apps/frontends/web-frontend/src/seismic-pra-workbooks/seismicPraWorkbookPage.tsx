import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getProject } from "../projects/projectApi";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { WorkbookApprovalTable } from "../workbooks/workbookApprovalTable";
import { WorkbookRolesModal } from "../workbooks/workbookRolesModal";
import { WorkbookRoster } from "../workbooks/workbookRoster";
import { WorkbookSignCard } from "../workbooks/workbookSignCard";
import { patchWorkbookComment, postWorkbookComment, requestWorkbookRevision, submitWorkbookForReview } from "../workbooks/workbookReviewApi";
import { SeismicPraDocumentsCard } from "./seismicPraDocumentsCard";
import { fetchSeismicPraLinkedInputs, getSeismicPraExamples, getSeismicPraWorkbook, loadSeismicPraExample, seismicPraVariant, unloadSeismicPraExample, type SeismicPraExampleOption, type SeismicPraWorkbookRoleName } from "./seismicPraWorkbookApi";
import { SeismicPraWorkbookProvider, type SeismicPraLinkedInputs } from "./seismicPraWorkbookContext";
import { SeismicPraWorkbench, type SeismicPraPersona } from "./seismicPraWorkbench";
import { useSeismicPraMefPatch } from "./useSeismicPraMefPatch";

function SeismicPraWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [mef, setMef] = useState<SeismicPRA | null>(null);
  const [linkedInputs, setLinkedInputs] = useState<SeismicPraLinkedInputs | null>(null);
  const [roles, setRoles] = useState<SeismicPraWorkbookRoleName[]>([]);
  const [options, setOptions] = useState<SeismicPraExampleOption[]>([]);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [unloadOpen, setUnloadOpen] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [persona, setPersona] = useState<SeismicPraPersona>("preparer");

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([getSeismicPraWorkbook(id), getSeismicPraExamples()]).then(async ([workbook, examples]) => {
      if (cancelled) return;
      setMef(workbook.mef); setRoles(workbook.myRoles); setHasPrevious(workbook.hasPreviousMef); setOptions(examples);
      try { const project = await getProject(workbook.projectId); if (!cancelled) setProjectName(project.name); } catch { if (!cancelled) setProjectName(""); }
    }).catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load this Seismic PRA workbook"); });
    return () => { cancelled = true; };
  }, [id]);

  const exampleVariant = mef === null ? null : seismicPraVariant(mef);
  useEffect(() => {
    let cancelled = false;
    setLinkedInputs(null);
    if (exampleVariant === null) return () => { cancelled = true; };
    fetchSeismicPraLinkedInputs(exampleVariant)
      .then((links) => { if (!cancelled) setLinkedInputs(links); })
      .catch(() => { if (!cancelled) setLinkedInputs(null); });
    return () => { cancelled = true; };
  }, [exampleVariant]);

  const onSaveSuccess = useCallback((next: SeismicPRA): void => { setMef(next); setSaveError(null); }, []);
  const onSaveError = useCallback((message: string): void => setSaveError(message), []);
  const { patchDebounced } = useSeismicPraMefPatch(id ?? "", mef, onSaveSuccess, onSaveError);
  const mutate = useCallback((mutator: (current: SeismicPRA) => SeismicPRA): void => { setMef((current) => current === null ? current : mutator(current)); patchDebounced(mutator); }, [patchDebounced]);
  const availablePersonas = useMemo<SeismicPraPersona[]>(() => {
    const out: SeismicPraPersona[] = [];
    if (roles.includes("preparer") || roles.includes("co_preparer")) out.push("preparer");
    if (roles.includes("reviewer")) out.push("reviewer");
    if (roles.includes("approver")) out.push("approver");
    return out;
  }, [roles]);
  useEffect(() => { if (availablePersonas.length > 0 && !availablePersonas.includes(persona)) setPersona(availablePersonas[0]!); }, [availablePersonas, persona]);

  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null || id === undefined) return <div className="posw"><main className="posmain"><p className="pws-status">Loading Seismic PRA workbook…</p></main></div>;
  if (availablePersonas.length === 0) return <div className="posw"><main className="posmain"><p className="pws-status">You do not have a role on this workbook yet.</p><button type="button" className="posnav__btn" onClick={() => setRolesOpen(true)}>View roles</button></main>{rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(response) => setRoles(response.myRoles as SeismicPraWorkbookRoleName[])} />}</div>;

  const canPrepare = roles.includes("preparer") || roles.includes("co_preparer");
  const editable = persona === "preparer" && (mef.workflowState === "DRAFT" || mef.workflowState === "REVISION_REQUIRED");
  const canLoad = canPrepare && (mef.workflowState === "DRAFT" || mef.workflowState === "REVISION_REQUIRED");
  const activeLinkedInputs = linkedInputs?.variant === exampleVariant ? linkedInputs : null;
  const actions = {
    submitForReview: async (): Promise<void> => setMef(await submitWorkbookForReview(id) as SeismicPRA),
    requestRevision: async (note: string): Promise<void> => setMef(await requestWorkbookRevision(id, note) as SeismicPRA),
    postComment: async (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", associatedSr?: string): Promise<void> => setMef(await postWorkbookComment(id, { text, severity, associatedSr }) as SeismicPRA),
    toggleResolve: async (commentId: string, resolved: boolean): Promise<void> => setMef(await patchWorkbookComment(id, commentId, { resolved }) as SeismicPRA),
  };

  return <SeismicPraWorkbookProvider mef={mef} linkedInputs={activeLinkedInputs} editable={editable} mutate={mutate}>
    <SeismicPraWorkbench persona={persona} setPersona={setPersona} availablePersonas={availablePersonas} showPersonaPicker={availablePersonas.length > 1} onOpenRoles={() => setRolesOpen(true)} onLoadExample={canLoad ? () => setLoadOpen(true) : undefined} onUnloadExample={canLoad && hasPrevious ? () => setUnloadOpen(true) : undefined} headerMeta={{ projectName, workbookName: mef.name, workbookVersion: mef.version }} actions={actions} renderDocuments={() => <SeismicPraDocumentsCard workbookId={id} canEdit={canPrepare} />} renderApprovalTable={() => <WorkbookApprovalTable workbookId={id} refreshSignal={approvalRefresh} />} renderSignCard={() => <WorkbookSignCard workbookId={id} actingUsername={user?.username ?? ""} currentPersona={persona} myOpenComments={mef.internalReviewComments.comments.filter((comment) => comment.authorId === (user?.username ?? "") && !comment.resolved).length} refreshSignal={approvalRefresh} onSigned={() => setApprovalRefresh((value) => value + 1)} />} renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />} />
    {saveError !== null && <div className="ie-savebar" role="alert"><span>Could not save changes: {saveError}</span><button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button></div>}
    {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(response) => setRoles(response.myRoles as SeismicPraWorkbookRoleName[])} />}
    {loadOpen && <LoadExampleModal exampleName="Seismic PRA" exampleOptions={options} onCancel={() => setLoadOpen(false)} onConfirm={async (exampleId) => { setLinkedInputs(null); const response = await loadSeismicPraExample(id, exampleId); setMef(response.mef); setHasPrevious(response.hasPreviousMef); setLoadOpen(false); }} />}
    {unloadOpen && <UnloadExampleModal onCancel={() => setUnloadOpen(false)} onConfirm={async () => { setLinkedInputs(null); const response = await unloadSeismicPraExample(id); setMef(response.mef); setHasPrevious(response.hasPreviousMef); setUnloadOpen(false); }} />}
  </SeismicPraWorkbookProvider>;
}

export { SeismicPraWorkbookPage };
