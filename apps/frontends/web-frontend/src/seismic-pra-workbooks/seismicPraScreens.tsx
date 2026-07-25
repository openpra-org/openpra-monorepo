import { SEISMIC_PRA_SR_CATALOG, type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { type PlantIdentity } from "interfaces-mef-types/technical-element";
import { synchronizeSeismicPraDerivedRegisters, validateSeismicPra, type SeismicPraDiagnostic } from "interfaces-mef-types/seismic/seismic-pra-validation";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { seismicConformanceItems, seismicConformanceScore } from "./seismicPraConformance";
import { generateSeismicPraReport } from "./seismicPraDocx";
import { Drawer, EmptyState, Field, NumberInput, Section, SelectInput, Tag, TextArea, TextInput } from "./seismicPraFields";
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

function Table({ headers, children, minWidth = 720, caption }: { headers: string[]; children: ReactNode; minWidth?: number; caption?: string }): JSX.Element {
  return <div className="stablewrap"><table className="stable postable" style={{ minWidth }}>{caption !== undefined && <caption>{caption}</caption>}<thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
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
      {inputs.dataSets.length === 0 ? <EmptyState title="No data sets" detail="No earth-science evidence has been registered." /> : <Table headers={["Data set", "Discipline", "Coverage", "Data cutoff", "Quality or limitation"]} minWidth={980}>
        {inputs.dataSets.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setDataEditor({ title: item.name, subtitle: displayLabel(item.discipline), focus: ["seismicHazardAnalysis", "earthScienceInputs", "dataSets", index], visibleRootFields: dataFields, removeLabel: "Remove data set" })}><td><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td><Tag tone="sha">{displayLabel(item.discipline)}</Tag></td><td>{item.spatialCoverage}</td><td>{item.dataCutoffDate ?? "Not recorded"}</td><td>{item.qualityAndLimitations}</td></tr>)}
      </Table>}
    </Section>

    <Section title="Models and methods" description="Sources assessed for potential hazard impact." tone="sha" actions={editable ? <AddButton label="Add source" onClick={() => setModelEditor({ title: "New model or method", subtitle: "Applicability, potential impact, and disposition", focus: [], createAt: ["seismicHazardAnalysis", "earthScienceInputs", "modelAndMethodInventory"], visibleRootFields: modelFields })} /> : undefined}>
      {inputs.modelAndMethodInventory.length === 0 ? <EmptyState title="No models or methods" detail="No new or existing technical source has been assessed." /> : <Table headers={["Source or model", "Type", "Version or date", "Applicability", "Disposition", "Hazard impact"]} minWidth={1100}>
        {inputs.modelAndMethodInventory.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setModelEditor({ title: item.name, subtitle: item.sourceReference, focus: ["seismicHazardAnalysis", "earthScienceInputs", "modelAndMethodInventory", index], visibleRootFields: modelFields, removeLabel: "Remove source" })}><td><strong>{item.name}</strong><code>{item.sourceReference}</code></td><td>{displayLabel(item.modelKind)}</td><td>{[item.version, item.publicationDate].filter(Boolean).join(" · ") || "Not recorded"}</td><td>{item.applicability}</td><td><Tag tone={item.disposition === "REQUIRES_UPDATE" ? "warn" : item.disposition === "EXCLUDED" ? "neutral" : "good"}>{displayLabel(item.disposition)}</Tag></td><td>{item.potentialImpactOnHazard}</td></tr>)}
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
      {source.earthquakeSources.length === 0 ? <EmptyState title="No seismic sources" detail="No credible earthquake source has been characterized." /> : <Table headers={["Source", "Geometry", "Distance", "Magnitude range", "Hazard role"]} minWidth={880}>
        {source.earthquakeSources.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: displayLabel(item.sourceType), focus: ["seismicHazardAnalysis", "sourceCharacterization", "earthquakeSources", index], removeLabel: "Remove source" })}><td><strong>{item.name}</strong><code>{item.tectonicRegionType}</code></td><td><strong>{item.sourceType === item.geometry.geometryType ? displayLabel(item.sourceType) : `${displayLabel(item.sourceType)} / ${displayLabel(item.geometry.geometryType)}`}</strong><code>{item.faultMechanisms.map(displayLabel).join(", ")}</code></td><td>{item.geometry.closestDistanceToSiteKm === undefined ? "Not recorded" : `${item.geometry.closestDistanceToSiteKm} km`}</td><td>{sourceMagnitudeRange(item.magnitudeFrequencyModels)}</td><td><Tag tone={item.majorHazardContributor ? "warn" : "sha"}>{item.majorHazardContributor ? "Major contributor" : "Contributor"}</Tag></td></tr>)}
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

function SiteResponseScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const site = mef.seismicHazardAnalysis.siteResponseAnalysis;
  const [basisOpen, setBasisOpen] = useState(false);
  const [profileEditor, setProfileEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SHA · HLR-E" title="Local site-response basis" description="Profiles, strain-dependent properties, analysis methods, input motions, amplification, topology, and epistemic uncertainty." tone="sha" actions={<EditButton label="Edit response basis" onClick={() => setBasisOpen(true)} />}>
      <div className="sreadouts"><Readout label="Local response" value={site.localSiteResponseIncluded ? "Included" : "Not included"} /><Readout label="Bounding variability" value={site.boundingSiteVariabilityIncluded ? "Included" : "Not included"} /><Readout label="Profiles" value={site.profiles.length} /><Readout label="Analysis methods" value={site.methods.length} /></div>
      <Narrative label="Approach justification" value={site.approachJustification} />
      <Narrative label="Incorporation into hazard" value={site.incorporationIntoHazardMethod} />
    </Section>
    <Section eyebrow="Subsurface model" title="Site profiles" description="Each profile carries its weight, layering, material properties, bedrock depth, and groundwater basis." tone="sha" actions={editable ? <AddButton label="Add profile" onClick={() => setProfileEditor({ title: "New site profile", subtitle: "Profile type, layers, material properties, bedrock, groundwater, and weight", focus: [], createAt: ["seismicHazardAnalysis", "siteResponseAnalysis", "profiles"] })} /> : undefined}>
      {site.profiles.length === 0 ? <EmptyState title="No site profiles" detail="The local site model does not yet contain a profile." /> : <Table headers={["Profile", "Location", "Subsurface model", "Weight", ""]}>
        {site.profiles.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setProfileEditor({ title: item.name, subtitle: displayLabel(item.profileType), focus: ["seismicHazardAnalysis", "siteResponseAnalysis", "profiles", index], removeLabel: "Remove profile" })}><td><strong>{item.name}</strong><code>{displayLabel(item.profileType)}</code></td><td>{item.locationDescription}</td><td><strong>{item.layers.length} layers · bedrock at {item.depthToBedrock} {item.depthUnit}</strong><code>{item.bedrockDefinition}</code></td><td>{item.profileWeight ?? "—"}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>}
    </Section>
    {basisOpen && <MefEditor tone="sha" title="Site-response basis" subtitle="Profiles, material properties, methods, motions, amplification, topography, and uncertainty" focus={["seismicHazardAnalysis", "siteResponseAnalysis"]} onClose={() => setBasisOpen(false)} />}
    <CollectionEditor tone="sha" target={profileEditor} onClose={() => setProfileEditor(null)} />
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

function HazardResultsScreen(): JSX.Element {
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

function SecondaryHazardsScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const evaluation = mef.seismicHazardAnalysis.secondaryHazardEvaluation;
  const [basisOpen, setBasisOpen] = useState(false);
  const [hazardEditor, setHazardEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SHA · HLR-H" title="Secondary seismic hazards" description="Fault displacement, slope instability, liquefaction, settlement, ground failure, and earthquake-induced flooding are explicitly screened or retained." tone="sha" actions={editable ? <AddButton label="Add secondary hazard" onClick={() => setHazardEditor({ title: "New secondary hazard", subtitle: "Screening, retained modeling, affected equipment, interfaces, and evidence", focus: [], createAt: ["seismicHazardAnalysis", "secondaryHazardEvaluation", "hazards"] })} /> : undefined}>
      <SectionEditorRow title="Secondary-hazard evaluation basis" description="Identification process, screening methods, interfaces, and completeness review." onClick={() => setBasisOpen(true)} />
      <Table headers={["Hazard", "Type", "Disposition", "Criterion", "Affected SEL items", ""]}>
        {evaluation.hazards.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setHazardEditor({ title: item.name, subtitle: displayLabel(item.hazardType), focus: ["seismicHazardAnalysis", "secondaryHazardEvaluation", "hazards", index], removeLabel: "Remove secondary hazard" })}><td><strong>{item.name}</strong><code>{item.description}</code></td><td>{displayLabel(item.hazardType)}</td><td><Tag tone={item.screening.disposition === "RETAINED" ? "warn" : "good"}>{displayLabel(item.screening.disposition)}</Tag></td><td>{item.screening.criterion}</td><td>{item.potentiallyAffectedSeismicEquipmentListItemRefs.length}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
      <Narrative label="Completeness review" value={evaluation.completenessReview} />
    </Section>
    {basisOpen && <MefEditor tone="sha" title="Secondary-hazard evaluation" subtitle="Identification, screening, retained hazard curves, affected equipment, interfaces, and completeness" focus={["seismicHazardAnalysis", "secondaryHazardEvaluation"]} onClose={() => setBasisOpen(false)} />}
    <CollectionEditor tone="sha" target={hazardEditor} onClose={() => setHazardEditor(null)} />
  </>;
}

function SelResponseScreen(): JSX.Element {
  const { mef, editable } = useUpdate();
  const sel = mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
  const response = mef.seismicFragilityAnalysis.seismicResponseAnalysis;
  const [selOpen, setSelOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [collectionEditor, setCollectionEditor] = useState<CollectionEditorTarget | null>(null);
  return <>
    <Section eyebrow="SPR · HLR-C / SFR · HLR-A" title="Seismic equipment list" description="One controlled list connects systems failure modes, investigations, fragility mechanisms, correlation, and plant-response events." tone="spr" actions={editable ? <AddButton label="Add equipment" onClick={() => setCollectionEditor({ title: "New seismic equipment item", subtitle: "SSC identity, credited functions, failure modes, disposition, and traceability", focus: [], createAt: ["seismicPlantResponseAnalysis", "seismicEquipmentListDevelopment", "equipment"] })} /> : undefined}>
      <SectionEditorRow title="Equipment-list basis" description="Source lists, inclusion logic, completeness, coordination, and revision control." onClick={() => setSelOpen(true)} />
      <Table headers={["SSC", "Type and location", "Credited functions", "Failure modes", "Disposition", ""]}>
        {sel.equipment.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: `${item.sscType} · ${item.building}`, focus: ["seismicPlantResponseAnalysis", "seismicEquipmentListDevelopment", "equipment", index], removeLabel: "Remove equipment" })}><td><strong>{item.name}</strong><code>{item.roomOrArea ?? item.building}</code></td><td>{item.sscType}<br /><span>{item.building}</span></td><td>{item.creditedFunctions.join("; ")}</td><td>{item.failureModes.map((mode) => mode.name).join("; ")}</td><td><Tag tone={item.disposition === "ACTIVE" ? "spr" : "neutral"}>{displayLabel(item.disposition)}</Tag></td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    <Section eyebrow="SFR · HLR-B" title="Reference earthquake and structural response" description="Three-direction input, realistic 3-D response, SSI, median centering, variability, convergence, scaling, and probabilistic simulation over the hazard range." tone="sfr" actions={editable ? <AddButton label="Add structural model" onClick={() => setCollectionEditor({ title: "New structural model", subtitle: "Model condition, software, modal properties, verification, and traceability", focus: [], createAt: ["seismicFragilityAnalysis", "seismicResponseAnalysis", "structuralModels"] })} /> : undefined}>
      <SectionEditorRow title="Structural-response basis" description="Reference earthquakes, SSI, scaling, simulations, response results, and consistency." onClick={() => setResponseOpen(true)} />
      <Table headers={["Structural model", "Software", "Condition", "Modes", "Verification", ""]}>
        {response.structuralModels.map((item, index) => <tr className="postable__row--clickable" key={item.uuid} onClick={() => setCollectionEditor({ title: item.name, subtitle: "Structural response model", focus: ["seismicFragilityAnalysis", "seismicResponseAnalysis", "structuralModels", index], removeLabel: "Remove structural model" })}><td><strong>{item.name}</strong><code>{item.structureRef}</code></td><td>{item.softwareAndVersion}</td><td>{displayLabel(item.asModeledCondition)}</td><td>{item.modalProperties.length}</td><td>{item.verificationAndValidation}</td><td className="srowopen"><POSIcon.ArrowR /></td></tr>)}
      </Table>
    </Section>
    {selOpen && <MefEditor tone="spr" title="Seismic equipment list" subtitle="Equipment, sources, structures, failure modes, completeness, coordination, and revision control" focus={["seismicPlantResponseAnalysis", "seismicEquipmentListDevelopment"]} onClose={() => setSelOpen(false)} />}
    {responseOpen && <MefEditor tone="sfr" title="Seismic-response analysis" subtitle="Reference earthquake, structural models, SSI, scaling, simulations, results, and consistency" focus={["seismicFragilityAnalysis", "seismicResponseAnalysis"]} onClose={() => setResponseOpen(false)} />}
    <CollectionEditor tone={(collectionEditor?.createAt?.[0] ?? collectionEditor?.focus[0]) === "seismicPlantResponseAnalysis" ? "spr" : "sfr"} target={collectionEditor} onClose={() => setCollectionEditor(null)} />
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
