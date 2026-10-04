import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX, useId, useState } from "react";
import type {
  ComponentBoundary,
  ComponentGrouping,
  DataAnalysis,
  DataAnalysisParameter,
  DaBasicEventNeed,
  DaCcfGroupNeed,
  DaDataNeeds,
  DaDataPlan,
  DaHumanErrorNeed,
  DaInitiatorNeed,
  DaLinkCode,
  DaLinkedWorkbooks,
  DaManualEntry,
  DaNeedChange,
  DaNeedElement,
  DaScopeDecision,
  DaScopeKind,
  DaStateNeed,
  FailureModeType,
  OutlierComponent,
} from "interfaces-mef-types/da/data-analysis";
import { DAIcon } from "./daIcons";
import { Badge, DaProvenanceChip, DaTabs, FormFoot, FormRow, ModalHead, sciText } from "./daShared";
import { useDaWorkbook } from "./daWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  CCF_MODEL_LABELS,
  DA_LINK_TILES,
  DA_REQUIRED_SCOPE,
  DA_SCOPE_KINDS,
  DETECTABILITY_TEXT,
  FAILURE_MODE_CATEGORIES,
  FAILURE_MODE_TEXT,
  FREQUENCY_BASIS_TEXT,
  GROUPING_BASIS,
  HFE_TIMING_TEXT,
  NEED_ELEMENT_LABELS,
  NEED_ELEMENT_PROVIDES,
  NEED_KIND_LABELS,
  NEED_KINDS,
  OPERATING_MODE_TEXT,
  OUTLIER_STATUS_TEXT,
  QUANTIFICATION_MODELS,
  EVIDENCE_LADDER,
  PARAM_TYPES,
  ESTIMATION_APPROACH,
  DA_METHODS,
  exampleLinkLabel,
  type Stage,
} from "./daViewData";
import {
  COMPONENT_MODELS,
  NEED_ELEMENTS,
  basicEventEdited,
  daImportNeeds,
  daNeedChecks,
  daNeedsImportReady,
  daNeedsLinked,
  emptyNeeds,
  initiatorBand,
  mappableNeeds,
  modelSpecOf,
  modelsForNeed,
  needChangeOf,
  needManualCount,
  nextNeedId,
  nextParameterId,
  parameterFindings,
  parameterNeeds,
  parameterStates,
  parameterValueText,
  scopeDecisionOf,
  scopeItemsToComplete,
  stateShares,
  withAutoMapping,
  withLinkedValuesSynced,
  withNeedParameter,
  withNeeds,
  withOutlierGroup,
  withNeedsMerged,
  type DaFindingSeverity,
  type DaNeedFinding,
} from "./daSelectors";

interface DaDrawerContext {
  kind: "estimate" | "failuredef" | "demand" | "exposure" | "testcred" | "unavail" | "coincident" | "repair" | "recovery" | "outage" | "ccf" | "uncsource" | "preop" | "sens" | "datamod" | "needEvent" | "needInitiator" | "needHuman" | "needCcf" | "needState" | "daParameter" | "daBoundary" | "daFailureMode" | "daGroup" | "daOutlier" | "daSource" | "daEntry" | "daSourcing" | "daElicitation" | "daCatalog" | "daImport";
  id: string;
}

function MethodChips({ ids, label }: { ids: string[]; label?: string }): JSX.Element | null {
  const ms = ids.map((id) => DA_METHODS[id]).filter((m): m is (typeof DA_METHODS)[string] => m !== undefined);
  if (ms.length === 0) return null;
  return (
    <div className="hrmethods">
      {label !== undefined && <span className="hrmethods__label">{label}</span>}
      {ms.map((m) => (
        <span key={m.id} className="hrmethod-chip" title={`${m.name} · ${m.ref}`}>{m.abbr}</span>
      ))}
    </div>
  );
}

function ParamTypePill({ type }: { type: string }): JSX.Element {
  const t = PARAM_TYPES[type];
  return <span className={`daptype daptype--${t?.tone ?? "primary"}`}>{t?.short ?? type}</span>;
}

function RungPill({ approach }: { approach?: string }): JSX.Element {
  const a = approach !== undefined ? ESTIMATION_APPROACH[approach] : undefined;
  return <span className={`darung darung--${a?.rung ?? "generic"}`}>{a?.label ?? "Generic"}</span>;
}

function LadderPosition({ rung }: { rung: string }): JSX.Element {
  return (
    <div className="daladpos">
      {EVIDENCE_LADDER.map((r) => (
        <span key={r.id} className={`daladpos__rung daladpos__rung--${r.color}${r.color === rung ? " daladpos__rung--on" : ""}`} title={r.label}>{r.label}</span>
      ))}
    </div>
  );
}

const WORKBOOK_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  complete: "Complete",
};

const PLANT_STAGES: { id: Stage; title: string; body: string }[] = [
  { id: "pre_operational", title: "Pre-operational", body: "Generic sources, technology experience and planned schedules stand in for plant records. Every borrowing needs a reason." },
  { id: "operational", title: "Operational", body: "The plant's own failures, demands, hours and outages inside the data window update the generic estimates." },
];

