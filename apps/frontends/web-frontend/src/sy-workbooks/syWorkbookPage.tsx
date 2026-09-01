import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { getProject } from "../projects/projectApi";
import { WorkbookRolesModal } from "../workbooks/workbookRolesModal";
import { WorkbookApprovalTable } from "../workbooks/workbookApprovalTable";
import { WorkbookSignCard } from "../workbooks/workbookSignCard";
import { WorkbookRoster } from "../workbooks/workbookRoster";
import { postWorkbookComment, patchWorkbookComment, submitWorkbookForReview, requestWorkbookRevision } from "../workbooks/workbookReviewApi";
import { useAuth } from "../auth/AuthContext";
import {
  getSyWorkbook,
  getSyExampleOptions,
  loadSyExample,
  unloadSyExample,
  type SyWorkbookResponse,
  type SyWorkbookRoleName,
  type SyExampleOption,
} from "./syWorkbookApi";
import { SyWorkbench, type SyWorkbenchActions } from "./syWorkbench";
import {
  SyWorkbookProvider,
  type SyControlledHumanFailureOption,
  type SyControlledParameterOption,
  type SyWorkbookData,
  type SyLinkedInputs,
} from "./syWorkbookContext";
import { useSyMefPatch } from "./useSyMefPatch";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { SyDocumentsCard } from "./syDocumentsCard";
import { type SyPersona } from "./syViewData";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getDaWorkbook } from "../da-workbooks/daWorkbookApi";
import { getHrWorkbook } from "../hr-workbooks/hrWorkbookApi";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "SY-A1",
  models: "SY-A8",
  failures: "SY-A16",
  ccf: "SY-B1",
  deps: "SY-B5",
  integrity: "SY-A30",
  uncert: "SY-A32",
};

interface SyExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface SyBundleResponse {
  sy: SyExampleResponse;
  configurationControl: SyExampleResponse;
  newlyDevelopedMethods: SyExampleResponse[];
}

interface LinkedScMef {
  systemSuccessCriteria?: { uuid: string; systemId: string; description: string; requiredCapacities?: { parameter: string; value: string }[] }[];
}

interface LinkedPosMef {
  plantOperatingStates?: { uuid: string; name: string; meanDurationHours: number; decayHeat?: { representative?: number; max?: number; units?: string } }[];
}

async function fetchSyLinkedInputs(variant: string): Promise<SyLinkedInputs> {
  const [scBundle, posBundle] = await Promise.all([
    fetchJson<{ sc: { mef: unknown } }>(`/api/example-workbooks/sc-bundle?example=${variant}`),
    fetchJson<{ pos: { mef: unknown } }>(`/api/example-workbooks/pos-bundle?example=${variant}`),
  ]);
  const scMef = scBundle.sc.mef as LinkedScMef;
  const posMef = posBundle.pos.mef as LinkedPosMef;
  const label = variant === "htgr" ? "Generic HTGR" : "Generic SFR";
  return {
    scName: `${label} SC Workbook`,
    posName: `${label} POS Workbook`,
    scSystems: (scMef.systemSuccessCriteria ?? []).map((y) => ({
      id: y.systemId,
      name: y.description,
      capacities: (y.requiredCapacities ?? []).map((c) => `${c.parameter}: ${c.value}`).join(" · "),
    })),
    posStates: (posMef.plantOperatingStates ?? []).map((st) => {
      const rep = st.decayHeat?.representative ?? st.decayHeat?.max ?? 0;
      const units = st.decayHeat?.units ?? "MW";
      return { id: st.uuid, name: st.name, decayLabel: rep > 0 ? `${rep} ${units}` : "At power", durationHours: st.meanDurationHours };
    }),
  };
}

function SyWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<SyWorkbookData | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [myRoles, setMyRoles] = useState<SyWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const [exampleOptions, setExampleOptions] = useState<SyExampleOption[]>([]);
  const [controlledParameters, setControlledParameters] = useState<SyControlledParameterOption[]>([]);
  const [controlledHumanFailures, setControlledHumanFailures] = useState<SyControlledHumanFailureOption[]>([]);
  const workbookName = data?.sy.name ?? "";
  const workbookVersion = data?.sy.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getSyWorkbook(id),
      fetchJson<SyBundleResponse>("/api/example-workbooks/sy-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          sy: workbook.mef,
          cc: bundle.configurationControl.mef as PRAConfigurationControl,
          nms: bundle.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          links: null,
        });
        setMyRoles(workbook.myRoles);
        setRevision(workbook.revision);
        setHasPreviousMef(workbook.hasPreviousMef);
        try {
          const project = await getProject(workbook.projectId);
          if (!cancelled) setProjectName(project.name);
        } catch {
          if (!cancelled) setProjectName("");
        }
        try {
          const listing = await listWorkbooks(workbook.projectId, "DA");
          const loaded = await Promise.allSettled(
            listing.workbooks.map(async (entry) => ({
              entry,
              workbook: await getDaWorkbook(entry.id),
            })),
          );
          const supported = new Set(["FREQUENCY", "PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);
          const options = loaded.flatMap((result): SyControlledParameterOption[] => {
            if (result.status !== "fulfilled") return [];
            return result.value.workbook.mef.parameters.flatMap((parameter) => {
              if (
                !supported.has(parameter.parameterType) ||
                !Number.isFinite(parameter.value) ||
                parameter.value < 0 ||
                (parameter.parameterType !== "FREQUENCY" && parameter.value > 1)
              ) return [];
              return [{
                workbookId: result.value.entry.id,
                workbookName: result.value.entry.name,
                parameterId: parameter.uuid,
                parameterName: parameter.name,
                parameterType: parameter.parameterType as SyControlledParameterOption["parameterType"],
                value: parameter.value,
              }];
            });
          });
          if (!cancelled) {
            setControlledParameters(options.sort((left, right) =>
              [left.workbookName, left.parameterName].join(":").localeCompare(
                [right.workbookName, right.parameterName].join(":"),
              ),
            ));
          }
        } catch {
          if (!cancelled) setControlledParameters([]);
        }
        try {
          const listing = await listWorkbooks(workbook.projectId, "HRA");
          const loaded = await Promise.allSettled(
            listing.workbooks.map(async (entry) => ({
              entry,
              workbook: await getHrWorkbook(entry.id),
            })),
          );
          const options = loaded.flatMap((result): SyControlledHumanFailureOption[] => {
            if (result.status !== "fulfilled") return [];
            const humanFailureEvents = new Map(
              result.value.workbook.mef.humanFailureEvents.map((event) => [event.uuid, event]),
            );
            return result.value.workbook.mef.hepQuantifications.flatMap((quantification) => {
              const humanFailureEvent = humanFailureEvents.get(quantification.hfeId);
              const value = quantification.meanHep ?? quantification.pointEstimateHep;
              if (
                humanFailureEvent === undefined ||
                value === undefined ||
                !Number.isFinite(value) ||
                value < 0 ||
                value > 1
              ) return [];
              return [{
                workbookId: result.value.entry.id,
                workbookName: result.value.entry.name,
                humanFailureEventId: humanFailureEvent.uuid,
                humanFailureEventName: humanFailureEvent.name,
                hfeTiming: humanFailureEvent.hfeTiming,
                quantificationId: quantification.uuid,
                methodology: quantification.methodology,
                value,
                valueKind: quantification.meanHep === undefined ? "POINT_ESTIMATE" : "MEAN",
              }];
            });
          });
          if (!cancelled) {
            setControlledHumanFailures(options.sort((left, right) =>
              [left.workbookName, left.humanFailureEventName, left.methodology].join(":").localeCompare(
                [right.workbookName, right.humanFailureEventName, right.methodology].join(":"),
              ),
            ));
          }
        } catch {
          if (!cancelled) setControlledHumanFailures([]);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load this SY workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    getSyExampleOptions()
      .then((opts) => { if (!cancelled) setExampleOptions(opts); })
      .catch(() => { if (!cancelled) setExampleOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const syUuid = data?.sy.uuid ?? "";
  useEffect(() => {
    const variant = syUuid === "sy-generic-1" ? "sfr" : syUuid === "sy-generic-2" ? "htgr" : null;
    if (variant === null) return;
    let cancelled = false;
    fetchSyLinkedInputs(variant)
      .then((links) => { if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, links })); })
      .catch(() => { if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, links: null })); });
    return () => { cancelled = true; };
  }, [syUuid]);

  const updateSy = useCallback((sy: SystemsAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sy }));
  }, []);

  const handleSaveOk = useCallback((nextRevision: number): void => {
    setRevision(nextRevision);
    setSaveError(null);
  }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const handleSaveResync = useCallback((latest: SyWorkbookResponse): void => {
    setData((previous) => (previous === null ? previous : { ...previous, sy: latest.mef }));
    setRevision(latest.revision);
    setMyRoles(latest.myRoles);
    setHasPreviousMef(latest.hasPreviousMef);
  }, []);
  const refreshWorkbook = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    handleSaveResync(await getSyWorkbook(id));
  }, [handleSaveResync, id]);
  const { patch, saveStatus } = useSyMefPatch(
    id ?? "",
    data?.sy ?? null,
    revision,
    handleSaveOk,
    handleSaveErr,
    handleSaveResync,
  );
  const mutateSy = useCallback((mutator: (sy: SystemsAnalysis) => SystemsAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sy: mutator(prev.sy) }));
    void patch(mutator);
  }, [patch]);

  const actions = useMemo<SyWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] });
        await refreshWorkbook();
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        await patchWorkbookComment(id, commentId, { resolved: nextResolved });
        await refreshWorkbook();
      },
      submitForReview: async (): Promise<void> => {
        await submitWorkbookForReview(id);
        await refreshWorkbook();
      },
      requestRevision: async (note): Promise<void> => {
        await requestWorkbookRevision(id, note);
        await refreshWorkbook();
      },
    };
  }, [id, refreshWorkbook]);

  const availablePersonas = useMemo<SyPersona[]>(() => {
    const out: SyPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<SyPersona>("preparer");
  useEffect(() => {
    if (availablePersonas.length === 0) return;
    if (!availablePersonas.includes(persona)) setPersona(availablePersonas[0]);
  }, [availablePersonas, persona]);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null || id === undefined) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading workbook…</p></main></div>;
  }

  if (availablePersonas.length === 0) {
    return (
      <div className="posw">
        <main className="posmain">
          <p className="pws-status">You do not have any role on this workbook yet. Ask the workbook owner to assign you a preparer, reviewer, or approver role.</p>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRolesOpen(true)}>View roles</button>
        </main>
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as SyWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.sy.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const editable = persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <SyWorkbookProvider
      data={data}
      editable={editable}
      mutateSy={mutateSy}
      runtime={{ workbookId: id, revision, saveStatus }}
      controlledParameters={controlledParameters}
      controlledHumanFailures={controlledHumanFailures}
    >
      <SyWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onLoadExample={canLoadExample ? () => setLoadExOpen(true) : undefined}
        onUnloadExample={canUnloadExample ? () => setUnloadExOpen(true) : undefined}
        actions={actions}
        headerMeta={{ projectName, workbookName, workbookVersion, saveStatus }}
        renderApprovalTable={() => <WorkbookApprovalTable workbookId={id} refreshSignal={approvalRefresh} />}
        renderSignCard={() => (
          <WorkbookSignCard
            workbookId={id}
            actingUsername={actingUsername}
            currentPersona={persona}
            myOpenComments={data.sy.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => {
              setApprovalRefresh((n) => n + 1);
              void refreshWorkbook().catch((refreshError: unknown) => {
                handleSaveErr((refreshError as { message?: string }).message ?? "Could not refresh this SY workbook");
              });
            }}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <SyDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as SyWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="SY"
          exampleOptions={exampleOptions}
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async (exampleId) => {
            const res = await loadSyExample(id, exampleId);
            updateSy(res.mef);
            setRevision(res.revision);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadSyExample(id);
            updateSy(res.mef);
            setRevision(res.revision);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </SyWorkbookProvider>
  );
}

export { SyWorkbookPage };
