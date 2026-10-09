import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { Fragment, JSX, type ReactNode, useId, useMemo, useState } from "react";
import {
  PUBLISHED_REPORTING_FLOORS,
  PUBLISHED_RI_CRITERIA,
  type CompiledRiskInput,
  type ConsequenceMeasure,
  type ModelUncertaintySource,
  type RiskUncertaintyAnalysis,
  type ScreenedItemLedgerEntry,
  type RiConsequenceStats,
  type RiFrequencyStats,
  type RiInputConsequence,
  type RiInputContributor,
  type RiInputImportance,
  type RiManualEntry,
  type RiInputFamily,
  type RiInputs,
  type RiInputSequence,
  type RiTopEventState,
  type RiskIntegration,
  type RiAbsoluteCriteria,
  type RiResolvedAbsoluteCriteria,
  type RiApplicationContext,
  type RiCumulativeTarget,
  type RiFcAnchor,
  type RiLinkedWorkbooks,
  type RiRelativeCriteria,
  type RiScopeAspect,
  type RiStatistic,
} from "interfaces-mef-types/ri/risk-integration";
import { type RcMetricQuantity, type RcMetricReceptor, type RcMetricWindow, type RcMetricWindowStart } from "interfaces-mef-types/rc/metrics";
import { EndState } from "interfaces-mef-types/core/events";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import {
  rcMetricDurationText,
  rcMetricQuantityLabels,
  rcMetricReceptorLabels,
  rcMetricReceptorText,
  rcMetricUnit,
  rcMetricWindowStartLabels,
  rcMetricWindowUnit,
  rcMetricWindowUnits,
  rcMetricWindowValue,
  rcOrdinal,
  type RcMetricWindowUnit,
} from "interfaces-shared-types/rc-workbooks/metrics";
import { RIIcon } from "./riIcons";
import {
  CHAR_LEVEL_OPTIONS,
  CONSIDERED_OPTIONS,
  DrawerHead,
  ELEMENT_CODE_OPTIONS,
  ELEMENT_OPTIONS,
  EVAL_SCOPE_OPTIONS,
  EVAL_TYPE_OPTIONS,
  SCREENED_ITEM_TYPE_OPTIONS,
  labelOf,
} from "./riFields";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { Badge, RiProvenanceChip, RiTabs, sciText, shareText, valText } from "./riShared";
import { useRiWorkbook } from "./riWorkbookContext";
import {
  APPLICATION_TYPES,
  CAPABILITY_CATEGORIES,
  CLIFF_EDGE_STATUSES,
  CUMULATIVE_TARGET_SPECS,
  FC_ANCHOR_SPECS,
  FLOOR_SPECS,
  LICENSING_ACTIONS,
  MEASURE_QUANTITY_LABELS,
  ELEMENT_CODE_BY_TYPE,
  ELEMENT_NAME_BY_CODE,
  REGISTER_SIDE,
  MEASURE_RECEPTOR_LABELS,
  MEASURE_ROLE_SPECS,
  MEASURE_WINDOW_START_LABELS,
  NEI_SET_LABEL,
  PLANT_STAGES,
  RELATIVE_CRITERIA_SPECS,
  RELATIVE_SET_LABEL,
  RI_CRITERIA_SPECS,
  RI_CRITERIA_SUBTABS,
  RI_LINK_TILES,
  RI_SCOPE_ASPECTS,
  RI_STATISTICS,
  RI_STATISTIC_SHORT,
  SITE_BASES,
  exampleLinkLabel,
  type PlantStageId,
  FC_META,
  type AppTypeId,
  type RiCriteriaSubTab,
  type RiCriterionSpec,
  type RiLinkCode,
  type RiNumberFormat,
} from "./riViewData";
import {
  anchorChanged,
  appTypeFromMef,
  consequenceEdited,
  consequenceKey,
  frequencyEdited,
  riImportInputs,
  riImportReady,
  riInputChecks,
  withFrequencyStat,
  withInputs,
  familyCategories,
  familyDose,
  inDbeRange,
  cliffEdgeCheckOf,
  withCliffEdgeBasis,
  withCliffEdgeStatus,
  fcFamilies,
  targetAnchors,
  integratedRiskMetrics,
  contributionMetrics,
  contributionsBy,
  initiatingEventGroups,
  hazardGroupOf,
  withHazardAssignment,
  curveMeasures,
  exceedanceCurve,
  withAggregation,
  reviewScopeItems,
  detailNoteOf,
  withDetailNote,
  aggregationIssues,
  NOT_ATTRIBUTED,
  NOT_RECORDED,
  NOT_ASSIGNED,
  breakdownItems,
  breakdownSignificance,
  shortMetricLabel,
  absoluteBar,
  metricCoverage,
  withInputsCreated,
  withManualKept,
  manualCount,
  withFamilyRenamed,
  withSequenceRenamed,
  withSequenceFamily,
  withUnavailableReason,
  measuresWithoutResults,
  unavailableReasonOf,
  remPerUnit,
  countedItems,
  handoffTargets,
  handoffEntryOf,
  handoffLevelOf,
  withHandoffEntry,
  handoffMessageOf,
  withHandoffMessage,
  withHandoffSent,
  handoffReceiverOf,
  handoffChangeCount,
  withHandoffsUpdated,
  handoffIssues,
  handoffReceipts,
  HANDOFF_ELEMENTS,
  HANDOFF_RECEIVERS,
  type RiHandoffTarget,
  type RiHandoffEntry,
  type RiHandoffGroup,
  type RiHandoffReceiver,
  type RiReceipt,
  type RiReceiptRow,
  contributorValues,
  contributorTypeLabel,
  sscContributors,
  sscOf,
  withSscAssignment,
  sscGroups,
  importanceRows,
  nextId,
  newRegisterCandidates,
  withImportedRegister,
  newScreeningCandidates,
  withImportedScreening,
  sharedReleaseCategories,
  groupingIssues,
  registerIssues,
  analysisTotalOf,
  propagateTotals,
  PROPAGATION_SAMPLES,
  type RiBreakdownId,
  type RiIntegratedMetric,
  type RiContributionDimension,
  type RiExceedanceCurve,
  type RiFcFamily,
  type RiMargin,
  type RiCategory,
  type RiFamilyCategory,
  type RiFamilyDose,
  type RiFindingSeverity,
  type RiInputFinding,
  applicationContextOf,
  consequenceFloorMrem,
  consequenceFloorOf,
  floorChanged,
  floorsIssues,
  measureFromPreset,
  measureIssues,
  measureNeeds,
  measureNeedsShort,
  measureNeedsText,
  measureRcCheck,
  measureRoleIssues,
  withFloorJustification,
  withFloorValue,
  withFrequencyFloor,
  withFrequencyJustification,
  criteriaIssues,
  criteriaReview,
  criteriaSetOf,
  nextAnchor,
  nextCriterion,
  nextTarget,
  targetChanged,
  withAbsoluteCriteria,
  withAbsoluteField,
  withRelativeCriteria,
  withRelativeField,
  scopeRowsView,
  withModuleAdded,
  withScopeReason,
  withScopeState,
  fcPointsView,
  ccdfPointsView,
  metricRollup,
  type FcPointView,
  type ScopeRowView,
  type ScopeState,
} from "./riSelectors";
import {
  consequenceMetricMatches,
  meanFrequencyValue,
  sourcesForEventSequenceFamily,
} from "../workbooks/riskWorkbookConnections";

interface RiDrawerContext {
  kind: "family" | "measure" | "inputFamily" | "inputSequence" | "inputConsequence" | "inputContributor" | "inputImportance" | "inputGap" | "cliffEdge" | "aggregationNote" | "sscAssignment" | "uncertaintySource" | "screenedItem" | "uncertaintyAnalysis" | "sensitivityStudy" | "handoff" | "calc" | "metric" | "aggregation" | "hazardgroup" | "grouping" | "contributor" | "contribbasis" | "musource" | "screened" | "propagation" | "sensitivity" | "dispatch" | "method";
  id: string;
}

// ─── Log-scale helpers for the plots ───────────────────────────────────────
function log10(v: number): number {
  return Math.log(v) / Math.LN10;
}
function scaleLog(v: number, min: number, max: number, lo: number, hi: number): number {
  const t = (log10(v) - log10(min)) / (log10(max) - log10(min));
  return lo + t * (hi - lo);
}
function expTick(p: number): string {
  return `1E${p < 0 ? "" : "+"}${p}`;
}

// ─── 01 — Application (HLR-RI-A) ───────────────────────────────────────────
type ApplicationTab = "decision" | "criteria" | "measures";

const APPLICATION_TABS: { id: ApplicationTab; label: string }[] = [
  { id: "decision", label: "Decision and scope" },
  { id: "criteria", label: "Criteria set" },
  { id: "measures", label: "Measures and floors" },
];

const WORKBOOK_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  complete: "Complete",
};

