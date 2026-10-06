import { Fragment, JSX, useId, useMemo, useState } from "react";
import {
  type EsqFamilyChoice,
  type EsqFunctionLink,
  type EsqFunctionRule,
  type EsqFunctionTarget,
  type EsqInitiatorChoice,
  type EsqModel,
  type EsqSplitFractionTarget,
  type EsqValueHolder,
  type EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  DetailRow,
  DetailToggle,
  EsqProvenanceChip,
  EsqTabs,
  FieldList,
  FormFoot,
  FormRow,
  ModalHead,
  rowClass,
  sciText,
  useElementWidth,
} from "./esqShared";
import {
  familyIdTaken,
  modelChangeOf,
  modelImportReady,
  modelLinked,
  modelViewOf,
  nextFamilyId,
  sequenceChoiceOf,
  stateWeightingOf,
  topOf,
  withFamilyChoice,
  withFamilyRemoved,
  withFamilyRenamed,
  withFunctionLink,
  withHandFamily,
  withInitiatorChoice,
  withModelImported,
  withSequenceChoice,
  withValueBinding,
  type EsqFamilyView,
  type EsqFindingSeverity,
  type EsqFunctionView,
  type EsqInitiatorView,
  type EsqModelFinding,
  type EsqModelView,
  type EsqModelWindowKind,
  type EsqSequenceView,
  type EsqValueView,
} from "./esqModel";
import { type EsqLogicWindowKind } from "./esqLogic";
import { type EsqBarrierWindowKind } from "./esqBarriers";
import { type EsqSolveWindowKind } from "./esqSolve";
import { type EsqPostWindowKind } from "./esqPost";
import { type EsqResultsWindowKind } from "./esqResults";
import { type EsqUncertaintyWindowKind } from "./esqUncertainty";
import { type EsqSensitivityWindowKind } from "./esqSensitivity";
import { type EsqHandoffWindowKind } from "./esqHandoff";
import { barrierWorkOf, cellValueOfRecord } from "interfaces-mef-types/esq/esq-barrier-inputs";
import {
  END_STATE_LABELS,
  ESQ_MODEL_ELEMENTS,
  EVIDENCE_KIND_LABELS,
  MODEL_ELEMENT_LABELS,
  MODEL_ELEMENT_PROVIDES,
  exampleLinkLabel,
} from "./esqViewData";

type ModelTab = "sequences" | "families" | "functions" | "initiators" | "values" | "checks";

interface EsqWindowContext {
  kind:
    | EsqModelWindowKind
    | EsqLogicWindowKind
    | EsqBarrierWindowKind
    | EsqSolveWindowKind
    | EsqPostWindowKind
    | EsqResultsWindowKind
    | EsqUncertaintyWindowKind
    | EsqSensitivityWindowKind
    | EsqHandoffWindowKind;
  id: string;
}

const PAGE = 50;

const SEVERITY_TEXT: Record<EsqFindingSeverity, string> = { error: "Error", warning: "Warning", note: "Note" };

const TAB_HEADS: Record<ModelTab, { title: string; sr: string; add?: string }> = {
  sequences: { title: "Sequences", sr: "ESQ-A2 · ESQ-C3" },
  families: { title: "Families", sr: "ESQ-A1", add: "Add family" },
  functions: { title: "Functions", sr: "ESQ-A2" },
  initiators: { title: "Initiator frequencies", sr: "ESQ-A2" },
  values: { title: "Values", sr: "ESQ-A8" },
  checks: { title: "Model checks", sr: "ESQ-A1 · ESQ-A2 · ESQ-A8 · ESQ-C3" },
};

const MODEL_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqModelWindowKind>(["esqSequence", "esqFamily", "esqFunction", "esqInitiator", "esqValue"]);

const MODEL_WINDOW_LABELS: Record<EsqModelWindowKind, string> = {
  esqSequence: "Sequence",
  esqFamily: "Family",
  esqFunction: "Function",
  esqInitiator: "Initiator group",
  esqValue: "Basic event",
};

const SPLIT_PARAMETER_TYPES = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY", "OTHER"]);

function statText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function percentText(share: number | undefined): string {
  return share === undefined ? "—" : `${Number((share * 100).toPrecision(3))}%`;
}

function plainNumber(value: number | undefined): string {
  return value === undefined ? "—" : String(Number(value.toPrecision(6)));
}

function listValue(items: readonly string[]): string {
  return items.length === 0 ? "—" : items.join(", ");
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function numberFrom(text: string, apply: (value: number | undefined) => void): void {
  if (text.trim().length === 0) {
    apply(undefined);
    return;
  }
  const value = Number(text);
  if (Number.isFinite(value) && value >= 0) apply(value);
}

function frequencyUnitLabel(esq: EventSequenceQuantification): string {
  return esq.quantificationPlan?.frequencyBasis?.value === "PER_REACTOR_YEAR" ? "/reactor-year" : "/plant-year";
}

function pathText(view: EsqSequenceView): string {
  const order = view.tree?.functionIds ?? [];
  const keys = [...order, ...Object.keys(view.record.path).filter((key) => !order.includes(key))];
  const parts = keys.flatMap((key) => {
    const state = view.record.path[key];
    if (state === "SUCCESS") return [`${key} ok`];
    if (state === "FAILURE") return [`${key} fails`];
    return [];
  });
  return parts.length === 0 ? "—" : parts.join(" · ");
}

function targetText(model: EsqModel, target: EsqFunctionTarget | undefined): string {
  if (target === undefined) return "Not linked";
  if (target.kind === "SPLIT_FRACTION") {
    if (target.cellId !== undefined) return `Split fraction · Step 04 ${target.cellId}`;
    if (target.parameterId !== undefined) return `Split fraction · ${target.parameterId}`;
    return target.value === undefined ? "Split fraction" : `Split fraction ${sciText(target.value)}`;
  }
  return topOf(model, target.top)?.code ?? "Missing top";
}

function linkedToText(model: EsqModel, view: EsqFunctionView): string {
  const first = view.targets[0];
  if (first === undefined) return "Not linked";
  const head = view.targets.length === 1 ? targetText(model, first) : `${view.targets.length} targets`;
  return view.unlinked.length === 0 ? head : `${head}, ${view.unlinked.length} not linked`;
}

function ruleText(model: EsqModel, rule: EsqFunctionRule): string {
  const scope = [rule.groupIds.join(", "), rule.stateIds.join(", ")].filter((part) => part.length > 0).join(" in ");
  return `${scope.length === 0 ? "Every tree" : scope}: ${targetText(model, rule.target)}`;
}

function holderText(heldBy: EsqValueHolder, holderId: string | undefined): string {
  if (heldBy === "DA") return `DA · ${holderId ?? ""}`;
  if (heldBy === "HRA") return `HR · ${holderId ?? ""}`;
  return "Typed in SY";
}

function initiatorFromText(view: EsqInitiatorView): string {
  if (view.source === "TYPED") return "Typed";
  if (view.source === "DA") return `DA · ${view.choice?.parameterId ?? "not set"}`;
  if (view.record === undefined) return "Not in IE";
  return view.record.heldBy === "DA" && view.record.holderId !== undefined ? `IE · ${view.record.holderId}` : "IE";
}

function ChangeTags({ change, manual, edited, from }: { change?: "ADDED" | "REMOVED" | "CHANGED"; manual?: boolean; edited?: boolean; from?: string }): JSX.Element {
  return (
    <>
      {manual === true && <span className="esq-rowtable__tag">By hand</span>}
      {from !== undefined && <span className="esq-rowtable__tag">{from}</span>}
      {edited === true && <span className="esq-rowtable__tag">Edited</span>}
      {change === "ADDED" && <span className="esq-rowtable__tag">New</span>}
      {change === "CHANGED" && <span className="esq-rowtable__tag">Changed</span>}
    </>
  );
}

function Pager({ total, page, onPage }: { total: number; page: number; onPage: (page: number) => void }): JSX.Element {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const current = Math.min(page, pages - 1);
  const first = current * PAGE + 1;
  const last = Math.min(total, (current + 1) * PAGE);
  return (
    <span className="esq-pager">
      <span className="esq-count">{total === 0 ? "None" : `${first} to ${last} of ${total}`}</span>
      {pages > 1 && <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => onPage(current - 1)}>Previous</button>}
      {pages > 1 && <button type="button" className="posnav__btn posnav__btn--sm" disabled={current >= pages - 1} onClick={() => onPage(current + 1)}>Next</button>}
    </span>
  );
}

