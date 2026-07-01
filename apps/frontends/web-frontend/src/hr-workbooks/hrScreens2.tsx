import { JSX, useState } from "react";
import { HRIcon } from "./hrIcons";
import { Badge, HRProvenanceChip, hepText, type BadgeKind } from "./hrShared";
import {
  CAPABILITY_CATEGORIES,
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
  ERROR_FORCING_CONTEXTS,
  HEP_METHODS,
  REC_METHODS,
  DEP_METHOD,
  REVIEW_METHODS,
  HRA_METHODS,
  DEPENDENCE_THEME,
  HR_TOC,
  type CapabilityCategory,
} from "./hrViewData";
import { type CcScore } from "./hrSelectors";
import { useHrWorkbook } from "./hrWorkbookContext";
import { generateHrReport } from "./hrDocx";
import { MethodChips, NamedIcon, type HrDrawerContext } from "./hrScreens";
import { type HumanReliabilityAnalysis, type HepQuantification } from "interfaces-mef-types/hr/human-reliability-analysis";

const PA_SR: Record<string, string> = { "PA-1": "HR-A10", "PA-2": "HR-E9", "PA-3": "HR-G16", "PA-4": "HR-H6" };

function RespIdentifyScreen(): JSX.Element {
  const { hr } = useHrWorkbook();
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Response identification reviews</h3>
          <span className="possubtle">{hr.responseIdentificationReviews.length} reviews · HR-E1, E3, E4</span>
        </div>
        <p className="poscard__sub">Review the procedures, system information and training to find the actions each sequence needs.</p>
        <div className="hrrev">
          {hr.responseIdentificationReviews.map((r) => {
            const borrow = r.reviewScope === "NONNUCLEAR_FACILITY_EXPERIENCE" || r.reviewScope === "SIMILAR_FACILITY_EXPERIENCE";
            return (
              <div key={r.uuid} className={`hrrev__card${borrow ? " hrrev__card--borrow" : ""}`}>
                <div className="hrrev__head">
                  <span className="hrrev__icon"><HRIcon.Clipboard /></span>
                  <span className="hrrev__scope">{REVIEW_SCOPES[r.reviewScope]}</span>
                  {borrow && <span className="hrrev__borrow-flag"><HRIcon.Sparkle /> Borrowed</span>}
                </div>
                <div className="hrrev__sources">
                  {r.sourcesReviewed.map((s, i) => <span key={i} className="hrrev__source">{s}</span>)}
                </div>
                <p className="hrrev__findings">{r.findings}</p>
                <MethodChips ids={[REVIEW_METHODS[r.uuid]]} label="Identification method" />
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
          <HRProvenanceChip>HR-E5 · HR-E7</HRProvenanceChip>
        </div>
        <p className="poscard__sub">At CC-I the interpretation is reviewed with staff, and at CC-II it is confirmed by talk-through or simulation.</p>
        <div className="hrladder">
          {(hr.responseConfirmations ?? []).map((c, i) => {
            const m = CONFIRM_METHODS[c.method];
            const ccClass = m?.cc === "CC-II" ? "cc-ii" : "cc-i";
            return (
              <div key={c.uuid} className={`hrladder__step hrladder__step--${ccClass}`}>
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
  const { hr } = useHrWorkbook();
  const respHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming !== "PRE_INITIATOR");
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Response human failure events</h3>
          <span className="possubtle">{respHfes.length} defined · HR-F1, F4</span>
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
                  <span className={`hrhfe__timing hrhfe__timing--${t?.tone ?? "teal"}`}><NamedIcon name={t?.icon ?? "Shield"} /> {t?.label ?? h.hfeTiming}</span>
                  <span className="hrhfe__id posmono">{h.uuid}</span>
                  <span className={`hrhfe__resp hrhfe__resp--${aggr ? "aggr" : "do"}`}>{rd !== undefined ? RESPONSE_TYPES[rd.responseType] : "—"}</span>
                </div>
                <div className="hrhfe__name">{h.name}</div>
                {rd?.cueDescription !== undefined && <div className="hrhfe__cue"><HRIcon.Bolt /> {rd.cueDescription}</div>}
                {firstCt?.timeWindowMinutes !== undefined && (
                  <div className="hrhfe__window">
                    <span className="hrhfe__window-k">Time window</span>
                    <span className="hrhfe__window-v posmono">{firstCt.timeWindowMinutes} min</span>
                    <span className="hrhfe__window-basis">{firstCt.basis}</span>
                  </div>
                )}
                <div className="hrhfe__meta">
                  {(rd?.successCriteriaIds ?? []).length > 0 && <span className="hrhfe__sc">{(rd?.successCriteriaIds ?? []).join(", ")}</span>}
                </div>
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
        <p className="poscard__sub">Group the same response across states only where the conditions are comparable.</p>
        <div className="hrnote">
          <HRIcon.Layers />
          <span>The isolation action is grouped at CC-I and kept separate at CC-II unless the conditions match.</span>
        </div>
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
  const { hr } = useHrWorkbook();
  const postHfeIds = new Set(hr.humanFailureEvents.filter((h) => h.hfeTiming === "POST_INITIATOR").map((h) => h.uuid));
  const atHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming === "AT_INITIATOR");
  const postQuants = hr.hepQuantifications.filter((q) => postHfeIds.has(q.hfeId));
  const withinDeps = hr.dependencyAssessments.filter((d) => d.scope === "WITHIN_SEQUENCE");
  function hfeName(id: string): string {
    return hr.humanFailureEvents.find((h) => h.uuid === id)?.name ?? id;
  }
  return (
    <>
      {atHfes.length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">At-initiator analysis</h3>
            <HRProvenanceChip>HR-F1 · supplied to IE</HRProvenanceChip>
          </div>
          <p className="poscard__sub">An operator error that itself causes the initiator is analyzed and quantified here, then supplied to the Initiating Events fault trees.</p>
          <div className="hrhfe">
            {atHfes.map((h) => (
              <div key={h.uuid} className="hrhfe__card hrhfe__card--aggr" onClick={() => openDrawer({ kind: "posthfe", id: h.uuid })}>
                <div className="hrhfe__head">
                  <span className="hrhfe__timing hrhfe__timing--primary"><HRIcon.Bolt /> At-initiator</span>
                  <span className="hrhfe__id posmono">{h.uuid}</span>
                </div>
                <div className="hrhfe__name">{h.name}</div>
                {h.responseDetail?.cueDescription !== undefined && <div className="hrhfe__cue"><HRIcon.Bolt /> {h.responseDetail.cueDescription}</div>}
                <div className="hrhfe__modes"><span className="hrhfe__mode">Approach. {h.description}</span></div>
                <span className="poschip poschip--method"><HRIcon.ArrowR /> Supplied to IE</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Quantification</h3>
          <HRProvenanceChip>HR-G1 · HR-G3</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Each estimate addresses the failure in cognition and the failure to execute, with the timing and performance factors.</p>
        <div className="hrgq">
          {postQuants.map((q) => {
            const value = q.meanHep ?? q.pointEstimateHep;
            const cog = q.cognitionContribution ?? 0;
            const exe = q.executionContribution ?? 0;
            const sum = cog + exe > 0 ? cog + exe : 1;
            const ind = q.indicationsTreatment !== undefined ? INDICATION_TREATMENT[q.indicationsTreatment] : undefined;
            const tb = q.timeRequiredBasis !== undefined ? TIME_BASIS[q.timeRequiredBasis] : "";
            const methods = HEP_METHODS[q.hfeId] ?? {};
            const cogM = methods.cognitionMethod !== undefined ? HRA_METHODS[methods.cognitionMethod] : undefined;
            const exeM = methods.executionMethod !== undefined ? HRA_METHODS[methods.executionMethod] : undefined;
            const measured = (q.timeRequiredBasis ?? "").startsWith("MEASURED");
            return (
              <div key={q.uuid} className={`hrgq__card${q.isRiskSignificant ? " hrgq__card--rs" : ""}`} onClick={() => openDrawer({ kind: "posthfe", id: q.hfeId })}>
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
                    <span className="hrgq__split-k"><HRIcon.Brain /> Cognition {hepText(cog)}{cogM !== undefined && <span className="hrgq__split-method" title={`${cogM.name} · ${cogM.ref}`}>{cogM.abbr}</span>}</span>
                    <span className="hrgq__split-k"><HRIcon.Hand /> Execution {hepText(exe)}{exeM !== undefined && <span className="hrgq__split-method" title={`${exeM.name} · ${exeM.ref}`}>{exeM.abbr}</span>}</span>
                  </div>
                  <div className="hrgq__split-bar">
                    <span className="hrgq__split-cog" style={{ width: `${(cog / sum) * 100}%` }} />
                    <span className="hrgq__split-exe" style={{ width: `${(exe / sum) * 100}%` }} />
                  </div>
                </div>
                <TimeTriplet q={q} />
                <div className="hrgq__foot">
                  {ind !== undefined && <span className={`hrgq__ind hrgq__ind--${(q.indicationsTreatment ?? "").toLowerCase()}`}><HRIcon.Eye /> {ind.label} · {ind.cc}</span>}
                  <span className={`hrgq__tb hrgq__tb--${measured ? "measured" : "estimated"}`}><HRIcon.Stopwatch /> {tb}</span>
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
          <HRProvenanceChip>ATHEANA · qualitative search</HRProvenanceChip>
        </div>
        <p className="poscard__sub">The plant conditions and performance factors that can drive an operator to an unsafe action, found by a qualitative search.</p>
        <div className="hrdeps">
          {ERROR_FORCING_CONTEXTS.map((e) => (
            <div key={e.id} className="hrdep">
              <div className="hrdep__head">
                <span className="hrdep__icon"><HRIcon.Brain /></span>
                <div>
                  <div className="hrdep__title">{hfeName(e.hfeId)}</div>
                  <div className="hrdep__level">{e.id} · unsafe action</div>
                </div>
              </div>
              <div className="hrdep__note" style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <span style={{ color: "var(--hr-red-ink)", flexShrink: 0, display: "inline-flex", width: 14, height: 14, marginTop: 1 }}><HRIcon.Warn /></span>
                {e.unsafeAction}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="hrefc__cap">Plant conditions</div>
                  <div className="hrdep__elements">{e.plantConditions.map((c, i) => <span key={i} className="hrdep__el">{c}</span>)}</div>
                </div>
                <div>
                  <div className="hrefc__cap">Performance factors</div>
                  <div className="hrdep__elements">{e.psfs.map((c, i) => <span key={i} className="hrdep__el">{c}</span>)}</div>
                </div>
              </div>
              <div className="hrdep__note">{e.vulnerability}</div>
              <MethodChips ids={["atheana"]} label="Search method" />
            </div>
          ))}
        </div>
      </div>

      <div className="poscard hrfloor">
        <div className="poscard__head">
          <h3 className="poscard__title">Joint probability floor</h3>
          <HRProvenanceChip>HR-G11</HRProvenanceChip>
        </div>
        <p className="poscard__sub">A minimum joint value prevents an unrealistically low product of single human error probabilities.</p>
        <div className="hrfloor__band">
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
          <HRProvenanceChip>HR-G12 · HR-G13</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Assess the dependence among multiple actions in a sequence and check the joint value against the floor.</p>
        <div className="hrdeps">
          {withinDeps.map((d) => (
            <div key={d.uuid} className={`hrdep${d.belowFloor === true ? " hrdep--floor" : ""}`} onClick={() => openDrawer({ kind: "dependence", id: d.uuid })}>
              <div className="hrdep__head">
                <span className="hrdep__icon"><HRIcon.Merge /></span>
                <div>
                  <div className="hrdep__title">{d.eventSequenceId ?? ""} · {d.hfeIds.join(" + ")}</div>
                  <div className="hrdep__level">Dependence. {DEPENDENCE_LEVELS[d.dependenceLevel]}</div>
                </div>
                <span className="hrdep__joint posmono">{hepText(d.jointHep)}<span className="hrhep__kind">joint</span></span>
              </div>
              <div className="hrdep__elements">
                {d.commonElements.map((e, i) => <span key={i} className="hrdep__el">{e}</span>)}
              </div>
              <MethodChips ids={[DEP_METHOD]} label="Dependence model" />
              {d.belowFloor === true && <div className="hrdep__floor-flag"><HRIcon.Lock /> Held at the floor (HR-G13)</div>}
              {d.includesInitiatorCausingHfe === true && <div className="hrdep__h5"><HRIcon.Warn /> Includes the event that caused the initiator (HR-H5)</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Relative reasonableness</h3>
          <HRProvenanceChip>HR-G9 · HR-G10</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Confirm the human error probabilities are consistent across the scenario set.</p>
        <div className="hrnote hrnote--ok">
          <HRIcon.Check />
          <span>{(hr.hepConsistencyReviews ?? [])[0]?.findings ?? "The human error probabilities are consistent across the scenario set."}</span>
        </div>
      </div>
    </>
  );
}

function RecoveryScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr } = useHrWorkbook();
  return (
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Recovery actions</h3>
        <span className="possubtle">{(hr.recoveryActions ?? []).length} actions · HR-H1, H2</span>
      </div>
      <p className="poscard__sub">Credit a recovery only where its feasibility is demonstrated for the plant or the design.</p>
      <div className="hrrec">
        {(hr.recoveryActions ?? []).map((r) => {
          const feas = r.feasibility;
          const warn = r.preOperationalFeasibilityJustification !== undefined;
          const methods = REC_METHODS[r.uuid] ?? {};
          return (
            <div key={r.uuid} className={`hrrec__card${warn ? " hrrec__card--warn" : ""}`} onClick={() => openDrawer({ kind: "recovery", id: r.uuid })}>
              <div className="hrrec__head">
                <span className="hrrec__icon"><HRIcon.Refresh /></span>
                <div className="hrrec__head-main">
                  <div className="hrrec__name">{r.name}</div>
                  <div className="hrrec__fn">Restores. {r.restoredFunction}</div>
                </div>
                {warn ? <Badge kind="warn">Feasibility open</Badge> : <Badge kind="ok">Feasible</Badge>}
              </div>
              <div className="hrrec__feas">
                {FEASIBILITY_KEYS.map((k) => {
                  const ok = (feas as unknown as Record<string, boolean>)[k.key];
                  return (
                    <span key={k.key} className={`hrrec__feas-cell hrrec__feas-cell--${ok ? "yes" : "no"}`}>
                      {ok ? <HRIcon.Check /> : <HRIcon.Close />} {k.label}
                    </span>
                  );
                })}
              </div>
              <MethodChips ids={[methods.cognitionMethod, methods.executionMethod]} label="Quantification method" />
              {r.preOperationalFeasibilityJustification !== undefined && <div className="hrrec__preop"><HRIcon.Warn /> {r.preOperationalFeasibilityJustification}</div>}
            </div>
          );
        })}
      </div>
      <div className="hrnote" style={{ marginTop: 12 }}>
        <HRIcon.Lock />
        <span>If feasibility cannot be shown, the recovery is left out of the model (HR-H3).</span>
      </div>
    </div>
  );
}

interface RegisterRow {
  id: string;
  type: string;
  tone: BadgeKind | undefined;
  item: string;
  detail: string;
  sr: string;
}

function UncertScreen(): JSX.Element {
  const { hr } = useHrWorkbook();
  const register: RegisterRow[] = [
    ...hr.modelUncertainty.uncertaintySources.map((u, i) => ({ id: `mu-${i}`, type: "Uncertainty", tone: "progress" as BadgeKind, item: u.source, detail: u.impact, sr: "HR-G15" })),
    ...(hr.preOperationalAssumptions ?? []).map((a) => ({ id: a.uuid, type: "Pre-op", tone: "warn" as BadgeKind, item: a.influenceOnDefinition, detail: a.description, sr: PA_SR[a.uuid] ?? "HR-A10" })),
    ...(hr.sensitivityStudies ?? []).map((s) => ({ id: s.uuid, type: "Sensitivity", tone: undefined, item: s.name ?? s.description, detail: s.results ?? "", sr: "HR-G15" })),
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Dependence across the analysis</h3>
          <span className="possubtle">Treated at five points in the analysis</span>
        </div>
        <p className="poscard__sub">Dependence between successive human actions is handled at five points across the analysis.</p>
        <div className="hrtheme">
          {DEPENDENCE_THEME.map((x) => (
            <div key={x.sr} className="hrtheme__cell">
              <span className="hrtheme__sr posmono">{x.sr}</span>
              <span className="hrtheme__t">{x.t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <span className="possubtle">{register.length} items · HR-A9, D9, E8, G15</span>
        </div>
        <p className="poscard__sub">The uncertainty sources cite the identification, quantification and dependence requirements.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r) => (
              <tr key={r.id}>
                <td><Badge kind={r.tone}>{r.type}</Badge></td>
                <td style={{ fontWeight: 600 }}>{r.item}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.sr}</td>
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
  const { hr } = useHrWorkbook();

  if (context.kind === "activity") {
    const a = hr.routineActivities.find((x) => x.uuid === context.id);
    if (a === undefined) return null;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Routine activity · {a.activityType === "CALIBRATION" ? "Calibration" : "Realignment"}</div>
            <h2 className="posdrawer__title">{a.name}</h2>
            <p className="posdrawer__sub">{a.affectedSystems.join(", ")}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div><div className="essec">Description</div><p className="hrdrawer__text">{a.description}</p></div>
          {fieldGrid([["Operating states", a.applicablePlantOperatingStates.join(", ")]])}
          {a.affectsMultipleTrainsOrDiverseSystems && (
            <div className="hrnote">
              <HRIcon.Users />
              <span>Multi-train work practice (HR-A5). {a.multiTrainMechanism} It may not be screened out under HR-B3.</span>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "prehfe") {
    const h = hr.humanFailureEvents.find((x) => x.uuid === context.id);
    if (h === undefined) return null;
    const q = hr.hepQuantifications.find((x) => x.hfeId === h.uuid);
    const detail = h.preInitiatorDetail;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Human failure event · Pre-initiator</div>
            <h2 className="posdrawer__title">{h.name}</h2>
            <p className="posdrawer__sub">{h.uuid} · {IMPACT_LEVELS[h.impactLevel]} level</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div><div className="essec">How it is handled</div><p className="hrdrawer__text">{h.description}</p></div>
          {fieldGrid([
            ["Exposure window", detail?.detectionBasis ?? "—"],
            ["Miscalibration mode", detail?.miscalibrationImpactIncluded === true ? "Yes" : "No"],
            ["Assessment", q?.assessmentType === "DETAILED_ASSESSMENT" ? "Detailed (CC-II)" : "Conservative (CC-I)"],
            ["HEP", hepText(q?.meanHep ?? q?.pointEstimateHep)],
          ])}
          <div>
            <div className="essec">Unavailability modes</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>{(detail?.unavailabilityModes ?? []).map((m, i) => <span key={i} className="poschip">{m}</span>)}</div>
          </div>
          {q?.plantSpecificInformationUsed !== undefined && q.plantSpecificInformationUsed.length > 0 && (
            <div>
              <div className="essec">Plant or design-specific factors (HR-D4)</div>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>{q.plantSpecificInformationUsed.map((f, i) => <span key={i} className="poschip poschip--primary">{f}</span>)}</div>
            </div>
          )}
          <div><div className="essec">Method applied</div><MethodChips ids={[HEP_METHODS[h.uuid]?.method]} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "posthfe") {
    const h = hr.humanFailureEvents.find((x) => x.uuid === context.id);
    if (h === undefined) return null;
    const q = hr.hepQuantifications.find((x) => x.hfeId === h.uuid);
    const t = HFE_TIMING[h.hfeTiming];
    const rd = h.responseDetail;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Human failure event · {t?.label ?? h.hfeTiming}</div>
            <h2 className="posdrawer__title">{h.name}</h2>
            <p className="posdrawer__sub">{h.uuid} · {rd !== undefined ? RESPONSE_TYPES[rd.responseType] : "—"}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div><div className="essec">Cue and context</div><p className="hrdrawer__text">{rd?.cueDescription ?? ""} {h.description}</p></div>
          {rd?.cueTimingBySequence !== undefined && rd.cueTimingBySequence.length > 0 && (
            <div>
              <div className="essec">Cue timing per operating state (HR-F4)</div>
              <table className="postable">
                <thead><tr><th>State</th><th>Cue</th><th>Window</th><th>Basis</th></tr></thead>
                <tbody>
                  {rd.cueTimingBySequence.map((ct, i) => (
                    <tr key={i}>
                      <td className="posmono">{ct.plantOperatingStateId ?? "—"}</td>
                      <td className="posmono">{ct.cueTimeMinutes !== undefined ? `${ct.cueTimeMinutes} min` : "—"}</td>
                      <td className="posmono">{ct.timeWindowMinutes !== undefined ? `${ct.timeWindowMinutes} min` : "—"}</td>
                      <td className="possubtle" style={{ fontSize: 12 }}>{ct.basis ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {q !== undefined && (
            <>
              {fieldGrid([
                ["Cognition (HR-G3)", hepText(q.cognitionContribution)],
                ["Execution (HR-G3)", hepText(q.executionContribution)],
                ["Indications (HR-G5)", q.indicationsTreatment !== undefined ? (INDICATION_TREATMENT[q.indicationsTreatment]?.label ?? "—") : "—"],
                ["Time required (HR-G8)", q.timeRequiredBasis !== undefined ? (TIME_BASIS[q.timeRequiredBasis] ?? "—") : "—"],
              ])}
              <div>
                <div className="essec">Performance shaping factors (HR-G4)</div>
                {(q.performanceShapingFactors ?? []).map((p, i) => (
                  <div key={i} className="hrpsf-row">
                    <span className="hrpsf-row__name">{p.factor}</span>
                    <span className="hrpsf-row__eval">{p.evaluation}</span>
                    <span className={`hrpsf-row__impact hrpsf-row__impact--${p.impactOnHep.toLowerCase()}`}>{PSF_IMPACT[p.impactOnHep]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "dependence") {
    const d = hr.dependencyAssessments.find((x) => x.uuid === context.id);
    if (d === undefined) return null;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Dependence · {d.eventSequenceId ?? d.scope}</div>
            <h2 className="posdrawer__title">{d.hfeIds.join(" + ")}</h2>
            <p className="posdrawer__sub">{DEPENDENCE_LEVELS[d.dependenceLevel]} dependence</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          {fieldGrid([
            ["Joint HEP", hepText(d.jointHep)],
            ["Below the floor", d.belowFloor === true ? "Yes, held at the floor" : "No"],
          ])}
          <div>
            <div className="essec">Common elements</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>{d.commonElements.map((e, i) => <span key={i} className="poschip poschip--primary">{e}</span>)}</div>
          </div>
          {d.includesInitiatorCausingHfe === true && (
            <div className="hrnote"><HRIcon.Warn /><span>Includes the event that caused the initiator, so the recovery is not treated as independent (HR-H5).</span></div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "recovery") {
    const r = (hr.recoveryActions ?? []).find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    const feas = r.feasibility as unknown as Record<string, boolean>;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Recovery action</div>
            <h2 className="posdrawer__title">{r.name}</h2>
            <p className="posdrawer__sub">Restores {r.restoredFunction}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><HRIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Feasibility (HR-H2)</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {FEASIBILITY_KEYS.map((k) => (
                <span key={k.key} className={`hrrec__feas-cell hrrec__feas-cell--${feas[k.key] ? "yes" : "no"}`}>
                  {feas[k.key] ? <HRIcon.Check /> : <HRIcon.Close />} {k.label}
                </span>
              ))}
            </div>
          </div>
          {r.preOperationalFeasibilityJustification !== undefined && (
            <div className="hrnote"><HRIcon.Warn /><span>{r.preOperationalFeasibilityJustification} The pre-operational rule is to justify this or leave the recovery out (HR-H3).</span></div>
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
