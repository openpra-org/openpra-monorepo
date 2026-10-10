import { JSX } from "react";
import type { CommonCauseFailureGroup } from "interfaces-mef-types/sy/systems-analysis";
import { ccfFactorDraft } from "../newly-developed-methods/shared/uncertainEditor";
import { NoSystemsCard, NotRecorded, PointValue, ReviewLines, ReviewTitle } from "./syShared";
import { ccfFactorText, ccfModelText, groupTotal, linkedEstimate, memberEvents, sharedCauseLines, validateCcfGroup, vectorLengths } from "./syCcf";
import { systemTree } from "./syFailureRecords";
import { SyCcfAnalysis } from "./SyCcfAnalysis";
import { useExpressionPoints } from "./syBasicEventValues";
import { useSyValueSources } from "./syMissionTimes";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";
import "./css/syModels.css";

type GroupScope = CommonCauseFailureGroup["scope"];

function CommonCauseScreen({ sysId, setSysId, openDrawer, onOpenSystems }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenSystems?: () => void;
}): JSX.Element {
  const { sy, shortOf, editable, mutateSy, controlledCcfEstimates, controlledCcfVectors } = useSyWorkbook();
  const lengths = vectorLengths(controlledCcfVectors);
  const values = useSyValueSources();
  const actionLabel = editable ? "Edit" : "View";
  const found = sy.systemDefinitions.find((candidate) => candidate.uuid === sysId) ?? sy.systemDefinitions[0];
  const shownGroups = found === undefined ? [] : sy.commonCauseFailureGroups.filter((group) => group.affectedSystems.includes(found.uuid));
  const totaled = shownGroups.flatMap((group) => {
    const total = groupTotal(group, sy);
    return total === undefined ? [] : [{ id: group.uuid, total }];
  });
  const totals = useExpressionPoints(totaled.map(({ total }) => total), values.table);
  const totalById = new Map(totaled.map(({ id }, index) => [id, totals[index]]));
  const label = values.label;

  if (found === undefined) {
    return <NoSystemsCard title="Common cause" purpose="group their common cause failures here." onOpenSystems={onOpenSystems} />;
  }

  const system = found;
  const tree = systemTree(sy, system.uuid);
  const logic = sy.systemLogicModels.find((model) => model.systemReference === system.uuid);
  const within = sy.commonCauseFailureGroups.filter((group) => group.scope === "INTRASYSTEM" && group.affectedSystems[0] === system.uuid);
  const across = sy.commonCauseFailureGroups.filter((group) => group.scope === "INTERSYSTEM" && group.affectedSystems.includes(system.uuid));
  const treeNote = tree.state === "SYSTEM_LEVEL"
    ? "This system uses a system-level model, so it has no component events to group."
    : "This system has no fault tree yet. Build it in Step 02.";

  function addGroup(scope: GroupScope): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      commonCauseFailureGroups: [...draft.commonCauseFailureGroups, {
        uuid,
        name: "",
        description: "",
        scope,
        affectedComponents: [],
        affectedSystems: [system.uuid],
        factors: ccfFactorDraft("BETA_FACTOR", 2, "NON_STAGGERED"),
        total: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0 } } },
        members: { basicEvents: [] },
        implementsSrs: [{ sr: scope === "INTRASYSTEM" ? "SY-B1" : "SY-B2", hlr: "B" as const }, { sr: "SY-B3", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "ccf", id: uuid });
  }

  function sourceLine(group: CommonCauseFailureGroup): string {
    const reference = group.dataAnalysisCCFParameterRef;
    if (reference === undefined || reference.length === 0) {
      const typed = group.dataSources?.[0]?.reference;
      return typed === undefined || typed.length === 0 ? "Typed in this workbook" : `Typed · ${typed}`;
    }
    const estimate = linkedEstimate(group, controlledCcfEstimates);
    if (estimate !== undefined) return `DA ${estimate.estimateId} · ${estimate.workbookName}`;
    return controlledCcfEstimates.length === 0 ? `DA ${reference} · DA workbook not linked` : `DA ${reference}`;
  }

  function groupRow(group: CommonCauseFailureGroup): JSX.Element {
    const name = group.name.length > 0 ? group.name : "Unnamed group";
    const issues = validateCcfGroup(group, sy, controlledCcfEstimates, lengths);
    const members = memberEvents(group, sy);
    return (
      <tr key={group.uuid}>
        <td>
          <span className="sy-review-name">{name}</span>
          {group.scope === "INTERSYSTEM" && <span className="sy-review-sub">Affects {group.affectedSystems.map(shortOf).join(", ")}</span>}
          {issues.map((issue) => (
            <span key={`${issue.code}:${issue.message}`} className={issue.severity === "ERROR" ? "sy-error" : "sy-warn"}>{issue.message}</span>
          ))}
        </td>
        <td><ReviewLines items={members.map((event) => event.name)} /></td>
        <td><ReviewLines items={sharedCauseLines(group)} /></td>
        <td>
          <span>{ccfModelText(group.factors)}</span>
          <span className="sy-review-sub posmono sy-review-factors">{ccfFactorText(group.factors, label)}</span>
          <span className="sy-review-sub">{sourceLine(group)}</span>
        </td>
        <td className="posmono sy-review-num">{members.length === 0 ? <NotRecorded /> : totalById.has(group.uuid) ? <PointValue state={totalById.get(group.uuid)} /> : <span className="sy-review-sub">From the model</span>}</td>
        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${name}`} onClick={() => openDrawer({ kind: "ccf", id: group.uuid })}>{actionLabel}</button></td>
      </tr>
    );
  }

  function groupSection(scope: GroupScope, title: string, sr: string, groups: readonly CommonCauseFailureGroup[], empty: string): JSX.Element {
    return (
      <section className="sy-review-section" aria-label={title}>
        <ReviewTitle title={title} sr={sr}>
          {editable && tree.state === "TREE" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" aria-label={`Add group ${title.toLowerCase()}`} onClick={() => addGroup(scope)}>Add group</button>}
        </ReviewTitle>
        {tree.state !== "TREE" && groups.length === 0 ? <p className="sy-review-empty">{treeNote}</p>
          : groups.length === 0 ? <p className="sy-review-empty">{empty}</p> : (
            <table className="sy-review-table sy-review-ccf" aria-label={title}>
              <thead><tr><th scope="col">Group</th><th scope="col">Member events</th><th scope="col">Shared causes</th><th scope="col">Parameters</th><th scope="col">Qₜ</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>{groups.map(groupRow)}</tbody>
            </table>
          )}
      </section>
    );
  }

  return (
    <>
      <div className="poscard sy-model-card">
        <div className="poscard__head sy-model-card__head">
          <label className="sy-model-card__picker">
            <span className="posfield__label">System</span>
            <select className="posfield__select" aria-label="System" value={system.uuid} onChange={(event) => setSysId(event.target.value)}>
              {sy.systemDefinitions.map((candidate) => (
                <option key={candidate.uuid} value={candidate.uuid}>{shortOf(candidate.uuid)} · {candidate.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="sy-review">
          {groupSection("INTRASYSTEM", "Within this system", "SY-B1 · B3 · B4", within, "No common cause group within this system.")}
          {groupSection("INTERSYSTEM", "Across systems", "SY-B2 · B3 · B4", across, "No common cause group links this system to another.")}
        </div>
      </div>
      {logic !== undefined && tree.state === "TREE" && logic.topGate !== null && (
        <div className="poscard"><SyCcfAnalysis key={logic.uuid} currentModelId={logic.uuid} /></div>
      )}
    </>
  );
}

export { CommonCauseScreen };