function RiInterfaces(): JSX.Element {
  const { ri, editable, mutateRi, upstream } = useRiWorkbook();
  const [selected, setSelected] = useState<RiLinkCode | null>("POS");
  const selectId = useId();
  const links = applicationContextOf(ri).linkedWorkbooks;
  const tile = RI_LINK_TILES.find((t) => t.code === selected);
  const options = tile === undefined ? [] : upstream.options[tile.code];
  const linkedId = tile === undefined ? undefined : links[tile.code];
  const linked = options.find((w) => w.id === linkedId);
  const exampleLabel = linkedId === undefined ? undefined : exampleLinkLabel(linkedId);
  const nothingToLink = options.length === 0 && exampleLabel === undefined;

  function onLink(code: RiLinkCode, id: string): void {
    if (!editable) return;
    mutateRi((draft) => {
      const context = applicationContextOf(draft);
      const next: RiLinkedWorkbooks = {};
      for (const t of RI_LINK_TILES) {
        const value = t.code === code ? id : context.linkedWorkbooks[t.code];
        if (value !== undefined && value.length > 0) next[t.code] = value;
      }
      return { ...draft, applicationContext: { ...context, linkedWorkbooks: next } };
    });
  }

  return (
    <>
      <div className="poshandoff__grid ri-handoff__interface-tiles">
        {RI_LINK_TILES.map((t) => (
          <button
            key={t.code}
            type="button"
            className={`poshandoff__tile${selected === t.code ? " poshandoff__tile--active" : ""}`}
            onClick={() => setSelected(selected === t.code ? null : t.code)}
          >
            <span className="poshandoff__tile-code">{t.code}</span>
            <span className="poshandoff__tile-name">{t.name}</span>
            <span className="poshandoff__tile-role">{t.handoff}</span>
          </button>
        ))}
      </div>
      {tile !== undefined && (
        <div className="ri-handoff__lane">
          <div className="ri-link">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select
              id={selectId}
              className="posfield__select"
              value={linkedId ?? ""}
              disabled={!editable || nothingToLink}
              onChange={(e) => onLink(tile.code, e.target.value)}
            >
              <option value="">{nothingToLink ? `No ${tile.code} workbooks in this project` : "Not linked"}</option>
              {exampleLabel !== undefined && linkedId !== undefined && <option value={linkedId}>{exampleLabel}</option>}
              {options.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {linkedId !== undefined && linked === undefined && exampleLabel === undefined && (
            <p className="posmuted ri-link__note">The linked workbook is not in this project.</p>
          )}
          {exampleLabel !== undefined && (
            <table className="postable postable--mid ri-link__table">
              <thead><tr><th>Workbook</th><th>Status</th><th>Version</th><th>Owner</th><th>Updated</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="postable__name">{exampleLabel}</div></td>
                  <td>Example</td>
                  <td className="posmono">—</td>
                  <td>OpenPRA</td>
                  <td className="posmono">—</td>
                </tr>
              </tbody>
            </table>
          )}
          {linked !== undefined && (
            <table className="postable postable--mid ri-link__table">
              <thead><tr><th>Workbook</th><th>Status</th><th>Version</th><th>Owner</th><th>Updated</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="postable__name">{linked.name}</div></td>
                  <td>{WORKBOOK_STATUS_LABEL[linked.status] ?? linked.status}</td>
                  <td className="posmono">v{linked.version}</td>
                  <td>{linked.ownerFullName}</td>
                  <td className="posmono">{linked.updatedAt.slice(0, 10)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

function RiScopeTable(): JSX.Element {
  const { ri, editable, mutateRi, upstream } = useRiWorkbook();
  const [aspect, setAspect] = useState<RiScopeAspect>("HAZARD_GROUP");
  const [moduleName, setModuleName] = useState("");
  const tabId = useId();
  const rows = scopeRowsView(ri, upstream, aspect);
  const isModule = aspect === "MODULE";
  const aspectLabel = RI_SCOPE_ASPECTS.find((a) => a.aspect === aspect)?.label ?? "";
  const multiReactor = upstream.esq?.modelIntegration?.multiReactorSequencesIncluded;

  function onState(row: ScopeRowView, next: ScopeState): void {
    if (!editable) return;
    mutateRi((draft) => withScopeState(draft, aspect, row, next));
  }
  function onReason(row: ScopeRowView, reason: string): void {
    if (!editable) return;
    mutateRi((draft) => withScopeReason(draft, aspect, row, reason));
  }
  function onAddModule(): void {
    if (!editable || moduleName.trim().length === 0) return;
    mutateRi((draft) => withModuleAdded(draft, moduleName));
    setModuleName("");
  }

  return (
    <div className="riscope">
      <h4 className="riscope__title">Integration scope</h4>
      <RiTabs
        label="Integration scope aspects"
        tabs={RI_SCOPE_ASPECTS.map((a) => ({ id: a.aspect, label: a.label }))}
        active={aspect}
        onChange={setAspect}
        idBase={tabId}
        className="ri-subtabs"
      />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${aspect}`} tabIndex={0}>
        <div className="riscope__table-wrap">
          <table className={`postable riscope__table${isModule ? " riscope__table--modules" : ""}`} aria-label={aspectLabel}>
            <thead>
              <tr>
                <th>{isModule ? "Module" : "Item"}</th>
                {!isModule && <th>In ESQ model</th>}
                <th>Included?</th>
                <th>Reason for exclusion</th>
                {isModule && <th><span className="riscope__sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="riscope__empty">{isModule ? "No reactor modules recorded." : "Nothing recorded yet."}</td></tr>
              )}
              {rows.map((row) => {
                const reasonMissing = row.state === "excluded" && row.reason.trim().length === 0;
                return (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong>{row.detail !== undefined && <span className="riscope__hint">{row.detail}</span>}</td>
                    {!isModule && <td>{row.inEsq === undefined ? "—" : row.inEsq ? "Yes" : "No"}</td>}
                    <td>
                      <select
                        className="posfield__select"
                        aria-label={`${row.label} inclusion`}
                        value={row.state}
                        disabled={!editable}
                        onChange={(e) => onState(row, e.target.value === "included" ? "included" : e.target.value === "excluded" ? "excluded" : "unset")}
                      >
                        {!isModule && <option value="unset">Not set</option>}
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </td>
                    <td>
                      {row.state === "excluded" ? (
                        <>
                          <WorkbookInput
                            className="posfield__input"
                            aria-label={`${row.label} exclusion reason`}
                            aria-invalid={reasonMissing}
                            value={row.reason}
                            disabled={!editable}
                            onChange={(e) => onReason(row, e.target.value)}
                          />
                          {reasonMissing && <span className="riscope__error" role="alert">Reason required</span>}
                        </>
                      ) : "—"}
                    </td>
                    {isModule && (
                      <td>
                        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onState(row, "unset")}>Remove</button>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isModule && editable && (
          <div className="riscope__add">
            <WorkbookInput
              className="posfield__input"
              aria-label="New reactor module"
              placeholder="e.g. Reactor module 1"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
            />
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={moduleName.trim().length === 0} onClick={onAddModule}><RIIcon.Plus /> Add module</button>
          </div>
        )}
        {isModule && multiReactor !== undefined && (
          <p className="posmuted riscope__note">{multiReactor ? "The linked ESQ model includes multi-reactor sequences." : "The linked ESQ model covers a single reactor."}</p>
        )}
      </div>
    </div>
  );
}

function DecisionScopeTab({ appType, setAppType, documents }: {
  appType: AppTypeId;
  setAppType: (a: AppTypeId) => void;
  documents: JSX.Element | null;
}): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const context = applicationContextOf(ri);
  const ccId = ri.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const stage: PlantStageId = ri.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const actionId = useId();
  const siteId = useId();
  const dis = !editable;

  function patchContext(fn: (c: RiApplicationContext) => RiApplicationContext): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, applicationContext: fn(applicationContextOf(draft)) }));
  }
  function onDecisionChange(next: AppTypeId): void {
    if (!editable) return;
    setAppType(next);
    patchContext((c) => ({ ...c, applicationType: next === "baseline_risk" ? "BASELINE_RISK" : "FIXED_RISK_TARGET" }));
  }
  function onActionChange(value: string): void {
    const action = LICENSING_ACTIONS.find((a) => a.id === value)?.id;
    patchContext((c) => ({ ...c, licensingAction: action }));
  }
  function onSiteChange(value: string): void {
    const site = SITE_BASES.find((b) => b.id === value)?.id;
    patchContext((c) => ({ ...c, siteBasis: site }));
  }
  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: PlantStageId): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard ri-handoff__wide-card">
        <div className="poscard__head"><WorkbookSectionHeading workbook="RI" title="Interfaces" level={3} /></div>
        <RiInterfaces />
      </div>

      <div className="poscard ri-handoff__wide-card">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Decision" level={3} />
          <RiProvenanceChip>RI-A2 · A3</RiProvenanceChip>
        </div>
        <div className="ri-handoff__choices">
          {APPLICATION_TYPES.map((a) => {
            const active = a.id === appType;
            return (
              <button key={a.id} type="button" className="poscard" aria-pressed={active} onClick={() => onDecisionChange(a.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{a.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{a.desc}</p>
              </button>
            );
          })}
        </div>
        <div className="ri-decision__fields">
          <div className="posfield">
            <label className="posfield__label" htmlFor={actionId}>Licensing action</label>
            <select id={actionId} className="posfield__select" value={context.licensingAction ?? ""} disabled={dis} onChange={(e) => onActionChange(e.target.value)}>
              <option value="">Not set</option>
              {LICENSING_ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div className="posfield">
            <label className="posfield__label" htmlFor={siteId}>Site basis</label>
            <select id={siteId} className="posfield__select" value={context.siteBasis ?? ""} disabled={dis} onChange={(e) => onSiteChange(e.target.value)}>
              <option value="">Not set</option>
              {SITE_BASES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="poscard ri-handoff__wide-card ri-handoff__scope">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="PRA scope" level={3} />
          <RiProvenanceChip>RI-B1 · B4</RiProvenanceChip>
        </div>
        <WorkbookTextarea
          className="posfield__textarea"
          aria-label="PRA scope"
          rows={3}
          fitContent
          value={ri.praScope}
          disabled={dis}
          onChange={(e) => onScopeChange(e.target.value)}
        />
        <RiScopeTable />
      </div>

      <div className="poscard ri-handoff__compact-card">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div className="ri-handoff__choices">
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard ri-handoff__compact-card">
        <div className="poscard__head"><WorkbookSectionHeading workbook="RI" title="Plant stage" level={3} /></div>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {PLANT_STAGES.map((s) => (
            <label key={s.id} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === s.id ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <WorkbookInput type="radio" name="ri-stage" value={s.id} checked={stage === s.id} disabled={dis} onChange={() => onStageChange(s.id)} />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>{s.name}</div>
                  <div className="possubtle" style={{ fontSize: 12.5 }}>{s.description}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {documents}
    </>
  );
}

interface CriterionRowModel {
  id: string;
  label: string;
  hint: string;
  value: JSX.Element;
  published: string;
  changed: boolean;
  justification: string;
  issue?: string;
  onJustification: (text: string) => void;
}

function statisticLabel(value: RiStatistic): string {
  return RI_STATISTICS.find((s) => s.id === value)?.label ?? value;
}

function toStatistic(value: string): RiStatistic {
  return RI_STATISTICS.find((s) => s.id === value)?.id ?? "MEAN";
}

function numberText(value: number, format: RiNumberFormat): string {
  return format === "sci" ? sciText(value) : String(value);
}

function numberInputText(value: number, format: RiNumberFormat): string {
  if (format === "plain" || !Number.isFinite(value) || value === 0) return String(value);
  const [mantissa, exponent] = value.toExponential().split("e");
  const power = Number(exponent);
  return power === 0 ? mantissa : `${mantissa}E${power}`;
}

function withUnit(text: string, unit: string): string {
  return unit.length > 0 ? `${text} ${unit}` : text;
}

function CriterionNumber({ label, value, unit, format = "plain", disabled, onCommit }: {
  label: string;
  value: number;
  unit: string;
  format?: RiNumberFormat;
  disabled: boolean;
  onCommit: (value: number) => void;
}): JSX.Element {
  return (
    <span className="ricriteria__value">
      <WorkbookInput className="posfield__input" type="number" step="any" aria-label={label} value={numberInputText(value, format)} disabled={disabled} onChange={(e) => onCommit(Number(e.target.value))} />
      {unit.length > 0 && <span className="ricriteria__unit">{unit}</span>}
    </span>
  );
}

function CriterionStatistic({ label, value, percentilesOnly, disabled, onCommit }: {
  label: string;
  value: RiStatistic;
  percentilesOnly: boolean;
  disabled: boolean;
  onCommit: (value: RiStatistic) => void;
}): JSX.Element {
  const options = percentilesOnly ? RI_STATISTICS.filter((s) => s.id !== "MEAN") : RI_STATISTICS;
  return (
    <select className="posfield__select ricriteria__select" aria-label={label} value={value} disabled={disabled} onChange={(e) => onCommit(toStatistic(e.target.value))}>
      {options.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

function CriteriaTable({ label, rows, editable }: { label: string; rows: CriterionRowModel[]; editable: boolean }): JSX.Element {
  return (
    <div className="ricriteria__table-wrap">
      <table className="postable ricriteria__table" aria-label={label}>
        <thead><tr><th>Criterion</th><th>Value</th><th>Published</th><th>Justification</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const missing = row.changed && row.justification.trim().length === 0;
            return (
              <tr key={row.id}>
                <td><strong>{row.label}</strong><span className="ricriteria__hint">{row.hint}</span></td>
                <td>
                  {row.value}
                  {row.issue !== undefined && <span className="ricriteria__error" role="alert">{row.issue}</span>}
                </td>
                <td className="ricriteria__published">{row.published}</td>
                <td>
                  {row.changed ? (
                    <>
                      <WorkbookInput
                        className="posfield__input"
                        aria-label={`${row.label} justification`}
                        aria-invalid={missing}
                        value={row.justification}
                        disabled={!editable}
                        onChange={(e) => row.onJustification(e.target.value)}
                      />
                      {missing && <span className="ricriteria__error" role="alert">Justification required</span>}
                    </>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AbsoluteCriteriaCard(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const [sub, setSub] = useState<RiCriteriaSubTab>("target");
  const tabId = useId();
  const set = criteriaSetOf(ri);
  const a = set.absolute;
  const published = PUBLISHED_RI_CRITERIA.absolute;
  const issues = criteriaIssues(set);
  const review = criteriaReview(set, "fixed_risk_target");
  const dis = !editable;

  function patch(fn: (criteria: RiResolvedAbsoluteCriteria) => RiResolvedAbsoluteCriteria): void {
    if (!editable) return;
    mutateRi((draft) => withAbsoluteCriteria(draft, fn));
  }
  function restore(): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, criteriaSet: { ...criteriaSetOf(draft), absolute: PUBLISHED_RI_CRITERIA.absolute } }));
  }

  function specRow(spec: RiCriterionSpec): CriterionRowModel {
    if (spec.kind === "number") {
      const key = spec.key;
      const current = a[key];
      return {
        id: key,
        label: spec.label,
        hint: spec.source,
        value: <CriterionNumber label={spec.label} value={current.value} unit={spec.unit} format={spec.format} disabled={dis} onCommit={(v) => patch((x) => withAbsoluteField(x, key, nextCriterion(x[key], v, published[key].value)))} />,
        published: withUnit(numberText(published[key].value, spec.format), spec.unit),
        changed: current.value !== published[key].value,
        justification: current.justification ?? "",
        issue: issues.numbers[key],
        onJustification: (text) => patch((x) => withAbsoluteField(x, key, { ...x[key], justification: text })),
      };
    }
    const key = spec.key;
    const current = a[key];
    return {
      id: key,
      label: spec.label,
      hint: spec.source,
      value: <CriterionStatistic label={spec.label} value={current.value} percentilesOnly={spec.percentilesOnly === true} disabled={dis} onCommit={(v) => patch((x) => withAbsoluteField(x, key, nextCriterion(x[key], v, published[key].value)))} />,
      published: statisticLabel(published[key].value),
      changed: current.value !== published[key].value,
      justification: current.justification ?? "",
      issue: issues.statistics[key],
      onJustification: (text) => patch((x) => withAbsoluteField(x, key, { ...x[key], justification: text })),
    };
  }

  function setAnchor(index: number, next: (anchor: RiFcAnchor) => RiFcAnchor): void {
    patch((x) => ({ ...x, fcAnchors: x.fcAnchors.map((anchor, i) => (i === index ? next(anchor) : anchor)) }));
  }

  const anchorRows: CriterionRowModel[] = a.fcAnchors.map((anchor, index) => {
    const spec = FC_ANCHOR_SPECS[index];
    const label = spec?.label ?? `Anchor ${index + 1}`;
    const pub = published.fcAnchors[index];
    return {
      id: `anchor-${index}`,
      label,
      hint: spec?.source ?? "",
      value: (
        <span className="ricriteria__pair">
          <CriterionNumber label={`${label} dose`} value={anchor.doseRem} unit="rem" disabled={dis} onCommit={(v) => setAnchor(index, (item) => nextAnchor({ ...item, doseRem: v }, index))} />
          <CriterionNumber label={`${label} frequency`} value={anchor.frequencyPerPlantYear} unit="per plant-year" format="sci" disabled={dis} onCommit={(v) => setAnchor(index, (item) => nextAnchor({ ...item, frequencyPerPlantYear: v }, index))} />
        </span>
      ),
      published: pub === undefined ? "—" : `${pub.doseRem} rem at ${sciText(pub.frequencyPerPlantYear)} per plant-year`,
      changed: anchorChanged(anchor, index),
      justification: anchor.justification ?? "",
      issue: issues.anchors[index],
      onJustification: (text) => setAnchor(index, (item) => ({ ...item, justification: text })),
    };
  });

  const targetRows: CriterionRowModel[] = a.cumulativeTargets.map((target) => {
    const spec = CUMULATIVE_TARGET_SPECS[target.id];
    const pub = published.cumulativeTargets.find((t) => t.id === target.id);
    const threshold = (target.limitPerPlantYear * a.sscCumulativePercent.value) / 100;
    function setTarget(next: (item: RiCumulativeTarget) => RiCumulativeTarget): void {
      patch((x) => ({ ...x, cumulativeTargets: x.cumulativeTargets.map((item) => (item.id === target.id ? next(item) : item)) }));
    }
    return {
      id: target.id,
      label: spec.label,
      hint: `${spec.receptor} · ${spec.source}`,
      value: (
        <>
          <CriterionNumber label={`${spec.label} limit`} value={target.limitPerPlantYear} unit="per plant-year" format="sci" disabled={dis} onCommit={(v) => setTarget((item) => nextTarget({ ...item, limitPerPlantYear: v }))} />
          <span className="ricriteria__derived">SSC threshold {sciText(threshold)} per plant-year</span>
        </>
      ),
      published: pub === undefined ? "—" : `${sciText(pub.limitPerPlantYear)} per plant-year`,
      changed: targetChanged(target),
      justification: target.justification ?? "",
      issue: issues.targets[target.id],
      onJustification: (text) => setTarget((item) => ({ ...item, justification: text })),
    };
  });

  const specRows = RI_CRITERIA_SPECS[sub].map(specRow);
  const rows = sub === "target" ? [...anchorRows, ...specRows] : sub === "cumulative" ? [...targetRows, ...specRows] : specRows;
  const subLabel = RI_CRITERIA_SUBTABS.find((t) => t.id === sub)?.label ?? "";

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title="Absolute criteria" level={3} />
        <div className="posrow" style={{ gap: 10 }}>
          <RiProvenanceChip>RI-A3</RiProvenanceChip>
          {editable && review.changed > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={restore}>Restore published values</button>}
        </div>
      </div>
      <div className="ricriteria__set"><span className="posfield__label">Published set</span><span>{NEI_SET_LABEL}</span></div>
      <RiTabs label="Criteria set sections" tabs={RI_CRITERIA_SUBTABS} active={sub} onChange={setSub} idBase={tabId} className="ri-subtabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${sub}`} tabIndex={0}>
        <CriteriaTable label={subLabel} rows={rows} editable={editable} />
      </div>
    </div>
  );
}

function RelativeCriteriaCard(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const set = criteriaSetOf(ri);
  const r = set.relative;
  const published = PUBLISHED_RI_CRITERIA.relative;
  const issues = criteriaIssues(set);
  const review = criteriaReview(set, "baseline_risk");

  function patch(fn: (criteria: RiRelativeCriteria) => RiRelativeCriteria): void {
    if (!editable) return;
    mutateRi((draft) => withRelativeCriteria(draft, fn));
  }
  function restore(): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, criteriaSet: { ...criteriaSetOf(draft), relative: PUBLISHED_RI_CRITERIA.relative } }));
  }

  const rows: CriterionRowModel[] = RELATIVE_CRITERIA_SPECS.map((spec) => {
    const key = spec.key;
    const current = r[key];
    return {
      id: key,
      label: spec.label,
      hint: RELATIVE_SET_LABEL,
      value: <CriterionNumber label={spec.label} value={current.value} unit={spec.unit} disabled={!editable} onCommit={(v) => patch((x) => withRelativeField(x, key, nextCriterion(x[key], v, published[key].value)))} />,
      published: withUnit(String(published[key].value), spec.unit),
      changed: current.value !== published[key].value,
      justification: current.justification ?? "",
      issue: issues.relative[key],
      onJustification: (text) => patch((x) => withRelativeField(x, key, { ...x[key], justification: text })),
    };
  });

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title="Relative criteria" level={3} />
        <div className="posrow" style={{ gap: 10 }}>
          <RiProvenanceChip>RI-A2</RiProvenanceChip>
          {editable && review.changed > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={restore}>Restore published values</button>}
        </div>
      </div>
      <div className="ricriteria__set"><span className="posfield__label">Published set</span><span>{RELATIVE_SET_LABEL}</span></div>
      <CriteriaTable label="Relative criteria" rows={rows} editable={editable} />
    </div>
  );
}

interface FcPoint {
  dose: number;
  freq: number;
}

function doseOnTarget(line: FcPoint[], freq: number, fallback: number): number {
  for (let i = 0; i + 1 < line.length; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    if (freq > Math.max(a.freq, b.freq) || freq < Math.min(a.freq, b.freq)) continue;
    if (a.freq === b.freq) return a.dose;
    const t = (log10(freq) - log10(a.freq)) / (log10(b.freq) - log10(a.freq));
    return Math.pow(10, log10(a.dose) + t * (log10(b.dose) - log10(a.dose)));
  }
  const head = line[0];
  return head !== undefined && freq > head.freq ? head.dose : fallback;
}

function FcTargetPreview({ criteria }: { criteria: RiAbsoluteCriteria }): JSX.Element {
  const clipId = `ri-fc-clip-${useId().split(":").join("")}`;
  const anchors = criteria.fcAnchors.filter((p) => p.doseRem > 0 && p.frequencyPerPlantYear > 0);
  const share = criteria.lbeTargetPercent.value / 100;
  const floorRem = criteria.lbeDoseFloorMrem.value / 1000;
  const bands = [
    { label: "AOO", lower: criteria.aooLowerPerPlantYear.value },
    { label: "DBE", lower: criteria.dbeLowerPerPlantYear.value },
    { label: "BDBE", lower: criteria.bdbeLowerPerPlantYear.value },
  ].filter((b) => b.lower > 0);
  const first = anchors[0];
  const second = anchors[1];
  const last = anchors[anchors.length - 1];
  if (first === undefined || second === undefined || last === undefined) {
    return <p className="posmuted">Enter at least two anchors above zero to draw the target.</p>;
  }

  const W = 560;
  const H = 420;
  const x0 = 58;
  const x1 = 544;
  const yTop = 14;
  const yBot = 370;
  const xLoExp = Math.floor(log10(Math.min(first.doseRem, floorRem > 0 ? floorRem : first.doseRem)));
  const xHiExp = Math.ceil(log10(last.doseRem)) + 1;
  const yHiExp = Math.ceil(log10(first.frequencyPerPlantYear)) + 1;
  const yLoExp = Math.floor(log10(Math.min(last.frequencyPerPlantYear, ...bands.map((b) => b.lower))));
  const xMin = Math.pow(10, xLoExp);
  const xMax = Math.pow(10, xHiExp);
  const yMin = Math.pow(10, yLoExp);
  const yMax = Math.pow(10, yHiExp);
  const mx = (d: number): number => scaleLog(d, xMin, xMax, x0, x1);
  const my = (f: number): number => scaleLog(f, yMin, yMax, yBot, yTop);

  const lx1 = log10(first.doseRem);
  const ly1 = log10(first.frequencyPerPlantYear);
  const run = log10(second.doseRem) - lx1;
  const slope = run === 0 ? 0 : (log10(second.frequencyPerPlantYear) - ly1) / run;
  const head: FcPoint[] = [];
  if (slope < 0) {
    const xAtTop = lx1 + (yHiExp - ly1) / slope;
    head.push(xAtTop >= xLoExp
      ? { dose: Math.pow(10, xAtTop), freq: yMax }
      : { dose: xMin, freq: Math.pow(10, ly1 + slope * (xLoExp - lx1)) });
  }
  const target: FcPoint[] = [...head, ...anchors.map((p) => ({ dose: p.doseRem, freq: p.frequencyPerPlantYear })), { dose: xMax, freq: last.frequencyPerPlantYear }];
  const lowered = target.map((p) => ({ dose: p.dose, freq: p.freq * share }));
  const points = (list: FcPoint[]): string => list.map((p) => `${mx(p.dose)},${my(p.freq)}`).join(" ");
  const xTicks: number[] = [];
  for (let e = xLoExp; e <= xHiExp; e += 1) xTicks.push(e);
  const yTicks: number[] = [];
  for (let e = yLoExp; e <= yHiExp; e += 1) yTicks.push(e);
  const labelX = Math.max(x0 + 6, (floorRem > 0 ? mx(floorRem) : x0) + 6);
  const boundLines = bands.map((b) => ({
    label: b.label,
    y: my(b.lower),
    xEnd: mx(Math.min(xMax, Math.max(xMin, doseOnTarget(target, b.lower, xMax)))),
  }));
  const extraTicks = bands.map((b) => b.lower).filter((v) => {
    const e = log10(v);
    if (Math.abs(e - Math.round(e)) < 1e-9) return false;
    return Math.abs(my(v) - my(Math.pow(10, Math.floor(e)))) >= 11 && Math.abs(my(v) - my(Math.pow(10, Math.ceil(e)))) >= 11;
  });

  return (
    <>
      <div className="rifc__legend rifc__legend--top">
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--target" />F-C target</div>
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--share" />{criteria.lbeTargetPercent.value}% of the target</div>
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--floor" />{criteria.lbeDoseFloorMrem.value} mrem dose floor</div>
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--band" />Category bounds</div>
      </div>
      <div className="rifc__center">
        <div className="rifc__plot">
          <svg className="rifc__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Frequency-consequence target preview">
            <defs><clipPath id={clipId}><rect x={x0} y={yTop} width={x1 - x0} height={yBot - yTop} /></clipPath></defs>
            {xTicks.map((p) => (<line key={`gx${p}`} className="rifc__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
            {yTicks.map((p) => (<line key={`gy${p}`} className="rifc__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
            {boundLines.map((b) => (<line key={`band${b.label}`} className="rifc__fc-band" x1={x0} y1={b.y} x2={b.xEnd} y2={b.y} />))}
            {boundLines.map((b) => (<text key={`bandlab${b.label}`} className="rifc__fc-bandlab" x={labelX} y={b.y - 5}>{b.label}</text>))}
            <g clipPath={`url(#${clipId})`}>
              <polyline className="rifc__fc-share" points={points(lowered)} />
              <polyline className="rifc__fc-target" points={points(target)} />
              {floorRem > 0 && <line className="rifc__fc-floor" x1={mx(floorRem)} y1={yTop} x2={mx(floorRem)} y2={yBot} />}
            </g>
            <line className="rifc__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
            <line className="rifc__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
            {xTicks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
            {yTicks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
            {extraTicks.map((v) => (<text key={`tyx${v}`} className="rifc__lab" x={x0 - 6} y={my(v) + 3} textAnchor="end">{sciText(v)}</text>))}
            <text className="rifc__axlab" x={(x0 + x1) / 2} y={H - 8} textAnchor="middle">30-day TEDE at the EAB (rem)</text>
            <text className="rifc__axlab" x={-((yTop + yBot) / 2)} y={14} textAnchor="middle" transform="rotate(-90 0 0)">Frequency (per plant-year)</text>
            {anchors.map((p, i) => (
              <circle key={`anchor${i}`} className="rifc__fc-anchor" cx={mx(p.doseRem)} cy={my(p.frequencyPerPlantYear)} r={4.5}>
                <title>{`${p.doseRem} rem at ${sciText(p.frequencyPerPlantYear)} per plant-year`}</title>
              </circle>
            ))}
          </svg>
        </div>
      </div>
    </>
  );
}

function CriteriaSetTab({ appType }: { appType: AppTypeId }): JSX.Element {
  const { ri } = useRiWorkbook();
  if (appType === "baseline_risk") return <RelativeCriteriaCard />;
  return (
    <>
      <AbsoluteCriteriaCard />
      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="RI" title="Target preview" level={3} /></div>
        <FcTargetPreview criteria={criteriaSetOf(ri).absolute} />
      </div>
    </>
  );
}

const MEASURE_QUANTITIES: RcMetricQuantity[] = [
  "INDIVIDUAL_DOSE",
  "INDIVIDUAL_EARLY_FATALITY_RISK",
  "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
  "POPULATION_DOSE",
  "LAND_CONTAMINATION_AREA",
  "ECONOMIC_COST",
  "CUSTOM",
];

const MEASURE_RECEPTORS: RcMetricReceptor["kind"][] = ["EAB_MAXIMUM", "DISTANCE_PROFILE", "AVERAGE_BEYOND_EAB", "WITHIN_RADIUS", "OTHER"];

const WINDOW_STARTS: RcMetricWindowStart[] = ["RELEASE_ONSET", "PLUME_ARRIVAL"];

const MILE_KM = 1.609344;

function receptorFor(kind: RcMetricReceptor["kind"], current: RcMetricReceptor | undefined): RcMetricReceptor {
  const distance = current?.kind === "AVERAGE_BEYOND_EAB" ? current.distanceKm : current?.kind === "WITHIN_RADIUS" ? current.radiusKm : undefined;
  switch (kind) {
    case "EAB_MAXIMUM": return { kind };
    case "DISTANCE_PROFILE": return { kind };
    case "AVERAGE_BEYOND_EAB": return { kind, distanceKm: distance };
    case "WITHIN_RADIUS": return { kind, radiusKm: distance };
    case "OTHER": return { kind, description: current?.kind === "OTHER" ? current.description : "" };
  }
}

function distanceText(km: number): string {
  const miles = km / MILE_KM;
  const whole = Math.round(miles);
  return whole > 0 && Math.abs(miles - whole) < 1e-3 ? `${whole} mi` : `${Number(km.toPrecision(3))} km`;
}

function measureReceptorText(receptor: RcMetricReceptor | undefined): string {
  if (receptor === undefined) return "Not set";
  switch (receptor.kind) {
    case "EAB_MAXIMUM": return "EAB maximum";
    case "DISTANCE_PROFILE": return "Maximum by distance";
    case "AVERAGE_BEYOND_EAB": return receptor.distanceKm === undefined ? "Average beyond the EAB" : `Average, EAB to ${distanceText(receptor.distanceKm)}`;
    case "WITHIN_RADIUS": return receptor.radiusKm === undefined ? "Within a radius" : `Within ${distanceText(receptor.radiusKm)}`;
    case "OTHER": return receptor.description.trim().length > 0 ? receptor.description : "Other receptors";
  }
}

function measureWindowText(window: RcMetricWindow | undefined): string {
  if (window === undefined) return "Not set";
  return `${rcMetricDurationText(window.seconds)}, ${MEASURE_WINDOW_START_LABELS[window.start].toLowerCase()}`;
}

function protectiveText(credited: boolean | undefined): string {
  if (credited === undefined) return "Not set";
  return credited ? "Credited" : "Not credited";
}

function MeasuresCard({ appType, openDrawer }: { appType: AppTypeId; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi, upstream } = useRiWorkbook();
  const measures = ri.scopeDefinition.consequenceMeasures;
  const set = criteriaSetOf(ri);
  const absolute = appType !== "baseline_risk";
  const roleProblems = measureRoleIssues(measures, appType);
  const missingRoles = MEASURE_ROLE_SPECS.filter((r) => !measures.some((m) => m.role === r.id));

  function setMeasures(fn: (list: ConsequenceMeasure[]) => ConsequenceMeasure[]): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, scopeDefinition: { ...draft.scopeDefinition, consequenceMeasures: fn(draft.scopeDefinition.consequenceMeasures) } }));
  }
  function addMeasure(): void {
    if (!editable) return;
    const index = measures.length;
    setMeasures((list) => [...list, { name: "" }]);
    openDrawer({ kind: "measure", id: String(index) });
  }
  function addNei(): void {
    setMeasures((list) => [...list, ...MEASURE_ROLE_SPECS.filter((r) => !list.some((m) => m.role === r.id)).map(measureFromPreset)]);
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title="Consequence measures" level={3} />
        <RiProvenanceChip>RI-A1</RiProvenanceChip>
      </div>
      {measures.length === 0 ? (
        <p className="posmuted">No consequence measures yet.</p>
      ) : (
        <div className="ricriteria__table-wrap">
          <table className="postable ri-rowtable" aria-label="Consequence measures">
            <thead>
              <tr>
                <th>Measure</th>
                {absolute && <th>Used for</th>}
                <th>Quantity</th>
                <th>Receptors</th>
                <th>Exposure window</th>
                <th>Protective actions</th>
                <th>Statistics</th>
                <th>RC check</th>
              </tr>
            </thead>
            <tbody>
              {measures.map((m, index) => {
                const issues = measureIssues(m);
                const needs = measureNeeds(m, set, appType);
                const check = measureRcCheck(m, needs, upstream.rc);
                const unit = m.quantity === undefined ? "" : rcMetricUnit({ quantity: m.quantity, customUnit: m.customUnit });
                return (
                  <tr key={index}>
                    <td className="ri-rowtable__wrap">
                      <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "measure", id: String(index) })}>
                        {m.name.trim().length > 0 ? m.name : "Unnamed measure"}
                      </button>
                      {issues.length > 0 && <span className="ri-rowtable__note">{issues.length} {issues.length === 1 ? "item" : "items"} to complete</span>}
                    </td>
                    {absolute && <td>{MEASURE_ROLE_SPECS.find((r) => r.id === m.role)?.short ?? "Reported only"}</td>}
                    <td title={unit.length > 0 ? `Unit: ${unit}` : undefined}>{m.quantity === undefined ? "Not set" : MEASURE_QUANTITY_LABELS[m.quantity]}</td>
                    <td title={m.receptor === undefined ? undefined : rcMetricReceptorText(m.receptor)}>{measureReceptorText(m.receptor)}</td>
                    <td>{measureWindowText(m.window)}</td>
                    <td>{protectiveText(m.protectiveActionsCredited)}</td>
                    <td title={measureNeedsText(needs)}>{measureNeedsShort(needs)}</td>
                    <td title={check.detail} className={`ri-tone--${check.tone}`}>{check.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {roleProblems.length > 0 && (
        <div className="rimeasures__problems" role="alert">
          {roleProblems.map((p) => <span key={p} className="ricriteria__error">{p}</span>)}
        </div>
      )}
      {editable && (
        <div className="rimeasures__actions">
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMeasure}><RIIcon.Plus /> Add measure</button>
          {absolute && missingRoles.length > 0 && (
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={addNei}><RIIcon.Plus /> Add NEI 18-04 measures</button>
          )}
        </div>
      )}
    </div>
  );
}

function FormRow({ label, htmlFor, top = false, children }: { label: string; htmlFor: string; top?: boolean; children: ReactNode }): JSX.Element {
  return (
    <div className={`ri-form__row${top ? " ri-form__row--top" : ""}`}>
      <label className="posfield__label ri-form__label" htmlFor={htmlFor}>{label}</label>
      <div className="ri-form__control">{children}</div>
    </div>
  );
}

function FormFoot({ onClose, children }: { onClose: () => void; children?: ReactNode }): JSX.Element {
  return (
    <div className="modal__foot ri-form__foot">
      {children}
      <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary ri-form__done" onClick={onClose}>Done</button>
    </div>
  );
}

function MeasureDrawer({ index, onClose }: { index: number; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const measure = ri.scopeDefinition.consequenceMeasures[index];
  const [windowUnit, setWindowUnit] = useState<RcMetricWindowUnit>(() => rcMetricWindowUnit(measure?.window?.seconds));
  const fieldId = useId();
  if (measure === undefined) return null;
  const dis = !editable;
  const absolute = appTypeFromMef(ri) !== "baseline_risk";
  const receptor = measure.receptor;
  const window = measure.window;
  const unitSeconds = rcMetricWindowUnits.find((u) => u.id === windowUnit)?.seconds ?? 86400;
  const fid = (name: string): string => `${fieldId}-${name}`;

  function patch(next: Partial<ConsequenceMeasure>): void {
    if (!editable) return;
    mutateRi((d) => ({
      ...d,
      scopeDefinition: { ...d.scopeDefinition, consequenceMeasures: d.scopeDefinition.consequenceMeasures.map((m, i) => (i === index ? { ...m, ...next } : m)) },
    }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => ({
      ...d,
      scopeDefinition: { ...d.scopeDefinition, consequenceMeasures: d.scopeDefinition.consequenceMeasures.filter((_, i) => i !== index) },
    }));
  }
  function distanceRow(label: string, value: number | undefined, commit: (km: number | undefined) => void): JSX.Element {
    return (
      <FormRow label={label} htmlFor={fid("distance")}>
        <WorkbookInput
          id={fid("distance")}
          className="posfield__input ri-form__number"
          type="number"
          min={0}
          step="any"
          value={value === undefined ? "" : String(value)}
          disabled={dis}
          onChange={(e) => {
            const km = Number(e.target.value);
            commit(e.target.value === "" || !Number.isFinite(km) || km <= 0 ? undefined : km);
          }}
        />
        <span className="ri-form__unit">km</span>
      </FormRow>
    );
  }

  return (
    <>
      <DrawerHead cap="Consequence measure · RI-A1" title={measure.name.trim().length > 0 ? measure.name : "Unnamed measure"} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Name" htmlFor={fid("name")}>
          <WorkbookInput id={fid("name")} className="posfield__input" value={measure.name} disabled={dis} onChange={(e) => patch({ name: e.target.value })} />
        </FormRow>
        {absolute && (
          <FormRow label="Used for" htmlFor={fid("role")}>
            <select id={fid("role")} className="posfield__select" value={measure.role ?? ""} disabled={dis} onChange={(e) => patch({ role: MEASURE_ROLE_SPECS.find((r) => r.id === e.target.value)?.id })}>
              <option value="">Reported only</option>
              {MEASURE_ROLE_SPECS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </FormRow>
        )}
        <FormRow label="Description" htmlFor={fid("description")} top>
          <WorkbookTextarea id={fid("description")} className="posfield__textarea" rows={2} fitContent value={measure.description ?? ""} disabled={dis} onChange={(e) => patch({ description: e.target.value })} />
        </FormRow>
        <FormRow label="Quantity" htmlFor={fid("quantity")}>
          <select
            id={fid("quantity")}
            className="posfield__select"
            value={measure.quantity ?? ""}
            disabled={dis}
            onChange={(e) => {
              const quantity = MEASURE_QUANTITIES.find((q) => q === e.target.value);
              patch({ quantity, customUnit: quantity === "CUSTOM" ? measure.customUnit ?? "" : undefined });
            }}
          >
            {measure.quantity === undefined && <option value="">Choose a quantity</option>}
            {MEASURE_QUANTITIES.map((q) => <option key={q} value={q}>{rcMetricQuantityLabels[q]}</option>)}
          </select>
        </FormRow>
        {measure.quantity === "CUSTOM" && (
          <FormRow label="Unit" htmlFor={fid("unit")}>
            <WorkbookInput id={fid("unit")} className="posfield__input" value={measure.customUnit ?? ""} disabled={dis} onChange={(e) => patch({ customUnit: e.target.value })} />
          </FormRow>
        )}
        <FormRow label="Receptors" htmlFor={fid("receptors")}>
          <select
            id={fid("receptors")}
            className="posfield__select"
            value={receptor?.kind ?? ""}
            disabled={dis}
            onChange={(e) => {
              const kind = MEASURE_RECEPTORS.find((k) => k === e.target.value);
              if (kind !== undefined) patch({ receptor: receptorFor(kind, receptor) });
            }}
          >
            {receptor === undefined && <option value="">Choose receptors</option>}
            {MEASURE_RECEPTORS.map((k) => <option key={k} value={k}>{rcMetricReceptorLabels[k]}</option>)}
          </select>
        </FormRow>
        {receptor?.kind === "AVERAGE_BEYOND_EAB" && distanceRow("Distance beyond the EAB", receptor.distanceKm, (km) => patch({ receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: km } }))}
        {receptor?.kind === "WITHIN_RADIUS" && distanceRow("Radius from the release", receptor.radiusKm, (km) => patch({ receptor: { kind: "WITHIN_RADIUS", radiusKm: km } }))}
        {receptor?.kind === "OTHER" && (
          <FormRow label="Receptor description" htmlFor={fid("other")}>
            <WorkbookInput id={fid("other")} className="posfield__input" value={receptor.description} disabled={dis} onChange={(e) => patch({ receptor: { kind: "OTHER", description: e.target.value } })} />
          </FormRow>
        )}
        <FormRow label="Exposure window" htmlFor={fid("window")}>
          <WorkbookInput
            id={fid("window")}
            className="posfield__input ri-form__number"
            type="number"
            min={0}
            step="any"
            value={window === undefined ? "" : String(rcMetricWindowValue(window.seconds, windowUnit))}
            disabled={dis}
            onChange={(e) => {
              if (e.target.value === "") {
                patch({ window: undefined });
                return;
              }
              const value = Number(e.target.value);
              if (!Number.isFinite(value) || value <= 0) return;
              patch({ window: { seconds: Math.round(value * unitSeconds), start: window?.start ?? "RELEASE_ONSET" } });
            }}
          />
          <select className="posfield__select" aria-label="Exposure window unit" value={windowUnit} disabled={dis} onChange={(e) => setWindowUnit(rcMetricWindowUnits.find((u) => u.id === e.target.value)?.id ?? "days")}>
            {rcMetricWindowUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Window starts at" htmlFor={fid("start")}>
          <select
            id={fid("start")}
            className="posfield__select"
            value={window?.start ?? "RELEASE_ONSET"}
            disabled={dis || window === undefined}
            onChange={(e) => {
              const start = WINDOW_STARTS.find((s) => s === e.target.value);
              if (window !== undefined && start !== undefined) patch({ window: { ...window, start } });
            }}
          >
            {WINDOW_STARTS.map((s) => <option key={s} value={s}>{rcMetricWindowStartLabels[s]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Protective actions" htmlFor={fid("protective")}>
          <select
            id={fid("protective")}
            className="posfield__select"
            value={measure.protectiveActionsCredited === undefined ? "" : measure.protectiveActionsCredited ? "yes" : "no"}
            disabled={dis}
            onChange={(e) => patch({ protectiveActionsCredited: e.target.value === "" ? undefined : e.target.value === "yes" })}
          >
            <option value="">Not set</option>
            <option value="no">Not credited</option>
            <option value="yes">Credited</option>
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove measure</button>}
      </FormFoot>
    </>
  );
}

function FloorsCard({ appType }: { appType: AppTypeId }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const t = ri.reportingThresholds;
  const floor = consequenceFloorOf(t);
  const issues = floorsIssues(t);
  const mrem = consequenceFloorMrem(floor);
  const lbeFloor = criteriaSetOf(ri).absolute.lbeDoseFloorMrem.value;
  const consistent = Math.abs(mrem - lbeFloor) <= 0.05 * lbeFloor;

  function mutate(fn: (draft: RiskIntegration) => RiskIntegration): void {
    if (!editable) return;
    mutateRi(fn);
  }

  const rows: CriterionRowModel[] = FLOOR_SPECS.map((spec) => {
    if (spec.key === "frequency") {
      const value = t.minimumReportingFrequencyPerPlantYear;
      const published = PUBLISHED_REPORTING_FLOORS.minimumReportingFrequencyPerPlantYear;
      return {
        id: spec.key,
        label: spec.label,
        hint: spec.source,
        value: <CriterionNumber label={spec.label} value={value} unit={spec.unit} format={spec.format} disabled={!editable} onCommit={(v) => mutate((d) => withFrequencyFloor(d, v))} />,
        published: withUnit(numberText(published, spec.format), spec.unit),
        changed: value !== published,
        justification: t.frequencyJustification ?? "",
        issue: issues.frequency,
        onJustification: (text) => mutate((d) => withFrequencyJustification(d, text)),
      };
    }
    const key = spec.key;
    const current = floor[key];
    return {
      id: key,
      label: spec.label,
      hint: spec.source,
      value: <CriterionNumber label={spec.label} value={current.value} unit={spec.unit} format={spec.format} disabled={!editable} onCommit={(v) => mutate((d) => withFloorValue(d, key, v))} />,
      published: withUnit(numberText(PUBLISHED_REPORTING_FLOORS[key], spec.format), spec.unit),
      changed: floorChanged(floor, key),
      justification: current.justification ?? "",
      issue: issues[key],
      onJustification: (text) => mutate((d) => withFloorJustification(d, key, text)),
    };
  });

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title="Reporting floors" level={3} />
        <RiProvenanceChip>RI-A4 · A5</RiProvenanceChip>
      </div>
      <CriteriaTable label="Reporting floors" rows={rows} editable={editable} />
      <div className="rifloor__result">
        <span className="posfield__label">Minimum reporting consequence</span>
        <span className="rifloor__value">{Number(mrem.toPrecision(3))} mrem</span>
        {appType !== "baseline_risk" && (
          <span className={consistent ? "rifloor__note" : "ricriteria__error"}>
            {consistent
              ? `Consistent with the ${lbeFloor} mrem significance floor in the criteria set.`
              : `Differs from the ${lbeFloor} mrem significance floor in the criteria set.`}
          </span>
        )}
      </div>
    </div>
  );
}

function MeasuresFloorsTab({ appType, openDrawer }: { appType: AppTypeId; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  return (
    <>
      <MeasuresCard appType={appType} openDrawer={openDrawer} />
      <FloorsCard appType={appType} />
    </>
  );
}

function ApplicationScreen({ appType, setAppType, openDrawer, documents }: {
  appType: AppTypeId;
  setAppType: (a: AppTypeId) => void;
  openDrawer: (ctx: RiDrawerContext) => void;
  documents: JSX.Element | null;
}): JSX.Element {
  const [tab, setTab] = useState<ApplicationTab>("decision");
  const tabId = useId();

  return (
    <div className="ri-step">
      <RiTabs label="Application sections" tabs={APPLICATION_TABS} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        {tab === "decision" && <DecisionScopeTab appType={appType} setAppType={setAppType} documents={documents} />}
        {tab === "criteria" && <CriteriaSetTab appType={appType} />}
        {tab === "measures" && <MeasuresFloorsTab appType={appType} openDrawer={openDrawer} />}
      </div>
    </div>
  );
}

// ─── 02 — Inputs (HLR-RI-B) ────────────────────────────────────────────────
type InputsTab = "families" | "sequences" | "consequences" | "contributors" | "importance" | "checks";

const SEQUENCE_PAGE = 50;

const DOSE_100_MREM_SV = 0.001;

const END_STATE_TEXT: Record<EndState, string> = {
  [EndState.SUCCESSFUL_MITIGATION]: "No release",
  [EndState.RADIONUCLIDE_RELEASE]: "Release",
};

const SEVERITY_TEXT: Record<RiFindingSeverity, string> = { error: "Error", warning: "Warning", note: "Note" };

function statText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function probabilityText(value: number | undefined): string {
  return value === undefined ? "—" : String(Number(value.toPrecision(4)));
}

function familySourceText(family: RiInputFamily): string {
  if (family.manual !== undefined) return "By hand";
  if (family.frequencySource === "ES") return "ES screening";
  if (family.quantificationIds.length === 1) return `ESQ ${family.quantificationIds[0] ?? ""}`;
  if (family.quantificationIds.length > 1) return `ESQ, ${family.quantificationIds.length} parts`;
  return "—";
}

function familySourceTitle(family: RiInputFamily): string | undefined {
  if (family.quantificationIds.length > 1) return `Sum of ${family.quantificationIds.join(", ")}. The percentiles use a lognormal approximation.`;
  return undefined;
}

function topEventText(events: RiTopEventState[]): string {
  if (events.length === 0) return "—";
  return events.map((e) => `${e.event}${e.state === "SUCCESS" ? "✓" : e.state === "FAILURE" ? "✗" : "–"}`).join(" ");
}

function percentileOf(stats: RiConsequenceStats, percentile: number): number | undefined {
  return stats.percentiles.find((p) => p.percentile === percentile)?.value;
}

function thresholdText(threshold: number, unit: string): string {
  return unit === "Sv" ? `${Number((threshold * 100000).toPrecision(6))} mrem` : `${threshold} ${unit}`.trim();
}

function InputSourcesCard(): JSX.Element {
  const { ri, editable, mutateRi, upstream } = useRiWorkbook();
  const inputs = ri.inputs;
  const links = applicationContextOf(ri).linkedWorkbooks;
  const ready = riImportReady(upstream);
  const linked = links.ES !== undefined || links.ESQ !== undefined || links.RC !== undefined;
  const edits = inputs === undefined
    ? 0
    : inputs.families.filter(frequencyEdited).length + inputs.sequences.filter(frequencyEdited).length + inputs.consequences.filter(consequenceEdited).length;
  const byHand = manualCount(inputs);
  const rows: { code: "ES" | "ESQ" | "RC"; provides: string; loaded: boolean }[] = [
    { code: "ES", provides: "Families and sequences", loaded: upstream.es !== undefined },
    { code: "ESQ", provides: "Frequencies", loaded: upstream.esq !== undefined },
    { code: "RC", provides: "Consequences", loaded: upstream.rc !== undefined },
  ];

  function importNow(): void {
    if (!editable) return;
    const now = new Date().toISOString();
    mutateRi((draft) => {
      const next = riImportInputs(draft, upstream, now);
      return next === undefined ? draft : { ...draft, inputs: withManualKept(draft.inputs, next) };
    });
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title="Source workbooks" level={3} />
        <div className="posrow" style={{ gap: 10 }}>
          <RiProvenanceChip>RI-B1</RiProvenanceChip>
          {editable && linked && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!ready} onClick={importNow}>
              {inputs?.importedAt === undefined ? "Import from linked workbooks" : "Import again"}
            </button>
          )}
        </div>
      </div>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Source workbooks">
          <thead><tr><th>Element</th><th>Linked workbook</th><th>Provides</th><th>Imported from</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const id = links[row.code];
              const name = id === undefined ? "Not linked" : upstream.options[row.code].find((w) => w.id === id)?.name ?? exampleLinkLabel(id) ?? id;
              const source = inputs?.sources.find((s) => s.element === row.code);
              return (
                <tr key={row.code}>
                  <td>{row.code}</td>
                  <td>{name}{id !== undefined && !row.loaded && <span className="ri-rowtable__tag">Not loaded</span>}</td>
                  <td>{row.provides}</td>
                  <td>{source === undefined ? "—" : source.workbookName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ri-inputs__meta">
        {inputs?.importedAt !== undefined ? `Imported ${new Date(inputs.importedAt).toLocaleString()}. ` : ""}
        {byHand > 0 ? `${byHand} ${byHand === 1 ? "item is" : "items are"} entered by hand. ` : ""}
        {inputs?.importedAt !== undefined && edits > 0 ? `Importing again replaces ${edits} edited ${edits === 1 ? "value" : "values"}. ` : ""}
        {inputs?.importedAt !== undefined && byHand > 0 ? "Hand-entered items stay. " : ""}
        {!linked ? "No workbook is linked. Link ES, ESQ and RC in Step 01 to import, or add the inputs by hand below." : !ready ? "Link the ES and ESQ workbooks in Step 01 to import." : ""}
      </p>
    </div>
  );
}

function ByHandTag({ manual }: { manual: RiManualEntry | undefined }): JSX.Element | null {
  return manual === undefined ? null : <span className="ri-rowtable__tag">By hand</span>;
}

function FamiliesTable({ inputs, openDrawer }: { inputs: RiInputs; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  if (inputs.families.length === 0) return <p className="posmuted">No family yet. Import them above or add them by hand.</p>;
  return (
    <div className="ricriteria__table-wrap">
      <table className="postable ri-rowtable" aria-label="Event sequence families">
        <thead>
          <tr>
            <th>Family</th><th>Name</th><th>Operating state</th><th>Initiating event</th><th>Release category</th>
            <th>Frequency from</th><th>Mean</th><th>5th</th><th>50th</th><th>95th</th><th>Sequences</th>
          </tr>
        </thead>
        <tbody>
          {inputs.families.map((f) => {
            const tag = !f.included ? "Excluded" : frequencyEdited(f) ? "Edited" : undefined;
            return (
              <tr key={f.id} className={f.included ? undefined : "ri-rowtable__muted"}>
                <td>
                  <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputFamily", id: f.id })}>{f.id}</button>
                  {tag !== undefined && <span className="ri-rowtable__tag">{tag}</span>}
                </td>
                <td className="ri-rowtable__wrap">{f.name.trim().length > 0 ? f.name : "Unnamed"}</td>
                <td>{f.plantOperatingStateId.trim().length > 0 ? f.plantOperatingStateId : "—"}</td>
                <td>{f.initiatingEventId.trim().length > 0 ? f.initiatingEventId : "—"}</td>
                <td>{f.releaseCategoryIds.length > 0 ? f.releaseCategoryIds.join(", ") : END_STATE_TEXT[f.endState]}</td>
                <td title={familySourceTitle(f)}>{familySourceText(f)}</td>
                <td>{statText(f.frequency?.mean)}</td>
                <td>{statText(f.frequency?.p05)}</td>
                <td>{statText(f.frequency?.p50)}</td>
                <td>{statText(f.frequency?.p95)}</td>
                <td>{f.memberSequenceIds.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SequencesTable({ inputs, openDrawer }: { inputs: RiInputs; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const [family, setFamily] = useState("");
  const [page, setPage] = useState(0);
  const filterId = useId();
  if (inputs.sequences.length === 0) return <p className="posmuted">No sequence yet. Import them above or add them by hand.</p>;
  const rows = family === "" ? inputs.sequences : inputs.sequences.filter((s) => s.familyId === family);
  const pages = Math.max(1, Math.ceil(rows.length / SEQUENCE_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * SEQUENCE_PAGE, (current + 1) * SEQUENCE_PAGE);
  return (
    <>
      <div className="ri-inputs__bar">
        <label className="posfield__label" htmlFor={filterId}>Family</label>
        <select id={filterId} className="posfield__select" value={family} onChange={(e) => { setFamily(e.target.value); setPage(0); }}>
          <option value="">All families</option>
          {inputs.families.map((f) => <option key={f.id} value={f.id}>{f.id}</option>)}
        </select>
        <span className="ri-inputs__count">
          {rows.length === 0 ? "No sequences" : `${current * SEQUENCE_PAGE + 1} to ${current * SEQUENCE_PAGE + shown.length} of ${rows.length}`}
        </span>
        <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        <button type="button" className="posnav__btn posnav__btn--sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
      </div>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Event sequences">
          <thead>
            <tr>
              <th>Sequence</th><th>Family</th><th>Operating state</th><th>Initiating event</th><th>Top events</th>
              <th>End state</th><th>Release category</th><th>Mean</th><th>95th</th><th>Reactors or sources</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td title={s.name}>
                  <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputSequence", id: s.id })}>{s.id}</button>
                  {frequencyEdited(s) && <span className="ri-rowtable__tag">Edited</span>}
                  <ByHandTag manual={s.manual} />
                </td>
                <td>{s.familyId ?? "—"}</td>
                <td>{s.plantOperatingStateId.trim().length > 0 ? s.plantOperatingStateId : "—"}</td>
                <td>{s.initiatingEventId.trim().length > 0 ? s.initiatingEventId : "—"}</td>
                <td className="ri-rowtable__mono">{topEventText(s.topEvents)}</td>
                <td>{END_STATE_TEXT[s.endState]}</td>
                <td>{s.releaseCategoryId ?? "—"}</td>
                <td title={s.frequencySource === "ES" ? "ES screening value" : s.frequencySource === "ESQ" ? "ESQ estimate" : undefined}>{statText(s.frequency?.mean)}</td>
                <td>{statText(s.frequency?.p95)}</td>
                <td>{s.reactorSourceCombinations.length > 0 ? s.reactorSourceCombinations.join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function chanceAbove100Mrem(c: RiInputConsequence): number | undefined {
  const factor = remPerUnit(c.unit);
  if (factor === undefined) return undefined;
  return c.statistics.exceedances.find((x) => Math.abs(x.threshold * factor - DOSE_100_MREM_SV * 100) <= 1e-9)?.probability;
}

function ConsequencesTable({ inputs, measures, openDrawer }: { inputs: RiInputs; measures: ConsequenceMeasure[]; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const gaps = measuresWithoutResults(ri);
  const order = (c: RiInputConsequence): number => {
    const index = measures.findIndex((m) => m.name === c.measure);
    return index < 0 ? measures.length : index;
  };
  const rows = [...inputs.consequences].sort((a, b) => a.releaseCategoryId.localeCompare(b.releaseCategoryId, undefined, { numeric: true }) || order(a) - order(b));
  return (
    <>
      {rows.length === 0 ? (
        <p className="posmuted">No result yet. Import them above or add them by hand.</p>
      ) : (
        <div className="ricriteria__table-wrap">
          <table className="postable ri-rowtable" aria-label="Consequences by release category">
            <thead>
              <tr>
                <th>Release category</th><th>Measure</th><th>Unit</th><th>Mean</th><th>5th</th><th>50th</th><th>95th</th>
                <th>Chance above 100 mrem</th><th>Used by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const users = inputs.families.filter((f) => f.included && f.releaseCategoryIds.includes(c.releaseCategoryId)).map((f) => f.id);
                const dose = remPerUnit(c.unit) !== undefined;
                return (
                  <tr key={consequenceKey(c)}>
                    <td>
                      <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputConsequence", id: consequenceKey(c) })}>{c.releaseCategoryId.trim().length > 0 ? c.releaseCategoryId : "No category"}</button>
                      {consequenceEdited(c) && <span className="ri-rowtable__tag">Edited</span>}
                      <ByHandTag manual={c.manual} />
                    </td>
                    <td className="ri-rowtable__wrap">{c.measure}</td>
                    <td>{c.unit.length > 0 ? c.unit : "—"}</td>
                    <td>{statText(c.statistics.mean)}</td>
                    <td>{statText(percentileOf(c.statistics, 5))}</td>
                    <td>{statText(percentileOf(c.statistics, 50))}</td>
                    <td>{statText(percentileOf(c.statistics, 95))}</td>
                    <td>{dose ? probabilityText(chanceAbove100Mrem(c)) : "—"}</td>
                    <td className="ri-rowtable__wrap">{users.length > 0 ? countedItems(users, 4) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {gaps.length > 0 && (
        <>
          <h4 className="ri-step__subhead">Measures without results</h4>
          <p className="ri-step__note">These measures have no result for any release family. Record why, so the gap is documented rather than an error.</p>
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Measures without results">
              <thead><tr><th>Measure</th><th>Families without a result</th><th>Why they are not available</th></tr></thead>
              <tbody>
                {gaps.map((gap) => {
                  const reason = unavailableReasonOf(inputs, gap.measure);
                  return (
                    <tr key={gap.measure}>
                      <td className="ri-rowtable__wrap"><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputGap", id: gap.measure })}>{gap.measure}</button></td>
                      <td>{gap.families.length}</td>
                      <td className="ri-rowtable__wrap">{reason ?? "Not recorded yet"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function ContributorInputsTable({ inputs, openDrawer }: { inputs: RiInputs; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const rows = inputs.contributors ?? [];
  if (rows.length === 0) return <p className="posmuted">No contributor yet. Import them from ESQ above or add them by hand.</p>;
  return (
    <div className="ricriteria__table-wrap">
      <table className="postable ri-rowtable" aria-label="Contributors">
        <thead><tr><th>Contributor</th><th>Type</th><th>Family</th><th>Share of the family</th><th>From</th></tr></thead>
        <tbody>
          {rows.map((c, index) => (
            <tr key={`${c.quantificationId}:${c.name}:${index}`}>
              <td className="ri-rowtable__wrap">
                {c.manual === undefined ? c.name : (
                  <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputContributor", id: c.quantificationId })}>{c.name.trim().length > 0 ? c.name : "Unnamed contributor"}</button>
                )}
              </td>
              <td>{contributorKindText(c.type)}</td>
              <td>{c.familyId}</td>
              <td>{c.manual === undefined ? `${shareText(c.fraction)} of ${c.quantificationId}` : shareText(c.fraction)}</td>
              <td>{c.manual === undefined ? "ESQ" : "By hand"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportanceInputsTable({ inputs, openDrawer }: { inputs: RiInputs; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const rows = inputs.importance ?? [];
  if (rows.length === 0) return <p className="posmuted">No importance measure yet. Import them from ESQ above or add them by hand.</p>;
  return (
    <div className="ricriteria__table-wrap">
      <table className="postable ri-rowtable" aria-label="Importance measures">
        <thead><tr><th>Entity</th><th>Type</th><th>Scope</th><th>Fussell-Vesely</th><th>RAW</th><th>From</th></tr></thead>
        <tbody>
          {rows.map((m, index) => (
            <tr key={`${m.analysisId}:${m.entity}:${index}`}>
              <td className="ri-rowtable__wrap">
                {m.manual === undefined ? m.entity : (
                  <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputImportance", id: m.analysisId })}>{m.entity.trim().length > 0 ? m.entity : "Unnamed entity"}</button>
                )}
              </td>
              <td>{IMPORTANCE_TYPE_LABELS[m.entityType] ?? m.entityType}</td>
              <td>{m.scope === "OVERALL" ? "Overall" : m.scope === "PER_FAMILY" ? `Family ${m.familyRef ?? ""}` : `Sequence ${m.sequenceRef ?? ""}`}</td>
              <td>{importanceNumber(m.fussellVesely)}</td>
              <td>{importanceNumber(m.riskAchievementWorth)}</td>
              <td>{m.manual === undefined ? "ESQ" : "By hand"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecksTable({ findings, openDrawer }: { findings: RiInputFinding[]; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="ricriteria__table-wrap">
      <table className="postable ri-rowtable" aria-label="Data checks">
        <thead><tr><th>Severity</th><th>Check</th><th>Item</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((f, index) => {
            const target = f.target;
            return (
              <tr key={`${f.check}:${f.item}:${index}`}>
                <td className={`ri-severity ri-severity--${f.severity}`}>{SEVERITY_TEXT[f.severity]}</td>
                <td>{f.check}</td>
                <td>
                  {target === undefined ? f.item : (
                    <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: target.kind, id: target.id })}>{f.item}</button>
                  )}
                </td>
                <td className="ri-rowtable__wrap">{f.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const INPUT_TAB_HEADS: Record<InputsTab, { title: string; sr: string; add?: string }> = {
  families: { title: "Event sequence families", sr: "RI-B1", add: "Add family" },
  sequences: { title: "Event sequences", sr: "RI-B5", add: "Add sequence" },
  consequences: { title: "Consequences by release category", sr: "RI-B1", add: "Add result" },
  contributors: { title: "Contributors", sr: "RI-B6", add: "Add contributor" },
  importance: { title: "Importance measures", sr: "RI-B6", add: "Add measure" },
  checks: { title: "Data checks", sr: "RI-B1 · B4 · B5" },
};

function doseUnitOf(measure: ConsequenceMeasure | undefined): string {
  if (measure?.quantity === undefined) return "";
  return rcMetricUnit({ quantity: measure.quantity, customUnit: measure.customUnit });
}

function InputsScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi, upstream } = useRiWorkbook();
  const [tab, setTab] = useState<InputsTab>("families");
  const tabId = useId();
  const inputs = ri.inputs;
  const findings = riInputChecks(ri, upstream.options);
  const count = (n: number): string => (inputs === undefined ? "" : ` (${n})`);
  const tabs: { id: InputsTab; label: string }[] = [
    { id: "families", label: `Families${count(inputs?.families.length ?? 0)}` },
    { id: "sequences", label: `Sequences${count(inputs?.sequences.length ?? 0)}` },
    { id: "consequences", label: `Consequences${count(inputs?.consequences.length ?? 0)}` },
    { id: "contributors", label: `Contributors${count(inputs?.contributors?.length ?? 0)}` },
    { id: "importance", label: `Importance${count(inputs?.importance?.length ?? 0)}` },
    { id: "checks", label: `Checks${count(findings.length)}` },
  ];
  const head = INPUT_TAB_HEADS[tab];

  function add(): void {
    if (!editable) return;
    const current = ri.inputs ?? { sources: [], families: [], sequences: [], consequences: [] };
    if (tab === "families") {
      const id = nextId("FAM", current.families.map((f) => f.id));
      const family: RiInputFamily = { id, name: "", plantOperatingStateId: "", initiatingEventId: "", releaseCategoryIds: [], endState: EndState.RADIONUCLIDE_RELEASE, memberSequenceIds: [], quantificationIds: [], included: true, manual: { source: "" } };
      mutateRi((d) => withInputsCreated(d, (i) => ({ ...i, families: [...i.families, family] })));
      openDrawer({ kind: "inputFamily", id });
    } else if (tab === "sequences") {
      const id = nextId("SEQ", current.sequences.map((s) => s.id));
      const sequence: RiInputSequence = { id, name: "", plantOperatingStateId: "", initiatingEventId: "", topEvents: [], endState: EndState.RADIONUCLIDE_RELEASE, reactorSourceCombinations: [], manual: { source: "" } };
      mutateRi((d) => withInputsCreated(d, (i) => ({ ...i, sequences: [...i.sequences, sequence] })));
      openDrawer({ kind: "inputSequence", id });
    } else if (tab === "consequences") {
      const key = nextId("M", current.consequences.filter((c) => c.manual !== undefined).map((c) => c.rcMetricId));
      const measure = ri.scopeDefinition.consequenceMeasures[0];
      const consequence: RiInputConsequence = { releaseCategoryId: "", measure: measure?.name ?? "", rcMetricId: key, unit: doseUnitOf(measure), statistics: { percentiles: [], exceedances: [] }, manual: { source: "" } };
      mutateRi((d) => withInputsCreated(d, (i) => ({ ...i, consequences: [...i.consequences, consequence] })));
      openDrawer({ kind: "inputConsequence", id: `manual:${key}` });
    } else if (tab === "contributors") {
      const key = nextId("C", (current.contributors ?? []).filter((c) => c.manual !== undefined).map((c) => c.quantificationId));
      const contributor: RiInputContributor = { familyId: current.families[0]?.id ?? "", quantificationId: key, quantificationMean: 0, name: "", type: "BASIC_EVENT", fraction: 0, manual: { source: "" } };
      mutateRi((d) => withInputsCreated(d, (i) => ({ ...i, contributors: [...(i.contributors ?? []), contributor] })));
      openDrawer({ kind: "inputContributor", id: key });
    } else if (tab === "importance") {
      const key = nextId("I", (current.importance ?? []).filter((m) => m.manual !== undefined).map((m) => m.analysisId));
      const measure: RiInputImportance = { analysisId: key, scope: "OVERALL", entityType: "BASIC_EVENT", entity: "", manual: { source: "" } };
      mutateRi((d) => withInputsCreated(d, (i) => ({ ...i, importance: [...(i.importance ?? []), measure] })));
      openDrawer({ kind: "inputImportance", id: key });
    }
  }

  return (
    <div className="ri-step">
      <InputSourcesCard />
      <RiTabs label="Input sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="RI" title={head.title} level={3} />
            <div className="posrow" style={{ gap: 10 }}>
              <RiProvenanceChip>{head.sr}</RiProvenanceChip>
              {editable && head.add !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}><RIIcon.Plus /> {head.add}</button>
              )}
            </div>
          </div>
          {inputs === undefined ? (
            <p className="posmuted">Nothing is imported or entered yet. Import from the linked workbooks above, or add the inputs by hand.</p>
          ) : tab === "families" ? (
            <FamiliesTable inputs={inputs} openDrawer={openDrawer} />
          ) : tab === "sequences" ? (
            <SequencesTable inputs={inputs} openDrawer={openDrawer} />
          ) : tab === "consequences" ? (
            <ConsequencesTable inputs={inputs} measures={ri.scopeDefinition.consequenceMeasures} openDrawer={openDrawer} />
          ) : tab === "contributors" ? (
            <ContributorInputsTable inputs={inputs} openDrawer={openDrawer} />
          ) : tab === "importance" ? (
            <ImportanceInputsTable inputs={inputs} openDrawer={openDrawer} />
          ) : (
            <ChecksTable findings={findings} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCell {
  key: string;
  label: string;
  value: number | undefined;
  disabled: boolean;
  onChange: (value: number | undefined) => void;
}

function StatGridRow({ label, unit, cells }: { label: string; unit: string; cells: StatCell[] }): JSX.Element {
  const baseId = useId();
  return (
    <div className="ri-form__row ri-form__row--stats">
      <div className="ri-form__label ri-form__label--stack" id={`${baseId}-label`}>
        <span className="posfield__label">{label}</span>
        {unit.length > 0 && <span className="ri-form__unit">{unit}</span>}
      </div>
      <div className="ri-form__stats" role="group" aria-labelledby={`${baseId}-label`}>
        {cells.map((cell) => (
          <div key={cell.key} className="ri-form__stat">
            <label className="ri-form__stat-label" htmlFor={`${baseId}-${cell.key}`}>{cell.label}</label>
            <WorkbookInput
              id={`${baseId}-${cell.key}`}
              className="posfield__input"
              type="number"
              step="any"
              value={cell.value === undefined ? "" : numberInputText(Number(cell.value.toPrecision(6)), "sci")}
              disabled={cell.disabled}
              onChange={(e) => {
                const next = Number(e.target.value);
                cell.onChange(e.target.value === "" || !Number.isFinite(next) ? undefined : next);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FrequencyGrid({ stats, disabled, onChange }: {
  stats: RiFrequencyStats | undefined;
  disabled: boolean;
  onChange: (key: "mean" | "p05" | "p50" | "p95", value: number | undefined) => void;
}): JSX.Element {
  const locked = disabled || stats === undefined;
  return (
    <StatGridRow
      label="Frequency"
      unit="per plant-year"
      cells={[
        { key: "mean", label: "Mean", value: stats?.mean, disabled, onChange: (v) => onChange("mean", v) },
        { key: "p05", label: "5th", value: stats?.p05, disabled: locked, onChange: (v) => onChange("p05", v) },
        { key: "p50", label: "50th", value: stats?.p50, disabled: locked, onChange: (v) => onChange("p50", v) },
        { key: "p95", label: "95th", value: stats?.p95, disabled: locked, onChange: (v) => onChange("p95", v) },
      ]}
    />
  );
}

function ReasonRow({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="Reason for change" htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </FormRow>
  );
}

const DOSE_UNITS = ["Sv", "mSv", "rem", "mrem"];

function linesOf(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

function SourceRow({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="Where the values come from" htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </FormRow>
  );
}

function EndStateRow({ value, disabled, onChange }: { value: EndState; disabled: boolean; onChange: (value: EndState) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="End state" htmlFor={id}>
      <select id={id} className="posfield__select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value === EndState.SUCCESSFUL_MITIGATION ? EndState.SUCCESSFUL_MITIGATION : EndState.RADIONUCLIDE_RELEASE)}>
        <option value={EndState.RADIONUCLIDE_RELEASE}>{END_STATE_TEXT[EndState.RADIONUCLIDE_RELEASE]}</option>
        <option value={EndState.SUCCESSFUL_MITIGATION}>{END_STATE_TEXT[EndState.SUCCESSFUL_MITIGATION]}</option>
      </select>
    </FormRow>
  );
}

function InputFamilyDrawer({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: RiDrawerContext) => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const family = ri.inputs?.families.find((f) => f.id === id);
  if (family === undefined) return null;
  const dis = !editable;
  const manual = family.manual !== undefined;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<RiInputFamily>): void {
    if (!editable) return;
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, families: inputs.families.map((f) => (f.id === id ? { ...f, ...next } : f)) })));
  }
  function rename(value: string): void {
    if (!editable) return;
    const next = value.trim();
    if (next.length === 0 || next === id || (ri.inputs?.families ?? []).some((f) => f.id !== id && f.id.trim().toLowerCase() === next.toLowerCase())) return;
    mutateRi((d) => withFamilyRenamed(d, id, next));
    onRetarget({ kind: "inputFamily", id: next });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => withInputs(d, (inputs) => ({
      ...inputs,
      families: inputs.families.filter((f) => f.id !== id),
      sequences: inputs.sequences.map((s) => {
        if (s.familyId !== id) return s;
        const { familyId: _removed, ...rest } = s;
        return rest;
      }),
    })));
  }
  const states = ri.scopeDefinition.plantOperatingStateRefs;
  return (
    <>
      <DrawerHead cap="Event sequence family · RI-B1" title={family.name.trim().length > 0 ? `${family.id} · ${family.name}` : family.id} onClose={onClose} />
      <div className="modal__body ri-form">
        {manual && (
          <>
            <FormRow label="ID" htmlFor={fid("id")}>
              <WorkbookInput id={fid("id")} className="posfield__input" value={family.id} disabled={dis} onChange={(e) => rename(e.target.value)} />
            </FormRow>
            <FormRow label="Name" htmlFor={fid("name")} top>
              <WorkbookTextarea id={fid("name")} className="posfield__textarea" rows={2} fitContent value={family.name} disabled={dis} onChange={(e) => patch({ name: e.target.value })} />
            </FormRow>
            <FormRow label="Operating state" htmlFor={fid("state")}>
              <WorkbookInput id={fid("state")} className="posfield__input" list={fid("states")} value={family.plantOperatingStateId} disabled={dis} onChange={(e) => patch({ plantOperatingStateId: e.target.value })} />
              <datalist id={fid("states")}>{states.map((s) => <option key={s} value={s} />)}</datalist>
            </FormRow>
            <FormRow label="Initiating event" htmlFor={fid("initiator")}>
              <WorkbookInput id={fid("initiator")} className="posfield__input" value={family.initiatingEventId} disabled={dis} onChange={(e) => patch({ initiatingEventId: e.target.value })} />
            </FormRow>
            <EndStateRow value={family.endState} disabled={dis} onChange={(endState) => patch(endState === EndState.SUCCESSFUL_MITIGATION ? { endState, releaseCategoryIds: [] } : { endState })} />
            {family.endState === EndState.RADIONUCLIDE_RELEASE && (
              <FormRow label="Release category" htmlFor={fid("category")}>
                <WorkbookInput id={fid("category")} className="posfield__input" value={family.releaseCategoryIds.join(", ")} disabled={dis} onChange={(e) => patch({ releaseCategoryIds: e.target.value.split(",").map((c) => c.trim()).filter((c) => c.length > 0) })} />
              </FormRow>
            )}
          </>
        )}
        <FormRow label="Integration" htmlFor={fid("integration")}>
          <select
            id={fid("integration")}
            className="posfield__select"
            value={family.included ? "included" : "excluded"}
            disabled={dis}
            onChange={(e) => patch(e.target.value === "included" ? { included: true, exclusionReason: undefined } : { included: false, exclusionReason: family.exclusionReason ?? "" })}
          >
            <option value="included">Included</option>
            <option value="excluded">Excluded</option>
          </select>
        </FormRow>
        {!family.included && (
          <FormRow label="Reason for exclusion" htmlFor={fid("exclusion")} top>
            <WorkbookTextarea id={fid("exclusion")} className="posfield__textarea" rows={2} fitContent value={family.exclusionReason ?? ""} disabled={dis} onChange={(e) => patch({ exclusionReason: e.target.value })} />
          </FormRow>
        )}
        <FrequencyGrid stats={family.frequency} disabled={dis} onChange={(key, value) => patch({ frequency: withFrequencyStat(family.frequency, key, value) })} />
        {manual
          ? <SourceRow value={family.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />
          : <ReasonRow value={family.changeReason ?? ""} disabled={dis} onChange={(changeReason) => patch({ changeReason })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove family</button>}
        {editable && !manual && frequencyEdited(family) && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ frequency: family.imported === undefined ? undefined : { ...family.imported }, changeReason: undefined })}>Restore imported values</button>
        )}
      </FormFoot>
    </>
  );
}

function InputSequenceDrawer({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: RiDrawerContext) => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const sequence = ri.inputs?.sequences.find((s) => s.id === id);
  if (sequence === undefined) return null;
  const dis = !editable;
  const manual = sequence.manual !== undefined;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<RiInputSequence>): void {
    if (!editable) return;
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, sequences: inputs.sequences.map((s) => (s.id === id ? { ...s, ...next } : s)) })));
  }
  function rename(value: string): void {
    if (!editable) return;
    const next = value.trim();
    if (next.length === 0 || next === id || (ri.inputs?.sequences ?? []).some((s) => s.id !== id && s.id.trim().toLowerCase() === next.toLowerCase())) return;
    mutateRi((d) => withSequenceRenamed(d, id, next));
    onRetarget({ kind: "inputSequence", id: next });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => withInputs(d, (inputs) => ({
      ...inputs,
      sequences: inputs.sequences.filter((s) => s.id !== id),
      families: inputs.families.map((f) => (f.memberSequenceIds.includes(id) ? { ...f, memberSequenceIds: f.memberSequenceIds.filter((m) => m !== id) } : f)),
    })));
  }
  const failed = sequence.topEvents.filter((e) => e.state === "FAILURE").map((e) => e.event);
  return (
    <>
      <DrawerHead cap="Event sequence · RI-B5" title={sequence.id} sub={sequence.name} onClose={onClose} />
      <div className="modal__body ri-form">
        {manual && (
          <>
            <FormRow label="ID" htmlFor={fid("id")}>
              <WorkbookInput id={fid("id")} className="posfield__input" value={sequence.id} disabled={dis} onChange={(e) => rename(e.target.value)} />
            </FormRow>
            <FormRow label="Name" htmlFor={fid("name")} top>
              <WorkbookTextarea id={fid("name")} className="posfield__textarea" rows={2} fitContent value={sequence.name} disabled={dis} onChange={(e) => patch({ name: e.target.value })} />
            </FormRow>
            <FormRow label="Family" htmlFor={fid("family")}>
              <select id={fid("family")} className="posfield__select" value={sequence.familyId ?? ""} disabled={dis}
                onChange={(e) => { if (!editable) return; const value = e.target.value; mutateRi((d) => withSequenceFamily(d, id, value.length === 0 ? undefined : value)); }}>
                <option value="">No family</option>
                {(ri.inputs?.families ?? []).map((f) => <option key={f.id} value={f.id}>{f.id}</option>)}
              </select>
            </FormRow>
            <FormRow label="Operating state" htmlFor={fid("state")}>
              <WorkbookInput id={fid("state")} className="posfield__input" value={sequence.plantOperatingStateId} disabled={dis} onChange={(e) => patch({ plantOperatingStateId: e.target.value })} />
            </FormRow>
            <FormRow label="Initiating event" htmlFor={fid("initiator")}>
              <WorkbookInput id={fid("initiator")} className="posfield__input" value={sequence.initiatingEventId} disabled={dis} onChange={(e) => patch({ initiatingEventId: e.target.value })} />
            </FormRow>
            <EndStateRow
              value={sequence.endState}
              disabled={dis}
              onChange={(endState) => {
                if (endState === EndState.SUCCESSFUL_MITIGATION) {
                  if (!editable) return;
                  mutateRi((d) => withInputs(d, (inputs) => ({
                    ...inputs,
                    sequences: inputs.sequences.map((s) => {
                      if (s.id !== id) return s;
                      const { releaseCategoryId: _dropped, ...rest } = s;
                      return { ...rest, endState };
                    }),
                  })));
                } else {
                  patch({ endState });
                }
              }}
            />
            {sequence.endState === EndState.RADIONUCLIDE_RELEASE && (
              <FormRow label="Release category" htmlFor={fid("category")}>
                <WorkbookInput id={fid("category")} className="posfield__input" value={sequence.releaseCategoryId ?? ""} disabled={dis} onChange={(e) => patch({ releaseCategoryId: e.target.value.trim() })} />
              </FormRow>
            )}
            <FormRow label="Failed functions" htmlFor={fid("failed")} top>
              <WorkbookTextarea id={fid("failed")} className="posfield__textarea" rows={2} fitContent value={failed.join("\n")} disabled={dis}
                onChange={(e) => patch({ topEvents: linesOf(e.target.value).map((event) => ({ event, state: "FAILURE" as const })) })} />
            </FormRow>
            <FormRow label="Reactors or sources" htmlFor={fid("sources")} top>
              <WorkbookTextarea id={fid("sources")} className="posfield__textarea" rows={2} fitContent value={sequence.reactorSourceCombinations.join("\n")} disabled={dis}
                onChange={(e) => patch({ reactorSourceCombinations: linesOf(e.target.value) })} />
            </FormRow>
          </>
        )}
        <FrequencyGrid stats={sequence.frequency} disabled={dis} onChange={(key, value) => patch({ frequency: withFrequencyStat(sequence.frequency, key, value) })} />
        {manual
          ? <SourceRow value={sequence.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />
          : <ReasonRow value={sequence.changeReason ?? ""} disabled={dis} onChange={(changeReason) => patch({ changeReason })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove sequence</button>}
        {editable && !manual && frequencyEdited(sequence) && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ frequency: sequence.imported === undefined ? undefined : { ...sequence.imported }, changeReason: undefined })}>Restore imported values</button>
        )}
      </FormFoot>
    </>
  );
}

function withPercentile(stats: RiConsequenceStats, percentile: number, value: number | undefined): RiConsequenceStats {
  const others = stats.percentiles.filter((p) => p.percentile !== percentile);
  const percentiles = value === undefined ? others : [...others, { percentile, value }].sort((a, b) => a.percentile - b.percentile);
  return { ...stats, percentiles };
}

function withChanceAbove100Mrem(stats: RiConsequenceStats, unit: string, value: number | undefined): RiConsequenceStats {
  const factor = remPerUnit(unit);
  if (factor === undefined) return stats;
  const threshold = Number(((DOSE_100_MREM_SV * 100) / factor).toPrecision(12));
  const others = stats.exceedances.filter((x) => Math.abs(x.threshold * factor - DOSE_100_MREM_SV * 100) > 1e-9);
  return { ...stats, exceedances: value === undefined ? others : [...others, { threshold, probability: value }] };
}

function InputConsequenceDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const item = ri.inputs?.consequences.find((c) => consequenceKey(c) === id);
  if (item === undefined) return null;
  const dis = !editable;
  const stats = item.statistics;
  const manual = item.manual !== undefined;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const measures = ri.scopeDefinition.consequenceMeasures;
  const categories = [...new Set((ri.inputs?.families ?? []).flatMap((f) => f.releaseCategoryIds))];
  function patch(next: Partial<RiInputConsequence>): void {
    if (!editable) return;
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, consequences: inputs.consequences.map((c) => (consequenceKey(c) === id ? { ...c, ...next } : c)) })));
  }
  function setStatistics(next: RiConsequenceStats): void {
    patch({ statistics: next });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, consequences: inputs.consequences.filter((c) => consequenceKey(c) !== id) })));
  }
  const meanCell: StatCell = {
    key: "mean",
    label: "Mean",
    value: stats.mean,
    disabled: dis,
    onChange: (value) => setStatistics(value === undefined ? { percentiles: stats.percentiles, exceedances: stats.exceedances } : { ...stats, mean: value }),
  };
  const dose = remPerUnit(item.unit) !== undefined;
  return (
    <>
      <DrawerHead cap="Consequence result · RI-B1" title={`${item.releaseCategoryId.trim().length > 0 ? item.releaseCategoryId : "No category"} · ${item.measure}`} onClose={onClose} />
      <div className="modal__body ri-form">
        {manual && (
          <>
            <FormRow label="Release category" htmlFor={fid("category")}>
              <WorkbookInput id={fid("category")} className="posfield__input" list={fid("categories")} value={item.releaseCategoryId} disabled={dis} onChange={(e) => patch({ releaseCategoryId: e.target.value.trim() })} />
              <datalist id={fid("categories")}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </FormRow>
            <FormRow label="Measure" htmlFor={fid("measure")}>
              <select id={fid("measure")} className="posfield__select" value={item.measure} disabled={dis}
                onChange={(e) => { const measure = measures.find((m) => m.name === e.target.value); if (measure !== undefined) patch({ measure: measure.name, unit: doseUnitOf(measure) }); }}>
                {measures.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </FormRow>
            {dose && (
              <FormRow label="Unit" htmlFor={fid("unit")}>
                <select id={fid("unit")} className="posfield__select" value={item.unit} disabled={dis} onChange={(e) => patch({ unit: e.target.value })}>
                  {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </FormRow>
            )}
          </>
        )}
        <StatGridRow
          label="Result"
          unit={item.unit}
          cells={manual
            ? [
              meanCell,
              ...[5, 50, 95].map((percentile): StatCell => ({ key: `p${percentile}`, label: rcOrdinal(percentile), value: percentileOf(stats, percentile), disabled: dis, onChange: (value) => setStatistics(withPercentile(stats, percentile, value)) })),
            ]
            : [
              meanCell,
              ...stats.percentiles.map((p): StatCell => ({
                key: `p${p.percentile}`,
                label: rcOrdinal(p.percentile),
                value: p.value,
                disabled: dis,
                onChange: (value) => {
                  if (value === undefined) return;
                  setStatistics({ ...stats, percentiles: stats.percentiles.map((x) => (x.percentile === p.percentile ? { percentile: x.percentile, value } : x)) });
                },
              })),
            ]}
        />
        {manual && dose ? (
          <StatGridRow
            label="Chance above"
            unit=""
            cells={[{ key: "x100", label: "100 mrem", value: chanceAbove100Mrem(item), disabled: dis, onChange: (value) => setStatistics(withChanceAbove100Mrem(stats, item.unit, value)) }]}
          />
        ) : stats.exceedances.length > 0 && (
          <StatGridRow
            label="Chance above"
            unit=""
            cells={stats.exceedances.map((x): StatCell => ({
              key: `x${x.threshold}`,
              label: thresholdText(x.threshold, item.unit),
              value: x.probability,
              disabled: dis,
              onChange: (value) => {
                if (value === undefined) return;
                setStatistics({ ...stats, exceedances: stats.exceedances.map((y) => (y.threshold === x.threshold ? { threshold: y.threshold, probability: value } : y)) });
              },
            }))}
          />
        )}
        {manual
          ? <SourceRow value={item.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />
          : <ReasonRow value={item.changeReason ?? ""} disabled={dis} onChange={(changeReason) => patch({ changeReason })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove result</button>}
        {editable && !manual && consequenceEdited(item) && item.imported !== undefined && (
          <button
            type="button"
            className="posnav__btn posnav__btn--sm"
            onClick={() => {
              const imported = item.imported;
              if (imported === undefined) return;
              patch({
                statistics: {
                  ...(imported.mean === undefined ? {} : { mean: imported.mean }),
                  percentiles: imported.percentiles.map((p) => ({ percentile: p.percentile, value: p.value })),
                  exceedances: imported.exceedances.map((x) => ({ threshold: x.threshold, probability: x.probability })),
                },
                changeReason: undefined,
              });
            }}
          >
            Restore imported values
          </button>
        )}
      </FormFoot>
    </>
  );
}

function InputContributorDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const item = (ri.inputs?.contributors ?? []).find((c) => c.manual !== undefined && c.quantificationId === id);
  if (item === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<RiInputContributor>): void {
    if (!editable) return;
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, contributors: (inputs.contributors ?? []).map((c) => (c.manual !== undefined && c.quantificationId === id ? { ...c, ...next } : c)) })));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, contributors: (inputs.contributors ?? []).filter((c) => !(c.manual !== undefined && c.quantificationId === id)) })));
  }
  return (
    <>
      <DrawerHead cap="Contributor · RI-B6" title={item.name.trim().length > 0 ? item.name : "Unnamed contributor"} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Name" htmlFor={fid("name")}>
          <WorkbookInput id={fid("name")} className="posfield__input" value={item.name} disabled={dis} onChange={(e) => patch({ name: e.target.value })} />
        </FormRow>
        <FormRow label="Type" htmlFor={fid("type")}>
          <select id={fid("type")} className="posfield__select" value={item.type} disabled={dis} onChange={(e) => patch({ type: e.target.value })}>
            {Object.entries(CONTRIBUTOR_TYPE_SINGULAR).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Family" htmlFor={fid("family")}>
          <select id={fid("family")} className="posfield__select" value={item.familyId} disabled={dis} onChange={(e) => patch({ familyId: e.target.value })}>
            {(ri.inputs?.families ?? []).map((f) => <option key={f.id} value={f.id}>{f.id}</option>)}
          </select>
        </FormRow>
        <StatGridRow
          label="Share of the family"
          unit="fraction of its frequency"
          cells={[{ key: "fraction", label: "Share", value: item.fraction, disabled: dis, onChange: (value) => patch({ fraction: value ?? 0 }) }]}
        />
        <SourceRow value={item.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove contributor</button>}
      </FormFoot>
    </>
  );
}

function InputImportanceDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const item = (ri.inputs?.importance ?? []).find((m) => m.manual !== undefined && m.analysisId === id);
  if (item === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function replace(next: RiInputImportance): void {
    if (!editable) return;
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, importance: (inputs.importance ?? []).map((m) => (m.manual !== undefined && m.analysisId === id ? next : m)) })));
  }
  function patch(next: Partial<RiInputImportance>): void {
    if (item === undefined) return;
    replace({ ...item, ...next });
  }
  function setMeasure(key: "fussellVesely" | "riskAchievementWorth" | "riskReductionWorth" | "birnbaum", value: number | undefined): void {
    if (item === undefined) return;
    const next: RiInputImportance = { ...item };
    if (value === undefined) delete next[key];
    else next[key] = value;
    replace(next);
  }
  function setScope(scope: string): void {
    if (item === undefined) return;
    if (scope === "PER_FAMILY") {
      replace({ ...item, scope: "PER_FAMILY", familyRef: item.familyRef ?? ri.inputs?.families[0]?.id ?? "" });
      return;
    }
    const { familyRef: _family, ...rest } = item;
    replace({ ...rest, scope: "OVERALL" });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => withInputs(d, (inputs) => ({ ...inputs, importance: (inputs.importance ?? []).filter((m) => !(m.manual !== undefined && m.analysisId === id)) })));
  }
  return (
    <>
      <DrawerHead cap="Importance measure · RI-B6" title={item.entity.trim().length > 0 ? item.entity : "Unnamed entity"} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Entity" htmlFor={fid("entity")}>
          <WorkbookInput id={fid("entity")} className="posfield__input" value={item.entity} disabled={dis} onChange={(e) => patch({ entity: e.target.value })} />
        </FormRow>
        <FormRow label="Type" htmlFor={fid("type")}>
          <select id={fid("type")} className="posfield__select" value={item.entityType} disabled={dis} onChange={(e) => patch({ entityType: e.target.value })}>
            {Object.entries(IMPORTANCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Scope" htmlFor={fid("scope")}>
          <select id={fid("scope")} className="posfield__select" value={item.scope === "PER_FAMILY" ? "PER_FAMILY" : "OVERALL"} disabled={dis} onChange={(e) => setScope(e.target.value)}>
            <option value="OVERALL">Overall</option>
            <option value="PER_FAMILY">One family</option>
          </select>
        </FormRow>
        {item.scope === "PER_FAMILY" && (
          <FormRow label="Family" htmlFor={fid("family")}>
            <select id={fid("family")} className="posfield__select" value={item.familyRef ?? ""} disabled={dis} onChange={(e) => patch({ familyRef: e.target.value })}>
              {(ri.inputs?.families ?? []).map((f) => <option key={f.id} value={f.id}>{f.id}</option>)}
            </select>
          </FormRow>
        )}
        <StatGridRow
          label="Measures"
          unit=""
          cells={[
            { key: "fv", label: "Fussell-Vesely", value: item.fussellVesely, disabled: dis, onChange: (value) => setMeasure("fussellVesely", value) },
            { key: "raw", label: "RAW", value: item.riskAchievementWorth, disabled: dis, onChange: (value) => setMeasure("riskAchievementWorth", value) },
            { key: "rrw", label: "RRW", value: item.riskReductionWorth, disabled: dis, onChange: (value) => setMeasure("riskReductionWorth", value) },
            { key: "birnbaum", label: "Birnbaum", value: item.birnbaum, disabled: dis, onChange: (value) => setMeasure("birnbaum", value) },
          ]}
        />
        <SourceRow value={item.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove measure</button>}
      </FormFoot>
    </>
  );
}

function InputGapDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const inputs = ri.inputs;
  if (inputs === undefined) return null;
  const reason = inputs.unavailable?.find((u) => u.measure === id)?.reason ?? "";
  const families = measuresWithoutResults(ri).find((g) => g.measure === id)?.families ?? [];
  return (
    <>
      <DrawerHead cap="Measure without results · RI-B1" title={id} sub={`${families.length} release ${families.length === 1 ? "family has" : "families have"} no result.`} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Why they are not available" htmlFor={fieldId} top>
          <WorkbookTextarea
            id={fieldId}
            className="posfield__textarea"
            rows={2}
            fitContent
            value={reason}
            disabled={!editable}
            onChange={(e) => {
              if (!editable) return;
              const text = e.target.value;
              mutateRi((d) => withUnavailableReason(d, id, text));
            }}
          />
        </FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

type CategoriesTab = "categories" | "dbe" | "below";

const CATEGORY_TAB_HEADS: Record<CategoriesTab, { title: string; sr: string }> = {
  categories: { title: "Event categories", sr: "RI-A3 · B2" },
  dbe: { title: "Families evaluated in the DBE range", sr: "RI-A3 · B2" },
  below: { title: "Families below the BDBE floor", sr: "RI-A3 · B2" },
};

const CATEGORY_ORDER: RiCategory[] = ["AOO", "DBE", "BDBE"];

interface CategoryLabels {
  central: string;
  lower: string;
  upper: string;
  floor: string;
  dose: string;
}

function categoryLabels(a: RiResolvedAbsoluteCriteria): CategoryLabels {
  return {
    central: RI_STATISTIC_SHORT[a.categoryStatistic.value],
    lower: RI_STATISTIC_SHORT[a.bandLowerStatistic.value],
    upper: RI_STATISTIC_SHORT[a.bandUpperStatistic.value],
    floor: RI_STATISTIC_SHORT[a.bdbeFloorStatistic.value],
    dose: RI_STATISTIC_SHORT[a.highConsequenceStatistic.value],
  };
}

function countText(n: number, one: string, many: string): string {
  return `${n === 0 ? "no" : n} ${n === 1 ? one : many}`;
}

function categorySummary(views: RiFamilyCategory[], labels: CategoryLabels): string {
  const count = (category: RiCategory): number => views.filter((v) => v.category === category).length;
  const below = views.filter((v) => v.below).length;
  const sentences = [
    `By the ${labels.central.toLowerCase()}: ${countText(count("AOO"), "AOO", "AOOs")}, ${countText(count("DBE"), "DBE", "DBEs")}, ${countText(count("BDBE"), "BDBE", "BDBEs")} and ${countText(below, "family", "families")} below the BDBE floor.`,
  ];
  const byFloor = views.filter((v) => v.byFloorRule).length;
  if (byFloor > 0) sentences.push(`${byFloor} of the BDBEs ${byFloor === 1 ? "is" : "are"} placed by the ${labels.floor}, not the ${labels.central.toLowerCase()}.`);
  const added = CATEGORY_ORDER.map((category) => ({ category, n: views.filter((v) => v.also.includes(category)).length })).filter((x) => x.n > 0);
  sentences.push(added.length === 0
    ? "No band crosses a category bound."
    : `Also evaluated because of the band: ${added.map((x) => `${x.n} as ${x.category}`).join(", ")}.`);
  const noBand = views.filter((v) => (v.category !== undefined || v.below) && !v.bandChecked).length;
  if (noBand > 0) sentences.push(`${noBand} ${noBand === 1 ? "family has" : "families have"} no ${labels.lower} to ${labels.upper} band.`);
  const high = views.filter((v) => v.highConsequence === true).length;
  sentences.push(high === 0 ? "No high-consequence BDBE." : `${countText(high, "high-consequence BDBE", "high-consequence BDBEs")}.`);
  const unknown = views.filter((v) => (v.category === "BDBE" || v.also.includes("BDBE")) && v.highConsequence === undefined).length;
  if (unknown > 0) sentences.push(`${unknown} ${unknown === 1 ? "BDBE has" : "BDBEs have"} no EAB dose to test.`);
  return sentences.join(" ");
}

function doseText(dose: RiFamilyDose): string {
  switch (dose.state) {
    case "no-release": return "No release";
    case "no-measure": return "No dose measure";
    case "not-reported": return "Not reported";
    case "value": return dose.rem === undefined ? "—" : sciText(dose.rem);
  }
}

function alsoText(view: RiFamilyCategory): string {
  if (view.category === undefined && !view.below) return "—";
  if (!view.bandChecked) return "No band";
  return view.also.length === 0 ? "—" : view.also.join(", ");
}

function highConsequenceText(view: RiFamilyCategory): string {
  if (view.category !== "BDBE" && !view.also.includes("BDBE")) return "—";
  if (view.highConsequence === undefined) return "Unknown";
  return view.highConsequence ? "Yes" : "No";
}

function CategoriesTable({ views, labels, openDrawer }: { views: RiFamilyCategory[]; labels: CategoryLabels; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  return (
    <>
      <p className="ri-step__note">{categorySummary(views, labels)}</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Event categories">
          <thead>
            <tr>
              <th>Family</th><th>Name</th><th>{labels.central}</th><th>{labels.lower}</th><th>{labels.upper}</th>
              <th>Category</th><th>Also evaluated as</th><th>EAB dose, {labels.dose.toLowerCase()} (rem)</th><th>High consequence</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => (
              <tr key={v.family.id}>
                <td><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputFamily", id: v.family.id })}>{v.family.id}</button></td>
                <td className="ri-rowtable__wrap">{v.family.name}</td>
                <td>{statText(v.central)}</td>
                <td>{statText(v.lower)}</td>
                <td>{statText(v.upper)}</td>
                <td>
                  {v.category ?? (v.below ? "Below range" : "No frequency")}
                  {v.byFloorRule && <span className="ri-rowtable__tag">by the {labels.floor}</span>}
                  {v.below && !v.floorChecked && <span className="ri-rowtable__tag">no {labels.floor}</span>}
                </td>
                <td title={v.bandChecked ? undefined : `No ${labels.lower} or ${labels.upper} value, so band crossings are not checked.`}>{alsoText(v)}</td>
                <td>{doseText(v.dose)}</td>
                <td>{highConsequenceText(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function rangeReason(view: RiFamilyCategory, labels: CategoryLabels, a: RiResolvedAbsoluteCriteria): string {
  if (view.category === "DBE") return `${labels.central} in the DBE range`;
  if (view.category === "AOO") return `${labels.lower} below ${sciText(a.aooLowerPerPlantYear.value)}`;
  return `${labels.upper} above ${sciText(a.dbeLowerPerPlantYear.value)}`;
}

function DbeRangeTable({ views, labels, criteria, openDrawer }: {
  views: RiFamilyCategory[];
  labels: CategoryLabels;
  criteria: RiResolvedAbsoluteCriteria;
  openDrawer: (ctx: RiDrawerContext) => void;
}): JSX.Element {
  const { ri } = useRiWorkbook();
  if (views.length === 0) return <p className="posmuted">No family is evaluated in the DBE range.</p>;
  return (
    <>
      <p className="ri-step__note">Each family here is evaluated as a DBE, so a design basis accident must cover it (NEI 18-04 Task 6, NEI 21-07 Appendix A).</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Families evaluated in the DBE range">
          <thead>
            <tr>
              <th>Family</th><th>Name</th><th>Category</th><th>In the DBE range because</th>
              <th>{labels.central}</th><th>{labels.lower}</th><th>{labels.upper}</th><th>EAB dose, mean (rem)</th><th>EAB dose, 95th (rem)</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => (
              <tr key={v.family.id}>
                <td><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputFamily", id: v.family.id })}>{v.family.id}</button></td>
                <td className="ri-rowtable__wrap">{v.family.name}</td>
                <td>{v.category ?? "—"}</td>
                <td>{rangeReason(v, labels, criteria)}</td>
                <td>{statText(v.central)}</td>
                <td>{statText(v.lower)}</td>
                <td>{statText(v.upper)}</td>
                <td>{doseText(familyDose(ri, v.family, "MEAN"))}</td>
                <td>{doseText(familyDose(ri, v.family, "P95"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BelowRangeTable({ views, labels, openDrawer }: { views: RiFamilyCategory[]; labels: CategoryLabels; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  if (views.length === 0) return <p className="posmuted">No family falls below the BDBE floor.</p>;
  return (
    <>
      <p className="ri-step__note">NEI 18-04 keeps these families in the PRA results to confirm there are no cliff-edge effects (Task 4). Record a result and a basis for each.</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Families below the BDBE floor">
          <thead>
            <tr>
              <th>Family</th><th>Name</th><th>{labels.central}</th><th>{labels.floor}</th>
              <th>EAB dose, mean (rem)</th><th>EAB dose, 95th (rem)</th><th>Cliff-edge check</th><th>Basis</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => {
              const check = cliffEdgeCheckOf(ri, v.family.id);
              const status = CLIFF_EDGE_STATUSES.find((s) => s.id === check?.status)?.label ?? "Not reviewed";
              return (
                <tr key={v.family.id}>
                  <td><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "cliffEdge", id: v.family.id })}>{v.family.id}</button></td>
                  <td className="ri-rowtable__wrap">{v.family.name}</td>
                  <td>{statText(v.central)}</td>
                  <td>{statText(v.floor)}</td>
                  <td>{doseText(familyDose(ri, v.family, "MEAN"))}</td>
                  <td>{doseText(familyDose(ri, v.family, "P95"))}</td>
                  <td>{status}</td>
                  <td className="ri-rowtable__wrap">{check === undefined || check.basis.trim().length === 0 ? "—" : check.basis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CategoriesScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const [tab, setTab] = useState<CategoriesTab>("categories");
  const tabId = useId();
  const criteria = criteriaSetOf(ri).absolute;
  const labels = categoryLabels(criteria);
  const views = familyCategories(ri);
  const inRange = views.filter(inDbeRange);
  const below = views.filter((v) => v.below);
  const imported = ri.inputs !== undefined;
  const count = (n: number): string => (imported ? ` (${n})` : "");
  const tabs: { id: CategoriesTab; label: string }[] = [
    { id: "categories", label: `Categories${count(views.length)}` },
    { id: "dbe", label: `DBE range${count(inRange.length)}` },
    { id: "below", label: `Below range${count(below.length)}` },
  ];
  const head = CATEGORY_TAB_HEADS[tab];

  return (
    <div className="ri-step">
      <RiTabs label="Event category sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="RI" title={head.title} level={3} />
            <RiProvenanceChip>{head.sr}</RiProvenanceChip>
          </div>
          {!imported ? (
            <p className="posmuted">Nothing is imported yet. Import the families in Step 02 first.</p>
          ) : tab === "categories" ? (
            <CategoriesTable views={views} labels={labels} openDrawer={openDrawer} />
          ) : tab === "dbe" ? (
            <DbeRangeTable views={inRange} labels={labels} criteria={criteria} openDrawer={openDrawer} />
          ) : (
            <BelowRangeTable views={below} labels={labels} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

function CliffEdgeDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const family = ri.inputs?.families.find((f) => f.id === id);
  if (family === undefined) return null;
  const check = cliffEdgeCheckOf(ri, id);
  const dis = !editable;
  return (
    <>
      <DrawerHead cap="Cliff-edge check · NEI 18-04 Task 4" title={`${family.id} · ${family.name}`} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Result" htmlFor={`${fieldId}-result`}>
          <select
            id={`${fieldId}-result`}
            className="posfield__select"
            value={check?.status ?? ""}
            disabled={dis}
            onChange={(e) => {
              if (!editable) return;
              const status = CLIFF_EDGE_STATUSES.find((s) => s.id === e.target.value)?.id;
              mutateRi((d) => withCliffEdgeStatus(d, id, status));
            }}
          >
            <option value="">Not reviewed</option>
            {CLIFF_EDGE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Basis" htmlFor={`${fieldId}-basis`} top>
          <WorkbookTextarea
            id={`${fieldId}-basis`}
            className="posfield__textarea"
            rows={3}
            fitContent
            value={check?.basis ?? ""}
            disabled={dis}
            onChange={(e) => {
              if (!editable) return;
              const basis = e.target.value;
              mutateRi((d) => withCliffEdgeBasis(d, id, basis));
            }}
          />
        </FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

type FcTab = "chart" | "evaluation" | "margins";

const FC_TAB_HEADS: Record<FcTab, { title: string; sr: string }> = {
  chart: { title: "Frequency-consequence chart", sr: "RI-B2" },
  evaluation: { title: "Target and risk significance", sr: "RI-A3 · B2" },
  margins: { title: "Margins to the target", sr: "RI-B2" },
};

function polylineFrom(line: FcPoint[], dose: number): FcPoint[] {
  const out: FcPoint[] = [];
  line.forEach((p, i) => {
    if (p.dose < dose) return;
    const prev = line[i - 1];
    if (out.length === 0 && prev !== undefined && prev.dose < dose && p.dose > prev.dose) {
      const t = (log10(dose) - log10(prev.dose)) / (log10(p.dose) - log10(prev.dose));
      out.push({ dose, freq: Math.pow(10, log10(prev.freq) + t * (log10(p.freq) - log10(prev.freq))) });
    }
    out.push(p);
  });
  return out;
}

interface FcPlotPoint {
  id: string;
  x: number;
  y: number;
  row: RiFcFamily;
}

function FcChart({ criteria, rows }: { criteria: RiResolvedAbsoluteCriteria; rows: RiFcFamily[] }): JSX.Element {
  const baseId = useId().split(":").join("");
  const clipId = `ri-fcc-clip-${baseId}`;
  const hatchId = `ri-fcc-hatch-${baseId}`;
  const anchors = targetAnchors(criteria);
  const share = criteria.lbeTargetPercent.value / 100;
  const floorRem = criteria.lbeDoseFloorMrem.value / 1000;
  const bands = [
    { label: "AOO", lower: criteria.aooLowerPerPlantYear.value },
    { label: "DBE", lower: criteria.dbeLowerPerPlantYear.value },
    { label: "BDBE", lower: criteria.bdbeLowerPerPlantYear.value },
  ].filter((b) => b.lower > 0);
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (first === undefined || last === undefined || anchors.length < 2) {
    return <p className="posmuted">Set at least two target anchors in Step 01 to draw the chart.</p>;
  }

  const doses = rows.flatMap((r) => [r.doseLow, r.doseMean, r.doseHigh]).filter((v): v is number => v !== undefined && v > 0);
  const freqs = rows.flatMap((r) => [r.freqLow, r.freqMean, r.freqHigh]).filter((v): v is number => v !== undefined && v > 0);
  const W = 720;
  const H = 480;
  const x0 = 64;
  const x1 = 704;
  const yTop = 14;
  const yBot = 426;
  const xLoExp = Math.floor(log10(Math.min(first.doseRem, floorRem > 0 ? floorRem : first.doseRem, ...doses)));
  const xHiExp = Math.max(Math.ceil(log10(last.doseRem)) + 1, ...doses.map((d) => Math.ceil(log10(d))));
  const yHiExp = Math.max(Math.ceil(log10(first.frequencyPerPlantYear)) + 1, ...freqs.map((f) => Math.ceil(log10(f))));
  const yLoExp = Math.floor(log10(Math.min(last.frequencyPerPlantYear, ...bands.map((b) => b.lower), ...freqs)));
  const xMin = Math.pow(10, xLoExp);
  const xMax = Math.pow(10, xHiExp);
  const yMin = Math.pow(10, yLoExp);
  const yMax = Math.pow(10, yHiExp);
  const mx = (d: number): number => scaleLog(d, xMin, xMax, x0, x1);
  const my = (f: number): number => scaleLog(f, yMin, yMax, yBot, yTop);

  const isoRisk = first.frequencyPerPlantYear * first.doseRem;
  const headDose = isoRisk / yMax;
  const anchorLine: FcPoint[] = [...anchors.map((p) => ({ dose: p.doseRem, freq: p.frequencyPerPlantYear })), { dose: xMax, freq: last.frequencyPerPlantYear }];
  const head: FcPoint = headDose >= xMin ? { dose: headDose, freq: yMax } : { dose: xMin, freq: isoRisk / xMin };
  const target: FcPoint[] = [head, ...anchorLine];
  const lowered = target.map((p) => ({ dose: p.dose, freq: p.freq * share }));
  const zoneStart = floorRem > 0 ? floorRem : xMin;
  const zoneUpper = zoneStart < first.doseRem ? [{ dose: zoneStart, freq: isoRisk / zoneStart }, ...anchorLine] : polylineFrom(anchorLine, zoneStart);
  const zone = [...zoneUpper, ...zoneUpper.map((p) => ({ dose: p.dose, freq: p.freq * share })).reverse()];
  const points = (list: FcPoint[]): string => list.map((p) => `${mx(p.dose)},${my(p.freq)}`).join(" ");
  const xTicks: number[] = [];
  for (let e = xLoExp; e <= xHiExp; e += 1) xTicks.push(e);
  const yTicks: number[] = [];
  for (let e = yLoExp; e <= yHiExp; e += 1) yTicks.push(e);
  const labelX = Math.max(x0 + 6, (floorRem > 0 ? mx(floorRem) : x0) + 6);
  const boundLines = bands.map((b) => ({
    label: b.label,
    y: my(b.lower),
    xEnd: mx(Math.min(xMax, Math.max(xMin, doseOnTarget(target, b.lower, xMax)))),
  }));
  const extraTicks = bands.map((b) => b.lower).filter((v) => {
    const e = log10(v);
    if (Math.abs(e - Math.round(e)) < 1e-9) return false;
    return Math.abs(my(v) - my(Math.pow(10, Math.floor(e)))) >= 11 && Math.abs(my(v) - my(Math.pow(10, Math.ceil(e)))) >= 11;
  });

  const plotPoints: FcPlotPoint[] = [];
  for (const row of rows) {
    if (row.freqMean === undefined || row.doseMean === undefined) continue;
    plotPoints.push({ id: row.view.family.id, x: row.doseMean > 0 ? mx(row.doseMean) : x0, y: my(row.freqMean), row });
  }
  const obstacles: LabelBox[] = [];
  for (let i = 0; i + 1 < target.length; i += 1) {
    const a = target[i];
    const b = target[i + 1];
    for (let k = 0; k <= 24; k += 1) {
      const t = k / 24;
      const sx = mx(a.dose) + (mx(b.dose) - mx(a.dose)) * t;
      const sy = my(a.freq) + (my(b.freq) - my(a.freq)) * t;
      obstacles.push({ x1: sx - 3, y1: sy - 3, x2: sx + 3, y2: sy + 3 });
    }
  }
  for (const p of plotPoints) {
    const r = p.row;
    obstacles.push({ x1: p.x - 6, y1: p.y - 6, x2: p.x + 6, y2: p.y + 6 });
    if (r.freqLow !== undefined && r.freqHigh !== undefined) obstacles.push({ x1: p.x - 5, y1: my(r.freqHigh), x2: p.x + 5, y2: my(r.freqLow) });
    if (r.doseLow !== undefined && r.doseHigh !== undefined && r.doseLow > 0 && r.doseHigh > 0) obstacles.push({ x1: mx(r.doseLow), y1: p.y - 5, x2: mx(r.doseHigh), y2: p.y + 5 });
  }
  const labelRank = (p: FcPlotPoint): number => (p.row.significant === true ? 0 : p.row.release ? 1 : 2);
  const labels = placeLabels(
    [...plotPoints].sort((a, b) => labelRank(a) - labelRank(b)).map((p) => ({ id: p.id, text: p.id, cx: p.x, cy: p.y, optional: p.row.significant !== true })),
    obstacles,
    { left: x0 + 3, right: x1 - 3, top: yTop + 2, bottom: yBot - 3 },
  );
  const unlabeled = plotPoints.length - labels.length;

  return (
    <>
      <div className="rifc__legend rifc__legend--top">
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--target" />F-C target</div>
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--share" />{criteria.lbeTargetPercent.value}% of the target</div>
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--floor" />{criteria.lbeDoseFloorMrem.value} mrem dose floor</div>
        <div className="rifc__legend-item"><span className="rifc__legend-line rifc__legend-line--band" />Category bounds</div>
        <div className="rifc__legend-item"><span className="rifc__legend-zone" />Risk-significant zone</div>
        <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--family" />Family, mean with 5th to 95th bars</div>
        <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--significant" />Risk-significant family</div>
      </div>
      <div className="rifc__center">
        <div className="rifc__plot rifc__plot--wide">
          <svg className="rifc__svg rifc__svg--wide" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Frequency-consequence chart">
            <defs>
              <clipPath id={clipId}><rect x={x0} y={yTop} width={x1 - x0} height={yBot - yTop} /></clipPath>
              <pattern id={hatchId} width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line className="rifc__hatch" x1={0} y1={0} x2={0} y2={7} />
              </pattern>
            </defs>
            {xTicks.map((p) => (<line key={`gx${p}`} className="rifc__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
            {yTicks.map((p) => (<line key={`gy${p}`} className="rifc__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
            {boundLines.map((b) => (<line key={`band${b.label}`} className="rifc__fc-band" x1={x0} y1={b.y} x2={b.xEnd} y2={b.y} />))}
            {boundLines.map((b) => (<text key={`bandlab${b.label}`} className="rifc__fc-bandlab" x={labelX} y={b.y - 5}>{b.label}</text>))}
            <g clipPath={`url(#${clipId})`}>
              <polygon className="rifc__zone" points={points(zone)} fill={`url(#${hatchId})`} />
              <polyline className="rifc__fc-share" points={points(lowered)} />
              <polyline className="rifc__fc-target" points={points(target)} />
              {floorRem > 0 && <line className="rifc__fc-floor" x1={mx(floorRem)} y1={yTop} x2={mx(floorRem)} y2={yBot} />}
            </g>
            <line className="rifc__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
            <line className="rifc__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
            {xTicks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
            {yTicks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
            {extraTicks.map((v) => (<text key={`tyx${v}`} className="rifc__lab" x={x0 - 6} y={my(v) + 3} textAnchor="end">{sciText(v)}</text>))}
            <text className="rifc__axlab" x={(x0 + x1) / 2} y={H - 8} textAnchor="middle">30-day TEDE at the EAB (rem)</text>
            <text className="rifc__axlab" x={-((yTop + yBot) / 2)} y={14} textAnchor="middle" transform="rotate(-90 0 0)">Frequency (per plant-year)</text>
            {plotPoints.map((p) => {
              const r = p.row;
              const tone = r.significant === true ? " rifc__bar--significant" : "";
              const hasFreqBar = r.freqLow !== undefined && r.freqHigh !== undefined;
              const hasDoseBar = r.doseLow !== undefined && r.doseHigh !== undefined && r.doseLow > 0 && r.doseHigh > 0;
              return (
                <g key={p.id}>
                  {hasFreqBar && r.freqLow !== undefined && r.freqHigh !== undefined && (
                    <>
                      <line className={`rifc__bar${tone}`} x1={p.x} y1={my(r.freqLow)} x2={p.x} y2={my(r.freqHigh)} />
                      <line className={`rifc__bar${tone}`} x1={p.x - 4} y1={my(r.freqLow)} x2={p.x + 4} y2={my(r.freqLow)} />
                      <line className={`rifc__bar${tone}`} x1={p.x - 4} y1={my(r.freqHigh)} x2={p.x + 4} y2={my(r.freqHigh)} />
                    </>
                  )}
                  {hasDoseBar && r.doseLow !== undefined && r.doseHigh !== undefined && (
                    <>
                      <line className={`rifc__bar${tone}`} x1={mx(r.doseLow)} y1={p.y} x2={mx(r.doseHigh)} y2={p.y} />
                      <line className={`rifc__bar${tone}`} x1={mx(r.doseLow)} y1={p.y - 4} x2={mx(r.doseLow)} y2={p.y + 4} />
                      <line className={`rifc__bar${tone}`} x1={mx(r.doseHigh)} y1={p.y - 4} x2={mx(r.doseHigh)} y2={p.y + 4} />
                    </>
                  )}
                  <circle className={`rifc__family${r.significant === true ? " rifc__family--significant" : ""}`} cx={p.x} cy={p.y} r={4.5}>
                    <title>{`${p.id}: ${sciText(r.freqMean ?? 0)} per plant-year, ${r.release ? `${sciText(r.doseMean ?? 0)} rem` : "no release"}`}</title>
                  </circle>
                </g>
              );
            })}
            {labels.map((l) => l.leader === undefined ? null : (<line key={`lead${l.id}`} className="rifc__leader" x1={l.leader.x} y1={l.leader.y} x2={l.x} y2={l.y - 4} />))}
            {labels.map((l) => (<text key={`lab${l.id}`} className="rifc__famlab" x={l.x} y={l.y} textAnchor={l.anchor}>{l.text}</text>))}
          </svg>
        </div>
      </div>
      {unlabeled > 0 && <p className="ri-inputs__meta">{unlabeled} of {plotPoints.length} names do not fit on the chart. Hover a point for its name, or see the Evaluation tab.</p>}
    </>
  );
}

function marginText(value: number | undefined): string {
  if (value === undefined) return "—";
  if (!Number.isFinite(value)) return "No limit";
  return value >= 1000 || value < 0.01 ? sciText(value) : String(Number(value.toPrecision(3)));
}

function lbeCategoryText(row: RiFcFamily): string {
  const category = row.view.category ?? "—";
  return row.view.also.length === 0 ? category : `${category}, also ${row.view.also.join(", ")}`;
}

function fcSummary(rows: RiFcFamily[], below: number): string {
  const ids = (list: RiFcFamily[]): string => list.map((r) => r.view.family.id).join(", ");
  const outside = rows.filter((r) => r.withinTarget === false);
  const significant = rows.filter((r) => r.significant === true);
  const untested = rows.filter((r) => r.significant === undefined).length;
  const sentences = [`${rows.length} ${rows.length === 1 ? "LBE" : "LBEs"} evaluated.`];
  sentences.push(outside.length === 0 ? "None lies outside the target." : `${ids(outside)} ${outside.length === 1 ? "lies" : "lie"} outside the target.`);
  sentences.push(significant.length === 0 ? "None is risk-significant." : `${ids(significant)} ${significant.length === 1 ? "is" : "are"} risk-significant.`);
  if (untested > 0) sentences.push(`${untested} cannot be tested yet.`);
  if (below > 0) sentences.push(`Families below the BDBE floor are not LBEs and are left out.`);
  return sentences.join(" ");
}

function FcEvaluationTable({ rows, below, criteria, openDrawer }: {
  rows: RiFcFamily[];
  below: number;
  criteria: RiResolvedAbsoluteCriteria;
  openDrawer: (ctx: RiDrawerContext) => void;
}): JSX.Element {
  const freqLabel = RI_STATISTIC_SHORT[criteria.lbeFrequencyStatistic.value];
  const doseLabel = RI_STATISTIC_SHORT[criteria.lbeDoseStatistic.value];
  const pointLabel = RI_STATISTIC_SHORT[criteria.fcStatistic.value];
  return (
    <>
      <p className="ri-step__note">{fcSummary(rows, below)}</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Target and risk significance">
          <thead>
            <tr>
              <th>Family</th><th>Name</th><th>Category</th><th>{pointLabel} point</th>
              <th>{freqLabel} frequency</th><th>{doseLabel} dose (rem)</th><th>Share of target</th><th>Risk-significant</th><th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.view.family.id}>
                <td><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputFamily", id: r.view.family.id })}>{r.view.family.id}</button></td>
                <td className="ri-rowtable__wrap">{r.view.family.name}</td>
                <td>{lbeCategoryText(r)}</td>
                <td>{r.withinTarget === undefined ? "—" : r.withinTarget ? "Within target" : "Outside target"}</td>
                <td>{statText(r.sigFrequency)}</td>
                <td>{r.release ? statText(r.sigDose) : "No release"}</td>
                <td>{shareText(r.share)}</td>
                <td>{r.significant === undefined ? "Unknown" : r.significant ? "Yes" : "No"}</td>
                <td className="ri-rowtable__wrap">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MarginCells({ margin }: { margin: RiMargin | undefined }): JSX.Element {
  return (
    <>
      <td>{marginText(margin?.frequency)}</td>
      <td>{marginText(margin?.dose)}</td>
    </>
  );
}

function FcMarginsTable({ rows, openDrawer }: { rows: RiFcFamily[]; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const least = (r: RiFcFamily): number => Math.min(r.marginHigh?.frequency ?? Number.POSITIVE_INFINITY, r.marginHigh?.dose ?? Number.POSITIVE_INFINITY);
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: rows.filter((r) => r.view.category === category).sort((a, b) => least(a) - least(b)),
  })).filter((g) => g.items.length > 0);
  return (
    <>
      <p className="ri-step__note">A frequency margin is the target frequency at the family's dose divided by its frequency. A dose margin is the target dose at its frequency divided by its dose. Both are above 1 inside the target (NEI 18-04 Section 5.7.1).</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Margins to the target">
          <thead>
            <tr>
              <th>Family</th><th>Name</th>
              <th>Mean, frequency margin</th><th>Mean, dose margin</th><th>95th, frequency margin</th><th>95th, dose margin</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.category}>
              <tr className="ri-rowtable__group"><td colSpan={6}>{g.category}</td></tr>
              {g.items.map((r) => (
                <tr key={r.view.family.id}>
                  <td><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "inputFamily", id: r.view.family.id })}>{r.view.family.id}</button></td>
                  <td className="ri-rowtable__wrap">{r.view.family.name}</td>
                  {r.release ? (
                    <>
                      <MarginCells margin={r.marginMean} />
                      <MarginCells margin={r.marginHigh} />
                    </>
                  ) : <td colSpan={4}>No release</td>}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}

function FcScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const [tab, setTab] = useState<FcTab>("chart");
  const tabId = useId();
  const criteria = criteriaSetOf(ri).absolute;
  const rows = fcFamilies(ri);
  const below = familyCategories(ri).filter((v) => v.below).length;
  const imported = ri.inputs !== undefined;
  const count = (n: number): string => (imported ? ` (${n})` : "");
  const tabs: { id: FcTab; label: string }[] = [
    { id: "chart", label: "Chart" },
    { id: "evaluation", label: `Evaluation${count(rows.length)}` },
    { id: "margins", label: `Margins${count(rows.length)}` },
  ];
  const head = FC_TAB_HEADS[tab];

  return (
    <div className="ri-step">
      <RiTabs label="Frequency-consequence sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="RI" title={head.title} level={3} />
            <RiProvenanceChip>{head.sr}</RiProvenanceChip>
          </div>
          {!imported ? (
            <p className="posmuted">Nothing is imported yet. Import the families in Step 02 first.</p>
          ) : tab === "chart" ? (
            <>
              <p className="ri-step__note">Each LBE sits at its mean, with bars from the 5th to the 95th percentile. Families with no release sit on the frequency axis. Families below the BDBE floor are not LBEs and are not shown.</p>
              <FcChart criteria={criteria} rows={rows} />
            </>
          ) : tab === "evaluation" ? (
            <FcEvaluationTable rows={rows} below={below} criteria={criteria} openDrawer={openDrawer} />
          ) : (
            <FcMarginsTable rows={rows} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

type RiskTab = "targets" | "contributions" | "curve" | "review";

const RISK_TAB_HEADS: Record<RiskTab, { title: string; sr: string }> = {
  targets: { title: "Integrated risk", sr: "RI-B2" },
  contributions: { title: "Contributions", sr: "RI-B3 · B4" },
  curve: { title: "Exceedance-frequency curve", sr: "RI-B2" },
  review: { title: "Aggregation review", sr: "RI-B3 · B4" },
};

const CONTRIBUTION_TABS: { id: RiContributionDimension; label: string }[] = [
  { id: "family", label: "Families" },
  { id: "category", label: "Release categories" },
  { id: "state", label: "Operating states" },
  { id: "hazard", label: "Hazard groups" },
  { id: "source", label: "Sources and modules" },
];

const CONTRIBUTION_HEADS: Record<RiContributionDimension, string> = {
  family: "Family",
  category: "Release category",
  state: "Operating state",
  hazard: "Hazard group",
  source: "Reactor or source",
  initiating: "Initiating event",
  sequence: "Event sequence",
};

function missingText(ri: RiskIntegration, metric: RiIntegratedMetric): string {
  const reason = ri.inputs === undefined || metric.measureName === undefined ? undefined : unavailableReasonOf(ri.inputs, metric.measureName);
  if (reason !== undefined) return `${metric.label} is not computed. ${reason}`;
  if (metricCoverage(metric) === "none") return `${metric.label} is not computed. No release family has ${metric.targetId === "DOSE_100_MREM_EXCEEDANCE" ? "a chance above 100 mrem" : "a result for it"}.`;
  const count = metric.missing.length;
  return `${metric.label} leaves out ${count} ${count === 1 ? "family" : "families"} for lack of data: ${countedItems(metric.missing, 4)}.`;
}

function totalText(value: number): string {
  return value === 0 ? "0" : sciText(value);
}

function RiskTotalsTable({ metrics, measures }: { metrics: RiIntegratedMetric[]; measures: ConsequenceMeasure[] }): JSX.Element {
  const { ri } = useRiWorkbook();
  const incomplete = metrics.filter((m) => m.missing.length > 0);
  return (
    <>
      <p className="ri-step__note">Each total adds up every included family's mean frequency times the mean value for its release category (RI-B2). Families below the BDBE floor count too. The 100 mrem total uses each result's reported chance of exceeding 100 mrem.</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Integrated risk">
          <thead>
            <tr><th>Metric</th><th>Measure</th><th>Receptors</th><th>Total</th><th>Unit</th><th>Limit</th><th>Margin</th><th>Result</th></tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const measure = measures.find((x) => x.name === m.measureName);
              const receptors = m.targetId !== undefined ? CUMULATIVE_TARGET_SPECS[m.targetId].receptor : measureReceptorText(measure?.receptor);
              const complete = m.measureName !== undefined && m.missing.length === 0;
              const none = metricCoverage(m) === "none";
              const result = none ? "Not computed" : m.limit === undefined ? "Reported" : !complete ? "Incomplete" : m.total <= m.limit ? "Meets the target" : "Exceeds the target";
              return (
                <tr key={m.key}>
                  <td className="ri-rowtable__wrap">{m.label}</td>
                  <td className="ri-rowtable__wrap">{m.measureName ?? "No measure with this role"}</td>
                  <td>{receptors}</td>
                  <td>{none ? "—" : totalText(m.total)}</td>
                  <td>{m.unit}</td>
                  <td>{m.limit === undefined ? "—" : sciText(m.limit)}</td>
                  <td>{m.limit === undefined || !(m.total > 0) ? "—" : marginText(m.limit / m.total)}</td>
                  <td>{result}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {incomplete.length > 0 && (
        <p className="ri-inputs__meta">{incomplete.map((m) => missingText(ri, m)).join(" ")}</p>
      )}
    </>
  );
}

function HazardAssignmentTable(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const groups = ri.scopeDefinition.hazardGroups;
  const ids = initiatingEventGroups(ri);
  return (
    <div className="ricriteria__table-wrap ri-step__block">
      <table className="postable ri-rowtable" aria-label="Hazard group of each initiating event group">
        <thead><tr><th>Initiating event group</th><th>Hazard group</th></tr></thead>
        <tbody>
          {ids.map((id) => {
            const current = hazardGroupOf(ri, id);
            return (
              <tr key={id}>
                <td>{id}</td>
                <td>
                  <select
                    className="posfield__select"
                    aria-label={`Hazard group of ${id}`}
                    value={current === NOT_ATTRIBUTED ? "" : current}
                    disabled={!editable}
                    onChange={(e) => {
                      if (!editable) return;
                      const group = groups.find((g) => g === e.target.value);
                      mutateRi((d) => withHazardAssignment(d, id, group));
                    }}
                  >
                    <option value="">Not attributed</option>
                    {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function contributionNote(dimension: RiContributionDimension, hazardGroups: string[], rows: { key: string }[]): string {
  switch (dimension) {
    case "family": return "Each family's share of each total. Families with no release add nothing.";
    case "category": return "Each family counts under the release category that bounds it.";
    case "state": return "A family's share is split across operating states in proportion to its member sequences' frequencies.";
    case "hazard": {
      const only = hazardGroups[0];
      if (hazardGroups.length === 1 && only !== undefined) return `Every initiating event belongs to ${only}, the only hazard group in scope.`;
      return "A family's share is split across hazard groups in proportion to its member sequences' frequencies. Assign each initiating event group to its hazard group below.";
    }
    case "source": {
      const base = "A family's share is split across the reactors and sources its sequences affect (RI-B4).";
      return rows.some((r) => r.key === NOT_RECORDED) ? `${base} ES records no reactor or source for these sequences, so their share is listed as not recorded.` : base;
    }
    case "initiating": return "A family's share is split across initiating events in proportion to its member sequences' frequencies.";
    case "sequence": return "A family's share is split across its member sequences in proportion to their frequencies.";
  }
}

function ContributionsView(): JSX.Element {
  const { ri } = useRiWorkbook();
  const [dimension, setDimension] = useState<RiContributionDimension>("family");
  const tabId = useId();
  const metrics = contributionMetrics(ri);
  const rows = contributionsBy(ri, metrics, dimension);
  const hazardGroups = ri.scopeDefinition.hazardGroups;
  return (
    <>
      <RiTabs label="Contribution views" tabs={CONTRIBUTION_TABS} active={dimension} onChange={setDimension} idBase={tabId} className="ri-subtabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${dimension}`} tabIndex={0}>
        <p className="ri-step__note">{contributionNote(dimension, hazardGroups, rows)}</p>
        {rows.length === 0 ? (
          <p className="posmuted">{metrics.length > 0 && metrics.every((m) => metricCoverage(m) === "none") ? "None of these totals is computed, so no share can be shown. The Cumulative targets tab says why." : "No family adds to these totals yet."}</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Contributions">
              <thead>
                <tr>
                  <th>{CONTRIBUTION_HEADS[dimension]}</th>
                  {metrics.map((m) => (
                    <Fragment key={m.key}>
                      <th title={m.label}>{shortMetricLabel(m)}</th>
                      <th>Share</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className={row.key === NOT_RECORDED || row.key === NOT_ATTRIBUTED ? "ri-rowtable__muted" : undefined}>
                    <td className="ri-rowtable__wrap">{row.key}</td>
                    {metrics.map((m, index) => {
                      const value = row.values[index] ?? 0;
                      return (
                        <Fragment key={m.key}>
                          <td>{totalText(value)}</td>
                          <td>{m.total > 0 ? shareText(value / m.total) : "—"}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dimension === "hazard" && hazardGroups.length > 1 && <HazardAssignmentTable />}
      </div>
    </>
  );
}

function ExceedanceChart({ curve, target }: { curve: RiExceedanceCurve; target: { value: number; frequency: number } | undefined }): JSX.Element {
  const W = 720;
  const H = 420;
  const x0 = 64;
  const x1 = 704;
  const yTop = 14;
  const yBot = 366;
  const values = curve.points.map((p) => p.value);
  const freqs = curve.points.map((p) => p.frequency);
  const maxFreq = Math.max(...freqs, target?.frequency ?? 0);
  const floorFreq = maxFreq * 1e-9;
  const shown = curve.points.filter((p) => p.frequency >= floorFreq);
  const xLoExp = Math.floor(log10(Math.min(...values, target?.value ?? Number.POSITIVE_INFINITY)));
  const xHiExp = Math.ceil(log10(Math.max(...values, target?.value ?? 0)));
  const yHiExp = Math.ceil(log10(maxFreq));
  const yLoExp = Math.floor(log10(Math.min(...shown.map((p) => p.frequency), target?.frequency ?? Number.POSITIVE_INFINITY)));
  const xMin = Math.pow(10, xLoExp);
  const xMax = Math.pow(10, Math.max(xHiExp, xLoExp + 1));
  const yMin = Math.pow(10, yLoExp);
  const yMax = Math.pow(10, Math.max(yHiExp, yLoExp + 1));
  const mx = (v: number): number => scaleLog(v, xMin, xMax, x0, x1);
  const my = (f: number): number => scaleLog(f, yMin, yMax, yBot, yTop);
  const xTicks: number[] = [];
  for (let e = xLoExp; e <= log10(xMax); e += 1) xTicks.push(e);
  const yTicks: number[] = [];
  for (let e = yLoExp; e <= log10(yMax); e += 1) yTicks.push(e);
  const yStep = yTicks.length > 12 ? 2 : 1;
  return (
    <div className="rifc__center">
      <div className="rifc__plot rifc__plot--wide">
        <svg className="rifc__svg rifc__svg--curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Exceedance-frequency curve">
          {xTicks.map((p) => (<line key={`gx${p}`} className="rifc__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
          {yTicks.map((p) => (<line key={`gy${p}`} className="rifc__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
          <polyline className="rifc__curve" points={shown.map((p) => `${mx(p.value)},${my(p.frequency)}`).join(" ")} />
          <line className="rifc__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
          <line className="rifc__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
          {xTicks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
          {yTicks.filter((_, i) => i % yStep === 0).map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
          <text className="rifc__axlab" x={(x0 + x1) / 2} y={H - 8} textAnchor="middle">{`${curve.measureName} (${curve.unit})`}</text>
          <text className="rifc__axlab" x={-((yTop + yBot) / 2)} y={14} textAnchor="middle" transform="rotate(-90 0 0)">Frequency of exceeding (per plant-year)</text>
          {target !== undefined && (
            <>
              <rect className="rifc__target-pt" x={mx(target.value) - 5} y={my(target.frequency) - 5} width={10} height={10} transform={`rotate(45 ${mx(target.value)} ${my(target.frequency)})`}>
                <title>{`100 mrem target: ${sciText(target.frequency)} per plant-year`}</title>
              </rect>
              <text className="rifc__famlab" x={mx(target.value) + 10} y={my(target.frequency) + 4}>100 mrem target</text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

function ExceedanceView(): JSX.Element {
  const { ri } = useRiWorkbook();
  const options = curveMeasures(ri);
  const eab = ri.scopeDefinition.consequenceMeasures.find((m) => m.role === "EAB_DOSE")?.name;
  const [choice, setChoice] = useState<string>(eab ?? "");
  const selectId = useId();
  const measureName = options.includes(choice) ? choice : options[0];
  if (measureName === undefined) return <p className="posmuted">No measure has the percentiles the curve needs.</p>;
  const curve = exceedanceCurve(ri, measureName);
  const limit = criteriaSetOf(ri).absolute.cumulativeTargets.find((t) => t.id === "DOSE_100_MREM_EXCEEDANCE")?.limitPerPlantYear;
  const target = measureName === eab && curve.unit === "rem" && limit !== undefined && appTypeFromMef(ri) !== "baseline_risk" ? { value: 0.1, frequency: limit } : undefined;
  return (
    <>
      <div className="ri-inputs__bar">
        <label className="posfield__label" htmlFor={selectId}>Measure</label>
        <select id={selectId} className="posfield__select" value={measureName} onChange={(e) => setChoice(e.target.value)}>
          {options.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <p className="ri-step__note">
        Each release category's value is treated as lognormal, fitted to its reported 5th and 95th percentiles, or as a fixed value when its percentiles are all equal. The curve adds up each family's mean frequency times its chance of exceeding each value.
        {curve.missing.length > 0 ? ` Left out for lack of percentiles: ${curve.missing.join(", ")}.` : ""}
      </p>
      {curve.points.length === 0 ? <p className="posmuted">No family has the data the curve needs.</p> : <ExceedanceChart curve={curve} target={target} />}
    </>
  );
}

function AggregationForm(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const results = ri.integratedRiskResults;
  const a = results.aggregationApproach;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(fn: (d: RiskIntegration) => RiskIntegration): void {
    if (!editable) return;
    mutateRi(fn);
  }
  const yesNo = (value: boolean): string => (value ? "yes" : "no");
  return (
    <div className="ri-form ri-form--card">
      <FormRow label="Aggregation approach" htmlFor={fid("approach")} top>
        <WorkbookTextarea id={fid("approach")} className="posfield__textarea" rows={2} fitContent value={a.description} disabled={dis}
          onChange={(e) => { const v = e.target.value; patch((d) => withAggregation(d, (x) => ({ ...x, description: v }))); }} />
      </FormRow>
      <FormRow label="Contributions identified per source and hazard group" htmlFor={fid("identified")}>
        <select id={fid("identified")} className="posfield__select" value={yesNo(a.perSourceHazardContributionsIdentified)} disabled={dis}
          onChange={(e) => { const v = e.target.value === "yes"; patch((d) => withAggregation(d, (x) => ({ ...x, perSourceHazardContributionsIdentified: v }))); }}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </FormRow>
      <FormRow label="Separate review done" htmlFor={fid("review")}>
        <select id={fid("review")} className="posfield__select" value={a.separateReviewPerformed === undefined ? "" : yesNo(a.separateReviewPerformed)} disabled={dis}
          onChange={(e) => {
            const raw = e.target.value;
            patch((d) => withAggregation(d, (x) => {
              const next = { ...x };
              if (raw === "") delete next.separateReviewPerformed;
              else next.separateReviewPerformed = raw === "yes";
              return next;
            }));
          }}>
          <option value="">Not set</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </FormRow>
      {a.separateReviewPerformed === true && (
        <FormRow label="Review findings" htmlFor={fid("findings")} top>
          <WorkbookTextarea id={fid("findings")} className="posfield__textarea" rows={2} fitContent value={a.separateReviewFindings ?? ""} disabled={dis}
            onChange={(e) => { const v = e.target.value; patch((d) => withAggregation(d, (x) => ({ ...x, separateReviewFindings: v }))); }} />
        </FormRow>
      )}
      <FormRow label="Multi-reactor contributions included" htmlFor={fid("reactors")}>
        <select id={fid("reactors")} className="posfield__select" value={yesNo(results.multiReactorContributionsIncluded)} disabled={dis}
          onChange={(e) => { const v = e.target.value === "yes"; patch((d) => ({ ...d, integratedRiskResults: { ...d.integratedRiskResults, multiReactorContributionsIncluded: v } })); }}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </FormRow>
      <FormRow label="Multi-source contributions included" htmlFor={fid("sources")}>
        <select id={fid("sources")} className="posfield__select" value={yesNo(results.multiSourceContributionsIncluded)} disabled={dis}
          onChange={(e) => { const v = e.target.value === "yes"; patch((d) => ({ ...d, integratedRiskResults: { ...d.integratedRiskResults, multiSourceContributionsIncluded: v } })); }}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </FormRow>
      <FormRow label="Justification" htmlFor={fid("justification")} top>
        <WorkbookTextarea id={fid("justification")} className="posfield__textarea" rows={2} fitContent value={a.justification} disabled={dis}
          onChange={(e) => { const v = e.target.value; patch((d) => withAggregation(d, (x) => ({ ...x, justification: v }))); }} />
      </FormRow>
    </div>
  );
}

function AggregationReview({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const items = reviewScopeItems(ri);
  const issues = aggregationIssues(ri);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Detail and conservatism" level={3} />
          <RiProvenanceChip>RI-B3</RiProvenanceChip>
        </div>
        <p className="ri-step__note">Record how detailed and how conservative the model is for each hazard group and source in scope, so a conservative model is never added to a realistic one unnoticed.</p>
        {items.length === 0 ? (
          <p className="posmuted">No hazard group or source is in scope yet. Set the scope in Step 01.</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Detail and conservatism">
              <thead><tr><th>Scope</th><th>Kind</th><th>Level of detail and conservatism</th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const note = detailNoteOf(ri, item.scope);
                  return (
                    <tr key={`${item.kind}:${item.scope}`}>
                      <td><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "aggregationNote", id: item.scope })}>{item.scope}</button></td>
                      <td>{item.kind}</td>
                      <td className="ri-rowtable__wrap">{note === undefined || note.trim().length === 0 ? "No note yet" : note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Review and inclusion" level={3} />
          <RiProvenanceChip>RI-B3 · B4</RiProvenanceChip>
        </div>
        <AggregationForm />
        {issues.length > 0 && <p className="ri-inputs__meta">To complete this step: {issues.join(" ")}</p>}
      </div>
    </>
  );
}

function AggregationNoteDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const kind = reviewScopeItems(ri).find((item) => item.scope === id)?.kind ?? "Scope";
  return (
    <>
      <DrawerHead cap={`${kind} · RI-B3`} title={id} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Level of detail and conservatism" htmlFor={`${fieldId}-note`} top>
          <WorkbookTextarea
            id={`${fieldId}-note`}
            className="posfield__textarea"
            rows={3}
            fitContent
            value={detailNoteOf(ri, id) ?? ""}
            disabled={!editable}
            onChange={(e) => {
              if (!editable) return;
              const note = e.target.value;
              mutateRi((d) => withDetailNote(d, id, note));
            }}
          />
        </FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function IntegratedRiskScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const [tab, setTab] = useState<RiskTab>("targets");
  const tabId = useId();
  const imported = ri.inputs !== undefined;
  const baseline = appTypeFromMef(ri) === "baseline_risk";
  const tabs: { id: RiskTab; label: string }[] = [
    { id: "targets", label: baseline ? "Integrated totals" : "Cumulative targets" },
    { id: "contributions", label: "Contributions" },
    { id: "curve", label: "Exceedance curve" },
    { id: "review", label: "Aggregation review" },
  ];
  const head = RISK_TAB_HEADS[tab];

  return (
    <div className="ri-step">
      <RiTabs label="Integrated risk sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        {tab === "review" ? (
          <AggregationReview openDrawer={openDrawer} />
        ) : (
          <div className="poscard">
            <div className="poscard__head">
              <WorkbookSectionHeading workbook="RI" title={head.title} level={3} />
              <RiProvenanceChip>{head.sr}</RiProvenanceChip>
            </div>
            {!imported ? (
              <p className="posmuted">Nothing is imported yet. Import the families in Step 02 first.</p>
            ) : tab === "targets" ? (
              <RiskTotalsTable metrics={integratedRiskMetrics(ri)} measures={ri.scopeDefinition.consequenceMeasures} />
            ) : tab === "contributions" ? (
              <ContributionsView />
            ) : (
              <ExceedanceView />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type ContributorsTab = "breakdown" | "groups" | "importance";

const CONTRIBUTOR_TAB_HEADS: Record<ContributorsTab, { title: string; sr: string }> = {
  breakdown: { title: "Contribution breakdown", sr: "RI-B6" },
  groups: { title: "Contributors grouped by SSC", sr: "RI-B6" },
  importance: { title: "Importance measures", sr: "RI-B6" },
};

function breakdownCodes(items: { id: RiBreakdownId; group: string }[]): Map<RiBreakdownId, string> {
  const counts = new Map<string, number>();
  const codes = new Map<RiBreakdownId, string>();
  for (const item of items) {
    const n = (counts.get(item.group) ?? 0) + 1;
    counts.set(item.group, n);
    codes.set(item.id, `${item.group}.${n}`);
  }
  return codes;
}

const IMPORTANCE_TYPE_LABELS: Record<string, string> = {
  BASIC_EVENT: "Basic event",
  CCF_GROUP: "Common-cause group",
  HUMAN_FAILURE_EVENT: "Human failure event",
  SYSTEM: "System",
  COMPONENT: "Component",
  INITIATING_EVENT: "Initiating event",
};

const CONTRIBUTOR_TYPE_SINGULAR: Record<string, string> = {
  CCF: "Common-cause failure",
  EQUIPMENT_FAILURE: "Equipment failure",
  BASIC_EVENT: "Basic event",
  MAINTENANCE_UNAVAILABILITY: "Maintenance unavailability",
  HUMAN_FAILURE_EVENT: "Human failure event",
  INITIATING_EVENT: "Initiating event",
  OTHER: "Other contributor",
  BARRIER_FAILURE_MODE: "Barrier failure mode",
};

const RANKING_LIMIT = 25;

function importanceNumber(value: number | undefined): string {
  return value === undefined ? "—" : String(Number(value.toPrecision(3)));
}

function MetricPicker({ metrics, value, onChange }: { metrics: RiIntegratedMetric[]; value: string; onChange: (key: string) => void }): JSX.Element {
  const selectId = useId();
  return (
    <div className="ri-inputs__bar">
      <label className="posfield__label" htmlFor={selectId}>Total</label>
      <select id={selectId} className="posfield__select" value={value} onChange={(e) => onChange(e.target.value)}>
        {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
    </div>
  );
}

function pickMetric(metrics: RiIntegratedMetric[], choice: string): RiIntegratedMetric | undefined {
  return metrics.find((m) => m.key === choice) ?? metrics.find((m) => m.total > 0) ?? metrics[0];
}

function BreakdownView({ metric }: { metric: RiIntegratedMetric }): JSX.Element {
  const { ri } = useRiWorkbook();
  const [selected, setSelected] = useState<RiBreakdownId>("family");
  const items = breakdownItems(ri, metric);
  const codes = breakdownCodes(items);
  const current = items.find((i) => i.id === selected) ?? items[0];
  const share = (value: number): string => (metric.total > 0 ? shareText(value / metric.total) : "—");
  if (current === undefined) return <p className="posmuted">Nothing to break down yet.</p>;
  const flags = breakdownSignificance(ri, metric, current);
  const bar = absoluteBar(ri, metric);
  const shown = current.ranked.slice(0, RANKING_LIMIT);
  const hasDetail = shown.some((r) => r.detail !== undefined);
  return (
    <>
      <p className="ri-step__note">The RI-N-7 breakdown of this total. Each row names the largest contributor. Select a row to see its full ranking below.</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="RI-N-7 breakdown">
          <thead><tr><th>RI-N-7</th><th>Breakdown by</th><th>Largest contributor</th><th>Share</th><th>Contributors</th></tr></thead>
          <tbody>
            {items.map((item) => {
              const top = item.ranked[0];
              return (
                <tr key={item.id} className={item.id === current.id ? "ri-rowtable__selected" : undefined}>
                  <td>{codes.get(item.id)}</td>
                  <td><button type="button" className="ri-rowtable__name" aria-pressed={item.id === current.id} onClick={() => setSelected(item.id)}>{item.label}</button></td>
                  <td className="ri-rowtable__wrap">{top === undefined ? (item.note ?? "None") : top.key}</td>
                  <td>{top === undefined ? "—" : share(top.value)}</td>
                  <td>{item.ranked.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h4 className="ri-step__subhead">{codes.get(current.id)} Ranking by {current.label.toLowerCase()}</h4>
      {current.ranked.length === 0 ? (
        <p className="posmuted">{current.note ?? "No contributor adds to this total."}</p>
      ) : (
        <>
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label={`Ranking by ${current.label.toLowerCase()}`}>
              <thead>
                <tr>
                  <th>Rank</th><th>Contributor</th>{hasDetail && <th>Type</th>}<th>Contribution</th><th>Share</th><th>Risk-significant</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, index) => {
                  const flag = flags[index];
                  return (
                    <tr key={r.key}>
                      <td>{index + 1}</td>
                      <td className="ri-rowtable__wrap">{r.key}</td>
                      {hasDetail && <td>{r.detail ?? "—"}</td>}
                      <td>{totalText(r.value)}</td>
                      <td>{share(r.value)}</td>
                      <td>{flag === undefined ? "—" : flag ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ri-inputs__meta">
            {current.ranked.length > RANKING_LIMIT ? `Top ${RANKING_LIMIT} of ${current.ranked.length}. ` : ""}
            {current.id === "function" ? "One sequence can fail several functions, so these shares overlap and do not add to 100%. " : ""}
            {["equipment", "ccf", "human", "maintenance", "basicEvent", "eventCategory"].includes(current.id) ? "Each value weights ESQ's fractional contribution by its family's share of this total. " : ""}
            {bar === undefined
              ? "Risk-significant follows RA-S-1.4 Table 1.9-1 where it defines a rule for this kind of item."
              : `Risk-significant means above ${criteriaSetOf(ri).absolute.sscCumulativePercent.value}% of this total's target, ${sciText(bar)} ${metric.unit}, the absolute bar of RI-A3 and NEI 18-04. Step 04 tests the families as LBEs.`}
          </p>
        </>
      )}
    </>
  );
}

function ComponentGroupsView({ metric, openDrawer }: { metric: RiIntegratedMetric; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  if (ri.inputs?.contributors === undefined) return <p className="posmuted">Import ESQ's contributors in Step 02 or add them by hand there.</p>;
  const contributors = sscContributors(ri);
  if (contributors.length === 0) return <p className="posmuted">ESQ reports no equipment or common-cause contributor to group.</p>;
  const groups = sscGroups(ri, metric);
  const values = contributorValues(ri, metric);
  const share = (value: number): string => (metric.total > 0 ? shareText(value / metric.total) : "—");
  return (
    <>
      <p className="ri-step__note">Assign each equipment and common-cause contributor to its SSC. Human failure events and initiating events are not SSCs, so they are left out. An SSC adds up its members, which counts shared cut sets more than once, so its share is an upper bound.</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="SSC groups">
          <thead><tr><th>SSC</th><th>Members</th><th>Contribution</th><th>Share</th></tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.ssc} className={g.ssc === NOT_ASSIGNED ? "ri-rowtable__muted" : undefined}>
                <td className="ri-rowtable__wrap">{g.ssc}</td>
                <td>{g.members.length}</td>
                <td>{totalText(g.value)}</td>
                <td>{share(g.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="ri-step__subhead">Contributors</h4>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Contributors and their SSC">
          <thead><tr><th>Contributor</th><th>Type</th><th>SSC</th><th>Contribution</th><th>Share</th></tr></thead>
          <tbody>
            {contributors.map((c) => {
              const ssc = sscOf(ri, c.name);
              const value = values.get(c.name)?.value ?? 0;
              return (
                <tr key={c.name}>
                  <td className="ri-rowtable__wrap"><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "sscAssignment", id: c.name })}>{c.name}</button></td>
                  <td>{contributorTypeLabel(c.type)}</td>
                  <td>{ssc ?? NOT_ASSIGNED}</td>
                  <td>{totalText(value)}</td>
                  <td>{share(value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ImportanceView(): JSX.Element {
  const { ri } = useRiWorkbook();
  if (ri.inputs?.importance === undefined) return <p className="posmuted">Import ESQ's importance measures in Step 02 or add them by hand there.</p>;
  const rows = importanceRows(ri);
  if (rows.length === 0) return <p className="posmuted">ESQ reports no importance measures.</p>;
  const relative = criteriaSetOf(ri).relative;
  const fixed = appTypeFromMef(ri) === "fixed_risk_target";
  return (
    <>
      <p className="ri-step__note">The importance measures as ESQ reports them or as entered by hand. RA-S-1.4 Table 1.9-1 counts a basic event as risk-significant when its Fussell-Vesely is above {relative.fussellVesely.value} or its RAW is above {relative.riskAchievementWorth.value}.{fixed ? " This application classifies by the absolute bar shown in the Breakdown, so these flags are for insight only." : ""}</p>
      <div className="ricriteria__table-wrap">
        <table className="postable ri-rowtable" aria-label="Importance measures">
          <thead><tr><th>Entity</th><th>Type</th><th>Scope</th><th>Fussell-Vesely</th><th>RAW</th><th>{fixed ? "Above Table 1.9-1" : "Risk-significant"}</th></tr></thead>
          <tbody>
            {rows.map((row, index) => {
              const e = row.entry;
              const scope = e.scope === "OVERALL" ? "Overall" : e.scope === "PER_FAMILY" ? `Family ${e.familyRef ?? ""}` : `Sequence ${e.sequenceRef ?? ""}`;
              return (
                <tr key={`${e.analysisId}:${e.entity}:${index}`}>
                  <td className="ri-rowtable__wrap">{e.entity}</td>
                  <td>{IMPORTANCE_TYPE_LABELS[e.entityType] ?? e.entityType}</td>
                  <td>{scope}</td>
                  <td>{importanceNumber(e.fussellVesely)}</td>
                  <td>{importanceNumber(e.riskAchievementWorth)}</td>
                  <td>{row.significant === undefined ? "—" : row.significant ? "Yes" : "No"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SscAssignmentDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const known = [...new Set((ri.sscAssignments ?? []).map((a) => a.ssc).filter((s) => s.trim().length > 0))].sort();
  const type = sscContributors(ri).find((c) => c.name === id)?.type;
  return (
    <>
      <DrawerHead cap={`${type === undefined ? "Contributor" : CONTRIBUTOR_TYPE_SINGULAR[type] ?? "Contributor"} · RI-B6`} title={id} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="SSC" htmlFor={`${fieldId}-ssc`}>
          <WorkbookInput
            id={`${fieldId}-ssc`}
            className="posfield__input"
            list={`${fieldId}-known`}
            value={sscOf(ri, id) ?? ""}
            disabled={!editable}
            onChange={(e) => {
              if (!editable) return;
              const ssc = e.target.value;
              mutateRi((d) => withSscAssignment(d, id, ssc));
            }}
          />
          <datalist id={`${fieldId}-known`}>
            {known.map((name) => <option key={name} value={name} />)}
          </datalist>
        </FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function ContributorsScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const [tab, setTab] = useState<ContributorsTab>("breakdown");
  const [choice, setChoice] = useState("");
  const tabId = useId();
  const imported = ri.inputs !== undefined;
  const metrics = contributionMetrics(ri);
  const metric = pickMetric(metrics, choice);
  const tabs: { id: ContributorsTab; label: string }[] = [
    { id: "breakdown", label: "Breakdown" },
    { id: "groups", label: "Component groups" },
    { id: "importance", label: "Importance" },
  ];
  const head = CONTRIBUTOR_TAB_HEADS[tab];

  return (
    <div className="ri-step">
      <RiTabs label="Contributor sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="RI" title={head.title} level={3} />
            <RiProvenanceChip>{head.sr}</RiProvenanceChip>
          </div>
          {!imported ? (
            <p className="posmuted">Nothing is imported yet. Import the families in Step 02 first.</p>
          ) : tab === "importance" ? (
            <ImportanceView />
          ) : metric === undefined ? (
            <p className="posmuted">No total to break down yet.</p>
          ) : (
            <>
              <MetricPicker metrics={metrics} value={metric.key} onChange={setChoice} />
              {metricCoverage(metric) === "none" ? (
                <p className="posmuted">{missingText(ri, metric)} Nothing can be broken down until it is.</p>
              ) : tab === "breakdown" ? <BreakdownView metric={metric} /> : <ComponentGroupsView metric={metric} openDrawer={openDrawer} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type UncertaintyTab = "register" | "grouping" | "propagation" | "sensitivity";

const SCREENED_TYPES: ScreenedItemLedgerEntry["itemType"][] = ["HAZARD_GROUP", "HAZARD_EVENT", "PLANT_OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "BASIC_EVENT"];
const SCREENING_CODES: ScreenedItemLedgerEntry["screeningElementCode"][] = ["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "MS", "RC"];

function quantityLabel(value: string): string {
  const quantity = MEASURE_QUANTITIES.find((q) => q === value);
  return quantity === undefined ? value : MEASURE_QUANTITY_LABELS[quantity];
}

function RegisterView({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi, upstream } = useRiWorkbook();
  const sources = ri.modelUncertaintySources;
  const ledger = ri.screenedItemsLedger ?? [];
  const newSources = newRegisterCandidates(ri, upstream).length;
  const newItems = newScreeningCandidates(ri, upstream).length;
  const issues = registerIssues(ri);

  function addSource(): void {
    if (!editable) return;
    const uuid = nextId("MU", sources.map((u) => u.uuid));
    mutateRi((d) => ({
      ...d,
      modelUncertaintySources: [...d.modelUncertaintySources, {
        uuid,
        name: "",
        description: "",
        originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
        affectedMetrics: [],
        impactAssessment: "",
        implementsSrs: [{ sr: "RI-C1", hlr: "C" as const }, { sr: "RI-C3", hlr: "C" as const }],
      }],
    }));
    openDrawer({ kind: "uncertaintySource", id: uuid });
  }
  function addItem(): void {
    if (!editable) return;
    const uuid = nextId("SL", ledger.map((s) => s.uuid));
    mutateRi((d) => ({
      ...d,
      screenedItemsLedger: [...(d.screenedItemsLedger ?? []), {
        uuid,
        itemType: "EVENT_SEQUENCE" as const,
        itemRef: "",
        screeningElementCode: "ES" as const,
        screeningBasis: "",
        implementsSrs: [{ sr: "RI-C1", hlr: "C" as const }],
      }],
    }));
    openDrawer({ kind: "screenedItem", id: uuid });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Model uncertainties" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-C1 · C3</RiProvenanceChip>
            {editable && newSources > 0 && (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateRi((d) => withImportedRegister(d, upstream))}>Import {newSources} from linked workbooks</button>
            )}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}><RIIcon.Plus /> Add source</button>}
          </div>
        </div>
        <p className="ri-step__note">The key model uncertainties of every element. The frequency side arrives through ESQ's assessments (ESQ-E1), the consequence side through MS and RC. Each one needs the totals it affects and an assessment of its effect (RI-C3).</p>
        {sources.length === 0 ? (
          <p className="posmuted">No model uncertainty is compiled yet.</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Model uncertainties">
              <thead><tr><th>Element</th><th>Uncertainty source</th><th>Side</th><th>Affected totals</th><th>Effect on the results</th></tr></thead>
              <tbody>
                {sources.map((u) => {
                  const code = ELEMENT_CODE_BY_TYPE[u.originatingElement] ?? "RI";
                  return (
                    <tr key={u.uuid}>
                      <td>{code}</td>
                      <td className="ri-rowtable__wrap"><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "uncertaintySource", id: u.uuid })}>{u.name.trim().length > 0 ? u.name : "Untitled source"}</button></td>
                      <td>{REGISTER_SIDE[code] ?? "Frequency side"}</td>
                      <td className="ri-rowtable__wrap">{u.affectedMetrics.length === 0 ? "Not set" : u.affectedMetrics.map(quantityLabel).join(", ")}</td>
                      <td className="ri-rowtable__wrap">{u.impactAssessment.trim().length === 0 ? "Not assessed yet" : u.impactAssessment}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Screened items" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-C1</RiProvenanceChip>
            {editable && newItems > 0 && (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateRi((d) => withImportedScreening(d, upstream))}>Import {newItems} screening decisions</button>
            )}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addItem}><RIIcon.Plus /> Add item</button>}
          </div>
        </div>
        <p className="ri-step__note">Everything screened out of the PRA, with the reason and its effect on the results. The import takes the screened operating states from POS, the screened sequences from ES and the screened initiating events that ESQ assessed.</p>
        {ledger.length === 0 ? (
          <p className="posmuted">No screened item is recorded yet.</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Screened items">
              <thead><tr><th>Screened by</th><th>Item</th><th>Type</th><th>Basis</th><th>Effect on the results</th></tr></thead>
              <tbody>
                {ledger.map((s) => (
                  <tr key={s.uuid}>
                    <td>{s.screeningElementCode}</td>
                    <td className="ri-rowtable__wrap"><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "screenedItem", id: s.uuid })}>{s.itemRef.trim().length > 0 ? s.itemRef : "Untitled item"}</button></td>
                    <td>{labelOf(SCREENED_ITEM_TYPE_OPTIONS, s.itemType)}</td>
                    <td className="ri-rowtable__wrap">{s.screeningBasis.trim().length === 0 ? "No basis yet" : s.screeningBasis}</td>
                    <td className="ri-rowtable__wrap">{s.impactOnRiskMetrics ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {issues.length > 0 && <p className="ri-inputs__meta">To complete the register: {issues.slice(0, 6).join(" ")}{issues.length > 6 ? ` And ${issues.length - 6} more.` : ""}</p>}
      </div>
    </>
  );
}

function GroupingView(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const g = ri.groupingAdequacyReview;
  const shared = sharedReleaseCategories(ri);
  const issues = groupingIssues(ri);
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<RiskIntegration["groupingAdequacyReview"]>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, groupingAdequacyReview: { ...d.groupingAdequacyReview, ...next } }));
  }
  function patchReview(next: Partial<RiskIntegration["groupingAdequacyReview"]["groupingUncertaintyReview"]>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, groupingAdequacyReview: { ...d.groupingAdequacyReview, groupingUncertaintyReview: { ...d.groupingAdequacyReview.groupingUncertaintyReview, ...next } } }));
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Release categories shared by several families" level={3} />
          <RiProvenanceChip>RI-C2</RiProvenanceChip>
        </div>
        <p className="ri-step__note">One bounding consequence stands for every family in a shared release category, so a difference between those families can hide there.</p>
        {shared.length === 0 ? (
          <p className="posmuted">Every release category carries one family.</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Shared release categories">
              <thead><tr><th>Release category</th><th>Families</th></tr></thead>
              <tbody>
                {shared.map((s) => (
                  <tr key={s.category}><td>{s.category}</td><td className="ri-rowtable__wrap">{s.families.join(", ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Grouping review" level={3} />
          <RiProvenanceChip>RI-B5 · C2</RiProvenanceChip>
        </div>
        <div className="ri-form ri-form--card">
          <FormRow label="Variations within families" htmlFor={fid("variation")} top>
            <WorkbookTextarea id={fid("variation")} className="posfield__textarea" rows={2} fitContent value={g.variationNotSignificantJustification} disabled={dis} onChange={(e) => patch({ variationNotSignificantJustification: e.target.value })} />
          </FormRow>
          <FormRow label="Release category selection" htmlFor={fid("categories")} top>
            <WorkbookTextarea id={fid("categories")} className="posfield__textarea" rows={2} fitContent value={g.releaseCategorySelectionSufficiency} disabled={dis} onChange={(e) => patch({ releaseCategorySelectionSufficiency: e.target.value })} />
          </FormRow>
          <FormRow label="Family assignment" htmlFor={fid("assignment")} top>
            <WorkbookTextarea id={fid("assignment")} className="posfield__textarea" rows={2} fitContent value={g.familyAssignmentSufficiency} disabled={dis} onChange={(e) => patch({ familyAssignmentSufficiency: e.target.value })} />
          </FormRow>
          <FormRow label="Grouping uncertainty reviewed" htmlFor={fid("performed")}>
            <select id={fid("performed")} className="posfield__select" value={g.groupingUncertaintyReview.performed ? "yes" : "no"} disabled={dis} onChange={(e) => patchReview({ performed: e.target.value === "yes" })}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormRow>
          <FormRow label="Artificial significance found" htmlFor={fid("artifact")}>
            <select id={fid("artifact")} className="posfield__select" value={g.groupingUncertaintyReview.artificialSignificanceFound ? "yes" : "no"} disabled={dis} onChange={(e) => patchReview({ artificialSignificanceFound: e.target.value === "yes" })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          <FormRow label="Findings" htmlFor={fid("findings")} top>
            <WorkbookTextarea id={fid("findings")} className="posfield__textarea" rows={2} fitContent value={g.groupingUncertaintyReview.findings ?? ""} disabled={dis} onChange={(e) => patchReview({ findings: e.target.value })} />
          </FormRow>
        </div>
        {issues.length > 0 && <p className="ri-inputs__meta">To complete the review: {issues.join(" ")}</p>}
      </div>
    </>
  );
}

function PropagationView({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const results = useMemo(() => propagateTotals(ri), [ri]);
  const incomplete = results.filter((r) => r.metric.missing.length > 0);
  const offset = results.filter((r) => r.metric.missing.length === 0 && r.metric.total > 0 && Math.abs(r.mean - r.metric.total) > 3 * r.standardError);
  const analyses = ri.uncertaintyAnalyses;
  function addAnalysis(): void {
    if (!editable) return;
    const uuid = nextId("RIU", analyses.map((u) => u.uuid));
    mutateRi((d) => ({
      ...d,
      uncertaintyAnalyses: [...d.uncertaintyAnalyses, {
        uuid,
        name: "",
        metric: integratedRiskMetrics(d)[0]?.label ?? "",
        characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT" as const,
        propagationMethod: "Monte Carlo sampling in the RI workbook",
        sokcAndPhenomenaTreatment: { eventFrequencySokcConsidered: false, phenomenaDependenciesConsidered: false },
        evaluationScope: "COMBINATION" as const,
        evaluationType: "QUANTITATIVE" as const,
        implementsSrs: [{ sr: "RI-C3", hlr: "C" as const }, { sr: "RI-C4", hlr: "C" as const }],
      }],
    }));
    openDrawer({ kind: "uncertaintyAnalysis", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Propagated totals" level={3} />
          <RiProvenanceChip>RI-C4</RiProvenanceChip>
        </div>
        <p className="ri-step__note">{PROPAGATION_SAMPLES.toLocaleString()} samples with a fixed seed. Each family frequency and each release category value is lognormal, fitted to its 5th and 95th percentiles, or fixed when it has no spread. Families that share a release category share its sampled value. Families are otherwise sampled independently, so correlation between them is not captured. The chance above 100 mrem is each result's single reported value.</p>
        {results.length === 0 ? (
          <p className="posmuted">{ri.inputs === undefined ? "Nothing is imported yet. Import the families in Step 02 first." : "No total to propagate yet."}</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Propagated totals">
              <thead><tr><th>Total</th><th>Point estimate</th><th>Mean</th><th>5th</th><th>Median</th><th>95th</th><th>Unit</th><th>Limit</th><th>Margin at the 95th</th></tr></thead>
              <tbody>
                {results.map((r) => {
                  const none = metricCoverage(r.metric) === "none";
                  const value = (v: number): string => (none ? "—" : totalText(v));
                  return (
                    <tr key={r.metric.key}>
                      <td className="ri-rowtable__wrap">{r.metric.label}</td>
                      <td>{value(r.metric.total)}</td>
                      <td>{value(r.mean)}</td>
                      <td>{value(r.p05)}</td>
                      <td>{value(r.p50)}</td>
                      <td>{value(r.p95)}</td>
                      <td>{r.metric.unit}</td>
                      <td>{r.metric.limit === undefined ? "—" : sciText(r.metric.limit)}</td>
                      <td>{none ? "Not computed" : r.metric.missing.length > 0 ? "Incomplete" : r.metric.limit === undefined || !(r.p95 > 0) ? "—" : marginText(r.metric.limit / r.p95)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {incomplete.length > 0 && (
          <p className="ri-inputs__meta">{incomplete.map((r) => missingText(ri, r.metric)).join(" ")}</p>
        )}
        {offset.length > 0 && (
          <p className="ri-inputs__meta">Sampled mean against the point estimate: {offset.map((r) => `${r.metric.label} ${Math.round(Math.abs(r.mean / r.metric.total - 1) * 100)} percent ${r.mean > r.metric.total ? "above" : "below"}`).join(", ")}. That is more than three standard errors of the sampling, so some recorded means do not match their percentiles. Check those means against their sources.</p>
        )}
      </div>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Uncertainty characterization" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-C3 · C4</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAnalysis}><RIIcon.Plus /> Add analysis</button>}
          </div>
        </div>
        <p className="ri-step__note">How each total's uncertainty is characterized, how correlation and phenomena are treated, and what the range means (RI-C4).</p>
        {analyses.length === 0 ? (
          <p className="posmuted">No characterization is recorded yet.</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Uncertainty characterization">
              <thead><tr><th>Analysis</th><th>Total</th><th>Level</th><th>Method</th><th>Range</th></tr></thead>
              <tbody>
                {analyses.map((u) => (
                  <tr key={u.uuid}>
                    <td className="ri-rowtable__wrap"><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "uncertaintyAnalysis", id: u.uuid })}>{u.name !== undefined && u.name.trim().length > 0 ? u.name : "Untitled analysis"}</button></td>
                    <td className="ri-rowtable__wrap">{analysisTotalOf(ri, String(u.metric)) ?? (String(u.metric).trim().length > 0 ? String(u.metric) : "Not set")}</td>
                    <td>{labelOf(CHAR_LEVEL_OPTIONS, u.characterizationLevel)}</td>
                    <td className="ri-rowtable__wrap">{u.propagationMethod}</td>
                    <td className="ri-rowtable__wrap">{u.uncertaintyRangeDiscussion ?? "Not discussed yet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function SensitivityView({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi, upstream } = useRiWorkbook();
  const studies = ri.sensitivityStudies ?? [];
  const linked = [
    ...(upstream.es?.sensitivityStudies ?? []).map((s) => ({ code: "ES", study: s })),
    ...(upstream.esq?.sensitivityStudies ?? []).map((s) => ({ code: "ESQ", study: s })),
    ...(upstream.ms?.sensitivityStudies ?? []).map((s) => ({ code: "MS", study: s })),
  ];
  function addStudy(): void {
    if (!editable) return;
    const uuid = nextId("RIS", studies.map((s) => s.uuid));
    mutateRi((d) => ({
      ...d,
      sensitivityStudies: [...(d.sensitivityStudies ?? []), { uuid, name: "", description: "", variedParameters: [], parameterRanges: {}, implementsSrs: [{ sr: "RI-C3", hlr: "C" as const }] }],
    }));
    openDrawer({ kind: "sensitivityStudy", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="RI sensitivity studies" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-C3</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addStudy}><RIIcon.Plus /> Add study</button>}
          </div>
        </div>
        <p className="ri-step__note">The quantitative checks of the register's key uncertainties on the totals (RI-C3).</p>
        {studies.length === 0 ? (
          <p className="posmuted">No sensitivity study is recorded yet.</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="RI sensitivity studies">
              <thead><tr><th>Study</th><th>Varies</th><th>Uncertainty source</th><th>Result</th></tr></thead>
              <tbody>
                {studies.map((s) => {
                  const source = ri.modelUncertaintySources.find((u) => u.uuid === s.modelUncertaintyId);
                  return (
                    <tr key={s.uuid}>
                      <td className="ri-rowtable__wrap"><button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "sensitivityStudy", id: s.uuid })}>{s.name !== undefined && s.name.trim().length > 0 ? s.name : "Untitled study"}</button></td>
                      <td className="ri-rowtable__wrap">{s.variedParameters.length === 0 ? "—" : s.variedParameters.join(", ")}</td>
                      <td className="ri-rowtable__wrap">{source?.name ?? "—"}</td>
                      <td className="ri-rowtable__wrap">{s.results ?? "No result yet"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Studies in the linked workbooks" level={3} />
          <RiProvenanceChip>RI-C3</RiProvenanceChip>
        </div>
        {linked.length === 0 ? (
          <p className="posmuted">{upstream.es === undefined && upstream.esq === undefined && upstream.ms === undefined ? "No ES, ESQ or MS workbook is linked." : "The linked ES, ESQ and MS workbooks record no sensitivity study."}</p>
        ) : (
          <div className="ricriteria__table-wrap">
            <table className="postable ri-rowtable" aria-label="Studies in the linked workbooks">
              <thead><tr><th>Element</th><th>Study</th><th>Result</th></tr></thead>
              <tbody>
                {linked.map(({ code, study }) => (
                  <tr key={`${code}:${study.uuid}`}>
                    <td>{code}</td>
                    <td className="ri-rowtable__wrap">{study.name ?? study.description}</td>
                    <td className="ri-rowtable__wrap">{study.results ?? study.impact ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function UncertaintySourceDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const u = ri.modelUncertaintySources.find((x) => x.uuid === id);
  if (u === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const quantities = [...new Set([
    ...ri.scopeDefinition.consequenceMeasures.map((m) => m.quantity).filter((q): q is RcMetricQuantity => q !== undefined),
    ...u.affectedMetrics,
  ])];
  function patch(next: Partial<ModelUncertaintySource>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, modelUncertaintySources: d.modelUncertaintySources.map((x) => (x.uuid === id ? { ...x, ...next } : x)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => ({ ...d, modelUncertaintySources: d.modelUncertaintySources.filter((x) => x.uuid !== id) }));
  }
  function toggle(quantity: string, on: boolean): void {
    if (!editable) return;
    mutateRi((d) => ({
      ...d,
      modelUncertaintySources: d.modelUncertaintySources.map((x) => {
        if (x.uuid !== id) return x;
        const rest = x.affectedMetrics.filter((m) => m !== quantity);
        const next = on ? [...rest, quantity] : rest;
        const order = [...new Set([...quantities, ...x.affectedMetrics, quantity])];
        return { ...x, affectedMetrics: order.filter((q) => next.includes(q)) };
      }),
    }));
  }
  return (
    <>
      <DrawerHead cap="Model uncertainty · RI-C1 · C3" title={u.name.trim().length > 0 ? u.name : "Untitled source"} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Name" htmlFor={fid("name")}>
          <WorkbookInput id={fid("name")} className="posfield__input" value={u.name} disabled={dis} onChange={(e) => patch({ name: e.target.value })} />
        </FormRow>
        <FormRow label="Element" htmlFor={fid("element")}>
          <select id={fid("element")} className="posfield__select" value={u.originatingElement} disabled={dis}
            onChange={(e) => { const type = Object.values(TechnicalElementTypes).find((t) => t === e.target.value); if (type !== undefined) patch({ originatingElement: type }); }}>
            {ELEMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Description" htmlFor={fid("description")} top>
          <WorkbookTextarea id={fid("description")} className="posfield__textarea" rows={2} fitContent value={u.description} disabled={dis} onChange={(e) => patch({ description: e.target.value })} />
        </FormRow>
        <div className="ri-form__row ri-form__row--top">
          <span className="posfield__label ri-form__label">Affected totals</span>
          <div className="ri-form__checks" role="group" aria-label="Affected totals">
            {quantities.map((q) => (
              <label key={q} className="ri-form__check">
                <input type="checkbox" checked={u.affectedMetrics.includes(q)} disabled={dis} onChange={(e) => toggle(q, e.target.checked)} />
                {quantityLabel(q)}
              </label>
            ))}
          </div>
        </div>
        <FormRow label="Effect on the results" htmlFor={fid("impact")} top>
          <WorkbookTextarea id={fid("impact")} className="posfield__textarea" rows={2} fitContent value={u.impactAssessment} disabled={dis} onChange={(e) => patch({ impactAssessment: e.target.value })} />
        </FormRow>
        <FormRow label="Related assumptions" htmlFor={fid("assumptions")} top>
          <WorkbookTextarea id={fid("assumptions")} className="posfield__textarea" rows={2} fitContent value={(u.relatedAssumptions ?? []).join("\n")} disabled={dis}
            onChange={(e) => patch({ relatedAssumptions: e.target.value.split("\n").map((a) => a.trim()).filter((a) => a.length > 0) })} />
        </FormRow>
        <FormRow label="How it is assessed" htmlFor={fid("method")}>
          <WorkbookInput id={fid("method")} className="posfield__input" value={u.characterizationMethod ?? ""} disabled={dis} onChange={(e) => patch({ characterizationMethod: e.target.value })} />
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove source</button>}
      </FormFoot>
    </>
  );
}

function ScreenedItemDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const s = (ri.screenedItemsLedger ?? []).find((x) => x.uuid === id);
  if (s === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<ScreenedItemLedgerEntry>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, screenedItemsLedger: (d.screenedItemsLedger ?? []).map((x) => (x.uuid === id ? { ...x, ...next } : x)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => ({ ...d, screenedItemsLedger: (d.screenedItemsLedger ?? []).filter((x) => x.uuid !== id) }));
  }
  return (
    <>
      <DrawerHead cap="Screened item · RI-C1" title={s.itemRef.trim().length > 0 ? s.itemRef : "Untitled item"} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Item" htmlFor={fid("item")}>
          <WorkbookInput id={fid("item")} className="posfield__input" value={s.itemRef} disabled={dis} onChange={(e) => patch({ itemRef: e.target.value })} />
        </FormRow>
        <FormRow label="Type" htmlFor={fid("type")}>
          <select id={fid("type")} className="posfield__select" value={s.itemType} disabled={dis}
            onChange={(e) => { const type = SCREENED_TYPES.find((t) => t === e.target.value); if (type !== undefined) patch({ itemType: type }); }}>
            {SCREENED_ITEM_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Screened by" htmlFor={fid("code")}>
          <select id={fid("code")} className="posfield__select" value={s.screeningElementCode} disabled={dis}
            onChange={(e) => { const code = SCREENING_CODES.find((c) => c === e.target.value); if (code !== undefined) patch({ screeningElementCode: code }); }}>
            {ELEMENT_CODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Basis" htmlFor={fid("basis")} top>
          <WorkbookTextarea id={fid("basis")} className="posfield__textarea" rows={2} fitContent value={s.screeningBasis} disabled={dis} onChange={(e) => patch({ screeningBasis: e.target.value })} />
        </FormRow>
        <FormRow label="Effect on the results" htmlFor={fid("impact")} top>
          <WorkbookTextarea id={fid("impact")} className="posfield__textarea" rows={2} fitContent value={s.impactOnRiskMetrics ?? ""} disabled={dis} onChange={(e) => patch({ impactOnRiskMetrics: e.target.value })} />
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove item</button>}
      </FormFoot>
    </>
  );
}

function UncertaintyAnalysisDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const u = ri.uncertaintyAnalyses.find((x) => x.uuid === id);
  if (u === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const totals = integratedRiskMetrics(ri).map((m) => m.label);
  const metric = String(u.metric);
  const current = analysisTotalOf(ri, metric);
  function patch(next: Partial<RiskUncertaintyAnalysis>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, uncertaintyAnalyses: d.uncertaintyAnalyses.map((x) => (x.uuid === id ? { ...x, ...next } : x)) }));
  }
  function patchTreatment(next: Partial<RiskUncertaintyAnalysis["sokcAndPhenomenaTreatment"]>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, uncertaintyAnalyses: d.uncertaintyAnalyses.map((x) => (x.uuid === id ? { ...x, sokcAndPhenomenaTreatment: { ...x.sokcAndPhenomenaTreatment, ...next } } : x)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => ({ ...d, uncertaintyAnalyses: d.uncertaintyAnalyses.filter((x) => x.uuid !== id) }));
  }
  return (
    <>
      <DrawerHead cap="Uncertainty characterization · RI-C3 · C4" title={u.name !== undefined && u.name.trim().length > 0 ? u.name : "Untitled analysis"} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Name" htmlFor={fid("name")}>
          <WorkbookInput id={fid("name")} className="posfield__input" value={u.name ?? ""} disabled={dis} onChange={(e) => patch({ name: e.target.value })} />
        </FormRow>
        <FormRow label="Total" htmlFor={fid("metric")}>
          <select id={fid("metric")} className="posfield__select" value={current ?? metric} disabled={dis} onChange={(e) => patch({ metric: e.target.value })}>
            {current === undefined && <option value={metric}>{metric.trim().length > 0 ? metric : "No total chosen"}</option>}
            {totals.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        <FormRow label="Level" htmlFor={fid("level")}>
          <select id={fid("level")} className="posfield__select" value={u.characterizationLevel} disabled={dis}
            onChange={(e) => patch({ characterizationLevel: e.target.value === "CHARACTERIZED" ? "CHARACTERIZED" : "PROPAGATED_RISK_SIGNIFICANT" })}>
            {CHAR_LEVEL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Method" htmlFor={fid("method")}>
          <WorkbookInput id={fid("method")} className="posfield__input" value={u.propagationMethod} disabled={dis} onChange={(e) => patch({ propagationMethod: e.target.value })} />
        </FormRow>
        <FormRow label="Evaluation" htmlFor={fid("type")}>
          <select id={fid("type")} className="posfield__select" value={u.evaluationType} disabled={dis}
            onChange={(e) => patch({ evaluationType: e.target.value === "QUALITATIVE" ? "QUALITATIVE" : "QUANTITATIVE" })}>
            {EVAL_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Scope" htmlFor={fid("scope")}>
          <select id={fid("scope")} className="posfield__select" value={u.evaluationScope} disabled={dis}
            onChange={(e) => patch({ evaluationScope: e.target.value === "INDIVIDUAL" ? "INDIVIDUAL" : "COMBINATION" })}>
            {EVAL_SCOPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="State-of-knowledge correlation" htmlFor={fid("sokc")}>
          <select id={fid("sokc")} className="posfield__select" value={u.sokcAndPhenomenaTreatment.eventFrequencySokcConsidered ? "yes" : "no"} disabled={dis}
            onChange={(e) => patchTreatment({ eventFrequencySokcConsidered: e.target.value === "yes" })}>
            {CONSIDERED_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Phenomena dependencies" htmlFor={fid("phenomena")}>
          <select id={fid("phenomena")} className="posfield__select" value={u.sokcAndPhenomenaTreatment.phenomenaDependenciesConsidered ? "yes" : "no"} disabled={dis}
            onChange={(e) => patchTreatment({ phenomenaDependenciesConsidered: e.target.value === "yes" })}>
            {CONSIDERED_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormRow>
        <FormRow label="Treatment" htmlFor={fid("treatment")} top>
          <WorkbookTextarea id={fid("treatment")} className="posfield__textarea" rows={2} fitContent value={u.sokcAndPhenomenaTreatment.treatmentDescription ?? ""} disabled={dis} onChange={(e) => patchTreatment({ treatmentDescription: e.target.value })} />
        </FormRow>
        <FormRow label="Range discussion" htmlFor={fid("range")} top>
          <WorkbookTextarea id={fid("range")} className="posfield__textarea" rows={2} fitContent value={u.uncertaintyRangeDiscussion ?? ""} disabled={dis} onChange={(e) => patch({ uncertaintyRangeDiscussion: e.target.value })} />
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove analysis</button>}
      </FormFoot>
    </>
  );
}

function SensitivityStudyDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const s = (ri.sensitivityStudies ?? []).find((x) => x.uuid === id);
  if (s === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<SensitivityStudy>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).map((x) => (x.uuid === id ? { ...x, ...next } : x)) }));
  }
  function setParameters(text: string): void {
    if (!editable) return;
    const params = text.split("\n").map((p) => p.trim()).filter((p) => p.length > 0);
    mutateRi((d) => ({
      ...d,
      sensitivityStudies: (d.sensitivityStudies ?? []).map((x) => {
        if (x.uuid !== id) return x;
        const ranges: Record<string, [number, number]> = {};
        for (const p of params) {
          const range = x.parameterRanges[p];
          if (range !== undefined) ranges[p] = range;
        }
        return { ...x, variedParameters: params, parameterRanges: ranges };
      }),
    }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateRi((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).filter((x) => x.uuid !== id) }));
  }
  return (
    <>
      <DrawerHead cap="Sensitivity study · RI-C3" title={s.name !== undefined && s.name.trim().length > 0 ? s.name : "Untitled study"} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Name" htmlFor={fid("name")}>
          <WorkbookInput id={fid("name")} className="posfield__input" value={s.name ?? ""} disabled={dis} onChange={(e) => patch({ name: e.target.value })} />
        </FormRow>
        <FormRow label="Description" htmlFor={fid("description")} top>
          <WorkbookTextarea id={fid("description")} className="posfield__textarea" rows={2} fitContent value={s.description} disabled={dis} onChange={(e) => patch({ description: e.target.value })} />
        </FormRow>
        <FormRow label="Uncertainty source" htmlFor={fid("source")}>
          <select id={fid("source")} className="posfield__select" value={s.modelUncertaintyId ?? ""} disabled={dis}
            onChange={(e) => { const value = e.target.value; patch({ modelUncertaintyId: value.length === 0 ? undefined : value }); }}>
            <option value="">None</option>
            {ri.modelUncertaintySources.map((u) => <option key={u.uuid} value={u.uuid}>{u.name.trim().length > 0 ? u.name : u.uuid}</option>)}
          </select>
        </FormRow>
        <FormRow label="Varied parameters" htmlFor={fid("params")} top>
          <WorkbookTextarea id={fid("params")} className="posfield__textarea" rows={2} fitContent value={s.variedParameters.join("\n")} disabled={dis} onChange={(e) => setParameters(e.target.value)} />
        </FormRow>
        <FormRow label="Result" htmlFor={fid("results")} top>
          <WorkbookTextarea id={fid("results")} className="posfield__textarea" rows={2} fitContent value={s.results ?? ""} disabled={dis} onChange={(e) => patch({ results: e.target.value })} />
        </FormRow>
        <FormRow label="Insights" htmlFor={fid("insights")} top>
          <WorkbookTextarea id={fid("insights")} className="posfield__textarea" rows={2} fitContent value={s.insights ?? ""} disabled={dis} onChange={(e) => patch({ insights: e.target.value })} />
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove study</button>}
      </FormFoot>
    </>
  );
}

function UncertaintyStepScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const [tab, setTab] = useState<UncertaintyTab>("register");
  const tabId = useId();
  const tabs: { id: UncertaintyTab; label: string }[] = [
    { id: "register", label: `Register (${ri.modelUncertaintySources.length})` },
    { id: "grouping", label: "Grouping" },
    { id: "propagation", label: "Propagation" },
    { id: "sensitivity", label: `Sensitivity (${(ri.sensitivityStudies ?? []).length})` },
  ];
  return (
    <div className="ri-step">
      <RiTabs label="Uncertainty sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        {tab === "register" ? (
          <RegisterView openDrawer={openDrawer} />
        ) : tab === "grouping" ? (
          <GroupingView />
        ) : tab === "propagation" ? (
          <PropagationView openDrawer={openDrawer} />
        ) : (
          <SensitivityView openDrawer={openDrawer} />
        )}
      </div>
    </div>
  );
}

type HandoffTab = "summary" | "esq" | "ms" | "rc" | "elements" | "responses";

const LEVEL_TEXT: Record<ImportanceLevel, string> = {
  [ImportanceLevel.HIGH]: "High",
  [ImportanceLevel.MEDIUM]: "Medium",
  [ImportanceLevel.LOW]: "Low",
};

const LEVEL_OPTIONS: ImportanceLevel[] = [ImportanceLevel.HIGH, ImportanceLevel.MEDIUM, ImportanceLevel.LOW];

const HANDOFF_GROUP_LIST: RiHandoffGroup[] = ["family", "contributor", "category", "sourceTerm", "measure", "element"];

const HANDOFF_GROUP_CAPS: Record<RiHandoffGroup, string> = {
  family: "Family hand-off to ESQ",
  contributor: "Contributor hand-off to ESQ",
  category: "Release category hand-off to MS",
  sourceTerm: "Source term hand-off to MS",
  measure: "Measure hand-off to RC",
  element: "Hand-off",
};

const HANDOFF_GROUP_KINDS: Record<RiHandoffGroup, string> = {
  family: "Family",
  contributor: "Contributor",
  category: "Release category",
  sourceTerm: "Source term",
  measure: "Measure",
  element: "Element",
};

const RESPONSE_STATUS_TEXT: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ADDRESSED: "Addressed",
  DEFERRED: "Deferred",
};

function handoffDrawerId(group: RiHandoffGroup, key: string): string {
  return `${group}::${key}`;
}

function parseHandoffId(id: string): { group: RiHandoffGroup; key: string } | undefined {
  const at = id.indexOf("::");
  if (at < 0) return undefined;
  const group = HANDOFF_GROUP_LIST.find((g) => g === id.slice(0, at));
  return group === undefined ? undefined : { group, key: id.slice(at + 2) };
}

function contributorKindText(type: string): string {
  return CONTRIBUTOR_TYPE_SINGULAR[type] ?? IMPORTANCE_TYPE_LABELS[type] ?? type;
}

function handoffRuleText(ri: RiskIntegration): string {
  const set = criteriaSetOf(ri);
  return appTypeFromMef(ri) === "fixed_risk_target"
    ? `High means risk-significant under NEI 18-04: a risk-significant LBE, or above ${set.absolute.sscCumulativePercent.value}% of a cumulative target. Medium is the analyst's call and needs a reason. Everything else goes as Low.`
    : `High means risk-significant under RA-S-1.4 Table 1.9-1: in the top ${set.relative.aggregatePercent.value}% or above ${set.relative.individualPercent.value}% of a total, or a basic event above the Fussell-Vesely or RAW bar. Medium is the analyst's call and needs a reason. Everything else goes as Low.`;
}

function handoffDetail(target: RiHandoffTarget, entry: RiHandoffEntry | undefined): string {
  if (target.group === "sourceTerm") {
    const list = entry?.keyUncertainties ?? [];
    return list.length === 0 ? "None yet" : list.join(", ");
  }
  if (target.group === "element") {
    const message = entry?.generalFeedback ?? "";
    return message.trim().length === 0 ? "No message" : message;
  }
  const list = entry?.recommendations ?? [];
  const first = list[0];
  if (first === undefined) return "None";
  return list.length > 1 ? `${first} And ${list.length - 1} more.` : first;
}

function HandoffTable({ group, caption, keyHead, labelHead, sharesHead, detailHead, labelOf, openDrawer }: {
  group: RiHandoffGroup;
  caption: string;
  keyHead: string;
  labelHead: string;
  sharesHead?: string;
  detailHead: string;
  labelOf: (target: RiHandoffTarget) => string;
  openDrawer: (ctx: RiDrawerContext) => void;
}): JSX.Element {
  const { ri } = useRiWorkbook();
  const targets = handoffTargets(ri).filter((t) => t.group === group);
  if (targets.length === 0) return <p className="posmuted">Nothing to hand off yet.</p>;
  return (
    <div className="ricriteria__table-wrap">
      <table className="postable ri-rowtable" aria-label={caption}>
        <thead>
          <tr>
            <th>{keyHead}</th><th>{labelHead}</th>{sharesHead !== undefined && <th>{sharesHead}</th>}<th>Test</th><th>Result</th><th>Sent as</th><th>{detailHead}</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => {
            const entry = handoffEntryOf(ri, t.group, t.key);
            return (
              <tr key={t.key}>
                <td className="ri-rowtable__wrap">
                  <button type="button" className="ri-rowtable__name" onClick={() => openDrawer({ kind: "handoff", id: handoffDrawerId(t.group, t.key) })}>{t.key}</button>
                </td>
                <td className="ri-rowtable__wrap">{labelOf(t)}</td>
                {sharesHead !== undefined && <td className="ri-rowtable__wrap">{t.shares}</td>}
                <td className="ri-rowtable__wrap">{t.basis}</td>
                <td>{LEVEL_TEXT[t.derived]}</td>
                <td>{LEVEL_TEXT[entry?.riskSignificance ?? t.derived]}</td>
                <td className="ri-rowtable__wrap">{handoffDetail(t, entry)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HandoffMessageCard({ receiver }: { receiver: RiHandoffReceiver }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title={`Message to ${receiver}`} level={3} />
        <RiProvenanceChip>RI-D1</RiProvenanceChip>
      </div>
      <div className="ri-form ri-form--card">
        <FormRow label="Message" htmlFor={fieldId} top>
          <WorkbookTextarea
            id={fieldId}
            className="posfield__textarea"
            rows={2}
            fitContent
            value={handoffMessageOf(ri, receiver)}
            disabled={!editable}
            onChange={(e) => {
              if (!editable) return;
              const text = e.target.value;
              mutateRi((d) => withHandoffMessage(d, receiver, text));
            }}
          />
        </FormRow>
      </div>
    </div>
  );
}

function HandoffGroupCard({ title, sr, note, children }: { title: string; sr: string; note: string; children: ReactNode }): JSX.Element {
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title={title} level={3} />
        <RiProvenanceChip>{sr}</RiProvenanceChip>
      </div>
      <p className="ri-step__note">{note}</p>
      {children}
    </div>
  );
}

function HandoffSummary({ onOpenTab, openDrawer }: { onOpenTab: (tab: HandoffTab) => void; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const targets = handoffTargets(ri);
  const changes = handoffChangeCount(ri);
  const issues = handoffIssues(ri);
  const sentOn = ri.riskIntegrationFeedbackDispatch?.dispatchDate;
  const counts = (list: RiHandoffTarget[]): Record<ImportanceLevel, number> => {
    const out: Record<ImportanceLevel, number> = { [ImportanceLevel.HIGH]: 0, [ImportanceLevel.MEDIUM]: 0, [ImportanceLevel.LOW]: 0 };
    for (const t of list) out[handoffLevelOf(ri, t)] += 1;
    return out;
  };
  const receiverTabs: Record<RiHandoffReceiver, HandoffTab> = { ESQ: "esq", MS: "ms", RC: "rc" };
  const rows: { code: string; list: RiHandoffTarget[]; message: string; open: () => void }[] = [
    ...HANDOFF_RECEIVERS.map((receiver) => ({
      code: receiver,
      list: targets.filter((t) => handoffReceiverOf(t.group) === receiver),
      message: handoffMessageOf(ri, receiver),
      open: () => onOpenTab(receiverTabs[receiver]),
    })),
    ...HANDOFF_ELEMENTS.map((code) => ({
      code,
      list: targets.filter((t) => t.group === "element" && t.key === code),
      message: handoffEntryOf(ri, "element", code)?.generalFeedback ?? "",
      open: () => openDrawer({ kind: "handoff", id: handoffDrawerId("element", code) }),
    })),
  ];
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title="Hand-off record" level={3} />
        <div className="posrow" style={{ gap: 10 }}>
          <RiProvenanceChip>RI-B6 · D1</RiProvenanceChip>
          {editable && changes > 0 && (
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateRi((d) => withHandoffsUpdated(d))}>Update {changes} from Steps 04 to 06</button>
          )}
          {editable && ri.inputs !== undefined && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => mutateRi((d) => withHandoffSent(d, new Date().toISOString()))}>Record as sent</button>
          )}
        </div>
      </div>
      <p className="ri-step__note">{handoffRuleText(ri)} {sentOn === undefined || sentOn.trim().length === 0 ? "Not sent yet." : `Sent ${new Date(sentOn).toLocaleDateString()}.`}</p>
      {ri.inputs === undefined ? (
        <p className="posmuted">Nothing is imported yet. Import the families in Step 02 first.</p>
      ) : (
        <div className="ricriteria__table-wrap">
          <table className="postable ri-rowtable" aria-label="Hand-offs by receiving element">
            <thead><tr><th>Element</th><th>Name</th><th>Items</th><th>High</th><th>Medium</th><th>Low</th><th>Message</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const level = counts(row.list);
                return (
                  <tr key={row.code}>
                    <td><button type="button" className="ri-rowtable__name" onClick={row.open}>{row.code}</button></td>
                    <td className="ri-rowtable__wrap">{ELEMENT_NAME_BY_CODE[row.code] ?? row.code}</td>
                    <td>{row.list.length}</td>
                    <td>{level[ImportanceLevel.HIGH]}</td>
                    <td>{level[ImportanceLevel.MEDIUM]}</td>
                    <td>{level[ImportanceLevel.LOW]}</td>
                    <td className="ri-rowtable__wrap">{row.message.trim().length === 0 ? "No message" : row.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {issues.length > 0 && <p className="ri-inputs__meta">To complete the hand-off: {issues.slice(0, 6).join(" ")}{issues.length > 6 ? ` And ${issues.length - 6} more.` : ""}</p>}
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: RiReceipt }): JSX.Element {
  const { ri } = useRiWorkbook();
  const name = ELEMENT_NAME_BY_CODE[receipt.receiver] ?? receipt.receiver;
  const match = (row: RiReceiptRow): string => {
    if (row.sent === undefined) return "Not sent";
    if (row.recorded === undefined) return "Not recorded";
    return row.sent === row.recorded ? "Same" : "Differs";
  };
  const differs = receipt.rows.filter((row) => match(row) === "Differs");
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RI" title={name} level={3} />
        <RiProvenanceChip>{receipt.receiver}</RiProvenanceChip>
      </div>
      {!receipt.linked ? (
        <p className="posmuted">Not linked in Step 01.</p>
      ) : !receipt.loaded ? (
        <p className="posmuted">The linked workbook is not read yet.</p>
      ) : !receipt.recorded ? (
        <p className="posmuted">{receipt.receiver} has recorded no feedback from RI yet.</p>
      ) : (
        <>
          <p className="ri-step__note">
            {receipt.recordedOn === undefined ? "Recorded" : `Recorded ${new Date(receipt.recordedOn).toLocaleDateString()}`} for {receipt.analysisRef}
            {receipt.analysisRef !== undefined && receipt.analysisRef !== ri.uuid ? `, which is not this workbook (${ri.uuid}).` : "."}
            {differs.length > 0 ? ` ${differs.length} of its levels differ from what RI sends now.` : " Every recorded level matches what RI sends."}
          </p>
          {receipt.rows.length > 0 && (
            <div className="ricriteria__table-wrap">
              <table className="postable ri-rowtable" aria-label={`What ${receipt.receiver} recorded`}>
                <thead><tr><th>Item</th><th>Kind</th><th>RI sends</th><th>{receipt.receiver} records</th><th>Match</th><th>Status</th></tr></thead>
                <tbody>
                  {receipt.rows.map((row) => (
                    <tr key={`${row.group}:${row.key}`}>
                      <td className="ri-rowtable__wrap">{row.key}</td>
                      <td>{HANDOFF_GROUP_KINDS[row.group]}</td>
                      <td>{row.sent === undefined ? "—" : LEVEL_TEXT[row.sent]}</td>
                      <td>{row.recorded === undefined ? "—" : LEVEL_TEXT[row.recorded]}</td>
                      <td>{match(row)}</td>
                      <td>{row.status === undefined ? "—" : RESPONSE_STATUS_TEXT[row.status] ?? row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {receipt.response === undefined ? (
            <p className="ri-inputs__meta">{receipt.receiver} has not responded yet.</p>
          ) : (
            <>
              <h4 className="ri-step__subhead">Response, {(RESPONSE_STATUS_TEXT[receipt.response.status] ?? receipt.response.status).toLowerCase()}</h4>
              <p className="ri-step__note">{receipt.response.description}</p>
              {receipt.response.changes.length > 0 && (
                <div className="ricriteria__table-wrap">
                  <table className="postable ri-rowtable" aria-label={`Changes ${receipt.receiver} reports`}>
                    <thead><tr><th>Changes {receipt.receiver} reports</th></tr></thead>
                    <tbody>
                      {receipt.response.changes.map((change) => <tr key={change}><td className="ri-rowtable__wrap">{change}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function HandoffDrawer({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const fieldId = useId();
  const parsed = parseHandoffId(id);
  const target = parsed === undefined ? undefined : handoffTargets(ri).find((t) => t.group === parsed.group && t.key === parsed.key);
  if (target === undefined) return null;
  const entry = handoffEntryOf(ri, target.group, target.key);
  const level = entry?.riskSignificance ?? target.derived;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const lines = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  function write(next: RiHandoffEntry): void {
    if (!editable || target === undefined) return;
    const group = target.group;
    const key = target.key;
    const derived = target.derived;
    const insight = target.insight;
    mutateRi((d) => {
      const current = handoffEntryOf(d, group, key) ?? { riskSignificance: derived, insights: [insight] };
      return withHandoffEntry(d, group, key, { ...current, riskSignificance: current.riskSignificance ?? derived, ...next });
    });
  }
  const cap = target.group === "element" ? `Hand-off to ${target.key} · RI-B6 · D1` : `${HANDOFF_GROUP_CAPS[target.group]} · RI-B6 · D1`;
  const title = target.group === "element" ? target.label : target.key;
  return (
    <>
      <DrawerHead cap={cap} title={title} onClose={onClose} />
      <div className="modal__body ri-form">
        <FormRow label="Sent as" htmlFor={fid("level")}>
          <select
            id={fid("level")}
            className="posfield__select"
            value={level}
            disabled={dis}
            onChange={(e) => {
              const next = LEVEL_OPTIONS.find((l) => l === e.target.value);
              if (next !== undefined) write({ riskSignificance: next });
            }}
          >
            {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{LEVEL_TEXT[l]}</option>)}
          </select>
        </FormRow>
        {level !== target.derived && (
          <FormRow label="Reason for the level" htmlFor={fid("reason")} top>
            <WorkbookTextarea id={fid("reason")} className="posfield__textarea" rows={2} fitContent value={entry?.significanceReason ?? ""} disabled={dis} onChange={(e) => write({ significanceReason: e.target.value })} />
          </FormRow>
        )}
        {target.group === "element" && (
          <FormRow label="Message" htmlFor={fid("message")} top>
            <WorkbookTextarea id={fid("message")} className="posfield__textarea" rows={2} fitContent value={entry?.generalFeedback ?? ""} disabled={dis} onChange={(e) => write({ generalFeedback: e.target.value })} />
          </FormRow>
        )}
        <FormRow label="Insights" htmlFor={fid("insights")} top>
          <WorkbookTextarea id={fid("insights")} className="posfield__textarea" rows={2} fitContent value={(entry?.insights ?? [target.insight]).join("\n")} disabled={dis} onChange={(e) => write({ insights: lines(e.target.value) })} />
        </FormRow>
        {target.group === "sourceTerm" ? (
          <FormRow label="Key uncertainties" htmlFor={fid("uncertainties")} top>
            <WorkbookTextarea id={fid("uncertainties")} className="posfield__textarea" rows={2} fitContent value={(entry?.keyUncertainties ?? []).join("\n")} disabled={dis} onChange={(e) => write({ keyUncertainties: lines(e.target.value) })} />
          </FormRow>
        ) : (
          <FormRow label="Recommendations" htmlFor={fid("recommendations")} top>
            <WorkbookTextarea id={fid("recommendations")} className="posfield__textarea" rows={2} fitContent value={(entry?.recommendations ?? []).join("\n")} disabled={dis} onChange={(e) => write({ recommendations: lines(e.target.value) })} />
          </FormRow>
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && level !== target.derived && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => write({ riskSignificance: target.derived })}>Use the test result</button>
        )}
      </FormFoot>
    </>
  );
}

function HandoffsScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, upstream } = useRiWorkbook();
  const [tab, setTab] = useState<HandoffTab>("summary");
  const tabId = useId();
  const imported = ri.inputs !== undefined;
  const rule = handoffRuleText(ri);
  const tabs: { id: HandoffTab; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "esq", label: "ESQ" },
    { id: "ms", label: "MS" },
    { id: "rc", label: "RC" },
    { id: "elements", label: "Other elements" },
    { id: "responses", label: "Responses" },
  ];
  const notImported = <div className="poscard"><p className="posmuted">Nothing is imported yet. Import the families in Step 02 first.</p></div>;
  return (
    <div className="ri-step">
      <RiTabs label="Hand-off sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="ri-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        {tab === "summary" ? (
          <HandoffSummary onOpenTab={setTab} openDrawer={openDrawer} />
        ) : tab === "responses" ? (
          handoffReceipts(ri, upstream).map((receipt) => <ReceiptCard key={receipt.receiver} receipt={receipt} />)
        ) : !imported ? (
          notImported
        ) : tab === "esq" ? (
          <>
            <HandoffGroupCard title="Families" sr="RI-B6" note={`${rule} Each family's test uses Steps 04 and 05.`}>
              <HandoffTable group="family" caption="Family hand-offs" keyHead="Family" labelHead="Name" sharesHead="Share" detailHead="Recommendation" labelOf={(t) => t.label} openDrawer={openDrawer} />
            </HandoffGroupCard>
            <HandoffGroupCard title="Contributors" sr="RI-B6" note="The contributors, valued on each total as in Step 06.">
              <HandoffTable group="contributor" caption="Contributor hand-offs" keyHead="Contributor" labelHead="Type" sharesHead="Share" detailHead="Recommendation" labelOf={(t) => contributorKindText(t.label)} openDrawer={openDrawer} />
            </HandoffGroupCard>
            <HandoffMessageCard receiver="ESQ" />
          </>
        ) : tab === "ms" ? (
          <>
            <HandoffGroupCard title="Release categories" sr="RI-B6" note={`${rule} A release category follows the families it holds.`}>
              <HandoffTable group="category" caption="Release category hand-offs" keyHead="Release category" labelHead="Families" sharesHead="Share" detailHead="Recommendation" labelOf={(t) => t.label} openDrawer={openDrawer} />
            </HandoffGroupCard>
            <HandoffGroupCard title="Source terms" sr="RI-B6" note="Each source term follows the release category it feeds.">
              <HandoffTable group="sourceTerm" caption="Source term hand-offs" keyHead="Source term" labelHead="Release category" detailHead="Key uncertainties" labelOf={(t) => t.label} openDrawer={openDrawer} />
            </HandoffGroupCard>
            <HandoffMessageCard receiver="MS" />
          </>
        ) : tab === "rc" ? (
          <>
            <HandoffGroupCard title="Measures" sr="RI-B6" note={`${rule} A measure is High when a risk-significant item is found through it.`}>
              <HandoffTable group="measure" caption="Measure hand-offs" keyHead="Measure" labelHead="Total" sharesHead="Largest category" detailHead="Recommendation" labelOf={(t) => t.label} openDrawer={openDrawer} />
            </HandoffGroupCard>
            <HandoffMessageCard receiver="RC" />
          </>
        ) : (
          <HandoffGroupCard title="Other elements" sr="RI-B6 · D1" note={`${rule} POS, IE and ES are High when a family they feed is risk-significant. SC follows the failed functions, and SY, HR and DA follow their contributors.`}>
            <HandoffTable group="element" caption="Element hand-offs" keyHead="Element" labelHead="Name" sharesHead="Largest item" detailHead="Message" labelOf={(t) => t.label} openDrawer={openDrawer} />
          </HandoffGroupCard>
        )}
      </div>
    </div>
  );
}

// ─── Plot axes, derived from the data so nothing can fall outside the box ───
interface Bounds {
  min: number;
  max: number;
  ticks: number[];
}

function decadeBounds(values: number[], extra: number[]): Bounds {
  const all = [...values, ...extra].filter((v) => v > 0 && Number.isFinite(v));
  if (all.length === 0) return { min: 1e-9, max: 1e0, ticks: [-9, -6, -3, 0] };
  const lo = Math.floor(log10(Math.min(...all)));
  const hi = Math.max(lo + 1, Math.ceil(log10(Math.max(...all))));
  const step = hi - lo > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e += step) ticks.push(e);
  return { min: Math.pow(10, lo), max: Math.pow(10, hi), ticks };
}

// ─── Label placement, so point names never sit on the line or on each other ──
interface LabelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type Anchor = "middle" | "start" | "end";

const LABEL_CANDIDATES: { dx: number; dy: number; anchor: Anchor }[] = [
  { dx: 0, dy: -13, anchor: "middle" },
  { dx: 0, dy: 18, anchor: "middle" },
  { dx: 12, dy: 4, anchor: "start" },
  { dx: -12, dy: 4, anchor: "end" },
  { dx: 12, dy: -9, anchor: "start" },
  { dx: -12, dy: -9, anchor: "end" },
  { dx: 12, dy: 16, anchor: "start" },
  { dx: -12, dy: 16, anchor: "end" },
  { dx: 0, dy: -25, anchor: "middle" },
  { dx: 0, dy: 30, anchor: "middle" },
];

const FAR_LABEL_CANDIDATES: { dx: number; dy: number; anchor: Anchor }[] = [1, 2, 3, 4, 5].flatMap((step) => {
  const d = 22 + step * 12;
  const k = Math.round(d * 0.7);
  return [
    { dx: 0, dy: -d, anchor: "middle" as const },
    { dx: 0, dy: d + 5, anchor: "middle" as const },
    { dx: d, dy: 4, anchor: "start" as const },
    { dx: -d, dy: 4, anchor: "end" as const },
    { dx: k, dy: -k, anchor: "start" as const },
    { dx: -k, dy: -k, anchor: "end" as const },
    { dx: k, dy: k + 4, anchor: "start" as const },
    { dx: -k, dy: k + 4, anchor: "end" as const },
  ];
});

function labelBox(x: number, y: number, text: string, anchor: Anchor): LabelBox {
  const w = text.length * 5.4 + 4;
  const h = 11;
  const x1 = anchor === "middle" ? x - w / 2 : anchor === "start" ? x : x - w;
  return { x1, y1: y - h + 2, x2: x1 + w, y2: y + 2 };
}

function boxesHit(a: LabelBox, b: LabelBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

interface Frame {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function insidePlot(b: LabelBox, f: Frame): boolean {
  return b.x1 >= f.left && b.x2 <= f.right && b.y1 >= f.top && b.y2 <= f.bottom;
}

function clampInto(x: number, y: number, text: string, anchor: Anchor, f: Frame): { x: number; y: number } {
  const b = labelBox(x, y, text, anchor);
  let dx = 0;
  let dy = 0;
  if (b.x1 < f.left) dx = f.left - b.x1;
  else if (b.x2 > f.right) dx = f.right - b.x2;
  if (b.y1 < f.top) dy = f.top - b.y1;
  else if (b.y2 > f.bottom) dy = f.bottom - b.y2;
  return { x: x + dx, y: y + dy };
}

interface PlacedLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  anchor: Anchor;
  leader?: { x: number; y: number };
}

function freeSpot(it: { id: string; text: string; cx: number; cy: number }, candidates: { dx: number; dy: number; anchor: Anchor }[], taken: LabelBox[], frame: Frame): PlacedLabel | undefined {
  for (const cand of candidates) {
    const x = it.cx + cand.dx;
    const y = it.cy + cand.dy;
    const box = labelBox(x, y, it.text, cand.anchor);
    if (!insidePlot(box, frame)) continue;
    if (taken.some((t) => boxesHit(box, t))) continue;
    return { id: it.id, text: it.text, x, y, anchor: cand.anchor };
  }
  return undefined;
}

function placeLabels(
  items: { id: string; text: string; cx: number; cy: number; optional?: boolean }[],
  obstacles: LabelBox[],
  frame: Frame,
): PlacedLabel[] {
  const taken: LabelBox[] = [...obstacles];
  const placed: PlacedLabel[] = [];
  for (const it of items) {
    let best = freeSpot(it, LABEL_CANDIDATES, taken, frame);
    if (best === undefined && it.optional === true) continue;
    if (best === undefined && it.optional === false) {
      const far = freeSpot(it, FAR_LABEL_CANDIDATES, taken, frame);
      if (far !== undefined) best = { ...far, leader: { x: it.cx, y: it.cy } };
    }
    if (best === undefined) {
      const cand = LABEL_CANDIDATES[0];
      const c = clampInto(it.cx + cand.dx, it.cy + cand.dy, it.text, cand.anchor, frame);
      best = { id: it.id, text: it.text, x: c.x, y: c.y, anchor: cand.anchor };
    }
    taken.push(labelBox(best.x, best.y, best.text, best.anchor));
    placed.push(best);
  }
  return placed;
}

// ─── The frequency-consequence plot (RI-B2 b) ──────────────────────────────
function FCPlot({ points, axisLabel }: { points: FcPointView[]; axisLabel: string }): JSX.Element {
  const W = 480;
  const H = 360;
  const x0 = 46;
  const x1 = 466;
  const yTop = 16;
  const yBot = 320;
  const { targetFrom, targetTo } = FC_META;
  const xb = decadeBounds(points.map((p) => p.consequence), [targetFrom.dose, targetTo.dose]);
  const yb = decadeBounds(points.map((p) => p.freq), [targetFrom.freq, targetTo.freq]);
  const mx = (d: number): number => scaleLog(d, xb.min, xb.max, x0, x1);
  const my = (f: number): number => scaleLog(f, yb.min, yb.max, yBot, yTop);

  const tx1 = mx(targetFrom.dose);
  const ty1 = my(targetFrom.freq);
  const tx2 = mx(targetTo.dose);
  const ty2 = my(targetTo.freq);

  const obstacles: LabelBox[] = [];
  for (let i = 0; i <= 60; i += 1) {
    const t = i / 60;
    const px = tx1 + (tx2 - tx1) * t;
    const py = ty1 + (ty2 - ty1) * t;
    obstacles.push({ x1: px - 4, y1: py - 4, x2: px + 4, y2: py + 4 });
  }
  for (const p of points) {
    const r = p.sig === "HIGH" ? 10 : 8.5;
    obstacles.push({ x1: mx(p.consequence) - r, y1: my(p.freq) - r, x2: mx(p.consequence) + r, y2: my(p.freq) + r });
  }

  const ordered = [...points].sort((a, b) => b.freq - a.freq);
  const labels = placeLabels(
    ordered.map((p) => ({ id: p.id, text: p.name, cx: mx(p.consequence), cy: my(p.freq) })),
    obstacles,
    { left: x0 + 3, right: x1 - 3, top: yTop + 2, bottom: yBot - 3 },
  );

  return (
    <svg className="rifc__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Frequency-consequence plot">
      {xb.ticks.map((p) => (<line key={`gx${p}`} className="rifc__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
      {yb.ticks.map((p) => (<line key={`gy${p}`} className="rifc__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
      <line className="rifc__target" x1={tx1} y1={ty1} x2={tx2} y2={ty2} />
      <line className="rifc__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
      <line className="rifc__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
      {xb.ticks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
      {yb.ticks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
      <text className="rifc__axlab" x={(x0 + x1) / 2} y={H - 2} textAnchor="middle">{axisLabel}</text>
      <text className="rifc__axlab" x={-((yTop + yBot) / 2)} y={12} textAnchor="middle" transform="rotate(-90 0 0)">Frequency (per yr)</text>
      {points.map((pt) => {
        const cls = pt.sig === "HIGH" ? "high" : pt.sig === "MEDIUM" ? "medium" : "low";
        return <circle key={pt.id} className={`rifc__pt rifc__pt--${cls}`} cx={mx(pt.consequence)} cy={my(pt.freq)} r={pt.sig === "HIGH" ? 8 : 6.5} />;
      })}
      {labels.map((l) => (
        <text key={l.id} className="rifc__lab" x={l.x} y={l.y} textAnchor={l.anchor}>{l.text}</text>
      ))}
    </svg>
  );
}

// ─── The exceedance-frequency curve (RI-B2 c, CCDF) ────────────────────────
function CCDFCurve({ points, axisLabel }: { points: { dose: number; exceed: number }[]; axisLabel: string }): JSX.Element {
  const W = 430;
  const H = 250;
  const x0 = 52;
  const x1 = 416;
  const yTop = 16;
  const yBot = 212;
  const xb = decadeBounds(points.map((p) => p.dose), []);
  const yb = decadeBounds(points.map((p) => p.exceed), []);
  const mx = (d: number): number => scaleLog(d, xb.min, xb.max, x0, x1);
  const my = (f: number): number => scaleLog(f, yb.min, yb.max, yBot, yTop);
  const pts = points.map((p) => `${mx(p.dose)},${my(p.exceed)}`).join(" ");
  return (
    <svg className="riccdf__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Exceedance-frequency curve">
      {xb.ticks.map((p) => (<line key={`gx${p}`} className="riccdf__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
      {yb.ticks.map((p) => (<line key={`gy${p}`} className="riccdf__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
      <polyline className="riccdf__curve" points={pts} />
      <line className="riccdf__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
      <line className="riccdf__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
      {xb.ticks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
      {yb.ticks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
      <text className="riccdf__lab" x={(x0 + x1) / 2} y={H - 2} textAnchor="middle">{axisLabel}</text>
      <text className="riccdf__lab" x={-((yTop + yBot) / 2)} y={12} textAnchor="middle" transform="rotate(-90 0 0)">Exceedance frequency (per yr)</text>
      {points.map((p, i) => (<circle key={i} className="riccdf__pt" cx={mx(p.dose)} cy={my(p.exceed)} r="3.5" />))}
    </svg>
  );
}

// ─── 03 — Integrate & Compute (HLR-RI-B) ───────────────────────────────────
function nextRimId(list: { uuid: string }[]): string {
  const n = list.reduce((m, x) => {
    const v = Number(x.uuid.split("-").pop());
    return Number.isNaN(v) ? m : Math.max(m, v);
  }, 0) + 1;
  return `RIM-${String(n)}`;
}

function nextMetricId(list: { uuid: string }[]): string {
  const n = list.reduce((m, x) => {
    const v = Number(x.uuid.split("-").pop());
    return Number.isNaN(v) ? m : Math.max(m, v);
  }, 0) + 1;
  return `METRIC-${String(n)}`;
}

function IntegrateScreen({ ccId, openDrawer }: { ccId: string; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi, riskSources } = useRiWorkbook();
  const isCcOne = ccId === "cc-i";
  const results = ri.integratedRiskResults;
  const approach = results.calculationApproach;
  const measures = ri.scopeDefinition.consequenceMeasures;
  const plotMeasure = measures[0]?.name ?? "";
  const fcPoints = fcPointsView(ri, plotMeasure);
  const ccdfPoints = ccdfPointsView(ri, plotMeasure);
  const availableFamilySources = riskSources.eventSequenceFamilies.filter((source) => {
    const linked = sourcesForEventSequenceFamily(riskSources, source);
    return linked.quantifications.length > 0 && linked.consequence !== undefined;
  });
  const [selectedFamilySource, setSelectedFamilySource] = useState("");

  const families = ri.compiledRiskInputs.length;
  const approachBlocks: { label: string; detail: string }[] = [];
  if (approach.sumOfProducts === true) {
    approachBlocks.push({
      label: "Sum of products",
      detail: `${results.metrics.length} risk metric${results.metrics.length === 1 ? "" : "s"} totaled across ${families} compiled famil${families === 1 ? "y" : "ies"}.`,
    });
  }
  if (approach.frequencyConsequencePlots === true) {
    approachBlocks.push({
      label: "Frequency-consequence plot",
      detail: `${fcPoints.length} famil${fcPoints.length === 1 ? "y" : "ies"} plotted against the frequency-consequence target.`,
    });
  }
  if (approach.exceedanceFrequencyCurves === true) {
    approachBlocks.push({
      label: "Exceedance-frequency curve",
      detail: isCcOne
        ? "Not required while the workbook targets CC-I."
        : `${ccdfPoints.length} exceedance level${ccdfPoints.length === 1 ? "" : "s"} drawn from the compiled families.`,
    });
  }
  if (approach.alternativeApproach !== undefined && approach.alternativeApproach.length > 0) {
    approachBlocks.push({ label: "Alternative approach", detail: approach.alternativeApproach });
  }

  function addMethod(): void {
    if (!editable) return;
    const uuid = nextRimId(ri.integrationMethods);
    mutateRi((draft) => ({
      ...draft,
      integrationMethods: [...draft.integrationMethods, {
        uuid,
        name: "New integration method",
        description: "",
        scopeJustification: "",
        verificationStatus: { verified: false },
        implementsSrs: [{ sr: "RI-B2", hlr: "B" as const }, { sr: "RI-B7", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "method", id: uuid });
  }

  function addMetric(): void {
    if (!editable) return;
    const uuid = nextMetricId(results.metrics);
    mutateRi((draft) => ({
      ...draft,
      integratedRiskResults: {
        ...draft.integratedRiskResults,
        metrics: [...draft.integratedRiskResults.metrics, {
          uuid,
          name: "New risk metric",
          metricType: "CUSTOM",
          consequenceMeasureRef: measures[0]?.name ?? "",
          value: 0,
          units: "per plant-year",
          implementsSrs: [{ sr: "RI-B2", hlr: "B" as const }],
        }],
      },
    }));
    openDrawer({ kind: "metric", id: uuid });
  }

  function addLinkedInput(): void {
    if (!editable) return;
    const sourceKey = selectedFamilySource.length > 0
      ? selectedFamilySource
      : availableFamilySources[0] === undefined
        ? ""
        : `${availableFamilySources[0].workbookId}|${availableFamilySources[0].family.uuid}`;
    const familySource = availableFamilySources.find((source) =>
      `${source.workbookId}|${source.family.uuid}` === sourceKey);
    if (familySource === undefined) return;
    const existing = ri.compiledRiskInputs.find((input) =>
      input.eventSequenceFamilyReference?.workbookId === familySource.workbookId &&
      input.eventSequenceFamilyReference.entityId === familySource.family.uuid);
    if (existing !== undefined) {
      openDrawer({ kind: "family", id: existing.uuid });
      return;
    }
    const linked = sourcesForEventSequenceFamily(riskSources, familySource);
    if (linked.quantifications.length === 0 || linked.consequence === undefined) return;
    const baseId = `RII-${familySource.family.uuid}`;
    const uuid = ri.compiledRiskInputs.some((input) => input.uuid === baseId)
      ? `${baseId}-${String(ri.compiledRiskInputs.length + 1)}`
      : baseId;
    const consequences = measures.flatMap((measure) => {
      const result = linked.consequence!.result.consequenceResults.find((entry) =>
        consequenceMetricMatches(entry.metric, measure.name));
      return result === undefined ? [] : [{
        metric: measure.name,
        meanValue: result.meanValue,
        unit: result.unit,
        distribution: result.uncertaintyDistribution,
      }];
    });
    const input: CompiledRiskInput = {
      uuid,
      eventSequenceFamilyRef: familySource.family.uuid,
      eventSequenceFamilyReference: familySource.reference,
      releaseCategoryRef: familySource.family.releaseCategoryIds?.[0],
      sourceTermDefinitionRef: familySource.family.representativeSourceTermId,
      frequency: linked.quantifications.reduce(
        (sum, source) => sum + meanFrequencyValue(source.quantification.meanFrequency),
        0,
      ),
      frequencyUnit: "per plant-year",
      esqFamilyQuantificationRef: linked.quantifications.map((source) => source.quantification.uuid).join(" + "),
      familyQuantificationReferences: linked.quantifications.map((source) => source.reference),
      consequences: consequences.length > 0
        ? consequences
        : linked.consequence.result.consequenceResults.map((result) => ({
          metric: result.metric,
          meanValue: result.meanValue,
          unit: result.unit,
          distribution: result.uncertaintyDistribution,
        })),
      rcqRecordRef: linked.consequence.result.uuid,
      consequenceResultReference: linked.consequence.reference,
      consistentWithEventSequenceAnalysis: true,
      implementsSrs: [{ sr: "RI-B1", hlr: "B" }],
    };
    mutateRi((draft) => {
      const compiledRiskInputs = [...draft.compiledRiskInputs, input];
      return {
        ...draft,
        scopeDefinition: {
          ...draft.scopeDefinition,
          eventSequenceFamilyRefs: [...new Set([
            ...(draft.scopeDefinition.eventSequenceFamilyRefs ?? []),
            input.eventSequenceFamilyRef,
          ])],
        },
        compiledRiskInputs,
        integratedRiskResults: {
          ...draft.integratedRiskResults,
          metrics: draft.integratedRiskResults.metrics.map((metric) => ({
            ...metric,
            value: metric.consequenceMeasureRef === undefined
              ? metric.value
              : compiledRiskInputs.reduce((sum, compiled) => {
                const result = compiled.consequences.find((entry) =>
                  consequenceMetricMatches(entry.metric, metric.consequenceMeasureRef!));
                return sum + compiled.frequency * (result?.meanValue ?? 0);
              }, 0),
          })),
        },
      };
    });
    openDrawer({ kind: "family", id: uuid });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Calculation approach" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <Badge kind="progress">{results.calculationLevel === "MEAN" ? "Mean" : "Point estimate"}</Badge>
            <RiProvenanceChip>RI-B2</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "calc", id: "calc" })}><RIIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The integrated risk is totaled, plotted and, at CC-II, drawn as an exceedance curve. These are the routes this integration takes.</p>
        {approachBlocks.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No calculation approach recorded yet.</p>
        ) : (
          <div className="rimeasure">
            {approachBlocks.map((a, i) => (
              <div key={a.label} className="rimeasure__cell">
                <span className="rinum">{i + 1}</span>
                <div className="rimeasure__main">
                  <div className="rimeasure__name">{a.label}</div>
                  <div className="rimeasure__note">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {approach.justification.length > 0 && (
          <p className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "12px 0 0" }}>{approach.justification}</p>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Methods and codes" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-B7</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMethod}><RIIcon.Plus /> Add method</button>}
          </div>
        </div>
        <p className="poscard__sub">The integration methods and codes are identified with their scope of applicability and their verification. Select a row to edit it.</p>
        {ri.integrationMethods.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No integration methods recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Method</th><th>Scope of applicability</th><th>Verification</th></tr></thead>
            <tbody>
              {ri.integrationMethods.map((m) => (
                <tr key={m.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "method", id: m.uuid })}>
                  <td>
                    <div className="postable__name">{m.name}</div>
                    <span className="possubtle" style={{ fontSize: 12 }}>{m.description ?? ""}</span>
                  </td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{m.scopeJustification}</td>
                  <td>{m.verificationStatus?.verified === true ? <Badge kind="ok">Verified</Badge> : <Badge kind="warn">Not verified</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Frequency-consequence plot" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-B2</RiProvenanceChip>
          </div>
        </div>
        {editable && availableFamilySources.length > 0 && (
          <div className="posrow" style={{ gap: 8, alignItems: "center", marginBottom: 14 }}>
            <select
              className="posfield__select"
              aria-label="Linked risk input family"
              value={selectedFamilySource}
              onChange={(event) => setSelectedFamilySource(event.target.value)}
              style={{ flex: 1 }}
            >
              {availableFamilySources.map((source) => (
                <option key={`${source.workbookId}|${source.family.uuid}`} value={`${source.workbookId}|${source.family.uuid}`}>
                  {source.family.uuid} · {source.family.name} · {source.family.endState} — {source.workbookName}
                </option>
              ))}
            </select>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addLinkedInput}><RIIcon.Plus /> Add linked input</button>
          </div>
        )}
        <p className="poscard__sub">Every family plots its consequence against its frequency, and the target is the diagonal the families are judged against. Select a family to edit it.</p>
        {fcPoints.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No families compiled yet.</p>
        ) : (
          <>
            <div className="rifc__legend rifc__legend--top">
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--high" /> High significance</div>
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--medium" /> Medium significance</div>
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--low" /> Low significance</div>
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--target" /> Frequency-consequence target</div>
            </div>
            <div className="rifc__center">
              <div className="rifc__plot"><FCPlot points={fcPoints} axisLabel={plotMeasure} /></div>
            </div>
            <table className="postable postable--mid" style={{ marginTop: 14 }}>
              <thead><tr><th>Family</th><th>Frequency</th><th>{plotMeasure}</th><th>Significance</th></tr></thead>
              <tbody>
                {fcPoints.map((p) => (
                  <tr key={p.id} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "family", id: p.id })}>
                    <td><div className="postable__name">{p.name}</div></td>
                    <td className="posmono">{valText(p.freq)} <span className="possubtle">per plant-year</span></td>
                    <td className="posmono">{valText(p.consequence)}</td>
                    <td>
                      {p.sig === "HIGH" && <Badge kind="block">High</Badge>}
                      {p.sig === "MEDIUM" && <Badge kind="warn">Medium</Badge>}
                      {p.sig === "LOW" && <Badge kind="draft">Low</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Exceedance-frequency curve" level={3} />
          <RiProvenanceChip>RI-B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The curve is built from the compiled families, giving the frequency of exceeding each level of {plotMeasure.length > 0 ? plotMeasure.toLowerCase() : "the consequence measure"}.</p>
        {isCcOne ? (
          <p className="posmuted" style={{ margin: 0 }}>The exceedance-frequency curve is a CC-II approach, so it is not required while the workbook targets CC-I.</p>
        ) : ccdfPoints.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No families compiled yet.</p>
        ) : (
          <>
            <div className="rifc__center"><div className="rifc__plot"><CCDFCurve points={ccdfPoints} axisLabel={plotMeasure} /></div></div>
            <table className="postable postable--mid" style={{ marginTop: 14 }}>
              <thead><tr><th>{plotMeasure} at or above</th><th>Exceedance frequency</th></tr></thead>
              <tbody>
                {[...ccdfPoints].reverse().map((p) => (
                  <tr key={p.dose}>
                    <td className="posmono">{valText(p.dose)}</td>
                    <td className="posmono">{valText(p.exceed)} <span className="possubtle">per plant-year</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RI" title="Integrated risk" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-B2</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMetric}><RIIcon.Plus /> Add metric</button>}
          </div>
        </div>
        <p className="poscard__sub">The integrated risk is the single number the whole standard has been assembling, judged against the target for the application. Select a row to edit it.</p>
        {results.metrics.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No risk metrics yet.</p>
        ) : (
          <>
            <table className="postable postable--mid">
              <thead><tr><th>Metric</th><th>Value</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>
                {results.metrics.map((m) => {
                  const roll = metricRollup(ri, m);
                  return (
                    <tr key={m.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "metric", id: m.uuid })}>
                      <td>
                        <div className="postable__name">{m.name}</div>
                        <span className="possubtle" style={{ fontSize: 12 }}>{m.consequenceMeasureRef !== undefined && m.consequenceMeasureRef.length > 0 ? `Sums ${m.consequenceMeasureRef.toLowerCase()}` : "No consequence measure linked"}</span>
                      </td>
                      <td className="posmono">{valText(m.value)} <span className="possubtle">{m.units}</span></td>
                      <td className="posmono">{roll.limit !== undefined ? valText(roll.limit) : "—"}</td>
                      <td>{roll.limit === undefined ? <Badge kind="draft">Reported</Badge> : roll.compliant ? <Badge kind="ok">Below target</Badge> : <Badge kind="warn">Check margin</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}

export {
  AggregationNoteDrawer,
  ApplicationScreen,
  CategoriesScreen,
  CliffEdgeDrawer,
  ContributorsScreen,
  SscAssignmentDrawer,
  UncertaintyStepScreen,
  UncertaintySourceDrawer,
  HandoffsScreen,
  HandoffDrawer,
  ScreenedItemDrawer,
  UncertaintyAnalysisDrawer,
  SensitivityStudyDrawer,
  FcScreen,
  IntegratedRiskScreen,
  InputsScreen,
  InputFamilyDrawer,
  InputSequenceDrawer,
  InputConsequenceDrawer,
  InputContributorDrawer,
  InputImportanceDrawer,
  InputGapDrawer,
  IntegrateScreen,
  MeasureDrawer,
  type RiDrawerContext,
};
