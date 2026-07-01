import { JSX } from "react";
import { DAIcon } from "./daIcons";
import { Badge, DaProvenanceChip, valText, unitText } from "./daShared";
import { useDaWorkbook } from "./daWorkbookContext";
import { MethodChips, LadderPosition, type DaDrawerContext } from "./daScreens";
import { generateDaReport } from "./daDocx";
import {
  PARAM_TYPES,
  ESTIMATION_APPROACH,
  GROUPING_BASIS,
  CCF_MODEL_LABELS,
  CCF_MODEL_METHOD,
  CCF_SOURCE_LABELS,
  DEMAND_BASIS,
  EXPOSURE_BASIS,
  APPLICABILITY_THEME,
  PA_SR,
  SS_SR,
  DA_TOC,
  type Stage,
  type CapabilityCategory,
} from "./daViewData";
import { modelLabel, paramIsWarn, methodIdsForParameter, uncertaintyText, posteriorText, type CcScore } from "./daSelectors";

function groupNameMap(groupings: { uuid: string; name: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groupings) m.set(g.uuid, g.name);
  return m;
}

// ─── 05 — Collect: Counts (HLR-C) ──────────────────────────────────────────
function CountsScreen({ stage }: { stage: Stage }): JSX.Element {
  const { da } = useDaWorkbook();
  const fd = da.failureEventClassifications?.[0];
  const names = groupNameMap(da.componentGroupings ?? []);
  const demand = da.demandCountRecords ?? [];
  const exposure = da.exposureTimeRecords ?? [];
  const tests = da.testCredibilityReviews ?? [];
  return (
    <>
      {fd !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">What counts as a failure</h3>
            <DaProvenanceChip>DA-C5 · DA-C6</DaProvenanceChip>
          </div>
          <p className="poscard__sub">A slow start is a judgment call, so the basis for calling a state a failure is written down before any counting.</p>
          <div className="dafail">
            <div className="dafail__basis"><DAIcon.Clipboard /> {fd.failureDefinitionBasis}</div>
            <div className="dafail__cols">
              <div className="dafail__col">
                <span className="dafail__col-cap dafail__col-cap--yes">Counts as a failure</span>
                {fd.degradedStatesCountedAsFailures.map((x, i) => <span key={i} className="dafail__item dafail__item--yes">{x}</span>)}
              </div>
              <div className="dafail__col">
                <span className="dafail__col-cap dafail__col-cap--no">Does not count</span>
                {fd.degradedStatesNotCounted.map((x, i) => <span key={i} className="dafail__item dafail__item--no">{x}</span>)}
              </div>
            </div>
            {fd.repeatedFailureCountingApplied && (
              <div className="dafail__repeat"><DAIcon.Refresh /> A repeated failure from one repetitive cause counts once, as one failure on one demand.</div>
            )}
          </div>
          {stage === "pre_operational" && (
            <div className="hrnote" style={{ marginTop: 12 }}>
              <DAIcon.Warn />
              <span>The plant is pre-operational, so the definition governs the counting once operating records exist.</span>
            </div>
          )}
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Demand counting</h3>
          <DaProvenanceChip>DA-C7 · DA-C9</DaProvenanceChip>
        </div>
        <p className="poscard__sub">Demands come from surveillance, maintenance and operation, estimated here from the planned schedule.</p>
        <table className="postable" style={{ marginTop: 4 }}>
          <thead><tr><th>Group</th><th>Surveillance</th><th>Maintenance</th><th>Operation</th><th>Total</th><th>Basis</th></tr></thead>
          <tbody>
            {demand.map((d) => (
              <tr key={d.uuid}>
                <td style={{ fontWeight: 600 }}>{names.get(d.componentGroupRef) ?? d.componentGroupRef}</td>
                <td className="posmono">{d.surveillanceTestDemands ?? 0}</td>
                <td className="posmono">{d.maintenanceActDemands ?? 0}</td>
                <td className="posmono">{d.operationalDemands ?? 0}</td>
                <td className="posmono" style={{ fontWeight: 700 }}>{d.totalDemands}</td>
                <td><span className="dabasis dabasis--preop">{DEMAND_BASIS[d.basis] ?? d.basis}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Exposure time</h3>
          <DaProvenanceChip>DA-C10 · DA-C11</DaProvenanceChip>
        </div>
        <p className="poscard__sub">Rate-based parameters need exposure time as the denominator, taken here from the planned test practices.</p>
        <div className="daexpo">
          {exposure.map((e) => (
            <div key={e.uuid} className="daexpo__row">
              <span className="daexpo__name">{names.get(e.componentGroupRef) ?? e.componentGroupRef}</span>
              <span className="daexpo__cell"><span className="daexpo__k">Standby</span><span className="posmono">{(e.standbyHours ?? 0).toLocaleString()} h</span></span>
              <span className="daexpo__cell"><span className="daexpo__k">Run</span><span className="posmono">{(e.operatingHours ?? 0).toLocaleString()} h</span></span>
              <span className="dabasis dabasis--preop">{EXPOSURE_BASIS[e.basis] ?? e.basis}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Test credibility</h3>
          <DaProvenanceChip>DA-C12</DaProvenanceChip>
        </div>
        <p className="poscard__sub">A demand that does not exercise a failure mode is not evidence about it, so each test procedure is reviewed.</p>
        <div className="datest">
          {tests.map((t) => (
            <div key={t.uuid} className="datest__card">
              <div className="datest__head">
                <span className="datest__icon"><DAIcon.Beaker /></span>
                <span className="datest__proc">{t.testProcedureReference}</span>
              </div>
              <div className="datest__modes">
                {t.failureModesExercised.map((m, i) => <span key={`y${i}`} className="datest__mode datest__mode--yes"><DAIcon.Check /> {m}</span>)}
                {t.failureModesNotExercised.map((m, i) => <span key={`n${i}`} className="datest__mode datest__mode--no"><DAIcon.Close /> {m}</span>)}
              </div>
              <p className="datest__decision">{t.demandCreditingDecision}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 06 — Collect: Unavailability (HLR-C) ──────────────────────────────────
function UnavailScreen(): JSX.Element {
  const { da } = useDaWorkbook();
  const unavail = da.unavailabilityDataRecords ?? [];
  const coincident = da.coincidentMaintenanceRecords ?? [];
  const repair = da.repairTimeRecords ?? [];
  const recovery = da.recoveryTimeRecords ?? [];
  const outage = da.lpsdOutageDataRecords ?? [];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Unavailability from maintenance and test</h3>
          <DaProvenanceChip>DA-C13 · DA-C15</DaProvenanceChip>
        </div>
        <p className="poscard__sub">Count only the activities that disable the function, and assign it to the support system when that is the cause.</p>
        <div className="daunavail">
          {unavail.map((u) => (
            <div key={u.uuid} className={`daunavail__card${u.assignedToSupportSystem !== undefined ? " daunavail__card--support" : ""}`}>
              <div className="daunavail__head">
                <span className="daunavail__name">{u.componentOrTrainReference}</span>
                <span className="daunavail__sys posmono">{u.systemReference}</span>
                {u.assignedToSupportSystem !== undefined && <span className="daunavail__assign"><DAIcon.Link /> Assigned to {u.assignedToSupportSystem}</span>}
              </div>
              <div className="daunavail__acts">
                {u.contributingActivities.map((a, i) => (
                  <div key={i} className={`daunavail__act daunavail__act--${a.disablesFunction ? "disables" : "no"}`}>
                    <span className="daunavail__act-dot" />
                    <span className="daunavail__act-name">{a.activity}</span>
                    <span className="daunavail__act-dur posmono">{a.durationHours} h</span>
                    <span className="daunavail__act-flag">{a.disablesFunction ? "Disables" : "Does not disable"}</span>
                  </div>
                ))}
              </div>
              {u.preOperationalAssumptionsBasis !== undefined && <p className="daunavail__note">{u.preOperationalAssumptionsBasis}</p>}
            </div>
          ))}
        </div>
      </div>

      {coincident.length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Coincident maintenance</h3>
            <DaProvenanceChip>DA-C18</DaProvenanceChip>
          </div>
          <p className="poscard__sub">A planned activity that takes two redundant trains down together is evaluated explicitly, not buried.</p>
          {coincident.map((c) => (
            <div key={c.uuid} className="dacoin">
              <div className="dacoin__head">
                <span className="dacoin__icon"><DAIcon.Users /></span>
                <div className="dacoin__main">
                  <div className="dacoin__eq">{c.redundantEquipmentIds.join(" + ")}</div>
                  <div className="dacoin__act">{c.plannedActivityDescription}</div>
                </div>
                <span className="dacoin__val posmono">{valText(c.unavailabilityValue)}<span className="daparam__unit">coincident</span></span>
              </div>
              <div className="dacoin__foot">
                <span className="poschip poschip--primary">{c.scope === "INTRASYSTEM" ? "Within system" : "Across systems"}</span>
                {c.systemsAnalysisSimultaneousEventRef !== undefined && <DaProvenanceChip>{c.systemsAnalysisSimultaneousEventRef} handshake</DaProvenanceChip>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Repair, recovery and outage</h3>
          <DaProvenanceChip>DA-C20 · DA-C24</DaProvenanceChip>
        </div>
        <p className="poscard__sub">Repair time runs from finding the failure to restoration, and the outage data is the raw material behind the POS time fractions.</p>
        <div className="dargo">
          <div className="dargo__group">
            <div className="dargo__group-cap"><DAIcon.Wrench /> Repair</div>
            {repair.map((r) => (
              <div key={r.uuid} className="dargo__row">
                <span className="dargo__name">{r.sscReference}</span>
                <span className="dargo__val posmono">{r.repairEvents[0]?.identificationToRestorationHours ?? 0} h mean</span>
                <span className="poschip">Pre-op assumption</span>
              </div>
            ))}
          </div>
          <div className="dargo__group">
            <div className="dargo__group-cap"><DAIcon.Refresh /> Recovery</div>
            {recovery.map((r) => (
              <div key={r.uuid} className="dargo__row">
                <span className="dargo__name">{r.functionLost}</span>
                <span className="dargo__val posmono">{r.recoveryEvents[0]?.identificationToRestorationHours ?? 0} h mean</span>
                <span className="poschip">Generic</span>
              </div>
            ))}
          </div>
          <div className="dargo__group">
            <div className="dargo__group-cap"><DAIcon.Calendar /> Outage</div>
            {outage.map((o) => (
              <div key={o.uuid} className="dargo__row">
                <span className="dargo__name">{o.outageType} · {o.plantOperatingStateRef}</span>
                <span className="dargo__val posmono">{o.outagesPerCalendarYear}/yr · {o.durationHours} h</span>
                <span className="poschip poschip--primary">{o.plantOperatingStateRef}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── 07 — Estimate Values (HLR-D) ──────────────────────────────────────────
function EstimateScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const withBayes = da.parameters.filter((p) => p.bayesianUpdate?.performed === true && p.bayesianUpdate.posteriorReasonablenessCheck !== undefined);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Estimates on the ladder</h3>
          <DaProvenanceChip>DA-D1 · DA-D3</DaProvenanceChip>
        </div>
        <p className="poscard__sub">The available specific estimate at CC-I, or a realistic combined mean for the risk-significant events at CC-II.</p>
        <div className="daest">
          {da.parameters.map((p) => {
            const rung = (p.estimationApproach !== undefined ? ESTIMATION_APPROACH[p.estimationApproach]?.rung : undefined) ?? "generic";
            return (
              <div key={p.uuid} className={`daest__card daest__card--${rung}${paramIsWarn(p) ? " daest__card--warn" : ""}`} onClick={() => openDrawer({ kind: "estimate", id: p.uuid })}>
                <div className="daest__head">
                  <div className="daest__head-main">
                    <div className="daest__name">{p.name}</div>
                    <div className="daest__be posmono">{p.basicEventRef}</div>
                  </div>
                  <div className="daest__val">
                    <span className="daest__val-num posmono">{valText(p.value)}</span>
                    <span className="daest__val-kind">{p.valueType === "MEAN" ? "mean" : "point"}</span>
                  </div>
                </div>
                <LadderPosition rung={rung} />
                <div className="daest__uncert"><DAIcon.Curve /> {uncertaintyText(p.uncertainty, p.isRiskSignificant ?? false)}</div>
                {p.similarEquipmentAdjustment !== undefined && (
                  <div className="daest__similar"><DAIcon.Scale /> {p.similarEquipmentAdjustment.sourceEquipment}. {p.similarEquipmentAdjustment.adjustments}</div>
                )}
                <div className="daest__foot">
                  <MethodChips ids={methodIdsForParameter(p)} label="Method" />
                  {p.isRiskSignificant === true && <span className="daest__rs">Risk-significant</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Bayesian estimate</h3>
          <DaProvenanceChip>DA-D4 · DA-D5</DaProvenanceChip>
        </div>
        <p className="poscard__sub">When updating produces a parameter, the posterior is checked against the relative weight of the prior and the evidence.</p>
        <div className="dabayes">
          {withBayes.map((p) => {
            const bu = p.bayesianUpdate!;
            const check = bu.posteriorReasonablenessCheck!;
            const plant = check.evidenceStage === "PLANT_SPECIFIC";
            return (
              <div key={p.uuid} className="dabayes__card">
                <div className="dabayes__head">
                  <span className="dabayes__name">{p.name}</span>
                  <span className={`dabayes__stage dabayes__stage--${plant ? "plant" : "tech"}`}>{plant ? "Plant evidence" : "Technology evidence"}</span>
                </div>
                <div className="dabayes__flow">
                  <span className="dabayes__node dabayes__node--prior">{bu.prior?.source ?? "Prior"}</span>
                  <span className="dabayes__arrow"><DAIcon.ArrowR /></span>
                  <span className="dabayes__node dabayes__node--post">{posteriorText(bu)}</span>
                </div>
                <div className={`dabayes__check${check.reasonable ? "" : " dabayes__check--warn"}`}>
                  {check.reasonable ? <DAIcon.Check /> : <DAIcon.Warn />}
                  <span>{check.basis}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <DAIcon.Sparkle />
          <span>This guards a prior so strong it ignores the record, and data so thin the posterior is the prior in disguise.</span>
        </div>
      </div>
    </>
  );
}

// ─── 08 — Common-Cause (HLR-D) ─────────────────────────────────────────────
function CcfScreen(): JSX.Element {
  const { da } = useDaWorkbook();
  const ccfs = da.ccfParameterEstimations ?? [];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Common-cause parameters</h3>
          <DaProvenanceChip>DA-D7 · DA-D8</DaProvenanceChip>
        </div>
        <p className="poscard__sub">A beta-factor or equivalent at CC-I, or a multi-parameter model for risk-significant common-cause events at CC-II.</p>
        <div className="daccf">
          {ccfs.map((c) => {
            const name = c.dataSources?.[0]?.context ?? c.ccfGroupReference;
            const rs = c.isRiskSignificant === true;
            return (
              <div key={c.uuid} className={`daccf__card${rs ? " daccf__card--rs" : ""}`}>
                <div className="daccf__head">
                  <span className="daccf__icon"><DAIcon.Merge /></span>
                  <div className="daccf__head-main">
                    <div className="daccf__name">{name}</div>
                    <div className="daccf__ref posmono">{c.ccfGroupReference}</div>
                  </div>
                  <span className={`daccf__model daccf__model--${c.modelType === "ALPHA_FACTOR" ? "ii" : "i"}`}>{CCF_MODEL_LABELS[c.modelType] ?? c.modelType}</span>
                </div>
                <div className="daccf__params">
                  {Object.entries(c.parameters).map(([k, v]) => (
                    <span key={k} className="daccf__param"><span className="daccf__param-k posmono">{k}</span><span className="daccf__param-v posmono">{v}</span></span>
                  ))}
                </div>
                <div className="daccf__rows">
                  <div className="daccf__r"><DAIcon.Database /> {CCF_SOURCE_LABELS[c.parameterSource] ?? c.parameterSource}</div>
                  <div className="daccf__r"><DAIcon.Link /> {c.componentBoundaryConsistencyBasis}</div>
                  {c.genericExclusionConsistencyConfirmed === true && c.genericExclusionConsistencyBasis !== undefined && (
                    <div className="daccf__r daccf__r--ok"><DAIcon.Check /> {c.genericExclusionConsistencyBasis}</div>
                  )}
                </div>
                <div className="daccf__foot">
                  <MethodChips ids={[CCF_MODEL_METHOD[c.modelType] ?? "beta"]} label="Model" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consistent exclusion</h3>
          <DaProvenanceChip>DA-D9</DaProvenanceChip>
        </div>
        <p className="poscard__sub">An event excluded from the independent database is excluded from the common-cause database too, or the ratio is distorted.</p>
        <div className="hrnote hrnote--ok">
          <DAIcon.Check />
          <span>The exclusions are applied to both databases, since the CCF parameter is the ratio between them.</span>
        </div>
      </div>
    </>
  );
}

// ─── 09 — Uncertainty & Pre-op (closeout) ──────────────────────────────────
function UncertScreen({ stage }: { stage: Stage }): JSX.Element {
  const { da } = useDaWorkbook();
  const register: { type: string; tone: string; item: string; detail: string; srs: string }[] = [
    ...da.modelUncertainty.uncertaintySources.map((u) => ({ type: "Uncertainty", tone: "progress", item: u.source, detail: u.impact, srs: "DA-A5 · E2" })),
    ...(da.preOperationalAssumptions ?? []).map((a) => ({ type: "Pre-op", tone: "warn", item: a.influenceOnDefinition, detail: a.description, srs: PA_SR[a.assumptionId] ?? "DA-A6" })),
    ...(da.sensitivityStudies ?? []).map((s) => ({ type: "Sensitivity", tone: "", item: s.name ?? "Sensitivity study", detail: s.results ?? "", srs: SS_SR[s.uuid] ?? "DA-E2" })),
  ];
  const mods = da.dataModificationAdjustments ?? [];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Applicability across the analysis</h3>
          <span className="possubtle">DA's one discipline, in five places</span>
        </div>
        <p className="poscard__sub">Every block asks the same question, which is whether the number matches where it is used.</p>
        <div className="hrtheme">
          {APPLICABILITY_THEME.map((x) => (
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
          <span className="possubtle">{register.length} items · DA-A5, C9, D5, E2</span>
        </div>
        <p className="poscard__sub">The uncertainty sources, the pre-operational assumptions and the sensitivity studies feed the documentation.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r, i) => (
              <tr key={i}>
                <td><span className={`posbadge${r.tone !== "" ? ` posbadge--${r.tone}` : ""}`}>{r.tone !== "" && <span className="posbadge__dot" />}{r.type}</span></td>
                <td style={{ fontWeight: 600 }}>{r.item}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.srs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Data modification</h3>
          <DaProvenanceChip>DA-D10</DaProvenanceChip>
        </div>
        <p className="poscard__sub">When a plant modification makes past data unrepresentative, the data stops being used as-is.</p>
        {stage === "pre_operational" ? (
          <div className="hrnote">
            <DAIcon.Lock />
            <span>Not applicable while the plant is pre-operational, since there is no past data to modify.</span>
          </div>
        ) : (
          <div className="damod">
            {mods.map((d) => (
              <div key={d.uuid} className="damod__row">
                <span className="damod__name">{d.modificationDescription}</span>
                <span className="poschip poschip--warn">{d.pastDataDisposition}</span>
                <span className="damod__basis">{d.basis}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── 10 — Draft ────────────────────────────────────────────────────────────
function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: { cc: CapabilityCategory; scores: CcScore; stage: Stage; onSubmitDraft: () => void; canSubmit: boolean }): JSX.Element {
  const { da } = useDaWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(da, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${da.name} — DA Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{da.name}</h1>
        <h2>Preliminary Data Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {DA_TOC.map(([tt, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{tt}</span><span>{p}</span></div>
          ))}
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
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable, stage</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 9 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><DAIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateDaReport(da, false); }}><DAIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><DAIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer content ─────────────────────────────────────────────────────────
function DrawerContent({ context, onClose }: { context: DaDrawerContext; onClose: () => void }): JSX.Element | null {
  const { da } = useDaWorkbook();

  if (context.kind === "param" || context.kind === "estimate") {
    const p = da.parameters.find((x) => x.uuid === context.id);
    if (p === undefined) return null;
    const t = PARAM_TYPES[p.parameterType];
    const a = p.estimationApproach !== undefined ? ESTIMATION_APPROACH[p.estimationApproach] : undefined;
    const b = p.componentBoundaryRef !== undefined ? da.componentBoundaries.find((x) => x.uuid === p.componentBoundaryRef) : undefined;
    const bu = p.bayesianUpdate;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">{context.kind === "estimate" ? "Estimate" : "Parameter"} · {a?.label ?? t?.label}</div>
            <h2 className="posdrawer__title">{p.name}</h2>
            <p className="posdrawer__sub">{p.basicEventRef} · {valText(p.value)} {unitText(p.parameterType)}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          {p.description !== undefined && (
            <div>
              <div className="essec">How it is handled</div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{p.description}</p>
            </div>
          )}
          <div>
            <div className="essec">Rung of the ladder</div>
            <LadderPosition rung={a?.rung ?? "generic"} />
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Type</label><div style={{ fontWeight: 700 }}>{t?.label}</div></div>
            <div className="posfield"><label className="posfield__label">Value</label><div className="posmono">{valText(p.value)} {t?.unit}</div></div>
            <div className="posfield"><label className="posfield__label">Value type</label><div>{p.valueType === "MEAN" ? "Mean" : "Point estimate"}</div></div>
            <div className="posfield"><label className="posfield__label">Pedigree</label><div>{a?.label ?? "—"}</div></div>
            <div className="posfield"><label className="posfield__label">Probability model</label><div>{modelLabel(p)}</div></div>
            <div className="posfield"><label className="posfield__label">Operating state</label><div className="posmono">{p.plantOperatingStateRef}</div></div>
          </div>
          <div>
            <div className="essec">Uncertainty</div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text-muted)", margin: 0 }}>{uncertaintyText(p.uncertainty, p.isRiskSignificant ?? false)}</p>
          </div>
          {bu !== undefined && bu.performed && bu.posteriorReasonablenessCheck !== undefined && (
            <div>
              <div className="essec">Bayesian estimate</div>
              <div className="dabayes__flow" style={{ marginTop: 4 }}>
                <span className="dabayes__node dabayes__node--prior">{bu.prior?.source ?? "Prior"}</span>
                <span className="dabayes__arrow"><DAIcon.ArrowR /></span>
                <span className="dabayes__node dabayes__node--post">{posteriorText(bu)}</span>
              </div>
              <div className={`dabayes__check${bu.posteriorReasonablenessCheck.reasonable ? "" : " dabayes__check--warn"}`} style={{ marginTop: 8 }}>
                {bu.posteriorReasonablenessCheck.reasonable ? <DAIcon.Check /> : <DAIcon.Warn />}<span>{bu.posteriorReasonablenessCheck.basis}</span>
              </div>
            </div>
          )}
          {p.similarEquipmentAdjustment !== undefined && (
            <div className="eswarn" style={{ background: "rgba(192,133,46,0.08)", borderColor: "rgba(192,133,46,0.3)" }}>
              <span className="eswarn__icon" style={{ color: "var(--da-similar-ink)" }}><DAIcon.Scale /></span>
              <span>{p.similarEquipmentAdjustment.sourceEquipment}. {p.similarEquipmentAdjustment.justification}</span>
            </div>
          )}
          {b !== undefined && (
            <div>
              <div className="essec">Component boundary</div>
              <div className="daboundary__basis" style={{ marginTop: 4 }}><DAIcon.Link /> {b.name}. {b.boundaryBasis}</div>
            </div>
          )}
          <MethodChips ids={methodIdsForParameter(p)} label="Quantification method" />
        </div>
      </>
    );
  }

  if (context.kind === "boundary") {
    const b = da.componentBoundaries.find((x) => x.uuid === context.id);
    if (b === undefined) return null;
    const consistent = !b.boundaryBasis.toLowerCase().includes("under review");
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Component boundary</div>
            <h2 className="posdrawer__title">{b.name}</h2>
            <p className="posdrawer__sub">{b.systemId} · {b.boundaries[0]}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Boundary basis</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{b.boundaryBasis}</p>
          </div>
          <div className="daboundary__cols">
            <div className="daboundary__col">
              <span className="daboundary__col-cap daboundary__col-cap--in"><DAIcon.Check /> Included</span>
              {b.includedItems.map((x, i) => <span key={i} className="daboundary__item">{x}</span>)}
            </div>
            <div className="daboundary__col">
              <span className="daboundary__col-cap daboundary__col-cap--out"><DAIcon.Close /> Excluded</span>
              {(b.excludedItems ?? []).map((x, i) => <span key={i} className="daboundary__item daboundary__item--out">{x}</span>)}
            </div>
          </div>
          {!consistent && <div className="eswarn"><span className="eswarn__icon"><DAIcon.Warn /></span><span>{b.boundaryBasis}</span></div>}
        </div>
      </>
    );
  }

  if (context.kind === "grouping") {
    const g = (da.componentGroupings ?? []).find((x) => x.uuid === context.id);
    if (g === undefined) return null;
    const basis = GROUPING_BASIS[g.groupingBasis];
    const heldOut = g.excludedOutliers ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Component group · {basis?.label}</div>
            <h2 className="posdrawer__title">{g.name}</h2>
            <p className="posdrawer__sub">{g.systemId} · {basis?.cc}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Grouping basis</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{g.groupingJustification}</p>
          </div>
          <div>
            <div className="essec">Members</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>{g.componentIds.map((m, i) => <span key={i} className="poschip">{m}</span>)}</div>
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Design</label><div>{g.designCharacteristics.join(", ")}</div></div>
            <div className="posfield"><label className="posfield__label">Service</label><div>{g.serviceConditions.join(", ")}</div></div>
            <div className="posfield"><label className="posfield__label">Environment</label><div>{g.environmentalConditions.join(", ")}</div></div>
            <div className="posfield"><label className="posfield__label">Basis</label><div>{basis?.label} · {basis?.cc}</div></div>
          </div>
          {heldOut.length > 0 && (
            <div>
              <div className="essec">Outliers held out</div>
              {heldOut.map((oid) => {
                const o = (da.outlierComponents ?? []).find((x) => x.uuid === oid);
                return o !== undefined ? (
                  <div key={oid} className="eswarn" style={{ background: "rgba(196,77,77,0.06)", borderColor: "rgba(196,77,77,0.25)" }}>
                    <span className="eswarn__icon"><DAIcon.Filter /></span><span>{o.componentId}. {o.alternativeHandling}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return (
    <div className="poscard">
      <div className="hrempty">
        <div className="hrempty__title">{label}</div>
        <p className="hrempty__hint">This step is part of the Data Analysis workflow.</p>
      </div>
    </div>
  );
}

export { CountsScreen, UnavailScreen, EstimateScreen, CcfScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };
