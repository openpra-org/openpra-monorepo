import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { HazardEventTreeEditor, HazardFaultTreeEditor } from "../workbooks/hazardConditionedModelEditors";
import {
  type InternalFireAnalysisRecord,
  type InternalFirePRA,
  type InternalFirePraApplication,
  type InternalFireRecordStatus,
} from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { synchronizeInternalFirePraDerivedRegisters } from "interfaces-mef-types/internal-fire/internal-fire-pra-validation";
import { InternalFirePRASchema } from "interfaces-mef-types/zod/internal-fire/internal-fire-pra";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { removeStructuredRecord, StructuredEditorDrawer, type EditorPath } from "../seismic-pra-workbooks/seismicPraStructuredEditor";
import { Drawer, Field, NumberInput, Section, SelectInput, TextArea, TextInput } from "./internalFirePraFields";
import { useInternalFirePraWorkbook } from "./internalFirePraWorkbookContext";
import "../seismic-pra-workbooks/css/seismicPra.css";

interface EditorTarget {
  title: string;
  focus: EditorPath;
  createAt?: EditorPath;
  removeLabel?: string;
  visibleRootFields?: string[];
  inlinePrimitiveArrays?: boolean;
  inlineObjectFields?: string[];
}

interface RecordSection {
  title: string;
  path: EditorPath;
  singular: string;
  empty: string;
  columns: Array<{ label: string; key: string }>;
}

type SemanticRecord = InternalFireAnalysisRecord & Record<string, unknown>;

const EDITOR_HIDDEN_FIELDS = ["uuid", "implementsSrs", "standardRequirementRefs", "transferBasis"];

