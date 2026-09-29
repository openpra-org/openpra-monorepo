import { JSX } from "react";
import type {
  ComponentBoundaryReview,
  ModelValidation,
  ModularizationRecord,
  NomenclatureDesignator,
  SystemConfirmationRecord,
} from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { DialogHead, ReviewLines } from "./syShared";
import { ListEditor } from "./SySystemDialogs";
import { CONFIRM_METHODS } from "./syViewData";
import {
  BOUNDARY_NOTE_LABELS,
  BOUNDARY_STATUSES,
  BOUNDARY_STATUS_LABELS,
  DESIGNATOR_KIND_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  boundaryRows,
  designatorIssues,
  detailIssues,
  isComponentEvent,
  moduleIssues,
  recordIssues,
  treeEvents,
  type IntegrityIssue,
} from "./syIntegrityChecks";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

type IntegrityDialogKind = "confirm" | "detail" | "cbound" | "module" | "naming" | "convention";

const INTEGRITY_DIALOG_KINDS: readonly IntegrityDialogKind[] = ["confirm", "detail", "cbound", "module", "naming", "convention"];

const CONFIRM_METHOD_KEYS: readonly SystemConfirmationRecord["method"][] = ["DISCUSSIONS", "PLANT_INVESTIGATION", "WALKDOWN", "DESIGN_REVIEW"];

function isIntegrityDialogKind(kind: SyDrawerContext["kind"]): kind is IntegrityDialogKind {
  return INTEGRITY_DIALOG_KINDS.some((candidate) => candidate === kind);
}

function textOrUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}

function RemoveAction({ label, onRemove }: { label: string; onRemove: () => void }): JSX.Element {
  return <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={onRemove}>{label}</button></div>;
}

function ProblemList({ issues }: { issues: readonly IntegrityIssue[] }): JSX.Element | null {
  if (issues.length === 0) return null;
  return (
    <div className="posfield posfield-grid--span2 sy-event-review" role="group" aria-label="Setup problems">
      {issues.map((item) => <p key={`${item.code}:${item.message}`} className={item.severity === "ERROR" ? "sy-error" : "sy-warn"}>{item.message}</p>)}
    </div>
  );
}

function ConfirmationDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.systemConfirmationRecords ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const record = found;
  const systemId = record.systemReference ?? "";
  const sr = sy.plantStage === "OPERATIONAL" ? "SY-A5" : "SY-A6";

  function patch(fields: Partial<SystemConfirmationRecord>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      systemConfirmationRecords: (draft.systemConfirmationRecords ?? []).map((candidate) => (candidate.uuid === record.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, systemConfirmationRecords: (draft.systemConfirmationRecords ?? []).filter((candidate) => candidate.uuid !== record.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Confirmation against the plant · ${shortOf(systemId)} · ${sr}`} title={sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? "Confirmation record"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield"><label className="posfield__label">Method</label>
            {editable ? (
              <select className="posfield__select" aria-label="Method" value={record.method} onChange={(change) => patch({ method: CONFIRM_METHOD_KEYS.find((method) => method === change.target.value) ?? "DESIGN_REVIEW" })}>
                {CONFIRM_METHOD_KEYS.map((method) => <option key={method} value={method}>{CONFIRM_METHODS[method]}</option>)}
              </select>
            ) : <div>{CONFIRM_METHODS[record.method] ?? record.method}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Date</label>
            {editable ? <WorkbookInput className="posfield__input posmono" type="date" aria-label="Date" value={record.date} onChange={(change) => patch({ date: change.target.value })} /> : <div className="posmono">{record.date}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Findings</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Findings" value={record.findings} onChange={(change) => patch({ findings: change.target.value })} /> : <div>{record.findings}</div>}
          </div>
          <ProblemList issues={recordIssues(record)} />
        </div>
        <ListEditor label="Who took part" items={record.personnelRoles} editable={editable} addLabel="Add a role, such as systems analyst or plant operator" onChange={(items) => patch({ personnelRoles: items })} />
        {editable && <RemoveAction label="Remove record" onRemove={remove} />}
      </div>
    </>
  );
}

function DetailDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.modelValidations ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const record = found;
  const sr = sy.plantStage === "OPERATIONAL" ? "SY-A9, A10" : "SY-A9, A11";

  function patch(fields: Partial<ModelValidation>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      modelValidations: (draft.modelValidations ?? []).map((candidate) => (candidate.uuid === record.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, modelValidations: (draft.modelValidations ?? []).filter((candidate) => candidate.uuid !== record.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Level of detail · ${shortOf(record.systemReference)} · ${sr}`} title={sy.systemDefinitions.find((system) => system.uuid === record.systemReference)?.name ?? "Level of detail"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">What the model includes</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="What the model includes" value={record.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{record.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Finding</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Finding" value={record.results} onChange={(change) => patch({ results: change.target.value })} /> : <div>{record.results}</div>}
          </div>
          <ProblemList issues={detailIssues(record).filter((item) => item.code !== "DETAIL_OPEN")} />
        </div>
        <ListEditor label="Checked against" items={record.techniques} editable={editable} addLabel="Add a check, such as a design document or a cut set review" onChange={(items) => patch({ techniques: items })} />
        <ListEditor label="Open issues" items={record.issuesIdentified ?? []} editable={editable} addLabel="Add an open issue" onChange={(items) => patch({ issuesIdentified: items.length === 0 ? undefined : items })} />
        {editable && <RemoveAction label="Remove review" onRemove={remove} />}
      </div>
    </>
  );
}

function BoundaryDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, controlledParameters, controlledComponentBoundaries } = useSyWorkbook();
  const found = (sy.componentBoundaryReviews ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const review = found;
  const row = boundaryRows(sy, review.systemReference, controlledParameters, controlledComponentBoundaries).find((candidate) => candidate.review?.uuid === review.uuid);
  const boundary = row?.boundary ?? controlledComponentBoundaries.find((candidate) => candidate.boundaryId === review.componentBoundaryRef);
  const preOperational = sy.plantStage !== "OPERATIONAL";

  function patch(fields: Partial<ComponentBoundaryReview>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      componentBoundaryReviews: (draft.componentBoundaryReviews ?? []).map((candidate) => (candidate.uuid === review.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function setStatus(value: string): void {
    const status = BOUNDARY_STATUSES.find((candidate) => candidate === value) ?? "MATCHES";
    patch({ status, implementsSrs: status === "NOT_VERIFIED" ? [{ sr: "SY-A12", hlr: "A" }, { sr: "SY-A13", hlr: "A" }] : [{ sr: "SY-A12", hlr: "A" }] });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, componentBoundaryReviews: (draft.componentBoundaryReviews ?? []).filter((candidate) => candidate.uuid !== review.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Component boundary · ${shortOf(review.systemReference)} · ${preOperational ? "SY-A12, A13" : "SY-A12"}`} title={boundary?.name ?? review.componentBoundaryRef} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><span className="posfield__label">Modeled events</span>
            <ReviewLines items={(row?.events ?? []).map((event) => `${event.code} · ${event.name}`)} />
          </div>
          {boundary !== undefined && (
            <>
              <div className="posfield"><span className="posfield__label">Data boundary includes</span><ReviewLines items={boundary.includedItems} /></div>
              <div className="posfield"><span className="posfield__label">Data boundary leaves out</span><ReviewLines items={boundary.excludedItems} /></div>
            </>
          )}
          <div className="posfield"><label className="posfield__label">Review</label>
            {editable ? (
              <select className="posfield__select" aria-label="Review" value={review.status} onChange={(change) => setStatus(change.target.value)}>
                {BOUNDARY_STATUSES.filter((status) => preOperational || status !== "NOT_VERIFIED" || review.status === status).map((status) => <option key={status} value={status}>{BOUNDARY_STATUS_LABELS[status]}</option>)}
              </select>
            ) : <div>{BOUNDARY_STATUS_LABELS[review.status]}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">{BOUNDARY_NOTE_LABELS[review.status]}</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label={BOUNDARY_NOTE_LABELS[review.status]} value={review.note ?? ""} onChange={(change) => patch({ note: textOrUndefined(change.target.value) })} /> : <div>{review.note ?? ""}</div>}
          </div>
          <ProblemList issues={row?.issues ?? []} />
        </div>
        {editable && <RemoveAction label="Remove review" onRemove={remove} />}
      </div>
    </>
  );
}

function ModuleDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.modularizationRecords ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const record = found;
  const picked = record.basicEventIds ?? [];
  const events = treeEvents(sy, record.systemReference).filter(isComponentEvent);
  const shown = new Set(events.map((event) => event.uuid));
  const stray = picked.filter((eventId) => !shown.has(eventId));
  const codeOf = (eventId: string): string => sy.systemBasicEvents.find((event) => event.uuid === eventId)?.code ?? eventId;

  function patch(fields: Partial<ModularizationRecord>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      modularizationRecords: (draft.modularizationRecords ?? []).map((candidate) => (candidate.uuid === record.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function toggle(eventId: string, checked: boolean): void {
    patch({ basicEventIds: checked ? [...picked, eventId] : picked.filter((candidate) => candidate !== eventId) });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, modularizationRecords: (draft.modularizationRecords ?? []).filter((candidate) => candidate.uuid !== record.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Supercomponent · ${shortOf(record.systemReference)} · SY-A14`} title={record.moduleId.length > 0 ? record.moduleId : "New supercomponent"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Name" value={record.moduleId} onChange={(change) => patch({ moduleId: change.target.value })} /> : <div>{record.moduleId}</div>}
          </div>
          <div className="posfield posfield-grid--span2" role="group" aria-label="Events that stand for it">
            <span className="posfield__label">Events that stand for it</span>
            {events.length === 0 && stray.length === 0 && <span className="posmuted">No component events in this fault tree.</span>}
            <div className="sy-dialog-checks">
              {events.map((event) => (
                <label key={event.uuid} className="sy-dialog-check">
                  <input type="checkbox" checked={picked.includes(event.uuid)} disabled={!editable} onChange={(change) => toggle(event.uuid, change.target.checked)} />
                  <span className="posmono">{event.code}</span>
                </label>
              ))}
              {stray.map((eventId) => (
                <label key={eventId} className="sy-dialog-check">
                  <input type="checkbox" checked disabled={!editable} onChange={(change) => toggle(eventId, change.target.checked)} />
                  <span className="posmono">{codeOf(eventId)}</span>{" "}<span className="posmuted">Not in this fault tree</span>
                </label>
              ))}
            </div>
          </div>
          <label className="sy-dialog-check">
            <input type="checkbox" checked={record.avoidsMixedRecoveryPotential} disabled={!editable} onChange={(change) => patch({ avoidsMixedRecoveryPotential: change.target.checked })} />
            <span>Its components share one recovery potential</span>
          </label>
          <label className="sy-dialog-check">
            <input type="checkbox" checked={record.avoidsEventsRequiredByOtherSystems} disabled={!editable} onChange={(change) => patch({ avoidsEventsRequiredByOtherSystems: change.target.checked })} />
            <span>No other system needs its events</span>
          </label>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Basis" value={record.justification} onChange={(change) => patch({ justification: change.target.value })} /> : <div>{record.justification}</div>}
          </div>
          <ProblemList issues={moduleIssues(sy, record)} />
        </div>
        <ListEditor label="Components it stands for" items={record.representedComponentIds} editable={editable} addLabel="Add a component" onChange={(items) => patch({ representedComponentIds: items })} />
        {editable && <RemoveAction label="Remove supercomponent" onRemove={remove} />}
      </div>
    </>
  );
}

function DesignatorDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, controlledFailureModes } = useSyWorkbook();
  const found = (sy.nomenclatureDesignators ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const designator = found;
  const failureModeNames = new Map(controlledFailureModes.map((mode) => [mode.failureModeId, mode.name]));
  const modeIds = [...new Set(controlledFailureModes.map((mode) => mode.failureModeId))];
  const refs = designator.failureModeRefs ?? [];
  const strayModes = refs.filter((ref) => !modeIds.includes(ref));

  function patch(fields: Partial<NomenclatureDesignator>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      nomenclatureDesignators: (draft.nomenclatureDesignators ?? []).map((candidate) => (candidate.uuid === designator.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function setSystem(systemId: string): void {
    const system = sy.systemDefinitions.find((candidate) => candidate.uuid === systemId);
    patch(system === undefined ? { systemReference: undefined, meaning: "" } : { systemReference: system.uuid, meaning: system.name });
  }

  function toggleMode(modeId: string, checked: boolean): void {
    patch({ failureModeRefs: checked ? [...refs, modeId] : refs.filter((candidate) => candidate !== modeId) });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, nomenclatureDesignators: (draft.nomenclatureDesignators ?? []).filter((candidate) => candidate.uuid !== designator.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`${DESIGNATOR_KIND_LABELS[designator.kind]} · SY-A30`} title={designator.designator.length > 0 ? designator.designator : "New designator"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield"><label className="posfield__label">{designator.kind === "SYSTEM" ? "Code" : "Designator"}</label>
            {editable ? <WorkbookInput className="posfield__input posmono" aria-label={designator.kind === "SYSTEM" ? "Code" : "Designator"} value={designator.designator} onChange={(change) => patch({ designator: change.target.value.trim().toUpperCase() })} /> : <div className="posmono">{designator.designator}</div>}
          </div>
          {designator.kind === "SYSTEM" ? (
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" aria-label="System" value={designator.systemReference ?? ""} onChange={(change) => setSystem(change.target.value)}>
                  {designator.systemReference === undefined && <option value="">Pick a system</option>}
                  {sy.systemDefinitions.map((system) => <option key={system.uuid} value={system.uuid}>{shortOf(system.uuid)} · {system.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((system) => system.uuid === designator.systemReference)?.name ?? ""}</div>}
            </div>
          ) : (
            <div className="posfield"><label className="posfield__label">Meaning</label>
              {editable ? <WorkbookInput className="posfield__input" aria-label="Meaning" value={designator.meaning} onChange={(change) => patch({ meaning: change.target.value })} /> : <div>{designator.meaning}</div>}
            </div>
          )}
          {designator.kind === "EVENT_TYPE" && (
            <div className="posfield"><label className="posfield__label">Event type</label>
              {editable ? (
                <select className="posfield__select" aria-label="Event type" value={designator.eventType ?? ""} onChange={(change) => patch({ eventType: EVENT_TYPES.find((type) => type === change.target.value) })}>
                  {designator.eventType === undefined && <option value="">Pick an event type</option>}
                  {EVENT_TYPES.map((type) => <option key={type} value={type}>{EVENT_TYPE_LABELS[type]}</option>)}
                </select>
              ) : <div>{designator.eventType === undefined ? "" : EVENT_TYPE_LABELS[designator.eventType]}</div>}
            </div>
          )}
          {designator.kind === "FAILURE_MODE" && (
            <div className="posfield posfield-grid--span2" role="group" aria-label="DA failure modes">
              <span className="posfield__label">DA failure modes it stands for</span>
              {modeIds.length === 0 && strayModes.length === 0 && <span className="posmuted">Link the DA workbook in Step 01 Interfaces to pick its failure modes.</span>}
              <div className="sy-dialog-checks">
                {modeIds.map((modeId) => (
                  <label key={modeId} className="sy-dialog-check">
                    <input type="checkbox" checked={refs.includes(modeId)} disabled={!editable} onChange={(change) => toggleMode(modeId, change.target.checked)} />
                    <span>{failureModeNames.get(modeId) ?? modeId}</span>
                  </label>
                ))}
                {strayModes.map((modeId) => (
                  <label key={modeId} className="sy-dialog-check">
                    <input type="checkbox" checked disabled={!editable} onChange={(change) => toggleMode(modeId, change.target.checked)} />
                    <span className="posmono">{modeId}</span>{" "}<span className="posmuted">Not in the linked DA workbook</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <ProblemList issues={designatorIssues(sy, designator, failureModeNames)} />
        </div>
        {editable && <RemoveAction label="Remove designator" onRemove={remove} />}
      </div>
    </>
  );
}

function ConventionDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const convention = sy.documentation.nomenclatureConventions;
  return (
    <>
      <DialogHead cap="Naming scheme · SY-A30" title="Naming convention" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield"><label className="posfield__label">How event codes are built</label>
          {editable ? <WorkbookTextarea className="posfield__textarea" rows={4} aria-label="How event codes are built" value={convention} onChange={(change) => {
            const value = change.target.value;
            mutateSy((draft) => ({ ...draft, documentation: { ...draft.documentation, nomenclatureConventions: value } }));
          }} /> : <div>{convention}</div>}
        </div>
      </div>
    </>
  );
}

function IntegrityDialogContent({ context, onClose }: { context: SyDrawerContext & { kind: IntegrityDialogKind }; onClose: () => void }): JSX.Element | null {
  if (context.kind === "confirm") return <ConfirmationDialog id={context.id} onClose={onClose} />;
  if (context.kind === "detail") return <DetailDialog id={context.id} onClose={onClose} />;
  if (context.kind === "cbound") return <BoundaryDialog id={context.id} onClose={onClose} />;
  if (context.kind === "module") return <ModuleDialog id={context.id} onClose={onClose} />;
  if (context.kind === "naming") return <DesignatorDialog id={context.id} onClose={onClose} />;
  return <ConventionDialog onClose={onClose} />;
}

export { IntegrityDialogContent, isIntegrityDialogKind, type IntegrityDialogKind };
