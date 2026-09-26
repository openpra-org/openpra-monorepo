import { JSX, useId, useState } from "react";
import type { SyLinkedWorkbooks } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { Badge, ReviewLines } from "./syShared";
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

const WORKBOOK_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  complete: "Complete",
};

const DEFAULT_MISSION_TIME_HOURS = 24;

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

function SystemsInScope({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, links, editable, mutateSy } = useSyWorkbook();
  const functionNames = new Map((links?.esSafetyFunctions ?? []).map((sf) => [sf.id, sf.name]));
  const actionLabel = editable ? "Edit" : "View";

  function addSystem(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      systemDefinitions: [...draft.systemDefinitions, {
        uuid,
        name: "New system",
        boundaries: [],
        successCriteriaIds: [],
        missionTimeHours: DEFAULT_MISSION_TIME_HOURS,
        modeledComponentsAndFailures: {},
        informationBasis: draft.plantStage === "OPERATIONAL" ? "as-built-as-operated" : "as-designed-as-intended",
        implementsSrs: [{ sr: "SY-A1", hlr: "A" }],
      }],
    }));
    openDrawer({ kind: "system", id: uuid });
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="SY" title="Systems in scope" level={3} />
        <div className="posrow">
          <span className="possubtle">{sy.systemDefinitions.length} system{sy.systemDefinitions.length === 1 ? "" : "s"}</span>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSystem}>Add system</button>}
        </div>
      </div>
      <div className="sy-review">
        {sy.systemDefinitions.length === 0 ? <p className="sy-review-empty">No systems in scope yet.</p> : (
          <table className="sy-review-table sy-scope-systems" aria-label="Systems in scope">
            <thead><tr><th scope="col">System</th><th scope="col">Safety functions</th><th scope="col">Model depth</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
            <tbody>
              {sy.systemDefinitions.map((def) => {
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

function ScopeScreen({ ccId, setCcId, stage, setStage, onAction, openDrawer }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
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

      <SystemsInScope openDrawer={openDrawer} />

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