function display(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(" · ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1_000_000)
    ? value.toExponential(2).replace("e", "E")
    : value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
  if (value !== null && typeof value === "object") return Object.values(value as Record<string, unknown>).map(display).join(" · ");
  return String(value ?? "—");
}

function titleCase(value: string): string { return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function statusTone(status: InternalFireRecordStatus): string {
  if (status === "DRAFT" || status === "OPEN") return "fltag--warn";
  if (status === "SCREENED") return "fltag--neutral";
  return "fltag--good";
}
function valueAt(root: unknown, path: EditorPath): unknown {
  let current = root;
  for (const segment of path) current = (current as Record<string | number, unknown> | undefined)?.[segment];
  return current;
}

function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Pencil /> {label}</button>;
}
function AddButton({ onClick, label }: { onClick: () => void; label: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Plus /> {label}</button>;
}
function AnalysisRow({ label, value, emptyValue = "Not defined" }: { label: string; value: string; emptyValue?: string }): JSX.Element {
  return <div className="sanalysisbasis__row"><span>{label}</span><strong title={value}>{value.trim().length > 0 ? value : emptyValue}</strong></div>;
}

function Editor({ target, onClose }: { target: EditorTarget | null; onClose: () => void }): JSX.Element | null {
  const { mef, editable, mutate } = useInternalFirePraWorkbook();
  if (target === null) return null;
  return <StructuredEditorDrawer
    eyebrow="Internal Fire PRA"
    title={target.title}
    schema={InternalFirePRASchema}
    value={mef}
    editable={editable}
    initialFocus={target.focus}
    createAt={target.createAt}
    hiddenRootFields={EDITOR_HIDDEN_FIELDS}
    visibleRootFields={target.visibleRootFields}
    inlinePrimitiveArrays={target.inlinePrimitiveArrays ?? true}
    inlineObjectFields={target.inlineObjectFields}
    onClose={onClose}
    onApply={(value) => mutate(() => synchronizeInternalFirePraDerivedRegisters(value))}
    onRemove={target.removeLabel === undefined ? undefined : () => mutate((current) => synchronizeInternalFirePraDerivedRegisters(removeStructuredRecord(current, target.focus) as InternalFirePRA))}
    removeLabel={target.removeLabel}
  />;
}

function collectionTarget(path: EditorPath, title: string, index?: number, visibleRootFields?: string[]): EditorTarget {
  return index === undefined
    ? { title: `Add ${title}`, focus: [], createAt: path, inlinePrimitiveArrays: true, visibleRootFields }
    : { title: `Edit ${title}`, focus: [...path, index], removeLabel: `Remove ${title}`, inlinePrimitiveArrays: true, visibleRootFields };
}

function useEditor(): { target: EditorTarget | null; setTarget: (target: EditorTarget | null) => void } {
  const [target, setTarget] = useState<EditorTarget | null>(null);
  return { target, setTarget };
}

function RecordTable({ records, section, onEdit }: { records: SemanticRecord[]; section: RecordSection; onEdit: (index: number) => void }): JSX.Element {
  if (records.length === 0) return <div className="flempty"><strong>{section.empty}</strong><p>Add a complete structured record with the section action.</p></div>;
  return <div className="fltablewrap"><table className="fltable" aria-label={section.title}><thead><tr><th>Record</th>{section.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Status</th><th><span className="sr-only">Edit</span></th></tr></thead><tbody>{records.map((record, index) => <tr key={record.uuid}><td><button type="button" className="fltable__record" onClick={() => onEdit(index)}><strong>{record.name}</strong><code>{record.code}</code></button></td>{section.columns.map((column) => <td key={`${record.uuid}-${column.key}`}>{column.key === "description" ? record.description : display(record[column.key])}</td>)}<td><span className={`fltag ${statusTone(record.status)}`}>{record.status}</span></td><td><button type="button" className="fltable__edit" aria-label={`Edit ${record.name}`} onClick={() => onEdit(index)}><POSIcon.Pencil /></button></td></tr>)}</tbody></table></div>;
}

function RecordSectionView({ config, editor }: { config: RecordSection; editor: ReturnType<typeof useEditor> }): JSX.Element {
  const { mef, editable } = useInternalFirePraWorkbook();
  const records = valueAt(mef, config.path) as SemanticRecord[];
  return <Section title={config.title} actions={editable ? <AddButton label={`Add ${config.singular}`} onClick={() => editor.setTarget(collectionTarget(config.path, config.singular))} /> : undefined}>
    <RecordTable records={records} section={config} onEdit={(index) => editor.setTarget(collectionTarget(config.path, config.singular, index))} />
  </Section>;
}

type ScopeDraft = {
  applicationName: string; purpose: string; decisionContext: string; supportedRiskMetrics: string; plantName: string;
  siteName: string; vendor: string; reactorType: string; thermalPower: string; numberOfModules: number; praScope: string;
};
function technicalList(value: string): string[] { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function defaultApplication(owner: string): InternalFirePraApplication {
  return { uuid: crypto.randomUUID(), code: "F-APP-001", name: "", description: "", basis: "", owner, status: "DRAFT", evidenceRefs: [], relatedRefs: [], assumptionRefs: [], implementsSrs: [], purpose: "", decisionContext: "", supportedRiskMetrics: [], consumingElementRefs: [], configurationBasis: "", limitations: [] };
}

function AnalysisScopeEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, mutate } = useInternalFirePraWorkbook();
  const application = mef.applications[0];
  const identity = mef.metadata.plantIdentity ?? { name: mef.name, vendor: "", reactorType: "", thermalPower: "", primaryCoolant: "", numberOfModules: 1 };
  const [draft, setDraft] = useState<ScopeDraft>(() => ({
    applicationName: application?.name ?? "", purpose: application?.purpose ?? "", decisionContext: application?.decisionContext ?? "",
    supportedRiskMetrics: application?.supportedRiskMetrics.join("\n") ?? "", plantName: identity.name, siteName: identity.siteName ?? "",
    vendor: identity.vendor, reactorType: identity.reactorType, thermalPower: identity.thermalPower, numberOfModules: identity.numberOfModules ?? 1, praScope: mef.praScope,
  }));
  function save(): void {
    mutate((current) => {
      const next = structuredClone(current);
      const saved = { ...(next.applications[0] ?? defaultApplication(next.owner ?? "Internal Fire PRA Team")), name: draft.applicationName, purpose: draft.purpose, description: draft.purpose, decisionContext: draft.decisionContext, basis: draft.decisionContext, supportedRiskMetrics: technicalList(draft.supportedRiskMetrics) };
      next.applications = [saved, ...next.applications.slice(1)];
      next.metadata.plantIdentity = { ...(next.metadata.plantIdentity ?? identity), name: draft.plantName, siteName: draft.siteName, vendor: draft.vendor, reactorType: draft.reactorType, thermalPower: draft.thermalPower, numberOfModules: Math.max(1, Math.round(draft.numberOfModules)) };
      next.praScope = draft.praScope;
      next.metadata.scope = draft.praScope;
      return synchronizeInternalFirePraDerivedRegisters(next);
    });
    onClose();
  }
  return <Drawer title="PRA analysis and scope" onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>{editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}</>}>
    <fieldset className="sinlineeditor" disabled={!editable}><div className="sinlineeditor__group"><WorkbookSectionHeading title="PRA application" className="sinlineeditor__title" /><Field label="Intended application"><TextInput value={draft.applicationName} onChange={(value) => setDraft((item) => ({ ...item, applicationName: value }))} /></Field><Field label="Purpose"><TextArea rows={3} value={draft.purpose} onChange={(value) => setDraft((item) => ({ ...item, purpose: value }))} /></Field><Field label="Decision supported"><TextArea rows={3} value={draft.decisionContext} onChange={(value) => setDraft((item) => ({ ...item, decisionContext: value }))} /></Field><Field label="Risk measures and endpoints"><TextArea rows={4} value={draft.supportedRiskMetrics} onChange={(value) => setDraft((item) => ({ ...item, supportedRiskMetrics: value }))} /></Field></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Reference plant and site" className="sinlineeditor__title" /><div className="flfieldgrid"><Field label="Plant name"><TextInput value={draft.plantName} onChange={(value) => setDraft((item) => ({ ...item, plantName: value }))} /></Field><Field label="Site"><TextInput value={draft.siteName} onChange={(value) => setDraft((item) => ({ ...item, siteName: value }))} /></Field><Field label="Vendor or designer"><TextInput value={draft.vendor} onChange={(value) => setDraft((item) => ({ ...item, vendor: value }))} /></Field><Field label="Reactor type"><TextInput value={draft.reactorType} onChange={(value) => setDraft((item) => ({ ...item, reactorType: value }))} /></Field><Field label="Thermal power"><TextInput value={draft.thermalPower} onChange={(value) => setDraft((item) => ({ ...item, thermalPower: value }))} /></Field><Field label="Modules or units"><NumberInput value={draft.numberOfModules} onChange={(value) => setDraft((item) => ({ ...item, numberOfModules: value }))} /></Field></div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Analysis boundary" className="sinlineeditor__title" /><Field label="PRA scope"><TextArea rows={5} value={draft.praScope} onChange={(value) => setDraft((item) => ({ ...item, praScope: value }))} /></Field></div></fieldset>
  </Drawer>;
}

const INTERFACE_FIELDS = ["code", "name", "description", "basis", "owner", "status", "evidenceRefs", "relatedRefs", "assumptionRefs", "technicalElementCode", "technicalElementName", "direction", "role", "producer", "consumer", "payloadType", "columns", "transferItems", "producerRefs", "consumerRefs", "consistencyChecks", "consistent", "openItems"];

interface InterfaceEditorSelection { interfaceIndex: number; transferIndex: number }

function TechnicalInterfaceEditor({ selection, onClose }: { selection: InterfaceEditorSelection; onClose: () => void }): JSX.Element {
  const { mef, mutate } = useInternalFirePraWorkbook();
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
      const next = structuredClone(current);
      const targetInterface = next.integration.interfaces[selection.interfaceIndex];
      const targetTransfer = targetInterface?.transferItems[selection.transferIndex];
      if (targetInterface === undefined || targetTransfer === undefined) return current;
      targetInterface.direction = direction;
      targetInterface.role = role.trim();
      targetInterface.producer = direction === "INPUT" ? targetInterface.technicalElementCode : "F";
      targetInterface.consumer = direction === "INPUT" ? "F" : targetInterface.technicalElementCode;
      Object.assign(targetTransfer, { name: name.trim(), recordRef: recordRef.trim(), sourceModelRef: sourceModelRef.trim(), destinationRefs: technicalList(destinationRefs), evidenceRefs: technicalList(evidenceRefs), status, values });
      targetInterface.producerRefs = targetInterface.transferItems.map((item) => item.recordRef);
      targetInterface.consumerRefs = Array.from(new Set(targetInterface.transferItems.flatMap((item) => item.destinationRefs)));
      return synchronizeInternalFirePraDerivedRegisters(next);
    });
    onClose();
  }
  return <Drawer title="Technical-element transfer record" onClose={onClose} footer={<><button type="button" className="flbtn" onClick={onClose}>Cancel</button><span className="fldrawer__footer-spacer" /><button type="button" className="flbtn flbtn--primary" onClick={save}>Save changes</button></>}>
    <div className="sinlineeditor__body">
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Technical-element handoff" className="sinlineeditor__title" /><div className="sinlineeditor__grid">
        <Field label="Technical element"><TextInput value={`${sourceInterface.technicalElementCode} · ${sourceInterface.technicalElementName}`} disabled onChange={() => undefined} /></Field>
        <Field label="Direction"><SelectInput value={direction} options={[{ value: "INPUT", label: "Input to Internal Fire PRA" }, { value: "OUTPUT", label: "Output from Internal Fire PRA" }]} onChange={(value) => setDirection(value as typeof direction)} /></Field>
        <Field label="Interface role" wide><TextArea rows={3} value={role} onChange={setRole} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred record" className="sinlineeditor__title" /><div className="sinlineeditor__grid">
        <Field label="Record name" wide><TextInput value={name} onChange={setName} /></Field>
        <Field label="Record reference"><TextInput value={recordRef} onChange={setRecordRef} /></Field>
        <Field label="Transfer status"><SelectInput value={status} options={["CONTROLLED", "WORKING", "OPEN"].map((value) => ({ value, label: titleCase(value) }))} onChange={(value) => setStatus(value as typeof status)} /></Field>
        <Field label="Source model or revision" wide><TextInput value={sourceModelRef} onChange={setSourceModelRef} /></Field>
        <Field label="Destination records" wide><TextArea rows={4} value={destinationRefs} onChange={setDestinationRefs} /></Field>
        <Field label="Evidence references" wide><TextArea rows={3} value={evidenceRefs} onChange={setEvidenceRefs} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred values" className="sinlineeditor__title" /><div className="sinlineeditor__grid">{sourceInterface.columns.map((column, index) => <Field key={column} label={column} wide><TextArea rows={2} value={values[index] ?? ""} onChange={(value) => setValues((current) => sourceInterface.columns.map((_, candidate) => candidate === index ? value : current[candidate] ?? ""))} /></Field>)}</div></div>
    </div>
  </Drawer>;
}

function InternalFireInterfacesSection({ onEdit }: { onEdit: (interfaceIndex: number, transferIndex: number) => void }): JSX.Element {
  const { mef } = useInternalFirePraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const selectedInterface = selected === null ? undefined : mef.integration.interfaces[selected];
  return <div className="poscard">
    <div className="poscard__head"><div className="ssection__heading"><h3 className="poscard__title">Interfaces</h3></div></div>
    <div className="poshandoff__grid">{mef.integration.interfaces.map((item, index) => <button key={item.uuid} type="button" className={`poshandoff__tile${selected === index ? " poshandoff__tile--active" : ""}`} onClick={() => setSelected(selected === index ? null : index)}>
      <span className="poshandoff__tile-code">{item.direction === "INPUT" ? `${item.technicalElementCode} → F` : `F → ${item.technicalElementCode}`}</span><span className="poshandoff__tile-name">{item.technicalElementName}</span><span className="poshandoff__tile-role">{item.direction === "INPUT" ? "Receives" : "Provides"} · {item.role}</span>
    </button>)}</div>
    {selectedInterface !== undefined && <div className="sinterface__details"><div className="sinterface__flow-title">{selectedInterface.direction === "INPUT" ? `Internal Fire PRA receives ${selectedInterface.role.toLowerCase()} from ${selectedInterface.technicalElementName}` : `${selectedInterface.technicalElementName} receives ${selectedInterface.role.toLowerCase()} from Internal Fire PRA`}</div><div className="sinterface__table-wrap"><table className="postable postable--mid flinterface-table"><thead><tr><th>Transferred record</th>{selectedInterface.columns.map((column) => <th key={column}>{column}</th>)}<th>Status</th><th /></tr></thead><tbody>{selectedInterface.transferItems.length === 0 ? <tr><td colSpan={selectedInterface.columns.length + 3}>No controlled transfer records are available.</td></tr> : selectedInterface.transferItems.map((transfer, transferIndex) => <tr key={transfer.uuid}><td className="stable__key"><strong>{transfer.name}</strong><small className="flcellnote">{transfer.recordRef} · {transfer.sourceModelRef}</small></td>{selectedInterface.columns.map((column, columnIndex) => <td key={`${transfer.uuid}-${column}`}>{transfer.values[columnIndex] ?? "—"}</td>)}<td><span className={`fltag ${transfer.status === "CONTROLLED" ? "fltag--good" : "fltag--warn"}`}>{transfer.status}</span></td><td><button type="button" className="fltable__edit" aria-label={`Edit ${transfer.name}`} onClick={() => onEdit(selected ?? 0, transferIndex)}><POSIcon.Pencil /></button></td></tr>)}</tbody></table></div></div>}
  </div>;
}

