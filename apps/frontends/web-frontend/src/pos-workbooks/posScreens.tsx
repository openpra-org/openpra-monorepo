import { Fragment, JSX, useRef, useState } from "react";
import { type PosDocumentEntry } from "./posWorkbookApi";
import { type PlantOperatingStatesAnalysis, type PlantEvolution, type PlantOperatingState, type PlantOperatingStateGroup, type ParameterRange, type ScreeningCriterion, type PosScreeningRecord, type PosSeparationRecord, type DemandTimeBasedRecord, type SubsumedPosRecord, type InterviewRecord, EvolutionType, OperatingMode } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type PlantIdentity } from "interfaces-mef-types/technical-element";
import { type CapabilityCategory as MefCapabilityCategory, type PlantStage as MefPlantStage } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type Mutator } from "./useMefPatch";
import { POSIcon } from "./posIcons";
import { Badge } from "./posShared";
import { PreopAssumptionCard } from "./posPreopCard";
import {
  CAPABILITY_CATEGORIES,
  POS_DOCUMENTS,
  type CapabilityCategory,
  type CcScore,
} from "./posViewData";
import {
  statesView,
  evolutionsView,
  interviewsView,
  screeningEditorView,
  type ScreeningEditorView,
  groupsView,
  coverageView,
  mutualExclusivityView,
  transitionValidationView,
  DELINEATION_PARAMETER_OPTIONS,
  handoffBundleView,
  cycleReconciliation,
  quantStatesView,
  groupRollupView,
  type QuantStateView,
  stateLabel,
  evolutionLabel,
  methodLabel,
  formatNumber,
  formatDuration,
  formatFrequency,
  DECAY_HEAT_METHODS,
  type DecayHeatMethod,
  preOpsForState,
  ccScore,
  type Stage,
} from "./posSelectors";
import { usePosWorkbook } from "./posWorkbookContext";
import { computePosReportToc } from "./posDocx";

interface DrawerContext {
  kind: "state" | "evolution" | "group";
  id: string;
  focus?: "preop";
}

interface ScreenProps {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  openDrawer: (ctx: DrawerContext) => void;
  onAction: (msg: string) => void;
  mefPatch?: (mutator: Mutator) => void;
  mefPatchDebounced?: (mutator: Mutator) => void;
  canEdit: boolean;
  onAddEvolution?: () => void;
  onAddState?: () => void;
  onAddGroup?: () => void;
}

function blankPlantIdentity(): PlantIdentity {
  return { name: "", vendor: "", reactorType: "", thermalPower: "", primaryCoolant: "" };
}

function blankPlantEvolution(): PlantEvolution {
  return {
    uuid: crypto.randomUUID(),
    name: "",
    type: EvolutionType.AT_POWER,
    description: "",
    operatingModes: [],
    reviewedDocumentation: {
      operatingModes: [],
      rcbConfigurations: [],
      rcsParameterRanges: [],
      decayHeatRemovalMechanisms: [],
      availableInstrumentation: [],
      activitiesLeadingToChanges: [],
      radionuclideTransportBarrierStatus: [],
      sscCapabilityChanges: [],
      operationalAssumptions: [],
    },
    plantOperatingStateIds: [],
    implementsSrs: [],
  };
}

function blankPlantOperatingStateGroup(): PlantOperatingStateGroup {
  return {
    uuid: crypto.randomUUID(),
    name: "",
    evolutionType: EvolutionType.AT_POWER,
    memberPosIds: [],
    similarityBasis: "",
    boundingCharacteristics: [],
    doesNotMaskRiskSignificantContributors: false,
    summedDurationHours: 0,
    entryFrequency: 0,
    implementsSrs: [],
  };
}

function blankInterviewRecord(): InterviewRecord {
  return {
    uuid: crypto.randomUUID(),
    date: "",
    personnelRoles: [],
    method: "TABLETOP",
    findings: "",
    overlookedEvolutionsIdentified: [],
  };
}

function blankPlantOperatingState(evolutionId: string): PlantOperatingState {
  const zeroRange = (): ParameterRange => ({ min: 0, max: 0, representative: 0, units: "" });
  return {
    uuid: crypto.randomUUID(),
    name: "",
    evolutionId,
    description: "",
    operatingMode: OperatingMode.POWER,
    radioactiveMaterialSources: [],
    rcbConfiguration: "",
    rcsParameters: {
      powerLevel: zeroRange(),
      decayHeatLevel: zeroRange(),
      reactorCoolantTemperature: zeroRange(),
      coolantPressure: zeroRange(),
      rcsConfigurationDescription: "",
    },
    availableInstrumentation: [],
    activitiesLeadingToParameterChanges: [],
    radionuclideTransportBarriers: [],
    timeBoundary: { startingCondition: "", endingCondition: "", transitionParameters: [] },
    decayHeatRemoval: { primaryCoolingSystems: {}, secondaryCoolingSystems: {}, passiveMechanisms: {} },
    sscOperationalCharacteristics: [],
    safetyFunctions: [],
    applicableInitiatingEvents: [],
    successCriteriaIds: [],
    meanDurationHours: 0,
    meanEntryFrequency: 0,
    decayHeatLevelDefined: false,
    implementsSrs: [],
  };
}

function setPlantIdentityField<K extends keyof PlantIdentity>(
  pos: PlantOperatingStatesAnalysis,
  key: K,
  value: PlantIdentity[K],
): PlantOperatingStatesAnalysis {
  const current = pos.metadata.plantIdentity ?? blankPlantIdentity();
  return {
    ...pos,
    metadata: {
      ...pos.metadata,
      plantIdentity: { ...current, [key]: value },
    },
  };
}

function ccIdToMef(ccId: string): MefCapabilityCategory {
  return ccId === "cc-i" ? "CC-I" : "CC-II";
}

function stageToMef(stage: Stage): MefPlantStage {
  return stage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL";
}

