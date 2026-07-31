import { SEISMIC_PRA_SR_CATALOG, type SeismicPRA, type SeismicPraApplication } from "interfaces-mef-types/seismic/seismic-pra";
import { type PlantIdentity } from "interfaces-mef-types/technical-element";
import { synchronizeSeismicPraDerivedRegisters, validateSeismicPra, type SeismicPraDiagnostic } from "interfaces-mef-types/seismic/seismic-pra-validation";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { seismicConformanceItems, seismicConformanceScore } from "./seismicPraConformance";
import { generateSeismicPraReport } from "./seismicPraDocx";
import { Drawer, EmptyState, Field, InfoButton, NumberInput, Section, SelectInput, Tag, TextArea, TextInput } from "./seismicPraFields";
import { exampleBaselinePra } from "./seismicPraBaselineFallback";
import { fragilityFanSeries, hazardCurveFanSeries, motionValueAtFrequency, responseSpectrumFanSeries, secondaryHazardFanSeries, structuralResponseFanSeries, type HazardFanPoint, type SpectrumDirection } from "./seismicPraHazardCharts";
import { seismicPraInterfaceLanes, type SeismicPraInterfaceLane } from "./seismicPraInterfaces";
import { removeStructuredRecord, StructuredEditorDrawer, type EditorPath } from "./seismicPraStructuredEditor";
import { seismicPraVariant, useSeismicPraWorkbook } from "./seismicPraWorkbookContext";

type Tone = "sha" | "sfr" | "spr" | "integration";
interface CollectionEditorTarget {
  title: string;
  subtitle: string;
  focus: EditorPath;
  createAt?: EditorPath;
  visibleRootFields?: string[] | ((value: Record<string, unknown>) => string[]);
  inlinePrimitiveArrays?: boolean;
  inlineObjectFields?: string[];
  removeLabel?: string;
}
interface AddCategoryOption {
  label: string;
  description: string;
  title: string;
  subtitle: string;
  createAt: EditorPath;
}

const EDITOR_LABELS: Record<Tone, string> = {
  sha: "Seismic Hazard Analysis",
  sfr: "Seismic Fragility Analysis",
  spr: "Seismic Plant Response Analysis",
  integration: "Integrated Seismic PRA",
};

function displayLabel(value: string): string {
  const normalized = value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\bground motion\b/g, "ground-motion")
    .replace(/\bplant specific\b/g, "plant-specific")
    .replace(/\bsite specific\b/g, "site-specific")
    .replace(/\bpre operational\b/g, "pre-operational")
    .replace(/\bevent sequence\b/g, "event-sequence")
    .replace(/\bex control room\b/g, "ex-control-room")
    .replace(/\bnon seismic\b/g, "non-seismic");
  const sentence = `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  return sentence
    .replace(/\bsshac\b/gi, "SSHAC")
    .replace(/\bpga\b/gi, "PGA")
    .replace(/\bssc\b/gi, "SSC")
    .replace(/\bpra\b/gi, "PRA")
    .replace(/\bhfe\b/gi, "HFE");
}

function displayParameter(value: string): string {
  if (value === "betaR") return "βR";
  if (value === "betaU") return "βU";
  if (value === "compositeBeta") return "Composite β";
  return displayLabel(value);
}

function structuredProcessLabel(value: string): string {
  const match = /^SSHAC_LEVEL_(\d+)$/.exec(value);
  return match === null ? displayLabel(value) : `SSHAC Level ${match[1]}`;
}

function srCapabilitySummary(mef: SeismicPRA): string {
  const applicable = mef.conformanceMatrix.filter((row) => row.applicableToStage.includes(mef.plantStage));
  const ccOneCount = applicable.filter((row) => row.capabilityCategory === "CC-I").length;
  const ccTwoCount = applicable.filter((row) => row.capabilityCategory === "CC-II").length;
  return `${ccOneCount} CC-I · ${ccTwoCount} CC-II`;
}

function useUpdate(): { mef: SeismicPRA; editable: boolean; update: (change: (draft: SeismicPRA) => void) => void } {
  const { mef, editable, mutate } = useSeismicPraWorkbook();
  function update(change: (draft: SeismicPRA) => void): void {
    mutate((current) => {
      const draft = structuredClone(current);
      change(draft);
      const siteDefinition = draft.seismicHazardAnalysis.analysisBasis.site;
      if (siteDefinition.siteBasis === "IDENTIFIED_SITE") {
        const referenceSiteName = draft.metadata.plantIdentity?.siteName?.trim() ?? "";
        siteDefinition.name = referenceSiteName.length > 0 ? referenceSiteName : "Identified site";
        siteDefinition.siteName = referenceSiteName.length > 0 ? referenceSiteName : undefined;
      }
      Object.assign(draft, synchronizeSeismicPraDerivedRegisters(draft));
      const now = new Date().toISOString();
      draft.modified = now;
      draft.metadata.lastModifiedDate = now;
      return draft;
    });
  }
  return { mef, editable, update };
}

function FieldGrid({ children }: { children: ReactNode }): JSX.Element {
  return <div className="sfieldgrid">{children}</div>;
}

function OptionalNumberInput({ value, onChange }: { value: number | undefined; onChange: (value: number | undefined) => void }): JSX.Element {
  return <input
    className="sinput sinput--number"
    type="number"
    step="any"
    value={value ?? ""}
    onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
  />;
}

function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Pencil /> {label}</button>;
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Plus /> {label}</button>;
}

function EntryName({ children, detailLabel, detail }: { children: ReactNode; detailLabel?: string; detail?: ReactNode }): JSX.Element {
  return <span className="sentryname">
    <strong>{children}</strong>
    {detailLabel !== undefined && detail !== undefined
      && <span onClick={(event) => event.stopPropagation()}>
        <InfoButton kind="entry" label={detailLabel}>{detail}</InfoButton>
      </span>}
  </span>;
}

function CategorizedAddButton({ label, title, options, onChoose }: { label: string; title: string; options: AddCategoryOption[]; onChoose: (target: CollectionEditorTarget) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return <>
    <AddButton label={label} onClick={() => setOpen(true)} />
    {open && <Drawer title={title} subtitle="Choose the record type." plainHeader onClose={() => setOpen(false)} footer={<button type="button" className="posnav__btn" onClick={() => setOpen(false)}>Cancel</button>}>
      <div className="saddcategory">{options.map((option) => <button type="button" className="saddcategory__row" key={option.label} onClick={() => { setOpen(false); onChoose({ title: option.title, subtitle: option.subtitle, focus: [], createAt: option.createAt }); }}><span><strong>{option.label}</strong><small>{option.description}</small></span><POSIcon.ArrowR /></button>)}</div>
    </Drawer>}
  </>;
}

function SectionEditorRow({ title, description, onClick }: { title: string; description: string; onClick: () => void }): JSX.Element {
  return <button type="button" className="seditrow" onClick={onClick}><span><strong>{title}</strong><small>{description}</small></span><POSIcon.ArrowR /></button>;
}

function Readout({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return <div className="sreadout"><span>{label}</span><strong>{value}</strong></div>;
}

function Narrative({ label, value, empty = "Not documented yet." }: { label: string; value: string; empty?: string }): JSX.Element {
  return <div className="snarrative"><span>{label}</span><p className={value.trim().length === 0 ? "snarrative__empty" : ""}>{value.trim().length > 0 ? value : empty}</p></div>;
}

function BasisDetail({ label, value }: { label: string; value: string }): JSX.Element {
  const populated = value.trim().length > 0;
  return <div className="sbasis__detail"><span>{label}</span><p className={populated ? "" : "sbasis__detail-empty"}>{populated ? value : "Not documented yet."}</p></div>;
}

function TableCaption({ caption, actions }: { caption: string; actions?: ReactNode }): JSX.Element {
  return <div className="stable__caption-row">
    <div className="stable__caption">{caption}</div>
    {actions !== undefined && <div className="stable__caption-actions">{actions}</div>}
  </div>;
}

function Table({ headers, children, minWidth = 720, caption, captionActions, columnWidths, className }: { headers: string[]; children: ReactNode; minWidth?: number; caption?: string; captionActions?: ReactNode; columnWidths?: string[]; className?: string }): JSX.Element {
  return <div className="stablewrap">
    {caption !== undefined && <TableCaption caption={caption} actions={captionActions} />}
    <table aria-label={caption} className={`stable postable${className === undefined ? "" : ` ${className}`}`} style={{ minWidth, tableLayout: minWidth === 0 ? "fixed" : undefined }}>
      {columnWidths !== undefined && <colgroup>{columnWidths.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>}
      <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>;
}

function DiagnosticTable({ diagnostics }: { diagnostics: SeismicPraDiagnostic[] }): JSX.Element {
  if (diagnostics.length === 0) return <div className="svalidation__clear"><POSIcon.Check /><div><strong>No validation findings</strong><span>The current canonical model passes the integrated consistency checks.</span></div></div>;
  return <Table headers={["Finding", "Area", "Severity", "Affected records"]}>
    {diagnostics.map((diagnostic, index) => <tr key={`${diagnostic.code}-${index}`}><td><strong>{diagnostic.message}</strong><code>{diagnostic.code}</code></td><td>{diagnostic.area}</td><td><Tag tone={diagnostic.severity === "ERROR" ? "bad" : diagnostic.severity === "WARNING" ? "warn" : "neutral"}>{diagnostic.severity}</Tag></td><td>{diagnostic.recordRefs.length > 0 ? diagnostic.recordRefs.join(" · ") : "—"}</td></tr>)}
  </Table>;
}

function MefEditor({ tone, title, subtitle, focus, createAt, hiddenRootFields, visibleRootFields, inlinePrimitiveArrays, inlineObjectFields, removeLabel, onClose }: { tone: Tone; title: string; subtitle: string; focus: EditorPath; createAt?: EditorPath; hiddenRootFields?: string[]; visibleRootFields?: string[] | ((value: Record<string, unknown>) => string[]); inlinePrimitiveArrays?: boolean; inlineObjectFields?: string[]; removeLabel?: string; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  return <StructuredEditorDrawer eyebrow={EDITOR_LABELS[tone]} title={title} subtitle={subtitle} schema={SeismicPRASchema} value={mef} editable={editable} initialFocus={focus} createAt={createAt} hiddenRootFields={hiddenRootFields} visibleRootFields={visibleRootFields} inlinePrimitiveArrays={inlinePrimitiveArrays} inlineObjectFields={inlineObjectFields} onClose={onClose} onApply={(value) => update((draft) => { Object.assign(draft, value); })} onRemove={removeLabel === undefined ? undefined : () => update((draft) => { Object.assign(draft, removeStructuredRecord(draft, focus)); })} removeLabel={removeLabel} />;
}

function CollectionEditor({ tone, target, onClose }: { tone: Tone; target: CollectionEditorTarget | null; onClose: () => void }): JSX.Element | null {
  if (target === null) return null;
  return <MefEditor tone={tone} title={target.title} subtitle={target.subtitle} focus={target.focus} createAt={target.createAt} visibleRootFields={target.visibleRootFields} inlinePrimitiveArrays={target.inlinePrimitiveArrays} inlineObjectFields={target.inlineObjectFields} removeLabel={target.removeLabel} onClose={onClose} />;
}

function InterfaceFlowTable({ title, lane }: { title: string; lane: SeismicPraInterfaceLane }): JSX.Element {
  return <div className="sinterface__flow">
    <div className="sinterface__flow-title">{title}</div>
    {lane.rows.length === 0 ? <p className="posmuted sinterface__empty">{lane.empty}</p> : <div className="sinterface__table-wrap"><table className="postable postable--mid">
      <thead><tr>{lane.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>{lane.rows.map((row) => <tr key={row.id}><td><div className="postable__name">{row.name}</div></td>{row.values.map((value, index) => <td key={`${row.id}-${lane.columns[index + 1] ?? index}`}>{value}</td>)}</tr>)}</tbody>
    </table></div>}
  </div>;
}

function SeismicInterfacesSection(): JSX.Element {
  const { mef, linkedInputs } = useSeismicPraWorkbook();
  const lanes = useMemo(() => seismicPraInterfaceLanes(mef, linkedInputs), [mef, linkedInputs]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const selectedLane = lanes.find((lane) => lane.code === selectedElement);
  const selectedRole = selectedLane === undefined ? "" : `${selectedLane.role.charAt(0).toLowerCase()}${selectedLane.role.slice(1)}`;
  return <div className="poscard">
    <div className="poscard__head"><div className="ssection__heading"><h3 className="poscard__title">Interfaces</h3><InfoButton label="About Interfaces">Use this section to see what technical data Seismic PRA receives from earlier technical elements and what results it sends to later ones. Select a tab to inspect the actual records being transferred.</InfoButton></div></div>
    <div className="poshandoff__grid">
      {lanes.map((lane) => <button key={lane.code} type="button" className={`poshandoff__tile${selectedElement === lane.code ? " poshandoff__tile--active" : ""}`} onClick={() => setSelectedElement(selectedElement === lane.code ? null : lane.code)}>
        <span className="poshandoff__tile-code">{lane.code}</span>
        <span className="poshandoff__tile-name">{lane.element}</span>
        <span className="poshandoff__tile-role">{lane.direction === "out" ? "Consumes · " : "Provides · "}{lane.role}</span>
      </button>)}
    </div>
    {selectedLane !== undefined && <div className="sinterface__details">
      <InterfaceFlowTable title={selectedLane.direction === "out" ? `${selectedLane.element} receives ${selectedRole} from Seismic PRA` : `Seismic PRA receives ${selectedRole} from ${selectedLane.element}`} lane={selectedLane} />
    </div>}
  </div>;
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
  plantStage: SeismicPRA["plantStage"];
};

function defaultPlantIdentity(): PlantIdentity {
  return {
    name: "",
    vendor: "",
    reactorType: "",
    thermalPower: "",
    primaryCoolant: "",
    siteName: "",
    numberOfModules: 1,
  };
}

function AnalysisScopeEditor({ onClose, operatingStates, materialSources }: {
  onClose: () => void;
  operatingStates: string;
  materialSources: string;
}): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const application = mef.applications[0];
  const identity = mef.metadata.plantIdentity ?? defaultPlantIdentity();
  const [draft, setDraft] = useState<AnalysisScopeDraft>(() => ({
    applicationName: application?.name ?? "",
    purpose: application?.purpose ?? "",
    decisionContext: application?.decisionContext ?? "",
    supportedRiskMetrics: application?.supportedRiskMetrics.join("\n") ?? "",
    plantName: identity.name,
    siteName: identity.siteName ?? "",
    vendor: identity.vendor,
    reactorType: identity.reactorType,
    thermalPower: identity.thermalPower,
    numberOfModules: identity.numberOfModules ?? 1,
    praScope: mef.praScope,
    plantStage: mef.plantStage,
  }));

  function save(): void {
    update((next) => {
      const currentApplication = next.applications[0];
      const savedApplication: SeismicPraApplication = {
        uuid: currentApplication?.uuid ?? crypto.randomUUID(),
        name: draft.applicationName,
        purpose: draft.purpose,
        decisionContext: draft.decisionContext,
        supportedRiskMetrics: technicalList(draft.supportedRiskMetrics),
        consumingElementRefs: currentApplication?.consumingElementRefs ?? [],
        configurationBasis: currentApplication?.configurationBasis ?? "",
        limitations: currentApplication?.limitations ?? [],
        evidenceRefs: currentApplication?.evidenceRefs ?? [],
        status: currentApplication?.status ?? "ACTIVE",
      };
      next.applications = [savedApplication, ...next.applications.slice(1)];
      next.metadata.plantIdentity = {
        ...(next.metadata.plantIdentity ?? defaultPlantIdentity()),
        name: draft.plantName,
        siteName: draft.siteName,
        vendor: draft.vendor,
        reactorType: draft.reactorType,
        thermalPower: draft.thermalPower,
        numberOfModules: Math.max(1, Math.round(draft.numberOfModules)),
      };
      next.praScope = draft.praScope;
      next.metadata.scope = draft.praScope;
      next.seismicHazardAnalysis.praScope = draft.praScope;
      next.seismicFragilityAnalysis.praScope = draft.praScope;
      next.seismicPlantResponseAnalysis.praScope = draft.praScope;
      next.plantStage = draft.plantStage;
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.integration} title="PRA scope and application" subtitle="Use this editor to record why the analysis is being performed, which plant and operating conditions it covers, and which risk results it must produce" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">PRA application</h3>
        <Field label="Intended application">
          <TextInput value={draft.applicationName} onChange={(value) => setDraft((current) => ({ ...current, applicationName: value }))} />
        </Field>
        <Field label="Purpose">
          <TextArea rows={3} value={draft.purpose} onChange={(value) => setDraft((current) => ({ ...current, purpose: value }))} />
        </Field>
        <Field label="Decision supported">
          <TextArea rows={3} value={draft.decisionContext} onChange={(value) => setDraft((current) => ({ ...current, decisionContext: value }))} />
        </Field>
        <Field label="Risk measures and endpoints">
          <TextArea rows={4} value={draft.supportedRiskMetrics} onChange={(value) => setDraft((current) => ({ ...current, supportedRiskMetrics: value }))} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Reference plant and site</h3>
        <FieldGrid>
          <Field label="Plant name">
            <TextInput value={draft.plantName} onChange={(value) => setDraft((current) => ({ ...current, plantName: value }))} />
          </Field>
          <Field label="Site">
            <TextInput value={draft.siteName} onChange={(value) => setDraft((current) => ({ ...current, siteName: value }))} />
          </Field>
          <Field label="Vendor or designer">
            <TextInput value={draft.vendor} onChange={(value) => setDraft((current) => ({ ...current, vendor: value }))} />
          </Field>
          <Field label="Reactor type">
            <TextInput value={draft.reactorType} onChange={(value) => setDraft((current) => ({ ...current, reactorType: value }))} />
          </Field>
          <Field label="Thermal power">
            <TextInput value={draft.thermalPower} onChange={(value) => setDraft((current) => ({ ...current, thermalPower: value }))} />
          </Field>
          <Field label="Modules or units">
            <NumberInput value={draft.numberOfModules} step="1" onChange={(value) => setDraft((current) => ({ ...current, numberOfModules: value }))} />
          </Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">PRA boundary</h3>
        <Field label="Integrated PRA scope">
          <TextArea rows={4} value={draft.praScope} onChange={(value) => setDraft((current) => ({ ...current, praScope: value }))} />
        </Field>
        <Field label="Plant stage">
          <SelectInput value={draft.plantStage} options={[{ value: "PRE_OPERATIONAL", label: "Pre-operational" }, { value: "OPERATIONAL", label: "Operational" }]} onChange={(value) => setDraft((current) => ({ ...current, plantStage: value as SeismicPRA["plantStage"] }))} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Imported POS scope</h3>
        <Field label="Operating states">
          <TextArea rows={3} value={operatingStates} disabled onChange={() => undefined} />
        </Field>
        <Field label="Radioactive-material sources">
          <TextArea rows={3} value={materialSources} disabled onChange={() => undefined} />
        </Field>
      </div>
    </fieldset>
  </Drawer>;
}

function AnalysisScopeRow({ label, value, emptyValue = "Not defined" }: { label: string; value: string; emptyValue?: string }): JSX.Element {
  return <div className="sanalysisbasis__row"><span>{label}</span><strong title={value}>{value.trim().length > 0 ? value : emptyValue}</strong></div>;
}

function ScopeScreen(): JSX.Element {
  const { linkedInputs } = useSeismicPraWorkbook();
  const { mef, editable } = useUpdate();
  const identity = mef.metadata.plantIdentity ?? defaultPlantIdentity();
  const application = mef.applications[0];
  const groundMotionParameters = mef.seismicHazardAnalysis.analysisBasis.groundMotionParameters;
  const controlPoints = mef.seismicHazardAnalysis.responseSpectraEvaluation.controlPoints;
  const groundMotionFields = (value: Record<string, unknown>): string[] => [
    "name",
    "parameterType",
    "direction",
    "units",
    ...(value.parameterType === "PEAK_GROUND_ACCELERATION" ? [] : ["dampingRatio", "oscillatorFrequencyHz"]),
    "selectedRange",
    "selectedFrequencyRangeHz",
    "usedForHazard",
    "usedForFragility",
    "usedForPlantResponse",
  ];
  const controlPointFields = ["name", "controlPointType", "locationDescription", "elevation", "elevationUnit", "coordinateReference", "basis"];
  const [scopeOpen, setScopeOpen] = useState(false);
  const [parameterEditor, setParameterEditor] = useState<CollectionEditorTarget | null>(null);
  const [controlPointEditor, setControlPointEditor] = useState<CollectionEditorTarget | null>(null);
  const frequencyRangeLabel = (lower: number, upper: number): string => lower === upper ? `${lower} Hz` : `${lower}–${upper} Hz`;
  const plantAndSite = [identity.name, identity.siteName].filter((value) => value !== undefined && value.trim().length > 0).join(" · ");
  const plantStage = displayLabel(mef.plantStage);
  const operatingStates = linkedInputs?.posStates.map((state) => state.name).join(" · ") ?? "";
  const materialSources = Array.from(new Set(linkedInputs?.posStates.flatMap((state) => state.materialSources) ?? [])).join(" · ");

  return <>
    <Section title="PRA scope and application" description="Use this section to record why the analysis is being performed, which plant, operating states, and radioactive-material sources are included, and which risk results are required. Capability categories are checked separately for each supporting requirement in Conformance." tone="integration" actions={<EditButton label="Edit PRA scope and application" onClick={() => setScopeOpen(true)} />}>
      <div className="sanalysisbasis">
        <AnalysisScopeRow label="Intended application" value={application?.name ?? ""} />
        <AnalysisScopeRow label="Purpose" value={application?.purpose ?? ""} />
        <AnalysisScopeRow label="Decision supported" value={application?.decisionContext ?? ""} />
        <AnalysisScopeRow label="Reference plant and site" value={plantAndSite} />
        <AnalysisScopeRow label="PRA scope" value={mef.praScope} />
        <AnalysisScopeRow label="Plant stage" value={plantStage} />
        <AnalysisScopeRow label="Operating states" value={operatingStates} emptyValue="Not available from POS" />
        <AnalysisScopeRow label="Radioactive-material sources" value={materialSources} emptyValue="Not available from POS" />
        <AnalysisScopeRow label="Risk measures and endpoints" value={application?.supportedRiskMetrics.join(" · ") ?? ""} />
      </div>
    </Section>

    <Section title="Ground-motion definition" description="Use this section to agree on the earthquake-motion measurements and physical locations that every later calculation will use. These are common starting inputs, not calculated hazard or response results." tone="integration">
      <div className="smotionbasis">
        <div className="smotionbasis__heading">
          <div className="smotionbasis__heading-title">
            <h3 className="smotionbasis__title">Ground-motion parameters</h3>
            <InfoButton label="About ground-motion parameters">These rows define how earthquake shaking will be measured in later calculations. Each row chooses a direction, frequency, damping value, unit, and calculation range. The analysts select these settings before running the hazard calculations; later steps calculate the actual hazard values.</InfoButton>
          </div>
          {editable && <AddButton label="Add ground-motion parameter" onClick={() => setParameterEditor({ title: "New ground-motion parameter", subtitle: "Ground-motion parameter used by seismic hazard, fragility, and plant-response calculations", focus: [], createAt: ["seismicHazardAnalysis", "analysisBasis", "groundMotionParameters"], visibleRootFields: groundMotionFields })} />}
        </div>
        {groundMotionParameters.length === 0 ? <p className="sanalysisbasis__empty">No ground-motion parameters defined.</p> : <Table headers={["Parameter", "Type", "Direction", "Range", "Frequency range"]} minWidth={0} className="stable--technical">
          {groundMotionParameters.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setParameterEditor({ title: item.name, subtitle: "Ground-motion parameter used by seismic hazard, fragility, and plant-response calculations", focus: ["seismicHazardAnalysis", "analysisBasis", "groundMotionParameters", index], visibleRootFields: groundMotionFields, removeLabel: "Remove parameter" })}>
            <td className="stable__key"><strong>{item.name}</strong></td>
            <td>{displayLabel(item.parameterType)}{item.dampingRatio === undefined ? "" : ` · ${item.dampingRatio * 100}% damping`}</td>
            <td>{displayLabel(item.direction)}</td>
            <td>{item.selectedRange.minimum}–{item.selectedRange.maximum} {item.units}</td>
            <td>{frequencyRangeLabel(item.selectedFrequencyRangeHz.lower, item.selectedFrequencyRangeHz.upper)}</td>
          </tr>)}
        </Table>}
        <div className="smotionbasis__heading">
          <div className="smotionbasis__heading-title">
            <h3 className="smotionbasis__title">Seismic control points</h3>
            <InfoButton label="About seismic control points">These rows name the exact physical locations where earthquake motion will be defined or compared. The analyst selects them from site coordinates and existing foundation and structural drawings. Later steps calculate how the motion changes between these locations.</InfoButton>
          </div>
          {editable && <AddButton label="Add seismic control point" onClick={() => setControlPointEditor({ title: "New seismic control point", subtitle: "Physical reference location at which input or transferred ground motion is defined", focus: [], createAt: ["seismicHazardAnalysis", "responseSpectraEvaluation", "controlPoints"], visibleRootFields: controlPointFields, inlinePrimitiveArrays: true })} />}
        </div>
        {controlPoints.length === 0 ? <p className="sanalysisbasis__empty">No seismic control points defined.</p> : <Table headers={["Control point", "Type", "Location", "Elevation"]} minWidth={0} className="stable--technical">
          {controlPoints.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setControlPointEditor({ title: item.name, subtitle: "Physical reference location at which input or transferred ground motion is defined", focus: ["seismicHazardAnalysis", "responseSpectraEvaluation", "controlPoints", index], visibleRootFields: controlPointFields, inlinePrimitiveArrays: true, removeLabel: "Remove control point" })}>
            <td className="stable__key"><strong>{item.name}</strong></td>
            <td>{displayLabel(item.controlPointType)}</td>
            <td>{item.locationDescription}</td>
            <td>{item.elevation === undefined ? "Not defined" : `${item.elevation} ${item.elevationUnit ?? ""}`.trim()}</td>
          </tr>)}
        </Table>}
      </div>
    </Section>

    <SeismicInterfacesSection />

    {scopeOpen && <AnalysisScopeEditor onClose={() => setScopeOpen(false)} operatingStates={operatingStates} materialSources={materialSources} />}
    <CollectionEditor tone="integration" target={parameterEditor} onClose={() => setParameterEditor(null)} />
    <CollectionEditor tone="integration" target={controlPointEditor} onClose={() => setControlPointEditor(null)} />
  </>;
}

type HazardAnalysisBasis = SeismicPRA["seismicHazardAnalysis"]["analysisBasis"];
type SeismicSiteBasis = HazardAnalysisBasis["site"]["siteBasis"];
type StructuredHazardProcessType = HazardAnalysisBasis["structuredProcess"]["processType"];

const SITE_BASIS_OPTIONS: { value: SeismicSiteBasis; label: string }[] = [
  { value: "IDENTIFIED_SITE", label: "Identified site" },
  { value: "BOUNDING_SITE", label: "Bounding site" },
];

const PSHA_PROCESS_OPTIONS: { value: StructuredHazardProcessType; label: string }[] = [
  { value: "SSHAC_LEVEL_1", label: "SSHAC Level 1" },
  { value: "SSHAC_LEVEL_2", label: "SSHAC Level 2" },
  { value: "SSHAC_LEVEL_3", label: "SSHAC Level 3" },
  { value: "SSHAC_LEVEL_4", label: "SSHAC Level 4" },
  { value: "OTHER_STRUCTURED_PROCESS", label: "Other defined process" },
];

function SiteAndPshaBasisEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const referenceSiteName = mef.metadata.plantIdentity?.siteName?.trim() || "Not defined in Step 01";
  const [draft, setDraft] = useState<Pick<HazardAnalysisBasis, "site" | "structuredProcess" | "calculationBounds">>(() => ({
    site: { ...mef.seismicHazardAnalysis.analysisBasis.site },
    structuredProcess: { ...mef.seismicHazardAnalysis.analysisBasis.structuredProcess },
    calculationBounds: { ...mef.seismicHazardAnalysis.analysisBasis.calculationBounds },
  }));
  const process = draft.structuredProcess;

  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.analysisBasis.site = draft.site;
      next.seismicHazardAnalysis.analysisBasis.structuredProcess = draft.structuredProcess;
      next.seismicHazardAnalysis.analysisBasis.calculationBounds = draft.calculationBounds;
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title="PSHA basis" subtitle="Use this editor to define the structured hazard process and the numerical range over which the site hazard will be calculated." plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor sbasis-editor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Site basis</h3>
        <FieldGrid>
          <Field label="Reference site" hint="Managed in Step 01.">
            <TextInput value={referenceSiteName} disabled onChange={() => undefined} />
          </Field>
          <Field label="Site basis">
            <SelectInput value={draft.site.siteBasis} options={SITE_BASIS_OPTIONS} onChange={(value) => setDraft((current) => ({
              ...current,
              site: { ...current.site, siteBasis: value as SeismicSiteBasis },
            }))} />
          </Field>
        </FieldGrid>
        {draft.site.siteBasis === "BOUNDING_SITE" && <>
          <Field label="Sites covered by the bounding basis">
            <TextArea rows={3} value={draft.site.applicableSiteRange ?? ""} onChange={(value) => setDraft((current) => ({
              ...current,
              site: { ...current.site, applicableSiteRange: value },
            }))} />
          </Field>
          <Field label="Bounding-site justification">
            <TextArea rows={4} value={draft.site.selectionAndApplicabilityBasis} onChange={(value) => setDraft((current) => ({
              ...current,
              site: { ...current.site, selectionAndApplicabilityBasis: value },
            }))} />
          </Field>
          <label className="sbasis-editor__check">
            <input type="checkbox" checked={draft.site.boundsAllSitesInScope} onChange={(event) => setDraft((current) => ({
              ...current,
              site: { ...current.site, boundsAllSitesInScope: event.target.checked },
            }))} />
            <span>Bounding site covers the full PRA scope</span>
          </label>
        </>}
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">PSHA process</h3>
        <Field label="Defined process">
          <SelectInput value={process.processType} options={PSHA_PROCESS_OPTIONS} onChange={(value) => setDraft((current) => ({
            ...current,
            structuredProcess: { ...current.structuredProcess, processType: value as StructuredHazardProcessType },
          }))} />
        </Field>
        {process.processType === "OTHER_STRUCTURED_PROCESS" && <Field label="Other defined process">
          <TextArea rows={3} value={process.alternateProcessDescription ?? ""} onChange={(value) => setDraft((current) => ({
            ...current,
            structuredProcess: { ...current.structuredProcess, alternateProcessDescription: value },
          }))} />
        </Field>}
        <Field label="Study objective and intended application">
          <TextArea rows={3} value={process.studyObjective} onChange={(value) => setDraft((current) => ({
            ...current,
            structuredProcess: { ...current.structuredProcess, studyObjective: value },
          }))} />
        </Field>
        <Field label="Why this process level is appropriate">
          <TextArea rows={3} value={process.processLevelBasis} onChange={(value) => setDraft((current) => ({
            ...current,
            structuredProcess: { ...current.structuredProcess, processLevelBasis: value },
          }))} />
        </Field>
        <Field label="Technical integration approach">
          <TextArea rows={3} value={process.technicalIntegrationApproach} onChange={(value) => setDraft((current) => ({
            ...current,
            structuredProcess: { ...current.structuredProcess, technicalIntegrationApproach: value },
          }))} />
        </Field>
        <Field label="How center, body, and range are represented">
          <TextArea rows={4} value={process.centerBodyRangeDemonstration} onChange={(value) => setDraft((current) => ({
            ...current,
            structuredProcess: { ...current.structuredProcess, centerBodyRangeDemonstration: value },
          }))} />
        </Field>
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Calculation limits</h3>
        <FieldGrid>
          <Field label="Maximum ground motion">
            <NumberInput value={draft.calculationBounds.maximumGroundMotion} onChange={(value) => setDraft((current) => ({
              ...current,
              calculationBounds: { ...current.calculationBounds, maximumGroundMotion: value },
            }))} />
          </Field>
          <Field label="Ground-motion units">
            <TextInput value={draft.calculationBounds.groundMotionUnits} onChange={(value) => setDraft((current) => ({
              ...current,
              calculationBounds: { ...current.calculationBounds, groundMotionUnits: value },
            }))} />
          </Field>
          <Field label="Minimum magnitude">
            <NumberInput value={draft.calculationBounds.lowerBoundMagnitude} onChange={(value) => setDraft((current) => ({
              ...current,
              calculationBounds: { ...current.calculationBounds, lowerBoundMagnitude: value },
            }))} />
          </Field>
          <Field label="Magnitude scale">
            <TextInput value={draft.calculationBounds.magnitudeScale} onChange={(value) => setDraft((current) => ({
              ...current,
              calculationBounds: { ...current.calculationBounds, magnitudeScale: value },
            }))} />
          </Field>
          <Field label="Epsilon limit">
            <NumberInput value={draft.calculationBounds.epsilonLimit} onChange={(value) => setDraft((current) => ({
              ...current,
              calculationBounds: { ...current.calculationBounds, epsilonLimit: value },
            }))} />
          </Field>
        </FieldGrid>
        <Field label="Minimum-magnitude basis">
          <TextArea rows={3} value={draft.calculationBounds.lowerBoundMagnitudeBasis} onChange={(value) => setDraft((current) => ({
            ...current,
            calculationBounds: { ...current.calculationBounds, lowerBoundMagnitudeBasis: value },
          }))} />
        </Field>
        <Field label="High-motion tail">
          <TextArea rows={3} value={draft.calculationBounds.tailExtrapolationMethod} onChange={(value) => setDraft((current) => ({
            ...current,
            calculationBounds: { ...current.calculationBounds, tailExtrapolationMethod: value },
          }))} />
        </Field>
        <Field label="Truncation check">
          <TextArea rows={3} value={draft.calculationBounds.truncationImpactEvaluation} onChange={(value) => setDraft((current) => ({
            ...current,
            calculationBounds: { ...current.calculationBounds, truncationImpactEvaluation: value },
          }))} />
        </Field>
        <Field label="Epsilon-tail treatment">
          <TextArea rows={3} value={draft.calculationBounds.epsilonTailTreatment} onChange={(value) => setDraft((current) => ({
            ...current,
            calculationBounds: { ...current.calculationBounds, epsilonTailTreatment: value },
          }))} />
        </Field>
        <Field label="Epsilon-limit basis">
          <TextArea rows={3} value={draft.calculationBounds.epsilonLimitBasis} onChange={(value) => setDraft((current) => ({
            ...current,
            calculationBounds: { ...current.calculationBounds, epsilonLimitBasis: value },
          }))} />
        </Field>
        <label className="sbasis-editor__check">
          <input type="checkbox" checked={draft.calculationBounds.sequenceRankingUnaffected} onChange={(event) => setDraft((current) => ({
            ...current,
            calculationBounds: { ...current.calculationBounds, sequenceRankingUnaffected: event.target.checked },
          }))} />
          <span>Sequence ranking is unchanged by the calculation limits</span>
        </label>
      </div>
    </fieldset>
  </Drawer>;
}

type EarthquakeCatalog =
  SeismicPRA["seismicHazardAnalysis"]["earthScienceInputs"]["earthquakeCatalog"];

function EarthquakeCatalogEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const catalog = mef.seismicHazardAnalysis.earthScienceInputs.earthquakeCatalog;
  const [draft, setDraft] = useState<EarthquakeCatalog>(() => ({
    ...catalog,
    magnitudeScales: [...catalog.magnitudeScales],
    sourceReferences: [...catalog.sourceReferences],
    events: [...catalog.events],
    implementsSrs: [...catalog.implementsSrs],
  }));

  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.earthScienceInputs.earthquakeCatalog = draft;
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Earthquake catalog" subtitle="Use this editor to record the catalog time span and the methods used to make earthquake locations and magnitudes consistent before source recurrence is calculated." plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save catalog</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Catalog coverage</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Start date or age"><TextInput value={draft.catalogStartDateOrAge} onChange={(value) => setDraft((current) => ({ ...current, catalogStartDateOrAge: value }))} /></Field>
          <Field label="End date"><TextInput value={draft.catalogEndDate} onChange={(value) => setDraft((current) => ({ ...current, catalogEndDate: value }))} /></Field>
        </FieldGrid>
        <Field label="Magnitude scales" hint="Separate values with commas."><TextInput value={draft.magnitudeScales.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, magnitudeScales: technicalList(value) }))} /></Field>
        <Field label="Source references" hint="Separate references with commas."><TextArea rows={3} value={draft.sourceReferences.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, sourceReferences: technicalList(value) }))} /></Field>
        <Field label="Imported event records"><NumberInput value={draft.events.length} disabled onChange={() => undefined} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Catalog processing</h3>
        <Field label="Magnitude homogenization"><TextArea rows={3} value={draft.homogenizationMethod} onChange={(value) => setDraft((current) => ({ ...current, homogenizationMethod: value }))} /></Field>
        <Field label="Declustering"><TextArea rows={3} value={draft.declusteringMethod ?? ""} onChange={(value) => setDraft((current) => ({ ...current, declusteringMethod: value || undefined }))} /></Field>
        <Field label="Completeness"><TextArea rows={4} value={draft.completenessAssessment} onChange={(value) => setDraft((current) => ({ ...current, completenessAssessment: value }))} /></Field>
        <Field label="Location and magnitude uncertainty"><TextArea rows={3} value={draft.locationAndMagnitudeUncertaintyTreatment} onChange={(value) => setDraft((current) => ({ ...current, locationAndMagnitudeUncertaintyTreatment: value }))} /></Field>
        <Field label="Duplicate-event resolution"><TextArea rows={3} value={draft.duplicateResolutionMethod} onChange={(value) => setDraft((current) => ({ ...current, duplicateResolutionMethod: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

const DOWNSTREAM_EVIDENCE_IDS = new Set([
  "EVIDENCE-SHA-REPORT",
  "EVIDENCE-SFR-CALCS",
  "EVIDENCE-SEL",
  "EVIDENCE-PEER-REVIEW-2026",
]);

function EvidenceBaseScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const [evidenceEditor, setEvidenceEditor] = useState<CollectionEditorTarget | null>(null);
  const evidenceDocumentById = useMemo(
    () => new Map((mef.exampleDocuments ?? []).map((document) => [document.id, document])),
    [mef.exampleDocuments],
  );
  const evidenceGuide = evidenceDocumentById.get("DOC-HTGR-EVIDENCE-GUIDE");
  const evidenceFields = [
    "name",
    "evidenceType",
    "sourceReference",
    "revision",
    "effectiveDate",
    "owner",
    "applicableSubelements",
    "applicability",
    "qualityAndLimitations",
    "fileReference",
    "supersedesEvidenceRef",
    "status",
  ];
  const sourceEvidence = mef.evidenceRegister
    .map((evidence, index) => ({ evidence, index }))
    .filter(({ evidence }) => !DOWNSTREAM_EVIDENCE_IDS.has(evidence.uuid));
  const gapPattern = /\b(pending|not yet|not available|incomplete|unavailable|requires confirmation|pre-operational confirmation|does not (?:provide|establish)|is not a site-specific)\b/i;
  const openGaps = sourceEvidence.filter(({ evidence }) =>
    evidence.status === "DRAFT" || gapPattern.test(evidence.qualityAndLimitations));

  return <>
    <Section title="Source evidence" description="Use this section to register the existing records that the Seismic PRA will rely on before its calculations begin. Record where each item came from, its revision, owner, applicable subanalyses, and qualification status. Results created later in this workbook do not belong here." tone="integration" actions={evidenceGuide?.url !== undefined || editable
      ? <>
        {evidenceGuide?.url !== undefined && <a className="posnav__btn posnav__btn--sm" href={evidenceGuide.url} target="_blank" rel="noopener noreferrer">Evidence guide</a>}
        {editable && <AddButton label="Add source evidence" onClick={() => setEvidenceEditor({
          title: "New source evidence",
          subtitle: "Record an existing model, drawing, calculation, data set, procedure, review, or configuration record used as an analysis input",
          focus: [],
          createAt: ["evidenceRegister"],
          visibleRootFields: evidenceFields,
          inlinePrimitiveArrays: true,
        })} />}
      </>
      : undefined}>
      {sourceEvidence.length === 0
        ? <EmptyState title="No source evidence" detail="Register the existing technical records needed before Seismic PRA calculations begin." />
        : <Table headers={["Evidence", "Type", "Source and revision", "Applies to", "Status"]} minWidth={0} columnWidths={["28%", "12%", "30%", "14%", "16%"]} className="stable--wrapheads stable--technical">
          {sourceEvidence.map(({ evidence, index }) => {
            const document = evidenceDocumentById.get(evidence.uuid);
            return <tr className="postable__row--clickable" key={evidence.uuid} onClick={() => setEvidenceEditor({
              title: evidence.name,
              subtitle: "Source, revision, ownership, applicability, qualification, and limitations",
              focus: ["evidenceRegister", index],
              visibleRootFields: evidenceFields,
              inlinePrimitiveArrays: true,
              removeLabel: "Remove source evidence",
            })}>
              <td className="stable__key"><strong>{evidence.name}</strong><code>{evidence.owner}</code></td>
              <td><Tag tone="neutral">{displayLabel(evidence.evidenceType)}</Tag></td>
              <td>
                <div className="sevidence__source">
                  <span>{evidence.sourceReference}</span>
                  {document?.url !== undefined && <a
                    className="posnav__btn posnav__btn--sm sevidence__view"
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View evidence"
                    title="View evidence"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <POSIcon.Eye />
                  </a>}
                </div>
                <code>{evidence.revision === undefined ? "Revision not recorded" : `Revision ${evidence.revision}`}</code>
              </td>
              <td>{evidence.applicableSubelements.join(" · ")}</td>
              <td><Tag tone={evidence.status === "CONTROLLED" ? "good" : evidence.status === "DRAFT" ? "warn" : "neutral"}>{displayLabel(evidence.status)}</Tag>{evidence.effectiveDate !== undefined && <code>{evidence.effectiveDate}</code>}</td>
            </tr>;
          })}
        </Table>}
    </Section>

    <Section title="Open evidence gaps" description="Use this section to see which source records are provisional, incomplete, or still need confirmation. Resolve these gaps before relying on the affected information in a final risk result." tone="integration">
      {openGaps.length === 0
        ? <EmptyState title="No open evidence gaps" detail="Every registered source record is controlled and has no identified confirmation item." />
        : <Table headers={["Evidence gap", "Affected analysis", "Responsible group"]} minWidth={0} columnWidths={["28%", "52%", "20%"]} className="stable--wrapheads stable--technical">
          {openGaps.map(({ evidence, index }) => <tr className="postable__row--clickable" key={evidence.uuid} onClick={() => setEvidenceEditor({
            title: evidence.name,
            subtitle: "Source, revision, ownership, applicability, qualification, and limitations",
            focus: ["evidenceRegister", index],
            visibleRootFields: evidenceFields,
            inlinePrimitiveArrays: true,
            removeLabel: "Remove source evidence",
          })}>
            <td className="stable__key"><strong>{evidence.name}</strong><code>{evidence.status === "DRAFT" ? "Draft evidence" : "Confirmation required"}</code></td>
            <td>{evidence.qualityAndLimitations}</td>
            <td>{evidence.owner}</td>
          </tr>)}
        </Table>}
    </Section>

    <CollectionEditor tone="integration" target={evidenceEditor} onClose={() => setEvidenceEditor(null)} />
  </>;
}

type BaselinePraDefinition = NonNullable<SeismicPRA["baselinePra"]>;
type BaselinePraRecordTreatment = BaselinePraDefinition["recordTreatments"][number];
type BaselinePraTechnicalArea = BaselinePraRecordTreatment["technicalArea"];

const BASELINE_TECHNICAL_AREA_OPTIONS: { value: BaselinePraTechnicalArea; label: string }[] = [
  { value: "PLANT_OPERATING_STATES", label: "Plant operating states" },
  { value: "INITIATING_EVENTS", label: "Initiating events" },
  { value: "EVENT_SEQUENCES", label: "Event sequences" },
  { value: "SUCCESS_CRITERIA", label: "Success criteria" },
  { value: "SYSTEMS", label: "Systems" },
  { value: "DATA", label: "Data" },
  { value: "HUMAN_RELIABILITY", label: "Human reliability" },
  { value: "INTERNAL_FIRE", label: "Internal fire" },
  { value: "INTERNAL_FLOOD", label: "Internal flood" },
  { value: "EXTERNAL_HAZARDS", label: "External hazards" },
  { value: "RISK_INTEGRATION", label: "Risk integration" },
  { value: "SEISMIC_LOGIC", label: "New seismic logic" },
];

function defaultBaselinePra(mef: SeismicPRA): BaselinePraDefinition {
  const source = mef.evidenceRegister.find((evidence) => evidence.evidenceType === "MODEL");
  return {
    modelName: source?.name ?? "",
    modelReference: source?.sourceReference ?? "",
    sourceEvidenceRef: source?.uuid ?? "",
    revision: source?.revision ?? "",
    freezeDate: source?.effectiveDate ?? "",
    freezeStatus: "WORKING",
    modelBoundary: "",
    nonSeismicHazardModelRefs: [],
    recordTreatments: [],
    unresolvedInterfaces: [],
  };
}

function newBaselineTreatment(): BaselinePraRecordTreatment {
  return {
    uuid: crypto.randomUUID(),
    name: "Baseline PRA treatment",
    technicalArea: "SYSTEMS",
    sourceRecordRefs: [],
    treatment: "MODIFIED",
    seismicChange: "",
    owner: "",
    status: "OPEN",
  };
}

function BaselinePraEditor({ baseline, evidenceOptions, onSave, onClose }: {
  baseline: BaselinePraDefinition;
  evidenceOptions: { value: string; label: string }[];
  onSave: (value: BaselinePraDefinition) => void;
  onClose: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState(() => ({
    ...baseline,
    nonSeismicHazardModelRefs: [...baseline.nonSeismicHazardModelRefs],
    recordTreatments: baseline.recordTreatments.map((record) => ({
      ...record,
      sourceRecordRefs: [...record.sourceRecordRefs],
    })),
    unresolvedInterfaces: [...baseline.unresolvedInterfaces],
  }));
  return <Drawer
    eyebrow={EDITOR_LABELS.integration}
    title="Baseline PRA version"
    subtitle="Record the exact PRA model configuration used as the starting point. A reference-only report cannot substitute for an executable, reproducible model."
    plainHeader
    onClose={onClose}
    footer={<><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button><button type="button" className="posnav__btn posnav__btn--primary" onClick={() => { onSave(draft); onClose(); }}>Save baseline</button></>}
  >
    <FieldGrid>
      <Field label="Model name"><TextInput value={draft.modelName} onChange={(value) => setDraft((current) => ({ ...current, modelName: value }))} /></Field>
      <Field label="Model reference"><TextInput value={draft.modelReference} onChange={(value) => setDraft((current) => ({ ...current, modelReference: value }))} /></Field>
      <Field label="Source evidence"><SelectInput value={draft.sourceEvidenceRef} options={evidenceOptions} onChange={(value) => setDraft((current) => ({ ...current, sourceEvidenceRef: value }))} /></Field>
      <Field label="Revision"><TextInput value={draft.revision} onChange={(value) => setDraft((current) => ({ ...current, revision: value }))} /></Field>
      <Field label="Freeze date"><TextInput value={draft.freezeDate} placeholder="YYYY-MM-DD" onChange={(value) => setDraft((current) => ({ ...current, freezeDate: value }))} /></Field>
      <Field label="Configuration status"><SelectInput value={draft.freezeStatus} options={[
        { value: "WORKING", label: "Working" },
        { value: "FROZEN", label: "Frozen" },
        { value: "REFERENCE_ONLY", label: "Reference only" },
      ]} onChange={(value) => setDraft((current) => ({ ...current, freezeStatus: value as BaselinePraDefinition["freezeStatus"] }))} /></Field>
      <Field label="Fire, flood, external-hazard, and risk-integration model references" wide><TextArea rows={4} value={draft.nonSeismicHazardModelRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, nonSeismicHazardModelRefs: technicalList(value) }))} /></Field>
      <Field label="Open inputs" wide><TextArea rows={4} value={draft.unresolvedInterfaces.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, unresolvedInterfaces: technicalList(value) }))} /></Field>
    </FieldGrid>
  </Drawer>;
}

function BaselineTreatmentEditor({ treatment, isNew, onSave, onRemove, onClose }: {
  treatment: BaselinePraRecordTreatment;
  isNew: boolean;
  onSave: (value: BaselinePraRecordTreatment) => void;
  onRemove: () => void;
  onClose: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState(() => ({
    ...treatment,
    sourceRecordRefs: [...treatment.sourceRecordRefs],
  }));
  return <Drawer
    eyebrow={EDITOR_LABELS.integration}
    title={isNew ? "New seismic change" : treatment.name}
    subtitle="Classify one baseline PRA area as reused, modified, newly required, or not applicable, and state the seismic change in one technical line."
    plainHeader
    onClose={onClose}
    footer={<>{!isNew && <button type="button" className="posnav__btn" onClick={() => { onRemove(); onClose(); }}>Remove</button>}<span className="sdrawer__footer-spacer" /><button type="button" className="posnav__btn" onClick={onClose}>Cancel</button><button type="button" className="posnav__btn posnav__btn--primary" onClick={() => { onSave(draft); onClose(); }}>Save change</button></>}
  >
    <FieldGrid>
      <Field label="Baseline area"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
      <Field label="Technical element"><SelectInput value={draft.technicalArea} options={BASELINE_TECHNICAL_AREA_OPTIONS} onChange={(value) => setDraft((current) => ({ ...current, technicalArea: value as BaselinePraTechnicalArea }))} /></Field>
      <Field label="Treatment"><SelectInput value={draft.treatment} options={[
        { value: "REUSED", label: "Reused" },
        { value: "MODIFIED", label: "Modified" },
        { value: "NEW", label: "New" },
        { value: "NOT_APPLICABLE", label: "Not applicable" },
      ]} onChange={(value) => setDraft((current) => ({ ...current, treatment: value as BaselinePraRecordTreatment["treatment"] }))} /></Field>
      <Field label="Status"><SelectInput value={draft.status} options={[
        { value: "CONFIRMED", label: "Confirmed" },
        { value: "OPEN", label: "Open" },
      ]} onChange={(value) => setDraft((current) => ({ ...current, status: value as BaselinePraRecordTreatment["status"] }))} /></Field>
      <Field label="Owner"><TextInput value={draft.owner} onChange={(value) => setDraft((current) => ({ ...current, owner: value }))} /></Field>
      <Field label="Source record references"><TextArea rows={3} value={draft.sourceRecordRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, sourceRecordRefs: technicalList(value) }))} /></Field>
      <Field label="Seismic change" wide><TextArea rows={4} value={draft.seismicChange} onChange={(value) => setDraft((current) => ({ ...current, seismicChange: value }))} /></Field>
    </FieldGrid>
  </Drawer>;
}

function baselineInventory(
  linkedInputs: ReturnType<typeof useSeismicPraWorkbook>["linkedInputs"],
  baseline: BaselinePraDefinition,
): { name: string; count: number; examples: string[] }[] {
  if (linkedInputs === null) return [];
  return [
    { name: "Plant operating states", count: linkedInputs.posStates.length, examples: linkedInputs.posStates.map((record) => record.name) },
    { name: "Initiating-event groups", count: linkedInputs.ieGroups.length, examples: linkedInputs.ieGroups.map((record) => record.name) },
    { name: "Event-sequence families", count: linkedInputs.esFamilies.length, examples: linkedInputs.esFamilies.map((record) => record.name) },
    { name: "Success criteria and mission times", count: linkedInputs.scMissionTimes.length, examples: linkedInputs.scMissionTimes.map((record) => record.eventSequence) },
    { name: "Systems", count: linkedInputs.sySystems.length, examples: linkedInputs.sySystems.map((record) => record.name) },
    { name: "Human failure events", count: linkedInputs.hrActions.length, examples: linkedInputs.hrActions.map((record) => record.name) },
    { name: "Data parameters", count: linkedInputs.daParameters.length, examples: linkedInputs.daParameters.map((record) => record.name) },
    { name: "Other hazard and integration models", count: baseline.nonSeismicHazardModelRefs.length, examples: baseline.nonSeismicHazardModelRefs },
  ];
}

function BaselinePraScreen(): JSX.Element {
  const { linkedInputs } = useSeismicPraWorkbook();
  const { mef, editable, update } = useUpdate();
  const variant = linkedInputs?.variant ?? seismicPraVariant(mef);
  const hasConfiguredBaseline = mef.baselinePra !== undefined
    && (
      mef.baselinePra.modelName.trim().length > 0
      || mef.baselinePra.modelReference.trim().length > 0
      || mef.baselinePra.recordTreatments.length > 0
      || mef.baselinePra.modelBoundary.trim().length > 0
    );
  const baseline = hasConfiguredBaseline
    ? mef.baselinePra!
    : variant === null
      ? defaultBaselinePra(mef)
      : exampleBaselinePra(variant, mef.evidenceRegister);
  const [baselineEditorOpen, setBaselineEditorOpen] = useState(false);
  const [treatmentEditor, setTreatmentEditor] = useState<number | "new" | null>(null);
  const sourceEvidence = mef.evidenceRegister.find((evidence) => evidence.uuid === baseline.sourceEvidenceRef);
  const inventory = baselineInventory(linkedInputs, baseline);
  const evidenceOptions = [
    { value: "", label: "No source evidence selected" },
    ...mef.evidenceRegister
      .filter((evidence) => evidence.evidenceType === "MODEL")
      .map((evidence) => ({ value: evidence.uuid, label: `${evidence.name} · ${evidence.sourceReference}` })),
  ];
  const selectedTreatment = treatmentEditor === null
    ? null
    : treatmentEditor === "new"
      ? newBaselineTreatment()
      : baseline.recordTreatments[treatmentEditor] ?? null;

  function saveBaseline(value: BaselinePraDefinition): void {
    update((draft) => {
      draft.baselinePra = value;
      draft.seismicPlantResponseAnalysis.plantResponseModel.baseInternalEventsModelRefs = value.modelReference.trim().length > 0 ? [value.modelReference] : [];
      draft.seismicPlantResponseAnalysis.plantResponseModel.baseNonSeismicHazardModelRefs = value.nonSeismicHazardModelRefs;
    });
  }

  function saveTreatment(value: BaselinePraRecordTreatment): void {
    update((draft) => {
      const current = draft.baselinePra ?? baseline;
      const records = [...current.recordTreatments];
      if (treatmentEditor === "new") records.push(value);
      else if (typeof treatmentEditor === "number") records[treatmentEditor] = value;
      draft.baselinePra = { ...current, recordTreatments: records };
    });
  }

  function removeTreatment(): void {
    if (typeof treatmentEditor !== "number") return;
    update((draft) => {
      const current = draft.baselinePra ?? baseline;
      draft.baselinePra = { ...current, recordTreatments: current.recordTreatments.filter((_, index) => index !== treatmentEditor) };
    });
  }

  return <>
    <Section title="Baseline PRA version" description="This is the exact PRA model used as the starting point. Freezing its version prevents later model changes from silently changing the Seismic PRA. A report marked reference only helps define the model, but an executable model and reproducible run package are still needed." tone="integration" actions={editable ? <EditButton label="Edit baseline version" onClick={() => setBaselineEditorOpen(true)} /> : undefined}>
      <Table headers={["Model", "Source evidence", "Revision", "Freeze date", "Status"]} minWidth={0} columnWidths={["27%", "31%", "12%", "15%", "15%"]} className="stable--wrapheads stable--technical">
        <tr>
          <td className="stable__key"><strong>{baseline.modelName || "Baseline model not named"}</strong><code>{baseline.modelReference || "Reference not recorded"}</code></td>
          <td>{sourceEvidence?.name ?? "Not linked"}{sourceEvidence !== undefined && <code>{sourceEvidence.sourceReference}</code>}</td>
          <td>{baseline.revision || "—"}</td>
          <td>{baseline.freezeDate || "—"}</td>
          <td><Tag tone={baseline.freezeStatus === "FROZEN" ? "good" : "warn"}>{displayLabel(baseline.freezeStatus)}</Tag></td>
        </tr>
      </Table>
    </Section>

    <Section title="Imported baseline scope" description="These rows come directly from the linked POS, IE, ES, SC, SY, HR, and DA examples. They show what exists in the starting PRA before any seismic changes are made." tone="integration">
      {inventory.length === 0
        ? <EmptyState title="Baseline inputs unavailable" detail="Load a matching HTGR or SFR example to inspect the upstream PRA records." showMark={false} />
        : <Table headers={["Baseline content", "Records", "Examples"]} minWidth={0} columnWidths={["28%", "12%", "60%"]} className="stable--wrapheads stable--technical">
          {inventory.map((item) => <tr key={item.name}>
            <td className="stable__key"><strong>{item.name}</strong></td>
            <td>{item.count}</td>
            <td>{item.examples.slice(0, 3).join(" · ") || "No records"}{item.examples.length > 3 && <code>+{item.examples.length - 3} more</code>}</td>
          </tr>)}
        </Table>}
    </Section>

    <Section title="Seismic changes" description="Each row states whether a part of the baseline PRA is reused, modified, or newly required. The one-line change tells later analysts exactly what must be done without pretending that the later seismic analysis is already complete." tone="integration" actions={editable ? <AddButton label="Add seismic change" onClick={() => setTreatmentEditor("new")} /> : undefined}>
      {baseline.recordTreatments.length === 0
        ? <EmptyState title="No seismic changes classified" detail="Classify the baseline PRA areas that will be reused, modified, or newly developed." />
        : <Table headers={["Baseline area", "Treatment", "Seismic change", "Owner", "Status"]} minWidth={0} columnWidths={["20%", "12%", "42%", "14%", "12%"]} className="stable--wrapheads stable--technical">
          {baseline.recordTreatments.map((record, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={record.uuid} onClick={editable ? () => setTreatmentEditor(index) : undefined}>
            <td className="stable__key"><strong>{record.name}</strong><code>{displayLabel(record.technicalArea)}</code></td>
            <td><Tag tone={record.treatment === "REUSED" ? "good" : record.treatment === "NEW" ? "sha" : record.treatment === "MODIFIED" ? "warn" : "neutral"}>{displayLabel(record.treatment)}</Tag></td>
            <td>{record.seismicChange || "Change not defined"}</td>
            <td>{record.owner || "Unassigned"}</td>
            <td><Tag tone={record.status === "CONFIRMED" ? "good" : "warn"}>{displayLabel(record.status)}</Tag></td>
          </tr>)}
        </Table>}
    </Section>

    {baseline.unresolvedInterfaces.length > 0 && <Section title="Open inputs" description="These are model packages or technical-element handoffs that are still required before the affected Seismic PRA work can be finalized." tone="integration" actions={editable ? <EditButton label="Edit open inputs" onClick={() => setBaselineEditorOpen(true)} /> : undefined}>
      <Table headers={["Required input", "Status"]} minWidth={0} columnWidths={["84%", "16%"]} className="stable--wrapheads stable--technical">
        {baseline.unresolvedInterfaces.map((item) => <tr key={item}><td className="stable__key"><strong>{item}</strong></td><td><Tag tone="warn">Open</Tag></td></tr>)}
      </Table>
    </Section>}

    {baselineEditorOpen && <BaselinePraEditor baseline={baseline} evidenceOptions={evidenceOptions} onSave={saveBaseline} onClose={() => setBaselineEditorOpen(false)} />}
    {selectedTreatment !== null && <BaselineTreatmentEditor treatment={selectedTreatment} isNew={treatmentEditor === "new"} onSave={saveTreatment} onRemove={removeTreatment} onClose={() => setTreatmentEditor(null)} />}
  </>;
}

type EarthScienceInputs = SeismicPRA["seismicHazardAnalysis"]["earthScienceInputs"];
type SeismicStudyRegion = EarthScienceInputs["studyRegions"][number];

function newStudyRegion(): SeismicStudyRegion {
  return {
    uuid: crypto.randomUUID(),
    name: "Regional seismic study area",
    boundaryDescription: "",
    tectonicSetting: "",
    includedSourceRegions: [],
    majorContributorCoverageBasis: "",
    regionalPropagationDataSufficiency: "",
    localSiteEffectsDataSufficiency: "",
    uncertaintyCoverageBasis: "",
    implementsSrs: [{ sr: "SHA-B2", hlr: "B" }, { sr: "SHA-B3", hlr: "B" }],
  };
}

function EarthScienceCoverageEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const inputs = mef.seismicHazardAnalysis.earthScienceInputs;
  const [draft, setDraft] = useState(() => ({
    compilationCutoffDate: inputs.compilationCutoffDate,
    dataGapAssessment: inputs.dataGapAssessment,
    subjectMatterExpertReview: inputs.subjectMatterExpertReview,
    studyRegion: structuredClone(inputs.studyRegions[0] ?? newStudyRegion()),
  }));

  function save(): void {
    update((next) => {
      const nextInputs = next.seismicHazardAnalysis.earthScienceInputs;
      nextInputs.compilationCutoffDate = draft.compilationCutoffDate;
      nextInputs.dataGapAssessment = draft.dataGapAssessment;
      nextInputs.subjectMatterExpertReview = draft.subjectMatterExpertReview;
      nextInputs.studyRegions = [draft.studyRegion, ...nextInputs.studyRegions.slice(1)];
    });
    onClose();
  }

  function updateRegion(change: Partial<SeismicStudyRegion>): void {
    setDraft((current) => ({ ...current, studyRegion: { ...current.studyRegion, ...change } }));
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Coverage" subtitle="Study extent and data sufficiency" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Study region</h3>
        <FieldGrid>
          <Field label="Region name">
            <TextInput value={draft.studyRegion.name} onChange={(value) => updateRegion({ name: value })} />
          </Field>
          <Field label="Radial extent (km)">
            <NumberInput value={draft.studyRegion.radialExtentKm ?? 0} onChange={(value) => updateRegion({ radialExtentKm: value })} />
          </Field>
          <Field label="Compilation cutoff">
            <TextInput value={draft.compilationCutoffDate} onChange={(value) => setDraft((current) => ({ ...current, compilationCutoffDate: value }))} />
          </Field>
        </FieldGrid>
        <Field label="Boundary">
          <TextArea rows={3} value={draft.studyRegion.boundaryDescription} onChange={(value) => updateRegion({ boundaryDescription: value })} />
        </Field>
        <Field label="Tectonic setting">
          <TextArea rows={3} value={draft.studyRegion.tectonicSetting} onChange={(value) => updateRegion({ tectonicSetting: value })} />
        </Field>
        <Field label="Credible contributor coverage">
          <TextArea rows={3} value={draft.studyRegion.majorContributorCoverageBasis} onChange={(value) => updateRegion({ majorContributorCoverageBasis: value })} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Data sufficiency</h3>
        <Field label="Regional propagation">
          <TextArea rows={3} value={draft.studyRegion.regionalPropagationDataSufficiency} onChange={(value) => updateRegion({ regionalPropagationDataSufficiency: value })} />
        </Field>
        <Field label="Local site effects">
          <TextArea rows={3} value={draft.studyRegion.localSiteEffectsDataSufficiency} onChange={(value) => updateRegion({ localSiteEffectsDataSufficiency: value })} />
        </Field>
        <Field label="Uncertainty coverage">
          <TextArea rows={3} value={draft.studyRegion.uncertaintyCoverageBasis} onChange={(value) => updateRegion({ uncertaintyCoverageBasis: value })} />
        </Field>
        <Field label="Data-gap assessment">
          <TextArea rows={3} value={draft.dataGapAssessment} onChange={(value) => setDraft((current) => ({ ...current, dataGapAssessment: value }))} />
        </Field>
        <Field label="Technical review">
          <TextArea rows={3} value={draft.subjectMatterExpertReview} onChange={(value) => setDraft((current) => ({ ...current, subjectMatterExpertReview: value }))} />
        </Field>
      </div>
    </fieldset>
  </Drawer>;
}

function EarthScienceScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const inputs = mef.seismicHazardAnalysis.earthScienceInputs;
  const studyRegion = inputs.studyRegions[0];
  const catalog = inputs.earthquakeCatalog;
  const dataFields = [
    "name", "discipline", "sourceOrganization", "sourceReference",
    "publicationOrAcquisitionDate", "dataCutoffDate", "spatialCoverage",
    "temporalCoverage", "resolution", "format", "qualityAndLimitations",
    "currentnessAssessment", "fileReference",
  ];
  const modelFields = [
    "name", "modelKind", "version", "publicationDate", "sourceReference",
    "applicability", "knownToExistingAnalysis", "previouslyUsed",
    "potentialImpactOnHazard", "disposition", "dispositionBasis",
  ];
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [dataEditor, setDataEditor] = useState<CollectionEditorTarget | null>(null);
  const [modelEditor, setModelEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section title="Coverage" description="Study extent and data sufficiency." tone="sha" actions={<EditButton label="Edit coverage" onClick={() => setCoverageOpen(true)} />}>
      <div className="sreadouts">
        <Readout label="Study region" value={studyRegion?.name ?? "Not defined"} />
        <Readout label="Radial extent" value={studyRegion?.radialExtentKm === undefined ? "Not defined" : `${studyRegion.radialExtentKm} km`} />
        <Readout label="Compilation cutoff" value={inputs.compilationCutoffDate || "Not defined"} />
        <Readout label="Catalog period" value={`${catalog.catalogStartDateOrAge} through ${catalog.catalogEndDate}`} />
      </div>
    </Section>

    <Section title="Earth-science data" description="Current technical inputs used by the hazard analysis." tone="sha" actions={editable ? <AddButton label="Add data set" onClick={() => setDataEditor({ title: "New earth-science data set", subtitle: "Source, coverage, quality, and currentness", focus: [], createAt: ["seismicHazardAnalysis", "earthScienceInputs", "dataSets"], visibleRootFields: dataFields })} /> : undefined}>
      {inputs.dataSets.length === 0 ? <EmptyState title="No data sets" detail="No earth-science evidence has been registered." /> : <Table headers={["Data set", "Discipline", "Coverage", "Quality or limitation"]} minWidth={820}>
        {inputs.dataSets.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setDataEditor({ title: item.name, subtitle: displayLabel(item.discipline), focus: ["seismicHazardAnalysis", "earthScienceInputs", "dataSets", index], visibleRootFields: dataFields, removeLabel: "Remove data set" })}><td className="stable__key"><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td><Tag tone="sha">{displayLabel(item.discipline)}</Tag></td><td>{item.spatialCoverage}</td><td>{item.qualityAndLimitations}</td></tr>)}
      </Table>}
    </Section>

    <Section title="Models and methods" description="Sources assessed for potential hazard impact." tone="sha" actions={editable ? <AddButton label="Add source" onClick={() => setModelEditor({ title: "New model or method", subtitle: "Applicability, potential impact, and disposition", focus: [], createAt: ["seismicHazardAnalysis", "earthScienceInputs", "modelAndMethodInventory"], visibleRootFields: modelFields })} /> : undefined}>
      {inputs.modelAndMethodInventory.length === 0 ? <EmptyState title="No models or methods" detail="No new or existing technical source has been assessed." /> : <Table headers={["Source or model", "Type", "Applicability", "Hazard impact"]} minWidth={850}>
        {inputs.modelAndMethodInventory.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setModelEditor({ title: item.name, subtitle: item.sourceReference, focus: ["seismicHazardAnalysis", "earthScienceInputs", "modelAndMethodInventory", index], visibleRootFields: modelFields, removeLabel: "Remove source" })}><td className="stable__key"><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td>{displayLabel(item.modelKind)}</td><td>{item.applicability}</td><td>{item.potentialImpactOnHazard}</td></tr>)}
      </Table>}
    </Section>

    {coverageOpen && <EarthScienceCoverageEditor onClose={() => setCoverageOpen(false)} />}
    <CollectionEditor tone="sha" target={dataEditor} onClose={() => setDataEditor(null)} />
    <CollectionEditor tone="sha" target={modelEditor} onClose={() => setModelEditor(null)} />
  </>;
}

type SourceCharacterization = SeismicPRA["seismicHazardAnalysis"]["sourceCharacterization"];
type GroundMotionCharacterization = SeismicPRA["seismicHazardAnalysis"]["groundMotionCharacterization"];
type ExistingModelAssessment = SourceCharacterization["existingModelAssessments"][number];
type ReferenceHorizon = GroundMotionCharacterization["referenceHorizons"][number];
type SeismicSourceEntry = SourceCharacterization["earthquakeSources"][number];
type MagnitudeFrequencyModel = SeismicSourceEntry["magnitudeFrequencyModels"][number];
type GroundMotionModel = GroundMotionCharacterization["predictionModels"][number];

function technicalList(value: string): string[] {
  return value.split(/[,\n]/).map((item) => item.trim()).filter((item) => item.length > 0);
}

function newExistingModelAssessment(modelType: ExistingModelAssessment["modelType"]): ExistingModelAssessment {
  const hlr = modelType === "SEISMIC_SOURCE" ? "C" : "D";
  return {
    uuid: crypto.randomUUID(),
    name: "Existing model assessment",
    modelType,
    modelVersion: "",
    newDataModelMethodRefs: [],
    centerBodyRangeCoverageEvaluation: "",
    technicalValidityEvaluation: "",
    updateRequired: false,
    implementsSrs: [{ sr: `SHA-${hlr}4`, hlr }],
  };
}

function newReferenceHorizon(): ReferenceHorizon {
  return {
    uuid: crypto.randomUUID(),
    name: "Reference rock horizon",
    horizonType: "ROCK",
    depth: 0,
    depthUnit: "m",
    shearWaveVelocity: 0,
    shearWaveVelocityUnit: "m/s",
    density: 0,
    densityUnit: "kg/m3",
    dampingRatio: 0,
    definitionBasis: "",
    uncertaintyDescription: "",
    implementsSrs: [{ sr: "SHA-D1", hlr: "D" }, { sr: "SHA-D3", hlr: "D" }],
  };
}

function newMagnitudeFrequencyModel(): MagnitudeFrequencyModel {
  return {
    uuid: crypto.randomUUID(),
    name: "New recurrence model",
    modelType: "GUTENBERG_RICHTER",
    minimumMagnitude: 4.5,
    maximumMagnitude: 7,
    magnitudeScale: "Mw",
    annualRateAboveMinimum: 0,
    dataAndMethodBasis: "",
  };
}

function newSeismicSourceEntry(): SeismicSourceEntry {
  return {
    uuid: crypto.randomUUID(),
    name: "New seismic source",
    sourceType: "FAULT",
    tectonicRegionType: "",
    active: true,
    faultMechanisms: ["UNKNOWN"],
    geometry: {
      geometryType: "PLANE",
      geometryDescription: "",
      closestDistanceToSiteKm: 0,
      depthRangeKm: { minimum: 0, maximum: 20 },
      uncertaintyDescription: "",
    },
    magnitudeFrequencyModels: [newMagnitudeFrequencyModel()],
    paleoseismicEventRefs: [],
    historicalAndInstrumentalEventRefs: [],
    sourceDataRefs: [],
    majorHazardContributor: false,
    characterizationBasis: "",
    uncertainties: [],
    implementsSrs: [
      { sr: "SHA-C1", hlr: "C" },
      { sr: "SHA-C2", hlr: "C" },
      { sr: "SHA-C3", hlr: "C" },
    ],
  };
}

function cloneSeismicSourceEntry(source: SeismicSourceEntry): SeismicSourceEntry {
  return {
    ...source,
    faultMechanisms: [...source.faultMechanisms],
    geometry: {
      ...source.geometry,
      depthRangeKm: source.geometry.depthRangeKm === undefined
        ? undefined
        : { ...source.geometry.depthRangeKm },
    },
    magnitudeFrequencyModels: source.magnitudeFrequencyModels.map((model) => ({ ...model })),
    paleoseismicEventRefs: [...(source.paleoseismicEventRefs ?? [])],
    historicalAndInstrumentalEventRefs: [...(source.historicalAndInstrumentalEventRefs ?? [])],
    sourceDataRefs: [...source.sourceDataRefs],
    uncertainties: [...source.uncertainties],
    implementsSrs: [...source.implementsSrs],
  };
}

function SeismicSourceEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const source = index === null
    ? newSeismicSourceEntry()
    : cloneSeismicSourceEntry(mef.seismicHazardAnalysis.sourceCharacterization.earthquakeSources[index]!);
  const [draft, setDraft] = useState<SeismicSourceEntry>(source);

  function updateGeometry(change: Partial<SeismicSourceEntry["geometry"]>): void {
    setDraft((current) => ({ ...current, geometry: { ...current.geometry, ...change } }));
  }

  function updateMagnitudeModel(modelIndex: number, change: Partial<MagnitudeFrequencyModel>): void {
    setDraft((current) => ({
      ...current,
      magnitudeFrequencyModels: current.magnitudeFrequencyModels.map((model, candidate) =>
        candidate === modelIndex ? { ...model, ...change } : model),
    }));
  }

  function toggleMechanism(mechanism: SeismicSourceEntry["faultMechanisms"][number], checked: boolean): void {
    setDraft((current) => ({
      ...current,
      faultMechanisms: checked
        ? Array.from(new Set([...current.faultMechanisms, mechanism]))
        : current.faultMechanisms.filter((candidate) => candidate !== mechanism),
    }));
  }

  function save(): void {
    update((next) => {
      const sources = next.seismicHazardAnalysis.sourceCharacterization.earthquakeSources;
      if (index === null) sources.push(draft);
      else sources[index] = draft;
    });
    onClose();
  }

  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicHazardAnalysis.sourceCharacterization.earthquakeSources.splice(index, 1);
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle="Use this single editor to define the source identity, geometry, recurrence models, evidence, and uncertainty." plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove source</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save source</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Source</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Source type"><SelectInput value={draft.sourceType} options={["FAULT", "AREA", "BACKGROUND", "SUBDUCTION_INTERFACE", "SUBDUCTION_SLAB", "INDUCED", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, sourceType: value as SeismicSourceEntry["sourceType"] }))} /></Field>
          <Field label="Tectonic region"><TextInput value={draft.tectonicRegionType} onChange={(value) => setDraft((current) => ({ ...current, tectonicRegionType: value }))} /></Field>
        </FieldGrid>
        <div className="sinlineeditor__checks">
          <label className="sbasis-editor__check"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /><span>Active source</span></label>
          <label className="sbasis-editor__check"><input type="checkbox" checked={draft.majorHazardContributor} onChange={(event) => setDraft((current) => ({ ...current, majorHazardContributor: event.target.checked }))} /><span>Major hazard contributor</span></label>
        </div>
        <div className="sinlineeditor__choices">
          {(["STRIKE_SLIP", "NORMAL", "REVERSE", "OBLIQUE", "UNKNOWN"] as const).map((mechanism) => <label className={`sinlineeditor__choice${draft.faultMechanisms.includes(mechanism) ? " sinlineeditor__choice--active" : ""}`} key={mechanism}>
            <input type="checkbox" checked={draft.faultMechanisms.includes(mechanism)} onChange={(event) => toggleMechanism(mechanism, event.target.checked)} />
            <span><strong>{displayLabel(mechanism)}</strong></span>
          </label>)}
        </div>
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Geometry</h3>
        <FieldGrid>
          <Field label="Geometry type"><SelectInput value={draft.geometry.geometryType} options={["POINT", "LINE", "AREA", "PLANE", "VOLUME"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => updateGeometry({ geometryType: value as SeismicSourceEntry["geometry"]["geometryType"] })} /></Field>
          <Field label="Closest distance (km)"><OptionalNumberInput value={draft.geometry.closestDistanceToSiteKm} onChange={(value) => updateGeometry({ closestDistanceToSiteKm: value })} /></Field>
          <Field label="Minimum depth (km)"><OptionalNumberInput value={draft.geometry.depthRangeKm?.minimum} onChange={(value) => updateGeometry({ depthRangeKm: { minimum: value ?? 0, maximum: draft.geometry.depthRangeKm?.maximum ?? 0 } })} /></Field>
          <Field label="Maximum depth (km)"><OptionalNumberInput value={draft.geometry.depthRangeKm?.maximum} onChange={(value) => updateGeometry({ depthRangeKm: { minimum: draft.geometry.depthRangeKm?.minimum ?? 0, maximum: value ?? 0 } })} /></Field>
          <Field label="Strike (degrees)"><OptionalNumberInput value={draft.geometry.strikeDegrees} onChange={(value) => updateGeometry({ strikeDegrees: value })} /></Field>
          <Field label="Dip (degrees)"><OptionalNumberInput value={draft.geometry.dipDegrees} onChange={(value) => updateGeometry({ dipDegrees: value })} /></Field>
        </FieldGrid>
        <Field label="Geometry description"><TextArea rows={3} value={draft.geometry.geometryDescription} onChange={(value) => updateGeometry({ geometryDescription: value })} /></Field>
        <FieldGrid>
          <Field label="Coordinate system"><TextInput value={draft.geometry.coordinateReferenceSystem ?? ""} onChange={(value) => updateGeometry({ coordinateReferenceSystem: value || undefined })} /></Field>
          <Field label="Geometry file"><TextInput value={draft.geometry.geometryFileRef ?? ""} onChange={(value) => updateGeometry({ geometryFileRef: value || undefined })} /></Field>
        </FieldGrid>
        <Field label="Geometry uncertainty"><TextArea rows={3} value={draft.geometry.uncertaintyDescription} onChange={(value) => updateGeometry({ uncertaintyDescription: value })} /></Field>
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Magnitude and recurrence</h3>
        {draft.magnitudeFrequencyModels.map((model, modelIndex) => <div className="sinlineeditor__subgroup" key={model.uuid}>
          <FieldGrid>
            <Field label={`Model ${modelIndex + 1}`}><TextInput value={model.name} onChange={(value) => updateMagnitudeModel(modelIndex, { name: value })} /></Field>
            <Field label="Model type"><SelectInput value={model.modelType} options={["GUTENBERG_RICHTER", "CHARACTERISTIC", "RENEWAL", "FIXED_RATE", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => updateMagnitudeModel(modelIndex, { modelType: value as MagnitudeFrequencyModel["modelType"] })} /></Field>
          </FieldGrid>
          <FieldGrid>
            <Field label="Minimum magnitude"><NumberInput value={model.minimumMagnitude} onChange={(value) => updateMagnitudeModel(modelIndex, { minimumMagnitude: value })} /></Field>
            <Field label="Maximum magnitude"><NumberInput value={model.maximumMagnitude} onChange={(value) => updateMagnitudeModel(modelIndex, { maximumMagnitude: value })} /></Field>
            <Field label="Magnitude scale"><TextInput value={model.magnitudeScale} onChange={(value) => updateMagnitudeModel(modelIndex, { magnitudeScale: value })} /></Field>
            <Field label="Annual rate above minimum"><OptionalNumberInput value={model.annualRateAboveMinimum} onChange={(value) => updateMagnitudeModel(modelIndex, { annualRateAboveMinimum: value })} /></Field>
            <Field label="a-value"><OptionalNumberInput value={model.aValue} onChange={(value) => updateMagnitudeModel(modelIndex, { aValue: value })} /></Field>
            <Field label="b-value"><OptionalNumberInput value={model.bValue} onChange={(value) => updateMagnitudeModel(modelIndex, { bValue: value })} /></Field>
            <Field label="Recurrence interval (years)"><OptionalNumberInput value={model.recurrenceIntervalYears} onChange={(value) => updateMagnitudeModel(modelIndex, { recurrenceIntervalYears: value })} /></Field>
          </FieldGrid>
          <Field label="Data and method basis"><TextArea rows={3} value={model.dataAndMethodBasis} onChange={(value) => updateMagnitudeModel(modelIndex, { dataAndMethodBasis: value })} /></Field>
          {editable && draft.magnitudeFrequencyModels.length > 1 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, magnitudeFrequencyModels: current.magnitudeFrequencyModels.filter((_, candidate) => candidate !== modelIndex) }))}>Remove recurrence model</button>}
        </div>)}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, magnitudeFrequencyModels: [...current.magnitudeFrequencyModels, newMagnitudeFrequencyModel()] }))}>Add magnitude-frequency model</button>}
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Evidence and uncertainty</h3>
        <Field label="Source data references" hint="Separate references with commas."><TextArea rows={3} value={draft.sourceDataRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, sourceDataRefs: technicalList(value) }))} /></Field>
        <Field label="Paleoseismic event references" hint="Separate references with commas."><TextInput value={(draft.paleoseismicEventRefs ?? []).join(", ")} onChange={(value) => setDraft((current) => ({ ...current, paleoseismicEventRefs: technicalList(value) }))} /></Field>
        <Field label="Historical and instrumental event references" hint="Separate references with commas."><TextArea rows={3} value={(draft.historicalAndInstrumentalEventRefs ?? []).join(", ")} onChange={(value) => setDraft((current) => ({ ...current, historicalAndInstrumentalEventRefs: technicalList(value) }))} /></Field>
        <Field label="Characterization basis"><TextArea rows={4} value={draft.characterizationBasis} onChange={(value) => setDraft((current) => ({ ...current, characterizationBasis: value }))} /></Field>
        <Field label="Uncertainties" hint="Separate entries with commas."><TextArea rows={3} value={draft.uncertainties.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, uncertainties: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function newGroundMotionModel(parameterRefs: string[]): GroundMotionModel {
  return {
    uuid: crypto.randomUUID(),
    name: "New ground-motion model",
    modelKind: "PUBLISHED_GMPE",
    sourceReference: "",
    tectonicRegionTypes: [],
    faultMechanisms: ["UNKNOWN"],
    magnitudeRange: { minimum: 3, maximum: 8 },
    distanceRangeKm: { minimum: 0, maximum: 500 },
    supportedParameterRefs: [...parameterRefs],
    horizontalComponentDefinition: "",
    siteTermDefinition: "",
    medianModelDescription: "",
    aleatoryVariabilityDescription: "",
    extrapolationAndTruncation: "",
    applicabilityAndLimitations: "",
    calibrationDataRefs: [],
    logicTreeWeight: 0,
    selectionBasis: "",
    implementsSrs: [
      { sr: "SHA-D1", hlr: "D" },
      { sr: "SHA-D2", hlr: "D" },
      { sr: "SHA-D3", hlr: "D" },
    ],
  };
}

function cloneGroundMotionModel(model: GroundMotionModel): GroundMotionModel {
  return {
    ...model,
    tectonicRegionTypes: [...model.tectonicRegionTypes],
    faultMechanisms: [...model.faultMechanisms],
    magnitudeRange: { ...model.magnitudeRange },
    distanceRangeKm: { ...model.distanceRangeKm },
    supportedParameterRefs: [...model.supportedParameterRefs],
    sigmaComponents: model.sigmaComponents === undefined ? undefined : { ...model.sigmaComponents },
    calibrationDataRefs: [...model.calibrationDataRefs],
    implementsSrs: [...model.implementsSrs],
  };
}

function GroundMotionModelEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const parameterRefs = mef.seismicHazardAnalysis.analysisBasis.groundMotionParameters.map((parameter) => parameter.uuid);
  const source = index === null
    ? newGroundMotionModel(parameterRefs)
    : cloneGroundMotionModel(mef.seismicHazardAnalysis.groundMotionCharacterization.predictionModels[index]!);
  const [draft, setDraft] = useState<GroundMotionModel>(source);

  function updateSigma(change: Partial<NonNullable<GroundMotionModel["sigmaComponents"]>>): void {
    setDraft((current) => ({
      ...current,
      sigmaComponents: { ...(current.sigmaComponents ?? {}), ...change },
    }));
  }

  function toggleMechanism(mechanism: GroundMotionModel["faultMechanisms"][number], checked: boolean): void {
    setDraft((current) => ({
      ...current,
      faultMechanisms: checked
        ? Array.from(new Set([...current.faultMechanisms, mechanism]))
        : current.faultMechanisms.filter((candidate) => candidate !== mechanism),
    }));
  }

  function save(): void {
    update((next) => {
      const models = next.seismicHazardAnalysis.groundMotionCharacterization.predictionModels;
      if (index === null) models.push(draft);
      else models[index] = draft;
    });
    onClose();
  }

  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicHazardAnalysis.groundMotionCharacterization.predictionModels.splice(index, 1);
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle="Use this single editor to define model applicability, supported motion parameters, variability, data support, and logic-tree weight." plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove ground-motion model</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save model</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Model</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Model kind"><SelectInput value={draft.modelKind} options={["PUBLISHED_GMPE", "PROJECT_SPECIFIC_GMPE", "SIMULATION", "HYBRID"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, modelKind: value as GroundMotionModel["modelKind"] }))} /></Field>
          <Field label="Version"><TextInput value={draft.version ?? ""} onChange={(value) => setDraft((current) => ({ ...current, version: value || undefined }))} /></Field>
          <Field label="Source reference"><TextInput value={draft.sourceReference} onChange={(value) => setDraft((current) => ({ ...current, sourceReference: value }))} /></Field>
          <Field label="Logic-tree weight"><NumberInput value={draft.logicTreeWeight} onChange={(value) => setDraft((current) => ({ ...current, logicTreeWeight: value }))} /></Field>
        </FieldGrid>
        <Field label="Tectonic regions" hint="Separate entries with commas."><TextArea rows={3} value={draft.tectonicRegionTypes.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, tectonicRegionTypes: technicalList(value) }))} /></Field>
        <div className="sinlineeditor__choices">
          {(["STRIKE_SLIP", "NORMAL", "REVERSE", "OBLIQUE", "UNKNOWN"] as const).map((mechanism) => <label className={`sinlineeditor__choice${draft.faultMechanisms.includes(mechanism) ? " sinlineeditor__choice--active" : ""}`} key={mechanism}>
            <input type="checkbox" checked={draft.faultMechanisms.includes(mechanism)} onChange={(event) => toggleMechanism(mechanism, event.target.checked)} />
            <span><strong>{displayLabel(mechanism)}</strong></span>
          </label>)}
        </div>
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Applicability range</h3>
        <FieldGrid>
          <Field label="Minimum magnitude"><NumberInput value={draft.magnitudeRange.minimum} onChange={(value) => setDraft((current) => ({ ...current, magnitudeRange: { ...current.magnitudeRange, minimum: value } }))} /></Field>
          <Field label="Maximum magnitude"><NumberInput value={draft.magnitudeRange.maximum} onChange={(value) => setDraft((current) => ({ ...current, magnitudeRange: { ...current.magnitudeRange, maximum: value } }))} /></Field>
          <Field label="Minimum distance (km)"><NumberInput value={draft.distanceRangeKm.minimum} onChange={(value) => setDraft((current) => ({ ...current, distanceRangeKm: { ...current.distanceRangeKm, minimum: value } }))} /></Field>
          <Field label="Maximum distance (km)"><NumberInput value={draft.distanceRangeKm.maximum} onChange={(value) => setDraft((current) => ({ ...current, distanceRangeKm: { ...current.distanceRangeKm, maximum: value } }))} /></Field>
        </FieldGrid>
        <Field label="Supported ground-motion parameters" hint="Separate references with commas."><TextArea rows={4} value={draft.supportedParameterRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, supportedParameterRefs: technicalList(value) }))} /></Field>
        <Field label="Applicability and limitations"><TextArea rows={4} value={draft.applicabilityAndLimitations} onChange={(value) => setDraft((current) => ({ ...current, applicabilityAndLimitations: value }))} /></Field>
        <Field label="Extrapolation and truncation"><TextArea rows={3} value={draft.extrapolationAndTruncation} onChange={(value) => setDraft((current) => ({ ...current, extrapolationAndTruncation: value }))} /></Field>
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Motion definition and variability</h3>
        <Field label="Horizontal component"><TextArea rows={3} value={draft.horizontalComponentDefinition} onChange={(value) => setDraft((current) => ({ ...current, horizontalComponentDefinition: value }))} /></Field>
        <Field label="Reference-horizon site term"><TextArea rows={3} value={draft.siteTermDefinition} onChange={(value) => setDraft((current) => ({ ...current, siteTermDefinition: value }))} /></Field>
        <Field label="Median model"><TextArea rows={3} value={draft.medianModelDescription} onChange={(value) => setDraft((current) => ({ ...current, medianModelDescription: value }))} /></Field>
        <Field label="Aleatory variability"><TextArea rows={3} value={draft.aleatoryVariabilityDescription} onChange={(value) => setDraft((current) => ({ ...current, aleatoryVariabilityDescription: value }))} /></Field>
        <FieldGrid>
          <Field label="Total sigma"><OptionalNumberInput value={draft.sigmaComponents?.total} onChange={(value) => updateSigma({ total: value })} /></Field>
          <Field label="Inter-event sigma"><OptionalNumberInput value={draft.sigmaComponents?.interEvent} onChange={(value) => updateSigma({ interEvent: value })} /></Field>
          <Field label="Intra-event sigma"><OptionalNumberInput value={draft.sigmaComponents?.intraEvent} onChange={(value) => updateSigma({ intraEvent: value })} /></Field>
        </FieldGrid>
      </div>

      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Selection evidence</h3>
        <Field label="Calibration data references" hint="Separate references with commas."><TextArea rows={3} value={draft.calibrationDataRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, calibrationDataRefs: technicalList(value) }))} /></Field>
        <Field label="Selection basis"><TextArea rows={4} value={draft.selectionBasis} onChange={(value) => setDraft((current) => ({ ...current, selectionBasis: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function SourceCharacterizationBasisEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const source = mef.seismicHazardAnalysis.sourceCharacterization;
  const [draft, setDraft] = useState<SourceCharacterization>(() => {
    const initial = structuredClone(source);
    if (initial.existingModelAssessments.length === 0) initial.existingModelAssessments.push(newExistingModelAssessment("SEISMIC_SOURCE"));
    return initial;
  });
  const assessment = draft.existingModelAssessments[0]!;

  function updateLogicTree(change: Partial<SourceCharacterization["sourceLogicTree"]>): void {
    setDraft((current) => ({ ...current, sourceLogicTree: { ...current.sourceLogicTree, ...change } }));
  }

  function updateAssessment(change: Partial<ExistingModelAssessment>): void {
    setDraft((current) => ({
      ...current,
      existingModelAssessments: [{ ...current.existingModelAssessments[0]!, ...change }, ...current.existingModelAssessments.slice(1)],
    }));
  }

  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.sourceCharacterization = draft;
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Source basis" subtitle="Source model, logic tree, and existing-model update" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Source model</h3>
        <Field label="Source model reference">
          <TextInput value={draft.sourceModelReference} onChange={(value) => setDraft((current) => ({ ...current, sourceModelReference: value }))} />
        </Field>
        <Field label="Structured approach">
          <TextArea rows={3} value={draft.structuredApproach} onChange={(value) => setDraft((current) => ({ ...current, structuredApproach: value }))} />
        </Field>
        <Field label="Uncertainty identification">
          <TextArea rows={3} value={draft.uncertaintyIdentificationMethod} onChange={(value) => setDraft((current) => ({ ...current, uncertaintyIdentificationMethod: value }))} />
        </Field>
        <Field label="Technical integration">
          <TextArea rows={3} value={draft.technicalIntegrationSummary} onChange={(value) => setDraft((current) => ({ ...current, technicalIntegrationSummary: value }))} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Logic tree</h3>
        <Field label="End branches">
          <NumberInput value={draft.sourceLogicTree.totalEndBranchCount ?? 0} onChange={(value) => updateLogicTree({ totalEndBranchCount: value })} />
        </Field>
        <Field label="Branch-weight review">
          <TextArea rows={3} value={draft.sourceLogicTree.branchWeightReview} onChange={(value) => updateLogicTree({ branchWeightReview: value })} />
        </Field>
        <Field label="Dependencies and correlations">
          <TextArea rows={3} value={draft.sourceLogicTree.dependenciesAndCorrelations} onChange={(value) => updateLogicTree({ dependenciesAndCorrelations: value })} />
        </Field>
        <Field label="Center, body, and range">
          <TextArea rows={3} value={draft.sourceLogicTree.centerBodyRangeCoverage} onChange={(value) => updateLogicTree({ centerBodyRangeCoverage: value })} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Existing model update</h3>
        <FieldGrid>
          <Field label="Model version">
            <TextInput value={assessment.modelVersion} onChange={(value) => updateAssessment({ modelVersion: value })} />
          </Field>
          <Field label="Original study date">
            <TextInput value={assessment.originalStudyDate ?? ""} onChange={(value) => updateAssessment({ originalStudyDate: value.length === 0 ? undefined : value })} />
          </Field>
        </FieldGrid>
        <Field label="Center, body, and range evaluation">
          <TextArea rows={3} value={assessment.centerBodyRangeCoverageEvaluation} onChange={(value) => updateAssessment({ centerBodyRangeCoverageEvaluation: value })} />
        </Field>
        <Field label="Technical validity">
          <TextArea rows={3} value={assessment.technicalValidityEvaluation} onChange={(value) => updateAssessment({ technicalValidityEvaluation: value })} />
        </Field>
        <label className="sbasis-editor__check">
          <input type="checkbox" checked={assessment.updateRequired} onChange={(event) => updateAssessment({ updateRequired: event.target.checked })} />
          <span>Existing source model requires an update</span>
        </label>
        {assessment.updateRequired && <>
          <Field label="Update level">
            <TextInput value={assessment.updateLevel ?? ""} onChange={(value) => updateAssessment({ updateLevel: value })} />
          </Field>
          <Field label="Update method">
            <TextArea rows={3} value={assessment.updateMethod ?? ""} onChange={(value) => updateAssessment({ updateMethod: value })} />
          </Field>
          <Field label="Update justification">
            <TextArea rows={3} value={assessment.updateJustification ?? ""} onChange={(value) => updateAssessment({ updateJustification: value })} />
          </Field>
          <Field label="Resulting model reference">
            <TextInput value={assessment.resultingModelRef ?? ""} onChange={(value) => updateAssessment({ resultingModelRef: value })} />
          </Field>
        </>}
      </div>
    </fieldset>
  </Drawer>;
}

function GroundMotionBasisEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const ground = mef.seismicHazardAnalysis.groundMotionCharacterization;
  const [draft, setDraft] = useState<GroundMotionCharacterization>(() => {
    const initial = structuredClone(ground);
    if (initial.referenceHorizons.length === 0) initial.referenceHorizons.push(newReferenceHorizon());
    if (initial.existingModelAssessments.length === 0) initial.existingModelAssessments.push(newExistingModelAssessment("GROUND_MOTION"));
    return initial;
  });
  const [governingMechanisms, setGoverningMechanisms] = useState(ground.governingMechanisms.join(", "));
  const [selectionCriteria, setSelectionCriteria] = useState(ground.modelSelectionCriteria.join(", "));
  const horizon = draft.referenceHorizons[0]!;
  const assessment = draft.existingModelAssessments[0]!;

  function updateHorizon(change: Partial<ReferenceHorizon>): void {
    setDraft((current) => ({
      ...current,
      referenceHorizons: [{ ...current.referenceHorizons[0]!, ...change }, ...current.referenceHorizons.slice(1)],
    }));
  }

  function updateLogicTree(change: Partial<GroundMotionCharacterization["groundMotionLogicTree"]>): void {
    setDraft((current) => ({ ...current, groundMotionLogicTree: { ...current.groundMotionLogicTree, ...change } }));
  }

  function updateAssessment(change: Partial<ExistingModelAssessment>): void {
    setDraft((current) => ({
      ...current,
      existingModelAssessments: [{ ...current.existingModelAssessments[0]!, ...change }, ...current.existingModelAssessments.slice(1)],
    }));
  }

  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.groundMotionCharacterization = {
        ...draft,
        governingMechanisms: technicalList(governingMechanisms),
        modelSelectionCriteria: technicalList(selectionCriteria),
      };
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Ground-motion basis" subtitle="Data, reference horizon, compatibility, and uncertainty" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Motion basis</h3>
        <Field label="Governing mechanisms" hint="Separate entries with commas.">
          <TextArea rows={3} value={governingMechanisms} onChange={setGoverningMechanisms} />
        </Field>
        <Field label="Historical and instrumental review">
          <TextArea rows={3} value={draft.historicalAndInstrumentalReview} onChange={(value) => setDraft((current) => ({ ...current, historicalAndInstrumentalReview: value }))} />
        </Field>
        <Field label="Model-selection criteria" hint="Separate entries with commas.">
          <TextArea rows={4} value={selectionCriteria} onChange={setSelectionCriteria} />
        </Field>
        <Field label="Compatibility with the structured process">
          <TextArea rows={3} value={draft.processCompatibilityBasis} onChange={(value) => setDraft((current) => ({ ...current, processCompatibilityBasis: value }))} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Reference horizon</h3>
        <FieldGrid>
          <Field label="Name">
            <TextInput value={horizon.name} onChange={(value) => updateHorizon({ name: value })} />
          </Field>
          <Field label="Type">
            <SelectInput value={horizon.horizonType} options={[{ value: "ROCK", label: "Rock" }, { value: "SOIL", label: "Soil" }]} onChange={(value) => updateHorizon({ horizonType: value as ReferenceHorizon["horizonType"] })} />
          </Field>
          <Field label="Depth">
            <NumberInput value={horizon.depth} onChange={(value) => updateHorizon({ depth: value })} />
          </Field>
          <Field label="Depth unit">
            <TextInput value={horizon.depthUnit} onChange={(value) => updateHorizon({ depthUnit: value })} />
          </Field>
          <Field label="Shear-wave velocity">
            <NumberInput value={horizon.shearWaveVelocity} onChange={(value) => updateHorizon({ shearWaveVelocity: value })} />
          </Field>
          <Field label="Velocity unit">
            <TextInput value={horizon.shearWaveVelocityUnit} onChange={(value) => updateHorizon({ shearWaveVelocityUnit: value })} />
          </Field>
          <Field label="Density">
            <NumberInput value={horizon.density} onChange={(value) => updateHorizon({ density: value })} />
          </Field>
          <Field label="Density unit">
            <TextInput value={horizon.densityUnit} onChange={(value) => updateHorizon({ densityUnit: value })} />
          </Field>
          <Field label="Damping ratio">
            <NumberInput value={horizon.dampingRatio} onChange={(value) => updateHorizon({ dampingRatio: value })} />
          </Field>
        </FieldGrid>
        <Field label="Definition basis">
          <TextArea rows={3} value={horizon.definitionBasis} onChange={(value) => updateHorizon({ definitionBasis: value })} />
        </Field>
        <Field label="Uncertainty">
          <TextArea rows={3} value={horizon.uncertaintyDescription} onChange={(value) => updateHorizon({ uncertaintyDescription: value })} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Logic tree and update</h3>
        <Field label="End branches">
          <NumberInput value={draft.groundMotionLogicTree.totalEndBranchCount ?? 0} onChange={(value) => updateLogicTree({ totalEndBranchCount: value })} />
        </Field>
        <Field label="Branch-weight review">
          <TextArea rows={3} value={draft.groundMotionLogicTree.branchWeightReview} onChange={(value) => updateLogicTree({ branchWeightReview: value })} />
        </Field>
        <Field label="Dependencies and correlations">
          <TextArea rows={3} value={draft.groundMotionLogicTree.dependenciesAndCorrelations} onChange={(value) => updateLogicTree({ dependenciesAndCorrelations: value })} />
        </Field>
        <Field label="Center, body, and range">
          <TextArea rows={3} value={draft.groundMotionLogicTree.centerBodyRangeCoverage} onChange={(value) => updateLogicTree({ centerBodyRangeCoverage: value })} />
        </Field>
        <label className="sbasis-editor__check">
          <input type="checkbox" checked={draft.siteToSiteVariabilityIncluded} onChange={(event) => setDraft((current) => ({ ...current, siteToSiteVariabilityIncluded: event.target.checked }))} />
          <span>Include site-to-site variability</span>
        </label>
        <Field label="Site-variability treatment">
          <TextArea rows={3} value={draft.siteToSiteVariabilityTreatment ?? ""} onChange={(value) => setDraft((current) => ({ ...current, siteToSiteVariabilityTreatment: value }))} />
        </Field>
        <FieldGrid>
          <Field label="Existing model version">
            <TextInput value={assessment.modelVersion} onChange={(value) => updateAssessment({ modelVersion: value })} />
          </Field>
          <Field label="Original study date">
            <TextInput value={assessment.originalStudyDate ?? ""} onChange={(value) => updateAssessment({ originalStudyDate: value.length === 0 ? undefined : value })} />
          </Field>
        </FieldGrid>
        <Field label="Technical validity">
          <TextArea rows={3} value={assessment.technicalValidityEvaluation} onChange={(value) => updateAssessment({ technicalValidityEvaluation: value })} />
        </Field>
        <label className="sbasis-editor__check">
          <input type="checkbox" checked={assessment.updateRequired} onChange={(event) => updateAssessment({ updateRequired: event.target.checked })} />
          <span>Existing ground-motion model requires an update</span>
        </label>
        {assessment.updateRequired && <>
          <Field label="Update method">
            <TextArea rows={3} value={assessment.updateMethod ?? ""} onChange={(value) => updateAssessment({ updateMethod: value })} />
          </Field>
          <Field label="Update justification">
            <TextArea rows={3} value={assessment.updateJustification ?? ""} onChange={(value) => updateAssessment({ updateJustification: value })} />
          </Field>
          <Field label="Resulting model reference">
            <TextInput value={assessment.resultingModelRef ?? ""} onChange={(value) => updateAssessment({ resultingModelRef: value })} />
          </Field>
        </>}
      </div>
    </fieldset>
  </Drawer>;
}

function SourceGroundMotionScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const source = mef.seismicHazardAnalysis.sourceCharacterization;
  const ground = mef.seismicHazardAnalysis.groundMotionCharacterization;
  const sourceMagnitudeRange = (models: typeof source.earthquakeSources[number]["magnitudeFrequencyModels"]): string => {
    if (models.length === 0) return "Not defined";
    const minimum = Math.min(...models.map((model) => model.minimumMagnitude));
    const maximum = Math.max(...models.map((model) => model.maximumMagnitude));
    return `${models[0]?.magnitudeScale ?? "M"} ${minimum} to ${maximum}`;
  };
  const [sourceBasisOpen, setSourceBasisOpen] = useState(false);
  const [groundBasisOpen, setGroundBasisOpen] = useState(false);
  const [collectionEditor, setCollectionEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section title="Seismic sources" description="Credible sources and recurrence models." tone="sha" actions={<>
      <EditButton label="Edit basis" onClick={() => setSourceBasisOpen(true)} />
      {editable && <AddButton label="Add source" onClick={() => setCollectionEditor({ title: "New seismic source", subtitle: "Geometry, magnitude, recurrence, dependencies, and epistemic alternatives", focus: [], createAt: ["seismicHazardAnalysis", "sourceCharacterization", "earthquakeSources"] })} />}
    </>}>
      {source.earthquakeSources.length === 0 ? <EmptyState title="No seismic sources" detail="No credible earthquake source has been characterized." /> : <Table headers={["Source", "Geometry", "Distance", "Magnitude range"]} minWidth={760}>
        {source.earthquakeSources.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: displayLabel(item.sourceType), focus: ["seismicHazardAnalysis", "sourceCharacterization", "earthquakeSources", index], removeLabel: "Remove source" })}><td className="stable__key"><strong>{item.name}</strong><code>{item.tectonicRegionType}</code></td><td><strong>{item.sourceType === item.geometry.geometryType ? displayLabel(item.sourceType) : `${displayLabel(item.sourceType)} / ${displayLabel(item.geometry.geometryType)}`}</strong><code>{item.faultMechanisms.map(displayLabel).join(", ")}</code></td><td>{item.geometry.closestDistanceToSiteKm === undefined ? "Not recorded" : `${item.geometry.closestDistanceToSiteKm} km`}</td><td>{sourceMagnitudeRange(item.magnitudeFrequencyModels)}</td></tr>)}
      </Table>}
    </Section>
    <Section title="Ground-motion models" description="Prediction ranges, variability, and weights." tone="sha" actions={<>
      <EditButton label="Edit basis" onClick={() => setGroundBasisOpen(true)} />
      {editable && <AddButton label="Add model" onClick={() => setCollectionEditor({ title: "New prediction model", subtitle: "Model range, source basis, logic-tree weight, and applicability", focus: [], createAt: ["seismicHazardAnalysis", "groundMotionCharacterization", "predictionModels"] })} />}
    </>}>
      {ground.predictionModels.length === 0 ? <EmptyState title="No prediction models" detail="No ground-motion prediction model has been selected." /> : <Table headers={["Prediction model", "Type", "Magnitude range", "Distance range", "Total sigma", "Weight"]} minWidth={920}>
        {ground.predictionModels.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: "Ground-motion prediction model", focus: ["seismicHazardAnalysis", "groundMotionCharacterization", "predictionModels", index], removeLabel: "Remove prediction model" })}><td className="stable__key"><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td>{displayLabel(item.modelKind)}</td><td>M {item.magnitudeRange.minimum} to {item.magnitudeRange.maximum}</td><td>{item.distanceRangeKm.minimum} to {item.distanceRangeKm.maximum} km</td><td>{item.sigmaComponents?.total ?? "Not recorded"}</td><td>{item.logicTreeWeight.toFixed(2)}</td></tr>)}
      </Table>}
    </Section>
    {sourceBasisOpen && <SourceCharacterizationBasisEditor onClose={() => setSourceBasisOpen(false)} />}
    {groundBasisOpen && <GroundMotionBasisEditor onClose={() => setGroundBasisOpen(false)} />}
    <CollectionEditor tone="sha" target={collectionEditor} onClose={() => setCollectionEditor(null)} />
  </>;
}

type SiteResponseAnalysis = SeismicPRA["seismicHazardAnalysis"]["siteResponseAnalysis"];
type SiteProfile = SiteResponseAnalysis["profiles"][number];
type SiteLayer = SiteProfile["layers"][number];
type SiteProperty = SiteLayer["properties"][number];
type SiteMethod = SiteResponseAnalysis["methods"][number];
type SiteInputMotion = SiteResponseAnalysis["inputMotions"][number];
type SiteUncertainty = SiteResponseAnalysis["uncertainties"][number];
type SiteResult = SiteResponseAnalysis["amplificationResults"][number];

function numericRange(values: number[], unit = ""): string {
  if (values.length === 0) return "Not defined";
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return `${minimum} to ${maximum}${unit.length > 0 ? ` ${unit}` : ""}`;
}

function siteProperty(layer: SiteLayer, propertyType: SiteProperty["propertyType"]): number | undefined {
  return layer.properties.find((property) => property.propertyType === propertyType)?.value;
}

function setSiteProperty(layer: SiteLayer, propertyType: SiteProperty["propertyType"], value: number, units: string): SiteLayer {
  const properties = [...layer.properties];
  const index = properties.findIndex((property) => property.propertyType === propertyType);
  if (index >= 0) {
    properties[index] = { ...properties[index]!, value, units };
  } else {
    properties.push({
      uuid: crypto.randomUUID(),
      name: displayLabel(propertyType),
      propertyType,
      value,
      units,
      sourceReference: layer.sourceReferences[0] ?? "",
      basisAndLimitations: "",
    });
  }
  return { ...layer, properties };
}

function newSiteLayer(index: number): SiteLayer {
  return {
    uuid: crypto.randomUUID(),
    name: `Layer ${index + 1}`,
    materialType: "",
    topDepth: 0,
    bottomDepth: 0,
    depthUnit: "m",
    thickness: 0,
    properties: [],
    spatialVariability: "",
    sourceReferences: [],
  };
}

function newSiteProfile(): SiteProfile {
  return {
    uuid: crypto.randomUUID(),
    name: "New site profile",
    profileType: "ALTERNATIVE",
    locationDescription: "",
    layers: [newSiteLayer(0)],
    depthToBedrock: 0,
    depthUnit: "m",
    bedrockDefinition: "",
    profileWeight: 0,
    siteVariabilityBasis: "",
    sourceReferences: [],
    implementsSrs: [{ sr: "SHA-E1", hlr: "E" }, { sr: "SHA-E3", hlr: "E" }, { sr: "SHA-E5", hlr: "E" }],
  };
}

function newSiteMethod(): SiteMethod {
  return {
    uuid: crypto.randomUUID(),
    name: "Site-response method",
    dimension: "ONE_DIMENSIONAL",
    analysisType: "EQUIVALENT_LINEAR",
    methodDescription: "",
    dimensionSelectionBasis: "",
    inputLocation: "",
    outputLocation: "CONTROL-POINT-FOUNDATION",
    boundaryConditions: "",
    materialModelDescription: "",
    verificationAndValidation: "",
    limitations: [],
    implementsSrs: [{ sr: "SHA-E3", hlr: "E" }, { sr: "SHA-E5", hlr: "E" }],
  };
}

function newSiteInputMotion(): SiteInputMotion {
  return {
    uuid: crypto.randomUUID(),
    name: "Input-motion set",
    inputType: "FOURIER_AMPLITUDE_SPECTRUM",
    referenceHorizonRef: "",
    groundMotionParameterRef: "",
    amplitudeLevels: [],
    units: "g",
    selectionAndScalingBasis: "",
  };
}

function newSiteUncertainty(): SiteUncertainty {
  return {
    uuid: crypto.randomUUID(),
    name: "Site-response uncertainty",
    uncertaintyType: "EPISTEMIC",
    analysisArea: "SITE_RESPONSE",
    description: "",
    affectedModelRefs: [],
    affectedResultRefs: [],
    characterizationMethod: "",
    propagationMethod: "",
    implementsSrs: [{ sr: "SHA-E3", hlr: "E" }],
  };
}

function newSiteResult(site: SiteResponseAnalysis): SiteResult {
  return {
    uuid: crypto.randomUUID(),
    name: "Site amplification calculation",
    profileRefs: site.profiles.map((profile) => profile.uuid),
    methodRef: site.methods[0]?.uuid ?? "",
    inputMotionRef: site.inputMotions[0]?.uuid ?? "",
    outputControlPointRef: "CONTROL-POINT-FOUNDATION",
    points: [],
    weightingAndCombinationMethod: "",
    nonlinearEffectsTreatment: "",
    uncertaintyTreatment: "",
    implementsSrs: [{ sr: "SHA-E3", hlr: "E" }, { sr: "SHA-E5", hlr: "E" }],
  };
}

function SiteConditionsEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const [draft, setDraft] = useState<SiteResponseAnalysis>(() => structuredClone(mef.seismicHazardAnalysis.siteResponseAnalysis));
  const topography = draft.topographyAndGeology;
  function updateTopography(change: Partial<SiteResponseAnalysis["topographyAndGeology"]>): void {
    setDraft((current) => ({ ...current, topographyAndGeology: { ...current.topographyAndGeology, ...change } }));
  }
  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.siteResponseAnalysis = draft;
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Site conditions" subtitle="Topography, geology, and response basis" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Local conditions</h3>
        <Field label="Topography"><TextArea rows={3} value={topography.topographicDescription} onChange={(value) => updateTopography({ topographicDescription: value })} /></Field>
        <Field label="Topography references" hint="Separate references with commas."><TextInput value={topography.topographicDataRefs.join(", ")} onChange={(value) => updateTopography({ topographicDataRefs: technicalList(value) })} /></Field>
        <Field label="Surficial deposits"><TextArea rows={3} value={topography.surficialDepositDescription} onChange={(value) => updateTopography({ surficialDepositDescription: value })} /></Field>
        <Field label="Surficial-geology references" hint="Separate references with commas."><TextInput value={topography.surficialGeologyDataRefs.join(", ")} onChange={(value) => updateTopography({ surficialGeologyDataRefs: technicalList(value) })} /></Field>
        <Field label="Geologic structure"><TextArea rows={3} value={topography.geologicStructureDescription} onChange={(value) => updateTopography({ geologicStructureDescription: value })} /></Field>
        <Field label="Geotechnical references" hint="Separate references with commas."><TextInput value={topography.geotechnicalInvestigationRefs.join(", ")} onChange={(value) => updateTopography({ geotechnicalInvestigationRefs: technicalList(value) })} /></Field>
        <label className="sbasis-editor__check"><input type="checkbox" checked={topography.topographicEffectsSignificant} onChange={(event) => updateTopography({ topographicEffectsSignificant: event.target.checked })} /><span>Topographic effects are significant</span></label>
        <Field label="Topographic-effects treatment"><TextArea rows={3} value={topography.topographicEffectsTreatment} onChange={(value) => updateTopography({ topographicEffectsTreatment: value })} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Hazard integration</h3>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.localSiteResponseIncluded} onChange={(event) => setDraft((current) => ({ ...current, localSiteResponseIncluded: event.target.checked }))} /><span>Include local site response</span></label>
        <Field label="Approach justification"><TextArea rows={4} value={draft.approachJustification} onChange={(value) => setDraft((current) => ({ ...current, approachJustification: value }))} /></Field>
        <Field label="Incorporation into hazard"><TextArea rows={4} value={draft.incorporationIntoHazardMethod} onChange={(value) => setDraft((current) => ({ ...current, incorporationIntoHazardMethod: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function SiteProfileEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const source = index === null ? newSiteProfile() : mef.seismicHazardAnalysis.siteResponseAnalysis.profiles[index]!;
  const [draft, setDraft] = useState<SiteProfile>(() => structuredClone(source));
  const [sources, setSources] = useState(draft.sourceReferences.join(", "));
  function updateLayer(layerIndex: number, change: (layer: SiteLayer) => SiteLayer): void {
    setDraft((current) => ({ ...current, layers: current.layers.map((layer, candidate) => candidate === layerIndex ? change(layer) : layer) }));
  }
  function save(): void {
    update((next) => {
      const profiles = next.seismicHazardAnalysis.siteResponseAnalysis.profiles;
      const saved = { ...draft, sourceReferences: technicalList(sources) };
      if (index === null) profiles.push(saved);
      else profiles[index] = saved;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicHazardAnalysis.siteResponseAnalysis.profiles.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle="Weighted subsurface profile" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove profile</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save profile</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Profile</h3>
        <FieldGrid>
          <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
          <Field label="Type"><SelectInput value={draft.profileType} options={[
            { value: "BEST_ESTIMATE", label: "Best estimate" },
            { value: "LOWER_BOUND", label: "Lower bound" },
            { value: "UPPER_BOUND", label: "Upper bound" },
            { value: "ALTERNATIVE", label: "Alternative" },
            { value: "BOUNDING_SITE", label: "Bounding site" },
          ]} onChange={(value) => setDraft((current) => ({ ...current, profileType: value as SiteProfile["profileType"] }))} /></Field>
          <Field label="Depth to bedrock (m)"><NumberInput value={draft.depthToBedrock} onChange={(value) => setDraft((current) => ({ ...current, depthToBedrock: value }))} /></Field>
          <Field label="Groundwater depth (m)"><NumberInput value={draft.groundwaterDepth ?? 0} onChange={(value) => setDraft((current) => ({ ...current, groundwaterDepth: value }))} /></Field>
          <Field label="Weight"><NumberInput value={draft.profileWeight ?? 0} onChange={(value) => setDraft((current) => ({ ...current, profileWeight: value }))} /></Field>
        </FieldGrid>
        <Field label="Location"><TextArea rows={2} value={draft.locationDescription} onChange={(value) => setDraft((current) => ({ ...current, locationDescription: value }))} /></Field>
        <Field label="Bedrock definition"><TextArea rows={2} value={draft.bedrockDefinition} onChange={(value) => setDraft((current) => ({ ...current, bedrockDefinition: value }))} /></Field>
        <Field label="Variability basis"><TextArea rows={3} value={draft.siteVariabilityBasis} onChange={(value) => setDraft((current) => ({ ...current, siteVariabilityBasis: value }))} /></Field>
        <Field label="Source references" hint="Separate references with commas."><TextInput value={sources} onChange={setSources} /></Field>
      </div>
      {draft.layers.map((layer, layerIndex) => <div className="sinlineeditor__group" key={layer.uuid}>
        <h3 className="sinlineeditor__title">Layer {layerIndex + 1}</h3>
        <FieldGrid>
          <Field label="Name"><TextInput value={layer.name} onChange={(value) => updateLayer(layerIndex, (current) => ({ ...current, name: value }))} /></Field>
          <Field label="Material"><TextInput value={layer.materialType} onChange={(value) => updateLayer(layerIndex, (current) => ({ ...current, materialType: value }))} /></Field>
          <Field label="Top depth (m)"><NumberInput value={layer.topDepth} onChange={(value) => updateLayer(layerIndex, (current) => ({ ...current, topDepth: value, thickness: current.bottomDepth - value }))} /></Field>
          <Field label="Bottom depth (m)"><NumberInput value={layer.bottomDepth} onChange={(value) => updateLayer(layerIndex, (current) => ({ ...current, bottomDepth: value, thickness: value - current.topDepth }))} /></Field>
          <Field label="Shear-wave velocity (m/s)"><NumberInput value={siteProperty(layer, "SHEAR_WAVE_VELOCITY") ?? 0} onChange={(value) => updateLayer(layerIndex, (current) => setSiteProperty(current, "SHEAR_WAVE_VELOCITY", value, "m/s"))} /></Field>
          <Field label="Density (kg/m3)"><NumberInput value={siteProperty(layer, "DENSITY") ?? 0} onChange={(value) => updateLayer(layerIndex, (current) => setSiteProperty(current, "DENSITY", value, "kg/m3"))} /></Field>
          <Field label="Damping ratio"><NumberInput value={siteProperty(layer, "DAMPING") ?? 0} onChange={(value) => updateLayer(layerIndex, (current) => setSiteProperty(current, "DAMPING", value, "ratio"))} /></Field>
        </FieldGrid>
        <Field label="Spatial variability"><TextArea rows={2} value={layer.spatialVariability} onChange={(value) => updateLayer(layerIndex, (current) => ({ ...current, spatialVariability: value }))} /></Field>
        {editable && draft.layers.length > 1 && <button type="button" className="posnav__btn" onClick={() => setDraft((current) => ({ ...current, layers: current.layers.filter((_, candidate) => candidate !== layerIndex) }))}>Remove layer</button>}
      </div>)}
      {editable && <button type="button" className="posnav__btn" onClick={() => setDraft((current) => ({ ...current, layers: [...current.layers, newSiteLayer(current.layers.length)] }))}>Add layer</button>}
    </fieldset>
  </Drawer>;
}

function SiteResponseSetupEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const [draft, setDraft] = useState<SiteResponseAnalysis>(() => {
    const initial = structuredClone(mef.seismicHazardAnalysis.siteResponseAnalysis);
    if (initial.methods.length === 0) initial.methods.push(newSiteMethod());
    if (initial.inputMotions.length === 0) initial.inputMotions.push(newSiteInputMotion());
    if (initial.uncertainties.length === 0) initial.uncertainties.push(newSiteUncertainty());
    return initial;
  });
  function updateMethod(index: number, change: Partial<SiteMethod>): void {
    setDraft((current) => ({ ...current, methods: current.methods.map((method, candidate) => candidate === index ? { ...method, ...change } : method) }));
  }
  function updateInput(index: number, change: Partial<SiteInputMotion>): void {
    setDraft((current) => ({ ...current, inputMotions: current.inputMotions.map((input, candidate) => candidate === index ? { ...input, ...change } : input) }));
  }
  function updateUncertainty(index: number, change: Partial<SiteUncertainty>): void {
    setDraft((current) => ({ ...current, uncertainties: current.uncertainties.map((uncertainty, candidate) => candidate === index ? { ...uncertainty, ...change } : uncertainty) }));
  }
  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.siteResponseAnalysis = draft;
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Response setup" subtitle="Methods, input motions, and uncertainty" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      {draft.methods.map((method, index) => <div className="sinlineeditor__group" key={method.uuid}>
        <h3 className="sinlineeditor__title">Method {index + 1}</h3>
        <FieldGrid>
          <Field label="Name"><TextInput value={method.name} onChange={(value) => updateMethod(index, { name: value })} /></Field>
          <Field label="Software"><TextInput value={method.softwareAndVersion ?? ""} onChange={(value) => updateMethod(index, { softwareAndVersion: value })} /></Field>
          <Field label="Dimension"><SelectInput value={method.dimension} options={["ONE_DIMENSIONAL", "TWO_DIMENSIONAL", "THREE_DIMENSIONAL"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => updateMethod(index, { dimension: value as SiteMethod["dimension"] })} /></Field>
          <Field label="Analysis type"><SelectInput value={method.analysisType} options={["EQUIVALENT_LINEAR", "NONLINEAR", "RANDOM_VIBRATION_THEORY", "TIME_DOMAIN", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => updateMethod(index, { analysisType: value as SiteMethod["analysisType"] })} /></Field>
        </FieldGrid>
        <Field label="Method"><TextArea rows={3} value={method.methodDescription} onChange={(value) => updateMethod(index, { methodDescription: value })} /></Field>
        <Field label="Dimensionality basis"><TextArea rows={3} value={method.dimensionSelectionBasis} onChange={(value) => updateMethod(index, { dimensionSelectionBasis: value })} /></Field>
        <Field label="Material model"><TextArea rows={3} value={method.materialModelDescription} onChange={(value) => updateMethod(index, { materialModelDescription: value })} /></Field>
        <Field label="Verification and validation"><TextArea rows={3} value={method.verificationAndValidation} onChange={(value) => updateMethod(index, { verificationAndValidation: value })} /></Field>
      </div>)}
      {draft.inputMotions.map((input, index) => <div className="sinlineeditor__group" key={input.uuid}>
        <h3 className="sinlineeditor__title">Input motion {index + 1}</h3>
        <FieldGrid>
          <Field label="Name"><TextInput value={input.name} onChange={(value) => updateInput(index, { name: value })} /></Field>
          <Field label="Type"><SelectInput value={input.inputType} options={["RESPONSE_SPECTRUM", "TIME_HISTORY", "FOURIER_AMPLITUDE_SPECTRUM", "RANDOM_VIBRATION"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => updateInput(index, { inputType: value as SiteInputMotion["inputType"] })} /></Field>
          <Field label="Reference horizon"><TextInput value={input.referenceHorizonRef} onChange={(value) => updateInput(index, { referenceHorizonRef: value })} /></Field>
          <Field label="Motion parameter"><TextInput value={input.groundMotionParameterRef} onChange={(value) => updateInput(index, { groundMotionParameterRef: value })} /></Field>
        </FieldGrid>
        <Field label={`Amplitude levels (${input.units})`} hint="Separate values with commas."><TextInput value={input.amplitudeLevels.join(", ")} onChange={(value) => updateInput(index, { amplitudeLevels: technicalList(value).map(Number).filter(Number.isFinite) })} /></Field>
        <Field label="Selection and scaling"><TextArea rows={3} value={input.selectionAndScalingBasis} onChange={(value) => updateInput(index, { selectionAndScalingBasis: value })} /></Field>
      </div>)}
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Uncertainty sources</h3>
        {draft.uncertainties.map((uncertainty, index) => <div className="sinlineeditor__subgroup" key={uncertainty.uuid}>
          <FieldGrid>
            <Field label="Name"><TextInput value={uncertainty.name} onChange={(value) => updateUncertainty(index, { name: value })} /></Field>
            <Field label="Importance"><SelectInput value={uncertainty.importance ?? "MEDIUM"} options={["LOW", "MEDIUM", "HIGH"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => updateUncertainty(index, { importance: value as SiteUncertainty["importance"] })} /></Field>
          </FieldGrid>
          <Field label="Description"><TextArea rows={2} value={uncertainty.description} onChange={(value) => updateUncertainty(index, { description: value })} /></Field>
          <Field label="Propagation"><TextArea rows={2} value={uncertainty.propagationMethod} onChange={(value) => updateUncertainty(index, { propagationMethod: value })} /></Field>
        </div>)}
      </div>
    </fieldset>
  </Drawer>;
}

function SiteResultEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const site = mef.seismicHazardAnalysis.siteResponseAnalysis;
  const [draft, setDraft] = useState<SiteResult>(() => structuredClone(index === null ? newSiteResult(site) : site.amplificationResults[index]!));
  function save(): void {
    update((next) => {
      const results = next.seismicHazardAnalysis.siteResponseAnalysis.amplificationResults;
      if (index === null) results.push(draft);
      else results[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicHazardAnalysis.siteResponseAnalysis.amplificationResults.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle="Foundation amplification result" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove calculation</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save calculation</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Calculation</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Method"><SelectInput value={draft.methodRef} options={site.methods.map((method) => ({ value: method.uuid, label: method.name }))} onChange={(value) => setDraft((current) => ({ ...current, methodRef: value }))} /></Field>
          <Field label="Input motion"><SelectInput value={draft.inputMotionRef} options={site.inputMotions.map((input) => ({ value: input.uuid, label: input.name }))} onChange={(value) => setDraft((current) => ({ ...current, inputMotionRef: value }))} /></Field>
        </FieldGrid>
        <Field label="Profile references" hint="Separate references with commas."><TextInput value={draft.profileRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, profileRefs: technicalList(value) }))} /></Field>
        <Field label="Weighting and combination"><TextArea rows={3} value={draft.weightingAndCombinationMethod} onChange={(value) => setDraft((current) => ({ ...current, weightingAndCombinationMethod: value }))} /></Field>
        <Field label="Nonlinear effects"><TextArea rows={3} value={draft.nonlinearEffectsTreatment} onChange={(value) => setDraft((current) => ({ ...current, nonlinearEffectsTreatment: value }))} /></Field>
        <Field label="Uncertainty treatment"><TextArea rows={3} value={draft.uncertaintyTreatment} onChange={(value) => setDraft((current) => ({ ...current, uncertaintyTreatment: value }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Amplification points</h3>
        {draft.points.length === 0 ? <EmptyState title="No amplification points" detail="Add the input levels and frequencies calculated by this result." /> : <div className="sresponsepoints"><Table headers={["Input motion", "Frequency (Hz)", "Median", "Log sigma"]} minWidth={0}>
          {draft.points.map((point, pointIndex) => <tr key={`${point.inputGroundMotion}-${point.frequencyHz}-${pointIndex}`}>
            <td><NumberInput value={point.inputGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, points: current.points.map((candidate, indexValue) => indexValue === pointIndex ? { ...candidate, inputGroundMotion: value } : candidate) }))} /></td>
            <td><NumberInput value={point.frequencyHz} onChange={(value) => setDraft((current) => ({ ...current, points: current.points.map((candidate, indexValue) => indexValue === pointIndex ? { ...candidate, frequencyHz: value } : candidate) }))} /></td>
            <td><NumberInput value={point.medianAmplification} onChange={(value) => setDraft((current) => ({ ...current, points: current.points.map((candidate, indexValue) => indexValue === pointIndex ? { ...candidate, medianAmplification: value } : candidate) }))} /></td>
            <td><NumberInput value={point.logarithmicStandardDeviation ?? 0} onChange={(value) => setDraft((current) => ({ ...current, points: current.points.map((candidate, indexValue) => indexValue === pointIndex ? { ...candidate, logarithmicStandardDeviation: value } : candidate) }))} /></td>
          </tr>)}
        </Table></div>}
        {editable && <button type="button" className="posnav__btn" onClick={() => setDraft((current) => ({ ...current, points: [...current.points, { inputGroundMotion: 0, frequencyHz: 0, medianAmplification: 0, logarithmicStandardDeviation: 0 }] }))}>Add point</button>}
      </div>
    </fieldset>
  </Drawer>;
}

function SiteResponseScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const site = mef.seismicHazardAnalysis.siteResponseAnalysis;
  const topography = site.topographyAndGeology;
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [profileIndex, setProfileIndex] = useState<number | null | undefined>(undefined);
  const [resultIndex, setResultIndex] = useState<number | null | undefined>(undefined);
  const profileVelocityRange = (profile: SiteProfile): string => numericRange(profile.layers.map((layer) => siteProperty(layer, "SHEAR_WAVE_VELOCITY")).filter((value): value is number => value !== undefined), "m/s");
  return <>
    <Section title="Site conditions" description="Local conditions that affect ground motion." tone="sha" actions={<EditButton label="Edit conditions" onClick={() => setConditionsOpen(true)} />}>
      <Table headers={["Condition", "Site characterization"]} minWidth={0}>
        <tr><td className="stable__key"><strong>Topography</strong></td><td>{topography.topographicDescription || "Not defined"}</td></tr>
        <tr><td className="stable__key"><strong>Surficial deposits</strong></td><td>{topography.surficialDepositDescription || "Not defined"}</td></tr>
        <tr><td className="stable__key"><strong>Geologic structure</strong></td><td>{topography.geologicStructureDescription || "Not defined"}</td></tr>
        <tr><td className="stable__key"><strong>Topographic effects</strong></td><td>{topography.topographicEffectsTreatment || "Not evaluated"}</td></tr>
      </Table>
    </Section>
    <Section title="Site profiles" description="Weighted subsurface branches used in the response analysis." tone="sha" actions={editable ? <AddButton label="Add profile" onClick={() => setProfileIndex(null)} /> : undefined}>
      {site.profiles.length === 0 ? <EmptyState title="No site profiles" detail="Add the subsurface profiles used by the local response analysis." /> : <Table headers={["Profile", "Layers", "Vs range", "Depths", "Weight"]} minWidth={0}>
        {site.profiles.map((profile, index) => <tr className="postable__row--clickable" key={profile.uuid} onClick={() => setProfileIndex(index)}>
          <td className="stable__key"><strong>{profile.name}</strong><code>{displayLabel(profile.profileType)}</code></td>
          <td>{profile.layers.length}</td>
          <td>{profileVelocityRange(profile)}</td>
          <td><strong>Bedrock {profile.depthToBedrock} {profile.depthUnit}</strong><code>Groundwater {profile.groundwaterDepth === undefined ? "not defined" : `${profile.groundwaterDepth} ${profile.depthUnit}`}</code></td>
          <td>{profile.profileWeight?.toFixed(2) ?? "Not defined"}</td>
        </tr>)}
      </Table>}
    </Section>
    <Section title="Response calculations" description="Foundation amplification across the hazard range." tone="sha" actions={<>
      <EditButton label="Edit setup" onClick={() => setSetupOpen(true)} />
      {editable && <AddButton label="Add calculation" onClick={() => setResultIndex(null)} />}
    </>}>
      {site.amplificationResults.length === 0 ? <EmptyState title="No response calculations" detail="Add an amplification calculation for the foundation control point." /> : <Table headers={["Calculation", "Method", "Analysis range", "Amplification"]} minWidth={0}>
        {site.amplificationResults.map((result, index) => {
          const method = site.methods.find((candidate) => candidate.uuid === result.methodRef);
          const input = site.inputMotions.find((candidate) => candidate.uuid === result.inputMotionRef);
          return <tr className="postable__row--clickable" key={result.uuid} onClick={() => setResultIndex(index)}>
            <td className="stable__key"><strong>{result.name}</strong></td>
            <td><strong>{method?.name ?? "Missing method"}</strong><code>{method === undefined ? result.methodRef : `${displayLabel(method.dimension)} · ${displayLabel(method.analysisType)}`}</code></td>
            <td><strong>{input === undefined ? "Missing input" : numericRange(input.amplitudeLevels, input.units)}</strong><code>{numericRange(result.points.map((point) => point.frequencyHz), "Hz")}</code></td>
            <td><strong>{numericRange(result.points.map((point) => point.medianAmplification))}</strong><code>Log σ {numericRange(result.points.map((point) => point.logarithmicStandardDeviation).filter((value): value is number => value !== undefined))}</code></td>
          </tr>;
        })}
      </Table>}
    </Section>
    {conditionsOpen && <SiteConditionsEditor onClose={() => setConditionsOpen(false)} />}
    {setupOpen && <SiteResponseSetupEditor onClose={() => setSetupOpen(false)} />}
    {profileIndex !== undefined && <SiteProfileEditor index={profileIndex} onClose={() => setProfileIndex(undefined)} />}
    {resultIndex !== undefined && <SiteResultEditor index={resultIndex} onClose={() => setResultIndex(undefined)} />}
  </>;
}

function LineChart({ series, xLabel, yLabel, color = "#315fc7" }: { series: { x: number; y: number }[]; xLabel: string; yLabel: string; color?: string }): JSX.Element {
  if (series.length < 2) return <EmptyState title="No plottable results" detail="At least two result points are required." />;
  const xMin = Math.min(...series.map((point) => point.x)); const xMax = Math.max(...series.map((point) => point.x));
  const yPositive = series.map((point) => point.y).filter((value) => value > 0); const yMin = Math.min(...yPositive); const yMax = Math.max(...yPositive);
  const px = (x: number): number => 50 + ((x - xMin) / Math.max(xMax - xMin, 1e-12)) * 480;
  const py = (y: number): number => 25 + ((Math.log10(yMax) - Math.log10(Math.max(y, yMin))) / Math.max(Math.log10(yMax) - Math.log10(yMin), 1e-12)) * 210;
  const points = series.map((point) => `${px(point.x)},${py(point.y)}`).join(" ");
  return <div className="schart"><svg viewBox="0 0 570 290" role="img" aria-label={`${yLabel} versus ${xLabel}`}><line x1="50" x2="530" y1="235" y2="235" className="schart__axis" /><line x1="50" x2="50" y1="25" y2="235" className="schart__axis" />{[0, .25, .5, .75, 1].map((fraction) => <g key={fraction}><line x1="50" x2="530" y1={25 + fraction * 210} y2={25 + fraction * 210} className="schart__grid" /><text x="43" y={29 + fraction * 210} textAnchor="end">{(10 ** (Math.log10(yMax) - fraction * (Math.log10(yMax) - Math.log10(yMin)))).toExponential(0)}</text></g>)}<polyline points={points} fill="none" stroke={color} strokeWidth="3" />{series.map((point, index) => <circle key={index} cx={px(point.x)} cy={py(point.y)} r="4" fill={color} />)}<text x="290" y="276" textAnchor="middle" className="schart__label">{xLabel}</text><text x="15" y="130" textAnchor="middle" transform="rotate(-90 15 130)" className="schart__label">{yLabel}</text><text x="50" y="253">{xMin}</text><text x="530" y="253" textAnchor="end">{xMax}</text></svg></div>;
}

function LegacyHazardResultsScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const quant = mef.seismicHazardAnalysis.hazardQuantification;
  const spectra = mef.seismicHazardAnalysis.responseSpectraEvaluation;
  const selectedCurve = quant.hazardCurves[0];
  const responseSpectra = [
    ...spectra.horizontalSpectra.map((item, index) => ({ item, index, collection: "horizontalSpectra" as const, kind: "Horizontal", direction: displayLabel(item.direction), detail: item.statistic })),
    ...spectra.verticalSpectra.map((item, index) => ({ item, index, collection: "verticalSpectra" as const, kind: "Vertical", direction: displayLabel(item.direction), detail: item.statistic })),
    ...spectra.foundationInputResponseSpectra.map((item, index) => ({ item, index, collection: "foundationInputResponseSpectra" as const, kind: "Foundation input", direction: item.structureRef, detail: item.derivationMethod })),
  ];
  const [transferOpen, setTransferOpen] = useState(false);
  const [spectraOpen, setSpectraOpen] = useState(false);
  const [resultEditor, setResultEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SHA · HLR-F" title="Hazard curves and discretization" description="Mean and fractile hazard results, deaggregation, calculation runs, uncertainty findings, and non-overlapping intervals are transferred to SPR." tone="sha" actions={editable ? <CategorizedAddButton label="Add hazard result" title="Add hazard result" options={[
      { label: "Hazard curve", description: "A mean, fractile, or branch hazard curve and its result points.", title: "New hazard curve", subtitle: "Ground-motion parameter, control point, statistic, and curve points", createAt: ["seismicHazardAnalysis", "hazardQuantification", "hazardCurves"] },
      { label: "Hazard interval", description: "A non-overlapping discretization interval transferred to SPR.", title: "New hazard interval", subtitle: "Bounds, representative motion, annual frequency, and downstream use", createAt: ["seismicHazardAnalysis", "hazardQuantification", "seismicPraInputs", "hazardIntervals"] },
    ]} onChoose={setResultEditor} /> : undefined}>
      <SectionEditorRow title="Hazard-quantification basis" description="Calculation runs, propagation, deaggregation, transfer basis, sensitivity, and quality controls." onClick={() => setTransferOpen(true)} />
      {selectedCurve !== undefined && <><div className="scharthead"><div><strong>{selectedCurve.name}</strong><span>{selectedCurve.groundMotionParameterRef} · {selectedCurve.controlPointRef}</span></div><Tag tone="sha">{selectedCurve.statistic}</Tag></div><LineChart series={selectedCurve.points.map((point) => ({ x: point.groundMotion, y: point.annualFrequencyOfExceedance }))} xLabel={`Ground motion (${selectedCurve.groundMotionUnits})`} yLabel="Annual frequency of exceedance" /></>}
      <Table caption="Hazard curves" headers={["Hazard curve", "Parameter", "Control point", "Statistic", "Points", ""]}>
        {quant.hazardCurves.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setResultEditor({ title: item.name, subtitle: "Hazard curve definition and result points", focus: ["seismicHazardAnalysis", "hazardQuantification", "hazardCurves", index], removeLabel: "Remove hazard curve" })}><td><strong>{item.name}</strong><code>{displayLabel(item.direction)} · {item.groundMotionUnits}</code></td><td>{item.groundMotionParameterRef}</td><td>{item.controlPointRef}</td><td><Tag tone="sha">{item.statistic}</Tag></td><td>{item.points.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
      <Table caption="Discretization intervals" headers={["Interval", "Lower", "Upper", "Representative", "Annual frequency", ""]}>
        {quant.seismicPraInputs.hazardIntervals.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setResultEditor({ title: item.name, subtitle: "Hazard discretization interval and downstream use", focus: ["seismicHazardAnalysis", "hazardQuantification", "seismicPraInputs", "hazardIntervals", index], removeLabel: "Remove interval" })}><td><strong>{item.name}</strong><code>{item.groundMotionParameterRef} · {item.controlPointRef}</code></td><td>{item.lowerGroundMotion} {item.groundMotionUnits}</td><td>{item.upperGroundMotion} {item.groundMotionUnits}</td><td>{item.representativeGroundMotion} {item.groundMotionUnits}</td><td className="smono">{item.annualFrequency.toExponential(3)}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    <Section eyebrow="SHA · HLR-G" title="Response spectra and control points" description="Horizontal, vertical, foundation-input spectra, spectral-shape bases, and control points retain consistent definitions downstream." tone="sha" actions={editable ? <CategorizedAddButton label="Add spectra entry" title="Add spectra entry" options={[
      { label: "Control point", description: "A shared evaluation location used by spectra and downstream analyses.", title: "New control point", subtitle: "Location, elevation, structures, transfer function, and basis", createAt: ["seismicHazardAnalysis", "responseSpectraEvaluation", "controlPoints"] },
      { label: "Horizontal spectrum", description: "A horizontal response spectrum at a selected control point.", title: "New horizontal spectrum", subtitle: "Control point, direction, statistic, damping, and spectral points", createAt: ["seismicHazardAnalysis", "responseSpectraEvaluation", "horizontalSpectra"] },
      { label: "Vertical spectrum", description: "A vertical response spectrum and its derivation basis.", title: "New vertical spectrum", subtitle: "Control point, direction, statistic, damping, and spectral points", createAt: ["seismicHazardAnalysis", "responseSpectraEvaluation", "verticalSpectra"] },
      { label: "Foundation-input spectrum", description: "A structure-specific FIRS with SSI treatment and applicability.", title: "New foundation-input spectrum", subtitle: "Structure, control point, component spectra, SSI treatment, and applicability", createAt: ["seismicHazardAnalysis", "responseSpectraEvaluation", "foundationInputResponseSpectra"] },
    ]} onChoose={setResultEditor} /> : undefined}>
      <SectionEditorRow title="Response-spectra basis" description="Horizontal and vertical methods, FIRS derivation, spectral-shape bases, and downstream consistency." onClick={() => setSpectraOpen(true)} />
      <Table caption="Control points" headers={["Control point", "Type", "Location", "Structures", ""]}>
        {spectra.controlPoints.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setResultEditor({ title: item.name, subtitle: displayLabel(item.controlPointType), focus: ["seismicHazardAnalysis", "responseSpectraEvaluation", "controlPoints", index], removeLabel: "Remove control point" })}><td><strong>{item.name}</strong><code>{item.basis}</code></td><td>{displayLabel(item.controlPointType)}</td><td>{item.locationDescription}</td><td>{item.applicableStructureRefs?.length ?? 0}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
      <Table caption="Response spectra" headers={["Spectrum", "Kind", "Direction or structure", "Statistic or basis", ""]}>
        {responseSpectra.map(({ item, index, collection, kind, direction, detail }) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setResultEditor({ title: item.name, subtitle: `${kind} response spectrum`, focus: ["seismicHazardAnalysis", "responseSpectraEvaluation", collection, index], removeLabel: "Remove spectrum" })}><td><strong>{item.name}</strong><code>{item.controlPointRef}</code></td><td>{kind}</td><td>{direction}</td><td>{detail}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
      <Narrative label="Downstream consistency" value={spectra.downstreamConsistencyBasis} />
    </Section>
    {transferOpen && <MefEditor tone="sha" title="Hazard quantification" subtitle="Curves, deaggregation, runs, intervals, transfer basis, sensitivity, and uncertainty" focus={["seismicHazardAnalysis", "hazardQuantification"]} onClose={() => setTransferOpen(false)} />}
    {spectraOpen && <MefEditor tone="sha" title="Response spectra evaluation" subtitle="Control points, horizontal and vertical spectra, FIRS, and downstream consistency" focus={["seismicHazardAnalysis", "responseSpectraEvaluation"]} onClose={() => setSpectraOpen(false)} />}
    <CollectionEditor tone="sha" target={resultEditor} onClose={() => setResultEditor(null)} />
  </>;
}

type HazardQuantification = SeismicPRA["seismicHazardAnalysis"]["hazardQuantification"];
type HazardCurve = HazardQuantification["hazardCurves"][number];
type HazardInterval = HazardQuantification["seismicPraInputs"]["hazardIntervals"][number];
type HazardDeaggregation = HazardQuantification["deaggregations"][number];
type HazardSensitivity = HazardQuantification["sensitivityStudies"][number];
type ResponseSpectraEvaluation = SeismicPRA["seismicHazardAnalysis"]["responseSpectraEvaluation"];
type ResponseSpectrum = ResponseSpectraEvaluation["horizontalSpectra"][number];

function annualFrequency(value: number | undefined): string {
  return value === undefined ? "Not defined" : value.toExponential(1);
}

function motionAtFrequency(curve: HazardCurve | undefined, target: number): string {
  const motion = motionValueAtFrequency(curve, target);
  return motion === undefined || curve === undefined
    ? "Not calculated"
    : `${Number(motion.toPrecision(3))} ${curve.groundMotionUnits}`;
}

function HazardCurveFamilyEditor({ parameterRef, onClose }: { parameterRef: string; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const parameter = mef.seismicHazardAnalysis.analysisBasis.groundMotionParameters.find((item) => item.uuid === parameterRef);
  const [draft, setDraft] = useState<HazardCurve[]>(() =>
    structuredClone(mef.seismicHazardAnalysis.hazardQuantification.hazardCurves.filter((curve) => curve.groundMotionParameterRef === parameterRef)),
  );
  function updatePoint(curveIndex: number, pointIndex: number, change: Partial<HazardCurve["points"][number]>): void {
    setDraft((current) => current.map((curve, currentCurveIndex) => currentCurveIndex !== curveIndex ? curve : {
      ...curve,
      points: curve.points.map((point, currentPointIndex) => currentPointIndex === pointIndex ? { ...point, ...change } : point),
    }));
  }
  function save(): void {
    update((next) => {
      const replacements = new Map(draft.map((curve) => [curve.uuid, curve]));
      next.seismicHazardAnalysis.hazardQuantification.hazardCurves =
        next.seismicHazardAnalysis.hazardQuantification.hazardCurves.map((curve) => replacements.get(curve.uuid) ?? curve);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title={parameter?.name ?? parameterRef} subtitle="Mean and fractile hazard curves" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save curves</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      {draft.map((curve, curveIndex) => <div className="sinlineeditor__group" key={curve.uuid}>
        <h3 className="sinlineeditor__title">{curve.statistic === "MEAN" ? "Mean" : `${Math.round((curve.fractile ?? 0) * 100)}th fractile`}</h3>
        <FieldGrid>
          <Field label="Control point"><TextInput value={curve.controlPointRef} onChange={(value) => setDraft((current) => current.map((item, index) => index === curveIndex ? { ...item, controlPointRef: value } : item))} /></Field>
          <Field label="Calculation run"><TextInput value={curve.calculationRunRef} onChange={(value) => setDraft((current) => current.map((item, index) => index === curveIndex ? { ...item, calculationRunRef: value } : item))} /></Field>
        </FieldGrid>
        <Table headers={["Ground motion", "Annual frequency"]} minWidth={0}>
          {curve.points.map((point, pointIndex) => <tr key={`${curve.uuid}-${pointIndex}`}>
            <td><NumberInput value={point.groundMotion} onChange={(value) => updatePoint(curveIndex, pointIndex, { groundMotion: value })} /></td>
            <td><NumberInput value={point.annualFrequencyOfExceedance} onChange={(value) => updatePoint(curveIndex, pointIndex, { annualFrequencyOfExceedance: value })} /></td>
          </tr>)}
        </Table>
      </div>)}
    </fieldset>
  </Drawer>;
}

function HazardIntervalEditor({ index, onClose }: { index: number; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const [draft, setDraft] = useState<HazardInterval>(() =>
    structuredClone(mef.seismicHazardAnalysis.hazardQuantification.seismicPraInputs.hazardIntervals[index]!),
  );
  function save(): void {
    update((next) => {
      const inputs = next.seismicHazardAnalysis.hazardQuantification.seismicPraInputs;
      inputs.hazardIntervals[index] = draft;
      inputs.plantResponseInputRefs = inputs.hazardIntervals.map((item) => item.uuid);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle="PRA hazard bin" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save bin</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Lower motion"><NumberInput value={draft.lowerGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, lowerGroundMotion: value }))} /></Field>
          <Field label="Upper motion"><NumberInput value={draft.upperGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, upperGroundMotion: value }))} /></Field>
          <Field label="Representative motion"><NumberInput value={draft.representativeGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, representativeGroundMotion: value }))} /></Field>
          <Field label="Annual frequency"><NumberInput value={draft.annualFrequency} onChange={(value) => setDraft((current) => ({ ...current, annualFrequency: value }))} /></Field>
        </FieldGrid>
        <Field label="Frequency calculation"><TextArea rows={3} value={draft.frequencyCalculationMethod} onChange={(value) => setDraft((current) => ({ ...current, frequencyCalculationMethod: value }))} /></Field>
        <FieldGrid>
          <Field label="Horizontal curve"><TextInput value={draft.sourceHazardCurveRef} onChange={(value) => setDraft((current) => ({ ...current, sourceHazardCurveRef: value }))} /></Field>
          <Field label="Vertical motion"><TextInput value={draft.verticalMotionRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, verticalMotionRef: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Secondary-hazard results" hint="Separate references with commas."><TextInput value={(draft.secondaryHazardResultRefs ?? []).join(", ")} onChange={(value) => setDraft((current) => ({ ...current, secondaryHazardResultRefs: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function DeaggregationEditor({ index, onClose }: { index: number; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const [draft, setDraft] = useState<HazardDeaggregation>(() =>
    structuredClone(mef.seismicHazardAnalysis.hazardQuantification.deaggregations[index]!),
  );
  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.hazardQuantification.deaggregations[index] = draft;
    });
    onClose();
  }
  const updateContribution = (
    collection: "sourceContributions" | "groundMotionModelContributions",
    contributionIndex: number,
    change: Partial<HazardDeaggregation["sourceContributions"][number]>,
  ): void => setDraft((current) => ({
    ...current,
    [collection]: current[collection].map((item, itemIndex) => itemIndex === contributionIndex ? { ...item, ...change } : item),
  }));
  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle="Magnitude, distance, source, and model contributions" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save deaggregation</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Hazard level</h3>
        <FieldGrid>
          <Field label="Ground motion"><NumberInput value={draft.groundMotionLevel} onChange={(value) => setDraft((current) => ({ ...current, groundMotionLevel: value }))} /></Field>
          <Field label="Annual frequency"><NumberInput value={draft.annualFrequencyOfExceedance ?? 0} onChange={(value) => setDraft((current) => ({ ...current, annualFrequencyOfExceedance: value }))} /></Field>
          <Field label="Mean magnitude"><NumberInput value={draft.meanMagnitude} onChange={(value) => setDraft((current) => ({ ...current, meanMagnitude: value }))} /></Field>
          <Field label="Mean distance (km)"><NumberInput value={draft.meanDistanceKm} onChange={(value) => setDraft((current) => ({ ...current, meanDistanceKm: value }))} /></Field>
        </FieldGrid>
      </div>
      {(["sourceContributions", "groundMotionModelContributions"] as const).map((collection) => <div className="sinlineeditor__group" key={collection}>
        <h3 className="sinlineeditor__title">{collection === "sourceContributions" ? "Source contributions" : "Ground-motion model contributions"}</h3>
        <Table headers={["Contributor", "Fraction"]} minWidth={0}>
          {draft[collection].map((item, contributionIndex) => <tr key={`${collection}-${item.contributorRef}`}>
            <td><TextInput value={item.contributorName} onChange={(value) => updateContribution(collection, contributionIndex, { contributorName: value })} /></td>
            <td><NumberInput value={item.contributionFraction} onChange={(value) => updateContribution(collection, contributionIndex, { contributionFraction: value })} /></td>
          </tr>)}
        </Table>
      </div>)}
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Magnitude-distance bins</h3>
        <Table headers={["Magnitude", "Distance (km)", "Fraction"]} minWidth={0}>
          {draft.magnitudeDistanceBins.map((bin, binIndex) => <tr key={`${bin.magnitudeLower}-${bin.distanceLowerKm}-${binIndex}`}>
            <td>{bin.magnitudeLower} to {bin.magnitudeUpper}</td>
            <td>{bin.distanceLowerKm} to {bin.distanceUpperKm}</td>
            <td><NumberInput value={bin.contributionFraction} onChange={(value) => setDraft((current) => ({ ...current, magnitudeDistanceBins: current.magnitudeDistanceBins.map((item, itemIndex) => itemIndex === binIndex ? { ...item, contributionFraction: value } : item) }))} /></td>
          </tr>)}
        </Table>
      </div>
    </fieldset>
  </Drawer>;
}

function ResponseSpectrumEditor({ direction, index, onClose }: { direction: "horizontal" | "vertical"; index: number; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const spectra = mef.seismicHazardAnalysis.responseSpectraEvaluation;
  const source = direction === "horizontal" ? spectra.horizontalSpectra[index]! : spectra.verticalSpectra[index]!;
  const [draft, setDraft] = useState<ResponseSpectrum>(() => structuredClone(source));
  const [horizontalBasis, setHorizontalBasis] = useState(() =>
    structuredClone(spectra.horizontalShapeBases.find((item) => item.spectrumRef === source.uuid)),
  );
  const [verticalBasis, setVerticalBasis] = useState(() =>
    structuredClone(spectra.verticalSpectrumBases.find((item) => item.spectrumRef === source.uuid)),
  );
  function save(): void {
    update((next) => {
      const evaluation = next.seismicHazardAnalysis.responseSpectraEvaluation;
      if (direction === "horizontal") evaluation.horizontalSpectra[index] = draft;
      else evaluation.verticalSpectra[index] = draft;
      if (horizontalBasis !== undefined) {
        const basisIndex = evaluation.horizontalShapeBases.findIndex((item) => item.uuid === horizontalBasis.uuid);
        if (basisIndex >= 0) evaluation.horizontalShapeBases[basisIndex] = horizontalBasis;
      }
      if (verticalBasis !== undefined) {
        const basisIndex = evaluation.verticalSpectrumBases.findIndex((item) => item.uuid === verticalBasis.uuid);
        if (basisIndex >= 0) evaluation.verticalSpectrumBases[basisIndex] = verticalBasis;
      }
      next.seismicHazardAnalysis.hazardQuantification.uniformHazardSpectra =
        [...evaluation.horizontalSpectra, ...evaluation.verticalSpectra];
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle={`${displayLabel(draft.direction)} response spectrum`} plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save spectrum</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Spectrum</h3>
        <FieldGrid>
          <Field label="Annual frequency"><NumberInput value={draft.annualFrequencyOfExceedance ?? 0} onChange={(value) => setDraft((current) => ({ ...current, annualFrequencyOfExceedance: value }))} /></Field>
          <Field label="Damping ratio"><NumberInput value={draft.dampingRatio} onChange={(value) => setDraft((current) => ({ ...current, dampingRatio: value }))} /></Field>
        </FieldGrid>
        <Field label="Derivation"><TextArea rows={3} value={draft.derivationMethod} onChange={(value) => setDraft((current) => ({ ...current, derivationMethod: value }))} /></Field>
        <Table headers={["Period (s)", "Frequency (Hz)", "Acceleration (g)"]} minWidth={0}>
          {draft.points.map((point, pointIndex) => <tr key={`${point.periodSeconds}-${pointIndex}`}>
            <td><NumberInput value={point.periodSeconds} onChange={(value) => setDraft((current) => ({ ...current, points: current.points.map((item, itemIndex) => itemIndex === pointIndex ? { ...item, periodSeconds: value } : item) }))} /></td>
            <td><NumberInput value={point.frequencyHz} onChange={(value) => setDraft((current) => ({ ...current, points: current.points.map((item, itemIndex) => itemIndex === pointIndex ? { ...item, frequencyHz: value } : item) }))} /></td>
            <td><NumberInput value={point.spectralAcceleration} onChange={(value) => setDraft((current) => ({ ...current, points: current.points.map((item, itemIndex) => itemIndex === pointIndex ? { ...item, spectralAcceleration: value } : item) }))} /></td>
          </tr>)}
        </Table>
      </div>
      {horizontalBasis !== undefined && <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Site-specific horizontal shape</h3>
        <FieldGrid>
          <Field label="Mean magnitude"><NumberInput value={horizontalBasis.meanMagnitude} onChange={(value) => setHorizontalBasis((current) => current === undefined ? current : { ...current, meanMagnitude: value })} /></Field>
          <Field label="Mean distance (km)"><NumberInput value={horizontalBasis.meanDistanceKm} onChange={(value) => setHorizontalBasis((current) => current === undefined ? current : { ...current, meanDistanceKm: value })} /></Field>
        </FieldGrid>
        <Field label="Evaluation basis"><TextArea rows={4} value={horizontalBasis.evaluationBasis} onChange={(value) => setHorizontalBasis((current) => current === undefined ? current : { ...current, evaluationBasis: value })} /></Field>
      </div>}
      {verticalBasis !== undefined && <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Vertical-motion method</h3>
        <Field label="Method"><TextArea rows={3} value={verticalBasis.methodDescription} onChange={(value) => setVerticalBasis((current) => current === undefined ? current : { ...current, methodDescription: value })} /></Field>
        <Field label="State of knowledge"><TextArea rows={4} value={verticalBasis.stateOfKnowledgeAssessment} onChange={(value) => setVerticalBasis((current) => current === undefined ? current : { ...current, stateOfKnowledgeAssessment: value })} /></Field>
        <Field label="Why it is appropriate"><TextArea rows={4} value={verticalBasis.appropriatenessJustification} onChange={(value) => setVerticalBasis((current) => current === undefined ? current : { ...current, appropriatenessJustification: value })} /></Field>
      </div>}
    </fieldset>
  </Drawer>;
}

function HazardBasisEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const quantification = mef.seismicHazardAnalysis.hazardQuantification;
  const [draft, setDraft] = useState(() => ({
    uncertaintyPropagationMethod: quantification.uncertaintyPropagationMethod,
    aleatoryUncertaintiesPropagated: quantification.aleatoryUncertaintiesPropagated,
    epistemicUncertaintiesPropagated: quantification.epistemicUncertaintiesPropagated,
    transferBasis: quantification.seismicPraInputs.transferBasis,
    consistencyChecks: quantification.seismicPraInputs.consistencyChecks,
  }));
  function save(): void {
    update((next) => {
      const quant = next.seismicHazardAnalysis.hazardQuantification;
      quant.uncertaintyPropagationMethod = draft.uncertaintyPropagationMethod;
      quant.aleatoryUncertaintiesPropagated = draft.aleatoryUncertaintiesPropagated;
      quant.epistemicUncertaintiesPropagated = draft.epistemicUncertaintiesPropagated;
      quant.seismicPraInputs.transferBasis = draft.transferBasis;
      quant.seismicPraInputs.consistencyChecks = draft.consistencyChecks;
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Hazard calculation basis" subtitle="Uncertainty propagation and PRA transfer" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save basis</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Uncertainty propagation</h3>
        <div className="sinlineeditor__checks">
          <label><input type="checkbox" checked={draft.aleatoryUncertaintiesPropagated} onChange={(event) => setDraft((current) => ({ ...current, aleatoryUncertaintiesPropagated: event.target.checked }))} /> Aleatory uncertainty propagated</label>
          <label><input type="checkbox" checked={draft.epistemicUncertaintiesPropagated} onChange={(event) => setDraft((current) => ({ ...current, epistemicUncertaintiesPropagated: event.target.checked }))} /> Epistemic uncertainty propagated</label>
        </div>
        <Field label="Method"><TextArea rows={4} value={draft.uncertaintyPropagationMethod} onChange={(value) => setDraft((current) => ({ ...current, uncertaintyPropagationMethod: value }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">PRA transfer</h3>
        <Field label="Transfer basis"><TextArea rows={4} value={draft.transferBasis} onChange={(value) => setDraft((current) => ({ ...current, transferBasis: value }))} /></Field>
        <Field label="Consistency checks" hint="One check per line."><TextArea rows={7} value={draft.consistencyChecks.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, consistencyChecks: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function HazardSensitivityEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const quantification = mef.seismicHazardAnalysis.hazardQuantification;
  const [studies, setStudies] = useState<HazardSensitivity[]>(() => structuredClone(quantification.sensitivityStudies));
  const [findings, setFindings] = useState(() => structuredClone(quantification.keyUncertaintyFindings));
  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.hazardQuantification.sensitivityStudies = studies;
      next.seismicHazardAnalysis.hazardQuantification.keyUncertaintyFindings = findings;
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Uncertainty sensitivities" subtitle="Studies that can change hazard or PRA results" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save studies</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      {studies.map((study, index) => {
        const findingIndex = findings.findIndex((finding) => finding.sensitivityStudyRefs.includes(study.uuid));
        const finding = findings[findingIndex];
        return <div className="sinlineeditor__group" key={study.uuid}>
          <h3 className="sinlineeditor__title">{study.name ?? `Sensitivity ${index + 1}`}</h3>
          <FieldGrid>
            <Field label="Study"><TextInput value={study.name ?? ""} onChange={(value) => setStudies((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: value } : item))} /></Field>
            <Field label="Importance"><SelectInput value={finding?.importance ?? "LOW"} options={["LOW", "MEDIUM", "HIGH"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => findingIndex >= 0 && setFindings((current) => current.map((item, itemIndex) => itemIndex === findingIndex ? { ...item, importance: value as typeof item.importance } : item))} /></Field>
          </FieldGrid>
          <Field label="Varied parameters" hint="Separate values with commas."><TextInput value={study.variedParameters.join(", ")} onChange={(value) => setStudies((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, variedParameters: technicalList(value) } : item))} /></Field>
          <Field label="Hazard effect"><TextArea rows={2} value={study.results ?? ""} onChange={(value) => setStudies((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, results: value } : item))} /></Field>
          <Field label="PRA impact"><TextArea rows={2} value={study.impact ?? ""} onChange={(value) => setStudies((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, impact: value } : item))} /></Field>
        </div>;
      })}
    </fieldset>
  </Drawer>;
}

function chartTick(value: number): string {
  if (value === 0) return "0";
  if (Math.abs(value) < 0.001 || Math.abs(value) >= 1000) {
    return value.toExponential(0);
  }
  return Number(value.toPrecision(3)).toString();
}

function geometricBlend(lower: number, upper: number, fraction: number): number {
  if (lower <= 0 || upper <= 0) return lower + (upper - lower) * fraction;
  return Math.exp(Math.log(lower) + (Math.log(upper) - Math.log(lower)) * fraction);
}

function DistributionFanChart({
  points,
  xLabel,
  yLabel,
  ariaLabel,
  yScale = "linear",
}: {
  points: HazardFanPoint[];
  xLabel: string;
  yLabel: string;
  ariaLabel: string;
  yScale?: "linear" | "log";
}): JSX.Element {
  const sorted = [...points]
    .filter((point) =>
      point.x > 0
      && point.low > 0
      && point.median > 0
      && point.mean > 0
      && point.high > 0)
    .sort((left, right) => left.x - right.x)
    .map((point) => ({
      ...point,
      innerLow: geometricBlend(point.low, point.median, 4 / 9),
      innerHigh: geometricBlend(point.median, point.high, 5 / 9),
    }));
  if (sorted.length < 2) {
    return <EmptyState title="Distribution unavailable" detail="Mean, 5th, 50th, and 95th-fractile curves are required." />;
  }

  const left = 62;
  const right = 654;
  const top = 22;
  const bottom = 264;
  const xMin = Math.min(...sorted.map((point) => point.x));
  const xMax = Math.max(...sorted.map((point) => point.x));
  const observedYMin = Math.min(...sorted.flatMap((point) => [point.low, point.median, point.mean, point.high]));
  const observedYMax = Math.max(...sorted.flatMap((point) => [point.low, point.median, point.mean, point.high]));
  const yMin = yScale === "log" ? observedYMin : 0;
  const yMax = yScale === "log" ? observedYMax : observedYMax * 1.08;
  const transform = (value: number, scale: "linear" | "log"): number =>
    scale === "log" ? Math.log10(value) : value;
  const xLow = transform(xMin, "log");
  const xHigh = transform(xMax, "log");
  const yLow = transform(yMin, yScale);
  const yHigh = transform(yMax, yScale);
  const xPosition = (value: number): number =>
    left + ((transform(value, "log") - xLow) / Math.max(xHigh - xLow, 1e-12)) * (right - left);
  const yPosition = (value: number): number =>
    bottom - ((transform(value, yScale) - yLow) / Math.max(yHigh - yLow, 1e-12)) * (bottom - top);
  const linePoints = (key: "low" | "median" | "mean" | "high"): string =>
    sorted.map((point) => `${xPosition(point.x)},${yPosition(point[key])}`).join(" ");
  const bandPoints = (lowerKey: "low" | "innerLow", upperKey: "high" | "innerHigh"): string =>
    [
      ...sorted.map((point) => `${xPosition(point.x)},${yPosition(point[upperKey])}`),
      ...[...sorted].reverse().map((point) => `${xPosition(point.x)},${yPosition(point[lowerKey])}`),
    ].join(" ");
  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const xTickValue = (fraction: number): number =>
    10 ** (xLow + fraction * (xHigh - xLow));
  const yTickValue = (fraction: number): number => {
    const transformed = yLow + fraction * (yHigh - yLow);
    return yScale === "log" ? 10 ** transformed : transformed;
  };

  return <div className="sdistribution">
    <div className="sdistribution__legend" aria-hidden="true">
      <span><i className="sdistribution__swatch sdistribution__swatch--outer" />5th–95th</span>
      <span><i className="sdistribution__swatch sdistribution__swatch--inner" />25th–75th</span>
      <span><i className="sdistribution__line sdistribution__line--median" />Median</span>
      <span><i className="sdistribution__line sdistribution__line--mean" />Mean</span>
    </div>
    <div className="schart schart--distribution">
      <svg viewBox="0 0 700 310" role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>
        {tickFractions.map((fraction) => {
          const y = bottom - fraction * (bottom - top);
          return <g key={`y-${fraction}`}>
            <line x1={left} x2={right} y1={y} y2={y} className="schart__grid" />
            <text x={left - 9} y={y + 3} textAnchor="end">{chartTick(yTickValue(fraction))}</text>
          </g>;
        })}
        {tickFractions.map((fraction) => {
          const x = left + fraction * (right - left);
          return <g key={`x-${fraction}`}>
            <line x1={x} x2={x} y1={top} y2={bottom} className="schart__grid" />
            <text x={x} y={bottom + 17} textAnchor="middle">{chartTick(xTickValue(fraction))}</text>
          </g>;
        })}
        <polygon points={bandPoints("low", "high")} className="schart__fan schart__fan--outer" />
        <polygon points={bandPoints("innerLow", "innerHigh")} className="schart__fan schart__fan--inner" />
        <polyline points={linePoints("low")} className="schart__fractile" />
        <polyline points={linePoints("high")} className="schart__fractile" />
        <polyline points={linePoints("median")} className="schart__median" />
        <polyline points={linePoints("mean")} className="schart__mean" />
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="schart__axis" />
        <line x1={left} x2={left} y1={top} y2={bottom} className="schart__axis" />
        <text x={(left + right) / 2} y="304" textAnchor="middle" className="schart__label">{xLabel}</text>
        <text x="15" y={(top + bottom) / 2} textAnchor="middle" transform={`rotate(-90 15 ${(top + bottom) / 2})`} className="schart__label">{yLabel}</text>
      </svg>
    </div>
  </div>;
}

function HazardResultsScreen(): JSX.Element {
  const { mef } = useUpdate();
  const sha = mef.seismicHazardAnalysis;
  const quant = sha.hazardQuantification;
  const spectra = sha.responseSpectraEvaluation;
  const parameters = sha.analysisBasis.groundMotionParameters;
  const [basisOpen, setBasisOpen] = useState(false);
  const [curveParameter, setCurveParameter] = useState<string | null>(null);
  const [intervalIndex, setIntervalIndex] = useState<number | null>(null);
  const [deaggregationIndex, setDeaggregationIndex] = useState<number | null>(null);
  const [spectrumTarget, setSpectrumTarget] = useState<{ direction: "horizontal" | "vertical"; index: number } | null>(null);
  const [sensitivitiesOpen, setSensitivitiesOpen] = useState(false);
  const [hazardChartParameter, setHazardChartParameter] = useState(
    parameters.find((parameter) => parameter.uuid === "GMP-SA-1HZ")?.uuid
      ?? parameters[0]?.uuid
      ?? "",
  );
  const [spectrumChartDirection, setSpectrumChartDirection] =
    useState<SpectrumDirection>("HORIZONTAL");
  const [spectrumChartFrequency, setSpectrumChartFrequency] = useState(1e-4);
  const hazardChartPoints = useMemo(
    () => hazardCurveFanSeries(mef, hazardChartParameter),
    [hazardChartParameter, mef],
  );
  const spectrumChartPoints = useMemo(
    () => responseSpectrumFanSeries(
      mef,
      spectrumChartDirection,
      spectrumChartFrequency,
    ),
    [mef, spectrumChartDirection, spectrumChartFrequency],
  );
  const spectrumFrequencies = useMemo(
    () => Array.from(new Set(
      spectra.horizontalSpectra
        .map((spectrum) => spectrum.annualFrequencyOfExceedance)
        .filter((frequency): frequency is number => frequency !== undefined),
    )).sort((left, right) => right - left),
    [spectra.horizontalSpectra],
  );
  const parameterName = (reference: string): string =>
    parameters.find((parameter) => parameter.uuid === reference)?.name ?? reference;
  return <>
    <Section title="Hazard curves" description="Mean and fractile hazard for every defined motion." tone="sha" actions={<EditButton label="Edit basis" onClick={() => setBasisOpen(true)} />}>
      <div className="sdistribution__head">
        <div><strong>Hazard distribution</strong><span>Outer and central uncertainty bands across the calculated curve family.</span></div>
        <label className="splotselect"><span>Ground-motion parameter</span><select className="sinput" aria-label="Hazard chart ground-motion parameter" value={hazardChartParameter} onChange={(event) => setHazardChartParameter(event.target.value)}>
          {parameters.map((parameter) => <option key={parameter.uuid} value={parameter.uuid}>{parameter.name}</option>)}
        </select></label>
      </div>
      <DistributionFanChart points={hazardChartPoints} xLabel="Ground motion (g, log scale)" yLabel="Annual frequency (log scale)" yScale="log" ariaLabel={`${parameterName(hazardChartParameter)} hazard distribution from the 5th through 95th fractiles`} />
      {parameters.length === 0 ? <EmptyState title="No motion parameters" detail="Define the ground-motion parameters in Step 02 first." /> : <Table headers={["Ground-motion parameter", "1E-4 motion", "1E-5 motion", "Curve set", "Range"]} minWidth={0} columnWidths={["34%", "16%", "16%", "18%", "16%"]}>
        {parameters.map((parameter) => {
          const curves = quant.hazardCurves.filter((curve) => curve.groundMotionParameterRef === parameter.uuid);
          const meanCurve = curves.find((curve) => curve.statistic === "MEAN");
          return <tr className="postable__row--clickable" key={parameter.uuid} onClick={() => setCurveParameter(parameter.uuid)}>
            <td className="stable__key"><strong>{parameter.name}</strong><code>{displayLabel(parameter.direction)} · {parameter.uuid}</code></td>
            <td><strong>{motionAtFrequency(meanCurve, 1e-4)}</strong></td>
            <td>{motionAtFrequency(meanCurve, 1e-5)}</td>
            <td>{curves.length === 0 ? "None" : `Mean + ${curves.filter((curve) => curve.statistic === "FRACTILE").length} fractiles`}</td>
            <td>{meanCurve === undefined ? "Not calculated" : numericRange(meanCurve.points.map((point) => point.groundMotion), meanCurve.groundMotionUnits)}</td>
          </tr>;
        })}
      </Table>}
      <Table caption="Calculation runs" headers={["Run", "Software", "Logic-tree branches", "Annual-frequency range", "Checks"]} minWidth={0} columnWidths={["28%", "18%", "18%", "24%", "12%"]}>
        {quant.calculationRuns.map((run) => <tr key={run.uuid}>
          <td className="stable__key"><strong>{run.name}</strong><code>{run.calculationDate}</code></td>
          <td>{run.software} {run.softwareVersion}</td>
          <td>{run.logicTreeEndBranchCount?.toLocaleString() ?? "Not defined"}</td>
          <td>{annualFrequency(run.annualFrequencyRange.maximum)} to {annualFrequency(run.annualFrequencyRange.minimum)}</td>
          <td>{run.verificationChecks.length}</td>
        </tr>)}
      </Table>
    </Section>

    <Section title="PRA bins" description="Non-overlapping inputs passed to plant response." tone="sha">
      {quant.seismicPraInputs.hazardIntervals.length === 0 ? <EmptyState title="No PRA bins" detail="Discretize the mean hazard curve for plant-response quantification." /> : <Table headers={["Bin", "Motion range", "Representative", "Annual frequency", "Coupled results"]} minWidth={0} columnWidths={["18%", "20%", "18%", "17%", "27%"]}>
        {quant.seismicPraInputs.hazardIntervals.map((interval, index) => <tr className="postable__row--clickable" key={interval.uuid} onClick={() => setIntervalIndex(index)}>
          <td className="stable__key"><strong>{interval.name}</strong></td>
          <td>{interval.lowerGroundMotion} to {interval.upperGroundMotion} {interval.groundMotionUnits}</td>
          <td><strong>{interval.representativeGroundMotion} {interval.groundMotionUnits}</strong></td>
          <td className="smono">{interval.annualFrequency.toExponential(2)}</td>
          <td><strong>{interval.verticalMotionRef === undefined ? "No vertical motion" : "Vertical motion included"}</strong><code>{(interval.secondaryHazardResultRefs ?? []).length === 0 ? "No secondary hazard" : "Secondary hazard included"}</code></td>
        </tr>)}
      </Table>}
    </Section>

    <Section title="Deaggregation" description="What controls important hazard levels." tone="sha">
      {quant.deaggregations.length === 0 ? <EmptyState title="No deaggregation results" detail="Calculate magnitude, distance, source, and model contributions at important motion levels." /> : <Table headers={["Hazard level", "Annual frequency", "Mean magnitude", "Mean distance", "Top source", "Top model"]} minWidth={0} columnWidths={["25%", "14%", "12%", "12%", "19%", "18%"]}>
        {quant.deaggregations.map((result, index) => <tr className="postable__row--clickable" key={result.uuid} onClick={() => setDeaggregationIndex(index)}>
          <td className="stable__key"><strong>{parameterName(result.groundMotionParameterRef)}</strong><code>{result.groundMotionLevel} {result.groundMotionUnits}</code></td>
          <td className="smono">{annualFrequency(result.annualFrequencyOfExceedance)}</td>
          <td>{result.meanMagnitude.toFixed(2)}</td>
          <td>{result.meanDistanceKm.toFixed(1)} km</td>
          <td><strong>{result.sourceContributions[0]?.contributorName ?? "None"}</strong><code>{((result.sourceContributions[0]?.contributionFraction ?? 0) * 100).toFixed(0)}%</code></td>
          <td><strong>{result.groundMotionModelContributions[0]?.contributorName ?? "None"}</strong><code>{((result.groundMotionModelContributions[0]?.contributionFraction ?? 0) * 100).toFixed(0)}%</code></td>
        </tr>)}
      </Table>}
    </Section>

    <Section title="Response spectra" description="Horizontal, vertical, and foundation inputs." tone="sha">
      <div className="sdistribution__head">
        <div><strong>Response spectrum distribution</strong><span>Fractile bands derived at the selected annual exceedance frequency.</span></div>
        <div className="splotselects">
          <label className="splotselect"><span>Direction</span><select className="sinput" aria-label="Response spectrum chart direction" value={spectrumChartDirection} onChange={(event) => setSpectrumChartDirection(event.target.value as SpectrumDirection)}>
            <option value="HORIZONTAL">Horizontal</option>
            <option value="VERTICAL">Vertical</option>
          </select></label>
          <label className="splotselect"><span>Annual frequency</span><select className="sinput" aria-label="Response spectrum chart annual frequency" value={spectrumChartFrequency} onChange={(event) => setSpectrumChartFrequency(Number(event.target.value))}>
            {spectrumFrequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency.toExponential(0)}</option>)}
          </select></label>
        </div>
      </div>
      <DistributionFanChart points={spectrumChartPoints} xLabel="Period (seconds, log scale)" yLabel="Spectral acceleration (g)" ariaLabel={`${displayLabel(spectrumChartDirection)} response spectrum distribution at ${spectrumChartFrequency.toExponential(0)} annual frequency`} />
      <Table headers={["Spectrum", "Direction", "Annual frequency", "Acceleration range", "Technical basis"]} minWidth={0} columnWidths={["30%", "12%", "16%", "18%", "24%"]}>
        {spectra.horizontalSpectra.map((spectrum, index) => {
          const basis = spectra.horizontalShapeBases.find((item) => item.spectrumRef === spectrum.uuid);
          return <tr className="postable__row--clickable" key={spectrum.uuid} onClick={() => setSpectrumTarget({ direction: "horizontal", index })}>
            <td className="stable__key"><strong>{spectrum.name}</strong><code>{(spectrum.dampingRatio * 100).toFixed(0)}% · {spectrum.controlPointRef}</code></td>
            <td>Horizontal</td>
            <td className="smono">{annualFrequency(spectrum.annualFrequencyOfExceedance)}</td>
            <td>{numericRange(spectrum.points.map((point) => point.spectralAcceleration), "g")}</td>
            <td>{basis === undefined ? "UHS interpolation" : `Site-specific M ${basis.meanMagnitude.toFixed(2)}, R ${basis.meanDistanceKm.toFixed(0)} km`}</td>
          </tr>;
        })}
        {spectra.verticalSpectra.map((spectrum, index) => {
          const basis = spectra.verticalSpectrumBases.find((item) => item.spectrumRef === spectrum.uuid);
          return <tr className="postable__row--clickable" key={spectrum.uuid} onClick={() => setSpectrumTarget({ direction: "vertical", index })}>
            <td className="stable__key"><strong>{spectrum.name}</strong><code>{(spectrum.dampingRatio * 100).toFixed(0)}% · {spectrum.controlPointRef}</code></td>
            <td>Vertical</td>
            <td className="smono">{annualFrequency(spectrum.annualFrequencyOfExceedance)}</td>
            <td>{numericRange(spectrum.points.map((point) => point.spectralAcceleration), "g")}</td>
            <td>{basis === undefined ? "Not defined" : displayLabel(basis.methodType)}</td>
          </tr>;
        })}
      </Table>
      <Table caption="Foundation inputs" headers={["Input", "Structure", "Horizontal spectrum", "Vertical spectrum", "Control point"]} minWidth={0} columnWidths={["24%", "20%", "19%", "19%", "18%"]}>
        {spectra.foundationInputResponseSpectra.map((input) => <tr key={input.uuid}>
          <td className="stable__key"><strong>{input.name}</strong></td>
          <td>{input.structureRef}</td>
          <td>{input.horizontalSpectrumRefs.join(", ")}</td>
          <td>{input.verticalSpectrumRef ?? "None"}</td>
          <td>{input.controlPointRef}</td>
        </tr>)}
      </Table>
    </Section>

    <Section title="Uncertainty sensitivities" description="Uncertainties that can change PRA results." tone="sha" actions={<EditButton label="Edit studies" onClick={() => setSensitivitiesOpen(true)} />}>
      {quant.sensitivityStudies.length === 0 ? <EmptyState title="No sensitivity studies" detail="Evaluate source, ground-motion, site-response, vertical-motion, and secondary-hazard uncertainties." /> : <Table headers={["Study", "Area", "Varied parameters", "Hazard effect", "PRA importance"]} minWidth={0} columnWidths={["20%", "12%", "22%", "34%", "12%"]}>
        {quant.sensitivityStudies.map((study) => {
          const finding = quant.keyUncertaintyFindings.find((item) => item.sensitivityStudyRefs.includes(study.uuid));
          return <tr key={study.uuid}>
            <td className="stable__key"><strong>{study.name ?? study.uuid}</strong></td>
            <td>{displayLabel(String(study.elementSpecificProperties?.analysisArea ?? finding?.analysisArea ?? "Not defined"))}</td>
            <td>{study.variedParameters.join(", ")}</td>
            <td>{study.results ?? "Not evaluated"}</td>
            <td><Tag tone={finding?.importance === "HIGH" ? "warn" : finding?.importance === "MEDIUM" ? "sha" : "neutral"}>{finding?.importance ?? "Not ranked"}</Tag></td>
          </tr>;
        })}
      </Table>}
    </Section>

    {basisOpen && <HazardBasisEditor onClose={() => setBasisOpen(false)} />}
    {curveParameter !== null && <HazardCurveFamilyEditor parameterRef={curveParameter} onClose={() => setCurveParameter(null)} />}
    {intervalIndex !== null && <HazardIntervalEditor index={intervalIndex} onClose={() => setIntervalIndex(null)} />}
    {deaggregationIndex !== null && <DeaggregationEditor index={deaggregationIndex} onClose={() => setDeaggregationIndex(null)} />}
    {spectrumTarget !== null && <ResponseSpectrumEditor direction={spectrumTarget.direction} index={spectrumTarget.index} onClose={() => setSpectrumTarget(null)} />}
    {sensitivitiesOpen && <HazardSensitivityEditor onClose={() => setSensitivitiesOpen(false)} />}
  </>;
}

type SecondaryHazardEvaluation =
  SeismicPRA["seismicHazardAnalysis"]["secondaryHazardEvaluation"];
type SecondaryHazard = SecondaryHazardEvaluation["hazards"][number];
type RetainedSecondaryHazard = NonNullable<SecondaryHazard["retainedAnalysis"]>;
type SecondaryHazardCurve = RetainedSecondaryHazard["hazardCurves"][number];

const EXTERNAL_FLOODING_INTERFACE_EXAMPLES = [
  {
    hazard: "Upstream embankment-dam breach",
    mechanism: "Coseismic settlement and cracking initiate a breach; the breach hydrograph is routed to the plant boundary.",
    coverage: "XFHA A-G",
    results: "Peak depth 0.8 m; velocity 0.6 m/s; arrival 2.3 h",
    fragility: "Exterior-door hydrostatic failure; below-grade inundation",
  },
  {
    hazard: "Intake-reservoir seiche",
    mechanism: "Horizontal ground motion excites the reservoir and produces runup and overtopping at the intake structure.",
    coverage: "XFHA A, C, D, F, G",
    results: "Runup 1.2 m; overtopping 0.15 m³/s/m; duration 18 min",
    fragility: "Intake-wall overtopping; pump-motor submergence",
  },
  {
    hazard: "Landslide-generated wave",
    mechanism: "Earthquake-triggered slope collapse displaces the impoundment and sends a wave toward the protected area.",
    coverage: "XFHA A-G",
    results: "Runup elevation 103.1 m; depth 0.35 m; arrival 11 min",
    fragility: "Flood-barrier overtopping; cable-vault inundation",
  },
] as const;

function TechnicalEmptyState({ title, detail }: { title: string; detail: string }): JSX.Element {
  return <div className="stechnicalempty"><strong>{title}</strong><span>{detail}</span></div>;
}

function newSecondaryCurve(
  statistic: SecondaryHazardCurve["statistic"],
  fractile?: number,
): SecondaryHazardCurve {
  const factor = fractile === 0.05 ? 0.45 : fractile === 0.95 ? 2.5 : statistic === "MEAN" ? 1.2 : 1;
  return {
    uuid: crypto.randomUUID(),
    name: statistic === "MEAN" ? "Mean hazard curve" : `${Math.round((fractile ?? 0) * 100)}th-fractile hazard curve`,
    hazardParameter: "Permanent ground displacement",
    hazardParameterUnits: "cm",
    statistic,
    fractile,
    points: [0.1, 1, 10].map((hazardLevel, index) => ({
      hazardLevel,
      annualFrequencyOfExceedance: [1e-3, 1e-4, 1e-6][index]! * factor,
    })),
    implementsSrs: [{ sr: "SHA-H3", hlr: "H" }],
  };
}

function newRetainedSecondaryHazard(): RetainedSecondaryHazard {
  return {
    uuid: crypto.randomUUID(),
    name: "Retained secondary-hazard analysis",
    hazardParameter: "Permanent ground displacement",
    parameterUnits: "cm",
    affectedSeismicEquipmentListItemRefs: [],
    failureMechanisms: [{
      id: crypto.randomUUID(),
      name: "Secondary-hazard failure mechanism",
      description: "",
      fragilityParameter: "Permanent displacement",
      fragilityUnits: "cm",
    }],
    hazardCurves: [
      newSecondaryCurve("FRACTILE", 0.05),
      newSecondaryCurve("FRACTILE", 0.5),
      newSecondaryCurve("MEAN"),
      newSecondaryCurve("FRACTILE", 0.95),
    ],
    calculationMethod: "",
    dataAndModelRefs: [],
    uncertainties: [],
    sensitivityStudyRefs: [],
    outputRefs: [],
    implementsSrs: [{ sr: "SHA-H3", hlr: "H" }],
  };
}

function newExternalFloodingInterface(): NonNullable<SecondaryHazard["externalFloodingInterface"]> {
  return {
    mechanismDescription: "",
    interfaceRequirements: ["XFHA-A", "XFHA-B", "XFHA-C", "XFHA-D", "XFHA-E", "XFHA-F", "XFHA-G"].map((requirementGroup) => ({
      requirementGroup: requirementGroup as "XFHA-A" | "XFHA-B" | "XFHA-C" | "XFHA-D" | "XFHA-E" | "XFHA-F" | "XFHA-G",
      applicable: true,
      status: "PARTIAL",
      satisfiedByRefs: [],
      evidence: "",
    })),
    hazardParameterResultsRefs: [],
    fragilityFailureMechanismRefs: [],
    interfaceBasis: "",
    implementsSrs: [{ sr: "SHA-H4", hlr: "H" }],
  };
}

function newSecondaryHazard(): SecondaryHazard {
  return {
    uuid: crypto.randomUUID(),
    name: "New secondary seismic hazard",
    hazardType: "OTHER",
    description: "",
    initiatingMechanisms: [],
    siteEvidenceRefs: [],
    potentiallyAffectedArea: "",
    potentiallyAffectedSeismicEquipmentListItemRefs: [],
    screening: {
      disposition: "SCREENED_OUT",
      criterion: "SCR-2",
      methodology: "",
      demonstrablyConservative: true,
      screeningBasis: "",
      calculationsAndEvidenceRefs: [],
      implementsSrs: [{ sr: "SHA-H2", hlr: "H" }],
    },
    implementsSrs: [{ sr: "SHA-H1", hlr: "H" }, { sr: "SHA-H2", hlr: "H" }],
  };
}

function SecondaryHazardBasisEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const [draft, setDraft] = useState<SecondaryHazardEvaluation>(() =>
    structuredClone(mef.seismicHazardAnalysis.secondaryHazardEvaluation),
  );
  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.secondaryHazardEvaluation = draft;
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Secondary-hazard basis" subtitle="Identification, screening, and transfer controls" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save basis</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Identification</h3>
        <Field label="Identification method"><TextArea rows={4} value={draft.identificationMethod} onChange={(value) => setDraft((current) => ({ ...current, identificationMethod: value }))} /></Field>
        <Field label="Site and regional sources" hint="Separate references with commas."><TextArea rows={5} value={draft.siteAndRegionalHazardListSources.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, siteAndRegionalHazardListSources: technicalList(value) }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Screening and transfer</h3>
        <FieldGrid>
          <Field label="Screening criteria reference"><TextInput value={draft.screeningCriteriaReference} onChange={(value) => setDraft((current) => ({ ...current, screeningCriteriaReference: value }))} /></Field>
          <Field label="Seismic equipment list"><TextInput value={draft.seismicEquipmentListRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, seismicEquipmentListRef: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Cross-hazard dependencies" hint="One dependency per line."><TextArea rows={5} value={draft.crossHazardDependencies.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, crossHazardDependencies: technicalList(value) }))} /></Field>
        <Field label="Completeness review"><TextArea rows={4} value={draft.completenessReview} onChange={(value) => setDraft((current) => ({ ...current, completenessReview: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function SecondaryHazardEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const source = index === null
    ? newSecondaryHazard()
    : mef.seismicHazardAnalysis.secondaryHazardEvaluation.hazards[index]!;
  const [draft, setDraft] = useState<SecondaryHazard>(() => structuredClone(source));
  const retained = draft.retainedAnalysis;

  function save(): void {
    update((next) => {
      const hazards = next.seismicHazardAnalysis.secondaryHazardEvaluation.hazards;
      if (index === null) hazards.push(draft);
      else hazards[index] = draft;
      const outputRefs = hazards.flatMap((hazard) => hazard.retainedAnalysis?.outputRefs ?? []);
      const inputs = next.seismicHazardAnalysis.hazardQuantification.seismicPraInputs;
      inputs.secondaryHazardResultRefs = outputRefs;
      inputs.hazardIntervals.forEach((interval, intervalIndex) => {
        interval.secondaryHazardResultRefs = intervalIndex >= 3 ? [...outputRefs] : [];
      });
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicHazardAnalysis.secondaryHazardEvaluation.hazards.splice(index, 1);
    });
    onClose();
  }
  function setDisposition(disposition: SecondaryHazard["screening"]["disposition"]): void {
    setDraft((current) => {
      const isRetained = disposition === "RETAINED";
      const retainedAnalysis = isRetained
        ? current.retainedAnalysis ?? newRetainedSecondaryHazard()
        : undefined;
      const externalFloodingInterface = isRetained
        && current.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING"
        ? current.externalFloodingInterface ?? newExternalFloodingInterface()
        : undefined;
      return {
        ...current,
        screening: {
          ...current.screening,
          disposition,
          criterion: isRetained ? "NOT_SCREENED" : current.screening.criterion === "NOT_SCREENED" ? "SCR-2" : current.screening.criterion,
        },
        retainedAnalysis,
        externalFloodingInterface,
      };
    });
  }
  function setHazardType(hazardType: SecondaryHazard["hazardType"]): void {
    setDraft((current) => ({
      ...current,
      hazardType,
      externalFloodingInterface:
        hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING"
        && current.screening.disposition === "RETAINED"
          ? current.externalFloodingInterface ?? newExternalFloodingInterface()
          : undefined,
    }));
  }
  function updateRetained(change: Partial<RetainedSecondaryHazard>): void {
    setDraft((current) => current.retainedAnalysis === undefined
      ? current
      : { ...current, retainedAnalysis: { ...current.retainedAnalysis, ...change } });
  }
  function updateCurvePoint(
    curveId: string,
    pointIndex: number,
    annualFrequencyOfExceedance: number,
  ): void {
    if (retained === undefined) return;
    updateRetained({
      hazardCurves: retained.hazardCurves.map((curve) => curve.uuid === curveId
        ? {
            ...curve,
            points: curve.points.map((point, candidate) => candidate === pointIndex
              ? { ...point, annualFrequencyOfExceedance }
              : point),
          }
        : curve),
    });
  }
  function updateHazardLevel(pointIndex: number, hazardLevel: number): void {
    if (retained === undefined) return;
    updateRetained({
      hazardCurves: retained.hazardCurves.map((curve) => ({
        ...curve,
        points: curve.points.map((point, candidate) => candidate === pointIndex
          ? { ...point, hazardLevel }
          : point),
      })),
    });
  }
  const curve = (statistic: SecondaryHazardCurve["statistic"], fractile?: number): SecondaryHazardCurve | undefined =>
    retained?.hazardCurves.find((item) =>
      item.statistic === statistic
      && (statistic === "MEAN" || Math.abs((item.fractile ?? -1) - (fractile ?? -2)) < 1e-9));
  const p05 = curve("FRACTILE", 0.05);
  const p50 = curve("FRACTILE", 0.5);
  const mean = curve("MEAN");
  const p95 = curve("FRACTILE", 0.95);

  return <Drawer eyebrow={EDITOR_LABELS.sha} title={draft.name} subtitle="Identification, screening, and retained analysis" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove hazard</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save hazard</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Hazard</h3>
        <FieldGrid>
          <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
          <Field label="Type"><SelectInput value={draft.hazardType} options={["FAULT_DISPLACEMENT", "LANDSLIDE", "SOIL_LIQUEFACTION", "SOIL_SETTLEMENT", "GROUND_FAILURE", "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING", "TSUNAMI_OR_SEICHE", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setHazardType(value as SecondaryHazard["hazardType"])} /></Field>
        </FieldGrid>
        {draft.hazardType === "OTHER" && <Field label="Other hazard type"><TextInput value={draft.otherHazardType ?? ""} onChange={(value) => setDraft((current) => ({ ...current, otherHazardType: value || undefined }))} /></Field>}
        <Field label="Technical description"><TextArea rows={3} value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} /></Field>
        <Field label="Initiating mechanisms" hint="Separate values with commas."><TextInput value={draft.initiatingMechanisms.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, initiatingMechanisms: technicalList(value) }))} /></Field>
        <Field label="Potentially affected area"><TextArea rows={2} value={draft.potentiallyAffectedArea} onChange={(value) => setDraft((current) => ({ ...current, potentiallyAffectedArea: value }))} /></Field>
        <FieldGrid>
          <Field label="Site evidence" hint="Separate references with commas."><TextInput value={draft.siteEvidenceRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, siteEvidenceRefs: technicalList(value) }))} /></Field>
          <Field label="Potentially affected SEL items" hint="Separate references with commas."><TextInput value={draft.potentiallyAffectedSeismicEquipmentListItemRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, potentiallyAffectedSeismicEquipmentListItemRefs: technicalList(value) }))} /></Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Screening</h3>
        <FieldGrid>
          <Field label="Disposition"><SelectInput value={draft.screening.disposition} options={[{ value: "SCREENED_OUT", label: "Screened out" }, { value: "RETAINED", label: "Retained" }]} onChange={(value) => setDisposition(value as SecondaryHazard["screening"]["disposition"])} /></Field>
          <Field label="Criterion"><SelectInput value={draft.screening.criterion} options={["SCR-2", "SCR-3", "NOT_SCREENED"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, screening: { ...current.screening, criterion: value as SecondaryHazard["screening"]["criterion"] } }))} /></Field>
        </FieldGrid>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.screening.demonstrablyConservative} onChange={(event) => setDraft((current) => ({ ...current, screening: { ...current.screening, demonstrablyConservative: event.target.checked } }))} /><span>Screening method is demonstrably conservative</span></label>
        <Field label="Method"><TextArea rows={3} value={draft.screening.methodology} onChange={(value) => setDraft((current) => ({ ...current, screening: { ...current.screening, methodology: value } }))} /></Field>
        <Field label="Technical basis"><TextArea rows={4} value={draft.screening.screeningBasis} onChange={(value) => setDraft((current) => ({ ...current, screening: { ...current.screening, screeningBasis: value } }))} /></Field>
        <FieldGrid>
          <Field label="Calculation and evidence references" hint="Separate references with commas."><TextInput value={draft.screening.calculationsAndEvidenceRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, screening: { ...current.screening, calculationsAndEvidenceRefs: technicalList(value) } }))} /></Field>
          <Field label="Reviewer"><TextInput value={draft.screening.reviewer ?? ""} onChange={(value) => setDraft((current) => ({ ...current, screening: { ...current.screening, reviewer: value || undefined } }))} /></Field>
        </FieldGrid>
      </div>
      {retained !== undefined && <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Retained analysis</h3>
        <FieldGrid>
          <Field label="Hazard parameter"><TextInput value={retained.hazardParameter} onChange={(value) => updateRetained({ hazardParameter: value, hazardCurves: retained.hazardCurves.map((item) => ({ ...item, hazardParameter: value })) })} /></Field>
          <Field label="Units"><TextInput value={retained.parameterUnits} onChange={(value) => updateRetained({ parameterUnits: value, hazardCurves: retained.hazardCurves.map((item) => ({ ...item, hazardParameterUnits: value })) })} /></Field>
        </FieldGrid>
        <Field label="Affected SEL items" hint="Separate references with commas."><TextInput value={retained.affectedSeismicEquipmentListItemRefs.join(", ")} onChange={(value) => updateRetained({ affectedSeismicEquipmentListItemRefs: technicalList(value) })} /></Field>
        <Field label="Calculation method"><TextArea rows={4} value={retained.calculationMethod} onChange={(value) => updateRetained({ calculationMethod: value })} /></Field>
        <FieldGrid>
          <Field label="Data and model references" hint="Separate references with commas."><TextArea rows={4} value={retained.dataAndModelRefs.join("\n")} onChange={(value) => updateRetained({ dataAndModelRefs: technicalList(value) })} /></Field>
          <Field label="Output references" hint="Separate references with commas."><TextArea rows={4} value={retained.outputRefs.join("\n")} onChange={(value) => updateRetained({ outputRefs: technicalList(value) })} /></Field>
        </FieldGrid>
        <div className="sresponsepoints">
          <Table headers={[`Level (${retained.parameterUnits || "units"})`, "P05 AFE", "Median AFE", "Mean AFE", "P95 AFE"]} minWidth={640}>
            {(mean?.points ?? []).map((point, pointIndex) => <tr key={`${point.hazardLevel}-${pointIndex}`}>
              <td><NumberInput value={point.hazardLevel} onChange={(value) => updateHazardLevel(pointIndex, value)} /></td>
              <td><NumberInput value={p05?.points[pointIndex]?.annualFrequencyOfExceedance ?? 0} onChange={(value) => p05 !== undefined && updateCurvePoint(p05.uuid, pointIndex, value)} /></td>
              <td><NumberInput value={p50?.points[pointIndex]?.annualFrequencyOfExceedance ?? 0} onChange={(value) => p50 !== undefined && updateCurvePoint(p50.uuid, pointIndex, value)} /></td>
              <td><NumberInput value={point.annualFrequencyOfExceedance} onChange={(value) => mean !== undefined && updateCurvePoint(mean.uuid, pointIndex, value)} /></td>
              <td><NumberInput value={p95?.points[pointIndex]?.annualFrequencyOfExceedance ?? 0} onChange={(value) => p95 !== undefined && updateCurvePoint(p95.uuid, pointIndex, value)} /></td>
            </tr>)}
          </Table>
        </div>
        {retained.failureMechanisms.map((mechanism, mechanismIndex) => <div className="sinlineeditor__subgroup" key={mechanism.id}>
          <FieldGrid>
            <Field label={`Failure mechanism ${mechanismIndex + 1}`}><TextInput value={mechanism.name} onChange={(value) => updateRetained({ failureMechanisms: retained.failureMechanisms.map((item, candidate) => candidate === mechanismIndex ? { ...item, name: value } : item) })} /></Field>
            <Field label="Fragility parameter"><TextInput value={mechanism.fragilityParameter} onChange={(value) => updateRetained({ failureMechanisms: retained.failureMechanisms.map((item, candidate) => candidate === mechanismIndex ? { ...item, fragilityParameter: value } : item) })} /></Field>
          </FieldGrid>
          <Field label="Description"><TextArea rows={2} value={mechanism.description} onChange={(value) => updateRetained({ failureMechanisms: retained.failureMechanisms.map((item, candidate) => candidate === mechanismIndex ? { ...item, description: value } : item) })} /></Field>
        </div>)}
      </div>}
      {draft.externalFloodingInterface !== undefined && <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">External flooding interface</h3>
        <Field label="Mechanism"><TextArea rows={3} value={draft.externalFloodingInterface.mechanismDescription} onChange={(value) => setDraft((current) => current.externalFloodingInterface === undefined ? current : { ...current, externalFloodingInterface: { ...current.externalFloodingInterface, mechanismDescription: value } })} /></Field>
        <Field label="Interface basis"><TextArea rows={3} value={draft.externalFloodingInterface.interfaceBasis} onChange={(value) => setDraft((current) => current.externalFloodingInterface === undefined ? current : { ...current, externalFloodingInterface: { ...current.externalFloodingInterface, interfaceBasis: value } })} /></Field>
        {draft.externalFloodingInterface.interfaceRequirements.map((requirement, requirementIndex) => <div className="sinlineeditor__subgroup" key={requirement.requirementGroup}>
          <FieldGrid>
            <Field label={requirement.requirementGroup}><SelectInput value={requirement.status} options={["MET", "PARTIAL", "NOT_MET", "NOT_APPLICABLE"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => current.externalFloodingInterface === undefined ? current : { ...current, externalFloodingInterface: { ...current.externalFloodingInterface, interfaceRequirements: current.externalFloodingInterface.interfaceRequirements.map((item, candidate) => candidate === requirementIndex ? { ...item, status: value as typeof item.status } : item) } })} /></Field>
            <Field label="Satisfied by"><TextInput value={requirement.satisfiedByRefs.join(", ")} onChange={(value) => setDraft((current) => current.externalFloodingInterface === undefined ? current : { ...current, externalFloodingInterface: { ...current.externalFloodingInterface, interfaceRequirements: current.externalFloodingInterface.interfaceRequirements.map((item, candidate) => candidate === requirementIndex ? { ...item, satisfiedByRefs: technicalList(value) } : item) } })} /></Field>
          </FieldGrid>
          <Field label="Evidence"><TextArea rows={2} value={requirement.evidence} onChange={(value) => setDraft((current) => current.externalFloodingInterface === undefined ? current : { ...current, externalFloodingInterface: { ...current.externalFloodingInterface, interfaceRequirements: current.externalFloodingInterface.interfaceRequirements.map((item, candidate) => candidate === requirementIndex ? { ...item, evidence: value } : item) } })} /></Field>
        </div>)}
      </div>}
    </fieldset>
  </Drawer>;
}

function SecondaryHazardsScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const evaluation = mef.seismicHazardAnalysis.secondaryHazardEvaluation;
  const retainedHazards = evaluation.hazards.filter((hazard) => hazard.screening.disposition === "RETAINED" && hazard.retainedAnalysis !== undefined);
  const retainedFloods = evaluation.hazards.filter((hazard) =>
    hazard.screening.disposition === "RETAINED"
    && hazard.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING"
    && hazard.externalFloodingInterface !== undefined);
  const [basisOpen, setBasisOpen] = useState(false);
  const [hazardIndex, setHazardIndex] = useState<number | null | undefined>(undefined);
  const [selectedRetainedRef, setSelectedRetainedRef] = useState(retainedHazards[0]?.uuid ?? "");
  const selectedRetained = retainedHazards.find((hazard) => hazard.uuid === selectedRetainedRef) ?? retainedHazards[0];
  const selectedAnalysis = selectedRetained?.retainedAnalysis;
  const fanPoints = useMemo(
    () => secondaryHazardFanSeries(selectedAnalysis?.hazardCurves ?? []),
    [selectedAnalysis],
  );
  return <>
    <Section title="Hazard screening" description="Identify each hazard and apply a conservative site-specific disposition." tone="sha" actions={editable ? <>
      <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setBasisOpen(true)}>Edit basis</button>
      <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setHazardIndex(null)}>Add hazard</button>
    </> : undefined}>
      {evaluation.hazards.length === 0 ? <TechnicalEmptyState title="No secondary hazards" detail="Identify the site-relevant non-vibratory seismic hazards before screening." /> : <Table headers={["Hazard", "Site condition", "Result", "Technical basis"]} minWidth={0} columnWidths={["25%", "24%", "16%", "35%"]}>
        {evaluation.hazards.map((hazard, index) => <tr className="postable__row--clickable" key={hazard.uuid} onClick={() => setHazardIndex(index)}>
          <td className="stable__key"><strong>{hazard.name}</strong><code>{displayLabel(hazard.hazardType)}</code></td>
          <td>{hazard.potentiallyAffectedArea}<code>{hazard.siteEvidenceRefs.length} site evidence references</code></td>
          <td><Tag tone={hazard.screening.disposition === "RETAINED" ? "warn" : "good"}>{hazard.screening.disposition === "RETAINED" ? "Retained" : "Screened"}</Tag><code>{hazard.screening.criterion.replace("_", " ")}</code></td>
          <td>{hazard.screening.screeningBasis}</td>
        </tr>)}
      </Table>}
    </Section>

    <Section title="Retained analysis" description="Parameter-frequency curves and fragility inputs for hazards that remain." tone="sha">
      {selectedRetained === undefined || selectedAnalysis === undefined ? <TechnicalEmptyState title="No retained secondary hazard" detail="Every identified secondary hazard has been screened out." /> : <>
        <div className="sdistribution__head">
          <div><strong>Hazard distribution</strong><span>Calculated frequency range for the selected retained parameter.</span></div>
          <label className="splotselect"><span>Retained hazard</span><select className="sinput" aria-label="Retained secondary hazard" value={selectedRetained.uuid} onChange={(event) => setSelectedRetainedRef(event.target.value)}>
            {retainedHazards.map((hazard) => <option key={hazard.uuid} value={hazard.uuid}>{hazard.name}</option>)}
          </select></label>
        </div>
        <DistributionFanChart points={fanPoints} xLabel={`${selectedAnalysis.hazardParameter} (${selectedAnalysis.parameterUnits}, log scale)`} yLabel="Annual frequency (log scale)" yScale="log" ariaLabel={`${selectedRetained.name} frequency distribution from the 5th through 95th fractiles`} />
        <Table headers={["Parameter and output", "Calculated range", "Affected SEL", "Failure mechanisms"]} minWidth={0} columnWidths={["30%", "22%", "18%", "30%"]} className="stable--wrapheads">
          {retainedHazards.map((hazard) => {
            const analysis = hazard.retainedAnalysis!;
            const meanCurve = analysis.hazardCurves.find((item) => item.statistic === "MEAN");
            const levels = meanCurve?.points.map((point) => point.hazardLevel) ?? [];
            const frequencies = meanCurve?.points.map((point) => point.annualFrequencyOfExceedance) ?? [];
            return <tr className="postable__row--clickable" key={hazard.uuid} onClick={() => setHazardIndex(evaluation.hazards.findIndex((item) => item.uuid === hazard.uuid))}>
              <td className="stable__key"><strong>{analysis.hazardParameter}</strong><code>{analysis.parameterUnits} | {analysis.outputRefs.join(", ") || "No output"}</code></td>
              <td>{numericRange(levels, analysis.parameterUnits)}<code>{frequencies.length === 0 ? "No mean curve" : `${annualFrequency(Math.max(...frequencies))} to ${annualFrequency(Math.min(...frequencies))} /yr`}</code></td>
              <td>{analysis.affectedSeismicEquipmentListItemRefs.join(", ") || "None"}</td>
              <td>{analysis.failureMechanisms.map((mechanism) => mechanism.name).join(", ") || "None"}</td>
            </tr>;
          })}
        </Table>
      </>}
    </Section>

    <Section title="External flooding interface" description="Required only when earthquake-induced flooding remains after screening." tone="sha">
      {retainedFloods.length === 0 ? <>
        <Table headers={["Hazard", "Mechanism", "XFHA coverage", "Hazard results", "Fragility mechanisms"]} minWidth={0} columnWidths={["20%", "30%", "14%", "18%", "18%"]}>
          {EXTERNAL_FLOODING_INTERFACE_EXAMPLES.map((example) => <tr key={example.hazard}>
            <td className="stable__key"><strong>{example.hazard}</strong><code>Illustrative example</code></td>
            <td>{example.mechanism}</td>
            <td><strong>{example.coverage}</strong></td>
            <td>{example.results}</td>
            <td>{example.fragility}</td>
          </tr>)}
        </Table>
      </> : <Table headers={["Hazard", "Mechanism", "XFHA coverage", "Hazard results", "Fragility mechanisms"]} minWidth={0} columnWidths={["20%", "30%", "14%", "18%", "18%"]}>
        {retainedFloods.map((hazard) => {
          const flood = hazard.externalFloodingInterface!;
          const met = flood.interfaceRequirements.filter((requirement) => requirement.status === "MET" || requirement.status === "NOT_APPLICABLE").length;
          return <tr className="postable__row--clickable" key={hazard.uuid} onClick={() => setHazardIndex(evaluation.hazards.findIndex((item) => item.uuid === hazard.uuid))}>
            <td className="stable__key"><strong>{hazard.name}</strong></td>
            <td>{flood.mechanismDescription}</td>
            <td><strong>{met} / {flood.interfaceRequirements.length}</strong></td>
            <td>{flood.hazardParameterResultsRefs.join(", ") || "None"}</td>
            <td>{flood.fragilityFailureMechanismRefs.join(", ") || "None"}</td>
          </tr>;
        })}
      </Table>}
    </Section>

    {basisOpen && <SecondaryHazardBasisEditor onClose={() => setBasisOpen(false)} />}
    {hazardIndex !== undefined && <SecondaryHazardEditor index={hazardIndex} onClose={() => setHazardIndex(undefined)} />}
  </>;
}

function SiteHazardModelScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const sha = mef.seismicHazardAnalysis;
  const basis = sha.analysisBasis;
  const catalog = sha.earthScienceInputs.earthquakeCatalog;
  const source = sha.sourceCharacterization;
  const ground = sha.groundMotionCharacterization;
  const site = sha.siteResponseAnalysis;
  const quantification = sha.hazardQuantification;
  const spectra = sha.responseSpectraEvaluation;
  const secondary = sha.secondaryHazardEvaluation;
  const parameters = basis.groundMotionParameters;
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [sourceIndex, setSourceIndex] = useState<number | null | undefined>(undefined);
  const [groundMotionModelIndex, setGroundMotionModelIndex] = useState<number | null | undefined>(undefined);
  const [profileIndex, setProfileIndex] = useState<number | null | undefined>(undefined);
  const [siteResultIndex, setSiteResultIndex] = useState<number | null | undefined>(undefined);
  const [curveParameter, setCurveParameter] = useState<string | null>(null);
  const [deaggregationIndex, setDeaggregationIndex] = useState<number | null>(null);
  const [spectrumTarget, setSpectrumTarget] = useState<{ direction: "horizontal" | "vertical"; index: number } | null>(null);
  const [secondaryHazardIndex, setSecondaryHazardIndex] = useState<number | null | undefined>(undefined);
  const [hazardChartParameter, setHazardChartParameter] = useState(
    parameters.find((parameter) => parameter.uuid === "GMP-SA-1HZ")?.uuid
      ?? parameters[0]?.uuid
      ?? "",
  );
  const hazardChartPoints = useMemo(
    () => hazardCurveFanSeries(mef, hazardChartParameter),
    [hazardChartParameter, mef],
  );
  const processLabel = PSHA_PROCESS_OPTIONS.find((option) =>
    option.value === basis.structuredProcess.processType)?.label
    ?? displayLabel(basis.structuredProcess.processType);
  const parameterName = (reference: string): string =>
    parameters.find((parameter) => parameter.uuid === reference)?.name ?? reference;
  const sourceMagnitudeRange = (
    models: typeof source.earthquakeSources[number]["magnitudeFrequencyModels"],
  ): string => {
    if (models.length === 0) return "Not defined";
    const minimum = Math.min(...models.map((model) => model.minimumMagnitude));
    const maximum = Math.max(...models.map((model) => model.maximumMagnitude));
    return `${models[0]?.magnitudeScale ?? "M"} ${minimum} to ${maximum}`;
  };
  const profileVelocityRange = (profile: SiteProfile): string =>
    numericRange(
      profile.layers
        .map((layer) => siteProperty(layer, "SHEAR_WAVE_VELOCITY"))
        .filter((value): value is number => value !== undefined),
      "m/s",
    );

  return <>
    <Section
      title="PSHA basis"
      description="This section sets how the site hazard will be developed. It records the structured evaluation process, earthquake-catalog coverage, and numerical limits that apply before the hazard calculations are run."
      tone="sha"
      actions={<EditButton label="Edit earthquake catalog" onClick={() => setCatalogOpen(true)} />}
    >
      <Table
        headers={["Technical item", "Current definition"]}
        minWidth={0}
        columnWidths={["25%", "75%"]}
        className="stable--technical"
      >
        <tr>
          <td className="stable__key"><strong>Structured process</strong></td>
          <td>{processLabel}<code>{basis.structuredProcess.participants.length} participants · {basis.structuredProcess.activities.length} recorded activities</code></td>
        </tr>
        <tr className={editable ? "postable__row--clickable" : undefined} onClick={editable ? () => setCatalogOpen(true) : undefined}>
          <td className="stable__key"><strong>Earthquake catalog</strong></td>
          <td>{catalog.catalogStartDateOrAge} to {catalog.catalogEndDate}<code>{catalog.events.length} event records · {catalog.magnitudeScales.join(", ")}</code></td>
        </tr>
        <tr>
          <td className="stable__key"><strong>Calculation limits</strong></td>
          <td>{basis.calculationBounds.magnitudeScale} {basis.calculationBounds.lowerBoundMagnitude} minimum · {basis.calculationBounds.maximumGroundMotion} {basis.calculationBounds.groundMotionUnits} maximum motion · epsilon {basis.calculationBounds.epsilonLimit}</td>
        </tr>
      </Table>
    </Section>

    <Section
      title="Seismic source model"
      description="This section identifies the faults and distributed seismic zones that can produce damaging motion at the site. Each source needs geometry, distance, magnitude recurrence, and uncertainty treatment."
      tone="sha"
      actions={editable ? <AddButton label="Add seismic source" onClick={() => setSourceIndex(null)} /> : undefined}
    >
      {source.earthquakeSources.length === 0
        ? <TechnicalEmptyState title="No seismic sources" detail="Add the faults and distributed source zones that can contribute to the site hazard." />
        : <Table
          headers={["Source", "Type", "Closest distance", "Magnitude range"]}
          minWidth={0}
          columnWidths={["32%", "24%", "20%", "24%"]}
          className="stable--technical"
        >
          {source.earthquakeSources.map((item, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={item.uuid} onClick={editable ? () => setSourceIndex(index) : undefined}>
            <td className="stable__key"><strong>{item.name}</strong><code>{item.tectonicRegionType}</code></td>
            <td>{displayLabel(item.sourceType)}<code>{item.faultMechanisms.map(displayLabel).join(", ")}</code></td>
            <td>{item.geometry.closestDistanceToSiteKm === undefined ? "Not recorded" : `${item.geometry.closestDistanceToSiteKm} km`}</td>
            <td>{sourceMagnitudeRange(item.magnitudeFrequencyModels)}</td>
          </tr>)}
        </Table>}
    </Section>

    <Section
      title="Ground-motion models"
      description="This section selects the equations or simulations that convert earthquake magnitude and distance into motion at the reference horizon. The weights represent uncertainty among technically credible models."
      tone="sha"
      actions={editable ? <AddButton label="Add ground-motion model" onClick={() => setGroundMotionModelIndex(null)} /> : undefined}
    >
      {ground.predictionModels.length === 0
        ? <TechnicalEmptyState title="No ground-motion models" detail="Add the prediction models used to calculate motion from each seismic source." />
        : <Table
          headers={["Prediction model", "Tectonic region", "Magnitude range", "Distance range", "Weight"]}
          minWidth={0}
          columnWidths={["28%", "22%", "18%", "18%", "14%"]}
          className="stable--technical"
        >
          {ground.predictionModels.map((model, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={model.uuid} onClick={editable ? () => setGroundMotionModelIndex(index) : undefined}>
            <td className="stable__key"><strong>{model.name}</strong><code>{model.sourceReference}</code></td>
            <td>{model.tectonicRegionTypes.join(", ")}</td>
            <td>M {model.magnitudeRange.minimum} to {model.magnitudeRange.maximum}</td>
            <td>{model.distanceRangeKm.minimum} to {model.distanceRangeKm.maximum} km</td>
            <td>{model.logicTreeWeight.toFixed(2)}</td>
          </tr>)}
        </Table>}
    </Section>

    <Section
      title="Local site response"
      description="This section describes the soil and rock beneath the plant and calculates how they amplify or reduce motion between the reference horizon and the foundation control point."
      tone="sha"
    >
      {site.profiles.length === 0
        ? <>
          <TableCaption caption="Site profiles" actions={editable ? <AddButton label="Add site profile" onClick={() => setProfileIndex(null)} /> : undefined} />
          <TechnicalEmptyState title="No site profiles" detail="Add the weighted soil and rock profiles used to calculate local amplification." />
        </>
        : <Table
          caption="Site profiles"
          captionActions={editable ? <AddButton label="Add site profile" onClick={() => setProfileIndex(null)} /> : undefined}
          headers={["Profile", "Bedrock depth", "Shear-wave velocity", "Groundwater depth", "Weight"]}
          minWidth={0}
          columnWidths={["30%", "17%", "21%", "18%", "14%"]}
          className="stable--technical"
        >
          {site.profiles.map((profile, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={profile.uuid} onClick={editable ? () => setProfileIndex(index) : undefined}>
            <td className="stable__key"><strong>{profile.name}</strong><code>{displayLabel(profile.profileType)}</code></td>
            <td>{profile.depthToBedrock} {profile.depthUnit}</td>
            <td>{profileVelocityRange(profile)}</td>
            <td>{profile.groundwaterDepth === undefined ? "Not defined" : `${profile.groundwaterDepth} ${profile.depthUnit}`}</td>
            <td>{profile.profileWeight?.toFixed(2) ?? "Not defined"}</td>
          </tr>)}
        </Table>}
      {site.amplificationResults.length === 0
        ? <>
          <TableCaption caption="Amplification calculations" actions={editable ? <AddButton label="Add response calculation" onClick={() => setSiteResultIndex(null)} /> : undefined} />
          <TechnicalEmptyState title="No site-response calculations" detail="Calculate foundation amplification over the ground-motion and frequency ranges used by the PRA." />
        </>
        : <Table
          caption="Amplification calculations"
          captionActions={editable ? <AddButton label="Add response calculation" onClick={() => setSiteResultIndex(null)} /> : undefined}
          headers={["Calculation", "Method", "Input range", "Output control point", "Median amplification"]}
          minWidth={0}
          columnWidths={["27%", "22%", "18%", "18%", "15%"]}
          className="stable--technical"
        >
          {site.amplificationResults.map((result, index) => {
            const method = site.methods.find((candidate) => candidate.uuid === result.methodRef);
            const input = site.inputMotions.find((candidate) => candidate.uuid === result.inputMotionRef);
            return <tr className={editable ? "postable__row--clickable" : undefined} key={result.uuid} onClick={editable ? () => setSiteResultIndex(index) : undefined}>
              <td className="stable__key"><strong>{result.name}</strong></td>
              <td>{method?.name ?? result.methodRef}</td>
              <td>{input === undefined ? "Missing input" : numericRange(input.amplitudeLevels, input.units)}</td>
              <td>{result.outputControlPointRef}</td>
              <td>{numericRange(result.points.map((point) => point.medianAmplification))}</td>
            </tr>;
          })}
        </Table>}
    </Section>

    <Section
      title="Hazard results"
      description="This section shows how often each level of shaking is exceeded, which magnitudes and distances control the result, and the horizontal and vertical spectra passed to later demand calculations."
      tone="sha"
    >
      {parameters.length === 0
        ? <TechnicalEmptyState title="No ground-motion parameters" detail="Define the shared ground-motion parameters in Step 01 before calculating hazard." />
        : <>
          <label className="splotselect">
            <span>Ground-motion parameter</span>
            <select className="sinput" aria-label="Hazard chart ground-motion parameter" value={hazardChartParameter} onChange={(event) => setHazardChartParameter(event.target.value)}>
              {parameters.map((parameter) => <option key={parameter.uuid} value={parameter.uuid}>{parameter.name}</option>)}
            </select>
          </label>
          <DistributionFanChart points={hazardChartPoints} xLabel="Ground motion (g, log scale)" yLabel="Annual frequency (log scale)" yScale="log" ariaLabel={`${parameterName(hazardChartParameter)} mean and fractile hazard curves`} />
          <Table
            caption="Hazard curves"
            headers={["Ground-motion parameter", "1E-4 motion", "1E-5 motion", "Calculated range"]}
            minWidth={0}
            columnWidths={["40%", "20%", "20%", "20%"]}
            className="stable--technical"
          >
            {parameters.map((parameter) => {
              const curves = quantification.hazardCurves.filter((curve) => curve.groundMotionParameterRef === parameter.uuid);
              const meanCurve = curves.find((curve) => curve.statistic === "MEAN");
              return <tr className={editable ? "postable__row--clickable" : undefined} key={parameter.uuid} onClick={editable ? () => setCurveParameter(parameter.uuid) : undefined}>
                <td className="stable__key"><strong>{parameter.name}</strong><code>{displayLabel(parameter.direction)}</code></td>
                <td>{motionAtFrequency(meanCurve, 1e-4)}</td>
                <td>{motionAtFrequency(meanCurve, 1e-5)}</td>
                <td>{meanCurve === undefined ? "Not calculated" : numericRange(meanCurve.points.map((point) => point.groundMotion), meanCurve.groundMotionUnits)}</td>
              </tr>;
            })}
          </Table>
        </>}
      {quantification.deaggregations.length > 0 && <Table
          caption="Deaggregation"
          headers={["Hazard level", "Annual frequency", "Mean magnitude", "Mean distance"]}
          minWidth={0}
          columnWidths={["40%", "20%", "20%", "20%"]}
          className="stable--technical"
        >
          {quantification.deaggregations.map((result, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={result.uuid} onClick={editable ? () => setDeaggregationIndex(index) : undefined}>
            <td className="stable__key"><strong>{parameterName(result.groundMotionParameterRef)}</strong><code>{result.groundMotionLevel} {result.groundMotionUnits}</code></td>
            <td className="smono">{annualFrequency(result.annualFrequencyOfExceedance)}</td>
            <td>{result.meanMagnitude.toFixed(2)}</td>
            <td>{result.meanDistanceKm.toFixed(1)} km</td>
          </tr>)}
        </Table>}
      <Table
        caption="Uniform hazard spectra"
        headers={["Spectrum", "Direction", "Annual frequency", "Acceleration range"]}
        minWidth={0}
        columnWidths={["42%", "18%", "20%", "20%"]}
        className="stable--technical"
      >
        {spectra.horizontalSpectra.map((spectrum, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={spectrum.uuid} onClick={editable ? () => setSpectrumTarget({ direction: "horizontal", index }) : undefined}>
          <td className="stable__key"><strong>{spectrum.name}</strong><code>{(spectrum.dampingRatio * 100).toFixed(0)}% damping</code></td>
          <td>Horizontal</td>
          <td className="smono">{annualFrequency(spectrum.annualFrequencyOfExceedance)}</td>
          <td>{numericRange(spectrum.points.map((point) => point.spectralAcceleration), "g")}</td>
        </tr>)}
        {spectra.verticalSpectra.map((spectrum, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={spectrum.uuid} onClick={editable ? () => setSpectrumTarget({ direction: "vertical", index }) : undefined}>
          <td className="stable__key"><strong>{spectrum.name}</strong><code>{(spectrum.dampingRatio * 100).toFixed(0)}% damping</code></td>
          <td>Vertical</td>
          <td className="smono">{annualFrequency(spectrum.annualFrequencyOfExceedance)}</td>
          <td>{numericRange(spectrum.points.map((point) => point.spectralAcceleration), "g")}</td>
        </tr>)}
      </Table>
    </Section>

    <Section
      title="Secondary seismic hazards"
      description="This section checks whether the earthquake can also cause permanent ground displacement, liquefaction, settlement, slope failure, seiche, or external flooding. Hazards that cannot be screened out are quantified and linked to affected SEL items."
      tone="sha"
      actions={editable ? <AddButton label="Add secondary hazard" onClick={() => setSecondaryHazardIndex(null)} /> : undefined}
    >
      {secondary.hazards.length === 0
        ? <TechnicalEmptyState title="No secondary hazards" detail="Identify and disposition every site-relevant non-vibratory seismic hazard." />
        : <Table
          headers={["Hazard", "Potentially affected area", "Disposition", "Retained output"]}
          minWidth={0}
          columnWidths={["26%", "34%", "16%", "24%"]}
          className="stable--technical"
        >
          {secondary.hazards.map((hazard, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={hazard.uuid} onClick={editable ? () => setSecondaryHazardIndex(index) : undefined}>
            <td className="stable__key"><strong>{hazard.name}</strong><code>{displayLabel(hazard.hazardType)}</code></td>
            <td>{hazard.potentiallyAffectedArea}</td>
            <td><Tag tone={hazard.screening.disposition === "RETAINED" ? "warn" : "good"}>{hazard.screening.disposition === "RETAINED" ? "Retained" : "Screened out"}</Tag></td>
            <td>{hazard.retainedAnalysis === undefined
              ? "Not applicable"
              : `${hazard.retainedAnalysis.hazardParameter} (${hazard.retainedAnalysis.parameterUnits})`}</td>
          </tr>)}
        </Table>}
    </Section>

    {catalogOpen && <EarthquakeCatalogEditor onClose={() => setCatalogOpen(false)} />}
    {sourceIndex !== undefined && <SeismicSourceEditor index={sourceIndex} onClose={() => setSourceIndex(undefined)} />}
    {groundMotionModelIndex !== undefined && <GroundMotionModelEditor index={groundMotionModelIndex} onClose={() => setGroundMotionModelIndex(undefined)} />}
    {profileIndex !== undefined && <SiteProfileEditor index={profileIndex} onClose={() => setProfileIndex(undefined)} />}
    {siteResultIndex !== undefined && <SiteResultEditor index={siteResultIndex} onClose={() => setSiteResultIndex(undefined)} />}
    {curveParameter !== null && <HazardCurveFamilyEditor parameterRef={curveParameter} onClose={() => setCurveParameter(null)} />}
    {deaggregationIndex !== null && <DeaggregationEditor index={deaggregationIndex} onClose={() => setDeaggregationIndex(null)} />}
    {spectrumTarget !== null && <ResponseSpectrumEditor direction={spectrumTarget.direction} index={spectrumTarget.index} onClose={() => setSpectrumTarget(null)} />}
    {secondaryHazardIndex !== undefined && <SecondaryHazardEditor index={secondaryHazardIndex} onClose={() => setSecondaryHazardIndex(undefined)} />}
  </>;
}

type SelDevelopment =
  SeismicPRA["seismicPlantResponseAnalysis"]["seismicEquipmentListDevelopment"];
type SelEntry = SelDevelopment["equipment"][number];
type SelFailureMode = SelEntry["failureModes"][number];
type SfrResponseAnalysis =
  SeismicPRA["seismicFragilityAnalysis"]["seismicResponseAnalysis"];
type SfrReferenceEarthquake = SfrResponseAnalysis["referenceEarthquakes"][number];
type SfrStructuralModel = SfrResponseAnalysis["structuralModels"][number];
type SfrResponseResult = SfrResponseAnalysis["responseResults"][number];
type SfrSsiAnalysis = SfrResponseAnalysis["soilStructureInteractionAnalyses"][number];
type SfrSimulation = SfrResponseAnalysis["probabilisticSimulations"][number];

const SEL_INCLUSION_OPTIONS = [
  "INTERNAL_EVENTS_SYSTEM_MODEL",
  "SEISMIC_EVENT_SEQUENCE_MODEL",
  "ADDITIONAL_SEISMIC_SSC",
  "INTERNAL_FLOOD_SOURCE",
  "INTERNAL_FIRE_IGNITION_SOURCE",
  "SECONDARY_HAZARD",
  "INVESTIGATION_FINDING",
] as const;

function newSelFailureMode(): SelFailureMode {
  return {
    uuid: crypto.randomUUID(),
    name: "Loss of credited function",
    failureModeType: "FUNCTIONAL",
    description: "",
    creditedFunction: "",
    failureDefinition: "",
    requiredState: "FUNCTION_AFTER_EARTHQUAKE",
    systemModelBasicEventRefs: [],
    eventSequenceRefs: [],
    fragilityMechanismRefs: [],
    consequenceDescription: "",
    implementsSrs: [{ sr: "SPR-C6", hlr: "C" }, { sr: "SFR-A1", hlr: "A" }],
  };
}

function newSelEntry(): SelEntry {
  return {
    uuid: crypto.randomUUID(),
    name: "New seismic equipment item",
    sscType: "COMPONENT",
    reactorUnitRefs: [],
    radioactiveMaterialSourceRefs: [],
    building: "",
    roomOrArea: "",
    elevation: "",
    orientation: "Plant coordinate axes",
    mountingAndAnchorage: "",
    creditedFunctions: [],
    inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL"],
    sourceElementRefs: [],
    failureModes: [newSelFailureMode()],
    correlationGroupRefs: [],
    disposition: "ACTIVE",
    dispositionBasis: "",
    revisionHistory: [{
      date: new Date().toISOString().slice(0, 10),
      action: "ADDED",
      reason: "Added during SEL reconciliation",
      actor: "workbook.preparer",
    }],
    implementsSrs: [
      { sr: "SPR-C1", hlr: "C" },
      { sr: "SPR-C2", hlr: "C" },
      { sr: "SPR-C6", hlr: "C" },
      { sr: "SFR-A1", hlr: "A" },
    ],
  };
}

function SelBasisEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const [draft, setDraft] = useState<SelDevelopment>(() => {
    const original = mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
    return {
      ...original,
      additionalSeismicSystemRefs: [...original.additionalSeismicSystemRefs],
      equipment: [...original.equipment],
      internalFloodSourceRefs: [...original.internalFloodSourceRefs],
      internalFireIgnitionSourceRefs: [...original.internalFireIgnitionSourceRefs],
      secondaryHazardSscRefs: [...original.secondaryHazardSscRefs],
      additionalStructuresAndPassiveSscRefs: [...original.additionalStructuresAndPassiveSscRefs],
      completenessChecks: [...original.completenessChecks],
      implementsSrs: original.implementsSrs.map((reference) => ({ ...reference })),
    };
  });
  function save(): void {
    update((next) => {
      const equipment = next.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
      next.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment = {
        ...draft,
        equipment,
      };
      next.seismicFragilityAnalysis.scope.seismicEquipmentListRef =
        draft.internalEventsSystemsModelRef.length > 0 ? "SEL-CONTROLLED" : "";
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.integration} title="Initial SEL basis" subtitle="Record the source models and completeness controls used to assemble the initial seismic equipment list." plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save basis</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Source models</h3>
        <Field label="Internal-events systems model">
          <TextInput value={draft.internalEventsSystemsModelRef} onChange={(value) => setDraft((current) => ({ ...current, internalEventsSystemsModelRef: value }))} />
        </Field>
        <Field label="Additional seismic systems" hint="Separate values with commas.">
          <TextArea rows={3} value={draft.additionalSeismicSystemRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, additionalSeismicSystemRefs: technicalList(value) }))} />
        </Field>
        <FieldGrid>
          <Field label="Internal-flood sources" hint="Separate references with commas.">
            <TextArea rows={3} value={draft.internalFloodSourceRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, internalFloodSourceRefs: technicalList(value) }))} />
          </Field>
          <Field label="Internal-fire sources" hint="Separate references with commas.">
            <TextArea rows={3} value={draft.internalFireIgnitionSourceRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, internalFireIgnitionSourceRefs: technicalList(value) }))} />
          </Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Secondary-hazard SSCs" hint="Separate references with commas.">
            <TextArea rows={3} value={draft.secondaryHazardSscRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, secondaryHazardSscRefs: technicalList(value) }))} />
          </Field>
          <Field label="Structures and passive SSCs" hint="Separate references with commas.">
            <TextArea rows={3} value={draft.additionalStructuresAndPassiveSscRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, additionalStructuresAndPassiveSscRefs: technicalList(value) }))} />
          </Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Selection control</h3>
        <Field label="Failure-mode identification">
          <TextArea rows={4} value={draft.failureModeIdentificationProcess} onChange={(value) => setDraft((current) => ({ ...current, failureModeIdentificationProcess: value }))} />
        </Field>
        <Field label="Systems and fragility coordination">
          <TextArea rows={4} value={draft.systemsFragilityAnalystCoordination} onChange={(value) => setDraft((current) => ({ ...current, systemsFragilityAnalystCoordination: value }))} />
        </Field>
        <Field label="Completeness checks" hint="One check per line.">
          <TextArea rows={7} value={draft.completenessChecks.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, completenessChecks: technicalList(value) }))} />
        </Field>
        <Field label="Revision basis">
          <TextArea rows={4} value={draft.revisionBasis} onChange={(value) => setDraft((current) => ({ ...current, revisionBasis: value }))} />
        </Field>
      </div>
    </fieldset>
  </Drawer>;
}

function SelEntryEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newSelEntry()
    : mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment[index]!;
  const [draft, setDraft] = useState<SelEntry>(() => ({
    ...original,
    reactorUnitRefs: [...original.reactorUnitRefs],
    radioactiveMaterialSourceRefs: [...(original.radioactiveMaterialSourceRefs ?? [])],
    creditedFunctions: [...original.creditedFunctions],
    inclusionSources: [...original.inclusionSources],
    sourceElementRefs: [...original.sourceElementRefs],
    failureModes: original.failureModes.map((mode) => ({
      ...mode,
      systemModelBasicEventRefs: [...mode.systemModelBasicEventRefs],
      eventSequenceRefs: [...(mode.eventSequenceRefs ?? [])],
      fragilityMechanismRefs: [...mode.fragilityMechanismRefs],
      implementsSrs: mode.implementsSrs.map((reference) => ({ ...reference })),
    })),
    correlationGroupRefs: [...original.correlationGroupRefs],
    revisionHistory: original.revisionHistory.map((revision) => ({ ...revision })),
    implementsSrs: original.implementsSrs.map((reference) => ({ ...reference })),
  }));
  function changeFailureMode(modeIndex: number, change: Partial<SelFailureMode>): void {
    setDraft((current) => ({
      ...current,
      failureModes: current.failureModes.map((mode, candidate) =>
        candidate === modeIndex ? { ...mode, ...change } : mode),
    }));
  }
  function toggleInclusion(source: typeof SEL_INCLUSION_OPTIONS[number], checked: boolean): void {
    setDraft((current) => ({
      ...current,
      inclusionSources: checked
        ? [...new Set([...current.inclusionSources, source])]
        : current.inclusionSources.filter((item) => item !== source),
    }));
  }
  function save(): void {
    update((next) => {
      const equipment = next.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
      if (index === null) equipment.push(draft);
      else equipment[index] = draft;
      next.seismicFragilityAnalysis.scope.includedSscRefs = equipment.map((item) => item.uuid);
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      const equipment = next.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
      equipment.splice(index, 1);
      next.seismicFragilityAnalysis.scope.includedSscRefs = equipment.map((item) => item.uuid);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.integration} title={draft.name} subtitle="Record the SSC identity, location, credited function, inclusion source, credible failures, plant-model consequences, and preliminary disposition." plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove SSC</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save SSC</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">SSC</h3>
        <FieldGrid>
          <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
          <Field label="Type"><SelectInput value={draft.sscType} options={["STRUCTURE", "SYSTEM", "COMPONENT", "RELAY", "PANEL", "CABINET", "FLOOD_SOURCE", "FIRE_SOURCE", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, sscType: value as SelEntry["sscType"] }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="System reference"><TextInput value={draft.systemRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, systemRef: value || undefined }))} /></Field>
          <Field label="Structure reference"><TextInput value={draft.structureRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, structureRef: value || undefined }))} /></Field>
          <Field label="Component reference"><TextInput value={draft.componentRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, componentRef: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Parent structure or cabinet"><TextInput value={draft.parentSscRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, parentSscRef: value || undefined }))} /></Field>
        <FieldGrid>
          <Field label="Building"><TextInput value={draft.building} onChange={(value) => setDraft((current) => ({ ...current, building: value }))} /></Field>
          <Field label="Room or area"><TextInput value={draft.roomOrArea ?? ""} onChange={(value) => setDraft((current) => ({ ...current, roomOrArea: value || undefined }))} /></Field>
          <Field label="Elevation"><TextInput value={draft.elevation ?? ""} onChange={(value) => setDraft((current) => ({ ...current, elevation: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Orientation"><TextInput value={draft.orientation ?? ""} onChange={(value) => setDraft((current) => ({ ...current, orientation: value || undefined }))} /></Field>
        <Field label="Mounting and anchorage"><TextArea rows={3} value={draft.mountingAndAnchorage} onChange={(value) => setDraft((current) => ({ ...current, mountingAndAnchorage: value }))} /></Field>
        <Field label="Credited functions" hint="Separate values with commas."><TextArea rows={3} value={draft.creditedFunctions.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, creditedFunctions: technicalList(value) }))} /></Field>
        <FieldGrid>
          <Field label="Reactor units" hint="Separate references with commas."><TextInput value={draft.reactorUnitRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, reactorUnitRefs: technicalList(value) }))} /></Field>
          <Field label="Radioactive-material sources" hint="Separate references with commas."><TextInput value={(draft.radioactiveMaterialSourceRefs ?? []).join(", ")} onChange={(value) => setDraft((current) => ({ ...current, radioactiveMaterialSourceRefs: technicalList(value) }))} /></Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Selected from</h3>
        <div className="sinlineeditor__choices">
          {SEL_INCLUSION_OPTIONS.map((source) => <label className={`sinlineeditor__choice${draft.inclusionSources.includes(source) ? " sinlineeditor__choice--active" : ""}`} key={source}>
            <input type="checkbox" checked={draft.inclusionSources.includes(source)} onChange={(event) => toggleInclusion(source, event.target.checked)} />
            <span><strong>{displayLabel(source)}</strong></span>
          </label>)}
        </div>
        <Field label="Source model references" hint="Separate references with commas."><TextArea rows={3} value={draft.sourceElementRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, sourceElementRefs: technicalList(value) }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Failure modes</h3>
        {draft.failureModes.map((mode, modeIndex) => <div className="sinlineeditor__subgroup" key={mode.uuid}>
          <FieldGrid>
            <Field label={`Failure mode ${modeIndex + 1}`}><TextInput value={mode.name} onChange={(value) => changeFailureMode(modeIndex, { name: value })} /></Field>
            <Field label="Type"><SelectInput value={mode.failureModeType} options={["FUNCTIONAL", "STRUCTURAL", "ANCHORAGE", "PRESSURE_BOUNDARY", "CONTACT_CHATTER", "FLOOD_SOURCE", "FIRE_IGNITION_SOURCE", "SEISMIC_INTERACTION", "SOIL_FAILURE", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => changeFailureMode(modeIndex, { failureModeType: value as SelFailureMode["failureModeType"] })} /></Field>
            <Field label="Required state"><SelectInput value={mode.requiredState} options={["FUNCTION_DURING_EARTHQUAKE", "FUNCTION_AFTER_EARTHQUAKE", "MAINTAIN_BOUNDARY", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => changeFailureMode(modeIndex, { requiredState: value as SelFailureMode["requiredState"] })} /></Field>
          </FieldGrid>
          <Field label="Description"><TextArea rows={2} value={mode.description} onChange={(value) => changeFailureMode(modeIndex, { description: value })} /></Field>
          <Field label="Credited function"><TextArea rows={2} value={mode.creditedFunction} onChange={(value) => changeFailureMode(modeIndex, { creditedFunction: value })} /></Field>
          <Field label="Failure definition"><TextArea rows={2} value={mode.failureDefinition} onChange={(value) => changeFailureMode(modeIndex, { failureDefinition: value })} /></Field>
          <FieldGrid>
            <Field label="System basic events" hint="Separate references with commas."><TextInput value={mode.systemModelBasicEventRefs.join(", ")} onChange={(value) => changeFailureMode(modeIndex, { systemModelBasicEventRefs: technicalList(value) })} /></Field>
            <Field label="Event sequences" hint="Separate references with commas."><TextInput value={(mode.eventSequenceRefs ?? []).join(", ")} onChange={(value) => changeFailureMode(modeIndex, { eventSequenceRefs: technicalList(value) })} /></Field>
          </FieldGrid>
          <Field label="Failure effect"><TextArea rows={2} value={mode.consequenceDescription} onChange={(value) => changeFailureMode(modeIndex, { consequenceDescription: value })} /></Field>
          {editable && draft.failureModes.length > 1 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, failureModes: current.failureModes.filter((_, candidate) => candidate !== modeIndex) }))}>Remove failure mode</button>}
        </div>)}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, failureModes: [...current.failureModes, newSelFailureMode()] }))}>Add failure mode</button>}
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Preliminary disposition</h3>
        <Field label="Disposition"><SelectInput value={draft.disposition} options={["ACTIVE", "INHERENTLY_RUGGED", "ABOVE_FRAGILITY_THRESHOLD", "REMOVED_FROM_MODEL"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, disposition: value as SelEntry["disposition"] }))} /></Field>
        <Field label="Correlation groups" hint="Separate references with commas."><TextInput value={draft.correlationGroupRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, correlationGroupRefs: technicalList(value) }))} /></Field>
        <Field label="Disposition basis"><TextArea rows={3} value={draft.dispositionBasis} onChange={(value) => setDraft((current) => ({ ...current, dispositionBasis: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function InitialSelScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const sel = mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
  const [entryIndex, setEntryIndex] = useState<number | null | undefined>(undefined);
  const failureRows = sel.equipment.flatMap((item, index) =>
    item.failureModes.map((failure) => ({ item, index, failure })));

  function itemReference(item: SelEntry): string {
    return item.componentRef
      ?? item.systemRef
      ?? item.structureRef
      ?? item.sourceElementRefs[0]
      ?? item.uuid;
  }

  return <>
    <Section
      title="Initial seismic equipment list"
      description="This is the first controlled list of SSCs that may matter to seismic risk. It begins with the baseline systems model, then adds structures, passive components, relays, cabinets, fire and flood sources, secondary-hazard SSCs, and operator-support equipment."
      tone="integration"
      actions={editable ? <AddButton label="Add SSC" onClick={() => setEntryIndex(null)} /> : undefined}
    >
      {sel.equipment.length === 0
        ? <TechnicalEmptyState title="No SSCs selected" detail="Start with SSCs represented in the baseline systems model, then add the seismic-only scope." />
        : <Table
          headers={["SSC", "Type", "Credited function", "Plant location", "Included from", "Preliminary disposition"]}
          minWidth={0}
          columnWidths={["20%", "10%", "25%", "18%", "15%", "12%"]}
          className="stable--wrapheads stable--technical"
        >
          {sel.equipment.map((item, index) => <tr className={editable ? "postable__row--clickable" : undefined} key={item.uuid} onClick={editable ? () => setEntryIndex(index) : undefined}>
            <td className="stable__key"><strong>{item.name}</strong><code>{itemReference(item)}</code></td>
            <td>{displayLabel(item.sscType)}</td>
            <td>{item.creditedFunctions.join("; ") || "Not defined"}</td>
            <td>{item.building}<code>{[item.roomOrArea, item.elevation, item.parentSscRef].filter(Boolean).join(" · ") || "Location incomplete"}</code></td>
            <td>{item.inclusionSources.map(displayLabel).join("; ") || "Not identified"}</td>
            <td><Tag tone={item.disposition === "ACTIVE" ? "spr" : item.disposition === "REMOVED_FROM_MODEL" ? "neutral" : "good"}>{displayLabel(item.disposition)}</Tag></td>
          </tr>)}
        </Table>}
    </Section>

    <Section
      title="Failure consequences"
      description="Each row defines one credible seismic failure and the plant-model effect it creates. The basic-event reference is the connection to the systems or event-sequence model; the correlation group identifies failures that may not be independent."
      tone="integration"
    >
      {failureRows.length === 0
        ? <TechnicalEmptyState title="No failure consequences defined" detail="Define at least one credible physical failure and plant-model consequence for each retained SSC." />
        : <Table
          headers={["SSC", "Credible failure", "Required function", "Plant-model consequence", "Basic event", "Correlation group"]}
          minWidth={0}
          columnWidths={["18%", "18%", "19%", "25%", "10%", "10%"]}
          className="stable--wrapheads stable--technical"
        >
          {failureRows.map(({ item, index, failure }) => <tr className={editable ? "postable__row--clickable" : undefined} key={failure.uuid} onClick={editable ? () => setEntryIndex(index) : undefined}>
            <td className="stable__key"><strong>{item.name}</strong><code>{displayLabel(item.sscType)}</code></td>
            <td>{failure.name}<code>{displayLabel(failure.failureModeType)}</code></td>
            <td>{failure.creditedFunction || item.creditedFunctions.join("; ") || "Not defined"}<code>{displayLabel(failure.requiredState)}</code></td>
            <td>{failure.consequenceDescription || "Not defined"}</td>
            <td>{failure.systemModelBasicEventRefs.join(", ") || "Not assigned"}</td>
            <td>{item.correlationGroupRefs.join(", ") || "Independent pending review"}</td>
          </tr>)}
        </Table>}
    </Section>

    {entryIndex !== undefined && <SelEntryEditor index={entryIndex} onClose={() => setEntryIndex(undefined)} />}
  </>;
}

function newReferenceEarthquake(): SfrReferenceEarthquake {
  return {
    uuid: crypto.randomUUID(),
    name: "New reference earthquake",
    hazardSpectrumRef: "",
    groundMotionParameterRef: "",
    controlPointRef: "",
    groundMotionLevel: 0,
    groundMotionUnits: "g",
    horizontalComponentRefs: [],
    verticalComponentRef: "",
    hazardRangeOfInterest: {
      lowerGroundMotion: 0,
      upperGroundMotion: 0,
      basis: "",
    },
    selectionMethod: "",
    selectionValidation: "",
    nonlinearBehaviorBasis: "",
    implementsSrs: [{ sr: "SFR-B1", hlr: "B" }, { sr: "SFR-B2", hlr: "B" }],
  };
}

function newStructuralModel(): SfrStructuralModel {
  return {
    uuid: crypto.randomUUID(),
    name: "New three-dimensional structural model",
    structureRef: "",
    modelType: "THREE_DIMENSIONAL_FINITE_ELEMENT",
    softwareAndVersion: "",
    modelFileRefs: [],
    asModeledCondition: "AS_DESIGNED",
    stiffnessRepresentation: "",
    massRepresentation: "",
    dampingRepresentation: "",
    stressStateRepresentation: "",
    directionalCoupling: "",
    rotationalInertia: "",
    diaphragmFlexibility: "",
    torsionalEffects: "",
    structuralCoupling: "",
    foundationAndEmbedment: "",
    nonlinearFeatures: [],
    modalProperties: [],
    verificationAndValidation: "",
    limitations: [],
    implementsSrs: [{ sr: "SFR-B3", hlr: "B" }],
  };
}

function newResponseResult(): SfrResponseResult {
  return {
    uuid: crypto.randomUUID(),
    name: "New seismic response result",
    responseModelRef: "",
    referenceEarthquakeRef: "",
    location: "",
    responseQuantity: "FLOOR_RESPONSE_SPECTRUM",
    direction: "X",
    units: "g",
    spectrumPoints: [
      { frequencyHz: 1, periodSeconds: 1, medianResponse: 0 },
      { frequencyHz: 5, periodSeconds: 0.2, medianResponse: 0 },
      { frequencyHz: 10, periodSeconds: 0.1, medianResponse: 0 },
    ],
    betaRandomness: 0,
    betaUncertainty: 0,
    compositeBeta: 0,
    variabilityBasis: "",
    applicableSscRefs: [],
    implementsSrs: [{ sr: "SFR-B4", hlr: "B" }],
  };
}

function newSsiAnalysis(): SfrSsiAnalysis {
  return {
    uuid: crypto.randomUUID(),
    name: "New soil-structure interaction analysis",
    applicable: true,
    significanceAssessment: "",
    analysisType: "PROBABILISTIC",
    method: "",
    siteSpecific: true,
    soilProfileRefs: [],
    strainCompatibleProperties: true,
    embedmentTreatment: "",
    groundMotionIncoherenceTreatment: "",
    structureSoilStructureInteractionTreatment: "",
    medianResponseResultRefs: [],
    uncertaintyResultRefs: [],
    exclusionOrMethodBasis: "",
    implementsSrs: [{ sr: "SFR-B5", hlr: "B" }],
  };
}

function newSimulation(): SfrSimulation {
  return {
    uuid: crypto.randomUUID(),
    name: "New probabilistic response simulation",
    method: "LATIN_HYPERCUBE",
    simulationCount: 0,
    inputMotionSetCount: 0,
    componentsPerSet: 3,
    sampledAleatoryVariables: [],
    sampledEpistemicVariables: [],
    correlationTreatment: "",
    convergenceMetric: "",
    convergenceCriterion: "",
    convergenceResults: [],
    stableResponsesDemonstrated: false,
    outputResultRefs: [],
    implementsSrs: [{ sr: "SFR-B6", hlr: "B" }],
  };
}

function ResponseSetupEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const response = mef.seismicFragilityAnalysis.seismicResponseAnalysis;
  const [draft, setDraft] = useState(() => ({
    hazardSpectrumRefs: [...response.hazardSpectrumRefs],
    threeOrthogonalDirectionsUsed: response.threeOrthogonalDirectionsUsed,
    groundMotionParameterConsistency: response.groundMotionParameterConsistency,
    controlPointConsistency: response.controlPointConsistency,
    timeHistoryDevelopmentBasis: response.timeHistoryDevelopmentBasis,
    medianCentered: response.medianCentered,
    approximationBiasAssessment: response.approximationBiasAssessment,
  }));
  function save(): void {
    update((next) => {
      Object.assign(next.seismicFragilityAnalysis.seismicResponseAnalysis, draft);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title="Response setup" subtitle="Input motion, common definitions, and response treatment" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save changes</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Input motion</h3>
        <Field label="Hazard spectra" hint="Separate references with commas."><TextArea rows={3} value={draft.hazardSpectrumRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, hazardSpectrumRefs: technicalList(value) }))} /></Field>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.threeOrthogonalDirectionsUsed} onChange={(event) => setDraft((current) => ({ ...current, threeOrthogonalDirectionsUsed: event.target.checked }))} /><span>Use three simultaneous orthogonal directions</span></label>
        <Field label="Ground-motion definition"><TextArea rows={3} value={draft.groundMotionParameterConsistency} onChange={(value) => setDraft((current) => ({ ...current, groundMotionParameterConsistency: value }))} /></Field>
        <Field label="Control-point transfer"><TextArea rows={3} value={draft.controlPointConsistency} onChange={(value) => setDraft((current) => ({ ...current, controlPointConsistency: value }))} /></Field>
        <Field label="Time-history development"><TextArea rows={4} value={draft.timeHistoryDevelopmentBasis} onChange={(value) => setDraft((current) => ({ ...current, timeHistoryDevelopmentBasis: value }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Response treatment</h3>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.medianCentered} onChange={(event) => setDraft((current) => ({ ...current, medianCentered: event.target.checked }))} /><span>Response analysis is median-centered</span></label>
        <Field label="Approximation and scaling check"><TextArea rows={4} value={draft.approximationBiasAssessment} onChange={(value) => setDraft((current) => ({ ...current, approximationBiasAssessment: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function ReferenceEarthquakeEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newReferenceEarthquake()
    : mef.seismicFragilityAnalysis.seismicResponseAnalysis.referenceEarthquakes[index]!;
  const [draft, setDraft] = useState<SfrReferenceEarthquake>(() => structuredClone(original));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.seismicResponseAnalysis.referenceEarthquakes;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.seismicResponseAnalysis.referenceEarthquakes.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Hazard level, three-component input, and applicable response range" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove earthquake</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save earthquake</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Reference motion</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Hazard spectrum"><TextInput value={draft.hazardSpectrumRef} onChange={(value) => setDraft((current) => ({ ...current, hazardSpectrumRef: value }))} /></Field>
          <Field label="Ground-motion parameter"><TextInput value={draft.groundMotionParameterRef} onChange={(value) => setDraft((current) => ({ ...current, groundMotionParameterRef: value }))} /></Field>
          <Field label="Control point"><TextInput value={draft.controlPointRef} onChange={(value) => setDraft((current) => ({ ...current, controlPointRef: value }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Annual exceedance frequency"><NumberInput value={draft.annualFrequencyOfExceedance ?? 0} onChange={(value) => setDraft((current) => ({ ...current, annualFrequencyOfExceedance: value }))} /></Field>
          <Field label="Input level"><NumberInput value={draft.groundMotionLevel} onChange={(value) => setDraft((current) => ({ ...current, groundMotionLevel: value }))} /></Field>
          <Field label="Units"><TextInput value={draft.groundMotionUnits} onChange={(value) => setDraft((current) => ({ ...current, groundMotionUnits: value }))} /></Field>
          <Field label="Risk-dominant level"><NumberInput value={draft.riskDominantInputLevel ?? 0} onChange={(value) => setDraft((current) => ({ ...current, riskDominantInputLevel: value || undefined }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Horizontal input suites" hint="Separate references with commas."><TextArea rows={3} value={draft.horizontalComponentRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, horizontalComponentRefs: technicalList(value) }))} /></Field>
          <Field label="Vertical input suite"><TextInput value={draft.verticalComponentRef} onChange={(value) => setDraft((current) => ({ ...current, verticalComponentRef: value }))} /></Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Applicable range</h3>
        <FieldGrid>
          <Field label="Lower motion"><NumberInput value={draft.hazardRangeOfInterest.lowerGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, hazardRangeOfInterest: { ...current.hazardRangeOfInterest, lowerGroundMotion: value } }))} /></Field>
          <Field label="Upper motion"><NumberInput value={draft.hazardRangeOfInterest.upperGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, hazardRangeOfInterest: { ...current.hazardRangeOfInterest, upperGroundMotion: value } }))} /></Field>
        </FieldGrid>
        <Field label="Range justification"><TextArea rows={3} value={draft.hazardRangeOfInterest.basis} onChange={(value) => setDraft((current) => ({ ...current, hazardRangeOfInterest: { ...current.hazardRangeOfInterest, basis: value } }))} /></Field>
        <Field label="Selection method"><TextArea rows={3} value={draft.selectionMethod} onChange={(value) => setDraft((current) => ({ ...current, selectionMethod: value }))} /></Field>
        <Field label="Selection validation"><TextArea rows={3} value={draft.selectionValidation} onChange={(value) => setDraft((current) => ({ ...current, selectionValidation: value }))} /></Field>
        <Field label="Nonlinear response treatment"><TextArea rows={3} value={draft.nonlinearBehaviorBasis} onChange={(value) => setDraft((current) => ({ ...current, nonlinearBehaviorBasis: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function StructuralModelEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newStructuralModel()
    : mef.seismicFragilityAnalysis.seismicResponseAnalysis.structuralModels[index]!;
  const [draft, setDraft] = useState<SfrStructuralModel>(() => structuredClone(original));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.seismicResponseAnalysis.structuralModels;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.seismicResponseAnalysis.structuralModels.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Three-dimensional model, dynamic properties, SSI boundary, and verification" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove model</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save model</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Model</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Structure reference"><TextInput value={draft.structureRef} onChange={(value) => setDraft((current) => ({ ...current, structureRef: value }))} /></Field>
          <Field label="Model type"><SelectInput value={draft.modelType} options={["THREE_DIMENSIONAL_FINITE_ELEMENT", "THREE_DIMENSIONAL_LUMPED_MASS", "OTHER_THREE_DIMENSIONAL"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, modelType: value as SfrStructuralModel["modelType"] }))} /></Field>
          <Field label="Plant condition"><SelectInput value={draft.asModeledCondition} options={["AS_DESIGNED", "AS_BUILT", "AS_OPERATED", "AS_INTENDED_TO_OPERATE"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, asModeledCondition: value as SfrStructuralModel["asModeledCondition"] }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Software"><TextInput value={draft.softwareAndVersion} onChange={(value) => setDraft((current) => ({ ...current, softwareAndVersion: value }))} /></Field>
          <Field label="Model files" hint="Separate references with commas."><TextArea rows={3} value={draft.modelFileRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, modelFileRefs: technicalList(value) }))} /></Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Three-dimensional representation</h3>
        <FieldGrid>
          <Field label="Stiffness"><TextArea rows={3} value={draft.stiffnessRepresentation} onChange={(value) => setDraft((current) => ({ ...current, stiffnessRepresentation: value }))} /></Field>
          <Field label="Mass"><TextArea rows={3} value={draft.massRepresentation} onChange={(value) => setDraft((current) => ({ ...current, massRepresentation: value }))} /></Field>
          <Field label="Damping"><TextArea rows={3} value={draft.dampingRepresentation} onChange={(value) => setDraft((current) => ({ ...current, dampingRepresentation: value }))} /></Field>
          <Field label="Stress state"><TextArea rows={3} value={draft.stressStateRepresentation} onChange={(value) => setDraft((current) => ({ ...current, stressStateRepresentation: value }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Directional coupling"><TextArea rows={3} value={draft.directionalCoupling} onChange={(value) => setDraft((current) => ({ ...current, directionalCoupling: value }))} /></Field>
          <Field label="Rotational inertia"><TextArea rows={3} value={draft.rotationalInertia} onChange={(value) => setDraft((current) => ({ ...current, rotationalInertia: value }))} /></Field>
          <Field label="Diaphragm flexibility"><TextArea rows={3} value={draft.diaphragmFlexibility} onChange={(value) => setDraft((current) => ({ ...current, diaphragmFlexibility: value }))} /></Field>
          <Field label="Torsional effects"><TextArea rows={3} value={draft.torsionalEffects} onChange={(value) => setDraft((current) => ({ ...current, torsionalEffects: value }))} /></Field>
        </FieldGrid>
        <Field label="Structural coupling"><TextArea rows={3} value={draft.structuralCoupling} onChange={(value) => setDraft((current) => ({ ...current, structuralCoupling: value }))} /></Field>
        <Field label="Foundation and embedment"><TextArea rows={3} value={draft.foundationAndEmbedment} onChange={(value) => setDraft((current) => ({ ...current, foundationAndEmbedment: value }))} /></Field>
        <Field label="Nonlinear features" hint="One feature per line."><TextArea rows={4} value={draft.nonlinearFeatures.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, nonlinearFeatures: technicalList(value) }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Modal properties</h3>
        <div className="sresponsepoints">
          <Table headers={["Mode", "Frequency (Hz)", "Damping", "Direction", "Mass participation"]} minWidth={620}>
            {draft.modalProperties.map((mode, modeIndex) => <tr key={`${mode.mode}-${modeIndex}`}>
              <td><NumberInput value={mode.mode} onChange={(value) => setDraft((current) => ({ ...current, modalProperties: current.modalProperties.map((item, candidate) => candidate === modeIndex ? { ...item, mode: value } : item) }))} /></td>
              <td><NumberInput value={mode.frequencyHz} onChange={(value) => setDraft((current) => ({ ...current, modalProperties: current.modalProperties.map((item, candidate) => candidate === modeIndex ? { ...item, frequencyHz: value } : item) }))} /></td>
              <td><NumberInput value={mode.dampingRatio} onChange={(value) => setDraft((current) => ({ ...current, modalProperties: current.modalProperties.map((item, candidate) => candidate === modeIndex ? { ...item, dampingRatio: value } : item) }))} /></td>
              <td><TextInput value={mode.direction} onChange={(value) => setDraft((current) => ({ ...current, modalProperties: current.modalProperties.map((item, candidate) => candidate === modeIndex ? { ...item, direction: value } : item) }))} /></td>
              <td><NumberInput value={mode.massParticipationFraction} onChange={(value) => setDraft((current) => ({ ...current, modalProperties: current.modalProperties.map((item, candidate) => candidate === modeIndex ? { ...item, massParticipationFraction: value } : item) }))} /></td>
            </tr>)}
          </Table>
        </div>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, modalProperties: [...current.modalProperties, { mode: current.modalProperties.length + 1, frequencyHz: 0, dampingRatio: 0.05, direction: "X", massParticipationFraction: 0 }] }))}>Add mode</button>}
        <Field label="Verification and validation"><TextArea rows={4} value={draft.verificationAndValidation} onChange={(value) => setDraft((current) => ({ ...current, verificationAndValidation: value }))} /></Field>
        <Field label="Limitations" hint="One limitation per line."><TextArea rows={4} value={draft.limitations.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, limitations: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function ResponseResultEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newResponseResult()
    : mef.seismicFragilityAnalysis.seismicResponseAnalysis.responseResults[index]!;
  const [draft, setDraft] = useState<SfrResponseResult>(() => structuredClone(original));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.seismicResponseAnalysis.responseResults;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.seismicResponseAnalysis.responseResults.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Median response, variability, location, and applicable SSCs" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove result</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save result</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Response result</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Structural model"><TextInput value={draft.responseModelRef} onChange={(value) => setDraft((current) => ({ ...current, responseModelRef: value }))} /></Field>
          <Field label="Reference earthquake"><TextInput value={draft.referenceEarthquakeRef} onChange={(value) => setDraft((current) => ({ ...current, referenceEarthquakeRef: value }))} /></Field>
        </FieldGrid>
        <Field label="Location"><TextInput value={draft.location} onChange={(value) => setDraft((current) => ({ ...current, location: value }))} /></Field>
        <FieldGrid>
          <Field label="Response quantity"><SelectInput value={draft.responseQuantity} options={["FLOOR_RESPONSE_SPECTRUM", "STRUCTURAL_LOAD", "DISPLACEMENT", "ACCELERATION", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, responseQuantity: value as SfrResponseResult["responseQuantity"] }))} /></Field>
          <Field label="Direction"><SelectInput value={draft.direction} options={["X", "Y", "Z", "COMBINED"].map((value) => ({ value, label: value }))} onChange={(value) => setDraft((current) => ({ ...current, direction: value as SfrResponseResult["direction"] }))} /></Field>
          <Field label="Units"><TextInput value={draft.units} onChange={(value) => setDraft((current) => ({ ...current, units: value }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Randomness, beta R"><NumberInput value={draft.betaRandomness} onChange={(value) => setDraft((current) => ({ ...current, betaRandomness: value }))} /></Field>
          <Field label="Uncertainty, beta U"><NumberInput value={draft.betaUncertainty} onChange={(value) => setDraft((current) => ({ ...current, betaUncertainty: value }))} /></Field>
          <Field label="Composite beta"><NumberInput value={draft.compositeBeta ?? 0} onChange={(value) => setDraft((current) => ({ ...current, compositeBeta: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Variability basis"><TextArea rows={4} value={draft.variabilityBasis} onChange={(value) => setDraft((current) => ({ ...current, variabilityBasis: value }))} /></Field>
        <Field label="Applicable SSCs" hint="Separate references with commas."><TextArea rows={4} value={draft.applicableSscRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, applicableSscRefs: technicalList(value) }))} /></Field>
        <Field label="Output file"><TextInput value={draft.outputFileRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, outputFileRef: value || undefined }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Median spectrum</h3>
        <div className="sresponsepoints">
          <Table headers={["Frequency (Hz)", "Period (s)", `Median (${draft.units || "units"})`]} minWidth={520}>
            {(draft.spectrumPoints ?? []).map((point, pointIndex) => <tr key={`${point.frequencyHz}-${pointIndex}`}>
              <td><NumberInput value={point.frequencyHz} onChange={(value) => setDraft((current) => ({ ...current, spectrumPoints: (current.spectrumPoints ?? []).map((item, candidate) => candidate === pointIndex ? { ...item, frequencyHz: value } : item) }))} /></td>
              <td><NumberInput value={point.periodSeconds} onChange={(value) => setDraft((current) => ({ ...current, spectrumPoints: (current.spectrumPoints ?? []).map((item, candidate) => candidate === pointIndex ? { ...item, periodSeconds: value } : item) }))} /></td>
              <td><NumberInput value={point.medianResponse} onChange={(value) => setDraft((current) => ({ ...current, spectrumPoints: (current.spectrumPoints ?? []).map((item, candidate) => candidate === pointIndex ? { ...item, medianResponse: value } : item) }))} /></td>
            </tr>)}
          </Table>
        </div>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, spectrumPoints: [...(current.spectrumPoints ?? []), { frequencyHz: 0, periodSeconds: 0, medianResponse: 0 }] }))}>Add spectrum point</button>}
      </div>
    </fieldset>
  </Drawer>;
}

function SsiAnalysisEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newSsiAnalysis()
    : mef.seismicFragilityAnalysis.seismicResponseAnalysis.soilStructureInteractionAnalyses[index]!;
  const [draft, setDraft] = useState<SfrSsiAnalysis>(() => structuredClone(original));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.seismicResponseAnalysis.soilStructureInteractionAnalyses;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.seismicResponseAnalysis.soilStructureInteractionAnalyses.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Site-specific soil, embedment, incoherence, and response uncertainty" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove SSI analysis</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save SSI analysis</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">SSI treatment</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.applicable} onChange={(event) => setDraft((current) => ({ ...current, applicable: event.target.checked }))} /><span>SSI is applicable</span></label>
        <Field label="Significance assessment"><TextArea rows={3} value={draft.significanceAssessment} onChange={(value) => setDraft((current) => ({ ...current, significanceAssessment: value }))} /></Field>
        <FieldGrid>
          <Field label="Analysis type"><SelectInput value={draft.analysisType ?? "PROBABILISTIC"} options={["DETERMINISTIC", "PROBABILISTIC"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, analysisType: value as SfrSsiAnalysis["analysisType"] }))} /></Field>
          <Field label="Method"><TextInput value={draft.method ?? ""} onChange={(value) => setDraft((current) => ({ ...current, method: value || undefined }))} /></Field>
        </FieldGrid>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.siteSpecific} onChange={(event) => setDraft((current) => ({ ...current, siteSpecific: event.target.checked }))} /><span>Use site-specific soil properties</span></label>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.strainCompatibleProperties} onChange={(event) => setDraft((current) => ({ ...current, strainCompatibleProperties: event.target.checked }))} /><span>Use strain-compatible soil properties</span></label>
        <Field label="Soil profiles" hint="Separate references with commas."><TextInput value={draft.soilProfileRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, soilProfileRefs: technicalList(value) }))} /></Field>
        <Field label="Embedment"><TextArea rows={3} value={draft.embedmentTreatment ?? ""} onChange={(value) => setDraft((current) => ({ ...current, embedmentTreatment: value || undefined }))} /></Field>
        <Field label="Ground-motion incoherence"><TextArea rows={3} value={draft.groundMotionIncoherenceTreatment ?? ""} onChange={(value) => setDraft((current) => ({ ...current, groundMotionIncoherenceTreatment: value || undefined }))} /></Field>
        <Field label="Structure-soil-structure interaction"><TextArea rows={3} value={draft.structureSoilStructureInteractionTreatment ?? ""} onChange={(value) => setDraft((current) => ({ ...current, structureSoilStructureInteractionTreatment: value || undefined }))} /></Field>
        <FieldGrid>
          <Field label="Median-response results" hint="Separate references with commas."><TextArea rows={3} value={draft.medianResponseResultRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, medianResponseResultRefs: technicalList(value) }))} /></Field>
          <Field label="Uncertainty results" hint="Separate references with commas."><TextArea rows={3} value={draft.uncertaintyResultRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, uncertaintyResultRefs: technicalList(value) }))} /></Field>
        </FieldGrid>
        <Field label="Method justification"><TextArea rows={4} value={draft.exclusionOrMethodBasis} onChange={(value) => setDraft((current) => ({ ...current, exclusionOrMethodBasis: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function SimulationEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newSimulation()
    : mef.seismicFragilityAnalysis.seismicResponseAnalysis.probabilisticSimulations[index]!;
  const [draft, setDraft] = useState<SfrSimulation>(() => structuredClone(original));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.seismicResponseAnalysis.probabilisticSimulations;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.seismicResponseAnalysis.probabilisticSimulations.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Probabilistic sampling, correlation, and response convergence" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove simulation</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save simulation</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Sampling</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Method"><SelectInput value={draft.method} options={["MONTE_CARLO", "LATIN_HYPERCUBE", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, method: value as SfrSimulation["method"] }))} /></Field>
          <Field label="Simulations"><NumberInput value={draft.simulationCount} onChange={(value) => setDraft((current) => ({ ...current, simulationCount: value }))} /></Field>
          <Field label="Random seed"><NumberInput value={draft.randomSeed ?? 0} onChange={(value) => setDraft((current) => ({ ...current, randomSeed: value || undefined }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Input-motion sets"><NumberInput value={draft.inputMotionSetCount} onChange={(value) => setDraft((current) => ({ ...current, inputMotionSetCount: value }))} /></Field>
          <Field label="Components per set"><NumberInput value={draft.componentsPerSet} onChange={(value) => setDraft((current) => ({ ...current, componentsPerSet: value }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Aleatory variables" hint="One variable per line."><TextArea rows={5} value={draft.sampledAleatoryVariables.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, sampledAleatoryVariables: technicalList(value) }))} /></Field>
          <Field label="Epistemic variables" hint="One variable per line."><TextArea rows={5} value={draft.sampledEpistemicVariables.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, sampledEpistemicVariables: technicalList(value) }))} /></Field>
        </FieldGrid>
        <Field label="Correlation treatment"><TextArea rows={4} value={draft.correlationTreatment} onChange={(value) => setDraft((current) => ({ ...current, correlationTreatment: value }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Convergence</h3>
        <Field label="Metric"><TextArea rows={3} value={draft.convergenceMetric} onChange={(value) => setDraft((current) => ({ ...current, convergenceMetric: value }))} /></Field>
        <Field label="Criterion"><TextArea rows={3} value={draft.convergenceCriterion} onChange={(value) => setDraft((current) => ({ ...current, convergenceCriterion: value }))} /></Field>
        <label className="sbasis-editor__check"><input type="checkbox" checked={draft.stableResponsesDemonstrated} onChange={(event) => setDraft((current) => ({ ...current, stableResponsesDemonstrated: event.target.checked }))} /><span>Stable response is demonstrated</span></label>
        <div className="sresponsepoints">
          <Table headers={["Sample count", "Metric"]} minWidth={420}>
            {draft.convergenceResults.map((result, resultIndex) => <tr key={`${result.sampleCount}-${resultIndex}`}>
              <td><NumberInput value={result.sampleCount} onChange={(value) => setDraft((current) => ({ ...current, convergenceResults: current.convergenceResults.map((item, candidate) => candidate === resultIndex ? { ...item, sampleCount: value } : item) }))} /></td>
              <td><NumberInput value={result.metricValue} onChange={(value) => setDraft((current) => ({ ...current, convergenceResults: current.convergenceResults.map((item, candidate) => candidate === resultIndex ? { ...item, metricValue: value } : item) }))} /></td>
            </tr>)}
          </Table>
        </div>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, convergenceResults: [...current.convergenceResults, { sampleCount: 0, metricValue: 0 }] }))}>Add convergence point</button>}
        <Field label="Output results" hint="Separate references with commas."><TextArea rows={4} value={draft.outputResultRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, outputResultRefs: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function SelResponseScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const sel = mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
  const response = mef.seismicFragilityAnalysis.seismicResponseAnalysis;
  const foundationInputs =
    mef.seismicHazardAnalysis.responseSpectraEvaluation.foundationInputResponseSpectra;
  const [responseSetupOpen, setResponseSetupOpen] = useState(false);
  const [referenceIndex, setReferenceIndex] = useState<number | null | undefined>(undefined);
  const [modelIndex, setModelIndex] = useState<number | null | undefined>(undefined);
  const [resultIndex, setResultIndex] = useState<number | null | undefined>(undefined);
  const [ssiIndex, setSsiIndex] = useState<number | null | undefined>(undefined);
  const [simulationIndex, setSimulationIndex] = useState<number | null | undefined>(undefined);
  const [scalingEditor, setScalingEditor] = useState<CollectionEditorTarget | null>(null);
  const [selectedResponseRef, setSelectedResponseRef] = useState(response.responseResults[0]?.uuid ?? "");
  const [selectedSimulationRef, setSelectedSimulationRef] = useState(response.probabilisticSimulations[0]?.uuid ?? "");
  const selectedResponse = response.responseResults.find((result) => result.uuid === selectedResponseRef)
    ?? response.responseResults[0];
  const selectedSimulation = response.probabilisticSimulations.find(
    (simulation) => simulation.uuid === selectedSimulationRef,
  ) ?? response.probabilisticSimulations[0];
  const responseFan = useMemo(
    () => structuralResponseFanSeries(selectedResponse),
    [selectedResponse],
  );
  const sharedParameters = [...new Set(
    response.referenceEarthquakes.map((earthquake) => earthquake.groundMotionParameterRef),
  )];
  const sharedControlPoints = [...new Set(
    response.referenceEarthquakes.map((earthquake) => earthquake.controlPointRef),
  )];
  const scalingFields = [
    "name",
    "sourceResponseAnalysisRef",
    "targetResponseAnalysisRef",
    "scaleFactor",
    "originalSpectrumRef",
    "targetSpectrumRef",
    "structuralModelSimilarity",
    "foundationSimilarity",
    "inputMotionSimilarity",
    "naturalFrequencyAndModeShapeEvaluation",
    "nonlinearPhenomenaEvaluation",
    "conservativeForCapabilityCategoryOne",
    "adequacyJustification",
  ];
  const applicableSel = sel.equipment.filter(
    (item) => item.disposition !== "REMOVED_FROM_MODEL",
  );
  return <>
    <Section
      title="Response setup"
      description="This section sets the rules for shaking the plant models. It identifies the site-hazard spectra, the horizontal and vertical motion components, the shared motion parameter and control point, and whether the calculated response represents the median plant response."
      tone="sfr"
      actions={<EditButton label="Edit response setup" onClick={() => setResponseSetupOpen(true)} />}
    >
      <Table
        headers={["Hazard spectra", "Input directions", "Ground-motion parameter", "Control point", "Response target"]}
        minWidth={0}
        columnWidths={["24%", "16%", "20%", "20%", "20%"]}
        className="stable--wrapheads"
      >
        <tr>
          <td className="stable__key"><strong>{response.hazardSpectrumRefs.join(", ") || "Not selected"}</strong></td>
          <td>{response.threeOrthogonalDirectionsUsed ? "2 horizontal + 1 vertical" : "Not confirmed"}</td>
          <td>{sharedParameters.join(", ") || "Not defined"}</td>
          <td>{sharedControlPoints.join(", ") || "Not defined"}</td>
          <td>{response.medianCentered ? "Median response" : "Response target not confirmed"}</td>
        </tr>
      </Table>
    </Section>

    <Section
      title="Reference earthquakes and input motions"
      description="This section chooses a few representative earthquake levels from the site hazard and links each level to two horizontal motions and one vertical motion. These three motions are applied together so the plant model is shaken in all directions."
      tone="sfr"
    >
      {response.referenceEarthquakes.length === 0 && <TechnicalEmptyState title="No reference earthquakes" detail="Select a target hazard spectrum and its three-component input-motion suite." />}
      <Table
        caption="Reference earthquakes"
        captionActions={editable ? <AddButton label="Add reference earthquake" onClick={() => setReferenceIndex(null)} /> : undefined}
        headers={["Reference earthquake", "Annual frequency", "Input level", "Hazard range", "Input components"]}
        minWidth={0}
        columnWidths={["26%", "14%", "18%", "19%", "23%"]}
        className="stable--wrapheads"
      >
        {response.referenceEarthquakes.map((earthquake, index) => <tr className="postable__row--clickable" key={earthquake.uuid} onClick={() => setReferenceIndex(index)}>
          <td className="stable__key"><strong>{earthquake.name}</strong><code>{earthquake.hazardSpectrumRef}</code></td>
          <td className="smono">{earthquake.annualFrequencyOfExceedance === undefined ? "Not defined" : annualFrequency(earthquake.annualFrequencyOfExceedance)}</td>
          <td><strong>{earthquake.groundMotionLevel} {earthquake.groundMotionUnits}</strong><code>{earthquake.groundMotionParameterRef} | {earthquake.controlPointRef}</code></td>
          <td>{earthquake.hazardRangeOfInterest.lowerGroundMotion}-{earthquake.hazardRangeOfInterest.upperGroundMotion} {earthquake.groundMotionUnits}</td>
          <td>{earthquake.horizontalComponentRefs.length} horizontal + {earthquake.verticalComponentRef.trim().length > 0 ? 1 : 0} vertical<code>{[...earthquake.horizontalComponentRefs, earthquake.verticalComponentRef].filter(Boolean).join(" | ")}</code></td>
        </tr>)}
      </Table>
      {foundationInputs.length === 0
        ? <TechnicalEmptyState title="No foundation input motion" detail="Complete the foundation-input spectra in the site seismic-hazard step." />
        : <Table
          caption="Foundation input motion"
          headers={["Foundation spectrum", "Structure", "Control point", "Horizontal spectra", "Vertical spectrum"]}
          minWidth={0}
          columnWidths={["25%", "20%", "19%", "21%", "15%"]}
          className="stable--wrapheads"
        >
          {foundationInputs.map((input) => <tr key={input.uuid}>
            <td className="stable__key"><strong>{input.name}</strong></td>
            <td>{input.structureRef}</td>
            <td>{input.controlPointRef}</td>
            <td>{input.horizontalSpectrumRefs.join(", ") || "Not defined"}</td>
            <td>{input.verticalSpectrumRef ?? "Not defined"}</td>
          </tr>)}
        </Table>}
    </Section>

    <Section
      title="Structural models"
      description="This section represents each important plant structure as a three-dimensional dynamic model. The model turns foundation shaking into motion at the floors, cabinets, and components inside the structure."
      tone="sfr"
    >
      {response.structuralModels.length === 0 && <TechnicalEmptyState title="No structural models" detail="Add the three-dimensional models used to calculate plant response." />}
      <Table
        caption="Structural models"
        captionActions={editable ? <AddButton label="Add structural model" onClick={() => setModelIndex(null)} /> : undefined}
        headers={["Structural model", "Plant condition", "Model type", "Modal coverage", "Foundation"]}
        minWidth={0}
        columnWidths={["26%", "15%", "20%", "18%", "21%"]}
        className="stable--wrapheads"
      >
        {response.structuralModels.map((model, index) => {
          const frequencies = model.modalProperties.map((mode) => mode.frequencyHz);
          const participation = model.modalProperties.reduce((sum, mode) => sum + mode.massParticipationFraction, 0);
          return <tr className="postable__row--clickable" key={model.uuid} onClick={() => setModelIndex(index)}>
            <td className="stable__key"><strong>{model.name}</strong><code>{model.structureRef} | {model.softwareAndVersion}</code></td>
            <td>{displayLabel(model.asModeledCondition)}</td>
            <td>{displayLabel(model.modelType)}</td>
            <td>{model.modalProperties.length} modes<code>{numericRange(frequencies, "Hz")} | mass {participation.toFixed(2)}</code></td>
            <td>{model.foundationAndEmbedment}</td>
          </tr>;
        })}
      </Table>
      {response.scalingEvaluations.length === 0 && <TechnicalEmptyState title="No scaling checks" detail="Add a scaling check when an existing response calculation is used at another earthquake level." />}
      <Table
        caption="Scaling checks"
        captionActions={editable ? <AddButton label="Add scaling check" onClick={() => setScalingEditor({
          title: "New scaling check",
          subtitle: "Source response, target spectrum, scale factor, and applicability checks",
          focus: [],
          createAt: ["seismicFragilityAnalysis", "seismicResponseAnalysis", "scalingEvaluations"],
          visibleRootFields: scalingFields,
          inlinePrimitiveArrays: true,
        })} /> : undefined}
        headers={["Scaling check", "Scale factor", "Original spectrum", "Target spectrum", "Target response"]}
        minWidth={0}
        columnWidths={["30%", "12%", "18%", "18%", "22%"]}
        className="stable--wrapheads"
      >
        {response.scalingEvaluations.map((scaling, index) => <tr className="postable__row--clickable" key={scaling.uuid} onClick={() => setScalingEditor({
          title: scaling.name,
          subtitle: "Response scaling and applicability checks",
          focus: ["seismicFragilityAnalysis", "seismicResponseAnalysis", "scalingEvaluations", index],
          visibleRootFields: scalingFields,
          inlinePrimitiveArrays: true,
          removeLabel: "Remove scaling check",
        })}>
          <td className="stable__key"><strong>{scaling.name}</strong><code>{scaling.sourceResponseAnalysisRef}</code></td>
          <td className="smono">{scaling.scaleFactor.toFixed(3)}</td>
          <td>{scaling.originalSpectrumRef}</td>
          <td>{scaling.targetSpectrumRef}</td>
          <td>{scaling.targetResponseAnalysisRef}</td>
        </tr>)}
      </Table>
    </Section>

    <Section
      title="Soil-structure interaction"
      description="This section accounts for the fact that the soil and structure move together. Flexible soil can change the structure's frequencies, damping, rocking, and the motion that reaches each floor."
      tone="sfr"
      actions={editable ? <AddButton label="Add SSI analysis" onClick={() => setSsiIndex(null)} /> : undefined}
    >
      {response.soilStructureInteractionAnalyses.length === 0
        ? <TechnicalEmptyState title="No SSI analysis" detail="Add an SSI analysis where soil flexibility can affect plant response." />
        : <Table
          headers={["SSI analysis", "Method", "Soil profiles", "Response records"]}
          minWidth={0}
          columnWidths={["28%", "31%", "20%", "21%"]}
          className="stable--wrapheads"
        >
          {response.soilStructureInteractionAnalyses.map((ssi, index) => <tr className="postable__row--clickable" key={ssi.uuid} onClick={() => setSsiIndex(index)}>
            <td className="stable__key"><strong>{ssi.name}</strong><code>{ssi.applicable ? "Included" : "Not applicable"} | {ssi.analysisType === undefined ? "Method not defined" : displayLabel(ssi.analysisType)}</code></td>
            <td>{ssi.method ?? "Not defined"}<code>{ssi.strainCompatibleProperties ? "Strain-compatible soil properties" : "Nominal soil properties"}</code></td>
            <td>{ssi.soilProfileRefs.join(", ") || "Not defined"}</td>
            <td>{ssi.medianResponseResultRefs.length} median + {ssi.uncertaintyResultRefs.length} uncertainty</td>
          </tr>)}
        </Table>}
    </Section>

    <Section
      title="Plant response demands"
      description="This section shows how hard the earthquake shakes each plant location. The center curve is the median demand; the surrounding band shows plausible lower and upper demand after response uncertainty is included."
      tone="sfr"
    >
      {selectedResponse === undefined ? <TechnicalEmptyState title="No response results" detail="Calculate structural loads or floor-response spectra for the selected SSC locations." /> : <>
        <div className="sdistribution__head">
          <div><strong>{selectedResponse.name}</strong><span>{selectedResponse.responseModelRef} | {selectedResponse.referenceEarthquakeRef}</span></div>
          <label className="splotselect"><span>Response location</span><select className="sinput" aria-label="Response distribution" value={selectedResponse.uuid} onChange={(event) => setSelectedResponseRef(event.target.value)}>
            {response.responseResults.map((result) => <option key={result.uuid} value={result.uuid}>{result.name}</option>)}
          </select></label>
        </div>
        <DistributionFanChart points={responseFan} xLabel="Frequency (Hz, log scale)" yLabel={`Response (${selectedResponse.units})`} ariaLabel={`${selectedResponse.name} median response and 5th through 95th percentile distribution`} />
      </>}
      <Table
        caption="Response results"
        captionActions={editable ? <AddButton label="Add response result" onClick={() => setResultIndex(null)} /> : undefined}
        headers={["Response", "Model and direction", "Median range", "Variability", "Applicable SSCs"]}
        minWidth={0}
        columnWidths={["25%", "20%", "17%", "16%", "22%"]}
        className="stable--wrapheads"
      >
        {response.responseResults.map((result, index) => {
          const medians = result.spectrumPoints?.map((point) => point.medianResponse)
            ?? (result.medianValue === undefined ? [] : [result.medianValue]);
          return <tr className="postable__row--clickable" key={result.uuid} onClick={() => { setSelectedResponseRef(result.uuid); setResultIndex(index); }}>
            <td className="stable__key"><strong>{result.name}</strong><code>{result.location}</code></td>
            <td>{result.responseModelRef}<code>{result.direction} | {displayLabel(result.responseQuantity)}</code></td>
            <td><strong>{numericRange(medians, result.units)}</strong><code>{result.spectrumPoints?.length ?? 1} result points</code></td>
            <td>Beta R {result.betaRandomness.toFixed(3)}<code>Beta U {result.betaUncertainty.toFixed(3)} | composite {(result.compositeBeta ?? Math.sqrt(result.betaRandomness ** 2 + result.betaUncertainty ** 2)).toFixed(3)}</code></td>
            <td>{result.applicableSscRefs.join(", ")}</td>
          </tr>;
        })}
      </Table>
      {applicableSel.length === 0
        ? <TechnicalEmptyState title="No applicable SEL items" detail="Complete the initial SEL before assigning response demands." />
        : <Table
          caption="SEL demand assignments"
          headers={["SEL item", "Demand location", "Response model", "Directions", "Demand records"]}
          minWidth={0}
          columnWidths={["28%", "24%", "19%", "12%", "17%"]}
          className="stable--wrapheads"
        >
          {applicableSel.map((item) => {
            const assignments = response.responseResults.filter(
              (result) => result.applicableSscRefs.includes(item.uuid),
            );
            const locations = [...new Set(assignments.map((result) => result.location))];
            const models = [...new Set(assignments.map((result) => result.responseModelRef))];
            const directions = [...new Set(assignments.map((result) => result.direction))];
            return <tr key={item.uuid}>
              <td className="stable__key"><strong>{item.name}</strong><code>{item.uuid}</code></td>
              <td>{locations.join(", ") || "Not assigned"}</td>
              <td>{models.join(", ") || "Not assigned"}</td>
              <td>{directions.join(", ") || "None"}</td>
              <td>{assignments.length > 0
                ? <><strong>{assignments.length} linked</strong><code>{assignments.map((result) => result.uuid).join(" | ")}</code></>
                : <Tag tone="warn">Missing</Tag>}</td>
            </tr>;
          })}
        </Table>}
    </Section>

    <Section
      title="Response convergence"
      description="This section checks whether enough probabilistic simulations were run. If adding more trials no longer changes the median response or its variability by a meaningful amount, the response distribution is stable."
      tone="sfr"
      actions={editable ? <AddButton label="Add simulation" onClick={() => setSimulationIndex(null)} /> : undefined}
    >
      {selectedSimulation === undefined
        ? <TechnicalEmptyState title="No response simulations" detail="Add a probabilistic response simulation and its convergence results." />
        : <>
          <div className="sdistribution__head">
            <div><strong>{selectedSimulation.name}</strong><span>{selectedSimulation.convergenceMetric}</span></div>
            <label className="splotselect"><span>Simulation</span><select className="sinput" aria-label="Response convergence simulation" value={selectedSimulation.uuid} onChange={(event) => setSelectedSimulationRef(event.target.value)}>
              {response.probabilisticSimulations.map((simulation) => <option key={simulation.uuid} value={simulation.uuid}>{simulation.name}</option>)}
            </select></label>
          </div>
          <LineChart
            series={selectedSimulation.convergenceResults.map((point) => ({ x: point.sampleCount, y: point.metricValue }))}
            xLabel="Simulation count"
            yLabel="Maximum relative change"
            color="#9b5b18"
          />
        </>}
      <Table
        headers={["Simulation", "Trials and motion sets", "Convergence criterion", "Final change", "Status"]}
        minWidth={0}
        columnWidths={["27%", "19%", "30%", "12%", "12%"]}
        className="stable--wrapheads"
      >
        {response.probabilisticSimulations.map((simulation, index) => {
          const final = simulation.convergenceResults.at(-1);
          return <tr className="postable__row--clickable" key={simulation.uuid} onClick={() => { setSelectedSimulationRef(simulation.uuid); setSimulationIndex(index); }}>
            <td className="stable__key"><strong>{simulation.name}</strong><code>{displayLabel(simulation.method)}</code></td>
            <td>{simulation.simulationCount} trials<code>{simulation.inputMotionSetCount} sets x {simulation.componentsPerSet} components</code></td>
            <td>{simulation.convergenceCriterion}</td>
            <td>{final === undefined ? "No metric" : `${(final.metricValue * 100).toFixed(2)}%`}<code>{final === undefined ? "" : `${final.sampleCount} trials`}</code></td>
            <td><Tag tone={simulation.stableResponsesDemonstrated ? "good" : "warn"}>{simulation.stableResponsesDemonstrated ? "Stable" : "Open"}</Tag></td>
          </tr>;
        })}
      </Table>
    </Section>

    {responseSetupOpen && <ResponseSetupEditor onClose={() => setResponseSetupOpen(false)} />}
    {referenceIndex !== undefined && <ReferenceEarthquakeEditor index={referenceIndex} onClose={() => setReferenceIndex(undefined)} />}
    {modelIndex !== undefined && <StructuralModelEditor index={modelIndex} onClose={() => setModelIndex(undefined)} />}
    {resultIndex !== undefined && <ResponseResultEditor index={resultIndex} onClose={() => setResultIndex(undefined)} />}
    {ssiIndex !== undefined && <SsiAnalysisEditor index={ssiIndex} onClose={() => setSsiIndex(undefined)} />}
    {simulationIndex !== undefined && <SimulationEditor index={simulationIndex} onClose={() => setSimulationIndex(undefined)} />}
    <CollectionEditor tone="sfr" target={scalingEditor} onClose={() => setScalingEditor(null)} />
  </>;
}

type SfrThresholdProgram =
  SeismicPRA["seismicFragilityAnalysis"]["thresholdProgram"];
type SfrRuggednessBasis =
  SfrThresholdProgram["inherentlyRuggedBases"][number];
type SfrThresholdMethod = SfrThresholdProgram["thresholdMethods"][number];
type SfrInvestigation =
  SeismicPRA["seismicFragilityAnalysis"]["plantInvestigations"][number];
type SfrFinding = SfrInvestigation["findings"][number];
type SfrTeamMember = SfrInvestigation["team"][number];

function newRuggednessBasis(): SfrRuggednessBasis {
  return {
    uuid: crypto.randomUUID(),
    name: "New inherently rugged basis",
    referenceGroundMotionParameter: "",
    genericRuggedComponentTypes: [],
    guidanceReferences: [],
    plantSpecificAdditions: [],
    excludedComponentTypes: [],
    capacityBeyondRiskSignificantRangeBasis: "",
    hazardIndependentBasis: "",
    implementsSrs: [{ sr: "SFR-C1", hlr: "C" }],
  };
}

function newThresholdMethod(): SfrThresholdMethod {
  return {
    uuid: crypto.randomUUID(),
    name: "New fragility threshold method",
    plantResponseThresholdRef: "",
    groundMotionParameterRef: "",
    controlPointRef: "",
    thresholdCapacity: 0,
    capacityUnits: "g",
    cumulativeSscCountBasis: 0,
    correlationTreatment: "",
    screeningCapacitySources: [],
    caveatsAndInclusionRules: [],
    comparisonMethod: "",
    satisfiesScr2: false,
    implementsSrs: [{ sr: "SFR-C2", hlr: "C" }],
  };
}

function newTeamMember(): SfrTeamMember {
  return {
    uuid: crypto.randomUUID(),
    name: "New team member",
    organization: "",
    role: "",
    seismicPerformanceExperience: "",
    walkdownExperience: "",
    systemsOrOperationsExperience: "",
    qualifications: [],
  };
}

function newInvestigation(): SfrInvestigation {
  return {
    uuid: crypto.randomUUID(),
    name: "New plant investigation",
    investigationType: "DESIGN_DOCUMENT_REVIEW",
    conditionBasis: "AS_DESIGNED",
    date: new Date().toISOString().slice(0, 10),
    scope: "",
    procedures: "",
    team: [newTeamMember()],
    designDocumentRefs: [],
    sscRefsReviewed: [],
    anchorageAndLoadPathReview: "",
    observations: [],
    findings: [],
    fragilityThresholdConfirmations: [],
    conclusions: "",
    limitations: [],
    implementsSrs: [
      { sr: "SFR-D1", hlr: "D" },
      { sr: "SFR-D2", hlr: "D" },
      { sr: "SFR-D5", hlr: "D" },
    ],
  };
}

function newFinding(sscRef: string): SfrFinding {
  return {
    uuid: crypto.randomUUID(),
    name: "New vulnerability finding",
    sscRef,
    findingType: "ANCHORAGE_LOAD_PATH",
    description: "",
    location: "",
    credible: true,
    potentiallyRiskSignificant: false,
    affectedFunctionOrAction: "",
    affectedFailureModeRefs: [],
    resolutionOrFragilityTreatment: "",
    evidenceRefs: [],
    implementsSrs: [
      { sr: "SFR-D2", hlr: "D" },
      { sr: "SFR-D5", hlr: "D" },
    ],
  };
}

function ThresholdProgramEditor({ onClose }: { onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const program = mef.seismicFragilityAnalysis.thresholdProgram;
  const [draft, setDraft] = useState(() => ({
    screenedSscRefs: [...program.screenedSscRefs],
    screeningConfirmationMethod: program.screeningConfirmationMethod,
    anchorageAndSupportIncluded: program.anchorageAndSupportIncluded,
  }));
  function save(): void {
    update((next) => {
      Object.assign(next.seismicFragilityAnalysis.thresholdProgram, draft);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title="Screened SSC scope" subtitle="The SEL records proposed for threshold or inherently rugged screening" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save scope</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Screening control</h3>
        <Field label="Screened SSC references" hint="One reference per line.">
          <TextArea rows={10} value={draft.screenedSscRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, screenedSscRefs: technicalList(value) }))} />
        </Field>
        <label className="sbasis-editor__check">
          <input type="checkbox" checked={draft.anchorageAndSupportIncluded} onChange={(event) => setDraft((current) => ({ ...current, anchorageAndSupportIncluded: event.target.checked }))} />
          <span>Include anchorage and the complete support load path</span>
        </label>
        <Field label="Final confirmation method">
          <TextArea rows={6} value={draft.screeningConfirmationMethod} onChange={(value) => setDraft((current) => ({ ...current, screeningConfirmationMethod: value }))} />
        </Field>
      </div>
    </fieldset>
  </Drawer>;
}

function RuggednessBasisEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newRuggednessBasis()
    : mef.seismicFragilityAnalysis.thresholdProgram.inherentlyRuggedBases[index]!;
  const [draft, setDraft] = useState<SfrRuggednessBasis>(() => structuredClone(original));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.thresholdProgram.inherentlyRuggedBases;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.thresholdProgram.inherentlyRuggedBases.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Configurations, evidence, exclusions, and capacity justification" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove class</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save class</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Inherently rugged class</h3>
        <FieldGrid>
          <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
          <Field label="Ground-motion parameter"><TextInput value={draft.referenceGroundMotionParameter} onChange={(value) => setDraft((current) => ({ ...current, referenceGroundMotionParameter: value }))} /></Field>
        </FieldGrid>
        <Field label="Generic component configurations" hint="One configuration per line.">
          <TextArea rows={5} value={draft.genericRuggedComponentTypes.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, genericRuggedComponentTypes: technicalList(value) }))} />
        </Field>
        <Field label="Technical guidance and evidence" hint="One reference per line.">
          <TextArea rows={5} value={draft.guidanceReferences.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, guidanceReferences: technicalList(value) }))} />
        </Field>
        <Field label="Excluded configurations" hint="One exclusion per line.">
          <TextArea rows={5} value={draft.excludedComponentTypes.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, excludedComponentTypes: technicalList(value) }))} />
        </Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Plant-specific additions</h3>
        {draft.plantSpecificAdditions.map((addition, additionIndex) => <div className="sinlineeditor__subgroup" key={`${addition.componentType}-${additionIndex}`}>
          <Field label="Component configuration"><TextInput value={addition.componentType} onChange={(value) => setDraft((current) => ({ ...current, plantSpecificAdditions: current.plantSpecificAdditions.map((item, candidate) => candidate === additionIndex ? { ...item, componentType: value } : item) }))} /></Field>
          <Field label="Justification"><TextArea rows={3} value={addition.justification} onChange={(value) => setDraft((current) => ({ ...current, plantSpecificAdditions: current.plantSpecificAdditions.map((item, candidate) => candidate === additionIndex ? { ...item, justification: value } : item) }))} /></Field>
          <Field label="Supporting references" hint="One reference per line."><TextArea rows={3} value={addition.supportingRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, plantSpecificAdditions: current.plantSpecificAdditions.map((item, candidate) => candidate === additionIndex ? { ...item, supportingRefs: technicalList(value) } : item) }))} /></Field>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, plantSpecificAdditions: current.plantSpecificAdditions.filter((_, candidate) => candidate !== additionIndex) }))}>Remove addition</button>}
        </div>)}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, plantSpecificAdditions: [...current.plantSpecificAdditions, { componentType: "", justification: "", supportingRefs: [] }] }))}>Add plant-specific configuration</button>}
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Decision basis</h3>
        <Field label="Capacity beyond the risk-significant range"><TextArea rows={5} value={draft.capacityBeyondRiskSignificantRangeBasis} onChange={(value) => setDraft((current) => ({ ...current, capacityBeyondRiskSignificantRangeBasis: value }))} /></Field>
        <Field label="Hazard-independent ruggedness basis"><TextArea rows={5} value={draft.hazardIndependentBasis} onChange={(value) => setDraft((current) => ({ ...current, hazardIndependentBasis: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function ThresholdMethodEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newThresholdMethod()
    : mef.seismicFragilityAnalysis.thresholdProgram.thresholdMethods[index]!;
  const [draft, setDraft] = useState<SfrThresholdMethod>(() => structuredClone(original));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.thresholdProgram.thresholdMethods;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.thresholdProgram.thresholdMethods.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Capacity threshold, cumulative treatment, and technical acceptance" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove method</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save method</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Threshold</h3>
        <Field label="Method name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Plant-response threshold reference"><TextInput value={draft.plantResponseThresholdRef} onChange={(value) => setDraft((current) => ({ ...current, plantResponseThresholdRef: value }))} /></Field>
          <Field label="Ground-motion parameter"><TextInput value={draft.groundMotionParameterRef} onChange={(value) => setDraft((current) => ({ ...current, groundMotionParameterRef: value }))} /></Field>
          <Field label="Control point"><TextInput value={draft.controlPointRef} onChange={(value) => setDraft((current) => ({ ...current, controlPointRef: value }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Threshold capacity"><NumberInput value={draft.thresholdCapacity} onChange={(value) => setDraft((current) => ({ ...current, thresholdCapacity: value }))} /></Field>
          <Field label="Units"><TextInput value={draft.capacityUnits} onChange={(value) => setDraft((current) => ({ ...current, capacityUnits: value }))} /></Field>
          <Field label="Cumulative SSC count"><NumberInput value={draft.cumulativeSscCountBasis} onChange={(value) => setDraft((current) => ({ ...current, cumulativeSscCountBasis: value }))} /></Field>
        </FieldGrid>
        <label className="sbasis-editor__check">
          <input type="checkbox" checked={draft.satisfiesScr2} onChange={(event) => setDraft((current) => ({ ...current, satisfiesScr2: event.target.checked }))} />
          <span>The cumulative comparison satisfies SCR-2</span>
        </label>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Technical method</h3>
        <Field label="Capacity evidence" hint="One source per line."><TextArea rows={5} value={draft.screeningCapacitySources.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, screeningCapacitySources: technicalList(value) }))} /></Field>
        <Field label="Inclusion rules and caveats" hint="One rule per line."><TextArea rows={5} value={draft.caveatsAndInclusionRules.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, caveatsAndInclusionRules: technicalList(value) }))} /></Field>
        <Field label="Correlation treatment"><TextArea rows={4} value={draft.correlationTreatment} onChange={(value) => setDraft((current) => ({ ...current, correlationTreatment: value }))} /></Field>
        <Field label="Cumulative comparison"><TextArea rows={5} value={draft.comparisonMethod} onChange={(value) => setDraft((current) => ({ ...current, comparisonMethod: value }))} /></Field>
        <Field label="Higher-seismicity adjustment"><TextArea rows={3} value={draft.higherSeismicityAdjustment ?? ""} onChange={(value) => setDraft((current) => ({ ...current, higherSeismicityAdjustment: value || undefined }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function InvestigationEditor({ index, onClose }: { index: number | null; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newInvestigation()
    : mef.seismicFragilityAnalysis.plantInvestigations[index]!;
  const [draft, setDraft] = useState<SfrInvestigation>(() => structuredClone(original));
  function changeTeamMember(memberIndex: number, change: Partial<SfrTeamMember>): void {
    setDraft((current) => ({
      ...current,
      team: current.team.map((member, candidate) =>
        candidate === memberIndex ? { ...member, ...change } : member),
    }));
  }
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.plantInvestigations;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.plantInvestigations.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Scope, evidence, qualified team, confirmations, and conclusion" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove investigation</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save investigation</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Investigation</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Method"><SelectInput value={draft.investigationType} options={["WALKDOWN", "TABLETOP_REVIEW", "COMPUTERIZED_WALKDOWN", "DESIGN_DOCUMENT_REVIEW", "INTERVIEW"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, investigationType: value as SfrInvestigation["investigationType"] }))} /></Field>
          <Field label="Configuration basis"><SelectInput value={draft.conditionBasis} options={["AS_DESIGNED", "AS_BUILT", "AS_OPERATED", "AS_INTENDED_TO_OPERATE"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, conditionBasis: value as SfrInvestigation["conditionBasis"] }))} /></Field>
          <Field label="Date"><TextInput value={draft.date ?? ""} onChange={(value) => setDraft((current) => ({ ...current, date: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Scope"><TextArea rows={4} value={draft.scope} onChange={(value) => setDraft((current) => ({ ...current, scope: value }))} /></Field>
        <Field label="Procedure"><TextArea rows={5} value={draft.procedures} onChange={(value) => setDraft((current) => ({ ...current, procedures: value }))} /></Field>
        <Field label="Reviewed SSC references" hint="One reference per line."><TextArea rows={9} value={draft.sscRefsReviewed.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, sscRefsReviewed: technicalList(value) }))} /></Field>
        <Field label="Design and evidence references" hint="One reference per line."><TextArea rows={5} value={draft.designDocumentRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, designDocumentRefs: technicalList(value) }))} /></Field>
        <Field label="Anchorage and support load-path review"><TextArea rows={5} value={draft.anchorageAndLoadPathReview} onChange={(value) => setDraft((current) => ({ ...current, anchorageAndLoadPathReview: value }))} /></Field>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Qualified team</h3>
        {draft.team.map((member, memberIndex) => <div className="sinlineeditor__subgroup" key={member.uuid}>
          <FieldGrid>
            <Field label="Name"><TextInput value={member.name} onChange={(value) => changeTeamMember(memberIndex, { name: value })} /></Field>
            <Field label="Role"><TextInput value={member.role} onChange={(value) => changeTeamMember(memberIndex, { role: value })} /></Field>
          </FieldGrid>
          <Field label="Organization"><TextInput value={member.organization ?? ""} onChange={(value) => changeTeamMember(memberIndex, { organization: value || undefined })} /></Field>
          <Field label="Seismic-performance experience"><TextArea rows={3} value={member.seismicPerformanceExperience} onChange={(value) => changeTeamMember(memberIndex, { seismicPerformanceExperience: value })} /></Field>
          <Field label="Walkdown experience"><TextArea rows={2} value={member.walkdownExperience ?? ""} onChange={(value) => changeTeamMember(memberIndex, { walkdownExperience: value || undefined })} /></Field>
          <Field label="Systems or operations experience"><TextArea rows={2} value={member.systemsOrOperationsExperience ?? ""} onChange={(value) => changeTeamMember(memberIndex, { systemsOrOperationsExperience: value || undefined })} /></Field>
          <Field label="Qualifications" hint="One qualification per line."><TextArea rows={3} value={member.qualifications.join("\n")} onChange={(value) => changeTeamMember(memberIndex, { qualifications: technicalList(value) })} /></Field>
          {editable && draft.team.length > 1 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, team: current.team.filter((_, candidate) => candidate !== memberIndex) }))}>Remove team member</button>}
        </div>)}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, team: [...current.team, newTeamMember()] }))}>Add team member</button>}
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Threshold confirmations</h3>
        {draft.fragilityThresholdConfirmations.map((confirmation, confirmationIndex) => <div className="sinlineeditor__subgroup" key={`${confirmation.sscRef}-${confirmationIndex}`}>
          <Field label="SSC reference"><TextInput value={confirmation.sscRef} onChange={(value) => setDraft((current) => ({ ...current, fragilityThresholdConfirmations: current.fragilityThresholdConfirmations.map((item, candidate) => candidate === confirmationIndex ? { ...item, sscRef: value } : item) }))} /></Field>
          <div className="sinlineeditor__choices">
            {([
              ["anchorageConfirmed", "Anchorage confirmed"],
              ["supportConfirmed", "Support path confirmed"],
              ["thresholdSatisfied", "Threshold satisfied"],
            ] as const).map(([key, label]) => <label className={`sinlineeditor__choice${confirmation[key] ? " sinlineeditor__choice--active" : ""}`} key={key}>
              <input type="checkbox" checked={confirmation[key]} onChange={(event) => setDraft((current) => ({ ...current, fragilityThresholdConfirmations: current.fragilityThresholdConfirmations.map((item, candidate) => candidate === confirmationIndex ? { ...item, [key]: event.target.checked } : item) }))} />
              <span><strong>{label}</strong></span>
            </label>)}
          </div>
          <Field label="Technical basis"><TextArea rows={3} value={confirmation.basis} onChange={(value) => setDraft((current) => ({ ...current, fragilityThresholdConfirmations: current.fragilityThresholdConfirmations.map((item, candidate) => candidate === confirmationIndex ? { ...item, basis: value } : item) }))} /></Field>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, fragilityThresholdConfirmations: current.fragilityThresholdConfirmations.filter((_, candidate) => candidate !== confirmationIndex) }))}>Remove confirmation</button>}
        </div>)}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, fragilityThresholdConfirmations: [...current.fragilityThresholdConfirmations, { sscRef: "", anchorageConfirmed: false, supportConfirmed: false, thresholdSatisfied: false, basis: "" }] }))}>Add confirmation</button>}
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Result</h3>
        <Field label="Observations" hint="One observation per line."><TextArea rows={6} value={draft.observations.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, observations: technicalList(value) }))} /></Field>
        <Field label="Conclusion"><TextArea rows={5} value={draft.conclusions} onChange={(value) => setDraft((current) => ({ ...current, conclusions: value }))} /></Field>
        <Field label="Limitations or closure items" hint="One item per line."><TextArea rows={5} value={draft.limitations.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, limitations: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function FindingEditor({
  investigationIndex,
  findingIndex,
  initialType,
  onClose,
}: {
  investigationIndex: number;
  findingIndex: number | null;
  initialType?: SfrFinding["findingType"];
  onClose: () => void;
}): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const equipment = mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const investigations = mef.seismicFragilityAnalysis.plantInvestigations;
  const original = findingIndex === null
    ? {
        ...newFinding(equipment[0]?.uuid ?? ""),
        findingType: initialType ?? "ANCHORAGE_LOAD_PATH",
      }
    : mef.seismicFragilityAnalysis.plantInvestigations[investigationIndex]!.findings[findingIndex]!;
  const [draft, setDraft] = useState<SfrFinding>(() => structuredClone(original));
  const [targetInvestigationIndex, setTargetInvestigationIndex] =
    useState(investigationIndex);
  function save(): void {
    update((next) => {
      const destinationIndex =
        findingIndex === null ? targetInvestigationIndex : investigationIndex;
      const findings =
        next.seismicFragilityAnalysis.plantInvestigations[destinationIndex]!
          .findings;
      if (findingIndex === null) findings.push(draft);
      else findings[findingIndex] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (findingIndex === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.plantInvestigations[investigationIndex]!.findings.splice(findingIndex, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Credible vulnerability, affected function, and model treatment" plainHeader onClose={onClose} footer={<>
    {editable && findingIndex !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove finding</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save finding</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Vulnerability</h3>
        {findingIndex === null && <Field label="Investigation">
          <SelectInput
            value={String(targetInvestigationIndex)}
            options={investigations.map((investigation, index) => ({
              value: String(index),
              label: investigation.name,
            }))}
            onChange={(value) => setTargetInvestigationIndex(Number(value))}
          />
        </Field>}
        <Field label="Finding name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="SSC"><SelectInput value={draft.sscRef} options={equipment.map((item) => ({ value: item.uuid, label: `${item.name} | ${item.uuid}` }))} onChange={(value) => setDraft((current) => ({ ...current, sscRef: value }))} /></Field>
          <Field label="Finding type"><SelectInput value={draft.findingType} options={["ANCHORAGE_LOAD_PATH", "INTERNAL_ASSEMBLY", "CLEARANCE", "DIFFERENTIAL_DISPLACEMENT", "FALLING_HAZARD", "MAINTENANCE_CONDITION", "FLOOD_SOURCE", "FIRE_SOURCE", "INTERACTION", "OTHER"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, findingType: value as SfrFinding["findingType"] }))} /></Field>
        </FieldGrid>
        <Field label="Location"><TextInput value={draft.location} onChange={(value) => setDraft((current) => ({ ...current, location: value }))} /></Field>
        <Field label="Technical description"><TextArea rows={5} value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} /></Field>
        <div className="sinlineeditor__choices">
          <label className={`sinlineeditor__choice${draft.credible ? " sinlineeditor__choice--active" : ""}`}><input type="checkbox" checked={draft.credible} onChange={(event) => setDraft((current) => ({ ...current, credible: event.target.checked }))} /><span><strong>Credible mechanism</strong></span></label>
          <label className={`sinlineeditor__choice${draft.potentiallyRiskSignificant ? " sinlineeditor__choice--active" : ""}`}><input type="checkbox" checked={draft.potentiallyRiskSignificant} onChange={(event) => setDraft((current) => ({ ...current, potentiallyRiskSignificant: event.target.checked }))} /><span><strong>Potentially risk-significant</strong></span></label>
        </div>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">PRA treatment</h3>
        <Field label="Affected function or operator action"><TextArea rows={4} value={draft.affectedFunctionOrAction} onChange={(value) => setDraft((current) => ({ ...current, affectedFunctionOrAction: value }))} /></Field>
        <Field label="Affected failure-mode references" hint="One reference per line."><TextArea rows={4} value={draft.affectedFailureModeRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, affectedFailureModeRefs: technicalList(value) }))} /></Field>
        <Field label="Resolution or fragility treatment"><TextArea rows={5} value={draft.resolutionOrFragilityTreatment} onChange={(value) => setDraft((current) => ({ ...current, resolutionOrFragilityTreatment: value }))} /></Field>
        <Field label="Evidence references" hint="One reference per line."><TextArea rows={4} value={draft.evidenceRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, evidenceRefs: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function PlantConfigurationScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const applicableEquipment = equipment.filter((item) =>
    item.disposition !== "REMOVED_FROM_MODEL");
  const equipmentByRef = new Map(equipment.map((item) => [item.uuid, item]));
  const investigations = mef.seismicFragilityAnalysis.plantInvestigations;
  const responseResults =
    mef.seismicFragilityAnalysis.seismicResponseAnalysis.responseResults;
  const findings = investigations.flatMap((investigation, investigationIndex) =>
    investigation.findings.map((finding, findingIndex) => ({
      finding,
      investigationIndex,
      findingIndex,
      investigationName: investigation.name,
    })));
  const interactionTypes = new Set<SfrFinding["findingType"]>([
    "INTERACTION",
    "FALLING_HAZARD",
    "CLEARANCE",
    "DIFFERENTIAL_DISPLACEMENT",
  ]);
  const sourceTypes = new Set<SfrFinding["findingType"]>([
    "FLOOD_SOURCE",
    "FIRE_SOURCE",
  ]);
  const interactionFindings = findings.filter(({ finding }) =>
    interactionTypes.has(finding.findingType));
  const sourceFindings = findings.filter(({ finding }) =>
    sourceTypes.has(finding.findingType));
  const generalFindings = findings.filter(({ finding }) =>
    !interactionTypes.has(finding.findingType)
    && !sourceTypes.has(finding.findingType));
  const operatorInvestigations = investigations
    .map((investigation, investigationIndex) => ({
      investigation,
      investigationIndex,
    }))
    .filter(({ investigation }) =>
      [
        investigation.name,
        investigation.scope,
        investigation.procedures,
        ...investigation.observations,
        investigation.conclusions,
      ].join(" ").match(
        /operator|access route|travel path|action station|communication|lighting|indication/i,
      ) !== null);
  const closureItems = investigations.flatMap(
    (investigation, investigationIndex) =>
      investigation.limitations.map((limitation) => ({
        investigation,
        investigationIndex,
        limitation,
      })),
  );
  const [investigationIndex, setInvestigationIndex] =
    useState<number | null | undefined>(undefined);
  const [findingTarget, setFindingTarget] = useState<{
    investigationIndex: number;
    findingIndex: number | null;
    initialType?: SfrFinding["findingType"];
  } | null>(null);

  function openNewFinding(initialType?: SfrFinding["findingType"]): void {
    if (investigations.length === 0) return;
    setFindingTarget({
      investigationIndex: 0,
      findingIndex: null,
      initialType,
    });
  }

  function findingStatus(finding: SfrFinding): JSX.Element {
    return <Tag tone={
      finding.potentiallyRiskSignificant
        ? "warn"
        : finding.credible ? "sfr" : "neutral"
    }>
      {finding.potentiallyRiskSignificant
        ? "PRA treatment"
        : finding.credible ? "Credible" : "Screened"}
    </Tag>;
  }

  return <>
    <Section
      title="Plant investigations"
      description="This section checks whether the real plant, or the final design before construction, matches the equipment and layout assumed by the seismic model."
      tone="sfr"
    >
      <Table
        caption="Investigation program"
        captionActions={editable
          ? <AddButton
              label="Add investigation"
              onClick={() => setInvestigationIndex(null)}
            />
          : undefined}
        headers={[
          "Investigation",
          "Method",
          "Configuration",
          "SSC coverage",
          "Findings",
          "Field confirmation",
        ]}
        minWidth={0}
        columnWidths={["23%", "15%", "15%", "16%", "13%", "18%"]}
        className="stable--wrapheads stable--step07"
      >
        {investigations.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No plant investigation"
              detail="Add a design review, tabletop review, computerized walkdown, or physical walkdown."
            /></td></tr>
          : investigations.map((investigation, index) =>
            <tr
              className="postable__row--clickable"
              key={investigation.uuid}
              onClick={() => setInvestigationIndex(index)}
            >
              <td className="stable__key">
                <strong>{investigation.name}</strong>
                <code>{investigation.date ?? "Date pending"}</code>
              </td>
              <td>
                {displayLabel(investigation.investigationType)}
                <code>{investigation.team.length} qualified roles</code>
              </td>
              <td>{displayLabel(investigation.conditionBasis)}</td>
              <td>
                {investigation.sscRefsReviewed.length} SSCs
                <code>{investigation.designDocumentRefs.length} evidence records</code>
              </td>
              <td>
                {investigation.findings.length} findings
                <code>{investigation.fragilityThresholdConfirmations.length} confirmations</code>
              </td>
              <td>
                <Tag tone={investigation.limitations.length === 0 ? "good" : "warn"}>
                  {investigation.limitations.length === 0
                    ? "Closed"
                    : `${investigation.limitations.length} remaining`}
                </Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Final SEL confirmations"
      description="This is the final checklist for each seismic equipment list item. An item is ready when its configuration and load path were reviewed, Step 06 assigned its earthquake demand, and its credible failure modes are defined."
      tone="sfr"
    >
      <Table
        caption="SEL configuration and demand reconciliation"
        headers={[
          "SSC",
          "Configuration review",
          "Anchorage and supports",
          "Assigned demand",
          "Failure modes",
          "SEL status",
        ]}
        minWidth={0}
        columnWidths={["22%", "16%", "17%", "19%", "16%", "10%"]}
        className="stable--wrapheads stable--step07"
      >
        {applicableEquipment.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No applicable SEL records"
              detail="Step 04 must contain an applicable SSC before its configuration can be finalized."
            /></td></tr>
          : applicableEquipment.map((item) => {
            const reviews = investigations.filter((investigation) =>
              investigation.sscRefsReviewed.includes(item.uuid));
            const confirmation = investigations
              .flatMap((investigation) =>
                investigation.fragilityThresholdConfirmations)
              .find((candidate) => candidate.sscRef === item.uuid);
            const demandAssignments = responseResults.filter((result) =>
              result.applicableSscRefs.includes(item.uuid));
            const loadPathReviewed =
              confirmation?.anchorageConfirmed === true
              && confirmation.supportConfirmed
              || reviews.some((investigation) =>
                investigation.anchorageAndLoadPathReview.trim().length > 0);
            const ready =
              reviews.length > 0
              && loadPathReviewed
              && demandAssignments.length > 0
              && item.failureModes.length > 0;
            return <tr key={item.uuid}>
              <td className="stable__key">
                <strong>{item.name}</strong>
                <code>{item.uuid} · {displayLabel(item.disposition)}</code>
              </td>
              <td>
                <Tag tone={reviews.length > 0 ? "good" : "bad"}>
                  {reviews.length > 0 ? "Reviewed" : "Missing"}
                </Tag>
                <code>{reviews.length} investigations</code>
              </td>
              <td>
                <Tag tone={loadPathReviewed ? "good" : "bad"}>
                  {loadPathReviewed ? "Reviewed" : "Open"}
                </Tag>
                <code>{item.mountingAndAnchorage}</code>
              </td>
              <td>
                {demandAssignments.length === 0
                  ? <Tag tone="bad">Missing</Tag>
                  : <>
                    {demandAssignments.map((result) => result.name).join(", ")}
                    <code>{Array.from(new Set(
                      demandAssignments.map((result) => result.location),
                    )).join(", ")}</code>
                  </>}
              </td>
              <td>
                {item.failureModes.length === 0
                  ? <Tag tone="bad">Missing</Tag>
                  : item.failureModes.map((mode) => mode.name).join(", ")}
              </td>
              <td>
                <Tag tone={ready ? "good" : "bad"}>
                  {ready ? "Ready" : "Open"}
                </Tag>
              </td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Seismic interactions"
      description="This section checks whether one plant item can hit, pull, block, or move differently from another item during an earthquake."
      tone="sfr"
    >
      <Table
        caption="Interaction findings"
        captionActions={editable && investigations.length > 0
          ? <AddButton
              label="Add interaction"
              onClick={() => openNewFinding("INTERACTION")}
            />
          : undefined}
        headers={[
          "Interaction",
          "Affected SSC",
          "Type and location",
          "Failure modes",
          "PRA disposition",
        ]}
        minWidth={0}
        columnWidths={["22%", "21%", "20%", "20%", "17%"]}
        className="stable--wrapheads stable--step07"
      >
        {interactionFindings.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No interaction findings"
              detail="Record credible impact, falling-hazard, clearance, or differential-movement conditions."
            /></td></tr>
          : interactionFindings.map((record) => {
            const item = equipmentByRef.get(record.finding.sscRef);
            const modes = item?.failureModes.filter((mode) =>
              record.finding.affectedFailureModeRefs.includes(mode.uuid));
            return <tr
              className="postable__row--clickable"
              key={record.finding.uuid}
              onClick={() => setFindingTarget({
                investigationIndex: record.investigationIndex,
                findingIndex: record.findingIndex,
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`PRA disposition for ${record.finding.name}`}
                  detail={record.finding.resolutionOrFragilityTreatment.trim().length > 0
                    ? record.finding.resolutionOrFragilityTreatment
                    : undefined}
                >
                  {record.finding.name}
                </EntryName>
                <code>{record.investigationName}</code>
              </td>
              <td>{item?.name ?? record.finding.sscRef}</td>
              <td>
                {displayLabel(record.finding.findingType)}
                <code>{record.finding.location}</code>
              </td>
              <td>{modes?.map((mode) => mode.name).join(", ")
                || record.finding.affectedFailureModeRefs.join(", ")
                || "No linked failure mode"}</td>
              <td>{findingStatus(record.finding)}</td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Seismic fire and flood sources"
      description="This section lists plant sources whose seismic failure could release liquid, create spray, or start a fire that affects credited equipment."
      tone="sfr"
    >
      <Table
        caption="Fire and flood source findings"
        captionActions={editable && investigations.length > 0
          ? <AddButton
              label="Add fire or flood source"
              onClick={() => openNewFinding("FLOOD_SOURCE")}
            />
          : undefined}
        headers={[
          "Source",
          "Hazard",
          "Location",
          "Seismic failure",
          "PRA disposition",
        ]}
        minWidth={0}
        columnWidths={["24%", "12%", "22%", "24%", "18%"]}
        className="stable--wrapheads stable--step07"
      >
        {sourceFindings.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No seismic fire or flood sources"
              detail="Record each credible source boundary or ignition failure identified by the investigation."
            /></td></tr>
          : sourceFindings.map((record) => {
            const item = equipmentByRef.get(record.finding.sscRef);
            const modes = item?.failureModes.filter((mode) =>
              record.finding.affectedFailureModeRefs.includes(mode.uuid));
            return <tr
              className="postable__row--clickable"
              key={record.finding.uuid}
              onClick={() => setFindingTarget({
                investigationIndex: record.investigationIndex,
                findingIndex: record.findingIndex,
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`PRA disposition for ${record.finding.name}`}
                  detail={record.finding.resolutionOrFragilityTreatment.trim().length > 0
                    ? record.finding.resolutionOrFragilityTreatment
                    : undefined}
                >
                  {item?.name ?? record.finding.name}
                </EntryName>
                <code>{record.finding.name}</code>
              </td>
              <td>
                <Tag tone={record.finding.findingType === "FIRE_SOURCE"
                  ? "warn"
                  : "sfr"}>
                  {record.finding.findingType === "FIRE_SOURCE"
                    ? "Fire"
                    : "Flood"}
                </Tag>
              </td>
              <td>{record.finding.location}</td>
              <td>{modes?.map((mode) => mode.name).join(", ")
                || item?.failureModes.map((mode) => mode.name).join(", ")
                || "No linked failure mode"}</td>
              <td>{findingStatus(record.finding)}</td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Operator access and indications"
      description="This section checks whether operators can still reach required locations and use controls, communications, lighting, and indications after the earthquake."
      tone="sfr"
    >
      <Table
        caption="Operator configuration checks"
        headers={[
          "Review",
          "Configuration",
          "SSCs and routes",
          "Operator features checked",
          "Field status",
        ]}
        minWidth={0}
        columnWidths={["24%", "15%", "16%", "28%", "17%"]}
        className="stable--wrapheads stable--step07"
      >
        {operatorInvestigations.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No operator-access review"
              detail="Add an investigation that checks access routes, action stations, controls, communications, lighting, and indications."
            /></td></tr>
          : operatorInvestigations.map(({ investigation, investigationIndex: index }) => {
            const reviewText = [
              investigation.scope,
              investigation.procedures,
              ...investigation.observations,
            ].join(" ");
            const checkedFeatures = [
              /route|travel|access/i.test(reviewText) ? "Routes" : null,
              /action station|operator action/i.test(reviewText) ? "Action stations" : null,
              /control/i.test(reviewText) ? "Controls" : null,
              /communication|radio/i.test(reviewText) ? "Communications" : null,
              /lighting/i.test(reviewText) ? "Lighting" : null,
              /indication|display/i.test(reviewText) ? "Indications" : null,
            ].filter((value): value is string => value !== null);
            return <tr
              className="postable__row--clickable"
              key={investigation.uuid}
              onClick={() => setInvestigationIndex(index)}
            >
              <td className="stable__key">
                <strong>{investigation.name}</strong>
                <code>{displayLabel(investigation.investigationType)}</code>
              </td>
              <td>{displayLabel(investigation.conditionBasis)}</td>
              <td>{investigation.sscRefsReviewed.length} reviewed</td>
              <td>{checkedFeatures.length > 0
                ? checkedFeatures.join(" · ")
                : "Operator actions"}</td>
              <td>
                <Tag tone={investigation.limitations.length === 0
                  ? "good"
                  : "warn"}>
                  {investigation.limitations.length === 0
                    ? "Confirmed"
                    : `${investigation.limitations.length} remaining`}
                </Tag>
              </td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Open findings and data gaps"
      description="This section keeps seismic vulnerabilities and missing field evidence visible until each item is resolved or explicitly represented in the PRA."
      tone="sfr"
    >
      <Table
        caption="Vulnerability findings"
        captionActions={editable && investigations.length > 0
          ? <AddButton
              label="Add finding"
              onClick={() => openNewFinding()}
            />
          : undefined}
        headers={[
          "Finding",
          "Affected SSC",
          "Type and location",
          "Failure modes",
          "PRA disposition",
        ]}
        minWidth={0}
        columnWidths={["22%", "21%", "20%", "20%", "17%"]}
        className="stable--wrapheads stable--step07"
      >
        {generalFindings.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No additional vulnerability findings"
              detail="Anchorage, internal-assembly, maintenance, and other configuration findings will appear here."
            /></td></tr>
          : generalFindings.map((record) => {
            const item = equipmentByRef.get(record.finding.sscRef);
            const modes = item?.failureModes.filter((mode) =>
              record.finding.affectedFailureModeRefs.includes(mode.uuid));
            return <tr
              className="postable__row--clickable"
              key={record.finding.uuid}
              onClick={() => setFindingTarget({
                investigationIndex: record.investigationIndex,
                findingIndex: record.findingIndex,
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`PRA disposition for ${record.finding.name}`}
                  detail={record.finding.resolutionOrFragilityTreatment.trim().length > 0
                    ? record.finding.resolutionOrFragilityTreatment
                    : undefined}
                >
                  {record.finding.name}
                </EntryName>
                <code>{record.investigationName}</code>
              </td>
              <td>{item?.name ?? record.finding.sscRef}</td>
              <td>
                {displayLabel(record.finding.findingType)}
                <code>{record.finding.location}</code>
              </td>
              <td>{modes?.map((mode) => mode.name).join(", ")
                || record.finding.affectedFailureModeRefs.join(", ")
                || "No linked failure mode"}</td>
              <td>{findingStatus(record.finding)}</td>
            </tr>;
          })}
      </Table>

      <Table
        caption="Remaining data gaps"
        headers={[
          "Investigation",
          "Configuration",
          "Remaining evidence",
          "Status",
        ]}
        minWidth={0}
        columnWidths={["27%", "18%", "40%", "15%"]}
        className="stable--wrapheads stable--step07"
      >
        {closureItems.length === 0
          ? <tr><td colSpan={4}><TechnicalEmptyState
              title="No remaining data gaps"
              detail="All investigation evidence is available for the current plant configuration."
            /></td></tr>
          : closureItems.map((item, index) =>
            <tr
              className="postable__row--clickable"
              key={`${item.investigation.uuid}-${index}`}
              onClick={() => setInvestigationIndex(item.investigationIndex)}
            >
              <td className="stable__key">
                <strong>{item.investigation.name}</strong>
              </td>
              <td>{displayLabel(item.investigation.conditionBasis)}</td>
              <td>{item.limitation}</td>
              <td><Tag tone="warn">Open</Tag></td>
            </tr>)}
      </Table>
    </Section>

    {investigationIndex !== undefined
      && <InvestigationEditor
        index={investigationIndex}
        onClose={() => setInvestigationIndex(undefined)}
      />}
    {findingTarget !== null
      && <FindingEditor
        {...findingTarget}
        onClose={() => setFindingTarget(null)}
      />}
  </>;
}

function ThresholdInvestigationScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const threshold = mef.seismicFragilityAnalysis.thresholdProgram;
  const investigations = mef.seismicFragilityAnalysis.plantInvestigations;
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const equipmentByRef = new Map(equipment.map((item) => [item.uuid, item]));
  const confirmations = new Map(
    investigations.flatMap((investigation) =>
      investigation.fragilityThresholdConfirmations.map((confirmation) =>
        [confirmation.sscRef, confirmation] as const)),
  );
  const findings = investigations.flatMap((investigation, sourceIndex) =>
    investigation.findings.map((finding, findingIndex) => ({
      finding,
      sourceIndex,
      findingIndex,
      investigationName: investigation.name,
    })));
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [ruggednessIndex, setRuggednessIndex] =
    useState<number | null | undefined>(undefined);
  const [methodIndex, setMethodIndex] =
    useState<number | null | undefined>(undefined);
  const [investigationIndex, setInvestigationIndex] =
    useState<number | null | undefined>(undefined);
  const [findingTarget, setFindingTarget] = useState<{
    investigationIndex: number;
    findingIndex: number | null;
  } | null>(null);

  return <>
    <Section title="Fragility screening" description="Define when an SSC can be screened instead of explicitly modeled." tone="sfr">
      <div className="sstep09actions">
        <EditButton label="Edit screening basis" onClick={() => setThresholdOpen(true)} />
        {editable && <AddButton label="Add ruggedness basis" onClick={() => setRuggednessIndex(null)} />}
        {editable && <AddButton label="Add threshold method" onClick={() => setMethodIndex(null)} />}
      </div>
      {threshold.inherentlyRuggedBases.length === 0
        ? <EmptyState title="No ruggedness bases" detail="Define the configurations whose demonstrated capacity is beyond the risk-significant hazard range." />
        : <Table caption="Ruggedness bases" headers={["Basis", "Component scope", "Technical evidence", "Excluded configurations", "Capacity decision"]} minWidth={0} columnWidths={["19%", "21%", "18%", "18%", "24%"]} className="stable--wrapheads stable--step09">
          {threshold.inherentlyRuggedBases.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setRuggednessIndex(index)}>
            <td className="stable__key"><strong>{item.name}</strong><code>{item.referenceGroundMotionParameter}</code></td>
            <td>{item.genericRuggedComponentTypes.join(", ")}{item.plantSpecificAdditions.length > 0 && <code>{item.plantSpecificAdditions.map((addition) => addition.componentType).join(", ")}</code>}</td>
            <td>{item.guidanceReferences.join(", ")}</td>
            <td>{item.excludedComponentTypes.join(", ") || "None"}</td>
            <td>{item.capacityBeyondRiskSignificantRangeBasis}<code>{item.hazardIndependentBasis}</code></td>
          </tr>)}
        </Table>
      }
      {threshold.thresholdMethods.length === 0
        ? <EmptyState title="No threshold methods" detail="Define the capacity comparison, cumulative treatment, and decision criterion." />
        : <Table caption="Threshold methods" headers={["Method", "Threshold", "Parameter and control point", "Cumulative treatment", "Decision"]} minWidth={0} columnWidths={["21%", "13%", "19%", "28%", "19%"]} className="stable--wrapheads stable--step09">
          {threshold.thresholdMethods.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setMethodIndex(index)}>
            <td className="stable__key"><strong>{item.name}</strong><code>{item.plantResponseThresholdRef}</code></td>
            <td><strong>{item.thresholdCapacity} {item.capacityUnits}</strong><code>{item.cumulativeSscCountBasis} SSCs</code></td>
            <td>{item.groundMotionParameterRef}<code>{item.controlPointRef}</code></td>
            <td>{item.correlationTreatment}<code>{item.comparisonMethod}</code></td>
            <td><Tag tone={item.satisfiesScr2 ? "good" : "warn"}>{item.satisfiesScr2 ? "SCR-2 satisfied" : "Open"}</Tag><code>{item.caveatsAndInclusionRules.join(", ")}</code></td>
          </tr>)}
        </Table>
      }
      {threshold.screenedSscRefs.length === 0
        ? <EmptyState title="No screened SSCs" detail="Non-active SEL dispositions will appear here after a technical basis is assigned." />
        : <Table caption="Screened SSC confirmations" headers={["SSC", "Disposition", "Credited failure mode", "Anchorage and support", "Technical basis"]} minWidth={0} columnWidths={["22%", "15%", "21%", "17%", "25%"]} className="stable--wrapheads stable--step09">
          {threshold.screenedSscRefs.map((reference) => {
            const item = equipmentByRef.get(reference);
            const confirmation = confirmations.get(reference);
            return <tr key={reference}>
              <td className="stable__key"><strong>{item?.name ?? reference}</strong><code>{reference}</code></td>
              <td><Tag tone={item?.disposition === "INHERENTLY_RUGGED" ? "good" : "sfr"}>{item === undefined ? "Unmatched" : displayLabel(item.disposition)}</Tag></td>
              <td>{item?.failureModes.map((mode) => mode.name).join(", ") ?? "No linked SEL record"}</td>
              <td><Tag tone={confirmation?.anchorageConfirmed && confirmation.supportConfirmed ? "good" : "bad"}>{confirmation?.anchorageConfirmed && confirmation.supportConfirmed ? "Confirmed" : "Open"}</Tag><code>{confirmation?.thresholdSatisfied ? "Threshold satisfied" : "Threshold not confirmed"}</code></td>
              <td>{confirmation?.basis ?? "No investigation confirmation recorded."}</td>
            </tr>;
          })}
        </Table>
      }
    </Section>

    <Section title="Plant investigations" description="Confirm installed capability and identify vulnerabilities that require PRA treatment." tone="sfr">
      <div className="sstep09actions">
        {editable && <AddButton label="Add investigation" onClick={() => setInvestigationIndex(null)} />}
        {editable && investigations.length > 0 && <AddButton label="Add finding" onClick={() => setFindingTarget({ investigationIndex: 0, findingIndex: null })} />}
      </div>
      {investigations.length === 0
        ? <EmptyState title="No investigations recorded" detail="Add a design review, walkdown, or other plant investigation." />
        : <Table caption="Investigation program" headers={["Investigation", "Configuration", "Technical scope", "Evidence and team", "Conclusion"]} minWidth={0} columnWidths={["21%", "15%", "24%", "18%", "22%"]} className="stable--wrapheads stable--step09">
          {investigations.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setInvestigationIndex(index)}>
            <td className="stable__key"><strong>{item.name}</strong><code>{displayLabel(item.investigationType)}</code></td>
            <td><strong>{displayLabel(item.conditionBasis)}</strong><code>{item.date ?? "Date pending"}</code></td>
            <td>{item.scope}<code>{item.sscRefsReviewed.length} SSCs reviewed</code></td>
            <td>{item.designDocumentRefs.join(", ")}<code>{item.team.map((member) => `${member.role}: ${member.name}`).join(", ")}</code></td>
            <td>{item.conclusions}<code>{item.limitations.length === 0 ? "No open limitations" : item.limitations.join(", ")}</code></td>
          </tr>)}
        </Table>
      }
      {findings.length === 0
        ? <EmptyState title="No vulnerability findings" detail="Credible anchorage, functional, flood, fire, and interaction findings will appear here." />
        : <Table caption="Vulnerability findings" headers={["Finding and SSC", "Mechanism and location", "Risk disposition", "Affected function", "PRA treatment"]} minWidth={0} columnWidths={["20%", "21%", "14%", "20%", "25%"]} className="stable--wrapheads stable--step09">
          {findings.map(({ finding, sourceIndex, findingIndex, investigationName }) => {
            const item = equipmentByRef.get(finding.sscRef);
            return <tr className="postable__row--clickable" key={finding.uuid} onClick={() => setFindingTarget({ investigationIndex: sourceIndex, findingIndex })}>
              <td className="stable__key"><strong>{finding.name}</strong><code>{item?.name ?? finding.sscRef}</code></td>
              <td>{displayLabel(finding.findingType)}<code>{finding.location}</code></td>
              <td><Tag tone={finding.potentiallyRiskSignificant ? "warn" : finding.credible ? "sfr" : "neutral"}>{finding.potentiallyRiskSignificant ? "PRA treatment" : finding.credible ? "Credible" : "Screened"}</Tag><code>{investigationName}</code></td>
              <td>{finding.affectedFunctionOrAction}<code>{finding.affectedFailureModeRefs.join(", ")}</code></td>
              <td>{finding.resolutionOrFragilityTreatment}<code>{finding.evidenceRefs.join(", ")}</code></td>
            </tr>;
          })}
        </Table>
      }
    </Section>

    {thresholdOpen && <ThresholdProgramEditor onClose={() => setThresholdOpen(false)} />}
    {ruggednessIndex !== undefined && <RuggednessBasisEditor index={ruggednessIndex} onClose={() => setRuggednessIndex(undefined)} />}
    {methodIndex !== undefined && <ThresholdMethodEditor index={methodIndex} onClose={() => setMethodIndex(undefined)} />}
    {investigationIndex !== undefined && <InvestigationEditor index={investigationIndex} onClose={() => setInvestigationIndex(undefined)} />}
    {findingTarget !== null && <FindingEditor {...findingTarget} onClose={() => setFindingTarget(null)} />}
  </>;
}

type SfrFragilityResults =
  SeismicPRA["seismicFragilityAnalysis"]["results"];
type SfrFailureMechanism = SfrFragilityResults["failureMechanisms"][number];
type SfrFragilityEvaluation =
  SfrFragilityResults["fragilityEvaluations"][number];
type SfrCorrelationGroup = SfrFragilityResults["correlationGroups"][number];
type SfrFragilityUncertainty = SfrFragilityResults["uncertainties"][number];
type SfrSensitivityStudy = SfrFragilityResults["sensitivityStudies"][number];

const FRAGILITY_MECHANISM_TYPES: SfrFailureMechanism["mechanismType"][] = [
  "SLIDING",
  "OVERTURNING",
  "STRUCTURAL_YIELDING",
  "EXCESSIVE_DRIFT",
  "ANCHORAGE_FAILURE",
  "FUNCTIONAL_FAILURE",
  "IMPACT",
  "BRACING_FAILURE",
  "CONTACT_CHATTER",
  "PRESSURE_BOUNDARY_FAILURE",
  "LIQUEFACTION",
  "SLOPE_INSTABILITY",
  "DIFFERENTIAL_SETTLEMENT",
  "FIRE_IGNITION",
  "FLOOD_RELEASE",
  "OTHER",
];

function frontendNormalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function frontendFragilityCurve(
  median: number,
  beta: number,
  groundMotions?: number[],
): SfrFragilityEvaluation["meanFragilityCurve"] {
  const motions = groundMotions ?? Array.from(
    { length: 25 },
    (_, index) => Number((median * Math.exp(-2.4 + index * 0.2)).toPrecision(6)),
  );
  return motions.map((groundMotion) => ({
    groundMotion,
    conditionalFailureProbability: Number(Math.min(
      0.999999,
      Math.max(
        0.000001,
        frontendNormalCdf(
          Math.log(groundMotion / Math.max(median, 1e-6))
          / Math.max(beta, 0.01),
        ),
      ),
    ).toPrecision(7)),
  }));
}

function refreshFragilityCurves(
  evaluation: SfrFragilityEvaluation,
): SfrFragilityEvaluation {
  const betaR = Math.max(evaluation.betaRandomness, 0.01);
  const betaU = Math.max(evaluation.betaUncertainty, 0.01);
  const median = Math.max(evaluation.medianCapacity, 1e-6);
  const composite = Math.sqrt(betaR ** 2 + betaU ** 2);
  const meanCurve = frontendFragilityCurve(median, composite);
  const groundMotions = meanCurve.map((point) => point.groundMotion);
  return {
    ...evaluation,
    compositeBeta: Number(composite.toPrecision(5)),
    highConfidenceLowProbabilityOfFailureCapacity: Number(
      (median * Math.exp(-1.644854 * (betaR + betaU))).toPrecision(5),
    ),
    meanFragilityCurve: meanCurve,
    uncertaintyFractileCurves: [
      {
        fractile: 0.05,
        points: frontendFragilityCurve(
          median * Math.exp(1.644854 * betaU),
          betaR,
          groundMotions,
        ),
      },
      {
        fractile: 0.5,
        points: frontendFragilityCurve(median, betaR, groundMotions),
      },
      {
        fractile: 0.95,
        points: frontendFragilityCurve(
          median * Math.exp(-1.644854 * betaU),
          betaR,
          groundMotions,
        ),
      },
    ],
  };
}

function synchronizeSpecializedFragilityRefs(
  results: SfrFragilityResults,
): void {
  const refsFor = (
    category: SfrFragilityEvaluation["analysisCategory"],
  ): string[] => results.fragilityEvaluations
    .filter((evaluation) => evaluation.analysisCategory === category)
    .map((evaluation) => evaluation.uuid);
  results.floodSourceFragilityRefs = refsFor("FLOOD_SOURCE");
  results.fireSourceFragilityRefs = refsFor("FIRE_SOURCE");
  results.contactChatterFragilityRefs = refsFor("CONTACT_CHATTER");
  results.soilFragilityRefs = refsFor("SOIL");
}

function newFailureMechanism(mef: SeismicPRA): SfrFailureMechanism {
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment[0];
  const failureMode = equipment?.failureModes[0];
  return {
    uuid: crypto.randomUUID(),
    name: "New failure mechanism",
    sscRef: equipment?.uuid ?? "",
    systemsFailureModeRef: failureMode?.uuid ?? "",
    mechanismType: "FUNCTIONAL_FAILURE",
    failureModeType: failureMode?.failureModeType ?? "FUNCTIONAL",
    description: "",
    demandParameter: "",
    demandUnits: "g",
    demandResultRefs: [],
    capacityParameter: "",
    capacityUnits: "g",
    capacityDataRefs: [],
    anchorageAndSupportLoadPath: equipment?.mountingAndAnchorage ?? "",
    interactionRefs: [],
    conservativeBounding: false,
    realisticForRiskSignificantSsc: true,
    controlling: true,
    selectionBasis: "",
    implementsSrs: [{ sr: "SFR-E1", hlr: "E" }],
  };
}

function newFragilityEvaluation(mef: SeismicPRA): SfrFragilityEvaluation {
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment[0];
  const failureMode = equipment?.failureModes[0];
  const mechanism =
    mef.seismicFragilityAnalysis.results.failureMechanisms.find((item) =>
      item.sscRef === equipment?.uuid);
  return refreshFragilityCurves({
    uuid: crypto.randomUUID(),
    name: "New fragility evaluation",
    sscRef: equipment?.uuid ?? "",
    systemsFailureModeRef: failureMode?.uuid ?? "",
    mechanismRefs: mechanism === undefined ? [] : [mechanism.uuid],
    controllingMechanismRef: mechanism?.uuid ?? "",
    analysisCategory: "GENERAL_SSC",
    evaluationBasis: "PLANT_SPECIFIC_CALCULATION",
    plantSpecific: true,
    riskSignificance: "MEDIUM" as SfrFragilityEvaluation["riskSignificance"],
    groundMotionParameterRef: "GMP-H-PGA",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    medianCapacity: 1,
    capacityUnits: "g",
    betaRandomness: 0.3,
    betaUncertainty: 0.35,
    meanFragilityCurve: [],
    demandToCapacityMethod: "",
    responseResultRefs: [],
    capacityDataRefs: [],
    correlationGroupRefs: [],
    thresholdSatisfied: false,
    sensitivityStudyRefs: [],
    assumptions: [],
    limitations: [],
    implementsSrs: [{ sr: "SFR-E3", hlr: "E" }],
  });
}

function newCorrelationGroup(): SfrCorrelationGroup {
  return {
    uuid: crypto.randomUUID(),
    name: "New correlation group",
    memberSscRefs: [],
    correlationModel: "PARTIAL",
    correlationCoefficient: 0.5,
    commonDemandBasis: "",
    constructionSimilarity: "",
    installationSimilarity: "",
    locationAndOrientationSimilarity: "",
    capacitySimilarity: "",
    modelingImplementation: "",
    justification: "",
    sensitivityStudyRefs: [],
    implementsSrs: [{ sr: "SFR-E6", hlr: "E" }],
  };
}

function newFragilityUncertainty(): SfrFragilityUncertainty {
  return {
    uuid: crypto.randomUUID(),
    name: "New fragility uncertainty",
    uncertaintyType: "MODEL",
    description: "",
    affectedSscRefs: [],
    affectedFragilityRefs: [],
    relatedAssumptions: [],
    reasonableAlternatives: [],
    treatment: "",
    importance: "MEDIUM" as SfrFragilityUncertainty["importance"],
    implementsSrs: [{ sr: "SFR-E6", hlr: "E" }],
  };
}

function newFragilitySensitivity(): SfrSensitivityStudy {
  return {
    uuid: crypto.randomUUID(),
    name: "New sensitivity study",
    description: "",
    variedParameters: [],
    parameterRanges: {},
    results: "",
    insights: "",
    implementsSrs: [{ sr: "SFR-E6", hlr: "E" }],
  };
}

function parameterRangeText(
  ranges: SfrSensitivityStudy["parameterRanges"],
): string {
  return Object.entries(ranges)
    .map(([parameter, [lower, upper]]) => `${parameter}: ${lower}, ${upper}`)
    .join("\n");
}

function parseParameterRanges(
  value: string,
): SfrSensitivityStudy["parameterRanges"] {
  return Object.fromEntries(
    value.split(/\r?\n/).flatMap((line) => {
      const [parameter, range] = line.split(":", 2);
      const values = range?.split(",").map((item) => Number(item.trim()));
      return parameter?.trim().length > 0
        && values?.length === 2
        && values.every(Number.isFinite)
        ? [[parameter.trim(), [values[0]!, values[1]!] as [number, number]]]
        : [];
    }),
  );
}

function FragilityResultsBasisEditor(
  { onClose }: { onClose: () => void },
): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const [transferBasis, setTransferBasis] = useState(
    mef.seismicFragilityAnalysis.results.systemsModelTransferBasis,
  );
  function save(): void {
    update((next) => {
      next.seismicFragilityAnalysis.results.systemsModelTransferBasis =
        transferBasis;
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title="Plant-model transfer" subtitle="How evaluated failure modes enter the seismic plant-response model" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save transfer</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <Field label="Transfer basis"><TextArea rows={10} value={transferBasis} onChange={setTransferBasis} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function FailureMechanismEditor(
  { index, onClose }: { index: number | null; onClose: () => void },
): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const original = index === null
    ? newFailureMechanism(mef)
    : mef.seismicFragilityAnalysis.results.failureMechanisms[index]!;
  const [draft, setDraft] = useState<SfrFailureMechanism>(
    () => structuredClone(original),
  );
  const failureModes = equipment.flatMap((item) =>
    item.failureModes.map((failureMode) => ({
      ...failureMode,
      sscRef: item.uuid,
      sscName: item.name,
    })));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.results.failureMechanisms;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      const results = next.seismicFragilityAnalysis.results;
      const removed = results.failureMechanisms[index]!;
      results.failureMechanisms.splice(index, 1);
      results.fragilityEvaluations.forEach((evaluation) => {
        evaluation.mechanismRefs = evaluation.mechanismRefs.filter(
          (ref) => ref !== removed.uuid,
        );
        if (evaluation.controllingMechanismRef === removed.uuid) {
          evaluation.controllingMechanismRef =
            evaluation.mechanismRefs[0] ?? "";
        }
      });
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Credible mechanism, demand, capacity evidence, and controlling basis" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove mechanism</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save mechanism</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Failure mechanism</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="SSC"><SelectInput value={draft.sscRef} options={equipment.map((item) => ({ value: item.uuid, label: `${item.name} | ${item.uuid}` }))} onChange={(value) => {
            const item = equipment.find((candidate) => candidate.uuid === value);
            const failureMode = item?.failureModes[0];
            setDraft((current) => ({
              ...current,
              sscRef: value,
              systemsFailureModeRef: failureMode?.uuid ?? "",
              failureModeType: failureMode?.failureModeType ?? current.failureModeType,
              anchorageAndSupportLoadPath:
                item?.mountingAndAnchorage ?? current.anchorageAndSupportLoadPath,
            }));
          }} /></Field>
          <Field label="Systems failure mode"><SelectInput value={draft.systemsFailureModeRef} options={failureModes.filter((failureMode) => failureMode.sscRef === draft.sscRef).map((failureMode) => ({ value: failureMode.uuid, label: failureMode.name }))} onChange={(value) => {
            const failureMode = failureModes.find((candidate) => candidate.uuid === value);
            setDraft((current) => ({
              ...current,
              systemsFailureModeRef: value,
              failureModeType: failureMode?.failureModeType ?? current.failureModeType,
            }));
          }} /></Field>
          <Field label="Mechanism"><SelectInput value={draft.mechanismType} options={FRAGILITY_MECHANISM_TYPES.map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, mechanismType: value as SfrFailureMechanism["mechanismType"] }))} /></Field>
        </FieldGrid>
        {draft.mechanismType === "OTHER" && <Field label="Other mechanism"><TextInput value={draft.otherMechanismType ?? ""} onChange={(value) => setDraft((current) => ({ ...current, otherMechanismType: value || undefined }))} /></Field>}
        <Field label="Technical description"><TextArea rows={5} value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} /></Field>
        <div className="sinlineeditor__choices">
          <label className={`sinlineeditor__choice${draft.realisticForRiskSignificantSsc ? " sinlineeditor__choice--active" : ""}`}><input type="checkbox" checked={draft.realisticForRiskSignificantSsc} onChange={(event) => setDraft((current) => ({ ...current, realisticForRiskSignificantSsc: event.target.checked }))} /><span><strong>Realistic for risk-significant SSC</strong></span></label>
          <label className={`sinlineeditor__choice${draft.controlling ? " sinlineeditor__choice--active" : ""}`}><input type="checkbox" checked={draft.controlling} onChange={(event) => setDraft((current) => ({ ...current, controlling: event.target.checked }))} /><span><strong>Controlling mechanism</strong></span></label>
          <label className={`sinlineeditor__choice${draft.conservativeBounding ? " sinlineeditor__choice--active" : ""}`}><input type="checkbox" checked={draft.conservativeBounding} onChange={(event) => setDraft((current) => ({ ...current, conservativeBounding: event.target.checked }))} /><span><strong>Conservative bound</strong></span></label>
        </div>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Demand and capacity</h3>
        <FieldGrid>
          <Field label="Demand parameter"><TextInput value={draft.demandParameter} onChange={(value) => setDraft((current) => ({ ...current, demandParameter: value }))} /></Field>
          <Field label="Demand units"><TextInput value={draft.demandUnits} onChange={(value) => setDraft((current) => ({ ...current, demandUnits: value }))} /></Field>
          <Field label="Capacity parameter"><TextInput value={draft.capacityParameter} onChange={(value) => setDraft((current) => ({ ...current, capacityParameter: value }))} /></Field>
          <Field label="Capacity units"><TextInput value={draft.capacityUnits} onChange={(value) => setDraft((current) => ({ ...current, capacityUnits: value }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Response-result references" hint="One reference per line."><TextArea rows={5} value={draft.demandResultRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, demandResultRefs: technicalList(value) }))} /></Field>
          <Field label="Capacity evidence" hint="One reference per line."><TextArea rows={5} value={draft.capacityDataRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, capacityDataRefs: technicalList(value) }))} /></Field>
        </FieldGrid>
        <Field label="Anchorage and support load path"><TextArea rows={5} value={draft.anchorageAndSupportLoadPath} onChange={(value) => setDraft((current) => ({ ...current, anchorageAndSupportLoadPath: value }))} /></Field>
        <Field label="Interaction or finding references" hint="One reference per line."><TextArea rows={4} value={draft.interactionRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, interactionRefs: technicalList(value) }))} /></Field>
        <Field label="Why this mechanism controls"><TextArea rows={5} value={draft.selectionBasis} onChange={(value) => setDraft((current) => ({ ...current, selectionBasis: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function FragilityEvaluationEditor(
  { index, onClose }: { index: number | null; onClose: () => void },
): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const results = mef.seismicFragilityAnalysis.results;
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const original = index === null
    ? newFragilityEvaluation(mef)
    : results.fragilityEvaluations[index]!;
  const [draft, setDraft] = useState<SfrFragilityEvaluation>(
    () => structuredClone(original),
  );
  const failureModes = equipment.flatMap((item) =>
    item.failureModes.map((failureMode) => ({
      ...failureMode,
      sscRef: item.uuid,
    })));
  function save(): void {
    update((next) => {
      const target = next.seismicFragilityAnalysis.results;
      const refreshed = refreshFragilityCurves(draft);
      if (index === null) target.fragilityEvaluations.push(refreshed);
      else target.fragilityEvaluations[index] = refreshed;
      synchronizeSpecializedFragilityRefs(target);
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      const target = next.seismicFragilityAnalysis.results;
      target.fragilityEvaluations.splice(index, 1);
      synchronizeSpecializedFragilityRefs(target);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Capacity, variability, curve distribution, correlation, and model transfer" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove fragility</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save fragility</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Evaluation</h3>
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="SSC"><SelectInput value={draft.sscRef} options={equipment.map((item) => ({ value: item.uuid, label: `${item.name} | ${item.uuid}` }))} onChange={(value) => {
            const item = equipment.find((candidate) => candidate.uuid === value);
            const failureMode = item?.failureModes[0];
            const mechanism = results.failureMechanisms.find((candidate) => candidate.sscRef === value);
            setDraft((current) => ({
              ...current,
              sscRef: value,
              systemsFailureModeRef: failureMode?.uuid ?? "",
              mechanismRefs: mechanism === undefined ? [] : [mechanism.uuid],
              controllingMechanismRef: mechanism?.uuid ?? "",
            }));
          }} /></Field>
          <Field label="Systems failure mode"><SelectInput value={draft.systemsFailureModeRef} options={failureModes.filter((failureMode) => failureMode.sscRef === draft.sscRef).map((failureMode) => ({ value: failureMode.uuid, label: failureMode.name }))} onChange={(value) => setDraft((current) => ({ ...current, systemsFailureModeRef: value }))} /></Field>
          <Field label="Analysis category"><SelectInput value={draft.analysisCategory} options={["GENERAL_SSC", "SOIL", "CONTACT_CHATTER", "FLOOD_SOURCE", "FIRE_SOURCE"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, analysisCategory: value as SfrFragilityEvaluation["analysisCategory"] }))} /></Field>
          <Field label="Evaluation basis"><SelectInput value={draft.evaluationBasis} options={["PLANT_SPECIFIC_CALCULATION", "PLANT_SPECIFIC_TEST", "GENERIC_TEST_DATA", "EARTHQUAKE_EXPERIENCE", "SEISMIC_QUALIFICATION_DATA", "DESIGN_CRITERIA", "CONSERVATIVE_ASSUMPTION", "ENGINEERING_JUDGMENT"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, evaluationBasis: value as SfrFragilityEvaluation["evaluationBasis"] }))} /></Field>
          <Field label="Risk significance"><SelectInput value={draft.riskSignificance} options={["LOW", "MEDIUM", "HIGH"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, riskSignificance: value as SfrFragilityEvaluation["riskSignificance"] }))} /></Field>
        </FieldGrid>
        <div className="sinlineeditor__choices">
          <label className={`sinlineeditor__choice${draft.plantSpecific ? " sinlineeditor__choice--active" : ""}`}><input type="checkbox" checked={draft.plantSpecific} onChange={(event) => setDraft((current) => ({ ...current, plantSpecific: event.target.checked }))} /><span><strong>Plant-specific evaluation</strong></span></label>
          <label className={`sinlineeditor__choice${draft.thresholdSatisfied ? " sinlineeditor__choice--active" : ""}`}><input type="checkbox" checked={draft.thresholdSatisfied} onChange={(event) => setDraft((current) => ({ ...current, thresholdSatisfied: event.target.checked }))} /><span><strong>Threshold confirmed</strong></span></label>
        </div>
        {!draft.plantSpecific && <Field label="Generic-data justification"><TextArea rows={6} value={draft.genericDataJustification ?? ""} onChange={(value) => setDraft((current) => ({ ...current, genericDataJustification: value || undefined }))} /></Field>}
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Capacity distribution</h3>
        <FieldGrid>
          <Field label="Median capacity"><NumberInput value={draft.medianCapacity} onChange={(value) => setDraft((current) => ({ ...current, medianCapacity: value }))} /></Field>
          <Field label="Units"><TextInput value={draft.capacityUnits} onChange={(value) => setDraft((current) => ({ ...current, capacityUnits: value }))} /></Field>
          <Field label="Randomness, βR"><NumberInput value={draft.betaRandomness} onChange={(value) => setDraft((current) => ({ ...current, betaRandomness: value }))} /></Field>
          <Field label="Uncertainty, βU"><NumberInput value={draft.betaUncertainty} onChange={(value) => setDraft((current) => ({ ...current, betaUncertainty: value }))} /></Field>
          <Field label="Ground-motion parameter"><TextInput value={draft.groundMotionParameterRef} onChange={(value) => setDraft((current) => ({ ...current, groundMotionParameterRef: value }))} /></Field>
          <Field label="Control point"><TextInput value={draft.controlPointRef} onChange={(value) => setDraft((current) => ({ ...current, controlPointRef: value }))} /></Field>
        </FieldGrid>
        <Field label="Demand-to-capacity method"><TextArea rows={6} value={draft.demandToCapacityMethod} onChange={(value) => setDraft((current) => ({ ...current, demandToCapacityMethod: value }))} /></Field>
        <FieldGrid>
          <Field label="Failure mechanisms" hint="One reference per line."><TextArea rows={5} value={draft.mechanismRefs.join("\n")} onChange={(value) => {
            const refs = technicalList(value);
            setDraft((current) => ({
              ...current,
              mechanismRefs: refs,
              controllingMechanismRef: refs.includes(current.controllingMechanismRef) ? current.controllingMechanismRef : refs[0] ?? "",
            }));
          }} /></Field>
          <Field label="Controlling mechanism"><SelectInput value={draft.controllingMechanismRef} options={draft.mechanismRefs.map((value) => ({ value, label: results.failureMechanisms.find((mechanism) => mechanism.uuid === value)?.name ?? value }))} onChange={(value) => setDraft((current) => ({ ...current, controllingMechanismRef: value }))} /></Field>
          <Field label="Response results" hint="One reference per line."><TextArea rows={5} value={draft.responseResultRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, responseResultRefs: technicalList(value) }))} /></Field>
          <Field label="Capacity evidence" hint="One reference per line."><TextArea rows={5} value={draft.capacityDataRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, capacityDataRefs: technicalList(value) }))} /></Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Model treatment</h3>
        <FieldGrid>
          <Field label="Correlation groups" hint="One reference per line."><TextArea rows={5} value={draft.correlationGroupRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, correlationGroupRefs: technicalList(value) }))} /></Field>
          <Field label="Sensitivity studies" hint="One reference per line."><TextArea rows={5} value={draft.sensitivityStudyRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, sensitivityStudyRefs: technicalList(value) }))} /></Field>
          <Field label="Threshold method"><TextInput value={draft.thresholdMethodRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, thresholdMethodRef: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Masking evaluation"><TextArea rows={5} value={draft.maskingEvaluation ?? ""} onChange={(value) => setDraft((current) => ({ ...current, maskingEvaluation: value || undefined }))} /></Field>
        <FieldGrid>
          <Field label="Assumptions" hint="One assumption per line."><TextArea rows={6} value={draft.assumptions.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, assumptions: technicalList(value) }))} /></Field>
          <Field label="Limitations and closure items" hint="One item per line."><TextArea rows={6} value={draft.limitations.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, limitations: technicalList(value) }))} /></Field>
        </FieldGrid>
      </div>
    </fieldset>
  </Drawer>;
}

function CorrelationGroupEditor(
  { index, onClose }: { index: number | null; onClose: () => void },
): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newCorrelationGroup()
    : mef.seismicFragilityAnalysis.results.correlationGroups[index]!;
  const [draft, setDraft] = useState<SfrCorrelationGroup>(
    () => structuredClone(original),
  );
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.results.correlationGroups;
      if (index === null) records.push(draft);
      else records[index] = draft;
      next.seismicFragilityAnalysis.scope.correlationGroupRefs =
        records.map((record) => record.uuid);
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      const results = next.seismicFragilityAnalysis.results;
      const removed = results.correlationGroups[index]!;
      results.correlationGroups.splice(index, 1);
      results.fragilityEvaluations.forEach((evaluation) => {
        evaluation.correlationGroupRefs =
          evaluation.correlationGroupRefs.filter((ref) => ref !== removed.uuid);
      });
      next.seismicFragilityAnalysis.scope.correlationGroupRefs =
        results.correlationGroups.map((record) => record.uuid);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Common demand, capacity similarity, and conditional failure treatment" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove group</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save group</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Correlation model"><SelectInput value={draft.correlationModel} options={["PERFECT", "INDEPENDENT", "PARTIAL", "CAUSAL_DEPENDENCY"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, correlationModel: value as SfrCorrelationGroup["correlationModel"] }))} /></Field>
          <Field label="Correlation coefficient"><NumberInput value={draft.correlationCoefficient ?? 0} onChange={(value) => setDraft((current) => ({ ...current, correlationCoefficient: value }))} /></Field>
          <Field label="Causal logic reference"><TextInput value={draft.causalLogicRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, causalLogicRef: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Member SSCs" hint="One reference per line."><TextArea rows={7} value={draft.memberSscRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, memberSscRefs: technicalList(value) }))} /></Field>
        <Field label="Common demand"><TextArea rows={4} value={draft.commonDemandBasis} onChange={(value) => setDraft((current) => ({ ...current, commonDemandBasis: value }))} /></Field>
        <FieldGrid>
          <Field label="Construction similarity"><TextArea rows={4} value={draft.constructionSimilarity} onChange={(value) => setDraft((current) => ({ ...current, constructionSimilarity: value }))} /></Field>
          <Field label="Installation similarity"><TextArea rows={4} value={draft.installationSimilarity} onChange={(value) => setDraft((current) => ({ ...current, installationSimilarity: value }))} /></Field>
          <Field label="Location and orientation"><TextArea rows={4} value={draft.locationAndOrientationSimilarity} onChange={(value) => setDraft((current) => ({ ...current, locationAndOrientationSimilarity: value }))} /></Field>
          <Field label="Capacity similarity"><TextArea rows={4} value={draft.capacitySimilarity} onChange={(value) => setDraft((current) => ({ ...current, capacitySimilarity: value }))} /></Field>
        </FieldGrid>
        <Field label="Model implementation"><TextArea rows={5} value={draft.modelingImplementation} onChange={(value) => setDraft((current) => ({ ...current, modelingImplementation: value }))} /></Field>
        <Field label="Technical justification"><TextArea rows={5} value={draft.justification} onChange={(value) => setDraft((current) => ({ ...current, justification: value }))} /></Field>
        <Field label="Sensitivity studies" hint="One reference per line."><TextArea rows={4} value={draft.sensitivityStudyRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, sensitivityStudyRefs: technicalList(value) }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function FragilityUncertaintyEditor(
  { index, onClose }: { index: number | null; onClose: () => void },
): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newFragilityUncertainty()
    : mef.seismicFragilityAnalysis.results.uncertainties[index]!;
  const [draft, setDraft] = useState<SfrFragilityUncertainty>(
    () => structuredClone(original),
  );
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.results.uncertainties;
      if (index === null) records.push(draft);
      else records[index] = draft;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.results.uncertainties.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name} subtitle="Uncertainty source, affected fragilities, alternatives, and treatment" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove uncertainty</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save uncertainty</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <Field label="Name"><TextInput value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <FieldGrid>
          <Field label="Type"><SelectInput value={draft.uncertaintyType} options={["PARAMETER_ALEATORY", "PARAMETER_EPISTEMIC", "MODEL"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, uncertaintyType: value as SfrFragilityUncertainty["uncertaintyType"] }))} /></Field>
          <Field label="Importance"><SelectInput value={draft.importance ?? "MEDIUM"} options={["LOW", "MEDIUM", "HIGH"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, importance: value as SfrFragilityUncertainty["importance"] }))} /></Field>
        </FieldGrid>
        <Field label="Technical description"><TextArea rows={5} value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} /></Field>
        <FieldGrid>
          <Field label="Affected SSCs" hint="One reference per line."><TextArea rows={7} value={draft.affectedSscRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, affectedSscRefs: technicalList(value) }))} /></Field>
          <Field label="Affected fragilities" hint="One reference per line."><TextArea rows={7} value={draft.affectedFragilityRefs.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, affectedFragilityRefs: technicalList(value) }))} /></Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Lower capacity factor"><NumberInput value={draft.estimatedCapacityImpact?.lowerFactor ?? 1} onChange={(value) => setDraft((current) => ({ ...current, estimatedCapacityImpact: { lowerFactor: value, upperFactor: current.estimatedCapacityImpact?.upperFactor ?? 1 } }))} /></Field>
          <Field label="Upper capacity factor"><NumberInput value={draft.estimatedCapacityImpact?.upperFactor ?? 1} onChange={(value) => setDraft((current) => ({ ...current, estimatedCapacityImpact: { lowerFactor: current.estimatedCapacityImpact?.lowerFactor ?? 1, upperFactor: value } }))} /></Field>
        </FieldGrid>
        <Field label="Related assumptions" hint="One assumption per line."><TextArea rows={5} value={draft.relatedAssumptions.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, relatedAssumptions: technicalList(value) }))} /></Field>
        <Field label="Reasonable alternatives" hint="One alternative per line."><TextArea rows={5} value={draft.reasonableAlternatives.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, reasonableAlternatives: technicalList(value) }))} /></Field>
        <Field label="Quantification treatment"><TextArea rows={6} value={draft.treatment} onChange={(value) => setDraft((current) => ({ ...current, treatment: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function FragilitySensitivityEditor(
  { index, onClose }: { index: number | null; onClose: () => void },
): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newFragilitySensitivity()
    : mef.seismicFragilityAnalysis.results.sensitivityStudies[index]!;
  const [draft, setDraft] = useState<SfrSensitivityStudy>(
    () => structuredClone(original),
  );
  const [ranges, setRanges] = useState(() =>
    parameterRangeText(original.parameterRanges));
  function save(): void {
    update((next) => {
      const records = next.seismicFragilityAnalysis.results.sensitivityStudies;
      const saved = { ...draft, parameterRanges: parseParameterRanges(ranges) };
      if (index === null) records.push(saved);
      else records[index] = saved;
    });
    onClose();
  }
  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicFragilityAnalysis.results.sensitivityStudies.splice(index, 1);
    });
    onClose();
  }
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title={draft.name ?? "Sensitivity study"} subtitle="Reasonable alternative, parameter range, result, and decision" plainHeader onClose={onClose} footer={<>
    {editable && index !== null && <button type="button" className="posnav__btn" onClick={remove}>Remove study</button>}
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save study</button>}
  </>}>
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <Field label="Name"><TextInput value={draft.name ?? ""} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /></Field>
        <Field label="Alternative tested"><TextArea rows={5} value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} /></Field>
        <Field label="Varied parameters" hint="One parameter per line."><TextArea rows={5} value={draft.variedParameters.join("\n")} onChange={(value) => setDraft((current) => ({ ...current, variedParameters: technicalList(value) }))} /></Field>
        <Field label="Parameter ranges" hint="Use one line per parameter: parameter: lower, upper"><TextArea rows={6} value={ranges} onChange={setRanges} /></Field>
        <Field label="Quantified result"><TextArea rows={5} value={draft.results ?? ""} onChange={(value) => setDraft((current) => ({ ...current, results: value || undefined }))} /></Field>
        <Field label="Decision or insight"><TextArea rows={5} value={draft.insights ?? ""} onChange={(value) => setDraft((current) => ({ ...current, insights: value || undefined }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
}

function FragilityDevelopmentScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const threshold = mef.seismicFragilityAnalysis.thresholdProgram;
  const results = mef.seismicFragilityAnalysis.results;
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const investigations = mef.seismicFragilityAnalysis.plantInvestigations;
  const responseResults =
    mef.seismicFragilityAnalysis.seismicResponseAnalysis.responseResults;
  const responseByRef = new Map(
    responseResults.map((result) => [result.uuid, result]),
  );
  const mechanismByRef = new Map(
    results.failureMechanisms.map((mechanism) => [mechanism.uuid, mechanism]),
  );
  const confirmations = new Map(
    investigations.flatMap((investigation) =>
      investigation.fragilityThresholdConfirmations.map((confirmation) =>
        [confirmation.sscRef, confirmation] as const)),
  );
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [ruggednessIndex, setRuggednessIndex] =
    useState<number | null | undefined>(undefined);
  const [methodIndex, setMethodIndex] =
    useState<number | null | undefined>(undefined);
  const [mechanismIndex, setMechanismIndex] =
    useState<number | null | undefined>(undefined);
  const [fragilityIndex, setFragilityIndex] =
    useState<number | null | undefined>(undefined);
  const [correlationIndex, setCorrelationIndex] =
    useState<number | null | undefined>(undefined);
  const [uncertaintyIndex, setUncertaintyIndex] =
    useState<number | null | undefined>(undefined);
  const [sensitivityIndex, setSensitivityIndex] =
    useState<number | null | undefined>(undefined);
  const [selectedFragilityRef, setSelectedFragilityRef] = useState(
    results.fragilityEvaluations[0]?.uuid ?? "",
  );
  const selected = results.fragilityEvaluations.find((evaluation) =>
    evaluation.uuid === selectedFragilityRef)
    ?? results.fragilityEvaluations[0];
  const chartPoints = useMemo(
    () => fragilityFanSeries(selected),
    [selected],
  );

  function equipmentName(ref: string): string {
    return equipment.find((item) => item.uuid === ref)?.name ?? ref;
  }

  function mechanismName(ref: string): string {
    return mechanismByRef.get(ref)?.name ?? ref;
  }

  function stopRowClick(event: { stopPropagation: () => void }): void {
    event.stopPropagation();
  }

  return <>
    <Section
      title="Screening criteria"
      description="This section sets the capacity checks used to screen an SSC. An SSC can be screened only when its verified capacity is safely above the risk-based target and every configuration, anchorage, support, and interaction condition is satisfied."
      tone="sfr"
    >
      <Table
        caption="Risk-based screening targets"
        captionActions={editable ? <>
          <EditButton
            label="Edit screened SSC scope"
            onClick={() => setThresholdOpen(true)}
          />
          <AddButton
            label="Add threshold method"
            onClick={() => setMethodIndex(null)}
          />
        </> : undefined}
        headers={[
          "Method",
          "Target capacity",
          "Motion parameter",
          "SEL population",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["26%", "16%", "21%", "16%", "21%"]}
        className="stable--wrapheads stable--step08"
      >
        {threshold.thresholdMethods.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No screening target"
              detail="Define the ground-motion parameter, target capacity, cumulative SSC population, and comparison method."
            /></td></tr>
          : threshold.thresholdMethods.map((method, index) =>
            <tr
              className="postable__row--clickable"
              key={method.uuid}
              onClick={() => setMethodIndex(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Technical method for ${method.name}`}
                  detail={[
                    method.comparisonMethod,
                    method.correlationTreatment,
                    ...method.caveatsAndInclusionRules,
                  ].filter((value) => value.trim().length > 0).join(" ")}
                >
                  {method.name}
                </EntryName>
                <code>{method.plantResponseThresholdRef}</code>
              </td>
              <td>{method.thresholdCapacity} {method.capacityUnits}</td>
              <td>
                {method.groundMotionParameterRef}
                <code>{method.controlPointRef}</code>
              </td>
              <td>{method.cumulativeSscCountBasis} SSCs</td>
              <td>
                <Tag tone={method.satisfiesScr2 ? "good" : "bad"}>
                  {method.satisfiesScr2 ? "Qualified" : "Open"}
                </Tag>
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Inherently rugged component classes"
        captionActions={editable
          ? <AddButton
              label="Add ruggedness class"
              onClick={() => setRuggednessIndex(null)}
            />
          : undefined}
        headers={[
          "Class",
          "Motion parameter",
          "Generic configurations",
          "Plant additions",
          "Exclusions",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["21%", "13%", "23%", "17%", "16%", "10%"]}
        className="stable--wrapheads stable--step08"
      >
        {threshold.inherentlyRuggedBases.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No inherently rugged class"
              detail="Define only component configurations whose seismic capacity is well beyond the risk-significant range."
            /></td></tr>
          : threshold.inherentlyRuggedBases.map((item, index) =>
            <tr
              className="postable__row--clickable"
              key={item.uuid}
              onClick={() => setRuggednessIndex(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Capacity decision for ${item.name}`}
                  detail={<>
                    {item.capacityBeyondRiskSignificantRangeBasis}{" "}
                    {item.hazardIndependentBasis}
                  </>}
                >
                  {item.name}
                </EntryName>
              </td>
              <td>{item.referenceGroundMotionParameter}</td>
              <td>{item.genericRuggedComponentTypes.join(", ")}</td>
              <td>{item.plantSpecificAdditions.length === 0
                ? "None"
                : item.plantSpecificAdditions
                  .map((addition) => addition.componentType).join(", ")}</td>
              <td>{item.excludedComponentTypes.join(", ") || "None"}</td>
              <td>
                <Tag tone="good">Defined</Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="SEL fragility disposition"
      description="This section gives every final SEL item one clear outcome: screened as inherently rugged, screened above a justified threshold, represented by an applicable fragility, or retained with a detailed fragility calculation."
      tone="sfr"
    >
      <Table
        caption="Final screening and fragility assignments"
        headers={[
          "SSC",
          "Risk treatment",
          "Technical method",
          "Assigned demand",
          "Failure modes",
          "Status",
        ]}
        minWidth={0}
        columnWidths={["22%", "16%", "19%", "18%", "16%", "9%"]}
        className="stable--wrapheads stable--step08"
      >
        {equipment.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No final SEL records"
              detail="Complete the SEL before making screening and fragility decisions."
            /></td></tr>
          : equipment.map((item) => {
            const evaluation = results.fragilityEvaluations.find((candidate) =>
              candidate.sscRef === item.uuid);
            const mechanism = evaluation === undefined
              ? undefined
              : mechanismByRef.get(evaluation.controllingMechanismRef);
            const confirmation = confirmations.get(item.uuid);
            const assignedResponses = responseResults.filter((response) =>
              response.applicableSscRefs.includes(item.uuid));
            const screenedReady = item.disposition === "REMOVED_FROM_MODEL"
              ? item.dispositionBasis.trim().length > 0
              : confirmation?.anchorageConfirmed === true
                && confirmation.supportConfirmed
                && confirmation.thresholdSatisfied;
            const evaluationReady = evaluation !== undefined
              && mechanism !== undefined
              && evaluation.responseResultRefs.length > 0
              && evaluation.capacityDataRefs.length > 0;
            const ready = evaluation === undefined
              ? screenedReady
              : evaluationReady;
            const treatment = evaluation !== undefined
              ? evaluation.plantSpecific
                ? "Detailed fragility"
                : "Representative fragility"
              : item.disposition === "INHERENTLY_RUGGED"
                ? "Inherently rugged"
                : item.disposition === "ABOVE_FRAGILITY_THRESHOLD"
                  ? "Threshold screened"
                  : "Removed from model";
            const thresholdMethod = evaluation?.thresholdMethodRef === undefined
              ? undefined
              : threshold.thresholdMethods.find((method) =>
                method.uuid === evaluation.thresholdMethodRef);
            return <tr key={item.uuid}>
              <td className="stable__key">
                <EntryName
                  detailLabel={`Technical basis for ${item.name}`}
                  detail={item.dispositionBasis.trim().length > 0
                    || (!evaluation?.plantSpecific
                      && evaluation?.genericDataJustification !== undefined)
                    ? <>
                      {item.dispositionBasis}{" "}
                      {!evaluation?.plantSpecific
                        ? evaluation?.genericDataJustification ?? ""
                        : ""}
                    </>
                    : undefined}
                >
                  {item.name}
                </EntryName>
                <code>{item.uuid}</code>
              </td>
              <td>{treatment}</td>
              <td>{evaluation === undefined
                ? item.disposition === "INHERENTLY_RUGGED"
                  ? "Ruggedness class confirmation"
                  : item.disposition === "ABOVE_FRAGILITY_THRESHOLD"
                    ? "Cumulative threshold confirmation"
                    : "Documented removal"
                : <>
                  {displayLabel(evaluation.evaluationBasis)}
                  <code>{thresholdMethod?.name
                    ?? mechanismName(evaluation.controllingMechanismRef)}</code>
                </>}
              </td>
              <td>{evaluation !== undefined
                ? evaluation.responseResultRefs
                  .map((ref) => responseByRef.get(ref)?.name ?? ref).join(", ")
                : assignedResponses.length === 0
                  ? item.disposition === "REMOVED_FROM_MODEL"
                    ? "Not required"
                    : "No demand assigned"
                  : assignedResponses.map((response) => response.name).join(", ")}</td>
              <td>{item.failureModes.length === 0
                ? "No modeled failure mode"
                : item.failureModes.map((mode) => mode.name).join(", ")}</td>
              <td><Tag tone={ready ? "good" : "bad"}>
                {ready ? "Ready" : "Open"}
              </Tag></td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Failure mechanisms"
      description="An SSC can fail in several physical ways. This section identifies the mechanism that controls each modeled failure mode and connects it to the correct seismic demand and capacity evidence."
      tone="sfr"
    >
      <Table
        caption="Governing failure mechanisms"
        captionActions={editable
          ? <AddButton
              label="Add failure mechanism"
              onClick={() => setMechanismIndex(null)}
            />
          : undefined}
        headers={[
          "SSC and failure mode",
          "Governing mechanism",
          "Demand",
          "Capacity evidence",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["24%", "19%", "21%", "20%", "16%"]}
        className="stable--wrapheads stable--step08"
      >
        {results.failureMechanisms.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No failure mechanism"
              detail="Link each modeled SEL failure mode to its controlling physical mechanism."
            /></td></tr>
          : results.failureMechanisms.map((mechanism, index) =>
            <tr
              className="postable__row--clickable"
              key={mechanism.uuid}
              onClick={() => setMechanismIndex(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Technical basis for ${mechanism.name}`}
                  detail={<>
                    {mechanism.description} {mechanism.selectionBasis}
                  </>}
                >
                  {equipmentName(mechanism.sscRef)}
                </EntryName>
                <code>{mechanism.systemsFailureModeRef}</code>
              </td>
              <td>{displayLabel(mechanism.mechanismType)}</td>
              <td>
                {mechanism.demandParameter}
                <code>{mechanism.demandResultRefs
                  .map((ref) => responseByRef.get(ref)?.name ?? ref).join(", ")}</code>
              </td>
              <td>
                {mechanism.capacityParameter}
                <code>{mechanism.capacityDataRefs.length} source records</code>
              </td>
              <td>
                <Tag tone={mechanism.realisticForRiskSignificantSsc
                  ? "good"
                  : mechanism.conservativeBounding ? "warn" : "neutral"}>
                  {mechanism.realisticForRiskSignificantSsc
                    ? "Realistic"
                    : mechanism.conservativeBounding ? "Bounding" : "Review"}
                </Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Fragility evaluations"
      description="A fragility curve converts earthquake motion into a probability of failure. The median capacity locates the curve, beta-R represents randomness, beta-U represents uncertainty in the median, and HCLPF shows the conservative lower-tail capacity."
      tone="sfr"
    >
      {selected === undefined
        ? <TechnicalEmptyState
            title="No fragility evaluation"
            detail="Add a fragility to calculate its capacity distribution."
          />
        : <>
          <div className="sdistribution__head">
            <div>
              <strong>{selected.name}</strong>
              <span>
                Median {selected.medianCapacity} {selected.capacityUnits}
                {" · "}βR {selected.betaRandomness}
                {" · "}βU {selected.betaUncertainty}
                {" · "}HCLPF {
                  selected.highConfidenceLowProbabilityOfFailureCapacity
                    ?? "Not calculated"
                } {selected.capacityUnits}
              </span>
            </div>
            <div className="splotselects">
              <label className="splotselect">Fragility
                <SelectInput
                  value={selected.uuid}
                  options={results.fragilityEvaluations.map((evaluation) => ({
                    value: evaluation.uuid,
                    label: evaluation.name,
                  }))}
                  onChange={setSelectedFragilityRef}
                />
              </label>
            </div>
          </div>
          <div className="sfragilityfan">
            <DistributionFanChart
              points={chartPoints}
              xLabel={`Ground motion (${selected.capacityUnits})`}
              yLabel="Conditional failure probability"
              ariaLabel={`${selected.name} conditional failure distribution`}
            />
          </div>
        </>}

      <Table
        caption="Capacity distributions"
        captionActions={editable
          ? <AddButton
              label="Add fragility"
              onClick={() => setFragilityIndex(null)}
            />
          : undefined}
        headers={[
          "SSC and evaluation",
          "Method",
          "Capacity",
          "Variability",
          "Traceability",
        ]}
        minWidth={0}
        columnWidths={["25%", "18%", "18%", "17%", "22%"]}
        className="stable--wrapheads stable--step08"
      >
        {results.fragilityEvaluations.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No capacity distribution"
              detail="Add the median capacity, variability, demand record, capacity evidence, and governing mechanism."
            /></td></tr>
          : results.fragilityEvaluations.map((evaluation, index) =>
            <tr
              className="postable__row--clickable"
              key={evaluation.uuid}
              onClick={() => setFragilityIndex(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Representative-data justification for ${evaluation.name}`}
                  detail={!evaluation.plantSpecific
                    ? evaluation.genericDataJustification
                    : undefined}
                >
                  {equipmentName(evaluation.sscRef)}
                </EntryName>
                <code>{evaluation.name}</code>
              </td>
              <td>
                {evaluation.plantSpecific
                  ? "Plant-specific"
                  : "Representative"}
                <code>{displayLabel(evaluation.evaluationBasis)}</code>
              </td>
              <td>
                Median {evaluation.medianCapacity} {evaluation.capacityUnits}
                <code>HCLPF {
                  evaluation.highConfidenceLowProbabilityOfFailureCapacity
                    ?? "Not calculated"
                } {evaluation.capacityUnits}</code>
              </td>
              <td>
                βR {evaluation.betaRandomness} · βU {evaluation.betaUncertainty}
                <code>Composite β {evaluation.compositeBeta ?? "Not calculated"}</code>
              </td>
              <td>
                {mechanismName(evaluation.controllingMechanismRef)}
                <code>
                  {evaluation.responseResultRefs.length} demand · {
                    evaluation.capacityDataRefs.length
                  } capacity · {evaluation.correlationGroupRefs.length} correlation
                </code>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Fragility correlation"
      description="If two SSCs share earthquake demand, design, installation, location, or a physical dependency, their failures may not be independent. This section records that shared cause so the PRA does not understate or double-count joint failure."
      tone="sfr"
    >
      <Table
        caption="Correlation groups"
        captionActions={editable
          ? <AddButton
              label="Add correlation group"
              onClick={() => setCorrelationIndex(null)}
            />
          : undefined}
        headers={[
          "Group",
          "Members",
          "Dependence",
          "Common physical driver",
          "Model check",
        ]}
        minWidth={0}
        columnWidths={["23%", "19%", "17%", "27%", "14%"]}
        className="stable--wrapheads stable--step08"
      >
        {results.correlationGroups.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No correlation group"
              detail="Record each common demand, common capacity, or causal dependency used by the plant model."
            /></td></tr>
          : results.correlationGroups.map((group, index) =>
            <tr
              className="postable__row--clickable"
              key={group.uuid}
              onClick={() => setCorrelationIndex(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Correlation treatment for ${group.name}`}
                  detail={<>Construction: {group.constructionSimilarity} Installation: {
                    group.installationSimilarity
                  } Location and orientation: {
                    group.locationAndOrientationSimilarity
                  } Capacity: {group.capacitySimilarity} Model: {
                    group.modelingImplementation
                  } Decision: {group.justification}</>}
                >
                  {group.name}
                </EntryName>
                <code>{group.uuid}</code>
              </td>
              <td>{group.memberSscRefs.map(equipmentName).join(", ")}</td>
              <td>
                {displayLabel(group.correlationModel)}
                {group.correlationCoefficient === undefined
                  ? ""
                  : ` · ρ ${group.correlationCoefficient}`}
              </td>
              <td>{group.commonDemandBasis}</td>
              <td>
                <Tag tone={group.justification.trim().length > 0
                  ? "good"
                  : "bad"}>
                  {group.justification.trim().length > 0
                    ? "Justified"
                    : "Open"}
                </Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Fragility uncertainty and sensitivity"
      description="This section records what is uncertain, how much capacity could change, and whether reasonable alternative assumptions change the important risk results or hide another contributor."
      tone="sfr"
    >
      <Table
        caption="Fragility uncertainties"
        captionActions={editable
          ? <AddButton
              label="Add uncertainty"
              onClick={() => setUncertaintyIndex(null)}
            />
          : undefined}
        headers={[
          "Uncertainty",
          "Type and importance",
          "Affected models",
          "Capacity factor",
          "Quantification",
        ]}
        minWidth={0}
        columnWidths={["25%", "19%", "17%", "17%", "22%"]}
        className="stable--wrapheads stable--step08"
      >
        {results.uncertainties.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No fragility uncertainty"
              detail="Identify important parameter, model, and pre-operational configuration uncertainty."
            /></td></tr>
          : results.uncertainties.map((uncertainty, index) =>
            <tr
              className="postable__row--clickable"
              key={uncertainty.uuid}
              onClick={() => setUncertaintyIndex(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Treatment for ${uncertainty.name}`}
                  detail={<>
                    {uncertainty.description} {uncertainty.treatment} Alternatives: {
                      uncertainty.reasonableAlternatives.join(", ")
                    }
                  </>}
                >
                  {uncertainty.name}
                </EntryName>
              </td>
              <td>
                {displayLabel(uncertainty.uncertaintyType)}
                <code>{uncertainty.importance === undefined
                  ? "Importance not set"
                  : displayLabel(uncertainty.importance)}</code>
              </td>
              <td>
                {uncertainty.affectedFragilityRefs.length} fragilities
                <code>{uncertainty.affectedSscRefs.length} SSCs</code>
              </td>
              <td>{uncertainty.estimatedCapacityImpact === undefined
                ? "Not estimated"
                : `${uncertainty.estimatedCapacityImpact.lowerFactor} to ${
                  uncertainty.estimatedCapacityImpact.upperFactor
                } × median`}</td>
              <td>
                <Tag tone={uncertainty.treatment.trim().length > 0
                  ? "good"
                  : "bad"}>
                  {uncertainty.treatment.trim().length > 0
                    ? "Propagated"
                    : "Open"}
                </Tag>
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Fragility sensitivity studies"
        captionActions={editable
          ? <AddButton
              label="Add sensitivity study"
              onClick={() => setSensitivityIndex(null)}
            />
          : undefined}
        headers={[
          "Study",
          "Varied parameters",
          "Range",
          "Quantified effect",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["23%", "18%", "19%", "22%", "18%"]}
        className="stable--wrapheads stable--step08"
      >
        {results.sensitivityStudies.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No sensitivity study"
              detail="Test the reasonable alternatives that could change capacity, risk significance, contributor ranking, or masking."
            /></td></tr>
          : results.sensitivityStudies.map((study, index) =>
            <tr
              className="postable__row--clickable"
              key={study.uuid}
              onClick={() => setSensitivityIndex(index)}
            >
              <td className="stable__key">
                <strong>{study.name ?? `Sensitivity ${index + 1}`}</strong>
              </td>
              <td>{study.variedParameters.map(displayParameter).join(", ")}</td>
              <td><code>{parameterRangeText(study.parameterRanges)}</code></td>
              <td>{study.results ?? "Not quantified"}</td>
              <td>{study.insights ?? "No decision recorded"}</td>
            </tr>)}
      </Table>
    </Section>

    {thresholdOpen
      && <ThresholdProgramEditor onClose={() => setThresholdOpen(false)} />}
    {ruggednessIndex !== undefined
      && <RuggednessBasisEditor
        index={ruggednessIndex}
        onClose={() => setRuggednessIndex(undefined)}
      />}
    {methodIndex !== undefined
      && <ThresholdMethodEditor
        index={methodIndex}
        onClose={() => setMethodIndex(undefined)}
      />}
    {mechanismIndex !== undefined
      && <FailureMechanismEditor
        index={mechanismIndex}
        onClose={() => setMechanismIndex(undefined)}
      />}
    {fragilityIndex !== undefined
      && <FragilityEvaluationEditor
        index={fragilityIndex}
        onClose={() => setFragilityIndex(undefined)}
      />}
    {correlationIndex !== undefined
      && <CorrelationGroupEditor
        index={correlationIndex}
        onClose={() => setCorrelationIndex(undefined)}
      />}
    {uncertaintyIndex !== undefined
      && <FragilityUncertaintyEditor
        index={uncertaintyIndex}
        onClose={() => setUncertaintyIndex(undefined)}
      />}
    {sensitivityIndex !== undefined
      && <FragilitySensitivityEditor
        index={sensitivityIndex}
        onClose={() => setSensitivityIndex(undefined)}
      />}
  </>;
}

function FragilityResultsScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const results = mef.seismicFragilityAnalysis.results;
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const [basisOpen, setBasisOpen] = useState(false);
  const [mechanismIndex, setMechanismIndex] =
    useState<number | null | undefined>(undefined);
  const [fragilityIndex, setFragilityIndex] =
    useState<number | null | undefined>(undefined);
  const [correlationIndex, setCorrelationIndex] =
    useState<number | null | undefined>(undefined);
  const [uncertaintyIndex, setUncertaintyIndex] =
    useState<number | null | undefined>(undefined);
  const [sensitivityIndex, setSensitivityIndex] =
    useState<number | null | undefined>(undefined);
  const [selectedFragilityRef, setSelectedFragilityRef] = useState(
    results.fragilityEvaluations[0]?.uuid ?? "",
  );
  const selected = results.fragilityEvaluations.find(
    (evaluation) => evaluation.uuid === selectedFragilityRef,
  ) ?? results.fragilityEvaluations[0];
  const chartPoints = useMemo(
    () => fragilityFanSeries(selected),
    [selected],
  );
  const equipmentName = (ref: string): string =>
    equipment.find((item) => item.uuid === ref)?.name ?? ref;
  const mechanismName = (ref: string): string =>
    results.failureMechanisms.find((item) => item.uuid === ref)?.name ?? ref;
  return <>
    <Section eyebrow="SFR · HLR-E" title="Failure mechanisms" description="Credible mechanisms for modeled failure modes." tone="sfr">
      {editable && <div className="sstep10actions">
        <EditButton label="Edit transfer" onClick={() => setBasisOpen(true)} />
        <AddButton label="Add mechanism" onClick={() => setMechanismIndex(null)} />
      </div>}
      <Table caption="Controlling failure mechanisms" headers={["SSC and failure mode", "Mechanism", "Demand and response", "Capacity evidence", "Decision"]} minWidth={0} columnWidths={["23%", "20%", "21%", "20%", "16%"]} className="stable--wrapheads stable--technical">
        {results.failureMechanisms.map((mechanism, index) => <tr className="postable__row--clickable" key={mechanism.uuid} onClick={() => setMechanismIndex(index)}>
          <td className="stable__key"><strong>{equipmentName(mechanism.sscRef)}</strong><code>{mechanism.systemsFailureModeRef}</code></td>
          <td><strong>{displayLabel(mechanism.mechanismType)}</strong><code>{mechanism.description}</code></td>
          <td>{mechanism.demandParameter}<code>{mechanism.demandResultRefs.join(", ")}</code></td>
          <td>{mechanism.capacityParameter}<code>{mechanism.capacityDataRefs.join(", ")}</code></td>
          <td><Tag tone={mechanism.realisticForRiskSignificantSsc ? "good" : mechanism.conservativeBounding ? "warn" : "neutral"}>{mechanism.realisticForRiskSignificantSsc ? "Realistic" : mechanism.conservativeBounding ? "Bounding" : "Review"}</Tag><code>{mechanism.selectionBasis}</code></td>
        </tr>)}
      </Table>
    </Section>

    <Section eyebrow="Capacity distributions" title="Fragility curves" description="Median capacity, variability, and lower-tail capacity." tone="sfr">
      {editable && <div className="sstep10actions"><AddButton label="Add fragility" onClick={() => setFragilityIndex(null)} /></div>}
      {selected !== undefined && <>
        <div className="sdistribution__head">
          <div><strong>{selected.name}</strong><span>Median {selected.medianCapacity} {selected.capacityUnits} · βR {selected.betaRandomness} · βU {selected.betaUncertainty} · HCLPF {selected.highConfidenceLowProbabilityOfFailureCapacity ?? "—"} {selected.capacityUnits}</span></div>
          <div className="splotselects">
            <label className="splotselect">Fragility
              <SelectInput value={selected.uuid} options={results.fragilityEvaluations.map((evaluation) => ({ value: evaluation.uuid, label: evaluation.name }))} onChange={setSelectedFragilityRef} />
            </label>
          </div>
        </div>
        <div className="sfragilityfan"><DistributionFanChart points={chartPoints} xLabel={`Ground motion (${selected.capacityUnits})`} yLabel="Conditional failure probability" ariaLabel={`${selected.name} conditional failure distribution`} /></div>
      </>}
      <Table caption="Fragility evaluations" headers={["Fragility", "Analysis", "Capacity", "Variability", "Model transfer"]} minWidth={0} columnWidths={["24%", "17%", "18%", "17%", "24%"]} className="stable--wrapheads stable--technical">
        {results.fragilityEvaluations.map((evaluation, index) => <tr className="postable__row--clickable" key={evaluation.uuid} onClick={() => setFragilityIndex(index)}>
          <td className="stable__key"><strong>{equipmentName(evaluation.sscRef)}</strong><code>{evaluation.name}</code></td>
          <td><strong>{displayLabel(evaluation.analysisCategory)}</strong><code>{displayLabel(evaluation.evaluationBasis)}</code></td>
          <td><strong>Median {evaluation.medianCapacity} {evaluation.capacityUnits}</strong><code>HCLPF {evaluation.highConfidenceLowProbabilityOfFailureCapacity ?? "—"} {evaluation.capacityUnits}</code></td>
          <td><strong>βR {evaluation.betaRandomness} · βU {evaluation.betaUncertainty}</strong><code>Composite β {evaluation.compositeBeta ?? "—"}</code></td>
          <td>{mechanismName(evaluation.controllingMechanismRef)}<code>{evaluation.correlationGroupRefs.join(", ")}</code></td>
        </tr>)}
      </Table>
    </Section>

    <Section eyebrow="Model treatment" title="Correlation and uncertainty" description="Dependencies and reasonable alternatives used in quantification." tone="sfr">
      {editable && <div className="sstep10actions">
        <AddButton label="Add correlation" onClick={() => setCorrelationIndex(null)} />
        <AddButton label="Add uncertainty" onClick={() => setUncertaintyIndex(null)} />
        <AddButton label="Add sensitivity" onClick={() => setSensitivityIndex(null)} />
      </div>}
      <Table caption="Correlation groups" headers={["Group", "Members", "Dependence", "Implementation"]} minWidth={0} columnWidths={["23%", "18%", "25%", "34%"]} className="stable--wrapheads stable--technical">
        {results.correlationGroups.map((group, index) => <tr className="postable__row--clickable" key={group.uuid} onClick={() => setCorrelationIndex(index)}>
          <td className="stable__key"><strong>{group.name}</strong><code>{group.uuid}</code></td>
          <td>{group.memberSscRefs.map(equipmentName).join(", ")}</td>
          <td><strong>{displayLabel(group.correlationModel)}{group.correlationCoefficient === undefined ? "" : ` · ρ ${group.correlationCoefficient}`}</strong><code>{group.commonDemandBasis}</code></td>
          <td>{group.modelingImplementation}<code>{group.justification}</code></td>
        </tr>)}
      </Table>
      <Table caption="Fragility uncertainties" headers={["Uncertainty", "Affected models", "Capacity impact", "Treatment"]} minWidth={0} columnWidths={["24%", "17%", "17%", "42%"]} className="stable--wrapheads stable--technical">
        {results.uncertainties.map((uncertainty, index) => <tr className="postable__row--clickable" key={uncertainty.uuid} onClick={() => setUncertaintyIndex(index)}>
          <td className="stable__key"><strong>{uncertainty.name}</strong><code>{displayLabel(uncertainty.uncertaintyType)}</code></td>
          <td><strong>{uncertainty.affectedFragilityRefs.length} fragilities</strong><code>{uncertainty.affectedSscRefs.length} SSCs</code></td>
          <td>{uncertainty.estimatedCapacityImpact === undefined ? "Not estimated" : `${uncertainty.estimatedCapacityImpact.lowerFactor}–${uncertainty.estimatedCapacityImpact.upperFactor} × median`}<code>{uncertainty.importance === undefined ? "" : displayLabel(uncertainty.importance)}</code></td>
          <td>{uncertainty.treatment}<code>{uncertainty.reasonableAlternatives.join(", ")}</code></td>
        </tr>)}
      </Table>
      <Table caption="Sensitivity studies" headers={["Study", "Variation", "Result", "Decision"]} minWidth={0} columnWidths={["22%", "22%", "28%", "28%"]} className="stable--wrapheads stable--technical">
        {results.sensitivityStudies.map((study, index) => <tr className="postable__row--clickable" key={study.uuid} onClick={() => setSensitivityIndex(index)}>
          <td className="stable__key"><strong>{study.name ?? `Sensitivity ${index + 1}`}</strong><code>{study.description}</code></td>
          <td>{study.variedParameters.map(displayParameter).join(", ")}<code>{parameterRangeText(study.parameterRanges)}</code></td>
          <td>{study.results ?? "Not quantified"}</td>
          <td>{study.insights ?? "No decision recorded"}</td>
        </tr>)}
      </Table>
    </Section>

    {basisOpen && <FragilityResultsBasisEditor onClose={() => setBasisOpen(false)} />}
    {mechanismIndex !== undefined && <FailureMechanismEditor index={mechanismIndex} onClose={() => setMechanismIndex(undefined)} />}
    {fragilityIndex !== undefined && <FragilityEvaluationEditor index={fragilityIndex} onClose={() => setFragilityIndex(undefined)} />}
    {correlationIndex !== undefined && <CorrelationGroupEditor index={correlationIndex} onClose={() => setCorrelationIndex(undefined)} />}
    {uncertaintyIndex !== undefined && <FragilityUncertaintyEditor index={uncertaintyIndex} onClose={() => setUncertaintyIndex(undefined)} />}
    {sensitivityIndex !== undefined && <FragilitySensitivityEditor index={sensitivityIndex} onClose={() => setSensitivityIndex(undefined)} />}
  </>;
}

function PlantResponseModelScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const initiators =
    mef.seismicPlantResponseAnalysis.initiatingEventIdentification;
  const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
  const equipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const fragilities =
    mef.seismicFragilityAnalysis.results.fragilityEvaluations;
  const outcomeMappings =
    mef.seismicPlantResponseAnalysis.quantification
      .eventSequenceFamilyQuantifications;
  const retainedInitiatorRefs = new Set(
    initiators.retainedInitiatingEventRefs,
  );
  const allInitiators = [
    ...initiators.directInitiators.map((item, collectionIndex) => ({
      item,
      collectionIndex,
      collection: "directInitiators" as const,
      eventType: "Direct shaking",
    })),
    ...initiators.secondaryHazardInitiators.map(
      (item, collectionIndex) => ({
        item,
        collectionIndex,
        collection: "secondaryHazardInitiators" as const,
        eventType: "Secondary or consequential",
      }),
    ),
  ];
  const baselineRows = [
    {
      label: "Event sequences",
      records: model.eventSequenceRefs,
      treatment: "Reuse applicable sequences and add seismic branches",
    },
    {
      label: "Systems logic",
      records: model.systemsLogicModelRefs,
      treatment: "Preserve system boundaries and add seismic basic events",
    },
    {
      label: "Random and common-cause failures",
      records: model.nonSeismicFailureRefs,
      treatment: "Retain applicable non-seismic failures",
    },
    {
      label: "Planned and test unavailability",
      records: model.unavailabilityRefs,
      treatment: "Retain applicable plant unavailability",
    },
    {
      label: "Baseline human errors",
      records: model.humanErrorRefs,
      treatment: "Carry forward for seismic HRA review in Step 10",
    },
    {
      label: "Non-seismic hazard models",
      records: model.baseNonSeismicHazardModelRefs,
      treatment: "Reuse fire and flood logic where applicable",
    },
    {
      label: "Plant operating states",
      records: model.plantOperatingStateRefs,
      treatment: "Apply the model in every in-scope state",
    },
    {
      label: "Radioactive-material sources",
      records: model.radioactiveMaterialSourceRefs,
      treatment: "Preserve reactor and other source pathways",
    },
  ];
  const [identificationOpen, setIdentificationOpen] = useState(false);
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [recordEditor, setRecordEditor] =
    useState<CollectionEditorTarget | null>(null);
  const initiatorFields = [
    "name",
    "origin",
    "description",
    "plantOperatingStateRefs",
    "reactorUnitRefs",
    "radioactiveMaterialSourceRefs",
    "directGroundMotionFailureRefs",
    "secondaryHazardRef",
    "industryExperienceRefs",
    "internalEventsInitiatingEventRef",
    "combinedEventComponents",
    "automaticOrManualTrip",
    "affectedSscRefs",
    "eventSequenceRefs",
    "riskSignificant",
    "screeningOrSubsumingBasis",
    "retained",
  ];
  const logicFields = [
    "name",
    "logicType",
    "reasonNeeded",
    "baseInternalEventsModelRef",
    "modelRefs",
    "verificationAndValidation",
  ];
  const missionFields = [
    "name",
    "eventSequenceRef",
    "successCriteriaRef",
    "assumedMissionTimeHours",
    "sustainedAccessibilityImpact",
    "emergencyResponseCapabilityImpact",
    "seismicEnvironmentDuration",
    "missionTimeValid",
    "revisedMissionTimeHours",
    "basis",
  ];
  const failureFields = [
    "name",
    "sscRef",
    "seismicEquipmentListEntryRef",
    "systemsFailureModeRef",
    "fragilityEvaluationRef",
    "systemsBasicEventRef",
    "failureEffect",
    "correlationGroupRefs",
    "causalDependencyRefs",
    "eventSequenceRefs",
    "modelImplementation",
  ];
  const chatterFields = [
    "name",
    "deviceSscRef",
    "fragilityEvaluationRef",
    "affectedSscRefs",
    "chatterEffect",
    "systemsLogicRefs",
    "riskSignificant",
    "exclusionByDesignBasis",
  ];
  const multiUnitFields = [
    "name",
    "applicable",
    "reactorUnitRefs",
    "sharedSscRefs",
    "sharedHazardAndDependencyDescription",
    "concurrentInitiatingEventRefs",
    "multiUnitEventSequenceRefs",
    "sharedHumanActionRefs",
    "sharedRadioactiveSourceRefs",
    "modelImplementation",
    "exclusionBasis",
  ];
  const hazardFields = [
    "name",
    "hazardType",
    "hazardAnalysisRef",
    "initiatingEventRefs",
    "sourceSscRefs",
    "affectedSscRefs",
    "fragilityRefs",
    "plantResponseModelRefs",
    "integrationBasis",
  ];
  const outcomeFields = [
    "name",
    "eventSequenceFamilyRef",
    "initiatingEventRefs",
    "eventSequenceRefs",
    "releaseCategoryRef",
    "sourceTermRef",
  ];
  const findingFields = [
    "name",
    "sourcePraElement",
    "sourcePeerReviewRef",
    "findingRef",
    "relevanceToSeismicPra",
    "potentialAmplificationInSeismicModel",
    "resolutionStatus",
    "resolution",
    "incorporatedModelRefs",
    "evidenceRefs",
  ];

  function equipmentName(reference: string): string {
    return equipment.find((item) => item.uuid === reference)?.name
      ?? reference;
  }

  function fragilityName(reference: string): string {
    return fragilities.find((item) => item.uuid === reference)?.name
      ?? reference;
  }

  function openRecord(
    title: string,
    subtitle: string,
    focus: EditorPath,
    visibleRootFields: string[],
    removeLabel: string,
  ): void {
    setRecordEditor({
      title,
      subtitle,
      focus,
      visibleRootFields,
      inlinePrimitiveArrays: true,
      removeLabel,
    });
  }

  function createRecord(
    title: string,
    subtitle: string,
    createAt: EditorPath,
    visibleRootFields: string[],
  ): void {
    setRecordEditor({
      title,
      subtitle,
      focus: [],
      createAt,
      visibleRootFields,
      inlinePrimitiveArrays: true,
    });
  }

  function stopRowClick(event: { stopPropagation: () => void }): void {
    event.stopPropagation();
  }

  return <>
    <Section
      title="Seismic initiating events"
      description="An initiating event is the first modeled event in a sequence. Direct events begin with earthquake shaking. Secondary events begin with something the shaking causes, such as ground deformation, flooding, fire, or a concurrent challenge to another radioactive-material source."
      tone="spr"
    >
      <Table
        caption="Initiating-event register"
        captionActions={editable ? <>
          <EditButton
            label="Edit identification scope"
            onClick={() => setIdentificationOpen(true)}
          />
          <AddButton
            label="Add direct event"
            onClick={() => createRecord(
              "New direct seismic initiating event",
              "Define the shaking trigger and affected plant scope.",
              [
                "seismicPlantResponseAnalysis",
                "initiatingEventIdentification",
                "directInitiators",
              ],
              initiatorFields,
            )}
          />
          <AddButton
            label="Add secondary event"
            onClick={() => createRecord(
              "New secondary seismic initiating event",
              "Define the earthquake-caused hazard and affected plant scope.",
              [
                "seismicPlantResponseAnalysis",
                "initiatingEventIdentification",
                "secondaryHazardInitiators",
              ],
              initiatorFields,
            )}
          />
        </> : undefined}
        headers={[
          "Initiating event",
          "Event type",
          "Plant scope",
          "Affected model",
          "Disposition",
        ]}
        minWidth={0}
        columnWidths={["25%", "16%", "20%", "22%", "17%"]}
        className="stable--wrapheads stable--step09"
      >
        {allInitiators.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No seismic initiating event"
              detail="Identify direct shaking and retained earthquake-caused events for every in-scope plant state and radioactive-material source."
            /></td></tr>
          : allInitiators.map(({
            item,
            collection,
            collectionIndex,
            eventType,
          }) => {
            const retained = retainedInitiatorRefs.has(item.uuid)
              && item.retained;
            const complete = item.plantOperatingStateRefs.length > 0
              && item.radioactiveMaterialSourceRefs.length > 0
              && (item.eventSequenceRefs.length > 0
                || !item.retained
                  && (item.screeningOrSubsumingBasis?.trim().length ?? 0) > 0);
            return <tr
              className="postable__row--clickable"
              key={item.uuid}
              onClick={() => openRecord(
                item.name,
                eventType,
                [
                  "seismicPlantResponseAnalysis",
                  "initiatingEventIdentification",
                  collection,
                  collectionIndex,
                ],
                initiatorFields,
                "Remove initiating event",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Technical decision for ${item.name}`}
                  detail={<>
                    {item.description} {item.screeningOrSubsumingBasis ?? ""}
                  </>}
                >
                  {item.name}
                </EntryName>
                <code>{item.uuid}</code>
              </td>
              <td>
                {eventType}
                <code>{displayLabel(item.origin)}</code>
              </td>
              <td>
                {item.plantOperatingStateRefs.join(", ")}
                <code>{item.radioactiveMaterialSourceRefs.join(", ")}</code>
              </td>
              <td>
                {item.eventSequenceRefs.length} sequences
                <code>{item.affectedSscRefs.length} affected SSCs</code>
              </td>
              <td>
                <Tag tone={complete ? retained ? "warn" : "good" : "bad"}>
                  {complete ? retained ? "Retained" : "Screened" : "Open"}
                </Tag>
              </td>
            </tr>;
          })}
      </Table>

      <Table
        caption="Multi-unit and radioactive-material-source dependencies"
        captionActions={editable
          ? <AddButton
              label="Add shared-effect model"
              onClick={() => createRecord(
                "New shared seismic effect",
                "Define affected units, sources, SSCs, actions, and sequences.",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "multiReactorModels",
                ],
                multiUnitFields,
              )}
            />
          : undefined}
        headers={[
          "Shared-effect model",
          "Units and sources",
          "Shared SSCs",
          "Initiators and sequences",
          "Disposition",
        ]}
        minWidth={0}
        columnWidths={["24%", "22%", "19%", "22%", "13%"]}
        className="stable--wrapheads stable--step09"
      >
        {model.multiReactorModels.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No shared-effect evaluation"
              detail="Evaluate concurrent effects on multiple units and radioactive-material sources, including a documented not-applicable decision where appropriate."
            /></td></tr>
          : model.multiReactorModels.map((item, index) => {
            const ready = item.applicable
              ? item.concurrentInitiatingEventRefs.length > 0
                && item.modelImplementation.trim().length > 0
              : (item.exclusionBasis?.trim().length ?? 0) > 0
                && item.modelImplementation.trim().length > 0;
            return <tr
              className="postable__row--clickable"
              key={item.uuid}
              onClick={() => openRecord(
                item.name,
                item.applicable
                  ? "Shared seismic dependency"
                  : "Applicability evaluation",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "multiReactorModels",
                  index,
                ],
                multiUnitFields,
                "Remove shared-effect model",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Shared-effect treatment for ${item.name}`}
                  detail={<>
                    {item.sharedHazardAndDependencyDescription}{" "}
                    {item.modelImplementation} {item.exclusionBasis ?? ""}
                  </>}
                >
                  {item.name}
                </EntryName>
                <code>{item.uuid}</code>
              </td>
              <td>
                {item.reactorUnitRefs.join(", ")}
                <code>{item.sharedRadioactiveSourceRefs.join(", ")}</code>
              </td>
              <td>{item.sharedSscRefs.length === 0
                ? "None"
                : item.sharedSscRefs.map(equipmentName).join(", ")}</td>
              <td>
                {item.concurrentInitiatingEventRefs.length} initiators
                <code>{item.multiUnitEventSequenceRefs.length} sequences</code>
              </td>
              <td>
                <Tag tone={ready ? item.applicable ? "warn" : "good" : "bad"}>
                  {ready
                    ? item.applicable ? "Modeled" : "Not applicable"
                    : "Open"}
                </Tag>
              </td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Baseline model adaptation"
      description="The seismic model starts from the existing internal-events PRA. Applicable event sequences, system logic, random failures, common-cause failures, unavailability, operating states, and radioactive-material sources remain in the model. Only the logic that must change for earthquake conditions is added or revised."
      tone="spr"
    >
      <Table
        caption="Retained baseline model contents"
        captionActions={editable
          ? <EditButton
              label="Edit baseline model"
              onClick={() => setBaselineOpen(true)}
            />
          : undefined}
        headers={["Model content", "Controlled records", "Seismic treatment"]}
        minWidth={0}
        columnWidths={["25%", "45%", "30%"]}
        className="stable--wrapheads stable--step09"
      >
        {baselineRows.map((row) =>
          <tr key={row.label}>
            <td className="stable__key"><strong>{row.label}</strong></td>
            <td>
              {row.records.length === 0
                ? "No records"
                : row.records.join(", ")}
            </td>
            <td>{row.treatment}</td>
          </tr>)}
      </Table>

      <Table
        caption="Seismic logic additions"
        captionActions={editable
          ? <AddButton
              label="Add logic change"
              onClick={() => createRecord(
                "New seismic logic change",
                "Define the changed model and its verification.",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "newSeismicLogic",
                ],
                logicFields,
              )}
            />
          : undefined}
        headers={[
          "Logic change",
          "Model type",
          "Baseline model",
          "Added records",
          "Verification",
        ]}
        minWidth={0}
        columnWidths={["25%", "16%", "20%", "24%", "15%"]}
        className="stable--wrapheads stable--step09"
      >
        {model.newSeismicLogic.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No seismic logic change"
              detail="Add only the event-sequence, success-criteria, system, data, or human-action logic that differs from the baseline PRA."
            /></td></tr>
          : model.newSeismicLogic.map((logic, index) =>
            <tr
              className="postable__row--clickable"
              key={logic.uuid}
              onClick={() => openRecord(
                logic.name,
                displayLabel(logic.logicType),
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "newSeismicLogic",
                  index,
                ],
                logicFields,
                "Remove logic change",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Reason for ${logic.name}`}
                  detail={<>
                    {logic.reasonNeeded} {logic.verificationAndValidation}
                  </>}
                >
                  {logic.name}
                </EntryName>
                <code>{logic.uuid}</code>
              </td>
              <td>{displayLabel(logic.logicType)}</td>
              <td>{logic.baseInternalEventsModelRef ?? "New seismic model"}</td>
              <td>
                {logic.modelRefs.length} records
                <code>{logic.modelRefs.join(", ")}</code>
              </td>
              <td>
                <Tag tone={logic.verificationAndValidation.trim().length > 0
                  ? "good"
                  : "bad"}>
                  {logic.verificationAndValidation.trim().length > 0
                    ? "Checked"
                    : "Open"}
                </Tag>
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Seismic mission times"
        captionActions={editable
          ? <AddButton
              label="Add mission time"
              onClick={() => createRecord(
                "New seismic mission time",
                "Define the sequence, success criterion, duration, and access.",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "missionTimeAssessments",
                ],
                missionFields,
              )}
            />
          : undefined}
        headers={[
          "Assessment",
          "Event sequence",
          "Success criterion",
          "Mission time",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["26%", "22%", "23%", "14%", "15%"]}
        className="stable--wrapheads stable--step09"
      >
        {model.missionTimeAssessments.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No seismic mission time"
              detail="Confirm that earthquake damage, access, staffing, aftershocks, and available resources do not invalidate the credited mission time."
            /></td></tr>
          : model.missionTimeAssessments.map((mission, index) =>
            <tr
              className="postable__row--clickable"
              key={mission.uuid}
              onClick={() => openRecord(
                mission.name,
                mission.successCriteriaRef,
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "missionTimeAssessments",
                  index,
                ],
                missionFields,
                "Remove mission time",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Mission-time decision for ${mission.name}`}
                  detail={<>Access: {mission.sustainedAccessibilityImpact} Emergency
                    response: {mission.emergencyResponseCapabilityImpact}
                    Seismic conditions: {mission.seismicEnvironmentDuration}
                    Decision: {mission.basis}</>}
                >
                  {mission.name}
                </EntryName>
                <code>{mission.uuid}</code>
              </td>
              <td>{mission.eventSequenceRef}</td>
              <td>{mission.successCriteriaRef}</td>
              <td>{mission.revisedMissionTimeHours
                ?? mission.assumedMissionTimeHours} hours</td>
              <td>
                <Tag tone={mission.missionTimeValid ? "good" : "bad"}>
                  {mission.missionTimeValid ? "Valid" : "Revise"}
                </Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Seismic failure logic"
      description="This section connects each retained SSC fragility to a systems-model basic event. The basic event tells the PRA what function is lost, which sequences use that failure, and which failures must be treated as correlated or causally dependent."
      tone="spr"
    >
      <Table
        caption="Seismic basic events"
        captionActions={editable
          ? <AddButton
              label="Add seismic basic event"
              onClick={() => createRecord(
                "New seismic basic event",
                "Connect an SSC failure and fragility to the systems model.",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "inducedFailures",
                ],
                failureFields,
              )}
            />
          : undefined}
        headers={[
          "Basic event",
          "SSC and failure mode",
          "Fragility",
          "Sequences",
          "Dependencies",
        ]}
        minWidth={0}
        columnWidths={["21%", "27%", "22%", "15%", "15%"]}
        className="stable--wrapheads stable--step09"
      >
        {model.inducedFailures.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No seismic basic event"
              detail="Connect every retained fragility to the system or event-sequence logic that uses the SSC failure."
            /></td></tr>
          : model.inducedFailures.map((failure, index) =>
            <tr
              className="postable__row--clickable"
              key={failure.uuid}
              onClick={() => openRecord(
                failure.name,
                failure.systemsBasicEventRef,
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "inducedFailures",
                  index,
                ],
                failureFields,
                "Remove seismic basic event",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Model treatment for ${failure.name}`}
                  detail={<>
                    {failure.failureEffect} {failure.modelImplementation}
                  </>}
                >
                  {failure.systemsBasicEventRef}
                </EntryName>
                <code>{failure.uuid}</code>
              </td>
              <td>
                {equipmentName(failure.sscRef)}
                <code>{failure.systemsFailureModeRef}</code>
              </td>
              <td>{fragilityName(failure.fragilityEvaluationRef)}</td>
              <td>{failure.eventSequenceRefs.join(", ")}</td>
              <td>
                {failure.correlationGroupRefs.length === 0
                  ? "Independent"
                  : failure.correlationGroupRefs.join(", ")}
                <code>{failure.causalDependencyRefs.join(", ")
                  || "No causal dependency"}</code>
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Contact-chatter treatment"
        captionActions={editable
          ? <AddButton
              label="Add chatter treatment"
              onClick={() => createRecord(
                "New contact-chatter treatment",
                "Define the relay, affected logic, and modeled effect.",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "contactChatterModels",
                ],
                chatterFields,
              )}
            />
          : undefined}
        headers={[
          "Device",
          "Chatter effect",
          "Affected SSCs",
          "Systems logic",
          "Disposition",
        ]}
        minWidth={0}
        columnWidths={["25%", "17%", "23%", "22%", "13%"]}
        className="stable--wrapheads stable--step09"
      >
        {model.contactChatterModels.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No contact-chatter treatment"
              detail="Evaluate relay and similar-device chatter where it can cause unavailability or spurious actuation."
            /></td></tr>
          : model.contactChatterModels.map((chatter, index) =>
            <tr
              className="postable__row--clickable"
              key={chatter.uuid}
              onClick={() => openRecord(
                chatter.name,
                displayLabel(chatter.chatterEffect),
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "contactChatterModels",
                  index,
                ],
                chatterFields,
                "Remove chatter treatment",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Chatter decision for ${chatter.name}`}
                  detail={chatter.exclusionByDesignBasis}
                >
                  {equipmentName(chatter.deviceSscRef)}
                </EntryName>
                <code>{fragilityName(chatter.fragilityEvaluationRef)}</code>
              </td>
              <td>{displayLabel(chatter.chatterEffect)}</td>
              <td>{chatter.affectedSscRefs.map(equipmentName).join(", ")}</td>
              <td>{chatter.systemsLogicRefs.join(", ")}</td>
              <td>
                <Tag tone={chatter.riskSignificant ? "warn" : "good"}>
                  {chatter.riskSignificant ? "Modeled" : "Screened"}
                </Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Retained secondary hazards"
      description="A retained secondary hazard is an earthquake-caused condition that needs its own plant-response path. This section keeps its initiating event, affected SSCs, fragilities, and event-sequence logic connected as one model."
      tone="spr"
    >
      <Table
        caption="Secondary-hazard plant models"
        captionActions={editable
          ? <AddButton
              label="Add retained hazard"
              onClick={() => createRecord(
                "New retained secondary hazard",
                "Connect the hazard to its initiator, SSCs, fragilities, and logic.",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "retainedHazardModels",
                ],
                hazardFields,
              )}
            />
          : undefined}
        headers={[
          "Retained hazard",
          "Initiating events",
          "Affected SSCs",
          "Fragilities",
          "Plant-response logic",
        ]}
        minWidth={0}
        columnWidths={["24%", "18%", "23%", "18%", "17%"]}
        className="stable--wrapheads stable--step09"
      >
        {model.retainedHazardModels.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No retained secondary hazard"
              detail="Add only earthquake-caused fire, flood, ground-failure, or other hazards retained after screening."
            /></td></tr>
          : model.retainedHazardModels.map((hazard, index) =>
            <tr
              className="postable__row--clickable"
              key={hazard.uuid}
              onClick={() => openRecord(
                hazard.name,
                displayLabel(hazard.hazardType),
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "retainedHazardModels",
                  index,
                ],
                hazardFields,
                "Remove retained hazard",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Integration method for ${hazard.name}`}
                  detail={hazard.integrationBasis}
                >
                  {hazard.name}
                </EntryName>
                <code>{hazard.hazardAnalysisRef}</code>
              </td>
              <td>{hazard.initiatingEventRefs.join(", ")}</td>
              <td>{hazard.affectedSscRefs.map(equipmentName).join(", ")}</td>
              <td>{hazard.fragilityRefs.map(fragilityName).join(", ")}</td>
              <td>{hazard.plantResponseModelRefs.join(", ")}</td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Sequence outcome mapping"
      description="This section tells the model where each seismic sequence ends. Every sequence is assigned to an event-sequence family and a release category so Step 11 can calculate frequencies without changing the model boundary."
      tone="spr"
    >
      <Table
        caption="Event-sequence family mapping"
        captionActions={editable
          ? <AddButton
              label="Add outcome mapping"
              onClick={() => createRecord(
                "New sequence outcome mapping",
                "Connect initiators and sequences to a family and release category.",
                [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "eventSequenceFamilyQuantifications",
                ],
                outcomeFields,
              )}
            />
          : undefined}
        headers={[
          "Event-sequence family",
          "Initiating events",
          "Member sequences",
          "Release category",
          "Source term",
        ]}
        minWidth={0}
        columnWidths={["24%", "22%", "22%", "18%", "14%"]}
        className="stable--wrapheads stable--step09"
      >
        {outcomeMappings.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No sequence outcome mapping"
              detail="Assign each retained seismic sequence to one event-sequence family and release category before quantification."
            /></td></tr>
          : outcomeMappings.map((mapping, index) =>
            <tr
              className="postable__row--clickable"
              key={mapping.uuid}
              onClick={() => openRecord(
                mapping.name,
                mapping.eventSequenceFamilyRef,
                [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "eventSequenceFamilyQuantifications",
                  index,
                ],
                outcomeFields,
                "Remove outcome mapping",
              )}
            >
              <td className="stable__key">
                <strong>{mapping.name}</strong>
                <code>{mapping.eventSequenceFamilyRef}</code>
              </td>
              <td>{mapping.initiatingEventRefs.join(", ")}</td>
              <td>{mapping.eventSequenceRefs.join(", ")}</td>
              <td>{mapping.releaseCategoryRef ?? "No release category"}</td>
              <td>{mapping.sourceTermRef ?? "No release"}</td>
            </tr>)}
      </Table>

      <Table
        caption="Model reconciliation"
        captionActions={editable
          ? <AddButton
              label="Add model finding"
              onClick={() => createRecord(
                "New model finding",
                "Record the source finding, seismic effect, resolution, and evidence.",
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "peerReviewFindingResolutions",
                ],
                findingFields,
              )}
            />
          : undefined}
        headers={[
          "Finding",
          "Source model",
          "Resolution status",
          "Model records",
          "Evidence",
        ]}
        minWidth={0}
        columnWidths={["24%", "22%", "15%", "22%", "17%"]}
        className="stable--wrapheads stable--step09"
      >
        {model.peerReviewFindingResolutions.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No model reconciliation"
              detail="Resolve baseline PRA findings that could be amplified by correlated seismic failures or shared dependencies."
            /></td></tr>
          : model.peerReviewFindingResolutions.map((finding, index) =>
            <tr
              className="postable__row--clickable"
              key={finding.uuid}
              onClick={() => openRecord(
                finding.name,
                finding.findingRef,
                [
                  "seismicPlantResponseAnalysis",
                  "plantResponseModel",
                  "peerReviewFindingResolutions",
                  index,
                ],
                findingFields,
                "Remove model finding",
              )}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Resolution for ${finding.name}`}
                  detail={<>
                    {finding.relevanceToSeismicPra}{" "}
                    {finding.potentialAmplificationInSeismicModel}{" "}
                    {finding.resolution}
                  </>}
                >
                  {finding.name}
                </EntryName>
                <code>{finding.findingRef}</code>
              </td>
              <td>
                {finding.sourcePraElement}
                <code>{finding.sourcePeerReviewRef}</code>
              </td>
              <td>
                <Tag tone={finding.resolutionStatus === "RESOLVED"
                  ? "good"
                  : finding.resolutionStatus === "OPEN" ? "bad" : "neutral"}>
                  {displayLabel(finding.resolutionStatus)}
                </Tag>
              </td>
              <td>{finding.incorporatedModelRefs.join(", ")}</td>
              <td>{finding.evidenceRefs.join(", ")}</td>
            </tr>)}
      </Table>
    </Section>

    {identificationOpen
      && <MefEditor
        tone="spr"
        title="Initiating-event identification"
        subtitle="Define the scope, experience review, retention method, and completeness check."
        focus={[
          "seismicPlantResponseAnalysis",
          "initiatingEventIdentification",
        ]}
        visibleRootFields={[
          "systematicProcess",
          "plantOperatingStateRefs",
          "industryExperienceSources",
          "multiReactorAndMultiSourceEvaluation",
          "completenessReview",
          "riskSignificanceEvaluationMethod",
          "retainedInitiatingEventRefs",
        ]}
        inlinePrimitiveArrays
        onClose={() => setIdentificationOpen(false)}
      />}
    {baselineOpen
      && <MefEditor
        tone="spr"
        title="Baseline plant model"
        subtitle="Define the retained baseline records and the seismic model changes."
        focus={[
          "seismicPlantResponseAnalysis",
          "plantResponseModel",
        ]}
        visibleRootFields={[
          "baseInternalEventsModelRefs",
          "baseNonSeismicHazardModelRefs",
          "eventSequenceRefs",
          "systemsLogicModelRefs",
          "nonSeismicFailureRefs",
          "unavailabilityRefs",
          "humanErrorRefs",
          "plantOperatingStateRefs",
          "radioactiveMaterialSourceRefs",
          "modificationsFromBaseModel",
          "completenessAndConsistencyReview",
        ]}
        inlinePrimitiveArrays
        onClose={() => setBaselineOpen(false)}
      />}
    <CollectionEditor
      tone="spr"
      target={recordEditor}
      onClose={() => setRecordEditor(null)}
    />
  </>;
}

function PlantModelScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const initiators = mef.seismicPlantResponseAnalysis.initiatingEventIdentification;
  const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
  const equipment = mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.equipment;
  const fragilities = mef.seismicFragilityAnalysis.results.fragilityEvaluations;
  const all = [
    ...initiators.directInitiators.map((item, collectionIndex) => ({
      item,
      collectionIndex,
      collection: "directInitiators" as const,
    })),
    ...initiators.secondaryHazardInitiators.map((item, collectionIndex) => ({
      item,
      collectionIndex,
      collection: "secondaryHazardInitiators" as const,
    })),
  ];
  const [initiatorBasisOpen, setInitiatorBasisOpen] = useState(false);
  const [modelBasisOpen, setModelBasisOpen] = useState(false);
  const [recordEditor, setRecordEditor] = useState<CollectionEditorTarget | null>(null);
  const initiatorFields = [
    "name", "origin", "description", "plantOperatingStateRefs",
    "reactorUnitRefs", "radioactiveMaterialSourceRefs",
    "directGroundMotionFailureRefs", "secondaryHazardRef",
    "industryExperienceRefs", "internalEventsInitiatingEventRef",
    "combinedEventComponents", "automaticOrManualTrip", "affectedSscRefs",
    "eventSequenceRefs", "riskSignificant", "screeningOrSubsumingBasis",
    "retained",
  ];
  const failureFields = [
    "name", "sscRef", "seismicEquipmentListEntryRef",
    "systemsFailureModeRef", "fragilityEvaluationRef", "systemsBasicEventRef",
    "failureEffect", "correlationGroupRefs", "causalDependencyRefs",
    "eventSequenceRefs", "modelImplementation",
  ];
  const thresholdFields = [
    "name", "groundMotionParameterRef", "controlPointRef",
    "thresholdCapacity", "capacityUnits", "hazardCurveRef",
    "cumulativeSscCount", "correlationAndGroupingBasis",
    "integratedAnnualFrequency", "screeningCriterion", "criterionLimit",
    "satisfiesCriterion", "eventSequenceFamilyApplicability",
    "finalModelConfirmation", "sensitivityStudyRefs",
  ];
  const chatterFields = [
    "name", "deviceSscRef", "fragilityEvaluationRef", "affectedSscRefs",
    "chatterEffect", "systemsLogicRefs", "riskSignificant",
    "exclusionByDesignBasis",
  ];
  const logicFields = [
    "name", "logicType", "reasonNeeded", "baseInternalEventsModelRef",
    "modelRefs", "verificationAndValidation",
  ];
  const missionFields = [
    "name", "eventSequenceRef", "successCriteriaRef",
    "assumedMissionTimeHours", "sustainedAccessibilityImpact",
    "emergencyResponseCapabilityImpact", "seismicEnvironmentDuration",
    "missionTimeValid", "revisedMissionTimeHours",
    "basis",
  ];
  const findingFields = [
    "name", "sourcePraElement", "sourcePeerReviewRef", "findingRef",
    "relevanceToSeismicPra", "potentialAmplificationInSeismicModel",
    "resolutionStatus", "resolution", "incorporatedModelRefs", "evidenceRefs",
  ];
  const hazardFields = [
    "name", "hazardType", "hazardAnalysisRef", "initiatingEventRefs",
    "sourceSscRefs", "affectedSscRefs", "fragilityRefs",
    "plantResponseModelRefs", "integrationBasis",
  ];
  const multiUnitFields = [
    "name", "applicable", "reactorUnitRefs", "sharedSscRefs",
    "sharedHazardAndDependencyDescription", "concurrentInitiatingEventRefs",
    "multiUnitEventSequenceRefs", "sharedHumanActionRefs",
    "sharedRadioactiveSourceRefs", "modelImplementation", "exclusionBasis",
  ];
  function equipmentName(reference: string): string {
    return equipment.find((item) => item.uuid === reference)?.name ?? reference;
  }
  function fragilityName(reference: string): string {
    return fragilities.find((item) => item.uuid === reference)?.name ?? reference;
  }
  function openRecord(
    title: string,
    subtitle: string,
    focus: EditorPath,
    visibleRootFields: string[],
    removeLabel: string,
  ): void {
    setRecordEditor({
      title,
      subtitle,
      focus,
      visibleRootFields,
      inlinePrimitiveArrays: true,
      removeLabel,
    });
  }
  function createRecord(
    title: string,
    subtitle: string,
    createAt: EditorPath,
    visibleRootFields: string[],
  ): void {
    setRecordEditor({
      title,
      subtitle,
      focus: [],
      createAt,
      visibleRootFields,
      inlinePrimitiveArrays: true,
    });
  }
  return <>
    <Section eyebrow="SPR · HLR-A" title="Initiating events" description="Direct and secondary events evaluated for the plant model." tone="spr" actions={editable ? <div className="sstep10actions">
      <AddButton label="Add direct event" onClick={() => createRecord("New direct initiating event", "Ground-motion trigger, scope, affected SSCs, and model links", ["seismicPlantResponseAnalysis", "initiatingEventIdentification", "directInitiators"], initiatorFields)} />
      <AddButton label="Add secondary event" onClick={() => createRecord("New secondary-hazard event", "Hazard trigger, screening basis, affected SSCs, and model links", ["seismicPlantResponseAnalysis", "initiatingEventIdentification", "secondaryHazardInitiators"], initiatorFields)} />
    </div> : undefined}>
      <SectionEditorRow title="Identification basis" description="Operating states, radioactive sources, experience, and retention method." onClick={() => setInitiatorBasisOpen(true)} />
      {all.length === 0
        ? <EmptyState title="No initiating events" detail="Identify direct ground-motion and secondary-hazard events for each in-scope state." />
        : <Table caption="Initiating-event register" headers={["Initiating event", "Trigger", "Plant scope", "Model links", "Disposition", ""]} minWidth={0} columnWidths={["24%", "17%", "20%", "17%", "17%", "5%"]} className="stable--wrapheads stable--technical">
          {all.map(({ item, collection, collectionIndex }) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => openRecord(item.name, displayLabel(item.origin), ["seismicPlantResponseAnalysis", "initiatingEventIdentification", collection, collectionIndex], initiatorFields, "Remove initiating event")}>
            <td className="stable__key"><strong>{item.name}</strong><code>{item.uuid}</code></td>
            <td><strong>{displayLabel(item.origin)}</strong><code>{item.secondaryHazardRef ?? item.directGroundMotionFailureRefs?.join(", ") ?? "Ground-motion review"}</code></td>
            <td><strong>{item.plantOperatingStateRefs.join(", ")}</strong><code>{item.radioactiveMaterialSourceRefs.join(", ")} · {item.reactorUnitRefs.length} {item.reactorUnitRefs.length === 1 ? "unit" : "units"}</code></td>
            <td><strong>{item.eventSequenceRefs.length} sequences</strong><code>{item.affectedSscRefs.length} affected SSCs</code></td>
            <td><Tag tone={item.retained ? "warn" : "good"}>{item.retained ? "Retained" : "Screened"}</Tag><code>{item.riskSignificant ? "Risk-significant" : "Below retention criterion"}</code></td>
            <td className="srowopen"><POSIcon.ArrowR /></td>
          </tr>)}
        </Table>}
    </Section>

    <Section eyebrow="SPR · HLR-B" title="Seismic failure treatment" description="Failures, thresholds, and relay chatter used by the systems model." tone="spr" actions={editable ? <div className="sstep10actions">
      <AddButton label="Add failure" onClick={() => createRecord("New seismic failure", "Failure mode, fragility, dependency, basic event, and sequence links", ["seismicPlantResponseAnalysis", "plantResponseModel", "inducedFailures"], failureFields)} />
      <AddButton label="Add threshold" onClick={() => createRecord("New fragility threshold", "Motion capacity, cumulative scope, hazard integration, and confirmation", ["seismicPlantResponseAnalysis", "plantResponseModel", "fragilityThresholds"], thresholdFields)} />
      <AddButton label="Add chatter model" onClick={() => createRecord("New contact-chatter model", "Device fragility, system effect, affected SSCs, and disposition", ["seismicPlantResponseAnalysis", "plantResponseModel", "contactChatterModels"], chatterFields)} />
    </div> : undefined}>
      {model.inducedFailures.length === 0
        ? <EmptyState title="No modeled seismic failures" detail="Link active SEL failure modes and fragilities to systems basic events." />
        : <Table caption="Modeled seismic failures" headers={["Basic event", "SSC failure", "Fragility", "Dependencies", "Sequences", ""]} minWidth={0} columnWidths={["17%", "24%", "20%", "19%", "15%", "5%"]} className="stable--wrapheads stable--technical">
          {model.inducedFailures.map((failure, index) => <tr className="postable__row--clickable" key={failure.uuid} onClick={() => openRecord(failure.name, failure.systemsBasicEventRef, ["seismicPlantResponseAnalysis", "plantResponseModel", "inducedFailures", index], failureFields, "Remove modeled failure")}>
            <td className="stable__key"><strong>{failure.systemsBasicEventRef}</strong><code>{failure.uuid}</code></td>
            <td><strong>{equipmentName(failure.sscRef)}</strong><code>{failure.systemsFailureModeRef}</code></td>
            <td><strong>{fragilityName(failure.fragilityEvaluationRef)}</strong><code>{failure.fragilityEvaluationRef}</code></td>
            <td><strong>{failure.correlationGroupRefs.join(", ") || "Independent"}</strong><code>{failure.causalDependencyRefs.join(", ") || "No causal dependency"}</code></td>
            <td>{failure.eventSequenceRefs.join(", ")}</td>
            <td className="srowopen"><POSIcon.ArrowR /></td>
          </tr>)}
        </Table>}
      {model.fragilityThresholds.length > 0 && <Table caption="Fragility thresholds" headers={["Threshold", "Capacity", "Cumulative treatment", "Integrated frequency", "Decision", ""]} minWidth={0} columnWidths={["22%", "16%", "29%", "15%", "13%", "5%"]} className="stable--wrapheads stable--technical">
        {model.fragilityThresholds.map((threshold, index) => <tr className="postable__row--clickable" key={threshold.uuid} onClick={() => openRecord(threshold.name, `${threshold.screeningCriterion} plant-model threshold`, ["seismicPlantResponseAnalysis", "plantResponseModel", "fragilityThresholds", index], thresholdFields, "Remove threshold")}>
          <td className="stable__key"><strong>{threshold.name}</strong><code>{threshold.groundMotionParameterRef}</code></td>
          <td><strong>{threshold.thresholdCapacity} {threshold.capacityUnits}</strong><code>{threshold.controlPointRef}</code></td>
          <td>{threshold.correlationAndGroupingBasis}<code>{threshold.cumulativeSscCount} SSCs</code></td>
          <td><strong className="smono">{threshold.integratedAnnualFrequency.toExponential(2)}/yr</strong><code>Limit {threshold.criterionLimit.toExponential(1)}/yr</code></td>
          <td><Tag tone={threshold.satisfiesCriterion ? "good" : "bad"}>{threshold.satisfiesCriterion ? "Pass" : "Retain"}</Tag><code>{threshold.screeningCriterion}</code></td>
          <td className="srowopen"><POSIcon.ArrowR /></td>
        </tr>)}
      </Table>}
      {model.contactChatterModels.length > 0 && <Table caption="Contact chatter" headers={["Device", "Fragility", "System effect", "Affected logic", "Disposition", ""]} minWidth={0} columnWidths={["22%", "21%", "18%", "21%", "13%", "5%"]} className="stable--wrapheads stable--technical">
        {model.contactChatterModels.map((chatter, index) => <tr className="postable__row--clickable" key={chatter.uuid} onClick={() => openRecord(chatter.name, "Relay or similar-device chatter treatment", ["seismicPlantResponseAnalysis", "plantResponseModel", "contactChatterModels", index], chatterFields, "Remove chatter model")}>
          <td className="stable__key"><strong>{equipmentName(chatter.deviceSscRef)}</strong><code>{chatter.deviceSscRef}</code></td>
          <td><strong>{fragilityName(chatter.fragilityEvaluationRef)}</strong><code>{chatter.fragilityEvaluationRef}</code></td>
          <td>{displayLabel(chatter.chatterEffect)}</td>
          <td><strong>{chatter.systemsLogicRefs.join(", ")}</strong><code>{chatter.affectedSscRefs.length} affected SSCs</code></td>
          <td><Tag tone={chatter.riskSignificant ? "warn" : "good"}>{chatter.riskSignificant ? "Modeled" : "Screened"}</Tag></td>
          <td className="srowopen"><POSIcon.ArrowR /></td>
        </tr>)}
      </Table>}
    </Section>

    <Section eyebrow="Internal events → seismic model" title="Adapted plant logic" description="New logic and mission times added to the internal-events base." tone="spr" actions={editable ? <div className="sstep10actions">
      <AddButton label="Add logic" onClick={() => createRecord("New seismic logic", "Reason, base model, model records, and verification", ["seismicPlantResponseAnalysis", "plantResponseModel", "newSeismicLogic"], logicFields)} />
      <AddButton label="Add mission time" onClick={() => createRecord("New mission-time assessment", "Sequence, success criterion, duration, access, response, and basis", ["seismicPlantResponseAnalysis", "plantResponseModel", "missionTimeAssessments"], missionFields)} />
    </div> : undefined}>
      <SectionEditorRow title="Base-model basis" description="Source models, failures, unavailabilities, human errors, states, and sources." onClick={() => setModelBasisOpen(true)} />
      {model.newSeismicLogic.length === 0
        ? <EmptyState title="No seismic logic changes" detail="Record new event-sequence, systems, success-criteria, data, and human-action logic." />
        : <Table caption="New seismic logic" headers={["Logic", "Type", "Base model", "Model records", "Requirement groups", ""]} minWidth={0} columnWidths={["25%", "15%", "20%", "20%", "15%", "5%"]} className="stable--wrapheads stable--technical">
          {model.newSeismicLogic.map((logic, index) => <tr className="postable__row--clickable" key={logic.uuid} onClick={() => openRecord(logic.name, displayLabel(logic.logicType), ["seismicPlantResponseAnalysis", "plantResponseModel", "newSeismicLogic", index], logicFields, "Remove seismic logic")}>
            <td className="stable__key"><strong>{logic.name}</strong><code>{logic.uuid}</code></td>
            <td>{displayLabel(logic.logicType)}</td>
            <td>{logic.baseInternalEventsModelRef ?? "New seismic model"}</td>
            <td><strong>{logic.modelRefs.length} linked records</strong><code>{logic.modelRefs.join(", ")}</code></td>
            <td>{logic.requirementCompliance.map((item) => item.requirementGroup).join(", ")}</td>
            <td className="srowopen"><POSIcon.ArrowR /></td>
          </tr>)}
        </Table>}
      {model.missionTimeAssessments.length > 0 && <Table caption="Mission-time assessments" headers={["Assessment", "Event sequence", "Success criterion", "Mission", "Decision", ""]} minWidth={0} columnWidths={["26%", "22%", "22%", "12%", "13%", "5%"]} className="stable--wrapheads stable--technical">
        {model.missionTimeAssessments.map((mission, index) => <tr className="postable__row--clickable" key={mission.uuid} onClick={() => openRecord(mission.name, "Seismic success-criteria mission time", ["seismicPlantResponseAnalysis", "plantResponseModel", "missionTimeAssessments", index], missionFields, "Remove mission-time assessment")}>
          <td className="stable__key"><strong>{mission.name}</strong><code>{mission.uuid}</code></td>
          <td>{mission.eventSequenceRef}</td>
          <td>{mission.successCriteriaRef}</td>
          <td><strong>{mission.assumedMissionTimeHours} hours</strong></td>
          <td><Tag tone={mission.missionTimeValid ? "good" : "bad"}>{mission.missionTimeValid ? "Valid" : "Revise"}</Tag></td>
          <td className="srowopen"><POSIcon.ArrowR /></td>
        </tr>)}
      </Table>}
    </Section>

    <Section eyebrow="Plant-model controls" title="Integration controls" description="Peer-review resolutions, retained hazards, and multi-unit effects." tone="spr" actions={editable ? <div className="sstep10actions">
      <AddButton label="Add finding" onClick={() => createRecord("New peer-review resolution", "Source finding, seismic relevance, resolution, model links, and evidence", ["seismicPlantResponseAnalysis", "plantResponseModel", "peerReviewFindingResolutions"], findingFields)} />
      <AddButton label="Add retained hazard" onClick={() => createRecord("New retained secondary-hazard model", "Hazard, initiating events, sources, fragilities, and model links", ["seismicPlantResponseAnalysis", "plantResponseModel", "retainedHazardModels"], hazardFields)} />
      <AddButton label="Add multi-unit model" onClick={() => createRecord("New multi-reactor impact model", "Units, shared SSCs, events, sources, actions, and implementation", ["seismicPlantResponseAnalysis", "plantResponseModel", "multiReactorModels"], multiUnitFields)} />
    </div> : undefined}>
      {model.peerReviewFindingResolutions.length > 0 && <Table caption="Peer-review finding resolutions" headers={["Finding", "Source", "Seismic effect", "Disposition", "Model records", ""]} minWidth={0} columnWidths={["20%", "19%", "27%", "13%", "16%", "5%"]} className="stable--wrapheads stable--technical">
        {model.peerReviewFindingResolutions.map((finding, index) => <tr className="postable__row--clickable" key={finding.uuid} onClick={() => openRecord(finding.name, finding.findingRef, ["seismicPlantResponseAnalysis", "plantResponseModel", "peerReviewFindingResolutions", index], findingFields, "Remove finding resolution")}>
          <td className="stable__key"><strong>{finding.name}</strong><code>{finding.findingRef}</code></td>
          <td><strong>{finding.sourcePraElement}</strong><code>{finding.sourcePeerReviewRef}</code></td>
          <td>{finding.potentialAmplificationInSeismicModel}</td>
          <td><Tag tone={finding.resolutionStatus === "RESOLVED" ? "good" : finding.resolutionStatus === "OPEN" ? "bad" : "neutral"}>{displayLabel(finding.resolutionStatus)}</Tag></td>
          <td><strong>{finding.incorporatedModelRefs.length} linked</strong><code>{finding.incorporatedModelRefs.join(", ")}</code></td>
          <td className="srowopen"><POSIcon.ArrowR /></td>
        </tr>)}
      </Table>}
      {model.retainedHazardModels.length > 0 && <Table caption="Retained secondary hazards" headers={["Hazard", "Initiating events", "Affected SSCs", "Fragilities", "Plant model", ""]} minWidth={0} columnWidths={["23%", "18%", "18%", "18%", "18%", "5%"]} className="stable--wrapheads stable--technical">
        {model.retainedHazardModels.map((hazard, index) => <tr className="postable__row--clickable" key={hazard.uuid} onClick={() => openRecord(hazard.name, displayLabel(hazard.hazardType), ["seismicPlantResponseAnalysis", "plantResponseModel", "retainedHazardModels", index], hazardFields, "Remove retained hazard")}>
          <td className="stable__key"><strong>{hazard.name}</strong><code>{hazard.hazardAnalysisRef}</code></td>
          <td>{hazard.initiatingEventRefs.join(", ")}</td>
          <td><strong>{hazard.affectedSscRefs.map(equipmentName).join(", ")}</strong><code>{hazard.sourceSscRefs.length} source SSCs</code></td>
          <td>{hazard.fragilityRefs.map(fragilityName).join(", ")}</td>
          <td>{hazard.plantResponseModelRefs.join(", ")}</td>
          <td className="srowopen"><POSIcon.ArrowR /></td>
        </tr>)}
      </Table>}
      {model.multiReactorModels.length > 0 && <Table caption="Multi-unit and multi-source effects" headers={["Model", "Units and sources", "Shared SSCs", "Concurrent sequences", "Disposition", ""]} minWidth={0} columnWidths={["24%", "22%", "18%", "18%", "13%", "5%"]} className="stable--wrapheads stable--technical">
        {model.multiReactorModels.map((multiUnit, index) => <tr className="postable__row--clickable" key={multiUnit.uuid} onClick={() => openRecord(multiUnit.name, multiUnit.applicable ? "Multi-reactor model" : "Applicability evaluation", ["seismicPlantResponseAnalysis", "plantResponseModel", "multiReactorModels", index], multiUnitFields, "Remove multi-unit model")}>
          <td className="stable__key"><strong>{multiUnit.name}</strong><code>{multiUnit.uuid}</code></td>
          <td><strong>{multiUnit.reactorUnitRefs.join(", ")}</strong><code>{multiUnit.sharedRadioactiveSourceRefs.join(", ")}</code></td>
          <td>{multiUnit.sharedSscRefs.length === 0 ? "None" : multiUnit.sharedSscRefs.map(equipmentName).join(", ")}</td>
          <td><strong>{multiUnit.concurrentInitiatingEventRefs.length} initiators</strong><code>{multiUnit.multiUnitEventSequenceRefs.join(", ") || "No multi-unit sequence"}</code></td>
          <td><Tag tone={multiUnit.applicable ? "warn" : "neutral"}>{multiUnit.applicable ? "Modeled" : "Not applicable"}</Tag></td>
          <td className="srowopen"><POSIcon.ArrowR /></td>
        </tr>)}
      </Table>}
    </Section>
    {initiatorBasisOpen && <MefEditor tone="spr" title="Initiating-event basis" subtitle="Operating states, radioactive sources, experience, retention, and completeness" focus={["seismicPlantResponseAnalysis", "initiatingEventIdentification"]} visibleRootFields={["systematicProcess", "plantOperatingStateRefs", "industryExperienceSources", "multiReactorAndMultiSourceEvaluation", "completenessReview", "riskSignificanceEvaluationMethod", "retainedInitiatingEventRefs"]} inlinePrimitiveArrays onClose={() => setInitiatorBasisOpen(false)} />}
    {modelBasisOpen && <MefEditor tone="spr" title="Plant-model basis" subtitle="Base models, non-seismic events, states, sources, modifications, and review" focus={["seismicPlantResponseAnalysis", "plantResponseModel"]} visibleRootFields={["baseInternalEventsModelRefs", "baseNonSeismicHazardModelRefs", "eventSequenceRefs", "systemsLogicModelRefs", "nonSeismicFailureRefs", "unavailabilityRefs", "humanErrorRefs", "plantOperatingStateRefs", "radioactiveMaterialSourceRefs", "modificationsFromBaseModel", "completenessAndConsistencyReview"]} inlinePrimitiveArrays onClose={() => setModelBasisOpen(false)} />}
    <CollectionEditor tone="spr" target={recordEditor} onClose={() => setRecordEditor(null)} />
  </>;
}

function HumanReliabilityScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const hra = mef.seismicPlantResponseAnalysis.humanReliabilityModel;
  const [methodOpen, setMethodOpen] = useState(false);
  const [actionEditor, setActionEditor] =
    useState<CollectionEditorTarget | null>(null);
  const actionFields = [
    "name",
    "humanFailureEventRef",
    "sourceInternalEventsHfeRef",
    "recoveryAction",
    "eventSequenceRefs",
    "controlRoomOrExControlRoom",
    "availableTime",
    "requiredTime",
    "timeUnits",
    "humanErrorProbability",
    "probabilityDistribution",
    "dependencyRefs",
    "seismicSpecificChallenges",
    "feasibilityBasis",
    "humanReliabilityAnalysisRef",
  ];

  function openAction(index: number): void {
    const action = hra.humanActions[index]!;
    setActionEditor({
      title: action.name,
      subtitle: action.humanFailureEventRef,
      focus: [
        "seismicPlantResponseAnalysis",
        "humanReliabilityModel",
        "humanActions",
        index,
      ],
      visibleRootFields: actionFields,
      inlinePrimitiveArrays: true,
      inlineObjectFields: [
        "seismicSpecificChallenges",
        "probabilityDistribution",
      ],
      removeLabel: "Remove human action",
    });
  }

  function createAction(): void {
    setActionEditor({
      title: "New seismic human action",
      subtitle:
        "Define the sequence context, seismic conditions, feasibility, HEP, and dependence.",
      focus: [],
      createAt: [
        "seismicPlantResponseAnalysis",
        "humanReliabilityModel",
        "humanActions",
      ],
      visibleRootFields: actionFields,
      inlinePrimitiveArrays: true,
      inlineObjectFields: [
        "seismicSpecificChallenges",
        "probabilityDistribution",
      ],
    });
  }

  function actionName(reference: string): string {
    return hra.humanActions.find((action) =>
      action.humanFailureEventRef === reference)?.name ?? reference;
  }

  function distributionLabel(
    action: typeof hra.humanActions[number],
  ): string {
    const distribution = action.probabilityDistribution;
    if (distribution === undefined) return "Point estimate";
    if (distribution.type === "lognormal") {
      return `Lognormal, EF ${distribution.errorFactor}`;
    }
    return displayLabel(distribution.type);
  }

  function conditionComplete(...values: string[]): boolean {
    return values.every((value) => value.trim().length > 0);
  }

  function stopRowClick(event: { stopPropagation: () => void }): void {
    event.stopPropagation();
  }

  return <>
    <Section
      title="Human action scope"
      description="This section identifies the human actions used by the seismic plant model. It shows whether each action comes from the baseline PRA or is new for seismic conditions, where it is performed, which event sequences use it, and whether it is a response or recovery action."
      tone="spr"
    >
      <Table
        caption="HFE register"
        captionActions={editable ? <>
          <EditButton
            label="Edit HRA method"
            onClick={() => setMethodOpen(true)}
          />
          <AddButton label="Add human action" onClick={createAction} />
        </> : undefined}
        headers={[
          "Human action",
          "Source",
          "Event sequences",
          "Location",
          "Credit",
        ]}
        minWidth={0}
        columnWidths={["28%", "18%", "25%", "16%", "13%"]}
        className="stable--wrapheads stable--step10"
      >
      {hra.humanActions.length === 0
        ? <tr><td colSpan={5}><TechnicalEmptyState
            title="No seismic human action"
            detail="Identify relevant baseline HFEs and any new seismic-specific response or recovery action."
          /></td></tr>
        : hra.humanActions.map((action, index) =>
          <tr
            className="postable__row--clickable"
            key={action.uuid}
            onClick={() => openAction(index)}
          >
            <td className="stable__key">
              <strong>{action.name}</strong>
              <code>{action.humanFailureEventRef}</code>
            </td>
            <td>
              {action.sourceInternalEventsHfeRef === undefined
                ? "New seismic HFE"
                : "Adapted baseline HFE"}
              {action.sourceInternalEventsHfeRef !== undefined
                && <code>{action.sourceInternalEventsHfeRef}</code>}
            </td>
            <td>{action.eventSequenceRefs.join(", ")}</td>
            <td>{displayLabel(action.controlRoomOrExControlRoom)}</td>
            <td>
              <Tag tone={action.recoveryAction ? "warn" : "neutral"}>
                {action.recoveryAction ? "Recovery" : "Response"}
              </Tag>
            </td>
          </tr>)}
      </Table>
    </Section>

    <Section
      title="Seismic performance conditions"
      description="Earthquake damage can change what operators see, how they diagnose the event, how much work and stress they face, whether communications and job aids remain available, and whether a field route is safe. This section confirms that those conditions were evaluated for every credited action."
      tone="spr"
    >
      <Table
        caption="Human-performance conditions"
        headers={[
          "Human action",
          "Training and procedures",
          "Cues, job aids, and communications",
          "Workload and mitigation",
          "Access and physical hazards",
        ]}
        minWidth={0}
        columnWidths={["25%", "17%", "20%", "18%", "20%"]}
        className="stable--wrapheads stable--step10"
      >
      {hra.humanActions.length === 0
        ? <tr><td colSpan={5}><TechnicalEmptyState
            title="No performance-condition evaluation"
            detail="Add a seismic human action before evaluating its cues, workload, communication, access, and physical hazards."
          /></td></tr>
        : hra.humanActions.map((action, index) => {
          const challenges = action.seismicSpecificChallenges;
          const procedureReady = conditionComplete(
            challenges.trainingAndProcedures,
          );
          const aidsReady = conditionComplete(
            challenges.jobAidsAndTraining,
          );
          const workloadReady = conditionComplete(
            challenges.workloadAndStress,
            challenges.mitigationImpact,
          );
          const accessReady = conditionComplete(
            challenges.timingAndAccessibility,
            challenges.physicalHazards,
          );
          return <tr
            className="postable__row--clickable"
            key={action.uuid}
            onClick={() => openAction(index)}
          >
            <td className="stable__key">
              <EntryName
                detailLabel={`Seismic performance conditions for ${action.name}`}
                detail={<>Training and procedures: {
                  challenges.trainingAndProcedures
                } Cues and communications: {
                  challenges.jobAidsAndTraining
                } Workload and stress: {
                  challenges.workloadAndStress
                } Mitigation: {challenges.mitigationImpact} Access and timing: {
                  challenges.timingAndAccessibility
                } Physical hazards: {challenges.physicalHazards}</>}
              >
                {action.name}
              </EntryName>
              <code>{action.humanFailureEventRef}</code>
            </td>
            <td>
              <Tag tone={procedureReady ? "good" : "bad"}>
                {procedureReady ? "Defined" : "Open"}
              </Tag>
            </td>
            <td>
              <Tag tone={aidsReady ? "good" : "bad"}>
                {aidsReady ? "Evaluated" : "Open"}
              </Tag>
              <code>{displayLabel(action.controlRoomOrExControlRoom)}</code>
            </td>
            <td>
              <Tag tone={workloadReady ? "good" : "bad"}>
                {workloadReady ? "Evaluated" : "Open"}
              </Tag>
            </td>
            <td>
              <Tag tone={accessReady ? "good" : "bad"}>
                {accessReady ? "Evaluated" : "Open"}
              </Tag>
            </td>
          </tr>;
        })}
      </Table>
    </Section>

    <Section
      title="Timing and feasibility"
      description="Available time is how long the plant can wait before the action becomes ineffective. Required time is how long the crew needs to diagnose and complete it. The action is feasible only when the required time, access, equipment, staffing, and environmental conditions fit inside the available window."
      tone="spr"
    >
      <Table
        caption="Action timing"
        headers={[
          "Human action",
          "Available time",
          "Required time",
          "Time margin",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["32%", "15%", "15%", "16%", "22%"]}
        className="stable--wrapheads stable--step10"
      >
      {hra.humanActions.length === 0
        ? <tr><td colSpan={5}><TechnicalEmptyState
            title="No action timing"
            detail="Define the available and required time for each credited human action."
          /></td></tr>
        : hra.humanActions.map((action, index) => {
          const margin = action.availableTime - action.requiredTime;
          const feasible = margin > 0
            && action.feasibilityBasis.trim().length > 0;
          return <tr
            className="postable__row--clickable"
            key={action.uuid}
            onClick={() => openAction(index)}
          >
            <td className="stable__key">
              <EntryName
                detailLabel={`Feasibility decision for ${action.name}`}
                detail={action.feasibilityBasis}
              >
                {action.name}
              </EntryName>
              <code>{action.humanFailureEventRef}</code>
            </td>
            <td>{action.availableTime} {action.timeUnits}</td>
            <td>{action.requiredTime} {action.timeUnits}</td>
            <td>{margin} {action.timeUnits}</td>
            <td>
              <Tag tone={feasible ? "good" : "bad"}>
                {feasible ? "Feasible" : "Not feasible"}
              </Tag>
            </td>
          </tr>;
        })}
      </Table>
    </Section>

    <Section
      title="HEP, damage states, and dependence"
      description="The human error probability, or HEP, is the chance that a credited action fails when it is demanded. The central HEP and its uncertainty are applied only in the sequence and earthquake-damage states where the action remains feasible. Recovery actions and actions sharing diagnosis, crews, routes, or cues are treated as dependent."
      tone="spr"
    >
      <Table
        caption="Seismic HEP models"
        headers={[
          "Human failure event",
          "HEP",
          "Uncertainty",
          "Damage-state application",
          "Recovery and dependence",
          "HRA record",
        ]}
        minWidth={0}
        columnWidths={["25%", "10%", "14%", "18%", "20%", "13%"]}
        className="stable--wrapheads stable--step10"
      >
        {hra.humanActions.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No seismic HEP"
              detail="Quantify each credited action, its uncertainty, damage-state application, recovery credit, and dependencies."
            /></td></tr>
          : hra.humanActions.map((action, index) =>
            <tr
              className="postable__row--clickable"
              key={action.uuid}
              onClick={() => openAction(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Damage-state treatment for ${action.name}`}
                  detail={<>
                    {action.seismicSpecificChallenges.mitigationImpact}{" "}
                    {hra.seismicInfluenceIntegration}
                  </>}
                >
                  {action.name}
                </EntryName>
                <code>{action.humanFailureEventRef}</code>
              </td>
              <td className="smono">
                {(action.humanErrorProbability * 100).toFixed(1)}%
                <code>{action.humanErrorProbability.toExponential(2)}</code>
              </td>
              <td>{distributionLabel(action)}</td>
              <td>
                Sequence-conditioned
                <code>{action.eventSequenceRefs.length} sequences</code>
              </td>
              <td>
                <Tag tone={action.recoveryAction ? "warn" : "neutral"}>
                  {action.recoveryAction ? "Recovery" : "Response"}
                </Tag>
                <code>{action.dependencyRefs.length === 0
                  ? "Independent in modeled sequence"
                  : action.dependencyRefs.map(actionName).join(", ")}</code>
              </td>
              <td>{action.humanReliabilityAnalysisRef}</td>
            </tr>)}
      </Table>
    </Section>

    {methodOpen
      && <MefEditor
        tone="spr"
        title="Seismic HRA method"
        subtitle="Define HFE selection, response and recovery treatment, HEP quantification, and damage-state application."
        focus={[
          "seismicPlantResponseAnalysis",
          "humanReliabilityModel",
        ]}
        visibleRootFields={[
          "relevantInternalEventsHfeRefs",
          "responseActionRequirementCompliance",
          "hfeDefinitionRequirementCompliance",
          "recoveryRequirementCompliance",
          "quantificationRequirementCompliance",
          "seismicInfluenceIntegration",
        ]}
        inlinePrimitiveArrays
        onClose={() => setMethodOpen(false)}
      />}
    <CollectionEditor
      tone="spr"
      target={actionEditor}
      onClose={() => setActionEditor(null)}
    />
  </>;
}

function QuantificationIntegrationScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const quant = mef.seismicPlantResponseAnalysis.quantification;
  const [basisOpen, setBasisOpen] = useState(false);
  const [collectionEditor, setCollectionEditor] = useState<CollectionEditorTarget | null>(null);
  const primaryDiscretization = quant.hazardDiscretizations[0];
  const familyName = (reference: string): string =>
    quant.eventSequenceFamilyQuantifications.find((family) =>
      family.eventSequenceFamilyRef === reference)?.name ?? reference;
  const firstSentence = (value: string): string =>
    value.split(/(?<=[.!?])\s/u)[0] ?? value;
  const uncertaintyBounds = (
    family: typeof quant.eventSequenceFamilyQuantifications[number],
  ): string => {
    const distribution = family.frequencyDistribution;
    if (
      distribution?.type !== "lognormal"
      || distribution.median <= 0
      || distribution.errorFactor <= 0
    ) return "Not calculated";
    return `${(distribution.median / distribution.errorFactor).toExponential(2)} to ${(distribution.median * distribution.errorFactor).toExponential(2)}`;
  };
  const studiesByUncertainty = new Map(
    quant.sensitivityStudies.flatMap((study) =>
      study.modelUncertaintyId === undefined
        ? []
        : [[study.modelUncertaintyId, study] as const]),
  );
  const esqGroups = ["ESQ-A", "ESQ-B", "ESQ-C", "ESQ-D"].map((group) => {
    const records = quant.esqRequirementCompliance.filter((record) =>
      record.requirement.startsWith(group));
    return {
      group,
      records,
      complete: records.length > 0 && records.every((record) =>
        record.status === "MET" || record.status === "NOT_APPLICABLE"),
    };
  });
  function openFamily(index: number): void {
    const family = quant.eventSequenceFamilyQuantifications[index]!;
    setCollectionEditor({
      title: family.name,
      subtitle: "Family frequency, uncertainty distribution, bin contributions, and trace links",
      focus: [
        "seismicPlantResponseAnalysis",
        "quantification",
        "eventSequenceFamilyQuantifications",
        index,
      ],
      visibleRootFields: [
        "name",
        "eventSequenceFamilyRef",
        "initiatingEventRefs",
        "eventSequenceRefs",
        "releaseCategoryRef",
        "sourceTermRef",
        "hazardDiscretizationRef",
        "meanHazardUsed",
        "meanFragilitiesUsed",
        "pointEstimateFrequency",
        "meanFrequency",
        "frequencyUnit",
        "frequencyDistribution",
        "hazardBinContributions",
        "uncertaintyContributions",
        "truncationAndScreeningTreatment",
        "quantificationMethod",
      ],
      inlinePrimitiveArrays: true,
      inlineObjectFields: ["frequencyDistribution"],
      removeLabel: "Remove family result",
    });
  }
  return <>
    <Section eyebrow="SPR · HLR-E1, E4, E5" title="Event-sequence-family results" description="Mean frequencies and propagated uncertainty per plant-year." tone="spr" actions={editable ? <AddButton label="Add family result" onClick={() => setCollectionEditor({ title: "New family result", subtitle: "Frequency, uncertainty, hazard-bin contributions, and trace links", focus: [], createAt: ["seismicPlantResponseAnalysis", "quantification", "eventSequenceFamilyQuantifications"], inlinePrimitiveArrays: true, inlineObjectFields: ["frequencyDistribution"] })} /> : undefined}>
      <SectionEditorRow title="Quantification method" description="Integrated solution, uncertainty propagation, ESQ checks, and quality controls." onClick={() => setBasisOpen(true)} />
      {quant.eventSequenceFamilyQuantifications.length === 0
        ? <EmptyState title="No quantified families" detail="Integrate hazard, fragility, systems, and HRA results for each seismic event-sequence family." />
        : <Table caption="Seismic family frequencies" headers={["Event-sequence family", "Point estimate", "Mean frequency", "5th to 95th percentile", "Release category", ""]} minWidth={0} columnWidths={["28%", "14%", "14%", "19%", "20%", "5%"]} className="stable--wrapheads stable--technical">
          {quant.eventSequenceFamilyQuantifications.map((family, index) => <tr className="postable__row--clickable" key={family.uuid} onClick={() => openFamily(index)}>
            <td className="stable__key"><strong>{family.name}</strong><code>{family.eventSequenceFamilyRef}</code></td>
            <td className="smono">{family.pointEstimateFrequency.toExponential(3)}</td>
            <td><strong className="smono">{family.meanFrequency?.toExponential(3) ?? "Not calculated"}</strong></td>
            <td className="smono">{uncertaintyBounds(family)}</td>
            <td>{family.releaseCategoryRef ?? "No release category"}<code>{family.sourceTermRef ?? "No source term"}</code></td>
            <td className="srowopen"><POSIcon.ArrowR /></td>
          </tr>)}
        </Table>}
    </Section>
    <Section eyebrow="SPR · HLR-E2, E3" title="Numerical integration" description="Hazard bins, convergence, and rare-event corrections." tone="spr" actions={editable ? <AddButton label="Add rare-event check" onClick={() => setCollectionEditor({ title: "New rare-event check", subtitle: "Approximation, overestimation mechanism, correction, and impact", focus: [], createAt: ["seismicPlantResponseAnalysis", "quantification", "rareEventApproximationAssessments"], inlinePrimitiveArrays: true })} /> : undefined}>
      {primaryDiscretization === undefined
        ? <EmptyState title="No integration mesh" detail="Define the hazard discretization and demonstrate convergence of the seismic risk results." />
        : <>
          <Table caption="Convergence" headers={["Integration mesh", "Production bins", "Confirmation bins", "Final change", "Criterion", "Result", ""]} minWidth={0} columnWidths={["27%", "13%", "15%", "13%", "13%", "14%", "5%"]} className="stable--wrapheads stable--technical">
            <tr className="postable__row--clickable" onClick={() => setCollectionEditor({ title: primaryDiscretization.name, subtitle: "Hazard bins, numerical method, refinement results, and convergence basis", focus: ["seismicPlantResponseAnalysis", "quantification", "hazardDiscretizations", 0], inlinePrimitiveArrays: true })}>
              <td className="stable__key"><strong>{primaryDiscretization.name}</strong><code>{primaryDiscretization.convergenceMetric}</code></td>
              <td>{primaryDiscretization.bins.length}</td>
              <td>{primaryDiscretization.convergenceStudies.at(-1)?.binCount ?? "Not run"}</td>
              <td>{((primaryDiscretization.convergenceStudies.at(-1)?.relativeChange ?? 0) * 100).toFixed(1)}%</td>
              <td>{(primaryDiscretization.convergenceTolerance * 100).toFixed(1)}%</td>
              <td><Tag tone={primaryDiscretization.converged ? "good" : "bad"}>{primaryDiscretization.converged ? "Converged" : "Open"}</Tag></td>
              <td className="srowopen"><POSIcon.ArrowR /></td>
            </tr>
          </Table>
          <Table caption="Hazard-bin integration" headers={["Bin", "Motion range", "Representative motion", "Annual frequency", "Aggregate contribution", ""]} minWidth={0} columnWidths={["16%", "22%", "20%", "18%", "19%", "5%"]} className="stable--wrapheads stable--technical">
            {primaryDiscretization.bins.map((bin, index) => <tr className="postable__row--clickable" key={bin.uuid} onClick={() => setCollectionEditor({ title: bin.name, subtitle: "Ground-motion interval and linked quantification records", focus: ["seismicPlantResponseAnalysis", "quantification", "hazardDiscretizations", 0, "bins", index], inlinePrimitiveArrays: true })}>
              <td className="stable__key"><strong>{bin.name}</strong><code>{bin.uuid}</code></td>
              <td>{bin.lowerGroundMotion} to {bin.upperGroundMotion} {bin.groundMotionUnits}</td>
              <td>{bin.representativeGroundMotion} {bin.groundMotionUnits}</td>
              <td className="smono">{bin.annualFrequency.toExponential(3)}</td>
              <td>{bin.contributionToRiskMetric === undefined ? "Not calculated" : `${(bin.contributionToRiskMetric * 100).toFixed(1)}%`}</td>
              <td className="srowopen"><POSIcon.ArrowR /></td>
            </tr>)}
          </Table>
        </>}
      {quant.rareEventApproximationAssessments.length > 0 && <Table caption="Rare-event corrections" headers={["Affected result", "Approximation issue", "Uncorrected", "Corrected", "Impact", ""]} minWidth={0} columnWidths={["22%", "28%", "13%", "13%", "19%", "5%"]} className="stable--wrapheads stable--technical">
        {quant.rareEventApproximationAssessments.map((assessment, index) => <tr className="postable__row--clickable" key={assessment.uuid} onClick={() => setCollectionEditor({ title: assessment.name, subtitle: "Rare-event approximation, correction method, and impact", focus: ["seismicPlantResponseAnalysis", "quantification", "rareEventApproximationAssessments", index], inlinePrimitiveArrays: true, removeLabel: "Remove rare-event check" })}>
          <td className="stable__key"><strong>{assessment.name}</strong><code>{assessment.affectedModelRef}</code></td>
          <td>{firstSentence(assessment.overestimationMechanism)}</td>
          <td className="smono">{assessment.uncorrectedResult?.toExponential(3) ?? "Not recorded"}</td>
          <td className="smono">{assessment.correctedResult?.toExponential(3) ?? "Not recorded"}</td>
          <td>{assessment.impactAssessment}</td>
          <td className="srowopen"><POSIcon.ArrowR /></td>
        </tr>)}
      </Table>}
    </Section>
    <Section eyebrow="SPR · HLR-E5 to E8" title="Uncertainty and sensitivity" description="Model alternatives and their effect on the integrated results." tone="spr" actions={editable ? <CategorizedAddButton label="Add analysis" title="Add uncertainty analysis" options={[
      { label: "Model uncertainty", description: "An assumption and reasonable alternative in the plant-response model.", title: "New model uncertainty", subtitle: "Source, assumptions, alternatives, treatment, and affected families", createAt: ["seismicPlantResponseAnalysis", "quantification", "modelUncertainties"] },
      { label: "Sensitivity study", description: "An integrated test of an important parameter or model alternative.", title: "New sensitivity study", subtitle: "Varied parameters, range, result, impact, and insight", createAt: ["seismicPlantResponseAnalysis", "quantification", "sensitivityStudies"] },
    ]} onChoose={setCollectionEditor} /> : undefined}>
      {quant.modelUncertainties.length === 0
        ? <EmptyState title="No model alternatives" detail="Identify plant-response uncertainties, assumptions, alternatives, and their integrated treatment." />
        : <Table caption="Integrated uncertainty evaluations" headers={["Uncertainty", "Reasonable alternatives", "Treatment", "Sensitivity result", "Risk insight", ""]} minWidth={0} columnWidths={["20%", "19%", "20%", "18%", "18%", "5%"]} className="stable--wrapheads stable--technical">
          {quant.modelUncertainties.map((uncertainty, index) => {
            const study = studiesByUncertainty.get(uncertainty.uuid);
            return <tr className="postable__row--clickable" key={uncertainty.uuid} onClick={() => setCollectionEditor({ title: uncertainty.name, subtitle: "Model uncertainty, assumptions, alternatives, and integrated treatment", focus: ["seismicPlantResponseAnalysis", "quantification", "modelUncertainties", index], inlinePrimitiveArrays: true, removeLabel: "Remove uncertainty" })}>
              <td className="stable__key"><strong>{uncertainty.name}</strong><code>{displayLabel(uncertainty.sourceArea)} · {displayLabel(uncertainty.uncertaintyType)}</code></td>
              <td>{uncertainty.reasonableAlternatives.join(", ")}</td>
              <td><Tag tone={uncertainty.propagated ? "good" : "neutral"}>{uncertainty.propagated ? "Propagated" : "Sensitivity"}</Tag><code>{firstSentence(uncertainty.treatment)}</code></td>
              <td>{study?.results ?? "No linked result"}</td>
              <td>{study?.insights ?? "No linked insight"}</td>
              <td className="srowopen"><POSIcon.ArrowR /></td>
            </tr>;
          })}
        </Table>}
    </Section>
    <Section eyebrow="SPR · HLR-E4, E8" title="Review and risk contributors" description="Required quantification checks and the contributors that drive the results." tone="spr" actions={editable ? <AddButton label="Add contributor" onClick={() => setCollectionEditor({ title: "New risk contributor", subtitle: "Contributor type, affected families, importance, context, and risk insight", focus: [], createAt: ["seismicPlantResponseAnalysis", "quantification", "riskSignificantContributors"], inlinePrimitiveArrays: true })} /> : undefined}>
      <Table caption="Referenced ESQ checks" headers={["Requirement group", "Applicable checks", "Not applicable", "Status"]} minWidth={0} columnWidths={["28%", "24%", "24%", "24%"]} className="stable--wrapheads stable--technical">
        {esqGroups.map(({ group, records, complete }) => <tr key={group}>
          <td className="stable__key"><strong>{group}</strong></td>
          <td>{records.filter((record) => record.applicable).length}</td>
          <td>{records.filter((record) => !record.applicable).length}</td>
          <td><Tag tone={complete ? "good" : "bad"}>{complete ? "Complete" : "Open"}</Tag></td>
        </tr>)}
      </Table>
      {quant.riskSignificantContributors.length === 0
        ? <EmptyState title="No risk contributors" detail="Review the results and identify the contributors that drive each risk-significant family." />
        : <Table caption="Risk-significant contributors" headers={["Contributor", "Type", "Affected families", "Contribution", "Risk insight", ""]} minWidth={0} columnWidths={["23%", "12%", "22%", "14%", "24%", "5%"]} className="stable--wrapheads stable--technical">
          {quant.riskSignificantContributors.map((contributor, index) => <tr className="postable__row--clickable" key={contributor.uuid} onClick={() => setCollectionEditor({ title: contributor.name, subtitle: "Contributor scope, importance, context, and risk insight", focus: ["seismicPlantResponseAnalysis", "quantification", "riskSignificantContributors", index], inlinePrimitiveArrays: true, removeLabel: "Remove contributor" })}>
            <td className="stable__key"><strong>{contributor.name}</strong><code>{contributor.contributorRef}</code></td>
            <td>{displayLabel(contributor.contributorType)}</td>
            <td>{contributor.affectedEventSequenceFamilyRefs.map(familyName).join(", ")}</td>
            <td>{contributor.contributionValue === undefined ? "Qualitative" : `${(contributor.contributionValue * 100).toFixed(1)}%`}<code>{displayLabel(contributor.importance)}</code></td>
            <td>{contributor.riskInsight}</td>
            <td className="srowopen"><POSIcon.ArrowR /></td>
          </tr>)}
        </Table>}
    </Section>
    {basisOpen && <MefEditor tone="spr" title="Quantification method" subtitle="Integrated solution, parameter uncertainty, ESQ dispositions, combined alternatives, and quality controls" focus={["seismicPlantResponseAnalysis", "quantification"]} visibleRootFields={["resultType", "integratedHazardFragilitySystemsMethod", "parameterUncertaintyPropagationMethod", "esqRequirementCompliance", "combinedAssumptionEvaluation", "outputQualityChecks"]} inlinePrimitiveArrays onClose={() => setBasisOpen(false)} />}
    <CollectionEditor tone="spr" target={collectionEditor} onClose={() => setCollectionEditor(null)} />
  </>;
}

function AnnualRiskQuantificationScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const quant = mef.seismicPlantResponseAnalysis.quantification;
  const [methodOpen, setMethodOpen] = useState(false);
  const [recordEditor, setRecordEditor] =
    useState<CollectionEditorTarget | null>(null);
  const [sensitivityIndex, setSensitivityIndex] =
    useState<number | null | undefined>(undefined);
  const mesh = quant.hazardDiscretizations[0];
  const familyFields = [
    "name",
    "eventSequenceFamilyRef",
    "initiatingEventRefs",
    "eventSequenceRefs",
    "releaseCategoryRef",
    "sourceTermRef",
    "hazardDiscretizationRef",
    "meanHazardUsed",
    "meanFragilitiesUsed",
    "pointEstimateFrequency",
    "meanFrequency",
    "frequencyUnit",
    "frequencyDistribution",
    "truncationAndScreeningTreatment",
    "quantificationMethod",
  ];
  const familiesByRef = new Map(
    quant.eventSequenceFamilyQuantifications.map((family) =>
      [family.eventSequenceFamilyRef, family] as const),
  );
  const familiesById = new Map(
    quant.eventSequenceFamilyQuantifications.map((family) =>
      [family.uuid, family] as const),
  );
  const familyName = (reference: string): string =>
    familiesByRef.get(reference)?.name ?? reference;
  const releaseCategories = useMemo(() => {
    const results = new Map<string, {
      category: string;
      familyCount: number;
      pointEstimate: number;
      meanFrequency: number;
    }>();
    for (const family of quant.eventSequenceFamilyQuantifications) {
      const category = family.releaseCategoryRef ?? "UNASSIGNED";
      const current = results.get(category) ?? {
        category,
        familyCount: 0,
        pointEstimate: 0,
        meanFrequency: 0,
      };
      current.familyCount += 1;
      current.pointEstimate += family.pointEstimateFrequency;
      current.meanFrequency +=
        family.meanFrequency ?? family.pointEstimateFrequency;
      results.set(category, current);
    }
    return [...results.values()].sort((left, right) =>
      right.meanFrequency - left.meanFrequency);
  }, [quant.eventSequenceFamilyQuantifications]);
  const totalFamilyMean = releaseCategories.reduce(
    (sum, category) => sum + category.meanFrequency,
    0,
  );

  function stopRowClick(event: { stopPropagation: () => void }): void {
    event.stopPropagation();
  }

  function uncertaintyRange(
    family: typeof quant.eventSequenceFamilyQuantifications[number],
  ): string {
    const distribution = family.frequencyDistribution;
    if (
      distribution?.type !== "lognormal"
      || distribution.median <= 0
      || distribution.errorFactor <= 0
    ) return "Not calculated";
    return `${(distribution.median / distribution.errorFactor).toExponential(2)} to ${(distribution.median * distribution.errorFactor).toExponential(2)}`;
  }

  function openFamily(index: number): void {
    const family = quant.eventSequenceFamilyQuantifications[index]!;
    setRecordEditor({
      title: family.name,
      subtitle:
        "Define the linked sequences, annual frequency, uncertainty distribution, release category, and calculation basis.",
      focus: [
        "seismicPlantResponseAnalysis",
        "quantification",
        "eventSequenceFamilyQuantifications",
        index,
      ],
      visibleRootFields: familyFields,
      inlinePrimitiveArrays: true,
      inlineObjectFields: ["frequencyDistribution"],
      removeLabel: "Remove family result",
    });
  }

  function openMesh(): void {
    if (mesh === undefined) return;
    setRecordEditor({
      title: mesh.name,
      subtitle:
        "Define the hazard curves, numerical method, convergence metric, criterion, and acceptance basis.",
      focus: [
        "seismicPlantResponseAnalysis",
        "quantification",
        "hazardDiscretizations",
        0,
      ],
      visibleRootFields: [
        "name",
        "hazardCurveRefs",
        "numericalMethod",
        "convergenceMetric",
        "convergenceTolerance",
        "converged",
        "basis",
      ],
      inlinePrimitiveArrays: true,
      removeLabel: "Remove integration mesh",
    });
  }

  return <>
    <Section
      title="Annual frequency results"
      description="This section shows how often each modeled seismic outcome is expected per plant-year. The point estimate is one central calculation. The mean and uncertainty range include sampled hazard, fragility, systems, and human-action uncertainty."
      tone="spr"
    >
      <Table
        caption="Event-sequence-family frequencies"
        captionActions={editable
          ? <>
            <EditButton
              label="Edit method"
              onClick={() => setMethodOpen(true)}
            />
            <AddButton
              label="Add family result"
              onClick={() => setRecordEditor({
                title: "New family result",
                subtitle:
                  "Define the linked sequences, annual frequency, uncertainty distribution, release category, and calculation basis.",
                focus: [],
                createAt: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "eventSequenceFamilyQuantifications",
                ],
                visibleRootFields: familyFields,
                inlinePrimitiveArrays: true,
                inlineObjectFields: ["frequencyDistribution"],
              })}
            />
          </>
          : undefined}
        headers={[
          "Event-sequence family",
          "Point estimate",
          "Mean frequency",
          "Uncertainty range",
          "Release category",
        ]}
        minWidth={0}
        columnWidths={["29%", "15%", "15%", "20%", "21%"]}
        className="stable--wrapheads stable--step11"
      >
        {quant.eventSequenceFamilyQuantifications.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No annual frequency result"
              detail="Quantify each seismic event-sequence family on a plant-year basis."
            /></td></tr>
          : quant.eventSequenceFamilyQuantifications.map((family, index) =>
            <tr
              className="postable__row--clickable"
              key={family.uuid}
              onClick={() => openFamily(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Calculation basis for ${family.name}`}
                  detail={<>
                    {family.quantificationMethod}{" "}
                    {family.truncationAndScreeningTreatment}
                  </>}
                >
                  {family.name}
                </EntryName>
                <code>{family.eventSequenceFamilyRef}</code>
              </td>
              <td className="smono">
                {family.pointEstimateFrequency.toExponential(3)}
              </td>
              <td className="smono">
                {family.meanFrequency?.toExponential(3) ?? "Not calculated"}
              </td>
              <td className="smono">{uncertaintyRange(family)}</td>
              <td>
                {family.releaseCategoryRef ?? "Unassigned"}
                <code>{family.sourceTermRef ?? "No source term"}</code>
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Release-category frequencies"
        headers={[
          "Release category",
          "Families",
          "Point estimate",
          "Mean frequency",
          "Share of total",
        ]}
        minWidth={0}
        columnWidths={["32%", "12%", "19%", "19%", "18%"]}
        className="stable--wrapheads stable--step11"
      >
        {releaseCategories.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No release-category result"
              detail="Assign each quantified family to a release category."
            /></td></tr>
          : releaseCategories.map((category) =>
            <tr key={category.category}>
              <td className="stable__key">
                <strong>{category.category}</strong>
              </td>
              <td>{category.familyCount}</td>
              <td className="smono">
                {category.pointEstimate.toExponential(3)}
              </td>
              <td className="smono">
                {category.meanFrequency.toExponential(3)}
              </td>
              <td>{totalFamilyMean <= 0
                ? "Not calculated"
                : `${(category.meanFrequency / totalFamilyMean * 100).toFixed(1)}%`}</td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Hazard integration"
      description="The hazard curve is divided into non-overlapping ground-motion intervals. For each interval, the calculation multiplies its annual frequency by the conditional probability of the modeled outcome, then adds the interval results: annual family frequency = sum of interval frequency x conditional outcome probability."
      tone="spr"
    >
      {mesh === undefined
        ? <TechnicalEmptyState
            title="No integration mesh"
            detail="Define the hazard intervals and convergence method used by the annual-risk calculation."
          />
        : <>
          <Table
            caption="Integration mesh"
            captionActions={editable
              ? <EditButton label="Edit mesh" onClick={openMesh} />
              : undefined}
            headers={[
              "Integration mesh",
              "Hazard curves",
              "Production intervals",
              "Confirmation intervals",
              "Criterion",
              "Decision",
            ]}
            minWidth={0}
            columnWidths={["28%", "17%", "14%", "15%", "12%", "14%"]}
            className="stable--wrapheads stable--step11"
          >
            <tr className="postable__row--clickable" onClick={openMesh}>
              <td className="stable__key">
                <EntryName
                  detailLabel="Integration-mesh basis"
                  detail={<>{mesh.numericalMethod} {mesh.basis}</>}
                >
                  {mesh.name}
                </EntryName>
                <code>{mesh.convergenceMetric}</code>
              </td>
              <td>{mesh.hazardCurveRefs.join(", ")}</td>
              <td>{mesh.bins.length}</td>
              <td>{mesh.convergenceStudies.at(-1)?.binCount ?? "Not run"}</td>
              <td>{(mesh.convergenceTolerance * 100).toFixed(1)}%</td>
              <td>
                <Tag tone={mesh.converged ? "good" : "bad"}>
                  {mesh.converged ? "Converged" : "Open"}
                </Tag>
              </td>
            </tr>
          </Table>

          <Table
            caption="Hazard intervals"
            captionActions={editable
              ? <AddButton
                  label="Add hazard interval"
                  onClick={() => setRecordEditor({
                    title: "New hazard interval",
                    subtitle:
                      "Define the ground-motion range, representative motion, annual frequency, and linked fragility and family records.",
                    focus: [],
                    createAt: [
                      "seismicPlantResponseAnalysis",
                      "quantification",
                      "hazardDiscretizations",
                      0,
                      "bins",
                    ],
                    inlinePrimitiveArrays: true,
                  })}
                />
              : undefined}
            headers={[
              "Interval",
              "Motion range",
              "Representative motion",
              "Annual frequency",
              "Release-frequency share",
            ]}
            minWidth={0}
            columnWidths={["21%", "22%", "21%", "18%", "18%"]}
            className="stable--wrapheads stable--step11"
          >
            {mesh.bins.map((bin, index) =>
              <tr
                className="postable__row--clickable"
                key={bin.uuid}
                onClick={() => setRecordEditor({
                  title: bin.name,
                  subtitle:
                    "Define the ground-motion range, representative motion, annual frequency, and linked fragility and family records.",
                  focus: [
                    "seismicPlantResponseAnalysis",
                    "quantification",
                    "hazardDiscretizations",
                    0,
                    "bins",
                    index,
                  ],
                  inlinePrimitiveArrays: true,
                  removeLabel: "Remove hazard interval",
                })}
              >
                <td className="stable__key">
                  <strong>{bin.name}</strong>
                  <code>{bin.uuid}</code>
                </td>
                <td>
                  {bin.lowerGroundMotion} to {bin.upperGroundMotion}{" "}
                  {bin.groundMotionUnits}
                </td>
                <td>
                  {bin.representativeGroundMotion} {bin.groundMotionUnits}
                </td>
                <td className="smono">
                  {bin.annualFrequency.toExponential(3)}
                </td>
                <td>{bin.contributionToRiskMetric === undefined
                  ? "Not calculated"
                  : `${(bin.contributionToRiskMetric * 100).toFixed(1)}%`}</td>
              </tr>)}
          </Table>

          <Table
            caption="Convergence runs"
            captionActions={editable
              ? <AddButton
                  label="Add convergence run"
                  onClick={() => setRecordEditor({
                    title: "New convergence run",
                    subtitle:
                      "Record the interval count, calculated risk metric, and change from the preceding run.",
                    focus: [],
                    createAt: [
                      "seismicPlantResponseAnalysis",
                      "quantification",
                      "hazardDiscretizations",
                      0,
                      "convergenceStudies",
                    ],
                  })}
                />
              : undefined}
            headers={[
              "Run",
              "Intervals",
              "Release-family frequency",
              "Change",
              "Criterion",
              "Decision",
            ]}
            minWidth={0}
            columnWidths={["16%", "13%", "24%", "16%", "15%", "16%"]}
            className="stable--wrapheads stable--step11"
          >
            {mesh.convergenceStudies.map((study, index) => {
              const accepted =
                study.relativeChange <= mesh.convergenceTolerance;
              return <tr
                className="postable__row--clickable"
                key={`${study.binCount}-${index}`}
                onClick={() => setRecordEditor({
                  title: `Convergence run ${index + 1}`,
                  subtitle:
                    "Record the interval count, calculated risk metric, and change from the preceding run.",
                  focus: [
                    "seismicPlantResponseAnalysis",
                    "quantification",
                    "hazardDiscretizations",
                    0,
                    "convergenceStudies",
                    index,
                  ],
                  removeLabel: "Remove convergence run",
                })}
              >
                <td className="stable__key">
                  <strong>Run {index + 1}</strong>
                </td>
                <td>{study.binCount}</td>
                <td className="smono">
                  {study.metricValue.toExponential(3)}
                </td>
                <td>{(study.relativeChange * 100).toFixed(1)}%</td>
                <td>{(mesh.convergenceTolerance * 100).toFixed(1)}%</td>
                <td>
                  <Tag tone={accepted ? "good" : "warn"}>
                    {accepted ? "Accepted" : "Refine"}
                  </Tag>
                </td>
              </tr>;
            })}
          </Table>
        </>}

      <Table
        caption="Rare-event corrections"
        captionActions={editable
          ? <AddButton
              label="Add rare-event check"
              onClick={() => setRecordEditor({
                title: "New rare-event check",
                subtitle:
                  "Define the approximation issue, affected fragilities, corrected solution, and calculated impact.",
                focus: [],
                createAt: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "rareEventApproximationAssessments",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          : undefined}
        headers={[
          "Check",
          "Affected result",
          "Uncorrected",
          "Corrected",
          "Reduction",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["26%", "20%", "14%", "14%", "12%", "14%"]}
        className="stable--wrapheads stable--step11"
      >
        {quant.rareEventApproximationAssessments.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No rare-event check"
              detail="Check where conditional failures approach one or cutsets overlap."
            /></td></tr>
          : quant.rareEventApproximationAssessments.map((assessment, index) => {
            const uncorrected = assessment.uncorrectedResult;
            const corrected = assessment.correctedResult;
            const reduction = uncorrected === undefined
              || corrected === undefined
              || uncorrected === 0
              ? undefined
              : (uncorrected - corrected) / uncorrected;
            return <tr
              className="postable__row--clickable"
              key={assessment.uuid}
              onClick={() => setRecordEditor({
                title: assessment.name,
                subtitle:
                  "Define the approximation issue, affected fragilities, corrected solution, and calculated impact.",
                focus: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "rareEventApproximationAssessments",
                  index,
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove rare-event check",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Correction basis for ${assessment.name}`}
                  detail={<>
                    {assessment.overestimationMechanism}{" "}
                    {assessment.correctionMethod}{" "}
                    {assessment.impactAssessment}
                  </>}
                >
                  {assessment.name}
                </EntryName>
                <code>{assessment.approximationMethod}</code>
              </td>
              <td>
                {familiesById.get(assessment.affectedModelRef)?.name
                  ?? assessment.affectedModelRef}
              </td>
              <td className="smono">
                {uncorrected?.toExponential(3) ?? "Not recorded"}
              </td>
              <td className="smono">
                {corrected?.toExponential(3) ?? "Not recorded"}
              </td>
              <td>{reduction === undefined
                ? "Not calculated"
                : `${(reduction * 100).toFixed(1)}%`}</td>
              <td>
                <Tag tone={corrected === undefined ? "bad" : "good"}>
                  {corrected === undefined ? "Open" : "Corrected"}
                </Tag>
              </td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Uncertainty and sensitivity"
      description="This section tests whether uncertain hazard, site-response, fragility, systems, human-action, numerical, and pre-operational assumptions could change the calculated frequencies or the decisions drawn from them."
      tone="spr"
    >
      <Table
        caption="Model and parameter uncertainty"
        captionActions={<>
          <InfoButton label="About combined uncertainty evaluation">
            {quant.combinedAssumptionEvaluation}
          </InfoButton>
          {editable
            && <AddButton
              label="Add uncertainty"
              onClick={() => setRecordEditor({
                title: "New uncertainty",
                subtitle:
                  "Define the source, affected records, assumptions, alternatives, treatment, and importance.",
                focus: [],
                createAt: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "modelUncertainties",
                ],
                inlinePrimitiveArrays: true,
              })}
            />}
        </>}
        headers={[
          "Uncertainty",
          "Source and type",
          "Affected families",
          "Treatment",
          "Importance",
        ]}
        minWidth={0}
        columnWidths={["30%", "20%", "17%", "18%", "15%"]}
        className="stable--wrapheads stable--step11"
      >
        {quant.modelUncertainties.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No uncertainty evaluation"
              detail="Identify important uncertainties and define how each is propagated or tested."
            /></td></tr>
          : quant.modelUncertainties.map((uncertainty, index) =>
            <tr
              className="postable__row--clickable"
              key={uncertainty.uuid}
              onClick={() => setRecordEditor({
                title: uncertainty.name,
                subtitle:
                  "Define the source, affected records, assumptions, alternatives, treatment, and importance.",
                focus: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "modelUncertainties",
                  index,
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove uncertainty",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Evaluation basis for ${uncertainty.name}`}
                  detail={<>
                    {uncertainty.description} Related assumptions: {
                      uncertainty.relatedAssumptions.join(", ")
                    }. Reasonable alternatives: {
                      uncertainty.reasonableAlternatives.join(", ")
                    }. {uncertainty.treatment}
                  </>}
                >
                  {uncertainty.name}
                </EntryName>
              </td>
              <td>
                {displayLabel(uncertainty.sourceArea)}
                <code>{displayLabel(uncertainty.uncertaintyType)}</code>
              </td>
              <td>{uncertainty.affectedEventSequenceFamilyRefs.length}</td>
              <td>
                <Tag tone={uncertainty.propagated ? "good" : "neutral"}>
                  {uncertainty.propagated ? "Propagated" : "Sensitivity"}
                </Tag>
              </td>
              <td>{uncertainty.importance === undefined
                ? "Not assigned"
                : displayLabel(uncertainty.importance)}</td>
            </tr>)}
      </Table>

      <Table
        caption="Sensitivity studies"
        captionActions={editable
          ? <AddButton
              label="Add sensitivity study"
              onClick={() => setSensitivityIndex(null)}
            />
          : undefined}
        headers={[
          "Study",
          "Varied parameters",
          "Range",
          "Calculated effect",
          "Impact",
        ]}
        minWidth={0}
        columnWidths={["25%", "18%", "18%", "24%", "15%"]}
        className="stable--wrapheads stable--step11"
      >
        {quant.sensitivityStudies.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No sensitivity study"
              detail="Test alternatives that could change annual frequency or contributor ranking."
            /></td></tr>
          : quant.sensitivityStudies.map((study, index) =>
            <tr
              className="postable__row--clickable"
              key={study.uuid}
              onClick={() => setSensitivityIndex(index)}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Decision basis for ${
                    study.name ?? `sensitivity ${index + 1}`
                  }`}
                  detail={<>{study.description} {study.insights}</>}
                >
                  {study.name ?? `Sensitivity ${index + 1}`}
                </EntryName>
              </td>
              <td>
                {study.variedParameters.map(displayParameter).join(", ")}
              </td>
              <td><code>{parameterRangeText(study.parameterRanges)}</code></td>
              <td>{study.results ?? "Not calculated"}</td>
              <td>{study.impact ?? "Not assessed"}</td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Cutsets and contributors"
      description="This section identifies the combinations of failures that matter most and the individual hazard intervals, SSCs, basic events, human actions, initiators, and event-sequence families that drive the annual results."
      tone="spr"
    >
      <Table
        caption="Significant cutsets"
        captionActions={editable
          ? <AddButton
              label="Add cutset"
              onClick={() => setRecordEditor({
                title: "New significant cutset",
                subtitle:
                  "Define the linked family, sequence, initiating event, dominant hazard interval, failure combination, frequency, contribution, and review decision.",
                focus: [],
                createAt: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "significantCutsets",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          : undefined}
        headers={[
          "Cutset",
          "Event-sequence family",
          "Dominant interval",
          "Mean frequency",
          "Family contribution",
          "Review",
        ]}
        minWidth={0}
        columnWidths={["27%", "20%", "15%", "14%", "13%", "11%"]}
        className="stable--wrapheads stable--step11"
      >
        {quant.significantCutsets.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No significant cutset"
              detail="Retain and review the failure combinations that materially contribute to risk."
            /></td></tr>
          : quant.significantCutsets.map((cutset, index) =>
            <tr
              className="postable__row--clickable"
              key={cutset.uuid}
              onClick={() => setRecordEditor({
                title: cutset.name,
                subtitle:
                  "Define the linked family, sequence, initiating event, dominant hazard interval, failure combination, frequency, contribution, and review decision.",
                focus: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "significantCutsets",
                  index,
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove cutset",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Review basis for ${cutset.name}`}
                  detail={cutset.reviewBasis}
                >
                  {cutset.name}
                </EntryName>
                <code>{cutset.basicEventRefs.join(", ")}</code>
                {cutset.humanFailureEventRefs.length > 0
                  && <code>{cutset.humanFailureEventRefs.join(", ")}</code>}
              </td>
              <td>{familyName(cutset.eventSequenceFamilyRef)}</td>
              <td>{cutset.dominantHazardBinRef}</td>
              <td className="smono">
                {cutset.meanFrequency.toExponential(3)}
              </td>
              <td>{(cutset.contributionFraction * 100).toFixed(1)}%</td>
              <td>
                <Tag tone={cutset.reviewStatus === "VERIFIED" ? "good" : "bad"}>
                  {displayLabel(cutset.reviewStatus)}
                </Tag>
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Risk-significant contributors"
        captionActions={editable
          ? <AddButton
              label="Add contributor"
              onClick={() => setRecordEditor({
                title: "New risk contributor",
                subtitle:
                  "Define the contributor, affected families, calculated contribution, importance, plant context, and risk decision.",
                focus: [],
                createAt: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "riskSignificantContributors",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          : undefined}
        headers={[
          "Contributor",
          "Type",
          "Affected families",
          "Contribution",
          "Importance",
        ]}
        minWidth={0}
        columnWidths={["31%", "17%", "17%", "18%", "17%"]}
        className="stable--wrapheads stable--step11"
      >
        {quant.riskSignificantContributors.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No risk-significant contributor"
              detail="Identify the records that drive the annual results."
            /></td></tr>
          : quant.riskSignificantContributors.map((contributor, index) =>
            <tr
              className="postable__row--clickable"
              key={contributor.uuid}
              onClick={() => setRecordEditor({
                title: contributor.name,
                subtitle:
                  "Define the contributor, affected families, calculated contribution, importance, plant context, and risk decision.",
                focus: [
                  "seismicPlantResponseAnalysis",
                  "quantification",
                  "riskSignificantContributors",
                  index,
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove contributor",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Risk insight for ${contributor.name}`}
                  detail={<>
                    {contributor.designOperationMaintenanceContext}{" "}
                    {contributor.riskInsight}
                  </>}
                >
                  {contributor.name}
                </EntryName>
                <code>{contributor.contributorRef}</code>
              </td>
              <td>{displayLabel(contributor.contributorType)}</td>
              <td>{contributor.affectedEventSequenceFamilyRefs.length}</td>
              <td>{contributor.contributionValue === undefined
                ? "Qualitative"
                : `${(contributor.contributionValue * 100).toFixed(1)}%`}</td>
              <td>{displayLabel(contributor.importance)}</td>
            </tr>)}
      </Table>
    </Section>

    {methodOpen
      && <MefEditor
        tone="spr"
        title="Annual-risk quantification method"
        subtitle="Define the integrated hazard, fragility, plant-model, uncertainty, and numerical quality-control method."
        focus={[
          "seismicPlantResponseAnalysis",
          "quantification",
        ]}
        visibleRootFields={[
          "resultType",
          "integratedHazardFragilitySystemsMethod",
          "parameterUncertaintyPropagationMethod",
          "combinedAssumptionEvaluation",
          "outputQualityChecks",
        ]}
        inlinePrimitiveArrays
        onClose={() => setMethodOpen(false)}
      />}
    <CollectionEditor
      tone="spr"
      target={recordEditor}
      onClose={() => setRecordEditor(null)}
    />
    {sensitivityIndex !== undefined
      && <QuantificationSensitivityEditor
        index={sensitivityIndex}
        onClose={() => setSensitivityIndex(undefined)}
      />}
  </>;
}

function RiskInterpretationScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const interpretation = mef.riskInterpretation;
  const quant = mef.seismicPlantResponseAnalysis.quantification;
  const mesh = quant.hazardDiscretizations[0];
  const [recordEditor, setRecordEditor] =
    useState<CollectionEditorTarget | null>(null);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const releaseFamilies = quant.eventSequenceFamilyQuantifications.filter(
    (family) => family.releaseCategoryRef !== "RC-NO-RELEASE",
  );
  const aggregateReleaseMean = releaseFamilies.reduce(
    (sum, family) =>
      sum + (family.meanFrequency ?? family.pointEstimateFrequency),
    0,
  );
  const familyByRef = new Map(
    quant.eventSequenceFamilyQuantifications.map((family) =>
      [family.eventSequenceFamilyRef, family] as const),
  );
  const contributorById = new Map(
    quant.riskSignificantContributors.map((contributor) =>
      [contributor.uuid, contributor] as const),
  );
  const uncertaintyById = new Map(
    quant.modelUncertainties.map((uncertainty) =>
      [uncertainty.uuid, uncertainty] as const),
  );
  const sensitivityById = new Map(
    quant.sensitivityStudies.map((study) => [study.uuid, study] as const),
  );
  const actionById = new Map(
    interpretation.refinementActions.map((action) =>
      [action.uuid, action] as const),
  );
  const mechanismById = new Map(
    mef.seismicFragilityAnalysis.results.failureMechanisms.map((mechanism) =>
      [mechanism.uuid, mechanism] as const),
  );
  const fragilityBySsc = new Map(
    mef.seismicFragilityAnalysis.results.fragilityEvaluations.map(
      (evaluation) => [evaluation.sscRef, evaluation] as const,
    ),
  );
  const inducedFailureByBasicEvent = new Map(
    mef.seismicPlantResponseAnalysis.plantResponseModel.inducedFailures.map(
      (failure) => [failure.systemsBasicEventRef, failure] as const,
    ),
  );
  const hazardInputs =
    mef.seismicHazardAnalysis.hazardQuantification.seismicPraInputs
      .hazardIntervals;
  const hazardInputByBinRef = new Map<string, typeof hazardInputs[number]>(
    hazardInputs.map((interval) => [`SPR-${interval.uuid}`, interval] as const),
  );
  const binContributions = new Map<string, number>();
  for (const family of releaseFamilies) {
    for (const contribution of family.hazardBinContributions) {
      binContributions.set(
        contribution.binRef,
        (binContributions.get(contribution.binRef) ?? 0)
          + contribution.frequencyContribution,
      );
    }
  }
  let cumulativeBinShare = 0;
  const dominantBins = (mesh?.bins ?? [])
    .map((bin) => {
      const frequencyContribution = binContributions.get(bin.uuid) ?? 0;
      const share = aggregateReleaseMean <= 0
        ? 0
        : frequencyContribution / aggregateReleaseMean;
      const hazardInput = hazardInputByBinRef.get(bin.uuid);
      const candidateDeaggregations =
        mef.seismicHazardAnalysis.hazardQuantification.deaggregations.filter(
          (deaggregation) =>
            hazardInput === undefined
            || deaggregation.groundMotionParameterRef
              === hazardInput.groundMotionParameterRef,
        );
      const deaggregation = candidateDeaggregations.reduce(
        (closest, current) =>
          closest === undefined
          || Math.abs(
            current.groundMotionLevel - bin.representativeGroundMotion,
          ) < Math.abs(
            closest.groundMotionLevel - bin.representativeGroundMotion,
          )
            ? current
            : closest,
        undefined as typeof candidateDeaggregations[number] | undefined,
      );
      const source = deaggregation?.sourceContributions
        .slice()
        .sort((left, right) =>
          right.contributionFraction - left.contributionFraction)[0];
      return {
        bin,
        frequencyContribution,
        share,
        deaggregation,
        source,
        cumulativeShare: 0,
      };
    })
    .filter((row) => row.frequencyContribution > 0)
    .sort((left, right) => right.share - left.share)
    .map((row) => {
      cumulativeBinShare += row.share;
      return { ...row, cumulativeShare: cumulativeBinShare };
    });
  const importanceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const contributors = quant.riskSignificantContributors
    .slice()
    .sort((left, right) =>
      importanceOrder[left.importance] - importanceOrder[right.importance]
      || (right.contributionValue ?? 0) - (left.contributionValue ?? 0));

  function familyNames(references: string[]): string {
    return references.map((reference) =>
      familyByRef.get(reference)?.name ?? reference).join(", ");
  }

  function contributorMechanism(
    contributor: typeof quant.riskSignificantContributors[number],
  ): string {
    let evaluation = fragilityBySsc.get(contributor.contributorRef);
    if (evaluation === undefined && contributor.contributorType === "BASIC_EVENT") {
      const failure =
        inducedFailureByBasicEvent.get(contributor.contributorRef);
      evaluation = failure === undefined
        ? undefined
        : fragilityBySsc.get(failure.sscRef);
    }
    if (evaluation !== undefined) {
      return mechanismById.get(evaluation.controllingMechanismRef)?.name
        ?? evaluation.controllingMechanismRef;
    }
    if (contributor.contributorType === "EVENT_SEQUENCE_FAMILY") {
      return familyByRef.get(contributor.contributorRef)?.releaseCategoryRef
        ?? "Release outcome";
    }
    if (contributor.contributorType === "HUMAN_ACTION") {
      return "Seismic human action";
    }
    if (contributor.contributorType === "HAZARD_BIN") {
      const bin = mesh?.bins.find((item) =>
        item.uuid === contributor.contributorRef);
      return bin === undefined
        ? "Ground-motion interval"
        : `${bin.lowerGroundMotion} to ${bin.upperGroundMotion} ${bin.groundMotionUnits}`;
    }
    return displayLabel(contributor.contributorType);
  }

  function driverNames(references: string[]): string {
    return references.map((reference) =>
      contributorById.get(reference)?.name
      ?? uncertaintyById.get(reference)?.name
      ?? familyByRef.get(reference)?.name
      ?? reference).join(", ");
  }

  return <>
    <Section
      title="Risk drivers"
      description="Start with the calculated results, not engineering intuition. This section shows which ground-motion ranges, seismic sources, plant failures, human actions, dependencies, and uncertainties have the most influence on annual seismic risk."
      tone="integration"
    >
      <Table
        caption="Ground-motion and source drivers"
        headers={[
          "Ground-motion interval",
          "Motion range",
          "Representative motion",
          "Release-frequency share",
          "Cumulative share",
          "Leading hazard source",
        ]}
        minWidth={0}
        columnWidths={["22%", "16%", "16%", "16%", "14%", "16%"]}
        className="stable--wrapheads stable--step12"
      >
        {dominantBins.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No ground-motion driver"
              detail="Complete the annual release-family quantification and hazard-bin contributions."
            /></td></tr>
          : dominantBins.map((row) =>
            <tr key={row.bin.uuid}>
              <td className="stable__key">
                <EntryName
                  detailLabel={`Risk basis for ${row.bin.name}`}
                  detail={<>
                    This interval contributes{" "}
                    {row.frequencyContribution.toExponential(3)} per
                    plant-year to the aggregate release-family mean.{" "}
                    {row.deaggregation === undefined
                      ? "No matching PSHA deaggregation is stored."
                      : <>The closest PSHA deaggregation is at{" "}
                        {row.deaggregation.groundMotionLevel}{" "}
                        {row.deaggregation.groundMotionUnits}, with mean
                        magnitude {row.deaggregation.meanMagnitude} and mean
                        distance {row.deaggregation.meanDistanceKm} km.</>}
                  </>}
                >
                  {row.bin.name}
                </EntryName>
              </td>
              <td>
                {row.bin.lowerGroundMotion} to {row.bin.upperGroundMotion}{" "}
                {row.bin.groundMotionUnits}
              </td>
              <td>
                {row.bin.representativeGroundMotion}{" "}
                {row.bin.groundMotionUnits}
              </td>
              <td>{(row.share * 100).toFixed(1)}%</td>
              <td>{(row.cumulativeShare * 100).toFixed(1)}%</td>
              <td>
                {row.source === undefined
                  ? "Not available"
                  : <>{row.source.contributorName}<code>
                      {(row.source.contributionFraction * 100).toFixed(0)}%
                    </code></>}
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Plant-model contributors"
        headers={[
          "Contributor",
          "Type",
          "Mechanism or scope",
          "Affected outcomes",
          "Contribution",
          "Importance",
        ]}
        minWidth={0}
        columnWidths={["25%", "13%", "20%", "18%", "13%", "11%"]}
        className="stable--wrapheads stable--step12"
      >
        {contributors.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No model contributor"
              detail="Identify the initiators, sequences, SSCs, human actions, dependencies, and outcomes that drive the annual results."
            /></td></tr>
          : contributors.map((contributor) =>
            <tr key={contributor.uuid}>
              <td className="stable__key">
                <EntryName
                  detailLabel={`Risk insight for ${contributor.name}`}
                  detail={<>
                    {contributor.designOperationMaintenanceContext}{" "}
                    {contributor.riskInsight}
                  </>}
                >
                  {contributor.name}
                </EntryName>
                <code>{contributor.contributorRef}</code>
              </td>
              <td>{displayLabel(contributor.contributorType)}</td>
              <td>{contributorMechanism(contributor)}</td>
              <td>{familyNames(
                contributor.affectedEventSequenceFamilyRefs,
              )}</td>
              <td>{contributor.contributionValue === undefined
                ? "Qualitative"
                : `${(contributor.contributionValue * 100).toFixed(1)}%`}</td>
              <td>{displayLabel(contributor.importance)}</td>
            </tr>)}
      </Table>

      <Table
        caption="Uncertainty drivers"
        headers={[
          "Uncertainty",
          "Source and type",
          "Affected outcomes",
          "Treatment",
          "Calculated effect",
          "Importance",
        ]}
        minWidth={0}
        columnWidths={["24%", "16%", "17%", "13%", "20%", "10%"]}
        className="stable--wrapheads stable--step12"
      >
        {quant.modelUncertainties.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No uncertainty driver"
              detail="Link the important model and parameter uncertainties to sensitivity results."
            /></td></tr>
          : quant.modelUncertainties.map((uncertainty) => {
            const sensitivity = uncertainty.sensitivityStudyRefs
              .map((reference) => sensitivityById.get(reference))
              .find((study) => study !== undefined);
            return <tr key={uncertainty.uuid}>
              <td className="stable__key">
                <EntryName
                  detailLabel={`Evaluation basis for ${uncertainty.name}`}
                  detail={<>
                    {uncertainty.description} Related assumptions:{" "}
                    {uncertainty.relatedAssumptions.join(", ")}. Reasonable
                    alternatives:{" "}
                    {uncertainty.reasonableAlternatives.join(", ")}.{" "}
                    {uncertainty.treatment}
                  </>}
                >
                  {uncertainty.name}
                </EntryName>
              </td>
              <td>
                {displayLabel(uncertainty.sourceArea)}
                <code>{displayLabel(uncertainty.uncertaintyType)}</code>
              </td>
              <td>{familyNames(
                uncertainty.affectedEventSequenceFamilyRefs,
              )}</td>
              <td>
                <Tag tone={uncertainty.propagated ? "good" : "neutral"}>
                  {uncertainty.propagated ? "Propagated" : "Sensitivity"}
                </Tag>
              </td>
              <td>{sensitivity?.results ?? "Not calculated"}</td>
              <td>{uncertainty.importance === undefined
                ? "Not assigned"
                : displayLabel(uncertainty.importance)}</td>
            </tr>;
          })}
      </Table>
    </Section>

    <Section
      title="Model refinements"
      description="A refinement is a specific technical change made because an important contributor or uncertainty can be represented more realistically. Every change must identify its driver, affected records, evidence, requantification run, result, and decision."
      tone="integration"
    >
      <Table
        caption="Targeted refinement actions"
        captionActions={editable
          ? <AddButton
              label="Add refinement"
              onClick={() => setRecordEditor({
                title: "New model refinement",
                subtitle:
                  "Define one targeted technical change, its driver, evidence, expected effect, requantification run, result, and decision.",
                focus: [],
                createAt: ["riskInterpretation", "refinementActions"],
                visibleRootFields: [
                  "name",
                  "technicalArea",
                  "driverRefs",
                  "affectedRecordRefs",
                  "refinement",
                  "evidenceRefs",
                  "expectedEffect",
                  "priority",
                  "status",
                  "quantificationIterationRef",
                  "result",
                  "decisionBasis",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          : undefined}
        headers={[
          "Refinement",
          "Technical area",
          "Risk driver",
          "Priority",
          "Requantification",
          "Status",
        ]}
        minWidth={0}
        columnWidths={["26%", "14%", "27%", "10%", "13%", "10%"]}
        className="stable--wrapheads stable--step12"
      >
        {interpretation.refinementActions.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No targeted refinement"
              detail="Add only a change that can improve the realism of an important risk driver."
            /></td></tr>
          : interpretation.refinementActions.map((action, index) =>
            <tr
              className="postable__row--clickable"
              key={action.uuid}
              onClick={() => setRecordEditor({
                title: action.name,
                subtitle:
                  "Define one targeted technical change, its driver, evidence, expected effect, requantification run, result, and decision.",
                focus: ["riskInterpretation", "refinementActions", index],
                visibleRootFields: [
                  "name",
                  "technicalArea",
                  "driverRefs",
                  "affectedRecordRefs",
                  "refinement",
                  "evidenceRefs",
                  "expectedEffect",
                  "priority",
                  "status",
                  "quantificationIterationRef",
                  "result",
                  "decisionBasis",
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove refinement",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Technical details for ${action.name}`}
                  detail={<>
                    {action.refinement} Expected effect:{" "}
                    {action.expectedEffect} Result: {action.result} Decision:{" "}
                    {action.decisionBasis} Affected records:{" "}
                    {action.affectedRecordRefs.join(", ")}. Evidence:{" "}
                    {action.evidenceRefs.join(", ")}.
                  </>}
                >
                  {action.name}
                </EntryName>
              </td>
              <td>{displayLabel(action.technicalArea)}</td>
              <td>{driverNames(action.driverRefs)}</td>
              <td>{displayLabel(action.priority)}</td>
              <td>{action.quantificationIterationRef ?? "Not run"}</td>
              <td>
                <Tag tone={action.status === "CLOSED"
                  ? "good"
                  : action.status === "PROPOSED"
                    ? "neutral"
                    : "warn"}>
                  {displayLabel(action.status)}
                </Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Requantification and stability"
      description="After each material refinement, rerun the full annual calculation. Stop only when the aggregate and family results change less than the stated limits, the leading contributors keep essentially the same order, and no new risk-significant contributor appears for the required number of consecutive runs."
      tone="integration"
    >
      <Table
        caption="Stopping criteria"
        captionActions={editable
          ? <EditButton
              label="Edit criteria"
              onClick={() => setCriteriaOpen(true)}
            />
          : undefined}
        headers={[
          "Aggregate change",
          "Family change",
          "Contributor rank shift",
          "Stable runs",
          "New contributors",
        ]}
        minWidth={0}
        columnWidths={["20%", "20%", "21%", "17%", "22%"]}
        className="stable--wrapheads stable--step12"
      >
        <tr>
          <td>
            ≤ {(interpretation.stoppingCriteria
              .maximumAggregateFrequencyChange * 100).toFixed(1)}%
          </td>
          <td>
            ≤ {(interpretation.stoppingCriteria
              .maximumFamilyFrequencyChange * 100).toFixed(1)}%
          </td>
          <td>
            ≤ {interpretation.stoppingCriteria.maximumContributorRankShift}{" "}
            position
          </td>
          <td>
            {interpretation.stoppingCriteria.requiredStableIterations}{" "}
            consecutive
          </td>
          <td>
            {interpretation.stoppingCriteria
              .requireNoNewRiskSignificantContributors
              ? "None allowed"
              : "Allowed with review"}
          </td>
        </tr>
      </Table>

      <Table
        caption="Requantification history"
        captionActions={editable
          ? <AddButton
              label="Add run"
              onClick={() => setRecordEditor({
                title: "New requantification run",
                subtitle:
                  "Record the controlled model version, incorporated refinements, annual result, calculated changes, contributor stability, and decision.",
                focus: [],
                createAt: [
                  "riskInterpretation",
                  "quantificationIterations",
                ],
                visibleRootFields: [
                  "name",
                  "modelVersion",
                  "calculationDate",
                  "refinementActionRefs",
                  "aggregateReleaseFamilyMeanFrequency",
                  "previousAggregateReleaseFamilyMeanFrequency",
                  "relativeChange",
                  "maximumFamilyRelativeChange",
                  "topContributorRefs",
                  "contributorRankingStable",
                  "newRiskSignificantContributorRefs",
                  "decision",
                  "basis",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          : undefined}
        headers={[
          "Run",
          "Model version",
          "Refinements",
          "Release-family mean",
          "Aggregate change",
          "Maximum family change",
          "Contributor check",
          "Decision",
        ]}
        minWidth={0}
        columnWidths={["18%", "11%", "14%", "14%", "11%", "12%", "11%", "9%"]}
        className="stable--wrapheads stable--step12"
      >
        {interpretation.quantificationIterations.length === 0
          ? <tr><td colSpan={8}><TechnicalEmptyState
              title="No requantification run"
              detail="Record the baseline run, each material refinement run, and the final stability confirmation."
            /></td></tr>
          : interpretation.quantificationIterations.map((run, index) =>
            <tr
              className="postable__row--clickable"
              key={run.uuid}
              onClick={() => setRecordEditor({
                title: run.name,
                subtitle:
                  "Record the controlled model version, incorporated refinements, annual result, calculated changes, contributor stability, and decision.",
                focus: [
                  "riskInterpretation",
                  "quantificationIterations",
                  index,
                ],
                visibleRootFields: [
                  "name",
                  "modelVersion",
                  "calculationDate",
                  "refinementActionRefs",
                  "aggregateReleaseFamilyMeanFrequency",
                  "previousAggregateReleaseFamilyMeanFrequency",
                  "relativeChange",
                  "maximumFamilyRelativeChange",
                  "topContributorRefs",
                  "contributorRankingStable",
                  "newRiskSignificantContributorRefs",
                  "decision",
                  "basis",
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove requantification run",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Decision basis for ${run.name}`}
                  detail={<>
                    {run.basis} Leading contributors:{" "}
                    {run.topContributorRefs.map((reference) =>
                      contributorById.get(reference)?.name ?? reference)
                      .join(", ")}.
                  </>}
                >
                  {run.name}
                </EntryName>
              </td>
              <td>
                {run.modelVersion}
                <code>{run.calculationDate}</code>
              </td>
              <td>{run.refinementActionRefs.length === 0
                ? "Baseline"
                : run.refinementActionRefs.map((reference) =>
                  actionById.get(reference)?.name ?? reference).join(", ")}</td>
              <td className="smono">
                {run.aggregateReleaseFamilyMeanFrequency.toExponential(3)}
              </td>
              <td>{run.relativeChange === undefined
                ? "Baseline"
                : `${(run.relativeChange * 100).toFixed(1)}%`}</td>
              <td>{run.maximumFamilyRelativeChange === undefined
                ? "Baseline"
                : `${(run.maximumFamilyRelativeChange * 100).toFixed(1)}%`}</td>
              <td>
                <Tag tone={run.contributorRankingStable
                  && run.newRiskSignificantContributorRefs.length === 0
                  ? "good"
                  : "warn"}>
                  {run.contributorRankingStable
                  && run.newRiskSignificantContributorRefs.length === 0
                    ? "Stable"
                    : run.newRiskSignificantContributorRefs.length > 0
                      ? `${run.newRiskSignificantContributorRefs.length} new`
                      : "Changing"}
                </Tag>
              </td>
              <td>
                <Tag tone={run.decision === "ACCEPT_STABLE"
                  ? "good"
                  : "warn"}>
                  {run.decision === "ACCEPT_STABLE" ? "Accept" : "Continue"}
                </Tag>
              </td>
            </tr>)}
      </Table>
    </Section>

    {criteriaOpen
      && <MefEditor
        tone="integration"
        title="Refinement stopping criteria"
        subtitle="Define the numerical and contributor-stability limits that must be met before model refinement can stop."
        focus={["riskInterpretation", "stoppingCriteria"]}
        visibleRootFields={[
          "maximumAggregateFrequencyChange",
          "maximumFamilyFrequencyChange",
          "maximumContributorRankShift",
          "requiredStableIterations",
          "requireNoNewRiskSignificantContributors",
          "basis",
        ]}
        onClose={() => setCriteriaOpen(false)}
      />}
    <CollectionEditor
      tone="integration"
      target={recordEditor}
      onClose={() => setRecordEditor(null)}
    />
  </>;
}

type QuantificationSensitivityStudy =
  SeismicPRA["seismicPlantResponseAnalysis"]["quantification"]["sensitivityStudies"][number];

function newQuantificationSensitivity(): QuantificationSensitivityStudy {
  return {
    uuid: crypto.randomUUID(),
    name: "New sensitivity study",
    description: "",
    variedParameters: [],
    parameterRanges: {},
    results: "",
    insights: "",
    impact: "",
    implementsSrs: [{ sr: "SPR-E8", hlr: "E" }],
  };
}

function QuantificationSensitivityEditor(
  { index, onClose }: { index: number | null; onClose: () => void },
): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const original = index === null
    ? newQuantificationSensitivity()
    : mef.seismicPlantResponseAnalysis.quantification.sensitivityStudies[index]!;
  const [draft, setDraft] = useState<QuantificationSensitivityStudy>(
    () => structuredClone(original),
  );
  const [ranges, setRanges] = useState(() =>
    parameterRangeText(original.parameterRanges));

  function save(): void {
    update((next) => {
      const records =
        next.seismicPlantResponseAnalysis.quantification.sensitivityStudies;
      const saved = { ...draft, parameterRanges: parseParameterRanges(ranges) };
      if (index === null) records.push(saved);
      else records[index] = saved;
    });
    onClose();
  }

  function remove(): void {
    if (index === null) return;
    update((next) => {
      next.seismicPlantResponseAnalysis.quantification.sensitivityStudies.splice(
        index,
        1,
      );
    });
    onClose();
  }

  return <Drawer
    eyebrow={EDITOR_LABELS.spr}
    title={draft.name ?? "Sensitivity study"}
    subtitle="Define the alternative, varied parameters, range, calculated effect, and resulting decision."
    plainHeader
    onClose={onClose}
    footer={<>
      {editable && index !== null
        && <button type="button" className="posnav__btn" onClick={remove}>
          Remove study
        </button>}
      <button type="button" className="posnav__btn" onClick={onClose}>
        Cancel
      </button>
      {editable
        && <button
          type="button"
          className="posnav__btn posnav__btn--primary"
          onClick={save}
        >
          Save study
        </button>}
    </>}
  >
    <fieldset className="sinlineeditor" disabled={!editable}>
      <div className="sinlineeditor__group">
        <Field label="Study">
          <TextInput
            value={draft.name ?? ""}
            onChange={(value) => setDraft((current) => ({
              ...current,
              name: value,
            }))}
          />
        </Field>
        <Field label="Alternative tested">
          <TextArea
            rows={5}
            value={draft.description}
            onChange={(value) => setDraft((current) => ({
              ...current,
              description: value,
            }))}
          />
        </Field>
        <Field label="Varied parameters" hint="One parameter per line.">
          <TextArea
            rows={5}
            value={draft.variedParameters.join("\n")}
            onChange={(value) => setDraft((current) => ({
              ...current,
              variedParameters: technicalList(value),
            }))}
          />
        </Field>
        <Field
          label="Parameter ranges"
          hint="Use one line per parameter: parameter: lower, upper"
        >
          <TextArea rows={6} value={ranges} onChange={setRanges} />
        </Field>
        <Field label="Calculated effect">
          <TextArea
            rows={5}
            value={draft.results ?? ""}
            onChange={(value) => setDraft((current) => ({
              ...current,
              results: value || undefined,
            }))}
          />
        </Field>
        <Field label="Decision">
          <TextArea
            rows={5}
            value={draft.insights ?? ""}
            onChange={(value) => setDraft((current) => ({
              ...current,
              insights: value || undefined,
            }))}
          />
        </Field>
        <Field label="Impact">
          <TextArea
            rows={4}
            value={draft.impact ?? ""}
            onChange={(value) => setDraft((current) => ({
              ...current,
              impact: value || undefined,
            }))}
          />
        </Field>
        <Field label="Linked uncertainty">
          <TextInput
            value={draft.modelUncertaintyId ?? ""}
            onChange={(value) => setDraft((current) => ({
              ...current,
              modelUncertaintyId: value || undefined,
            }))}
          />
        </Field>
      </div>
    </fieldset>
  </Drawer>;
}

interface WorkflowActions {
  submitForReview?: () => Promise<void>;
  requestRevision?: (note: string) => Promise<void>;
  postComment?: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", associatedSr?: string) => Promise<void>;
  toggleResolve?: (commentId: string, resolved: boolean) => Promise<void>;
}

function RiskIntegrationBaselineScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const [recordEditor, setRecordEditor] =
    useState<CollectionEditorTarget | null>(null);
  const integration = mef.riskIntegrationBaseline;
  const result = integration.result;
  const families = mef.seismicPlantResponseAnalysis.quantification
    .eventSequenceFamilyQuantifications;
  const diagnostics = useMemo(() => validateSeismicPra(mef), [mef]);
  const conformanceItems = useMemo(
    () => seismicConformanceItems(mef),
    [mef],
  );
  const conformanceScore = useMemo(
    () => seismicConformanceScore(conformanceItems),
    [conformanceItems],
  );
  const releaseRows = useMemo(() => {
    const grouped = new Map<string, {
      category: string;
      families: typeof families;
      pointEstimate: number;
      mean: number;
    }>();
    families.forEach((family) => {
      const category = family.releaseCategoryRef ?? "UNASSIGNED";
      if (category === "RC-NO-RELEASE") return;
      const current = grouped.get(category) ?? {
        category,
        families: [],
        pointEstimate: 0,
        mean: 0,
      };
      current.families.push(family);
      current.pointEstimate += family.pointEstimateFrequency;
      current.mean += family.meanFrequency ?? family.pointEstimateFrequency;
      grouped.set(category, current);
    });
    return [...grouped.values()].sort((left, right) =>
      right.mean - left.mean);
  }, [families]);
  const releaseTotal = releaseRows.reduce(
    (sum, row) => sum + row.mean,
    0,
  );
  const passedTraces = integration.traceabilityPaths.filter(
    (path) => path.status === "PASS",
  ).length;
  const interfaceOpen = mef.integration.unresolvedInterfaces.length;
  const validationErrors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "ERROR",
  ).length;
  const validationWarnings = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "WARNING",
  ).length;
  const checks = [
    {
      name: "Technical consistency",
      result: validationErrors === 0 ? "PASS" : "OPEN",
      findings: validationErrors === 0
        ? `${validationWarnings} warning${validationWarnings === 1 ? "" : "s"}`
        : `${validationErrors} error${validationErrors === 1 ? "" : "s"}`,
      gate: validationErrors === 0
        ? "No blocking calculation or model finding"
        : "Resolve validation errors",
    },
    {
      name: "SHA, SFR, and SPR interfaces",
      result: interfaceOpen === 0 ? "PASS" : "OPEN",
      findings: interfaceOpen === 0
        ? `${mef.integration.interfaces.length} controlled interfaces`
        : `${interfaceOpen} unresolved interface${interfaceOpen === 1 ? "" : "s"}`,
      gate: interfaceOpen === 0
        ? "Handoffs are linked"
        : "Close unresolved handoffs",
    },
    {
      name: "Bidirectional traceability",
      result: passedTraces === integration.traceabilityPaths.length
        && integration.traceabilityPaths.length > 0
        ? "PASS"
        : "OPEN",
      findings:
        `${passedTraces} of ${integration.traceabilityPaths.length} paths pass`,
      gate: passedTraces === integration.traceabilityPaths.length
        && integration.traceabilityPaths.length > 0
        ? "Evidence-to-decision paths are complete"
        : "Complete open trace paths",
    },
    {
      name: "Supporting requirements",
      result: conformanceScore.blocked === 0 ? "PASS" : "OPEN",
      findings:
        `${conformanceScore.met} of ${conformanceScore.applicable} ready`,
      gate: conformanceScore.blocked === 0
        ? `${conformanceScore.percent}% conformance`
        : `${conformanceScore.blocked} blocked requirement${conformanceScore.blocked === 1 ? "" : "s"}`,
    },
    {
      name: "Controlled baseline",
      result: integration.baseline.releaseStatus === "CONTROLLED"
        && integration.baseline.peerReviewStatus === "COMPLETE"
        && integration.baseline.approvalStatus === "APPROVED"
        ? "PASS"
        : "OPEN",
      findings: `${displayLabel(integration.baseline.peerReviewStatus)} peer review`,
      gate: `${displayLabel(integration.baseline.approvalStatus)} · ${displayLabel(integration.baseline.releaseStatus)}`,
    },
  ] as const;

  function list(values: string[]): string {
    return values.length === 0 ? "None" : values.join(", ");
  }

  function statusTone(value: string): "good" | "warn" | "neutral" {
    return value === "PASS"
      || value === "CONTROLLED"
      || value === "APPROVED"
      || value === "READY_FOR_RISK_INTEGRATION"
      || value === "ACCEPTED_BY_RISK_INTEGRATION"
      ? "good"
      : value === "OPEN"
        || value === "IN_PROGRESS"
        ? "warn"
        : "neutral";
  }

  return <>
    <Section
      title="Seismic risk package"
      description="This is the final Seismic PRA result sent to Risk Integration. It identifies the covered plant states, units, radioactive-material sources, seismic initiators, release outcomes, uncertainty, and overlap rules. Risk Integration combines this package with internal events and other hazards; this workbook does not calculate an all-hazard total."
      tone="integration"
    >
      <Table
        caption="Plant-level seismic result"
        captionActions={editable
          ? <EditButton
              label="Edit handoff"
              onClick={() => setRecordEditor({
                title: result.name,
                subtitle:
                  "Define the controlled seismic result transferred to Risk Integration.",
                focus: ["riskIntegrationBaseline", "result"],
                visibleRootFields: [
                  "name",
                  "modelVersion",
                  "plantOperatingStateRefs",
                  "unitRefs",
                  "radioactiveMaterialSourceRefs",
                  "initiatingEventRefs",
                  "eventSequenceFamilyRefs",
                  "releaseCategoryRefs",
                  "aggregateReleaseFamilyMeanFrequency",
                  "frequencyUnit",
                  "uncertaintyRange",
                  "internalEventsRiskRef",
                  "otherHazardRiskRefs",
                  "overlapTreatment",
                  "crossHazardIntegrationBasis",
                  "riskIntegrationResultRef",
                  "dominantContributorRefs",
                  "status",
                ],
                inlinePrimitiveArrays: true,
                inlineObjectFields: ["uncertaintyRange"],
              })}
            />
          : undefined}
        headers={[
          "Result",
          "POSs",
          "Units",
          "Material sources",
          "Initiators",
          "Release-family mean",
          "90% range",
          "Status",
        ]}
        minWidth={0}
        columnWidths={[
          "19%",
          "11%",
          "11%",
          "12%",
          "13%",
          "13%",
          "12%",
          "9%",
        ]}
        className="stable--wrapheads stable--step13"
      >
        <tr>
          <td className="stable__key">
            <EntryName
              detailLabel={`Technical basis for ${result.name}`}
              detail={<>
                Model {result.modelVersion}. The package contains{" "}
                {result.eventSequenceFamilyRefs.length} event-sequence
                families and {result.releaseCategoryRefs.length} release
                categories. Dominant contributors:{" "}
                {list(result.dominantContributorRefs)}.
              </>}
            >
              {result.name}
            </EntryName>
            <code>{result.uuid}</code>
          </td>
          <td>{result.plantOperatingStateRefs.length}</td>
          <td>{result.unitRefs.length}</td>
          <td>{result.radioactiveMaterialSourceRefs.length}</td>
          <td>{result.initiatingEventRefs.length}</td>
          <td>
            {result.aggregateReleaseFamilyMeanFrequency.toExponential(3)}
            <code>per plant-year</code>
          </td>
          <td>
            {result.uncertaintyRange === undefined
              ? "Not calculated"
              : <>
                {result.uncertaintyRange.lowerBound.toExponential(2)}
                {" to "}
                {result.uncertaintyRange.upperBound.toExponential(2)}
              </>}
          </td>
          <td>
            <Tag tone={statusTone(result.status)}>
              {displayLabel(result.status)}
            </Tag>
          </td>
        </tr>
      </Table>

      <Table
        caption="Release-outcome handoff"
        headers={[
          "Release category",
          "Event-sequence families",
          "Point estimate",
          "Mean frequency",
          "Share of release total",
        ]}
        minWidth={0}
        columnWidths={["22%", "34%", "15%", "15%", "14%"]}
        className="stable--wrapheads stable--step13"
      >
        {releaseRows.length === 0
          ? <tr><td colSpan={5}><TechnicalEmptyState
              title="No release result"
              detail="Complete the annual event-sequence-family quantification."
            /></td></tr>
          : releaseRows.map((row) =>
            <tr key={row.category}>
              <td className="stable__key">{row.category}</td>
              <td>{row.families.map((family) => family.name).join(", ")}</td>
              <td>{row.pointEstimate.toExponential(3)}</td>
              <td>{row.mean.toExponential(3)}</td>
              <td>
                {releaseTotal === 0
                  ? "0.0%"
                  : `${((row.mean / releaseTotal) * 100).toFixed(1)}%`}
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Risk Integration handoff"
        headers={[
          "Handoff",
          "Internal events",
          "Other hazards",
          "Overlap control",
          "RI result",
          "Status",
        ]}
        minWidth={0}
        columnWidths={["20%", "15%", "19%", "25%", "12%", "9%"]}
        className="stable--wrapheads stable--step13"
      >
        <tr>
          <td className="stable__key">
            <EntryName
              detailLabel="How the seismic package is integrated"
              detail={<>
                {result.crossHazardIntegrationBasis}
              </>}
            >
              {result.name}
            </EntryName>
          </td>
          <td>{result.internalEventsRiskRef}</td>
          <td>{list(result.otherHazardRiskRefs)}</td>
          <td>
            <EntryName
              detailLabel="Overlap-treatment basis"
              detail={result.overlapTreatment}
            >
              Seismic-induced hazards remain under the seismic initiator
            </EntryName>
          </td>
          <td>{result.riskIntegrationResultRef}</td>
          <td>
            <Tag tone={statusTone(result.status)}>
              {displayLabel(result.status)}
            </Tag>
          </td>
        </tr>
      </Table>
    </Section>

    <Section
      title="Risk-informed actions"
      description="Each record turns a calculated seismic insight into one owned action. Defense-in-depth and SSC-classification records are inputs to the plant-level processes, not final classifications or defense-in-depth conclusions."
      tone="integration"
    >
      <Table
        caption="Decision records"
        captionActions={editable
          ? <AddButton
              label="Add decision"
              onClick={() => setRecordEditor({
                title: "New risk-informed action",
                subtitle:
                  "Record one action, its calculated driver, owner, verification, and reanalysis rule.",
                focus: [],
                createAt: ["riskIntegrationBaseline", "decisions"],
                visibleRootFields: [
                  "name",
                  "decisionType",
                  "driverRefs",
                  "affectedSscRefs",
                  "action",
                  "owner",
                  "duePhase",
                  "disposition",
                  "verificationRefs",
                  "reanalysisRequired",
                  "riskIntegrationResultRef",
                  "basis",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          : undefined}
        headers={[
          "Decision",
          "Type",
          "Affected SSCs",
          "Owner and due phase",
          "Disposition",
          "Reanalysis",
        ]}
        minWidth={0}
        columnWidths={["27%", "14%", "16%", "20%", "14%", "9%"]}
        className="stable--wrapheads stable--step13"
      >
        {integration.decisions.length === 0
          ? <tr><td colSpan={6}><TechnicalEmptyState
              title="No risk-informed action"
              detail="Add only actions supported by calculated seismic results."
            /></td></tr>
          : integration.decisions.map((decision, index) =>
            <tr
              className="postable__row--clickable"
              key={decision.uuid}
              onClick={() => setRecordEditor({
                title: decision.name,
                subtitle:
                  "Record one action, its calculated driver, owner, verification, and reanalysis rule.",
                focus: ["riskIntegrationBaseline", "decisions", index],
                visibleRootFields: [
                  "name",
                  "decisionType",
                  "driverRefs",
                  "affectedSscRefs",
                  "action",
                  "owner",
                  "duePhase",
                  "disposition",
                  "verificationRefs",
                  "reanalysisRequired",
                  "riskIntegrationResultRef",
                  "basis",
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove decision",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Technical basis for ${decision.name}`}
                  detail={<>
                    {decision.action} Basis: {decision.basis} Verification:{" "}
                    {list(decision.verificationRefs)}. Drivers:{" "}
                    {list(decision.driverRefs)}.
                  </>}
                >
                  {decision.name}
                </EntryName>
              </td>
              <td>{displayLabel(decision.decisionType)}</td>
              <td>{list(decision.affectedSscRefs)}</td>
              <td>
                {decision.owner}
                <code>{decision.duePhase}</code>
              </td>
              <td>{displayLabel(decision.disposition)}</td>
              <td>{decision.reanalysisRequired ? "Required" : "Not required"}</td>
            </tr>)}
      </Table>
    </Section>

    <Section
      title="Traceability and validation"
      description="A trace path lets an analyst move in both directions: from physical evidence through hazard, demand, fragility, plant logic, and release outcome to a decision, or from a reported decision back to the evidence that supports it. The release checks identify anything that blocks the controlled baseline."
      tone="integration"
    >
      <Table
        caption="Risk traceability paths"
        captionActions={editable
          ? <AddButton
              label="Add trace path"
              onClick={() => setRecordEditor({
                title: "New risk traceability path",
                subtitle:
                  "Link one physical input through the model, release outcome, Risk Integration result, and decision.",
                focus: [],
                createAt: [
                  "riskIntegrationBaseline",
                  "traceabilityPaths",
                ],
                visibleRootFields: [
                  "name",
                  "evidenceRefs",
                  "hazardRefs",
                  "responseRefs",
                  "sscRefs",
                  "failureMechanismRefs",
                  "fragilityRefs",
                  "plantModelRefs",
                  "humanActionRefs",
                  "eventSequenceRefs",
                  "eventSequenceFamilyRef",
                  "releaseCategoryRef",
                  "riskIntegrationResultRef",
                  "decisionRefs",
                  "status",
                  "openItems",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          : undefined}
        headers={[
          "Trace path",
          "Hazard input",
          "Physical failure",
          "Plant response",
          "Release outcome",
          "RI and decision",
          "Status",
        ]}
        minWidth={0}
        columnWidths={["20%", "14%", "15%", "17%", "14%", "13%", "7%"]}
        className="stable--wrapheads stable--step13"
      >
        {integration.traceabilityPaths.length === 0
          ? <tr><td colSpan={7}><TechnicalEmptyState
              title="No trace path"
              detail="Link each important result to its physical evidence and decision."
            /></td></tr>
          : integration.traceabilityPaths.map((path, index) =>
            <tr
              className="postable__row--clickable"
              key={path.uuid}
              onClick={() => setRecordEditor({
                title: path.name,
                subtitle:
                  "Link one physical input through the model, release outcome, Risk Integration result, and decision.",
                focus: [
                  "riskIntegrationBaseline",
                  "traceabilityPaths",
                  index,
                ],
                visibleRootFields: [
                  "name",
                  "evidenceRefs",
                  "hazardRefs",
                  "responseRefs",
                  "sscRefs",
                  "failureMechanismRefs",
                  "fragilityRefs",
                  "plantModelRefs",
                  "humanActionRefs",
                  "eventSequenceRefs",
                  "eventSequenceFamilyRef",
                  "releaseCategoryRef",
                  "riskIntegrationResultRef",
                  "decisionRefs",
                  "status",
                  "openItems",
                ],
                inlinePrimitiveArrays: true,
                removeLabel: "Remove trace path",
              })}
            >
              <td className="stable__key">
                <EntryName
                  detailLabel={`Complete trace for ${path.name}`}
                  detail={<>
                    Evidence: {list(path.evidenceRefs)}. Hazard:{" "}
                    {list(path.hazardRefs)}. Response:{" "}
                    {list(path.responseRefs)}. SSCs: {list(path.sscRefs)}.
                    Failure mechanisms: {list(path.failureMechanismRefs)}.
                    Fragilities: {list(path.fragilityRefs)}. Plant model:{" "}
                    {list(path.plantModelRefs)}. Human actions:{" "}
                    {list(path.humanActionRefs)}. Sequences:{" "}
                    {list(path.eventSequenceRefs)}. Open items:{" "}
                    {list(path.openItems)}.
                  </>}
                >
                  {path.name}
                </EntryName>
              </td>
              <td>{list(path.hazardRefs)}</td>
              <td>
                {list([
                  ...path.sscRefs,
                  ...path.failureMechanismRefs,
                  ...path.fragilityRefs,
                ])}
              </td>
              <td>
                {list([
                  ...path.responseRefs,
                  ...path.plantModelRefs,
                  ...path.humanActionRefs,
                ])}
              </td>
              <td>
                {path.eventSequenceFamilyRef}
                <code>{path.releaseCategoryRef}</code>
              </td>
              <td>
                {path.riskIntegrationResultRef}
                <code>{list(path.decisionRefs)}</code>
              </td>
              <td>
                <Tag tone={statusTone(path.status)}>
                  {displayLabel(path.status)}
                </Tag>
              </td>
            </tr>)}
      </Table>

      <Table
        caption="Automated release checks"
        headers={["Check", "Result", "Findings", "Release gate"]}
        minWidth={0}
        columnWidths={["25%", "12%", "25%", "38%"]}
        className="stable--wrapheads stable--step13"
      >
        {checks.map((check) =>
          <tr key={check.name}>
            <td className="stable__key">{check.name}</td>
            <td>
              <Tag tone={statusTone(check.result)}>{check.result}</Tag>
            </td>
            <td>{check.findings}</td>
            <td>{check.gate}</td>
          </tr>)}
      </Table>
    </Section>

    <Section
      title="Controlled baseline"
      description="This freezes the exact model version, final quantification run, Risk Integration handoff, technical reports, peer-review record, approval, limitations, and release state. A later change must use configuration control and trigger reanalysis when it can affect seismic risk."
      tone="integration"
    >
      <Table
        caption="Controlled baseline"
        captionActions={editable
          ? <>
            <EditButton
              label="Edit baseline"
              onClick={() => setRecordEditor({
                title: integration.baseline.name,
                subtitle:
                  "Control the final model, reports, review, approval, limitations, and release state.",
                focus: ["riskIntegrationBaseline", "baseline"],
                visibleRootFields: [
                  "name",
                  "modelVersion",
                  "configurationControlRecordId",
                  "quantificationRunRef",
                  "riskIntegrationHandoffRef",
                  "controlledDocumentRefs",
                  "peerReviewRef",
                  "peerReviewStatus",
                  "openFindingRefs",
                  "approvalStatus",
                  "approvedBy",
                  "approvalDate",
                  "releaseStatus",
                  "releaseDate",
                  "scopeLimitations",
                  "basis",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
            <EditButton
              label="Edit review basis"
              onClick={() => setRecordEditor({
                title: "Peer-review basis",
                subtitle:
                  "Define the technical disciplines, methods, and open findings covered by peer review.",
                focus: ["documentation", "peerReviewBasis"],
                visibleRootFields: [
                  "peerReviewIds",
                  "systemsEngineeringCoverage",
                  "seismicHazardCoverage",
                  "seismicCapabilityCoverage",
                  "seismicPraCoverage",
                  "fragilityWalkdownExperienceCoverage",
                  "methodologyReviewScope",
                  "openFindingRefs",
                ],
                inlinePrimitiveArrays: true,
              })}
            />
          </>
          : undefined}
        headers={[
          "Baseline",
          "Configuration snapshot",
          "Final quantification",
          "Documents",
          "Peer review",
          "Approval",
          "Release",
        ]}
        minWidth={0}
        columnWidths={["21%", "16%", "14%", "9%", "14%", "13%", "13%"]}
        className="stable--wrapheads stable--step13"
      >
        <tr>
          <td className="stable__key">
            <EntryName
              detailLabel={`Control basis for ${integration.baseline.name}`}
              detail={<>
                {integration.baseline.basis} Application limitations:{" "}
                {list(integration.baseline.scopeLimitations)}.
              </>}
            >
              {integration.baseline.name}
            </EntryName>
            <code>{integration.baseline.modelVersion}</code>
          </td>
          <td>{integration.baseline.configurationControlRecordId}</td>
          <td>{integration.baseline.quantificationRunRef}</td>
          <td>{integration.baseline.controlledDocumentRefs.length}</td>
          <td>
            <Tag tone={statusTone(integration.baseline.peerReviewStatus)}>
              {displayLabel(integration.baseline.peerReviewStatus)}
            </Tag>
            <code>{integration.baseline.peerReviewRef}</code>
          </td>
          <td>
            <Tag tone={statusTone(integration.baseline.approvalStatus)}>
              {displayLabel(integration.baseline.approvalStatus)}
            </Tag>
            {integration.baseline.approvedBy !== undefined
              && <code>{integration.baseline.approvedBy}</code>}
          </td>
          <td>
            <Tag tone={statusTone(integration.baseline.releaseStatus)}>
              {displayLabel(integration.baseline.releaseStatus)}
            </Tag>
            {integration.baseline.releaseDate !== undefined
              && <code>{integration.baseline.releaseDate}</code>}
          </td>
        </tr>
      </Table>

      <Table
        caption="Controlled documentation"
        headers={["Package", "Controlled reference", "Status"]}
        minWidth={0}
        columnWidths={["36%", "44%", "20%"]}
        className="stable--wrapheads stable--step13"
      >
        {integration.baseline.controlledDocumentRefs.length === 0
          ? <tr><td colSpan={3}><TechnicalEmptyState
              title="No controlled document"
              detail="Link the SHA, SFR, SPR, and integrated Seismic PRA reports."
            /></td></tr>
          : integration.baseline.controlledDocumentRefs.map(
            (reference, index) =>
              <tr key={reference}>
                <td className="stable__key">
                  {index === 0
                    ? "Seismic Hazard Analysis"
                    : index === 1
                      ? "Seismic Fragility Analysis"
                      : index === 2
                        ? "Seismic Plant Response Analysis"
                        : "Integrated Seismic PRA"}
                </td>
                <td>{reference}</td>
                <td>
                  <Tag tone={statusTone(
                    integration.baseline.releaseStatus,
                  )}>
                    {displayLabel(integration.baseline.releaseStatus)}
                  </Tag>
                </td>
              </tr>,
          )}
      </Table>

    </Section>

    <CollectionEditor
      tone="integration"
      target={recordEditor}
      onClose={() => setRecordEditor(null)}
    />
  </>;
}

function DraftScreen({ actions }: { actions?: WorkflowActions }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  const [busy, setBusy] = useState(false);
  const [documentationFocus, setDocumentationFocus] = useState<EditorPath | null>(null);
  const items = useMemo(() => seismicConformanceItems(mef), [mef]);
  const score = useMemo(() => seismicConformanceScore(items), [items]);
  const diagnostics = useMemo(() => validateSeismicPra(mef), [mef]);
  const blockers = diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR");
  const ready = blockers.length === 0;
  const toc = [
    ["1", "Scope and applications"], ["2", "Seismic Hazard Analysis"], ["2.1", "Site and earth-science basis"], ["2.2", "Sources, motion, and site response"], ["2.3", "Hazard results and secondary hazards"],
    ["3", "Seismic Fragility Analysis"], ["3.1", "Equipment scope and response"], ["3.2", "Thresholds and investigations"], ["3.3", "Fragility results"],
    ["4", "Seismic Plant Response Analysis"], ["4.1", "Initiating events and plant model"], ["4.2", "Human reliability"], ["4.3", "Quantification"], ["5", "Integrated results and risk insights"],
  ];
  function downloadJson(): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(mef, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${mef.name} — Seismic PRA.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  return <>
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{mef.name}</h1><h2>Seismic Probabilistic Risk Assessment</h2><h3>Table of contents</h3>
        <div className="posgen__preview-toc">{toc.map(([number, title], index) => <div key={number} className="posgen__preview-toc-row"><span style={{ paddingLeft: number.includes(".") ? 24 : 0 }}>{number} {title}</span><span>{index + 3}</span></div>)}</div>
      </div>
      <div className="posgen__side">
        <div className="posgen__readout"><h3 className="posgen__readout-h">Conformance check</h3><div className="posgen__bar"><span className="posgen__bar-label">SR capability assignments</span><strong>{srCapabilitySummary(mef)}</strong></div><div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><strong>{mef.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational"}</strong></div><div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{score.met} / {score.applicable}</span></div>{score.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Needs attention</span><span className="posmono">{score.warn}</span></div>}{score.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Blocked</span><span className="posmono">{score.blocked}</span></div>}</div>
        <div className="posgen__readout"><h3 className="posgen__readout-h">{actions?.submitForReview !== undefined ? "Hand-off to internal review" : "Read-only draft preview"}</h3><p className="sdraft__help">{ready ? "The controlled model is ready to be locked and advanced to Internal Technical Review." : `${blockers.length} validation blocker${blockers.length === 1 ? "" : "s"} remain. Draft files may still be generated, but review submission is gated.`}</p><div className="sdraft__actions">{actions?.submitForReview !== undefined && (mef.workflowState === "DRAFT" || mef.workflowState === "REVISION_REQUIRED") && <button type="button" className="posnav__btn posnav__btn--primary" disabled={busy || !ready} onClick={() => { setBusy(true); actions.submitForReview?.().finally(() => setBusy(false)); }}><POSIcon.Send /> {busy ? "Submitting…" : "Submit draft to internal review"}</button>}<button type="button" className="posnav__btn" onClick={() => { void generateSeismicPraReport(mef, false); }}><POSIcon.Download /> Download draft (.docx)</button><button type="button" className="posnav__btn" onClick={downloadJson}><POSIcon.Download /> Download JSON</button></div></div>
      </div>
    </div>
    <Section eyebrow="SHA-I · SFR-F · SPR-F" title="Controlled documentation and traceability" description="Complete each subelement package and the integrated narrative from the same model used by the technical steps; no report-only fields are maintained separately." tone="integration" actions={<EditButton label="Edit conformance" onClick={() => setDocumentationFocus(["conformanceMatrix"])} />}>
      <Table headers={["Package", "Process status", "Trace links", "Controlled references", ""]}>
        <tr className="postable__row--clickable" onClick={() => setDocumentationFocus(["seismicHazardAnalysis", "documentation"])}><td><strong>Seismic Hazard Analysis</strong><code>SHA-I1–I3</code></td><td><Tag tone={mef.seismicHazardAnalysis.documentation.processDescription.trim().length > 0 ? "good" : "warn"}>{mef.seismicHazardAnalysis.documentation.processDescription.trim().length > 0 ? "Documented" : "Open"}</Tag></td><td>{mef.seismicHazardAnalysis.documentation.traceabilityLinks.length}</td><td>{mef.seismicHazardAnalysis.documentation.dataAndModelReferences.length + mef.seismicHazardAnalysis.documentation.calculationFileRefs.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>
        <tr className="postable__row--clickable" onClick={() => setDocumentationFocus(["seismicFragilityAnalysis", "documentation"])}><td><strong>Seismic Fragility Analysis</strong><code>SFR-F1–F3</code></td><td><Tag tone={mef.seismicFragilityAnalysis.documentation.processDescription.trim().length > 0 ? "good" : "warn"}>{mef.seismicFragilityAnalysis.documentation.processDescription.trim().length > 0 ? "Documented" : "Open"}</Tag></td><td>{mef.seismicFragilityAnalysis.documentation.traceability.length}</td><td>{mef.seismicFragilityAnalysis.documentation.dataAndCalculationRefs.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>
        <tr className="postable__row--clickable" onClick={() => setDocumentationFocus(["seismicPlantResponseAnalysis", "documentation"])}><td><strong>Seismic Plant Response Analysis</strong><code>SPR-F1–F5</code></td><td><Tag tone={mef.seismicPlantResponseAnalysis.documentation.processDescription.trim().length > 0 ? "good" : "warn"}>{mef.seismicPlantResponseAnalysis.documentation.processDescription.trim().length > 0 ? "Documented" : "Open"}</Tag></td><td>{mef.seismicPlantResponseAnalysis.documentation.traceability.length}</td><td>{mef.seismicPlantResponseAnalysis.documentation.dataModelAndCalculationRefs.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>
        <tr className="postable__row--clickable" onClick={() => setDocumentationFocus(["documentation"])}><td><strong>Integrated Seismic PRA</strong><code>Scope · interfaces · insights</code></td><td><Tag tone={mef.documentation.overallProcessDescription.trim().length > 0 ? "good" : "warn"}>{mef.documentation.overallProcessDescription.trim().length > 0 ? "Documented" : "Open"}</Tag></td><td>{mef.documentation.traceabilityMatrix.length}</td><td>{mef.documentation.supportingDocumentRefs.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>
      </Table>
    </Section>
    <Section eyebrow="Review gate" title="Validation findings" description="Submission is blocked only by errors; warnings remain visible for reviewer attention and documented disposition." tone="integration">
      <DiagnosticTable diagnostics={diagnostics} />
    </Section>
    {documentationFocus !== null && <MefEditor tone="integration" title={documentationFocus[0] === "conformanceMatrix" ? "Supporting-requirement conformance" : "Controlled documentation"} subtitle="Narratives, references, evidence, dispositions, peer-review basis, and end-to-end traceability" focus={documentationFocus} onClose={() => setDocumentationFocus(null)} />}
  </>;
}

function ReviewScreen({ actions, renderRoster }: { actions?: WorkflowActions; renderRoster?: () => ReactNode }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [text, setText] = useState("");
  const [severity, setSeverity] = useState<"MAJOR" | "MINOR" | "OBSERVATION">("MINOR");
  const [sr, setSr] = useState("");
  const [revision, setRevision] = useState("");
  const comments = mef.internalReviewComments.comments;
  const shown = comments.filter((comment) => filter === "all" || (filter === "resolved" ? comment.resolved : !comment.resolved));
  const openCount = comments.filter((comment) => !comment.resolved).length;
  const resolvedCount = comments.length - openCount;
  const allResolved = comments.length > 0 && openCount === 0;
  return <>
    <div className={`posrevbanner posrevbanner--${allResolved ? "ready" : "in_review"}`}><div className="posrevbanner__icon"><POSIcon.Lock /></div><div className="posrevbanner__main"><div className="posrevbanner__eyebrow">{allResolved ? "All comments resolved" : "In review"}</div><div className="posrevbanner__title">{allResolved ? "Ready for Internal Approval" : comments.length === 0 ? "No review comments have been posted" : `${openCount} of ${comments.length} comments still open`}</div></div><div className="posrevbanner__counts"><span className="posrevbanner__count posrevbanner__count--ok">{resolvedCount} resolved</span>{openCount > 0 && <span className="posrevbanner__count posrevbanner__count--warn">{openCount} open</span>}</div></div>
    {renderRoster?.()}
    <div className="poscard"><div className="poscard__head"><h3 className="poscard__title">All review comments</h3><div className="posrow" style={{ gap: 6 }}><button type="button" className={`poschip${filter === "all" ? " poschip--primary" : ""}`} onClick={() => setFilter("all")}>All ({comments.length})</button><button type="button" className={`poschip${filter === "open" ? " poschip--primary" : ""}`} onClick={() => setFilter("open")}>Open ({openCount})</button><button type="button" className={`poschip${filter === "resolved" ? " poschip--primary" : ""}`} onClick={() => setFilter("resolved")}>Resolved ({resolvedCount})</button></div></div><p className="poscard__sub">Comments across SHA, SFR, SPR, and their interfaces, newest first.</p><div className="poscomments">{shown.length === 0 ? <p className="posmuted">No comments in this view.</p> : shown.map((comment) => <div key={comment.uuid} className={`poscomment poscomment--${(comment.severity ?? "OBSERVATION").toLowerCase()} poscomment--${comment.resolved ? "resolved" : "open"}`}><div className="poscomment__avatar">{comment.authorId.slice(0, 2).toUpperCase()}</div><div className="poscomment__main"><div className="poscomment__head"><span className="poscomment__author">{comment.authorId}</span><span className="poscomment__when">· {new Date(comment.createdAt).toLocaleString()}</span><span className="poscomment__spacer" /><Tag tone={comment.severity === "MAJOR" ? "bad" : comment.severity === "MINOR" ? "warn" : "neutral"}>{comment.severity ?? "OBSERVATION"}</Tag><span className={`posbadge ${comment.resolved ? "posbadge--ok" : "posbadge--progress"}`}><span className="posbadge__dot" />{comment.resolved ? "Resolved" : "Open"}</span></div><div className="poscomment__target"><span className="possubtle">Anchored to</span> <span className="poschip">{comment.associatedSr ?? "Seismic PRA"}</span></div><p className="poscomment__body">{comment.text}</p><div className="poscomment__foot"><span className="poscomment__foot-spacer" />{actions?.toggleResolve !== undefined && <button type="button" className={`posnav__btn posnav__btn--sm${comment.resolved ? "" : " posnav__btn--primary"}`} onClick={() => void actions.toggleResolve?.(comment.uuid, !comment.resolved)}>{comment.resolved ? <><POSIcon.Close /> Reopen</> : <><POSIcon.Check /> Mark resolved</>}</button>}</div></div></div>)}</div></div>
    {actions?.postComment !== undefined && <div className="poscard"><div className="poscard__head"><h3 className="poscard__title">Add review comment</h3></div><div className="sreviewform"><FieldGrid><Field label="Severity"><SelectInput value={severity} options={[{ value: "OBSERVATION", label: "Observation" }, { value: "MINOR", label: "Minor" }, { value: "MAJOR", label: "Major" }]} onChange={(value) => setSeverity(value as typeof severity)} /></Field><Field label="Supporting requirement"><SelectInput value={sr} options={[{ value: "", label: "Entire Seismic PRA" }, ...Object.keys(SEISMIC_PRA_SR_CATALOG).map((requirement) => ({ value: requirement, label: requirement }))]} onChange={setSr} /></Field></FieldGrid><Field label="Comment"><TextArea value={text} rows={5} onChange={setText} /></Field><button type="button" className="posnav__btn posnav__btn--primary" disabled={text.trim().length === 0} onClick={() => { void actions.postComment?.(text.trim(), severity, sr.trim() || undefined).then(() => { setText(""); setSr(""); }); }}><POSIcon.Send /> Post comment</button></div></div>}
    {actions?.requestRevision !== undefined && <div className="poscard"><div className="poscard__head"><h3 className="poscard__title">Request revision</h3></div><p className="poscard__sub">Return the controlled workbook to its preparers with an integration-level reason.</p><div className="sreviewform"><Field label="Revision note"><TextArea value={revision} rows={5} onChange={setRevision} /></Field><button type="button" className="posnav__btn" disabled={revision.trim().length === 0} onClick={() => void actions.requestRevision?.(revision.trim()).then(() => setRevision(""))}>Request revision</button></div></div>}
  </>;
}

function ApprovalScreen({ renderApprovalTable, renderSignCard }: { renderApprovalTable?: () => ReactNode; renderSignCard?: () => ReactNode }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  const items = useMemo(() => seismicConformanceItems(mef), [mef]);
  const score = useMemo(() => seismicConformanceScore(items), [items]);
  const comments = mef.internalReviewComments.comments;
  const resolved = comments.filter((comment) => comment.resolved).length;
  const approved = mef.workflowState === "FINAL";
  return <>
    <div className={`posrevbanner posrevbanner--${approved ? "approved" : "submitted"}`}><div className="posrevbanner__icon"><POSIcon.Lock /></div><div className="posrevbanner__main"><div className="posrevbanner__eyebrow">{approved ? "Approved" : "Internal approval"}</div><div className="posrevbanner__title">{approved ? "Workbook approved · locked from edits" : "Awaiting the assigned approver's signature"}</div></div><div className="posrevbanner__counts"><span className="posrevbanner__count posrevbanner__count--ok">{resolved} resolved</span></div></div>
    <div className="poscard"><div className="poscard__head"><h3 className="poscard__title">What is being attested</h3></div><div className="posapprove__attest-with-sign"><div className="posapprove__attest-grid"><div className="posapprove__attest-row"><span className="posapprove__attest-cap">SR capability assignments</span><span className="posapprove__attest-val"><strong>{srCapabilitySummary(mef)}</strong></span></div><div className="posapprove__attest-row"><span className="posapprove__attest-cap">Items satisfied</span><span className="posapprove__attest-val posmono">{score.met} of {score.applicable}</span></div><div className="posapprove__attest-row"><span className="posapprove__attest-cap">Review comments</span><span className="posapprove__attest-val posmono">{resolved} of {comments.length} resolved</span></div><div className="posapprove__attest-row"><span className="posapprove__attest-cap">Configuration snapshot</span><span className="posapprove__attest-val">{mef.configurationControlRecordId ?? "Not linked"}</span></div></div>{renderSignCard !== undefined && <div className="posapprove__sign-col">{renderSignCard()}</div>}</div></div>
    {renderApprovalTable?.()}
    {approved && <div className="poscard posapprove__handoff"><div className="poscard__head"><h3 className="poscard__title">After approval · external workflows</h3><span className="posbadge">View + comment only</span></div><p className="poscard__sub">The approved Seismic PRA baseline can now be released to peer review and audit without reopening technical editing.</p><div className="posapprove__handoff-grid"><div className="posapprove__handoff-card"><div className="posapprove__handoff-card-head"><div className="posapprove__handoff-card-icon"><POSIcon.Eye /></div><div><div className="posapprove__handoff-card-eyebrow">External · Section 6</div><div className="posapprove__handoff-card-title">Peer Review</div></div></div></div><div className="posapprove__handoff-card"><div className="posapprove__handoff-card-head"><div className="posapprove__handoff-card-icon"><POSIcon.Lock /></div><div><div className="posapprove__handoff-card-eyebrow">External · NQA-1 aligned</div><div className="posapprove__handoff-card-title">Audit</div></div></div></div></div></div>}
  </>;
}

export {
  ScopeScreen,
  EvidenceBaseScreen,
  BaselinePraScreen,
  EarthScienceScreen,
  InitialSelScreen,
  SiteHazardModelScreen,
  SourceGroundMotionScreen,
  SiteResponseScreen,
  HazardResultsScreen,
  SecondaryHazardsScreen,
  SelResponseScreen,
  PlantConfigurationScreen,
  FragilityDevelopmentScreen,
  ThresholdInvestigationScreen,
  FragilityResultsScreen,
  PlantResponseModelScreen,
  PlantModelScreen,
  HumanReliabilityScreen,
  AnnualRiskQuantificationScreen,
  RiskInterpretationScreen,
  RiskIntegrationBaselineScreen,
  QuantificationIntegrationScreen,
  DraftScreen,
  ReviewScreen,
  ApprovalScreen,
  type WorkflowActions,
};
