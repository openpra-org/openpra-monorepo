import { SEISMIC_PRA_SR_CATALOG, type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { type PlantIdentity } from "interfaces-mef-types/technical-element";
import { synchronizeSeismicPraDerivedRegisters, validateSeismicPra, type SeismicPraDiagnostic } from "interfaces-mef-types/seismic/seismic-pra-validation";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { seismicConformanceItems, seismicConformanceScore } from "./seismicPraConformance";
import { generateSeismicPraReport } from "./seismicPraDocx";
import { Drawer, EmptyState, Field, NumberInput, Section, SelectInput, Tag, TextArea, TextInput } from "./seismicPraFields";
import { hazardCurveFanSeries, motionValueAtFrequency, responseSpectrumFanSeries, secondaryHazardFanSeries, structuralResponseFanSeries, type HazardFanPoint, type SpectrumDirection } from "./seismicPraHazardCharts";
import { seismicPraInterfaceLanes, type SeismicPraInterfaceLane } from "./seismicPraInterfaces";
import { removeStructuredRecord, StructuredEditorDrawer, type EditorPath } from "./seismicPraStructuredEditor";
import { useSeismicPraWorkbook } from "./seismicPraWorkbookContext";

type Tone = "sha" | "sfr" | "spr" | "integration";
interface CollectionEditorTarget {
  title: string;
  subtitle: string;
  focus: EditorPath;
  createAt?: EditorPath;
  visibleRootFields?: string[] | ((value: Record<string, unknown>) => string[]);
  removeLabel?: string;
}
interface AddCategoryOption {
  label: string;
  description: string;
  title: string;
  subtitle: string;
  createAt: EditorPath;
}

const UncertaintyPackageSchema = SeismicPRASchema.pick({
  integratedUncertainties: true,
  integratedSensitivityStudies: true,
  modelUncertainty: true,
  preOperationalAssumptions: true,
}).extend({
  seismicHazardAnalysis: SeismicPRASchema.shape.seismicHazardAnalysis.pick({
    uncertainties: true,
    modelUncertainty: true,
    preOperationalAssumptions: true,
  }),
  seismicFragilityAnalysis: SeismicPRASchema.shape.seismicFragilityAnalysis.pick({
    modelUncertainty: true,
    preOperationalAssumptions: true,
  }),
  seismicPlantResponseAnalysis: SeismicPRASchema.shape.seismicPlantResponseAnalysis.pick({
    modelUncertainty: true,
    preOperationalAssumptions: true,
  }),
});

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

function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Pencil /> {label}</button>;
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }): JSX.Element {
  return <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onClick}><POSIcon.Plus /> {label}</button>;
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