function SetupScreen({ ccId, setCcId, stage, setStage, onAction, mefPatch, mefPatchDebounced, canEdit }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const handoff = handoffBundleView(pos);
  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const selectedLane = handoff.lanes.find((l) => l.code === selectedTe);
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const pi = pos.metadata.plantIdentity ?? blankPlantIdentity();
  const isReal = mefPatch !== undefined;

  function onPiChange<K extends keyof PlantIdentity>(key: K, value: PlantIdentity[K]): void {
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((draft) => setPlantIdentityField(draft, key, value));
  }

  function onScopeChange(value: string): void {
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((draft) => ({ ...draft, praScope: value }));
  }

  function onCcChange(newCcId: string): void {
    if (!canEdit) return;
    setCcId(newCcId);
    if (mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, capabilityCategory: ccIdToMef(newCcId) }));
  }

  function onStageChange(newStage: Stage): void {
    if (!canEdit) return;
    setStage(newStage);
    if (mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, plantStage: stageToMef(newStage) }));
  }

  function onAtPowerChange(value: boolean): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, includesAtPowerOperations: value }));
  }

  function onHazardChange(value: boolean): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, includesNonInternalHazardGroups: value }));
  }

  function onLpsdChange(value: boolean): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, includesLPSDOperations: value }));
  }

  return (
    <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
      {!canEdit && (
        <div className="poscard" style={{ background: "var(--color-bg-to)" }}>
          <p className="poscard__sub" style={{ margin: 0 }}>Steps 1 through 9 are read only in this view.</p>
        </div>
      )}
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
        </div>
        <p className="poscard__sub">POS has no upstream inputs. It feeds these downstream elements. Select one to see what it receives from the {handoff.retainedCount} retained states.</p>
        <div className="poshandoff__grid">
          {handoff.lanes.map((lane) => (
            <button
              key={lane.code}
              type="button"
              className={`poshandoff__tile${selectedTe === lane.code ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.code ? null : lane.code)}
            >
              <span className="poshandoff__tile-code">{lane.code}</span>
              <span className="poshandoff__tile-name">{lane.element}</span>
              <span className="poshandoff__tile-role">{lane.role}</span>
            </button>
          ))}
        </div>
        {selectedLane !== undefined && (
          <div style={{ marginTop: 16 }}>
            <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>{selectedLane.element} receives</div>
            {selectedLane.rows.length === 0 ? (
              <p className="posmuted" style={{ margin: 0 }}>No retained states to hand off yet.</p>
            ) : (
            <table className="postable postable--mid">
              <thead>
                <tr>{selectedLane.columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {selectedLane.rows.map((r) => (
                  <tr key={r.posId}>
                    <td><div className="postable__name">{r.name}</div></td>
                    {r.values.map((v, idx) => <td key={selectedLane.columns[idx + 1] ?? `c${idx}`} className="mono">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}
      </div>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant identity</h3>
        </div>
        <div className="posfield-grid">
          <div className="posfield">
            <label className="posfield__label">Plant name</label>
            <input
              className="posfield__input"
              placeholder="e.g. Generic HTGR"
              value={isReal ? pi.name : undefined}
              defaultValue={!isReal ? pi.name : undefined}
              onChange={(e) => onPiChange("name", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Vendor / designer</label>
            <input
              className="posfield__input"
              placeholder="e.g. Vendor LLC"
              value={isReal ? pi.vendor : undefined}
              defaultValue={!isReal ? pi.vendor : undefined}
              onChange={(e) => onPiChange("vendor", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Reactor type</label>
            <input
              className="posfield__input"
              placeholder="e.g. High-temperature gas-cooled reactor (prismatic)"
              value={isReal ? pi.reactorType : undefined}
              defaultValue={!isReal ? pi.reactorType : undefined}
              onChange={(e) => onPiChange("reactorType", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Thermal power</label>
            <input
              className="posfield__input"
              placeholder="e.g. 350 MWth"
              value={isReal ? pi.thermalPower : undefined}
              defaultValue={!isReal ? pi.thermalPower : undefined}
              onChange={(e) => onPiChange("thermalPower", e.target.value)}
            />
          </div>
        </div>
        <div className="posfield-grid posfield-grid--3" style={{ marginTop: 16 }}>
          <div className="posfield">
            <label className="posfield__label">Primary coolant</label>
            <input
              className="posfield__input"
              placeholder="e.g. Helium"
              value={isReal ? pi.primaryCoolant : undefined}
              defaultValue={!isReal ? pi.primaryCoolant : undefined}
              onChange={(e) => onPiChange("primaryCoolant", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Intermediate coolant</label>
            <input
              className="posfield__input"
              placeholder="e.g. None (direct steam cycle)"
              value={isReal ? (pi.intermediateCoolant ?? "") : undefined}
              defaultValue={!isReal ? (pi.intermediateCoolant ?? "") : undefined}
              onChange={(e) => onPiChange("intermediateCoolant", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Power conversion working fluid</label>
            <input
              className="posfield__input"
              placeholder="e.g. Steam (Rankine cycle)"
              value={isReal ? (pi.powerConversionFluid ?? "") : undefined}
              defaultValue={!isReal ? (pi.powerConversionFluid ?? "") : undefined}
              onChange={(e) => onPiChange("powerConversionFluid", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what the analysis covers and what it excludes.</p>
        <textarea
          className="posfield__textarea"
          placeholder="Briefly state in-scope hazard groups, operating modes, and explicit exclusions."
          rows={4}
          value={isReal ? pos.praScope : undefined}
          defaultValue={!isReal ? pos.praScope : undefined}
          onChange={(e) => onScopeChange(e.target.value)}
        />
        <p className="posfield__hint" style={{ marginTop: 8, marginBottom: 0 }}>
          <strong>Example:</strong> Internal events at full power; internal floods and internal fires; excludes seismic, high winds, and external floods (covered by external-hazards workbooks).
        </p>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant stage</h3>
        </div>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          <label className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === "pre_operational" ? "var(--color-primary)" : undefined }}>
            <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
              <input type="radio" name="stage" value="pre_operational" checked={stage === "pre_operational"} onChange={() => onStageChange("pre_operational")} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>Pre-operational</div>
                <div className="possubtle" style={{ fontSize: 12.5 }}>
                  Plant not yet built or operated. Inputs come from design basis, vendor data, and engineering interviews.
                </div>
              </div>
            </div>
          </label>
          <label className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === "operational" ? "var(--color-primary)" : undefined }}>
            <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
              <input type="radio" name="stage" value="operational" checked={stage === "operational"} onChange={() => onStageChange("operational")} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>Operational</div>
                <div className="possubtle" style={{ fontSize: 12.5 }}>
                  Plant is operating. Expected records: as-built and as-operated configuration verification, operating history, walkdowns, and interviews with operations staff.
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const scores = ccScore(pos, c.id, stage);
            return (
              <button
                key={c.id}
                type="button"
                className="poscard"
                onClick={() => onCcChange(c.id)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: active ? "var(--color-primary)" : undefined,
                  boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Literata', serif", fontWeight: 700, fontSize: 16, color: "var(--color-text)" }}>
                    {c.name}
                  </span>
                  <span className="possubtle" style={{ fontSize: 12 }}>{c.tag}</span>
                </div>
                <div className="possubtle" style={{ marginBottom: 10 }}>{c.description}</div>
                <div className="posrow" style={{ justifyContent: "space-between" }}>
                  <span className="posmono possubtle">{scores.applicable} items required</span>
                  <span className={`poschip ${active ? "poschip--primary" : ""}`}>{scores.applicable === 0 ? "—" : `${scores.percent}% ready`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant operations in scope</h3>
        </div>
        <p className="poscard__sub">Which plant operating modes does this POS analysis cover?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="posrow" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={pos.includesAtPowerOperations}
              onChange={(e) => onAtPowerChange(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ display: "block", fontSize: 13.5 }}>At-power operations</strong>
              <span className="possubtle" style={{ fontSize: 12.5 }}>Full-power and load-following operation.</span>
            </span>
          </label>
          <label className="posrow" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={pos.includesLPSDOperations ?? false}
              onChange={(e) => onLpsdChange(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ display: "block", fontSize: 13.5 }}>Low power and shutdown (LPSD)</strong>
              <span className="possubtle" style={{ fontSize: 12.5 }}>Startup, shutdown, refueling, cold shutdown, and other non-power evolutions.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Hazard groups in scope</h3>
        </div>
        <p className="poscard__sub">Internal events are always in scope for a POS workbook. Check below if the PRA also covers hazards beyond internal events.</p>
        <label className="posrow" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={pos.includesNonInternalHazardGroups}
            onChange={(e) => onHazardChange(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong style={{ display: "block", fontSize: 13.5 }}>Hazards beyond internal events</strong>
            <span className="possubtle" style={{ fontSize: 12.5 }}>Internal floods, internal fires, seismic, high winds, external floods, and other external hazards. Each in-scope hazard requires its own workbook downstream; POS definitions must remain bounding for each.</span>
          </span>
        </label>
        <p className="posfield__hint" style={{ marginTop: 14, marginBottom: 0 }}>
          Configuration freeze date lives in the linked PRA Configuration Control workbook. {pos.configurationControlRecordId !== undefined && pos.configurationControlRecordId.length > 0
            ? <>Linked: <code className="posmono">{pos.configurationControlRecordId}</code></>
            : <>No configuration control workbook linked yet.</>}
        </p>
      </div>
    </fieldset>
  );
}

interface DocumentsScreenProps extends ScreenProps {
  realDocuments?: PosDocumentEntry[];
  canUpload?: boolean;
  onUploadFile?: (file: File) => Promise<void>;
  onDeleteDocument?: (documentId: string) => Promise<void>;
  onDownloadDocument?: (documentId: string) => Promise<void>;
  onUpdateDocument?: (documentId: string, fields: { name?: string; notes?: string }) => Promise<void>;
}

function pickIconKind(mimeType: string): "sheet" | "image" | "doc" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "text/csv" || mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "sheet";
  return "doc";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function patchExampleDoc(pos: PlantOperatingStatesAnalysis, id: string, name: string): PlantOperatingStatesAnalysis {
  return { ...pos, exampleDocuments: (pos.exampleDocuments ?? []).map((d) => (d.id === id ? { ...d, name } : d)) };
}

function ExampleDocName({ id, name, canEdit, mefPatchDebounced }: {
  id: string;
  name: string;
  canEdit: boolean;
  mefPatchDebounced?: (mutator: Mutator) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  if (!canEdit || mefPatchDebounced === undefined) {
    return <div className="posdoc__name">{name}</div>;
  }
  if (editing) {
    return (
      <input
        className="posdoc__name-input"
        value={text}
        aria-label="Document name"
        autoFocus
        onChange={(e) => { setText(e.target.value); mefPatchDebounced((d) => patchExampleDoc(d, id, e.target.value)); }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
      />
    );
  }
  return (
    <div className="posdoc__name-row">
      <span className="posdoc__name">{name}</span>
      <button type="button" className="posdoc__name-edit" aria-label="Edit document name" onClick={() => { setText(name); setEditing(true); }}><POSIcon.Pencil /></button>
    </div>
  );
}

function RealDocName({ documentId, name, canRename, onUpdateDocument }: { documentId: string; name: string; canRename: boolean; onUpdateDocument?: (documentId: string, fields: { name?: string; notes?: string }) => Promise<void> }): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  if (!canRename || onUpdateDocument === undefined) return <div className="posdoc__name">{name}</div>;
  function save(): void {
    setEditing(false);
    const next = text.trim();
    if (next.length === 0 || next === name) return;
    void onUpdateDocument!(documentId, { name: next });
  }
  if (editing) {
    return (
      <input className="posdoc__name-input" value={text} aria-label="Document name" autoFocus onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }} />
    );
  }
  return (
    <div className="posdoc__name-row">
      <span className="posdoc__name">{name}</span>
      <button type="button" className="posdoc__name-edit" aria-label="Rename document" onClick={() => { setText(name); setEditing(true); }}><POSIcon.Pencil /></button>
    </div>
  );
}

function RealDocNotes({ documentId, notes, canEdit, onUpdateDocument }: { documentId: string; notes: string; canEdit: boolean; onUpdateDocument?: (documentId: string, fields: { name?: string; notes?: string }) => Promise<void> }): JSX.Element | null {
  const [text, setText] = useState(notes);
  if (!canEdit || onUpdateDocument === undefined) return notes.length > 0 ? <div className="posdoc__meta" style={{ marginTop: 4 }}>{notes}</div> : null;
  function save(): void {
    if (text === notes) return;
    void onUpdateDocument!(documentId, { notes: text });
  }
  return (
    <input className="posfield__input" style={{ marginTop: 6, width: "100%" }} placeholder="What this document supports (summary)…" value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
  );
}

function DocumentsScreen({ onAction, canEdit, mefPatchDebounced, realDocuments, canUpload, onUploadFile, onDeleteDocument, onDownloadDocument, onUpdateDocument }: DocumentsScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const isReal = realDocuments !== undefined;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const exampleDocs = pos.exampleDocuments ?? [];
  const showExampleDocs = isReal && realDocuments.length === 0 && exampleDocs.length > 0;

  function pickFile(): void {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file === undefined || onUploadFile === undefined) return;
    setUploading(true);
    onUploadFile(file)
      .then(() => { onAction("Document uploaded"); })
      .catch((err: unknown) => { onAction((err as { message?: string }).message ?? "Upload failed"); })
      .finally(() => {
        setUploading(false);
        if (fileInputRef.current !== null) fileInputRef.current.value = "";
      });
  }

  function handleDelete(documentId: string): void {
    if (onDeleteDocument === undefined) return;
    onDeleteDocument(documentId)
      .then(() => onAction("Document removed"))
      .catch((err: unknown) => onAction((err as { message?: string }).message ?? "Delete failed"));
  }

  function handleDownload(documentId: string): void {
    if (onDownloadDocument === undefined) return;
    onDownloadDocument(documentId)
      .catch((err: unknown) => onAction((err as { message?: string }).message ?? "Download failed"));
  }

  return (
    <>
      <div className="posupload">
        <div className="posupload__icon"><POSIcon.Upload /></div>
        <div className="posupload__copy">
          <div className="posupload__copy-title">Drag &amp; drop design documents, P&amp;IDs, procedures, or prior PRAs</div>
          <div className="posupload__copy-sub">OpenPRA reads the contents, identifies relevant inputs, and links them to the right operating-state fields.</div>
        </div>
        {isReal ? (
          <>
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
            <button
              type="button"
              className="posnav__btn posnav__btn--primary"
              onClick={pickFile}
              disabled={uploading || canUpload !== true}
            >
              <POSIcon.Upload /> {uploading ? "Uploading…" : "Browse files"}
            </button>
          </>
        ) : (
          <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Document picker opening…")}>
            <POSIcon.Upload /> Browse files
          </button>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Uploaded documents</h3>
          <div className="posrow" style={{ gap: 12 }}>
            <Badge kind="ok">{(showExampleDocs ? exampleDocs.length : (isReal ? realDocuments.length : POS_DOCUMENTS.length))} files</Badge>
          </div>
        </div>
        <div className="posdoc-list">
          {showExampleDocs
            ? exampleDocs.map((d) => (
              <div key={d.id} className="posdoc">
                <div className="posdoc__icon">
                  {d.kind === "sheet" ? <POSIcon.Sheet /> : d.kind === "image" ? <POSIcon.Image /> : <POSIcon.Doc />}
                </div>
                <div className="posdoc__main">
                  <ExampleDocName id={d.id} name={d.name} canEdit={canEdit} mefPatchDebounced={mefPatchDebounced} />
                  <div className="posdoc__meta">{d.sizeLabel} · {d.uploadedLabel}</div>
                </div>
                {d.url !== undefined && (
                  <a className="posnav__btn posnav__btn--sm" href={d.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <POSIcon.Eye /> View source
                  </a>
                )}
              </div>
            ))
            : isReal
            ? (realDocuments.length === 0
                ? <p className="posmuted" style={{ padding: "16px 0", margin: 0 }}>No documents uploaded yet.</p>
                : realDocuments.map((d) => {
                    const kind = pickIconKind(d.mimeType);
                    return (
                      <div key={d.documentId} className="posdoc">
                        <div className="posdoc__icon">
                          {kind === "sheet" ? <POSIcon.Sheet /> : kind === "image" ? <POSIcon.Image /> : <POSIcon.Doc />}
                        </div>
                        <div className="posdoc__main" style={{ flex: 1 }}>
                          <RealDocName documentId={d.documentId} name={d.filename} canRename={canUpload === true} onUpdateDocument={onUpdateDocument} />
                          <div className="posdoc__meta">{formatSize(d.size)} · uploaded by @{d.uploadedBy}</div>
                          <RealDocNotes documentId={d.documentId} notes={d.notes} canEdit={canUpload === true} onUpdateDocument={onUpdateDocument} />
                        </div>
                        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => handleDownload(d.documentId)}>
                          <POSIcon.Eye /> Download
                        </button>
                        {canUpload === true && (
                          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => handleDelete(d.documentId)}>
                            <POSIcon.Close /> Remove
                          </button>
                        )}
                      </div>
                    );
                  })
              )
            : POS_DOCUMENTS.map((d) => (
              <div key={d.id} className="posdoc">
                <div className="posdoc__icon">
                  {d.kind === "sheet" ? <POSIcon.Sheet /> : d.kind === "image" ? <POSIcon.Image /> : <POSIcon.Doc />}
                </div>
                <div className="posdoc__main">
                  <div className="posdoc__name">{d.name}</div>
                  <div className="posdoc__meta">{d.size} · {d.uploaded}</div>
                </div>
                {d.url !== undefined && (
                  <a className="posnav__btn posnav__btn--sm" href={d.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <POSIcon.Eye /> View source
                  </a>
                )}
              </div>
            ))}
        </div>
      </div>

    </>
  );
}

function EvolutionsScreen({ openDrawer, onAddEvolution }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const evolutions = evolutionsView(pos);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant evolutions</h3>
          <div className="posrow" style={{ gap: 8 }}>
            {onAddEvolution !== undefined && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onAddEvolution}><POSIcon.Plus /> Add evolution</button>}
          </div>
        </div>
        <p className="poscard__sub">
          An evolution is a process the plant goes through (e.g., refuelling, at-power, etc.). Evolutions are sliced into operating states next.
        </p>
        {evolutions.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No evolutions defined yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead>
              <tr>
                <th>Evolution</th>
                <th>States</th>
                <th>% of state hours</th>
                <th>Source document</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {evolutions.map((ev) => (
                <tr key={ev.id} className="postable__row--clickable" onClick={() => openDrawer({ kind: "evolution", id: ev.id })}>
                  <td>
                    <div className="postable__name">{evolutionLabel(ev.name)}</div>
                    <span className="postable__name-sub">{ev.description}</span>
                  </td>
                  <td className="mono">{ev.statesCount}</td>
                  <td className="mono">{(ev.durationFraction * 100).toFixed(1)} %</td>
                  <td className="mono">{ev.fromDoc.length > 0 ? ev.fromDoc : "—"}</td>
                  <td><POSIcon.Chevron /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function patchDelineation(pos: PlantOperatingStatesAnalysis, params: string[]): PlantOperatingStatesAnalysis {
  return {
    ...pos,
    validationRules: {
      ...pos.validationRules,
      mutualExclusivity: { ...pos.validationRules.mutualExclusivity, delineationParameters: params },
    },
  };
}

function patchTransition(pos: PlantOperatingStatesAnalysis, fromUuid: string, toUuid: string): PlantOperatingStatesAnalysis {
  const matrix = pos.validationRules.transitions.transitionMatrix;
  const current = matrix[fromUuid] ?? [];
  const next = current.includes(toUuid) ? current.filter((id) => id !== toUuid) : [...current, toUuid];
  return {
    ...pos,
    validationRules: {
      ...pos.validationRules,
      transitions: { ...pos.validationRules.transitions, transitionMatrix: { ...matrix, [fromUuid]: next } },
    },
  };
}

function DelineationEditor({ selected, canEdit, mefPatch }: { selected: string[]; canEdit: boolean; mefPatch?: (mutator: Mutator) => void }): JSX.Element {
  const chosen = new Set(selected);
  function toggle(p: string): void {
    if (mefPatch === undefined) return;
    const next = chosen.has(p) ? selected.filter((x) => x !== p) : [...selected, p];
    mefPatch((d) => patchDelineation(d, next));
  }
  return (
    <div className="posrow" style={{ gap: 6, flexWrap: "wrap", marginTop: 10 }}>
      {DELINEATION_PARAMETER_OPTIONS.map((p) => (
        <button key={p} type="button" disabled={!canEdit} className={`posnav__btn posnav__btn--sm${chosen.has(p) ? " posnav__btn--primary" : ""}`} onClick={() => toggle(p)}>{p}</button>
      ))}
    </div>
  );
}

function TransitionEditor({ canEdit, mefPatch }: { canEdit: boolean; mefPatch?: (mutator: Mutator) => void }): JSX.Element {
  const { pos } = usePosWorkbook();
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const states = pos.plantOperatingStates.filter((s) => !screenedOut.has(s.uuid));
  const matrix = pos.validationRules.transitions.transitionMatrix;
  function toggle(from: string, to: string): void {
    if (mefPatch === undefined) return;
    mefPatch((d) => patchTransition(d, from, to));
  }
  return (
    <div style={{ marginTop: 10 }}>
      {states.map((s) => {
        const targets = new Set(matrix[s.uuid] ?? []);
        return (
          <div key={s.uuid} style={{ marginTop: 8 }}>
            <div className="possubtle" style={{ fontSize: 12, marginBottom: 4 }}>{stateLabel(s.name)} transitions to</div>
            <div className="posrow" style={{ gap: 6, flexWrap: "wrap" }}>
              {states.filter((t) => t.uuid !== s.uuid).map((t) => (
                <button key={t.uuid} type="button" disabled={!canEdit} className={`posnav__btn posnav__btn--sm${targets.has(t.uuid) ? " posnav__btn--primary" : ""}`} onClick={() => toggle(s.uuid, t.uuid)}>{stateLabel(t.name)}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatesScreen({ openDrawer, onAddState, canEdit, mefPatch }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const [showTransitions, setShowTransitions] = useState(false);
  const states = statesView(pos);
  const coverage = coverageView(pos);
  const me = mutualExclusivityView(pos);
  const tv = transitionValidationView(pos);
  const validationOk = coverage.covered && me.allSeparable && tv.allValid;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operating states</h3>
          <div className="posrow" style={{ gap: 8 }}>
            {onAddState !== undefined && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onAddState}><POSIcon.Plus /> Add state</button>}
          </div>
        </div>

        {states.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No operating states defined yet.</p>
        ) : (
        <table className="postable postable--mid">
          <thead>
            <tr>
              <th>State</th>
              <th>Mode</th>
              <th>Coolant Temp</th>
              <th>Power</th>
              <th>Status</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.id} className="postable__row--clickable" onClick={() => openDrawer({ kind: "state", id: s.id })}>
                <td>
                  <div className="postable__name">{stateLabel(s.name)}</div>
                  <span className="postable__name-sub">{s.description}</span>
                </td>
                <td className="mono">{s.mode}</td>
                <td className="mono">{s.rcs.temp}</td>
                <td className="mono">{s.rcs.power}</td>
                <td>
                  {s.status === "ok" && <Badge kind="ok">Ready</Badge>}
                  {s.status === "warn" && <Badge kind="warn">Needs attention</Badge>}
                  {s.status === "draft" && <Badge kind="draft">Draft</Badge>}
                  {s.statusMessage !== undefined && (
                    <div className="possubtle" style={{ marginTop: 4, fontSize: 11.5 }}>{s.statusMessage}</div>
                  )}
                  {s.hasPreopAssumption && (
                    <span
                      className="poschip poschip--preop"
                      style={{ marginTop: 6, display: "inline-flex", cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); openDrawer({ kind: "state", id: s.id, focus: "preop" }); }}
                    >
                      <POSIcon.Warn /> Flagged
                    </span>
                  )}
                </td>
                <td><POSIcon.Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Validation</h3>
          {states.length > 0 && (validationOk ? <Badge kind="ok">All checks pass</Badge> : <Badge kind="warn">Needs attention</Badge>)}
        </div>
        {states.length === 0 ? (
          <p className="posmuted" style={{ padding: "8px 0", margin: 0 }}>Add operating states to run validation.</p>
        ) : (
        <>
          <div style={{ marginTop: 4 }}>
            <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <span className="possubtle">Collective exhaustivity</span>
              <span className="posmono" style={{ fontWeight: 700, color: "var(--color-text)" }}>{(coverage.coverageFraction * 100).toFixed(1)} %</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, coverage.coverageFraction * 100)}%`, borderRadius: 999, background: coverage.covered ? "var(--c-complete)" : "var(--color-warning)" }} />
            </div>
            <div className="possubtle" style={{ marginTop: 6, fontSize: 12 }}>
              {coverage.summedHours.toLocaleString("en-US")} of {coverage.totalCycleHours.toLocaleString("en-US")} h per year
              {coverage.gapHours > 1 && <> · {coverage.gapHours.toLocaleString("en-US")} h unassigned</>}
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
            <div className="posrow" style={{ justifyContent: "space-between" }}>
              <span className="possubtle">Mutual exclusivity</span>
              {!me.configured
                ? <Badge kind="draft">Not set</Badge>
                : me.allSeparable
                  ? <Badge kind="ok">Separable</Badge>
                  : <Badge kind="warn">{me.overlaps.length} overlap{me.overlaps.length === 1 ? "" : "s"}</Badge>}
            </div>
            <div className="possubtle" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              {!me.configured
                ? "Set the delineation parameters to run this check."
                : me.allSeparable
                  ? `Every condition belongs to exactly one state, separated by ${me.recognizedParameters.join(", ").toLowerCase()}.`
                  : "These state pairs are not separated by the delineation parameters. Add a parameter that distinguishes them, or merge them."}
            </div>
            {canEdit && <DelineationEditor selected={pos.validationRules.mutualExclusivity.delineationParameters} canEdit={canEdit} mefPatch={mefPatch} />}
            {me.overlaps.map((o) => (
              <div key={`${o.aId}-${o.bId}`} style={{ fontSize: 12, marginTop: 4, color: "var(--color-text)" }}>{o.aName} and {o.bName}</div>
            ))}
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
            <div className="posrow" style={{ justifyContent: "space-between" }}>
              <span className="possubtle">Transition map</span>
              {tv.allValid ? <Badge kind="ok">Reachable &amp; exitable</Badge> : <Badge kind="warn">Issues</Badge>}
            </div>
            <div className="possubtle" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              {tv.allValid
                ? `All ${tv.totalStates} states can be reached from at-power operation and can be exited.`
                : "The transition map has gaps."}
            </div>
            {tv.unreachable.length > 0 && <div style={{ fontSize: 12, marginTop: 4, color: "var(--color-text)" }}>Unreachable: {tv.unreachable.map((u) => u.name).join(", ")}</div>}
            {tv.nonExitable.length > 0 && <div style={{ fontSize: 12, marginTop: 4, color: "var(--color-text)" }}>Cannot be exited: {tv.nonExitable.map((u) => u.name).join(", ")}</div>}
            {tv.danglingTargets.length > 0 && <div style={{ fontSize: 12, marginTop: 4, color: "var(--color-text)" }}>Edge to a missing state: {tv.danglingTargets.map((d) => `${d.from} to ${d.to}`).join(", ")}</div>}
            {tv.staleSources.length > 0 && <div style={{ fontSize: 12, marginTop: 4, color: "var(--color-text)" }}>Screened state still in the map: {tv.staleSources.map((s) => s.name).join(", ")}</div>}
            {canEdit && (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setShowTransitions((v) => !v)}>{showTransitions ? "Hide transition editor" : "Edit transitions"}</button>
                {showTransitions && <TransitionEditor canEdit={canEdit} mefPatch={mefPatch} />}
              </div>
            )}
          </div>
        </>
        )}
      </div>
    </>
  );
}