function DaInterfaces(): JSX.Element {
  const { da, editable, mutateDa, upstream } = useDaWorkbook();
  const [selected, setSelected] = useState<DaLinkCode | null>("SY");
  const selectId = useId();
  const links: DaLinkedWorkbooks = da.linkedWorkbooks ?? {};
  const tile = DA_LINK_TILES.find((candidate) => candidate.code === selected);
  const options = tile === undefined ? [] : upstream.options[tile.code];
  const linkedId = tile === undefined ? undefined : links[tile.code];
  const linked = options.find((workbook) => workbook.id === linkedId);
  const exampleLabel = linkedId === undefined ? undefined : exampleLinkLabel(linkedId);
  const nothingToLink = options.length === 0 && exampleLabel === undefined;

  function onLink(code: DaLinkCode, id: string): void {
    if (!editable) return;
    mutateDa((draft) => {
      const current: DaLinkedWorkbooks = draft.linkedWorkbooks ?? {};
      const next: DaLinkedWorkbooks = {};
      for (const candidate of DA_LINK_TILES) {
        const value = candidate.code === code ? id : current[candidate.code];
        if (value !== undefined && value.length > 0) next[candidate.code] = value;
      }
      return { ...draft, linkedWorkbooks: next };
    });
  }

  return (
    <>
      <div className="poshandoff__grid da-scope-tiles">
        {DA_LINK_TILES.map((candidate) => (
          <button
            key={candidate.code}
            type="button"
            className={`poshandoff__tile${selected === candidate.code ? " poshandoff__tile--active" : ""}`}
            aria-pressed={selected === candidate.code}
            onClick={() => setSelected(selected === candidate.code ? null : candidate.code)}
          >
            <span className="poshandoff__tile-code">{candidate.label}</span>
            <span className="poshandoff__tile-name">{candidate.name}</span>
            <span className="poshandoff__tile-role">{candidate.handoff}</span>
          </button>
        ))}
      </div>
      {tile !== undefined && (
        <div className="da-scope-lane">
          <div className="da-scope-link">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select
              id={selectId}
              className="posfield__select"
              value={linkedId ?? ""}
              disabled={!editable || nothingToLink}
              onChange={(event) => onLink(tile.code, event.target.value)}
            >
              <option value="">{nothingToLink ? `No ${tile.label} workbooks in this project` : "Not linked"}</option>
              {exampleLabel !== undefined && linkedId !== undefined && <option value={linkedId}>{exampleLabel}</option>}
              {options.map((workbook) => <option key={workbook.id} value={workbook.id}>{workbook.name}</option>)}
            </select>
          </div>
          {linkedId !== undefined && linked === undefined && exampleLabel === undefined && (
            <p className="posmuted da-scope-note">The linked workbook is not in this project.</p>
          )}
          {exampleLabel !== undefined && (
            <table className="postable postable--mid" aria-label={`Linked ${tile.label} workbook`}>
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
            <table className="postable postable--mid" aria-label={`Linked ${tile.label} workbook`}>
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

function withScopeDecision(draft: DataAnalysis, kind: DaScopeKind, next: DaScopeDecision | undefined): DataAnalysis {
  const kept = (draft.scopeDecisions ?? []).filter((decision) => decision.kind !== kind);
  const decisions = next === undefined ? kept : [...kept, next];
  const ordered = DA_SCOPE_KINDS.flatMap((spec) => decisions.filter((decision) => decision.kind === spec.kind));
  return { ...draft, scopeDecisions: ordered };
}

function DaScopeTable(): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();

  function onInclusion(kind: DaScopeKind, value: string): void {
    if (!editable) return;
    const current = scopeDecisionOf(da, kind);
    mutateDa((draft) => withScopeDecision(draft, kind, value === ""
      ? undefined
      : value === "included"
        ? { kind, included: true }
        : { kind, included: false, exclusionReason: current?.exclusionReason ?? "" }));
  }

  function onReason(kind: DaScopeKind, reason: string): void {
    if (!editable) return;
    mutateDa((draft) => withScopeDecision(draft, kind, { kind, included: false, exclusionReason: reason }));
  }

  return (
    <div className="da-scope">
      <h4 className="da-scope__title">Parameters in scope</h4>
      <div className="da-scope__wrap">
        <table className="postable da-scope__table" aria-label="Parameters in scope">
          <thead><tr><th>Parameters</th><th>Requirements</th><th>Included?</th><th>Reason for exclusion</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>{DA_REQUIRED_SCOPE.label}</strong></td>
              <td className="da-scope__codes">{DA_REQUIRED_SCOPE.requirements}</td>
              <td>Required</td>
              <td>—</td>
            </tr>
            {DA_SCOPE_KINDS.map((spec) => {
              const decision = scopeDecisionOf(da, spec.kind);
              const state = decision === undefined ? "" : decision.included ? "included" : "excluded";
              const reason = decision?.exclusionReason ?? "";
              const reasonMissing = decision !== undefined && !decision.included && reason.trim().length === 0;
              return (
                <tr key={spec.kind}>
                  <td><strong>{spec.label}</strong></td>
                  <td className="da-scope__codes">{spec.requirements}</td>
                  <td>
                    <select className="posfield__select" aria-label={`${spec.label} inclusion`} value={state} disabled={!editable} onChange={(event) => onInclusion(spec.kind, event.target.value)}>
                      <option value="">Not set</option>
                      <option value="included">Included</option>
                      <option value="excluded">Excluded</option>
                    </select>
                  </td>
                  <td>
                    {decision !== undefined && !decision.included ? (
                      <>
                        <WorkbookInput
                          className="posfield__input"
                          aria-label={`${spec.label} exclusion reason`}
                          aria-invalid={reasonMissing}
                          value={reason}
                          disabled={!editable}
                          onChange={(event) => onReason(spec.kind, event.target.value)}
                        />
                        {reasonMissing && <span className="da-scope__error" role="alert">Reason required</span>}
                      </>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function linkedWorkbookLabel(id: string, options: readonly { id: string; name: string }[]): string {
  return options.find((workbook) => workbook.id === id)?.name ?? exampleLinkLabel(id) ?? "the linked workbook";
}

function DaDataPlanCard(): JSX.Element {
  const { da, editable, mutateDa, upstream } = useDaWorkbook();
  const plan: DaDataPlan = da.dataPlan ?? {};
  const fieldId = useId();
  const operational = da.plantStage === "OPERATIONAL";
  const ieId = da.linkedWorkbooks?.IE;
  const ieModules = upstream.ie?.metadata.plantIdentity?.numberOfModules;
  const modules = plan.modulesPerPlant;
  const link = modules?.link;
  const linkedToCurrent = link !== undefined && link.workbookId === ieId;
  const ieName = ieId === undefined ? undefined : linkedWorkbookLabel(ieId, upstream.options.IE);
  const windowStart = plan.dataWindowStart ?? "";
  const windowEnd = plan.dataWindowEnd ?? "";
  const windowBackwards = windowStart.length > 0 && windowEnd.length > 0 && windowStart >= windowEnd;

  function patchPlan(fields: Partial<DaDataPlan>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, dataPlan: { ...(draft.dataPlan ?? {}), ...fields } }));
  }

  function onModulesSource(value: string): void {
    if (value === "linked" && ieId !== undefined && ieModules !== undefined) {
      patchPlan({ modulesPerPlant: { value: ieModules, link: { element: "IE", workbookId: ieId, field: "numberOfModules" } } });
      return;
    }
    if (value === "typed") patchPlan({ modulesPerPlant: modules === undefined ? undefined : { value: modules.value } });
  }

  function onModulesTyped(text: string): void {
    const value = Number(text);
    if (text.trim().length === 0) {
      patchPlan({ modulesPerPlant: undefined });
      return;
    }
    if (Number.isInteger(value) && value >= 1) patchPlan({ modulesPerPlant: { value } });
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Data plan" level={3} />
        <DaProvenanceChip>DA-C3 · DA-E1 · IE-C</DaProvenanceChip>
      </div>
      <div className="da-form da-form--card">
        <FormRow label="Data freeze date" htmlFor={`${fieldId}-freeze`}>
          <WorkbookInput id={`${fieldId}-freeze`} className="posfield__input da-form__date" type="date" value={plan.freezeDate ?? ""} disabled={!editable}
            onChange={(event) => patchPlan({ freezeDate: event.target.value.length === 0 ? undefined : event.target.value })} />
        </FormRow>
        {operational && (
          <FormRow label="Data window" htmlFor={`${fieldId}-start`}>
            <WorkbookInput id={`${fieldId}-start`} className="posfield__input da-form__date" type="date" aria-label="Data window start" value={windowStart} disabled={!editable}
              onChange={(event) => patchPlan({ dataWindowStart: event.target.value.length === 0 ? undefined : event.target.value })} />
            <span className="da-form__unit">to</span>
            <WorkbookInput className="posfield__input da-form__date" type="date" aria-label="Data window end" value={windowEnd} disabled={!editable}
              onChange={(event) => patchPlan({ dataWindowEnd: event.target.value.length === 0 ? undefined : event.target.value })} />
            {windowBackwards && <span className="da-form__error" role="alert">End after the start</span>}
          </FormRow>
        )}
        <FormRow label="Modules per plant" htmlFor={`${fieldId}-modules`}>
          {link === undefined ? (
            <WorkbookInput id={`${fieldId}-modules`} className="posfield__input posmono da-form__number" type="number" min="1" step="1" value={modules?.value ?? ""} disabled={!editable}
              onChange={(event) => onModulesTyped(event.target.value)} />
          ) : (
            <span id={`${fieldId}-modules`} className="posmono da-form__value">{modules?.value}</span>
          )}
          {ieId === undefined && link === undefined ? (
            <span className="da-form__unit">Typed</span>
          ) : (
            <select className="posfield__select" aria-label="Modules per plant source" value={link === undefined ? "typed" : "linked"} disabled={!editable} onChange={(event) => onModulesSource(event.target.value)}>
              <option value="typed">Typed</option>
              {(link !== undefined || (ieId !== undefined && ieModules !== undefined)) && <option value="linked">Linked to IE · {link !== undefined && !linkedToCurrent ? linkedWorkbookLabel(link.workbookId, upstream.options.IE) : ieName}</option>}
            </select>
          )}
        </FormRow>
        {link !== undefined && !linkedToCurrent && (
          <p className="da-form__warn" role="status">
            This value is linked to an IE workbook that DA no longer links.
            {editable && ieId !== undefined && ieModules !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onModulesSource("linked")}>Link to {ieName} ({ieModules})</button>}
          </p>
        )}
        {linkedToCurrent && ieModules !== undefined && modules !== undefined && ieModules !== modules.value && (
          <p className="da-form__warn" role="status">
            The IE workbook now gives {ieModules} modules.
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onModulesSource("linked")}>Use {ieModules}</button>}
          </p>
        )}
      </div>
    </div>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage, documents }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  documents: JSX.Element | null;
}): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const todo = scopeItemsToComplete(da);

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateDa((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateDa((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <div className="da-step">
      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="DA" title="Interfaces" level={3} /></div>
        <DaInterfaces />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="DA" title="PRA scope" level={3} />
          <DaProvenanceChip>DA-A1</DaProvenanceChip>
        </div>
        <WorkbookTextarea
          className="posfield__textarea da-scope__text"
          aria-label="PRA scope"
          rows={3}
          fitContent
          value={da.praScope}
          disabled={!editable}
          onChange={(event) => onScopeChange(event.target.value)}
        />
        <DaScopeTable />
      </div>

      <DaDataPlanCard />

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="DA" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div className="da-scope-choices">
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className={`da-scope-choice${active ? " da-scope-choice--active" : ""}`} aria-pressed={active} disabled={!editable} onClick={() => onCcChange(c.id)}>
                <span className="da-scope-choice__head">
                  <span className="da-scope-choice__name">{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </span>
                <span className="da-scope-choice__desc">{c.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="DA" title="Plant stage" level={3} /></div>
        <div className="da-scope-choices">
          {PLANT_STAGES.map((option) => (
            <label key={option.id} className={`da-scope-choice${stage === option.id ? " da-scope-choice--active" : ""}`}>
              <span className="da-scope-choice__head">
                <WorkbookInput type="radio" name="da-stage" value={option.id} checked={stage === option.id} disabled={!editable} onChange={() => onStageChange(option.id)} />
                <span className="da-scope-choice__name">{option.title}</span>
              </span>
              <span className="da-scope-choice__desc">{option.body}</span>
            </label>
          ))}
        </div>
      </div>

      {documents}

      {todo.length > 0 && (
        <details className="da-todo">
          <summary>{todo.length} {todo.length === 1 ? "item" : "items"} to complete</summary>
          <ul>{todo.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

type NeedsTab = "events" | "initiators" | "human" | "ccf" | "states" | "checks";

const NEED_PAGE = 50;

const SEVERITY_TEXT: Record<DaFindingSeverity, string> = { error: "Error", warning: "Warning", note: "Note" };

const NEED_TAB_HEADS: Record<NeedsTab, { title: string; sr: string; add?: string }> = {
  events: { title: "Basic events", sr: "DA-A1 · DA-A3", add: "Add basic event" },
  initiators: { title: "Initiator groups", sr: "DA-A1 · IE-C1", add: "Add initiator group" },
  human: { title: "Human failure events", sr: "HR-D · HR-G", add: "Add human failure event" },
  ccf: { title: "Common cause groups", sr: "DA-D7", add: "Add common cause group" },
  states: { title: "Operating states", sr: "DA-C25", add: "Add operating state" },
  checks: { title: "Coverage checks", sr: "DA-A1" },
};

const OPERATING_MODES = ["POWER", "STARTUP", "SHUTDOWN", "REFUELING", "MAINTENANCE"];

function statText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function plainNumber(value: number | undefined): string {
  return value === undefined ? "—" : String(Number(value.toPrecision(6)));
}

function percentText(value: number | undefined): string {
  return value === undefined ? "—" : String(Number((value * 100).toPrecision(3)));
}

function countedList(items: readonly string[], shown: number): string {
  return items.length > shown ? `${items.slice(0, shown).join(", ")} and ${items.length - shown} more` : items.join(", ");
}

function listCell(items: readonly string[], noun: string): JSX.Element {
  if (items.length === 0) return <>—</>;
  if (items.length <= 2) return <>{items.join(", ")}</>;
  return <span title={items.join(", ")}>{items.length} {noun}</span>;
}

function heldByText(need: DaBasicEventNeed): string {
  if (need.manual !== undefined || need.valueHeldBy === undefined) return "—";
  if (need.valueHeldBy === "DA") return `DA · ${need.valueHolderId ?? ""}`;
  if (need.valueHeldBy === "HRA") return `HR · ${need.valueHolderId ?? ""}`;
  return "Typed in SY";
}

function NeedTags({ change, manual, edited, excluded }: { change?: DaNeedChange["change"]; manual?: DaManualEntry; edited?: boolean; excluded: boolean }): JSX.Element {
  return (
    <>
      {manual !== undefined && <span className="da-rowtable__tag">By hand</span>}
      {edited === true && <span className="da-rowtable__tag">Edited</span>}
      {excluded && <span className="da-rowtable__tag">Excluded</span>}
      {change === "ADDED" && <span className="da-rowtable__tag">New</span>}
      {change === "CHANGED" && <span className="da-rowtable__tag">Changed</span>}
    </>
  );
}

function NeedSourcesCard(): JSX.Element {
  const { da, editable, mutateDa, upstream } = useDaWorkbook();
  const needs = da.dataNeeds;
  const links = da.linkedWorkbooks ?? {};
  const linked = daNeedsLinked(da);
  const ready = daNeedsImportReady(da, upstream);
  const byHand = needManualCount(needs);
  const changes = needs?.changes ?? [];
  const added = changes.filter((change) => change.change === "ADDED").length;
  const changed = changes.filter((change) => change.change === "CHANGED").length;
  const removed = changes.filter((change) => change.change === "REMOVED").map((change) => change.label ?? change.id);
  const imported = (rows: readonly { manual?: DaManualEntry }[]): number => rows.filter((row) => row.manual === undefined).length;
  const counts: Record<DaNeedElement, number> = {
    SY: needs === undefined ? 0 : imported(needs.basicEvents) + imported(needs.ccfGroups),
    IE: needs === undefined ? 0 : imported(needs.initiators),
    HRA: needs === undefined ? 0 : imported(needs.humanErrors),
    POS: needs === undefined ? 0 : imported(needs.states),
  };
  const loaded: Record<DaNeedElement, boolean> = { SY: upstream.sy !== undefined, IE: upstream.ie !== undefined, HRA: upstream.hr !== undefined, POS: upstream.pos !== undefined };
  const meta: string[] = [];
  if (needs?.importedAt !== undefined) meta.push(`Imported ${new Date(needs.importedAt).toLocaleString()}.`);
  if (needs?.changes !== undefined && changes.length === 0) meta.push("Nothing changed since the previous import.");
  if (changes.length > 0) meta.push(`Since the previous import, ${added} added, ${changed} changed and ${removed.length} removed${removed.length > 0 ? ` (${countedList(removed, 5)})` : ""}.`);
  if (byHand > 0) meta.push(`${byHand} ${byHand === 1 ? "item is" : "items are"} entered by hand.`);
  if (needs?.importedAt !== undefined) meta.push("Hand entries and DA decisions stay when you import again.");
  if (linked.length === 0) meta.push("No workbook is linked. Link SY, IE, HR and POS in Step 01 to import, or add the needs by hand below.");
  else if (!ready) meta.push("The linked workbooks are still loading.");

  function importNow(): void {
    if (!editable) return;
    const now = new Date().toISOString();
    mutateDa((draft) => withLinkedValuesSynced({ ...draft, dataNeeds: withNeedsMerged(draft.dataNeeds, daImportNeeds(draft, upstream, now)) }));
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="DA" title="Source workbooks" level={3} />
        <div className="da-card-actions">
          <DaProvenanceChip>DA-A1</DaProvenanceChip>
          {editable && linked.length > 0 && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!ready} onClick={importNow}>
              {needs?.importedAt === undefined ? "Import from linked workbooks" : "Import again"}
            </button>
          )}
        </div>
      </div>
      <div className="da-table-wrap">
        <table className="postable da-rowtable" aria-label="Source workbooks">
          <thead><tr><th>Element</th><th>Linked workbook</th><th>Provides</th><th>Imported from</th><th>Items</th></tr></thead>
          <tbody>
            {NEED_ELEMENTS.map((element) => {
              const id = links[element];
              const name = id === undefined ? "Not linked" : upstream.options[element].find((workbook) => workbook.id === id)?.name ?? exampleLinkLabel(id) ?? id;
              const source = needs?.sources.find((candidate) => candidate.element === element);
              return (
                <tr key={element}>
                  <td>{NEED_ELEMENT_LABELS[element]}</td>
                  <td>{name}{id !== undefined && !loaded[element] && <span className="da-rowtable__tag">Not loaded</span>}</td>
                  <td>{NEED_ELEMENT_PROVIDES[element]}</td>
                  <td>{source === undefined ? "—" : source.workbookName}</td>
                  <td className="da-rowtable__num">{source === undefined ? "—" : counts[element]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {meta.length > 0 && <p className="da-needs__meta">{meta.join(" ")}</p>}
    </div>
  );
}

function NeedPager({ total, page, onPage }: { total: number; page: number; onPage: (page: number) => void }): JSX.Element {
  const pages = Math.max(1, Math.ceil(total / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const first = current * NEED_PAGE + 1;
  const last = Math.min(total, (current + 1) * NEED_PAGE);
  return (
    <>
      <span className="da-needs__count">{total === 0 ? "None" : `${first} to ${last} of ${total}`}</span>
      {pages > 1 && <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => onPage(current - 1)}>Previous</button>}
      {pages > 1 && <button type="button" className="posnav__btn posnav__btn--sm" disabled={current >= pages - 1} onClick={() => onPage(current + 1)}>Next</button>}
    </>
  );
}

function BasicEventNeedsTable({ needs, openDrawer }: { needs: DaDataNeeds; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const [system, setSystem] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(0);
  const filterId = useId();
  if (needs.basicEvents.length === 0) return <p className="posmuted">No basic event yet. Import them above or add them by hand.</p>;
  const systems = [...new Set(needs.basicEvents.flatMap((need) => (need.systemName === undefined ? [] : [need.systemName])))].sort();
  const rows = needs.basicEvents.filter((need) => (system === "" || need.systemName === system) && (kind === "" || (kind === "unset" ? need.kind === undefined : need.kind === kind)));
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={`${filterId}-system`}>System</label>
        <select id={`${filterId}-system`} className="posfield__select" value={system} onChange={(event) => { setSystem(event.target.value); setPage(0); }}>
          <option value="">All systems</option>
          {systems.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-kind`}>Event type</label>
        <select id={`${filterId}-kind`} className="posfield__select" value={kind} onChange={(event) => { setKind(event.target.value); setPage(0); }}>
          <option value="">All event types</option>
          {NEED_KINDS.map((option) => <option key={option} value={option}>{NEED_KIND_LABELS[option]}</option>)}
          <option value="unset">Not set</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="da-table-wrap">
        <table className="postable da-rowtable" aria-label="Basic events">
          <thead>
            <tr><th>Event</th><th>Name</th><th>System</th><th>Failure mode</th><th>Event type</th><th>Mission (h)</th><th>Test interval (h)</th><th>Value</th><th>Held by</th></tr>
          </thead>
          <tbody>
            {shown.map((need) => (
              <tr key={need.id} className={need.included ? undefined : "da-rowtable__muted"}>
                <td>
                  <button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "needEvent", id: need.id })}>{need.code.trim().length > 0 ? need.code : need.id}</button>
                  <NeedTags change={needChangeOf(needs, "SY", need.id)} manual={need.manual} edited={basicEventEdited(need)} excluded={!need.included} />
                </td>
                <td className="da-rowtable__wrap">{need.name.trim().length > 0 ? need.name : "Unnamed"}</td>
                <td>{need.systemName ?? "—"}</td>
                <td>{need.failureMode === undefined ? "—" : FAILURE_MODE_TEXT[need.failureMode] ?? need.failureMode}</td>
                <td>{need.kind === undefined ? "Not set" : NEED_KIND_LABELS[need.kind]}</td>
                <td className="da-rowtable__num">{need.kind === "RUNNING" ? plainNumber(need.missionTimeHours) : "—"}</td>
                <td className="da-rowtable__num">{need.kind === "STANDBY" ? plainNumber(need.testIntervalHours) : "—"}</td>
                <td className="da-rowtable__num">{need.value === undefined ? "—" : `${sciText(need.value)}${need.valueUnit === "PER_HOUR" ? " /h" : ""}`}</td>
                <td>{heldByText(need)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InitiatorNeedsTable({ needs, openDrawer }: { needs: DaDataNeeds; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  if (needs.initiators.length === 0) return <p className="posmuted">No initiator group yet. Import them above or add them by hand.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Initiator groups">
        <thead>
          <tr><th>Group</th><th>Name</th><th>Operating states</th><th>Members</th><th>Mean (/plant-year)</th><th>5th</th><th>95th</th><th>IE basis</th></tr>
        </thead>
        <tbody>
          {needs.initiators.map((need) => {
            const band = initiatorBand(need);
            return (
              <tr key={need.id} className={need.included ? undefined : "da-rowtable__muted"}>
                <td>
                  <button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "needInitiator", id: need.id })}>{need.id}</button>
                  <NeedTags change={needChangeOf(needs, "IE", need.id)} manual={need.manual} excluded={!need.included} />
                </td>
                <td className="da-rowtable__wrap">{need.name.trim().length > 0 ? need.name : "Unnamed"}</td>
                <td>{listCell(need.stateIds, "states")}</td>
                <td>{listCell(need.memberIds, "initiators")}</td>
                <td className="da-rowtable__num">{statText(need.meanFrequency)}</td>
                <td className="da-rowtable__num">{statText(band.p05)}</td>
                <td className="da-rowtable__num">{statText(band.p95)}</td>
                <td>{need.frequencyBasis === undefined ? "—" : FREQUENCY_BASIS_TEXT[need.frequencyBasis] ?? need.frequencyBasis}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HumanErrorNeedsTable({ needs, openDrawer }: { needs: DaDataNeeds; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  if (needs.humanErrors.length === 0) return <p className="posmuted">No human failure event yet. Import them above or add them by hand.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Human failure events">
        <thead>
          <tr><th>Event</th><th>Name</th><th>Timing</th><th>Event type</th><th>Value</th><th>Value type</th><th>Operating states</th></tr>
        </thead>
        <tbody>
          {needs.humanErrors.map((need) => (
            <tr key={need.id} className={need.included ? undefined : "da-rowtable__muted"}>
              <td>
                <button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "needHuman", id: need.id })}>{need.hfeId}</button>
                <NeedTags change={needChangeOf(needs, "HRA", need.id)} manual={need.manual} excluded={!need.included} />
              </td>
              <td className="da-rowtable__wrap" title={need.method}>{need.name.trim().length > 0 ? need.name : "Unnamed"}</td>
              <td>{need.timing === undefined ? "—" : HFE_TIMING_TEXT[need.timing] ?? need.timing}</td>
              <td>{NEED_KIND_LABELS[need.kind]}</td>
              <td className="da-rowtable__num">{statText(need.value)}</td>
              <td>{need.valueKind === undefined ? "—" : need.valueKind === "MEAN" ? "Mean" : "Point estimate"}</td>
              <td>{listCell(need.stateIds, "states")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CcfGroupNeedsTable({ needs, openDrawer }: { needs: DaDataNeeds; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  if (needs.ccfGroups.length === 0) return <p className="posmuted">No common cause group yet. Import them above or add them by hand.</p>;
  const codeOf = new Map(needs.basicEvents.map((need) => [need.id, need.code]));
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Common cause groups">
        <thead>
          <tr><th>Group</th><th>Name</th><th>Systems</th><th>Members</th><th>Model</th><th>Factors</th><th>Total probability</th><th>Held by</th></tr>
        </thead>
        <tbody>
          {needs.ccfGroups.map((need) => {
            const factors = Object.entries(need.factors ?? {}).map(([key, value]) => `${key} ${sciText(value)}`);
            return (
              <tr key={need.id} className={need.included ? undefined : "da-rowtable__muted"}>
                <td>
                  <button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "needCcf", id: need.id })}>{need.id}</button>
                  <NeedTags change={needChangeOf(needs, "SY", need.id)} manual={need.manual} excluded={!need.included} />
                </td>
                <td className="da-rowtable__wrap">{need.name.trim().length > 0 ? need.name : "Unnamed"}</td>
                <td>{listCell(need.systemIds, "systems")}</td>
                <td>{listCell(need.memberIds.map((member) => codeOf.get(member) ?? member), "members")}</td>
                <td>{need.modelType === undefined ? "—" : CCF_MODEL_LABELS[need.modelType] ?? need.modelType}</td>
                <td className="da-rowtable__mono">{factors.length === 0 ? "—" : factors.join(" · ")}</td>
                <td className="da-rowtable__num">{statText(need.totalProbability)}</td>
                <td>{need.manual !== undefined ? "—" : need.estimateRef === undefined ? "Typed in SY" : `DA · ${need.estimateRef}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StateNeedsTable({ needs, openDrawer }: { needs: DaDataNeeds; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  if (needs.states.length === 0) return <p className="posmuted">No operating state yet. Import them above or add them by hand.</p>;
  const shares = stateShares(needs.states);
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Operating states">
        <thead>
          <tr><th>State</th><th>Name</th><th>Mode</th><th>Duration (h)</th><th>Entries per year</th><th>% Share</th></tr>
        </thead>
        <tbody>
          {needs.states.map((need) => (
            <tr key={need.id} className={need.included ? undefined : "da-rowtable__muted"}>
              <td>
                <button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "needState", id: need.id })}>{need.id}</button>
                <NeedTags change={needChangeOf(needs, "POS", need.id)} manual={need.manual} excluded={!need.included} />
              </td>
              <td className="da-rowtable__wrap">{need.name.trim().length > 0 ? need.name : "Unnamed"}</td>
              <td>{need.mode === undefined ? "—" : OPERATING_MODE_TEXT[need.mode] ?? need.mode}</td>
              <td className="da-rowtable__num">{plainNumber(need.durationHours)}</td>
              <td className="da-rowtable__num">{need.entriesPerYear === 0 ? "Base state" : plainNumber(need.entriesPerYear)}</td>
              <td className="da-rowtable__num">{percentText(shares.get(need.id))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NeedChecksTable({ findings, openDrawer }: { findings: DaNeedFinding[]; openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Coverage checks">
        <thead><tr><th>Severity</th><th>Check</th><th>Item</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((finding, index) => {
            const target = finding.target;
            return (
              <tr key={`${finding.check}:${finding.item}:${index}`}>
                <td className={`da-severity da-severity--${finding.severity}`}>{SEVERITY_TEXT[finding.severity]}</td>
                <td>{finding.check}</td>
                <td>
                  {target === undefined ? finding.item : (
                    <button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: target.kind, id: target.id })}>{finding.item}</button>
                  )}
                </td>
                <td className="da-rowtable__wrap">{finding.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DataNeedsScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa, upstream } = useDaWorkbook();
  const [tab, setTab] = useState<NeedsTab>("events");
  const tabId = useId();
  const needs = da.dataNeeds;
  const findings = daNeedChecks(da, upstream.options);
  const count = (n: number): string => (needs === undefined ? "" : ` (${n})`);
  const tabs: { id: NeedsTab; label: string }[] = [
    { id: "events", label: `Basic events${count(needs?.basicEvents.length ?? 0)}` },
    { id: "initiators", label: `Initiators${count(needs?.initiators.length ?? 0)}` },
    { id: "human", label: `Human errors${count(needs?.humanErrors.length ?? 0)}` },
    { id: "ccf", label: `Common cause${count(needs?.ccfGroups.length ?? 0)}` },
    { id: "states", label: `Operating states${count(needs?.states.length ?? 0)}` },
    { id: "checks", label: `Checks${count(findings.length)}` },
  ];
  const head = NEED_TAB_HEADS[tab];

  function add(): void {
    if (!editable) return;
    const current = da.dataNeeds ?? emptyNeeds();
    const manual = { source: "" };
    if (tab === "events") {
      const id = nextNeedId("BE", current.basicEvents.flatMap((need) => [need.id, need.code]));
      mutateDa((draft) => withNeeds(draft, (n) => ({ ...n, basicEvents: [...n.basicEvents, { id, code: id, name: "", included: true, manual }] })));
      openDrawer({ kind: "needEvent", id });
    } else if (tab === "initiators") {
      const id = nextNeedId("IG", current.initiators.map((need) => need.id));
      mutateDa((draft) => withNeeds(draft, (n) => ({ ...n, initiators: [...n.initiators, { id, name: "", stateIds: [], memberIds: [], included: true, manual }] })));
      openDrawer({ kind: "needInitiator", id });
    } else if (tab === "human") {
      const id = nextNeedId("HE", current.humanErrors.flatMap((need) => [need.id, need.hfeId]));
      mutateDa((draft) => withNeeds(draft, (n) => ({ ...n, humanErrors: [...n.humanErrors, { id, hfeId: id, name: "", kind: "HUMAN_ERROR", stateIds: [], included: true, manual }] })));
      openDrawer({ kind: "needHuman", id });
    } else if (tab === "ccf") {
      const id = nextNeedId("CG", current.ccfGroups.map((need) => need.id));
      mutateDa((draft) => withNeeds(draft, (n) => ({ ...n, ccfGroups: [...n.ccfGroups, { id, name: "", systemIds: [], memberIds: [], included: true, manual }] })));
      openDrawer({ kind: "needCcf", id });
    } else if (tab === "states") {
      const id = nextNeedId("ST", current.states.map((need) => need.id));
      mutateDa((draft) => withNeeds(draft, (n) => ({ ...n, states: [...n.states, { id, name: "", included: true, manual }] })));
      openDrawer({ kind: "needState", id });
    }
  }

  return (
    <div className="da-step">
      <NeedSourcesCard />
      <DaTabs label="Data need sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && head.add !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>{head.add}</button>
              )}
            </div>
          </div>
          {needs === undefined ? (
            <p className="posmuted">Nothing is imported or entered yet. Import from the linked workbooks above, or add the needs by hand.</p>
          ) : tab === "events" ? (
            <BasicEventNeedsTable needs={needs} openDrawer={openDrawer} />
          ) : tab === "initiators" ? (
            <InitiatorNeedsTable needs={needs} openDrawer={openDrawer} />
          ) : tab === "human" ? (
            <HumanErrorNeedsTable needs={needs} openDrawer={openDrawer} />
          ) : tab === "ccf" ? (
            <CcfGroupNeedsTable needs={needs} openDrawer={openDrawer} />
          ) : tab === "states" ? (
            <StateNeedsTable needs={needs} openDrawer={openDrawer} />
          ) : (
            <NeedChecksTable findings={findings} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

function numberFrom(text: string, apply: (value: number | undefined) => void): void {
  if (text.trim().length === 0) {
    apply(undefined);
    return;
  }
  const value = Number(text);
  if (Number.isFinite(value) && value >= 0) apply(value);
}

function InclusionRows({ included, reason, disabled, onChange }: { included: boolean; reason: string | undefined; disabled: boolean; onChange: (included: boolean, reason: string | undefined) => void }): JSX.Element {
  const id = useId();
  return (
    <>
      <FormRow label="In this analysis" htmlFor={`${id}-included`}>
        <select id={`${id}-included`} className="posfield__select" value={included ? "included" : "excluded"} disabled={disabled} onChange={(event) => onChange(event.target.value === "included", event.target.value === "included" ? undefined : reason ?? "")}>
          <option value="included">Included</option>
          <option value="excluded">Excluded</option>
        </select>
      </FormRow>
      {!included && (
        <FormRow label="Reason for exclusion" htmlFor={`${id}-reason`} top>
          <WorkbookTextarea id={`${id}-reason`} className="posfield__textarea" rows={2} fitContent value={reason ?? ""} disabled={disabled} onChange={(event) => onChange(false, event.target.value)} />
        </FormRow>
      )}
    </>
  );
}

function NeedSourceRow({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="Where this need comes from" htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function NeedReasonRow({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label="Reason for change" htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function listFromText(text: string): string[] {
  return text.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

function NeedEventWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const need = da.dataNeeds?.basicEvents.find((candidate) => candidate.id === id);
  if (need === undefined) return null;
  const dis = !editable;
  const manual = need.manual !== undefined;
  const edited = basicEventEdited(need);
  const fid = (name: string): string => `${fieldId}-${name}`;
  const systems = [...new Set((da.dataNeeds?.basicEvents ?? []).flatMap((candidate) => (candidate.systemName === undefined ? [] : [candidate.systemName])))].sort();
  function patch(next: Partial<DaBasicEventNeed>): void {
    if (!editable) return;
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, basicEvents: needs.basicEvents.map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) })));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withNeeds(draft, (needs) => ({
      ...needs,
      basicEvents: needs.basicEvents.filter((candidate) => candidate.id !== id),
      ccfGroups: needs.ccfGroups.map((group) => (group.memberIds.includes(id) ? { ...group, memberIds: group.memberIds.filter((member) => member !== id) } : group)),
    })));
  }
  const kindValue = need.kind ?? "";
  const cap = manual ? "Basic event · By hand · DA-A1" : `Basic event · SY${need.systemName === undefined ? "" : ` · ${need.systemName}`} · DA-A1`;
  return (
    <>
      <ModalHead cap={cap} title={need.name.trim().length > 0 ? `${need.code} · ${need.name}` : need.code} onClose={onClose} />
      <div className="modal__body da-form">
        {manual && (
          <>
            <FormRow label="ID" htmlFor={fid("code")}>
              <WorkbookInput id={fid("code")} className="posfield__input" value={need.code} disabled={dis} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ code: event.target.value.trim() }); }} />
            </FormRow>
            <FormRow label="Name" htmlFor={fid("name")} top>
              <WorkbookTextarea id={fid("name")} className="posfield__textarea" rows={2} fitContent value={need.name} disabled={dis} onChange={(event) => patch({ name: event.target.value })} />
            </FormRow>
            <FormRow label="System" htmlFor={fid("system")}>
              <WorkbookInput id={fid("system")} className="posfield__input" list={fid("systems")} value={need.systemName ?? ""} disabled={dis} onChange={(event) => patch({ systemName: event.target.value.trim().length === 0 ? undefined : event.target.value.trim() })} />
              <datalist id={fid("systems")}>{systems.map((name) => <option key={name} value={name} />)}</datalist>
            </FormRow>
            <FormRow label="Failure mode" htmlFor={fid("mode")}>
              <WorkbookInput id={fid("mode")} className="posfield__input" value={need.failureMode === undefined ? "" : FAILURE_MODE_TEXT[need.failureMode] ?? need.failureMode} disabled={dis} onChange={(event) => patch({ failureMode: event.target.value.trim().length === 0 ? undefined : event.target.value.trim() })} />
            </FormRow>
          </>
        )}
        <FormRow label="Event type" htmlFor={fid("kind")}>
          <select id={fid("kind")} className="posfield__select" value={kindValue} disabled={dis} onChange={(event) => { const next = NEED_KINDS.find((option) => option === event.target.value); if (next !== undefined) patch({ kind: next }); }}>
            {need.kind === undefined && <option value="">Not set</option>}
            {NEED_KINDS.map((option) => <option key={option} value={option}>{NEED_KIND_LABELS[option]}</option>)}
          </select>
        </FormRow>
        {need.kind === "RUNNING" && (
          <FormRow label="Mission time" htmlFor={fid("mission")}>
            <WorkbookInput id={fid("mission")} className="posfield__input da-form__number" type="number" min="0" step="any" value={need.missionTimeHours ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (value) => patch({ missionTimeHours: value }))} />
            <span className="da-form__unit">hours</span>
          </FormRow>
        )}
        {need.kind === "STANDBY" && (
          <FormRow label="Test interval" htmlFor={fid("interval")}>
            <WorkbookInput id={fid("interval")} className="posfield__input da-form__number" type="number" min="0" step="any" value={need.testIntervalHours ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (value) => patch({ testIntervalHours: value }))} />
            <span className="da-form__unit">hours</span>
          </FormRow>
        )}
        <InclusionRows included={need.included} reason={need.exclusionReason} disabled={dis} onChange={(included, exclusionReason) => patch({ included, exclusionReason })} />
        {manual
          ? <NeedSourceRow value={need.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />
          : edited && <NeedReasonRow value={need.changeReason ?? ""} disabled={dis} onChange={(changeReason) => patch({ changeReason })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove basic event</button>}
        {editable && !manual && edited && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ kind: need.importedKind, missionTimeHours: need.importedMissionTimeHours, changeReason: undefined })}>Restore imported values</button>
        )}
      </FormFoot>
    </>
  );
}

function NeedInitiatorWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const need = da.dataNeeds?.initiators.find((candidate) => candidate.id === id);
  if (need === undefined) return null;
  const dis = !editable;
  const manual = need.manual !== undefined;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<DaInitiatorNeed>): void {
    if (!editable) return;
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, initiators: needs.initiators.map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) })));
  }
  function rename(value: string): void {
    const next = value.trim();
    if (!editable || next.length === 0 || next === id || (da.dataNeeds?.initiators ?? []).some((candidate) => candidate.id.toLowerCase() === next.toLowerCase())) return;
    patch({ id: next });
    onRetarget({ kind: "needInitiator", id: next });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, initiators: needs.initiators.filter((candidate) => candidate.id !== id) })));
  }
  return (
    <>
      <ModalHead cap={manual ? "Initiator group · By hand · IE-C1" : "Initiator group · IE · IE-C1"} title={need.name.trim().length > 0 ? `${need.id} · ${need.name}` : need.id} onClose={onClose} />
      <div className="modal__body da-form">
        {manual && (
          <>
            <FormRow label="ID" htmlFor={fid("id")}>
              <WorkbookInput id={fid("id")} className="posfield__input" value={need.id} disabled={dis} onChange={(event) => rename(event.target.value)} />
            </FormRow>
            <FormRow label="Name" htmlFor={fid("name")} top>
              <WorkbookTextarea id={fid("name")} className="posfield__textarea" rows={2} fitContent value={need.name} disabled={dis} onChange={(event) => patch({ name: event.target.value })} />
            </FormRow>
            <FormRow label="Operating states" htmlFor={fid("states")}>
              <WorkbookInput id={fid("states")} className="posfield__input" value={need.stateIds.join(", ")} disabled={dis} onChange={(event) => patch({ stateIds: listFromText(event.target.value) })} />
            </FormRow>
            <FormRow label="Member initiators" htmlFor={fid("members")}>
              <WorkbookInput id={fid("members")} className="posfield__input" value={need.memberIds.join(", ")} disabled={dis} onChange={(event) => patch({ memberIds: listFromText(event.target.value) })} />
            </FormRow>
          </>
        )}
        <InclusionRows included={need.included} reason={need.exclusionReason} disabled={dis} onChange={(included, exclusionReason) => patch({ included, exclusionReason })} />
        {manual && <NeedSourceRow value={need.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove initiator group</button>}
      </FormFoot>
    </>
  );
}

function NeedHumanWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const need = da.dataNeeds?.humanErrors.find((candidate) => candidate.id === id);
  if (need === undefined) return null;
  const dis = !editable;
  const manual = need.manual !== undefined;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<DaHumanErrorNeed>): void {
    if (!editable) return;
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, humanErrors: needs.humanErrors.map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) })));
  }
  function rename(value: string): void {
    const next = value.trim();
    if (!editable || next.length === 0 || next === id || (da.dataNeeds?.humanErrors ?? []).some((candidate) => candidate.id.toLowerCase() === next.toLowerCase())) return;
    patch({ id: next, hfeId: next });
    onRetarget({ kind: "needHuman", id: next });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, humanErrors: needs.humanErrors.filter((candidate) => candidate.id !== id) })));
  }
  const timings = ["PRE_INITIATOR", "AT_INITIATOR", "POST_INITIATOR"] as const;
  return (
    <>
      <ModalHead cap={manual ? "Human failure event · By hand · HR-G" : "Human failure event · HR · HR-G"} title={need.name.trim().length > 0 ? `${need.hfeId} · ${need.name}` : need.hfeId} onClose={onClose} />
      <div className="modal__body da-form">
        {manual && (
          <>
            <FormRow label="ID" htmlFor={fid("id")}>
              <WorkbookInput id={fid("id")} className="posfield__input" value={need.id} disabled={dis} onChange={(event) => rename(event.target.value)} />
            </FormRow>
            <FormRow label="Name" htmlFor={fid("name")} top>
              <WorkbookTextarea id={fid("name")} className="posfield__textarea" rows={2} fitContent value={need.name} disabled={dis} onChange={(event) => patch({ name: event.target.value })} />
            </FormRow>
            <FormRow label="Timing" htmlFor={fid("timing")}>
              <select id={fid("timing")} className="posfield__select" value={need.timing ?? ""} disabled={dis} onChange={(event) => patch({ timing: timings.find((option) => option === event.target.value) })}>
                <option value="">Not set</option>
                {timings.map((option) => <option key={option} value={option}>{HFE_TIMING_TEXT[option]}</option>)}
              </select>
            </FormRow>
            <FormRow label="Event type" htmlFor={fid("type")}>
              <select id={fid("type")} className="posfield__select" value={need.kind} disabled={dis} onChange={(event) => patch({ kind: event.target.value === "RECOVERY" ? "RECOVERY" : "HUMAN_ERROR" })}>
                <option value="HUMAN_ERROR">{NEED_KIND_LABELS.HUMAN_ERROR}</option>
                <option value="RECOVERY">{NEED_KIND_LABELS.RECOVERY}</option>
              </select>
            </FormRow>
            <FormRow label="Operating states" htmlFor={fid("states")}>
              <WorkbookInput id={fid("states")} className="posfield__input" value={need.stateIds.join(", ")} disabled={dis} onChange={(event) => patch({ stateIds: listFromText(event.target.value) })} />
            </FormRow>
          </>
        )}
        <InclusionRows included={need.included} reason={need.exclusionReason} disabled={dis} onChange={(included, exclusionReason) => patch({ included, exclusionReason })} />
        {manual && <NeedSourceRow value={need.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove human failure event</button>}
      </FormFoot>
    </>
  );
}

function NeedCcfWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const need = da.dataNeeds?.ccfGroups.find((candidate) => candidate.id === id);
  if (need === undefined) return null;
  const dis = !editable;
  const manual = need.manual !== undefined;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const events = da.dataNeeds?.basicEvents ?? [];
  const memberIds = need.memberIds;
  function patch(next: Partial<DaCcfGroupNeed>): void {
    if (!editable) return;
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, ccfGroups: needs.ccfGroups.map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) })));
  }
  function rename(value: string): void {
    const next = value.trim();
    if (!editable || next.length === 0 || next === id || (da.dataNeeds?.ccfGroups ?? []).some((candidate) => candidate.id.toLowerCase() === next.toLowerCase())) return;
    patch({ id: next });
    onRetarget({ kind: "needCcf", id: next });
  }
  function toggleMember(memberId: string, checked: boolean): void {
    const members = checked ? [...memberIds, memberId] : memberIds.filter((member) => member !== memberId);
    const systems = [...new Set(members.flatMap((member) => { const system = events.find((event) => event.id === member)?.systemName; return system === undefined ? [] : [system]; }))];
    patch({ memberIds: members, systemIds: systems });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, ccfGroups: needs.ccfGroups.filter((candidate) => candidate.id !== id) })));
  }
  return (
    <>
      <ModalHead cap={manual ? "Common cause group · By hand · DA-D7" : "Common cause group · SY · DA-D7"} title={need.name.trim().length > 0 ? `${need.id} · ${need.name}` : need.id} onClose={onClose} />
      <div className="modal__body da-form">
        {manual && (
          <>
            <FormRow label="ID" htmlFor={fid("id")}>
              <WorkbookInput id={fid("id")} className="posfield__input" value={need.id} disabled={dis} onChange={(event) => rename(event.target.value)} />
            </FormRow>
            <FormRow label="Name" htmlFor={fid("name")} top>
              <WorkbookTextarea id={fid("name")} className="posfield__textarea" rows={2} fitContent value={need.name} disabled={dis} onChange={(event) => patch({ name: event.target.value })} />
            </FormRow>
            <div className="da-form__row da-form__row--top" role="group" aria-labelledby={fid("members-label")}>
              <span className="posfield__label da-form__label" id={fid("members-label")}>Members</span>
              <div className="da-form__checks">
                {events.length === 0 && <span className="da-form__unit">List the basic events first.</span>}
                {events.map((event) => (
                  <label key={event.id} className="da-form__check">
                    <input type="checkbox" checked={need.memberIds.includes(event.id)} disabled={dis} onChange={(change) => toggleMember(event.id, change.target.checked)} />
                    <span>{event.code}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        <InclusionRows included={need.included} reason={need.exclusionReason} disabled={dis} onChange={(included, exclusionReason) => patch({ included, exclusionReason })} />
        {manual && <NeedSourceRow value={need.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove common cause group</button>}
      </FormFoot>
    </>
  );
}

function NeedStateWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const need = da.dataNeeds?.states.find((candidate) => candidate.id === id);
  if (need === undefined) return null;
  const dis = !editable;
  const manual = need.manual !== undefined;
  const fid = (name: string): string => `${fieldId}-${name}`;
  function patch(next: Partial<DaStateNeed>): void {
    if (!editable) return;
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, states: needs.states.map((candidate) => (candidate.id === id ? { ...candidate, ...next } : candidate)) })));
  }
  function rename(value: string): void {
    const next = value.trim();
    if (!editable || next.length === 0 || next === id || (da.dataNeeds?.states ?? []).some((candidate) => candidate.id.toLowerCase() === next.toLowerCase())) return;
    mutateDa((draft) => withNeeds(draft, (needs) => ({
      ...needs,
      states: needs.states.map((candidate) => (candidate.id === id ? { ...candidate, id: next } : candidate)),
      initiators: needs.initiators.map((initiator) => ({ ...initiator, stateIds: initiator.stateIds.map((state) => (state === id ? next : state)) })),
      humanErrors: needs.humanErrors.map((human) => ({ ...human, stateIds: human.stateIds.map((state) => (state === id ? next : state)) })),
    })));
    onRetarget({ kind: "needState", id: next });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withNeeds(draft, (needs) => ({ ...needs, states: needs.states.filter((candidate) => candidate.id !== id) })));
  }
  return (
    <>
      <ModalHead cap={manual ? "Operating state · By hand · DA-C25" : "Operating state · POS · DA-C25"} title={need.name.trim().length > 0 ? `${need.id} · ${need.name}` : need.id} onClose={onClose} />
      <div className="modal__body da-form">
        {manual && (
          <>
            <FormRow label="ID" htmlFor={fid("id")}>
              <WorkbookInput id={fid("id")} className="posfield__input" value={need.id} disabled={dis} onChange={(event) => rename(event.target.value)} />
            </FormRow>
            <FormRow label="Name" htmlFor={fid("name")} top>
              <WorkbookTextarea id={fid("name")} className="posfield__textarea" rows={2} fitContent value={need.name} disabled={dis} onChange={(event) => patch({ name: event.target.value })} />
            </FormRow>
            <FormRow label="Mode" htmlFor={fid("mode")}>
              <select id={fid("mode")} className="posfield__select" value={need.mode ?? ""} disabled={dis} onChange={(event) => patch({ mode: event.target.value.length === 0 ? undefined : event.target.value })}>
                <option value="">Not set</option>
                {OPERATING_MODES.map((mode) => <option key={mode} value={mode}>{OPERATING_MODE_TEXT[mode] ?? mode}</option>)}
              </select>
            </FormRow>
            <FormRow label="Duration" htmlFor={fid("duration")}>
              <WorkbookInput id={fid("duration")} className="posfield__input da-form__number" type="number" min="0" step="any" value={need.durationHours ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (value) => patch({ durationHours: value }))} />
              <span className="da-form__unit">hours</span>
            </FormRow>
            <FormRow label="Entries" htmlFor={fid("entries")}>
              <WorkbookInput id={fid("entries")} className="posfield__input da-form__number" type="number" min="0" step="any" value={need.entriesPerYear ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (value) => patch({ entriesPerYear: value }))} />
              <span className="da-form__unit">per year</span>
            </FormRow>
          </>
        )}
        <InclusionRows included={need.included} reason={need.exclusionReason} disabled={dis} onChange={(included, exclusionReason) => patch({ included, exclusionReason })} />
        {manual && <NeedSourceRow value={need.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />}
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove operating state</button>}
      </FormFoot>
    </>
  );
}