function Table({ headers, children, minWidth = 720, caption, columnWidths, className }: { headers: string[]; children: ReactNode; minWidth?: number; caption?: string; columnWidths?: string[]; className?: string }): JSX.Element {
  return <div className="stablewrap"><table className={`stable postable${className === undefined ? "" : ` ${className}`}`} style={{ minWidth, tableLayout: minWidth === 0 ? "fixed" : undefined }}>{columnWidths !== undefined && <colgroup>{columnWidths.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>}{caption !== undefined && <caption>{caption}</caption>}<thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function DiagnosticTable({ diagnostics }: { diagnostics: SeismicPraDiagnostic[] }): JSX.Element {
  if (diagnostics.length === 0) return <div className="svalidation__clear"><POSIcon.Check /><div><strong>No validation findings</strong><span>The current canonical model passes the integrated consistency checks.</span></div></div>;
  return <Table headers={["Finding", "Area", "Severity", "Affected records"]}>
    {diagnostics.map((diagnostic, index) => <tr key={`${diagnostic.code}-${index}`}><td><strong>{diagnostic.message}</strong><code>{diagnostic.code}</code></td><td>{diagnostic.area}</td><td><Tag tone={diagnostic.severity === "ERROR" ? "bad" : diagnostic.severity === "WARNING" ? "warn" : "neutral"}>{diagnostic.severity}</Tag></td><td>{diagnostic.recordRefs.length > 0 ? diagnostic.recordRefs.join(" · ") : "—"}</td></tr>)}
  </Table>;
}

function MefEditor({ tone, title, subtitle, focus, createAt, hiddenRootFields, visibleRootFields, removeLabel, onClose }: { tone: Tone; title: string; subtitle: string; focus: EditorPath; createAt?: EditorPath; hiddenRootFields?: string[]; visibleRootFields?: string[] | ((value: Record<string, unknown>) => string[]); removeLabel?: string; onClose: () => void }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  return <StructuredEditorDrawer eyebrow={EDITOR_LABELS[tone]} title={title} subtitle={subtitle} schema={SeismicPRASchema} value={mef} editable={editable} initialFocus={focus} createAt={createAt} hiddenRootFields={hiddenRootFields} visibleRootFields={visibleRootFields} onClose={onClose} onApply={(value) => update((draft) => { Object.assign(draft, value); })} onRemove={removeLabel === undefined ? undefined : () => update((draft) => { Object.assign(draft, removeStructuredRecord(draft, focus)); })} removeLabel={removeLabel} />;
}

function CollectionEditor({ tone, target, onClose }: { tone: Tone; target: CollectionEditorTarget | null; onClose: () => void }): JSX.Element | null {
  if (target === null) return null;
  return <MefEditor tone={tone} title={target.title} subtitle={target.subtitle} focus={target.focus} createAt={target.createAt} visibleRootFields={target.visibleRootFields} removeLabel={target.removeLabel} onClose={onClose} />;
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
    <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
    <p className="poscard__sub">Review technical inputs and outputs by element.</p>
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

function ScopeScreen({ renderDocuments }: { renderDocuments?: () => ReactNode }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const identity: PlantIdentity = mef.metadata.plantIdentity ?? {
    name: "",
    vendor: "",
    reactorType: "",
    thermalPower: "",
    primaryCoolant: "",
    siteName: "",
    numberOfModules: 1,
  };
  function updatePraScope(value: string): void {
    update((draft) => {
      draft.praScope = value;
      draft.metadata.scope = value;
      draft.seismicHazardAnalysis.praScope = value;
      draft.seismicFragilityAnalysis.praScope = value;
      draft.seismicPlantResponseAnalysis.praScope = value;
    });
  }

  function updatePlantIdentity<K extends keyof PlantIdentity>(key: K, value: PlantIdentity[K]): void {
    update((draft) => {
      const current = draft.metadata.plantIdentity ?? {
        name: "",
        vendor: "",
        reactorType: "",
        thermalPower: "",
        primaryCoolant: "",
      };
      draft.metadata.plantIdentity = { ...current, [key]: value };
    });
  }

  return <>
    <SeismicInterfacesSection />
    <Section title="Scope and reference plant and site" tone="integration">
      <fieldset className="sinlineeditor" disabled={!editable}>
        <div className="sinlineeditor__group">
          <h3 className="sinlineeditor__title">Reference plant and site</h3>
          <div className="posfield-grid">
            <label className="posfield"><span className="posfield__label">Plant name</span><input className="posfield__input" value={identity.name} onChange={(event) => updatePlantIdentity("name", event.target.value)} /></label>
            <label className="posfield"><span className="posfield__label">Vendor / designer</span><input className="posfield__input" value={identity.vendor} onChange={(event) => updatePlantIdentity("vendor", event.target.value)} /></label>
            <label className="posfield"><span className="posfield__label">Reactor type</span><input className="posfield__input" value={identity.reactorType} onChange={(event) => updatePlantIdentity("reactorType", event.target.value)} /></label>
            <label className="posfield"><span className="posfield__label">Thermal power</span><input className="posfield__input" value={identity.thermalPower} onChange={(event) => updatePlantIdentity("thermalPower", event.target.value)} /></label>
            <label className="posfield"><span className="posfield__label">Site</span><input className="posfield__input" value={identity.siteName ?? ""} onChange={(event) => updatePlantIdentity("siteName", event.target.value)} /></label>
            <label className="posfield"><span className="posfield__label">Modules or units</span><input className="posfield__input" type="number" min="1" step="1" value={identity.numberOfModules ?? 1} onChange={(event) => updatePlantIdentity("numberOfModules", Number(event.target.value))} /></label>
          </div>
        </div>
        <div className="sinlineeditor__group">
          <h3 className="sinlineeditor__title">PRA scope</h3>
          <textarea className="posfield__textarea" rows={4} value={mef.praScope} onChange={(event) => updatePraScope(event.target.value)} />
        </div>
        <div className="sinlineeditor__group">
          <h3 className="sinlineeditor__title">Plant stage</h3>
          <div className="sinlineeditor__choices">
            {([
              ["PRE_OPERATIONAL", "Pre-operational", "Plant information is based on the available design and must be confirmed as the plant is built."],
              ["OPERATIONAL", "Operational", "The analysis is maintained against the as-built and as-operated plant."],
            ] as const).map(([value, label, detail]) => <label className={`sinlineeditor__choice${mef.plantStage === value ? " sinlineeditor__choice--active" : ""}`} key={value}>
              <input type="radio" name="seismic-plant-stage" checked={mef.plantStage === value} onChange={() => update((draft) => { draft.plantStage = value; })} />
              <span><strong>{label}</strong><small>{detail}</small></span>
            </label>)}
          </div>
        </div>
        <div className="sinlineeditor__group">
          <h3 className="sinlineeditor__title">Capability category</h3>
          <div className="sinlineeditor__choices">
            {([
              ["CC-I", "Bounding", "Coarse scope, generic data, and bounding assumptions."],
              ["CC-II", "Plant-specific", "Plant-specific data and finer resolution for risk-significant contributors."],
            ] as const).map(([value, label, detail]) => <label className={`sinlineeditor__choice${(mef.capabilityCategory ?? "CC-II") === value ? " sinlineeditor__choice--active" : ""}`} key={value}>
              <input type="radio" name="seismic-capability-category" checked={(mef.capabilityCategory ?? "CC-II") === value} onChange={() => update((draft) => { draft.capabilityCategory = value; })} />
              <span><strong>{value} · {label}</strong><small>{detail}</small></span>
            </label>)}
          </div>
        </div>
      </fieldset>
    </Section>
    {renderDocuments?.()}
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
  const [draft, setDraft] = useState<Pick<HazardAnalysisBasis, "site" | "structuredProcess">>(() => ({
    site: structuredClone(mef.seismicHazardAnalysis.analysisBasis.site),
    structuredProcess: structuredClone(mef.seismicHazardAnalysis.analysisBasis.structuredProcess),
  }));
  const process = draft.structuredProcess;

  function save(): void {
    update((next) => {
      next.seismicHazardAnalysis.analysisBasis.site = draft.site;
      next.seismicHazardAnalysis.analysisBasis.structuredProcess = draft.structuredProcess;
    });
    onClose();
  }

  return <Drawer eyebrow={EDITOR_LABELS.sha} title="Site and PSHA basis" subtitle="Site selection and PSHA process" plainHeader onClose={onClose} footer={<>
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
    </fieldset>
  </Drawer>;
}

function HazardBasisScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const sha = mef.seismicHazardAnalysis;
  const site = sha.analysisBasis.site;
  const process = sha.analysisBasis.structuredProcess;
  const bounds = sha.analysisBasis.calculationBounds;
  const referenceSiteName = mef.metadata.plantIdentity?.siteName?.trim() || "Not defined in Step 01";
  const siteSelection = site.siteBasis === "IDENTIFIED_SITE"
    ? referenceSiteName
    : site.applicableSiteRange?.trim() || "Bounding site not described";
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
  const [basisOpen, setBasisOpen] = useState(false);
  const [boundsOpen, setBoundsOpen] = useState(false);
  const [parameterEditor, setParameterEditor] = useState<CollectionEditorTarget | null>(null);
  const frequencyRangeLabel = (lower: number, upper: number): string => lower === upper ? `${lower} Hz` : `${lower}–${upper} Hz`;
  return <>
    <Section title="Site and PSHA basis" tone="sha" actions={<EditButton label="Edit basis" onClick={() => setBasisOpen(true)} />}>
      <div className="sbasis">
        <div className="sbasis__overview">
          <div className="sbasis__summary">
            <span>Reference site</span>
            <strong>{siteSelection}</strong>
          </div>
          <div className="sbasis__summary">
            <span>Defined process</span>
            <strong>{structuredProcessLabel(process.processType)}</strong>
          </div>
        </div>
        {site.siteBasis === "BOUNDING_SITE" && <div className="sbasis__bounding">
          <BasisDetail label="Sites covered" value={site.applicableSiteRange ?? ""} />
          <BasisDetail label="Bounding basis" value={site.selectionAndApplicabilityBasis} />
        </div>}
        <div className="sbasis__technical-grid">
          <BasisDetail label="Study objective" value={process.studyObjective} />
          <BasisDetail label="Level selection" value={process.processLevelBasis} />
          <BasisDetail label="Technical integration" value={process.technicalIntegrationApproach} />
          <BasisDetail label="Center, body, and range" value={process.centerBodyRangeDemonstration} />
        </div>
      </div>
    </Section>

    <Section title="Shared ground-motion definition" description="Define motion parameters shared across seismic analyses." tone="sha" actions={editable ? <AddButton label="Add parameter" onClick={() => setParameterEditor({ title: "New ground-motion parameter", subtitle: "Parameter shared by hazard, fragility, and plant response", focus: [], createAt: ["seismicHazardAnalysis", "analysisBasis", "groundMotionParameters"], visibleRootFields: groundMotionFields })} /> : undefined}>
      {sha.analysisBasis.groundMotionParameters.length === 0 ? <EmptyState title="No ground-motion parameters" detail="The shared motion definition has not been established." /> : <Table headers={["Parameter", "Direction", "Range", "Frequency range"]} minWidth={0}>
        {sha.analysisBasis.groundMotionParameters.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setParameterEditor({ title: item.name, subtitle: "Parameter shared by hazard, fragility, and plant response", focus: ["seismicHazardAnalysis", "analysisBasis", "groundMotionParameters", index], visibleRootFields: groundMotionFields, removeLabel: "Remove parameter" })}><td><strong>{item.name}</strong><code>{[displayLabel(item.parameterType), item.dampingRatio === undefined ? undefined : `${item.dampingRatio * 100}% damping`].filter(Boolean).join(" · ")}</code></td><td>{displayLabel(item.direction)}</td><td>{item.selectedRange.minimum}–{item.selectedRange.maximum} {item.units}</td><td>{frequencyRangeLabel(item.selectedFrequencyRangeHz.lower, item.selectedFrequencyRangeHz.upper)}</td></tr>)}
      </Table>}
    </Section>

    <Section title="Calculation limits" description="Set the hazard calculation bounds." tone="sha" actions={<EditButton label="Edit limits" onClick={() => setBoundsOpen(true)} />}>
      <div className="sreadouts sreadouts--calculation-limits">
        <Readout label="Upper ground motion" value={`${bounds.maximumGroundMotion} ${bounds.groundMotionUnits}`} />
        <Readout label="Truncation effect" value={bounds.sequenceRankingUnaffected ? "None" : "Unresolved"} />
        <Readout label="Lower-bound magnitude" value={`${bounds.magnitudeScale} ${bounds.lowerBoundMagnitude}`} />
        <Readout label="Aleatory-tail limit" value={`ε = ${bounds.epsilonLimit}`} />
      </div>
    </Section>

    {basisOpen && <SiteAndPshaBasisEditor onClose={() => setBasisOpen(false)} />}
    {boundsOpen && <MefEditor tone="sha" title="Calculation limits" subtitle="Maximum motion, lower-bound magnitude, and epsilon truncation" focus={["seismicHazardAnalysis", "analysisBasis", "calculationBounds"]} visibleRootFields={["maximumGroundMotion", "groundMotionUnits", "truncationImpactEvaluation", "sequenceRankingUnaffected", "lowerBoundMagnitude", "magnitudeScale", "lowerBoundMagnitudeBasis", "epsilonLimit", "epsilonLimitBasis"]} onClose={() => setBoundsOpen(false)} />}
    <CollectionEditor tone="sha" target={parameterEditor} onClose={() => setParameterEditor(null)} />
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
        {inputs.dataSets.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setDataEditor({ title: item.name, subtitle: displayLabel(item.discipline), focus: ["seismicHazardAnalysis", "earthScienceInputs", "dataSets", index], visibleRootFields: dataFields, removeLabel: "Remove data set" })}><td><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td><Tag tone="sha">{displayLabel(item.discipline)}</Tag></td><td>{item.spatialCoverage}</td><td>{item.qualityAndLimitations}</td></tr>)}
      </Table>}
    </Section>

    <Section title="Models and methods" description="Sources assessed for potential hazard impact." tone="sha" actions={editable ? <AddButton label="Add source" onClick={() => setModelEditor({ title: "New model or method", subtitle: "Applicability, potential impact, and disposition", focus: [], createAt: ["seismicHazardAnalysis", "earthScienceInputs", "modelAndMethodInventory"], visibleRootFields: modelFields })} /> : undefined}>
      {inputs.modelAndMethodInventory.length === 0 ? <EmptyState title="No models or methods" detail="No new or existing technical source has been assessed." /> : <Table headers={["Source or model", "Type", "Applicability", "Hazard impact"]} minWidth={850}>
        {inputs.modelAndMethodInventory.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setModelEditor({ title: item.name, subtitle: item.sourceReference, focus: ["seismicHazardAnalysis", "earthScienceInputs", "modelAndMethodInventory", index], visibleRootFields: modelFields, removeLabel: "Remove source" })}><td><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td>{displayLabel(item.modelKind)}</td><td>{item.applicability}</td><td>{item.potentialImpactOnHazard}</td></tr>)}
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
        {source.earthquakeSources.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: displayLabel(item.sourceType), focus: ["seismicHazardAnalysis", "sourceCharacterization", "earthquakeSources", index], removeLabel: "Remove source" })}><td><strong>{item.name}</strong><code>{item.tectonicRegionType}</code></td><td><strong>{item.sourceType === item.geometry.geometryType ? displayLabel(item.sourceType) : `${displayLabel(item.sourceType)} / ${displayLabel(item.geometry.geometryType)}`}</strong><code>{item.faultMechanisms.map(displayLabel).join(", ")}</code></td><td>{item.geometry.closestDistanceToSiteKm === undefined ? "Not recorded" : `${item.geometry.closestDistanceToSiteKm} km`}</td><td>{sourceMagnitudeRange(item.magnitudeFrequencyModels)}</td></tr>)}
      </Table>}
    </Section>
    <Section title="Ground-motion models" description="Prediction ranges, variability, and weights." tone="sha" actions={<>
      <EditButton label="Edit basis" onClick={() => setGroundBasisOpen(true)} />
      {editable && <AddButton label="Add model" onClick={() => setCollectionEditor({ title: "New prediction model", subtitle: "Model range, source basis, logic-tree weight, and applicability", focus: [], createAt: ["seismicHazardAnalysis", "groundMotionCharacterization", "predictionModels"] })} />}
    </>}>
      {ground.predictionModels.length === 0 ? <EmptyState title="No prediction models" detail="No ground-motion prediction model has been selected." /> : <Table headers={["Prediction model", "Type", "Magnitude range", "Distance range", "Total sigma", "Weight"]} minWidth={920}>
        {ground.predictionModels.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: "Ground-motion prediction model", focus: ["seismicHazardAnalysis", "groundMotionCharacterization", "predictionModels", index], removeLabel: "Remove prediction model" })}><td><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td>{displayLabel(item.modelKind)}</td><td>M {item.magnitudeRange.minimum} to {item.magnitudeRange.maximum}</td><td>{item.distanceRangeKm.minimum} to {item.distanceRangeKm.maximum} km</td><td>{item.sigmaComponents?.total ?? "Not recorded"}</td><td>{item.logicTreeWeight.toFixed(2)}</td></tr>)}
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
        <tr><td><strong>Topography</strong></td><td>{topography.topographicDescription || "Not defined"}</td></tr>
        <tr><td><strong>Surficial deposits</strong></td><td>{topography.surficialDepositDescription || "Not defined"}</td></tr>
        <tr><td><strong>Geologic structure</strong></td><td>{topography.geologicStructureDescription || "Not defined"}</td></tr>
        <tr><td><strong>Topographic effects</strong></td><td>{topography.topographicEffectsTreatment || "Not evaluated"}</td></tr>
      </Table>
    </Section>
    <Section title="Site profiles" description="Weighted subsurface branches used in the response analysis." tone="sha" actions={editable ? <AddButton label="Add profile" onClick={() => setProfileIndex(null)} /> : undefined}>
      {site.profiles.length === 0 ? <EmptyState title="No site profiles" detail="Add the subsurface profiles used by the local response analysis." /> : <Table headers={["Profile", "Layers", "Vs range", "Depths", "Weight"]} minWidth={0}>
        {site.profiles.map((profile, index) => <tr className="postable__row--clickable" key={profile.uuid} onClick={() => setProfileIndex(index)}>
          <td><strong>{profile.name}</strong><code>{displayLabel(profile.profileType)}</code></td>
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
            <td><strong>{result.name}</strong></td>
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
            <td><strong>{parameter.name}</strong><code>{displayLabel(parameter.direction)} · {parameter.uuid}</code></td>
            <td><strong>{motionAtFrequency(meanCurve, 1e-4)}</strong></td>
            <td>{motionAtFrequency(meanCurve, 1e-5)}</td>
            <td>{curves.length === 0 ? "None" : `Mean + ${curves.filter((curve) => curve.statistic === "FRACTILE").length} fractiles`}</td>
            <td>{meanCurve === undefined ? "Not calculated" : numericRange(meanCurve.points.map((point) => point.groundMotion), meanCurve.groundMotionUnits)}</td>
          </tr>;
        })}
      </Table>}
      <Table caption="Calculation runs" headers={["Run", "Software", "Logic-tree branches", "Annual-frequency range", "Checks"]} minWidth={0} columnWidths={["28%", "18%", "18%", "24%", "12%"]}>
        {quant.calculationRuns.map((run) => <tr key={run.uuid}>
          <td><strong>{run.name}</strong><code>{run.calculationDate}</code></td>
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
          <td><strong>{interval.name}</strong></td>
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
          <td><strong>{parameterName(result.groundMotionParameterRef)}</strong><code>{result.groundMotionLevel} {result.groundMotionUnits}</code></td>
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
            <td><strong>{spectrum.name}</strong><code>{(spectrum.dampingRatio * 100).toFixed(0)}% · {spectrum.controlPointRef}</code></td>
            <td>Horizontal</td>
            <td className="smono">{annualFrequency(spectrum.annualFrequencyOfExceedance)}</td>
            <td>{numericRange(spectrum.points.map((point) => point.spectralAcceleration), "g")}</td>
            <td>{basis === undefined ? "UHS interpolation" : `Site-specific M ${basis.meanMagnitude.toFixed(2)}, R ${basis.meanDistanceKm.toFixed(0)} km`}</td>
          </tr>;
        })}
        {spectra.verticalSpectra.map((spectrum, index) => {
          const basis = spectra.verticalSpectrumBases.find((item) => item.spectrumRef === spectrum.uuid);
          return <tr className="postable__row--clickable" key={spectrum.uuid} onClick={() => setSpectrumTarget({ direction: "vertical", index })}>
            <td><strong>{spectrum.name}</strong><code>{(spectrum.dampingRatio * 100).toFixed(0)}% · {spectrum.controlPointRef}</code></td>
            <td>Vertical</td>
            <td className="smono">{annualFrequency(spectrum.annualFrequencyOfExceedance)}</td>
            <td>{numericRange(spectrum.points.map((point) => point.spectralAcceleration), "g")}</td>
            <td>{basis === undefined ? "Not defined" : displayLabel(basis.methodType)}</td>
          </tr>;
        })}
      </Table>
      <Table caption="Foundation inputs" headers={["Input", "Structure", "Horizontal spectrum", "Vertical spectrum", "Control point"]} minWidth={0} columnWidths={["24%", "20%", "19%", "19%", "18%"]}>
        {spectra.foundationInputResponseSpectra.map((input) => <tr key={input.uuid}>
          <td><strong>{input.name}</strong></td>
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
            <td><strong>{study.name ?? study.uuid}</strong></td>
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
  const retainedFloods = retainedHazards.filter((hazard) => hazard.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING" && hazard.externalFloodingInterface !== undefined);
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
          <td><strong>{hazard.name}</strong><code>{displayLabel(hazard.hazardType)}</code></td>
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
              <td><strong>{analysis.hazardParameter}</strong><code>{analysis.parameterUnits} | {analysis.outputRefs.join(", ") || "No output"}</code></td>
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
            <td><strong>{example.hazard}</strong><code>Illustrative example</code></td>
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
            <td><strong>{hazard.name}</strong></td>
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
  const [draft, setDraft] = useState<SelDevelopment>(() =>
    structuredClone(mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment));
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
  return <Drawer eyebrow={EDITOR_LABELS.spr} title="Equipment-list basis" subtitle="Scope sources, failure modes, coordination, and revision control" plainHeader onClose={onClose} footer={<>
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
  const [draft, setDraft] = useState<SelEntry>(() => structuredClone(original));
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
  return <Drawer eyebrow={EDITOR_LABELS.spr} title={draft.name} subtitle="SSC identity, selection source, failure modes, and fragility treatment" plainHeader onClose={onClose} footer={<>
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
          <Field label="Fragility mechanisms" hint="Separate references with commas."><TextInput value={mode.fragilityMechanismRefs.join(", ")} onChange={(value) => changeFailureMode(modeIndex, { fragilityMechanismRefs: technicalList(value) })} /></Field>
          <Field label="Failure effect"><TextArea rows={2} value={mode.consequenceDescription} onChange={(value) => changeFailureMode(modeIndex, { consequenceDescription: value })} /></Field>
          {editable && draft.failureModes.length > 1 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, failureModes: current.failureModes.filter((_, candidate) => candidate !== modeIndex) }))}>Remove failure mode</button>}
        </div>)}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDraft((current) => ({ ...current, failureModes: [...current.failureModes, newSelFailureMode()] }))}>Add failure mode</button>}
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Fragility treatment</h3>
        <FieldGrid>
          <Field label="Disposition"><SelectInput value={draft.disposition} options={["ACTIVE", "INHERENTLY_RUGGED", "ABOVE_FRAGILITY_THRESHOLD", "REMOVED_FROM_MODEL"].map((value) => ({ value, label: displayLabel(value) }))} onChange={(value) => setDraft((current) => ({ ...current, disposition: value as SelEntry["disposition"] }))} /></Field>
          <Field label="Fragility reference"><TextInput value={draft.fragilityAnalysisRef ?? ""} onChange={(value) => setDraft((current) => ({ ...current, fragilityAnalysisRef: value || undefined }))} /></Field>
        </FieldGrid>
        <Field label="Correlation groups" hint="Separate references with commas."><TextInput value={draft.correlationGroupRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, correlationGroupRefs: technicalList(value) }))} /></Field>
        <Field label="Disposition basis"><TextArea rows={3} value={draft.dispositionBasis} onChange={(value) => setDraft((current) => ({ ...current, dispositionBasis: value }))} /></Field>
      </div>
    </fieldset>
  </Drawer>;
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

