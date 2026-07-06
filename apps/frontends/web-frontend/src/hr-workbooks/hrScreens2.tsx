import { JSX, useState } from "react";
import { HRIcon } from "./hrIcons";
import { Badge, HRProvenanceChip, hepText, type BadgeKind } from "./hrShared";
import {
  CAPABILITY_CATEGORIES,
  ACTIVITY_SOURCES,
  HFE_TIMING,
  IMPACT_LEVELS,
  RESPONSE_TYPES,
  REVIEW_SCOPES,
  CONFIRM_METHODS,
  DEPENDENCE_LEVELS,
  PSF_IMPACT,
  INDICATION_TREATMENT,
  TIME_BASIS,
  FEASIBILITY_KEYS,
  HR_TOC,
  type CapabilityCategory,
} from "./hrViewData";
import { type CcScore } from "./hrSelectors";
import { useHrWorkbook } from "./hrWorkbookContext";
import { generateHrReport } from "./hrDocx";
import { NamedIcon, type HrDrawerContext } from "./hrScreens";
import { type HumanReliabilityAnalysis, type HepQuantification, type DependenceLevel } from "interfaces-mef-types/hr/human-reliability-analysis";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";


function RespIdentifyScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, editable, mutateHr } = useHrWorkbook();
  function addReview(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, responseIdentificationReviews: [...draft.responseIdentificationReviews, {
      uuid, reviewScope: "EMERGENCY_AND_ABNORMAL_PROCEDURES" as const, sourcesReviewed: [], findings: "", identifiedHfeIds: [], implementsSrs: [{ sr: "HR-E1", hlr: "E" as const }],
    }] }));
    openDrawer({ kind: "respreview", id: uuid });
  }
  function addConfirmation(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, responseConfirmations: [...(draft.responseConfirmations ?? []), {
      uuid, hfeIds: [], method: "PERSONNEL_REVIEW" as const, personnelRoles: [], date: "", findings: "", interpretationConsistent: true, implementsSrs: [{ sr: "HR-E5", hlr: "E" as const }],
    }] }));
    openDrawer({ kind: "respconfirm", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Response identification reviews</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">{hr.responseIdentificationReviews.length} reviews · HR-E1, E3, E4</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addReview}><HRIcon.Plus /> Add review</button>}
          </div>
        </div>
        <p className="poscard__sub">Review the procedures, system information and training to find the actions each sequence needs.</p>
        <div className="hrrev">
          {hr.responseIdentificationReviews.map((r) => {
            const borrow = r.reviewScope === "NONNUCLEAR_FACILITY_EXPERIENCE" || r.reviewScope === "SIMILAR_FACILITY_EXPERIENCE";
            return (
              <div key={r.uuid} className={`hrrev__card${borrow ? " hrrev__card--borrow" : ""}`} onClick={() => openDrawer({ kind: "respreview", id: r.uuid })}>
                <div className="hrrev__head">
                  <span className="hrrev__scope">{REVIEW_SCOPES[r.reviewScope]}</span>
                  {borrow && <span className="hrrev__borrow-flag">Borrowed</span>}
                </div>
                <div className="hrrev__sources">
                  {r.sourcesReviewed.map((s, i) => <span key={i} className="hrrev__source">{s}</span>)}
                </div>
                <p className="hrrev__findings">{r.findings}</p>
                <div className="hrrev__foot">
                  <span className="hrrev__hfes">{r.identifiedHfeIds.join(", ")}</span>
                  <HRProvenanceChip>{r.implementsSrs.map((s) => s.sr).join(" · ")}</HRProvenanceChip>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Confirmation ladder</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-E5 · HR-E7</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addConfirmation}><HRIcon.Plus /> Add confirmation</button>}
          </div>
        </div>
        <p className="poscard__sub">At CC-I the interpretation is reviewed with staff, and at CC-II it is confirmed by talk-through or simulation.</p>
        <div className="hrladder">
          {(hr.responseConfirmations ?? []).map((c, i) => {
            const m = CONFIRM_METHODS[c.method];
            const ccClass = m?.cc === "CC-II" ? "cc-ii" : "cc-i";
            return (
              <div key={c.uuid} className={`hrladder__step hrladder__step--${ccClass}`} onClick={() => openDrawer({ kind: "respconfirm", id: c.uuid })} style={{ cursor: "pointer" }}>
                <span className="hrladder__rung">{i + 1}</span>
                <div className="hrladder__main">
                  <div className="hrladder__method">{m?.label ?? c.method}<span className={`hrladder__cc hrladder__cc--${ccClass}`}>{m?.cc ?? ""}</span></div>
                  <div className="hrladder__roles">{c.personnelRoles.join(" · ")}</div>
                  <div className="hrladder__findings">{c.findings}</div>
                </div>
                {c.interpretationConsistent && <span className="hrladder__ok"><HRIcon.Check /></span>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function RespDefineScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, editable, mutateHr } = useHrWorkbook();
  const respHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming !== "PRE_INITIATOR");
  const grouped = respHfes.filter((h) => (h.groupedResponses ?? []).length > 0 || h.groupingJustification !== undefined || h.crossPosGroupingBasis !== undefined);
  const nameOf = (id: string): string => hr.humanFailureEvents.find((x) => x.uuid === id)?.name ?? id;
  function addPostHfe(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, humanFailureEvents: [...draft.humanFailureEvents, {
      uuid, name: "New response event", hfeTiming: "POST_INITIATOR" as const, description: "", impactLevel: "FUNCTION" as const, affectedSystems: [], applicablePlantOperatingStates: [], applicableEventSequences: [], responseDetail: { requiredResponse: "", responseType: "INITIATE" as const, successCriteriaIds: [], procedureReferences: [], cueDescription: "", cueTimingBySequence: [] }, implementsSrs: [{ sr: "HR-F1", hlr: "F" as const }],
    }] }));
    openDrawer({ kind: "posthfe", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Response human failure events</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">{respHfes.length} defined · HR-F1, F4</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPostHfe}><HRIcon.Plus /> Add event</button>}
          </div>
        </div>
        <p className="poscard__sub">Define each event at the appropriate level, with its cue timing, time window, success criteria and context.</p>
        <div className="hrhfe">
          {respHfes.map((h) => {
            const t = HFE_TIMING[h.hfeTiming];
            const rd = h.responseDetail;
            const aggr = rd?.responseType === "AGGRAVATING_ACTION";
            const firstCt = rd?.cueTimingBySequence?.[0];
            return (
              <div key={h.uuid} className={`hrhfe__card${aggr ? " hrhfe__card--aggr" : ""}`} onClick={() => openDrawer({ kind: "posthfe", id: h.uuid })}>
                <div className="hrhfe__head">
                  <span className={`hrhfe__timing hrhfe__timing--${t?.tone ?? "teal"}`}>{t?.label ?? h.hfeTiming}</span>
                  <span className="hrhfe__id posmono">{h.uuid}</span>
                  <span className={`hrhfe__resp hrhfe__resp--${aggr ? "aggr" : "do"}`}>{rd !== undefined ? RESPONSE_TYPES[rd.responseType] : "—"}</span>
                </div>
                <div className="hrhfe__name">{h.name}</div>
                {firstCt?.timeWindowMinutes !== undefined && (
                  <div className="hrhfe__window">
                    <span className="hrhfe__window-k">Time window</span>
                    <span className="hrhfe__window-v posmono">{firstCt.timeWindowMinutes} min</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Grouping across operating states</h3>
          <HRProvenanceChip>HR-F3</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Group the same response across states only where the conditions are comparable. Click a group to edit it.</p>
        {grouped.length > 0 ? (
          <table className="postable" style={{ marginTop: 4 }}>
            <thead><tr><th>Response</th><th>Grouped with</th><th>Basis</th></tr></thead>
            <tbody>
              {grouped.map((h) => (
                <tr key={h.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "posthfe", id: h.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{h.name}</td>
                  <td>{(h.groupedResponses ?? []).map(nameOf).join(", ") || "—"}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{h.crossPosGroupingBasis === "EQUIVALENT_BOUNDARY_CONDITIONS" ? "Equivalent boundary conditions" : h.crossPosGroupingBasis === "BOUNDED" ? "Bounded" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="posmuted" style={{ margin: 0 }}>No grouped responses defined.</p>
        )}
      </div>
    </>
  );
}

function TimeTriplet({ q }: { q: HepQuantification }): JSX.Element {
  const avail = q.timeAvailableMinutes ?? 0;
  const cue = q.cueArrivalTimeMinutes ?? 0;
  const req = q.timeRequiredMinutes ?? 0;
  const margin = Math.max(0, avail - cue - req);
  const pct = (v: number): number => (avail > 0 ? (v / avail) * 100 : 0);
  return (
    <div className="hrtime">
      <div className="hrtime__track">
        <div className="hrtime__seg hrtime__seg--cue" style={{ width: `${pct(cue)}%` }} title="Cue arrival" />
        <div className="hrtime__seg hrtime__seg--req" style={{ width: `${pct(req)}%` }} title="Time required" />
        <div className="hrtime__seg hrtime__seg--margin" style={{ width: `${pct(margin)}%` }} title="Margin" />
      </div>
      <div className="hrtime__legend">
        <span className="hrtime__leg"><span className="hrtime__dot hrtime__dot--cue" /> Cue {cue} min</span>
        <span className="hrtime__leg"><span className="hrtime__dot hrtime__dot--req" /> Required {req} min</span>
        <span className="hrtime__leg"><span className="hrtime__dot hrtime__dot--margin" /> Margin {margin} min</span>
        <span className="hrtime__avail posmono">Available {avail} min</span>
      </div>
    </div>
  );
}

function RespQuantScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, editable, mutateHr } = useHrWorkbook();
  const postHfeIds = new Set(hr.humanFailureEvents.filter((h) => h.hfeTiming === "POST_INITIATOR").map((h) => h.uuid));
  const atHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming === "AT_INITIATOR");
  const aggrIds = new Set(hr.humanFailureEvents.filter((h) => h.responseDetail?.responseType === "AGGRAVATING_ACTION").map((h) => h.uuid));
  const recoveryQuantIds = new Set((hr.recoveryActions ?? []).map((r) => r.hepQuantificationId));
  const postQuants = hr.hepQuantifications.filter((q) => postHfeIds.has(q.hfeId) && !recoveryQuantIds.has(q.uuid) && !aggrIds.has(q.hfeId));
  const withinDeps = hr.dependencyAssessments.filter((d) => d.scope === "WITHIN_SEQUENCE");
  function hfeName(id: string): string {
    return hr.humanFailureEvents.find((h) => h.uuid === id)?.name ?? id;
  }
  const quantIdFor = (hfeId: string): string | undefined => hr.hepQuantifications.find((q) => q.hfeId === hfeId)?.uuid;
  function addQuant(): void {
    if (!editable) return;
    const target = hr.humanFailureEvents.find((h) => h.hfeTiming === "POST_INITIATOR" && quantIdFor(h.uuid) === undefined);
    if (target === undefined) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, hepQuantifications: [...draft.hepQuantifications, {
      uuid, hfeId: target.uuid, methodology: "", assessmentType: "DETAILED_ASSESSMENT" as const, isRiskSignificant: false, meanHep: 1.0e-3, cognitionContribution: 5.0e-4, executionContribution: 5.0e-4, performanceShapingFactors: [], indicationsTreatment: "EVALUATED_PER_SEQUENCE" as const, uncertaintyCharacterization: { riskSignificant: false, method: "", probabilisticRepresentationProvided: false }, implementsSrs: [{ sr: "HR-G1", hlr: "G" as const }],
    }] }));
    openDrawer({ kind: "respquant", id: uuid });
  }
  function addWithinDep(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, dependencyAssessments: [...draft.dependencyAssessments, {
      uuid, scope: "WITHIN_SEQUENCE" as const, hfeIds: [], commonElements: [], dependenceLevel: "MODERATE" as const, jointHep: 1.0e-3, implementsSrs: [{ sr: "HR-G12", hlr: "G" as const }],
    }] }));
    openDrawer({ kind: "dependence", id: uuid });
  }
  function addConsistency(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, hepConsistencyReviews: [...(draft.hepConsistencyReviews ?? []), {
      uuid, hfeIdsReviewed: [], relativeReasonablenessConfirmed: true, basis: "SIMILAR_PLANT_AND_SCENARIO_CONTEXT" as const, findings: "", implementsSrs: [{ sr: "HR-G9", hlr: "G" as const }],
    }] }));
    openDrawer({ kind: "consistency", id: uuid });
  }
  function addEfc(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, errorForcingContexts: [...(draft.errorForcingContexts ?? []), {
      uuid, hfeId: hr.humanFailureEvents[0]?.uuid ?? "", unsafeAction: "", plantConditions: [], performanceShapingFactors: [], vulnerability: "", searchMethod: "ATHEANA qualitative search", implementsSrs: [{ sr: "HR-G3", hlr: "G" as const }],
    }] }));
    openDrawer({ kind: "efc", id: uuid });
  }
  return (
    <>
      {atHfes.length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">At-initiator analysis</h3>
            <HRProvenanceChip>HR-F1 · supplied to IE</HRProvenanceChip>
          </div>
          <p className="poscard__sub">An operator error that itself causes the initiator is analyzed and quantified here, then supplied to the Initiating Events fault trees. Click a card to edit its quantification.</p>
          <div className="hrhfe">
            {atHfes.map((h) => {
              const qid = quantIdFor(h.uuid);
              return (
                <div key={h.uuid} className="hrhfe__card hrhfe__card--aggr" onClick={() => { if (qid !== undefined) openDrawer({ kind: "respquant", id: qid }); }} style={{ cursor: "pointer" }}>
                  <div className="hrhfe__head">
                    <span className="hrhfe__timing hrhfe__timing--primary">At-initiator</span>
                    <span className="hrhfe__id posmono">{h.uuid}</span>
                  </div>
                  <div className="hrhfe__name">{h.name}</div>
                  <div className="hrhfe__modes"><span className="hrhfe__mode">Approach. {h.description}</span></div>
                  <span className="poschip poschip--method">Supplied to IE</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Quantification</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-G1 · HR-G3</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addQuant}><HRIcon.Plus /> Add quantification</button>}
          </div>
        </div>
        <p className="poscard__sub">Each estimate addresses the failure in cognition and the failure to execute, with the timing and performance factors. Click a card to edit it.</p>
        <div className="hrgq">
          {postQuants.map((q) => {
            const value = q.meanHep ?? q.pointEstimateHep;
            const cog = q.cognitionContribution ?? 0;
            const exe = q.executionContribution ?? 0;
            const sum = cog + exe > 0 ? cog + exe : 1;
            const ind = q.indicationsTreatment !== undefined ? INDICATION_TREATMENT[q.indicationsTreatment] : undefined;
            const tb = q.timeRequiredBasis !== undefined ? TIME_BASIS[q.timeRequiredBasis] : "";
            const measured = (q.timeRequiredBasis ?? "").startsWith("MEASURED");
            return (
              <div key={q.uuid} className={`hrgq__card${q.isRiskSignificant ? " hrgq__card--rs" : ""}`} onClick={() => openDrawer({ kind: "respquant", id: q.uuid })}>
                <div className="hrgq__head">
                  <div className="hrgq__head-main">
                    <div className="hrgq__name">{hfeName(q.hfeId)}</div>
                    <div className="hrgq__method">{q.methodology}</div>
                  </div>
                  <div className="hrgq__hep">
                    <span className="hrgq__hep-v posmono">{hepText(value)}</span>
                    <span className="hrgq__hep-kind">{q.meanHep !== undefined ? "mean HEP" : "point HEP"}</span>
                  </div>
                </div>
                <div className="hrgq__split">
                  <div className="hrgq__split-head">
                    <span className="hrgq__split-k">Cognition {hepText(cog)}</span>
                    <span className="hrgq__split-k">Execution {hepText(exe)}</span>
                  </div>
                  <div className="hrgq__split-bar">
                    <span className="hrgq__split-cog" style={{ width: `${(cog / sum) * 100}%` }} />
                    <span className="hrgq__split-exe" style={{ width: `${(exe / sum) * 100}%` }} />
                  </div>
                </div>
                <TimeTriplet q={q} />
                <div className="hrgq__foot">
                  {ind !== undefined && <span className={`hrgq__ind hrgq__ind--${(q.indicationsTreatment ?? "").toLowerCase()}`}>{ind.label} · {ind.cc}</span>}
                  <span className={`hrgq__tb hrgq__tb--${measured ? "measured" : "estimated"}`}>{tb}</span>
                </div>
                <div className="hrgq__psfs">
                  {(q.performanceShapingFactors ?? []).map((p, i) => <span key={i} className={`hrgq__psf hrgq__psf--${p.impactOnHep.toLowerCase()}`}>{p.factor}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Error forcing contexts</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>ATHEANA · qualitative search</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addEfc}><HRIcon.Plus /> Add context</button>}
          </div>
        </div>
        <p className="poscard__sub">The plant conditions and performance factors that can drive an operator to an unsafe action, found by a qualitative search. Click a context to edit it.</p>
        <div className="hrdeps">
          {(hr.errorForcingContexts ?? []).map((e) => (
            <div key={e.uuid} className="hrdep" onClick={() => openDrawer({ kind: "efc", id: e.uuid })} style={{ cursor: "pointer" }}>
              <div className="hrdep__head">
                <div>
                  <div className="hrdep__title">{hfeName(e.hfeId)}</div>
                  <div className="hrdep__level">{e.uuid} · unsafe action</div>
                </div>
              </div>
              <div className="hrdep__note">{e.unsafeAction}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="hrefc__cap">Plant conditions</div>
                  <div className="hrdep__elements">{e.plantConditions.map((c, i) => <span key={i} className="hrdep__el">{c}</span>)}</div>
                </div>
                <div>
                  <div className="hrefc__cap">Performance factors</div>
                  <div className="hrdep__elements">{e.performanceShapingFactors.map((c, i) => <span key={i} className="hrdep__el">{c}</span>)}</div>
                </div>
              </div>
              <div className="hrdep__note">{e.vulnerability}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard hrfloor">
        <div className="poscard__head">
          <h3 className="poscard__title">Joint probability floor</h3>
          <HRProvenanceChip>HR-G11</HRProvenanceChip>
        </div>
        <p className="poscard__sub">A minimum joint value prevents an unrealistically low product of single human error probabilities. Click to edit it.</p>
        <div className="hrfloor__band" onClick={() => openDrawer({ kind: "jointfloor", id: "floor" })} style={{ cursor: "pointer" }}>
          <div className="hrfloor__value">
            <span className="hrfloor__value-cap">Minimum joint</span>
            <span className="hrfloor__value-num posmono">{hepText(hr.jointHepFloor.minimumJointProbability)}</span>
          </div>
          <p className="hrfloor__just">{hr.jointHepFloor.justification}</p>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Within-sequence dependence</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-G12 · HR-G13</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addWithinDep}><HRIcon.Plus /> Add dependence</button>}
          </div>
        </div>
        <p className="poscard__sub">Assess the dependence among multiple actions in a sequence and check the joint value against the floor. Click a set to edit it.</p>
        <div className="hrdeps">
          {withinDeps.map((d) => (
            <div key={d.uuid} className={`hrdep${d.belowFloor === true ? " hrdep--floor" : ""}`} onClick={() => openDrawer({ kind: "dependence", id: d.uuid })} style={{ cursor: "pointer" }}>
              <div className="hrdep__head">
                <div>
                  <div className="hrdep__title">{d.eventSequenceId ?? ""} · {d.hfeIds.join(" + ")}</div>
                  <div className="hrdep__level">Dependence. {DEPENDENCE_LEVELS[d.dependenceLevel]}</div>
                </div>
                <span className="hrdep__joint posmono">{hepText(d.jointHep)}<span className="hrhep__kind">joint</span></span>
              </div>
              <div className="hrdep__elements">
                {d.commonElements.map((e, i) => <span key={i} className="hrdep__el">{e}</span>)}
              </div>
              {d.belowFloor === true && <div className="hrdep__floor-flag">Held at the floor (HR-G13)</div>}
              {d.includesInitiatorCausingHfe === true && <div className="hrdep__h5">Includes the event that caused the initiator (HR-H5)</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Relative reasonableness</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-G9 · HR-G10</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addConsistency}><HRIcon.Plus /> Add review</button>}
          </div>
        </div>
        <p className="poscard__sub">Confirm the human error probabilities are consistent across the scenario set. Click a review to edit it.</p>
        {(hr.hepConsistencyReviews ?? []).length > 0 ? (
          <div className="hrdeps">
            {(hr.hepConsistencyReviews ?? []).map((c) => (
              <div key={c.uuid} className="hrnote hrnote--ok" onClick={() => openDrawer({ kind: "consistency", id: c.uuid })} style={{ cursor: "pointer" }}>
                <span>{c.findings}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="posmuted" style={{ margin: 0 }}>No consistency review yet.</p>
        )}
      </div>
    </>
  );
}

function RecoveryScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, editable, mutateHr } = useHrWorkbook();
  function addRecovery(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    const firstPost = hr.humanFailureEvents.find((h) => h.hfeTiming !== "PRE_INITIATOR");
    mutateHr((draft) => ({ ...draft, recoveryActions: [...(draft.recoveryActions ?? []), {
      uuid, name: "New recovery action", hfeId: firstPost?.uuid ?? "", appliedAtLevel: "SEQUENCE" as const, restoredFunction: "", appliedToSequenceIds: [], feasibility: { procedureOrGuidanceAvailable: false, trainingIncluded: false, cuesAvailable: false, manpowerAvailable: false, timeAvailable: false, accessibilityConfirmed: false, equipmentAvailable: false }, hepQuantificationId: "", implementsSrs: [{ sr: "HR-H2", hlr: "H" as const }],
    }] }));
    openDrawer({ kind: "recovery", id: uuid });
  }
  return (
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Recovery actions</h3>
        <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
          <span className="possubtle">{(hr.recoveryActions ?? []).length} actions · HR-H1, H2</span>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRecovery}><HRIcon.Plus /> Add recovery</button>}
        </div>
      </div>
      <p className="poscard__sub">Credit a recovery only where its feasibility is demonstrated for the plant or the design. Click a card to edit it.</p>
      <div className="hrrec">
        {(hr.recoveryActions ?? []).map((r) => {
          const warn = r.preOperationalFeasibilityJustification !== undefined;
          return (
            <div key={r.uuid} className={`hrrec__card${warn ? " hrrec__card--warn" : ""}`} onClick={() => openDrawer({ kind: "recovery", id: r.uuid })}>
              <div className="hrrec__head">
                <div className="hrrec__head-main">
                  <div className="hrrec__name">{r.name}</div>
                  <div className="hrrec__fn">Restores. {r.restoredFunction}</div>
                </div>
                {warn ? <Badge kind="warn">Feasibility open</Badge> : <Badge kind="ok">Feasible</Badge>}
              </div>
              <div className="hrrec__feas">
                {FEASIBILITY_KEYS.map((k) => (
                  <span key={k.key} className={`hrrec__feas-cell hrrec__feas-cell--${r.feasibility[k.key] ? "yes" : "no"}`}>
                    {k.label}
                  </span>
                ))}
              </div>
              {r.preOperationalFeasibilityJustification !== undefined && <div className="hrrec__preop">{r.preOperationalFeasibilityJustification}</div>}
            </div>
          );
        })}
      </div>
      <div className="hrnote" style={{ marginTop: 12 }}>
        <span>If feasibility cannot be shown, the recovery is left out of the model (HR-H3).</span>
      </div>
    </div>
  );
}

function UncertScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, editable, mutateHr } = useHrWorkbook();
  const mu = hr.modelUncertainty;
  function addUncertSource(): void {
    if (!editable) return;
    const idx = mu.uncertaintySources.length;
    mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, uncertaintySources: [...draft.modelUncertainty.uncertaintySources, { source: "", impact: "" }] } }));
    openDrawer({ kind: "uncertsource", id: String(idx) });
  }
  function addRelatedAssumption(): void {
    if (!editable) return;
    const idx = mu.relatedAssumptions.length;
    mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, relatedAssumptions: [...draft.modelUncertainty.relatedAssumptions, { assumption: "", basis: "" }] } }));
    openDrawer({ kind: "relatedassumption", id: String(idx) });
  }
  function addReasonableAlt(): void {
    if (!editable) return;
    const idx = mu.reasonableAlternatives.length;
    mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, reasonableAlternatives: [...draft.modelUncertainty.reasonableAlternatives, { alternative: "", reasonNotSelected: "" }] } }));
    openDrawer({ kind: "reasonablealt", id: String(idx) });
  }
  function addPreOpAssumption(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, preOperationalAssumptions: [...(draft.preOperationalAssumptions ?? []), {
      uuid, assumptionId: uuid, description: "", influenceOnDefinition: "", status: "OPEN" as const, limitations: [], riskImpact: ImportanceLevel.MEDIUM, closureBasis: "", plannedClosureActions: [], affectedElementIds: [],
    }] }));
    openDrawer({ kind: "preopassum", id: uuid });
  }
  function addSensitivity(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, sensitivityStudies: [...(draft.sensitivityStudies ?? []), {
      uuid, name: "", description: "", variedParameters: [], parameterRanges: {}, results: "",
    }] }));
    openDrawer({ kind: "sensitivity", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sources of model uncertainty</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-G15</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addUncertSource}><HRIcon.Plus /> Add source</button>}
          </div>
        </div>
        <p className="poscard__sub">The modeling choices whose alternatives could change the result. Click a source to edit it.</p>
        <table className="postable">
          <thead><tr><th>Source</th><th>Impact</th></tr></thead>
          <tbody>
            {mu.uncertaintySources.map((u, i) => (
              <tr key={i} className="postable__row--clickable" onClick={() => openDrawer({ kind: "uncertsource", id: String(i) })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{u.source}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{u.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Related assumptions</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-G15</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRelatedAssumption}><HRIcon.Plus /> Add assumption</button>}
          </div>
        </div>
        <p className="poscard__sub">The assumptions tied to the uncertainty sources, with their basis. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Assumption</th><th>Basis</th></tr></thead>
          <tbody>
            {mu.relatedAssumptions.map((a, i) => (
              <tr key={i} className="postable__row--clickable" onClick={() => openDrawer({ kind: "relatedassumption", id: String(i) })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{a.assumption}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{a.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Reasonable alternatives</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-G15</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addReasonableAlt}><HRIcon.Plus /> Add alternative</button>}
          </div>
        </div>
        <p className="poscard__sub">The alternatives considered and why they were not selected. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Alternative</th><th>Reason not selected</th></tr></thead>
          <tbody>
            {mu.reasonableAlternatives.map((a, i) => (
              <tr key={i} className="postable__row--clickable" onClick={() => openDrawer({ kind: "reasonablealt", id: String(i) })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{a.alternative}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{a.reasonNotSelected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Pre-operational assumptions</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-A10</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPreOpAssumption}><HRIcon.Plus /> Add assumption</button>}
          </div>
        </div>
        <p className="poscard__sub">The assumptions that stand in for information the operating plant will later supply. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Influence on the analysis</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>
            {(hr.preOperationalAssumptions ?? []).map((a) => (
              <tr key={a.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "preopassum", id: a.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{a.influenceOnDefinition}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{a.description}</td>
                <td><Badge kind={a.status === "CLOSED" ? "ok" : a.status === "IN_PROGRESS" ? "progress" : "warn"}>{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sensitivity studies</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-G15</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSensitivity}><HRIcon.Plus /> Add study</button>}
          </div>
        </div>
        <p className="poscard__sub">The studies that vary an uncertain parameter to test the result. Click a study to edit it.</p>
        <table className="postable">
          <thead><tr><th>Study</th><th>Result</th></tr></thead>
          <tbody>
            {(hr.sensitivityStudies ?? []).map((s) => (
              <tr key={s.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "sensitivity", id: s.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{s.name ?? s.description}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{s.results ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { hr } = useHrWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(hr, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${hr.name} — HR Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{hr.name}</h1>
        <h2>Preliminary Human Reliability Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {HR_TOC.map(([t, p], i) => (<div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>))}
        </div>
      </div>
      <div className="posgen__side">
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Conformance check</h3>
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 9 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
                <HRIcon.Send /> {ready ? "Submit draft to internal review" : "Submit working draft to review"}
              </button>
            )}
            <button type="button" className="posnav__btn" onClick={() => { void generateHrReport(hr, ready); }}><HRIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><HRIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fieldGrid(rows: [string, string][]): JSX.Element {
  return (
    <div className="posfield-grid">
      {rows.map(([k, v], i) => (
        <div key={i} className="posfield"><label className="posfield__label">{k}</label><div className="posmono">{v}</div></div>
      ))}
    </div>
  );
}

function DrawerContent({ context, onClose }: { context: HrDrawerContext; onClose: () => void }): JSX.Element | null {
  const { hr, links, editable, mutateHr } = useHrWorkbook();

  if (context.kind === "activity") {
    const a = hr.routineActivities.find((x) => x.uuid === context.id);
    if (a === undefined) return null;
    const patch = (fields: Partial<typeof a>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, routineActivities: draft.routineActivities.map((x) => (x.uuid === a.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, routineActivities: draft.routineActivities.filter((x) => x.uuid !== a.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const sourceKeys = ["PROCEDURES", "PLANT_PRACTICES", "INDUSTRY_EXPERIENCE", "DESIGN_ENGINEER_INTERVIEW"] as const;
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Routine activity · HR-A1, A3</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <input className="posfield__input" value={a.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{a.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Type</label>
              {editable
                ? <select className="posfield__select" value={a.activityType} onChange={(e) => patch({ activityType: e.target.value === "CALIBRATION" ? "CALIBRATION" : "REALIGNMENT" })}>
                    <option value="REALIGNMENT">Realignment</option>
                    <option value="CALIBRATION">Calibration</option>
                  </select>
                : <div>{a.activityType === "CALIBRATION" ? "Calibration" : "Realignment"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Multi-train or diverse</label>
              {editable
                ? <select className="posfield__select" value={a.affectsMultipleTrainsOrDiverseSystems ? "yes" : "no"} onChange={(e) => patch({ affectsMultipleTrainsOrDiverseSystems: e.target.value === "yes" })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                : <div>{a.affectsMultipleTrainsOrDiverseSystems ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{a.description}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Affected systems (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(a.affectedSystems)} onChange={(e) => patch({ affectedSystems: parseCsv(e.target.value) })} /> : <div>{csv(a.affectedSystems)}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Affected components (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(a.affectedComponents ?? [])} onChange={(e) => patch({ affectedComponents: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(a.affectedComponents ?? []) || "\u2014"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Operating states (comma separated)</label>
              {editable ? <input className="posfield__input posmono" value={csv(a.applicablePlantOperatingStates)} onChange={(e) => patch({ applicablePlantOperatingStates: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(a.applicablePlantOperatingStates)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Identification sources</label>
              {editable
                ? <div className="posrow posrow--wrap" style={{ gap: 12 }}>
                    {sourceKeys.map((src) => (
                      <label key={src} className="posrow" style={{ gap: 5, alignItems: "center", cursor: "pointer" }}>
                        <input type="checkbox" checked={a.identificationSources.includes(src)} onChange={() => patch({ identificationSources: a.identificationSources.includes(src) ? a.identificationSources.filter((x) => x !== src) : [...a.identificationSources, src] })} />
                        <span style={{ fontSize: 12.5 }}>{ACTIVITY_SOURCES[src]}</span>
                      </label>
                    ))}
                  </div>
                : <div>{a.identificationSources.map((s) => ACTIVITY_SOURCES[s]).join(" · ")}</div>}
            </div>
            {a.affectsMultipleTrainsOrDiverseSystems && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Multi-train mechanism (HR-A5)</label>
                {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.multiTrainMechanism ?? ""} onChange={(e) => patch({ multiTrainMechanism: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{a.multiTrainMechanism ?? "\u2014"}</div>}
              </div>
            )}
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Pre-operational identification (HR-A10)</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.preOperationalIdentificationProcess ?? ""} onChange={(e) => patch({ preOperationalIdentificationProcess: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{a.preOperationalIdentificationProcess ?? "\u2014"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove activity</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "contribution") {
    const c = (hr.supportSystemInitiatorOperatorContributions ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (fields: Partial<typeof c>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, supportSystemInitiatorOperatorContributions: (draft.supportSystemInitiatorOperatorContributions ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, supportSystemInitiatorOperatorContributions: (draft.supportSystemInitiatorOperatorContributions ?? []).filter((x) => x.uuid !== c.uuid) }));
    };
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Operator contribution to a support-system initiator · HR-A7</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Support system</label>
              {editable ? <input className="posfield__input" value={c.systemReference} onChange={(e) => patch({ systemReference: e.target.value })} /> : <div>{c.systemReference}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Initiating event it contributes to</label>
              {editable
                ? (links !== null && links.ieInitiators.length > 0
                    ? <select className="posfield__select" value={c.faultTreeReference ?? ""} onChange={(e) => patch({ faultTreeReference: e.target.value.length === 0 ? undefined : e.target.value })}>
                        <option value="">Not linked</option>
                        {links.ieInitiators.map((i) => <option key={i.id} value={i.id}>{`${i.id} \u00b7 ${i.name}`}</option>)}
                      </select>
                    : <input className="posfield__input posmono" value={c.faultTreeReference ?? ""} onChange={(e) => patch({ faultTreeReference: e.target.value.length === 0 ? undefined : e.target.value })} />)
                : <div className="posmono">{c.faultTreeReference ?? "\u2014"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Included in the initiator fault tree</label>
              {editable
                ? <select className="posfield__select" value={c.included ? "yes" : "no"} onChange={(e) => patch({ included: e.target.value === "yes" })}>
                    <option value="yes">Included</option>
                    <option value="no">Excluded</option>
                  </select>
                : <div>{c.included ? "Included" : "Excluded"}</div>}
            </div>
            {!c.included && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Exclusion basis</label>
                {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.exclusionBasis ?? ""} onChange={(e) => patch({ exclusionBasis: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{c.exclusionBasis ?? "\u2014"}</div>}
              </div>
            )}
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove contribution</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "prescreen") {
    const s = hr.preInitiatorScreeningRecords.find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    const patch = (fields: Partial<typeof s>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, preInitiatorScreeningRecords: draft.preInitiatorScreeningRecords.map((x) => (x.uuid === s.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, preInitiatorScreeningRecords: draft.preInitiatorScreeningRecords.filter((x) => x.uuid !== s.uuid) }));
    };
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Pre-initiator screening · HR-B1 · HR-B3</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Activity</label>
              {editable
                ? <select className="posfield__select" value={s.activityId} onChange={(e) => patch({ activityId: e.target.value })}>
                    {hr.routineActivities.map((a) => <option key={a.uuid} value={a.uuid}>{`${a.uuid} · ${a.name}`}</option>)}
                  </select>
                : <div>{hr.routineActivities.find((a) => a.uuid === s.activityId)?.name ?? s.activityId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Decision</label>
              {editable
                ? <select className="posfield__select" value={s.screenedOut ? "out" : "carried"} onChange={(e) => patch({ screenedOut: e.target.value === "out" })}>
                    <option value="carried">Carried</option>
                    <option value="out">Screened out</option>
                  </select>
                : <div>{s.screenedOut ? "Screened out" : "Carried"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
              {editable ? <textarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={s.justification} onChange={(e) => patch({ justification: e.target.value })} /> : <div>{s.justification}</div>}
            </div>
            {s.screenedOut && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Multi-state administrative detection justification (HR-B2)</label>
                {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={s.multiStateAdministrativeDetectionJustification ?? ""} onChange={(e) => patch({ multiStateAdministrativeDetectionJustification: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{s.multiStateAdministrativeDetectionJustification ?? "—"}</div>}
              </div>
            )}
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove screening</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "prehfe") {
    const h = hr.humanFailureEvents.find((x) => x.uuid === context.id);
    if (h === undefined) return null;
    const detail = h.preInitiatorDetail;
    const patch = (fields: Partial<typeof h>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, humanFailureEvents: draft.humanFailureEvents.map((x) => (x.uuid === h.uuid ? { ...x, ...fields } : x)) }));
    };
    const patchDetail = (fields: Partial<NonNullable<typeof detail>>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, humanFailureEvents: draft.humanFailureEvents.map((x) => {
        if (x.uuid !== h.uuid) return x;
        const base = x.preInitiatorDetail ?? { sourceActivityId: "", detectionBasis: "", unavailabilityModes: [], miscalibrationImpactIncluded: false };
        return { ...x, preInitiatorDetail: { ...base, ...fields } };
      }) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, humanFailureEvents: draft.humanFailureEvents.filter((x) => x.uuid !== h.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const num = (v: string): number | undefined => { const n = Number(v); return v.length === 0 || Number.isNaN(n) ? undefined : n; };
    const posName = (id: string): string => { const p = links?.posStates.find((x) => x.id === id); return p !== undefined ? `${id} · ${p.name}` : id; };
    const sysLabel = (id: string): string => { const d = links?.syDefs.find((x) => x.id === id); return d !== undefined ? `${id} · ${d.name}` : id; };
    const srcName = detail?.sourceActivityId !== undefined ? hr.routineActivities.find((a) => a.uuid === detail.sourceActivityId)?.name ?? "" : "";
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Pre-initiator event · {h.uuid}</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <input className="posfield__input" value={h.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{h.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Impact level</label>
              {editable
                ? <select className="posfield__select" value={h.impactLevel} onChange={(e) => patch({ impactLevel: e.target.value === "FUNCTION" ? "FUNCTION" : e.target.value === "SYSTEM" ? "SYSTEM" : e.target.value === "COMPONENT" ? "COMPONENT" : "TRAIN" })}>
                    <option value="FUNCTION">Function</option>
                    <option value="SYSTEM">System</option>
                    <option value="TRAIN">Train</option>
                    <option value="COMPONENT">Component</option>
                  </select>
                : <div>{IMPACT_LEVELS[h.impactLevel]} level</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Source activity (HR-C1)</label>
              {editable
                ? <select className="posfield__select" value={detail?.sourceActivityId ?? ""} onChange={(e) => patchDetail({ sourceActivityId: e.target.value })}>
                    <option value="">Not linked</option>
                    {hr.routineActivities.map((a) => <option key={a.uuid} value={a.uuid}>{`${a.uuid} · ${a.name}`}</option>)}
                  </select>
                : <div>{detail?.sourceActivityId !== undefined && detail.sourceActivityId.length > 0 ? `${detail.sourceActivityId} · ${srcName}` : "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">How it is handled</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={h.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{h.description}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Affected systems (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(h.affectedSystems)} onChange={(e) => patch({ affectedSystems: parseCsv(e.target.value) })} /> : <div>{h.affectedSystems.map(sysLabel).join(", ")}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Affected components (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(h.affectedComponents ?? [])} onChange={(e) => patch({ affectedComponents: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(h.affectedComponents ?? []) || "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Operating states (comma separated)</label>
              {editable ? <input className="posfield__input posmono" value={csv(h.applicablePlantOperatingStates)} onChange={(e) => patch({ applicablePlantOperatingStates: parseCsv(e.target.value) })} /> : <div>{h.applicablePlantOperatingStates.map(posName).join(", ")}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time to detection (hours)</label>
              {editable ? <input className="posfield__input posmono" type="number" value={detail?.averageTimeToDetectionHours ?? ""} onChange={(e) => patchDetail({ averageTimeToDetectionHours: num(e.target.value) })} /> : <div className="posmono">{detail?.averageTimeToDetectionHours ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Miscalibration mode</label>
              {editable
                ? <select className="posfield__select" value={detail?.miscalibrationImpactIncluded === true ? "yes" : "no"} onChange={(e) => patchDetail({ miscalibrationImpactIncluded: e.target.value === "yes" })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                : <div>{detail?.miscalibrationImpactIncluded === true ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Detection basis</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={detail?.detectionBasis ?? ""} onChange={(e) => patchDetail({ detectionBasis: e.target.value })} /> : <div>{detail?.detectionBasis ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Unavailability modes (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(detail?.unavailabilityModes ?? [])} onChange={(e) => patchDetail({ unavailabilityModes: parseCsv(e.target.value) })} /> : <div>{csv(detail?.unavailabilityModes ?? []) || "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove event</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "respreview") {
    const r = hr.responseIdentificationReviews.find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    const patch = (fields: Partial<typeof r>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, responseIdentificationReviews: draft.responseIdentificationReviews.map((x) => (x.uuid === r.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, responseIdentificationReviews: draft.responseIdentificationReviews.filter((x) => x.uuid !== r.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Response identification review · HR-E1</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Review scope</label>
              {editable
                ? <select className="posfield__select" value={r.reviewScope} onChange={(e) => patch({ reviewScope: e.target.value as typeof r.reviewScope })}>
                    <option value="EMERGENCY_AND_ABNORMAL_PROCEDURES">Emergency and abnormal procedures</option>
                    <option value="PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH">Planned procedures and operational approach</option>
                    <option value="OPERATIONAL_EVENTS">Operational events</option>
                    <option value="TRAINING_MATERIALS">Training materials</option>
                    <option value="SIMILAR_FACILITY_EXPERIENCE">Similar facility experience</option>
                    <option value="NONNUCLEAR_FACILITY_EXPERIENCE">Nonnuclear facility experience</option>
                  </select>
                : <div>{REVIEW_SCOPES[r.reviewScope]}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Date</label>
              {editable ? <input className="posfield__input" type="date" value={r.date ?? ""} onChange={(e) => patch({ date: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{r.date ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Sources reviewed (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(r.sourcesReviewed)} onChange={(e) => patch({ sourcesReviewed: parseCsv(e.target.value) })} /> : <div>{csv(r.sourcesReviewed)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Findings</label>
              {editable ? <textarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={r.findings} onChange={(e) => patch({ findings: e.target.value })} /> : <div>{r.findings}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Identified events (comma separated ids)</label>
              {editable ? <input className="posfield__input posmono" value={csv(r.identifiedHfeIds)} onChange={(e) => patch({ identifiedHfeIds: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(r.identifiedHfeIds)}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove review</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "respconfirm") {
    const c = (hr.responseConfirmations ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (fields: Partial<typeof c>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, responseConfirmations: (draft.responseConfirmations ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, responseConfirmations: (draft.responseConfirmations ?? []).filter((x) => x.uuid !== c.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Confirmation · HR-E5 · HR-E7</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Method</label>
              {editable
                ? <select className="posfield__select" value={c.method} onChange={(e) => patch({ method: e.target.value as typeof c.method })}>
                    <option value="PERSONNEL_REVIEW">Personnel review</option>
                    <option value="TALK_THROUGH">Talk-through</option>
                    <option value="SIMULATION_OBSERVATION">Simulation observation</option>
                  </select>
                : <div>{c.method}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Date</label>
              {editable ? <input className="posfield__input" type="date" value={c.date} onChange={(e) => patch({ date: e.target.value })} /> : <div>{c.date}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Personnel roles (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(c.personnelRoles)} onChange={(e) => patch({ personnelRoles: parseCsv(e.target.value) })} /> : <div>{csv(c.personnelRoles)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Confirmed events (comma separated ids)</label>
              {editable ? <input className="posfield__input posmono" value={csv(c.hfeIds)} onChange={(e) => patch({ hfeIds: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(c.hfeIds)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Findings</label>
              {editable ? <textarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={c.findings} onChange={(e) => patch({ findings: e.target.value })} /> : <div>{c.findings}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Interpretation consistent</label>
              {editable
                ? <select className="posfield__select" value={c.interpretationConsistent ? "yes" : "no"} onChange={(e) => patch({ interpretationConsistent: e.target.value === "yes" })}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                : <div>{c.interpretationConsistent ? "Yes" : "No"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove confirmation</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "posthfe") {
    const h = hr.humanFailureEvents.find((x) => x.uuid === context.id);
    if (h === undefined) return null;
    const rd = h.responseDetail;
    const t = HFE_TIMING[h.hfeTiming];
    const patch = (fields: Partial<typeof h>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, humanFailureEvents: draft.humanFailureEvents.map((x) => (x.uuid === h.uuid ? { ...x, ...fields } : x)) }));
    };
    const patchDetail = (fields: Partial<NonNullable<typeof rd>>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, humanFailureEvents: draft.humanFailureEvents.map((x) => {
        if (x.uuid !== h.uuid) return x;
        const base = x.responseDetail ?? { requiredResponse: "", responseType: "INITIATE" as const, successCriteriaIds: [], procedureReferences: [], cueDescription: "", cueTimingBySequence: [] };
        return { ...x, responseDetail: { ...base, ...fields } };
      }) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, humanFailureEvents: draft.humanFailureEvents.filter((x) => x.uuid !== h.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const num = (v: string): number | undefined => { const n = Number(v); return v.length === 0 || Number.isNaN(n) ? undefined : n; };
    const cts = rd?.cueTimingBySequence ?? [];
    const setCt = (i: number, fields: Partial<(typeof cts)[number]>): void => patchDetail({ cueTimingBySequence: cts.map((x, j) => (j === i ? { ...x, ...fields } : x)) });
    const addCt = (): void => patchDetail({ cueTimingBySequence: [...cts, { eventSequenceId: "", plantOperatingStateId: "", cueTimeMinutes: undefined, timeWindowMinutes: undefined, basis: "" }] });
    const removeCt = (i: number): void => patchDetail({ cueTimingBySequence: cts.filter((unused, j) => j !== i) });
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Response event · {t?.label ?? h.hfeTiming}</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <input className="posfield__input" value={h.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{h.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Response type</label>
              {editable
                ? <select className="posfield__select" value={rd?.responseType ?? "INITIATE"} onChange={(e) => patchDetail({ responseType: e.target.value as NonNullable<typeof rd>["responseType"] })}>
                    <option value="INITIATE">Initiate</option>
                    <option value="OPERATE">Operate</option>
                    <option value="CONTROL">Control</option>
                    <option value="ISOLATE">Isolate</option>
                    <option value="TERMINATE">Terminate</option>
                    <option value="AGGRAVATING_ACTION">Aggravating action</option>
                  </select>
                : <div>{rd !== undefined ? RESPONSE_TYPES[rd.responseType] : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Impact level</label>
              {editable
                ? <select className="posfield__select" value={h.impactLevel} onChange={(e) => patch({ impactLevel: e.target.value === "FUNCTION" ? "FUNCTION" : e.target.value === "SYSTEM" ? "SYSTEM" : e.target.value === "COMPONENT" ? "COMPONENT" : "TRAIN" })}>
                    <option value="FUNCTION">Function</option>
                    <option value="SYSTEM">System</option>
                    <option value="TRAIN">Train</option>
                    <option value="COMPONENT">Component</option>
                  </select>
                : <div>{IMPACT_LEVELS[h.impactLevel]}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Required response</label>
              {editable ? <input className="posfield__input" value={rd?.requiredResponse ?? ""} onChange={(e) => patchDetail({ requiredResponse: e.target.value })} /> : <div>{rd?.requiredResponse ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Cue description</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={rd?.cueDescription ?? ""} onChange={(e) => patchDetail({ cueDescription: e.target.value })} /> : <div>{rd?.cueDescription ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">How it is handled</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={h.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{h.description}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Affected systems (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(h.affectedSystems)} onChange={(e) => patch({ affectedSystems: parseCsv(e.target.value) })} /> : <div>{csv(h.affectedSystems)}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Operating states (comma separated)</label>
              {editable ? <input className="posfield__input posmono" value={csv(h.applicablePlantOperatingStates)} onChange={(e) => patch({ applicablePlantOperatingStates: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(h.applicablePlantOperatingStates)}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Event sequences (comma separated)</label>
              {editable ? <input className="posfield__input posmono" value={csv(h.applicableEventSequences ?? [])} onChange={(e) => patch({ applicableEventSequences: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(h.applicableEventSequences ?? []) || "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Success criteria (comma separated ids)</label>
              {editable ? <input className="posfield__input posmono" value={csv(rd?.successCriteriaIds ?? [])} onChange={(e) => patchDetail({ successCriteriaIds: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(rd?.successCriteriaIds ?? []) || "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Procedure references (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(rd?.procedureReferences ?? [])} onChange={(e) => patchDetail({ procedureReferences: parseCsv(e.target.value) })} /> : <div>{csv(rd?.procedureReferences ?? []) || "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Grouped responses (comma separated ids)</label>
              {editable ? <input className="posfield__input posmono" value={csv(h.groupedResponses ?? [])} onChange={(e) => patch({ groupedResponses: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div className="posmono">{csv(h.groupedResponses ?? []) || "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Cross-state grouping basis</label>
              {editable
                ? <select className="posfield__select" value={h.crossPosGroupingBasis ?? ""} onChange={(e) => patch({ crossPosGroupingBasis: e.target.value === "BOUNDED" ? "BOUNDED" : e.target.value === "EQUIVALENT_BOUNDARY_CONDITIONS" ? "EQUIVALENT_BOUNDARY_CONDITIONS" : undefined })}>
                    <option value="">None</option>
                    <option value="BOUNDED">Bounded</option>
                    <option value="EQUIVALENT_BOUNDARY_CONDITIONS">Equivalent boundary conditions</option>
                  </select>
                : <div>{h.crossPosGroupingBasis ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Grouping justification</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={h.groupingJustification ?? ""} onChange={(e) => patch({ groupingJustification: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{h.groupingJustification ?? "—"}</div>}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="essec">Cue timing per operating state (HR-F4)</div>
            {cts.map((ct, i) => (
              <div key={i} className="posfield-grid" style={{ marginTop: 8 }}>
                <div className="posfield"><label className="posfield__label">Event sequence</label>
                  {editable ? <input className="posfield__input posmono" value={ct.eventSequenceId} onChange={(e) => setCt(i, { eventSequenceId: e.target.value })} /> : <div className="posmono">{ct.eventSequenceId}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Operating state</label>
                  {editable ? <input className="posfield__input posmono" value={ct.plantOperatingStateId ?? ""} onChange={(e) => setCt(i, { plantOperatingStateId: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div className="posmono">{ct.plantOperatingStateId ?? "—"}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Cue time (min)</label>
                  {editable ? <input className="posfield__input posmono" type="number" value={ct.cueTimeMinutes ?? ""} onChange={(e) => setCt(i, { cueTimeMinutes: num(e.target.value) })} /> : <div className="posmono">{ct.cueTimeMinutes ?? "—"}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Window (min)</label>
                  {editable ? <input className="posfield__input posmono" type="number" value={ct.timeWindowMinutes ?? ""} onChange={(e) => setCt(i, { timeWindowMinutes: num(e.target.value) })} /> : <div className="posmono">{ct.timeWindowMinutes ?? "—"}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
                  {editable ? <input className="posfield__input" value={ct.basis ?? ""} onChange={(e) => setCt(i, { basis: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{ct.basis ?? "—"}</div>}
                </div>
                {editable && (
                  <div className="posfield posfield-grid--span2">
                    <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeCt(i)}><HRIcon.Close /> Remove cue timing</button>
                  </div>
                )}
              </div>
            ))}
            {editable && (
              <div className="posrow" style={{ marginTop: 8 }}>
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCt}><HRIcon.Plus /> Add cue timing</button>
              </div>
            )}
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove event</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "prequant") {
    const q = hr.hepQuantifications.find((x) => x.hfeId === context.id);
    if (q === undefined) return null;
    const hName = hr.humanFailureEvents.find((x) => x.uuid === context.id)?.name ?? context.id;
    const patch = (fields: Partial<typeof q>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, hepQuantifications: draft.hepQuantifications.map((x) => (x.uuid === q.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, hepQuantifications: draft.hepQuantifications.filter((x) => x.uuid !== q.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const num = (v: string): number | undefined => { const n = Number(v); return v.length === 0 || Number.isNaN(n) ? undefined : n; };
    const unc = q.uncertaintyCharacterization ?? { riskSignificant: q.isRiskSignificant, method: "", probabilisticRepresentationProvided: false };
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Quantification · {hName}</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Methodology</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={q.methodology} onChange={(e) => patch({ methodology: e.target.value })} /> : <div>{q.methodology}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Assessment type</label>
              {editable
                ? <select className="posfield__select" value={q.assessmentType} onChange={(e) => patch({ assessmentType: e.target.value === "DETAILED_ASSESSMENT" ? "DETAILED_ASSESSMENT" : "CONSERVATIVE_ESTIMATE" })}>
                    <option value="CONSERVATIVE_ESTIMATE">Conservative (CC-I)</option>
                    <option value="DETAILED_ASSESSMENT">Detailed (CC-II)</option>
                  </select>
                : <div>{q.assessmentType === "DETAILED_ASSESSMENT" ? "Detailed (CC-II)" : "Conservative (CC-I)"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Risk-significant</label>
              {editable
                ? <select className="posfield__select" value={q.isRiskSignificant ? "yes" : "no"} onChange={(e) => { const v = e.target.value === "yes"; patch({ isRiskSignificant: v, uncertaintyCharacterization: { riskSignificant: v, method: unc.method, probabilisticRepresentationProvided: unc.probabilisticRepresentationProvided } }); }}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                : <div>{q.isRiskSignificant ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Point estimate HEP</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={q.pointEstimateHep ?? ""} onChange={(e) => patch({ pointEstimateHep: num(e.target.value) })} /> : <div className="posmono">{q.pointEstimateHep !== undefined ? hepText(q.pointEstimateHep) : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Mean HEP</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={q.meanHep ?? ""} onChange={(e) => patch({ meanHep: num(e.target.value) })} /> : <div className="posmono">{q.meanHep !== undefined ? hepText(q.meanHep) : "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Plant or design-specific factors (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(q.plantSpecificInformationUsed ?? [])} onChange={(e) => patch({ plantSpecificInformationUsed: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(q.plantSpecificInformationUsed ?? []) || "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Uncertainty characterization</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={unc.method} onChange={(e) => patch({ uncertaintyCharacterization: { riskSignificant: unc.riskSignificant, method: e.target.value, probabilisticRepresentationProvided: unc.probabilisticRepresentationProvided } })} /> : <div>{unc.method || "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Probabilistic representation provided</label>
              {editable
                ? <select className="posfield__select" value={unc.probabilisticRepresentationProvided ? "yes" : "no"} onChange={(e) => patch({ uncertaintyCharacterization: { riskSignificant: unc.riskSignificant, method: unc.method, probabilisticRepresentationProvided: e.target.value === "yes" } })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                : <div>{unc.probabilisticRepresentationProvided ? "Yes" : "No"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove quantification</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "precredit") {
    const r = (hr.preInitiatorRecoveryCredits ?? []).find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    const preHfes = hr.humanFailureEvents.filter((x) => x.hfeTiming === "PRE_INITIATOR");
    const patch = (fields: Partial<typeof r>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, preInitiatorRecoveryCredits: (draft.preInitiatorRecoveryCredits ?? []).map((x) => (x.uuid === r.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, preInitiatorRecoveryCredits: (draft.preInitiatorRecoveryCredits ?? []).filter((x) => x.uuid !== r.uuid) }));
    };
    const num = (v: string): number => { const n = Number(v); return Number.isNaN(n) ? 0 : n; };
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Recovery credit · HR-D5 · HR-D6</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Pre-initiator event</label>
              {editable
                ? <select className="posfield__select" value={r.hfeId} onChange={(e) => patch({ hfeId: e.target.value })}>
                    {preHfes.map((h) => <option key={h.uuid} value={h.uuid}>{`${h.uuid} · ${h.name}`}</option>)}
                  </select>
                : <div>{hr.humanFailureEvents.find((h) => h.uuid === r.hfeId)?.name ?? r.hfeId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Credit basis</label>
              {editable
                ? <select className="posfield__select" value={(r.creditBases ?? [])[0] ?? "INDEPENDENT_VERIFICATION"} onChange={(e) => patch({ creditBases: [e.target.value === "POST_MAINTENANCE_TEST" ? "POST_MAINTENANCE_TEST" : e.target.value === "WORK_SUPERVISION_CHECK" ? "WORK_SUPERVISION_CHECK" : e.target.value === "OPERATOR_ROUNDS" ? "OPERATOR_ROUNDS" : "INDEPENDENT_VERIFICATION"] })}>
                    <option value="POST_MAINTENANCE_TEST">Post-maintenance test</option>
                    <option value="INDEPENDENT_VERIFICATION">Independent verification</option>
                    <option value="WORK_SUPERVISION_CHECK">Work supervision check</option>
                    <option value="OPERATOR_ROUNDS">Operator rounds</option>
                  </select>
                : <div>{(r.creditBases ?? [])[0] ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Maximum credit (residual factor)</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={r.maximumCreditSpecified} onChange={(e) => patch({ maximumCreditSpecified: num(e.target.value) })} /> : <div className="posmono">{r.maximumCreditSpecified}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Methodology consistent</label>
              {editable
                ? <select className="posfield__select" value={r.recoveryFactorsMethodologyConsistent ? "yes" : "no"} onChange={(e) => patch({ recoveryFactorsMethodologyConsistent: e.target.value === "yes" })}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                : <div>{r.recoveryFactorsMethodologyConsistent ? "Yes" : "No"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove credit</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "dependence") {
    const d = hr.dependencyAssessments.find((x) => x.uuid === context.id);
    if (d === undefined) return null;
    const patch = (fields: Partial<typeof d>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, dependencyAssessments: draft.dependencyAssessments.map((x) => (x.uuid === d.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, dependencyAssessments: draft.dependencyAssessments.filter((x) => x.uuid !== d.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const num = (v: string): number => { const n = Number(v); return Number.isNaN(n) ? 0 : n; };
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Dependence · HR-D7 · HR-G12</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Scope</label>
              {editable
                ? <select className="posfield__select" value={d.scope} onChange={(e) => patch({ scope: e.target.value === "WITHIN_SEQUENCE" ? "WITHIN_SEQUENCE" : "PRE_INITIATOR_SET" })}>
                    <option value="PRE_INITIATOR_SET">Pre-initiator set</option>
                    <option value="WITHIN_SEQUENCE">Within sequence</option>
                  </select>
                : <div>{d.scope === "WITHIN_SEQUENCE" ? "Within sequence" : "Pre-initiator set"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Dependence level</label>
              {editable
                ? <select className="posfield__select" value={d.dependenceLevel} onChange={(e) => patch({ dependenceLevel: e.target.value as DependenceLevel })}>
                    <option value="ZERO">Zero</option>
                    <option value="LOW">Low</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="HIGH">High</option>
                    <option value="COMPLETE">Complete</option>
                  </select>
                : <div>{DEPENDENCE_LEVELS[d.dependenceLevel]}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Coupled events (comma separated ids)</label>
              {editable ? <input className="posfield__input posmono" value={csv(d.hfeIds)} onChange={(e) => patch({ hfeIds: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(d.hfeIds)}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Joint HEP</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={d.jointHep} onChange={(e) => patch({ jointHep: num(e.target.value) })} /> : <div className="posmono">{hepText(d.jointHep)}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Below the floor</label>
              {editable
                ? <select className="posfield__select" value={d.belowFloor === true ? "yes" : "no"} onChange={(e) => patch({ belowFloor: e.target.value === "yes" })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                : <div>{d.belowFloor === true ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Common elements (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(d.commonElements)} onChange={(e) => patch({ commonElements: parseCsv(e.target.value) })} /> : <div>{csv(d.commonElements)}</div>}
            </div>
            {d.scope === "WITHIN_SEQUENCE" && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Event sequence</label>
                {editable ? <input className="posfield__input posmono" value={d.eventSequenceId ?? ""} onChange={(e) => patch({ eventSequenceId: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div className="posmono">{d.eventSequenceId ?? "—"}</div>}
              </div>
            )}
            {d.belowFloor === true && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Floor applied / justification</label>
                {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={d.floorAppliedOrJustification ?? ""} onChange={(e) => patch({ floorAppliedOrJustification: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{d.floorAppliedOrJustification ?? "—"}</div>}
              </div>
            )}
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove dependence</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "respquant") {
    const q = hr.hepQuantifications.find((x) => x.uuid === context.id);
    if (q === undefined) return null;
    const hName = hr.humanFailureEvents.find((x) => x.uuid === q.hfeId)?.name ?? q.hfeId;
    const patch = (fields: Partial<typeof q>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, hepQuantifications: draft.hepQuantifications.map((x) => (x.uuid === q.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, hepQuantifications: draft.hepQuantifications.filter((x) => x.uuid !== q.uuid) }));
    };
    const num = (v: string): number | undefined => { const n = Number(v); return v.length === 0 || Number.isNaN(n) ? undefined : n; };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const unc = q.uncertaintyCharacterization ?? { riskSignificant: q.isRiskSignificant, method: "", probabilisticRepresentationProvided: false };
    const psfs = q.performanceShapingFactors ?? [];
    const setPsf = (i: number, fields: Partial<(typeof psfs)[number]>): void => patch({ performanceShapingFactors: psfs.map((x, j) => (j === i ? { ...x, ...fields } : x)) });
    const addPsf = (): void => patch({ performanceShapingFactors: [...psfs, { factor: "", evaluation: "", impactOnHep: "NEUTRAL" }] });
    const removePsf = (i: number): void => patch({ performanceShapingFactors: psfs.filter((unused, j) => j !== i) });
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Response quantification · {hName}</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Methodology</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={q.methodology} onChange={(e) => patch({ methodology: e.target.value })} /> : <div>{q.methodology}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Assessment type</label>
              {editable
                ? <select className="posfield__select" value={q.assessmentType} onChange={(e) => patch({ assessmentType: e.target.value === "DETAILED_ASSESSMENT" ? "DETAILED_ASSESSMENT" : "CONSERVATIVE_ESTIMATE" })}>
                    <option value="CONSERVATIVE_ESTIMATE">Conservative (CC-I)</option>
                    <option value="DETAILED_ASSESSMENT">Detailed (CC-II)</option>
                  </select>
                : <div>{q.assessmentType === "DETAILED_ASSESSMENT" ? "Detailed (CC-II)" : "Conservative (CC-I)"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Risk-significant</label>
              {editable
                ? <select className="posfield__select" value={q.isRiskSignificant ? "yes" : "no"} onChange={(e) => { const v = e.target.value === "yes"; patch({ isRiskSignificant: v, uncertaintyCharacterization: { riskSignificant: v, method: unc.method, probabilisticRepresentationProvided: unc.probabilisticRepresentationProvided } }); }}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                : <div>{q.isRiskSignificant ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Point estimate HEP</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={q.pointEstimateHep ?? ""} onChange={(e) => patch({ pointEstimateHep: num(e.target.value) })} /> : <div className="posmono">{q.pointEstimateHep !== undefined ? hepText(q.pointEstimateHep) : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Mean HEP</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={q.meanHep ?? ""} onChange={(e) => patch({ meanHep: num(e.target.value) })} /> : <div className="posmono">{q.meanHep !== undefined ? hepText(q.meanHep) : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Cognition contribution</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={q.cognitionContribution ?? ""} onChange={(e) => patch({ cognitionContribution: num(e.target.value) })} /> : <div className="posmono">{q.cognitionContribution !== undefined ? hepText(q.cognitionContribution) : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Execution contribution</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={q.executionContribution ?? ""} onChange={(e) => patch({ executionContribution: num(e.target.value) })} /> : <div className="posmono">{q.executionContribution !== undefined ? hepText(q.executionContribution) : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Indications treatment</label>
              {editable
                ? <select className="posfield__select" value={q.indicationsTreatment ?? "EVALUATED_PER_SEQUENCE"} onChange={(e) => patch({ indicationsTreatment: e.target.value === "ASSUMED_AVAILABLE" ? "ASSUMED_AVAILABLE" : "EVALUATED_PER_SEQUENCE" })}>
                    <option value="EVALUATED_PER_SEQUENCE">Evaluated per sequence</option>
                    <option value="ASSUMED_AVAILABLE">Assumed available</option>
                  </select>
                : <div>{q.indicationsTreatment ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time available (min)</label>
              {editable ? <input className="posfield__input posmono" type="number" value={q.timeAvailableMinutes ?? ""} onChange={(e) => patch({ timeAvailableMinutes: num(e.target.value) })} /> : <div className="posmono">{q.timeAvailableMinutes ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time available basis</label>
              {editable
                ? <select className="posfield__select" value={q.timeAvailableBasis ?? "REALISTIC_PLANT_SPECIFIC_ANALYSIS"} onChange={(e) => patch({ timeAvailableBasis: e.target.value === "GENERIC_STUDY" ? "GENERIC_STUDY" : "REALISTIC_PLANT_SPECIFIC_ANALYSIS" })}>
                    <option value="REALISTIC_PLANT_SPECIFIC_ANALYSIS">Realistic plant-specific</option>
                    <option value="GENERIC_STUDY">Generic study</option>
                  </select>
                : <div>{q.timeAvailableBasis ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Cue arrival (min)</label>
              {editable ? <input className="posfield__input posmono" type="number" value={q.cueArrivalTimeMinutes ?? ""} onChange={(e) => patch({ cueArrivalTimeMinutes: num(e.target.value) })} /> : <div className="posmono">{q.cueArrivalTimeMinutes ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time required (min)</label>
              {editable ? <input className="posfield__input posmono" type="number" value={q.timeRequiredMinutes ?? ""} onChange={(e) => patch({ timeRequiredMinutes: num(e.target.value) })} /> : <div className="posmono">{q.timeRequiredMinutes ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time required basis</label>
              {editable
                ? <select className="posfield__select" value={q.timeRequiredBasis ?? "ESTIMATED"} onChange={(e) => patch({ timeRequiredBasis: e.target.value === "MEASURED_SIMULATOR" ? "MEASURED_SIMULATOR" : e.target.value === "MEASURED_TALK_THROUGH" ? "MEASURED_TALK_THROUGH" : "ESTIMATED" })}>
                    <option value="ESTIMATED">Estimated</option>
                    <option value="MEASURED_TALK_THROUGH">Measured, talk-through</option>
                    <option value="MEASURED_SIMULATOR">Measured, simulator</option>
                  </select>
                : <div>{q.timeRequiredBasis ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Uncertainty characterization</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={unc.method} onChange={(e) => patch({ uncertaintyCharacterization: { riskSignificant: unc.riskSignificant, method: e.target.value, probabilisticRepresentationProvided: unc.probabilisticRepresentationProvided } })} /> : <div>{unc.method || "—"}</div>}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="essec">Performance shaping factors (HR-G4)</div>
            {psfs.map((p, i) => (
              <div key={i} className="posfield-grid" style={{ marginTop: 8 }}>
                <div className="posfield"><label className="posfield__label">Factor</label>
                  {editable ? <input className="posfield__input" value={p.factor} onChange={(e) => setPsf(i, { factor: e.target.value })} /> : <div>{p.factor}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Impact on HEP</label>
                  {editable
                    ? <select className="posfield__select" value={p.impactOnHep} onChange={(e) => setPsf(i, { impactOnHep: e.target.value === "INCREASE" ? "INCREASE" : e.target.value === "DECREASE" ? "DECREASE" : "NEUTRAL" })}>
                        <option value="INCREASE">Increase</option>
                        <option value="DECREASE">Decrease</option>
                        <option value="NEUTRAL">Neutral</option>
                      </select>
                    : <div>{p.impactOnHep}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Evaluation</label>
                  {editable ? <input className="posfield__input" value={p.evaluation} onChange={(e) => setPsf(i, { evaluation: e.target.value })} /> : <div>{p.evaluation}</div>}
                </div>
                {editable && (
                  <div className="posfield posfield-grid--span2">
                    <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removePsf(i)}><HRIcon.Close /> Remove factor</button>
                  </div>
                )}
              </div>
            ))}
            {editable && (
              <div className="posrow" style={{ marginTop: 8 }}>
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPsf}><HRIcon.Plus /> Add factor</button>
              </div>
            )}
          </div>
          <div className="posfield-grid" style={{ marginTop: 14 }}>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Plant or design-specific factors (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(q.plantSpecificInformationUsed ?? [])} onChange={(e) => patch({ plantSpecificInformationUsed: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(q.plantSpecificInformationUsed ?? []) || "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove quantification</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "jointfloor") {
    const f = hr.jointHepFloor;
    const patch = (fields: Partial<typeof f>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, jointHepFloor: { ...draft.jointHepFloor, ...fields } }));
    };
    const num = (v: string): number => { const n = Number(v); return Number.isNaN(n) ? 0 : n; };
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Joint probability floor · HR-G11</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Minimum joint probability</label>
              {editable ? <input className="posfield__input posmono" type="number" step="any" value={f.minimumJointProbability} onChange={(e) => patch({ minimumJointProbability: num(e.target.value) })} /> : <div className="posmono">{hepText(f.minimumJointProbability)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Justification</label>
              {editable ? <textarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={f.justification} onChange={(e) => patch({ justification: e.target.value })} /> : <div>{f.justification}</div>}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "consistency") {
    const c = (hr.hepConsistencyReviews ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (fields: Partial<typeof c>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, hepConsistencyReviews: (draft.hepConsistencyReviews ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, hepConsistencyReviews: (draft.hepConsistencyReviews ?? []).filter((x) => x.uuid !== c.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Relative reasonableness review · HR-G9 · HR-G10</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Confirmed reasonable</label>
              {editable
                ? <select className="posfield__select" value={c.relativeReasonablenessConfirmed ? "yes" : "no"} onChange={(e) => patch({ relativeReasonablenessConfirmed: e.target.value === "yes" })}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                : <div>{c.relativeReasonablenessConfirmed ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Basis</label>
              {editable
                ? <select className="posfield__select" value={c.basis} onChange={(e) => patch({ basis: e.target.value === "PLANT_HISTORY_PROCEDURES_OPERATIONS" ? "PLANT_HISTORY_PROCEDURES_OPERATIONS" : "SIMILAR_PLANT_AND_SCENARIO_CONTEXT" })}>
                    <option value="SIMILAR_PLANT_AND_SCENARIO_CONTEXT">Similar plant and scenario context</option>
                    <option value="PLANT_HISTORY_PROCEDURES_OPERATIONS">Plant history, procedures, operations</option>
                  </select>
                : <div>{c.basis}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Reviewed events (comma separated ids)</label>
              {editable ? <input className="posfield__input posmono" value={csv(c.hfeIdsReviewed)} onChange={(e) => patch({ hfeIdsReviewed: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(c.hfeIdsReviewed)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Findings</label>
              {editable ? <textarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={c.findings} onChange={(e) => patch({ findings: e.target.value })} /> : <div>{c.findings}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove review</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "efc") {
    const e = (hr.errorForcingContexts ?? []).find((x) => x.uuid === context.id);
    if (e === undefined) return null;
    const patch = (fields: Partial<typeof e>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, errorForcingContexts: (draft.errorForcingContexts ?? []).map((x) => (x.uuid === e.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, errorForcingContexts: (draft.errorForcingContexts ?? []).filter((x) => x.uuid !== e.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Error forcing context · ATHEANA</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Human failure event</label>
              {editable
                ? <select className="posfield__select" value={e.hfeId} onChange={(ev) => patch({ hfeId: ev.target.value })}>
                    {hr.humanFailureEvents.map((h) => <option key={h.uuid} value={h.uuid}>{`${h.uuid} · ${h.name}`}</option>)}
                  </select>
                : <div>{hr.humanFailureEvents.find((h) => h.uuid === e.hfeId)?.name ?? e.hfeId}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Unsafe action</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={e.unsafeAction} onChange={(ev) => patch({ unsafeAction: ev.target.value })} /> : <div>{e.unsafeAction}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Plant conditions (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(e.plantConditions)} onChange={(ev) => patch({ plantConditions: parseCsv(ev.target.value) })} /> : <div>{csv(e.plantConditions)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Performance shaping factors (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(e.performanceShapingFactors)} onChange={(ev) => patch({ performanceShapingFactors: parseCsv(ev.target.value) })} /> : <div>{csv(e.performanceShapingFactors)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Vulnerability</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={e.vulnerability} onChange={(ev) => patch({ vulnerability: ev.target.value })} /> : <div>{e.vulnerability}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Search method</label>
              {editable ? <input className="posfield__input" value={e.searchMethod ?? ""} onChange={(ev) => patch({ searchMethod: ev.target.value.length === 0 ? undefined : ev.target.value })} /> : <div>{e.searchMethod ?? "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove context</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "recovery") {
    const r = (hr.recoveryActions ?? []).find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    const patch = (fields: Partial<typeof r>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, recoveryActions: (draft.recoveryActions ?? []).map((x) => (x.uuid === r.uuid ? { ...x, ...fields } : x)) }));
    };
    const patchFeas = (fields: Partial<typeof r.feasibility>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, recoveryActions: (draft.recoveryActions ?? []).map((x) => (x.uuid === r.uuid ? { ...x, feasibility: { ...x.feasibility, ...fields } } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, recoveryActions: (draft.recoveryActions ?? []).filter((x) => x.uuid !== r.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const postHfes = hr.humanFailureEvents.filter((x) => x.hfeTiming !== "PRE_INITIATOR");
    const bool = (v: boolean, on: (val: boolean) => void) => (editable
      ? <select className="posfield__select" value={v ? "yes" : "no"} onChange={(e) => on(e.target.value === "yes")}><option value="yes">Yes</option><option value="no">No</option></select>
      : <div>{v ? "Yes" : "No"}</div>);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Recovery action · HR-H1 · HR-H2</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <input className="posfield__input" value={r.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{r.name}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Restored function</label>
              {editable ? <input className="posfield__input" value={r.restoredFunction} onChange={(e) => patch({ restoredFunction: e.target.value })} /> : <div>{r.restoredFunction}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Applied at level</label>
              {editable
                ? <select className="posfield__select" value={r.appliedAtLevel} onChange={(e) => patch({ appliedAtLevel: e.target.value === "CUTSET" ? "CUTSET" : e.target.value === "SCENARIO" ? "SCENARIO" : "SEQUENCE" })}>
                    <option value="CUTSET">Cutset</option>
                    <option value="SCENARIO">Scenario</option>
                    <option value="SEQUENCE">Sequence</option>
                  </select>
                : <div>{r.appliedAtLevel}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Recovered event</label>
              {editable
                ? <select className="posfield__select" value={r.hfeId} onChange={(e) => patch({ hfeId: e.target.value })}>
                    {postHfes.map((h) => <option key={h.uuid} value={h.uuid}>{`${h.uuid} · ${h.name}`}</option>)}
                  </select>
                : <div>{hr.humanFailureEvents.find((h) => h.uuid === r.hfeId)?.name ?? r.hfeId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Recovery quantification id</label>
              {editable ? <input className="posfield__input posmono" value={r.hepQuantificationId} onChange={(e) => patch({ hepQuantificationId: e.target.value })} /> : <div className="posmono">{r.hepQuantificationId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Dependence assessment id</label>
              {editable ? <input className="posfield__input posmono" value={r.dependencyAssessmentId ?? ""} onChange={(e) => patch({ dependencyAssessmentId: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div className="posmono">{r.dependencyAssessmentId ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Applied to sequences (comma separated)</label>
              {editable ? <input className="posfield__input posmono" value={csv(r.appliedToSequenceIds ?? [])} onChange={(e) => patch({ appliedToSequenceIds: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(r.appliedToSequenceIds ?? []) || "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Procedure or guidance</label>{bool(r.feasibility.procedureOrGuidanceAvailable, (v) => patchFeas({ procedureOrGuidanceAvailable: v }))}</div>
            <div className="posfield"><label className="posfield__label">Training included</label>{bool(r.feasibility.trainingIncluded, (v) => patchFeas({ trainingIncluded: v }))}</div>
            <div className="posfield"><label className="posfield__label">Cues available</label>{bool(r.feasibility.cuesAvailable, (v) => patchFeas({ cuesAvailable: v }))}</div>
            <div className="posfield"><label className="posfield__label">Manpower available</label>{bool(r.feasibility.manpowerAvailable, (v) => patchFeas({ manpowerAvailable: v }))}</div>
            <div className="posfield"><label className="posfield__label">Time available</label>{bool(r.feasibility.timeAvailable, (v) => patchFeas({ timeAvailable: v }))}</div>
            <div className="posfield"><label className="posfield__label">Accessibility confirmed</label>{bool(r.feasibility.accessibilityConfirmed, (v) => patchFeas({ accessibilityConfirmed: v }))}</div>
            <div className="posfield"><label className="posfield__label">Equipment available</label>{bool(r.feasibility.equipmentAvailable, (v) => patchFeas({ equipmentAvailable: v }))}</div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Omission justification</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.feasibility.omissionJustification ?? ""} onChange={(e) => patchFeas({ omissionJustification: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{r.feasibility.omissionJustification ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Pre-operational feasibility justification (HR-H3)</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.preOperationalFeasibilityJustification ?? ""} onChange={(e) => patch({ preOperationalFeasibilityJustification: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{r.preOperationalFeasibilityJustification ?? "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove recovery</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "uncertsource") {
    const i = Number(context.id);
    const u = hr.modelUncertainty.uncertaintySources[i];
    if (u === undefined) return null;
    const patch = (fields: Partial<typeof u>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, uncertaintySources: draft.modelUncertainty.uncertaintySources.map((x, j) => (j === i ? { ...x, ...fields } : x)) } }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, uncertaintySources: draft.modelUncertainty.uncertaintySources.filter((unused, j) => j !== i) } }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Model uncertainty source · HR-G15</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Source</label>
              {editable ? <input className="posfield__input" value={u.source} onChange={(e) => patch({ source: e.target.value })} /> : <div>{u.source}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Impact</label>
              {editable ? <textarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={u.impact} onChange={(e) => patch({ impact: e.target.value })} /> : <div>{u.impact}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Applicable elements (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(u.applicableElements ?? [])} onChange={(e) => patch({ applicableElements: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(u.applicableElements ?? []) || "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove source</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "relatedassumption") {
    const i = Number(context.id);
    const a = hr.modelUncertainty.relatedAssumptions[i];
    if (a === undefined) return null;
    const patch = (fields: Partial<typeof a>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, relatedAssumptions: draft.modelUncertainty.relatedAssumptions.map((x, j) => (j === i ? { ...x, ...fields } : x)) } }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, relatedAssumptions: draft.modelUncertainty.relatedAssumptions.filter((unused, j) => j !== i) } }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Related assumption · HR-G15</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Assumption</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.assumption} onChange={(e) => patch({ assumption: e.target.value })} /> : <div>{a.assumption}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.basis} onChange={(e) => patch({ basis: e.target.value })} /> : <div>{a.basis}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Applicable elements (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(a.applicableElements ?? [])} onChange={(e) => patch({ applicableElements: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(a.applicableElements ?? []) || "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove assumption</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "reasonablealt") {
    const i = Number(context.id);
    const a = hr.modelUncertainty.reasonableAlternatives[i];
    if (a === undefined) return null;
    const patch = (fields: Partial<typeof a>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, reasonableAlternatives: draft.modelUncertainty.reasonableAlternatives.map((x, j) => (j === i ? { ...x, ...fields } : x)) } }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, reasonableAlternatives: draft.modelUncertainty.reasonableAlternatives.filter((unused, j) => j !== i) } }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Reasonable alternative · HR-G15</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Alternative</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.alternative} onChange={(e) => patch({ alternative: e.target.value })} /> : <div>{a.alternative}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Reason not selected</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.reasonNotSelected} onChange={(e) => patch({ reasonNotSelected: e.target.value })} /> : <div>{a.reasonNotSelected}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Applicable elements (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(a.applicableElements ?? [])} onChange={(e) => patch({ applicableElements: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(a.applicableElements ?? []) || "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove alternative</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "preopassum") {
    const a = (hr.preOperationalAssumptions ?? []).find((x) => x.uuid === context.id);
    if (a === undefined) return null;
    const patch = (fields: Partial<typeof a>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).map((x) => (x.uuid === a.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).filter((x) => x.uuid !== a.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Pre-operational assumption · HR-A10</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Influence on the analysis</label>
              {editable ? <input className="posfield__input" value={a.influenceOnDefinition} onChange={(e) => patch({ influenceOnDefinition: e.target.value })} /> : <div>{a.influenceOnDefinition}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{a.description}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Status</label>
              {editable
                ? <select className="posfield__select" value={a.status} onChange={(e) => patch({ status: e.target.value === "CLOSED" ? "CLOSED" : e.target.value === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN" })}>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                : <div>{a.status}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Risk impact</label>
              {editable
                ? <select className="posfield__select" value={a.riskImpact} onChange={(e) => patch({ riskImpact: e.target.value === "HIGH" ? ImportanceLevel.HIGH : e.target.value === "LOW" ? ImportanceLevel.LOW : ImportanceLevel.MEDIUM })}>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                : <div>{a.riskImpact}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Closure basis</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.closureBasis} onChange={(e) => patch({ closureBasis: e.target.value })} /> : <div>{a.closureBasis}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Planned closure actions (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(a.plannedClosureActions)} onChange={(e) => patch({ plannedClosureActions: parseCsv(e.target.value) })} /> : <div>{csv(a.plannedClosureActions)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Limitations (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(a.limitations)} onChange={(e) => patch({ limitations: parseCsv(e.target.value) })} /> : <div>{csv(a.limitations)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Affected elements (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(a.affectedElementIds)} onChange={(e) => patch({ affectedElementIds: parseCsv(e.target.value) })} /> : <div>{csv(a.affectedElementIds)}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove assumption</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "sensitivity") {
    const s = (hr.sensitivityStudies ?? []).find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    const patch = (fields: Partial<typeof s>): void => {
      if (!editable) return;
      mutateHr((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).map((x) => (x.uuid === s.uuid ? { ...x, ...fields } : x)) }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateHr((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).filter((x) => x.uuid !== s.uuid) }));
    };
    const csv = (xs: string[]): string => xs.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head" style={{ borderBottom: "none", paddingBottom: 4 }}>
          <div><div className="posdrawer__cap">Sensitivity study · HR-G15</div></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body" style={{ paddingTop: 4 }}>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <input className="posfield__input" value={s.name ?? ""} onChange={(e) => patch({ name: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{s.name ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={s.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{s.description}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Varied parameters (comma separated)</label>
              {editable ? <input className="posfield__input" value={csv(s.variedParameters)} onChange={(e) => patch({ variedParameters: parseCsv(e.target.value) })} /> : <div>{csv(s.variedParameters)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Results</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={s.results ?? ""} onChange={(e) => patch({ results: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{s.results ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Insights</label>
              {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={s.insights ?? ""} onChange={(e) => patch({ insights: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{s.insights ?? "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><HRIcon.Close /> Remove study</button>
            </div>
          )}
        </div>
      </>
    );
  }

  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return <div className="poscard"><div className="hrempty"><div className="hrempty__title">{label}</div><p className="hrempty__hint">This step is not part of the current workbook view.</p></div></div>;
}

export { RespIdentifyScreen, RespDefineScreen, RespQuantScreen, RecoveryScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };
