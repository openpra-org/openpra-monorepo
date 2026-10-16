import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
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
import { Drawer, Field, NumberInput, Section, SelectInput, TextArea, TextInput } from "./internalFloodPraFields";
import { useInternalFloodPraWorkbook } from "./internalFloodPraWorkbookContext";
import {
  HazardEventTreeEditor,
  HazardFaultTreeEditor,
} from "../workbooks/hazardConditionedModelEditors";
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

function collectionTarget(path: EditorPath, title: string, index?: number): EditorTarget {
  return index === undefined
    ? { title: `Add ${title}`, focus: [], createAt: path, inlinePrimitiveArrays: true }
    : { title: `Edit ${title}`, focus: [...path, index], removeLabel: `Remove ${title}`, inlinePrimitiveArrays: true };
}

function groupedCollectionTarget(index: number, groups: Array<{ path: EditorPath; length: number; title: string }>): EditorTarget {
  let offset = 0;
  for (const group of groups) {
    if (index < offset + group.length) return collectionTarget(group.path, group.title, index - offset);
    offset += group.length;
  }
  return collectionTarget(groups[0]?.path ?? [], groups[0]?.title ?? "record");
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

  return <Drawer title="PRA scope and application" onClose={onClose} footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>{editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}</>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="PRA application" className="sinlineeditor__title" />
        <Field label="Intended application"><TextInput value={draft.applicationName} onChange={(value) => setDraft((current) => ({ ...current, applicationName: value }))} /></Field>
        <Field label="Purpose"><TextArea rows={3} value={draft.purpose} onChange={(value) => setDraft((current) => ({ ...current, purpose: value }))} /></Field>
        <Field label="Decision supported"><TextArea rows={3} value={draft.decisionContext} onChange={(value) => setDraft((current) => ({ ...current, decisionContext: value }))} /></Field>
        <Field label="Risk measures and endpoints"><TextArea rows={4} value={draft.supportedRiskMetrics} onChange={(value) => setDraft((current) => ({ ...current, supportedRiskMetrics: value }))} /></Field>
      </div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Reference plant and site" className="sinlineeditor__title" /><div className="flfieldgrid">
        <Field label="Plant name"><TextInput value={draft.plantName} onChange={(value) => setDraft((current) => ({ ...current, plantName: value }))} /></Field>
        <Field label="Site"><TextInput value={draft.siteName} onChange={(value) => setDraft((current) => ({ ...current, siteName: value }))} /></Field>
        <Field label="Vendor or designer"><TextInput value={draft.vendor} onChange={(value) => setDraft((current) => ({ ...current, vendor: value }))} /></Field>
        <Field label="Reactor type"><TextInput value={draft.reactorType} onChange={(value) => setDraft((current) => ({ ...current, reactorType: value }))} /></Field>
        <Field label="Thermal power"><TextInput value={draft.thermalPower} onChange={(value) => setDraft((current) => ({ ...current, thermalPower: value }))} /></Field>
        <Field label="Modules or units"><NumberInput value={draft.numberOfModules} onChange={(value) => setDraft((current) => ({ ...current, numberOfModules: value }))} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="PRA boundary" className="sinlineeditor__title" />
        <Field label="Integrated PRA scope"><TextArea rows={4} value={draft.praScope} onChange={(value) => setDraft((current) => ({ ...current, praScope: value }))} /></Field>
        <Field label="Plant stage"><SelectInput value={draft.plantStage} options={[{ value: "PRE_OPERATIONAL", label: "Pre-operational" }, { value: "OPERATIONAL", label: "Operational" }]} onChange={(value) => setDraft((current) => ({ ...current, plantStage: value as InternalFloodPRA["plantStage"] }))} /></Field>
      </div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Imported baseline scope" className="sinlineeditor__title" />
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
  return <Drawer title="Technical-element transfer record" onClose={onClose} footer={<><button type="button" className="flbtn" onClick={onClose}>Cancel</button><span className="fldrawer__footer-spacer" /><button type="button" className="flbtn flbtn--primary" onClick={save}>Save changes</button></>}>
    <div className="sinlineeditor__body">
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Technical-element handoff" className="sinlineeditor__title" /><div className="sinlineeditor__grid">
        <Field label="Technical element"><TextInput value={`${sourceInterface.technicalElementCode} · ${sourceInterface.technicalElementName}`} disabled onChange={() => undefined} /></Field>
        <Field label="Direction"><SelectInput value={direction} options={[{ value: "INPUT", label: "Input to Internal Flood PRA" }, { value: "OUTPUT", label: "Output from Internal Flood PRA" }]} onChange={(value) => setDirection(value as typeof direction)} /></Field>
        <Field label="Interface role" wide><TextArea rows={3} value={role} onChange={setRole} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred record" className="sinlineeditor__title" /><div className="sinlineeditor__grid">
        <Field label="Record name" wide><TextInput value={name} onChange={setName} /></Field>
        <Field label="Record reference"><TextInput value={recordRef} onChange={setRecordRef} /></Field>
        <Field label="Transfer status"><SelectInput value={status} options={["CONTROLLED", "WORKING", "OPEN"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} onChange={(value) => setStatus(value as typeof status)} /></Field>
        <Field label="Source model or revision" wide><TextInput value={sourceModelRef} onChange={setSourceModelRef} /></Field>
        <Field label="Destination records" wide><TextArea rows={4} value={destinationRefs} onChange={setDestinationRefs} /></Field>
        <Field label="Evidence references" wide><TextArea rows={3} value={evidenceRefs} onChange={setEvidenceRefs} /></Field>
      </div></div>
      <div className="sinlineeditor__group"><WorkbookSectionHeading title="Transferred values" className="sinlineeditor__title" /><div className="sinlineeditor__grid">{sourceInterface.columns.map((column, index) => <Field key={column} label={column} wide><TextArea rows={2} value={values[index] ?? ""} onChange={(value) => setValues((current) => sourceInterface.columns.map((_, candidate) => candidate === index ? value : current[candidate] ?? ""))} /></Field>)}</div></div>
    </div>
  </Drawer>;
}

function InternalFloodInterfacesSection({ onEdit }: { onEdit: (interfaceIndex: number, transferIndex: number) => void }): JSX.Element {
  const { mef } = useInternalFloodPraWorkbook();
  const [selected, setSelected] = useState<number | null>(null);
  const selectedInterface = selected === null ? undefined : mef.integration.interfaces[selected];
  return <div className="poscard">
    <div className="poscard__head"><div className="ssection__heading"><h3 className="poscard__title">Interfaces</h3></div></div>
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
    <Section title="PRA scope and application" actions={editable ? <EditButton label="Edit PRA scope and application" onClick={() => setScopeOpen(true)} /> : undefined}>
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
    <Section title="Internal-flood definition">
      <div className="smotionbasis">
        <div className="smotionbasis__heading"><div className="smotionbasis__heading-title"><h3 className="smotionbasis__title">Flood-source parameters</h3></div>{editable && <AddButton label="Add flood source" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source"))} />}</div>
        {sources.length === 0 ? <p className="sanalysisbasis__empty">No flood-source parameters defined.</p> : <div className="stablewrap"><table className="stable postable stable--technical"><thead><tr><th>Source</th><th>Type and fluid</th><th>System</th><th>Operating envelope</th><th>Inventory</th></tr></thead><tbody>{sources.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source", index))}><td className="stable__key"><strong>{item.name}</strong></td><td>{item.sourceType.replace(/_/g, " ")} · {item.fluid.replace(/_/g, " ")}</td><td>{item.systemRef}</td><td>{display(item.operatingPressureKpa, "kPa")} · {display(item.operatingTemperatureCelsius, "°C")}</td><td>{Number.isFinite(item.inventoryCubicMetres) ? display(item.inventoryCubicMetres, "m³") : "Connected source"}</td></tr>)}</tbody></table></div>}
        <div className="smotionbasis__heading"><div className="smotionbasis__heading-title"><h3 className="smotionbasis__title">Flood-area reference locations</h3></div>{editable && <AddButton label="Add flood area" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area"))} />}</div>
        {areas.length === 0 ? <p className="sanalysisbasis__empty">No flood-area reference locations defined.</p> : <div className="stablewrap"><table className="stable postable stable--technical"><thead><tr><th>Flood area</th><th>Building</th><th>Rooms</th><th>Floor elevation</th><th>Free volume</th></tr></thead><tbody>{areas.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area", index))}><td className="stable__key"><strong>{item.areaId} · {item.name}</strong></td><td>{item.building}</td><td>{item.rooms.join(" · ")}</td><td>{display(item.floorElevationMetres, "m")}</td><td>{display(item.netFreeVolumeCubicMetres, "m³")}</td></tr>)}</tbody></table></div>}
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
    <Section title="Controlled evidence register" actions={editable ? <AddButton label="Add evidence" onClick={() => editor.setTarget(collectionTarget(["evidenceRegister"], "evidence record"))} /> : undefined}>
      <TechnicalTable records={mef.evidenceRegister} caption="Controlled evidence" empty="No controlled evidence" onEdit={(index) => editor.setTarget(collectionTarget(["evidenceRegister"], "evidence record", index))} columns={[
        { header: "Type", render: (item) => item.evidenceType.replace(/_/g, " "), width: "120px" },
        { header: "Source / revision", render: (item) => <>{item.sourceReference}<small className="flcellnote">{item.revision ?? "No revision"}</small></> },
        { header: "Applies to", render: (item) => <EmptyOrList values={item.applicableSubelements} /> },
        { header: "Control", render: (item) => <span className={`fltag ${item.controlled ? "fltag--good" : "fltag--warn"}`}>{item.controlled ? "CONTROLLED" : "WORKING"}</span>, width: "100px" },
      ]} />
    </Section>
    <Section title="Plant investigations" actions={editable ? <AddButton label="Add investigation" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "investigations"], "plant investigation"))} /> : undefined}>
      <div className="fltimeline">{investigations.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["plantPartitioning", "investigations"], length: mef.plantPartitioning.investigations.length, title: "partitioning investigation" },
        { path: ["sourcesIdentificationAndCharacterization", "investigations"], length: mef.sourcesIdentificationAndCharacterization.investigations.length, title: "source investigation" },
        { path: ["scenariosDevelopment", "investigations"], length: mef.scenariosDevelopment.investigations.length, title: "scenario investigation" },
        { path: ["humanReliabilityAnalysis", "investigations"], length: mef.humanReliabilityAnalysis.investigations.length, title: "HRA investigation" },
      ]))}><span>{item.performedDate}</span><strong>{item.name}</strong><p>{item.scope}</p><small>{String(item.confirmedRecordRefs.length)} records confirmed · {String(item.observations.length)} observations</small></button>)}</div>
    </Section>
    <Section title="Evidence quality and open limitations" actions={editable ? <EditButton label="Edit limitations" onClick={() => editor.setTarget({ title: "Evidence limitations", focus: ["metadata"], inlinePrimitiveArrays: true })} /> : undefined}>
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
    <Section title="Frozen baseline PRA" actions={editable ? <EditButton label="Edit baseline" onClick={() => editor.setTarget({ title: "Baseline PRA", focus: ["baselinePra"], inlinePrimitiveArrays: true })} /> : undefined}>
      {baseline === undefined ? <div className="flempty"><strong>No baseline PRA defined</strong><p>Add the source model before technical development.</p></div> : <div className="sanalysisbasis"><AnalysisRow label="Model" value={`${baseline.modelName} · ${baseline.modelReference}`} /><AnalysisRow label="Revision and freeze date" value={`${baseline.revision} · ${baseline.freezeDate}`} /><AnalysisRow label="Freeze status" value={baseline.freezeStatus.replace(/_/g, " ")} /><AnalysisRow label="Operating states" value={baseline.plantOperatingStateRefs.join(" · ")} /><AnalysisRow label="Reactor units" value={baseline.reactorUnitRefs.join(" · ")} /><AnalysisRow label="Model boundary" value={baseline.modelBoundary} /></div>}
    </Section>
    {baseline !== undefined && <Section title="Technical-area treatments" actions={editable ? <AddButton label="Add treatment" onClick={() => editor.setTarget(collectionTarget(["baselinePra", "recordTreatments"], "baseline treatment"))} /> : undefined}>
      <TechnicalTable records={baseline.recordTreatments} caption="Baseline treatments" empty="No baseline treatments" onEdit={(index) => editor.setTarget(collectionTarget(["baselinePra", "recordTreatments"], "baseline treatment", index))} columns={[
        { header: "Technical area", render: (item) => item.technicalArea.replace(/_/g, " ") },
        { header: "Treatment", render: (item) => <span className="fltag fltag--neutral">{item.treatment}</span>, width: "105px" },
        { header: "Internal Flood change", render: (item) => item.internalFloodChange },
      ]} />
    </Section>}
    <Section title="Technical-element handoffs" actions={editable ? <AddButton label="Add interface" onClick={() => editor.setTarget(collectionTarget(["integration", "interfaces"], "technical-element interface"))} /> : undefined}>
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
    <Section title="Physical analysis boundary" actions={editable ? <EditButton label="Edit boundary" onClick={() => editor.setTarget({ title: "Physical analysis boundary", focus: ["plantPartitioning", "analysisBoundary"], inlinePrimitiveArrays: true, inlineObjectFields: ["includedElevationRange"] })} /> : undefined}>
      <div className="sanalysisbasis"><AnalysisRow label="Included buildings" value={pp.analysisBoundary.includedBuildings.join(" · ")} /><AnalysisRow label="Elevation range" value={`${display(pp.analysisBoundary.includedElevationRange.lowerMetres)} to ${display(pp.analysisBoundary.includedElevationRange.upperMetres)} m · ${pp.analysisBoundary.includedElevationRange.datum}`} /><AnalysisRow label="Reactor units" value={pp.analysisBoundary.reactorUnitRefs.join(" · ")} /><AnalysisRow label="Radioactive-material sources" value={pp.analysisBoundary.radioactiveMaterialSourceRefs.join(" · ")} /><AnalysisRow label="Multi-unit and shared-source basis" value={pp.analysisBoundary.multiUnitAndSharedSourceBasis} /><AnalysisRow label="Internal / external hazard interface" value={pp.analysisBoundary.internalExternalHazardInterface} /></div>
    </Section>
    <Section title="Flood areas" actions={editable ? <AddButton label="Add flood area" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area"))} /> : undefined}>
      <TechnicalTable records={pp.floodAreas} caption="Flood areas" empty="No flood areas" onEdit={(index) => editor.setTarget(collectionTarget(["plantPartitioning", "floodAreas"], "flood area", index))} columns={[
        { header: "Building / rooms", render: (item) => <>{item.building}<small className="flcellnote">{item.rooms.join(" · ")}</small></> },
        { header: "Floor", render: (item) => display(item.floorElevationMetres, "m"), width: "90px" },
        { header: "Free volume", render: (item) => display(item.netFreeVolumeCubicMetres, "m³"), width: "105px" },
        { header: "Sources / SSCs", render: (item) => `${String(item.floodSourceRefs.length)} / ${String(item.creditedSscRefs.length)}`, width: "90px" },
        { header: "Confirmed", render: (item) => <span className={`fltag ${item.spatialInformationConfirmed ? "fltag--good" : "fltag--warn"}`}>{item.spatialInformationConfirmed ? "YES" : "OPEN"}</span>, width: "90px" },
      ]} />
    </Section>
    <Section title="Partitioning investigations and uncertainty" actions={editable ? <AddButton label="Add uncertainty" onClick={() => editor.setTarget(collectionTarget(["plantPartitioning", "modelUncertainties"], "partitioning uncertainty"))} /> : undefined}>
      <TechnicalTable records={[...pp.investigations, ...pp.modelUncertainties, ...pp.preOperationalAssumptions]} caption="Partitioning assurance records" empty="No assurance records" onEdit={(index) => { const path = index < pp.investigations.length ? ["plantPartitioning", "investigations"] : index < pp.investigations.length + pp.modelUncertainties.length ? ["plantPartitioning", "modelUncertainties"] : ["plantPartitioning", "preOperationalAssumptions"]; const local = index < pp.investigations.length ? index : index < pp.investigations.length + pp.modelUncertainties.length ? index - pp.investigations.length : index - pp.investigations.length - pp.modelUncertainties.length; editor.setTarget(collectionTarget(path, "assurance record", local)); }} columns={[{ header: "Type", render: (item) => "investigationType" in item ? String(item.investigationType).replace(/_/g, " ") : "uncertaintyType" in item ? String(item.uncertaintyType) : "PRE-OP ASSUMPTION" }, { header: "Basis", render: (item) => item.basis }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span>, width: "90px" }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function FloodSources(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const so = mef.sourcesIdentificationAndCharacterization;
  return <div className="flstep">
    <Section title="Flood-source inventory" actions={editable ? <AddButton label="Add source" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source"))} /> : undefined}>
      <TechnicalTable records={so.sources} caption="Flood sources" empty="No flood sources" onEdit={(index) => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sources"], "flood source", index))} columns={[
        { header: "Type / fluid", render: (item) => <>{item.sourceType}<small className="flcellnote">{item.fluid}</small></>, width: "110px" },
        { header: "System", render: (item) => item.systemRef },
        { header: "Pressure", render: (item) => display(item.operatingPressureKpa, "kPa"), width: "100px" },
        { header: "Temperature", render: (item) => display(item.operatingTemperatureCelsius, "°C"), width: "100px" },
        { header: "Isolation", render: (item) => <EmptyOrList values={item.isolationRefs} /> },
      ]} />
    </Section>
    <Section title="Release envelope" actions={editable ? <AddButton label="Add release case" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "releaseCharacterizations"], "release characterization"))} /> : undefined}>
      <BarList tone="so" items={so.releaseCharacterizations.slice(0, 12).map((item) => ({ id: item.uuid, label: item.name, value: item.releaseRateCubicMetresPerMinute, detail: `${display(item.minimumReleaseRateCubicMetresPerMinute)}–${display(item.maximumReleaseRateCubicMetresPerMinute)} m³/min · ${display(item.unisolatedDurationMinutes)} min` }))} formatter={(value) => display(value, "m³/min")} onEdit={(index) => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "releaseCharacterizations"], "release characterization", index))} />
    </Section>
    <Section title="Failure mechanisms" actions={editable ? <AddButton label="Add failure mechanism" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "failureMechanisms"], "failure mechanism"))} /> : undefined}>
      <TechnicalTable records={so.failureMechanisms} caption="Source failure mechanisms" empty="No failure mechanisms" onEdit={(index) => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "failureMechanisms"], "failure mechanism", index))} columns={[{ header: "Mechanism", render: (item) => <span className="fltag fltag--neutral">{item.mechanism}</span> }, { header: "Breach", render: (item) => item.breachType }, { header: "Credible causes", render: (item) => <EmptyOrList values={item.credibleCauses} /> }, { header: "Effects", render: (item) => <EmptyOrList values={item.consequentialEffects} /> }]} />
    </Section>
    <Section title="Source screening, investigations, and uncertainty" actions={editable ? <AddButton label="Add screening decision" onClick={() => editor.setTarget(collectionTarget(["sourcesIdentificationAndCharacterization", "sourceScreeningDecisions"], "source screening decision"))} /> : undefined}>
      <TechnicalTable records={[...so.sourceScreeningDecisions, ...so.investigations, ...so.modelUncertainties, ...so.preOperationalAssumptions]} caption="Source assurance" empty="No source assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["sourcesIdentificationAndCharacterization", "sourceScreeningDecisions"], length: so.sourceScreeningDecisions.length, title: "source screening decision" },
        { path: ["sourcesIdentificationAndCharacterization", "investigations"], length: so.investigations.length, title: "source investigation" },
        { path: ["sourcesIdentificationAndCharacterization", "modelUncertainties"], length: so.modelUncertainties.length, title: "source uncertainty" },
        { path: ["sourcesIdentificationAndCharacterization", "preOperationalAssumptions"], length: so.preOperationalAssumptions.length, title: "source pre-operational assumption" },
      ]))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => `${String(item.evidenceRefs.length)} controlled refs` }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
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
    <Section title="Flood-propagation network" actions={editable ? <AddButton label="Add path" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "propagationPaths"], "propagation path"))} /> : undefined}>
      <FlowRows rows={sn.propagationPaths.map((item) => ({ id: item.uuid, from: areaName(item.originFloodAreaRef), through: `${item.pathType.replace(/_/g, " ")} · ${display(item.flowCapacityCubicMetresPerMinute, "m³/min")}`, to: areaName(item.destinationFloodAreaRef), status: `${display(item.travelTimeMinutes, "min")}` }))} onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "propagationPaths"], "propagation path", index))} />
    </Section>
    <Section title="Mitigation features" actions={editable ? <AddButton label="Add feature" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "mitigationFeatures"], "mitigation feature"))} /> : undefined}>
      <TechnicalTable records={sn.mitigationFeatures} caption="Flood mitigation features" empty="No mitigation features" onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "mitigationFeatures"], "mitigation feature", index))} columns={[{ header: "Feature", render: (item) => item.featureType.replace(/_/g, " ") }, { header: "Area", render: (item) => areaName(item.floodAreaRef) }, { header: "Capacity", render: (item) => display(item.designCapacity, item.capacityUnit) }, { header: "Credit", render: (item) => <span className={`fltag ${item.credited ? "fltag--good" : "fltag--neutral"}`}>{item.credited ? "CREDITED" : "NOT CREDITED"}</span> }, { header: "Dependencies", render: (item) => `${String(item.dependentPowerRefs.length)} power · ${String(item.dependentHumanActionRefs.length)} human` }]} />
    </Section>
    <Section title="Drainage and propagation capacity" actions={editable ? <EditButton label="Edit capacities" onClick={() => editor.setTarget({ title: "Drainage and propagation capacity", focus: ["scenariosDevelopment"], visibleRootFields: ["propagationPaths", "mitigationFeatures"], inlinePrimitiveArrays: true })} /> : undefined}>
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
    <Section title="SSC flood susceptibility" actions={editable ? <AddButton label="Add SSC evaluation" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "sscSusceptibilities"], "SSC susceptibility"))} /> : undefined}>
      <TechnicalTable records={sn.sscSusceptibilities} caption="SSC susceptibility" empty="No SSC susceptibility evaluations" onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "sscSusceptibilities"], "SSC susceptibility", index))} columns={[{ header: "SSC", render: (item) => item.sscRef }, { header: "Mechanisms", render: (item) => <EmptyOrList values={item.failureMechanisms} /> }, { header: "Damage elevation", render: (item) => item.lowestDamageElevationMetres === undefined ? "—" : display(item.lowestDamageElevationMetres, "m") }, { header: "Operability basis", render: (item) => item.operabilityBasis.replace(/_/g, " ") }, { header: "Basic events", render: (item) => item.failureBasicEventRefs.length }]} />
    </Section>
    <Section title="Retained flood scenarios" actions={editable ? <AddButton label="Add scenario" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "floodScenarios"], "flood scenario"))} /> : undefined}>
      <TechnicalTable records={sn.floodScenarios} caption="Flood scenarios" empty="No flood scenarios" onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "floodScenarios"], "flood scenario", index))} columns={[{ header: "Source / areas", render: (item) => <>{item.sourceRef}<small className="flcellnote">{String(item.affectedFloodAreaRefs.length)} affected areas</small></> }, { header: "Failed SSCs", render: (item) => <EmptyOrList values={item.failedSscRefs} /> }, { header: "Initiator", render: (item) => item.initiatingEventCandidate }, { header: "Operating states", render: (item) => item.plantOperatingStateRefs.length }, { header: "Disposition", render: (item) => <span className={`fltag ${item.disposition === "SCREENED" ? "fltag--neutral" : "fltag--good"}`}>{item.disposition}</span> }]} />
    </Section>
    <Section title="Hydraulic consequence profiles" actions={editable ? <AddButton label="Add calculation" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "hydraulicCalculations"], "hydraulic calculation"))} /> : undefined}>
      <BarList tone="sn" items={sn.hydraulicCalculations.map((item) => ({ id: item.uuid, label: item.name, value: item.maximumFloodHeightMetres, detail: `max at ${display(item.timeToMaximumHeightMinutes, "min")} · damage ${item.timeToCriticalDamageMinutes === undefined ? "not reached" : display(item.timeToCriticalDamageMinutes, "min")}` }))} formatter={(value) => display(value, "m")} onEdit={(index) => editor.setTarget(collectionTarget(["scenariosDevelopment", "hydraulicCalculations"], "hydraulic calculation", index))} />
    </Section>
    <Section title="Screening and scenario assurance" actions={editable ? <AddButton label="Add screening decision" onClick={() => editor.setTarget(collectionTarget(["scenariosDevelopment", "screeningDecisions"], "scenario screening decision"))} /> : undefined}>
      <TechnicalTable records={[...sn.screeningDecisions, ...sn.investigations, ...sn.modelUncertainties, ...sn.preOperationalAssumptions]} caption="Scenario assurance" empty="No assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["scenariosDevelopment", "screeningDecisions"], length: sn.screeningDecisions.length, title: "scenario screening decision" },
        { path: ["scenariosDevelopment", "investigations"], length: sn.investigations.length, title: "scenario investigation" },
        { path: ["scenariosDevelopment", "modelUncertainties"], length: sn.modelUncertainties.length, title: "scenario uncertainty" },
        { path: ["scenariosDevelopment", "preOperationalAssumptions"], length: sn.preOperationalAssumptions.length, title: "scenario pre-operational assumption" },
      ]))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Related records", render: (item) => item.relatedRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
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
    <Section title="Scenario groups and initiating events" actions={editable ? <AddButton label="Add scenario group" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "scenarioGroups"], "scenario group"))} /> : undefined}>
      <TechnicalTable records={ev.scenarioGroups} caption="Scenario groups" empty="No scenario groups" onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "scenarioGroups"], "scenario group", index))} columns={[{ header: "Scenarios", render: (item) => item.floodScenarioRefs.length }, { header: "Grouping basis", render: (item) => item.groupingBasis.replace(/_/g, " ") }, { header: "Units / sources", render: (item) => `${String(item.reactorUnitRefs.length)} / ${String(item.radioactiveMaterialSourceRefs.length)}` }, { header: "Checks", render: (item) => item.groupingValidityChecks.length }]} />
      <FlowRows rows={ev.initiatingEvents.map((item) => ({ id: item.uuid, from: item.scenarioGroupRef, through: item.newInitiatingEventRequired ? "NEW INITIATOR" : item.initiatingEventType.replace(/_/g, " "), to: item.affectedEventSequenceRefs.join(" · "), status: item.newInitiatingEventRequired ? "NEW" : "MAPPED" }))} onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "initiatingEvents"], "initiating-event mapping", index))} />
    </Section>
    <Section title="Annual scenario-group frequencies" actions={editable ? <AddButton label="Add frequency estimate" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyEstimates"], "frequency estimate"))} /> : undefined}>
      <BarList tone="ev" items={ev.frequencyEstimates.map((item) => ({ id: item.uuid, label: item.name, value: item.meanFrequencyPerPlantYear, detail: `5–95%: ${display(item.fifthPercentileFrequencyPerPlantYear)}–${display(item.ninetyFifthPercentileFrequencyPerPlantYear)} /plant-year` }))} formatter={(value) => display(value, "/plant-year")} onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyEstimates"], "frequency estimate", index))} />
    </Section>
    <Section title="Frequency data and mitigation reliability" actions={editable ? <AddButton label="Add data set" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyDataSets"], "frequency data set"))} /> : undefined}>
      <TechnicalTable records={ev.frequencyDataSets} caption="Frequency data" empty="No frequency data" onEdit={(index) => editor.setTarget(collectionTarget(["initiatingEvents", "frequencyDataSets"], "frequency data set", index))} columns={[{ header: "Data type", render: (item) => item.dataType.replace(/_/g, " ") }, { header: "Events / exposure", render: (item) => `${String(item.eventCount)} / ${display(item.exposure)} ${item.exposureUnit.toLowerCase()}` }, { header: "Mean rate", render: (item) => display(item.meanRate, item.rateUnit) }, { header: "Distribution", render: (item) => item.distribution }]} />
    </Section>
    <Section title="Frequency screening and uncertainty" actions={editable ? <AddButton label="Add uncertainty" onClick={() => editor.setTarget(collectionTarget(["initiatingEvents", "modelUncertainties"], "frequency uncertainty"))} /> : undefined}>
      <TechnicalTable records={[...ev.screeningDecisions, ...ev.modelUncertainties, ...ev.preOperationalAssumptions]} caption="Frequency assurance" empty="No assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["initiatingEvents", "screeningDecisions"], length: ev.screeningDecisions.length, title: "frequency screening decision" },
        { path: ["initiatingEvents", "modelUncertainties"], length: ev.modelUncertainties.length, title: "frequency uncertainty" },
        { path: ["initiatingEvents", "preOperationalAssumptions"], length: ev.preOperationalAssumptions.length, title: "frequency pre-operational assumption" },
      ]))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => item.evidenceRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
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
    <Section title="Flood event-sequence models" actions={editable ? <AddButton label="Add sequence model" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "eventSequenceModels"], "event-sequence model"))} /> : undefined}>
      <div className="flsequences">{pr.eventSequenceModels.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "eventSequenceModels"], "event-sequence model", index))}><span>{item.modelTreatment}</span><strong>{item.name}</strong><div>{item.topEvents.map((event) => <em key={event.uuid}>{event.name}</em>)}</div><small>{item.sequenceFamilyRefs.join(" · ")}</small></button>)}</div>
    </Section>
    <Section title="Systems-model changes" actions={editable ? <AddButton label="Add systems change" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "systemModelModifications"], "systems-model change"))} /> : undefined}>
      <TechnicalTable records={pr.systemModelModifications} caption="Systems model modifications" empty="No systems-model changes" onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "systemModelModifications"], "systems-model change", index))} columns={[{ header: "System", render: (item) => item.systemRef }, { header: "Treatment", render: (item) => <span className="fltag fltag--neutral">{item.treatment}</span> }, { header: "Flood failures", render: (item) => item.floodFailedSscRefs.length }, { header: "Added events", render: (item) => item.addedBasicEvents.length }, { header: "Shared dependencies", render: (item) => <EmptyOrList values={item.sharedDependencyRefs} /> }]} />
    </Section>
    <Section title="Success criteria and mission times" actions={editable ? <AddButton label="Add success criterion" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "successCriteria"], "success criterion"))} /> : undefined}>
      <TechnicalTable records={pr.successCriteria} caption="Success criteria" empty="No success criteria" onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "successCriteria"], "success criterion", index))} columns={[{ header: "Function", render: (item) => item.function }, { header: "Required SSCs", render: (item) => <EmptyOrList values={item.requiredSscRefs} /> }, { header: "Analysis", render: (item) => item.analysisMethod }, { header: "Mission", render: (item) => display(item.missionTimeHours, "h") }]} />
      <BarList tone="pr" items={pr.missionTimeAssessments.map((item) => ({ id: item.uuid, label: item.name, value: item.floodMissionTimeHours, detail: `${item.adequate ? "adequate" : "open"} · baseline ${display(item.baselineMissionTimeHours, "h")}` }))} formatter={(value) => display(value, "h")} onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "missionTimeAssessments"], "mission-time assessment", index))} />
    </Section>
    <Section title="Conditional plant-response results and assurance" actions={editable ? <AddButton label="Add response result" onClick={() => editor.setTarget(collectionTarget(["plantResponseModel", "plantResponseResults"], "plant response result"))} /> : undefined}>
      <TechnicalTable records={pr.plantResponseResults} caption="Plant response results" empty="No plant response results" onEdit={(index) => editor.setTarget(collectionTarget(["plantResponseModel", "plantResponseResults"], "plant response result", index))} columns={[{ header: "Conditional probability", render: (item) => display(item.conditionalSequenceFamilyProbability) }, { header: "Annual frequency", render: (item) => display(item.annualSequenceFamilyFrequency, "/plant-year") }, { header: "Release categories", render: (item) => <EmptyOrList values={item.releaseCategoryRefs} /> }]} />
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
    <Section title="Flood-specific human actions and HFEs" actions={editable ? <SectionActions><AddButton label="Add action" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanActions"], "human action"))} /><AddButton label="Add HFE" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanFailureEvents"], "human failure event"))} /><AddButton label="Add context" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "performanceContexts"], "performance context"))} /></SectionActions> : undefined}>
      <TechnicalTable records={hr.humanActions} caption="Human actions" empty="No human actions" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanActions"], "human action", index))} columns={[{ header: "Type", render: (item) => item.actionType.replace(/_/g, " ") }, { header: "Crew / location", render: (item) => <>{item.crew}<small className="flcellnote">{item.actionLocation}</small></> }, { header: "Cues", render: (item) => <EmptyOrList values={item.cues} /> }, { header: "Cue failures", render: (item) => item.floodInducedCueFailures.length }]} />
      <TechnicalTable records={hr.humanFailureEvents} caption="Human failure events" empty="No human failure events" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "humanFailureEvents"], "human failure event", index))} columns={[{ header: "Action / basic event", render: (item) => <>{item.humanActionRef}<small className="flcellnote">{item.basicEventRef}</small></> }, { header: "Failure definition", render: (item) => item.failureDefinition }, { header: "Sequence events", render: (item) => item.affectedEventSequenceRefs.length }, { header: "Areas / POS", render: (item) => `${String(item.floodAreaRefs.length)} / ${String(item.plantOperatingStateRefs.length)}` }]} />
      <TechnicalTable records={hr.performanceContexts} caption="Performance contexts" empty="No performance contexts" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "performanceContexts"], "performance context", index))} columns={[{ header: "HFE", render: (item) => item.humanFailureEventRef }, { header: "Diagnosis / cues", render: (item) => `${item.diagnosisComplexity} / ${item.cueQuality}` }, { header: "Procedure", render: (item) => item.procedureQuality }, { header: "Staffing / workload", render: (item) => item.staffingAndWorkload }, { header: "Route depth", render: (item) => display(item.maximumRouteWaterDepthMetres, "m") }]} />
    </Section>
    <Section title="Timing and feasibility" actions={editable ? <AddButton label="Add timing case" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "timingAssessments"], "timing assessment"))} /> : undefined}>
      <BarList tone="hr" items={hr.timingAssessments.map((item) => ({ id: item.uuid, label: item.name, value: Math.max(0, item.marginMinutes), detail: `${display(item.totalRequiredMinutes, "min")} required · deadline ${display(item.damageOrDeadlineMinutes, "min")} · ${item.feasible ? "feasible" : "not feasible"}` }))} formatter={(value) => display(value, "min margin")} onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "timingAssessments"], "timing assessment", index))} />
    </Section>
    <Section title="HEP quantification" actions={editable ? <AddButton label="Add HEP estimate" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "hepEstimates"], "HEP estimate"))} /> : undefined}>
      <TechnicalTable records={hr.hepEstimates} caption="HEP estimates" empty="No HEP estimates" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "hepEstimates"], "HEP estimate", index))} columns={[{ header: "Method", render: (item) => item.method }, { header: "Mean HEP", render: (item) => display(item.meanHep) }, { header: "5–95%", render: (item) => `${display(item.fifthPercentileHep)}–${display(item.ninetyFifthPercentileHep)}` }, { header: "Time margin", render: (item) => display(timingByHfe.get(item.humanFailureEventRef)?.marginMinutes ?? 0, "min") }, { header: "Recovery", render: (item) => item.recoveryCredit ? "Credited" : "None" }]} />
    </Section>
    <Section title="Human-action dependencies and assurance" actions={editable ? <SectionActions><AddButton label="Add dependency" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "dependencyGroups"], "dependency group"))} /><AddButton label="Add uncertainty" onClick={() => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "modelUncertainties"], "HRA uncertainty"))} /></SectionActions> : undefined}>
      <TechnicalTable records={hr.dependencyGroups} caption="HFE dependencies" empty="No HFE dependencies" onEdit={(index) => editor.setTarget(collectionTarget(["humanReliabilityAnalysis", "dependencyGroups"], "dependency group", index))} columns={[{ header: "HFEs", render: (item) => item.humanFailureEventRefs.length }, { header: "Level", render: (item) => <span className="fltag fltag--neutral">{item.dependencyLevel}</span> }, { header: "Shared factors", render: (item) => [item.commonCrew && "crew", item.commonCue && "cue", item.commonProcedure && "procedure", item.commonLocationOrRoute && "route"].filter(Boolean).join(" · ") }, { header: "Joint probability", render: (item) => display(item.jointFailureProbability) }]} />
      <TechnicalTable records={[...hr.investigations, ...hr.modelUncertainties, ...hr.preOperationalAssumptions]} caption="HRA assurance" empty="No HRA assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["humanReliabilityAnalysis", "investigations"], length: hr.investigations.length, title: "HRA investigation" },
        { path: ["humanReliabilityAnalysis", "modelUncertainties"], length: hr.modelUncertainties.length, title: "HRA uncertainty" },
        { path: ["humanReliabilityAnalysis", "preOperationalAssumptions"], length: hr.preOperationalAssumptions.length, title: "HRA pre-operational assumption" },
      ]))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => item.evidenceRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function Quantification(): JSX.Element {
  const { mef, editable, mutate } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const esq = mef.eventSequenceQuantification;
  return <div className="flstep">
    <Section title="Controlled quantification runs" actions={editable ? <AddButton label="Add run" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "quantificationRuns"], "quantification run"))} /> : undefined}>
      <TechnicalTable records={esq.quantificationRuns} caption="Quantification runs" empty="No quantification runs" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "quantificationRuns"], "quantification run", index))} columns={[{ header: "Model / solver", render: (item) => <>{item.modelVersion}<small className="flcellnote">{item.solverVersion}</small></> }, { header: "Truncation", render: (item) => display(item.truncationLimitPerPlantYear, "/plant-year") }, { header: "Samples", render: (item) => display(item.sampleCount) }, { header: "Convergence", render: (item) => `${display(item.convergenceMetric)} ≤ ${display(item.convergenceCriterion)}` }, { header: "Result", render: (item) => <span className={`fltag ${item.converged ? "fltag--good" : "fltag--warn"}`}>{item.converged ? "CONVERGED" : "OPEN"}</span> }]} />
    </Section>
    <Section title="Event-sequence-family frequencies" actions={editable ? <AddButton label="Add result" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "eventSequenceFamilyResults"], "sequence-family result"))} /> : undefined}>
      <BarList tone="esq" items={esq.eventSequenceFamilyResults.map((item) => ({ id: item.uuid, label: `${item.eventSequenceFamilyRef} · ${item.releaseCategoryRef}`, value: item.meanFrequencyPerPlantYear, detail: `5–95%: ${display(item.fifthPercentileFrequencyPerPlantYear)}–${display(item.ninetyFifthPercentileFrequencyPerPlantYear)} /plant-year` }))} formatter={(value) => display(value, "/plant-year")} onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "eventSequenceFamilyResults"], "sequence-family result", index))} />
    </Section>
    <Section title="Risk-significant contributors" actions={editable ? <AddButton label="Add contributor" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "riskContributors"], "risk contributor"))} /> : undefined}>
      <TechnicalTable records={esq.riskContributors} caption="Risk contributors" empty="No risk contributors" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "riskContributors"], "risk contributor", index))} columns={[{ header: "Rank / type", render: (item) => <><strong>#{item.ranking}</strong><small className="flcellnote">{item.contributorType.replace(/_/g, " ")}</small></> }, { header: "Contribution", render: (item) => display(item.absoluteFrequencyContributionPerPlantYear, "/plant-year") }, { header: "Fraction", render: (item) => `${display(item.fractionalContribution * 100)}%` }, { header: "FV / RAW", render: (item) => `${display(item.fussellVesely)} / ${display(item.riskAchievementWorth)}` }, { header: "Significance", render: (item) => <span className={`fltag ${item.riskSignificant ? "fltag--good" : "fltag--neutral"}`}>{item.riskSignificant ? "SIGNIFICANT" : "LOWER"}</span> }]} />
    </Section>
    <Section title="Uncertainty, dependencies, and sensitivity" actions={editable ? <SectionActions><AddButton label="Add dependency" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "dependencies"], "quantification dependency"))} /><AddButton label="Add sensitivity" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "sensitivityStudies"], "sensitivity study"))} /></SectionActions> : undefined}>
      <TechnicalTable records={esq.dependencies} caption="Quantification dependencies" empty="No quantification dependencies" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "dependencies"], "quantification dependency", index))} columns={[{ header: "Type", render: (item) => item.dependencyType.replace(/_/g, " ") }, { header: "Events / groups", render: (item) => `${String(item.dependentEventRefs.length)} / ${String(item.affectedScenarioGroupRefs.length)}` }, { header: "Treatment", render: (item) => item.treatment }, { header: "Correlation / joint", render: (item) => `${display(item.correlationCoefficient)} / ${display(item.jointProbability)}` }]} />
      <TechnicalTable records={esq.uncertaintyResults} caption="Quantified uncertainty" empty="No uncertainty results" onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "uncertaintyResults"], "uncertainty result", index))} columns={[{ header: "Method", render: (item) => item.propagationMethod }, { header: "Mean", render: (item) => display(item.meanFrequencyPerPlantYear, "/plant-year") }, { header: "5–95%", render: (item) => `${display(item.fifthPercentileFrequencyPerPlantYear)}–${display(item.ninetyFifthPercentileFrequencyPerPlantYear)}` }, { header: "Sources", render: (item) => item.uncertaintySourceRefs.length }]} />
      <BarList tone="esq" items={esq.sensitivityStudies.map((item) => ({ id: item.uuid, label: item.name, value: Math.abs(item.relativeChange), detail: `${item.relativeChange >= 0 ? "+" : ""}${display(item.relativeChange * 100)}% · ${item.conclusion}` }))} formatter={(value) => `${display(value * 100)}%`} onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "sensitivityStudies"], "sensitivity study", index))} />
      <TechnicalTable records={[...esq.modelUncertainties, ...esq.preOperationalAssumptions]} caption="Quantification assurance" empty="No quantification assurance records" onEdit={(index) => editor.setTarget(groupedCollectionTarget(index, [
        { path: ["eventSequenceQuantification", "modelUncertainties"], length: esq.modelUncertainties.length, title: "quantification uncertainty" },
        { path: ["eventSequenceQuantification", "preOperationalAssumptions"], length: esq.preOperationalAssumptions.length, title: "quantification pre-operational assumption" },
      ]))} columns={[{ header: "Basis", render: (item) => item.basis }, { header: "Evidence", render: (item) => item.evidenceRefs.length }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.status}</span> }]} />
    </Section>
    <Section title="End-to-end quantification traceability" actions={editable ? <AddButton label="Add trace" onClick={() => editor.setTarget(collectionTarget(["eventSequenceQuantification", "traceability"], "quantification trace"))} /> : undefined}>
      <FlowRows rows={esq.traceability.map((item) => ({ id: item.uuid, from: item.floodScenarioRefs.join(" · "), through: item.eventSequenceFamilyRefs.join(" · "), to: item.quantificationResultRefs.join(" · "), status: item.complete ? "COMPLETE" : "OPEN" }))} onEdit={(index) => editor.setTarget(collectionTarget(["eventSequenceQuantification", "traceability"], "quantification trace", index))} />
    </Section>
    <Editor target={editor.target} onClose={() => editor.setTarget(null)} />
  </div>;
}

