import { JSX, useEffect, useId, useRef, useState } from "react";
import type { SyLinkedWorkbooks, SystemDefinition } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { Badge, ReviewLines, SYSTEMS_IN_SCOPE_ID, SystemsInScopeLink } from "./syShared";
import { CAPABILITY_CATEGORIES, type Stage } from "./syViewData";
import { useSyWorkbook, type SyLinkCode } from "./syWorkbookContext";
import { isSystemLevelModel } from "./sySelectors";
import type { SyDrawerContext } from "./syScreens";
import "./css/syScope.css";

const SY_LINK_TILES: { code: SyLinkCode; label: string; name: string; handoff: string }[] = [
  { code: "ES", label: "ES", name: "Event Sequence Analysis", handoff: "Provides · Safety functions" },
  { code: "SC", label: "SC", name: "Success Criteria", handoff: "Provides · System success criteria" },
  { code: "POS", label: "POS", name: "Plant Operating States", handoff: "Provides · Operating states" },
  { code: "DA", label: "DA", name: "Data Analysis", handoff: "Provides · Parameters and distributions" },
  { code: "HRA", label: "HR", name: "Human Reliability", handoff: "Provides · Human error probabilities" },
];

const SYSTEM_PAGE = 10;

type SystemOrder = "OLDEST" | "NEWEST" | "NAME_ASC" | "NAME_DESC";

const SYSTEM_ORDERS: { value: SystemOrder; label: string }[] = [
  { value: "OLDEST", label: "Oldest first" },
  { value: "NEWEST", label: "Newest first" },
  { value: "NAME_ASC", label: "Name, A to Z" },
  { value: "NAME_DESC", label: "Name, Z to A" },
];

function byName(left: SystemDefinition, right: SystemDefinition): number {
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function orderedSystems(systems: readonly SystemDefinition[], order: SystemOrder): SystemDefinition[] {
  switch (order) {
    case "OLDEST": return [...systems];
    case "NEWEST": return [...systems].reverse();
    case "NAME_ASC": return [...systems].sort(byName);
    case "NAME_DESC": return [...systems].sort((left, right) => byName(right, left));
  }
}

const WORKBOOK_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  complete: "Complete",
};

