import { JSX, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { KeySafetyFunction } from "interfaces-mef-types/es/event-sequence-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { Badge } from "./esShared";
import { ESIcon } from "./esIcons";
import { CAPABILITY_CATEGORIES, type Stage } from "./esViewData";
import { useEsWorkbook } from "./esWorkbookContext";
import "./css/esScope.css";

type EsLinkCode = "POS" | "IE" | "SC" | "SY" | "HRA";

interface EsLinkOption {
  workbookId: string;
  name: string;
}

interface EsLinkActions {
  available: (code: EsLinkCode) => Promise<EsLinkOption[]>;
  link: (code: EsLinkCode, workbookId: string) => Promise<void>;
  unlink: (code: EsLinkCode) => Promise<void>;
}

type ScopeKey = "states" | "initiators" | "sources" | "barriers";

type EsScopeDialog = { kind: "scope"; key: ScopeKey } | { kind: "function"; id: string };

interface ScopeChoice {
  id: string;
  label: string;
}

const LINK_TILES: { code: EsLinkCode; label: string; name: string; handoff: string }[] = [
  { code: "POS", label: "POS", name: "Plant Operating States", handoff: "Provides · Operating states, sources and barriers" },
  { code: "IE", label: "IE", name: "Initiating Event Analysis", handoff: "Provides · Initiating event groups" },
  { code: "SC", label: "SC", name: "Success Criteria", handoff: "Provides · Success criteria, mission times and timing" },
  { code: "SY", label: "SY", name: "Systems Analysis", handoff: "Provides · Supporting systems and fault tree tops" },
  { code: "HRA", label: "HR", name: "Human Reliability", handoff: "Provides · Human failure events" },
];

const SCOPE_LABEL: Record<ScopeKey, string> = {
  states: "Operating states",
  initiators: "Initiating event groups",
  sources: "Radioactive material sources",
  barriers: "Radionuclide barriers",
};

const SCOPE_KEYS: readonly ScopeKey[] = ["states", "initiators", "sources", "barriers"];

const FUNCTION_PAGE = 10;

function EsInterfaces({ links }: { links?: EsLinkActions }): JSX.Element {
  const { es, posLink, ieLink, editable } = useEsWorkbook();
  const [selected, setSelected] = useState<EsLinkCode | null>("POS");
  const [options, setOptions] = useState<Partial<Record<EsLinkCode, EsLinkOption[]>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectId = useId();
  const tile = LINK_TILES.find((candidate) => candidate.code === selected);
  const linkedId = selected === null ? null : selected === "POS" ? posLink.linkedPosWorkbookId : selected === "IE" ? ieLink.linkedIeWorkbookId : es.linkedWorkbooks?.[selected] ?? null;
  const linkedName = selected === "POS" ? posLink.linkedName : selected === "IE" ? ieLink.linkedName : null;
  const choices = selected === null ? undefined : options[selected];
  const linked = choices?.find((option) => option.workbookId === linkedId);

  useEffect(() => {
    if (selected === null || links === undefined || options[selected] !== undefined) return;
    let cancelled = false;
    links.available(selected)
      .then((found) => { if (!cancelled) setOptions((current) => ({ ...current, [selected]: found })); })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [selected, links, options]);

  function onLink(code: EsLinkCode, workbookId: string): void {
    if (links === undefined || !editable) return;
    setBusy(true);
    setError(null);
    (workbookId.length === 0 ? links.unlink(code) : links.link(code, workbookId))
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setBusy(false));
  }

  return (
    <>
      <div className="poshandoff__grid es-scope-tiles">
        {LINK_TILES.map((candidate) => (
          <button
            key={candidate.code}
            type="button"
            className={`poshandoff__tile${selected === candidate.code ? " poshandoff__tile--active" : ""}`}
            aria-pressed={selected === candidate.code}
            onClick={() => { setSelected(selected === candidate.code ? null : candidate.code); setError(null); }}
          >
            <span className="poshandoff__tile-code">{candidate.label}</span>
            <span className="poshandoff__tile-name">{candidate.name}</span>
            <span className="poshandoff__tile-role">{candidate.handoff}</span>
          </button>
        ))}
      </div>
      {tile !== undefined && (
        <div className="es-scope-lane">
          <div className="es-scope-link">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select
              id={selectId}
              className="posfield__select"
              value={linkedId ?? ""}
              disabled={!editable || links === undefined || busy || choices === undefined}
              onChange={(event) => onLink(tile.code, event.target.value)}
            >
              <option value="">{choices !== undefined && choices.length === 0 && linkedId === null ? `No ${tile.label} workbooks in this project` : "Not linked"}</option>
              {(choices ?? []).map((option) => <option key={option.workbookId} value={option.workbookId}>{option.name}</option>)}
              {linkedId !== null && linked === undefined && <option value={linkedId}>{linkedName ?? (linkedId.startsWith("example") ? `Example ${tile.label} workbook` : `${tile.label} workbook not in this project`)}</option>}
            </select>
          </div>
          {error !== null && <p className="es-scope-error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}

function scopeValues(key: ScopeKey, scope: { plantOperatingStateIds: string[]; initiatingEventIds: string[]; radioactiveMaterialSources: string[]; radionuclideBarriers: string[] }): string[] {
  switch (key) {
    case "states": return scope.plantOperatingStateIds;
    case "initiators": return scope.initiatingEventIds;
    case "sources": return scope.radioactiveMaterialSources;
    case "barriers": return scope.radionuclideBarriers;
  }
}

function ScopeTable({ onEdit }: { onEdit: (key: ScopeKey) => void }): JSX.Element {
  const { es, editable } = useEsWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  return (
    <div className="poscard">
      <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Analysis scope" level={3} /></div>
      <table className="postable postable--mid es-scope-table" aria-label="Analysis scope">
        <thead><tr><th scope="col">Scope item</th><th scope="col">In scope</th><th scope="col" className="es-scope-edit" aria-label="Actions" /></tr></thead>
        <tbody>
          {SCOPE_KEYS.map((key) => {
            const values = scopeValues(key, es.scopeDefinition);
            return (
              <tr key={key}>
                <td><span className="postable__name">{SCOPE_LABEL[key]}</span></td>
                <td>{values.length === 0 ? <span className="posmuted">None</span> : values.join(", ")}</td>
                <td className="es-scope-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${SCOPE_LABEL[key].toLowerCase()}`} onClick={() => onEdit(key)}>{actionLabel}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SafetyFunctions({ onOpen }: { onOpen: (id: string) => void }): JSX.Element {
  const { es, upstream, editable, mutateEs } = useEsWorkbook();
  const criterionLabel = (recordId: string): string => upstream?.sc?.overallSuccessCriteria.find((criterion) => criterion.uuid === recordId)?.successCriteriaId ?? recordId;
  const [page, setPage] = useState(0);
  const functions = es.keySafetyFunctions;
  const total = functions.length;
  const pages = Math.max(1, Math.ceil(total / FUNCTION_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = functions.slice(current * FUNCTION_PAGE, (current + 1) * FUNCTION_PAGE);
  const actionLabel = editable ? "Edit" : "View";

  function addFunction(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    setPage(Math.floor(total / FUNCTION_PAGE));
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: [...draft.keySafetyFunctions, { id, name: "New safety function", description: "", supportingSystems: [] }] }));
    onOpen(id);
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="ES" title="Key safety functions" level={3} />
        <div className="posrow">
          {pages > 1 ? (
            <span className="es-pager">
              <span className="possubtle">{current * FUNCTION_PAGE + 1} to {Math.min(total, (current + 1) * FUNCTION_PAGE)} of {total} functions</span>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
            </span>
          ) : <span className="possubtle">{total} function{total === 1 ? "" : "s"}</span>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addFunction}>Add function</button>}
        </div>
      </div>
      {total === 0 ? <p className="posmuted es-scope-empty">No key safety functions yet. Add the functions every sequence must satisfy to reach a safe stable state.</p> : (
        <table className="postable postable--mid es-scope-functions" aria-label="Key safety functions">
          <thead><tr><th scope="col">Function</th><th scope="col">Supporting systems</th><th scope="col">SC record</th><th scope="col" className="es-scope-edit" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((fn) => (
              <tr key={fn.id}>
                <td><span className="postable__name">{fn.name}</span></td>
                <td>{fn.supportingSystems.length === 0 ? <span className="posmuted">None</span> : fn.supportingSystems.join(", ")}</td>
                <td className="posmono">{fn.successCriteriaId === undefined ? <span className="posmuted">None</span> : criterionLabel(fn.successCriteriaId)}</td>
                <td className="es-scope-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${fn.name}`} onClick={() => onOpen(fn.id)}>{actionLabel}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DialogShell({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.focus();
    return () => { if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent): void { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [onClose]);
  return (
    <div className="modal__backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} className="modal es-details-modal" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

function DialogHead({ cap, title, onClose }: { cap: string; title?: string; onClose: () => void }): JSX.Element {
  return (
    <div className="modal__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        {title !== undefined && <h2 className="modal__title">{title}</h2>}
      </div>
      <button type="button" className="modal__close" onClick={onClose} aria-label="Close"><ESIcon.Close /></button>
    </div>
  );
}

function ChoiceEditor({ label, choices, values, editable, addLabel, onChange, mono = true, showLabel = true }: {
  mono?: boolean;
  showLabel?: boolean;
  label: string;
  choices: readonly ScopeChoice[];
  values: readonly string[];
  editable: boolean;
  addLabel: string;
  onChange: (values: string[]) => void;
}): JSX.Element {
  const [draft, setDraft] = useState("");
  const known = new Set(choices.map((choice) => choice.id));
  const all = [...choices, ...values.filter((value) => !known.has(value)).map((value) => ({ id: value, label: "" }))];
  function add(): void {
    const value = draft.trim();
    if (value.length > 0 && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  }
  return (
    <div className="posfield es-dialog-list" role="group" aria-label={label}>
      {showLabel && <span className="posfield__label">{label}</span>}
      {!editable && values.length === 0 && <span className="posmuted">None recorded.</span>}
      {all.length > 0 && (
        <div className="es-dialog-checks">
          {all.map((choice) => (
            <label key={choice.id} className="es-dialog-check">
              <input type="checkbox" checked={values.includes(choice.id)} disabled={!editable} onChange={(event) => onChange(event.target.checked ? [...values, choice.id] : values.filter((value) => value !== choice.id))} />
              <span className={mono ? "es-dialog-check__id" : undefined}>{choice.id}</span>
              {choice.label.length > 0 && choice.label !== choice.id && <span className="es-dialog-check__name">{choice.label}</span>}
            </label>
          ))}
        </div>
      )}
      {editable && (
        <div className="es-dialog-list__row">
          <input className="posfield__input" aria-label={addLabel} placeholder={addLabel} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={draft.trim().length === 0} onClick={add}>Add</button>
        </div>
      )}
    </div>
  );
}

function ScopeDialog({ scopeKey, onClose }: { scopeKey: ScopeKey; onClose: () => void }): JSX.Element {
  const { es, posLink, ieLink, editable, mutateEs } = useEsWorkbook();
  const values = scopeValues(scopeKey, es.scopeDefinition);
  const choices: ScopeChoice[] = scopeKey === "states"
    ? posLink.states.map((state) => ({ id: state.id, label: state.name }))
    : scopeKey === "initiators"
      ? ieLink.groups.map((group) => ({ id: group.id, label: group.name }))
      : scopeKey === "sources"
        ? posLink.sources.map((source) => ({ id: source.name, label: source.location }))
        : [...new Set(posLink.sources.flatMap((source) => source.barriers))].map((barrier) => ({ id: barrier, label: "" }));
  const addLabel = scopeKey === "states" ? "Add an operating state ID" : scopeKey === "initiators" ? "Add an initiating event group ID" : scopeKey === "sources" ? "Add a source" : "Add a barrier";

  function setValues(next: string[]): void {
    if (!editable) return;
    mutateEs((draft) => {
      const scope = draft.scopeDefinition;
      switch (scopeKey) {
        case "states": return { ...draft, scopeDefinition: { ...scope, plantOperatingStateIds: next } };
        case "initiators": return { ...draft, scopeDefinition: { ...scope, initiatingEventIds: next } };
        case "sources": return { ...draft, scopeDefinition: { ...scope, radioactiveMaterialSources: next } };
        case "barriers": return { ...draft, scopeDefinition: { ...scope, radionuclideBarriers: next } };
      }
    });
  }

  return (
    <DialogShell label={SCOPE_LABEL[scopeKey]} onClose={onClose}>
      <DialogHead cap="Analysis scope · ES-A1, A2" title={SCOPE_LABEL[scopeKey]} onClose={onClose} />
      <div className="modal__body">
        <ChoiceEditor label={SCOPE_LABEL[scopeKey]} choices={choices} values={values} editable={editable} addLabel={addLabel} showLabel={false} onChange={setValues} />
      </div>
    </DialogShell>
  );
}

function FunctionDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { es, upstream, editable, mutateEs } = useEsWorkbook();
  const fn = es.keySafetyFunctions.find((candidate) => candidate.id === id);
  if (fn === undefined) return null;
  const criteria = [...(upstream?.sc?.overallSuccessCriteria ?? [])].sort((left, right) => Number(right.keySafetyFunctions.includes(id)) - Number(left.keySafetyFunctions.includes(id)));
  const systems = (upstream?.sy?.systemDefinitions ?? []).map((system) => ({ id: system.abbreviation === undefined || system.abbreviation.length === 0 ? system.name : `${system.name} (${system.abbreviation})`, label: "" }));
  const recordId = fn.successCriteriaId;

  function patch(fields: Partial<KeySafetyFunction>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: draft.keySafetyFunctions.map((candidate) => (candidate.id === id ? { ...candidate, ...fields } : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: draft.keySafetyFunctions.filter((candidate) => candidate.id !== id) }));
  }

  return (
    <DialogShell label="Key safety function" onClose={onClose}>
      <DialogHead cap="Key safety function · ES-A3, A4" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Name" value={fn.name} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ name: event.target.value }); }} /> : <div>{fn.name}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">What it must do</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="What it must do" value={fn.description} onChange={(event) => patch({ description: event.target.value })} /> : <div>{fn.description}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">SC record</label>
            {criteria.length > 0 ? (
              <select className="posfield__select" aria-label="SC record" value={recordId ?? ""} disabled={!editable} onChange={(event) => patch({ successCriteriaId: event.target.value.length === 0 ? undefined : event.target.value })}>
                <option value="">None</option>
                {criteria.map((criterion) => <option key={criterion.uuid} value={criterion.uuid}>{criterion.successCriteriaId} · {criterion.description}</option>)}
                {recordId !== undefined && !criteria.some((criterion) => criterion.uuid === recordId) && <option value={recordId}>{recordId}</option>}
              </select>
            ) : editable
              ? <WorkbookInput className="posfield__input posmono" aria-label="SC record" value={recordId ?? ""} onChange={(event) => { const value = event.target.value.trim(); patch({ successCriteriaId: value.length === 0 ? undefined : value }); }} />
              : <div className="posmono">{recordId ?? ""}</div>}
          </div>
        </div>
        <ChoiceEditor label="Supporting systems" choices={systems} values={fn.supportingSystems} editable={editable} addLabel="Add a supporting system" mono={false} onChange={(supportingSystems) => patch({ supportingSystems })} />
        {editable && <div className="posrow es-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove function</button></div>}
      </div>
    </DialogShell>
  );
}

function EsScopeScreen({ ccId, setCcId, stage, setStage, links }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (stage: Stage) => void;
  links?: EsLinkActions;
}): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const [dialog, setDialog] = useState<EsScopeDialog | null>(null);
  const cc = CAPABILITY_CATEGORIES.find((candidate) => candidate.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  function onCcChange(nextId: string): void {
    if (!editable) return;
    setCcId(nextId);
    mutateEs((draft) => ({ ...draft, capabilityCategory: nextId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(nextStage: Stage): void {
    if (!editable) return;
    setStage(nextStage);
    mutateEs((draft) => ({ ...draft, plantStage: nextStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Interfaces" level={3} /></div>
        <p className="poscard__sub">Links are optional. A linked workbook fills the analysis scope and the key safety functions below, which you can also type by hand.</p>
        <EsInterfaces links={links} />
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="PRA scope" level={3} /></div>
        <WorkbookTextarea
          className="posfield__textarea es-scope-text"
          aria-label="PRA scope"
          rows={3}
          value={es.praScope}
          disabled={!editable}
          onChange={(event) => { if (editable) mutateEs((draft) => ({ ...draft, praScope: event.target.value })); }}
        />
      </div>

      <ScopeTable onEdit={(key) => setDialog({ kind: "scope", key })} />

      <SafetyFunctions onOpen={(id) => setDialog({ kind: "function", id })} />

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ES" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div className="es-scope-choices">
          {CAPABILITY_CATEGORIES.map((candidate) => {
            const active = candidate.id === ccId;
            return (
              <button key={candidate.id} type="button" className={`es-scope-choice${active ? " es-scope-choice--active" : ""}`} aria-pressed={active} disabled={!editable} onClick={() => onCcChange(candidate.id)}>
                <span className="es-scope-choice__head">
                  <span className="es-scope-choice__name">{candidate.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{candidate.tag}</Badge>
                </span>
                <span className="es-scope-choice__desc">{candidate.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Plant stage" level={3} /></div>
        <div className="es-scope-choices">
          {([
            ["pre_operational", "Pre-operational", "Plant-response data comes from design calculations. Gaps from the plant not yet built are written down as assumptions (ES-A15)."],
            ["operational", "Operational", "Data and procedures from the running plant check the sequences."],
          ] as [Stage, string, string][]).map(([value, title, body]) => (
            <label key={value} className={`es-scope-choice${stage === value ? " es-scope-choice--active" : ""}`}>
              <span className="es-scope-choice__head">
                <WorkbookInput type="radio" name="es-stage" value={value} checked={stage === value} disabled={!editable} onChange={() => onStageChange(value)} />
                <span className="es-scope-choice__name">{title}</span>
              </span>
              <span className="es-scope-choice__desc">{body}</span>
            </label>
          ))}
        </div>
      </div>

      {dialog?.kind === "scope" && <ScopeDialog scopeKey={dialog.key} onClose={() => setDialog(null)} />}
      {dialog?.kind === "function" && <FunctionDialog id={dialog.id} onClose={() => setDialog(null)} />}
    </>
  );
}

export { EsScopeScreen, type EsLinkActions, type EsLinkCode, type EsLinkOption };