function RiskInterpretation(): JSX.Element {
  const { mef, editable } = useInternalFloodPraWorkbook();
  const editor = useEditor();
  const risk = mef.riskInterpretation;
  return <div className="flstep">
    <Section title="Integrated risk insights" actions={editable ? <AddButton label="Add risk insight" onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "riskInsights"], "risk insight"))} /> : undefined}>
      <div className="flinsights">{risk.riskInsights.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "riskInsights"], "risk insight", index))}><span>{item.insightType.replace(/_/g, " ")}</span><strong>{item.name}</strong><p>{item.description}</p><em>{item.decisionImplication}</em>{item.fractionalContribution !== undefined && <b>{display(item.fractionalContribution * 100)}%</b>}</button>)}</div>
    </Section>
    <Section title="Risk-driven model refinements" actions={editable ? <AddButton label="Add refinement" onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "refinementActions"], "model refinement"))} /> : undefined}>
      <TechnicalTable records={risk.refinementActions} caption="Model refinements" empty="No model refinements" onEdit={(index) => editor.setTarget(collectionTarget(["riskInterpretation", "refinementActions"], "model refinement", index))} columns={[{ header: "Area", render: (item) => item.technicalArea }, { header: "Priority", render: (item) => <span className="fltag fltag--neutral">{item.priority}</span> }, { header: "Refinement", render: (item) => item.refinement }, { header: "Status", render: (item) => <span className={`fltag ${statusTone(item.status)}`}>{item.refinementStatus}</span> }, { header: "Result", render: (item) => item.result }]} />
    </Section>
    <Section title="Refinement stability" actions={editable ? <AddButton label="Add iteration" onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "quantificationIterations"], "refinement iteration"))} /> : undefined}>
      <div className="fliterations">{risk.quantificationIterations.map((item, index) => <button type="button" key={item.uuid} onClick={() => editor.setTarget(collectionTarget(["riskInterpretation", "quantificationIterations"], "refinement iteration", index))}><span>{item.modelVersion}</span><strong>{display(item.aggregateMeanFrequencyPerPlantYear, "/plant-year")}</strong><small>{item.relativeChange === undefined ? "Initial result" : `${item.relativeChange >= 0 ? "+" : ""}${display(item.relativeChange * 100)}% from prior`}</small><em className={item.decision === "ACCEPT_STABLE" ? "fliterations__stable" : ""}>{item.decision.replace(/_/g, " ")}</em></button>)}</div>
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
    <Section title="Controlled risk handoff" actions={editable ? <SectionActions>{result !== undefined && <EditButton label="Edit result" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "results"], "risk-integration result", 0))} />}<AddButton label="Add result" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "results"], "risk-integration result"))} /></SectionActions> : undefined}>
      {result === undefined ? <div className="flempty"><strong>No integrated result</strong><p>Add the controlled Internal Flood risk result.</p></div> : <div className="sanalysisbasis"><AnalysisRow label="Model version" value={result.modelVersion} /><AnalysisRow label="Aggregate mean" value={display(result.aggregateMeanFrequencyPerPlantYear, "/plant-year")} /><AnalysisRow label="5th percentile" value={display(result.fifthPercentileFrequencyPerPlantYear, "/plant-year")} /><AnalysisRow label="95th percentile" value={display(result.ninetyFifthPercentileFrequencyPerPlantYear, "/plant-year")} /><AnalysisRow label="Integration status" value={result.integrationStatus.replace(/_/g, " ")} /><AnalysisRow label="Cross-hazard overlap treatment" value={result.overlapTreatment} /></div>}
    </Section>
    <Section title="Risk-informed decisions" actions={editable ? <AddButton label="Add decision" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "decisions"], "risk decision"))} /> : undefined}>
      <TechnicalTable records={baseline.decisions} caption="Risk decisions" empty="No risk decisions" onEdit={(index) => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "decisions"], "risk decision", index))} columns={[{ header: "Type", render: (item) => item.decisionType.replace(/_/g, " ") }, { header: "Action", render: (item) => item.action }, { header: "Disposition", render: (item) => <span className="fltag fltag--good">{item.disposition}</span> }, { header: "Due", render: (item) => item.duePhase }, { header: "Reanalysis", render: (item) => item.reanalysisRequired ? "Required" : "No" }]} />
    </Section>
    <Section title="End-to-end decision traceability" actions={editable ? <AddButton label="Add decision trace" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "traceabilityPaths"], "decision trace"))} /> : undefined}>
      <FlowRows rows={baseline.traceabilityPaths.map((item) => ({ id: item.uuid, from: `${String(item.floodAreaRefs.length)} areas · ${String(item.floodSourceRefs.length)} sources`, through: item.eventSequenceFamilyRefs.join(" · "), to: item.decisionRefs.join(" · "), status: item.complete ? "COMPLETE" : "OPEN" }))} onEdit={(index) => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "traceabilityPaths"], "decision trace", index))} />
    </Section>
    <Section title="Controlled baseline package" actions={editable ? <AddButton label="Add baseline" onClick={() => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "controlledBaselines"], "controlled baseline"))} /> : undefined}>
      <TechnicalTable records={baseline.controlledBaselines} caption="Controlled baselines" empty="No controlled baseline" onEdit={(index) => editor.setTarget(collectionTarget(["riskIntegrationBaseline", "controlledBaselines"], "controlled baseline", index))} columns={[{ header: "Model", render: (item) => item.modelVersion }, { header: "Quantification", render: (item) => item.quantificationRunRef }, { header: "Configuration", render: (item) => item.configurationControlRecordId }, { header: "Peer review", render: (item) => item.peerReviewRef }, { header: "Release", render: (item) => <span className="fltag fltag--good">{item.releaseStatus}</span> }]} />
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
