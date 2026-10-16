import { JSX } from "react";
import type { DepletionModel, SystemDependency } from "interfaces-mef-types/sy/systems-analysis";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { IssueLines, NoSystemsCard, NotRecorded, ReviewLines, ReviewTitle } from "./syShared";
import { RESOURCE_TYPE_LABELS } from "./syViewData";
import { systemTree } from "./syFailureRecords";
import {
  DEPENDENCY_TREATMENT_LABELS,
  SUPPORT_KIND_LABELS,
  coverageIssue,
  dependencyLinks,
  inventoryHours,
  linkDescription,
  linkIssues,
  linkKey,
  newDependency,
  treatmentOf,
  type DependencyIssue,
  type DependencyLink,
} from "./syDependencyLinks";
import { useSyWorkbook } from "./syWorkbookContext";
import { useSystemHours } from "./syMissionTimes";
import { hoursText } from "../sc-workbooks/scMissionTimePoints";
import type { SyDrawerContext } from "./syScreens";
import "./css/syModels.css";
import "./css/syDependencies.css";

interface LinkRow {
  link: DependencyLink;
  record: SystemDependency | undefined;
}

function linkRows(links: readonly DependencyLink[]): LinkRow[] {
  return links.flatMap((link): LinkRow[] => (link.records.length === 0 ? [{ link, record: undefined }] : link.records.map((record) => ({ link, record }))));
}

function hoursLabel(item: DepletionModel): string | null {
  if (item.initialQuantity <= 0) return "Does not deplete";
  const hours = inventoryHours(item);
  return hours === null ? null : `${Number(hours.toPrecision(4))} h`;
}

