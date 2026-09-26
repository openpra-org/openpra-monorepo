import { JSX, useState } from "react";
import type { SystemAlignment, SystemDefinition, SystemsAnalysis, VariableSuccessCriterion } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { SYIcon } from "./syIcons";
import { DialogHead } from "./syShared";
import { isSystemLevelModel } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

type SystemDialogKind = "system" | "sysdef" | "variant" | "alignment" | "boundary" | "states" | "operations";

const SYSTEM_DIALOG_KINDS: readonly SystemDialogKind[] = ["system", "sysdef", "variant", "alignment", "boundary", "states", "operations"];

function isSystemDialogKind(kind: SyDrawerContext["kind"]): kind is SystemDialogKind {
  return SYSTEM_DIALOG_KINDS.some((candidate) => candidate === kind);
}

function referencedSystemIds(sy: SystemsAnalysis): Set<string> {
  const ids = new Set<string>();
  sy.systemLogicModels.forEach((model) => {
    if (model.gates.length > 0 || model.leafNodes.length > 0) ids.add(model.systemReference);
  });
  sy.systemDependencies.forEach((dependency) => {
    ids.add(dependency.dependentSystem);
    ids.add(dependency.supportingSystem);
  });
  sy.commonCauseFailureGroups.forEach((group) => group.affectedSystems.forEach((id) => ids.add(id)));
  sy.humanFailureEventIntegrations.forEach((integration) => ids.add(integration.system));
  (sy.componentScreeningJustifications ?? []).forEach((item) => ids.add(item.systemReference));
  (sy.supportSystemSuccessCriteria ?? []).forEach((item) => {
    ids.add(item.systemReference);
    item.supportedSystems.forEach((id) => ids.add(id));
  });
  (sy.environmentalDesignBasisConsiderations ?? []).forEach((item) => ids.add(item.systemReference));
  (sy.depletionModels ?? []).forEach((item) => { if (item.associatedSystem !== undefined) ids.add(item.associatedSystem); });
  (sy.digitalInstrumentationAndControl ?? []).forEach((item) => ids.add(item.systemReference));
  (sy.overCapacityConsiderations ?? []).forEach((item) => ids.add(item.system));
  (sy.systemConfirmationRecords ?? []).forEach((item) => { if (item.systemReference !== undefined) ids.add(item.systemReference); });
  (sy.uncertaintyAnalyses ?? []).forEach((item) => ids.add(item.system));
  (sy.variableSuccessCriteria ?? []).forEach((item) => ids.add(item.systemReference));
  (sy.preOperationalAssumptions ?? []).forEach((item) => item.affectedElementIds.forEach((id) => ids.add(id)));
  return ids;
}

function ListEditor({ label, items, editable, addLabel, onChange }: {
  label: string;
  items: readonly string[];
  editable: boolean;
  addLabel: string;
  onChange: (items: string[]) => void;
}): JSX.Element {
  const [draft, setDraft] = useState("");
  function add(): void {
    const value = draft.trim();
    if (value.length > 0) onChange([...items, value]);
    setDraft("");
  }
  return (
    <div className="posfield sy-dialog-list">
      <span className="posfield__label">{label}</span>
      {items.length === 0 && <span className="posmuted">None recorded.</span>}
      {items.map((item, index) => (
        <div key={`${index}:${item}`} className="sy-dialog-list__row">
          {editable ? (
            <>
              <WorkbookInput className="posfield__input" aria-label={`${label} ${index + 1}`} value={item} onChange={(event) => {
                const value = event.target.value.trim();
                onChange(value.length === 0 ? items.filter((_, position) => position !== index) : items.map((candidate, position) => (position === index ? value : candidate)));
              }} />
              <button type="button" className="sy-icon-btn" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))}><SYIcon.Close /></button>
            </>
          ) : <span>{item}</span>}
        </div>
      ))}
      {editable && (
        <div className="sy-dialog-list__row">
          <input className="posfield__input" aria-label={addLabel} placeholder={addLabel} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={draft.trim().length === 0} onClick={add}><SYIcon.Plus /> Add</button>
        </div>
      )}
    </div>
  );
}

