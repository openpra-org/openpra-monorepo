import { JSX } from "react";
import type { SystemBasicEvent } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { NotRecorded, ReviewLines, ReviewTitle } from "./syShared";
import { SCREENING_CRITERIA, toExp } from "./syViewData";
import { TREATMENT_LABELS, humanFailureOption, integrationFor, systemOutages, systemTree } from "./syFailureRecords";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";
import "./css/syModels.css";

function FailureModesScreen({ sysId, setSysId, openDrawer, onOpenScope }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenScope?: () => void;
}): JSX.Element {
  const { sy, shortOf, editable, mutateSy, controlledHumanFailures, controlledCoincidentMaintenance } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const found = sy.systemDefinitions.find((candidate) => candidate.uuid === sysId) ?? sy.systemDefinitions[0];

  if (found === undefined) {
    return (
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Failure modes" level={3} />
          <span className="possubtle">0 systems</span>
        </div>
        <p className="posmuted">No systems are in scope yet. Add the systems to model in Step 01, then review their failure modes here.</p>
        {onOpenScope !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary sy-model-card__scope" onClick={onOpenScope}>Go to Scope</button>}
      </div>
    );
  }

  const system = found;
  const tree = systemTree(sy, system.uuid);
  const eventIds = new Set(tree.events.map((event) => event.uuid));
  const eventNames = new Map(tree.events.map((event) => [event.uuid, event.name]));
  const humanEvents = tree.events.filter((event) => event.failureMode === "HUMAN_ERROR");
  const integrations = sy.humanFailureEventIntegrations.filter((item) => item.system === system.uuid);
  const placed = new Set(humanEvents.flatMap((event) => {
    const integration = integrationFor(integrations, event);
    return integration === undefined ? [] : [integration.uuid];
  }));
  const unplaced = integrations.filter((item) => !placed.has(item.uuid));
  const screenings = (sy.componentScreeningJustifications ?? []).filter((item) => item.systemReference === system.uuid);
  const signals = (sy.isolationTripConditions ?? []).filter((item) => item.systemReference === system.uuid);
  const outages = systemOutages(sy, system.uuid, eventIds);
  const treeNote = tree.state === "SYSTEM_LEVEL"
    ? "This system uses a system-level model, so it has no basic events."
    : "This system has no fault tree yet. Build it in Step 02.";

  function addScreening(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      componentScreeningJustifications: [...(draft.componentScreeningJustifications ?? []), {
        uuid,
        systemReference: system.uuid,
        componentId: "",
        screeningCriterion: "a" as const,
        quantitativeJustification: "",
        implementsSrs: [{ sr: "SY-A20", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "screening", id: uuid });
  }

  function addSignal(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      isolationTripConditions: [...(draft.isolationTripConditions ?? []), {
        uuid,
        systemReference: system.uuid,
        condition: "",
        modeledIn: "SYSTEM_MODEL" as const,
        implementsSrs: [{ sr: "SY-A24", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "trip", id: uuid });
  }

  function addOutage(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      simultaneousUnavailabilityEvents: [...(draft.simultaneousUnavailabilityEvents ?? []), {
        uuid,
        systemReference: system.uuid,
        description: "",
        componentIds: [],
        plannedActivityBasis: "",
        implementsSrs: [{ sr: "SY-A27", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "unavail", id: uuid });
  }

  function humanRow(event: SystemBasicEvent | undefined, integrationId: string | undefined): JSX.Element {
    const integration = integrationId === undefined
      ? (event === undefined ? undefined : integrationFor(integrations, event))
      : integrations.find((item) => item.uuid === integrationId);
    const option = humanFailureOption(controlledHumanFailures, event, integration);
    const type = integration?.hfeType ?? (option === undefined ? undefined : option.hfeTiming === "PRE_INITIATOR" ? "PRE_INITIATOR" : "POST_INITIATOR");
    const reference = integration !== undefined && integration.hfeReference.length > 0 ? integration.hfeReference : option?.humanFailureEventId;
    const label = event?.code ?? integration?.hfeReference ?? "human failure event";
    return (
      <tr key={event?.uuid ?? integration?.uuid}>
        <td>
          {event === undefined
            ? <><span className="sy-review-name">{integration?.taskDescription || "Unnamed task"}</span><span className="sy-review-sub">Not in this fault tree</span></>
            : <><span className="sy-review-name">{event.name}</span><span className="sy-review-sub posmono">{event.code}</span></>}
        </td>
        <td>
          {type === undefined ? <NotRecorded /> : <span>{type === "PRE_INITIATOR" ? "Pre-initiator" : "Post-initiator"}</span>}
          {integration?.isTestMaintenance === true && <span className="sy-review-sub">After test or maintenance</span>}
        </td>
        <td>
          {option !== undefined ? (
            <>
              <span>{option.humanFailureEventName}</span>
              <span className="sy-review-sub">{option.workbookName} · {toExp(option.value)}</span>
            </>
          ) : reference !== undefined ? (
            <>
              <span className="posmono">{reference}</span>
              <span className="sy-review-sub">HR workbook not linked</span>
            </>
          ) : <NotRecorded />}
        </td>
        <td>{integration?.impact !== undefined && integration.impact.length > 0 ? integration.impact : <NotRecorded />}</td>
        <td className="sy-review-edit">
          <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${label}`} onClick={() => openDrawer({ kind: "hfe", id: event?.uuid ?? integration?.uuid ?? "" })}>{actionLabel}</button>
        </td>
      </tr>
    );
  }

  return (
    <div className="poscard sy-model-card">
      <div className="poscard__head sy-model-card__head">
        <WorkbookSectionHeading workbook="SY" title={system.name} cueKey="Failure modes" level={3} />
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
        <section className="sy-review-section" aria-label="Failure behavior">
          <ReviewTitle title="Failure behavior" sr="SY-A16 · A17 · A18 · A28">
            <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} failure behavior`} onClick={() => openDrawer({ kind: "behavior", id: system.uuid })}>{actionLabel}</button>
          </ReviewTitle>
          <table className="sy-review-table" aria-label="Failure behavior">
            <tbody>
              <tr><th scope="row">Failures left out</th><td><ReviewLines items={system.justificationForExclusionOfComponents ?? []} /></td></tr>
              <tr><th scope="row">Flow diversion paths</th><td><ReviewLines items={system.flowDiversionConsiderations ?? []} /></td></tr>
              <tr><th scope="row">Conditions that defeat the function</th><td><ReviewLines items={system.functionLossConditions ?? []} /></td></tr>
            </tbody>
          </table>
        </section>

        <section className="sy-review-section" aria-label="Screened out">
          <ReviewTitle title="Screened out" sr="SY-A20">
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addScreening}>Add screened item</button>}
          </ReviewTitle>
          {screenings.length === 0 ? <p className="sy-review-empty">Nothing screened out of this system.</p> : (
            <table className="sy-review-table" aria-label="Screened out">
              <thead><tr><th scope="col">Left out</th><th scope="col">Criterion</th><th scope="col">Justification</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {screenings.map((item) => {
                  const criterion = SCREENING_CRITERIA.find((candidate) => candidate.code === item.screeningCriterion);
                  return (
                    <tr key={item.uuid}>
                      <td>{item.componentId.length > 0 ? <span className="sy-review-name">{item.componentId}</span> : <NotRecorded />}</td>
                      <td>
                        <span>{criterion?.short ?? item.screeningCriterion}</span>
                        <span className="sy-review-sub">Criterion {item.screeningCriterion}</span>
                      </td>
                      <td>{item.quantitativeJustification.length > 0 ? item.quantitativeJustification : <NotRecorded />}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} screened item ${item.componentId.length > 0 ? item.componentId : "record"}`} onClick={() => openDrawer({ kind: "screening", id: item.uuid })}>{actionLabel}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Isolation and trip signals">
          <ReviewTitle title="Isolation and trip signals" sr="SY-A24">
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSignal}>Add signal</button>}
          </ReviewTitle>
          {signals.length === 0 ? <p className="sy-review-empty">No isolation or trip signal acts on this system.</p> : (
            <table className="sy-review-table" aria-label="Isolation and trip signals">
              <thead><tr><th scope="col">Signal</th><th scope="col">Treatment</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {signals.map((item) => (
                  <tr key={item.uuid}>
                    <td>{item.condition.length > 0 ? item.condition : <NotRecorded />}</td>
                    <td>
                      <span>{TREATMENT_LABELS[item.modeledIn]}</span>
                      {item.modeledIn === "EXCLUDED" && ((item.exclusionJustification ?? "").trim().length === 0
                        ? <span className="sy-error">Reason required</span>
                        : <span className="sy-review-sub">{item.exclusionJustification}</span>)}
                    </td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} signal ${item.condition.length > 0 ? item.condition : "record"}`} onClick={() => openDrawer({ kind: "trip", id: item.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Out of service together">
          <ReviewTitle title="Out of service together" sr="SY-A27">
            {editable && tree.state === "TREE" && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addOutage}>Add record</button>}
          </ReviewTitle>
          {tree.state !== "TREE" && outages.length === 0 ? <p className="sy-review-empty">{treeNote}</p>
            : outages.length === 0 ? <p className="sy-review-empty">No planned activity takes redundant equipment out together.</p> : (
              <table className="sy-review-table" aria-label="Out of service together">
                <thead><tr><th scope="col">Planned activity</th><th scope="col">Maintenance events</th><th scope="col">DA record</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {outages.map((item) => {
                    const record = controlledCoincidentMaintenance.find((option) => option.recordId === item.dataAnalysisRef);
                    return (
                      <tr key={item.uuid}>
                        <td>
                          {item.description.length > 0 ? <span>{item.description}</span> : <NotRecorded />}
                          {item.plannedActivityBasis.length > 0 && <span className="sy-review-sub">{item.plannedActivityBasis}</span>}
                        </td>
                        <td><ReviewLines items={item.componentIds.map((id) => eventNames.get(id) ?? id)} /></td>
                        <td>
                          {record !== undefined ? (
                            <>
                              <span>{record.description}</span>
                              <span className="sy-review-sub">{record.workbookName}{record.value === undefined ? "" : ` · ${toExp(record.value)}`}</span>
                            </>
                          ) : item.dataAnalysisRef !== undefined ? (
                            <>
                              <span className="posmono">{item.dataAnalysisRef}</span>
                              <span className="sy-review-sub">DA workbook not linked</span>
                            </>
                          ) : <NotRecorded />}
                        </td>
                        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${item.description.length > 0 ? item.description : "outage record"}`} onClick={() => openDrawer({ kind: "unavail", id: item.uuid })}>{actionLabel}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </section>

        <section className="sy-review-section" aria-label="Human failure events">
          <ReviewTitle title="Human failure events" sr="SY-A21 · A23" />
          {tree.state !== "TREE" && unplaced.length === 0 ? <p className="sy-review-empty">{treeNote}</p>
            : humanEvents.length === 0 && unplaced.length === 0 ? <p className="sy-review-empty">No human failure event in this fault tree. Add one in Step 02.</p> : (
              <table className="sy-review-table" aria-label="Human failure events">
                <thead><tr><th scope="col">Event</th><th scope="col">Type</th><th scope="col">HR event</th><th scope="col">Effect on the system</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {humanEvents.map((event) => humanRow(event, undefined))}
                  {unplaced.map((item) => humanRow(undefined, item.uuid))}
                </tbody>
              </table>
            )}
        </section>
      </div>
    </div>
  );
}

export { FailureModesScreen };