function BaselineInterfaces({ editor }: { editor: ReturnType<typeof useEditor> }): JSX.Element {
  const { mef, editable } = useInternalFirePraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const current = selected === null ? undefined : mef.integration.interfaces[selected];
  return <Section title="Technical-element interfaces" actions={editable ? <AddButton label="Add interface" onClick={() => editor.setTarget(collectionTarget(["integration", "interfaces"], "technical-element interface", undefined, INTERFACE_FIELDS))} /> : undefined}>
    <div className="poshandoff__grid">{mef.integration.interfaces.map((item, index) => <button key={item.uuid} type="button" className={`poshandoff__tile${selected === index ? " poshandoff__tile--active" : ""}`} onClick={() => setSelected(selected === index ? null : index)}><span className="poshandoff__tile-code">{item.direction === "INPUT" ? `${item.technicalElementCode} → F` : `F → ${item.technicalElementCode}`}</span><span className="poshandoff__tile-name">{item.technicalElementName}</span><span className="poshandoff__tile-role">{item.direction === "INPUT" ? "Receives" : "Provides"} · {item.role}</span></button>)}</div>
    {current !== undefined && <div className="sinterface__details"><div className="sinterface__flow-title">{current.producer} → {current.role} → {current.consumer}</div><div className="sinterface__table-wrap"><table className="postable postable--mid flinterface-table"><thead><tr><th>Transferred record</th>{current.columns.map((column) => <th key={column}>{column}</th>)}<th>Status</th></tr></thead><tbody>{current.transferItems.length === 0 ? <tr><td colSpan={current.columns.length + 2}>No controlled transfer records are available.</td></tr> : current.transferItems.map((transfer) => <tr key={transfer.uuid}><td className="stable__key"><strong>{transfer.name}</strong><small className="flcellnote">{transfer.recordRef} · {transfer.sourceModelRef}</small></td>{current.columns.map((column, columnIndex) => <td key={`${transfer.uuid}-${column}`}>{transfer.values[columnIndex] ?? "—"}</td>)}<td><span className={`fltag ${transfer.status === "CONTROLLED" ? "fltag--good" : "fltag--warn"}`}>{transfer.status}</span></td></tr>)}</tbody></table></div>{editable && <EditButton label="Edit selected interface" onClick={() => editor.setTarget(collectionTarget(["integration", "interfaces"], "technical-element interface", selected ?? 0, INTERFACE_FIELDS))} />}</div>}
  </Section>;
}

