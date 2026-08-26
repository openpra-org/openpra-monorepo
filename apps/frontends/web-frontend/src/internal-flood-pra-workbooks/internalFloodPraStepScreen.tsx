import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { composeWorkbookCue } from "../workbooks/workbookCueContent";
import {
  type InternalFloodAnalysisRecord,
  type InternalFloodPRA,
  type InternalFloodPraApplication,
  type InternalFloodRecordStatus,
} from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { synchronizeInternalFloodPraDerivedRegisters } from "interfaces-mef-types/internal-flood/internal-flood-pra-validation";
import { InternalFloodPRASchema } from "interfaces-mef-types/zod/internal-flood/internal-flood-pra";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { removeStructuredRecord, StructuredEditorDrawer, type EditorPath } from "../seismic-pra-workbooks/seismicPraStructuredEditor";
import { Drawer, Field, InfoButton, NumberInput, Section, SelectInput, TextArea, TextInput } from "./internalFloodPraFields";
import { useInternalFloodPraWorkbook } from "./internalFloodPraWorkbookContext";
import {
  HazardBayesianNetworkEditor,
  HazardEventTreeEditor,
  HazardFaultTreeEditor,
} from "../workbooks/hazardConditionedModelEditors";
import "../seismic-pra-workbooks/css/seismicPra.css";

interface EditorTarget {
  title: string;
  subtitle: string;
  focus: EditorPath;
  createAt?: EditorPath;
  removeLabel?: string;
  visibleRootFields?: string[];
  inlinePrimitiveArrays?: boolean;
  inlineObjectFields?: string[];
}

interface Column<T> {
  header: string;
  render: (record: T) => ReactNode;
  width?: string;
}

function display(value: unknown, unit?: string): string {
  let body: string;
  if (Array.isArray(value)) body = value.length === 0 ? "—" : value.join(" · ");
  else if (typeof value === "boolean") body = value ? "Yes" : "No";
  else if (typeof value === "number") body = value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1_000_000)
    ? value.toExponential(2).replace("e", "E")
    : value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
  else body = String(value ?? "—");
  return unit === undefined ? body : `${body} ${unit}`;
}

function statusTone(status: InternalFloodRecordStatus): string {
  if (status === "DRAFT" || status === "OPEN") return "fltag--warn";
  if (status === "SCREENED") return "fltag--neutral";
  return "fltag--good";
}

function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Pencil /> {label}</button>;
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Plus /> {label}</button>;
}

function SectionActions({ children }: { children: ReactNode }): JSX.Element {
  return <div className="flactions">{children}</div>;
}

function AnalysisRow({ label, value, emptyValue = "Not defined" }: { label: string; value: string; emptyValue?: string }): JSX.Element {
  return <div className="sanalysisbasis__row"><span>{label}</span><strong title={value}>{value.trim().length > 0 ? value : emptyValue}</strong></div>;
}