function DependenciesScreen({ sysId, setSysId, openDrawer, onOpenSystems }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenSystems?: () => void;
}): JSX.Element {
  const { sy, shortOf, editable, mutateSy, links } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const found = sy.systemDefinitions.find((candidate) => candidate.uuid === sysId) ?? sy.systemDefinitions[0];
  const missionHours = useSystemHours(found === undefined ? [] : [found]).get(found?.uuid ?? "");

  if (found === undefined) {
    return <NoSystemsCard title="Dependencies" purpose="trace their dependencies here." onOpenSystems={onOpenSystems} />;
  }

  const system = found;
  const nameOf = (id: string): string => sy.systemDefinitions.find((candidate) => candidate.uuid === id)?.name ?? id;
  const byName = (left: string, right: string): number => nameOf(left).localeCompare(nameOf(right));
  const allLinks = dependencyLinks(sy, links);
  const needs = allLinks.filter((link) => link.dependentSystem === system.uuid).sort((left, right) => byName(left.supportingSystem, right.supportingSystem));
  const neededBy = allLinks.filter((link) => link.supportingSystem === system.uuid).sort((left, right) => byName(left.dependentSystem, right.dependentSystem));
  const criteria = (sy.supportSystemSuccessCriteria ?? []).filter((criterion) => criterion.systemReference === system.uuid);
  const analyses = (sy.supportSystemNeedAnalyses ?? []).filter((analysis) => analysis.systemReference === system.uuid);
  const eventIds = new Set(systemTree(sy, system.uuid).events.map((event) => event.uuid));
  const eventById = new Map(sy.systemBasicEvents.map((event) => [event.uuid, event]));
  const eventOwner = new Map(sy.systemLogicModels.flatMap((model) => model.leafNodes.flatMap((leaf) => (leaf.kind === "BASIC_EVENT_REFERENCE" ? [[leaf.basicEventId, model.systemReference] as const] : []))));
  const couplings = (sy.environmentalDesignBasisConsiderations ?? []).filter((item) => item.systemReference === system.uuid || (item.basicEventIds ?? []).some((id) => eventIds.has(id)));
  const inventories = (sy.depletionModels ?? []).filter((item) => item.associatedSystem === system.uuid);
  const actuations = (sy.initiationActuationSystems ?? []).filter((item) => item.systemReference === system.uuid);
  const digital = (sy.digitalInstrumentationAndControl ?? []).filter((item) => item.systemReference === system.uuid);
  const preOperational = sy.plantStage === "PRE_OPERATIONAL";
  const assumptions = (sy.preOperationalAssumptions ?? []).filter((item) =>
    item.affectedElementIds.includes(system.uuid) && (item.implementsSrs ?? []).some((reference) => reference.sr === "SY-B10" || reference.sr === "SY-B17"));
  const initiatingNames = new Map((links?.esInitiatingEvents ?? []).map((event) => [event.id, event.name]));

  function openLink(row: LinkRow): void {
    if (row.record !== undefined) {
      openDrawer({ kind: "dep", id: row.record.uuid });
      return;
    }
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({ ...draft, systemDependencies: [...draft.systemDependencies, newDependency(row.link, uuid)] }));
    openDrawer({ kind: "dep", id: uuid });
  }

  function addSupport(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    const supportingSystem = sy.systemDefinitions.find((candidate) => candidate.uuid !== system.uuid)?.uuid ?? "";
    mutateSy((draft) => ({ ...draft, systemDependencies: [...draft.systemDependencies, newDependency({ dependentSystem: system.uuid, supportingSystem, transfers: [] }, uuid)] }));
    openDrawer({ kind: "dep", id: uuid });
  }

  function addCriterion(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      supportSystemSuccessCriteria: [...(draft.supportSystemSuccessCriteria ?? []), {
        uuid,
        systemReference: system.uuid,
        successCriteria: "",
        criteriaType: "CONSERVATIVE" as const,
        supportedSystems: [],
        implementsSrs: [{ sr: "SY-B7", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "ssc", id: uuid });
  }

  function addAnalysis(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      supportSystemNeedAnalyses: [...(draft.supportSystemNeedAnalyses ?? []), {
        uuid,
        systemReference: system.uuid,
        analysisReference: "",
        conditionsRepresented: [],
        implementsSrs: [{ sr: "SY-B6", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "need", id: uuid });
  }

  function addCoupling(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      environmentalDesignBasisConsiderations: [...(draft.environmentalDesignBasisConsiderations ?? []), {
        uuid,
        systemReference: system.uuid,
        components: [],
        eventSequences: [],
        environmentalConditions: "",
        basicEventIds: [],
        initiatingEventIds: [],
        implementsSrs: [{ sr: "SY-B8", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "spc", id: uuid });
  }

  function addInventory(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      depletionModels: [...(draft.depletionModels ?? []), {
        uuid,
        resourceType: "other" as const,
        description: "",
        initialQuantity: 0,
        consumptionRate: 1,
        units: "hours",
        associatedSystem: system.uuid,
        implementsSrs: [{ sr: "SY-B12", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "inv", id: uuid });
  }

  function addActuation(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      initiationActuationSystems: [...(draft.initiationActuationSystems ?? []), {
        uuid,
        name: "",
        systemReference: system.uuid,
        description: "",
        detailedModeling: true,
        implementsSrs: [{ sr: "SY-B11", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "act", id: uuid });
  }

  function addDigital(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      digitalInstrumentationAndControl: [...(draft.digitalInstrumentationAndControl ?? []), {
        uuid,
        name: "",
        systemReference: system.uuid,
        description: "",
        methodology: "",
        implementsSrs: [{ sr: "SY-B11", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "dic", id: uuid });
  }

  function addAssumption(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      preOperationalAssumptions: [...(draft.preOperationalAssumptions ?? []), {
        uuid,
        assumptionId: uuid,
        description: "",
        influenceOnDefinition: "Dependency modeling",
        status: "OPEN" as const,
        limitations: [],
        riskImpact: ImportanceLevel.MEDIUM,
        closureBasis: "",
        plannedClosureActions: [],
        affectedElementIds: [system.uuid],
        implementsSrs: [{ sr: "SY-B10", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "assum", id: uuid });
  }

  function dependencyRow(row: LinkRow, other: string, extra: DependencyIssue | null): JSX.Element {
    const { link, record } = row;
    const treatment = record === undefined ? (link.transfers.length > 0 ? "SYSTEM_MODEL" : undefined) : treatmentOf(record, link);
    const issues = [...linkIssues(link, record, sy, allLinks), ...(extra === null ? [] : [extra])];
    const description = linkDescription(link, record);
    const label = `${actionLabel} ${nameOf(other)} ${other === link.supportingSystem ? "support" : "need"}`;
    return (
      <tr key={record?.uuid ?? linkKey(link.dependentSystem, link.supportingSystem)}>
        <td>
          <span className="sy-review-name">{nameOf(other)}</span>
          <span className="sy-review-sub">{record?.supportKind === undefined ? "Kind not recorded" : SUPPORT_KIND_LABELS[record.supportKind]}</span>
          <IssueLines issues={issues} />
        </td>
        <td>{description === undefined ? <NotRecorded /> : description}</td>
        <td>
          {treatment === undefined ? <NotRecorded /> : <span>{DEPENDENCY_TREATMENT_LABELS[treatment]}</span>}
          {treatment === "EXCLUDED" && (record?.exclusionJustification ?? "").length > 0 && <span className="sy-review-sub">{record?.exclusionJustification}</span>}
        </td>
        <td className="sy-review-edit">
          {(record !== undefined || editable) && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={label} onClick={() => openLink(row)}>{actionLabel}</button>}
        </td>
      </tr>
    );
  }

  const noTree = systemTree(sy, system.uuid).state !== "TREE";

  return (
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
        <section className="sy-review-section" aria-label="Support it needs">
          <ReviewTitle title="Support it needs" sr="SY-B5 · B9 · B13 · B15">
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSupport}>Add support</button>}
          </ReviewTitle>
          {needs.length === 0 ? <p className="sy-review-empty">{noTree ? "This system has no fault tree, so it transfers to no support system." : "This system needs no support from another system."}</p> : (
            <table className="sy-review-table sy-review-deps" aria-label="Support it needs">
              <thead><tr><th scope="col">Support system</th><th scope="col">What it provides</th><th scope="col">Treatment</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>{linkRows(needs).map((row) => dependencyRow(row, row.link.supportingSystem, null))}</tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Systems that need it">
          <ReviewTitle title="Systems that need it" sr="SY-B5 · B7" />
          {neededBy.length === 0 ? <p className="sy-review-empty">No other system needs this one.</p> : (
            <table className="sy-review-table sy-review-deps" aria-label="Systems that need it">
              <thead><tr><th scope="col">System</th><th scope="col">What it needs</th><th scope="col">Treatment</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>{linkRows(neededBy).map((row) => dependencyRow(row, row.link.dependentSystem, row.record === undefined || row.record === row.link.records[0] ? coverageIssue(row.link, sy) : null))}</tbody>
            </table>
          )}
        </section>

        {(neededBy.length > 0 || criteria.length > 0) && (
          <section className="sy-review-section" aria-label="Support success criteria">
            <ReviewTitle title="Support success criteria" sr="SY-B7 · B9">
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCriterion}>Add criterion</button>}
            </ReviewTitle>
            {criteria.length === 0 ? <p className="sy-review-empty">No success criterion recorded for the support this system gives.</p> : (
              <table className="sy-review-table" aria-label="Support success criteria">
                <thead><tr><th scope="col">Criterion</th><th scope="col">Basis</th><th scope="col">Serves</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {criteria.map((criterion) => (
                    <tr key={criterion.uuid}>
                      <td>{criterion.successCriteria.length > 0 ? criterion.successCriteria : <NotRecorded />}</td>
                      <td>{criterion.criteriaType === "REALISTIC" ? "Realistic" : "Conservative"}</td>
                      <td><ReviewLines items={criterion.supportedSystems.map(nameOf)} /></td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} success criterion`} onClick={() => openDrawer({ kind: "ssc", id: criterion.uuid })}>{actionLabel}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <section className="sy-review-section" aria-label="Support need analyses">
          <ReviewTitle title="Support need analyses" sr="SY-B6">
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAnalysis}>Add analysis</button>}
          </ReviewTitle>
          {analyses.length === 0 ? <p className="sy-review-empty">No engineering analysis of this system's support needs recorded.</p> : (
            <table className="sy-review-table" aria-label="Support need analyses">
              <thead><tr><th scope="col">Analysis</th><th scope="col">Conditions it covers</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {analyses.map((analysis) => (
                  <tr key={analysis.uuid}>
                    <td>{analysis.analysisReference.length > 0 ? <span className="sy-review-name">{analysis.analysisReference}</span> : <NotRecorded />}</td>
                    <td><ReviewLines items={analysis.conditionsRepresented} /></td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${analysis.analysisReference.length > 0 ? analysis.analysisReference : "analysis"}`} onClick={() => openDrawer({ kind: "need", id: analysis.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Shared spaces and harsh conditions">
          <ReviewTitle title="Shared spaces and harsh conditions" sr="SY-B8 · B14">
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCoupling}>Add condition</button>}
          </ReviewTitle>
          {couplings.length === 0 ? <p className="sy-review-empty">No shared space or harsh condition affects this system.</p> : (
            <table className="sy-review-table" aria-label="Shared spaces and harsh conditions">
              <thead><tr><th scope="col">Condition</th><th scope="col">Events it affects</th><th scope="col">Initiating events</th><th scope="col">In the model</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {couplings.map((item) => {
                  const affected = (item.basicEventIds ?? []).map((id) => {
                    const owner = eventOwner.get(id);
                    const name = eventById.get(id)?.name ?? id;
                    return owner === undefined || owner === system.uuid ? name : `${name} (${shortOf(owner)})`;
                  });
                  return (
                    <tr key={item.uuid}>
                      <td>
                        {item.environmentalConditions.length > 0 ? item.environmentalConditions : <NotRecorded />}
                        {item.dependentFailuresIncluded !== true && <span className="sy-warn">Not in the model yet.</span>}
                      </td>
                      <td><ReviewLines items={affected} /></td>
                      <td><ReviewLines items={(item.initiatingEventIds ?? []).map((id) => initiatingNames.get(id) ?? id)} /></td>
                      <td>
                        <span>{item.dependentFailuresIncluded === true ? "In the model" : "Not in the model"}</span>
                        {item.beyondQualification === true && <span className="sy-review-sub">Beyond environmental qualification</span>}
                      </td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} shared condition`} onClick={() => openDrawer({ kind: "spc", id: item.uuid })}>{actionLabel}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Inventories">
          <ReviewTitle title="Inventories" sr="SY-B12">
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addInventory}>Add inventory</button>}
          </ReviewTitle>
          {inventories.length === 0 ? <p className="sy-review-empty">This system draws on no depletable inventory of air, power or cooling.</p> : (
            <table className="sy-review-table" aria-label="Inventories">
              <thead><tr><th scope="col">Inventory</th><th scope="col">Lasts</th><th scope="col">Mission time</th><th scope="col">Basis</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {inventories.map((item) => {
                  const lasts = hoursLabel(item);
                  const name = item.description !== undefined && item.description.length > 0 ? item.description : RESOURCE_TYPE_LABELS[item.resourceType];
                  return (
                    <tr key={item.uuid}>
                      <td>
                        <span className="sy-review-name">{name}</span>
                        <span className="sy-review-sub">{RESOURCE_TYPE_LABELS[item.resourceType]}</span>
                        {item.missionTimeSupported === false && <span className="sy-warn">Falls short of the mission time.</span>}
                      </td>
                      <td className="posmono sy-review-num">{lasts === null ? <NotRecorded /> : lasts}</td>
                      <td>
                        <span className="posmono sy-review-num">{system.missionTime === undefined ? "Not recorded" : hoursText(missionHours)}</span>
                        <span className="sy-review-sub">{item.missionTimeSupported === true ? "Carries it" : item.missionTimeSupported === false ? "Falls short" : "Not assessed"}</span>
                      </td>
                      <td>{item.basis !== undefined && item.basis.length > 0 ? item.basis : <NotRecorded />}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${name}`} onClick={() => openDrawer({ kind: "inv", id: item.uuid })}>{actionLabel}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Actuation and software">
          <ReviewTitle title="Actuation and software" sr="SY-B11">
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addActuation}>Add actuation</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDigital}>Add digital I&C</button>}
          </ReviewTitle>
          {actuations.length === 0 && digital.length === 0 ? <p className="sy-review-empty">No actuation logic or digital I&C recorded for this system.</p> : (
            <table className="sy-review-table" aria-label="Actuation and software">
              <thead><tr><th scope="col">Record</th><th scope="col">How the model treats it</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {actuations.map((item) => {
                  const missing = !item.detailedModeling && (item.justificationForNonDetailedModeling ?? "").trim().length === 0;
                  return (
                    <tr key={item.uuid}>
                      <td>
                        {item.name.length > 0 ? <span className="sy-review-name">{item.name}</span> : <NotRecorded />}
                        <span className="sy-review-sub">Actuation</span>
                        {missing && <span className="sy-error">Reason required for the simpler model.</span>}
                      </td>
                      <td>
                        <span>{item.detailedModeling ? "Modeled in detail" : "Modeled without detail"}</span>
                        {!item.detailedModeling && (item.justificationForNonDetailedModeling ?? "").length > 0 && <span className="sy-review-sub">{item.justificationForNonDetailedModeling}</span>}
                        {(item.softwareModelingApproach ?? "").length > 0 && <span className="sy-review-sub">Software: {item.softwareModelingApproach}</span>}
                      </td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${item.name.length > 0 ? item.name : "actuation"}`} onClick={() => openDrawer({ kind: "act", id: item.uuid })}>{actionLabel}</button></td>
                    </tr>
                  );
                })}
                {digital.map((item) => (
                  <tr key={item.uuid}>
                    <td>
                      {item.name.length > 0 ? <span className="sy-review-name">{item.name}</span> : <NotRecorded />}
                      <span className="sy-review-sub">Digital I&C</span>
                    </td>
                    <td>
                      {item.methodology.length > 0 ? <span>{item.methodology}</span> : <NotRecorded />}
                      {(item.failureModes ?? []).length > 0 && <span className="sy-review-sub">Failure modes: {(item.failureModes ?? []).join(", ")}</span>}
                    </td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${item.name.length > 0 ? item.name : "digital I&C"}`} onClick={() => openDrawer({ kind: "dic", id: item.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {preOperational && (
          <section className="sy-review-section" aria-label="Independence assumptions">
            <ReviewTitle title="Independence assumptions" sr="SY-B10 · B17">
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAssumption}>Add assumption</button>}
            </ReviewTitle>
            {assumptions.length === 0 ? <p className="sy-review-empty">No dependency assumption recorded for this system.</p> : (
              <table className="sy-review-table" aria-label="Independence assumptions">
                <thead><tr><th scope="col">Assumption</th><th scope="col">Status</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {assumptions.map((item) => (
                    <tr key={item.uuid}>
                      <td>{item.description.length > 0 ? item.description : <NotRecorded />}</td>
                      <td>{item.status === "CLOSED" ? "Closed" : item.status === "IN_PROGRESS" ? "In progress" : "Open"}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} assumption`} onClick={() => openDrawer({ kind: "assum", id: item.uuid })}>{actionLabel}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export { DependenciesScreen };
