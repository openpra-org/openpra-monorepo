import { Fragment, JSX, useRef, useState } from "react";
import { type PosDocumentEntry } from "./posWorkbookApi";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-states-analysis";
import { type PlantIdentity } from "interfaces-mef-types/technical-element";
import { type CapabilityCategory as MefCapabilityCategory, type PlantStage as MefPlantStage } from "interfaces-mef-types/core/pra-common";
import { type Mutator } from "./useMefPatch";
import { POSIcon } from "./posIcons";
import { Badge, Stat } from "./posShared";
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
  screeningView,
  groupsView,
  isBarrierBroken,
  preOpsForState,
  ccScore,
  type Stage,
} from "./posSelectors";
import { usePosWorkbook } from "./posWorkbookContext";
import { computePosReportToc } from "./posDocx";

// hardcoded — the per-screen summary figures (stat tiles, "still missing" notes,
// guided-Q&A prose) are static demo copy that mirrors the reference design.

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
}

function blankPlantIdentity(): PlantIdentity {
  return { name: "", vendor: "", reactorType: "", thermalPower: "", primaryCoolant: "" };
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

function SetupScreen({ ccId, setCcId, stage, setStage, onAction, mefPatch, mefPatchDebounced }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const pi = pos.metadata.plantIdentity ?? blankPlantIdentity();
  const isReal = mefPatch !== undefined;

  function onPiChange<K extends keyof PlantIdentity>(key: K, value: PlantIdentity[K]): void {
    if (mefPatchDebounced === undefined) return;
    mefPatchDebounced((draft) => setPlantIdentityField(draft, key, value));
  }

  function onScopeChange(value: string): void {
    if (mefPatchDebounced === undefined) return;
    mefPatchDebounced((draft) => ({ ...draft, praScope: value }));
  }

  function onCcChange(newCcId: string): void {
    setCcId(newCcId);
    if (mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, capabilityCategory: ccIdToMef(newCcId) }));
  }

  function onStageChange(newStage: Stage): void {
    setStage(newStage);
    if (mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, plantStage: stageToMef(newStage) }));
  }

  function onAtPowerChange(value: boolean): void {
    if (mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, includesAtPowerOperations: value }));
  }

  function onHazardChange(value: boolean): void {
    if (mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, includesNonInternalHazardGroups: value }));
  }

  function onLpsdChange(value: boolean): void {
    if (mefPatch === undefined) return;
    mefPatch((draft) => ({ ...draft, includesLPSDOperations: value }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant identity</h3>
        </div>
        <div className="posfield-grid">
          <div className="posfield">
            <label className="posfield__label">Plant name</label>
            <input
              className="posfield__input"
              placeholder="e.g. Generic-1 Reactor"
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
              placeholder="e.g. Sodium-cooled fast reactor (SFR)"
              value={isReal ? pi.reactorType : undefined}
              defaultValue={!isReal ? pi.reactorType : undefined}
              onChange={(e) => onPiChange("reactorType", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Thermal power</label>
            <input
              className="posfield__input"
              placeholder="e.g. 300 MWth"
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
              placeholder="e.g. Liquid sodium"
              value={isReal ? pi.primaryCoolant : undefined}
              defaultValue={!isReal ? pi.primaryCoolant : undefined}
              onChange={(e) => onPiChange("primaryCoolant", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Intermediate coolant</label>
            <input
              className="posfield__input"
              placeholder="e.g. Liquid sodium"
              value={isReal ? (pi.intermediateCoolant ?? "") : undefined}
              defaultValue={!isReal ? (pi.intermediateCoolant ?? "") : undefined}
              onChange={(e) => onPiChange("intermediateCoolant", e.target.value)}
            />
          </div>
          <div className="posfield">
            <label className="posfield__label">Power conversion working fluid</label>
            <input
              className="posfield__input"
              placeholder="e.g. supercritical CO₂"
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
    </>
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
                  <div className="posdoc__meta">{d.sizeLabel} · uploaded {d.uploadedLabel} · linked to {d.linked} field{d.linked === 1 ? "" : "s"}</div>
                </div>
                <div className="posdoc__extracted">
                  <POSIcon.Sparkle /> {d.extracted}
                </div>
                <Badge kind="ok">Indexed</Badge>
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
                  <div className="posdoc__meta">{d.size} · uploaded {d.uploaded} · linked to {d.linked} field{d.linked === 1 ? "" : "s"}</div>
                </div>
                <div className="posdoc__extracted">
                  <POSIcon.Sparkle /> {d.extracted}
                </div>
                <Badge kind="ok">Indexed</Badge>
                <button type="button" className="posdoc__more" aria-label="More"><POSIcon.More /></button>
              </div>
            ))}
        </div>
      </div>

      {!isReal && (
        <div className="poscard poscard--ghost">
          <div className="poscard__head">
            <h3 className="poscard__title">What OpenPRA is still missing</h3>
          </div>
          <p className="posmuted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
            Based on the uploaded set, three field groups have no source document attached:
          </p>
          <ul style={{ margin: "12px 0 0", paddingLeft: 22, fontSize: 13.5, lineHeight: 1.75, color: "var(--color-text)" }}>
            <li>Maintenance configuration document for IHX drained operation (referenced in POS-08)</li>
            <li>Cover-gas adjustment procedure (referenced in POS-09)</li>
            <li>Spent-fuel storage layout for ex-core source inventory</li>
          </ul>
        </div>
      )}
    </>
  );
}

function EvolutionsScreen({ openDrawer, onAction }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const evolutions = evolutionsView(pos);
  const totalHours = pos.plantOperatingStates.reduce((acc, s) => acc + s.meanDurationHours, 0);
  return (
    <>
      <div className="posstats">
        <Stat num={String(pos.plantEvolutions.length)} cap="Evolutions" />
        <Stat num={String(pos.plantOperatingStates.length)} cap="Operating states" />
        <Stat num={`${totalHours.toLocaleString("en-US")} h`} cap="Total state hours" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant evolutions</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Add evolution — coming soon")}><POSIcon.Plus /> Add evolution</button>
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
                    <div className="postable__name">{ev.name}</div>
                    <span className="postable__name-sub">{ev.id} · {ev.description}</span>
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

function StatesScreen({ openDrawer, onAction }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const states = statesView(pos);
  const okCount = states.filter((s) => s.status === "ok").length;
  const warnCount = states.filter((s) => s.status === "warn").length;
  const draftCount = states.filter((s) => s.status === "draft").length;
  return (
    <>
      <div className="posstats">
        <Stat num={String(states.length)} cap="Operating states" />
        <Stat num={String(okCount)} cap="Fully characterised" kind="ok" />
        <Stat num={String(warnCount)} cap="Needs attention" kind={warnCount > 0 ? "warn" : "ok"} />
        <Stat num={String(draftCount)} cap="Draft" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operating states</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Add operating state — coming soon")}><POSIcon.Plus /> Add state</button>
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
              <th>Barriers</th>
              <th>Status</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.id} className="postable__row--clickable" onClick={() => openDrawer({ kind: "state", id: s.id })}>
                <td>
                  <div className="postable__name">{s.id}</div>
                  <span className="postable__name-sub">{s.name}</span>
                </td>
                <td className="mono">{s.mode}</td>
                <td className="mono">{s.rcs.temp}</td>
                <td className="mono">{s.rcs.power}</td>
                <td>
                  <div className="posrow posrow--wrap" style={{ gap: 4 }}>
                    {s.barriers.map((b) => (
                      <span key={b} className={`poschip${isBarrierBroken(b) ? " poschip--warn" : ""}`}>{b}</span>
                    ))}
                  </div>
                </td>
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
          {pos.validationRules.collectiveExhaustivity.allConfigurationsCovered
            ? <Badge kind="ok">All conditions covered</Badge>
            : <Badge kind="warn">Coverage incomplete</Badge>}
        </div>
        <p className="poscard__sub">
          Mutual exclusivity and collective exhaustivity are checked against the validation rules defined in the MEF.
        </p>
        <div className="posrow" style={{ gap: 22, marginTop: 10 }}>
          <div className="posrow" style={{ gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: pos.validationRules.mutualExclusivity.allConditionsBelongToExactlyOnePos ? "var(--c-complete)" : "var(--color-warning)" }} />
            <span className="possubtle">Mutual exclusivity {pos.validationRules.mutualExclusivity.allConditionsBelongToExactlyOnePos ? "verified" : "not verified"}</span>
          </div>
          <div className="posrow" style={{ gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: pos.validationRules.collectiveExhaustivity.allConfigurationsCovered ? "var(--c-complete)" : "var(--color-warning)" }} />
            <span className="possubtle">Collective exhaustivity {(pos.validationRules.collectiveExhaustivity.coverageFraction * 100).toFixed(2)} %</span>
          </div>
        </div>
      </div>
    </>
  );
}

function InterviewsScreen({ onAction }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const interviews = interviewsView(pos);
  const personnelSet = new Set<string>();
  interviews.forEach((iv) => iv.personnel.forEach((p) => personnelSet.add(p)));
  const mostRecent = interviews.length > 0
    ? interviews.map((iv) => iv.date).sort().reverse()[0]
    : "—";
  return (
    <>
      <div className="posstats">
        <Stat num={String(interviews.length)} cap="Sessions logged" />
        <Stat num={String(personnelSet.size)} cap="Personnel involved" />
        <Stat num={String(interviews.reduce((acc, iv) => acc + iv.overlooked, 0))} cap="New states identified" />
        <Stat num={mostRecent} cap="Most recent" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interview &amp; walkdown log</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Log session — coming soon")}><POSIcon.Plus /> Log session</button>
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

function ScreeningScreen({ onAction }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const records = screeningView(pos);
  const retained = records.filter((r) => r.retained).length;
  const screenedOut = records.filter((r) => !r.retained).length;
  return (
    <>
      <div className="posstats">
        <Stat num={String(pos.plantOperatingStates.length)} cap="Operating states" />
        <Stat num={String(retained)} cap="Retained explicitly" kind="ok" />
        <Stat num={String(screenedOut)} cap="Screened out" />
        <Stat num={String(Math.max(0, pos.plantOperatingStates.length - retained - screenedOut))} cap="Default-retained" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screening decisions</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Propose screening — coming soon")}><POSIcon.Plus /> Propose screening</button>
          </div>
        </div>
        <p className="poscard__sub">
          Screen out a state only with written justification that downstream PRA results stay unchanged.
        </p>
        {records.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No screening decisions recorded yet.</p>
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {records.map((rec) => (
            <div key={rec.id} className="poscard" style={{ padding: 16 }}>
              <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div className="posrow" style={{ gap: 10 }}>
                  <span className="posmono possubtle">{rec.id}</span>
                  <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14 }}>{rec.posId}</span>
                  {rec.retained ? <Badge kind="ok">Retained</Badge> : <Badge kind="draft">Screened out</Badge>}
                </div>
                <div className="posrow" style={{ gap: 10 }}>
                  {rec.criterion !== null && <span className="poschip">{rec.criterion}</span>}
                  <span className={`poschip ${rec.riskImpact === "High" ? "poschip--warn" : ""}`}>Risk impact: {rec.riskImpact}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.55 }}>{rec.justification}</p>
            </div>
          ))}
        </div>
        )}
      </div>
    </>
  );
}

