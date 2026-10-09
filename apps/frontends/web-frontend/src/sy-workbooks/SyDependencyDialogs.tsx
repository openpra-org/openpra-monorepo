import { JSX, useState } from "react";
import type {
  DepletionModel,
  DigitalInstrumentationAndControl,
  EnvironmentalDesignBasisConsideration,
  InitiationActuationSystem,
  SupportSystemNeedAnalysis,
  SupportSystemSuccessCriteria,
  SystemBasicEvent,
  SystemDependency,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { DialogHead } from "./syShared";
import { useSystemHours } from "./syMissionTimes";
import { hoursPoint, hoursText } from "../sc-workbooks/scMissionTimePoints";
import { ListEditor } from "./SySystemDialogs";
import { RESOURCE_TYPE_LABELS } from "./syViewData";
import { systemTree } from "./syFailureRecords";
import {
  DEPENDENCY_TREATMENTS,
  DEPENDENCY_TREATMENT_LABELS,
  SUPPORT_KINDS,
  SUPPORT_KIND_LABELS,
  dependencyLinks,
  inventoryHours,
  isSupportKind,
  linkIsCredited,
  linkIssues,
  linkKey,
  treatmentOf,
} from "./syDependencyLinks";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

type DependencyDialogKind = "dep" | "ssc" | "need" | "spc" | "inv" | "act" | "dic" | "method";

const DEPENDENCY_DIALOG_KINDS: readonly DependencyDialogKind[] = ["dep", "ssc", "need", "spc", "inv", "act", "dic", "method"];

const RESOURCE_TYPES: readonly DepletionModel["resourceType"][] = ["battery", "air", "coolant", "fuel", "other"];

const EXCLUDED_EVENT_MODES = new Set(["COMMON_CAUSE_FAILURE", "HUMAN_ERROR", "TEST_MAINTENANCE"]);

function isDependencyDialogKind(kind: SyDrawerContext["kind"]): kind is DependencyDialogKind {
  return DEPENDENCY_DIALOG_KINDS.some((candidate) => candidate === kind);
}

function listOrUndefined(items: string[]): string[] | undefined {
  return items.length === 0 ? undefined : items;
}

function textOrUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}

function RemoveAction({ label, onRemove }: { label: string; onRemove: () => void }): JSX.Element {
  return <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={onRemove}>{label}</button></div>;
}

function DependencyDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, links } = useSyWorkbook();
  const found = sy.systemDependencies.find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const record = found;
  const allLinks = dependencyLinks(sy, links);
  const link = allLinks.find((candidate) => linkKey(candidate.dependentSystem, candidate.supportingSystem) === linkKey(record.dependentSystem, record.supportingSystem));
  const treatment = link === undefined ? record.modeledIn : treatmentOf(record, link);
  const issues = link === undefined ? [] : linkIssues(link, record, sy, allLinks);
  const nameOf = (systemId: string): string => sy.systemDefinitions.find((candidate) => candidate.uuid === systemId)?.name ?? systemId;
  const missingReason = treatment === "EXCLUDED" && (record.exclusionJustification ?? "").trim().length === 0;
  const sr = record.supportKind === "OPERATOR_INTERFACE" ? "SY-B5, B13, B15" : "SY-B5, B9, B13";

  function patch(fields: Partial<SystemDependency>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      systemDependencies: draft.systemDependencies.map((candidate) => (candidate.uuid === record.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function setKind(value: string): void {
    if (!isSupportKind(value)) {
      patch({ supportKind: undefined });
      return;
    }
    patch({ supportKind: value, type: value === "OPERATOR_INTERFACE" ? "HUMAN" : "FUNCTIONAL" });
  }

  function setTreatment(value: string): void {
    const next = DEPENDENCY_TREATMENTS.find((candidate) => candidate === value);
    patch(next === "EXCLUDED" ? { modeledIn: next } : { modeledIn: next, exclusionJustification: undefined });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, systemDependencies: draft.systemDependencies.filter((candidate) => candidate.uuid !== record.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Support dependency · ${shortOf(record.dependentSystem)} · ${sr}`} title={`${nameOf(record.dependentSystem)} needs ${nameOf(record.supportingSystem)}`} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield"><label className="posfield__label">Support system</label>
            {editable ? (
              <select className="posfield__select" aria-label="Support system" value={record.supportingSystem} onChange={(change) => patch({ supportingSystem: change.target.value })}>
                {sy.systemDefinitions.filter((system) => system.uuid !== record.dependentSystem).map((system) => (
                  <option key={system.uuid} value={system.uuid}>{shortOf(system.uuid)} · {system.name}</option>
                ))}
              </select>
            ) : <div>{nameOf(record.supportingSystem)}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Kind of support</label>
            {editable ? (
              <select className="posfield__select" aria-label="Kind of support" value={record.supportKind ?? ""} onChange={(change) => setKind(change.target.value)}>
                <option value="">Not recorded</option>
                {SUPPORT_KINDS.map((kind) => <option key={kind} value={kind}>{SUPPORT_KIND_LABELS[kind]}</option>)}
              </select>
            ) : <div>{record.supportKind === undefined ? "Not recorded" : SUPPORT_KIND_LABELS[record.supportKind]}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">What it provides</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="What it provides" value={record.details ?? ""} onChange={(change) => patch({ details: textOrUndefined(change.target.value) })} /> : <div>{record.details ?? ""}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Effect when it is lost</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Effect when it is lost" value={record.impact ?? ""} onChange={(change) => patch({ impact: textOrUndefined(change.target.value) })} /> : <div>{record.impact ?? ""}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Treatment</label>
            {editable ? (
              <select className="posfield__select" aria-label="Treatment" value={treatment ?? ""} onChange={(change) => setTreatment(change.target.value)}>
                {treatment === undefined && <option value="">Not recorded</option>}
                {DEPENDENCY_TREATMENTS.map((candidate) => <option key={candidate} value={candidate}>{DEPENDENCY_TREATMENT_LABELS[candidate]}</option>)}
              </select>
            ) : <div>{treatment === undefined ? "Not recorded" : DEPENDENCY_TREATMENT_LABELS[treatment]}</div>}
          </div>
          {treatment === "EXCLUDED" && (
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Why it can be left out</label>
              {editable ? (
                <>
                  <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Why it can be left out" aria-invalid={missingReason} value={record.exclusionJustification ?? ""} onChange={(change) => patch({ exclusionJustification: textOrUndefined(change.target.value) })} />
                  <span className="posmuted">Base it on an engineering analysis. A recovery procedure alone is not a reason (SY-B13).</span>
                </>
              ) : <div>{record.exclusionJustification ?? ""}</div>}
            </div>
          )}
          {issues.length > 0 && (
            <div className="posfield posfield-grid--span2 sy-event-review" role="group" aria-label="Setup problems">
              {issues.map((issue) => <p key={`${issue.code}:${issue.message}`} className={issue.severity === "ERROR" ? "sy-error" : "sy-warn"}>{issue.message}</p>)}
            </div>
          )}
        </div>
        {editable && <RemoveAction label="Remove dependency" onRemove={remove} />}
      </div>
    </>
  );
}

function CriterionDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, links } = useSyWorkbook();
  const found = (sy.supportSystemSuccessCriteria ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const criterion = found;
  const dependents = dependencyLinks(sy, links)
    .filter((link) => link.supportingSystem === criterion.systemReference && linkIsCredited(link))
    .map((link) => link.dependentSystem);
  const choices = [...new Set([...dependents, ...criterion.supportedSystems])];

  function patch(fields: Partial<SupportSystemSuccessCriteria>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      supportSystemSuccessCriteria: (draft.supportSystemSuccessCriteria ?? []).map((candidate) => (candidate.uuid === criterion.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function toggle(systemId: string, checked: boolean): void {
    patch({ supportedSystems: checked ? [...criterion.supportedSystems, systemId] : criterion.supportedSystems.filter((candidate) => candidate !== systemId) });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, supportSystemSuccessCriteria: (draft.supportSystemSuccessCriteria ?? []).filter((candidate) => candidate.uuid !== criterion.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Support success criterion · ${shortOf(criterion.systemReference)} · SY-B7, B9`} title={sy.systemDefinitions.find((system) => system.uuid === criterion.systemReference)?.name ?? "Support success criterion"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Criterion and timing</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Criterion and timing" value={criterion.successCriteria} onChange={(change) => patch({ successCriteria: change.target.value })} /> : <div>{criterion.successCriteria}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Basis</label>
            {editable ? (
              <select className="posfield__select" aria-label="Basis" value={criterion.criteriaType} onChange={(change) => patch({ criteriaType: change.target.value === "REALISTIC" ? "REALISTIC" : "CONSERVATIVE" })}>
                <option value="CONSERVATIVE">Conservative</option>
                <option value="REALISTIC">Realistic</option>
              </select>
            ) : <div>{criterion.criteriaType === "REALISTIC" ? "Realistic" : "Conservative"}</div>}
          </div>
          <div className="posfield posfield-grid--span2" role="group" aria-label="Serves">
            <span className="posfield__label">Serves</span>
            {choices.length === 0 && <span className="posmuted">No system transfers to this one yet.</span>}
            <div className="sy-dialog-checks">
              {choices.map((systemId) => (
                <label key={systemId} className="sy-dialog-check">
                  <input type="checkbox" checked={criterion.supportedSystems.includes(systemId)} disabled={!editable} onChange={(change) => toggle(systemId, change.target.checked)} />
                  <span>{sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? systemId}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {editable && <RemoveAction label="Remove criterion" onRemove={remove} />}
      </div>
    </>
  );
}

function NeedAnalysisDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.supportSystemNeedAnalyses ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const analysis = found;

  function patch(fields: Partial<SupportSystemNeedAnalysis>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      supportSystemNeedAnalyses: (draft.supportSystemNeedAnalyses ?? []).map((candidate) => (candidate.uuid === analysis.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, supportSystemNeedAnalyses: (draft.supportSystemNeedAnalyses ?? []).filter((candidate) => candidate.uuid !== analysis.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Support need analysis · ${shortOf(analysis.systemReference)} · SY-B6`} title={analysis.analysisReference.length > 0 ? analysis.analysisReference : "New analysis"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield"><label className="posfield__label">Analysis</label>
          {editable ? <WorkbookInput className="posfield__input" aria-label="Analysis" value={analysis.analysisReference} onChange={(change) => patch({ analysisReference: change.target.value })} /> : <div>{analysis.analysisReference}</div>}
        </div>
        <ListEditor label="Conditions it covers" items={analysis.conditionsRepresented} editable={editable} addLabel="Add a condition, such as an operating state or sequence" onChange={(items) => patch({ conditionsRepresented: items })} />
        {editable && <RemoveAction label="Remove analysis" onRemove={remove} />}
      </div>
    </>
  );
}

function componentsOf(events: readonly SystemBasicEvent[]): string[] {
  return [...new Set(events.map((event) => event.componentReference ?? event.code ?? event.uuid))];
}

function CouplingDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, links } = useSyWorkbook();
  const found = (sy.environmentalDesignBasisConsiderations ?? []).find((candidate) => candidate.uuid === id);
  const [shown, setShown] = useState<string[]>([]);
  if (found === undefined) return null;
  const item = found;
  const picked = item.basicEventIds ?? [];
  const eventById = new Map(sy.systemBasicEvents.map((event) => [event.uuid, event]));
  const ownerOf = new Map(sy.systemLogicModels.flatMap((model) => model.leafNodes.flatMap((leaf) => (leaf.kind === "BASIC_EVENT_REFERENCE" ? [[leaf.basicEventId, model.systemReference] as const] : []))));
  const systemsWithPicks = picked.flatMap((eventId) => {
    const owner = ownerOf.get(eventId);
    return owner === undefined ? [] : [owner];
  });
  const openSystems = [...new Set([item.systemReference, ...systemsWithPicks, ...shown])];
  const initiating = links?.esInitiatingEvents ?? [];
  const knownInitiating = new Set(initiating.map((event) => event.id));
  const strayInitiating = (item.initiatingEventIds ?? []).filter((eventId) => !knownInitiating.has(eventId));

  function patch(fields: Partial<EnvironmentalDesignBasisConsideration>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      environmentalDesignBasisConsiderations: (draft.environmentalDesignBasisConsiderations ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function toggleEvent(eventId: string, checked: boolean): void {
    const next = checked ? [...picked, eventId] : picked.filter((candidate) => candidate !== eventId);
    patch({
      basicEventIds: next,
      components: componentsOf(next.flatMap((candidate) => {
        const event = eventById.get(candidate);
        return event === undefined ? [] : [event];
      })),
    });
  }

  function toggleInitiating(eventId: string, checked: boolean): void {
    const current = item.initiatingEventIds ?? [];
    patch({ initiatingEventIds: checked ? [...current, eventId] : current.filter((candidate) => candidate !== eventId) });
  }

  function toggleSystem(systemId: string, checked: boolean): void {
    setShown((current) => (checked ? [...current, systemId] : current.filter((candidate) => candidate !== systemId)));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, environmentalDesignBasisConsiderations: (draft.environmentalDesignBasisConsiderations ?? []).filter((candidate) => candidate.uuid !== item.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Shared condition · ${shortOf(item.systemReference)} · SY-B8, B14`} title={item.environmentalConditions.length > 0 ? item.environmentalConditions.split(". ")[0] ?? "Shared condition" : "New shared condition"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Condition and how it couples failures</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Condition and how it couples failures" value={item.environmentalConditions} onChange={(change) => patch({ environmentalConditions: change.target.value })} /> : <div>{item.environmentalConditions}</div>}
          </div>
          <div className="posfield posfield-grid--span2" role="group" aria-label="Systems it reaches">
            <span className="posfield__label">Systems it reaches</span>
            <div className="sy-dialog-checks">
              {sy.systemDefinitions.filter((system) => systemTree(sy, system.uuid).state === "TREE").map((system) => {
                const locked = system.uuid === item.systemReference || systemsWithPicks.includes(system.uuid);
                return (
                  <label key={system.uuid} className="sy-dialog-check">
                    <input type="checkbox" checked={openSystems.includes(system.uuid)} disabled={!editable || locked} onChange={(change) => toggleSystem(system.uuid, change.target.checked)} />
                    <span>{system.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {openSystems.map((systemId) => {
            const events = systemTree(sy, systemId).events.filter((event) => !EXCLUDED_EVENT_MODES.has(event.failureMode ?? ""));
            return (
              <div key={systemId} className="posfield posfield-grid--span2" role="group" aria-label={`Events it affects in ${shortOf(systemId)}`}>
                <span className="posfield__label">Events it affects in {sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? systemId}</span>
                {events.length === 0 && <span className="posmuted">No component events in this fault tree.</span>}
                <div className="sy-dialog-checks">
                  {events.map((event) => (
                    <label key={event.uuid} className="sy-dialog-check">
                      <input type="checkbox" checked={picked.includes(event.uuid)} disabled={!editable} onChange={(change) => toggleEvent(event.uuid, change.target.checked)} />
                      <span>{event.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="posfield posfield-grid--span2" role="group" aria-label="Initiating events">
            <span className="posfield__label">Initiating events where it arises</span>
            {initiating.length === 0 && strayInitiating.length === 0 && <span className="posmuted">Link the ES workbook in Step 01 Interfaces to pick its initiating events.</span>}
            <div className="sy-dialog-checks">
              {initiating.map((event) => (
                <label key={event.id} className="sy-dialog-check">
                  <input type="checkbox" checked={(item.initiatingEventIds ?? []).includes(event.id)} disabled={!editable} onChange={(change) => toggleInitiating(event.id, change.target.checked)} />
                  <span>{event.name}</span>{" "}<span className="posmono">{event.id}</span>
                </label>
              ))}
              {strayInitiating.map((eventId) => (
                <label key={eventId} className="sy-dialog-check">
                  <input type="checkbox" checked disabled={!editable} onChange={(change) => toggleInitiating(eventId, change.target.checked)} />
                  <span className="posmono">{eventId}</span>{" "}<span className="posmuted">Not in the linked ES workbook</span>
                </label>
              ))}
            </div>
          </div>
          <div className="posfield"><label className="posfield__label">In the model</label>
            {editable ? (
              <select className="posfield__select" aria-label="In the model" value={item.dependentFailuresIncluded === true ? "yes" : "no"} onChange={(change) => patch({ dependentFailuresIncluded: change.target.value === "yes" })}>
                <option value="yes">Yes</option>
                <option value="no">Not yet</option>
              </select>
            ) : <div>{item.dependentFailuresIncluded === true ? "Yes" : "Not yet"}</div>}
          </div>
          <label className="sy-dialog-check">
            <input type="checkbox" checked={item.beyondQualification === true} disabled={!editable} onChange={(change) => patch({ beyondQualification: change.target.checked ? true : undefined })} />
            <span>Beyond environmental qualification (SY-B14)</span>
          </label>
        </div>
        {editable && <RemoveAction label="Remove condition" onRemove={remove} />}
      </div>
    </>
  );
}

function InventoryDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.depletionModels ?? []).find((candidate) => candidate.uuid === id);
  const owner = sy.systemDefinitions.find((system) => system.uuid === found?.associatedSystem);
  const ownerHours = useSystemHours(owner === undefined ? [] : [owner]).get(owner?.uuid ?? "");
  const ownerPoint = hoursPoint(ownerHours);
  if (found === undefined) return null;
  const item = found;
  const depletes = item.initialQuantity > 0;
  const hours = inventoryHours(item);

  function patch(fields: Partial<DepletionModel>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      depletionModels: (draft.depletionModels ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function setHours(text: string): void {
    const value = Number(text);
    if (text.trim().length === 0 || !Number.isFinite(value) || value <= 0) return;
    patch({ initialQuantity: value, consumptionRate: 1, units: "hours" });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, depletionModels: (draft.depletionModels ?? []).filter((candidate) => candidate.uuid !== item.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Inventory · ${item.associatedSystem === undefined ? "Workbook" : shortOf(item.associatedSystem)} · SY-B12`} title={item.description !== undefined && item.description.length > 0 ? item.description : "New inventory"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Inventory</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Inventory" value={item.description ?? ""} onChange={(change) => patch({ description: textOrUndefined(change.target.value) })} /> : <div>{item.description ?? ""}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Type</label>
            {editable ? (
              <select className="posfield__select" aria-label="Type" value={item.resourceType} onChange={(change) => patch({ resourceType: RESOURCE_TYPES.find((type) => type === change.target.value) ?? "other" })}>
                {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{RESOURCE_TYPE_LABELS[type]}</option>)}
              </select>
            ) : <div>{RESOURCE_TYPE_LABELS[item.resourceType]}</div>}
          </div>
          <label className="sy-dialog-check">
            <input type="checkbox" checked={!depletes} disabled={!editable || (!depletes && ownerPoint === undefined)} onChange={(change) => { if (change.target.checked) patch({ initialQuantity: 0, consumptionRate: 1, units: "hours" }); else if (ownerPoint !== undefined) patch({ initialQuantity: ownerPoint, consumptionRate: 1, units: "hours" }); }} />
            <span>Does not deplete</span>
          </label>
          {depletes && (
            <div className="posfield"><label className="posfield__label">Lasts (hours)</label>
              {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" step="any" aria-label="Lasts (hours)" value={hours ?? ""} onChange={(change) => setHours(change.target.value)} /> : <div className="posmono">{hours ?? ""}</div>}
            </div>
          )}
          <div className="posfield"><label className="posfield__label">Carries the {owner?.missionTime === undefined ? "" : `${hoursText(ownerHours)} `}mission time</label>
            {editable ? (
              <select className="posfield__select" aria-label="Carries the mission time" value={item.missionTimeSupported === undefined ? "" : item.missionTimeSupported ? "yes" : "no"} onChange={(change) => patch({ missionTimeSupported: change.target.value === "" ? undefined : change.target.value === "yes" })}>
                <option value="">Not assessed</option>
                <option value="yes">Yes</option>
                <option value="no">No, falls short</option>
              </select>
            ) : <div>{item.missionTimeSupported === undefined ? "Not assessed" : item.missionTimeSupported ? "Yes" : "No, falls short"}</div>}
          </div>
          {depletes && (
            <div className="posfield"><label className="posfield__label">When it runs out</label>
              {editable ? (
                <select className="posfield__select" aria-label="When it runs out" value={item.depletionImpact ?? ""} onChange={(change) => patch({ depletionImpact: change.target.value === "immediate-failure" ? "immediate-failure" : change.target.value === "degraded-operation" ? "degraded-operation" : undefined })}>
                  <option value="">Not recorded</option>
                  <option value="immediate-failure">The system fails</option>
                  <option value="degraded-operation">The system runs degraded</option>
                </select>
              ) : <div>{item.depletionImpact === "immediate-failure" ? "The system fails" : item.depletionImpact === "degraded-operation" ? "The system runs degraded" : "Not recorded"}</div>}
            </div>
          )}
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Basis" value={item.basis ?? ""} onChange={(change) => patch({ basis: textOrUndefined(change.target.value) })} /> : <div>{item.basis ?? ""}</div>}
          </div>
        </div>
        {editable && <RemoveAction label="Remove inventory" onRemove={remove} />}
      </div>
    </>
  );
}

function ActuationDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.initiationActuationSystems ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const item = found;
  const missing = !item.detailedModeling && (item.justificationForNonDetailedModeling ?? "").trim().length === 0;

  function patch(fields: Partial<InitiationActuationSystem>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      initiationActuationSystems: (draft.initiationActuationSystems ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, initiationActuationSystems: (draft.initiationActuationSystems ?? []).filter((candidate) => candidate.uuid !== item.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Actuation · ${shortOf(item.systemReference)} · SY-B11`} title={item.name.length > 0 ? item.name : "New actuation record"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Name" value={item.name} onChange={(change) => patch({ name: change.target.value })} /> : <div>{item.name}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">How it initiates and actuates</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="How it initiates and actuates" value={item.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{item.description}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Modeled in detail</label>
            {editable ? (
              <select className="posfield__select" aria-label="Modeled in detail" value={item.detailedModeling ? "yes" : "no"} onChange={(change) => patch(change.target.value === "yes" ? { detailedModeling: true, justificationForNonDetailedModeling: undefined } : { detailedModeling: false })}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            ) : <div>{item.detailedModeling ? "Yes" : "No"}</div>}
          </div>
          {!item.detailedModeling && (
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Why a simpler model is enough</label>
              {editable ? (
                <>
                  <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Why a simpler model is enough" aria-invalid={missing} value={item.justificationForNonDetailedModeling ?? ""} onChange={(change) => patch({ justificationForNonDetailedModeling: textOrUndefined(change.target.value) })} />
                  {missing && <span className="sy-error" role="alert">Reason required</span>}
                </>
              ) : <div>{item.justificationForNonDetailedModeling ?? ""}</div>}
            </div>
          )}
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Software treatment</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Software treatment" value={item.softwareModelingApproach ?? ""} onChange={(change) => patch({ softwareModelingApproach: textOrUndefined(change.target.value) })} /> : <div>{item.softwareModelingApproach ?? ""}</div>}
          </div>
        </div>
        {editable && <RemoveAction label="Remove actuation record" onRemove={remove} />}
      </div>
    </>
  );
}

function DigitalDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.digitalInstrumentationAndControl ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const item = found;

  function patch(fields: Partial<DigitalInstrumentationAndControl>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      digitalInstrumentationAndControl: (draft.digitalInstrumentationAndControl ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, digitalInstrumentationAndControl: (draft.digitalInstrumentationAndControl ?? []).filter((candidate) => candidate.uuid !== item.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Digital I&C · ${shortOf(item.systemReference)} · SY-B11`} title={item.name.length > 0 ? item.name : "New digital I&C record"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Name" value={item.name} onChange={(change) => patch({ name: change.target.value })} /> : <div>{item.name}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">What it does</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="What it does" value={item.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{item.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">How the model treats it</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="How the model treats it" value={item.methodology} onChange={(change) => patch({ methodology: change.target.value })} /> : <div>{item.methodology}</div>}
          </div>
        </div>
        <ListEditor label="Failure modes" items={item.failureModes ?? []} editable={editable} addLabel="Add a failure mode" onChange={(items) => patch({ failureModes: listOrUndefined(items) })} />
        <ListEditor label="Special considerations" items={item.specialConsiderations ?? []} editable={editable} addLabel="Add a consideration" onChange={(items) => patch({ specialConsiderations: listOrUndefined(items) })} />
        <ListEditor label="Assumptions" items={item.assumptions ?? []} editable={editable} addLabel="Add an assumption" onChange={(items) => patch({ assumptions: listOrUndefined(items) })} />
        {editable && <RemoveAction label="Remove digital I&C record" onRemove={remove} />}
      </div>
    </>
  );
}

function SearchMethodDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const method = sy.dependencySearchMethodology;

  function patch(fields: Partial<SystemsAnalysis["dependencySearchMethodology"]>): void {
    if (!editable) return;
    mutateSy((draft) => ({ ...draft, dependencySearchMethodology: { ...draft.dependencySearchMethodology, ...fields } }));
  }

  return (
    <>
      <DialogHead cap="Dependency search · SY-B5, B10" title={method.name.length > 0 ? method.name : "Dependency search"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Name" value={method.name} onChange={(change) => patch({ name: change.target.value })} /> : <div>{method.name}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Method</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={4} aria-label="Method" value={method.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{method.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Reference</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Reference" value={method.reference} onChange={(change) => patch({ reference: change.target.value })} /> : <div>{method.reference}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

function DependencyDialogContent({ context, onClose }: { context: SyDrawerContext & { kind: DependencyDialogKind }; onClose: () => void }): JSX.Element | null {
  if (context.kind === "dep") return <DependencyDialog id={context.id} onClose={onClose} />;
  if (context.kind === "ssc") return <CriterionDialog id={context.id} onClose={onClose} />;
  if (context.kind === "need") return <NeedAnalysisDialog id={context.id} onClose={onClose} />;
  if (context.kind === "spc") return <CouplingDialog id={context.id} onClose={onClose} />;
  if (context.kind === "inv") return <InventoryDialog id={context.id} onClose={onClose} />;
  if (context.kind === "act") return <ActuationDialog id={context.id} onClose={onClose} />;
  if (context.kind === "dic") return <DigitalDialog id={context.id} onClose={onClose} />;
  return <SearchMethodDialog onClose={onClose} />;
}

export { DependencyDialogContent, isDependencyDialogKind, type DependencyDialogKind };