function AnalysisBasis(): JSX.Element {
  const { mef, editable } = useInternalFirePraWorkbook();
  const editor = useEditor();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [interfaceEditor, setInterfaceEditor] = useState<InterfaceEditorSelection | null>(null);
  const application = mef.applications[0];
  const identity = mef.metadata.plantIdentity;
  const baseline = mef.baselinePra;
  const plantAndSite = [identity?.name ?? mef.name, identity?.siteName].filter(Boolean).join(" · ");
  return <div className="flstep"><Section title="PRA analysis and scope" actions={editable ? <EditButton label="Edit PRA analysis and scope" onClick={() => setScopeOpen(true)} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Intended application" value={application?.name ?? ""} /><AnalysisRow label="Purpose" value={application?.purpose ?? ""} /><AnalysisRow label="Decision supported" value={application?.decisionContext ?? ""} /><AnalysisRow label="Reference plant and site" value={plantAndSite} /><AnalysisRow label="PRA scope" value={mef.praScope} /><AnalysisRow label="Plant stage" value={titleCase(mef.plantStage)} /><AnalysisRow label="At-power operating states" value={baseline?.plantOperatingStateRefs.join(" · ") ?? ""} emptyValue="Not available from the baseline PRA" /><AnalysisRow label="Radioactive-material sources" value={baseline?.radioactiveMaterialSourceRefs.join(" · ") ?? ""} emptyValue="Not available from the baseline PRA" /><AnalysisRow label="Risk measures and endpoints" value={application?.supportedRiskMetrics.join(" · ") ?? ""} /></div></Section>
    <Section title="Common fire-analysis inputs"><div className="smotionbasis"><div className="smotionbasis__heading"><div className="smotionbasis__heading-title"><h3 className="smotionbasis__title">Physical analysis units</h3></div>{editable && <AddButton label="Add PAU" onClick={() => editor.setTarget(collectionTarget(["plantBoundaryAndPartitioning", "physicalAnalysisUnits"], "physical analysis unit"))} />}</div><RecordTable records={mef.plantBoundaryAndPartitioning.physicalAnalysisUnits as unknown as SemanticRecord[]} section={{ title: "Physical analysis units", path: [], singular: "PAU", empty: "No PAUs defined", columns: [{ label: "Building", key: "building" }, { label: "Rooms", key: "rooms" }, { label: "Elevation", key: "elevation" }] }} onEdit={(index) => editor.setTarget(collectionTarget(["plantBoundaryAndPartitioning", "physicalAnalysisUnits"], "physical analysis unit", index))} /><div className="smotionbasis__heading"><div className="smotionbasis__heading-title"><h3 className="smotionbasis__title">Ignition-source basis</h3></div>{editable && <AddButton label="Add ignition source" onClick={() => editor.setTarget(collectionTarget(["scenarioSelectionAndAnalysis", "ignitionSources"], "ignition source"))} />}</div><RecordTable records={mef.scenarioSelectionAndAnalysis.ignitionSources as unknown as SemanticRecord[]} section={{ title: "Ignition sources", path: [], singular: "ignition source", empty: "No ignition sources defined", columns: [{ label: "PAU", key: "physicalAnalysisUnitRef" }, { label: "Source type", key: "sourceType" }, { label: "Fuel", key: "fuelDescription" }] }} onEdit={(index) => editor.setTarget(collectionTarget(["scenarioSelectionAndAnalysis", "ignitionSources"], "ignition source", index))} /></div></Section>
    <InternalFireInterfacesSection onEdit={(interfaceIndex, transferIndex) => setInterfaceEditor({ interfaceIndex, transferIndex })} />{scopeOpen && <AnalysisScopeEditor onClose={() => setScopeOpen(false)} />}{interfaceEditor !== null && <TechnicalInterfaceEditor key={`${String(interfaceEditor.interfaceIndex)}-${String(interfaceEditor.transferIndex)}`} selection={interfaceEditor} onClose={() => setInterfaceEditor(null)} />}<Editor target={editor.target} onClose={() => editor.setTarget(null)} /></div>;
}

function BaselineAndInterfaces(): JSX.Element {
  const { mef, editable } = useInternalFirePraWorkbook();
  const editor = useEditor();
  const baseline = mef.baselinePra;
  return <div className="flstep"><Section title="Frozen baseline PRA" actions={editable ? <EditButton label="Edit baseline" onClick={() => editor.setTarget({ title: "Baseline PRA", focus: ["baselinePra"], inlinePrimitiveArrays: true })} /> : undefined}>{baseline === undefined ? <div className="flempty"><strong>No baseline PRA defined</strong><p>Add the source model before technical development.</p></div> : <div className="sanalysisbasis"><AnalysisRow label="Model" value={`${baseline.modelName} · ${baseline.modelReference}`} /><AnalysisRow label="Revision and freeze date" value={`${baseline.revision} · ${baseline.freezeDate}`} /><AnalysisRow label="Freeze status" value={titleCase(baseline.freezeStatus)} /><AnalysisRow label="At-power operating states" value={baseline.plantOperatingStateRefs.join(" · ")} /><AnalysisRow label="Reactor units" value={baseline.reactorUnitRefs.join(" · ")} /><AnalysisRow label="Model boundary" value={baseline.modelBoundary} /></div>}</Section>
    {baseline !== undefined && <RecordSectionView config={{ title: "Technical-area treatments", path: ["baselinePra", "recordTreatments"], singular: "baseline treatment", empty: "No baseline treatments", columns: [{ label: "Technical area", key: "technicalArea" }, { label: "Treatment", key: "treatment" }, { label: "Internal Fire change", key: "internalFireChange" }] }} editor={editor} />}<BaselineInterfaces editor={editor} /><RecordSectionView config={{ title: "Cross-model consistency checks", path: ["integration", "consistencyChecks"], singular: "consistency check", empty: "No consistency checks", columns: [{ label: "Check", key: "checkType" }, { label: "Subelements", key: "subelements" }, { label: "Result", key: "result" }] }} editor={editor} /><Editor target={editor.target} onClose={() => editor.setTarget(null)} /></div>;
}

const STEP_SECTIONS: Record<string, RecordSection[]> = {
  "evidence-base": [
    { title: "Controlled evidence register", path: ["evidenceRegister"], singular: "evidence record", empty: "No controlled evidence", columns: [{ label: "Type", key: "evidenceType" }, { label: "Source / revision", key: "sourceReference" }, { label: "Applies to", key: "applicableSubelements" }, { label: "Controlled", key: "controlled" }] },
    { title: "Plant investigations", path: ["plantBoundaryAndPartitioning", "investigations"], singular: "plant investigation", empty: "No plant investigations", columns: [{ label: "Type", key: "investigationType" }, { label: "Date", key: "performedDate" }, { label: "Locations", key: "locations" }, { label: "Confirmed records", key: "confirmedRecordRefs" }] },
    { title: "Scenario investigations", path: ["scenarioSelectionAndAnalysis", "investigations"], singular: "scenario investigation", empty: "No scenario investigations", columns: [{ label: "Type", key: "investigationType" }, { label: "Scope", key: "scope" }, { label: "Observations", key: "observations" }] },
  ],
  "plant-partitioning": [
    { title: "Physical analysis units", path: ["plantBoundaryAndPartitioning", "physicalAnalysisUnits"], singular: "physical analysis unit", empty: "No PAUs", columns: [{ label: "Building / compartment", key: "fireCompartment" }, { label: "Rooms", key: "rooms" }, { label: "Elevation", key: "elevation" }, { label: "Volume (m³)", key: "volumeCubicMetres" }] },
    { title: "Partitioning elements", path: ["plantBoundaryAndPartitioning", "partitioningElements"], singular: "partitioning element", empty: "No partitioning elements", columns: [{ label: "Type", key: "elementType" }, { label: "From PAU", key: "fromPauRef" }, { label: "To PAU", key: "toPauRef" }, { label: "Rating (min)", key: "fireResistanceRatingMinutes" }, { label: "Credited", key: "credited" }] },
    { title: "Partition reconciliation", path: ["plantBoundaryAndPartitioning", "coverageChecks"], singular: "partition reconciliation", empty: "No reconciliation checks", columns: [{ label: "Complete", key: "complete" }, { label: "Nonoverlapping", key: "nonOverlapping" }, { label: "Unassigned", key: "unassignedLocations" }, { label: "Method", key: "reconciliationMethod" }] },
  ],
  "equipment-selection": [
    { title: "Initiating-event selection", path: ["equipmentSelection", "initiatingEventSelections"], singular: "initiating-event selection", empty: "No initiating-event selections", columns: [{ label: "Initiating event", key: "initiatingEventRef" }, { label: "Selection", key: "selectionType" }, { label: "Fire-causing equipment", key: "fireCausingEquipmentRefs" }, { label: "Disposition", key: "disposition" }] },
    { title: "Selected equipment", path: ["equipmentSelection", "equipmentSelections"], singular: "equipment selection", empty: "No equipment selections", columns: [{ label: "Equipment", key: "equipmentRef" }, { label: "System", key: "systemRef" }, { label: "Selection basis", key: "selectionBasis" }, { label: "Failure modes", key: "fireFailureModes" }] },
    { title: "Selected instrumentation", path: ["equipmentSelection", "instrumentationSelections"], singular: "instrumentation selection", empty: "No instrumentation selections", columns: [{ label: "Instrument", key: "instrumentRef" }, { label: "Parameter", key: "monitoredParameter" }, { label: "Failure modes", key: "credibleFailureModes" }, { label: "Disposition", key: "disposition" }] },
  ],
  "cable-selection": [
    { title: "Raceway register", path: ["cableSelectionAndLocation", "raceways"], singular: "raceway", empty: "No raceways", columns: [{ label: "Raceway ID", key: "racewayId" }, { label: "Type", key: "racewayType" }, { label: "PAU", key: "physicalAnalysisUnitRef" }, { label: "Route", key: "routeDescription" }] },
    { title: "Selected cables and routes", path: ["cableSelectionAndLocation", "cables"], singular: "cable", empty: "No selected cables", columns: [{ label: "Cable ID", key: "cableId" }, { label: "Equipment", key: "equipmentRef" }, { label: "Type", key: "cableType" }, { label: "PAUs", key: "physicalAnalysisUnitRefs" }, { label: "Routing", key: "routingStatus" }] },
    { title: "Assumed cable routing", path: ["cableSelectionAndLocation", "assumedRouting"], singular: "assumed route", empty: "No assumed routes", columns: [{ label: "Cables", key: "cableRefs" }, { label: "Assumed PAUs", key: "assumedPauRefs" }, { label: "Conservatism", key: "conservatism" }, { label: "Closure action", key: "closureAction" }] },
    { title: "Overcurrent protection", path: ["cableSelectionAndLocation", "overcurrentProtectionAssessments"], singular: "overcurrent assessment", empty: "No overcurrent assessments", columns: [{ label: "Distribution bus", key: "distributionBusRef" }, { label: "Protective devices", key: "protectiveDeviceRefs" }, { label: "Coordination adequate", key: "coordinationAdequate" }, { label: "Model treatment", key: "modelTreatment" }] },
  ],
  "qualitative-screening": [
    { title: "Approved screening criteria", path: ["qualitativeScreening", "screeningCriteria"], singular: "screening criterion", empty: "No screening criteria", columns: [{ label: "Criterion", key: "name" }, { label: "Definition", key: "description" }, { label: "Basis", key: "basis" }] },
    { title: "PAU screening dispositions", path: ["qualitativeScreening", "screeningDecisions"], singular: "screening decision", empty: "No screening decisions", columns: [{ label: "Objects", key: "screenedObjectRefs" }, { label: "Criterion", key: "criterion" }, { label: "Disposition", key: "disposition" }, { label: "Conservatisms", key: "conservativeAssumptions" }] },
  ],
  "plant-response": [
    { title: "Baseline peer-review dispositions", path: ["plantResponseModel", "peerReviewDispositions"], singular: "peer-review disposition", empty: "No peer-review dispositions", columns: [{ label: "Finding", key: "findingRef" }, { label: "Applicability", key: "applicability" }, { label: "Disposition", key: "disposition" }, { label: "Incorporated", key: "incorporated" }] },
    { title: "Initiating-event and event-sequence models", path: ["plantResponseModel", "eventSequenceModels"], singular: "event-sequence model", empty: "No event-sequence models", columns: [{ label: "Initiating event", key: "initiatingEventRef" }, { label: "Scenarios", key: "fireScenarioRefs" }, { label: "Top events", key: "topEvents" }, { label: "End states", key: "endStates" }] },
    { title: "Fire-specific success criteria", path: ["plantResponseModel", "successCriteria"], singular: "success criterion", empty: "No success criteria", columns: [{ label: "Function", key: "function" }, { label: "Success definition", key: "successDefinition" }, { label: "Mission time (h)", key: "missionTimeHours" }, { label: "Treatment", key: "modelTreatment" }] },
    { title: "System-model modifications", path: ["plantResponseModel", "systemModelModifications"], singular: "system-model modification", empty: "No system-model modifications", columns: [{ label: "System", key: "systemRef" }, { label: "Fire equipment", key: "fireEquipmentRefs" }, { label: "Cables", key: "cableRefs" }, { label: "Model change", key: "modelChange" }] },
    { title: "Probability and data parameters", path: ["plantResponseModel", "probabilityDataParameters"], singular: "probability parameter", empty: "No probability parameters", columns: [{ label: "Parameter", key: "parameterRef" }, { label: "Type", key: "parameterType" }, { label: "Fire value", key: "fireContextValue" }, { label: "Reanalysis", key: "reanalysisRequired" }] },
  ],
  "fire-scenarios": [
    { title: "Ignition sources", path: ["scenarioSelectionAndAnalysis", "ignitionSources"], singular: "ignition source", empty: "No ignition sources", columns: [{ label: "PAU", key: "physicalAnalysisUnitRef" }, { label: "Type", key: "sourceType" }, { label: "Mobility", key: "mobility" }, { label: "Frequency group", key: "ignitionFrequencyGroupRef" }] },
    { title: "Damage target sets", path: ["scenarioSelectionAndAnalysis", "damageTargetSets"], singular: "damage target set", empty: "No damage target sets", columns: [{ label: "PAUs", key: "physicalAnalysisUnitRefs" }, { label: "Equipment", key: "equipmentRefs" }, { label: "Cables", key: "cableRefs" }, { label: "Mechanisms", key: "damageMechanisms" }] },
    { title: "Fire scenarios", path: ["scenarioSelectionAndAnalysis", "fireScenarios"], singular: "fire scenario", empty: "No fire scenarios", columns: [{ label: "PAUs", key: "physicalAnalysisUnitRefs" }, { label: "Ignition sources", key: "ignitionSourceRefs" }, { label: "Scenario type", key: "scenarioType" }, { label: "Disposition", key: "disposition" }] },
    { title: "Fire-model analyses", path: ["scenarioSelectionAndAnalysis", "fireModelAnalyses"], singular: "fire-model analysis", empty: "No fire-model analyses", columns: [{ label: "Scenario", key: "fireScenarioRef" }, { label: "Tool", key: "toolName" }, { label: "Peak HRR (kW)", key: "peakHeatReleaseRateKw" }, { label: "Damage probability", key: "conditionalTargetDamageProbability" }] },
    { title: "Detection and suppression", path: ["scenarioSelectionAndAnalysis", "detectionSuppressionAssessments"], singular: "detection and suppression assessment", empty: "No detection or suppression assessments", columns: [{ label: "Scenario", key: "fireScenarioRef" }, { label: "Detection (min)", key: "timeToDetectionMinutes" }, { label: "Time before damage", key: "timeAvailableBeforeDamageMinutes" }, { label: "Nonsuppression probability", key: "nonsuppressionProbability" }] },
    { title: "Fire barriers", path: ["scenarioSelectionAndAnalysis", "barrierAssessments"], singular: "barrier assessment", empty: "No barrier assessments", columns: [{ label: "Barrier", key: "barrierRef" }, { label: "PAUs", key: "affectedPauRefs" }, { label: "Reliability", key: "reliability" }, { label: "Availability", key: "availability" }] },
  ],
  "ignition-frequency": [
    { title: "Fire-event data sources", path: ["ignitionFrequency", "eventDataSources"], singular: "event-data source", empty: "No event-data sources", columns: [{ label: "Source type", key: "sourceType" }, { label: "Reference", key: "reference" }, { label: "Events", key: "eventCount" }, { label: "Plant-years", key: "exposurePlantYears" }] },
    { title: "Ignition-frequency groups", path: ["ignitionFrequency", "frequencyGroups"], singular: "frequency group", empty: "No frequency groups", columns: [{ label: "Source category", key: "sourceCategory" }, { label: "Generic /yr", key: "genericFrequencyPerPlantYear" }, { label: "Updated /yr", key: "updatedFrequencyPerPlantYear" }, { label: "Method", key: "updateMethod" }] },
    { title: "Plant fire experience", path: ["ignitionFrequency", "plantExperienceReviews"], singular: "plant-experience review", empty: "No experience reviews", columns: [{ label: "Period", key: "reviewPeriod" }, { label: "Plant-years", key: "plantYears" }, { label: "Events", key: "fireEventRefs" }, { label: "Update required", key: "frequencyUpdateRequired" }] },
    { title: "Source-level frequency estimates", path: ["ignitionFrequency", "frequencyEstimates"], singular: "frequency estimate", empty: "No frequency estimates", columns: [{ label: "Ignition source", key: "ignitionSourceRef" }, { label: "PAU", key: "physicalAnalysisUnitRef" }, { label: "Mean /yr", key: "meanFrequencyPerPlantYear" }, { label: "Preserves total", key: "preservesPlantWideFrequency" }] },
    { title: "Frequency reconciliation", path: ["ignitionFrequency", "reconciliationChecks"], singular: "reconciliation check", empty: "No reconciliation checks", columns: [{ label: "Check", key: "name" }, { label: "Result", key: "description" }, { label: "Basis", key: "basis" }] },
  ],
  "circuit-failure": [
    { title: "Fire-exposed circuits", path: ["circuitFailureAnalysis", "circuits"], singular: "circuit", empty: "No circuits", columns: [{ label: "Circuit ID", key: "circuitId" }, { label: "Equipment", key: "equipmentRef" }, { label: "Function", key: "circuitFunction" }, { label: "PAUs", key: "physicalAnalysisUnitRefs" }] },
    { title: "Circuit failure-mode evaluations", path: ["circuitFailureAnalysis", "failureModeEvaluations"], singular: "failure-mode evaluation", empty: "No failure-mode evaluations", columns: [{ label: "Circuit", key: "circuitRef" }, { label: "Equipment effect", key: "equipmentFailureMode" }, { label: "Circuit failure", key: "circuitFailureMode" }, { label: "Hot-short duration credited", key: "hotShortDurationCredited" }] },
    { title: "Circuit failure probabilities", path: ["circuitFailureAnalysis", "failureProbabilities"], singular: "failure probability", empty: "No failure probabilities", columns: [{ label: "Failure-mode evaluation", key: "failureModeEvaluationRef" }, { label: "Mean probability", key: "meanProbability" }, { label: "Duration probability", key: "durationProbability" }, { label: "Bounding", key: "bounding" }] },
  ],
  "human-reliability": [
    { title: "Fire-specific human actions", path: ["humanReliabilityAnalysis", "humanActions"], singular: "human action", empty: "No human actions", columns: [{ label: "Action type", key: "actionType" }, { label: "Scenarios", key: "fireScenarioRefs" }, { label: "Available / execution (min)", key: "availableTimeMinutes" }, { label: "Required location", key: "requiredLocation" }] },
    { title: "Human failure events", path: ["humanReliabilityAnalysis", "humanFailureEvents"], singular: "human failure event", empty: "No human failure events", columns: [{ label: "Human action", key: "humanActionRef" }, { label: "Basic event", key: "basicEventRef" }, { label: "Failure definition", key: "failureDefinition" }, { label: "Scenarios", key: "fireScenarioRefs" }] },
    { title: "Fire performance contexts", path: ["humanReliabilityAnalysis", "performanceContexts"], singular: "performance context", empty: "No performance contexts", columns: [{ label: "HFE", key: "humanFailureEventRef" }, { label: "Scenario", key: "fireScenarioRef" }, { label: "Smoke and heat", key: "smokeAndHeatConditions" }, { label: "Access / habitability", key: "accessAndHabitability" }] },
    { title: "HEP estimates", path: ["humanReliabilityAnalysis", "hepEstimates"], singular: "HEP estimate", empty: "No HEP estimates", columns: [{ label: "HFE", key: "humanFailureEventRef" }, { label: "Method", key: "method" }, { label: "Mean HEP", key: "meanHep" }, { label: "Feasible", key: "feasibilityDemonstrated" }] },
    { title: "Human dependencies", path: ["humanReliabilityAnalysis", "dependencyAssessments"], singular: "dependency assessment", empty: "No dependency assessments", columns: [{ label: "HFEs", key: "humanFailureEventRefs" }, { label: "Dependency", key: "dependencyLevel" }, { label: "Temporal relationship", key: "temporalRelationship" }, { label: "Joint HEP", key: "jointHep" }] },
    { title: "Action confirmations", path: ["humanReliabilityAnalysis", "confirmations"], singular: "action confirmation", empty: "No action confirmations", columns: [{ label: "Actions", key: "humanActionRefs" }, { label: "Confirmation", key: "confirmationType" }, { label: "Date", key: "performedDate" }, { label: "Feasible", key: "feasible" }] },
  ],
  quantification: [
    { title: "Quantification runs", path: ["eventSequenceQuantification", "quantificationRuns"], singular: "quantification run", empty: "No quantification runs", columns: [{ label: "Model", key: "modelVersion" }, { label: "Software", key: "software" }, { label: "Truncation", key: "truncationLevel" }, { label: "Converged", key: "converged" }] },
    { title: "Scenario results", path: ["eventSequenceQuantification", "scenarioResults"], singular: "scenario result", empty: "No scenario results", columns: [{ label: "Scenario", key: "fireScenarioRef" }, { label: "Initiating event", key: "initiatingEventRef" }, { label: "Mean /yr", key: "meanFrequencyPerPlantYear" }, { label: "Screened", key: "screened" }] },
    { title: "Event-sequence family results", path: ["eventSequenceQuantification", "eventSequenceFamilyResults"], singular: "sequence-family result", empty: "No sequence-family results", columns: [{ label: "Family", key: "eventSequenceFamilyRef" }, { label: "Release category", key: "releaseCategoryRef" }, { label: "Mean /yr", key: "meanFrequencyPerPlantYear" }, { label: "95th /yr", key: "ninetyFifthPercentileFrequencyPerPlantYear" }] },
    { title: "Risk contributors", path: ["eventSequenceQuantification", "riskContributors"], singular: "risk contributor", empty: "No risk contributors", columns: [{ label: "Type", key: "contributorType" }, { label: "Contributor", key: "contributorRef" }, { label: "Frequency /yr", key: "meanFrequencyContributionPerPlantYear" }, { label: "Fraction", key: "fractionalContribution" }, { label: "Rank", key: "rank" }] },
    { title: "Uncertainty results", path: ["eventSequenceQuantification", "uncertaintyResults"], singular: "uncertainty result", empty: "No uncertainty results", columns: [{ label: "Result", key: "resultRef" }, { label: "Method", key: "propagationMethod" }, { label: "Samples", key: "sampleCount" }, { label: "5th / 95th", key: "fifthPercentile" }] },
    { title: "Quantification reviews", path: ["eventSequenceQuantification", "reviews"], singular: "quantification review", empty: "No quantification reviews", columns: [{ label: "Run", key: "quantificationRunRef" }, { label: "Review type", key: "reviewType" }, { label: "Result", key: "result" }, { label: "Open items", key: "openItems" }] },
  ],
  "risk-interpretation": [
    { title: "Fire risk insights", path: ["riskInterpretation", "riskInsights"], singular: "risk insight", empty: "No risk insights", columns: [{ label: "Type", key: "insightType" }, { label: "Contributors", key: "contributorRefs" }, { label: "Risk metric", key: "affectedRiskMetric" }, { label: "Decision implication", key: "decisionImplication" }] },
    { title: "Model refinements", path: ["riskInterpretation", "refinementActions"], singular: "model refinement", empty: "No refinement actions", columns: [{ label: "Technical area", key: "technicalArea" }, { label: "Priority", key: "priority" }, { label: "Refinement", key: "refinement" }, { label: "Status", key: "refinementStatus" }] },
    { title: "Quantification stability", path: ["riskInterpretation", "quantificationIterations"], singular: "quantification iteration", empty: "No stability iterations", columns: [{ label: "Model", key: "modelVersion" }, { label: "Aggregate mean /yr", key: "aggregateMeanFrequencyPerPlantYear" }, { label: "Relative change", key: "relativeChange" }, { label: "Ranking stable", key: "contributorRankingStable" }, { label: "Decision", key: "decision" }] },
  ],
  "risk-integration": [
    { title: "Controlled Internal Fire risk results", path: ["riskIntegrationBaseline", "results"], singular: "risk-integration result", empty: "No integrated risk results", columns: [{ label: "Model", key: "modelVersion" }, { label: "Mean /yr", key: "aggregateMeanFrequencyPerPlantYear" }, { label: "Release categories", key: "releaseCategoryRefs" }, { label: "Integration status", key: "integrationStatus" }] },
    { title: "Risk-informed decisions", path: ["riskIntegrationBaseline", "decisions"], singular: "risk decision", empty: "No risk decisions", columns: [{ label: "Decision type", key: "decisionType" }, { label: "Action", key: "action" }, { label: "Disposition", key: "disposition" }, { label: "Reanalysis", key: "reanalysisRequired" }] },
    { title: "End-to-end traceability", path: ["riskIntegrationBaseline", "traceabilityPaths"], singular: "traceability path", empty: "No traceability paths", columns: [{ label: "PAUs", key: "physicalAnalysisUnitRefs" }, { label: "Scenarios", key: "fireScenarioRefs" }, { label: "Results", key: "resultRefs" }, { label: "Complete", key: "complete" }] },
    { title: "Configuration-controlled baselines", path: ["riskIntegrationBaseline", "controlledBaselines"], singular: "controlled baseline", empty: "No controlled baselines", columns: [{ label: "Model", key: "modelVersion" }, { label: "Quantification run", key: "quantificationRunRef" }, { label: "Control record", key: "configurationControlRecordId" }, { label: "Release status", key: "releaseStatus" }] },
  ],
};

function TechnicalStep({ stepId }: { stepId: string }): JSX.Element {
  const { mef, editable, mutate } = useInternalFirePraWorkbook();
  const editor = useEditor();
  const configs = STEP_SECTIONS[stepId] ?? [];
  const boundary = mef.plantBoundaryAndPartitioning.globalBoundary;
  const updateModels = (hazardConditionedModels: InternalFirePRA["hazardConditionedModels"]): void => mutate((current) => ({ ...current, hazardConditionedModels }));
  return <div className="flstep">
    {stepId === "plant-response" && <>
      <Section title="Fire-conditioned initiating-event fault trees"><HazardFaultTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
      <Section title="Fire-conditioned event trees"><HazardEventTreeEditor models={mef.hazardConditionedModels} editable={editable} onChange={updateModels} /></Section>
    </>}
    {stepId === "plant-partitioning" && <Section title="Global fire analysis boundary" actions={editable ? <EditButton label="Edit global boundary" onClick={() => editor.setTarget({ title: "Global fire analysis boundary", focus: ["plantBoundaryAndPartitioning", "globalBoundary"], inlinePrimitiveArrays: true })} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Licensee-controlled area" value={boundary.licenseeControlledAreaDescription} /><AnalysisRow label="Included locations" value={boundary.includedLocationRefs.join(" · ")} /><AnalysisRow label="Reactor units" value={boundary.reactorUnitRefs.join(" · ")} /><AnalysisRow label="Radioactive-material sources" value={boundary.radioactiveMaterialSourceRefs.join(" · ")} /><AnalysisRow label="At-power operating states" value={boundary.atPowerOperatingStateRefs.join(" · ")} /><AnalysisRow label="Multi-unit or multi-source locations" value={boundary.multiUnitOrMultiSourceLocations.join(" · ")} /></div></Section>}
    {configs.map((config) => <RecordSectionView key={config.title} config={config} editor={editor} />)}
    {stepId === "risk-integration" && <Section title="Cross-hazard integration method" actions={editable ? <EditButton label="Edit integration method" onClick={() => editor.setTarget({ title: "Cross-hazard integration", focus: ["integration"], visibleRootFields: ["integrationMethod", "unresolvedInterfaces"], inlinePrimitiveArrays: true })} /> : undefined}><div className="sanalysisbasis"><AnalysisRow label="Integration method" value={mef.integration.integrationMethod} /><AnalysisRow label="Unresolved interfaces" value={mef.integration.unresolvedInterfaces.join(" · ")} /></div></Section>}
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

export function InternalFirePraStepScreen({ stepId }: { stepId: string }): JSX.Element {
  if (stepId === "analysis-basis") return <AnalysisBasis />;
  if (stepId === "baseline-pra") return <BaselineAndInterfaces />;
  return <TechnicalStep stepId={stepId} />;
}
