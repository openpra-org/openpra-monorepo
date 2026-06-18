import { Fragment, JSX, useRef, useState } from "react";
import { type PosDocumentEntry } from "./posWorkbookApi";
import { type PlantOperatingStatesAnalysis, type PlantEvolution, type PlantOperatingState, type ParameterRange, type ScreeningCriterion, type PosScreeningRecord, EvolutionType, OperatingMode } from "interfaces-mef-types/pos/plant-operating-state-analysis";
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
  cycleReconciliation,
  quantStatesView,
  groupRollupView,
  type QuantStateView,
  stateLabel,
  evolutionLabel,
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
import { WorkbookInterfaceMap } from "../workbooks/workbookInterfaces";

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
        <p className="poscard__sub">POS has no upstream inputs. It feeds the operating states, alignments and outage timelines downstream to the rest of the model.</p>
        <WorkbookInterfaceMap element="POS" mode="outputs" />
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

function DocumentsScreen({ onAction, realDocuments, canUpload, onUploadFile, onDeleteDocument, onDownloadDocument }: DocumentsScreenProps): JSX.Element {
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
      .then(() => { onAction("Uploaded — document processing coming soon"); })
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
            {isReal && !showExampleDocs ? <Badge>Processing coming soon</Badge> : <Badge kind="progress">All extracted</Badge>}
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
                  <div className="posdoc__name">{d.name}</div>
                  <div className="posdoc__meta">{d.sizeLabel} · {d.uploadedLabel}</div>
                </div>
                <div className="posdoc__extracted">
                  <POSIcon.Sparkle /> {d.extracted}
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
                        <div className="posdoc__main">
                          <div className="posdoc__name">{d.filename}</div>
                          <div className="posdoc__meta">{formatSize(d.size)} · uploaded by @{d.uploadedBy}</div>
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
                <div className="posdoc__extracted">
                  <POSIcon.Sparkle /> {d.extracted}
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
          <table className="postable">
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

function StatesScreen({ openDrawer, onAddState }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const states = statesView(pos);
  const coverage = coverageView(pos);
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
        <table className="postable">
          <thead>
            <tr>
              <th>State</th>
              <th>Mode</th>
              <th>Coolant T</th>
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
          <h3 className="poscard__title">Coverage check</h3>
          {coverage.covered
            ? <Badge kind="ok">Cycle covered</Badge>
            : <Badge kind="warn">Coverage incomplete</Badge>}
        </div>
        <p className="poscard__sub">
          Collective exhaustivity is computed from the state durations.
        </p>
        <div style={{ marginTop: 12 }}>
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
        <div style={{ marginTop: 14, padding: 12, background: "var(--color-bg-to)", borderRadius: 6, fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--color-text)" }}>Mutual exclusivity.</strong> Every plant condition should belong to exactly one state. The automatic overlap check is not built yet, so it is not verified here.
        </div>
      </div>
    </>
  );
}

function InterviewsScreen({ onAction, canEdit }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const interviews = interviewsView(pos);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interview &amp; walkdown log</h3>
          <div className="posrow" style={{ gap: 8 }}>
            {canEdit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Log session — coming soon")}><POSIcon.Plus /> Log session</button>}
          </div>
        </div>
        <p className="poscard__sub">
          For pre-operational plants, engineering interviews substitute for operations walkdowns.
        </p>
        {interviews.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No interviews or walkdowns logged yet.</p>
        ) : (
        <table className="postable">
          <thead>
            <tr>
              <th>Session</th>
              <th>Method</th>
              <th>Personnel</th>
              <th>Findings</th>
              <th>Impact</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {interviews.map((iv) => (
              <tr key={iv.id} className="postable__row--clickable">
                <td>
                  <div className="postable__name">{iv.id}</div>
                  <span className="postable__name-sub">{iv.date} · {iv.evolutionId ?? "All evolutions"}</span>
                </td>
                <td><span className="poschip">{iv.method}</span></td>
                <td>
                  <div style={{ fontSize: 12.5 }}>{iv.personnel.join(", ")}</div>
                </td>
                <td>
                  <div style={{ fontSize: 12.5, color: "var(--color-text)", maxWidth: 380 }}>{iv.findings}</div>
                </td>
                <td>
                  {iv.overlooked > 0 ? (
                    <Badge kind="warn">{iv.overlooked} new state{iv.overlooked === 1 ? "" : "s"} identified</Badge>
                  ) : (
                    <Badge kind="ok">No new states</Badge>
                  )}
                </td>
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

function upsertScreening(pos: PlantOperatingStatesAnalysis, posId: string, fields: { retained?: boolean; criterion?: ScreeningCriterion; riskSignificance?: ImportanceLevel; justification?: string }): PlantOperatingStatesAnalysis {
  const apply = (r: PosScreeningRecord): PosScreeningRecord => {
    const retained = fields.retained ?? r.retained;
    const criterion = "criterion" in fields ? fields.criterion : r.criterion;
    const riskSignificance = "riskSignificance" in fields ? fields.riskSignificance : r.riskSignificance;
    return {
      ...r,
      retained,
      criterion: retained ? undefined : criterion,
      riskSignificance: retained ? riskSignificance : undefined,
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
  function onDecision(v: string): void {
    if (!canEdit || mefPatch === undefined) return;
    mefPatch((d) => upsertScreening(d, row.posId, { retained: v === "retained" }));
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
          </div>
        )}
        <div className="posfield posfield-grid--span2">
          <label className="posfield__label">Justification</label>
          <textarea className="posfield__textarea" value={justText} placeholder={row.retained ? "Why this state is retained for analysis…" : "Why screening out leaves downstream results unchanged…"} disabled={!canEdit} onChange={(e) => onJust(e.target.value)} />
        </div>
      </div>
    </div>
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
        <table className="postable postable--expandable">
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
    </>
  );
}

function GroupingScreen({ openDrawer, onAction, canEdit }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const groups = groupsView(pos);
  return (
    <>
      {groups.length === 0 && (
        <div className="poscard">
          <p className="posmuted" style={{ margin: 0 }}>No groups proposed yet.
            {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" style={{ marginLeft: 12 }} onClick={() => onAction("Propose group — coming soon")}><POSIcon.Plus /> Propose group</button>}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {groups.map((g) => (
          <div key={g.id} className="poscard">
            <div className="poscard__head">
              <div>
                <div className="posrow" style={{ gap: 10 }}>
                  <h3 className="poscard__title" style={{ fontSize: 16 }}>{g.name}</h3>
                  {g.status === "ok" ? <Badge kind="ok">Bounded</Badge> : <Badge kind="warn">Rationale pending</Badge>}
                </div>
                <div className="possubtle" style={{ marginTop: 6 }}>
                  Members: {g.members.join(", ")} · Total time {g.durationSum}
                </div>
              </div>
              <button type="button" className="posnav__btn" onClick={() => openDrawer({ kind: "group", id: g.id })}>{canEdit ? "Edit" : "View"}</button>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.55, marginBottom: 10 }}>{g.rationale}</div>
            <div className="posrow" style={{ gap: 22, fontSize: 12.5 }}>
              <div><span className="possubtle">Bounding by</span> <strong style={{ color: "var(--color-text)" }}>{g.boundingCharacteristic}</strong></div>
              <div><span className="possubtle">Member states</span> {g.members.map((m) => <span key={m} className="poschip" style={{ marginRight: 4 }}>{m}</span>)}</div>
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
    </>
  );
}

function patchStateQuant(pos: PlantOperatingStatesAnalysis, uuid: string, fields: { durationHours?: number; frequencyPerYear?: number; basis?: string }): PlantOperatingStatesAnalysis {
  return {
    ...pos,
    plantOperatingStates: pos.plantOperatingStates.map((s) => {
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
    }),
  };
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
        <p className="poscard__sub">The state durations should account for the full operating cycle. The cycle basis is one reactor-year.</p>
        <div className="posstats">
          <div className="posstat">
            <div className="posstat__label">Sum of state durations</div>
            <div className="posstat__value">{formatNumber(recon.summedHours)}<span className="posstat__unit">h/yr</span></div>
          </div>
          <div className="posstat">
            <div className="posstat__label">Cycle basis</div>
            <div className="posstat__value">{formatNumber(recon.totalCycleHours)}<span className="posstat__unit">h/yr</span></div>
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
        <table className="postable postable--expandable">
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
                    <td className="mono">{formatFrequency(s.frequencyPerYear)}</td>
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
        <table className="postable">
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
  return {
    ...pos,
    plantOperatingStates: pos.plantOperatingStates.map((s) => {
      if (s.uuid !== uuid) return s;
      const decayHeatLevel = fields.mw !== undefined
        ? { min: round(fields.mw * 0.9), max: round(fields.mw * 1.1), representative: round(fields.mw), units: "MW" }
        : s.rcsParameters.decayHeatLevel;
      return {
        ...s,
        meanTimeAfterShutdownHours: fields.timeHours ?? s.meanTimeAfterShutdownHours,
        rcsParameters: { ...s.rcsParameters, decayHeatLevel },
        decayHeatBasis: fields.basis ?? s.decayHeatBasis,
        decayHeatLevelDefined: fields.mw !== undefined ? true : s.decayHeatLevelDefined,
      };
    }),
  };
}

function DecayHeatRow({ state, powerMw, operatingDays, method, canEdit, mefPatch, mefPatchDebounced }: {
  state: PlantOperatingState;
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
          <input className="posfield__input" value={mwText} placeholder="MW" style={{ width: 90 }} disabled={!canEdit} onChange={(e) => onMw(e.target.value)} />
          {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" disabled={!canCompute} onClick={compute}>Compute</button>}
        </div>
      </td>
      <td className="mono">{fractionPercent !== undefined ? `${fractionPercent.toFixed(2)} %` : "—"}</td>
      <td>{state.decayHeatLevelDefined ? <Badge kind="ok">Characterised</Badge> : <Badge kind="warn">Pending</Badge>}</td>
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
        {lpsd.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No LPSD states yet.</p>
        ) : (
        <table className="postable">
          <thead>
            <tr>
              <th>State</th>
              <th>Time after shutdown (h)</th>
              <th>Decay heat</th>
              <th>Fraction of power</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lpsd.map((s) => (
              <DecayHeatRow key={`${s.uuid}-${computeVersion}`} state={s} powerMw={operatingPowerMw} operatingDays={operatingDays} method={method} canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />
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
