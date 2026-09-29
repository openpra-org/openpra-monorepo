import { JSX, useState } from "react";
import type { SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import type { SystemsAnalysis, SystemUncertaintyAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { SYIcon } from "./syIcons";
import { DialogHead } from "./syShared";
import {
  PLANT_LISTS,
  ccfSourceIssues,
  ccfSources,
  dependencySourceIssues,
  dependencySources,
  modelSourceIssues,
  modelSources,
  plantItemIssues,
  plantItems,
  relatedCcfGroups,
  sourceOptions,
  sourceSystem,
  studyIssues,
  type PlantList,
  type UncertaintyIssue,
} from "./syUncertainty";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

type UncertaintyDialogKind = "unc" | "uccf" | "udep" | "sens" | "puc";

const UNCERTAINTY_DIALOG_KINDS: readonly UncertaintyDialogKind[] = ["unc", "uccf", "udep", "sens", "puc"];

function isUncertaintyDialogKind(kind: SyDrawerContext["kind"]): kind is UncertaintyDialogKind {
  return UNCERTAINTY_DIALOG_KINDS.some((candidate) => candidate === kind);
}

function textOrUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}

function RemoveAction({ label, onRemove }: { label: string; onRemove: () => void }): JSX.Element {
  return <div className="posrow sy-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={onRemove}>{label}</button></div>;
}

function ProblemList({ issues }: { issues: readonly UncertaintyIssue[] }): JSX.Element | null {
  if (issues.length === 0) return null;
  return (
    <div className="posfield posfield-grid--span2 sy-event-review" role="group" aria-label="Setup problems">
      {issues.map((item) => <p key={`${item.code}:${item.message}`} className={item.severity === "ERROR" ? "sy-error" : "sy-warn"}>{item.message}</p>)}
    </div>
  );
}

function updateAnalyses(draft: SystemsAnalysis, change: (analysis: SystemUncertaintyAnalysis) => SystemUncertaintyAnalysis): SystemsAnalysis {
  return { ...draft, uncertaintyAnalyses: (draft.uncertaintyAnalyses ?? []).map(change) };
}

function withoutStudiesOf(draft: SystemsAnalysis, uncertaintyId: string): SystemsAnalysis {
  const studies = draft.sensitivityStudies;
  return studies === undefined ? draft : { ...draft, sensitivityStudies: studies.filter((study) => study.modelUncertaintyId !== uncertaintyId) };
}

function ModelSourceDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const systemId = sourceSystem(sy, id);
  const found = systemId === undefined ? undefined : modelSources(sy, systemId).find((item) => item.uncertaintyId === id);
  if (found === undefined || systemId === undefined) return null;
  const item = found;

  function patch(fields: Partial<typeof item>): void {
    if (!editable) return;
    mutateSy((draft) => updateAnalyses(draft, (analysis) => ({
      ...analysis,
      modelUncertainties: analysis.modelUncertainties.map((candidate) => (candidate.uncertaintyId === id ? { ...candidate, ...fields } : candidate)),
    })));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => withoutStudiesOf(updateAnalyses(draft, (analysis) => ({
      ...analysis,
      modelUncertainties: analysis.modelUncertainties.filter((candidate) => candidate.uncertaintyId !== id),
    })), id));
  }

  return (
    <>
      <DialogHead cap={`Model uncertainty · ${shortOf(systemId)} · SY-A32`} title={sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? "Model uncertainty"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Source and the assumption made</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Source and the assumption made" value={item.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{item.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Effect on the results</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Effect on the results" value={item.impact} onChange={(change) => patch({ impact: change.target.value })} /> : <div>{item.impact}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">How it is treated</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="How it is treated" value={item.treatmentApproach} onChange={(change) => patch({ treatmentApproach: change.target.value })} /> : <div>{item.treatmentApproach}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Quantified</label>
            {editable ? (
              <select className="posfield__select" aria-label="Quantified" value={item.isQuantified ? "yes" : "no"} onChange={(change) => patch({ isQuantified: change.target.value === "yes" })}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            ) : <div>{item.isQuantified ? "Yes" : "No"}</div>}
          </div>
          <ProblemList issues={modelSourceIssues(item)} />
        </div>
        {editable && <RemoveAction label="Remove source" onRemove={remove} />}
      </div>
    </>
  );
}

function CcfSourceDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const systemId = sourceSystem(sy, id);
  const found = systemId === undefined ? undefined : ccfSources(sy, systemId).find((item) => item.uncertaintyId === id);
  if (found === undefined || systemId === undefined) return null;
  const item = found;
  const groups = relatedCcfGroups(sy, systemId);
  const missing = !groups.some((group) => group.uuid === item.ccfGroupId);

  function patch(fields: Partial<typeof item>): void {
    if (!editable) return;
    mutateSy((draft) => updateAnalyses(draft, (analysis) => ({
      ...analysis,
      ccfUncertainties: analysis.ccfUncertainties?.map((candidate) => (candidate.uncertaintyId === id ? { ...candidate, ...fields } : candidate)),
    })));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => withoutStudiesOf(updateAnalyses(draft, (analysis) => ({
      ...analysis,
      ccfUncertainties: analysis.ccfUncertainties?.filter((candidate) => candidate.uncertaintyId !== id),
    })), id));
  }

  return (
    <>
      <DialogHead cap={`Common cause uncertainty · ${shortOf(systemId)} · SY-B16`} title={sy.commonCauseFailureGroups.find((group) => group.uuid === item.ccfGroupId)?.name ?? "Common cause uncertainty"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Common cause group</label>
            {editable ? (
              <select className="posfield__select" aria-label="Common cause group" value={item.ccfGroupId} onChange={(change) => patch({ ccfGroupId: change.target.value })}>
                {missing && <option value={item.ccfGroupId}>{item.ccfGroupId}</option>}
                {groups.map((group) => <option key={group.uuid} value={group.uuid}>{group.name}</option>)}
              </select>
            ) : <div>{sy.commonCauseFailureGroups.find((group) => group.uuid === item.ccfGroupId)?.name ?? item.ccfGroupId}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Source</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Source" value={item.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{item.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Effect on the results</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Effect on the results" value={item.impact} onChange={(change) => patch({ impact: change.target.value })} /> : <div>{item.impact}</div>}
          </div>
          <ProblemList issues={ccfSourceIssues(sy, systemId, item)} />
        </div>
        {editable && <RemoveAction label="Remove item" onRemove={remove} />}
      </div>
    </>
  );
}

function DependencySourceDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const systemId = sourceSystem(sy, id);
  const found = systemId === undefined ? undefined : dependencySources(sy, systemId).find((item) => item.uncertaintyId === id);
  if (found === undefined || systemId === undefined) return null;
  const item = found;

  function patch(fields: Partial<typeof item>): void {
    if (!editable) return;
    mutateSy((draft) => updateAnalyses(draft, (analysis) => ({
      ...analysis,
      dependencyUncertainties: analysis.dependencyUncertainties?.map((candidate) => (candidate.uncertaintyId === id ? { ...candidate, ...fields } : candidate)),
    })));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => withoutStudiesOf(updateAnalyses(draft, (analysis) => ({
      ...analysis,
      dependencyUncertainties: analysis.dependencyUncertainties?.filter((candidate) => candidate.uncertaintyId !== id),
    })), id));
  }

  return (
    <>
      <DialogHead cap={`Dependency uncertainty · ${shortOf(systemId)} · SY-B16`} title={sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? "Dependency uncertainty"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Support</label>
            {editable ? (
              <select className="posfield__select" aria-label="Support" value={item.supportingSystem ?? ""} onChange={(change) => patch({ supportingSystem: textOrUndefined(change.target.value) })}>
                <option value="">Shared space or condition</option>
                {sy.systemDefinitions.filter((system) => system.uuid !== systemId).map((system) => <option key={system.uuid} value={system.uuid}>{shortOf(system.uuid)} · {system.name}</option>)}
              </select>
            ) : <div>{item.supportingSystem === undefined ? "Shared space or condition" : sy.systemDefinitions.find((system) => system.uuid === item.supportingSystem)?.name ?? item.supportingSystem}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Source</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Source" value={item.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{item.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Effect on the results</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Effect on the results" value={item.impact} onChange={(change) => patch({ impact: change.target.value })} /> : <div>{item.impact}</div>}
          </div>
          <ProblemList issues={dependencySourceIssues(sy, item)} />
        </div>
        {editable && <RemoveAction label="Remove item" onRemove={remove} />}
      </div>
    </>
  );
}