function parseMethod(v: string): InterviewRecord["method"] {
  return v === "WALKDOWN" || v === "COMPUTERIZED_WALKDOWN" || v === "INTERVIEW" ? v : "TABLETOP";
}

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function patchInterview(pos: PlantOperatingStatesAnalysis, uuid: string, fields: Partial<InterviewRecord>): PlantOperatingStatesAnalysis {
  return { ...pos, interviewRecords: (pos.interviewRecords ?? []).map((r) => (r.uuid === uuid ? { ...r, ...fields } : r)) };
}

function removeInterview(pos: PlantOperatingStatesAnalysis, uuid: string): PlantOperatingStatesAnalysis {
  return { ...pos, interviewRecords: (pos.interviewRecords ?? []).filter((r) => r.uuid !== uuid) };
}

function InterviewEditor({ record, evolutions, canEdit, mefPatch, mefPatchDebounced }: {
  record: InterviewRecord;
  evolutions: { uuid: string; name: string }[];
  canEdit: boolean;
  mefPatch?: (mutator: Mutator) => void;
  mefPatchDebounced?: (mutator: Mutator) => void;
}): JSX.Element {
  const uuid = record.uuid ?? "";
  const [dateText, setDateText] = useState(record.date);
  const [personnelText, setPersonnelText] = useState(record.personnelRoles.join(", "));
  const [findingsText, setFindingsText] = useState(record.findings);
  const [overlookedText, setOverlookedText] = useState(record.overlookedEvolutionsIdentified.join(", "));
  function saveDebounced(fields: Partial<InterviewRecord>): void {
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => patchInterview(d, uuid, fields));
  }
  function saveNow(fields: Partial<InterviewRecord>): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => patchInterview(d, uuid, fields));
  }
  function onDelete(): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => removeInterview(d, uuid));
  }
  return (
    <div className="poscard">
      <div className="poscard__head"><h3 className="poscard__title">{canEdit ? "Edit session" : "Session (read-only)"}</h3></div>
      <div className="posfield-grid">
        <div className="posfield">
          <label className="posfield__label">Method</label>
          <select className="posfield__input" value={record.method} disabled={!canEdit} onChange={(e) => saveNow({ method: parseMethod(e.target.value) })}>
            <option value="TABLETOP">Tabletop</option>
            <option value="WALKDOWN">Walkdown</option>
            <option value="COMPUTERIZED_WALKDOWN">Computerised walkdown</option>
            <option value="INTERVIEW">Interview</option>
          </select>
        </div>
        <div className="posfield">
          <label className="posfield__label">Date</label>
          <input className="posfield__input" value={dateText} placeholder="e.g. Mar 12, 2026" disabled={!canEdit} onChange={(e) => { setDateText(e.target.value); saveDebounced({ date: e.target.value }); }} />
        </div>
        <div className="posfield">
          <label className="posfield__label">Evolution</label>
          <select className="posfield__input" value={record.evolutionId ?? ""} disabled={!canEdit} onChange={(e) => saveNow({ evolutionId: e.target.value.length > 0 ? e.target.value : undefined })}>
            <option value="">All evolutions</option>
            {evolutions.map((ev) => <option key={ev.uuid} value={ev.uuid}>{evolutionLabel(ev.name)}</option>)}
          </select>
        </div>
        <div className="posfield">
          <label className="posfield__label">Personnel (comma separated)</label>
          <input className="posfield__input" value={personnelText} placeholder="e.g. Lead Reactor Engineer, Senior I&C Designer" disabled={!canEdit} onChange={(e) => { setPersonnelText(e.target.value); saveDebounced({ personnelRoles: splitList(e.target.value) }); }} />
        </div>
        <div className="posfield posfield-grid--span2">
          <label className="posfield__label">Findings</label>
          <textarea className="posfield__textarea" value={findingsText} placeholder="What the session confirmed or surfaced." disabled={!canEdit} onChange={(e) => { setFindingsText(e.target.value); saveDebounced({ findings: e.target.value }); }} />
        </div>
        <div className="posfield posfield-grid--span2">
          <label className="posfield__label">Overlooked evolutions identified (comma separated)</label>
          <input className="posfield__input" value={overlookedText} placeholder="Evolutions the session newly identified" disabled={!canEdit} onChange={(e) => { setOverlookedText(e.target.value); saveDebounced({ overlookedEvolutionsIdentified: splitList(e.target.value) }); }} />
        </div>
      </div>
      {canEdit && (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onDelete}><POSIcon.Close /> Delete session</button>
        </div>
      )}
    </div>
  );
}