function GroupingScreen({ openDrawer, onAction }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const groups = groupsView(pos);
  const bounded = groups.filter((g) => g.status === "ok").length;
  const pending = groups.filter((g) => g.status !== "ok").length;
  return (
    <>
      <div className="posstats">
        <Stat num={String(pos.plantOperatingStates.length)} cap="Operating states" />
        <Stat num={String(groups.length)} cap="Groups proposed" />
        <Stat num={String(bounded)} cap="Groups fully bounded" kind={bounded > 0 ? "ok" : "warn"} />
        <Stat num={String(pending)} cap="Groups need rationale" kind={pending > 0 ? "warn" : "ok"} />
      </div>

      {groups.length === 0 && (
        <div className="poscard">
          <p className="posmuted" style={{ margin: 0 }}>No groups proposed yet.
            <button type="button" className="posnav__btn posnav__btn--sm" style={{ marginLeft: 12 }} onClick={() => onAction("Propose group — coming soon")}><POSIcon.Plus /> Propose group</button>
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {groups.map((g) => (
          <div key={g.id} className="poscard">
            <div className="poscard__head">
              <div>
                <div className="posrow" style={{ gap: 10 }}>
                  <span className="posmono possubtle">{g.id}</span>
                  <h3 className="poscard__title" style={{ fontSize: 16 }}>{g.name}</h3>
                  {g.status === "ok" ? <Badge kind="ok">Bounded</Badge> : <Badge kind="warn">Rationale pending</Badge>}
                </div>
                <div className="possubtle" style={{ marginTop: 6 }}>
                  Members: {g.members.join(", ")} · Total time {g.durationSum}
                </div>
              </div>
              <button type="button" className="posnav__btn" onClick={() => openDrawer({ kind: "group", id: g.id })}>Edit</button>
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

function FrequencyScreen(): JSX.Element {
  const { pos } = usePosWorkbook();
  const states = statesView(pos);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const totalStates = pos.plantOperatingStates.length;
  const durationsEntered = pos.plantOperatingStates.filter((s) => s.meanDurationHours > 0).length;
  const frequenciesEntered = pos.plantOperatingStates.filter((s) => {
    const v = typeof s.meanEntryFrequency === "number" ? s.meanEntryFrequency : s.meanEntryFrequency.value;
    return v > 0;
  }).length;
  const totalHours = pos.plantOperatingStates.reduce((acc, s) => acc + s.meanDurationHours, 0);
  const lpsdCount = pos.plantOperatingStates.filter((s) => s.operatingMode !== "POWER").length;
  return (
    <>
      <div className="posstats">
        <Stat num={`${durationsEntered} / ${totalStates}`} cap="Durations entered" kind={durationsEntered === totalStates && totalStates > 0 ? "ok" : "warn"} />
        <Stat num={`${frequenciesEntered} / ${totalStates}`} cap="Frequencies entered" kind={frequenciesEntered === totalStates && totalStates > 0 ? "ok" : "warn"} />
        <Stat num={`${totalHours.toLocaleString("en-US")} h`} cap="Sum across states" />
        <Stat num={String(lpsdCount)} cap="LPSD states" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Frequencies &amp; durations</h3>
        </div>
        {states.length === 0 ? (
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
              <th>Basis</th>
              <th>Pre-op</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s) => {
              const isOpen = expanded.has(s.id);
              const preops = preOpsForState(pos, s.id);
              return (
                <Fragment key={s.id}>
                  <tr className="postable__row--clickable" onClick={() => toggle(s.id)}>
                    <td>
                      <span className={`postable__expand${isOpen ? " postable__expand--open" : ""}`}><POSIcon.Chevron /></span>
                    </td>
                    <td>
                      <div className="postable__name">{s.id}</div>
                      <span className="postable__name-sub">{s.name}</span>
                    </td>
                    <td className="mono">{s.mode}</td>
                    <td className="mono">{s.duration}</td>
                    <td className="mono">{s.frequency}</td>
                    <td>
                      <span className="possubtle" style={{ fontSize: 12.5 }}>—</span>
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
                      <td colSpan={6}>
                        <div className="postable__expand-body">
                          <div className="poscard">
                            <div className="poscard__head"><h3 className="poscard__title">Edit duration &amp; frequency</h3></div>
                            <div className="posfield-grid">
                              <div className="posfield">
                                <label className="posfield__label">Mean duration</label>
                                <input className="posfield__input" defaultValue={s.duration} />
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">Entry frequency</label>
                                <input className="posfield__input" defaultValue={s.frequency} />
                              </div>
                              <div className="posfield posfield-grid--span2">
                                <label className="posfield__label">Basis</label>
                                <input className="posfield__input" placeholder="Cite the cycle-plan section or vendor letter…" />
                              </div>
                            </div>
                          </div>
                          <PreopAssumptionCard assumption={preops[0]} />
                        </div>
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

function DecayHeatScreen({ onAction }: ScreenProps): JSX.Element {
  const { pos } = usePosWorkbook();
  const lpsd = statesView(pos).filter((s) => s.mode !== "POWER" && s.retained);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const characterizedIds = new Set(pos.decayHeatCharacterizations.map((d) => d.posId));
  const characterized = lpsd.filter((s) => characterizedIds.has(s.id)).length;
  return (
    <>
      <div className="posstats">
        <Stat num={String(lpsd.length)} cap="LPSD states require characterisation" />
        <Stat num={String(characterized)} cap="Characterised" kind={characterized === lpsd.length && lpsd.length > 0 ? "ok" : (characterized < lpsd.length ? "block" : "ok")} />
        <Stat num={String(pos.decayHeatCharacterizations.length)} cap="Records on file" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Decay-heat characterisation</h3>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onAction("Generate from vendor curves — coming soon")}>
            <POSIcon.Sparkle /> Generate from curves
          </button>
        </div>
        {lpsd.length === 0 ? (
          <p className="posmuted" style={{ padding: "12px 0", margin: 0 }}>No LPSD states yet.</p>
        ) : (
        <table className="postable postable--expandable">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th>State</th>
              <th>Time after shutdown</th>
              <th>Decay-heat level</th>
              <th>Basis</th>
              <th>Status</th>
              <th>Pre-op</th>
            </tr>
          </thead>
          <tbody>
            {lpsd.map((s) => {
              const isOpen = expanded.has(s.id);
              const preops = preOpsForState(pos, s.id);
              return (
                <Fragment key={s.id}>
                  <tr className="postable__row--clickable" onClick={() => toggle(s.id)}>
                    <td>
                      <span className={`postable__expand${isOpen ? " postable__expand--open" : ""}`}><POSIcon.Chevron /></span>
                    </td>
                    <td>
                      <div className="postable__name">{s.id}</div>
                      <span className="postable__name-sub">{s.name}</span>
                    </td>
                    <td className="mono">—</td>
                    <td className="mono">—</td>
                    <td className="possubtle">Pending vendor curve fit</td>
                    <td><Badge kind="block">Required</Badge></td>
                    <td>
                      {s.hasPreopAssumption
                        ? <span className="poschip poschip--preop"><POSIcon.Warn /> Flagged</span>
                        : <span className="possubtle" style={{ fontSize: 11.5 }}>—</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="postable__expand-row">
                      <td />
                      <td colSpan={6}>
                        <div className="postable__expand-body">
                          <div className="poscard">
                            <div className="poscard__head"><h3 className="poscard__title">Characterise decay heat</h3></div>
                            <div className="posfield-grid">
                              <div className="posfield">
                                <label className="posfield__label">Time after shutdown</label>
                                <input className="posfield__input" placeholder="e.g. 1 h, 1 d, 30 d" />
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">Decay-heat level (MW)</label>
                                <input className="posfield__input" placeholder="From vendor curve / fit" />
                              </div>
                              <div className="posfield posfield-grid--span2">
                                <label className="posfield__label">Basis</label>
                                <input className="posfield__input" placeholder="Cite the vendor curve, fit, or NM record (e.g. NM-014)" />
                              </div>
                            </div>
                          </div>
                          <PreopAssumptionCard assumption={preops[0]} />
                        </div>
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

function DraftScreen({
  cc,
  scores,
  stage,
  onGenerate,
  onSubmitDraft,
}: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: Stage;
  onGenerate: (final: boolean) => void;
  onSubmitDraft: (final: boolean) => void;
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
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          {ready ? (
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Producing the draft locks Steps 1–9 and advances the workbook to <strong>Internal Technical Review</strong>.
            </p>
          ) : (
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              {scores.blocked} blocking item{scores.blocked === 1 ? "" : "s"} remain. You may produce a working draft for review, but the workbook cannot reach approval until blockers are resolved.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
              <POSIcon.Send /> {ready ? "Submit draft to internal review" : "Submit working draft to review"}
            </button>
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