function RangeEditor({ study, editable, onChange }: {
  study: SensitivityStudy;
  editable: boolean;
  onChange: (fields: Pick<SensitivityStudy, "variedParameters" | "parameterRanges">) => void;
}): JSX.Element {
  const [draft, setDraft] = useState("");
  const ranges = study.parameterRanges;

  function rename(index: number, value: string): void {
    const previous = study.variedParameters[index];
    const name = value.trim();
    if (previous === undefined || name.length === 0 || name === previous || study.variedParameters.includes(name)) return;
    const range = ranges[previous];
    const nextRanges = Object.fromEntries(Object.entries(ranges).filter(([key]) => key !== previous));
    onChange({
      variedParameters: study.variedParameters.map((candidate, position) => (position === index ? name : candidate)),
      parameterRanges: range === undefined ? nextRanges : { ...nextRanges, [name]: range },
    });
  }

  function setBound(name: string, bound: 0 | 1, text: string): void {
    const value = Number(text);
    if (text.trim().length === 0 || !Number.isFinite(value)) return;
    const current = ranges[name] ?? [0, 0];
    onChange({ variedParameters: study.variedParameters, parameterRanges: { ...ranges, [name]: bound === 0 ? [value, current[1]] : [current[0], value] } });
  }

  function remove(name: string): void {
    onChange({
      variedParameters: study.variedParameters.filter((candidate) => candidate !== name),
      parameterRanges: Object.fromEntries(Object.entries(ranges).filter(([key]) => key !== name)),
    });
  }

  function add(): void {
    const name = draft.trim();
    setDraft("");
    if (name.length === 0 || study.variedParameters.includes(name)) return;
    onChange({ variedParameters: [...study.variedParameters, name], parameterRanges: { ...ranges, [name]: [0, 0] } });
  }

  return (
    <div className="posfield sy-dialog-list" role="group" aria-label="Varied parameters">
      <span className="posfield__label">Varied parameters, low to high</span>
      {study.variedParameters.length === 0 && <span className="posmuted">None recorded.</span>}
      {study.variedParameters.map((name, index) => {
        const range = ranges[name];
        return (
          <div key={`${index}:${name}`} className="sy-dialog-list__row syunc-range">
            {editable ? (
              <>
                <WorkbookInput className="posfield__input" aria-label={`Varied parameter ${index + 1}`} value={name} onChange={(change) => rename(index, change.target.value)} />
                <WorkbookInput className="posfield__input posmono syunc-range__bound" type="number" step="any" aria-label={`${name} low`} value={range?.[0] ?? ""} onChange={(change) => setBound(name, 0, change.target.value)} />
                <WorkbookInput className="posfield__input posmono syunc-range__bound" type="number" step="any" aria-label={`${name} high`} value={range?.[1] ?? ""} onChange={(change) => setBound(name, 1, change.target.value)} />
                <button type="button" className="sy-icon-btn" aria-label={`Remove varied parameter ${index + 1}`} onClick={() => remove(name)}><SYIcon.Close /></button>
              </>
            ) : <span>{range === undefined ? name : `${name}: ${range[0]} to ${range[1]}`}</span>}
          </div>
        );
      })}
      {editable && (
        <div className="sy-dialog-list__row">
          <input className="posfield__input" aria-label="Add a varied parameter" placeholder="Add a varied parameter" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={draft.trim().length === 0} onClick={add}><SYIcon.Plus /> Add</button>
        </div>
      )}
    </div>
  );
}

function StudyDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const found = (sy.sensitivityStudies ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) return null;
  const study = found;
  const systemId = study.modelUncertaintyId === undefined ? undefined : sourceSystem(sy, study.modelUncertaintyId);
  const options = systemId === undefined ? [] : sourceOptions(sy, systemId);

  function patch(fields: Partial<SensitivityStudy>): void {
    if (!editable) return;
    mutateSy((draft) => ({
      ...draft,
      sensitivityStudies: (draft.sensitivityStudies ?? []).map((candidate) => (candidate.uuid === study.uuid ? { ...candidate, ...fields } : candidate)),
    }));
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).filter((candidate) => candidate.uuid !== study.uuid) }));
  }

  return (
    <>
      <DialogHead cap={`Sensitivity study · ${systemId === undefined ? "Workbook" : shortOf(systemId)} · SY-A32`} title={study.name !== undefined && study.name.length > 0 ? study.name : "New sensitivity study"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Name" value={study.name ?? ""} onChange={(change) => patch({ name: textOrUndefined(change.target.value) })} /> : <div>{study.name ?? ""}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Source it tests</label>
            {editable ? (
              <select className="posfield__select" aria-label="Source it tests" value={study.modelUncertaintyId ?? ""} onChange={(change) => patch({ modelUncertaintyId: textOrUndefined(change.target.value) })}>
                {options.length === 0 && <option value="">No source recorded</option>}
                {options.map((option) => <option key={option.id} value={option.id}>{option.label.length > 0 ? option.label : "Source not described yet"}</option>)}
              </select>
            ) : <div>{options.find((option) => option.id === study.modelUncertaintyId)?.label ?? ""}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">What it varies and why</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="What it varies and why" value={study.description} onChange={(change) => patch({ description: change.target.value })} /> : <div>{study.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Result</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label="Result" value={study.results ?? ""} onChange={(change) => patch({ results: textOrUndefined(change.target.value) })} /> : <div>{study.results ?? ""}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Insight</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Insight" value={study.insights ?? ""} onChange={(change) => patch({ insights: textOrUndefined(change.target.value) })} /> : <div>{study.insights ?? ""}</div>}
          </div>
          <ProblemList issues={studyIssues(sy, study)} />
        </div>
        <RangeEditor study={study} editable={editable} onChange={(fields) => patch(fields)} />
        {editable && <RemoveAction label="Remove study" onRemove={remove} />}
      </div>
    </>
  );
}

const PLANT_LABELS: Record<PlantList, { cap: string; text: string; detail: string }> = {
  sources: { cap: "Source across systems", text: "Source", detail: "Effect on the results" },
  assumptions: { cap: "Related assumption", text: "Assumption", detail: "Basis" },
  alternatives: { cap: "Reasonable alternative", text: "Alternative", detail: "Why it was not selected" },
};

function plantPosition(id: string): { list: PlantList; index: number } | null {
  const [name, position] = id.split(":");
  const list = PLANT_LISTS.find((candidate) => candidate === name);
  const index = Number(position);
  return list === undefined || !Number.isInteger(index) || index < 0 ? null : { list, index };
}

function patchPlantItem(draft: SystemsAnalysis, list: PlantList, index: number, fields: { text?: string; detail?: string; systems?: string[] }): SystemsAnalysis {
  const documentation = draft.modelUncertainty;
  if (list === "sources") {
    return { ...draft, modelUncertainty: { ...documentation, uncertaintySources: documentation.uncertaintySources.map((item, position) => (position !== index ? item : {
      ...item,
      ...(fields.text === undefined ? {} : { source: fields.text }),
      ...(fields.detail === undefined ? {} : { impact: fields.detail }),
      ...(fields.systems === undefined ? {} : { applicableElements: fields.systems }),
    })) } };
  }
  if (list === "assumptions") {
    return { ...draft, modelUncertainty: { ...documentation, relatedAssumptions: documentation.relatedAssumptions.map((item, position) => (position !== index ? item : {
      ...item,
      ...(fields.text === undefined ? {} : { assumption: fields.text }),
      ...(fields.detail === undefined ? {} : { basis: fields.detail }),
      ...(fields.systems === undefined ? {} : { applicableElements: fields.systems }),
    })) } };
  }
  return { ...draft, modelUncertainty: { ...documentation, reasonableAlternatives: documentation.reasonableAlternatives.map((item, position) => (position !== index ? item : {
    ...item,
    ...(fields.text === undefined ? {} : { alternative: fields.text }),
    ...(fields.detail === undefined ? {} : { reasonNotSelected: fields.detail }),
    ...(fields.systems === undefined ? {} : { applicableElements: fields.systems }),
  })) } };
}