function InterviewsScreen({ canEdit, mefPatch, mefPatchDebounced }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const interviews = interviewsView(pos);
  const rawByUuid = new Map((pos.interviewRecords ?? []).map((r) => [r.uuid ?? "", r]));
  const evolutions = pos.plantEvolutions.map((e) => ({ uuid: e.uuid, name: e.name }));
  function evoName(id: string): string {
    const e = evolutions.find((x) => x.uuid === id);
    return e !== undefined ? evolutionLabel(e.name) : "All evolutions";
  }
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function addInterview(): void {
    if (!canEdit || mefPatch === undefined) return;
    const rec = blankInterviewRecord();
    mefPatch((d) => ({ ...d, interviewRecords: [...(d.interviewRecords ?? []), rec] }));
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(rec.uuid ?? "");
      return next;
    });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interview &amp; walkdown log</h3>
          {canEdit && mefPatch !== undefined && <button type="button" className="posnav__btn posnav__btn--primary" onClick={addInterview}><POSIcon.Plus /> Add session</button>}
        </div>
        <p className="poscard__sub">
          For pre-operational plants, engineering interviews substitute for operations walkdowns.
        </p>
        {interviews.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No interviews or walkdowns logged yet.</p>
        ) : (
        <table className="postable postable--expandable postable--mid">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th>Session</th>
              <th>Method</th>
              <th>Personnel</th>
              <th>Findings</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((iv) => {
              const isOpen = expanded.has(iv.uuid);
              const raw = rawByUuid.get(iv.uuid);
              return (
                <Fragment key={iv.uuid}>
                  <tr className="postable__row--clickable" onClick={() => toggle(iv.uuid)}>
                    <td><span className={`postable__expand${isOpen ? " postable__expand--open" : ""}`}><POSIcon.Chevron /></span></td>
                    <td>
                      <div className="postable__name">{iv.id}</div>
                      <span className="postable__name-sub">{iv.date.length > 0 ? iv.date : "No date"} · {iv.evolutionId !== null ? evoName(iv.evolutionId) : "All evolutions"}</span>
                    </td>
                    <td><span className="poschip">{methodLabel(iv.method)}</span></td>
                    <td><div style={{ fontSize: 12.5 }}>{iv.personnel.join(", ")}</div></td>
                    <td><div style={{ fontSize: 12.5, color: "var(--color-text)", maxWidth: 380 }}>{iv.findings}</div></td>
                    <td>
                      {iv.overlooked > 0 ? (
                        <Badge kind="warn">{iv.overlooked} overlooked evolution{iv.overlooked === 1 ? "" : "s"} identified</Badge>
                      ) : (
                        <Badge kind="ok">No new evolutions</Badge>
                      )}
                    </td>
                  </tr>
                  {isOpen && raw !== undefined && (
                    <tr className="postable__expand-row">
                      <td />
                      <td colSpan={5}>
                        <fieldset disabled={!canEdit} className="postable__expand-body" style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
                          <InterviewEditor record={raw} evolutions={evolutions} canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />
                        </fieldset>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </>
  );
}

function parseCriterion(v: string): ScreeningCriterion | undefined {
  if (v === "SCR-1" || v === "SCR-2" || v === "SCR-3" || v === "ALTERNATE") return v;
  return undefined;
}

function parseImportance(v: string): ImportanceLevel | undefined {
  if (v === "HIGH") return ImportanceLevel.HIGH;
  if (v === "MEDIUM") return ImportanceLevel.MEDIUM;
  if (v === "LOW") return ImportanceLevel.LOW;
  return undefined;
}

function isDefaultScreening(r: PosScreeningRecord): boolean {
  return r.retained
    && r.criterion === undefined
    && r.riskSignificance === undefined
    && r.justification.trim() === ""
    && r.implementsSrs.length === 0
    && r.quantitativeBasis === undefined
    && r.alternateCriterionJustification === undefined;
}

function upsertScreening(pos: PlantOperatingStatesAnalysis, posId: string, fields: { retained?: boolean; criterion?: ScreeningCriterion; riskSignificance?: ImportanceLevel; justification?: string; quantitativeBasis?: number; alternateCriterionJustification?: string }): PlantOperatingStatesAnalysis {
  const apply = (r: PosScreeningRecord): PosScreeningRecord => {
    const retained = fields.retained ?? r.retained;
    const criterion = "criterion" in fields ? fields.criterion : r.criterion;
    const riskSignificance = "riskSignificance" in fields ? fields.riskSignificance : r.riskSignificance;
    const quantitativeBasis = "quantitativeBasis" in fields ? fields.quantitativeBasis : r.quantitativeBasis;
    const alternateCriterionJustification = "alternateCriterionJustification" in fields ? fields.alternateCriterionJustification : r.alternateCriterionJustification;
    return {
      ...r,
      retained,
      criterion: retained ? undefined : criterion,
      riskSignificance: retained ? riskSignificance : undefined,
      quantitativeBasis: retained ? undefined : quantitativeBasis,
      alternateCriterionJustification: retained ? undefined : alternateCriterionJustification,
      justification: fields.justification ?? r.justification,
    };
  };
  const exists = pos.screeningRecords.some((r) => r.posId === posId);
  const base: PosScreeningRecord = { posId, retained: true, justification: "", implementsSrs: [] };
  const next = exists
    ? pos.screeningRecords.map((r) => (r.posId === posId ? apply(r) : r))
    : [...pos.screeningRecords, apply(base)];
  return { ...pos, screeningRecords: next.filter((r) => !isDefaultScreening(r)) };
}

function ScreeningEditorRow({ row, canEdit, mefPatch, mefPatchDebounced }: {
  row: ScreeningEditorView;
  canEdit: boolean;
  mefPatch?: (mutator: Mutator) => void;
  mefPatchDebounced?: (mutator: Mutator) => void;
}): JSX.Element {
  const [justText, setJustText] = useState(row.justification);
  const [altText, setAltText] = useState(row.alternateCriterionJustification);
  const [quantText, setQuantText] = useState(row.quantitativeBasis !== null ? String(row.quantitativeBasis) : "");
  function onDecision(v: string): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => upsertScreening(d, row.posId, { retained: v === "retained" }));
  }
  function onAltJust(v: string): void {
    setAltText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => upsertScreening(d, row.posId, { alternateCriterionJustification: v }));
  }
  function onQuant(v: string): void {
    setQuantText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    const n = Number(v);
    mefPatchDebounced((d) => upsertScreening(d, row.posId, { quantitativeBasis: v.trim().length === 0 || Number.isNaN(n) ? undefined : n }));
  }
  function onCriterion(v: string): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => upsertScreening(d, row.posId, { criterion: parseCriterion(v) }));
  }
  function onRisk(v: string): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => upsertScreening(d, row.posId, { riskSignificance: parseImportance(v) }));
  }
  function onJust(v: string): void {
    setJustText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => upsertScreening(d, row.posId, { justification: v }));
  }
  return (
    <div className="poscard">
      <div className="poscard__head"><h3 className="poscard__title">{canEdit ? "Edit screening decision" : "Screening decision (read-only)"}</h3></div>
      <div className="posfield-grid">
        <div className="posfield">
          <label className="posfield__label">Decision</label>
          <select className="posfield__input" value={row.retained ? "retained" : "screened"} disabled={!canEdit} onChange={(e) => onDecision(e.target.value)}>
            <option value="retained">Retained</option>
            <option value="screened">Screened out</option>
          </select>
        </div>
        {row.retained ? (
          <div className="posfield">
            <label className="posfield__label">Risk significance</label>
            <select className="posfield__input" value={row.riskSignificance ?? ""} disabled={!canEdit} onChange={(e) => onRisk(e.target.value)}>
              <option value="">Unrated</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        ) : (
          <div className="posfield">
            <label className="posfield__label">Screening criterion</label>
            <select className="posfield__input" value={row.criterion ?? ""} disabled={!canEdit} onChange={(e) => onCriterion(e.target.value)}>
              <option value="">Select…</option>
              <option value="SCR-1">SCR-1</option>
              <option value="SCR-2">SCR-2</option>
              <option value="SCR-3">SCR-3</option>
              <option value="ALTERNATE">Alternate</option>
            </select>
            <p className="posfield__hint">SCR-1 and SCR-2: bounded by another state's impact. SCR-3: detected and corrected before a complicated shutdown. Alternate: a separately justified criterion.</p>
          </div>
        )}
        {!row.retained && (
          <div className="posfield">
            <label className="posfield__label">Quantitative basis (optional)</label>
            <input className="posfield__input" value={quantText} placeholder="Frequency or fraction" disabled={!canEdit} onChange={(e) => onQuant(e.target.value)} />
          </div>
        )}
        <div className="posfield posfield-grid--span2">
          <label className="posfield__label">Justification</label>
          <textarea className="posfield__textarea" value={justText} placeholder={row.retained ? "Why this state is retained for analysis…" : "Why screening out leaves downstream results unchanged…"} disabled={!canEdit} onChange={(e) => onJust(e.target.value)} />
        </div>
        {!row.retained && row.criterion === "ALTERNATE" && (
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label">Alternate-criterion justification</label>
            <textarea className="posfield__textarea" value={altText} placeholder="Justify the alternate screening criterion…" disabled={!canEdit} onChange={(e) => onAltJust(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}

function upsertDemandTime(pos: PlantOperatingStatesAnalysis, posId: string, basis: "DEMAND_BASED" | "TIME_BASED" | null): PlantOperatingStatesAnalysis {
  const records = pos.demandTimeBasedRecords ?? [];
  if (basis === null) return { ...pos, demandTimeBasedRecords: records.filter((r) => r.posId !== posId) };
  const exists = records.find((r) => r.posId === posId);
  const rec: DemandTimeBasedRecord = exists !== undefined
    ? { ...exists, initiatorBasis: basis }
    : { posId, initiatorBasis: basis, delineatedToAvoidAveraging: true, justification: "", implementsSrs: [{ sr: "POS-B5", hlr: "B" }] };
  const next = exists !== undefined ? records.map((r) => (r.posId === posId ? rec : r)) : [...records, rec];
  return { ...pos, demandTimeBasedRecords: next };
}

function patchDemandTimeJust(pos: PlantOperatingStatesAnalysis, posId: string, justification: string): PlantOperatingStatesAnalysis {
  return { ...pos, demandTimeBasedRecords: (pos.demandTimeBasedRecords ?? []).map((r) => (r.posId === posId ? { ...r, justification } : r)) };
}

function addSeparation(pos: PlantOperatingStatesAnalysis, posIds: string[], basis: string): PlantOperatingStatesAnalysis {
  const rec: PosSeparationRecord = { separatedPosIds: posIds, differingResponseBasis: basis, differentSuccessCriteria: false, differentBarrierConfiguration: false, moreSevereReleasePotential: false, implementsSrs: [{ sr: "POS-B4", hlr: "B" }] };
  return { ...pos, separationRecords: [...(pos.separationRecords ?? []), rec] };
}

function removeSeparation(pos: PlantOperatingStatesAnalysis, index: number): PlantOperatingStatesAnalysis {
  return { ...pos, separationRecords: (pos.separationRecords ?? []).filter((_, i) => i !== index) };
}

function DemandTimeRow({ state, record, canEdit, mefPatch, mefPatchDebounced }: { state: PlantOperatingState; record?: DemandTimeBasedRecord; canEdit: boolean; mefPatch?: (mutator: Mutator) => void; mefPatchDebounced?: (mutator: Mutator) => void }): JSX.Element {
  const [just, setJust] = useState(record?.justification ?? "");
  function onBasis(v: string): void {
    if (!canEdit || mefPatch === undefined) return;
    const basis = v === "DEMAND_BASED" ? "DEMAND_BASED" : v === "TIME_BASED" ? "TIME_BASED" : null;
    mefPatch((d) => upsertDemandTime(d, state.uuid, basis));
  }
  function onJust(v: string): void {
    setJust(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => patchDemandTimeJust(d, state.uuid, v));
  }
  return (
    <tr>
      <td><div className="postable__name">{stateLabel(state.name)}</div></td>
      <td>
        <select className="posfield__input" style={{ minWidth: 150 }} value={record?.initiatorBasis ?? ""} disabled={!canEdit} onChange={(e) => onBasis(e.target.value)}>
          <option value="">Not set</option>
          <option value="TIME_BASED">Time-based</option>
          <option value="DEMAND_BASED">Demand-based</option>
        </select>
      </td>
      <td>
        {record !== undefined && <input className="posfield__input" placeholder="Short note" value={just} disabled={!canEdit} onChange={(e) => onJust(e.target.value)} />}
      </td>
    </tr>
  );
}

function DemandTimeEditor({ canEdit, mefPatch, mefPatchDebounced }: { canEdit: boolean; mefPatch?: (mutator: Mutator) => void; mefPatchDebounced?: (mutator: Mutator) => void }): JSX.Element {
  const { pos } = usePosWorkbook();
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const retained = pos.plantOperatingStates.filter((s) => !screenedOut.has(s.uuid));
  const byId = new Map((pos.demandTimeBasedRecords ?? []).map((r) => [r.posId, r] as const));
  return (
    <div className="poscard">
      <div className="poscard__head"><h3 className="poscard__title">Demand-based and time-based states</h3></div>
      <p className="poscard__sub">Mark how each state is entered. This keeps short demand events apart from long time-based states.</p>
      {retained.length === 0 ? <p className="posmuted" style={{ padding: "8px 0", margin: 0 }}>No retained states yet.</p> : (
        <table className="postable postable--mid">
          <thead><tr><th>State</th><th>Basis</th><th>Note</th></tr></thead>
          <tbody>
            {retained.map((s) => <DemandTimeRow key={s.uuid} state={s} record={byId.get(s.uuid)} canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />)}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SeparationEditor({ canEdit, mefPatch }: { canEdit: boolean; mefPatch?: (mutator: Mutator) => void }): JSX.Element {
  const { pos } = usePosWorkbook();
  const screenedOut = new Set(pos.screeningRecords.filter((r) => !r.retained).map((r) => r.posId));
  const retained = pos.plantOperatingStates.filter((s) => !screenedOut.has(s.uuid));
  const nameById = new Map(pos.plantOperatingStates.map((s) => [s.uuid, stateLabel(s.name)] as const));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [basis, setBasis] = useState("");
  const records = pos.separationRecords ?? [];
  function togglePick(id: string): void {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function add(): void {
    if (!canEdit || mefPatch === undefined || picked.size < 2 || basis.trim().length === 0) return;
    const ids = Array.from(picked);
    mefPatch((d) => addSeparation(d, ids, basis));
    setPicked(new Set());
    setBasis("");
  }
  function remove(index: number): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => removeSeparation(d, index));
  }
  return (
    <div className="poscard">
      <div className="poscard__head"><h3 className="poscard__title">States kept separate</h3></div>
      <p className="poscard__sub">List states that are too different to group together. This keeps grouping from hiding the difference.</p>
      {records.length > 0 && (
        <div className="posbasis__list">
          {records.map((rec, i) => (
            <div key={rec.separatedPosIds.join("-")} className="posbasis__item">
              <div style={{ minWidth: 0 }}>
                <div className="posbasis__chips">{rec.separatedPosIds.map((id) => <span key={id} className="poschip">{nameById.get(id) ?? id}</span>)}</div>
                <div className="posbasis__note">{rec.differingResponseBasis}</div>
              </div>
              {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => remove(i)}>Remove</button>}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="posbasis__form">
          <div className="posfield">
            <label className="posfield__label">Pick the states</label>
            <div className="posbasis__chips">
              {retained.map((s) => (
                <button key={s.uuid} type="button" className={`posnav__btn posnav__btn--sm${picked.has(s.uuid) ? " posnav__btn--primary" : ""}`} onClick={() => togglePick(s.uuid)}>{stateLabel(s.name)}</button>
              ))}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Why they stay separate</label>
            <input className="posfield__input" placeholder="Short reason" value={basis} onChange={(e) => setBasis(e.target.value)} />
          </div>
          <div className="posbasis__actions">
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={picked.size < 2 || basis.trim().length === 0} onClick={add}>Add separation</button>
          </div>
        </div>
      )}
    </div>
  );
}

function addSubsumption(pos: PlantOperatingStatesAnalysis, subsumedPosId: string, subsumingPosId: string, justification: string): PlantOperatingStatesAnalysis {
  const rec: SubsumedPosRecord = { subsumedPosId, subsumingPosId, criterion: "SCR-1", justification, riskImpact: ImportanceLevel.LOW, limitations: [], validationMethod: "Qualitative comparison of the subsumed and subsuming states.", implementsSrs: [{ sr: "POS-B4", hlr: "B" }] };
  return { ...pos, subsumedPosRecords: [...(pos.subsumedPosRecords ?? []), rec] };
}

function removeSubsumption(pos: PlantOperatingStatesAnalysis, index: number): PlantOperatingStatesAnalysis {
  return { ...pos, subsumedPosRecords: (pos.subsumedPosRecords ?? []).filter((_, i) => i !== index) };
}

function SubsumptionEditor({ canEdit, mefPatch }: { canEdit: boolean; mefPatch?: (mutator: Mutator) => void }): JSX.Element {
  const { pos } = usePosWorkbook();
  const states = pos.plantOperatingStates;
  const nameById = new Map(states.map((s) => [s.uuid, stateLabel(s.name)] as const));
  const [subsumed, setSubsumed] = useState("");
  const [subsuming, setSubsuming] = useState("");
  const [just, setJust] = useState("");
  const records = pos.subsumedPosRecords ?? [];
  const valid = subsumed !== "" && subsuming !== "" && subsumed !== subsuming && just.trim().length > 0;
  function add(): void {
    if (!canEdit || mefPatch === undefined || !valid) return;
    mefPatch((d) => addSubsumption(d, subsumed, subsuming, just));
    setSubsumed(""); setSubsuming(""); setJust("");
  }
  function remove(index: number): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => removeSubsumption(d, index));
  }
  return (
    <div className="poscard">
      <div className="poscard__head"><h3 className="poscard__title">Subsumed states</h3></div>
      <p className="poscard__sub">Link a screened-out state to the retained state that covers it.</p>
      {records.length > 0 && (
        <div className="posbasis__list">
          {records.map((rec, i) => (
            <div key={`${rec.subsumedPosId}-${rec.subsumingPosId}`} className="posbasis__item">
              <div style={{ minWidth: 0 }}>
                <div className="posbasis__chips">
                  <span className="poschip">{nameById.get(rec.subsumedPosId) ?? rec.subsumedPosId}</span>
                  <span className="possubtle" style={{ fontSize: 12, alignSelf: "center" }}>covered by</span>
                  <span className="poschip">{nameById.get(rec.subsumingPosId) ?? rec.subsumingPosId}</span>
                </div>
                <div className="posbasis__note">{rec.justification}</div>
              </div>
              {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => remove(i)}>Remove</button>}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="posbasis__form">
          <div className="posfield-grid">
            <div className="posfield">
              <label className="posfield__label">Screened-out state</label>
              <select className="posfield__input" value={subsumed} onChange={(e) => setSubsumed(e.target.value)}>
                <option value="">Select</option>
                {states.map((s) => <option key={s.uuid} value={s.uuid}>{stateLabel(s.name)}</option>)}
              </select>
            </div>
            <div className="posfield">
              <label className="posfield__label">Covered by</label>
              <select className="posfield__input" value={subsuming} onChange={(e) => setSubsuming(e.target.value)}>
                <option value="">Select</option>
                {states.map((s) => <option key={s.uuid} value={s.uuid}>{stateLabel(s.name)}</option>)}
              </select>
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Why it is covered</label>
              <input className="posfield__input" placeholder="Short reason" value={just} onChange={(e) => setJust(e.target.value)} />
            </div>
          </div>
          <div className="posbasis__actions">
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!valid} onClick={add}>Add subsumption</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScreeningBasisCards({ canEdit, mefPatch, mefPatchDebounced }: { canEdit: boolean; mefPatch?: (mutator: Mutator) => void; mefPatchDebounced?: (mutator: Mutator) => void }): JSX.Element {
  return (
    <>
      <DemandTimeEditor canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />
      <SeparationEditor canEdit={canEdit} mefPatch={mefPatch} />
      <SubsumptionEditor canEdit={canEdit} mefPatch={mefPatch} />
    </>
  );
}

function ScreeningScreen({ canEdit, mefPatch, mefPatchDebounced }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const rows = screeningEditorView(pos);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Screening decisions</h3></div>
        {rows.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No operating states defined yet.</p>
        ) : (
        <table className="postable postable--expandable postable--mid">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th>State</th>
              <th>Mode</th>
              <th>Decision</th>
              <th>Criterion</th>
              <th>Risk significance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = expanded.has(r.posId);
              return (
                <Fragment key={r.posId}>
                  <tr className="postable__row--clickable" onClick={() => toggle(r.posId)}>
                    <td><span className={`postable__expand${isOpen ? " postable__expand--open" : ""}`}><POSIcon.Chevron /></span></td>
                    <td>
                      <div className="postable__name">{stateLabel(r.name)}</div>
                      <span className="postable__name-sub">{r.description}</span>
                    </td>
                    <td className="mono">{r.mode}</td>
                    <td>
                      <div className="posrow" style={{ gap: 6 }}>
                        {r.retained ? <Badge kind="ok">Retained</Badge> : <Badge kind="draft">Screened out</Badge>}
                        {r.needsBasis && <span className="poschip poschip--warn">Needs basis</span>}
                      </div>
                    </td>
                    <td>{!r.retained && r.criterion !== null ? <span className="poschip">{r.criterion}</span> : <span className="possubtle" style={{ fontSize: 11.5 }}>—</span>}</td>
                    <td>{r.retained && r.riskSignificance !== null ? <span className={`poschip ${r.riskLabel === "High" ? "poschip--warn" : ""}`}>{r.riskLabel}</span> : <span className="possubtle" style={{ fontSize: 11.5 }}>—</span>}</td>
                  </tr>
                  {isOpen && (
                    <tr className="postable__expand-row">
                      <td />
                      <td colSpan={5}>
                        <fieldset disabled={!canEdit} className="postable__expand-body" style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
                          <ScreeningEditorRow row={r} canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />
                        </fieldset>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
      {pos.plantOperatingStates.length > 0 && <ScreeningBasisCards canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />}
    </>
  );
}

function GroupingScreen({ openDrawer, canEdit, onAddGroup }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const groups = groupsView(pos);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operating-state groups</h3>
          {onAddGroup !== undefined && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onAddGroup}><POSIcon.Plus /> Add group</button>}
        </div>
        <p className="poscard__sub">Bound similar operating states into a group represented by a worst-case bounding state.</p>
        {groups.length === 0 && <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No groups defined yet.</p>}
      </div>

      {groups.length > 0 && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {groups.map((g) => (
          <div key={g.id} className="poscard">
            <div className="poscard__head">
              <div>
                <div className="posrow" style={{ gap: 10 }}>
                  <h3 className="poscard__title" style={{ fontSize: 16 }}>{g.name}</h3>
                  {g.status === "ok" ? <Badge kind="ok">Bounded</Badge> : <Badge kind="warn">Incomplete</Badge>}
                </div>
                <div className="possubtle" style={{ marginTop: 6 }}>
                  Members: {g.members.map((m) => m.label).join(", ")} · Total time {g.durationSum}
                </div>
              </div>
              <button type="button" className="posnav__btn" onClick={() => openDrawer({ kind: "group", id: g.id })}>{canEdit ? "Edit" : "View"}</button>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.55, marginBottom: 10 }}>{g.rationale}</div>
            <div className="posrow" style={{ gap: 22, fontSize: 12.5 }}>
              <div><span className="possubtle">Bounding by</span> <strong style={{ color: "var(--color-text)" }}>{g.boundingCharacteristic}</strong></div>
            </div>
            {g.statusMessage !== undefined && (
              <div style={{ marginTop: 10, padding: 10, background: "rgba(196,122,24,0.08)", borderLeft: "3px solid var(--color-warning)", borderRadius: 4, fontSize: 12.5, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", width: 14, height: 14, color: "var(--color-warning)", flexShrink: 0 }}><POSIcon.Warn /></span>
                <span>{g.statusMessage}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </>
  );
}

function patchStateQuant(pos: PlantOperatingStatesAnalysis, uuid: string, fields: { durationHours?: number; frequencyPerYear?: number; basis?: string }): PlantOperatingStatesAnalysis {
  const plantOperatingStates = pos.plantOperatingStates.map((s) => {
    if (s.uuid !== uuid) return s;
    let meanEntryFrequency = s.meanEntryFrequency;
    if (fields.frequencyPerYear !== undefined) {
      meanEntryFrequency = typeof s.meanEntryFrequency === "number"
        ? fields.frequencyPerYear
        : { ...s.meanEntryFrequency, value: fields.frequencyPerYear };
    }
    return {
      ...s,
      meanDurationHours: fields.durationHours ?? s.meanDurationHours,
      meanEntryFrequency,
      durationAndCycleTimingBasis: fields.basis ?? s.durationAndCycleTimingBasis,
    };
  });
  if (fields.durationHours === undefined) return { ...pos, plantOperatingStates };
  const durationById = new Map(plantOperatingStates.map((s) => [s.uuid, s.meanDurationHours]));
  const plantOperatingStateGroups = pos.plantOperatingStateGroups?.map((g) =>
    g.memberPosIds.includes(uuid)
      ? { ...g, summedDurationHours: g.memberPosIds.reduce((acc, id) => acc + (durationById.get(id) ?? 0), 0) }
      : g,
  );
  return plantOperatingStateGroups === undefined
    ? { ...pos, plantOperatingStates }
    : { ...pos, plantOperatingStates, plantOperatingStateGroups };
}

function FrequencyEditor({ row, canEdit, mefPatchDebounced }: {
  row: QuantStateView;
  canEdit: boolean;
  mefPatchDebounced?: (mutator: Mutator) => void;
}): JSX.Element {
  const [durationText, setDurationText] = useState(String(row.durationHours));
  const [freqText, setFreqText] = useState(String(row.frequencyPerYear));
  const [basisText, setBasisText] = useState(row.basis);
  function onDuration(v: string): void {
    setDurationText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    const n = Number(v);
    if (v.trim().length === 0 || Number.isNaN(n) || n < 0) return;
    mefPatchDebounced((d) => patchStateQuant(d, row.uuid, { durationHours: n }));
  }
  function onFreq(v: string): void {
    setFreqText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    const n = Number(v);
    if (v.trim().length === 0 || Number.isNaN(n) || n < 0) return;
    mefPatchDebounced((d) => patchStateQuant(d, row.uuid, { frequencyPerYear: n }));
  }
  function onBasis(v: string): void {
    setBasisText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => patchStateQuant(d, row.uuid, { basis: v }));
  }
  return (
    <div className="poscard">
      <div className="poscard__head"><h3 className="poscard__title">{canEdit ? "Edit duration & frequency" : "Duration & frequency (read-only)"}</h3></div>
      <div className="posfield-grid">
        <div className="posfield">
          <label className="posfield__label">Mean duration (h/yr)</label>
          <input className="posfield__input" value={durationText} disabled={!canEdit} onChange={(e) => onDuration(e.target.value)} />
        </div>
        <div className="posfield">
          <label className="posfield__label">Entry frequency (per year)</label>
          <input className="posfield__input" value={freqText} disabled={!canEdit} onChange={(e) => onFreq(e.target.value)} />
        </div>
        <div className="posfield posfield-grid--span2">
          <label className="posfield__label">Basis</label>
          <input className="posfield__input" value={basisText} placeholder="Cite the cycle-plan section or vendor letter…" disabled={!canEdit} onChange={(e) => onBasis(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function patchCycleHours(pos: PlantOperatingStatesAnalysis, hours: number): PlantOperatingStatesAnalysis {
  return {
    ...pos,
    validationRules: {
      ...pos.validationRules,
      collectiveExhaustivity: { ...pos.validationRules.collectiveExhaustivity, totalCycleHours: hours },
    },
  };
}

function CycleBasisField({ hours, canEdit, mefPatchDebounced }: { hours: number; canEdit: boolean; mefPatchDebounced?: (mutator: Mutator) => void }): JSX.Element {
  const [text, setText] = useState(String(hours));
  function onChange(v: string): void {
    setText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    const n = Number(v);
    if (v.trim().length === 0 || Number.isNaN(n) || n <= 0) return;
    mefPatchDebounced((d) => patchCycleHours(d, n));
  }
  if (!canEdit) return <div className="posstat__value">{formatNumber(hours)}<span className="posstat__unit">h/yr</span></div>;
  return (
    <div className="posstat__value">
      <input className="posfield__input" value={text} onChange={(e) => onChange(e.target.value)} style={{ width: 96 }} />
      <span className="posstat__unit">h/yr</span>
    </div>
  );
}

function FrequencyScreen({ canEdit, mefPatchDebounced }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const rows = quantStatesView(pos);
  const recon = cycleReconciliation(pos);
  const rollups = groupRollupView(pos);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const shortfall = recon.deltaHours < 0;
  const deltaLabel = `${recon.deltaHours >= 0 ? "+" : "-"}${formatNumber(Math.round(Math.abs(recon.deltaHours)))}`;
  return (
    <>
      {rows.length > 0 && (
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Cycle-time reconciliation</h3>
          {recon.withinTolerance
            ? <Badge kind="ok">Balanced</Badge>
            : <Badge kind="warn">{shortfall ? "Shortfall" : "Excess"}</Badge>}
        </div>
        <p className="poscard__sub">The state durations should account for the full operating cycle. Set the cycle basis to your plant's cycle length.</p>
        <div className="posstats">
          <div className="posstat">
            <div className="posstat__label">Sum of state durations</div>
            <div className="posstat__value">{formatNumber(recon.summedHours)}<span className="posstat__unit">h/yr</span></div>
          </div>
          <div className="posstat">
            <div className="posstat__label">Cycle basis</div>
            <CycleBasisField hours={recon.totalCycleHours} canEdit={canEdit} mefPatchDebounced={mefPatchDebounced} />
          </div>
          <div className={`posstat${recon.withinTolerance ? "" : " posstat--warn"}`}>
            <div className="posstat__label">Delta</div>
            <div className="posstat__value">{deltaLabel}<span className="posstat__unit">h/yr</span></div>
          </div>
        </div>
      </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Frequencies &amp; durations</h3>
        </div>
        {rows.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No operating states defined yet.</p>
        ) : (
        <table className="postable postable--expandable postable--mid">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th>State</th>
              <th>Mode</th>
              <th>Mean duration</th>
              <th>Entry frequency</th>
              <th>Cycle fraction</th>
              <th>Basis</th>
              <th>Pre-op</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const isOpen = expanded.has(s.uuid);
              const preops = preOpsForState(pos, s.uuid);
              return (
                <Fragment key={s.uuid}>
                  <tr className="postable__row--clickable" onClick={() => toggle(s.uuid)}>
                    <td>
                      <span className={`postable__expand${isOpen ? " postable__expand--open" : ""}`}><POSIcon.Chevron /></span>
                    </td>
                    <td>
                      <div className="postable__name">{stateLabel(s.name)}{!s.retained && <span className="possubtle" style={{ fontSize: 11, marginLeft: 6 }}>screened</span>}</div>
                      <span className="postable__name-sub">{s.description}</span>
                    </td>
                    <td className="mono">{s.mode}</td>
                    <td className="mono">{formatDuration(s.durationHours)}</td>
                    <td className="mono">{s.frequencyPerYear === 0 && s.mode === "POWER" ? "Base state" : formatFrequency(s.frequencyPerYear)}</td>
                    <td className="mono">{(s.durationFraction * 100).toFixed(1)} %</td>
                    <td>
                      {s.basis.trim().length > 0
                        ? <span className="possubtle" style={{ fontSize: 12.5 }} title={s.basis}>{s.basis.length > 40 ? `${s.basis.slice(0, 40)}…` : s.basis}</span>
                        : <span className="poschip poschip--warn">Missing</span>}
                    </td>
                    <td>
                      {s.hasPreopAssumption
                        ? <span className="poschip poschip--preop"><POSIcon.Warn /> Flagged</span>
                        : <span className="possubtle" style={{ fontSize: 11.5 }}>—</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="postable__expand-row">
                      <td />
                      <td colSpan={7}>
                        <fieldset disabled={!canEdit} className="postable__expand-body" style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
                          <FrequencyEditor row={s} canEdit={canEdit} mefPatchDebounced={mefPatchDebounced} />
                          <PreopAssumptionCard assumption={preops[0]} />
                        </fieldset>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {rollups.length > 0 && (
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Group roll-up check</h3></div>
        <p className="poscard__sub">A group's stored duration should match the sum of its member states. Entry frequency is the rate of entering the group, not the sum of member frequencies.</p>
        <table className="postable postable--mid">
          <thead>
            <tr><th>Group</th><th>Members</th><th>Sum of member duration</th><th>Stored duration</th><th>Group entry frequency</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rollups.map((g) => (
              <tr key={g.id}>
                <td><div className="postable__name">{g.name}</div></td>
                <td className="mono">{g.memberCount}</td>
                <td className="mono">{formatDuration(g.memberDurationHours)}</td>
                <td className="mono">{formatDuration(g.storedDurationHours)}</td>
                <td className="mono">{formatFrequency(g.entryFreqPerYear)}</td>
                <td>{g.durationMatches ? <Badge kind="ok">Matches</Badge> : <Badge kind="warn">Mismatch</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

    </>
  );
}

function patchStateDecayHeat(pos: PlantOperatingStatesAnalysis, uuid: string, fields: { timeHours?: number; mw?: number; basis?: string }): PlantOperatingStatesAnalysis {
  const round = (n: number): number => Number(n.toFixed(3));
  const plantOperatingStates = pos.plantOperatingStates.map((s) => {
    if (s.uuid !== uuid) return s;
    const decayHeatLevel = fields.mw !== undefined
      ? { min: round(fields.mw * 0.9), max: round(fields.mw * 1.1), representative: round(fields.mw), units: "MWth" }
      : s.rcsParameters.decayHeatLevel;
    return {
      ...s,
      meanTimeAfterShutdownHours: fields.timeHours ?? s.meanTimeAfterShutdownHours,
      rcsParameters: { ...s.rcsParameters, decayHeatLevel },
      decayHeatBasis: fields.basis ?? s.decayHeatBasis,
      decayHeatLevelDefined: fields.mw !== undefined ? true : s.decayHeatLevelDefined,
    };
  });
  if (fields.mw === undefined) return { ...pos, plantOperatingStates };
  const s = plantOperatingStates.find((x) => x.uuid === uuid);
  if (s === undefined) return { ...pos, plantOperatingStates };
  const entry = {
    posId: uuid,
    decayHeatLevel: s.rcsParameters.decayHeatLevel,
    timeAfterShutdownHours: s.meanTimeAfterShutdownHours ?? 0,
    basis: s.decayHeatBasis ?? "",
    isLpsd: s.operatingMode !== "POWER",
    implementsSrs: [{ sr: "POS-C4", hlr: "C" as const }],
  };
  const decayHeatCharacterizations = [...pos.decayHeatCharacterizations.filter((d) => d.posId !== uuid), entry];
  return { ...pos, plantOperatingStates, decayHeatCharacterizations };
}

function DecayHeatRow({ state, recorded, powerMw, operatingDays, method, canEdit, mefPatch, mefPatchDebounced }: {
  state: PlantOperatingState;
  recorded: boolean;
  powerMw?: number;
  operatingDays?: number;
  method: DecayHeatMethod;
  canEdit: boolean;
  mefPatch?: (mutator: Mutator) => void;
  mefPatchDebounced?: (mutator: Mutator) => void;
}): JSX.Element {
  const [timeText, setTimeText] = useState(state.meanTimeAfterShutdownHours !== undefined ? String(state.meanTimeAfterShutdownHours) : "");
  const [mwText, setMwText] = useState(state.decayHeatLevelDefined ? String(state.rcsParameters.decayHeatLevel.representative) : "");
  const mwNum = Number(mwText);
  const fractionPercent = mwText.trim().length > 0 && !Number.isNaN(mwNum) && powerMw !== undefined && powerMw > 0 ? (mwNum / powerMw) * 100 : undefined;
  const canCompute = canEdit && mefPatch !== undefined && powerMw !== undefined && operatingDays !== undefined;
  function onTime(v: string): void {
    setTimeText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    const t = Number(v);
    if (v.trim().length === 0 || Number.isNaN(t) || t <= 0) return;
    mefPatchDebounced((d) => patchStateDecayHeat(d, state.uuid, { timeHours: t }));
  }
  function onMw(v: string): void {
    setMwText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    const m = Number(v);
    if (v.trim().length === 0 || Number.isNaN(m) || m < 0) return;
    mefPatchDebounced((d) => patchStateDecayHeat(d, state.uuid, { mw: m, basis: "Manual entry." }));
  }
  function compute(): void {
    const t = Number(timeText);
    if (!canCompute || powerMw === undefined || operatingDays === undefined) return;
    if (timeText.trim().length === 0 || Number.isNaN(t) || t <= 0) return;
    const mw = method.compute(t, powerMw, operatingDays);
    setMwText(mw.toFixed(2));
    mefPatch?.((d) => patchStateDecayHeat(d, state.uuid, { timeHours: t, mw, basis: `${method.label} at ${t} h after shutdown.` }));
  }
  return (
    <tr>
      <td>
        <div className="postable__name">{stateLabel(state.name)}</div>
        <span className="postable__name-sub">{state.description}</span>
      </td>
      <td><input className="posfield__input" value={timeText} placeholder="hours" style={{ width: 90 }} disabled={!canEdit} onChange={(e) => onTime(e.target.value)} /></td>
      <td>
        <div className="posrow" style={{ gap: 6, alignItems: "center" }}>
          <input className="posfield__input" value={mwText} style={{ width: 90 }} disabled={!canEdit} onChange={(e) => onMw(e.target.value)} />
          {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" disabled={!canCompute} onClick={compute}>Compute</button>}
        </div>
      </td>
      <td className="mono">{fractionPercent !== undefined ? `${fractionPercent.toFixed(2)} %` : "—"}</td>
      <td>{recorded ? <Badge kind="ok">Characterised</Badge> : <Badge kind="warn">Pending</Badge>}</td>
    </tr>
  );
}

function patchOperatingDays(pos: PlantOperatingStatesAnalysis, days: number): PlantOperatingStatesAnalysis {
  return { ...pos, decayHeatOperatingDays: days };
}

function OperatingDaysField({ days, canEdit, mefPatchDebounced }: {
  days?: number;
  canEdit: boolean;
  mefPatchDebounced?: (mutator: Mutator) => void;
}): JSX.Element {
  const [text, setText] = useState(days !== undefined ? String(days) : "");
  function onChange(v: string): void {
    setText(v);
    if (!canEdit || mefPatchDebounced === undefined) return;
    const n = Number(v);
    if (v.trim().length === 0 || Number.isNaN(n) || n <= 0) return;
    mefPatchDebounced((d) => patchOperatingDays(d, n));
  }
  return (
    <div className="posrow" style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
      <span className="possubtle">Full-power operating time before shutdown (days)</span>
      <input className="posfield__input" value={text} placeholder="days" style={{ width: 110 }} disabled={!canEdit} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DecayHeatScreen({ canEdit, mefPatch, mefPatchDebounced }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const parsedPower = parseFloat(pos.metadata.plantIdentity?.thermalPower ?? "");
  const operatingPowerMw = Number.isFinite(parsedPower) && parsedPower > 0 ? parsedPower : undefined;
  const operatingDays = pos.decayHeatOperatingDays;
  const lpsd = pos.plantOperatingStates.filter((s) => s.operatingMode !== "POWER");
  const characterized = new Set(pos.decayHeatCharacterizations.map((d) => d.posId));
  const [methodId, setMethodId] = useState(DECAY_HEAT_METHODS[0].id);
  const method = DECAY_HEAT_METHODS.find((m) => m.id === methodId) ?? DECAY_HEAT_METHODS[0];
  const [computeVersion, setComputeVersion] = useState(0);
  const canComputeAll = canEdit && mefPatch !== undefined && operatingPowerMw !== undefined && operatingDays !== undefined && lpsd.length > 0;
  function computeAll(): void {
    if (!canComputeAll || operatingPowerMw === undefined || operatingDays === undefined) return;
    mefPatch?.((d) => {
      let next = d;
      for (const s of lpsd) {
        const t = s.meanTimeAfterShutdownHours;
        if (t === undefined || t <= 0) continue;
        next = patchStateDecayHeat(next, s.uuid, { timeHours: t, mw: method.compute(t, operatingPowerMw, operatingDays), basis: `${method.label} at ${t} h after shutdown.` });
      }
      return next;
    });
    setComputeVersion((v) => v + 1);
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Decay-heat characterisation</h3>
          {canEdit && mefPatch !== undefined && lpsd.length > 0 && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!canComputeAll} onClick={computeAll}>
              <POSIcon.Sparkle /> Compute all with {method.label}
            </button>
          )}
        </div>
        <p className="poscard__sub">Enter the decay heat for each state, or compute it from a correlation.</p>
        <OperatingDaysField days={operatingDays} canEdit={canEdit} mefPatchDebounced={mefPatchDebounced} />
        {DECAY_HEAT_METHODS.length > 1 && (
          <div className="posrow" style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
            <span className="possubtle">Correlation</span>
            <select className="posfield__input" style={{ width: 240 }} value={methodId} disabled={!canEdit} onChange={(e) => setMethodId(e.target.value)}>
              {DECAY_HEAT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        )}
        {operatingPowerMw === undefined && (
          <p className="posfield__hint" style={{ marginBottom: 10 }}>Set the core thermal power in the plant setup to compute decay heat from a correlation.</p>
        )}
        {operatingDays === undefined && (
          <p className="posfield__hint" style={{ marginBottom: 10 }}>Set the operating days before shutdown to compute decay heat from a correlation.</p>
        )}
        {lpsd.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No LPSD states yet.</p>
        ) : (
        <table className="postable postable--mid">
          <thead>
            <tr>
              <th>State</th>
              <th>Time after shutdown (h)</th>
              <th>Decay heat (MWth)</th>
              <th>Fraction of power</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lpsd.map((s) => (
              <DecayHeatRow key={`${s.uuid}-${computeVersion}`} state={s} recorded={characterized.has(s.uuid)} powerMw={operatingPowerMw} operatingDays={operatingDays} method={method} canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />
            ))}
          </tbody>
        </table>
        )}
      </div>
    </>
  );
}

function DraftScreen({
  cc,
  scores,
  stage,
  onGenerate,
  onSubmitDraft,
  canSubmit,
}: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: Stage;
  onGenerate: (final: boolean) => void;
  onSubmitDraft: (final: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { pos } = usePosWorkbook();
  const ready = scores.blocked === 0;
  const toc = computePosReportToc(pos);
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(pos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pos.name} — POS Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{pos.name}</h1>
        <h2>Plant Operating States Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {toc.map((entry) => (
            <div key={entry.title} className="posgen__preview-toc-row">
              <span style={{ paddingLeft: entry.indent === 1 ? 24 : 0 }}>{entry.title}</span>
              <span>{entry.page}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="posgen__side">
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Conformance check</h3>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Capability category</span>
            <span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span>
          </div>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Plant stage</span>
            <span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span>
          </div>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Items satisfied</span>
            <span className="posmono">{scores.met} / {scores.applicable}</span>
          </div>
          {scores.warn > 0 && (
            <div className="posgen__bar">
              <span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span>
              <span className="posmono">{scores.warn}</span>
            </div>
          )}
          {scores.blocked > 0 && (
            <div className="posgen__bar">
              <span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span>
              <span className="posmono">{scores.blocked}</span>
            </div>
          )}
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">{canSubmit ? "Hand-off to internal review" : "Read-only draft preview"}</h3>
          {canSubmit ? (
            ready ? (
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                Producing the draft locks Steps 1–9 and advances the workbook to <strong>Internal Technical Review</strong>.
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                {scores.blocked} blocking item{scores.blocked === 1 ? "" : "s"} remain. You may produce a working draft for review, but the workbook cannot reach approval until blockers are resolved.
              </p>
            )
          ) : (
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Only the preparer or a co-preparer can submit the draft for internal review.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
                <POSIcon.Send /> {ready ? "Submit draft to internal review" : "Submit working draft to review"}
              </button>
            )}
            <button type="button" className="posnav__btn" onClick={() => onGenerate(ready)}>
              <POSIcon.Download /> Download draft (.docx)
            </button>
            <button type="button" className="posnav__btn" onClick={downloadJson}>
              <POSIcon.Download /> Download JSON
            </button>
            <button type="button" className="posnav__btn" onClick={() => onGenerate(ready)}>
              <POSIcon.Eye /> Preview before generating
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  type DrawerContext,
  type ScreenProps,
  blankPlantEvolution,
  blankPlantOperatingState,
  blankPlantOperatingStateGroup,
  SetupScreen,
  DocumentsScreen,
  EvolutionsScreen,
  StatesScreen,
  InterviewsScreen,
  ScreeningScreen,
  GroupingScreen,
  FrequencyScreen,
  DecayHeatScreen,
  DraftScreen,
};