function pageOf<T>(rows: readonly T[], page: number): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  return { current, shown: rows.slice(current * PAGE, (current + 1) * PAGE) };
}

function ModelSourcesCard({ view }: { view: EsqModelView | undefined }): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const model = esq.model;
  const linked = modelLinked(esq);
  const ready = modelImportReady(esq, upstream);
  const changes = model?.changes ?? [];
  const added = changes.filter((change) => change.change === "ADDED").length;
  const changed = changes.filter((change) => change.change === "CHANGED").length;
  const removed = changes.filter((change) => change.change === "REMOVED").map((change) => change.label ?? change.id);
  const counts: Record<string, number> = {
    ES: model?.sequences.length ?? 0,
    SY: model?.events.length ?? 0,
    DA: model?.parameters.length ?? 0,
    HRA: model?.humanEvents.length ?? 0,
    IE: model?.initiators.length ?? 0,
    POS: model?.states.length ?? 0,
    SC: model?.criteria?.length ?? 0,
  };
  const loaded: Record<string, boolean> = {
    ES: upstream.es !== undefined,
    SY: upstream.sy !== undefined,
    DA: upstream.da !== undefined,
    HRA: upstream.hr !== undefined,
    IE: upstream.ie !== undefined,
    POS: upstream.pos !== undefined,
    SC: upstream.sc !== undefined,
  };
  const meta: string[] = [];
  if (model?.importedAt !== undefined) meta.push(`Imported ${new Date(model.importedAt).toLocaleString()}.`);
  if (model?.changes !== undefined && changes.length === 0) meta.push("Nothing changed since the previous import.");
  if (changes.length > 0) meta.push(`Since the previous import, ${added} added, ${changed} changed and ${removed.length} removed${removed.length > 0 ? ` (${removed.slice(0, 5).join(", ")}${removed.length > 5 ? ` and ${removed.length - 5} more` : ""})` : ""}.`);
  if (view !== undefined && view.outOfScope > 0) meta.push(`${view.outOfScope} ${view.outOfScope === 1 ? "sequence is" : "sequences are"} out of scope in Step 01.`);
  if (model?.importedAt !== undefined) meta.push("ESQ choices stay when you import again.");
  if (!linked.includes("ES")) meta.push("Link ES in Step 01 to import the event trees.");
  else if (!ready) meta.push("The linked workbooks are still loading.");

  function importNow(): void {
    if (!editable) return;
    const now = new Date().toISOString();
    mutateEsq((draft) => withModelImported(draft, upstream, now));
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="ESQ" title="Source workbooks" level={3} />
        <div className="esq-card-actions">
          <EsqProvenanceChip>ESQ-A2</EsqProvenanceChip>
          {editable && linked.includes("ES") && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!ready} onClick={importNow}>
              {model?.importedAt === undefined ? "Import from linked workbooks" : "Import again"}
            </button>
          )}
        </div>
      </div>
      <div className="esq-table-wrap">
        <table className="postable esq-rowtable" aria-label="Source workbooks">
          <thead><tr><th>Element</th><th>Linked workbook</th><th>Provides</th><th>Imported from</th><th>Items</th></tr></thead>
          <tbody>
            {ESQ_MODEL_ELEMENTS.map((element) => {
              const id = esq.linkedWorkbooks?.[element];
              const name = id === undefined || id.length === 0 ? "Not linked" : upstream.options[element].find((workbook) => workbook.id === id)?.name ?? exampleLinkLabel(id) ?? id;
              const source = model?.sources.find((candidate) => candidate.element === element);
              return (
                <tr key={element}>
                  <td>{MODEL_ELEMENT_LABELS[element]}</td>
                  <td className="esq-rowtable__text">{name}{id !== undefined && id.length > 0 && !loaded[element] && <span className="esq-rowtable__tag">Not loaded</span>}</td>
                  <td className="esq-rowtable__text">{MODEL_ELEMENT_PROVIDES[element]}</td>
                  <td className="esq-rowtable__text">{source === undefined ? "—" : source.workbookName}</td>
                  <td className="esq-rowtable__num">{source === undefined ? "—" : counts[element]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {meta.length > 0 && <p className="esq-meta">{meta.join(" ")}</p>}
    </div>
  );
}

function SequencesTable({ view, openWindow }: { view: EsqModelView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [group, setGroup] = useState("");
  const [state, setState] = useState("");
  const [family, setFamily] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const filterId = useId();
  if (view.sequences.length === 0) return <p className="posmuted">No sequence in scope. Check the coverage in Step 01.</p>;
  const groups = [...new Set(view.sequences.flatMap((sequence) => (sequence.tree === undefined ? [] : [sequence.tree.initiatorId])))].sort();
  const states = [...new Set(view.sequences.flatMap((sequence) => (sequence.tree?.stateId === undefined ? [] : [sequence.tree.stateId])))].sort();
  const rows = view.sequences.filter((sequence) => (group === "" || sequence.tree?.initiatorId === group)
    && (state === "" || sequence.tree?.stateId === state)
    && (family === "" || (family === "transfer" ? sequence.record.transferTreeId !== undefined : sequence.familyId === family)));
  const { current, shown } = pageOf(rows, page);
  const treeCode = new Map(view.model.trees.map((tree) => [tree.id, tree.code]));
  return (
    <>
      <div className="esq-bar">
        <label className="posfield__label" htmlFor={`${filterId}-group`}>Initiator group</label>
        <select id={`${filterId}-group`} className="posfield__select" value={group} onChange={(event) => { setGroup(event.target.value); setPage(0); }}>
          <option value="">All groups</option>
          {groups.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-state`}>State</label>
        <select id={`${filterId}-state`} className="posfield__select" value={state} onChange={(event) => { setState(event.target.value); setPage(0); }}>
          <option value="">All states</option>
          {states.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-family`}>Family</label>
        <select id={`${filterId}-family`} className="posfield__select" value={family} onChange={(event) => { setFamily(event.target.value); setPage(0); }}>
          <option value="">All families</option>
          {view.families.map((entry) => <option key={entry.id} value={entry.id}>{entry.id}</option>)}
          <option value="transfer">Transfers</option>
        </select>
        <Pager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Sequences">
          <thead>
            <tr><th className="esq-rowtable__pick">Details</th><th>Sequence</th><th>Tree</th><th>Fails</th><th>Family</th></tr>
          </thead>
          <tbody>
            {shown.map((sequence) => {
              const record = sequence.record;
              const open = record.id === openId;
              const transferTo = record.transferTreeId === undefined ? undefined : treeCode.get(record.transferTreeId) ?? record.transferTreeId;
              return (
                <Fragment key={record.id}>
                  <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(record.id); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={record.code} onToggle={() => setOpenId(open ? "" : record.id)} /></td>
                    <td className="esq-rowtable__text">
                      {transferTo === undefined ? (
                        <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqSequence", id: record.id }); }}>{record.code}</button>
                      ) : record.code}
                      <ChangeTags change={modelChangeOf(view.model, "SEQUENCE", record.id)} edited={sequence.choice !== undefined} />
                    </td>
                    <td className="esq-rowtable__text">{sequence.tree?.code ?? "—"}</td>
                    <td className="esq-rowtable__text">{sequence.failed.length === 0 ? "None" : sequence.failed.join(", ")}</td>
                    <td className="esq-rowtable__text">{transferTo !== undefined ? `To ${transferTo}` : sequence.familyId ?? "—"}</td>
                  </tr>
                  {open && (
                    <DetailRow span={5} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Event tree", value: sequence.tree === undefined ? "—" : `${sequence.tree.code} · ${sequence.tree.name}` },
                        { label: "Initiator group", value: sequence.tree?.initiatorId ?? "—" },
                        { label: "Operating state", value: sequence.tree?.stateId ?? "—" },
                        { label: "Path", value: pathText(sequence) },
                        { label: "Not asked", value: listValue(sequence.bypassed) },
                        { label: "End state", value: record.endState === undefined ? "—" : END_STATE_LABELS[record.endState] ?? record.endState },
                        { label: "Release category", value: record.releaseCategoryId ?? "—" },
                        { label: "Carries", value: transferTo === undefined ? "—" : listValue(record.transferCarries ?? []) },
                      ]} />
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FamiliesTable({ view, openWindow }: { view: EsqModelView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.families.length === 0) return <p className="posmuted">No family yet. Import them above or add one by hand.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Families">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Family</th><th>Name</th><th>Release category</th><th>Sequences</th></tr>
        </thead>
        <tbody>
          {view.families.map((family: EsqFamilyView) => {
            const open = family.id === openId;
            return (
              <Fragment key={family.id}>
                <tr className={rowClass(family.members.length === 0, open)} onClick={() => { if (!open) setOpenId(family.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={family.id} onToggle={() => setOpenId(open ? "" : family.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqFamily", id: family.id }); }}>{family.id}</button>
                    <ChangeTags change={modelChangeOf(view.model, "FAMILY", family.id)} manual={family.manual} />
                  </td>
                  <td className="esq-rowtable__text">{family.name.length > 0 ? family.name : "Unnamed"}</td>
                  <td className="esq-rowtable__text">{family.releaseCategoryId ?? (family.release ? "Not set" : "—")}</td>
                  <td className="esq-rowtable__num">{family.members.length}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "End state", value: family.endState === undefined ? "—" : END_STATE_LABELS[family.endState] ?? family.endState },
                      { label: "Operating states", value: listValue(family.stateIds) },
                      { label: "Initiator groups", value: listValue(family.initiatorIds) },
                      { label: "Sources", value: listValue(family.sourceIds) },
                      { label: "Release categories in ES", value: listValue(family.record?.releaseCategoryIds ?? []) },
                      { label: "Reason for grouping", value: textValue(family.choice?.groupingReason) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FunctionsTable({ view, openWindow }: { view: EsqModelView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.functions.length === 0) return <p className="posmuted">No function in scope. Import the event trees above.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Functions">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Function</th><th>Name</th><th>Trees</th><th>Linked to</th></tr>
        </thead>
        <tbody>
          {view.functions.map((entry) => {
            const id = entry.record.id;
            const open = id === openId;
            const linked = entry.record.esLinks.filter((link) => entry.trees.some((tree) => tree.id === link.treeId)).length;
            const missions = entry.trees.flatMap((tree) => (tree.missionTimeHours === undefined ? [] : [tree.missionTimeHours]));
            return (
              <Fragment key={id}>
                <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={id} onToggle={() => setOpenId(open ? "" : id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqFunction", id }); }}>{id}</button>
                    <ChangeTags change={modelChangeOf(view.model, "FUNCTION", id)} from={entry.fromEs && !entry.edited ? "From ES" : undefined} edited={entry.edited} />
                  </td>
                  <td className="esq-rowtable__text">{entry.record.name}</td>
                  <td className="esq-rowtable__num">{entry.trees.length}</td>
                  <td className="esq-rowtable__text"><span title={entry.targets.map((target) => targetText(view.model, target)).join(", ")}>{linkedToText(view.model, entry)}</span></td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Initiator groups", value: listValue([...new Set(entry.trees.map((tree) => tree.initiatorId))].sort()) },
                      { label: "Operating states", value: listValue([...new Set(entry.trees.flatMap((tree) => (tree.stateId === undefined ? [] : [tree.stateId])))].sort()) },
                      { label: "Default link", value: entry.link?.target === undefined ? (entry.fromEs ? "Links from ES" : "Not set") : targetText(view.model, entry.link.target) },
                      { label: "Rules", value: (entry.link?.rules ?? []).length === 0 ? "—" : (entry.link?.rules ?? []).map((rule) => ruleText(view.model, rule)).join(" · ") },
                      { label: "Linked in ES", value: `${linked} of ${entry.trees.length} trees` },
                      { label: "Not linked", value: listValue(entry.unlinked.map((tree) => tree.code)) },
                      { label: "Tree mission time (h)", value: missions.length === 0 ? "—" : plainNumber(Math.max(...missions)) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InitiatorsTable({ view, openWindow }: { view: EsqModelView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.initiators.length === 0) return <p className="posmuted">No initiator group in scope. Import the event trees above.</p>;
  const unit = frequencyUnitLabel(esq);
  const weighting = stateWeightingOf(esq);
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Initiator frequencies">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Group</th><th>Name</th><th>Mean ({unit})</th><th>From</th></tr>
        </thead>
        <tbody>
          {view.initiators.map((entry) => {
            const open = entry.id === openId;
            const band = entry.medianFrequency !== undefined && entry.errorFactor !== undefined && entry.errorFactor > 0
              ? `${sciText(entry.medianFrequency * entry.factor / entry.errorFactor)} to ${sciText(entry.medianFrequency * entry.factor * entry.errorFactor)}`
              : "—";
            return (
              <Fragment key={entry.id}>
                <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(entry.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={entry.id} onToggle={() => setOpenId(open ? "" : entry.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqInitiator", id: entry.id }); }}>{entry.id}</button>
                    <ChangeTags change={modelChangeOf(view.model, "INITIATOR", entry.id)} edited={entry.choice !== undefined && entry.choice.source !== "IE"} />
                  </td>
                  <td className="esq-rowtable__text">{entry.name}</td>
                  <td className="esq-rowtable__num">{statText(entry.mean)}</td>
                  <td className="esq-rowtable__text">{initiatorFromText(entry)}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      ...entry.states.map((state) => ({
                        label: `${state.stateId}${state.treeIds.length === 0 ? " · no tree" : ""}`,
                        value: state.applicable ? `${statText(state.frequency)} · ${percentText(state.share)}` : "Not in IE",
                      })),
                      { label: weighting === "POS_HOURS" ? "Hours in its states" : "State weighting", value: weighting === "POS_HOURS" ? plainNumber(entry.hours) : "Typed shares" },
                      { label: "5th to 95th", value: band },
                      { label: "Module factor", value: entry.factor === 1 ? "1" : plainNumber(entry.factor) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ValuesTable({ view, openWindow }: { view: EsqModelView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [system, setSystem] = useState("");
  const [from, setFrom] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const filterId = useId();
  if (view.values.length === 0) return <p className="posmuted">No basic event is reached yet. Link the functions to fault tree tops first.</p>;
  const systems = [...new Set(view.values.flatMap((value) => (value.systemName === undefined ? [] : [value.systemName])))].sort();
  const rows = view.values.filter((value: EsqValueView) => (system === "" || value.systemName === system) && (from === "" || value.heldBy === from) && (kind === "" || value.kind === kind));
  const { current, shown } = pageOf(rows, page);
  return (
    <>
      <div className="esq-bar">
        <label className="posfield__label" htmlFor={`${filterId}-system`}>System</label>
        <select id={`${filterId}-system`} className="posfield__select" value={system} onChange={(event) => { setSystem(event.target.value); setPage(0); }}>
          <option value="">All systems</option>
          {systems.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-from`}>From</label>
        <select id={`${filterId}-from`} className="posfield__select" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }}>
          <option value="">All sources</option>
          <option value="DA">DA</option>
          <option value="HRA">HR</option>
          <option value="TYPED">Typed in SY</option>
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-kind`}>Event type</label>
        <select id={`${filterId}-kind`} className="posfield__select" value={kind} onChange={(event) => { setKind(event.target.value); setPage(0); }}>
          <option value="">All event types</option>
          <option value="EVENT">Basic events</option>
          <option value="CCF">Common cause groups</option>
        </select>
        <Pager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Values">
          <thead>
            <tr><th className="esq-rowtable__pick">Details</th><th>Event</th><th>Name</th><th>Value</th><th>From</th></tr>
          </thead>
          <tbody>
            {shown.map((value) => {
              const key = `${value.kind}:${value.id}`;
              const open = key === openId;
              return (
                <Fragment key={key}>
                  <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(key); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={value.code} onToggle={() => setOpenId(open ? "" : key)} /></td>
                    <td className="esq-rowtable__text">
                      {value.kind === "EVENT" ? (
                        <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqValue", id: value.id }); }}>{value.code}</button>
                      ) : value.code}
                      <ChangeTags change={modelChangeOf(view.model, value.kind === "EVENT" ? "EVENT" : "CCF", value.id)} edited={value.binding !== undefined} />
                    </td>
                    <td className="esq-rowtable__text">{value.name}</td>
                    <td className="esq-rowtable__num">{value.value === undefined ? "—" : `${sciText(value.value)}${value.event?.valueUnit === "PER_HOUR" && value.parameter === undefined && value.human === undefined ? " /h" : ""}`}</td>
                    <td className="esq-rowtable__text">{holderText(value.heldBy, value.holderId)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={5} width={wrapWidth - 18}>
                      <FieldList items={value.kind === "EVENT" ? [
                        { label: "System", value: value.systemName ?? "—" },
                        { label: "Value type", value: value.valueType === undefined ? "—" : value.valueType === "MEAN" ? "Mean" : "Point estimate" },
                        { label: "Distribution", value: value.distributionType ?? (value.human?.distributionGiven === true ? "Given in HR" : "—") },
                        { label: "5th percentile", value: statText(value.p05) },
                        { label: "95th percentile", value: statText(value.p95) },
                        { label: "Mission time (h)", value: plainNumber(value.missionTimeHours) },
                        { label: "Evidence", value: value.parameter?.evidenceKind !== undefined ? EVIDENCE_KIND_LABELS[value.parameter.evidenceKind] ?? value.parameter.evidenceKind : value.human?.assessmentType === undefined ? "—" : value.human.assessmentType === "DETAILED_ASSESSMENT" ? "Detailed assessment" : "Conservative estimate" },
                        { label: "Functions", value: listValue(value.functionIds) },
                      ] : [
                        { label: "System", value: value.systemName ?? "—" },
                        { label: "Model", value: value.ccf?.modelType ?? "—" },
                        { label: "Members", value: listValue(value.ccf?.memberIds.map((member) => view.model.events.find((event) => event.id === member)?.code ?? member) ?? []) },
                        { label: "Functions", value: listValue(value.functionIds) },
                      ]} />
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ChecksTable({ findings, openWindow }: { findings: EsqModelFinding[]; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label="Model checks">
        <thead><tr><th>Severity</th><th>Check</th><th>Item</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((finding, index) => {
            const target = finding.target;
            return (
              <tr key={`${finding.check}:${finding.item}:${index}`}>
                <td className={`esq-severity esq-severity--${finding.severity}`}>{SEVERITY_TEXT[finding.severity]}</td>
                <td>{finding.check}</td>
                <td className="esq-rowtable__text">
                  {target === undefined ? finding.item : (
                    <button type="button" className="esq-rowtable__name" onClick={() => openWindow({ kind: target.kind, id: target.id })}>{finding.item}</button>
                  )}
                </td>
                <td className="esq-rowtable__wrap">{finding.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModelScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const [tab, setTab] = useState<ModelTab>("sequences");
  const tabId = useId();
  const view = useMemo(() => modelViewOf(esq, upstream.options), [esq, upstream.options]);
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: ModelTab; label: string }[] = [
    { id: "sequences", label: `Sequences${count(view?.sequences.length ?? 0)}` },
    { id: "families", label: `Families${count(view?.families.length ?? 0)}` },
    { id: "functions", label: `Functions${count(view?.functions.length ?? 0)}` },
    { id: "initiators", label: `Initiators${count(view?.initiators.length ?? 0)}` },
    { id: "values", label: `Values${count(view?.values.length ?? 0)}` },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[tab];

  function add(): void {
    if (!editable || tab !== "families") return;
    const id = nextFamilyId(esq);
    mutateEsq((draft) => withHandFamily(draft, id));
    openWindow({ kind: "esqFamily", id });
  }

  return (
    <div className="esq-step">
      <ModelSourcesCard view={view} />
      <EsqTabs label="Model sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {editable && head.add !== undefined && view !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>{head.add}</button>
              )}
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import from the linked workbooks above.</p>
          ) : tab === "sequences" ? (
            <SequencesTable view={view} openWindow={openWindow} />
          ) : tab === "families" ? (
            <FamiliesTable view={view} openWindow={openWindow} />
          ) : tab === "functions" ? (
            <FunctionsTable view={view} openWindow={openWindow} />
          ) : tab === "initiators" ? (
            <InitiatorsTable view={view} openWindow={openWindow} />
          ) : tab === "values" ? (
            <ValuesTable view={view} openWindow={openWindow} />
          ) : (
            <ChecksTable findings={view.findings} openWindow={openWindow} />
          )}
        </div>
      </div>
    </div>
  );
}

function ReasonRow({ label = "Reason for change", value, disabled, onChange }: { label?: string; value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function SequenceWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = modelViewOf(esq);
  const sequence = view?.sequences.find((candidate) => candidate.record.id === id);
  if (view === undefined || sequence === undefined) return null;
  const record = sequence.record;
  const choice = sequence.choice;
  const dis = !editable;

  function setFamily(next: string): void {
    if (!editable) return;
    mutateEsq((draft) => withSequenceChoice(draft, id, next === (record.familyId ?? "") ? undefined : { sequenceId: id, familyId: next, reason: sequenceChoiceOf(draft, id)?.reason ?? "" }));
  }

  return (
    <>
      <ModalHead cap="Sequence · ES · ESQ-A1" title={record.code} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Family" htmlFor={`${fieldId}-family`}>
          <select id={`${fieldId}-family`} className="posfield__select" value={sequence.familyId ?? ""} disabled={dis} onChange={(event) => setFamily(event.target.value)}>
            {sequence.familyId === undefined && <option value="">Not set</option>}
            {view.families.map((family) => <option key={family.id} value={family.id}>{family.name.length > 0 ? `${family.id} · ${family.name}` : family.id}</option>)}
          </select>
        </FormRow>
        {choice !== undefined && (
          <ReasonRow value={choice.reason} disabled={dis} onChange={(reason) => mutateEsq((draft) => withSequenceChoice(draft, id, { ...choice, reason }))} />
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && choice !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withSequenceChoice(draft, id, undefined))}>Restore imported values</button>
        )}
      </FormFoot>
    </>
  );
}

function releaseCategoryOptions(view: EsqModelView, current: string | undefined): string[] {
  const ids = new Set<string>();
  for (const family of view.model.families) for (const id of family.releaseCategoryIds) ids.add(id);
  for (const sequence of view.model.sequences) if (sequence.releaseCategoryId !== undefined) ids.add(sequence.releaseCategoryId);
  if (current !== undefined && current.length > 0) ids.add(current);
  return [...ids].sort();
}

function FamilyWindow({ id, onClose, onRetarget }: { id: string; onClose: () => void; onRetarget: (ctx: EsqWindowContext) => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [idError, setIdError] = useState("");
  const view = modelViewOf(esq);
  const family = view?.families.find((candidate) => candidate.id === id);
  if (view === undefined || family === undefined) return null;
  const choice = family.choice;
  const dis = !editable;
  const esCategories = family.record?.releaseCategoryIds ?? [];
  const showCategory = family.manual || esCategories.length !== 1;
  const base: EsqFamilyChoice = choice ?? { familyId: id };

  function patch(next: Partial<EsqFamilyChoice>): void {
    if (!editable) return;
    mutateEsq((draft) => withFamilyChoice(draft, id, { ...base, ...next, familyId: id }));
  }

  function rename(next: string): void {
    if (!editable) return;
    const value = next.trim();
    if (value.length === 0) { setIdError("Give the family an ID."); return; }
    if (familyIdTaken(esq, value, id)) { setIdError("Another family has this ID."); return; }
    setIdError("");
    mutateEsq((draft) => withFamilyRenamed(draft, id, value));
    onRetarget({ kind: "esqFamily", id: value });
  }

  return (
    <>
      <ModalHead cap={`Family · ${family.manual ? "By hand" : "ES"} · ESQ-A1`} title={family.name.length > 0 ? `${id} · ${family.name}` : id} onClose={onClose} />
      <div className="modal__body esq-form">
        {family.manual && (
          <>
            <FormRow label="ID" htmlFor={`${fieldId}-id`}>
              <WorkbookInput id={`${fieldId}-id`} className="posfield__input" value={id} disabled={dis} onChange={(event) => rename(event.target.value)} />
              {idError.length > 0 && <span className="esq-form__error" role="alert">{idError}</span>}
            </FormRow>
            <FormRow label="Name" htmlFor={`${fieldId}-name`}>
              <WorkbookInput id={`${fieldId}-name`} className="posfield__input" value={choice?.name ?? ""} disabled={dis} onChange={(event) => patch({ name: event.target.value })} />
            </FormRow>
            <FormRow label="End state" htmlFor={`${fieldId}-end`}>
              <select id={`${fieldId}-end`} className="posfield__select" value={choice?.endState ?? ""} disabled={dis} onChange={(event) => patch({ endState: event.target.value.length === 0 ? undefined : event.target.value })}>
                <option value="">Not set</option>
                {Object.entries(END_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormRow>
          </>
        )}
        {showCategory && (
          <FormRow label="Release category" htmlFor={`${fieldId}-rc`}>
            <select id={`${fieldId}-rc`} className="posfield__select" value={choice?.releaseCategoryId ?? ""} disabled={dis} onChange={(event) => patch({ releaseCategoryId: event.target.value.length === 0 ? undefined : event.target.value })}>
              <option value="">Not set</option>
              {releaseCategoryOptions(view, choice?.releaseCategoryId).map((rc) => <option key={rc} value={rc}>{rc}</option>)}
            </select>
          </FormRow>
        )}
        <ReasonRow label="Reason for grouping" value={choice?.groupingReason ?? ""} disabled={dis} onChange={(groupingReason) => patch({ groupingReason })} />
        {family.manual && (
          <ReasonRow label="Where this family comes from" value={choice?.manual?.source ?? ""} disabled={dis} onChange={(source) => patch({ manual: { source } })} />
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && family.manual && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withFamilyRemoved(draft, id)); onClose(); }}>Remove family</button>
        )}
      </FormFoot>
    </>
  );
}

function targetValue(target: EsqFunctionTarget | undefined, fallback: string): string {
  if (target === undefined) return fallback;
  if (target.kind === "SPLIT_FRACTION") return "split";
  return `top:${target.top.modelId}:${target.top.gateId}`;
}

function targetFrom(value: string, model: EsqModel, syWorkbookId: string): EsqFunctionTarget | undefined {
  if (value === "split") return { kind: "SPLIT_FRACTION" };
  if (!value.startsWith("top:")) return undefined;
  const [, modelId, gateId] = value.split(":");
  const top = model.tops.find((record) => record.modelId === modelId && record.gateId === gateId);
  if (top === undefined) return undefined;
  return { kind: "FAULT_TREE", top: { workbookId: syWorkbookId, modelId: top.modelId, gateId: top.gateId } };
}

function SplitRows({ target, model, disabled, onChange }: { target: EsqSplitFractionTarget; model: EsqModel; disabled: boolean; onChange: (next: EsqSplitFractionTarget) => void }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const id = useId();
  const parameters = model.parameters.filter((parameter) => SPLIT_PARAMETER_TYPES.has(parameter.parameterType));
  const cells = (barrierWorkOf(esq).cells ?? []).filter((cell) => cell.use === "SPLIT_FRACTION" || cell.id === target.cellId);
  const from = target.cellId !== undefined ? `cell:${target.cellId}` : target.parameterId === undefined ? "typed" : `da:${target.parameterId}`;
  return (
    <>
      <FormRow label="Value from" htmlFor={`${id}-from`}>
        <select id={`${id}-from`} className="posfield__select" value={from} disabled={disabled} onChange={(event) => {
          const next = event.target.value;
          if (next.startsWith("cell:")) onChange({ kind: "SPLIT_FRACTION", cellId: next.slice(5) });
          else onChange(next === "typed" ? { kind: "SPLIT_FRACTION" } : { kind: "SPLIT_FRACTION", parameterId: next.slice(3) });
        }}>
          <option value="typed">Typed in ESQ</option>
          {cells.map((cell) => <option key={cell.id} value={`cell:${cell.id}`}>{`Step 04 · ${cell.id}${cell.familyId === undefined ? "" : ` · ${cell.familyId}`} · ${statText(cellValueOfRecord(cell))}`}</option>)}
          {target.cellId !== undefined && !cells.some((cell) => cell.id === target.cellId) && <option value={`cell:${target.cellId}`}>{`Step 04 · ${target.cellId} · removed`}</option>}
          {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`DA · ${parameter.id} · ${statText(parameter.value)}`}</option>)}
        </select>
      </FormRow>
      {target.parameterId === undefined && target.cellId === undefined && (
        <>
          <FormRow label="Mean" htmlFor={`${id}-mean`}>
            <WorkbookInput id={`${id}-mean`} type="number" className="posfield__input esq-form__number" value={target.value ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (value) => onChange({ ...target, value }))} />
            <span className="esq-form__unit">per demand</span>
          </FormRow>
          <FormRow label="Error factor" htmlFor={`${id}-ef`}>
            <WorkbookInput id={`${id}-ef`} type="number" className="posfield__input esq-form__number" value={target.errorFactor ?? ""} disabled={disabled} onChange={(event) => numberFrom(event.target.value, (errorFactor) => onChange({ ...target, errorFactor }))} />
            <span className="esq-form__unit">lognormal</span>
          </FormRow>
          <FormRow label="Basis" htmlFor={`${id}-basis`} top>
            <WorkbookTextarea id={`${id}-basis`} className="posfield__textarea" rows={2} fitContent value={target.basis ?? ""} disabled={disabled} onChange={(event) => onChange({ ...target, basis: event.target.value })} />
          </FormRow>
        </>
      )}
    </>
  );
}

function TopSelect({ id, value, model, first, disabled, onChange }: { id: string; value: string; model: EsqModel; first?: { value: string; label: string }; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  return (
    <select id={id} className="posfield__select" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {first !== undefined && <option value={first.value}>{first.label}</option>}
      {model.tops.map((top) => <option key={`${top.modelId}:${top.gateId}`} value={`top:${top.modelId}:${top.gateId}`}>{`${top.code} · ${top.name}`}</option>)}
      <option value="split">Split fraction</option>
    </select>
  );
}

function nextRuleId(rules: readonly EsqFunctionRule[]): string {
  let n = rules.length + 1;
  while (rules.some((rule) => rule.id === `R-${n}`)) n += 1;
  return `R-${n}`;
}

function toggled(list: readonly string[], item: string, on: boolean): string[] {
  return on ? [...list.filter((entry) => entry !== item), item] : list.filter((entry) => entry !== item);
}

function FunctionWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = modelViewOf(esq);
  const entry = view?.functions.find((candidate) => candidate.record.id === id);
  if (view === undefined || entry === undefined) return null;
  const model = view.model;
  const link: EsqFunctionLink = entry.link ?? { functionId: id };
  const rules = link.rules ?? [];
  const dis = !editable;
  const syWorkbookId = esq.linkedWorkbooks?.SY ?? model.sources.find((source) => source.element === "SY")?.workbookId ?? "";
  const groups = [...new Set(entry.trees.map((tree) => tree.initiatorId))].sort();
  const states = [...new Set(entry.trees.flatMap((tree) => (tree.stateId === undefined ? [] : [tree.stateId])))].sort();

  function save(next: EsqFunctionLink): void {
    if (!editable) return;
    mutateEsq((draft) => withFunctionLink(draft, id, next));
  }

  function setRule(index: number, next: EsqFunctionRule): void {
    save({ ...link, rules: rules.map((rule, position) => (position === index ? next : rule)) });
  }

  return (
    <>
      <ModalHead cap={`Function · ES · ESQ-A2`} title={`${id} · ${entry.record.name}`} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Linked to" htmlFor={`${fieldId}-target`}>
          <TopSelect id={`${fieldId}-target`} value={targetValue(link.target, entry.fromEs ? "es" : "")} model={model} first={entry.fromEs ? { value: "es", label: "Links from ES" } : { value: "", label: "Not linked" }} disabled={dis} onChange={(value) => {
            const target = targetFrom(value, model, syWorkbookId);
            const { target: _old, ...rest } = link;
            save(target === undefined ? rest : { ...rest, target });
          }} />
        </FormRow>
        {link.target?.kind === "SPLIT_FRACTION" && (
          <SplitRows target={link.target} model={model} disabled={dis} onChange={(target) => save({ ...link, target })} />
        )}
        {entry.fromEs && link.target !== undefined && (
          <ReasonRow value={link.reason ?? ""} disabled={dis} onChange={(reason) => save({ ...link, reason })} />
        )}
        {rules.map((rule, index) => (
          <fieldset key={rule.id} className="esq-use">
            <legend className="esq-use__legend">{`Rule ${index + 1}`}</legend>
            <FormRow label="Initiator groups" top>
              <div className="esq-form__checks">
                {groups.map((group) => (
                  <label key={group} className="esq-form__check">
                    <input type="checkbox" checked={rule.groupIds.includes(group)} disabled={dis} onChange={(event) => setRule(index, { ...rule, groupIds: toggled(rule.groupIds, group, event.target.checked) })} />
                    {group}
                  </label>
                ))}
              </div>
            </FormRow>
            <FormRow label="Operating states" top>
              <div className="esq-form__checks">
                {states.map((state) => (
                  <label key={state} className="esq-form__check">
                    <input type="checkbox" checked={rule.stateIds.includes(state)} disabled={dis} onChange={(event) => setRule(index, { ...rule, stateIds: toggled(rule.stateIds, state, event.target.checked) })} />
                    {state}
                  </label>
                ))}
              </div>
            </FormRow>
            <FormRow label="Linked to" htmlFor={`${fieldId}-rule-${rule.id}`}>
              <TopSelect id={`${fieldId}-rule-${rule.id}`} value={targetValue(rule.target, "")} model={model} disabled={dis} onChange={(value) => {
                const target = targetFrom(value, model, syWorkbookId);
                if (target !== undefined) setRule(index, { ...rule, target });
              }} />
            </FormRow>
            {rule.target.kind === "SPLIT_FRACTION" && (
              <SplitRows target={rule.target} model={model} disabled={dis} onChange={(target) => setRule(index, { ...rule, target })} />
            )}
            <ReasonRow label="Reason" value={rule.reason} disabled={dis} onChange={(reason) => setRule(index, { ...rule, reason })} />
            {editable && (
              <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => save({ ...link, rules: rules.filter((_, position) => position !== index) })}>Remove this rule</button>
            )}
          </fieldset>
        ))}
        {editable && model.tops.length > 0 && (
          <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => {
            const first = model.tops[0];
            if (first === undefined) return;
            save({ ...link, rules: [...rules, { id: nextRuleId(rules), groupIds: [], stateIds: [], target: { kind: "FAULT_TREE", top: { workbookId: syWorkbookId, modelId: first.modelId, gateId: first.gateId } }, reason: "" }] });
          }}>Add rule</button>
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && entry.edited && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withFunctionLink(draft, id, undefined))}>Restore the ES links</button>
        )}
      </FormFoot>
    </>
  );
}

function InitiatorWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = modelViewOf(esq);
  const entry = view?.initiators.find((candidate) => candidate.id === id);
  if (view === undefined || entry === undefined) return null;
  const choice = entry.choice;
  const dis = !editable;
  const weighting = stateWeightingOf(esq);
  const parameters = view.model.parameters.filter((parameter) => parameter.parameterType === "FREQUENCY");
  const unit = frequencyUnitLabel(esq);
  const base: EsqInitiatorChoice = choice ?? { groupId: id, source: "IE" };

  function save(next: EsqInitiatorChoice): void {
    if (!editable) return;
    const empty = next.source === "IE" && (next.shares ?? []).length === 0;
    mutateEsq((draft) => withInitiatorChoice(draft, id, empty ? undefined : next));
  }

  function setSource(value: string): void {
    const shares = base.shares === undefined ? {} : { shares: base.shares };
    if (value === "ie") save({ groupId: id, source: "IE", ...shares });
    else if (value === "typed") save({ groupId: id, source: "TYPED", ...shares, ...(base.mean === undefined ? {} : { mean: base.mean }), ...(base.errorFactor === undefined ? {} : { errorFactor: base.errorFactor }), ...(base.basis === undefined ? {} : { basis: base.basis }) });
    else save({ groupId: id, source: "DA", parameterId: value.slice(3), ...shares });
  }

  function setShare(stateId: string, percent: number | undefined): void {
    const rest = (base.shares ?? []).filter((share) => share.stateId !== stateId);
    save({ ...base, shares: percent === undefined ? rest : [...rest, { stateId, percent }] });
  }

  const sourceValue = base.source === "DA" ? `da:${base.parameterId ?? ""}` : base.source === "TYPED" ? "typed" : "ie";

  return (
    <>
      <ModalHead cap={`Initiator group · ${entry.record === undefined ? "ES" : "IE"} · ESQ-A2`} title={entry.name === id ? id : `${id} · ${entry.name}`} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Frequency from" htmlFor={`${fieldId}-from`}>
          <select id={`${fieldId}-from`} className="posfield__select" value={sourceValue} disabled={dis} onChange={(event) => setSource(event.target.value)}>
            <option value="ie">{entry.record?.meanFrequency === undefined ? "IE" : `IE · ${sciText(entry.record.meanFrequency)}`}</option>
            {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`DA · ${parameter.id} · ${statText(parameter.value)}`}</option>)}
            {base.source === "DA" && base.parameterId !== undefined && !parameters.some((parameter) => parameter.id === base.parameterId) && <option value={`da:${base.parameterId}`}>{`DA · ${base.parameterId} · not imported`}</option>}
            <option value="typed">Typed in ESQ</option>
          </select>
        </FormRow>
        {base.source === "TYPED" && (
          <>
            <FormRow label="Mean" htmlFor={`${fieldId}-mean`}>
              <WorkbookInput id={`${fieldId}-mean`} type="number" className="posfield__input esq-form__number" value={base.mean ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (mean) => save({ ...base, mean }))} />
              <span className="esq-form__unit">{unit}</span>
            </FormRow>
            <FormRow label="Error factor" htmlFor={`${fieldId}-ef`}>
              <WorkbookInput id={`${fieldId}-ef`} type="number" className="posfield__input esq-form__number" value={base.errorFactor ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (errorFactor) => save({ ...base, errorFactor }))} />
              <span className="esq-form__unit">lognormal</span>
            </FormRow>
            <ReasonRow label="Basis" value={base.basis ?? ""} disabled={dis} onChange={(basis) => save({ ...base, basis })} />
          </>
        )}
        {weighting === "TYPED_SHARES" && entry.states.filter((state) => state.applicable).length > 1 && (
          <fieldset className="esq-use">
            <legend className="esq-use__legend">Share by state</legend>
            {entry.states.filter((state) => state.applicable).map((state) => (
              <FormRow key={state.stateId} label={state.stateId} htmlFor={`${fieldId}-share-${state.stateId}`}>
                <WorkbookInput id={`${fieldId}-share-${state.stateId}`} type="number" className="posfield__input esq-form__number" value={base.shares?.find((share) => share.stateId === state.stateId)?.percent ?? ""} disabled={dis} onChange={(event) => numberFrom(event.target.value, (percent) => setShare(state.stateId, percent))} />
                <span className="esq-form__unit">%</span>
              </FormRow>
            ))}
          </fieldset>
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && choice !== undefined && choice.source !== "IE" && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setSource("ie")}>Use the IE value</button>
        )}
      </FormFoot>
    </>
  );
}

function ValueWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = modelViewOf(esq);
  const value = view?.values.find((candidate) => candidate.kind === "EVENT" && candidate.id === id);
  const event = value?.event;
  if (view === undefined || value === undefined || event === undefined) return null;
  const binding = value.binding;
  const dis = !editable;
  const parameters = view.model.parameters.filter((parameter) => parameter.parameterType !== "FREQUENCY" && parameter.parameterType !== "CCF_PARAMETER");
  const imported = `${holderText(event.heldBy, event.holderId)}${event.heldBy === "TYPED" && event.value !== undefined ? ` · ${sciText(event.value)}` : ""}`;

  function setFrom(next: string): void {
    if (!editable) return;
    if (next === "sy") {
      mutateEsq((draft) => withValueBinding(draft, id, undefined));
      return;
    }
    const heldBy = next.startsWith("da:") ? "DA" : "HRA";
    const holderId = next.slice(3);
    if (event !== undefined && heldBy === event.heldBy && holderId === event.holderId) {
      mutateEsq((draft) => withValueBinding(draft, id, undefined));
      return;
    }
    mutateEsq((draft) => withValueBinding(draft, id, { eventId: id, heldBy, holderId, reason: binding?.reason ?? "" }));
  }

  const current = binding === undefined ? "sy" : `${binding.heldBy === "DA" ? "da" : "hr"}:${binding.holderId}`;

  return (
    <>
      <ModalHead cap="Basic event · SY · ESQ-A8" title={event.name.length > 0 ? `${event.code} · ${event.name}` : event.code} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Value from" htmlFor={`${fieldId}-from`}>
          <select id={`${fieldId}-from`} className="posfield__select" value={current} disabled={dis} onChange={(changeEvent) => setFrom(changeEvent.target.value)}>
            <option value="sy">{`As SY gives it · ${imported}`}</option>
            {parameters.map((parameter) => <option key={parameter.id} value={`da:${parameter.id}`}>{`DA · ${parameter.id} · ${statText(parameter.value)}`}</option>)}
            {view.model.humanEvents.map((human) => <option key={human.id} value={`hr:${human.id}`}>{`HR · ${human.id} · ${statText(human.value)}`}</option>)}
          </select>
        </FormRow>
        {binding !== undefined && (
          <ReasonRow value={binding.reason} disabled={dis} onChange={(reason) => mutateEsq((draft) => withValueBinding(draft, id, { ...binding, reason }))} />
        )}
      </div>
      <FormFoot onClose={onClose}>
        {editable && binding !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withValueBinding(draft, id, undefined))}>Restore imported values</button>
        )}
      </FormFoot>
    </>
  );
}

function ModelWindows({ context, onClose, onRetarget }: { context: EsqWindowContext; onClose: () => void; onRetarget: (ctx: EsqWindowContext) => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqSequence": return <SequenceWindow id={context.id} onClose={onClose} />;
    case "esqFamily": return <FamilyWindow id={context.id} onClose={onClose} onRetarget={onRetarget} />;
    case "esqFunction": return <FunctionWindow id={context.id} onClose={onClose} />;
    case "esqInitiator": return <InitiatorWindow id={context.id} onClose={onClose} />;
    case "esqValue": return <ValueWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { ModelScreen, ModelWindows, MODEL_WINDOW_KINDS, MODEL_WINDOW_LABELS, Pager, pageOf, type EsqWindowContext };