function removePlantItem(draft: SystemsAnalysis, list: PlantList, index: number): SystemsAnalysis {
  const documentation = draft.modelUncertainty;
  if (list === "sources") return { ...draft, modelUncertainty: { ...documentation, uncertaintySources: documentation.uncertaintySources.filter((_, position) => position !== index) } };
  if (list === "assumptions") return { ...draft, modelUncertainty: { ...documentation, relatedAssumptions: documentation.relatedAssumptions.filter((_, position) => position !== index) } };
  return { ...draft, modelUncertainty: { ...documentation, reasonableAlternatives: documentation.reasonableAlternatives.filter((_, position) => position !== index) } };
}

function PlantItemDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const position = plantPosition(id);
  const found = position === null ? undefined : plantItems(sy, position.list)[position.index];
  if (position === null || found === undefined) return null;
  const { list, index } = position;
  const item = found;
  const labels = PLANT_LABELS[list];

  function patch(fields: { text?: string; detail?: string; systems?: string[] }): void {
    if (!editable) return;
    mutateSy((draft) => patchPlantItem(draft, list, index, fields));
  }

  function toggle(systemId: string, checked: boolean): void {
    patch({ systems: checked ? [...item.systems, systemId] : item.systems.filter((candidate) => candidate !== systemId) });
  }

  function remove(): void {
    if (!editable) return;
    onClose();
    mutateSy((draft) => removePlantItem(draft, list, index));
  }

  return (
    <>
      <DialogHead cap={`${labels.cap} · SY-A32, C2`} title={item.text.length > 0 ? item.text : `New ${labels.text.toLowerCase()}`} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">{labels.text}</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label={labels.text} value={item.text} onChange={(change) => patch({ text: change.target.value })} /> : <div>{item.text}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">{labels.detail}</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} aria-label={labels.detail} value={item.detail} onChange={(change) => patch({ detail: change.target.value })} /> : <div>{item.detail}</div>}
          </div>
          <div className="posfield posfield-grid--span2" role="group" aria-label="Applies to">
            <span className="posfield__label">Applies to</span>
            <div className="sy-dialog-checks">
              {sy.systemDefinitions.map((system) => (
                <label key={system.uuid} className="sy-dialog-check">
                  <input type="checkbox" checked={item.systems.includes(system.uuid)} disabled={!editable} onChange={(change) => toggle(system.uuid, change.target.checked)} />
                  <span>{system.name}</span>
                </label>
              ))}
            </div>
          </div>
          <ProblemList issues={plantItemIssues(item, list)} />
        </div>
        {editable && <RemoveAction label="Remove item" onRemove={remove} />}
      </div>
    </>
  );
}

function UncertaintyDialogContent({ context, onClose }: { context: SyDrawerContext & { kind: UncertaintyDialogKind }; onClose: () => void }): JSX.Element | null {
  if (context.kind === "unc") return <ModelSourceDialog id={context.id} onClose={onClose} />;
  if (context.kind === "uccf") return <CcfSourceDialog id={context.id} onClose={onClose} />;
  if (context.kind === "udep") return <DependencySourceDialog id={context.id} onClose={onClose} />;
  if (context.kind === "sens") return <StudyDialog id={context.id} onClose={onClose} />;
  return <PlantItemDialog id={context.id} onClose={onClose} />;
}

export { UncertaintyDialogContent, isUncertaintyDialogKind, type UncertaintyDialogKind };