function Narrative({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return <div className="flnarrative"><span>{label}</span><p>{children}</p></div>;
}

function TechnicalTable<T extends InternalFloodAnalysisRecord>({ records, columns, caption, empty, onEdit }: {
  records: T[];
  columns: Array<Column<T>>;
  caption: string;
  empty: string;
  onEdit: (index: number) => void;
}): JSX.Element {
  if (records.length === 0) return <div className="flempty"><strong>{empty}</strong><p>Add a structured record with the section action.</p></div>;
  return <div className="fltablewrap"><table className="fltable" aria-label={caption}><colgroup><col style={{ width: "28%" }} />{columns.map((column, index) => <col key={`${column.header}-${String(index)}`} style={{ width: column.width }} />)}<col style={{ width: "52px" }} /></colgroup><thead><tr><th>Record</th>{columns.map((column) => <th key={column.header}>{column.header}</th>)}<th><span className="sr-only">Edit</span></th></tr></thead><tbody>{records.map((record, index) => <tr key={record.uuid}><td><button type="button" className="fltable__record" onClick={() => onEdit(index)}><strong>{record.name}</strong><code>{record.code}</code></button></td>{columns.map((column) => <td key={`${record.uuid}-${column.header}`}>{column.render(record)}</td>)}<td><button type="button" className="fltable__edit" aria-label={`Edit ${record.name}`} onClick={() => onEdit(index)}><POSIcon.Pencil /></button></td></tr>)}</tbody></table></div>;
}

function BarList({ items, formatter = (value) => display(value), tone = "integrated", onEdit }: { items: Array<{ id: string; label: string; value: number; detail?: string }>; formatter?: (value: number) => string; tone?: "pp" | "so" | "sn" | "ev" | "pr" | "hr" | "esq" | "integrated"; onEdit?: (index: number) => void }): JSX.Element {
  const maximum = Math.max(...items.map((item) => item.value), Number.EPSILON);
  return <div className={`flbars flbars--${tone}`}>{items.map((item, index) => {
    const content = <><div className="flbar__label"><span>{item.label}</span><strong>{formatter(item.value)}</strong></div><div className="flbar__track"><span style={{ width: `${String(Math.max(2, (item.value / maximum) * 100))}%` }} /></div>{item.detail !== undefined && <small>{item.detail}</small>}</>;
    return onEdit === undefined
      ? <div className="flbar" key={item.id}>{content}</div>
      : <button type="button" className="flbar flbar--editable" key={item.id} onClick={() => onEdit(index)}>{content}</button>;
  })}</div>;
}

function FlowRows({ rows, onEdit }: { rows: Array<{ id: string; from: string; through: string; to: string; status?: string }>; onEdit?: (index: number) => void }): JSX.Element {
  return <div className="flflows">{rows.map((row, index) => {
    const content = <><span>{row.from}</span><POSIcon.ArrowR /><strong>{row.through}</strong><POSIcon.ArrowR /><span>{row.to}</span>{row.status !== undefined && <em>{row.status}</em>}</>;
    return onEdit === undefined
      ? <div className="flflow" key={row.id}>{content}</div>
      : <button type="button" className="flflow flflow--editable" key={row.id} onClick={() => onEdit(index)}>{content}</button>;
  })}</div>;
}

function EmptyOrList({ values }: { values: string[] }): JSX.Element {
  return values.length === 0 ? <span className="flmuted">None</span> : <>{values.slice(0, 3).join(" · ")}{values.length > 3 ? ` +${String(values.length - 3)}` : ""}</>;
}

function Editor({ target, onClose }: { target: EditorTarget | null; onClose: () => void }): JSX.Element | null {
  const { mef, editable, mutate } = useInternalFloodPraWorkbook();
  if (target === null) return null;
  return <StructuredEditorDrawer
    eyebrow="Internal Flood PRA"
    title={target.title}
    subtitle={target.subtitle}
    schema={InternalFloodPRASchema}
    value={mef}
    editable={editable}
    initialFocus={target.focus}
    createAt={target.createAt}
    visibleRootFields={target.visibleRootFields}
    inlinePrimitiveArrays={target.inlinePrimitiveArrays ?? true}
    inlineObjectFields={target.inlineObjectFields}
    onClose={onClose}
    onApply={(value) => mutate(() => synchronizeInternalFloodPraDerivedRegisters(value))}
    onRemove={target.removeLabel === undefined ? undefined : () => mutate((current) => synchronizeInternalFloodPraDerivedRegisters(removeStructuredRecord(current, target.focus) as InternalFloodPRA))}
    removeLabel={target.removeLabel}
  />;
}

function collectionTarget(path: EditorPath, title: string, subtitle: string, index?: number): EditorTarget {
  return index === undefined
    ? { title: `Add ${title}`, subtitle, focus: [], createAt: path, inlinePrimitiveArrays: true }
    : { title: `Edit ${title}`, subtitle, focus: [...path, index], removeLabel: `Remove ${title}`, inlinePrimitiveArrays: true };
}

function groupedCollectionTarget(index: number, groups: Array<{ path: EditorPath; length: number; title: string }>, subtitle: string): EditorTarget {
  let offset = 0;
  for (const group of groups) {
    if (index < offset + group.length) return collectionTarget(group.path, group.title, subtitle, index - offset);
    offset += group.length;
  }
  return collectionTarget(groups[0]?.path ?? [], groups[0]?.title ?? "record", subtitle);
}

function useEditor(): { target: EditorTarget | null; setTarget: (target: EditorTarget | null) => void } {
  const [target, setTarget] = useState<EditorTarget | null>(null);
  return { target, setTarget };
}

type AnalysisScopeDraft = {
  applicationName: string;
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string;
  plantName: string;
  siteName: string;
  vendor: string;
  reactorType: string;
  thermalPower: string;
  numberOfModules: number;
  praScope: string;
  plantStage: InternalFloodPRA["plantStage"];
};

function technicalList(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter((item) => item.length > 0);
}

function defaultApplication(): InternalFloodPraApplication {
  return {
    uuid: crypto.randomUUID(), code: "FL-APP-001", name: "", description: "", basis: "", owner: "Internal Flood PRA Team", status: "DRAFT",
    evidenceRefs: [], relatedRefs: [], assumptionRefs: [], implementsSrs: [], purpose: "", decisionContext: "", supportedRiskMetrics: [],
    consumingElementRefs: [], configurationBasis: "", limitations: [],
  };
}

function AnalysisScopeEditor({ onClose, operatingStates, materialSources }: { onClose: () => void; operatingStates: string; materialSources: string }): JSX.Element {
  const { mef, editable, mutate } = useInternalFloodPraWorkbook();
  const application = mef.applications[0];
  const identity = mef.metadata.plantIdentity ?? { name: mef.name, vendor: "", reactorType: "", thermalPower: "", primaryCoolant: "", numberOfModules: 1 };
  const [draft, setDraft] = useState<AnalysisScopeDraft>(() => ({
    applicationName: application?.name ?? "", purpose: application?.purpose ?? "", decisionContext: application?.decisionContext ?? "",
    supportedRiskMetrics: application?.supportedRiskMetrics.join("\n") ?? "", plantName: identity.name, siteName: identity.siteName ?? "",
    vendor: identity.vendor, reactorType: identity.reactorType, thermalPower: identity.thermalPower, numberOfModules: identity.numberOfModules ?? 1,
    praScope: mef.praScope, plantStage: mef.plantStage,
  }));

  function save(): void {
    mutate((current) => {
      const next = typeof structuredClone === "function" ? structuredClone(current) : JSON.parse(JSON.stringify(current)) as InternalFloodPRA;
      const savedApplication: InternalFloodPraApplication = {
        ...(next.applications[0] ?? defaultApplication()), name: draft.applicationName, purpose: draft.purpose, description: draft.purpose,
        decisionContext: draft.decisionContext, basis: draft.decisionContext, supportedRiskMetrics: technicalList(draft.supportedRiskMetrics),
      };
      next.applications = [savedApplication, ...next.applications.slice(1)];
      next.metadata.plantIdentity = {
        ...(next.metadata.plantIdentity ?? identity), name: draft.plantName, siteName: draft.siteName, vendor: draft.vendor,
        reactorType: draft.reactorType, thermalPower: draft.thermalPower, numberOfModules: Math.max(1, Math.round(draft.numberOfModules)),
      };
      next.praScope = draft.praScope;
      next.metadata.scope = draft.praScope;
      next.plantStage = draft.plantStage;
      return synchronizeInternalFloodPraDerivedRegisters(next);
    });
    onClose();
  }

  return <Drawer title="PRA scope and application" subtitle="Use this editor to record why the analysis is being performed, which plant and operating conditions it covers, and which risk results it must produce." onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>{editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}</>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="FLOOD" title="PRA application" className="sinlineeditor__title" />
        <Field label="Intended application"><TextInput value={draft.applicationName} onChange={(value) => setDraft((current) => ({ ...current, applicationName: value }))} /></Field>
        <Field label="Purpose"><TextArea rows={3} value={draft.purpose} onChange={(value) => setDraft((current) => ({ ...current, purpose: value }))} /></Field>
        <Field label="Decision supported"><TextArea rows={3} value={draft.decisionContext} onChange={(value) => setDraft((current) => ({ ...current, decisionContext: value }))} /></Field>
        <Field label="Risk measures and endpoints"><TextArea rows={4} value={draft.supportedRiskMetrics} onChange={(value) => setDraft((current) => ({ ...current, supportedRiskMetrics: value }))} /></Field>
      </div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="FLOOD" title="Reference plant and site" className="sinlineeditor__title" /><div className="flfieldgrid">
        <Field label="Plant name"><TextInput value={draft.plantName} onChange={(value) => setDraft((current) => ({ ...current, plantName: value }))} /></Field>
        <Field label="Site"><TextInput value={draft.siteName} onChange={(value) => setDraft((current) => ({ ...current, siteName: value }))} /></Field>
        <Field label="Vendor or designer"><TextInput value={draft.vendor} onChange={(value) => setDraft((current) => ({ ...current, vendor: value }))} /></Field>
        <Field label="Reactor type"><TextInput value={draft.reactorType} onChange={(value) => setDraft((current) => ({ ...current, reactorType: value }))} /></Field>
        <Field label="Thermal power"><TextInput value={draft.thermalPower} onChange={(value) => setDraft((current) => ({ ...current, thermalPower: value }))} /></Field>
        <Field label="Modules or units"><NumberInput value={draft.numberOfModules} onChange={(value) => setDraft((current) => ({ ...current, numberOfModules: value }))} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="FLOOD" title="PRA boundary" className="sinlineeditor__title" />
        <Field label="Integrated PRA scope"><TextArea rows={4} value={draft.praScope} onChange={(value) => setDraft((current) => ({ ...current, praScope: value }))} /></Field>
        <Field label="Plant stage"><SelectInput value={draft.plantStage} options={[{ value: "PRE_OPERATIONAL", label: "Pre-operational" }, { value: "OPERATIONAL", label: "Operational" }]} onChange={(value) => setDraft((current) => ({ ...current, plantStage: value as InternalFloodPRA["plantStage"] }))} /></Field>
      </div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="FLOOD" title="Imported baseline scope" className="sinlineeditor__title" />
        <Field label="Operating states"><TextArea rows={3} value={operatingStates} disabled onChange={() => undefined} /></Field>
        <Field label="Radioactive-material sources"><TextArea rows={3} value={materialSources} disabled onChange={() => undefined} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

interface InterfaceEditorSelection { interfaceIndex: number; transferIndex: number }

function TechnicalInterfaceEditor({ selection, onClose }: { selection: InterfaceEditorSelection; onClose: () => void }): JSX.Element {
  const { mef, mutate } = useInternalFloodPraWorkbook();
  const sourceInterface = mef.integration.interfaces[selection.interfaceIndex];
  const sourceTransfer = sourceInterface?.transferItems[selection.transferIndex];
  const [direction, setDirection] = useState(sourceInterface?.direction ?? "INPUT");
  const [role, setRole] = useState(sourceInterface?.role ?? "");
  const [name, setName] = useState(sourceTransfer?.name ?? "");
  const [recordRef, setRecordRef] = useState(sourceTransfer?.recordRef ?? "");
  const [sourceModelRef, setSourceModelRef] = useState(sourceTransfer?.sourceModelRef ?? "");
  const [destinationRefs, setDestinationRefs] = useState(sourceTransfer?.destinationRefs.join("\n") ?? "");
  const [evidenceRefs, setEvidenceRefs] = useState(sourceTransfer?.evidenceRefs.join("\n") ?? "");
  const [status, setStatus] = useState(sourceTransfer?.status ?? "CONTROLLED");
  const [values, setValues] = useState(sourceTransfer?.values ?? []);
  if (sourceInterface === undefined || sourceTransfer === undefined) return <></>;
  function save(): void {
    mutate((current) => {
      const next = typeof structuredClone === "function" ? structuredClone(current) : JSON.parse(JSON.stringify(current)) as InternalFloodPRA;
      const targetInterface = next.integration.interfaces[selection.interfaceIndex];
      const targetTransfer = targetInterface?.transferItems[selection.transferIndex];
      if (targetInterface === undefined || targetTransfer === undefined) return current;
      targetInterface.direction = direction;
      targetInterface.role = role.trim();
      targetInterface.producer = direction === "INPUT" ? targetInterface.technicalElementCode : "FL";
      targetInterface.consumer = direction === "INPUT" ? "FL" : targetInterface.technicalElementCode;
      Object.assign(targetTransfer, { name: name.trim(), recordRef: recordRef.trim(), sourceModelRef: sourceModelRef.trim(), destinationRefs: technicalList(destinationRefs), evidenceRefs: technicalList(evidenceRefs), status, values });
      targetInterface.producerRefs = targetInterface.transferItems.map((item) => item.recordRef);
      targetInterface.consumerRefs = Array.from(new Set(targetInterface.transferItems.flatMap((item) => item.destinationRefs)));
      return synchronizeInternalFloodPraDerivedRegisters(next);
    });
    onClose();
  }
  return <Drawer title="Technical-element transfer record" subtitle={`${sourceInterface.technicalElementCode} ${direction === "INPUT" ? "to" : "from"} Internal Flood PRA · ${sourceInterface.technicalElementName}`} onClose={onClose} footer={<><button type="button" className="flbtn" onClick={onClose}>Cancel</button><span className="fldrawer__footer-spacer" /><button type="button" className="flbtn flbtn--primary" onClick={save}>Save changes</button></>}>
    <div className="sinlineeditor__body">
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="FLOOD" title="Technical-element handoff" className="sinlineeditor__title" /><div className="sinlineeditor__grid">
        <Field label="Technical element"><TextInput value={`${sourceInterface.technicalElementCode} · ${sourceInterface.technicalElementName}`} disabled onChange={() => undefined} /></Field>
        <Field label="Direction"><SelectInput value={direction} options={[{ value: "INPUT", label: "Input to Internal Flood PRA" }, { value: "OUTPUT", label: "Output from Internal Flood PRA" }]} onChange={(value) => setDirection(value as typeof direction)} /></Field>
        <Field label="Interface role" wide><TextArea rows={3} value={role} onChange={setRole} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="FLOOD" title="Transferred record" className="sinlineeditor__title" /><div className="sinlineeditor__grid">
        <Field label="Record name" wide><TextInput value={name} onChange={setName} /></Field>
        <Field label="Record reference"><TextInput value={recordRef} onChange={setRecordRef} /></Field>
        <Field label="Transfer status"><SelectInput value={status} options={["CONTROLLED", "WORKING", "OPEN"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} onChange={(value) => setStatus(value as typeof status)} /></Field>
        <Field label="Source model or revision" wide><TextInput value={sourceModelRef} onChange={setSourceModelRef} /></Field>
        <Field label="Destination records" wide><TextArea rows={4} value={destinationRefs} onChange={setDestinationRefs} /></Field>
        <Field label="Evidence references" wide><TextArea rows={3} value={evidenceRefs} onChange={setEvidenceRefs} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading workbook="FLOOD" title="Transferred values" className="sinlineeditor__title" /><div className="sinlineeditor__grid">{sourceInterface.columns.map((column, index) => <Field key={column} label={column} wide><TextArea rows={2} value={values[index] ?? ""} onChange={(value) => setValues((current) => sourceInterface.columns.map((_, candidate) => candidate === index ? value : current[candidate] ?? ""))} /></Field>)}</div></div>
    </div>
  </Drawer>;
}

function InternalFloodInterfacesSection({ onEdit }: { onEdit: (interfaceIndex: number, transferIndex: number) => void }): JSX.Element {
  const { mef } = useInternalFloodPraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const selectedInterface = selected === null ? undefined : mef.integration.interfaces[selected];
  return <div className="poscard">
    <div className="poscard__head"><div className="ssection__heading"><h3 className="poscard__title">Interfaces</h3><InfoButton label="About Interfaces">{composeWorkbookCue("FLOOD", "Interfaces", "Shows the controlled inputs received from other PRA technical elements and the flood results supplied to Event Sequence Quantification and Risk Integration.")}</InfoButton></div></div>
    <div className="poshandoff__grid">{mef.integration.interfaces.map((item, index) => <button key={item.uuid} type="button" className={`poshandoff__tile${selected === index ? " poshandoff__tile--active" : ""}`} onClick={() => setSelected(selected === index ? null : index)}>
      <span className="poshandoff__tile-code">{item.direction === "INPUT" ? `${item.technicalElementCode} → FL` : `FL → ${item.technicalElementCode}`}</span><span className="poshandoff__tile-name">{item.technicalElementName}</span><span className="poshandoff__tile-role">{item.direction === "INPUT" ? "Receives" : "Provides"} · {item.role}</span>
    </button>)}</div>
    {selectedInterface !== undefined && <div className="sinterface__details"><div className="sinterface__flow-title">{selectedInterface.direction === "INPUT" ? `Internal Flood PRA receives ${selectedInterface.role.toLowerCase()} from ${selectedInterface.technicalElementName}` : `${selectedInterface.technicalElementName} receives ${selectedInterface.role.toLowerCase()} from Internal Flood PRA`}</div><div className="sinterface__table-wrap"><table className="postable postable--mid flinterface-table"><thead><tr><th>Transferred record</th>{selectedInterface.columns.map((column) => <th key={column}>{column}</th>)}<th>Status</th><th /></tr></thead><tbody>{selectedInterface.transferItems.length === 0 ? <tr><td colSpan={selectedInterface.columns.length + 3}>No controlled transfer records are available.</td></tr> : selectedInterface.transferItems.map((transfer, transferIndex) => <tr key={transfer.uuid}><td className="stable__key"><strong>{transfer.name}</strong><small className="flcellnote">{transfer.recordRef} · {transfer.sourceModelRef}</small></td>{selectedInterface.columns.map((column, columnIndex) => <td key={`${transfer.uuid}-${column}`}>{transfer.values[columnIndex] ?? "—"}</td>)}<td><span className={`fltag ${transfer.status === "CONTROLLED" ? "fltag--good" : "fltag--warn"}`}>{transfer.status}</span></td><td><button type="button" className="fltable__edit" aria-label={`Edit ${transfer.name}`} onClick={() => onEdit(selected ?? 0, transferIndex)}><POSIcon.Pencil /></button></td></tr>)}</tbody></table></div></div>}
  </div>;
}

function AnalysisBasis(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [interfaceEditor, setInterfaceEditor] = useState<InterfaceEditorSelection | null>(null);
  const identity = mef.metadata.plantIdentity;
  const application = mef.applications[0];
  const operatingStates = mef.baselinePra?.plantOperatingStateRefs.join(" · ") ?? "";
  const materialSources = mef.baselinePra?.radioactiveMaterialSourceRefs.join(" · ") ?? "";
  const plantAndSite = [identity?.name ?? mef.name, identity?.siteName].filter((value) => value !== undefined && value.trim().length > 0).join(" · ");
  const sources = mef.sourcesIdentificationAndCharacterization.sources;
  const areas = mef.plantPartitioning.floodAreas;
  return <div className="flstep">
    <Section title="PRA scope and application" description="Use this section to record why the analysis is being performed, which plant, operating states, and radioactive-material sources are included, and which risk results are required. Capability categories are checked separately for each supporting requirement in Conformance." actions={editable ? <EditButton label="Edit PRA scope and application" onClick={() => setScopeOpen(true)} /> : undefined}>
      <div className="sanalysisbasis">
        <AnalysisRow label="Intended application" value={application?.name ?? ""} />
        <AnalysisRow label="Purpose" value={application?.purpose ?? ""} />
        <AnalysisRow label="Decision supported" value={application?.decisionContext ?? ""} />
        <AnalysisRow label="Reference plant and site" value={plantAndSite} />
        <AnalysisRow label="PRA scope" value={mef.praScope} />
        <AnalysisRow label="Plant stage" value={mef.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational"} />
        <AnalysisRow label="Operating states" value={operatingStates} emptyValue="Not available from the baseline PRA" />
        <AnalysisRow label="Radioactive-material sources" value={materialSources} emptyValue="Not available from the baseline PRA" />
        <AnalysisRow label="Risk measures and endpoints" value={application?.supportedRiskMetrics.join(" · ") ?? ""} />
      </div>
    </Section>
    <Section title="Internal-flood definition" description="Use this section to agree on the source parameters and physical flood-area references that every later source, propagation, scenario, response, and quantification calculation will use. These are common starting inputs, not calculated risk results.">
      <div className="smotionbasis">
        <div className="smotionbasis__heading"><div className="smotionbasis__heading-title"><h3 className="smotionbasis__title">Flood-source parameters</h3><InfoButton label="About flood-source parameters">{composeWorkbookCue("FLOOD", "Flood-source parameters", "Defines the fluid system, source type, inventory, operating envelope, and isolation boundary for each potential release.")}</InfoButton></div>{editable && <AddButton label="Add flood source" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source", "Define a common source segment and its operating envelope."))} />}</div>
        {sources.length === 0 ? <p className="sanalysisbasis__empty">No flood-source parameters defined.</p> : <div className="stablewrap"><table className="stable postable stable--technical"><thead><tr><th>Source</th><th>Type and fluid</th><th>System</th><th>Operating envelope</th><th>Inventory</th></tr></thead><tbody>{sources.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source", "Edit the common source segment and its operating envelope.", index))}><td className="stable__key"><strong>{item.name}</strong></td><td>{item.sourceType.replace(/_/g, " ")} · {item.fluid.replace(/_/g, " ")}</td><td>{item.systemRef}</td><td>{display(item.operatingPressureKpa, "kPa")} · {display(item.operatingTemperatureCelsius, "°C")}</td><td>{Number.isFinite(item.inventoryCubicMetres) ? display(item.inventoryCubicMetres, "m³") : "Connected source"}</td></tr>)}</tbody></table></div>}
        <div className="smotionbasis__heading"><div className="smotionbasis__heading-title"><h3 className="smotionbasis__title">Flood-area reference locations</h3><InfoButton label="About flood-area reference locations">{composeWorkbookCue("FLOOD", "Flood-area reference locations", "Defines the physical areas used to organize flood sources, propagation paths, exposed SSCs, and scenarios. Record each hydraulically distinct room or connected area.")}</InfoButton></div>{editable && <AddButton label="Add flood area" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area", "Define a common spatial and hydraulic reference location."))} />}</div>
        {areas.length === 0 ? <p className="sanalysisbasis__empty">No flood-area reference locations defined.</p> : <div className="stablewrap"><table className="stable postable stable--technical"><thead><tr><th>Flood area</th><th>Building</th><th>Rooms</th><th>Floor elevation</th><th>Free volume</th></tr></thead><tbody>{areas.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area", "Edit the common spatial and hydraulic reference location.", index))}><td className="stable__key"><strong>{item.areaId} · {item.name}</strong></td><td>{item.building}</td><td>{item.rooms.join(" · ")}</td><td>{display(item.floorElevationMetres, "m")}</td><td>{display(item.netFreeVolumeCubicMetres, "m³")}</td></tr>)}</tbody></table></div>}
      </div>
    </Section>
    <InternalFloodInterfacesSection onEdit={(interfaceIndex, transferIndex) => setInterfaceEditor({ interfaceIndex, transferIndex })} />
    {scopeOpen && <AnalysisScopeEditor onClose={() => setScopeOpen(false)} operatingStates={operatingStates} materialSources={materialSources} />}
    {interfaceEditor !== null && <TechnicalInterfaceEditor key={`${String(interfaceEditor.interfaceIndex)}-${String(interfaceEditor.transferIndex)}`} selection={interfaceEditor} onClose={() => setInterfaceEditor(null)} />}
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function EvidenceBase(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const investigations = [...mef.plantPartitioning.investigations, ...mef.sourcesIdentificationAndCharacterization.investigations, ...mef.scenariosDevelopment.investigations, ...mef.humanReliabilityAnalysis.investigations];
  return <div className="flstep">
    <Section title="Controlled evidence register" description="Drawings, calculations, procedures, data, models, investigations, and reviews with revision, applicability, quality, and limitations." actions={editable ? <AddButton label="Add evidence" onClick={() => editor.setTarget(collectionTarget(["evidenceRegister"], "evidence record", "Register a controlled source and its applicability."))} /> : undefined}>
      <TechnicalTable records={mef.evidenceRegister} caption="Controlled evidence" empty="No controlled evidence" onEdit={(index) => editor.setTarget(collectionTarget(["evidenceRegister"], "evidence record", "Edit source, revision, applicability, quality, and limitations.", index))} columns={[
        { header: "Type", render: (item) => item.evidenceType.replace(/_/g, " "), width: "120px" },
        { header: "Source / revision", render: (item) => <>{item.sourceReference}<small className="flcellnote">{item.revision ?? "No revision"}</small></> },
        { header: "Applies to", render: (item) => <EmptyOrList values={item.applicableSubelements} /> },
        { header: "Control", render: (item) => <span className={`fltag ${item.controlled ? "fltag--good" : "fltag--warn"}`}>{item.controlled ? "CONTROLLED" : "WORKING"}</span>, width: "100px" },
      ]} />
    </Section>
    <Section title="Plant investigations" description="Walkdowns, interviews, tabletop reviews, and design reviews confirming spatial, source, path, SSC, and human-action information." actions={editable ? <AddButton label="Add investigation" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "investigations"], "plant investigation", "Document a walkdown, interview, tabletop review, or design review."))} /> : undefined}>
      <div className="fltimeline">{investigations.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["plantPartitioning", "investigations"], length: mef.plantPartitioning.investigations.length, title: "partitioning investigation" },
        { path: ["sourcesIdentificationAndCharacterization", "investigations"], length: mef.sourcesIdentificationAndCharacterization.investigations.length, title: "source investigation" },
        { path: ["scenariosDevelopment", "investigations"], length: mef.scenariosDevelopment.investigations.length, title: "scenario investigation" },
        { path: ["humanReliabilityAnalysis", "investigations"], length: mef.humanReliabilityAnalysis.investigations.length, title: "HRA investigation" },
      ], "Edit scope, participants, evidence, observations, confirmations, and follow-up actions."))}><span>{item.performedDate}</span><strong>{item.name}</strong><p>{item.scope}</p><small>{String(item.confirmedRecordRefs.length)} records confirmed · {String(item.observations.length)} observations</small></button>)}</div>
    </Section>
    <Section title="Evidence quality and open limitations" description="Evidence sufficiency, applicability limits, and controlled closure actions." actions={editable ? <EditButton label="Edit limitations" onClick={() => editor.setTarget({ title: "Evidence limitations", subtitle: "Maintain the controlled analysis limitations and metadata.", focus: ["metadata"], inlinePrimitiveArrays: true })} /> : undefined}>
      <div className="sanalysisbasis">
        <AnalysisRow label="Controlled evidence" value={mef.evidenceRegister.filter((item) => item.controlled).map((item) => item.name).join(" · ")} emptyValue="No controlled evidence" />
        <AnalysisRow label="Plant investigations" value={investigations.map((item) => item.name).join(" · ")} emptyValue="No plant investigations" />
        <AnalysisRow label="Controlled limitations" value={mef.metadata.limitations.join(" · ")} emptyValue="No controlled limitations" />
      </div>
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function BaselinePra(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const [interfaceEditor, setInterfaceEditor] = useState<InterfaceEditorSelection | null>(null);
  const baseline = mef.baselinePra;
  return <div className="flstep">
    <Section title="Frozen baseline PRA" description="Controlled model version, boundary, operating states, reactor units, radioactive-material sources, and design cutoff." actions={editable ? <EditButton label="Edit baseline" onClick={() => editor.setTarget({ title: "Baseline PRA", subtitle: "Define the frozen model and technical-area treatments.", focus: ["baselinePra"], inlinePrimitiveArrays: true })} /> : undefined}>
      {baseline === undefined ? <div className="flempty"><strong>No baseline PRA defined</strong><p>Add the source model before technical development.</p></div> : <div className="sanalysisbasis"><AnalysisRow label="Model" value={`${baseline.modelName} · ${baseline.modelReference}`} /><AnalysisRow label="Revision and freeze date" value={`${baseline.revision} · ${baseline.freezeDate}`} /><AnalysisRow label="Freeze status" value={baseline.freezeStatus.replace(/_/g, " ")} /><AnalysisRow label="Operating states" value={baseline.plantOperatingStateRefs.join(" · ")} /><AnalysisRow label="Reactor units" value={baseline.reactorUnitRefs.join(" · ")} /><AnalysisRow label="Model boundary" value={baseline.modelBoundary} /></div>}
    </Section>
    {baseline !== undefined && <Section title="Technical-area treatments" description="Baseline records explicitly reused, modified, created, or determined not applicable for Internal Flood PRA." actions={editable ? <AddButton label="Add treatment" onClick={() => editor.setTarget(collectionTarget(["baselinePra", "recordTreatments"], "baseline treatment", "Define how a baseline technical-area record is reused, modified, created, or excluded."))} /> : undefined}>
      <TechnicalTable records={baseline.recordTreatments} caption="Baseline treatments" empty="No baseline treatments" onEdit={(index) => editor.setTarget(collectionTarget(["baselinePra", "recordTreatments"], "baseline treatment", "Edit reuse, modification, new-model basis, and unresolved items.", index))} columns={[
        { header: "Technical area", render: (item) => item.technicalArea.replace(/_/g, " ") },
        { header: "Treatment", render: (item) => <span className="fltag fltag--neutral">{item.treatment}</span>, width: "105px" },
        { header: "Internal Flood change", render: (item) => item.internalFloodChange },
      ]} />
    </Section>}
    <Section title="Technical-element handoffs" description="Controlled inputs received from POS, IE, ES, SC, SY, HR, and DA and controlled outputs delivered to ESQ and Risk Integration." actions={editable ? <AddButton label="Add interface" onClick={() => editor.setTarget(collectionTarget(["integration", "interfaces"], "technical-element interface", "Define an external technical-element handoff and its transferred records."))} /> : undefined}>
      <FlowRows rows={mef.integration.interfaces.map((item) => ({ id: item.uuid, from: item.producer, through: `${item.role} · ${String(item.transferItems.length)} records`, to: item.consumer, status: item.consistent ? "CONTROLLED" : "OPEN" }))} onEdit={(index) => setInterfaceEditor({ interfaceIndex: index, transferIndex: 0 })} />
    </Section>
    {interfaceEditor !== null && <TechnicalInterfaceEditor key={`${String(interfaceEditor.interfaceIndex)}-${String(interfaceEditor.transferIndex)}`} selection={interfaceEditor} onClose={() => setInterfaceEditor(null)} />}
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function PlantPartitioning(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const pp = mef.plantPartitioning;
  return <div className="flstep">
    <Section title="Physical analysis boundary" description="Every location where an internal flood can affect modeled equipment, including shared, multi-reactor, and multi-source locations." actions={editable ? <EditButton label="Edit boundary" onClick={() => editor.setTarget({ title: "Physical analysis boundary", subtitle: "Define included structures, sources, elevations, hazard interfaces, and exclusions.", focus: ["plantPartitioning", "analysisBoundary"], inlinePrimitiveArrays: true, inlineObjectFields: ["includedElevationRange"] })} /> : undefined}>
      <div className="sanalysisbasis"><AnalysisRow label="Included buildings" value={pp.analysisBoundary.includedBuildings.join(" · ")} /><AnalysisRow label="Elevation range" value={`${display(pp.analysisBoundary.includedElevationRange.lowerMetres)} to ${display(pp.analysisBoundary.includedElevationRange.upperMetres)} m · ${pp.analysisBoundary.includedElevationRange.datum}`} /><AnalysisRow label="Reactor units" value={pp.analysisBoundary.reactorUnitRefs.join(" · ")} /><AnalysisRow label="Radioactive-material sources" value={pp.analysisBoundary.radioactiveMaterialSourceRefs.join(" · ")} /><AnalysisRow label="Multi-unit and shared-source basis" value={pp.analysisBoundary.multiUnitAndSharedSourceBasis} /><AnalysisRow label="Internal / external hazard interface" value={pp.analysisBoundary.internalExternalHazardInterface} /></div>
    </Section>
    <Section title="Flood areas" description="Complete, nonoverlapping physical analysis units with geometry, boundaries, elevations, drainage, SSCs, and operating-state attributes." actions={editable ? <AddButton label="Add flood area" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area", "Define the spatial and hydraulic partition."))} /> : undefined}>
      <TechnicalTable records={pp.floodAreas} caption="Flood areas" empty="No flood areas" onEdit={(index) => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area", "Edit geometry, barriers, drains, sources, credited SSCs, and confirmation basis.", index))} columns={[
        { header: "Building / rooms", render: (item) => <>{item.building}<small className="flcellnote">{item.rooms.join(" · ")}</small></> },
        { header: "Floor", render: (item) => display(item.floorElevationMetres, "m"), width: "90px" },
        { header: "Free volume", render: (item) => display(item.netFreeVolumeCubicMetres, "m³"), width: "105px" },
        { header: "Sources / SSCs", render: (item) => `${String(item.floodSourceRefs.length)} / ${String(item.creditedSscRefs.length)}`, width: "90px" },
        { header: "Confirmed", render: (item) => <span className={`fltag ${item.spatialInformationConfirmed ? "fltag--good" : "fltag--warn"}`}>{item.spatialInformationConfirmed ? "YES" : "OPEN"}</span>, width: "90px" },
      ]} />
    </Section>
    <Section title="Partitioning investigations and uncertainty" description="Field confirmation, model uncertainty, reasonable alternatives, and pre-operational closure controls." actions={editable ? <AddButton label="Add uncertainty" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "modelUncertainties"], "partitioning uncertainty", "Define the uncertainty, alternatives, treatment, sensitivity, and conclusion."))} /> : undefined}>
      <TechnicalTable records={[...pp.investigations, ...pp.modelUncertainties, ...pp.preOperationalAssumptions]} caption="Partitioning assurance records" empty="No assurance records" onEdit={(index) => { const path = index < pp.investigations.length ? ["plantPartitioning", "investigations"] : index < pp.investigations.length + pp.modelUncertainties.length ? ["plantPartitioning", "modelUncertainties"] : ["plantPartitioning", "preOperationalAssumptions"]; const local = index < pp.investigations.length ? index : index < pp.investigations.length + pp.modelUncertainties.length ? index - pp.investigations.length : index - pp.investigations.length - pp.modelUncertainties.length; editor.setTarget(collectionTarget(path, "assurance record", "Edit investigation, uncertainty, or assumption details.", local)); }} columns={[{ header: "Type", render: (item) => "investigationType" in item ? String(item.investigationType).replace(/_/g, " ") : "uncertaintyType" in item ? String(item.uncertaintyType) : "PRE-OP ASSUMPTION" }, { header: "Basis", render: (item) => item.basis }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span>, width: "90px" }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function FloodSources(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const so = mef.sourcesIdentificationAndCharacterization;
  return <div className="flstep">
    <Section title="Flood-source inventory" description="Fixed, transient, internal, and connected external sources by area, fluid, operating state, inventory, pressure, temperature, and isolation." actions={editable ? <AddButton label="Add source" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source", "Define a source segment and its operating conditions."))} /> : undefined}>
      <TechnicalTable records={so.sources} caption="Flood sources" empty="No flood sources" onEdit={(index) => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source", "Edit source location, fluid, pressure, temperature, inventory, operating states, and isolation.", index))} columns={[
        { header: "Type / fluid", render: (item) => <>{item.sourceType}<small className="flcellnote">{item.fluid}</small></>, width: "110px" },
        { header: "System", render: (item) => item.systemRef },
        { header: "Pressure", render: (item) => display(item.operatingPressureKpa, "kPa"), width: "100px" },
        { header: "Temperature", render: (item) => display(item.operatingTemperatureCelsius, "°C"), width: "100px" },
        { header: "Isolation", render: (item) => <EmptyOrList values={item.isolationRefs} /> },
      ]} />
    </Section>
    <Section title="Release envelope" description="Minimum, nominal, and maximum release flow with inventory and isolation duration for each limiting failure case." actions={editable ? <AddButton label="Add release case" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "releaseCharacterizations"], "release characterization", "Quantify flow, inventory, duration, volume, isolation, and uncertainty."))} /> : undefined}>
      <BarList tone="so" items={so.releaseCharacterizations.slice(0, 12).map((item) => ({ id: item.uuid, label: item.name, value: item.releaseRateCubicMetresPerMinute, detail: `${display(item.minimumReleaseRateCubicMetresPerMinute)}–${display(item.maximumReleaseRateCubicMetresPerMinute)} m³/min · ${display(item.unisolatedDurationMinutes)} min` }))} formatter={(value) => display(value, "m³/min")} onEdit={(index) => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "releaseCharacterizations"], "release characterization", "Edit flow, inventory, duration, isolation, volume, and uncertainty.", index))} />
    </Section>
    <Section title="Failure mechanisms" description="Pressure-boundary, human, maintenance, fire-suppression, overflow, and other credible source failures." actions={editable ? <AddButton label="Add failure mechanism" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "failureMechanisms"], "failure mechanism", "Define breach type, causes, effects, and operating states."))} /> : undefined}>
      <TechnicalTable records={so.failureMechanisms} caption="Source failure mechanisms" empty="No failure mechanisms" onEdit={(index) => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "failureMechanisms"], "failure mechanism", "Edit failure mechanism and breach characterization.", index))} columns={[{ header: "Mechanism", render: (item) => <span className="fltag fltag--neutral">{item.mechanism}</span> }, { header: "Breach", render: (item) => item.breachType }, { header: "Credible causes", render: (item) => <EmptyOrList values={item.credibleCauses} /> }, { header: "Effects", render: (item) => <EmptyOrList values={item.consequentialEffects} /> }]} />
    </Section>
    <Section title="Source screening, investigations, and uncertainty" description="Controlled screening bases, field confirmation, uncertainty treatments, and pre-operational closure actions." actions={editable ? <AddButton label="Add screening decision" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sourceScreeningDecisions"], "source screening decision", "Document a source-specific quantitative or qualitative disposition."))} /> : undefined}>
      <TechnicalTable records={[...so.sourceScreeningDecisions, ...so.investigations, ...so.modelUncertainties, ...so.preOperationalAssumptions]} caption="Source assurance" empty="No source assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["sourcesIdentificationAndCharacterization", "sourceScreeningDecisions"], length: so.sourceScreeningDecisions.length, title: "source screening decision" },
        { path: ["sourcesIdentificationAndCharacterization", "investigations"], length: so.investigations.length, title: "source investigation" },
        { path: ["sourcesIdentificationAndCharacterization", "modelUncertainties"], length: so.modelUncertainties.length, title: "source uncertainty" },
        { path: ["sourcesIdentificationAndCharacterization", "preOperationalAssumptions"], length: so.preOperationalAssumptions.length, title: "source pre-operational assumption" },
      ], "Edit the assurance basis, evidence, alternatives, closure, and status."))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => `${String(item.evidenceRefs.length)} controlled refs` }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function PropagationAndMitigation(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const sn = mef.scenariosDevelopment;
  const areaName = (ref: string) => mef.plantPartitioning.floodAreas.find((area) => area.uuid === ref)?.areaId ?? ref;
  return <div className="flstep">
    <Section title="Flood-propagation network" description="Horizontal and vertical paths, opening geometry, thresholds, directions, travel times, barriers, and operating-state dependencies." actions={editable ? <AddButton label="Add path" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "propagationPaths"], "propagation path", "Define a hydraulic connection between flood areas."))} /> : undefined}>
      <FlowRows rows={sn.propagationPaths.map((item) => ({ id: item.uuid, from: areaName(item.originFloodAreaRef), through: `${item.pathType.replace(/_/g, " ")} · ${display(item.flowCapacityCubicMetresPerMinute, "m³/min")}`, to: areaName(item.destinationFloodAreaRef), status: `${display(item.travelTimeMinutes, "min")}` }))} onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "propagationPaths"], "propagation path", "Edit geometry, direction, threshold, capacity, travel time, barriers, and operating-state dependencies.", index))} />
    </Section>
    <Section title="Mitigation features" description="Alarms, barriers, doors, drains, sumps, pumps, shielding, isolation, dependencies, capacities, and surveillance." actions={editable ? <AddButton label="Add feature" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "mitigationFeatures"], "mitigation feature", "Define capacity, credit, dependencies, failure modes, and operating-state availability."))} /> : undefined}>
      <TechnicalTable records={sn.mitigationFeatures} caption="Flood mitigation features" empty="No mitigation features" onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "mitigationFeatures"], "mitigation feature", "Edit feature capacity, credit, dependencies, failure modes, and surveillance.", index))} columns={[{ header: "Feature", render: (item) => item.featureType.replace(/_/g, " ") }, { header: "Area", render: (item) => areaName(item.floodAreaRef) }, { header: "Capacity", render: (item) => display(item.designCapacity, item.capacityUnit) }, { header: "Credit", render: (item) => <span className={`fltag ${item.credited ? "fltag--good" : "fltag--neutral"}`}>{item.credited ? "CREDITED" : "NOT CREDITED"}</span> }, { header: "Dependencies", render: (item) => `${String(item.dependentPowerRefs.length)} power · ${String(item.dependentHumanActionRefs.length)} human` }]} />
    </Section>
    <Section title="Drainage and propagation capacity" description="Comparison of path throughput and credited drainage or pumping capacity." actions={editable ? <EditButton label="Edit capacities" onClick={() => editor.setTarget({ title: "Drainage and propagation capacity", subtitle: "Edit propagation paths and mitigation-feature capacities.", focus: ["scenariosDevelopment"], visibleRootFields: ["propagationPaths", "mitigationFeatures"], inlinePrimitiveArrays: true })} /> : undefined}>
      <BarList tone="sn" items={[...sn.propagationPaths.map((item) => ({ id: item.uuid, label: `${areaName(item.originFloodAreaRef)} → ${areaName(item.destinationFloodAreaRef)}`, value: item.flowCapacityCubicMetresPerMinute, detail: item.pathType.replace(/_/g, " ") })), ...sn.mitigationFeatures.filter((item) => item.capacityUnit === "m3/min").map((item) => ({ id: item.uuid, label: item.name, value: item.designCapacity, detail: "credited mitigation" }))]} formatter={(value) => display(value, "m³/min")} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function ScenarioDevelopment(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const sn = mef.scenariosDevelopment;
  return <div className="flstep">
    <Section title="SSC flood susceptibility" description="Equipment-specific failure thresholds and operability bases for submergence, spray, condensation, temperature, pressure, jet, pipe whip, and chemical effects." actions={editable ? <AddButton label="Add SSC evaluation" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "sscSusceptibilities"], "SSC susceptibility", "Define location, functions, failure mechanisms, thresholds, evidence, and model links."))} /> : undefined}>
      <TechnicalTable records={sn.sscSusceptibilities} caption="SSC susceptibility" empty="No SSC susceptibility evaluations" onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "sscSusceptibilities"], "SSC susceptibility", "Edit mechanisms, thresholds, qualification, and failure-model references.", index))} columns={[{ header: "SSC", render: (item) => item.sscRef }, { header: "Mechanisms", render: (item) => <EmptyOrList values={item.failureMechanisms} /> }, { header: "Damage elevation", render: (item) => item.lowestDamageElevationMetres === undefined ? "—" : display(item.lowestDamageElevationMetres, "m") }, { header: "Operability basis", render: (item) => item.operabilityBasis.replace(/_/g, " ") }, { header: "Basic events", render: (item) => item.failureBasicEventRefs.length }]} />
    </Section>
    <Section title="Retained flood scenarios" description="Complete source-failure-path-target-mitigation-response combinations by plant operating state and affected reactor or source." actions={editable ? <AddButton label="Add scenario" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "floodScenarios"], "flood scenario", "Construct the source-path-target and response combination."))} /> : undefined}>
      <TechnicalTable records={sn.floodScenarios} caption="Flood scenarios" empty="No flood scenarios" onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "floodScenarios"], "flood scenario", "Edit sources, paths, targets, mitigation, response, operating states, and disposition.", index))} columns={[{ header: "Source / areas", render: (item) => <>{item.sourceRef}<small className="flcellnote">{String(item.affectedFloodAreaRefs.length)} affected areas</small></> }, { header: "Failed SSCs", render: (item) => <EmptyOrList values={item.failedSscRefs} /> }, { header: "Initiator", render: (item) => item.initiatingEventCandidate }, { header: "Operating states", render: (item) => item.plantOperatingStateRefs.length }, { header: "Disposition", render: (item) => <span className={`fltag ${item.disposition === "SCREENED" ? "fltag--neutral" : "fltag--good"}`}>{item.disposition}</span> }]} />
    </Section>
    <Section title="Hydraulic consequence profiles" description="Maximum height, time to maximum, time to SSC damage, release volume, drainage, and verified calculation basis." actions={editable ? <AddButton label="Add calculation" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "hydraulicCalculations"], "hydraulic calculation", "Define mass balance, consequence timing, model, time history, and verification."))} /> : undefined}>
      <BarList tone="sn" items={sn.hydraulicCalculations.map((item) => ({ id: item.uuid, label: item.name, value: item.maximumFloodHeightMetres, detail: `max at ${display(item.timeToMaximumHeightMinutes, "min")} · damage ${item.timeToCriticalDamageMinutes === undefined ? "not reached" : display(item.timeToCriticalDamageMinutes, "min")}` }))} formatter={(value) => display(value, "m")} onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "hydraulicCalculations"], "hydraulic calculation", "Edit mass balance, heights, timing, drainage, model, verification, and time history.", index))} />
    </Section>
    <Section title="Screening and scenario assurance" description="Area, source, and scenario screening; investigations; model uncertainty; and pre-operational limitations." actions={editable ? <AddButton label="Add screening decision" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "screeningDecisions"], "scenario screening decision", "Document a traceable scenario disposition and quantitative basis."))} /> : undefined}>
      <TechnicalTable records={[...sn.screeningDecisions, ...sn.investigations, ...sn.modelUncertainties, ...sn.preOperationalAssumptions]} caption="Scenario assurance" empty="No assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["scenariosDevelopment", "screeningDecisions"], length: sn.screeningDecisions.length, title: "scenario screening decision" },
        { path: ["scenariosDevelopment", "investigations"], length: sn.investigations.length, title: "scenario investigation" },
        { path: ["scenariosDevelopment", "modelUncertainties"], length: sn.modelUncertainties.length, title: "scenario uncertainty" },
        { path: ["scenariosDevelopment", "preOperationalAssumptions"], length: sn.preOperationalAssumptions.length, title: "scenario pre-operational assumption" },
      ], "Edit the assurance basis, related records, evidence, closure, and status."))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Related records", render: (item) => item.relatedRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function EventFrequency(): JSX.Element {
  const { mef, editable, mutate } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const ev = mef.initiatingEvents;
  return <div className="flstep">
    <HazardFaultTreeEditor
      models={mef.hazardConditionedModels}
      editable={editable}
      onChange={(hazardConditionedModels) => mutate((current) => ({ ...current, hazardConditionedModels }))}
    />
    <Section title="Scenario groups and initiating events" description="Scenario grouping based on compatible response, success criteria, timing, target effects, and human context, with baseline or new initiating-event mapping." actions={editable ? <AddButton label="Add scenario group" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "scenarioGroups"], "scenario group", "Group compatible retained flood scenarios."))} /> : undefined}>
      <TechnicalTable records={ev.scenarioGroups} caption="Scenario groups" empty="No scenario groups" onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "scenarioGroups"], "scenario group", "Edit members, grouping basis, bounding scenario, scope, and checks.", index))} columns={[{ header: "Scenarios", render: (item) => item.floodScenarioRefs.length }, { header: "Grouping basis", render: (item) => item.groupingBasis.replace(/_/g, " ") }, { header: "Units / sources", render: (item) => `${String(item.reactorUnitRefs.length)} / ${String(item.radioactiveMaterialSourceRefs.length)}` }, { header: "Checks", render: (item) => item.groupingValidityChecks.length }]} />
      <FlowRows rows={ev.initiatingEvents.map((item) => ({ id: item.uuid, from: item.scenarioGroupRef, through: item.newInitiatingEventRequired ? "NEW INITIATOR" : item.initiatingEventType.replace(/_/g, " "), to: item.affectedEventSequenceRefs.join(" · "), status: item.newInitiatingEventRequired ? "NEW" : "MAPPED" }))} onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "initiatingEvents"], "initiating-event mapping", "Edit the scenario-group initiator and affected baseline event-sequence references.", index))} />
    </Section>
    <Section title="Annual scenario-group frequencies" description="Plant-year source failure, operating-state exposure, allocation, maintenance contribution, mitigation failure, HEP, and uncertainty." actions={editable ? <AddButton label="Add frequency estimate" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyEstimates"], "frequency estimate", "Quantify the complete plant-year scenario-group frequency."))} /> : undefined}>
      <BarList tone="ev" items={ev.frequencyEstimates.map((item) => ({ id: item.uuid, label: item.name, value: item.meanFrequencyPerPlantYear, detail: `5–95%: ${display(item.fifthPercentileFrequencyPerPlantYear)}–${display(item.ninetyFifthPercentileFrequencyPerPlantYear)} /plant-year` }))} formatter={(value) => display(value, "/plant-year")} onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyEstimates"], "frequency estimate", "Edit the plant-year frequency model, contributors, uncertainty, and checks.", index))} />
    </Section>
    <Section title="Frequency data and mitigation reliability" description="Qualified event populations, exposure, distributions, aging models, applicability, and credited feature failure probabilities." actions={editable ? <AddButton label="Add data set" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyDataSets"], "frequency data set", "Define population, events, exposure, posterior distribution, and applicability."))} /> : undefined}>
      <TechnicalTable records={ev.frequencyDataSets} caption="Frequency data" empty="No frequency data" onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyDataSets"], "frequency data set", "Edit population, exposure, posterior, aging, and applicability.", index))} columns={[{ header: "Data type", render: (item) => item.dataType.replace(/_/g, " ") }, { header: "Events / exposure", render: (item) => `${String(item.eventCount)} / ${display(item.exposure)} ${item.exposureUnit.toLowerCase()}` }, { header: "Mean rate", render: (item) => display(item.meanRate, item.rateUnit) }, { header: "Distribution", render: (item) => item.distribution }]} />
    </Section>
    <Section title="Frequency screening and uncertainty" description="Quantitative screening, model uncertainty, alternatives, sensitivities, and pre-operational exposure assumptions." actions={editable ? <AddButton label="Add uncertainty" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "modelUncertainties"], "frequency uncertainty", "Define alternatives, treatment, sensitivity, conclusion, and evidence."))} /> : undefined}>
      <TechnicalTable records={[...ev.screeningDecisions, ...ev.modelUncertainties, ...ev.preOperationalAssumptions]} caption="Frequency assurance" empty="No assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["initiatingEvents", "screeningDecisions"], length: ev.screeningDecisions.length, title: "frequency screening decision" },
        { path: ["initiatingEvents", "modelUncertainties"], length: ev.modelUncertainties.length, title: "frequency uncertainty" },
        { path: ["initiatingEvents", "preOperationalAssumptions"], length: ev.preOperationalAssumptions.length, title: "frequency pre-operational assumption" },
      ], "Edit the screening, uncertainty, or pre-operational assurance record."))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => item.evidenceRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function PlantResponse(): JSX.Element {
  const { mef, editable, mutate } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const pr = mef.plantResponseModel;
  return <div className="flstep">
    <HazardEventTreeEditor
      models={mef.hazardConditionedModels}
      editable={editable}
      onChange={(hazardConditionedModels) => mutate((current) => ({ ...current, hazardConditionedModels }))}
    />
    <Section title="Flood event-sequence models" description="Baseline reuse, controlled modifications, new initiators, top events, end states, multi-unit logic, and release-family mapping." actions={editable ? <AddButton label="Add sequence model" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "eventSequenceModels"], "event-sequence model", "Define the flood-specific sequence logic and outcomes."))} /> : undefined}>
      <div className="flsequences">{pr.eventSequenceModels.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "eventSequenceModels"], "event-sequence model", "Edit initiating event, top events, outcomes, and multi-source logic.", index))}><span>{item.modelTreatment}</span><strong>{item.name}</strong><div>{item.topEvents.map((event) => <em key={event.uuid}>{event.name}</em>)}</div><small>{item.sequenceFamilyRefs.join(" · ")}</small></button>)}</div>
    </Section>
    <Section title="Systems-model changes" description="Flood-induced target failures, added basic events, isolation, recovery, shared support, consequential hazards, and verification." actions={editable ? <AddButton label="Add systems change" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "systemModelModifications"], "systems-model change", "Define flood target failures and logic changes."))} /> : undefined}>
      <TechnicalTable records={pr.systemModelModifications} caption="Systems model modifications" empty="No systems-model changes" onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "systemModelModifications"], "systems-model change", "Edit target failures, basic events, dependencies, isolation, recovery, and verification.", index))} columns={[{ header: "System", render: (item) => item.systemRef }, { header: "Treatment", render: (item) => <span className="fltag fltag--neutral">{item.treatment}</span> }, { header: "Flood failures", render: (item) => item.floodFailedSscRefs.length }, { header: "Added events", render: (item) => item.addedBasicEvents.length }, { header: "Shared dependencies", render: (item) => <EmptyOrList values={item.sharedDependencyRefs} /> }]} />
    </Section>
    <Section title="Success criteria and mission times" description="Flood-specific functional requirements, credited trains, SSCs, operator actions, analysis basis, operating states, and required duration." actions={editable ? <AddButton label="Add success criterion" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "successCriteria"], "success criterion", "Define functional success and engineering basis."))} /> : undefined}>
      <TechnicalTable records={pr.successCriteria} caption="Success criteria" empty="No success criteria" onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "successCriteria"], "success criterion", "Edit function, required equipment/actions, analysis, scope, and mission time.", index))} columns={[{ header: "Function", render: (item) => item.function }, { header: "Required SSCs", render: (item) => <EmptyOrList values={item.requiredSscRefs} /> }, { header: "Analysis", render: (item) => item.analysisMethod }, { header: "Mission", render: (item) => display(item.missionTimeHours, "h") }]} />
      <BarList tone="pr" items={pr.missionTimeAssessments.map((item) => ({ id: item.uuid, label: item.name, value: item.floodMissionTimeHours, detail: `${item.adequate ? "adequate" : "open"} · baseline ${display(item.baselineMissionTimeHours, "h")}` }))} formatter={(value) => display(value, "h")} onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "missionTimeAssessments"], "mission-time assessment", "Edit baseline and flood mission time, adequacy, and technical basis.", index))} />
    </Section>
    <Section title="Conditional plant-response results and assurance" description="Conditional sequence probability, annual frequency, peer-finding dispositions, uncertainty, and pre-operational assumptions." actions={editable ? <AddButton label="Add response result" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "plantResponseResults"], "plant response result", "Record conditional probability, annual frequency, release categories, and contributors."))} /> : undefined}>
      <TechnicalTable records={pr.plantResponseResults} caption="Plant response results" empty="No plant response results" onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "plantResponseResults"], "plant response result", "Edit conditional probability, annual frequency, release categories, and contributors.", index))} columns={[{ header: "Conditional probability", render: (item) => display(item.conditionalSequenceFamilyProbability) }, { header: "Annual frequency", render: (item) => display(item.annualSequenceFamilyFrequency, "/plant-year") }, { header: "Release categories", render: (item) => <EmptyOrList values={item.releaseCategoryRefs} /> }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function HumanReliability(): JSX.Element {
  const { mef, editable, mutate } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const hr = mef.humanReliabilityAnalysis;
  const timingByHfe = new Map(hr.timingAssessments.map((item) => [item.humanFailureEventRef, item]));
  return <div className="flstep">
    <HazardBayesianNetworkEditor
      models={mef.hazardConditionedModels}
      editable={editable}
      onChange={(hazardConditionedModels) => mutate((current) => ({ ...current, hazardConditionedModels }))}
    />
    <Section title="Flood-specific human actions and HFEs" description="Baseline and new actions, undesired responses, cues, locations, procedures, crews, equipment, outcomes, and complete HFE definitions." actions={editable ? <SectionActions><AddButton label="Add action" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanActions"], "human action", "Define the flood-specific operator task and context."))} /><AddButton label="Add HFE" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanFailureEvents"], "human failure event", "Define the failed action, scenario scope, event-sequence logic, and dependency candidates."))} /><AddButton label="Add context" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "performanceContexts"], "performance context", "Define flood-specific cues, stress, access, communication, procedures, workload, and environment."))} /></SectionActions> : undefined}>
      <TechnicalTable records={hr.humanActions} caption="Human actions" empty="No human actions" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanActions"], "human action", "Edit task type, scenario, procedure, crew, cues, equipment, and required outcome.", index))} columns={[{ header: "Type", render: (item) => item.actionType.replace(/_/g, " ") }, { header: "Crew / location", render: (item) => <>{item.crew}<small className="flcellnote">{item.actionLocation}</small></> }, { header: "Cues", render: (item) => <EmptyOrList values={item.cues} /> }, { header: "Cue failures", render: (item) => item.floodInducedCueFailures.length }]} />
      <TechnicalTable records={hr.humanFailureEvents} caption="Human failure events" empty="No human failure events" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanFailureEvents"], "human failure event", "Edit the action linkage, scenario scope, logic, dependencies, and screening basis.", index))} columns={[{ header: "Action / basic event", render: (item) => <>{item.humanActionRef}<small className="flcellnote">{item.basicEventRef}</small></> }, { header: "Failure definition", render: (item) => item.failureDefinition }, { header: "Sequence events", render: (item) => item.affectedEventSequenceRefs.length }, { header: "Areas / POS", render: (item) => `${String(item.floodAreaRefs.length)} / ${String(item.plantOperatingStateRefs.length)}` }]} />
      <TechnicalTable records={hr.performanceContexts} caption="Performance contexts" empty="No performance contexts" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "performanceContexts"], "performance context", "Edit cues, stress, access, communication, procedures, workload, staffing, and environment.", index))} columns={[{ header: "HFE", render: (item) => item.humanFailureEventRef }, { header: "Diagnosis / cues", render: (item) => `${item.diagnosisComplexity} / ${item.cueQuality}` }, { header: "Procedure", render: (item) => item.procedureQuality }, { header: "Staffing / workload", render: (item) => item.staffingAndWorkload }, { header: "Route depth", render: (item) => display(item.maximumRouteWaterDepthMetres, "m") }]} />
    </Section>
    <Section title="Timing and feasibility" description="Cue, diagnosis, travel, execution, contingency, deadline, margin, route, and walkdown feasibility for credited actions." actions={editable ? <AddButton label="Add timing case" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "timingAssessments"], "timing assessment", "Build the scenario-specific action timeline."))} /> : undefined}>
      <BarList tone="hr" items={hr.timingAssessments.map((item) => ({ id: item.uuid, label: item.name, value: Math.max(0, item.marginMinutes), detail: `${display(item.totalRequiredMinutes, "min")} required · deadline ${display(item.damageOrDeadlineMinutes, "min")} · ${item.feasible ? "feasible" : "not feasible"}` }))} formatter={(value) => display(value, "min margin")} onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "timingAssessments"], "timing assessment", "Edit cue, diagnosis, travel, execution, deadline, route, and feasibility.", index))} />
    </Section>
    <Section title="HEP quantification" description="Scenario-specific HEPs, methods, uncertainty intervals, timing, performance conditions, recovery, inputs, and calculations." actions={editable ? <AddButton label="Add HEP estimate" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "hepEstimates"], "HEP estimate", "Quantify the flood-specific human failure probability."))} /> : undefined}>
      <TechnicalTable records={hr.hepEstimates} caption="HEP estimates" empty="No HEP estimates" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "hepEstimates"], "HEP estimate", "Edit method, probability, uncertainty, timing, PSFs, and recovery.", index))} columns={[{ header: "Method", render: (item) => item.method }, { header: "Mean HEP", render: (item) => display(item.meanHep) }, { header: "5–95%", render: (item) => `${display(item.fifthPercentileHep)}–${display(item.ninetyFifthPercentileHep)}` }, { header: "Time margin", render: (item) => display(timingByHfe.get(item.humanFailureEventRef)?.marginMinutes ?? 0, "min") }, { header: "Recovery", render: (item) => item.recoveryCredit ? "Credited" : "None" }]} />
    </Section>
    <Section title="Human-action dependencies and assurance" description="Common crew, cues, procedures, routes, timing, joint probability, investigations, uncertainty, and pre-operational closure." actions={editable ? <SectionActions><AddButton label="Add dependency" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "dependencyGroups"], "dependency group", "Define common influences and joint treatment."))} /><AddButton label="Add uncertainty" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "modelUncertainties"], "HRA uncertainty", "Define alternatives, treatment, sensitivity, and conclusion."))} /></SectionActions> : undefined}>
      <TechnicalTable records={hr.dependencyGroups} caption="HFE dependencies" empty="No HFE dependencies" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "dependencyGroups"], "dependency group", "Edit shared influences, level, separation, and joint probability.", index))} columns={[{ header: "HFEs", render: (item) => item.humanFailureEventRefs.length }, { header: "Level", render: (item) => <span className="fltag fltag--neutral">{item.dependencyLevel}</span> }, { header: "Shared factors", render: (item) => [item.commonCrew && "crew", item.commonCue && "cue", item.commonProcedure && "procedure", item.commonLocationOrRoute && "route"].filter(Boolean).join(" · ") }, { header: "Joint probability", render: (item) => display(item.jointFailureProbability) }]} />
      <TechnicalTable records={[...hr.investigations, ...hr.modelUncertainties, ...hr.preOperationalAssumptions]} caption="HRA assurance" empty="No HRA assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["humanReliabilityAnalysis", "investigations"], length: hr.investigations.length, title: "HRA investigation" },
        { path: ["humanReliabilityAnalysis", "modelUncertainties"], length: hr.modelUncertainties.length, title: "HRA uncertainty" },
        { path: ["humanReliabilityAnalysis", "preOperationalAssumptions"], length: hr.preOperationalAssumptions.length, title: "HRA pre-operational assumption" },
      ], "Edit the investigation, uncertainty, or pre-operational assurance record."))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => item.evidenceRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function Quantification(): JSX.Element {
  const { mef, editable, mutate } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const esq = mef.eventSequenceQuantification;
  return <div className="flstep">
    <HazardBayesianNetworkEditor
      models={mef.hazardConditionedModels}
      editable={editable}
      onChange={(hazardConditionedModels) => mutate((current) => ({ ...current, hazardConditionedModels }))}
    />
    <Section title="Controlled quantification runs" description="Model, code, solver, truncation, sampling, convergence, independent checks, and verification." actions={editable ? <AddButton label="Add run" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "quantificationRuns"], "quantification run", "Define numerical settings, convergence, scope, and checks."))} /> : undefined}>
      <TechnicalTable records={esq.quantificationRuns} caption="Quantification runs" empty="No quantification runs" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "quantificationRuns"], "quantification run", "Edit model, solver, truncation, sampling, convergence, and verification.", index))} columns={[{ header: "Model / solver", render: (item) => <>{item.modelVersion}<small className="flcellnote">{item.solverVersion}</small></> }, { header: "Truncation", render: (item) => display(item.truncationLimitPerPlantYear, "/plant-year") }, { header: "Samples", render: (item) => display(item.sampleCount) }, { header: "Convergence", render: (item) => `${display(item.convergenceMetric)} ≤ ${display(item.convergenceCriterion)}` }, { header: "Result", render: (item) => <span className={`fltag ${item.converged ? "fltag--good" : "fltag--warn"}`}>{item.converged ? "CONVERGED" : "OPEN"}</span> }]} />
    </Section>
    <Section title="Event-sequence-family frequencies" description="Annual mean, median, uncertainty interval, conditional probability, release category, operating-state scope, and dominant cutsets." actions={editable ? <AddButton label="Add result" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "eventSequenceFamilyResults"], "sequence-family result", "Record the complete annual risk result."))} /> : undefined}>
      <BarList tone="esq" items={esq.eventSequenceFamilyResults.map((item) => ({ id: item.uuid, label: `${item.eventSequenceFamilyRef} · ${item.releaseCategoryRef}`, value: item.meanFrequencyPerPlantYear, detail: `5–95%: ${display(item.fifthPercentileFrequencyPerPlantYear)}–${display(item.ninetyFifthPercentileFrequencyPerPlantYear)} /plant-year` }))} formatter={(value) => display(value, "/plant-year")} onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "eventSequenceFamilyResults"], "sequence-family result", "Edit annual frequency, uncertainty interval, conditional probability, cutsets, and screening.", index))} />
    </Section>
    <Section title="Risk-significant contributors" description="Ranked operating states, initiating events, sequences, basic events, areas, sources, scenarios, phenomena, SSCs, and human actions." actions={editable ? <AddButton label="Add contributor" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "riskContributors"], "risk contributor", "Record importance and risk-significance measures."))} /> : undefined}>
      <TechnicalTable records={esq.riskContributors} caption="Risk contributors" empty="No risk contributors" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "riskContributors"], "risk contributor", "Edit contributor type, frequency, fraction, importance, ranking, and affected families.", index))} columns={[{ header: "Rank / type", render: (item) => <><strong>#{item.ranking}</strong><small className="flcellnote">{item.contributorType.replace(/_/g, " ")}</small></> }, { header: "Contribution", render: (item) => display(item.absoluteFrequencyContributionPerPlantYear, "/plant-year") }, { header: "Fraction", render: (item) => `${display(item.fractionalContribution * 100)}%` }, { header: "FV / RAW", render: (item) => `${display(item.fussellVesely)} / ${display(item.riskAchievementWorth)}` }, { header: "Significance", render: (item) => <span className={`fltag ${item.riskSignificant ? "fltag--good" : "fltag--neutral"}`}>{item.riskSignificant ? "SIGNIFICANT" : "LOWER"}</span> }]} />
    </Section>
    <Section title="Uncertainty, dependencies, and sensitivity" description="Integrated uncertainty propagation, dependency implementation, model alternatives, sensitivity results, and risk-profile stability." actions={editable ? <SectionActions><AddButton label="Add dependency" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "dependencies"], "quantification dependency", "Define correlated events, affected groups, treatment, implementation, and verification."))} /><AddButton label="Add sensitivity" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "sensitivityStudies"], "sensitivity study", "Define the varied inputs, alternative model, result movement, ranking changes, and conclusion."))} /></SectionActions> : undefined}>
      <TechnicalTable records={esq.dependencies} caption="Quantification dependencies" empty="No quantification dependencies" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "dependencies"], "quantification dependency", "Edit dependency type, correlated events, groups, treatment, implementation, and verification.", index))} columns={[{ header: "Type", render: (item) => item.dependencyType.replace(/_/g, " ") }, { header: "Events / groups", render: (item) => `${String(item.dependentEventRefs.length)} / ${String(item.affectedScenarioGroupRefs.length)}` }, { header: "Treatment", render: (item) => item.treatment }, { header: "Correlation / joint", render: (item) => `${display(item.correlationCoefficient)} / ${display(item.jointProbability)}` }]} />
      <TechnicalTable records={esq.uncertaintyResults} caption="Quantified uncertainty" empty="No uncertainty results" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "uncertaintyResults"], "uncertainty result", "Edit sources, propagation method, distributions, intervals, dependencies, and operating-state effects.", index))} columns={[{ header: "Method", render: (item) => item.propagationMethod }, { header: "Mean", render: (item) => display(item.meanFrequencyPerPlantYear, "/plant-year") }, { header: "5–95%", render: (item) => `${display(item.fifthPercentileFrequencyPerPlantYear)}–${display(item.ninetyFifthPercentileFrequencyPerPlantYear)}` }, { header: "Sources", render: (item) => item.uncertaintySourceRefs.length }]} />
      <BarList tone="esq" items={esq.sensitivityStudies.map((item) => ({ id: item.uuid, label: item.name, value: Math.abs(item.relativeChange), detail: `${item.relativeChange >= 0 ? "+" : ""}${display(item.relativeChange * 100)}% · ${item.conclusion}` }))} formatter={(value) => `${display(value * 100)}%`} onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "sensitivityStudies"], "sensitivity study", "Edit varied inputs, alternative model, results, ranking changes, and conclusion.", index))} />
      <TechnicalTable records={[...esq.modelUncertainties, ...esq.preOperationalAssumptions]} caption="Quantification assurance" empty="No quantification assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["eventSequenceQuantification", "modelUncertainties"], length: esq.modelUncertainties.length, title: "quantification uncertainty" },
        { path: ["eventSequenceQuantification", "preOperationalAssumptions"], length: esq.preOperationalAssumptions.length, title: "quantification pre-operational assumption" },
      ], "Edit the uncertainty or pre-operational assurance record."))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => item.evidenceRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
    </Section>
    <Section title="End-to-end quantification traceability" description="Evidence, areas, sources, scenarios, initiators, models, HFEs, sequence families, results, and contributors." actions={editable ? <AddButton label="Add trace" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "traceability"], "quantification trace", "Link evidence through quantification results and risk contributors."))} /> : undefined}>
      <FlowRows rows={esq.traceability.map((item) => ({ id: item.uuid, from: item.floodScenarioRefs.join(" · "), through: item.eventSequenceFamilyRefs.join(" · "), to: item.quantificationResultRefs.join(" · "), status: item.complete ? "COMPLETE" : "OPEN" }))} onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "traceability"], "quantification trace", "Edit the complete evidence-to-result chain.", index))} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function RiskInterpretation(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const risk = mef.riskInterpretation;
  return <div className="flstep">
    <Section title="Integrated risk insights" description="Decision-relevant contributors, defense-in-depth observations, model limitations, uncertainties, and design opportunities." actions={editable ? <AddButton label="Add risk insight" onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "riskInsights"], "risk insight", "Explain the result and its decision implication."))} /> : undefined}>
      <div className="flinsights">{risk.riskInsights.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "riskInsights"], "risk insight", "Edit type, contributors, metric, contribution, and implication.", index))}><span>{item.insightType.replace(/_/g, " ")}</span><strong>{item.name}</strong><p>{item.description}</p><em>{item.decisionImplication}</em>{item.fractionalContribution !== undefined && <b>{display(item.fractionalContribution * 100)}%</b>}</button>)}</div>
    </Section>
    <Section title="Risk-driven model refinements" description="Evidence, source, scenario, frequency, plant-response, HRA, and quantification improvements targeted by contributor ranking." actions={editable ? <AddButton label="Add refinement" onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "refinementActions"], "model refinement", "Define driver, affected records, expected effect, status, and decision basis."))} /> : undefined}>
      <TechnicalTable records={risk.refinementActions} caption="Model refinements" empty="No model refinements" onEdit={(index) => editor.setTarget(collectionTarget(["riskInterpretation", "refinementActions"], "model refinement", "Edit drivers, actions, priority, status, result, and decision basis.", index))} columns={[{ header: "Area", render: (item) => item.technicalArea }, { header: "Priority", render: (item) => <span className="fltag fltag--neutral">{item.priority}</span> }, { header: "Refinement", render: (item) => item.refinement }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.refinementStatus}</span> }, { header: "Result", render: (item) => item.result }]} />
    </Section>
    <Section title="Refinement stability" description="Successive model results, relative and family changes, contributor rankings, new significant contributors, and stopping decisions." actions={editable ? <AddButton label="Add iteration" onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "quantificationIterations"], "refinement iteration", "Record model change, result movement, ranking stability, and decision."))} /> : undefined}>
      <div className="fliterations">{risk.quantificationIterations.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "quantificationIterations"], "refinement iteration", "Edit the model change, result movement, ranking stability, and stopping decision.", index))}><span>{item.modelVersion}</span><strong>{display(item.aggregateMeanFrequencyPerPlantYear, "/plant-year")}</strong><small>{item.relativeChange === undefined ? "Initial result" : `${item.relativeChange >= 0 ? "+" : ""}${display(item.relativeChange * 100)}% from prior`}</small><em className={item.decision === "ACCEPT_STABLE" ? "fliterations__stable" : ""}>{item.decision.replace(/_/g, " ")}</em></button>)}</div>
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function RiskIntegration(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const baseline = mef.riskIntegrationBaseline;
  const result = baseline.results[0];
  return <div className="flstep">
    <Section title="Controlled risk handoff" description="Final plant-year risk metrics, uncertainty, release families, scope, overlap treatment, contributors, and risk-integration status." actions={editable ? <SectionActions>{result !== undefined && <EditButton label="Edit result" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "results"], "risk-integration result", "Edit the final risk handoff and overlap treatment.", 0))} />}<AddButton label="Add result" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "results"], "risk-integration result", "Define the final risk handoff."))} /></SectionActions> : undefined}>
      {result === undefined ? <div className="flempty"><strong>No integrated result</strong><p>Add the controlled Internal Flood risk result.</p></div> : <div className="sanalysisbasis"><AnalysisRow label="Model version" value={result.modelVersion} /><AnalysisRow label="Aggregate mean" value={display(result.aggregateMeanFrequencyPerPlantYear, "/plant-year")} /><AnalysisRow label="5th percentile" value={display(result.fifthPercentileFrequencyPerPlantYear, "/plant-year")} /><AnalysisRow label="95th percentile" value={display(result.ninetyFifthPercentileFrequencyPerPlantYear, "/plant-year")} /><AnalysisRow label="Integration status" value={result.integrationStatus.replace(/_/g, " ")} /><AnalysisRow label="Cross-hazard overlap treatment" value={result.overlapTreatment} /></div>}
    </Section>
    <Section title="Risk-informed decisions" description="Design, procedure, configuration-control, monitoring, data, and model actions tied to the controlled risk result." actions={editable ? <AddButton label="Add decision" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "decisions"], "risk decision", "Define driver, action, disposition, owner, verification, and reanalysis need."))} /> : undefined}>
      <TechnicalTable records={baseline.decisions} caption="Risk decisions" empty="No risk decisions" onEdit={(index) => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "decisions"], "risk decision", "Edit drivers, affected SSCs, action, disposition, verification, and reanalysis.", index))} columns={[{ header: "Type", render: (item) => item.decisionType.replace(/_/g, " ") }, { header: "Action", render: (item) => item.action }, { header: "Disposition", render: (item) => <span className="fltag fltag--good">{item.disposition}</span> }, { header: "Due", render: (item) => item.duePhase }, { header: "Reanalysis", render: (item) => item.reanalysisRequired ? "Required" : "No" }]} />
    </Section>
    <Section title="End-to-end decision traceability" description="Evidence-to-area-to-source-to-path-to-scenario-to-initiator-to-HFE-to-result-to-decision linkage." actions={editable ? <AddButton label="Add decision trace" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "traceabilityPaths"], "decision trace", "Link controlled evidence through the risk result and decision."))} /> : undefined}>
      <FlowRows rows={baseline.traceabilityPaths.map((item) => ({ id: item.uuid, from: `${String(item.floodAreaRefs.length)} areas · ${String(item.floodSourceRefs.length)} sources`, through: item.eventSequenceFamilyRefs.join(" · "), to: item.decisionRefs.join(" · "), status: item.complete ? "COMPLETE" : "OPEN" }))} onEdit={(index) => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "traceabilityPaths"], "decision trace", "Edit the complete evidence-to-decision chain.", index))} />
    </Section>
    <Section title="Controlled baseline package" description="Model, quantification archive, report, configuration record, peer review, manifest, limitations, and release status." actions={editable ? <AddButton label="Add baseline" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "controlledBaselines"], "controlled baseline", "Define the released model and supporting package."))} /> : undefined}>
      <TechnicalTable records={baseline.controlledBaselines} caption="Controlled baselines" empty="No controlled baseline" onEdit={(index) => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "controlledBaselines"], "controlled baseline", "Edit model, archive, report, configuration, review, manifest, limitations, and status.", index))} columns={[{ header: "Model", render: (item) => item.modelVersion }, { header: "Quantification", render: (item) => item.quantificationRunRef }, { header: "Configuration", render: (item) => item.configurationControlRecordId }, { header: "Peer review", render: (item) => item.peerReviewRef }, { header: "Release", render: (item) => <span className="fltag fltag--good">{item.releaseStatus}</span> }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

export function InternalFloodPraStepScreen({ stepId }: { stepId: string }): JSX.Element {
  const screen = useMemo(() => stepId, [stepId]);
  switch (screen) {
    case "analysis-basis": return <AnalysisBasis />;
    case "evidence-base": return <EvidenceBase />;
    case "baseline-pra": return <BaselinePra />;
    case "plant-partitioning": return <PlantPartitioning />;
    case "flood-sources": return <FloodSources />;
    case "propagation-mitigation": return <PropagationAndMitigation />;
    case "scenario-development": return <ScenarioDevelopment />;
    case "event-frequency": return <EventFrequency />;
    case "plant-response": return <PlantResponse />;
    case "human-reliability": return <HumanReliability />;
    case "quantification": return <Quantification />;
    case "risk-interpretation": return <RiskInterpretation />;
    case "risk-integration": return <RiskIntegration />;
    default: return <div className="flnotice flnotice--danger">Internal Flood step not found.</div>;
  }
}