function ResponseBasisEditor({ onClose }: { onClose: () => void }): JSX.Element {
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
  return <Drawer eyebrow={EDITOR_LABELS.sfr} title="Structural-response basis" subtitle="Shared motion, three components, median response, and approximation control" plainHeader onClose={onClose} footer={<>
    <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
    {editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}>Save basis</button>}
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
        <Field label="Approximation and scaling bias"><TextArea rows={4} value={draft.approximationBiasAssessment} onChange={(value) => setDraft((current) => ({ ...current, approximationBiasAssessment: value }))} /></Field>
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
          <Field label="Horizontal components" hint="Separate references with commas."><TextArea rows={3} value={draft.horizontalComponentRefs.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, horizontalComponentRefs: technicalList(value) }))} /></Field>
          <Field label="Vertical component"><TextInput value={draft.verticalComponentRef} onChange={(value) => setDraft((current) => ({ ...current, verticalComponentRef: value }))} /></Field>
        </FieldGrid>
      </div>
      <div className="sinlineeditor__group">
        <h3 className="sinlineeditor__title">Applicable range</h3>
        <FieldGrid>
          <Field label="Lower motion"><NumberInput value={draft.hazardRangeOfInterest.lowerGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, hazardRangeOfInterest: { ...current.hazardRangeOfInterest, lowerGroundMotion: value } }))} /></Field>
          <Field label="Upper motion"><NumberInput value={draft.hazardRangeOfInterest.upperGroundMotion} onChange={(value) => setDraft((current) => ({ ...current, hazardRangeOfInterest: { ...current.hazardRangeOfInterest, upperGroundMotion: value } }))} /></Field>
        </FieldGrid>
        <Field label="Range basis"><TextArea rows={3} value={draft.hazardRangeOfInterest.basis} onChange={(value) => setDraft((current) => ({ ...current, hazardRangeOfInterest: { ...current.hazardRangeOfInterest, basis: value } }))} /></Field>
        <Field label="Selection method"><TextArea rows={3} value={draft.selectionMethod} onChange={(value) => setDraft((current) => ({ ...current, selectionMethod: value }))} /></Field>
        <Field label="Selection validation"><TextArea rows={3} value={draft.selectionValidation} onChange={(value) => setDraft((current) => ({ ...current, selectionValidation: value }))} /></Field>
        <Field label="Nonlinear behavior"><TextArea rows={3} value={draft.nonlinearBehaviorBasis} onChange={(value) => setDraft((current) => ({ ...current, nonlinearBehaviorBasis: value }))} /></Field>
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
        <Field label="Method basis"><TextArea rows={4} value={draft.exclusionOrMethodBasis} onChange={(value) => setDraft((current) => ({ ...current, exclusionOrMethodBasis: value }))} /></Field>
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
  const [selBasisOpen, setSelBasisOpen] = useState(false);
  const [selIndex, setSelIndex] = useState<number | null | undefined>(undefined);
  const [responseBasisOpen, setResponseBasisOpen] = useState(false);
  const [referenceIndex, setReferenceIndex] = useState<number | null | undefined>(undefined);
  const [modelIndex, setModelIndex] = useState<number | null | undefined>(undefined);
  const [resultIndex, setResultIndex] = useState<number | null | undefined>(undefined);
  const [ssiIndex, setSsiIndex] = useState<number | null | undefined>(undefined);
  const [simulationIndex, setSimulationIndex] = useState<number | null | undefined>(undefined);
  const [selectedResponseRef, setSelectedResponseRef] = useState(response.responseResults[0]?.uuid ?? "");
  const selectedResponse = response.responseResults.find((result) => result.uuid === selectedResponseRef)
    ?? response.responseResults[0];
  const responseFan = useMemo(
    () => structuralResponseFanSeries(selectedResponse),
    [selectedResponse],
  );
  return <>
    <Section title="Seismic equipment list" description="SSCs and failure modes selected from plant-response logic." tone="spr" actions={<>
      <EditButton label="Edit basis" onClick={() => setSelBasisOpen(true)} />
      {editable && <AddButton label="Add SSC" onClick={() => setSelIndex(null)} />}
    </>}>
      {sel.equipment.length === 0 ? <TechnicalEmptyState title="No seismic equipment" detail="Select SSCs and failure modes from the plant-response model." /> : <Table headers={["SSC", "Credited function", "Failure mode", "Selected from", "Fragility treatment"]} minWidth={0} columnWidths={["23%", "23%", "22%", "16%", "16%"]} className="stable--wrapheads">
        {sel.equipment.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setSelIndex(index)}>
          <td><strong>{item.name}</strong><code>{displayLabel(item.sscType)} | {item.building} | {item.roomOrArea ?? "Area not defined"} | {item.elevation ?? "Elevation not defined"}</code></td>
          <td>{item.creditedFunctions.join("; ") || "Not defined"}</td>
          <td>{item.failureModes.map((mode) => mode.name).join("; ") || "Not defined"}<code>{item.failureModes.map((mode) => displayLabel(mode.failureModeType)).join(" | ")}</code></td>
          <td>{item.inclusionSources.map(displayLabel).join("; ")}</td>
          <td><Tag tone={item.disposition === "ACTIVE" ? "spr" : item.disposition === "REMOVED_FROM_MODEL" ? "neutral" : "good"}>{displayLabel(item.disposition)}</Tag><code>{item.fragilityAnalysisRef ?? item.dispositionBasis}</code></td>
        </tr>)}
      </Table>}
    </Section>
    <Section title="Reference motion and structural models" description="Hazard-consistent three-direction input and realistic 3-D response models." tone="sfr" actions={<>
      <EditButton label="Edit basis" onClick={() => setResponseBasisOpen(true)} />
      {editable && <AddButton label="Add earthquake" onClick={() => setReferenceIndex(null)} />}
      {editable && <AddButton label="Add model" onClick={() => setModelIndex(null)} />}
    </>}>
      <Table caption="Reference earthquakes" headers={["Reference earthquake", "Annual frequency", "Input motion", "Hazard range", "Components"]} minWidth={0} columnWidths={["25%", "14%", "21%", "20%", "20%"]} className="stable--wrapheads">
        {response.referenceEarthquakes.map((earthquake, index) => <tr className="postable__row--clickable" key={earthquake.uuid} onClick={() => setReferenceIndex(index)}>
          <td><strong>{earthquake.name}</strong><code>{earthquake.hazardSpectrumRef}</code></td>
          <td className="smono">{earthquake.annualFrequencyOfExceedance === undefined ? "Not defined" : annualFrequency(earthquake.annualFrequencyOfExceedance)}</td>
          <td><strong>{earthquake.groundMotionLevel} {earthquake.groundMotionUnits}</strong><code>{earthquake.groundMotionParameterRef} | {earthquake.controlPointRef}</code></td>
          <td>{earthquake.hazardRangeOfInterest.lowerGroundMotion}-{earthquake.hazardRangeOfInterest.upperGroundMotion} {earthquake.groundMotionUnits}</td>
          <td>{earthquake.horizontalComponentRefs.length} horizontal + 1 vertical</td>
        </tr>)}
      </Table>
      <Table caption="Structural models" headers={["Structural model", "Condition", "Dynamic model", "Foundation and SSI boundary", "Verification"]} minWidth={0} columnWidths={["24%", "13%", "21%", "24%", "18%"]} className="stable--wrapheads">
        {response.structuralModels.map((model, index) => {
          const frequencies = model.modalProperties.map((mode) => mode.frequencyHz);
          const participation = model.modalProperties.reduce((sum, mode) => sum + mode.massParticipationFraction, 0);
          return <tr className="postable__row--clickable" key={model.uuid} onClick={() => setModelIndex(index)}>
            <td><strong>{model.name}</strong><code>{model.structureRef} | {model.softwareAndVersion}</code></td>
            <td>{displayLabel(model.asModeledCondition)}</td>
            <td><strong>{displayLabel(model.modelType)}</strong><code>{model.modalProperties.length} modes | {numericRange(frequencies, "Hz")} | participation {participation.toFixed(2)}</code></td>
            <td>{model.foundationAndEmbedment}</td>
            <td>{model.verificationAndValidation}</td>
          </tr>;
        })}
      </Table>
      <Table caption="Scaling checks" headers={["Target response", "Scale factor", "Target spectrum", "Model and foundation", "Nonlinear check"]} minWidth={0} columnWidths={["23%", "11%", "16%", "26%", "24%"]} className="stable--wrapheads">
        {response.scalingEvaluations.map((scaling) => <tr key={scaling.uuid}>
          <td><strong>{scaling.name}</strong><code>{scaling.sourceResponseAnalysisRef}</code></td>
          <td className="smono">{scaling.scaleFactor.toFixed(3)}</td>
          <td>{scaling.targetSpectrumRef}</td>
          <td>{scaling.structuralModelSimilarity}<code>{scaling.foundationSimilarity}</code></td>
          <td>{scaling.nonlinearPhenomenaEvaluation}</td>
        </tr>)}
      </Table>
    </Section>

    <Section title="Response distributions and stability" description="Median demand, variability, SSI, and simulation convergence." tone="sfr" actions={<>
      {editable && <AddButton label="Add response" onClick={() => setResultIndex(null)} />}
      {editable && <AddButton label="Add SSI" onClick={() => setSsiIndex(null)} />}
      {editable && <AddButton label="Add simulation" onClick={() => setSimulationIndex(null)} />}
    </>}>
      {selectedResponse === undefined ? <TechnicalEmptyState title="No response results" detail="Calculate structural loads or floor-response spectra for the selected SSC locations." /> : <>
        <div className="sdistribution__head">
          <div><strong>{selectedResponse.name}</strong><span>{selectedResponse.responseModelRef} | {selectedResponse.referenceEarthquakeRef}</span></div>
          <label className="splotselect"><span>Response location</span><select className="sinput" aria-label="Response distribution" value={selectedResponse.uuid} onChange={(event) => setSelectedResponseRef(event.target.value)}>
            {response.responseResults.map((result) => <option key={result.uuid} value={result.uuid}>{result.name}</option>)}
          </select></label>
        </div>
        <DistributionFanChart points={responseFan} xLabel="Frequency (Hz, log scale)" yLabel={`Response (${selectedResponse.units})`} ariaLabel={`${selectedResponse.name} median response and 5th through 95th percentile distribution`} />
      </>}
      <Table caption="Response results" headers={["Response", "Model and direction", "Median range", "Variability", "Applicable SSCs"]} minWidth={0} columnWidths={["25%", "20%", "17%", "16%", "22%"]} className="stable--wrapheads">
        {response.responseResults.map((result, index) => {
          const medians = result.spectrumPoints?.map((point) => point.medianResponse)
            ?? (result.medianValue === undefined ? [] : [result.medianValue]);
          return <tr className="postable__row--clickable" key={result.uuid} onClick={() => { setSelectedResponseRef(result.uuid); setResultIndex(index); }}>
            <td><strong>{result.name}</strong><code>{result.location}</code></td>
            <td>{result.responseModelRef}<code>{result.direction} | {displayLabel(result.responseQuantity)}</code></td>
            <td><strong>{numericRange(medians, result.units)}</strong><code>{result.spectrumPoints?.length ?? 1} result points</code></td>
            <td>Beta R {result.betaRandomness.toFixed(3)}<code>Beta U {result.betaUncertainty.toFixed(3)} | composite {(result.compositeBeta ?? Math.sqrt(result.betaRandomness ** 2 + result.betaUncertainty ** 2)).toFixed(3)}</code></td>
            <td>{result.applicableSscRefs.join(", ")}</td>
          </tr>;
        })}
      </Table>
      <Table caption="Soil-structure interaction" headers={["Analysis", "Method", "Profiles", "Response outputs", "Technical basis"]} minWidth={0} columnWidths={["23%", "21%", "14%", "16%", "26%"]} className="stable--wrapheads">
        {response.soilStructureInteractionAnalyses.map((ssi, index) => <tr className="postable__row--clickable" key={ssi.uuid} onClick={() => setSsiIndex(index)}>
          <td><strong>{ssi.name}</strong><code>{ssi.applicable ? "Included" : "Not applicable"} | {ssi.analysisType === undefined ? "Method not defined" : displayLabel(ssi.analysisType)}</code></td>
          <td>{ssi.method ?? "Not defined"}<code>{ssi.strainCompatibleProperties ? "Strain-compatible properties" : "Nominal soil properties"}</code></td>
          <td>{ssi.soilProfileRefs.join(", ")}</td>
          <td>{ssi.medianResponseResultRefs.length} median | {ssi.uncertaintyResultRefs.length} uncertainty</td>
          <td>{ssi.significanceAssessment}</td>
        </tr>)}
      </Table>
      <Table caption="Probabilistic response convergence" headers={["Simulation", "Trials and motion sets", "Sampled variables", "Convergence criterion", "Result"]} minWidth={0} columnWidths={["22%", "16%", "25%", "25%", "12%"]} className="stable--wrapheads">
        {response.probabilisticSimulations.map((simulation, index) => {
          const final = simulation.convergenceResults.at(-1);
          return <tr className="postable__row--clickable" key={simulation.uuid} onClick={() => setSimulationIndex(index)}>
            <td><strong>{simulation.name}</strong><code>{displayLabel(simulation.method)}</code></td>
            <td><strong>{simulation.simulationCount} trials</strong><code>{simulation.inputMotionSetCount} sets x {simulation.componentsPerSet} components</code></td>
            <td>{simulation.sampledAleatoryVariables.join(", ")}<code>{simulation.sampledEpistemicVariables.join(", ")}</code></td>
            <td>{simulation.convergenceCriterion}</td>
            <td><Tag tone={simulation.stableResponsesDemonstrated ? "good" : "warn"}>{simulation.stableResponsesDemonstrated ? "Stable" : "Open"}</Tag><code>{final === undefined ? "No metric" : `${(final.metricValue * 100).toFixed(2)}% at ${final.sampleCount}`}</code></td>
          </tr>;
        })}
      </Table>
    </Section>

    {selBasisOpen && <SelBasisEditor onClose={() => setSelBasisOpen(false)} />}
    {selIndex !== undefined && <SelEntryEditor index={selIndex} onClose={() => setSelIndex(undefined)} />}
    {responseBasisOpen && <ResponseBasisEditor onClose={() => setResponseBasisOpen(false)} />}
    {referenceIndex !== undefined && <ReferenceEarthquakeEditor index={referenceIndex} onClose={() => setReferenceIndex(undefined)} />}
    {modelIndex !== undefined && <StructuralModelEditor index={modelIndex} onClose={() => setModelIndex(undefined)} />}
    {resultIndex !== undefined && <ResponseResultEditor index={resultIndex} onClose={() => setResultIndex(undefined)} />}
    {ssiIndex !== undefined && <SsiAnalysisEditor index={ssiIndex} onClose={() => setSsiIndex(undefined)} />}
    {simulationIndex !== undefined && <SimulationEditor index={simulationIndex} onClose={() => setSimulationIndex(undefined)} />}
  </>;
}

function ThresholdInvestigationScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const threshold = mef.seismicFragilityAnalysis.thresholdProgram;
  const investigations = mef.seismicFragilityAnalysis.plantInvestigations;
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [collectionEditor, setCollectionEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SFR · HLR-C" title="Ruggedness and fragility thresholds" description="Capacity-based screening includes ruggedness bases, methods, anchorage, supports, caveats, correlations, cumulative count, and final model confirmation." tone="sfr" actions={editable ? <CategorizedAddButton label="Add threshold entry" title="Add threshold entry" options={[
      { label: "Ruggedness basis", description: "A generic or plant-specific inherently rugged equipment basis.", title: "New ruggedness basis", subtitle: "Reference motion, component types, guidance, exclusions, and capacity basis", createAt: ["seismicFragilityAnalysis", "thresholdProgram", "inherentlyRuggedBases"] },
      { label: "Threshold method", description: "A capacity-based screening or fragility-threshold method.", title: "New threshold method", subtitle: "Capacity, control point, correlation, screening sources, caveats, and comparison method", createAt: ["seismicFragilityAnalysis", "thresholdProgram", "thresholdMethods"] },
    ]} onChoose={setCollectionEditor} /> : undefined}>
      <SectionEditorRow title="Threshold-program basis" description="Screening confirmation, anchorage and support, screened SSC scope, and requirement coverage." onClick={() => setThresholdOpen(true)} />
      <div className="sreadouts"><Readout label="Rugged bases" value={threshold.inherentlyRuggedBases.length} /><Readout label="Threshold methods" value={threshold.thresholdMethods.length} /><Readout label="Screened SSCs" value={threshold.screenedSscRefs.length} /><Readout label="Anchorage and support" value={threshold.anchorageAndSupportIncluded ? "Included" : "Open"} /></div>
      <Narrative label="Screening confirmation method" value={threshold.screeningConfirmationMethod} />
      <Table caption="Ruggedness bases" headers={["Ruggedness basis", "Ground-motion parameter", "Generic types", "Plant additions", "Exclusions", ""]}>
        {threshold.inherentlyRuggedBases.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: "Inherently rugged equipment basis", focus: ["seismicFragilityAnalysis", "thresholdProgram", "inherentlyRuggedBases", index], removeLabel: "Remove ruggedness basis" })}><td><strong>{item.name}</strong><code>{item.hazardIndependentBasis}</code></td><td>{item.referenceGroundMotionParameter}</td><td>{item.genericRuggedComponentTypes.length}</td><td>{item.plantSpecificAdditions.length}</td><td>{item.excludedComponentTypes.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
      <Table caption="Threshold methods" headers={["Threshold method", "Capacity", "Ground-motion parameter", "Control point", "SCR-2", ""]}>
        {threshold.thresholdMethods.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: "Fragility threshold method", focus: ["seismicFragilityAnalysis", "thresholdProgram", "thresholdMethods", index], removeLabel: "Remove threshold method" })}><td><strong>{item.name}</strong><code>{item.plantResponseThresholdRef}</code></td><td>{item.thresholdCapacity} {item.capacityUnits}</td><td>{item.groundMotionParameterRef}</td><td>{item.controlPointRef}</td><td><Tag tone={item.satisfiesScr2 ? "good" : "warn"}>{item.satisfiesScr2 ? "Satisfied" : "Open"}</Tag></td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    <Section eyebrow="SFR · HLR-D" title="Plant investigations" description="Walkdowns and design reviews address condition, load paths, spatial interactions, fire/flood sources, and team qualifications." tone="sfr" actions={editable ? <AddButton label="Add investigation" onClick={() => setCollectionEditor({ title: "New plant investigation", subtitle: "Investigation type, date, team, reviewed SSCs, findings, and limitations", focus: [], createAt: ["seismicFragilityAnalysis", "plantInvestigations"] })} /> : undefined}>
      {investigations.length === 0 ? <EmptyState title="No investigations recorded" detail="No walkdown, computerized review, or design-document investigation is recorded." /> : <Table headers={["Investigation", "Type and date", "Coverage", "Findings", ""]}>
        {investigations.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: displayLabel(item.investigationType), focus: ["seismicFragilityAnalysis", "plantInvestigations", index], removeLabel: "Remove investigation" })}><td><strong>{item.name}</strong><code>{item.scope}</code></td><td><strong>{displayLabel(item.investigationType)}</strong><code>{item.date ?? "Date pending"}</code></td><td>{item.team.length} team members · {item.sscRefsReviewed.length} SSCs</td><td><Tag tone={item.limitations.length === 0 ? "good" : "warn"}>{item.findings.length} findings</Tag></td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>}
    </Section>
    {thresholdOpen && <MefEditor tone="sfr" title="Fragility-threshold program" subtitle="Ruggedness bases, threshold methods, screening confirmation, limitations, and final model treatment" focus={["seismicFragilityAnalysis", "thresholdProgram"]} onClose={() => setThresholdOpen(false)} />}
    <CollectionEditor tone="sfr" target={collectionEditor} onClose={() => setCollectionEditor(null)} />
  </>;
}

function FragilityResultsScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const results = mef.seismicFragilityAnalysis.results;
  const selected = results.fragilityEvaluations[0];
  const [basisOpen, setBasisOpen] = useState(false);
  const [fragilityEditor, setFragilityEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SFR · HLR-E" title="Fragility results" description="Controlling mechanisms, median capacities, randomness, uncertainty, HCLPF, curves, specialized failures, correlation, sensitivity, and plant-model transfer." tone="sfr" actions={editable ? <AddButton label="Add fragility" onClick={() => setFragilityEditor({ title: "New fragility evaluation", subtitle: "SSC failure mode, capacity, uncertainty, curve, correlation, and transfer", focus: [], createAt: ["seismicFragilityAnalysis", "results", "fragilityEvaluations"] })} /> : undefined}>
      <SectionEditorRow title="Fragility-results basis" description="Failure mechanisms, correlation, specialized sources, uncertainty, sensitivity, and SPR transfer." onClick={() => setBasisOpen(true)} />
      {selected !== undefined && <><div className="scharthead"><div><strong>{selected.name}</strong><span>Median {selected.medianCapacity} {selected.capacityUnits} · βR {selected.betaRandomness} · βU {selected.betaUncertainty}</span></div><Tag tone="sfr">HCLPF {selected.highConfidenceLowProbabilityOfFailureCapacity ?? "—"}</Tag></div><LineChart series={selected.meanFragilityCurve.map((point) => ({ x: point.groundMotion, y: Math.max(point.conditionalFailureProbability, 1e-4) }))} xLabel={`Ground motion (${selected.capacityUnits})`} yLabel="Conditional failure probability" color="#b05a2b" /></>}
      <Table headers={["Fragility", "SSC and failure mode", "Capacity", "Variability", "Importance", ""]}>
        {results.fragilityEvaluations.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setFragilityEditor({ title: item.name, subtitle: `${item.sscRef} · ${item.systemsFailureModeRef}`, focus: ["seismicFragilityAnalysis", "results", "fragilityEvaluations", index], removeLabel: "Remove fragility" })}><td><strong>{item.name}</strong><code>{displayLabel(item.analysisCategory)}</code></td><td><strong>{item.sscRef}</strong><code>{item.systemsFailureModeRef}</code></td><td><strong>Median {item.medianCapacity} {item.capacityUnits}</strong><code>HCLPF {item.highConfidenceLowProbabilityOfFailureCapacity ?? "—"}</code></td><td>βR {item.betaRandomness} · βU {item.betaUncertainty}</td><td><Tag tone={item.riskSignificance === "HIGH" ? "warn" : "neutral"}>{displayLabel(item.riskSignificance)}</Tag></td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    {basisOpen && <MefEditor tone="sfr" title="Fragility analysis results" subtitle="Mechanisms, evaluations, curves, correlation, specialized sources, uncertainty, sensitivity, and SPR transfer" focus={["seismicFragilityAnalysis", "results"]} onClose={() => setBasisOpen(false)} />}
    <CollectionEditor tone="sfr" target={fragilityEditor} onClose={() => setFragilityEditor(null)} />
  </>;
}

function PlantModelScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const initiators = mef.seismicPlantResponseAnalysis.initiatingEventIdentification;
  const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
  const all = [...initiators.directInitiators.map((item, collectionIndex) => ({ item, collectionIndex, collection: "directInitiators" as const })), ...initiators.secondaryHazardInitiators.map((item, collectionIndex) => ({ item, collectionIndex, collection: "secondaryHazardInitiators" as const }))];
  const [initiatorBasisOpen, setInitiatorBasisOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [eventEditor, setEventEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SPR · HLR-A" title="Seismic initiating events" description="Direct ground motion, retained secondary hazards, industry experience, risk significance, completeness, and multi-reactor effects." tone="spr" actions={editable ? <CategorizedAddButton label="Add initiating event" title="Add initiating event" options={[
      { label: "Direct ground-motion event", description: "An initiating event caused directly by seismic ground motion.", title: "New direct initiating event", subtitle: "Ground-motion origin, screening, affected SSCs, sequences, and units", createAt: ["seismicPlantResponseAnalysis", "initiatingEventIdentification", "directInitiators"] },
      { label: "Secondary-hazard event", description: "An initiating event caused by a retained secondary seismic hazard.", title: "New secondary-hazard initiating event", subtitle: "Secondary-hazard origin, screening, affected SSCs, sequences, and units", createAt: ["seismicPlantResponseAnalysis", "initiatingEventIdentification", "secondaryHazardInitiators"] },
    ]} onChoose={setEventEditor} /> : undefined}>
      <SectionEditorRow title="Initiating-event basis" description="Identification process, screening, operating states, experience, risk significance, and completeness." onClick={() => setInitiatorBasisOpen(true)} />
      <Table headers={["Initiating event", "Origin and disposition", "Model coverage", ""]}>
        {all.map(({ item, collection, collectionIndex }) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setEventEditor({ title: item.name, subtitle: displayLabel(item.origin), focus: ["seismicPlantResponseAnalysis", "initiatingEventIdentification", collection, collectionIndex], removeLabel: "Remove initiating event" })}><td><strong>{item.name}</strong><code>{item.description}</code></td><td><strong>{displayLabel(item.origin)}</strong><Tag tone={item.retained ? "warn" : "good"}>{item.retained ? "Retained" : "Screened"}</Tag></td><td>{item.affectedSscRefs.length} SSCs · {item.eventSequenceRefs.length} sequences · {item.reactorUnitRefs.length} units</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    <Section eyebrow="SPR · HLR-B" title="Plant-response model" description="The internal-events base model is adapted for peer-review findings, seismic failures, thresholds, correlation, chatter, mission time, retained hazards, new logic, and multi-unit effects." tone="spr" actions={<EditButton label="Edit plant model" onClick={() => setModelOpen(true)} />}>
      <div className="sreadouts"><Readout label="Induced failures" value={model.inducedFailures.length} /><Readout label="Fragility thresholds" value={model.fragilityThresholds.length} /><Readout label="Mission-time assessments" value={model.missionTimeAssessments.length} /><Readout label="Retained hazard models" value={model.retainedHazardModels.length} /></div>
      <Narrative label="Completeness and consistency review" value={model.completenessAndConsistencyReview} />
    </Section>
    {initiatorBasisOpen && <MefEditor tone="spr" title="Initiating-event identification" subtitle="Systematic process, direct and secondary initiators, operating states, experience, risk significance, and completeness" focus={["seismicPlantResponseAnalysis", "initiatingEventIdentification"]} onClose={() => setInitiatorBasisOpen(false)} />}
    {modelOpen && <MefEditor tone="spr" title="Plant-response model" subtitle="Base models, failures, dependencies, thresholds, chatter, mission time, retained hazards, logic, and multi-reactor treatment" focus={["seismicPlantResponseAnalysis", "plantResponseModel"]} onClose={() => setModelOpen(false)} />}
    <CollectionEditor tone="spr" target={eventEditor} onClose={() => setEventEditor(null)} />
  </>;
}

function HumanReliabilityScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const hra = mef.seismicPlantResponseAnalysis.humanReliabilityModel;
  const [basisOpen, setBasisOpen] = useState(false);
  const [actionEditor, setActionEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SPR · HLR-D" title="Seismic human reliability" description="Relevant actions are evaluated for seismic performance-shaping factors, timing, feasibility, dependency, recovery, requirement compliance, and quantification." tone="spr" actions={editable ? <AddButton label="Add human action" onClick={() => setActionEditor({ title: "New seismic human action", subtitle: "Location, timing, feasibility, dependency, HEP, recovery, and requirement compliance", focus: [], createAt: ["seismicPlantResponseAnalysis", "humanReliabilityModel", "humanActions"] })} /> : undefined}>
      <SectionEditorRow title="Human-reliability basis" description="Seismic challenges, timing, feasibility, dependency, recovery, and requirement compliance." onClick={() => setBasisOpen(true)} />
      <Table headers={["Human action", "Location", "Timing", "HEP", "Sequences", ""]}>
        {hra.humanActions.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setActionEditor({ title: item.name, subtitle: displayLabel(item.controlRoomOrExControlRoom), focus: ["seismicPlantResponseAnalysis", "humanReliabilityModel", "humanActions", index], removeLabel: "Remove human action" })}><td><strong>{item.name}</strong><code>{item.humanFailureEventRef}</code></td><td>{displayLabel(item.controlRoomOrExControlRoom)}</td><td><strong>{item.availableTime} {item.timeUnits} available</strong><code>{item.requiredTime} {item.timeUnits} required</code></td><td><Tag tone={item.humanErrorProbability <= .05 ? "good" : "warn"}>{item.humanErrorProbability}</Tag></td><td>{item.eventSequenceRefs.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
      <Narrative label="Seismic influence integration" value={hra.seismicInfluenceIntegration} />
    </Section>
    {basisOpen && <MefEditor tone="spr" title="Human-reliability model" subtitle="Action register, seismic challenges, timing, feasibility, dependency, probability, recovery, and requirement compliance" focus={["seismicPlantResponseAnalysis", "humanReliabilityModel"]} onClose={() => setBasisOpen(false)} />}
    <CollectionEditor tone="spr" target={actionEditor} onClose={() => setActionEditor(null)} />
  </>;
}

function QuantificationIntegrationScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const quant = mef.seismicPlantResponseAnalysis.quantification;
  const integration = mef.integration;
  const diagnostics = useMemo(() => validateSeismicPra(mef), [mef]);
  const blockerCount = diagnostics.filter((item) => item.severity === "ERROR").length;
  const warningCount = diagnostics.filter((item) => item.severity === "WARNING").length;
  const [quantOpen, setQuantOpen] = useState(false);
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [uncertaintyFocus, setUncertaintyFocus] = useState<EditorPath | null>(null);
  const [collectionEditor, setCollectionEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SPR · HLR-E" title="Integrated seismic quantification" description="Converged hazard discretization, rare-event treatment, mean results, uncertainty propagation, contributors, quality checks, and sensitivity studies." tone="spr" actions={editable ? <AddButton label="Add family result" onClick={() => setCollectionEditor({ title: "New family quantification", subtitle: "Family frequency, hazard-bin contributions, uncertainty, contributors, and quality", focus: [], createAt: ["seismicPlantResponseAnalysis", "quantification", "eventSequenceFamilyQuantifications"] })} /> : undefined}>
      <SectionEditorRow title="Quantification basis" description="Hazard discretization, rare-event treatment, uncertainty propagation, convergence, sensitivity, and quality." onClick={() => setQuantOpen(true)} />
      <Table headers={["Event-sequence family", "Frequency", "Hazard bins", "Uncertainty sources", ""]}>
        {quant.eventSequenceFamilyQuantifications.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: "Event-sequence family quantification", focus: ["seismicPlantResponseAnalysis", "quantification", "eventSequenceFamilyQuantifications", index], removeLabel: "Remove family result" })}><td><strong>{item.name}</strong><code>{item.eventSequenceFamilyRef}</code></td><td><strong className="smono">Mean {item.meanFrequency?.toExponential(3) ?? "—"}</strong><code>Point estimate {item.pointEstimateFrequency.toExponential(3)}</code></td><td>{item.hazardBinContributions.length}</td><td>{item.uncertaintyContributions.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    <Section eyebrow="SHA ⇄ SFR ⇄ SPR" title="Subelement integration and coverage" description="Producer-consumer records, selected references, coverage counts, multidisciplinary checks, integrated uncertainties, and sensitivities make consistency explicit." tone="integration" actions={editable ? <CategorizedAddButton label="Add integration entry" title="Add integration entry" options={[
      { label: "Subelement interface", description: "A producer-consumer transfer between SHA, SFR, and SPR.", title: "New subelement interface", subtitle: "Producer, consumer, payload, transfer basis, consistency, and evidence", createAt: ["integration", "interfaces"] },
      { label: "Consistency check", description: "A multidisciplinary check across selected references and subelements.", title: "New consistency check", subtitle: "Compared references, method, result, evidence, and open items", createAt: ["integration", "consistencyChecks"] },
    ]} onChoose={setCollectionEditor} /> : undefined}>
      <SectionEditorRow title="Integration basis and coverage" description="Selected references, coverage, unresolved interfaces, multidisciplinary review, and requirement mapping." onClick={() => setIntegrationOpen(true)} />
      <div className="sflow"><div><Tag tone="sha">SHA</Tag><strong>Hazard</strong><span>Curves · spectra · intervals · secondary hazards</span></div><b>→</b><div><Tag tone="sfr">SFR</Tag><strong>Fragility</strong><span>SEL scope · response · capacity · correlation</span></div><b>→</b><div><Tag tone="spr">SPR</Tag><strong>Plant response</strong><span>Initiators · logic · HRA · family frequencies</span></div></div>
      <Table headers={["Interface or check", "Flow or scope", "Status", "Evidence", ""]}>
        {integration.interfaces.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: `${item.producer} → ${item.consumer}`, focus: ["integration", "interfaces", index], removeLabel: "Remove interface" })}><td><strong>{item.name}</strong></td><td><strong>{item.producer} → {item.consumer}</strong><code>{displayLabel(item.payloadType)}</code></td><td><Tag tone={item.consistent ? "good" : "bad"}>{item.consistent ? "Consistent" : "Open"}</Tag></td><td>{item.transferBasis}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
        {integration.consistencyChecks.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: displayLabel(item.checkType), focus: ["integration", "consistencyChecks", index], removeLabel: "Remove consistency check" })}><td><strong>{item.name}</strong><code>{item.method}</code></td><td><strong>{item.subelements.join(" · ")}</strong><code>{displayLabel(item.checkType)}</code></td><td><Tag tone={item.result === "PASS" ? "good" : "warn"}>{displayLabel(item.result)}</Tag></td><td>{item.evidence}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    <Section eyebrow="Integrated interpretation" title="Uncertainty, sensitivity, and risk insights" description="Uncertainties are entered once at their source, then linked here to affected subelements, family results, sensitivity studies, combined effects, and closure actions." tone="integration" actions={editable ? <CategorizedAddButton label="Add analysis entry" title="Add uncertainty or sensitivity entry" options={[
      { label: "Integrated uncertainty", description: "A source uncertainty propagated across one or more subelements.", title: "New integrated uncertainty", subtitle: "Source, affected subelements, importance, propagation, sensitivities, and closure", createAt: ["integratedUncertainties"] },
      { label: "Sensitivity study", description: "A study of important assumptions, parameters, or model alternatives.", title: "New integrated sensitivity study", subtitle: "Varied parameters, ranges, results, insights, and uncertainty linkage", createAt: ["integratedSensitivityStudies"] },
    ]} onChoose={setCollectionEditor} /> : undefined}>
      <SectionEditorRow title="Uncertainty and risk-insight basis" description="Source linkage, combined effects, model uncertainty, assumptions, risk insights, and closure actions." onClick={() => setUncertaintyFocus([])} />
      {mef.integratedUncertainties.length === 0 ? <EmptyState title="No integrated uncertainties" detail="Link the important SHA, SFR, and SPR uncertainty sources and document their combined treatment." /> : <Table caption="Integrated uncertainties" headers={["Uncertainty", "Source and scope", "Importance", "Treatment", ""]}>
        {mef.integratedUncertainties.map((uncertainty, index) => <tr className="postable__row--clickable" key={uncertainty.uuid} onClick={() => setCollectionEditor({ title: uncertainty.name, subtitle: `${uncertainty.sourceSubelement} uncertainty`, focus: ["integratedUncertainties", index], removeLabel: "Remove uncertainty" })}><td><strong>{uncertainty.name}</strong><code>{uncertainty.sourceUncertaintyRef}</code></td><td><strong>{uncertainty.sourceSubelement}</strong><code>{uncertainty.affectedSubelements.join(" · ")}</code></td><td><Tag tone={uncertainty.importance === "HIGH" ? "warn" : "neutral"}>{displayLabel(uncertainty.importance)}</Tag></td><td>{uncertainty.propagationOrSensitivityTreatment}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>}
      {mef.integratedSensitivityStudies.length === 0 ? <EmptyState title="No integrated sensitivity studies" detail="Add studies that test important assumptions, parameters, and model alternatives." /> : <Table caption="Sensitivity studies" headers={["Sensitivity study", "Varied parameters", "Result and insight", ""]}>
        {mef.integratedSensitivityStudies.map((study, index) => <tr className="postable__row--clickable" key={study.uuid} onClick={() => setCollectionEditor({ title: study.name ?? `Sensitivity study ${index + 1}`, subtitle: "Integrated sensitivity study", focus: ["integratedSensitivityStudies", index], removeLabel: "Remove sensitivity study" })}><td><strong>{study.name ?? `Sensitivity study ${index + 1}`}</strong><code>{study.description}</code></td><td>{study.variedParameters.map(displayParameter).join(" · ")}</td><td><strong>{study.results ?? "Not recorded"}</strong><code>{study.insights ?? "Not recorded"}</code></td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>}
      <Narrative label="Integrated risk insights" value={mef.documentation.integratedRiskInsights} />
    </Section>
    <Section eyebrow="Automated controls" title="Completeness and consistency diagnostics" description="These checks combine schema validity, range and reference integrity, model coverage, interface closure, convergence, documentation, and conformance disposition." tone="integration">
      <div className="svalidation__summary"><Tag tone={blockerCount > 0 ? "bad" : "good"}>{blockerCount} blocker{blockerCount === 1 ? "" : "s"}</Tag><Tag tone={warningCount > 0 ? "warn" : "good"}>{warningCount} warning{warningCount === 1 ? "" : "s"}</Tag><span>Diagnostics update from the canonical MEF after every saved edit.</span></div>
      <DiagnosticTable diagnostics={diagnostics} />
    </Section>
    {quantOpen && <MefEditor tone="spr" title="Plant-response quantification" subtitle="Discretization, rare-event approximation, ESQ compliance, family results, uncertainty, contributors, sensitivity, and quality" focus={["seismicPlantResponseAnalysis", "quantification"]} onClose={() => setQuantOpen(false)} />}
    {integrationOpen && <MefEditor tone="integration" title="Seismic PRA integration" subtitle="All interfaces, consistency checks, selected references, coverage, unresolved items, integrated uncertainty, and sensitivity" focus={["integration"]} onClose={() => setIntegrationOpen(false)} />}
    <CollectionEditor tone={collectionEditor?.focus[0] === "seismicPlantResponseAnalysis" || collectionEditor?.createAt?.[0] === "seismicPlantResponseAnalysis" ? "spr" : "integration"} target={collectionEditor} onClose={() => setCollectionEditor(null)} />
    {uncertaintyFocus !== null && <StructuredEditorDrawer eyebrow="Integrated Seismic PRA" title={uncertaintyFocus[0] === "integratedUncertainties" ? "Integrated uncertainty register" : uncertaintyFocus[0] === "integratedSensitivityStudies" ? "Integrated sensitivity studies" : "Seismic PRA uncertainty package"} subtitle="Source uncertainty, assumptions, reasonable alternatives, combined effects, propagation, sensitivity, and closure actions" schema={UncertaintyPackageSchema} value={{
      integratedUncertainties: mef.integratedUncertainties,
      integratedSensitivityStudies: mef.integratedSensitivityStudies,
      modelUncertainty: mef.modelUncertainty,
      preOperationalAssumptions: mef.preOperationalAssumptions,
      seismicHazardAnalysis: {
        uncertainties: mef.seismicHazardAnalysis.uncertainties,
        modelUncertainty: mef.seismicHazardAnalysis.modelUncertainty,
        preOperationalAssumptions: mef.seismicHazardAnalysis.preOperationalAssumptions,
      },
      seismicFragilityAnalysis: {
        modelUncertainty: mef.seismicFragilityAnalysis.modelUncertainty,
        preOperationalAssumptions: mef.seismicFragilityAnalysis.preOperationalAssumptions,
      },
      seismicPlantResponseAnalysis: {
        modelUncertainty: mef.seismicPlantResponseAnalysis.modelUncertainty,
        preOperationalAssumptions: mef.seismicPlantResponseAnalysis.preOperationalAssumptions,
      },
    }} editable={editable} initialFocus={uncertaintyFocus} onClose={() => setUncertaintyFocus(null)} onApply={(value) => {
      const current = structuredClone(mef);
      current.integratedUncertainties = value.integratedUncertainties;
      current.integratedSensitivityStudies = value.integratedSensitivityStudies;
      current.modelUncertainty = value.modelUncertainty;
      current.preOperationalAssumptions = value.preOperationalAssumptions;
      current.seismicHazardAnalysis.uncertainties = value.seismicHazardAnalysis.uncertainties;
      current.seismicHazardAnalysis.modelUncertainty = value.seismicHazardAnalysis.modelUncertainty;
      current.seismicHazardAnalysis.preOperationalAssumptions = value.seismicHazardAnalysis.preOperationalAssumptions;
      current.seismicFragilityAnalysis.modelUncertainty = value.seismicFragilityAnalysis.modelUncertainty;
      current.seismicFragilityAnalysis.preOperationalAssumptions = value.seismicFragilityAnalysis.preOperationalAssumptions;
      current.seismicPlantResponseAnalysis.modelUncertainty = value.seismicPlantResponseAnalysis.modelUncertainty;
      current.seismicPlantResponseAnalysis.preOperationalAssumptions = value.seismicPlantResponseAnalysis.preOperationalAssumptions;
      update((draft) => { Object.assign(draft, current); });
    }} />}
  </>;
}

interface WorkflowActions {
  submitForReview?: () => Promise<void>;
  requestRevision?: (note: string) => Promise<void>;
  postComment?: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", associatedSr?: string) => Promise<void>;
  toggleResolve?: (commentId: string, resolved: boolean) => Promise<void>;
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
        <div className="posgen__readout"><h3 className="posgen__readout-h">Conformance check</h3><div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><strong>{mef.capabilityCategory ?? "CC-II"}</strong></div><div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><strong>{mef.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational"}</strong></div><div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{score.met} / {score.applicable}</span></div>{score.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Needs attention</span><span className="posmono">{score.warn}</span></div>}{score.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Blocked</span><span className="posmono">{score.blocked}</span></div>}</div>
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
    <div className="poscard"><div className="poscard__head"><h3 className="poscard__title">What is being attested</h3></div><div className="posapprove__attest-with-sign"><div className="posapprove__attest-grid"><div className="posapprove__attest-row"><span className="posapprove__attest-cap">Capability target</span><span className="posapprove__attest-val"><strong>{mef.capabilityCategory ?? "CC-II"}</strong> · Seismic PRA</span></div><div className="posapprove__attest-row"><span className="posapprove__attest-cap">Items satisfied</span><span className="posapprove__attest-val posmono">{score.met} of {score.applicable}</span></div><div className="posapprove__attest-row"><span className="posapprove__attest-cap">Review comments</span><span className="posapprove__attest-val posmono">{resolved} of {comments.length} resolved</span></div><div className="posapprove__attest-row"><span className="posapprove__attest-cap">Configuration snapshot</span><span className="posapprove__attest-val">{mef.configurationControlRecordId ?? "Not linked"}</span></div></div>{renderSignCard !== undefined && <div className="posapprove__sign-col">{renderSignCard()}</div>}</div></div>
    {renderApprovalTable?.()}
    {approved && <div className="poscard posapprove__handoff"><div className="poscard__head"><h3 className="poscard__title">After approval · external workflows</h3><span className="posbadge">View + comment only</span></div><p className="poscard__sub">The approved Seismic PRA baseline can now be released to peer review and audit without reopening technical editing.</p><div className="posapprove__handoff-grid"><div className="posapprove__handoff-card"><div className="posapprove__handoff-card-head"><div className="posapprove__handoff-card-icon"><POSIcon.Eye /></div><div><div className="posapprove__handoff-card-eyebrow">External · Section 6</div><div className="posapprove__handoff-card-title">Peer Review</div></div></div></div><div className="posapprove__handoff-card"><div className="posapprove__handoff-card-head"><div className="posapprove__handoff-card-icon"><POSIcon.Lock /></div><div><div className="posapprove__handoff-card-eyebrow">External · NQA-1 aligned</div><div className="posapprove__handoff-card-title">Audit</div></div></div></div></div></div>}
  </>;
}

export {
  ScopeScreen,
  HazardBasisScreen,
  EarthScienceScreen,
  SourceGroundMotionScreen,
  SiteResponseScreen,
  HazardResultsScreen,
  SecondaryHazardsScreen,
  SelResponseScreen,
  ThresholdInvestigationScreen,
  FragilityResultsScreen,
  PlantModelScreen,
  HumanReliabilityScreen,
  QuantificationIntegrationScreen,
  DraftScreen,
  ReviewScreen,
  ApprovalScreen,
  type WorkflowActions,
};
