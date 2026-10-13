import { JSX, useMemo, useState } from "react";
import type { EsUncertaintyArea, EsUncertaintySource, EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { PreOperationalAssumption } from "interfaces-mef-types/core/documentation";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { ChoiceEditor, DialogHead, DialogShell } from "./EsScope";
import { PAGE, Pager, TabBar, paged } from "./EsTiming";
import { useEsWorkbook } from "./esWorkbookContext";
import "./css/esUncertainty.css";

type UncertaintyTab = "register" | "cases" | "preoperational" | "checks";

type UncertaintyDialog = { kind: "source"; index: number } | { kind: "case"; id: string } | { kind: "assumption"; id: string };

interface UncertaintyFinding {
  severity: "error" | "warning";
  check: string;
  item: string;
  detail: string;
  target: UncertaintyDialog;
}

const UNCERTAINTY_TABS: { id: UncertaintyTab; label: string }[] = [
  { id: "register", label: "Register" },
  { id: "cases", label: "Sensitivity proposals" },
  { id: "preoperational", label: "Pre-operational" },
  { id: "checks", label: "Checks" },
];

const AREAS: { id: EsUncertaintyArea; label: string }[] = [
  { id: "PLANT_RESPONSE", label: "Plant response" },
  { id: "DEPENDENCIES", label: "Dependencies" },
  { id: "END_STATES", label: "End states" },
];

const STATUSES: { id: PreOperationalAssumption["status"]; label: string }[] = [
  { id: "OPEN", label: "Open" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "CLOSED", label: "Closed" },
];

const IMPACTS: { id: ImportanceLevel; label: string }[] = [
  { id: ImportanceLevel.HIGH, label: "High" },
  { id: ImportanceLevel.MEDIUM, label: "Medium" },
  { id: ImportanceLevel.LOW, label: "Low" },
];

function textOrNone(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "None" : text;
}

function counted(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function nextAssumptionId(existing: readonly PreOperationalAssumption[]): string {
  const taken = new Set(existing.map((entry) => entry.assumptionId));
  let index = existing.length + 1;
  while (taken.has(`ES-PA-${String(index)}`)) index += 1;
  return `ES-PA-${String(index)}`;
}

function sourcesOf(es: EventSequenceAnalysis): EsUncertaintySource[] {
  return es.modelUncertainty.uncertaintySources;
}

function withSources(es: EventSequenceAnalysis, update: (sources: EsUncertaintySource[]) => EsUncertaintySource[]): EventSequenceAnalysis {
  return { ...es, modelUncertainty: { ...es.modelUncertainty, uncertaintySources: update(es.modelUncertainty.uncertaintySources) } };
}

function casesFor(es: EventSequenceAnalysis, source: EsUncertaintySource): SensitivityStudy[] {
  return source.id === undefined ? [] : (es.sensitivityStudies ?? []).filter((study) => study.modelUncertaintyId === source.id);
}

function uncertaintyFindings(es: EventSequenceAnalysis): UncertaintyFinding[] {
  const findings: UncertaintyFinding[] = [];
  sourcesOf(es).forEach((source, index) => {
    const item = textOrNone(source.source);
    if ((source.familyIds ?? []).length === 0) {
      findings.push({ severity: "warning", check: "Uncertainty with no affected family", item, detail: "Name the families this uncertainty affects.", target: { kind: "source", index } });
    }
    if (source.key === true && casesFor(es, source).length === 0 && (source.noCaseReason ?? "").trim().length === 0) {
      findings.push({ severity: "error", check: "Key uncertainty with no case and no reason", item, detail: "Propose a sensitivity case for it, or record why none is needed.", target: { kind: "source", index } });
    }
  });
  return findings;
}

function RegisterPanel({ onOpen }: { onOpen: (index: number) => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const sources = sourcesOf(es);
  const rows = paged(sources.length, page);
  const actionLabel = editable ? "Edit" : "View";

  function addSource(): void {
    if (!editable) return;
    setPage(Math.floor(sources.length / PAGE));
    mutateEs((draft) => withSources(draft, (list) => [...list, { id: crypto.randomUUID(), source: "New model uncertainty", impact: "", key: false }]));
    onOpen(sources.length);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="uncertainty" plural="uncertainties" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}>Add uncertainty</button>}
        </div>
      </div>
      {sources.length > 0 && (
        <div className="es-uncertainty-table">
          <table className="postable es-records" aria-label="Register">
            <thead>
              <tr>
                <th scope="col">Uncertainty</th>
                <th scope="col">Area</th>
                <th scope="col">Affects</th>
                <th scope="col">Key</th>
                <th scope="col">Case</th>
                <th scope="col" className="es-records__act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sources.slice(rows.start, rows.start + PAGE).map((source, offset) => {
                const index = rows.start + offset;
                const cases = casesFor(es, source);
                return (
                  <tr key={source.id ?? `source-${String(index)}`}>
                    <td><span className="postable__name">{textOrNone(source.source)}</span>{source.impact.trim().length > 0 && <span className="postable__name-sub">{source.impact}</span>}</td>
                    <td>{AREAS.find((area) => area.id === source.area)?.label ?? "None"}</td>
                    <td>{counted((source.familyIds ?? []).length, "family", "families")}, {counted((source.sequenceIds ?? []).length, "sequence", "sequences")}</td>
                    <td>{source.key === true ? "Yes" : "No"}</td>
                    <td>{cases.length > 0 ? cases.map((study) => study.name ?? study.description).join(", ") : textOrNone(source.noCaseReason)}</td>
                    <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${textOrNone(source.source)}`} onClick={() => onOpen(index)}>{actionLabel}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CasesPanel({ onOpen }: { onOpen: (id: string) => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const studies = es.sensitivityStudies ?? [];
  const rows = paged(studies.length, page);
  const actionLabel = editable ? "Edit" : "View";
  const sourceText = new Map(sourcesOf(es).flatMap((source) => (source.id === undefined ? [] : [[source.id, source.source] as const])));

  function addCase(): void {
    if (!editable) return;
    const added: SensitivityStudy = { uuid: crypto.randomUUID(), name: "New sensitivity case", description: "", variedParameters: [], parameterRanges: {} };
    setPage(Math.floor(studies.length / PAGE));
    mutateEs((draft) => ({ ...draft, sensitivityStudies: [...(draft.sensitivityStudies ?? []), added] }));
    onOpen(added.uuid);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="case" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCase}>Add case</button>}
        </div>
      </div>
      {studies.length > 0 && (
        <div className="es-uncertainty-table">
          <table className="postable es-records" aria-label="Sensitivity proposals">
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Uncertainty</th>
                <th scope="col">Varied</th>
                <th scope="col">Expected effect</th>
                <th scope="col" className="es-records__act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {studies.slice(rows.start, rows.start + PAGE).map((study) => (
                <tr key={study.uuid}>
                  <td><span className="postable__name">{textOrNone(study.name ?? study.description)}</span></td>
                  <td>{study.modelUncertaintyId === undefined ? "None" : sourceText.get(study.modelUncertaintyId) ?? "Unresolved uncertainty"}</td>
                  <td>{study.variedParameters.length === 0 ? "None" : study.variedParameters.join(", ")}</td>
                  <td>{textOrNone(study.impact)}</td>
                  <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${textOrNone(study.name ?? study.description)}`} onClick={() => onOpen(study.uuid)}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function AssumptionsPanel({ onOpen }: { onOpen: (id: string) => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const assumptions = es.preOperationalAssumptions ?? [];
  const rows = paged(assumptions.length, page);
  const actionLabel = editable ? "Edit" : "View";

  function addAssumption(): void {
    if (!editable) return;
    const added: PreOperationalAssumption = {
      uuid: crypto.randomUUID(),
      assumptionId: nextAssumptionId(assumptions),
      description: "New pre-operational assumption",
      status: "OPEN",
      limitations: [],
      influenceOnDefinition: "",
      riskImpact: ImportanceLevel.MEDIUM,
      closureBasis: "",
      plannedClosureActions: [],
      affectedElementIds: [],
    };
    setPage(Math.floor(assumptions.length / PAGE));
    mutateEs((draft) => ({ ...draft, preOperationalAssumptions: [...(draft.preOperationalAssumptions ?? []), added] }));
    onOpen(added.uuid);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="assumption" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAssumption}>Add assumption</button>}
        </div>
      </div>
      {assumptions.length > 0 && (
        <div className="es-uncertainty-table">
          <table className="postable es-records" aria-label="Pre-operational assumptions">
            <thead>
              <tr>
                <th scope="col">Assumption</th>
                <th scope="col">Status</th>
                <th scope="col">Risk impact</th>
                <th scope="col">How it closes</th>
                <th scope="col" className="es-records__act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {assumptions.slice(rows.start, rows.start + PAGE).map((assumption) => (
                <tr key={assumption.uuid}>
                  <td><span className="postable__name">{assumption.description}</span><span className="postable__name-sub posmono">{assumption.assumptionId}</span></td>
                  <td>{STATUSES.find((status) => status.id === assumption.status)?.label ?? assumption.status}</td>
                  <td>{IMPACTS.find((impact) => impact.id === assumption.riskImpact)?.label ?? assumption.riskImpact}</td>
                  <td>{assumption.closureBasis.trim().length > 0 ? assumption.closureBasis : assumption.plannedClosureActions.length > 0 ? assumption.plannedClosureActions.join(", ") : "None"}</td>
                  <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${assumption.assumptionId}`} onClick={() => onOpen(assumption.uuid)}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ChecksPanel({ findings, onOpen }: { findings: readonly UncertaintyFinding[]; onOpen: (dialog: UncertaintyDialog) => void }): JSX.Element {
  const [page, setPage] = useState(0);
  const rows = paged(findings.length, page);
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions"><Pager rows={rows} noun="finding" onPage={setPage} /></div>
      </div>
      {findings.length > 0 && (
      <div className="es-uncertainty-table">
        <table className="postable es-records" aria-label="Checks">
          <thead><tr><th scope="col">Severity</th><th scope="col">Check</th><th scope="col">Item</th><th scope="col">Detail</th></tr></thead>
          <tbody>
            {findings.slice(rows.start, rows.start + PAGE).map((finding, index) => (
              <tr key={`${finding.check}:${String(rows.start + index)}`}>
                <td className={`es-severity es-severity--${finding.severity}`}>{finding.severity === "error" ? "Error" : "Warning"}</td>
                <td>{finding.check}</td>
                <td><button type="button" className="es-records__link" onClick={() => onOpen(finding.target)}>{finding.item}</button></td>
                <td>{finding.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}

function SequenceList({ values, editable, onChange }: { values: readonly string[]; editable: boolean; onChange: (values: string[]) => void }): JSX.Element {
  const { es } = useEsWorkbook();
  const trees = es.eventTrees ?? [];
  const name = new Map(es.eventSequences.map((sequence) => [sequence.uuid, sequence.name]));
  return (
    <div className="posfield es-dialog-list" role="group" aria-label="Affected sequences">
      <span className="posfield__label">Affected sequences</span>
      {!editable && values.length === 0 && <span className="posmuted">None recorded.</span>}
      {values.length > 0 && (
        <div className="es-dialog-checks">
          {values.map((value) => (
            <label key={value} className="es-dialog-check">
              <input type="checkbox" checked disabled={!editable} onChange={() => onChange(values.filter((candidate) => candidate !== value))} />
              <span>{name.get(value) ?? "Unresolved sequence"}</span>
            </label>
          ))}
        </div>
      )}
      {editable && (
        <select className="posfield__select es-uncertainty-add" aria-label="Add an affected sequence" value="" onChange={(event) => { if (event.target.value.length > 0 && !values.includes(event.target.value)) onChange([...values, event.target.value]); }}>
          <option value="">Add an affected sequence</option>
          {trees.map((tree) => (
            <optgroup key={tree.uuid} label={tree.name}>
              {es.eventSequences.filter((sequence) => sequence.eventTreeId === tree.uuid && !values.includes(sequence.uuid)).map((sequence) => <option key={sequence.uuid} value={sequence.uuid}>{sequence.name}</option>)}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}

function SourceDialog({ index, onClose }: { index: number; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const source = sourcesOf(es)[index];
  if (source === undefined) return null;
  const families = es.eventSequenceFamilies.map((family) => ({ id: family.uuid, label: family.name }));

  function patch(fields: Partial<EsUncertaintySource>): void {
    if (!editable) return;
    mutateEs((draft) => withSources(draft, (list) => list.map((entry, position) => (position === index ? { ...entry, id: entry.id ?? crypto.randomUUID(), ...fields } : entry))));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => withSources(draft, (list) => list.filter((_entry, position) => position !== index)));
  }

  return (
    <DialogShell label="Model uncertainty" onClose={onClose}>
      <DialogHead cap="Model uncertainty · ES-A14, B9, C10" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Uncertainty</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Uncertainty" value={source.source} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ source: event.target.value }); }} /> : <div>{textOrNone(source.source)}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Impact on the model</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Impact on the model" value={source.impact} onChange={(event) => patch({ impact: event.target.value })} /> : <div>{textOrNone(source.impact)}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Area</label>
            <select className="posfield__select" aria-label="Area" value={source.area ?? ""} disabled={!editable} onChange={(event) => {
              const area = AREAS.find((candidate) => candidate.id === event.target.value);
              if (area !== undefined) patch({ area: area.id });
            }}>
              {source.area === undefined && <option value="">None</option>}
              {AREAS.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
            </select>
          </div>
          <div className="posfield"><label className="posfield__label">Could move a family</label>
            <select className="posfield__select" aria-label="Could move a family" value={source.key === true ? "yes" : "no"} disabled={!editable} onChange={(event) => patch({ key: event.target.value === "yes" })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {source.key === true && casesFor(es, source).length === 0 && (
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Why no case is needed</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Why no case is needed" value={source.noCaseReason ?? ""} onChange={(event) => patch({ noCaseReason: event.target.value })} /> : <div>{textOrNone(source.noCaseReason)}</div>}
            </div>
          )}
        </div>
        <ChoiceEditor label="Affected families" choices={families} values={source.familyIds ?? []} editable={editable} addLabel="Add a family ID" onChange={(familyIds) => patch({ familyIds })} />
        <SequenceList values={source.sequenceIds ?? []} editable={editable} onChange={(sequenceIds) => patch({ sequenceIds })} />
        {editable && <div className="posrow es-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove uncertainty</button></div>}
      </div>
    </DialogShell>
  );
}

function CaseDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const study = (es.sensitivityStudies ?? []).find((candidate) => candidate.uuid === id);
  if (study === undefined) return null;
  const sources = sourcesOf(es);
  const linked = sources.some((source) => source.id !== undefined && source.id === study.modelUncertaintyId);

  function write(update: (current: SensitivityStudy) => SensitivityStudy): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).map((candidate) => (candidate.uuid === id ? update(candidate) : candidate)) }));
  }
  function linkSource(index: number | undefined): void {
    if (!editable) return;
    mutateEs((draft) => {
      const list = sourcesOf(draft);
      const target = index === undefined ? undefined : list[index];
      const sourceId = target === undefined ? undefined : target.id ?? crypto.randomUUID();
      const withId = target === undefined || target.id !== undefined || index === undefined ? draft : withSources(draft, (entries) => entries.map((entry, position) => (position === index ? { ...entry, id: sourceId } : entry)));
      return {
        ...withId,
        sensitivityStudies: (withId.sensitivityStudies ?? []).map((candidate) => {
          if (candidate.uuid !== id) return candidate;
          const { modelUncertaintyId: _old, ...rest } = candidate;
          return sourceId === undefined ? rest : { ...rest, modelUncertaintyId: sourceId };
        }),
      };
    });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).filter((candidate) => candidate.uuid !== id) }));
  }
  const linkedIndex = sources.findIndex((source) => source.id !== undefined && source.id === study.modelUncertaintyId);

  return (
    <DialogShell label="Sensitivity case" onClose={onClose}>
      <DialogHead cap="Sensitivity proposal · ES-A14, C10" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Case</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Case" value={study.name ?? ""} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, name: value })); }} /> : <div>{textOrNone(study.name)}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Uncertainty</label>
            <select className="posfield__select" aria-label="Uncertainty" value={linkedIndex < 0 ? "" : String(linkedIndex)} disabled={!editable} onChange={(event) => linkSource(event.target.value.length === 0 ? undefined : Number(event.target.value))}>
              <option value="">{study.modelUncertaintyId !== undefined && !linked ? "Unresolved uncertainty" : "None"}</option>
              {sources.map((source, index) => <option key={source.id ?? `source-${String(index)}`} value={String(index)}>{textOrNone(source.source)}</option>)}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">What the case changes</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="What the case changes" value={study.description} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, description: value })); }} /> : <div>{textOrNone(study.description)}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Expected effect</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Expected effect" value={study.impact ?? ""} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, impact: value })); }} /> : <div>{textOrNone(study.impact)}</div>}
          </div>
        </div>
        <ChoiceEditor label="Varied parameters" choices={study.variedParameters.map((parameter) => ({ id: parameter, label: "" }))} values={study.variedParameters} editable={editable} addLabel="Add a varied parameter" mono={false} onChange={(variedParameters) => write((current) => ({ ...current, variedParameters }))} />
        {editable && <div className="posrow es-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove case</button></div>}
      </div>
    </DialogShell>
  );
}

function AssumptionDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const assumption = (es.preOperationalAssumptions ?? []).find((candidate) => candidate.uuid === id);
  if (assumption === undefined) return null;

  function patch(fields: Partial<PreOperationalAssumption>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...fields } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).filter((candidate) => candidate.uuid !== id) }));
  }

  return (
    <DialogShell label="Pre-operational assumption" onClose={onClose}>
      <DialogHead cap="Pre-operational assumption · ES-A15, B10, C11" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield"><label className="posfield__label">ID</label>
            {editable ? <WorkbookInput className="posfield__input posmono" aria-label="ID" value={assumption.assumptionId} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ assumptionId: event.target.value.trim() }); }} /> : <div className="posmono">{assumption.assumptionId}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Status</label>
            <select className="posfield__select" aria-label="Status" value={assumption.status} disabled={!editable} onChange={(event) => {
              const status = STATUSES.find((candidate) => candidate.id === event.target.value);
              if (status !== undefined) patch({ status: status.id });
            }}>
              {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Assumption</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Assumption" value={assumption.description} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ description: event.target.value }); }} /> : <div>{assumption.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Effect on the event sequences</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Effect on the event sequences" value={assumption.influenceOnDefinition} onChange={(event) => patch({ influenceOnDefinition: event.target.value })} /> : <div>{textOrNone(assumption.influenceOnDefinition)}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Risk impact</label>
            <select className="posfield__select" aria-label="Risk impact" value={assumption.riskImpact} disabled={!editable} onChange={(event) => {
              const impact = IMPACTS.find((candidate) => candidate.id === event.target.value);
              if (impact !== undefined) patch({ riskImpact: impact.id });
            }}>
              {IMPACTS.map((impact) => <option key={impact.id} value={impact.id}>{impact.label}</option>)}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">How it closes</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="How it closes" value={assumption.closureBasis} onChange={(event) => patch({ closureBasis: event.target.value })} /> : <div>{textOrNone(assumption.closureBasis)}</div>}
          </div>
        </div>
        <ChoiceEditor label="Planned closure actions" choices={assumption.plannedClosureActions.map((action) => ({ id: action, label: "" }))} values={assumption.plannedClosureActions} editable={editable} addLabel="Add a closure action" mono={false} onChange={(plannedClosureActions) => patch({ plannedClosureActions })} />
        <ChoiceEditor label="Limitations" choices={assumption.limitations.map((limitation) => ({ id: limitation, label: "" }))} values={assumption.limitations} editable={editable} addLabel="Add a limitation" mono={false} onChange={(limitations) => patch({ limitations })} />
        {editable && <div className="posrow es-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove assumption</button></div>}
      </div>
    </DialogShell>
  );
}

function EsUncertaintyScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const [tab, setTab] = useState<UncertaintyTab>("register");
  const [dialog, setDialog] = useState<UncertaintyDialog | null>(null);
  const findings = useMemo(() => uncertaintyFindings(es), [es]);
  const close = (): void => setDialog(null);
  return (
    <>
      <div className="poscard es-seq-card">
        <TabBar tabs={UNCERTAINTY_TABS} tab={tab} label="Uncertainty sections" findings={findings.length} onTab={setTab} />
        <div role="tabpanel" aria-label={UNCERTAINTY_TABS.find((item) => item.id === tab)?.label} className="es-seq-card__panel">
          {tab === "register" && <RegisterPanel onOpen={(index) => setDialog({ kind: "source", index })} />}
          {tab === "cases" && <CasesPanel onOpen={(id) => setDialog({ kind: "case", id })} />}
          {tab === "preoperational" && <AssumptionsPanel onOpen={(id) => setDialog({ kind: "assumption", id })} />}
          {tab === "checks" && <ChecksPanel findings={findings} onOpen={setDialog} />}
        </div>
      </div>
      {dialog?.kind === "source" && <SourceDialog index={dialog.index} onClose={close} />}
      {dialog?.kind === "case" && <CaseDialog id={dialog.id} onClose={close} />}
      {dialog?.kind === "assumption" && <AssumptionDialog id={dialog.id} onClose={close} />}
    </>
  );
}

export { AREAS, EsUncertaintyScreen, IMPACTS, STATUSES };
