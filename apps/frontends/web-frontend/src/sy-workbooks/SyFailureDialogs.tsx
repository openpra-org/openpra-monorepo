import { JSX } from "react";
import type {
  ComponentScreeningJustification,
  HumanFailureEventIntegration,
  IsolationTripCondition,
  SimultaneousUnavailabilityEvent,
  SystemDefinition,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { systemFaultTreeBasicEventIds } from "interfaces-mef-types/sy/system-models";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { DialogHead } from "./syShared";
import { ListEditor } from "./SySystemDialogs";
import { SCREENING_CRITERIA, toExp } from "./syViewData";
import { TREATMENT_LABELS, humanEventReference, humanFailureOption, integrationFor, systemTree } from "./syFailureRecords";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

type FailureDialogKind = "behavior" | "screening" | "trip" | "unavail" | "hfe";

const FAILURE_DIALOG_KINDS: readonly FailureDialogKind[] = ["behavior", "screening", "trip", "unavail", "hfe"];

const TREATMENTS: readonly IsolationTripCondition["modeledIn"][] = ["SYSTEM_MODEL", "EVENT_SEQUENCE", "EXCLUDED"];

function isFailureDialogKind(kind: SyDrawerContext["kind"]): kind is FailureDialogKind {
  return FAILURE_DIALOG_KINDS.some((candidate) => candidate === kind);
}

function humanFailureKey(workbookId: string, eventId: string, quantificationId: string): string {
  return JSON.stringify([workbookId, eventId, quantificationId]);
}

function listOrUndefined(items: string[]): string[] | undefined {
  return items.length === 0 ? undefined : items;
}

function BehaviorDialog({ systemId, onClose }: { systemId: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const system = sy.systemDefinitions.find((candidate) => candidate.uuid === systemId);
  if (system === undefined) return null;
  const owner = system;

  function patch(fields: Partial<SystemDefinition>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      systemDefinitions: draft.systemDefinitions.map((candidate) => (candidate.uuid === owner.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  return (
    <>
      <DialogHead cap={`Failure behavior · ${shortOf(owner.uuid)} · SY-A16, A17, A18, A28`} title={owner.name} onClose={onClose} />
      <div className="modal__body">
        <ListEditor label="Failures left out" items={owner.justificationForExclusionOfComponents ?? []} editable={editable} addLabel="Add a failure left out, with why" onChange={(items) => patch({ justificationForExclusionOfComponents: listOrUndefined(items) })} />
        <ListEditor label="Flow diversion paths" items={owner.flowDiversionConsiderations ?? []} editable={editable} addLabel="Add a flow diversion path" onChange={(items) => patch({ flowDiversionConsiderations: listOrUndefined(items) })} />
        <ListEditor label="Conditions that defeat the function" items={owner.functionLossConditions ?? []} editable={editable} addLabel="Add a condition" onChange={(items) => patch({ functionLossConditions: listOrUndefined(items) })} />
      </div>
    </>
  );
}

function ScreeningDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.componentScreeningJustifications ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const item = found;
  const criterion = SCREENING_CRITERIA.find((candidate) => candidate.code === item.screeningCriterion);

  function patch(fields: Partial<ComponentScreeningJustification>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      componentScreeningJustifications: (draft.componentScreeningJustifications ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({
      ...draft,
      componentScreeningJustifications: (draft.componentScreeningJustifications ?? []).filter((candidate) => candidate.uuid !== item.uuid),
    }));
  }

  return (
    <>
      <DialogHead cap={`Screened out · ${shortOf(item.systemReference)} · SY-A20`} title={item.componentId.length > 0 ? item.componentId : "New screened item"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Left out</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Left out" value={item.componentId} onChange={(event) => patch({ componentId: event.target.value.trim() })} /> : <div>{item.componentId}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Criterion</label>
            {editable ? (
              <select className="posfield__select" aria-label="Criterion" value={item.screeningCriterion} onChange={(event) => patch({ screeningCriterion: event.target.value === "b" ? "b" : "a" })}>
                {SCREENING_CRITERIA.map((candidate) => <option key={candidate.code} value={candidate.code}>Criterion {candidate.code}: {candidate.label}</option>)}
              </select>
            ) : <div>Criterion {item.screeningCriterion}: {criterion?.label ?? ""}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Justification</label>
            {editable
              ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Justification" value={item.quantitativeJustification} onChange={(event) => patch({ quantitativeJustification: event.target.value })} />
              : <div>{item.quantitativeJustification}</div>}
          </div>
        </div>
        {editable && <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove screened item</button></div>}
      </div>
    </>
  );
}

function TripDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.isolationTripConditions ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const item = found;
  const missing = item.modeledIn === "EXCLUDED" && (item.exclusionJustification ?? "").trim().length === 0;

  function patch(fields: Partial<IsolationTripCondition>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      isolationTripConditions: (draft.isolationTripConditions ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function setTreatment(value: string): void {
    const treatment = TREATMENTS.find((candidate) => candidate === value) ?? "SYSTEM_MODEL";
    patch(treatment === "EXCLUDED" ? { modeledIn: treatment } : { modeledIn: treatment, exclusionJustification: undefined });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({
      ...draft,
      isolationTripConditions: (draft.isolationTripConditions ?? []).filter((candidate) => candidate.uuid !== item.uuid),
    }));
  }

  return (
    <>
      <DialogHead cap={`Isolation and trip signal · ${shortOf(item.systemReference)} · SY-A24`} title={item.condition.length > 0 ? item.condition : "New signal"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Signal</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Signal" value={item.condition} onChange={(event) => patch({ condition: event.target.value })} /> : <div>{item.condition}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Treatment</label>
            {editable ? (
              <select className="posfield__select" aria-label="Treatment" value={item.modeledIn} onChange={(event) => setTreatment(event.target.value)}>
                {TREATMENTS.map((treatment) => <option key={treatment} value={treatment}>{TREATMENT_LABELS[treatment]}</option>)}
              </select>
            ) : <div>{TREATMENT_LABELS[item.modeledIn]}</div>}
          </div>
          {item.modeledIn === "EXCLUDED" && (
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Why leaving it out is harmless</label>
              {editable ? (
                <>
                  <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Why leaving it out is harmless" aria-invalid={missing} value={item.exclusionJustification ?? ""} onChange={(event) => patch({ exclusionJustification: event.target.value.trim().length > 0 ? event.target.value : undefined })} />
                  {missing && <span className="sy-error" role="alert">Reason required</span>}
                </>
              ) : <div>{item.exclusionJustification ?? ""}</div>}
            </div>
          )}
        </div>
        {editable && <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove signal</button></div>}
      </div>
    </>
  );
}

function OutageDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, controlledCoincidentMaintenance } = useSyWorkbook();
  const found = (sy.simultaneousUnavailabilityEvents ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const item = found;
  const ownerId = item.systemReference ?? sy.systemLogicModels.find((model) => item.componentIds.some((eventId) => systemFaultTreeBasicEventIds(model).includes(eventId)))?.systemReference;
  const events = ownerId === undefined ? [] : systemTree(sy, ownerId).events;
  const maintenanceEvents = events.filter((event) => event.failureMode === "TEST_MAINTENANCE");
  const known = new Set(maintenanceEvents.map((event) => event.uuid));
  const strays = item.componentIds.filter((eventId) => !known.has(eventId));
  const recordKnown = item.dataAnalysisRef === undefined || controlledCoincidentMaintenance.some((option) => option.recordId === item.dataAnalysisRef);

  function patch(fields: Partial<SimultaneousUnavailabilityEvent>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      simultaneousUnavailabilityEvents: (draft.simultaneousUnavailabilityEvents ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function toggle(eventId: string, checked: boolean): void {
    patch({ componentIds: checked ? [...item.componentIds, eventId] : item.componentIds.filter((candidate) => candidate !== eventId) });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({
      ...draft,
      simultaneousUnavailabilityEvents: (draft.simultaneousUnavailabilityEvents ?? []).filter((candidate) => candidate.uuid !== item.uuid),
    }));
  }

  return (
    <>
      <DialogHead cap={`Out of service together${ownerId === undefined ? "" : ` · ${shortOf(ownerId)}`} · SY-A27`} title={item.description.length > 0 ? item.description : "New outage record"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Planned activity</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Planned activity" value={item.description} onChange={(event) => patch({ description: event.target.value })} /> : <div>{item.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2" role="group" aria-label="Maintenance events">
            <span className="posfield__label">Maintenance events in the fault tree</span>
            {maintenanceEvents.length === 0 && strays.length === 0 && <span className="posmuted">Add the maintenance event to the fault tree in Step 02 first.</span>}
            <div className="sy-dialog-checks">
              {maintenanceEvents.map((event) => (
                <label key={event.uuid} className="sy-dialog-check">
                  <input type="checkbox" checked={item.componentIds.includes(event.uuid)} disabled={!editable} onChange={(change) => toggle(event.uuid, change.target.checked)} />
                  <span>{event.name}</span>{" "}<span className="posmono">{event.code}</span>
                </label>
              ))}
              {strays.map((eventId) => (
                <label key={eventId} className="sy-dialog-check">
                  <input type="checkbox" checked disabled={!editable} onChange={(change) => toggle(eventId, change.target.checked)} />
                  <span className="posmono">{eventId}</span>{" "}<span className="posmuted">Not a maintenance event in this fault tree</span>
                </label>
              ))}
            </div>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">DA coincident maintenance record</label>
            {controlledCoincidentMaintenance.length === 0 && item.dataAnalysisRef === undefined ? <span className="posmuted">Link a DA workbook in Step 01 Interfaces to pick its coincident maintenance record.</span> : editable ? (
              <select className="posfield__select" aria-label="DA coincident maintenance record" value={item.dataAnalysisRef ?? ""} onChange={(event) => patch({ dataAnalysisRef: event.target.value.length > 0 ? event.target.value : undefined })}>
                <option value="">Not linked</option>
                {!recordKnown && <option value={item.dataAnalysisRef}>Linked record unavailable</option>}
                {controlledCoincidentMaintenance.map((option) => (
                  <option key={`${option.workbookId}:${option.recordId}`} value={option.recordId}>{option.workbookName} · {option.description}{option.value === undefined ? "" : ` · ${toExp(option.value)}`}</option>
                ))}
              </select>
            ) : <div>{controlledCoincidentMaintenance.find((option) => option.recordId === item.dataAnalysisRef)?.description ?? item.dataAnalysisRef ?? "Not linked"}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Basis" value={item.plannedActivityBasis} onChange={(event) => patch({ plannedActivityBasis: event.target.value })} /> : <div>{item.plannedActivityBasis}</div>}
          </div>
        </div>
        {editable && <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove record</button></div>}
      </div>
    </>
  );
}

function HumanEventDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, controlledHumanFailures } = useSyWorkbook();
  const event = sy.systemBasicEvents.find((candidate) => candidate.uuid === id);
  const eventOwner = event === undefined ? undefined : sy.systemLogicModels.find((model) => systemFaultTreeBasicEventIds(model).includes(event.uuid))?.systemReference;
  const orphan = event === undefined ? sy.humanFailureEventIntegrations.find((candidate) => candidate.uuid === id) : undefined;
  const ownerId = eventOwner ?? orphan?.system;
  if (ownerId === undefined || (event === undefined && orphan === undefined)) return null;
  const systemId = ownerId;
  const integration = event === undefined ? orphan : integrationFor(sy.humanFailureEventIntegrations.filter((candidate) => candidate.system === systemId), event);
  const integrationId = integration?.uuid ?? `HFI-${event?.uuid ?? id}`;
  const option = humanFailureOption(controlledHumanFailures, event, integration);
  const optionKey = option === undefined ? "" : humanFailureKey(option.workbookId, option.humanFailureEventId, option.quantificationId);
  const reference = integration !== undefined && integration.hfeReference.length > 0 ? integration.hfeReference : event === undefined ? undefined : humanEventReference(event);
  const type = integration?.hfeType ?? (option?.hfeTiming === "PRE_INITIATOR" ? "PRE_INITIATOR" : "POST_INITIATOR");
  const title = event?.name ?? (integration?.taskDescription || "Human failure event");

  function upsert(draft: SystemsAnalysis, fields: Partial<HumanFailureEventIntegration>): SystemsAnalysis {
    const current = draft.humanFailureEventIntegrations.find((candidate) => candidate.uuid === integrationId);
    const linked = event === undefined ? fields : { basicEventId: event.uuid, ...fields };
    if (current !== undefined) {
      return { ...draft, humanFailureEventIntegrations: draft.humanFailureEventIntegrations.map((candidate) => (candidate.uuid === integrationId ? { ...candidate, ...linked } : candidate)) };
    }
    if (event === undefined) return draft;
    const created: HumanFailureEventIntegration = {
      uuid: integrationId,
      hfeReference: reference ?? "",
      basicEventId: event.uuid,
      system: systemId,
      taskDescription: event.name,
      hfeType: type,
      isTestMaintenance: false,
      implementsSrs: [{ sr: type === "PRE_INITIATOR" ? "SY-A21" : "SY-A23", hlr: "A" }],
    };
    return { ...draft, humanFailureEventIntegrations: [...draft.humanFailureEventIntegrations, { ...created, ...linked }] };
  }

  function patch(fields: Partial<HumanFailureEventIntegration>): void {
    if (!editable) return;
    mutateSy((draft) => upsert(draft, fields));
  }

  function rename(name: string): void {
    const trimmed = name.trim();
    if (!editable || trimmed.length === 0 || event === undefined) return;
    mutateSy((draft) => upsert({
      ...draft,
      systemBasicEvents: draft.systemBasicEvents.map((candidate) => (candidate.uuid === event.uuid ? { ...candidate, name: trimmed } : candidate)),
    }, { taskDescription: trimmed }));
  }

  function link(key: string): void {
    if (!editable) return;
    const picked = controlledHumanFailures.find((candidate) => humanFailureKey(candidate.workbookId, candidate.humanFailureEventId, candidate.quantificationId) === key);
    mutateSy((draft) => {
      const events = event === undefined ? draft.systemBasicEvents : draft.systemBasicEvents.map((candidate) => {
        if (candidate.uuid !== event.uuid) return candidate;
        if (picked === undefined) return { ...candidate, controlledDataSource: undefined };
        return {
          ...candidate,
          probability: picked.value,
          quantificationBasis: { kind: "PROBABILITY" as const },
          controlledDataSource: { referenceType: "HUMAN_FAILURE_EVENT" as const, workbookId: picked.workbookId, entityId: picked.humanFailureEventId, quantificationId: picked.quantificationId },
          dataAnalysisBasicEventRef: undefined,
        };
      });
      return upsert({ ...draft, systemBasicEvents: events }, picked === undefined
        ? { hfeSource: undefined }
        : {
            hfeReference: picked.humanFailureEventId,
            hfeSource: { referenceType: "HUMAN_FAILURE_EVENT", workbookId: picked.workbookId, entityId: picked.humanFailureEventId, quantificationId: picked.quantificationId },
            hfeType: picked.hfeTiming === "PRE_INITIATOR" ? "PRE_INITIATOR" : "POST_INITIATOR",
            ...(event === undefined && (integration?.taskDescription ?? "").length === 0 ? { taskDescription: picked.humanFailureEventName } : {}),
          });
    });
  }

  function remove(): void {
    if (!editable || orphan === undefined) return;
    onClose();
    mutateSy((draft) => ({ ...draft, humanFailureEventIntegrations: draft.humanFailureEventIntegrations.filter((candidate) => candidate.uuid !== orphan.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Human failure event · ${shortOf(systemId)} · SY-A21, A23`} title={title} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          {event !== undefined ? (
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Event</label>
              {editable ? <WorkbookInput className="posfield__input" aria-label="Event name" value={event.name} onChange={(change) => rename(change.target.value)} /> : <div>{event.name}</div>}
            </div>
          ) : (
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Task</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Task" value={integration?.taskDescription ?? ""} onChange={(change) => patch({ taskDescription: change.target.value })} /> : <div>{integration?.taskDescription ?? ""}</div>}
            </div>
          )}
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Human Reliability event and HEP</label>
            {controlledHumanFailures.length === 0 && option === undefined ? (
              <span className="posmuted">{reference === undefined ? "Link an HR workbook in Step 01 Interfaces to pick its event." : `${reference}. Link its HR workbook in Step 01 Interfaces to pick the event and HEP.`}</span>
            ) : editable ? (
              <select className="posfield__select" aria-label="Human Reliability event and HEP" value={optionKey} onChange={(change) => link(change.target.value)}>
                <option value="">Not linked</option>
                {controlledHumanFailures.map((candidate) => {
                  const key = humanFailureKey(candidate.workbookId, candidate.humanFailureEventId, candidate.quantificationId);
                  return <option key={key} value={key}>{candidate.workbookName} · {candidate.humanFailureEventName} · {toExp(candidate.value)}</option>;
                })}
              </select>
            ) : <div>{option === undefined ? reference ?? "Not linked" : `${option.workbookName} · ${option.humanFailureEventName} · ${toExp(option.value)}`}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Type</label>
            {editable ? (
              <select className="posfield__select" aria-label="Type" value={type} onChange={(change) => patch(change.target.value === "PRE_INITIATOR" ? { hfeType: "PRE_INITIATOR" } : { hfeType: "POST_INITIATOR", isTestMaintenance: false })}>
                <option value="PRE_INITIATOR">Pre-initiator</option>
                <option value="POST_INITIATOR">Post-initiator</option>
              </select>
            ) : <div>{type === "PRE_INITIATOR" ? "Pre-initiator" : "Post-initiator"}</div>}
          </div>
          {type === "PRE_INITIATOR" && (
            <label className="sy-dialog-check"><input type="checkbox" checked={integration?.isTestMaintenance === true} disabled={!editable} onChange={(change) => patch({ isTestMaintenance: change.target.checked })} /><span>After test or maintenance</span></label>
          )}
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Effect on the system</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Effect on the system" value={integration?.impact ?? ""} onChange={(change) => patch({ impact: change.target.value.trim().length > 0 ? change.target.value : undefined })} /> : <div>{integration?.impact ?? ""}</div>}
          </div>
        </div>
        {editable && orphan !== undefined && <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove event</button></div>}
      </div>
    </>
  );
}

function FailureDialogContent({ context, onClose }: { context: SyDrawerContext & { kind: FailureDialogKind }; onClose: () => void }): JSX.Element | null {
  if (context.kind === "behavior") return <BehaviorDialog systemId={context.id} onClose={onClose} />;
  if (context.kind === "screening") return <ScreeningDialog id={context.id} onClose={onClose} />;
  if (context.kind === "trip") return <TripDialog id={context.id} onClose={onClose} />;
  if (context.kind === "unavail") return <OutageDialog id={context.id} onClose={onClose} />;
  return <HumanEventDialog id={context.id} onClose={onClose} />;
}

export { FailureDialogContent, isFailureDialogKind, type FailureDialogKind };