function SystemDialogContent({ context, onClose }: { context: SyDrawerContext & { kind: SystemDialogKind }; onClose: () => void }): JSX.Element | null {
  const { sy, links, editable, mutateSy, shortOf } = useSyWorkbook();

  function patchSystem(uuid: string, fields: Partial<SystemDefinition>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      systemDefinitions: draft.systemDefinitions.map((candidate) => (candidate.uuid === uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  if (context.kind === "system") {
    const def = sy.systemDefinitions.find((candidate) => candidate.uuid === context.id);
    if (def === undefined) return null;
    const system = def;
    const mapping = sy.systemToSafetyFunctionMappings.find((candidate) => candidate.systemReference === system.uuid);
    const functions = mapping?.safetyFunctions ?? [];
    const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === system.uuid);
    const systemLevel = model !== undefined && isSystemLevelModel(model);
    const justification = model?.nonDetailedModelJustification ?? "";
    const inUse = referencedSystemIds(sy).has(system.uuid);
    const esFunctions = links?.esSafetyFunctions ?? [];
    const functionOptions = Array.from(new Set([...esFunctions.map((sf) => sf.id), ...functions]));
    const functionNames = new Map(esFunctions.map((sf) => [sf.id, sf.name]));

    const setFunctions = (next: string[]): void => {
      if (!editable) return;
      mutateSy((draft) => {
        const existing = draft.systemToSafetyFunctionMappings.find((candidate) => candidate.systemReference === system.uuid);
        if (existing === undefined) {
          return {
            ...draft,
            systemToSafetyFunctionMappings: [...draft.systemToSafetyFunctionMappings, {
              uuid: `MAP-${system.uuid}`,
              systemReference: system.uuid,
              safetyFunctions: next,
              eventSequences: [],
              implementsSrs: [{ sr: "SY-A1", hlr: "A" }],
            }],
          };
        }
        return {
          ...draft,
          systemToSafetyFunctionMappings: draft.systemToSafetyFunctionMappings.map((candidate) => (candidate.uuid === existing.uuid ? { ...candidate, safetyFunctions: next } : candidate)),
        };
      });
    };

    const setDepth = (depth: "DETAILED" | "SYSTEM_LEVEL"): void => {
      if (!editable) return;
      mutateSy((draft) => {
        const current = draft.systemLogicModels.find((candidate) => candidate.systemReference === system.uuid);
        if (current === undefined) {
          if (depth === "DETAILED") return draft;
          return {
            ...draft,
            systemLogicModels: [...draft.systemLogicModels, {
              uuid: crypto.randomUUID(),
              code: `FT-${system.abbreviation ?? system.name}`,
              name: `${system.name} system-level model`,
              systemReference: system.uuid,
              description: system.description ?? system.name,
              modelRepresentation: "System-level",
              nonDetailedModelJustification: "",
              topGate: null,
              gates: [],
              leafNodes: [],
              gateInputs: [],
              nodePositions: [],
              layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
              implementsSrs: [{ sr: "SY-A9", hlr: "A" }],
            }],
          };
        }
        return {
          ...draft,
          systemLogicModels: draft.systemLogicModels.map((candidate) => {
            if (candidate.uuid !== current.uuid) return candidate;
            if (depth === "SYSTEM_LEVEL") return { ...candidate, modelRepresentation: "System-level", nonDetailedModelJustification: typeof candidate.nonDetailedModelJustification === "string" ? candidate.nonDetailedModelJustification : "" };
            const { nonDetailedModelJustification: _justification, ...detailed } = candidate;
            return { ...detailed, modelRepresentation: "Fault tree" };
          }),
        };
      });
    };

    const remove = (): void => {
      if (!editable || inUse) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        systemDefinitions: draft.systemDefinitions.filter((candidate) => candidate.uuid !== system.uuid),
        systemToSafetyFunctionMappings: draft.systemToSafetyFunctionMappings.filter((candidate) => candidate.systemReference !== system.uuid),
        systemLogicModels: draft.systemLogicModels.filter((candidate) => candidate.systemReference !== system.uuid),
      }));
    };

    return (
      <>
        <DialogHead cap="System in scope · SY-A1, A9" title={system.name} onClose={onClose} />
        <div className="modal__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <WorkbookInput className="posfield__input" aria-label="System name" value={system.name} onChange={(event) => { if (event.target.value.trim().length > 0) patchSystem(system.uuid, { name: event.target.value.trim() }); }} /> : <div>{system.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Code</label>
              {editable ? <WorkbookInput className="posfield__input posmono" aria-label="System code" value={system.abbreviation ?? ""} onChange={(event) => patchSystem(system.uuid, { abbreviation: event.target.value.trim().length > 0 ? event.target.value.trim() : undefined })} /> : <div className="posmono">{system.abbreviation ?? ""}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Model depth</label>
              {editable ? (
                <select className="posfield__select" aria-label="Model depth" value={systemLevel ? "SYSTEM_LEVEL" : "DETAILED"} onChange={(event) => setDepth(event.target.value === "SYSTEM_LEVEL" ? "SYSTEM_LEVEL" : "DETAILED")}>
                  <option value="DETAILED">Detailed fault tree</option>
                  <option value="SYSTEM_LEVEL">System-level model</option>
                </select>
              ) : <div>{systemLevel ? "System-level model" : "Detailed fault tree"}</div>}
            </div>
            {systemLevel && model !== undefined && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Why a system-level model is enough</label>
                {editable ? (
                  <>
                    <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="System-level justification" aria-invalid={justification.trim().length === 0} value={justification} onChange={(event) => mutateSy((draft) => ({
                      ...draft,
                      systemLogicModels: draft.systemLogicModels.map((candidate) => (candidate.uuid === model.uuid ? { ...candidate, nonDetailedModelJustification: event.target.value } : candidate)),
                    }))} />
                    {justification.trim().length === 0 && <span className="sy-error" role="alert">Justification required</span>}
                  </>
                ) : <div>{justification}</div>}
              </div>
            )}
            <div className="posfield posfield-grid--span2" role="group" aria-label="Safety functions">
              <span className="posfield__label">Safety functions</span>
              {functionOptions.length === 0 && <span className="posmuted">Link an ES workbook in Interfaces to choose the safety functions.</span>}
              <div className="sy-dialog-checks">
                {functionOptions.map((id) => (
                  <label key={id} className="sy-dialog-check">
                    <input type="checkbox" checked={functions.includes(id)} disabled={!editable} onChange={(event) => setFunctions(event.target.checked ? [...functions, id] : functions.filter((candidate) => candidate !== id))} />
                    <span className="posmono">{id}</span>{functionNames.has(id) && <span>{functionNames.get(id)}</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>
          {editable && (
            <div className="posrow sy-dialog-actions">
              {inUse && <span className="posmuted">Other records use this system, so it cannot be removed.</span>}
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={inUse} onClick={remove}><SYIcon.Close /> Remove system</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "sysdef") {
    const def = sy.systemDefinitions.find((candidate) => candidate.uuid === context.id);
    if (def === undefined) return null;
    const system = def;
    const setTopEvent = (value: string): void => {
      if (!editable) return;
      const description = value.trim().length > 0 ? value : undefined;
      mutateSy((draft) => ({
        ...draft,
        systemDefinitions: draft.systemDefinitions.map((candidate) => (candidate.uuid === system.uuid ? { ...candidate, description } : candidate)),
        systemLogicModels: draft.systemLogicModels.map((candidate) => (candidate.systemReference === system.uuid && description !== undefined ? { ...candidate, description } : candidate)),
      }));
    };
    const scCriteria = links?.scSystems ?? [];
    const scId = system.successCriteriaIds[0] ?? "";
    const scOptions = scId.length === 0 || scCriteria.some((criterion) => criterion.id === scId)
      ? scCriteria
      : [...scCriteria, { id: scId, systemId: system.uuid, name: scId, capacities: "" }];
    const setScCriterion = (id: string): void => {
      if (!editable) return;
      const criterion = scCriteria.find((candidate) => candidate.id === id);
      if (criterion === undefined) {
        patchSystem(system.uuid, { successCriteriaIds: [] });
        return;
      }
      const description = `${criterion.name} fails to meet its success criterion`;
      mutateSy((draft) => ({
        ...draft,
        systemDefinitions: draft.systemDefinitions.map((candidate) => (candidate.uuid !== system.uuid ? candidate : {
          ...candidate,
          successCriteriaIds: [criterion.id],
          description,
          successCriterion: criterion.capacities.length > 0 ? criterion.capacities : candidate.successCriterion,
        })),
        systemLogicModels: draft.systemLogicModels.map((candidate) => (candidate.systemReference === system.uuid ? { ...candidate, description } : candidate)),
      }));
    };
    const scMissionTimes = links?.scMissionTimes ?? [];
    const missionRef = system.missionTimeRef ?? "";
    const missionOptions = missionRef.length === 0 || scMissionTimes.some((missionTime) => missionTime.id === missionRef)
      ? scMissionTimes
      : [...scMissionTimes, { id: missionRef, hours: system.missionTimeHours ?? 0, sequence: "", basis: "" }];
    const setMissionSource = (id: string): void => {
      const missionTime = scMissionTimes.find((candidate) => candidate.id === id);
      if (missionTime === undefined) patchSystem(system.uuid, { missionTimeRef: undefined });
      else patchSystem(system.uuid, { missionTimeRef: missionTime.id, missionTimeHours: missionTime.hours });
    };
    return (
      <>
        <DialogHead cap={`System definition · ${shortOf(system.uuid)}`} title={system.name} onClose={onClose} />
        <div className="modal__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">SC criterion</label>
              {scOptions.length === 0 ? <span className="posmuted">Link an SC workbook in Interfaces to use its system success criteria.</span> : (
                <select className="posfield__select" aria-label="SC criterion" value={scId} disabled={!editable} onChange={(event) => setScCriterion(event.target.value)}>
                  <option value="">Typed</option>
                  {scOptions.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.name}</option>)}
                </select>
              )}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Top event</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Top event" value={system.description ?? ""} onChange={(event) => setTopEvent(event.target.value)} /> : <div>{system.description ?? ""}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Success criterion</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Success criterion" value={system.successCriterion ?? ""} onChange={(event) => patchSystem(system.uuid, { successCriterion: event.target.value.trim().length > 0 ? event.target.value : undefined })} /> : <div>{system.successCriterion ?? ""}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">SC mission time</label>
              {missionOptions.length === 0 ? <span className="posmuted">Link an SC workbook in Interfaces to use its mission times.</span> : (
                <select className="posfield__select" aria-label="SC mission time" value={missionRef} disabled={!editable} onChange={(event) => setMissionSource(event.target.value)}>
                  <option value="">Typed</option>
                  {missionOptions.map((missionTime) => <option key={missionTime.id} value={missionTime.id}>{missionTime.id} · {missionTime.hours} h{missionTime.sequence.length > 0 ? ` · ${missionTime.sequence}` : ""}</option>)}
                </select>
              )}
            </div>
            {missionRef.length === 0 && (
              <div className="posfield"><label className="posfield__label">Mission time (h)</label>
                {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" step="any" aria-label="Mission time (h)" value={system.missionTimeHours ?? ""} onChange={(event) => {
                  const hours = Number(event.target.value);
                  if (event.target.value.trim().length === 0) patchSystem(system.uuid, { missionTimeHours: undefined });
                  else if (Number.isFinite(hours) && hours > 0) patchSystem(system.uuid, { missionTimeHours: hours });
                }} /> : <div className="posmono">{system.missionTimeHours ?? ""}</div>}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "variant") {
    const variant = (sy.variableSuccessCriteria ?? []).find((candidate) => candidate.uuid === context.id);
    if (variant === undefined) return null;
    const item = variant;
    const system = sy.systemDefinitions.find((candidate) => candidate.uuid === item.systemReference);
    const posNames = new Map((links?.posStates ?? []).map((state) => [state.id, state.name]));
    const posOptions = Array.from(new Set([...(links?.posStates ?? []).map((state) => state.id), ...(system?.applicablePlantOperatingStates ?? []), ...(item.plantOperatingStateId === undefined ? [] : [item.plantOperatingStateId])]));
    const patch = (fields: Partial<VariableSuccessCriterion>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        variableSuccessCriteria: (draft.variableSuccessCriteria ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({ ...draft, variableSuccessCriteria: (draft.variableSuccessCriteria ?? []).filter((candidate) => candidate.uuid !== item.uuid) }));
    };
    const scCriteria = links?.scSystems ?? [];
    const variantScId = item.successCriteriaIds[0] ?? "";
    const variantScOptions = variantScId.length === 0 || scCriteria.some((criterion) => criterion.id === variantScId)
      ? scCriteria
      : [...scCriteria, { id: variantScId, systemId: item.systemReference, name: variantScId, capacities: "" }];
    const setVariantSource = (id: string): void => {
      const criterion = scCriteria.find((candidate) => candidate.id === id);
      if (criterion === undefined) patch({ successCriteriaIds: [] });
      else patch({ successCriteriaIds: [criterion.id], basis: criterion.capacities.length > 0 ? criterion.capacities : item.basis });
    };
    return (
      <>
        <DialogHead cap="Success criterion by operating state · SY-A15" title={system?.name ?? "Success criterion"} onClose={onClose} />
        <div className="modal__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Operating state</label>
              {editable ? (
                <select className="posfield__select" aria-label="Operating state" value={item.plantOperatingStateId ?? ""} onChange={(event) => patch({ plantOperatingStateId: event.target.value.length > 0 ? event.target.value : undefined })}>
                  <option value="">Any state</option>
                  {posOptions.map((id) => <option key={id} value={id}>{id}{posNames.has(id) ? ` · ${posNames.get(id)}` : ""}</option>)}
                </select>
              ) : <div>{item.plantOperatingStateId ?? "Any state"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Condition</label>
              {editable ? <WorkbookInput className="posfield__input" aria-label="Condition" value={item.scenarioCondition ?? ""} onChange={(event) => patch({ scenarioCondition: event.target.value.trim().length > 0 ? event.target.value.trim() : undefined })} /> : <div>{item.scenarioCondition ?? ""}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">SC criterion</label>
              {variantScOptions.length === 0 ? <span className="posmuted">Link an SC workbook in Interfaces to use its system success criteria.</span> : (
                <select className="posfield__select" aria-label="Variant SC criterion" value={variantScId} disabled={!editable} onChange={(event) => setVariantSource(event.target.value)}>
                  <option value="">Typed</option>
                  {variantScOptions.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.name}</option>)}
                </select>
              )}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Success criterion</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Variant success criterion" value={item.basis} onChange={(event) => patch({ basis: event.target.value })} /> : <div>{item.basis}</div>}
            </div>
          </div>
          {editable && <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove variant</button></div>}
        </div>
      </>
    );
  }

  if (context.kind === "alignment") {
    const owner = sy.systemDefinitions.find((candidate) => (candidate.alignments ?? []).some((alignment) => alignment.uuid === context.id));
    const alignment = owner?.alignments?.find((candidate) => candidate.uuid === context.id);
    if (owner === undefined || alignment === undefined) return null;
    const system = owner;
    const item = alignment;
    const missing = !item.modeled && (item.justificationIfNotModeled ?? "").trim().length === 0;
    const patch = (fields: Partial<SystemAlignment>): void => {
      patchSystem(system.uuid, { alignments: (system.alignments ?? []).map((candidate) => (candidate.uuid === item.uuid ? { ...candidate, ...fields } : candidate)) });
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      patchSystem(system.uuid, { alignments: (system.alignments ?? []).filter((candidate) => candidate.uuid !== item.uuid) });
    };
    return (
      <>
        <DialogHead cap={`Alignment · ${shortOf(system.uuid)} · SY-A7`} title={item.name} onClose={onClose} />
        <div className="modal__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Alignment</label>
              {editable ? <WorkbookInput className="posfield__input" aria-label="Alignment name" value={item.name} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ name: event.target.value.trim() }); }} /> : <div>{item.name}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Alignment description" value={item.description ?? ""} onChange={(event) => patch({ description: event.target.value.trim().length > 0 ? event.target.value : undefined })} /> : <div>{item.description ?? ""}</div>}
            </div>
            <label className="sy-dialog-check"><input type="checkbox" checked={item.isNormalAlignment} disabled={!editable} onChange={(event) => patch({ isNormalAlignment: event.target.checked })} /><span>Normal alignment</span></label>
            <label className="sy-dialog-check"><input type="checkbox" checked={item.modeled} disabled={!editable} onChange={(event) => patch(event.target.checked ? { modeled: true, justificationIfNotModeled: undefined } : { modeled: false })} /><span>Modeled in the fault tree</span></label>
            {!item.modeled && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Why it is not modeled</label>
                {editable ? (
                  <>
                    <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Why the alignment is not modeled" aria-invalid={missing} value={item.justificationIfNotModeled ?? ""} onChange={(event) => patch({ justificationIfNotModeled: event.target.value.trim().length > 0 ? event.target.value : undefined })} />
                    {missing && <span className="sy-error" role="alert">Reason required</span>}
                  </>
                ) : <div>{item.justificationIfNotModeled ?? ""}</div>}
              </div>
            )}
          </div>
          {editable && <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove alignment</button></div>}
        </div>
      </>
    );
  }

  const def = sy.systemDefinitions.find((candidate) => candidate.uuid === context.id);
  if (def === undefined) return null;
  const system = def;

  if (context.kind === "boundary") {
    return (
      <>
        <DialogHead cap={`Model boundary · ${shortOf(system.uuid)} · SY-A8`} title={system.name} onClose={onClose} />
        <div className="modal__body">
          <ListEditor label="Boundary" items={system.boundaries} editable={editable} addLabel="Add boundary item" onChange={(boundaries) => patchSystem(system.uuid, { boundaries })} />
        </div>
      </>
    );
  }

  if (context.kind === "states") {
    const applicable = system.applicablePlantOperatingStates ?? [];
    const posNames = new Map((links?.posStates ?? []).map((state) => [state.id, state.name]));
    const options = Array.from(new Set([...(links?.posStates ?? []).map((state) => state.id), ...applicable]));
    return (
      <>
        <DialogHead cap={`Operating states · ${shortOf(system.uuid)}`} title={system.name} onClose={onClose} />
        <div className="modal__body">
          <div className="posfield" role="group" aria-label="Operating states">
            <span className="posfield__label">States where this system model applies</span>
            {options.length === 0 && <span className="posmuted">Link a POS workbook in Step 01 Interfaces to choose operating states.</span>}
            <div className="sy-dialog-checks">
              {options.map((id) => (
                <label key={id} className="sy-dialog-check">
                  <input type="checkbox" checked={applicable.includes(id)} disabled={!editable} onChange={(event) => patchSystem(system.uuid, { applicablePlantOperatingStates: event.target.checked ? [...applicable, id] : applicable.filter((candidate) => candidate !== id) })} />
                  <span className="posmono">{id}</span>{posNames.has(id) && <span>{posNames.get(id)}</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHead cap={`Operation and maintenance · ${shortOf(system.uuid)} · SY-A3`} title={system.name} onClose={onClose} />
      <div className="modal__body">
        <ListEditor label="Operating procedures" items={system.operatingProcedures ?? []} editable={editable} addLabel="Add procedure" onChange={(operatingProcedures) => patchSystem(system.uuid, { operatingProcedures })} />
        <ListEditor label="Test and maintenance" items={system.testAndMaintenanceProcedures ?? []} editable={editable} addLabel="Add test or maintenance activity" onChange={(testAndMaintenanceProcedures) => patchSystem(system.uuid, { testAndMaintenanceProcedures })} />
        <ListEditor label="Operating limits" items={system.operatingLimitations ?? []} editable={editable} addLabel="Add operating limit" onChange={(operatingLimitations) => patchSystem(system.uuid, { operatingLimitations })} />
      </div>
    </>
  );
}

export { SystemDialogContent, isSystemDialogKind, referencedSystemIds, type SystemDialogKind };