function SyInterfaces(): JSX.Element {
  const { sy, editable, mutateSy, upstream } = useSyWorkbook();
  const [selected, setSelected] = useState<SyLinkCode | null>("ES");
  const selectId = useId();
  const linkedIds: SyLinkedWorkbooks = sy.linkedWorkbooks ?? {};
  const tile = SY_LINK_TILES.find((candidate) => candidate.code === selected);
  const options = tile === undefined ? [] : upstream.options[tile.code];
  const linkedId = tile === undefined ? undefined : linkedIds[tile.code];
  const linked = options.find((workbook) => workbook.id === linkedId);

  function onLink(code: SyLinkCode, id: string): void {
    if (!editable) return;
    mutateSy((draft) => {
      const current: SyLinkedWorkbooks = draft.linkedWorkbooks ?? {};
      const next: SyLinkedWorkbooks = {};
      SY_LINK_TILES.forEach((candidate) => {
        const value = candidate.code === code ? id : current[candidate.code];
        if (value !== undefined && value.length > 0) next[candidate.code] = value;
      });
      return { ...draft, linkedWorkbooks: next };
    });
  }

  return (
    <>
      <div className="poshandoff__grid sy-scope-tiles">
        {SY_LINK_TILES.map((candidate) => (
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
        <div className="sy-scope-lane">
          <div className="sy-scope-link">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select
              id={selectId}
              className="posfield__select"
              value={linkedId ?? ""}
              disabled={!editable || options.length === 0}
              onChange={(event) => onLink(tile.code, event.target.value)}
            >
              <option value="">{options.length === 0 ? `No ${tile.label} workbooks in this project` : "Not linked"}</option>
              {options.map((workbook) => <option key={workbook.id} value={workbook.id}>{workbook.name}</option>)}
            </select>
          </div>
          {options.length === 0 && <p className="posmuted sy-scope-note">Create one on the project page to link it here.</p>}
          {linkedId !== undefined && linked === undefined && <p className="posmuted sy-scope-note">The linked workbook is not in this project.</p>}
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

function SystemsInScope({ openDrawer, focusRequested, onFocused }: {
  openDrawer: (ctx: SyDrawerContext) => void;
  focusRequested: boolean;
  onFocused?: () => void;
}): JSX.Element {
  const { sy, links, editable, mutateSy } = useSyWorkbook();
  const card = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState<SystemOrder>("OLDEST");
  const orderId = useId();

  useEffect(() => {
    if (!focusRequested || card.current === null) return;
    card.current.scrollIntoView({ block: "start" });
    card.current.focus({ preventScroll: true });
    onFocused?.();
  }, [focusRequested, onFocused]);
  const functionNames = new Map((links?.esSafetyFunctions ?? []).map((sf) => [sf.id, sf.name]));
  const actionLabel = editable ? "Edit" : "View";
  const total = sy.systemDefinitions.length;
  const pages = Math.max(1, Math.ceil(total / SYSTEM_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = orderedSystems(sy.systemDefinitions, order).slice(current * SYSTEM_PAGE, (current + 1) * SYSTEM_PAGE);

  function addSystem(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    const added: SystemDefinition = {
      uuid,
      name: "New system",
      boundaries: [],
      successCriteriaIds: [],
      modeledComponentsAndFailures: {},
      informationBasis: sy.plantStage === "OPERATIONAL" ? "as-built-as-operated" : "as-designed-as-intended",
      implementsSrs: [{ sr: "SY-A1", hlr: "A" }],
    };
    const position = orderedSystems([...sy.systemDefinitions, added], order).findIndex((def) => def.uuid === uuid);
    setPage(Math.floor(Math.max(0, position) / SYSTEM_PAGE));
    mutateSy((draft) => ({ ...draft, systemDefinitions: [...draft.systemDefinitions, added] }));
    openDrawer({ kind: "system", id: uuid });
  }

  return (
    <div className="poscard sy-systems-in-scope" id={SYSTEMS_IN_SCOPE_ID} ref={card} tabIndex={-1}>
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="SY" title="Systems in scope" level={3} />
        <div className="posrow">
          {total > 1 && (
            <>
              <label className="posfield__label sy-sort__label" htmlFor={orderId}>Sort</label>
              <select id={orderId} className="posfield__select sy-sort__select" value={order} onChange={(event) => {
                const next = SYSTEM_ORDERS.find((option) => option.value === event.target.value);
                if (next !== undefined) { setOrder(next.value); setPage(0); }
              }}>
                {SYSTEM_ORDERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </>
          )}
          {pages > 1 ? (
            <span className="sy-pager">
              <span className="possubtle">{current * SYSTEM_PAGE + 1} to {Math.min(total, (current + 1) * SYSTEM_PAGE)} of {total} systems</span>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
            </span>
          ) : <span className="possubtle">{total} system{total === 1 ? "" : "s"}</span>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSystem}>Add system</button>}
        </div>
      </div>
      <div className="sy-review">
        {sy.systemDefinitions.length === 0 ? <p className="sy-review-empty">No systems in scope yet. Add a system to start, then build its fault tree in Step 02.</p> : (
          <table className="sy-review-table sy-scope-systems" aria-label="Systems in scope">
            <thead><tr><th scope="col">System</th><th scope="col">Safety functions</th><th scope="col">Model depth</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
            <tbody>
              {shown.map((def) => {
                const functions = sy.systemToSafetyFunctionMappings.find((mapping) => mapping.systemReference === def.uuid)?.safetyFunctions ?? [];
                const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === def.uuid);
                const systemLevel = model !== undefined && isSystemLevelModel(model);
                const justification = model?.nonDetailedModelJustification ?? "";
                return (
                  <tr key={def.uuid}>
                    <td>
                      <span className="sy-review-name">{def.name}</span>
                      {def.abbreviation !== undefined && <span className="sy-review-sub posmono">{def.abbreviation}</span>}
                    </td>
                    <td>
                      <ReviewLines items={functions.map((id) => { const name = functionNames.get(id); return name === undefined ? id : `${id} · ${name}`; })} />
                    </td>
                    <td>
                      <span>{systemLevel ? "System-level model" : "Detailed fault tree"}</span>
                      {systemLevel && (justification.trim().length === 0
                        ? <span className="sy-error">Justification required</span>
                        : <span className="sy-review-sub">{justification}</span>)}
                    </td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${def.name}`} onClick={() => openDrawer({ kind: "system", id: def.uuid })}>{actionLabel}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage, onAction, openDrawer, onOpenSystems, systemsFocus = false, onSystemsFocused }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenSystems?: () => void;
  systemsFocus?: boolean;
  onSystemsFocused?: () => void;
}): JSX.Element {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  function onCcChange(nextId: string): void {
    if (!editable) return;
    setCcId(nextId);
    mutateSy((draft) => ({ ...draft, capabilityCategory: nextId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(nextStage: Stage): void {
    if (!editable) return;
    setStage(nextStage);
    onAction(`Plant stage set to ${nextStage === "operational" ? "Operational" : "Pre-operational"}`);
    const informationBasis = nextStage === "operational" ? "as-built-as-operated" : "as-designed-as-intended";
    mutateSy((draft) => ({
      ...draft,
      plantStage: nextStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL",
      systemDefinitions: draft.systemDefinitions.map((def) => ({ ...def, informationBasis })),
    }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Interfaces" level={3} /></div>
        <p className="poscard__sub">Links are optional. A linked workbook fills matching fields here, such as safety functions from ES or estimates from DA. Without links, add the systems in <SystemsInScopeLink onOpen={onOpenSystems} /> below and type the values yourself.</p>
        <SyInterfaces />
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="PRA scope" level={3} /></div>
        <WorkbookTextarea
          className="posfield__textarea sy-scope-text"
          aria-label="PRA scope"
          rows={3}
          value={sy.praScope}
          disabled={!editable}
          onChange={(event) => { if (editable) mutateSy((draft) => ({ ...draft, praScope: event.target.value })); }}
        />
      </div>

      <SystemsInScope openDrawer={openDrawer} focusRequested={systemsFocus} onFocused={onSystemsFocused} />

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div className="sy-scope-choices">
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className={`sy-scope-choice${active ? " sy-scope-choice--active" : ""}`} aria-pressed={active} disabled={!editable} onClick={() => onCcChange(c.id)}>
                <span className="sy-scope-choice__head">
                  <span className="sy-scope-choice__name">{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </span>
                <span className="sy-scope-choice__desc">{c.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Plant stage" level={3} /></div>
        <div className="sy-scope-choices">
          {([
            ["pre_operational", "Pre-operational", "Models rest on design information. Gaps that walkdowns and operating practice would close are logged as pre-operational assumptions."],
            ["operational", "Operational", "Walkdowns, staff discussions and maintenance history confirm the models against the as-built, as-operated plant."],
          ] as [Stage, string, string][]).map(([value, title, body]) => (
            <label key={value} className={`sy-scope-choice${stage === value ? " sy-scope-choice--active" : ""}`}>
              <span className="sy-scope-choice__head">
                <WorkbookInput type="radio" name="sy-stage" value={value} checked={stage === value} disabled={!editable} onChange={() => onStageChange(value)} />
                <span className="sy-scope-choice__name">{title}</span>
              </span>
              <span className="sy-scope-choice__desc">{body}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

export { ScopeScreen };
