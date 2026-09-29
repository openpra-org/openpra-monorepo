import { JSX } from "react";
import type { SystemsAnalysis, SystemUncertaintyAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { AnalysisRunHistory } from "../newly-developed-methods/shared/analysisRunHistory";
import { IssueLines, NoSystemsCard, NotRecorded, ReviewLines, ReviewTitle } from "./syShared";
import { isSystemLevelModel } from "./sySelectors";
import { SyUncertaintyAnalysis } from "./SyUncertaintyAnalysis";
import {
  ccfSourceIssues,
  ccfSources,
  coverageIssues,
  dependencySourceIssues,
  dependencySources,
  distributionLabel,
  inputRows,
  modelSourceIssues,
  modelSources,
  plantItemIssues,
  plantItems,
  relatedCcfGroups,
  sourceOptions,
  studyIssues,
  systemStudies,
  withSystemAnalysis,
  type PlantList,
} from "./syUncertainty";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";
import "./css/syModels.css";
import "./css/syUncertainty.css";

function rangeText(name: string, range: readonly [number, number] | undefined): string {
  return range === undefined ? name : `${name}: ${range[0]} to ${range[1]}`;
}

function UncertaintyScreen({ sysId, setSysId, openDrawer, onOpenSystems }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenSystems?: () => void;
}): JSX.Element {
  const { sy, shortOf, editable, mutateSy, controlledParameters, runtime } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const found = sy.systemDefinitions.find((candidate) => candidate.uuid === sysId) ?? sy.systemDefinitions[0];

  if (found === undefined) {
    return <NoSystemsCard title="Uncertainty analysis" purpose="record their uncertainty here." onOpenSystems={onOpenSystems} />;
  }

  const system = found;
  const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === system.uuid);
  const systemLevel = model !== undefined && isSystemLevelModel(model);
  const runModelId = model !== undefined && !systemLevel && model.topGate !== null ? model.uuid : undefined;
  const rows = inputRows(sy, system.uuid, controlledParameters);
  const sources = modelSources(sy, system.uuid);
  const ccf = ccfSources(sy, system.uuid);
  const dependencies = dependencySources(sy, system.uuid);
  const studies = systemStudies(sy, system.uuid);
  const options = sourceOptions(sy, system.uuid);
  const related = relatedCcfGroups(sy, system.uuid);
  const coverage = coverageIssues(sy, system.uuid);
  const nameOf = (systemId: string): string => sy.systemDefinitions.find((candidate) => candidate.uuid === systemId)?.name ?? systemId;
  const groupName = (groupId: string): string => sy.commonCauseFailureGroups.find((group) => group.uuid === groupId)?.name ?? groupId;
  const studiesOf = (uncertaintyId: string): string[] => studies.filter((study) => study.modelUncertaintyId === uncertaintyId).map((study) => study.name ?? study.description);

  function update(change: (analysis: SystemUncertaintyAnalysis) => SystemUncertaintyAnalysis): void {
    mutateSy((draft) => withSystemAnalysis(draft, system.uuid, change));
  }

  function addSource(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    update((analysis) => ({ ...analysis, modelUncertainties: [...analysis.modelUncertainties, { uncertaintyId: uuid, description: "", impact: "", isQuantified: false, treatmentApproach: "" }] }));
    openDrawer({ kind: "unc", id: uuid });
  }

  function addCcf(): void {
    if (!editable) return;
    const covered = new Set(ccf.map((item) => item.ccfGroupId));
    const group = related.find((candidate) => !covered.has(candidate.uuid)) ?? related[0];
    if (group === undefined) return;
    const uuid = crypto.randomUUID();
    update((analysis) => ({ ...analysis, ccfUncertainties: [...(analysis.ccfUncertainties ?? []), { uncertaintyId: uuid, ccfGroupId: group.uuid, description: "", impact: "" }] }));
    openDrawer({ kind: "uccf", id: uuid });
  }

  function addDependency(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    update((analysis) => ({ ...analysis, dependencyUncertainties: [...(analysis.dependencyUncertainties ?? []), { uncertaintyId: uuid, description: "", impact: "" }] }));
    openDrawer({ kind: "udep", id: uuid });
  }

  function addStudy(): void {
    const tested = options[0]?.id;
    if (!editable || tested === undefined) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      sensitivityStudies: [...(draft.sensitivityStudies ?? []), {
        uuid,
        name: "",
        description: "",
        variedParameters: [],
        parameterRanges: {},
        modelUncertaintyId: tested,
        implementsSrs: [{ sr: "SY-A32", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "sens", id: uuid });
  }

  const inputsEmpty = model === undefined
    ? "This system has no model yet."
    : systemLevel ? "A system-level model has no basic events to sample." : "This fault tree has no basic events that take a DA estimate.";

  return (
    <>
      <div className="poscard sy-model-card">
        <div className="poscard__head sy-model-card__head">
          <WorkbookSectionHeading workbook="SY" title={system.name} cueKey="Uncertainty analysis" level={3} />
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
          <section className="sy-review-section" aria-label="DA inputs">
            <ReviewTitle title="DA inputs" sr="SY-A32 · DA" />
            {rows.length > 0 && controlledParameters.length === 0 && <p className="sy-review-empty">Link the DA workbook in Step 01 Interfaces to see each input's distribution.</p>}
            {rows.length === 0 ? <p className="sy-review-empty">{inputsEmpty}</p> : (
              <table className="sy-review-table syunc-inputs" aria-label="DA inputs">
                <thead><tr><th scope="col">Basic event</th><th scope="col">DA estimate</th><th scope="col">Distribution</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.event.uuid}>
                      <td>
                        <span className="sy-review-name posmono">{row.event.code}</span>
                        <span className="sy-review-sub">{row.event.name}</span>
                        <IssueLines issues={row.issues} />
                      </td>
                      <td>
                        {row.source === undefined ? <NotRecorded /> : <span>{row.source.parameterName}</span>}
                        {row.source !== undefined && <span className="sy-review-sub">{row.source.workbookName}</span>}
                      </td>
                      <td>{row.distribution === undefined ? <span className="sy-review-none">Point value</span> : distributionLabel(row.distribution)}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${row.event.code}`} onClick={() => openDrawer({ kind: "be", id: row.event.uuid })}>{actionLabel}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="sy-review-section" aria-label="Model uncertainty">
            <ReviewTitle title="Model uncertainty" sr="SY-A32">
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}>Add source</button>}
            </ReviewTitle>
            {sources.length === 0 ? <p className="sy-review-empty">No model uncertainty recorded for this system yet.</p> : (
              <table className="sy-review-table" aria-label="Model uncertainty">
                <thead><tr><th scope="col">Source and the assumption made</th><th scope="col">Effect on the results</th><th scope="col">Treatment</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {sources.map((item, index) => {
                    const tested = studiesOf(item.uncertaintyId);
                    return (
                      <tr key={item.uncertaintyId}>
                        <td>
                          {item.description.length > 0 ? item.description : <NotRecorded />}
                          <IssueLines issues={modelSourceIssues(item)} />
                        </td>
                        <td>{item.impact.length > 0 ? item.impact : <NotRecorded />}</td>
                        <td>
                          {item.treatmentApproach.length > 0 ? <span>{item.treatmentApproach}</span> : <NotRecorded />}
                          <span className="sy-review-sub">{item.isQuantified ? "Quantified" : "Not quantified"}</span>
                          {tested.length > 0 && <span className="sy-review-sub">Tested in {tested.join(", ")}</span>}
                        </td>
                        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} source ${index + 1}`} onClick={() => openDrawer({ kind: "unc", id: item.uncertaintyId })}>{actionLabel}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="sy-review-section" aria-label="Common cause and dependency uncertainty">
            <ReviewTitle title="Common cause and dependency uncertainty" sr="SY-B16">
              {editable && related.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCcf}>Add common cause item</button>}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDependency}>Add dependency item</button>}
            </ReviewTitle>
            <div className="syunc-issues"><IssueLines issues={coverage.filter((item) => item.code === "COVERAGE_CCF")} /></div>
            {ccf.length === 0 && dependencies.length === 0 ? <p className="sy-review-empty">No common cause or dependency uncertainty recorded for this system.</p> : (
              <table className="sy-review-table" aria-label="Common cause and dependency uncertainty">
                <thead><tr><th scope="col">Group or support</th><th scope="col">Source</th><th scope="col">Effect on the results</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {ccf.map((item) => (
                    <tr key={item.uncertaintyId}>
                      <td>
                        <span className="sy-review-name">{groupName(item.ccfGroupId)}</span>
                        <span className="sy-review-sub">Common cause group</span>
                        <IssueLines issues={ccfSourceIssues(sy, system.uuid, item)} />
                      </td>
                      <td>{item.description.length > 0 ? item.description : <NotRecorded />}</td>
                      <td>{item.impact.length > 0 ? item.impact : <NotRecorded />}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${groupName(item.ccfGroupId)} uncertainty`} onClick={() => openDrawer({ kind: "uccf", id: item.uncertaintyId })}>{actionLabel}</button></td>
                    </tr>
                  ))}
                  {dependencies.map((item) => {
                    const support = item.supportingSystem === undefined ? "Shared space or condition" : nameOf(item.supportingSystem);
                    return (
                      <tr key={item.uncertaintyId}>
                        <td>
                          <span className="sy-review-name">{support}</span>
                          <span className="sy-review-sub">Dependency</span>
                          <IssueLines issues={dependencySourceIssues(sy, item)} />
                        </td>
                        <td>{item.description.length > 0 ? item.description : <NotRecorded />}</td>
                        <td>{item.impact.length > 0 ? item.impact : <NotRecorded />}</td>
                        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${support} uncertainty`} onClick={() => openDrawer({ kind: "udep", id: item.uncertaintyId })}>{actionLabel}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="sy-review-section" aria-label="Sensitivity studies">
            <ReviewTitle title="Sensitivity studies" sr="SY-A32">
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={options.length === 0} onClick={addStudy}>Add study</button>}
            </ReviewTitle>
            {studies.length === 0 ? <p className="sy-review-empty">{options.length === 0 ? "Record a source of uncertainty first, then test it with a study." : "No sensitivity study tests this system's uncertainty yet."}</p> : (
              <table className="sy-review-table" aria-label="Sensitivity studies">
                <thead><tr><th scope="col">Study</th><th scope="col">What it varies</th><th scope="col">Result</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {studies.map((study) => {
                    const tested = options.find((option) => option.id === study.modelUncertaintyId)?.label;
                    const name = study.name !== undefined && study.name.length > 0 ? study.name : undefined;
                    return (
                      <tr key={study.uuid}>
                        <td>
                          {name === undefined ? <NotRecorded /> : <span className="sy-review-name">{name}</span>}
                          {tested !== undefined && tested.length > 0 && <span className="sy-review-sub">Tests: {tested}</span>}
                          <IssueLines issues={studyIssues(sy, study)} />
                        </td>
                        <td><ReviewLines items={study.variedParameters.map((parameter) => rangeText(parameter, study.parameterRanges[parameter]))} /></td>
                        <td>{study.results !== undefined && study.results.length > 0 ? study.results : <NotRecorded />}</td>
                        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${name ?? "sensitivity study"}`} onClick={() => openDrawer({ kind: "sens", id: study.uuid })}>{actionLabel}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
      {runModelId !== undefined && <div className="poscard"><SyUncertaintyAnalysis selectedModelId={runModelId} /></div>}
      <AnalysisRunHistory host="sy" workbookId={runtime.workbookId} calculationType="UNCERTAINTY" />
    </>
  );
}

const PLANT_SECTIONS: readonly { list: PlantList; title: string; text: string; detail: string; add: string }[] = [
  { list: "sources", title: "Sources across systems", text: "Source", detail: "Effect on the results", add: "Add source" },
  { list: "assumptions", title: "Related assumptions", text: "Assumption", detail: "Basis", add: "Add assumption" },
  { list: "alternatives", title: "Reasonable alternatives", text: "Alternative", detail: "Why it was not selected", add: "Add alternative" },
];

function withPlantItem(draft: SystemsAnalysis, list: PlantList): SystemsAnalysis {
  const documentation = draft.modelUncertainty;
  if (list === "sources") return { ...draft, modelUncertainty: { ...documentation, uncertaintySources: [...documentation.uncertaintySources, { source: "", impact: "", applicableElements: [] }] } };
  if (list === "assumptions") return { ...draft, modelUncertainty: { ...documentation, relatedAssumptions: [...documentation.relatedAssumptions, { assumption: "", basis: "", applicableElements: [] }] } };
  return { ...draft, modelUncertainty: { ...documentation, reasonableAlternatives: [...documentation.reasonableAlternatives, { alternative: "", reasonNotSelected: "", applicableElements: [] }] } };
}

function PlantUncertainty({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, shortOf, editable, mutateSy } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";

  function add(list: PlantList): void {
    if (!editable) return;
    const index = plantItems(sy, list).length;
    mutateSy((draft) => withPlantItem(draft, list));
    openDrawer({ kind: "puc", id: `${list}:${index}` });
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="SY" title="Plant-wide model uncertainty" level={3} />
      </div>
      <div className="sy-review">
        {PLANT_SECTIONS.map((section) => {
          const items = plantItems(sy, section.list);
          return (
            <section key={section.list} className="sy-review-section" aria-label={section.title}>
              <ReviewTitle title={section.title} sr="SY-A32 · C2">
                {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => add(section.list)}>{section.add}</button>}
              </ReviewTitle>
              {items.length === 0 ? <p className="sy-review-empty">None recorded yet.</p> : (
                <table className="sy-review-table" aria-label={section.title}>
                  <thead><tr><th scope="col">{section.text}</th><th scope="col">{section.detail}</th><th scope="col">Applies to</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={`${section.list}:${index}`}>
                        <td>
                          {item.text.length > 0 ? item.text : <NotRecorded />}
                          <IssueLines issues={plantItemIssues(item, section.list)} />
                        </td>
                        <td>{item.detail.length > 0 ? item.detail : <NotRecorded />}</td>
                        <td>{item.systems.length === 0 ? <NotRecorded /> : item.systems.map(shortOf).join(", ")}</td>
                        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${section.text.toLowerCase()} ${index + 1}`} onClick={() => openDrawer({ kind: "puc", id: `${section.list}:${index}` })}>{actionLabel}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export { PlantUncertainty, UncertaintyScreen };
