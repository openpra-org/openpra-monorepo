import { JSX } from "react";
import type { NomenclatureDesignator, NomenclatureDesignatorKind } from "interfaces-mef-types/sy/systems-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { IssueLines, NoSystemsCard, NotRecorded, ReviewLines, ReviewTitle } from "./syShared";
import { CONFIRM_METHODS } from "./syViewData";
import { isSystemLevelModel } from "./sySelectors";
import {
  BOUNDARY_STATUS_LABELS,
  boundaryRows,
  confirmationIssues,
  confirmationRecords,
  designatorIssues,
  detailIssues,
  detailRecords,
  moduleIssues,
  namingRows,
  newBoundaryReview,
  recordIssues,
  schemeIssues,
  systemCodeIssue,
  treeEvents,
  type BoundaryRow,
} from "./syIntegrityChecks";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";
import "./css/syModels.css";
import "./css/syIntegrity.css";

function IntegrityScreen({ sysId, setSysId, openDrawer, onOpenSystems }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenSystems?: () => void;
}): JSX.Element {
  const { sy, shortOf, editable, mutateSy, controlledParameters, controlledComponentBoundaries } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const found = sy.systemDefinitions.find((candidate) => candidate.uuid === sysId) ?? sy.systemDefinitions[0];

  if (found === undefined) {
    return <NoSystemsCard title="Model Integrity" purpose="confirm their models here." onOpenSystems={onOpenSystems} />;
  }

  const system = found;
  const operational = sy.plantStage === "OPERATIONAL";
  const records = confirmationRecords(sy, system.uuid);
  const details = detailRecords(sy, system.uuid);
  const events = treeEvents(sy, system.uuid);
  const eventById = new Map(sy.systemBasicEvents.map((event) => [event.uuid, event]));
  const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === system.uuid);
  const systemLevel = model !== undefined && isSystemLevelModel(model);
  const rows = boundaryRows(sy, system.uuid, controlledParameters, controlledComponentBoundaries);
  const modules = (sy.modularizationRecords ?? []).filter((record) => record.systemReference === system.uuid);
  const naming = namingRows(sy, system.uuid, controlledParameters).filter((row) => row.issues.length > 0);
  const codeIssue = systemCodeIssue(sy, system.uuid);
  const codeOf = (eventId: string): string => eventById.get(eventId)?.code ?? eventId;

  function addConfirmation(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      systemConfirmationRecords: [...(draft.systemConfirmationRecords ?? []), {
        uuid,
        systemReference: system.uuid,
        method: operational ? "DISCUSSIONS" as const : "DESIGN_REVIEW" as const,
        date: "",
        personnelRoles: [],
        findings: "",
        implementsSrs: [{ sr: operational ? "SY-A5" : "SY-A6", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "confirm", id: uuid });
  }

  function addDetail(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      modelValidations: [...(draft.modelValidations ?? []), {
        uuid,
        name: "Level of detail",
        description: "",
        systemReference: system.uuid,
        techniques: [],
        results: "",
        implementsSrs: [{ sr: "SY-A9", hlr: "A" as const }, { sr: operational ? "SY-A10" : "SY-A11", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "detail", id: uuid });
  }

  function openBoundary(row: BoundaryRow): void {
    if (row.review !== undefined) {
      openDrawer({ kind: "cbound", id: row.review.uuid });
      return;
    }
    const boundaryId = row.boundaryId;
    if (!editable || boundaryId === undefined) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({ ...draft, componentBoundaryReviews: [...(draft.componentBoundaryReviews ?? []), newBoundaryReview(system.uuid, boundaryId, uuid)] }));
    openDrawer({ kind: "cbound", id: uuid });
  }

  function addModule(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      modularizationRecords: [...(draft.modularizationRecords ?? []), {
        uuid,
        moduleId: "",
        systemReference: system.uuid,
        representedComponentIds: [],
        basicEventIds: [],
        avoidsMixedRecoveryPotential: true,
        avoidsEventsRequiredByOtherSystems: true,
        justification: "",
        implementsSrs: [{ sr: "SY-A14", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "module", id: uuid });
  }

  const boundaryEmpty = systemLevel
    ? "This system has a system-level model, so it has no component boundaries to check."
    : events.length === 0 ? "This fault tree has no component events yet." : "No component event in this fault tree has a boundary to check.";

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
        <section className="sy-review-section" aria-label="Confirmation against the plant">
          <ReviewTitle title="Confirmation against the plant" sr={operational ? "SY-A5" : "SY-A6"}>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addConfirmation}>Add record</button>}
          </ReviewTitle>
          {records.length === 0 ? <p className="sy-review-empty">{operational ? "Not confirmed with plant staff or by walkdown yet." : "Not confirmed against the design intent yet."}</p> : (
            <>
              <div className="sy-integrity-issues"><IssueLines issues={confirmationIssues(sy, system.uuid)} /></div>
              <table className="sy-review-table" aria-label="Confirmation against the plant">
                <thead><tr><th scope="col">Method</th><th scope="col">Who took part</th><th scope="col">Findings</th><th scope="col">Date</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {records.map((record) => {
                    const method = CONFIRM_METHODS[record.method] ?? record.method;
                    return (
                      <tr key={record.uuid}>
                        <td>
                          <span className="sy-review-name">{method}</span>
                          <IssueLines issues={recordIssues(record)} />
                        </td>
                        <td><ReviewLines items={record.personnelRoles} /></td>
                        <td>{record.findings.length > 0 ? record.findings : <NotRecorded />}</td>
                        <td className="posmono sy-review-num">{record.date.length > 0 ? record.date : <NotRecorded />}</td>
                        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${method} record`} onClick={() => openDrawer({ kind: "confirm", id: record.uuid })}>{actionLabel}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="sy-review-section" aria-label="Level of detail">
          <ReviewTitle title="Level of detail" sr={operational ? "SY-A9 · A10" : "SY-A9 · A11"}>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDetail}>Add review</button>}
          </ReviewTitle>
          {details.length === 0 ? <p className="sy-review-empty">No level of detail recorded for this system yet.</p> : (
            <table className="sy-review-table" aria-label="Level of detail">
              <thead><tr><th scope="col">What the model includes</th><th scope="col">Checked against</th><th scope="col">Finding</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {details.map((record, index) => (
                  <tr key={record.uuid}>
                    <td>
                      {record.description.length > 0 ? record.description : <NotRecorded />}
                      <IssueLines issues={detailIssues(record)} />
                    </td>
                    <td><ReviewLines items={record.techniques} /></td>
                    <td>{record.results.length > 0 ? record.results : <NotRecorded />}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} level of detail review ${index + 1}`} onClick={() => openDrawer({ kind: "detail", id: record.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Component boundaries">
          <ReviewTitle title="Component boundaries" sr={operational ? "SY-A12" : "SY-A12 · A13"} />
          {controlledParameters.length === 0 && !systemLevel && events.length > 0 && <p className="sy-review-empty">Link the DA workbook in Step 01 Interfaces to check each component against its data boundary.</p>}
          {rows.length === 0 ? (controlledParameters.length === 0 && !systemLevel && events.length > 0 ? null : <p className="sy-review-empty">{boundaryEmpty}</p>) : (
            <table className="sy-review-table sy-integrity-bounds" aria-label="Component boundaries">
              <thead><tr><th scope="col">Events</th><th scope="col">Data boundary</th><th scope="col">Review</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const name = row.boundary?.name ?? row.boundaryId;
                  const canOpen = row.review !== undefined || (editable && row.boundaryId !== undefined);
                  return (
                    <tr key={row.key}>
                      <td>
                        {row.events.length === 0 ? <span className="sy-review-none">No events</span> : <span className="posmono">{row.events.map((event) => event.code).join(", ")}</span>}
                        <IssueLines issues={row.issues} />
                      </td>
                      <td>
                        {name === undefined ? <span className="sy-review-none">None in DA</span> : <span className="sy-review-name">{name}</span>}
                        {row.boundary !== undefined && row.boundary.includedItems.length > 0 && <span className="sy-review-sub">Includes: {row.boundary.includedItems.join(", ")}</span>}
                      </td>
                      <td>
                        {row.review === undefined ? <NotRecorded /> : <span>{BOUNDARY_STATUS_LABELS[row.review.status]}</span>}
                        {row.review?.note !== undefined && row.review.note.length > 0 && <span className="sy-review-sub">{row.review.note}</span>}
                      </td>
                      <td className="sy-review-edit">
                        {canOpen && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${name ?? "boundary"} review`} onClick={() => openBoundary(row)}>{actionLabel}</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Supercomponents">
          <ReviewTitle title="Supercomponents" sr="SY-A14">
            {editable && !systemLevel && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addModule}>Add supercomponent</button>}
          </ReviewTitle>
          {modules.length === 0 ? <p className="sy-review-empty">{systemLevel ? "A system-level model has no supercomponents." : "No event in this fault tree stands for a group of components."}</p> : (
            <table className="sy-review-table" aria-label="Supercomponents">
              <thead><tr><th scope="col">Supercomponent</th><th scope="col">Stands for</th><th scope="col">Events</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {modules.map((record) => (
                  <tr key={record.uuid}>
                    <td>
                      {record.moduleId.length > 0 ? <span className="sy-review-name">{record.moduleId}</span> : <NotRecorded />}
                      {record.justification.length > 0 && <span className="sy-review-sub">{record.justification}</span>}
                      <IssueLines issues={moduleIssues(sy, record)} />
                    </td>
                    <td><ReviewLines items={record.representedComponentIds} /></td>
                    <td>{(record.basicEventIds ?? []).length === 0 ? <NotRecorded /> : <span className="posmono">{(record.basicEventIds ?? []).map(codeOf).join(", ")}</span>}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${record.moduleId.length > 0 ? record.moduleId : "supercomponent"}`} onClick={() => openDrawer({ kind: "module", id: record.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="sy-review-section" aria-label="Naming">
          <ReviewTitle title="Naming" sr="SY-A30" />
          {codeIssue !== null && <div className="sy-integrity-issues"><IssueLines issues={[codeIssue]} /></div>}
          {naming.length === 0 ? <p className="sy-review-empty">{events.length === 0 ? "No basic events to check." : "Every event code in this system follows the naming scheme."}</p> : (
            <table className="sy-review-table" aria-label="Naming">
              <thead><tr><th scope="col">Event</th><th scope="col">Problem</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {naming.map((row) => (
                  <tr key={row.event.uuid}>
                    <td>
                      <span className="posmono">{row.event.code}</span>
                      <span className="sy-review-sub">{row.event.name}</span>
                    </td>
                    <td><IssueLines issues={row.issues} /></td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${row.event.code}`} onClick={() => openDrawer({ kind: "be", id: row.event.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

const DESIGNATOR_SECTIONS: readonly { kind: NomenclatureDesignatorKind; title: string; add: string }[] = [
  { kind: "SYSTEM", title: "System codes", add: "Add code" },
  { kind: "FAILURE_MODE", title: "Failure mode designators", add: "Add designator" },
  { kind: "EVENT_TYPE", title: "Event type designators", add: "Add designator" },
];

function NamingScheme({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, controlledFailureModes } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const designators = sy.nomenclatureDesignators ?? [];
  const failureModeNames = new Map(controlledFailureModes.map((mode) => [mode.failureModeId, mode.name]));
  const convention = sy.documentation.nomenclatureConventions;
  const nameOf = (systemId: string | undefined): string | undefined => (systemId === undefined ? undefined : sy.systemDefinitions.find((system) => system.uuid === systemId)?.name ?? systemId);

  function add(kind: NomenclatureDesignatorKind): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    const entry: NomenclatureDesignator = kind === "FAILURE_MODE"
      ? { uuid, designator: "", kind, meaning: "", failureModeRefs: [] }
      : { uuid, designator: "", kind, meaning: "" };
    mutateSy((draft) => ({ ...draft, nomenclatureDesignators: [...(draft.nomenclatureDesignators ?? []), entry] }));
    openDrawer({ kind: "naming", id: uuid });
  }

  function appliesTo(designator: NomenclatureDesignator): JSX.Element {
    if (designator.kind === "SYSTEM") {
      const name = nameOf(designator.systemReference);
      return name === undefined ? <NotRecorded /> : <span>{name}</span>;
    }
    return <ReviewLines items={(designator.failureModeRefs ?? []).map((ref) => failureModeNames.get(ref) ?? ref)} />;
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="SY" title="Naming scheme" level={3} />
      </div>
      <div className="sy-review">
        <section className="sy-review-section" aria-label="Naming convention">
          <ReviewTitle title="Convention" sr="SY-A30">
            <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} naming convention`} onClick={() => openDrawer({ kind: "convention", id: "convention" })}>{actionLabel}</button>
          </ReviewTitle>
          <p className="sy-integrity-convention">{convention.length > 0 ? convention : <NotRecorded />}</p>
          <div className="sy-integrity-issues"><IssueLines issues={schemeIssues(sy)} /></div>
        </section>
        {DESIGNATOR_SECTIONS.map((section) => {
          const entries = designators.filter((designator) => designator.kind === section.kind);
          return (
            <section key={section.kind} className="sy-review-section" aria-label={section.title}>
              <ReviewTitle title={section.title}>
                {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => add(section.kind)}>{section.add}</button>}
              </ReviewTitle>
              {entries.length === 0 ? <p className="sy-review-empty">None listed yet.</p> : (
                <table className="sy-review-table sy-integrity-names" aria-label={section.title}>
                  <thead><tr><th scope="col">{section.kind === "SYSTEM" ? "Code" : "Designator"}</th><th scope="col">{section.kind === "SYSTEM" ? "System" : "Meaning"}</th>{section.kind === "FAILURE_MODE" && <th scope="col">DA failure modes</th>}<th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                  <tbody>
                    {entries.map((designator) => (
                      <tr key={designator.uuid}>
                        <td>
                          {designator.designator.length > 0 ? <span className="posmono sy-review-name">{designator.designator}</span> : <NotRecorded />}
                          <IssueLines issues={designatorIssues(sy, designator, failureModeNames)} />
                        </td>
                        <td>
                          {section.kind === "SYSTEM" ? appliesTo(designator) : designator.meaning.length > 0 ? designator.meaning : <NotRecorded />}
                        </td>
                        {section.kind === "FAILURE_MODE" && <td>{appliesTo(designator)}</td>}
                        <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${designator.designator.length > 0 ? designator.designator : "designator"}`} onClick={() => openDrawer({ kind: "naming", id: designator.uuid })}>{actionLabel}</button></td>
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

export { IntegrityScreen, NamingScheme };
