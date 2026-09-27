import { JSX } from "react";
import type { CommonCauseFailureGroup, SystemBasicEvent, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { DialogHead } from "./syShared";
import { ListEditor } from "./SySystemDialogs";
import { CCF_MODELS, SHARED_CAUSE_KEYS, SHARED_CAUSE_LABELS, toExp } from "./syViewData";
import {
  SUPPORTED_CCF_MODELS,
  ccfFactors,
  defaultCcfParameters,
  estimateFactorText,
  estimateParameters,
  isSupportedCcfModel,
  linkedEstimate,
  memberProbability,
  parametersFromValues,
  totalFailureProbability,
  validateCcfGroup,
  withTotalProbability,
  type SupportedCcfModel,
} from "./syCcf";
import { systemTree } from "./syFailureRecords";
import { useSyWorkbook, type SyControlledCcfEstimateOption } from "./syWorkbookContext";

type SharedCauseKey = typeof SHARED_CAUSE_KEYS[number];

const EXCLUDED_MEMBER_MODES = new Set(["COMMON_CAUSE_FAILURE", "HUMAN_ERROR", "TEST_MAINTENANCE"]);

const MGL_INPUT_LABELS = ["Beta", "Gamma", "Delta"];

function estimateKey(workbookId: string, estimateId: string): string {
  return JSON.stringify([workbookId, estimateId]);
}

function estimateLabel(option: SyControlledCcfEstimateOption): string {
  return `${option.workbookName} · ${option.estimateId} for ${option.groupReference} · ${CCF_MODELS[option.modelType]?.label ?? option.modelType} ${estimateFactorText(option)}`;
}

function listOrUndefined(items: string[]): string[] | undefined {
  return items.length === 0 ? undefined : items;
}

function factorCount(modelType: string, memberCount: number): number {
  if (modelType === "BETA_FACTOR") return 1;
  if (modelType === "MGL") return Math.max(1, memberCount - 1);
  return Math.max(2, memberCount);
}

function factorLabel(modelType: string, index: number): string {
  if (modelType === "BETA_FACTOR") return "Beta";
  if (modelType === "MGL") return MGL_INPUT_LABELS[index] ?? `Factor ${index + 1}`;
  return `${modelType === "ALPHA_FACTOR" ? "Alpha" : "Phi"} ${index + 1}`;
}

function componentsOf(events: readonly SystemBasicEvent[]): string[] {
  return [...new Set(events.map((event) => event.componentReference ?? event.code ?? event.uuid))];
}

function withMemberTotal(group: CommonCauseFailureGroup, analysis: SystemsAnalysis): CommonCauseFailureGroup {
  const total = memberProbability(group, analysis);
  const parameters = total === null ? null : withTotalProbability(group, total);
  return parameters === null ? group : { ...group, modelSpecificParameters: parameters };
}

function CommonCauseDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, controlledCcfEstimates } = useSyWorkbook();
  const found = sy.commonCauseFailureGroups.find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const group = found;
  const ownerId = group.affectedSystems[0] ?? "";
  const coupled = group.affectedSystems.slice(1);
  const reference = group.dataAnalysisCCFParameterRef ?? "";
  const linked = reference.length > 0;
  const estimate = linkedEstimate(group, controlledCcfEstimates);
  const issues = validateCcfGroup(group, sy, controlledCcfEstimates);
  const memberIds = group.members?.basicEvents.map((member) => member.id) ?? [];
  const scopeSystems = group.scope === "INTERSYSTEM" ? group.affectedSystems : [ownerId];
  const listed = new Set<string>();
  const memberSets = scopeSystems.map((systemId) => {
    const events = systemTree(sy, systemId).events.filter((event) => !EXCLUDED_MEMBER_MODES.has(event.failureMode ?? "") && !listed.has(event.uuid));
    events.forEach((event) => listed.add(event.uuid));
    return { systemId, events };
  });
  const strays = memberIds.filter((memberId) => !listed.has(memberId));
  const eventById = new Map(sy.systemBasicEvents.map((event) => [event.uuid, event]));
  const shared = group.sharedCauseFactors ?? {};
  const factorValues = ccfFactors(group).map((factor) => factor.value);
  const typedCount = factorCount(group.modelType, memberIds.length);
  const sr = group.scope === "INTRASYSTEM" ? "SY-B1, B3, B4" : "SY-B2, B3, B4";
  const selectedKey = estimate === undefined ? "" : estimateKey(estimate.workbookId, estimate.estimateId);

  function commit(fields: Partial<CommonCauseFailureGroup>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      commonCauseFailureGroups: draft.commonCauseFailureGroups.map((candidate) => (candidate.uuid === group.uuid ? withMemberTotal({ ...candidate, ...fields }, draft) : candidate)),
    }));
  }

  function currentTotal(): number {
    return memberProbability(group, sy) ?? totalFailureProbability(group) ?? 0;
  }

  function setMembers(ids: string[]): void {
    const unique = [...new Set(ids)];
    commit({
      members: { basicEvents: unique.map((memberId) => ({ id: memberId })) },
      affectedComponents: componentsOf(unique.flatMap((memberId) => {
        const event = eventById.get(memberId);
        return event === undefined ? [] : [event];
      })),
    });
  }

  function toggleMember(memberId: string, checked: boolean): void {
    setMembers(checked ? [...memberIds, memberId] : memberIds.filter((candidate) => candidate !== memberId));
  }

  function setScope(value: string): void {
    const scope = value === "INTERSYSTEM" ? "INTERSYSTEM" : "INTRASYSTEM";
    if (scope === group.scope) return;
    const from = scope === "INTERSYSTEM" ? "SY-B1" : "SY-B2";
    const to = scope === "INTERSYSTEM" ? "SY-B2" : "SY-B1";
    commit({
      scope,
      affectedSystems: [ownerId],
      implementsSrs: group.implementsSrs.map((item) => (item.sr === from ? { ...item, sr: to } : item)),
    });
  }

  function toggleCoupled(systemId: string, checked: boolean): void {
    const next = checked ? [...coupled, systemId] : coupled.filter((candidate) => candidate !== systemId);
    commit({ affectedSystems: [ownerId, ...next] });
  }

  function toggleShared(key: SharedCauseKey, checked: boolean): void {
    commit({ sharedCauseFactors: { ...shared, [key]: checked ? true : undefined } });
  }

  function applyEstimate(option: SyControlledCcfEstimateOption): void {
    commit({
      dataAnalysisCCFParameterRef: option.estimateId,
      modelType: option.modelType,
      modelSpecificParameters: estimateParameters(option, currentTotal()),
      dataSources: undefined,
    });
  }

  function pickSource(key: string): void {
    if (key === "") {
      commit({ dataAnalysisCCFParameterRef: undefined });
      return;
    }
    const option = controlledCcfEstimates.find((candidate) => estimateKey(candidate.workbookId, candidate.estimateId) === key);
    if (option !== undefined) applyEstimate(option);
  }

  function setModel(value: string): void {
    const modelType: SupportedCcfModel = isSupportedCcfModel(value) ? value : "BETA_FACTOR";
    if (modelType === group.modelType) return;
    commit({ modelType, modelSpecificParameters: defaultCcfParameters(modelType, memberIds.length, currentTotal()) });
  }

  function setFactor(index: number, text: string): void {
    const value = Number(text);
    if (text.trim().length === 0 || !Number.isFinite(value)) return;
    const modelType: SupportedCcfModel = isSupportedCcfModel(group.modelType) ? group.modelType : "BETA_FACTOR";
    const values = Array.from({ length: typedCount }, (_, position) => (position === index ? value : (factorValues[position] ?? 0)));
    commit({ modelType, modelSpecificParameters: parametersFromValues(modelType, values, currentTotal()) });
  }

  function setTypedSource(text: string): void {
    const value = text.trim();
    commit({ dataSources: value.length === 0 ? undefined : [{ reference: value, description: group.dataSources?.[0]?.description ?? "Common cause parameter source", dataType: group.dataSources?.[0]?.dataType ?? "generic" }] });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({
      ...draft,
      commonCauseFailureGroups: draft.commonCauseFailureGroups.filter((candidate) => candidate.uuid !== group.uuid),
    }));
  }

  function memberCheck(event: SystemBasicEvent): JSX.Element {
    return (
      <label key={event.uuid} className="sy-dialog-check">
        <input type="checkbox" checked={memberIds.includes(event.uuid)} disabled={!editable} onChange={(change) => toggleMember(event.uuid, change.target.checked)} />
        <span>{event.name}</span>{" "}<span className="posmono">{event.probability === undefined ? "No probability" : toExp(event.probability)}</span>
      </label>
    );
  }

  return (
    <>
      <DialogHead cap={`Common cause group · ${shortOf(ownerId)} · ${sr}`} title={group.name.length > 0 ? group.name : "New common cause group"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Group name" value={group.name} onChange={(change) => commit({ name: change.target.value })} /> : <div>{group.name}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Scope</label>
            {editable ? (
              <select className="posfield__select" aria-label="Scope" value={group.scope} onChange={(change) => setScope(change.target.value)}>
                <option value="INTRASYSTEM">Within this system</option>
                <option value="INTERSYSTEM">Across systems</option>
              </select>
            ) : <div>{group.scope === "INTRASYSTEM" ? "Within this system" : "Across systems"}</div>}
          </div>
          {group.scope === "INTERSYSTEM" && (
            <div className="posfield posfield-grid--span2" role="group" aria-label="Coupled systems">
              <span className="posfield__label">Coupled systems</span>
              <div className="sy-dialog-checks">
                {sy.systemDefinitions.filter((system) => system.uuid !== ownerId).map((system) => (
                  <label key={system.uuid} className="sy-dialog-check">
                    <input type="checkbox" checked={coupled.includes(system.uuid)} disabled={!editable} onChange={(change) => toggleCoupled(system.uuid, change.target.checked)} />
                    <span>{system.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {memberSets.map(({ systemId, events }) => (
            <div key={systemId} className="posfield posfield-grid--span2" role="group" aria-label={`Member events in ${shortOf(systemId)}`}>
              <span className="posfield__label">Member events in {sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? shortOf(systemId)}</span>
              {events.length === 0 && <span className="posmuted">No component events in this fault tree. Build it in Step 02 first.</span>}
              <div className="sy-dialog-checks">{events.map(memberCheck)}</div>
            </div>
          ))}
          {strays.length > 0 && (
            <div className="posfield posfield-grid--span2" role="group" aria-label="Members outside these fault trees">
              <span className="posfield__label">Members outside these fault trees</span>
              <div className="sy-dialog-checks">
                {strays.map((memberId) => (
                  <label key={memberId} className="sy-dialog-check">
                    <input type="checkbox" checked disabled={!editable} onChange={(change) => toggleMember(memberId, change.target.checked)} />
                    <span>{eventById.get(memberId)?.name ?? memberId}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="posfield posfield-grid--span2" role="group" aria-label="Shared causes">
            <span className="posfield__label">Shared causes</span>
            <div className="sy-dialog-checks">
              {SHARED_CAUSE_KEYS.map((key) => (
                <label key={key} className="sy-dialog-check">
                  <input type="checkbox" checked={shared[key] === true} disabled={!editable} onChange={(change) => toggleShared(key, change.target.checked)} />
                  <span>{SHARED_CAUSE_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="posfield-grid--span2">
            <ListEditor label="Other shared causes" items={shared.otherFactors ?? []} editable={editable} addLabel="Add a shared cause" onChange={(items) => commit({ sharedCauseFactors: { ...shared, otherFactors: listOrUndefined(items) } })} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Grouping basis</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Grouping basis" value={group.groupSelectionBasis ?? group.description} onChange={(change) => commit({ description: change.target.value, groupSelectionBasis: change.target.value })} /> : <div>{group.groupSelectionBasis ?? group.description}</div>}
          </div>
          <div className="posfield-grid--span2">
            <ListEditor label="Defenses" items={group.defenseMechanisms ?? []} editable={editable} addLabel="Add a defense" onChange={(items) => commit({ defenseMechanisms: listOrUndefined(items) })} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">DA common cause estimate</label>
            {controlledCcfEstimates.length === 0 && !linked ? <span className="posmuted">Link a DA workbook in Interfaces to pick its common cause estimate.</span> : editable ? (
              <select className="posfield__select" aria-label="DA common cause estimate" value={linked && estimate === undefined ? reference : selectedKey} onChange={(change) => pickSource(change.target.value)}>
                <option value="">Not linked, typed below</option>
                {linked && estimate === undefined && <option value={reference}>{reference} · linked estimate unavailable</option>}
                {controlledCcfEstimates.map((option) => {
                  const key = estimateKey(option.workbookId, option.estimateId);
                  return <option key={key} value={key}>{estimateLabel(option)}</option>;
                })}
              </select>
            ) : <div>{estimate === undefined ? (linked ? reference : "Not linked") : estimateLabel(estimate)}</div>}
          </div>
          {!linked && (
            <>
              <div className="posfield"><label className="posfield__label">Model</label>
                {editable ? (
                  <select className="posfield__select" aria-label="Model" value={group.modelType} onChange={(change) => setModel(change.target.value)}>
                    {SUPPORTED_CCF_MODELS.map((modelType) => <option key={modelType} value={modelType}>{CCF_MODELS[modelType]?.label ?? modelType}</option>)}
                  </select>
                ) : <div>{CCF_MODELS[group.modelType]?.label ?? group.modelType}</div>}
              </div>
              {Array.from({ length: typedCount }, (_, index) => {
                const label = factorLabel(group.modelType, index);
                const value = factorValues[index];
                return (
                  <div key={label} className="posfield"><label className="posfield__label">{label}</label>
                    {editable
                      ? <WorkbookInput className="posfield__input posmono" type="number" min="0" max="1" step="any" aria-label={label} value={value ?? ""} onChange={(change) => setFactor(index, change.target.value)} />
                      : <div className="posmono">{value ?? ""}</div>}
                  </div>
                );
              })}
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Parameter source</label>
                {editable ? <WorkbookInput className="posfield__input" aria-label="Parameter source" value={group.dataSources?.[0]?.reference ?? ""} onChange={(change) => setTypedSource(change.target.value)} /> : <div>{group.dataSources?.[0]?.reference ?? ""}</div>}
              </div>
            </>
          )}
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Risk significance</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Risk significance" value={group.riskSignificanceJustification ?? ""} onChange={(change) => commit({ riskSignificanceJustification: change.target.value.trim().length > 0 ? change.target.value : undefined })} /> : <div>{group.riskSignificanceJustification ?? ""}</div>}
          </div>
          {issues.length > 0 && (
            <div className="posfield posfield-grid--span2 sy-event-review" role="group" aria-label="Setup problems">
              {issues.map((issue) => (
                <p key={`${issue.code}:${issue.message}`} className={issue.severity === "ERROR" ? "sy-error" : "sy-warn"}>{issue.message}</p>
              ))}
              {editable && issues.some((issue) => issue.code === "CCF_TOTAL_MISMATCH") && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => commit({})}>Use the member probability</button>}
              {editable && estimate !== undefined && issues.some((issue) => issue.code === "CCF_DA_STALE") && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => applyEstimate(estimate)}>Apply the DA values</button>}
            </div>
          )}
        </div>
        {editable && <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove group</button></div>}
      </div>
    </>
  );
}

export { CommonCauseDialog };
