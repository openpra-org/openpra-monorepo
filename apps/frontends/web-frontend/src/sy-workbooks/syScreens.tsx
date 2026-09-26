import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX } from "react";
import { NotRecorded, ReviewLines, ReviewTitle, SYProvenanceChip } from "./syShared";
import { CCF_MODELS, SCREENING_CRITERIA } from "./syViewData";
import { useSyWorkbook } from "./syWorkbookContext";
import { SyCcfAnalysis } from "./SyCcfAnalysis";
import { ccfParameterSummary, validateCcfGroup } from "./syCcf";

interface SyDrawerContext {
  kind: "system" | "sysdef" | "variant" | "alignment" | "boundary" | "states" | "operations" | "ccf" | "hfe" | "screening" | "exclusion" | "unavail" | "ssc" | "spc" | "inv" | "dic" | "loop" | "confirm" | "oc" | "unc" | "assum" | "sens" | "be" | "house" | "diagram";
  id: string;
  modelId?: string;
  diagramId?: string;
}

function FailuresScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const screenings = sy.componentScreeningJustifications ?? [];
  const unavailabilities = sy.simultaneousUnavailabilityEvents ?? [];
  function addUnavailability(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      simultaneousUnavailabilityEvents: [...(draft.simultaneousUnavailabilityEvents ?? []), {
        uuid, description: "", componentIds: [], plannedActivityBasis: "", implementsSrs: [{ sr: "SY-A27", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "unavail", id: uuid });
  }
  function addHfe(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      humanFailureEventIntegrations: [...draft.humanFailureEventIntegrations, {
        uuid, hfeReference: "", system: draft.systemDefinitions[0]?.uuid ?? "", taskDescription: "", hfeType: "PRE_INITIATOR" as const, isTestMaintenance: false, implementsSrs: [{ sr: "SY-A21", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "hfe", id: uuid });
  }
  function addScreening(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      componentScreeningJustifications: [...(draft.componentScreeningJustifications ?? []), {
        uuid, systemReference: draft.systemDefinitions[0]?.uuid ?? "", componentId: "", screeningCriterion: "a" as const, quantitativeJustification: "", implementsSrs: [{ sr: "SY-A20", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "screening", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Exclusions and diversion paths" level={3} />
          <SYProvenanceChip>SY-A16 · A17 · A18</SYProvenanceChip>
        </div>
        <div className="sy-review">
          {sy.systemDefinitions.length === 0 ? <p className="sy-review-empty">No systems in scope yet.</p> : (
            <table className="sy-review-table" aria-label="Exclusions and diversion paths">
              <thead><tr><th scope="col">System</th><th scope="col">Left out</th><th scope="col">Diversion paths</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {sy.systemDefinitions.map((def) => (
                  <tr key={def.uuid}>
                    <td><span className="sy-review-name">{def.name}</span></td>
                    <td><ReviewLines items={def.justificationForExclusionOfComponents ?? []} /></td>
                    <td><ReviewLines items={def.flowDiversionConsiderations ?? []} /></td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} exclusions for ${def.name}`} onClick={() => openDrawer({ kind: "exclusion", id: def.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Screening" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A20</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addScreening}>Add component</button>}
          </div>
        </div>
        <div className="syscreen__crit">
          {SCREENING_CRITERIA.map((c) => (
            <div key={c.code} className="syscreen__crit-item">
              <span className="syscreen__crit-code">{c.code}</span>
              <span className="syscreen__crit-label">{c.label}</span>
            </div>
          ))}
        </div>
        <div className="sy-review sy-review--offset">
          {screenings.length === 0 ? <p className="sy-review-empty">No components screened out.</p> : (
            <table className="sy-review-table" aria-label="Screened components">
              <thead><tr><th scope="col">Component</th><th scope="col">System</th><th scope="col">Criterion</th><th scope="col">Justification</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {screenings.map((c) => (
                  <tr key={c.uuid}>
                    <td>{c.componentId.length > 0 ? <span className="sy-review-name">{c.componentId}</span> : <NotRecorded />}</td>
                    <td>{shortOf(c.systemReference)}</td>
                    <td>{c.screeningCriterion}</td>
                    <td>{c.quantitativeJustification.length > 0 ? c.quantitativeJustification : <NotRecorded />}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} screening ${c.componentId.length > 0 ? c.componentId : "record"}`} onClick={() => openDrawer({ kind: "screening", id: c.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Simultaneous unavailability" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A27</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addUnavailability}>Add record</button>}
          </div>
        </div>
        <div className="sy-review">
          {unavailabilities.length === 0 ? <p className="sy-review-empty">No simultaneous unavailability recorded.</p> : (
            <table className="sy-review-table" aria-label="Simultaneous unavailability">
              <thead><tr><th scope="col">Planned activity</th><th scope="col">Components</th><th scope="col">DA parameter</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {unavailabilities.map((u) => (
                  <tr key={u.uuid}>
                    <td>
                      {u.description.length > 0 ? <span>{u.description}</span> : <NotRecorded />}
                      {u.plannedActivityBasis.length > 0 && <span className="sy-review-sub">{u.plannedActivityBasis}</span>}
                    </td>
                    <td>{u.componentIds.length === 0 ? <NotRecorded /> : <span className="posmono">{u.componentIds.join(", ")}</span>}</td>
                    <td>{u.dataAnalysisRef === undefined ? <NotRecorded /> : <span className="posmono">{u.dataAnalysisRef}</span>}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${u.description.length > 0 ? u.description : "unavailability record"}`} onClick={() => openDrawer({ kind: "unavail", id: u.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Human failure events placed in the models" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A21 · SY-A23</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addHfe}>Add event</button>}
          </div>
        </div>
        <div className="sy-review">
          {sy.humanFailureEventIntegrations.length === 0 ? <p className="sy-review-empty">No human failure events placed yet.</p> : (
            <table className="sy-review-table" aria-label="Human failure events placed in the models">
              <thead><tr><th scope="col">Task</th><th scope="col">System</th><th scope="col">Type</th><th scope="col">HR event</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {sy.humanFailureEventIntegrations.map((h) => (
                  <tr key={h.uuid}>
                    <td>{h.taskDescription.length > 0 ? h.taskDescription : <NotRecorded />}</td>
                    <td>{shortOf(h.system)}</td>
                    <td>
                      <span>{h.hfeType === "PRE_INITIATOR" ? "Pre-initiator" : "Post-initiator"}</span>
                      {h.isTestMaintenance && <span className="sy-review-sub">Test and maintenance</span>}
                    </td>
                    <td>
                      {h.hfeReference.length > 0 ? <span className="posmono">{h.hfeReference}</span> : <NotRecorded />}
                      {h.hfeReference.length > 0 && <span className="sy-review-sub">{h.hfeSource === undefined ? "Typed" : "HR"}</span>}
                    </td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${h.hfeReference.length > 0 ? h.hfeReference : "human failure event"}`} onClick={() => openDrawer({ kind: "hfe", id: h.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function CcfScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const groups = sy.commonCauseFailureGroups;
  const intra = groups.filter((g) => g.scope === "INTRASYSTEM");
  const inter = groups.filter((g) => g.scope === "INTERSYSTEM");
  const eventById = new Map(sy.systemBasicEvents.map((event) => [event.uuid, event]));
  const actionLabel = editable ? "Edit" : "View";
  function addGroup(scope: "INTRASYSTEM" | "INTERSYSTEM"): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      commonCauseFailureGroups: [...draft.commonCauseFailureGroups, {
        uuid, name: "New common cause group", description: "", scope, affectedComponents: [], affectedSystems: [draft.systemDefinitions[0]?.uuid ?? ""], modelType: "BETA_FACTOR",
        modelSpecificParameters: { betaFactorParameters: { beta: 0.05, totalFailureProbability: 0 } },
        members: { basicEvents: [] }, sharedCauseFactors: {}, implementsSrs: [{ sr: scope === "INTRASYSTEM" ? "SY-B1" : "SY-B2", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "ccf", id: uuid });
  }
  function GroupSection({ scope, items }: { scope: "INTRASYSTEM" | "INTERSYSTEM"; items: typeof groups }): JSX.Element {
    const title = scope === "INTRASYSTEM" ? "Within a system" : "Across systems";
    return (
      <section className="sy-review-section" aria-label={title}>
        <ReviewTitle title={title} sr={scope === "INTRASYSTEM" ? "SY-B1" : "SY-B2"}>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" aria-label={`Add group ${title.toLowerCase()}`} onClick={() => addGroup(scope)}>Add group</button>}
        </ReviewTitle>
        {items.length === 0 ? <p className="sy-review-empty">No groups defined.</p> : (
          <table className="sy-review-table" aria-label={`Common cause groups ${title.toLowerCase()}`}>
            <thead><tr><th scope="col">Group</th><th scope="col">Model</th><th scope="col">Member events</th><th scope="col">Qₜ</th><th scope="col">Systems</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
            <tbody>
              {items.map((group) => {
                const summary = ccfParameterSummary(group);
                const members = group.members?.basicEvents ?? [];
                const name = group.name || "New common cause group";
                return (
                  <tr key={group.uuid}>
                    <td>
                      <span className="sy-review-name">{name}</span>
                      <span className="sy-review-sub posmono">{group.uuid}</span>
                    </td>
                    <td>
                      <span>{CCF_MODELS[group.modelType]?.label ?? group.modelType}</span>
                      <span className="sy-review-sub">{summary?.short ?? "Parameters incomplete"}</span>
                    </td>
                    <td>{members.length === 0 ? <NotRecorded /> : <span className="posmono">{members.map(({ id }) => eventById.get(id)?.code ?? id).join(", ")}</span>}</td>
                    <td className="posmono sy-review-num">{summary === null ? <NotRecorded /> : summary.totalFailureProbability.toExponential(2).toUpperCase()}</td>
                    <td>{group.affectedSystems.length === 0 ? <NotRecorded /> : group.affectedSystems.map(shortOf).join(", ")}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${name}`} onClick={() => openDrawer({ kind: "ccf", id: group.uuid })}>{actionLabel}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    );
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Common cause groups" level={3} />
          <SYProvenanceChip>SY-B1 · SY-B2 · SY-B3</SYProvenanceChip>
        </div>
        <div className="sy-review">
          <GroupSection scope="INTRASYSTEM" items={intra} />
          <GroupSection scope="INTERSYSTEM" items={inter} />
        </div>
      </div>

      {groups.some((group) => validateCcfGroup(group, sy).length > 0) && (
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="SY" title="Readiness review" level={3} />
            <SYProvenanceChip>SY-B4</SYProvenanceChip>
          </div>
          <div className="syccf__issues">
            {groups.flatMap((group) => validateCcfGroup(group, sy).map((issue) => (
              <button type="button" key={`${group.uuid}:${issue.code}:${issue.message}`} className={`syccf__issue syccf__issue--${issue.severity.toLowerCase()}`} onClick={() => openDrawer({ kind: "ccf", id: group.uuid })}>
                <span>{issue.severity === "ERROR" ? "Error" : "Review"}</span>
                <strong>{group.name || group.uuid}</strong>
                <span>{issue.message}</span>
              </button>
            )))}
          </div>
        </div>
      )}

      <div className="poscard"><SyCcfAnalysis /></div>
    </>
  );
}

export { FailuresScreen, CcfScreen, type SyDrawerContext };