function NeedWindow({ context, onClose, onRetarget }: { context: DaDrawerContext; onClose: () => void; onRetarget: (ctx: DaDrawerContext) => void }): JSX.Element | null {
  switch (context.kind) {
    case "needEvent": return <NeedEventWindow id={context.id} onClose={onClose} />;
    case "needInitiator": return <NeedInitiatorWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "needHuman": return <NeedHumanWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "needCcf": return <NeedCcfWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "needState": return <NeedStateWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "daParameter": return <ParameterWindow id={context.id} onClose={onClose} />;
    case "daBoundary": return <BoundaryWindow id={context.id} onClose={onClose} />;
    case "daFailureMode": return <FailureModeWindow id={context.id} onClose={onClose} />;
    case "daGroup": return <GroupWindow id={context.id} onClose={onClose} />;
    case "daOutlier": return <OutlierWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

type ParametersTab = "parameters" | "map" | "boundaries" | "modes" | "groups" | "outliers" | "checks";

const PARAMETER_TAB_HEADS: Record<ParametersTab, { title: string; sr: string; add?: string }> = {
  parameters: { title: "Parameters", sr: "DA-A3 · DA-A4 · DA-C25", add: "Add parameter" },
  map: { title: "Event map", sr: "DA-A1 · DA-A4" },
  boundaries: { title: "Component boundaries", sr: "DA-A2", add: "Add boundary" },
  modes: { title: "Failure modes", sr: "DA-A2", add: "Add failure mode" },
  groups: { title: "Populations", sr: "DA-B1", add: "Add group" },
  outliers: { title: "Outliers", sr: "DA-B2", add: "Add outlier" },
  checks: { title: "Parameter checks", sr: "DA-A1 to A4 · DA-B1 · DA-B2 · DA-C25" },
};

const VALUE_TYPE_TEXT: Record<string, string> = { MEAN: "Mean", POINT_ESTIMATE: "Point estimate" };

function linesOf(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

function systemOptions(da: DataAnalysis): { id: string; name: string }[] {
  const options = new Map<string, string>();
  for (const need of da.dataNeeds?.basicEvents ?? []) {
    if (need.systemId !== undefined && !options.has(need.systemId)) options.set(need.systemId, need.systemName ?? need.systemId);
  }
  for (const id of [...da.componentBoundaries.map((b) => b.systemId), ...(da.componentGroupings ?? []).map((g) => g.systemId), ...(da.outlierComponents ?? []).map((o) => o.systemId)]) {
    if (id.length > 0 && !options.has(id)) options.set(id, id);
  }
  return [...options.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function systemName(da: DataAnalysis, id: string | undefined): string {
  if (id === undefined || id.length === 0) return "—";
  return systemOptions(da).find((option) => option.id === id)?.name ?? id;
}

function AreaRow({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function LinesRow({ label, items, disabled, onChange }: { label: string; items: readonly string[]; disabled: boolean; onChange: (items: string[]) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={items.join("\n")} disabled={disabled} onChange={(event) => onChange(linesOf(event.target.value))} />
    </FormRow>
  );
}

function SystemRow({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const id = useId();
  const options = systemOptions(da);
  return (
    <FormRow label="System" htmlFor={id}>
      <select id={id} className="posfield__select" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not set</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </FormRow>
  );
}

function ParametersTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const [model, setModel] = useState("");
  const [page, setPage] = useState(0);
  const filterId = useId();
  if (da.parameters.length === 0) return <p className="posmuted">No parameter yet. Map the events automatically in the event map, or add one by hand.</p>;
  const events = new Map<string, string[]>();
  for (const need of mappableNeeds(da.dataNeeds)) {
    if (need.parameterId !== undefined) events.set(need.parameterId, [...(events.get(need.parameterId) ?? []), need.code]);
  }
  const rows = da.parameters.filter((parameter) => model === "" || (model === "unset" ? parameter.quantificationModel === undefined : parameter.quantificationModel === model));
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Model</label>
        <select id={filterId} className="posfield__select" value={model} onChange={(event) => { setModel(event.target.value); setPage(0); }}>
          <option value="">All models</option>
          {QUANTIFICATION_MODELS.map((spec) => <option key={spec.model} value={spec.model}>{spec.label}</option>)}
          <option value="unset">Not set</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="da-table-wrap">
        <table className="postable da-rowtable" aria-label="Parameters">
          <thead>
            <tr><th>Parameter</th><th>Name</th><th>Model</th><th>Unit</th><th>Value</th><th>Value type</th><th>Value from</th><th>Events</th><th>States</th></tr>
          </thead>
          <tbody>
            {shown.map((parameter) => {
              const spec = modelSpecOf(parameter.quantificationModel);
              const unit = parameter.quantificationModel === "MISSION_PROBABILITY" && parameter.missionTimeHours !== undefined ? `per ${plainNumber(parameter.missionTimeHours)} h` : spec?.unit ?? "—";
              return (
                <tr key={parameter.uuid}>
                  <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daParameter", id: parameter.uuid })}>{parameter.uuid}</button></td>
                  <td className="da-rowtable__wrap">{parameter.name.trim().length > 0 ? parameter.name : "Unnamed"}</td>
                  <td>{spec?.label ?? "Not set"}</td>
                  <td>{unit}</td>
                  <td className="da-rowtable__num">{statText(parameter.value)}</td>
                  <td>{parameter.value === undefined ? "—" : VALUE_TYPE_TEXT[parameter.valueType] ?? parameter.valueType}</td>
                  <td>{parameterValueText(da, parameter)}</td>
                  <td>{listCell(events.get(parameter.uuid) ?? [], "events")}</td>
                  <td>{listCell(parameterStates(parameter), "states")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EventMapTable({ unmapped }: { unmapped: number }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const [source, setSource] = useState("");
  const [show, setShow] = useState("all");
  const [page, setPage] = useState(0);
  const filterId = useId();
  const views = mappableNeeds(da.dataNeeds).filter((need) => need.included);
  if (da.dataNeeds === undefined) return <p className="posmuted">Import the data needs in Step 02 first.</p>;
  if (views.length === 0) return <p className="posmuted">No event to map. List the data needs in Step 02 first.</p>;
  const rows = views.filter((need) => (source === "" || need.element === source) && (show === "all" || need.parameterId === undefined));
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE);
  const byId = new Map(da.parameters.map((parameter) => [parameter.uuid, parameter]));
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={`${filterId}-source`}>From</label>
        <select id={`${filterId}-source`} className="posfield__select" value={source} onChange={(event) => { setSource(event.target.value); setPage(0); }}>
          <option value="">All sources</option>
          <option value="SY">Basic events</option>
          <option value="IE">Initiator groups</option>
          <option value="HRA">Human failure events</option>
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-show`}>Show</label>
        <select id={`${filterId}-show`} className="posfield__select" value={show} onChange={(event) => { setShow(event.target.value); setPage(0); }}>
          <option value="all">All events</option>
          <option value="unmapped">Not mapped</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="da-table-wrap">
        <table className="postable da-rowtable" aria-label="Event map">
          <thead>
            <tr><th>Event</th><th>Name</th><th>From</th><th>Event type</th><th>Value</th><th>Parameter</th><th>Model</th></tr>
          </thead>
          <tbody>
            {shown.map((need) => {
              const allowed = modelsForNeed(need);
              const mapped = need.parameterId === undefined ? undefined : byId.get(need.parameterId);
              const options = da.parameters.filter((parameter) => parameter.uuid === need.parameterId || parameter.quantificationModel === undefined || allowed.includes(parameter.quantificationModel));
              return (
                <tr key={`${need.element}:${need.id}`}>
                  <td>{need.code}</td>
                  <td className="da-rowtable__wrap">{need.name.trim().length > 0 ? need.name : "Unnamed"}</td>
                  <td>{need.element === "SY" ? `SY${need.systemName === undefined ? "" : ` · ${need.systemName}`}` : NEED_ELEMENT_LABELS[need.element]}</td>
                  <td>{need.element === "IE" ? "Initiator" : need.kind === undefined ? "Not set" : NEED_KIND_LABELS[need.kind]}</td>
                  <td className="da-rowtable__num">{statText(need.value)}</td>
                  <td>
                    <select className="posfield__select" aria-label={`Parameter for ${need.code}`} value={need.parameterId ?? ""} disabled={!editable} onChange={(event) => mutateDa((draft) => withNeedParameter(draft, need.element, need.id, event.target.value.length === 0 ? undefined : event.target.value))}>
                      <option value="">Not mapped</option>
                      {options.map((parameter) => <option key={parameter.uuid} value={parameter.uuid}>{parameter.uuid}</option>)}
                    </select>
                  </td>
                  <td>{mapped === undefined ? "—" : modelSpecOf(mapped.quantificationModel)?.label ?? "Not set"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {unmapped > 0 && <p className="da-needs__meta">{unmapped} {unmapped === 1 ? "event is" : "events are"} not mapped. Map automatically uses the DA parameter that SY already names for an event. For a value typed in SY, IE or HR, it creates a parameter linked to that value.</p>}
    </>
  );
}

function BoundariesTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  if (da.componentBoundaries.length === 0) return <p className="posmuted">No component boundary yet. Add one for each component type the parameters cover.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Component boundaries">
        <thead><tr><th>Boundary</th><th>Name</th><th>System</th><th>Included</th><th>Excluded</th><th>Parameters</th></tr></thead>
        <tbody>
          {da.componentBoundaries.map((boundary) => (
            <tr key={boundary.uuid}>
              <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daBoundary", id: boundary.uuid })}>{boundary.uuid}</button></td>
              <td className="da-rowtable__wrap">{boundary.name.trim().length > 0 ? boundary.name : "Unnamed"}</td>
              <td>{systemName(da, boundary.systemId)}</td>
              <td>{listCell(boundary.includedItems, "parts")}</td>
              <td>{listCell(boundary.excludedItems ?? [], "parts")}</td>
              <td>{listCell(da.parameters.filter((parameter) => parameter.componentBoundaryRef === boundary.uuid).map((parameter) => parameter.uuid), "parameters")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FailureModesTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const modes = da.failureModes ?? [];
  if (modes.length === 0) return <p className="posmuted">No failure mode yet. Add the failure modes the parameters estimate.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Failure modes">
        <thead><tr><th>Mode</th><th>Name</th><th>Category</th><th>Detectability</th><th>Parameters</th></tr></thead>
        <tbody>
          {modes.map((mode) => (
            <tr key={mode.uuid}>
              <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daFailureMode", id: mode.uuid })}>{mode.uuid}</button></td>
              <td className="da-rowtable__wrap" title={mode.mechanismOfFailure}>{mode.name.trim().length > 0 ? mode.name : "Unnamed"}</td>
              <td>{mode.category.length > 0 ? mode.category : "—"}</td>
              <td>{DETECTABILITY_TEXT[mode.detectability] ?? mode.detectability}</td>
              <td>{listCell(da.parameters.filter((parameter) => parameter.failureModeRef === mode.uuid).map((parameter) => parameter.uuid), "parameters")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupsTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const groups = da.componentGroupings ?? [];
  if (groups.length === 0) return <p className="posmuted">No population yet. Group the components whose design, service and environment match.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Populations">
        <thead><tr><th>Group</th><th>Name</th><th>System</th><th>Members</th><th>Grouped by</th><th>Parameters</th></tr></thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.uuid}>
              <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daGroup", id: group.uuid })}>{group.uuid}</button></td>
              <td className="da-rowtable__wrap">{group.name.trim().length > 0 ? group.name : "Unnamed"}</td>
              <td>{systemName(da, group.systemId)}</td>
              <td>{listCell(group.componentIds, "members")}</td>
              <td>{GROUPING_BASIS[group.groupingBasis]?.label ?? group.groupingBasis}</td>
              <td>{listCell(da.parameters.filter((parameter) => parameter.componentGroupRef === group.uuid).map((parameter) => parameter.uuid), "parameters")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutliersTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const outliers = da.outlierComponents ?? [];
  if (outliers.length === 0) return <p className="posmuted">No outlier. Hold out a component that does not belong to its group, such as one that is never tested.</p>;
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Outliers">
        <thead><tr><th>Outlier</th><th>Component</th><th>System</th><th>Group</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>
          {outliers.map((outlier) => (
            <tr key={outlier.uuid}>
              <td><button type="button" className="da-rowtable__name" onClick={() => openDrawer({ kind: "daOutlier", id: outlier.uuid })}>{outlier.uuid}</button></td>
              <td className="da-rowtable__wrap">{outlier.componentId.trim().length > 0 ? outlier.componentId : "Unnamed"}</td>
              <td>{systemName(da, outlier.systemId)}</td>
              <td>{outlier.potentialGroupId.length > 0 ? outlier.potentialGroupId : "—"}</td>
              <td className="da-rowtable__wrap">{outlier.exclusionReason.trim().length > 0 ? outlier.exclusionReason : "—"}</td>
              <td>{OUTLIER_STATUS_TEXT[outlier.status] ?? outlier.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParametersScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const [tab, setTab] = useState<ParametersTab>("parameters");
  const tabId = useId();
  const findings = parameterFindings(da);
  const needs = mappableNeeds(da.dataNeeds).filter((need) => need.included);
  const unmapped = needs.filter((need) => need.parameterId === undefined).length;
  const groups = da.componentGroupings ?? [];
  const outliers = da.outlierComponents ?? [];
  const modes = da.failureModes ?? [];
  const tabs: { id: ParametersTab; label: string }[] = [
    { id: "parameters", label: `Parameters (${da.parameters.length})` },
    { id: "map", label: `Event map (${needs.length - unmapped} of ${needs.length})` },
    { id: "boundaries", label: `Boundaries (${da.componentBoundaries.length})` },
    { id: "modes", label: `Failure modes (${modes.length})` },
    { id: "groups", label: `Populations (${groups.length})` },
    { id: "outliers", label: `Outliers (${outliers.length})` },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = PARAMETER_TAB_HEADS[tab];

  function add(): void {
    if (!editable) return;
    if (tab === "parameters") {
      const id = nextParameterId(new Set(da.parameters.map((parameter) => parameter.uuid)));
      mutateDa((draft) => ({ ...draft, parameters: [...draft.parameters, { uuid: id, name: "", parameterType: "PROBABILITY", valueType: "MEAN", valueMode: "TYPED", implementsSrs: [{ sr: "DA-A4", hlr: "A" }] }] }));
      openDrawer({ kind: "daParameter", id });
    } else if (tab === "boundaries") {
      const id = nextNeedId("CB", da.componentBoundaries.map((boundary) => boundary.uuid));
      mutateDa((draft) => ({ ...draft, componentBoundaries: [...draft.componentBoundaries, { uuid: id, name: "", systemId: "", description: "", boundaries: [], includedItems: [], boundaryBasis: "", implementsSrs: [{ sr: "DA-A2", hlr: "A" }] }] }));
      openDrawer({ kind: "daBoundary", id });
    } else if (tab === "modes") {
      const id = nextNeedId("FM", modes.map((mode) => mode.uuid));
      mutateDa((draft) => ({ ...draft, failureModes: [...(draft.failureModes ?? []), { uuid: id, name: "", category: "Demand", mechanismOfFailure: "", detectability: "MEDIUM" }] }));
      openDrawer({ kind: "daFailureMode", id });
    } else if (tab === "groups") {
      const id = nextNeedId("CG", groups.map((group) => group.uuid));
      mutateDa((draft) => ({ ...draft, componentGroupings: [...(draft.componentGroupings ?? []), { uuid: id, name: "", systemId: "", groupId: id, componentIds: [], groupingBasis: "TYPE_AND_SERVICE_CONDITIONS", designCharacteristics: [], environmentalConditions: [], serviceConditions: [], groupingJustification: "", implementsSrs: [{ sr: "DA-B1", hlr: "B" }] }] }));
      openDrawer({ kind: "daGroup", id });
    } else if (tab === "outliers") {
      const id = nextNeedId("OL", outliers.map((outlier) => outlier.uuid));
      mutateDa((draft) => ({ ...draft, outlierComponents: [...(draft.outlierComponents ?? []), { uuid: id, systemId: "", componentId: "", potentialGroupId: "", exclusionReason: "", exclusionJustification: "", differentiatingCharacteristics: [], alternativeHandling: "", status: "TENTATIVE", implementsSrs: [{ sr: "DA-B2", hlr: "B" }] }] }));
      openDrawer({ kind: "daOutlier", id });
    }
  }

  return (
    <div className="da-step">
      <DaTabs label="Parameter sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && tab === "map" && (
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={unmapped === 0} onClick={() => mutateDa((draft) => withAutoMapping(draft))}>Map automatically</button>
              )}
              {editable && head.add !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>{head.add}</button>
              )}
            </div>
          </div>
          {tab === "parameters" ? (
            <ParametersTable openDrawer={openDrawer} />
          ) : tab === "map" ? (
            <EventMapTable unmapped={unmapped} />
          ) : tab === "boundaries" ? (
            <BoundariesTable openDrawer={openDrawer} />
          ) : tab === "modes" ? (
            <FailureModesTable openDrawer={openDrawer} />
          ) : tab === "groups" ? (
            <GroupsTable openDrawer={openDrawer} />
          ) : tab === "outliers" ? (
            <OutliersTable openDrawer={openDrawer} />
          ) : (
            <NeedChecksTable findings={findings} openDrawer={openDrawer} />
          )}
        </div>
      </div>
    </div>
  );
}

function ParameterWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) return null;
  const dis = !editable;
  const fid = (name: string): string => `${fieldId}-${name}`;
  const mapped = parameterNeeds(da, id);
  const linkOptions = mapped.filter((need) => need.ownerTyped);
  const stateOptions = da.dataNeeds?.states ?? [];
  const states = parameterStates(parameter);
  const model = parameter.quantificationModel;
  const spec = modelSpecOf(model);
  const link = parameter.valueLink;
  const linked = parameter.valueMode === "LINKED" && link !== undefined;
  const linkKey = linked ? `${link.element}|${link.needId}` : "TYPED";
  const linkKnown = linked && linkOptions.some((need) => `${need.element}|${need.id}` === linkKey);
  const linkedNeed = linked ? mapped.find((need) => need.element === link.element && need.id === link.needId) : undefined;
  const statesOwned = linkedNeed !== undefined && linkedNeed.stateIds.length > 0;
  function patch(next: Partial<DataAnalysisParameter>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, parameters: draft.parameters.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function setModel(value: string): void {
    const next = QUANTIFICATION_MODELS.find((candidate) => candidate.model === value);
    if (next === undefined) return;
    patch({ quantificationModel: next.model, parameterType: next.parameterType, missionTimeHours: next.model === "MISSION_PROBABILITY" ? parameter?.missionTimeHours : undefined });
  }
  function setValueFrom(value: string): void {
    if (value === "TYPED") {
      patch({ valueMode: "TYPED", valueLink: undefined });
      return;
    }
    const need = linkOptions.find((candidate) => `${candidate.element}|${candidate.id}` === value);
    if (need === undefined) return;
    const owned = need.stateIds.length > 0 ? { stateIds: [...need.stateIds], plantOperatingStateRef: need.stateIds[0] } : {};
    patch({ valueMode: "LINKED", valueLink: { element: need.element, needId: need.id }, value: need.value, valueType: need.valueType, ...owned });
  }
  function toggleState(stateId: string, checked: boolean): void {
    const next = checked ? [...states, stateId] : states.filter((state) => state !== stateId);
    patch({ stateIds: next, plantOperatingStateRef: next[0] });
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => {
      let next: DataAnalysis = { ...draft, parameters: draft.parameters.filter((candidate) => candidate.uuid !== id) };
      for (const need of mappableNeeds(draft.dataNeeds)) {
        if (need.parameterId === id) next = withNeedParameter(next, need.element, need.id, undefined);
      }
      return next;
    });
  }
  const componentModel = model !== undefined && COMPONENT_MODELS.has(model);
  const failureModeApplies = model !== "HUMAN_ERROR" && model !== "NON_RECOVERY" && model !== "FREQUENCY";
  return (
    <>
      <ModalHead cap={`Parameter · ${spec?.label ?? "No model"} · DA-A3`} title={parameter.name.trim().length > 0 ? `${parameter.uuid} · ${parameter.name}` : parameter.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Name" value={parameter.name} disabled={dis} onChange={(name) => patch({ name })} />
        <AreaRow label="Failure definition" value={parameter.description ?? ""} disabled={dis} onChange={(description) => patch({ description: description.trim().length === 0 ? undefined : description })} />
        <FormRow label="Model" htmlFor={fid("model")}>
          <select id={fid("model")} className="posfield__select" value={model ?? ""} disabled={dis} onChange={(event) => setModel(event.target.value)}>
            {model === undefined && <option value="">Not set</option>}
            {QUANTIFICATION_MODELS.map((candidate) => <option key={candidate.model} value={candidate.model}>{candidate.label}</option>)}
          </select>
          {spec !== undefined && model !== "MISSION_PROBABILITY" && <span className="da-form__unit">{spec.unit}</span>}
        </FormRow>
        {model === "MISSION_PROBABILITY" && (
          <FormRow label="Mission time" htmlFor={fid("mission")}>
            <WorkbookInput id={fid("mission")} className="posfield__input da-form__number" type="number" min="0" step="any" value={parameter.missionTimeHours ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (value) => patch({ missionTimeHours: value }))} />
            <span className="da-form__unit">hours</span>
          </FormRow>
        )}
        {componentModel && (
          <FormRow label="Boundary" htmlFor={fid("boundary")}>
            <select id={fid("boundary")} className="posfield__select" value={parameter.componentBoundaryRef ?? ""} disabled={dis} onChange={(event) => patch({ componentBoundaryRef: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">None</option>
              {da.componentBoundaries.map((boundary) => <option key={boundary.uuid} value={boundary.uuid}>{boundary.uuid} · {boundary.name}</option>)}
            </select>
          </FormRow>
        )}
        {failureModeApplies && (
          <FormRow label="Failure mode" htmlFor={fid("mode")}>
            <select id={fid("mode")} className="posfield__select" value={parameter.failureModeRef ?? ""} disabled={dis} onChange={(event) => patch({ failureModeRef: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">None</option>
              {(da.failureModes ?? []).map((mode) => <option key={mode.uuid} value={mode.uuid}>{mode.name}</option>)}
            </select>
          </FormRow>
        )}
        {componentModel && (
          <FormRow label="Population" htmlFor={fid("group")}>
            <select id={fid("group")} className="posfield__select" value={parameter.componentGroupRef ?? ""} disabled={dis} onChange={(event) => patch({ componentGroupRef: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">None</option>
              {(da.componentGroupings ?? []).map((group) => <option key={group.uuid} value={group.uuid}>{group.uuid} · {group.name}</option>)}
            </select>
          </FormRow>
        )}
        {!statesOwned && (
          <div className="da-form__row da-form__row--top" role="group" aria-labelledby={fid("states-label")}>
            <span className="posfield__label da-form__label" id={fid("states-label")}>Operating states</span>
            <div className="da-form__checks">
              {stateOptions.length === 0 && <span className="da-form__unit">Import the operating states in Step 02 first.</span>}
              {stateOptions.map((state) => (
                <label key={state.id} className="da-form__check" title={state.name}>
                  <input type="checkbox" checked={states.includes(state.id)} disabled={dis} onChange={(change) => toggleState(state.id, change.target.checked)} />
                  <span>{state.id}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {!statesOwned && states.length > 1 && (
          <AreaRow label="Reason for several states" value={parameter.multiPosApplicabilityJustification ?? ""} disabled={dis} onChange={(text) => patch({ multiPosApplicabilityJustification: text.trim().length === 0 ? undefined : text })} />
        )}
        <FormRow label="Value from" htmlFor={fid("from")}>
          <select id={fid("from")} className="posfield__select" value={linkKey} disabled={dis} onChange={(event) => setValueFrom(event.target.value)}>
            <option value="TYPED">Typed in DA</option>
            {linked && !linkKnown && <option value={linkKey}>Linked · {link.needId} (no longer mapped)</option>}
            {linkOptions.map((need) => <option key={`${need.element}|${need.id}`} value={`${need.element}|${need.id}`}>Linked · {NEED_ELEMENT_LABELS[need.element]} {need.code} ({statText(need.value)})</option>)}
          </select>
        </FormRow>
        {!linked && (
          <FormRow label="Value" htmlFor={fid("value")}>
            <WorkbookInput id={fid("value")} className="posfield__input da-form__number" type="number" min="0" step="any" value={parameter.value ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (value) => patch({ value, valueMode: "TYPED" }))} />
            <select className="posfield__select" aria-label="Value type" value={parameter.valueType} disabled={dis} onChange={(event) => patch({ valueType: event.target.value === "POINT_ESTIMATE" ? "POINT_ESTIMATE" : "MEAN" })}>
              <option value="MEAN">Mean</option>
              <option value="POINT_ESTIMATE">Point estimate</option>
            </select>
          </FormRow>
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove parameter</button>}
      </FormFoot>
    </>
  );
}

function BoundaryWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const boundary = da.componentBoundaries.find((candidate) => candidate.uuid === id);
  if (boundary === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<ComponentBoundary>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, componentBoundaries: draft.componentBoundaries.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({
      ...draft,
      componentBoundaries: draft.componentBoundaries.filter((candidate) => candidate.uuid !== id),
      parameters: draft.parameters.map((parameter) => (parameter.componentBoundaryRef === id ? { ...parameter, componentBoundaryRef: undefined } : parameter)),
    }));
  }
  return (
    <>
      <ModalHead cap="Component boundary · DA-A2" title={boundary.name.trim().length > 0 ? `${boundary.uuid} · ${boundary.name}` : boundary.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Name" value={boundary.name} disabled={dis} onChange={(name) => patch({ name })} />
        <SystemRow value={boundary.systemId} disabled={dis} onChange={(systemId) => patch({ systemId })} />
        <AreaRow label="Description" value={boundary.description} disabled={dis} onChange={(description) => patch({ description })} />
        <LinesRow label="Included parts" items={boundary.includedItems} disabled={dis} onChange={(includedItems) => patch({ includedItems })} />
        <LinesRow label="Excluded parts" items={boundary.excludedItems ?? []} disabled={dis} onChange={(items) => patch({ excludedItems: items.length === 0 ? undefined : items })} />
        <LinesRow label="Boundary points" items={boundary.boundaries} disabled={dis} onChange={(boundaries) => patch({ boundaries })} />
        <AreaRow label="Basis" value={boundary.boundaryBasis} disabled={dis} onChange={(boundaryBasis) => patch({ boundaryBasis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove boundary</button>}
      </FormFoot>
    </>
  );
}

function FailureModeWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const mode = (da.failureModes ?? []).find((candidate) => candidate.uuid === id);
  if (mode === undefined) return null;
  const dis = !editable;
  const detectability = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
  function patch(next: Partial<FailureModeType>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, failureModes: (draft.failureModes ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({
      ...draft,
      failureModes: (draft.failureModes ?? []).filter((candidate) => candidate.uuid !== id),
      parameters: draft.parameters.map((parameter) => (parameter.failureModeRef === id ? { ...parameter, failureModeRef: undefined } : parameter)),
    }));
  }
  return (
    <>
      <ModalHead cap="Failure mode · DA-A2" title={mode.name.trim().length > 0 ? `${mode.uuid} · ${mode.name}` : mode.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Name" value={mode.name} disabled={dis} onChange={(name) => patch({ name })} />
        <FormRow label="Category" htmlFor={`${fieldId}-category`}>
          <select id={`${fieldId}-category`} className="posfield__select" value={mode.category} disabled={dis} onChange={(event) => patch({ category: event.target.value })}>
            {!FAILURE_MODE_CATEGORIES.includes(mode.category) && <option value={mode.category}>{mode.category.length > 0 ? mode.category : "Not set"}</option>}
            {FAILURE_MODE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </FormRow>
        <AreaRow label="Mechanism" value={mode.mechanismOfFailure} disabled={dis} onChange={(mechanismOfFailure) => patch({ mechanismOfFailure })} />
        <FormRow label="Detectability" htmlFor={`${fieldId}-detect`}>
          <select id={`${fieldId}-detect`} className="posfield__select" value={mode.detectability} disabled={dis} onChange={(event) => { const next = detectability.find((level) => level === event.target.value); if (next !== undefined) patch({ detectability: next }); }}>
            {detectability.map((level) => <option key={level} value={level}>{DETECTABILITY_TEXT[level]}</option>)}
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove failure mode</button>}
      </FormFoot>
    </>
  );
}

function GroupWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const group = (da.componentGroupings ?? []).find((candidate) => candidate.uuid === id);
  if (group === undefined) return null;
  const dis = !editable;
  function patch(next: Partial<ComponentGrouping>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, componentGroupings: (draft.componentGroupings ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => ({
      ...draft,
      componentGroupings: (draft.componentGroupings ?? []).filter((candidate) => candidate.uuid !== id),
      outlierComponents: draft.outlierComponents?.map((outlier) => (outlier.potentialGroupId === id ? { ...outlier, potentialGroupId: "" } : outlier)),
      parameters: draft.parameters.map((parameter) => (parameter.componentGroupRef === id ? { ...parameter, componentGroupRef: undefined } : parameter)),
    }));
  }
  return (
    <>
      <ModalHead cap="Population · DA-B1" title={group.name.trim().length > 0 ? `${group.uuid} · ${group.name}` : group.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <AreaRow label="Name" value={group.name} disabled={dis} onChange={(name) => patch({ name })} />
        <SystemRow value={group.systemId} disabled={dis} onChange={(systemId) => patch({ systemId })} />
        <LinesRow label="Members" items={group.componentIds} disabled={dis} onChange={(componentIds) => patch({ componentIds })} />
        <FormRow label="Grouped by" htmlFor={`${fieldId}-basis`}>
          <select id={`${fieldId}-basis`} className="posfield__select" value={group.groupingBasis} disabled={dis} onChange={(event) => patch({ groupingBasis: event.target.value === "TYPE_ONLY" ? "TYPE_ONLY" : "TYPE_AND_SERVICE_CONDITIONS" })}>
            {Object.entries(GROUPING_BASIS).map(([basis, spec]) => <option key={basis} value={basis}>{spec.label} ({spec.cc})</option>)}
          </select>
        </FormRow>
        <LinesRow label="Design" items={group.designCharacteristics} disabled={dis} onChange={(designCharacteristics) => patch({ designCharacteristics })} />
        <LinesRow label="Environment" items={group.environmentalConditions} disabled={dis} onChange={(environmentalConditions) => patch({ environmentalConditions })} />
        <LinesRow label="Service" items={group.serviceConditions} disabled={dis} onChange={(serviceConditions) => patch({ serviceConditions })} />
        <AreaRow label="Justification" value={group.groupingJustification} disabled={dis} onChange={(groupingJustification) => patch({ groupingJustification })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove group</button>}
      </FormFoot>
    </>
  );
}

function OutlierWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const outlier = (da.outlierComponents ?? []).find((candidate) => candidate.uuid === id);
  if (outlier === undefined) return null;
  const dis = !editable;
  const statuses = ["CONFIRMED", "TENTATIVE", "UNDER_REVIEW"] as const;
  function patch(next: Partial<OutlierComponent>): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, outlierComponents: (draft.outlierComponents ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)) }));
  }
  function setGroup(groupId: string): void {
    if (!editable) return;
    mutateDa((draft) => withOutlierGroup({ ...draft, outlierComponents: (draft.outlierComponents ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, potentialGroupId: groupId } : candidate)) }, id, groupId.length === 0 ? undefined : groupId));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateDa((draft) => withOutlierGroup({ ...draft, outlierComponents: (draft.outlierComponents ?? []).filter((candidate) => candidate.uuid !== id) }, id, undefined));
  }
  return (
    <>
      <ModalHead cap="Outlier · DA-B2" title={outlier.componentId.trim().length > 0 ? `${outlier.uuid} · ${outlier.componentId}` : outlier.uuid} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="Component" htmlFor={`${fieldId}-component`}>
          <WorkbookInput id={`${fieldId}-component`} className="posfield__input" value={outlier.componentId} disabled={dis} onChange={(event) => patch({ componentId: event.target.value })} />
        </FormRow>
        <SystemRow value={outlier.systemId} disabled={dis} onChange={(systemId) => patch({ systemId })} />
        <FormRow label="Group" htmlFor={`${fieldId}-group`}>
          <select id={`${fieldId}-group`} className="posfield__select" value={outlier.potentialGroupId} disabled={dis} onChange={(event) => setGroup(event.target.value)}>
            <option value="">None</option>
            {(da.componentGroupings ?? []).map((group) => <option key={group.uuid} value={group.uuid}>{group.uuid} · {group.name}</option>)}
          </select>
        </FormRow>
        <AreaRow label="Reason" value={outlier.exclusionReason} disabled={dis} onChange={(exclusionReason) => patch({ exclusionReason })} />
        <LinesRow label="Differences" items={outlier.differentiatingCharacteristics} disabled={dis} onChange={(differentiatingCharacteristics) => patch({ differentiatingCharacteristics })} />
        <AreaRow label="Justification" value={outlier.exclusionJustification} disabled={dis} onChange={(exclusionJustification) => patch({ exclusionJustification })} />
        <AreaRow label="Handling" value={outlier.alternativeHandling} disabled={dis} onChange={(alternativeHandling) => patch({ alternativeHandling })} />
        <FormRow label="Status" htmlFor={`${fieldId}-status`}>
          <select id={`${fieldId}-status`} className="posfield__select" value={outlier.status} disabled={dis} onChange={(event) => { const next = statuses.find((status) => status === event.target.value); if (next !== undefined) patch({ status: next }); }}>
            {statuses.map((status) => <option key={status} value={status}>{OUTLIER_STATUS_TEXT[status]}</option>)}
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose}>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove outlier</button>}
      </FormFoot>
    </>
  );
}

export {
  AreaRow,
  NEED_PAGE,
  NeedChecksTable,
  NeedPager,
  listCell,
  numberFrom,
  statText,
  ScopeScreen,
  DataNeedsScreen,
  NeedWindow,
  ParametersScreen,
  MethodChips,
  LadderPosition,
  ParamTypePill,
  RungPill,
  type DaDrawerContext,
};
