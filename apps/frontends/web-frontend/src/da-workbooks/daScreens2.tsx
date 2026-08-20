import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { DAIcon } from "./daIcons";
import { Badge, DaProvenanceChip, valText } from "./daShared";
import { useDaWorkbook } from "./daWorkbookContext";
import { type DataAnalysisParameter, type ComponentBoundary, type ComponentGrouping, type OutlierComponent, type ExternalDataSource, type FailureEventClassification, type DemandCountRecord, type ExposureTimeRecord, type TestCredibilityReview, type UnavailabilityDataRecord, type CoincidentMaintenanceRecord, type RepairTimeRecord, type RecoveryTimeRecord, type LpsdOutageDataRecord, type CcfParameterEstimation, type DataModificationAdjustment } from "interfaces-mef-types/da/data-analysis";
import { MethodChips, type DaDrawerContext } from "./daScreens";
import { generateDaReport } from "./daDocx";
import {
  PARAM_TYPES,
  ESTIMATION_APPROACH,
  GROUPING_BASIS,
  SOURCE_TYPES,
  CCF_MODEL_LABELS,
  CCF_MODEL_METHOD,
  CCF_SOURCE_LABELS,
  DEMAND_BASIS,
  EXPOSURE_BASIS,
  PA_SR,
  SS_SR,
  DA_TOC,
  type Stage,
  type CapabilityCategory,
} from "./daViewData";
import { paramIsWarn, methodIdsForParameter, uncertaintyText, posteriorText, type CcScore } from "./daSelectors";

function groupNameMap(groupings: { uuid: string; name: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groupings) m.set(g.uuid, g.name);
  return m;
}

// ─── 05 — Collect: Counts (HLR-C) ──────────────────────────────────────────
function CountsScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fd = da.failureEventClassifications?.[0];
  function addDemand(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, demandCountRecords: [...(draft.demandCountRecords ?? []), { uuid, componentGroupRef: "", totalDemands: 0, basis: "PREOP_EXPECTED_PERFORMANCE", implementsSrs: [{ sr: "DA-C9", hlr: "C" }] }] }));
    openDrawer({ kind: "demand", id: uuid });
  }
  function addExposure(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, exposureTimeRecords: [...(draft.exposureTimeRecords ?? []), { uuid, componentGroupRef: "", basis: "ESTIMATED_FROM_TEST_PRACTICES", implementsSrs: [{ sr: "DA-C11", hlr: "C" }] }] }));
    openDrawer({ kind: "exposure", id: uuid });
  }
  function addTest(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, testCredibilityReviews: [...(draft.testCredibilityReviews ?? []), { uuid, testProcedureReference: "New test review", failureModesExercised: [], failureModesNotExercised: [], demandCreditingDecision: "", implementsSrs: [{ sr: "DA-C12", hlr: "C" }] }] }));
    openDrawer({ kind: "testcred", id: uuid });
  }
  const names = groupNameMap(da.componentGroupings ?? []);
  const demand = da.demandCountRecords ?? [];
  const exposure = da.exposureTimeRecords ?? [];
  const tests = da.testCredibilityReviews ?? [];
  return (
    <>
      {fd !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title="What counts as a failure" level={3} />
            <DaProvenanceChip>DA-C5 · DA-C6</DaProvenanceChip>
          </div>
          <div className="dafail" onClick={() => openDrawer({ kind: "failuredef", id: fd.uuid })}>
            <table className="postable postable--mid" style={{ marginTop: 4 }}>
              <thead><tr><th>Degraded state</th><th>Treatment</th></tr></thead>
              <tbody>
                {fd.degradedStatesCountedAsFailures.map((x, i) => (
                  <tr key={`y${i}`}><td><div className="postable__name">{x}</div></td><td>Counted as a failure</td></tr>
                ))}
                {fd.degradedStatesNotCounted.map((x, i) => (
                  <tr key={`n${i}`}><td><div className="postable__name">{x}</div></td><td className="possubtle">Not counted</td></tr>
                ))}
                {fd.repeatedFailureCountingApplied && (
                  <tr><td><div className="postable__name">Repeated failures from one repetitive cause</div></td><td>Counted once, as one failure on one demand</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="DA" title="Demand counting" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-C7 · DA-C9</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDemand}><DAIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">Demands come from surveillance, maintenance and operation, estimated here from the planned schedule.</p>
        <table className="postable" style={{ marginTop: 4 }}>
          <thead><tr><th>Group</th><th>Surveillance</th><th>Maintenance</th><th>Operation</th><th>Total</th><th>Basis</th></tr></thead>
          <tbody>
            {demand.map((d) => (
              <tr key={d.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "demand", id: d.uuid })} style={{ cursor: "pointer" }}>
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
          <WorkbookSectionHeading workbook="DA" title="Exposure time" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-C10 · DA-C11</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addExposure}><DAIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">Rate-based parameters need exposure time as the denominator, taken here from the planned test practices.</p>
        <table className="postable postable--mid" style={{ marginTop: 4 }}>
          <thead><tr><th>Group</th><th>Standby (h)</th><th>Operating (h)</th><th>Basis</th></tr></thead>
          <tbody>
            {exposure.map((e) => (
              <tr key={e.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "exposure", id: e.uuid })} style={{ cursor: "pointer" }}>
                <td><div className="postable__name">{names.get(e.componentGroupRef) ?? e.componentGroupRef}</div></td>
                <td className="posmono">{(e.standbyHours ?? 0).toLocaleString()}</td>
                <td className="posmono">{(e.operatingHours ?? 0).toLocaleString()}</td>
                <td><span className="dabasis dabasis--preop">{EXPOSURE_BASIS[e.basis] ?? e.basis}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="DA" title="Test credibility" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-C12</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addTest}><DAIcon.Plus /> Add review</button>}
          </div>
        </div>
        <p className="poscard__sub">A demand that does not exercise a failure mode is not evidence about it, so each test procedure is reviewed.</p>
        <table className="postable postable--mid" style={{ marginTop: 4 }}>
          <thead><tr><th>Test procedure</th><th>Exercised</th><th>Not exercised</th><th>Crediting decision</th></tr></thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "testcred", id: t.uuid })} style={{ cursor: "pointer" }}>
                <td><div className="postable__name">{t.testProcedureReference}</div></td>
                <td>{t.failureModesExercised.map((m, i) => <div key={i} style={{ fontSize: 12 }}>{m}</div>)}</td>
                <td className="possubtle">{t.failureModesNotExercised.map((m, i) => <div key={i} style={{ fontSize: 12 }}>{m}</div>)}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{t.demandCreditingDecision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── 06 — Collect: Unavailability (HLR-C) ──────────────────────────────────
function UnavailScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const unavail = da.unavailabilityDataRecords ?? [];
  function addUnavail(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, unavailabilityDataRecords: [...(draft.unavailabilityDataRecords ?? []), { uuid, componentOrTrainReference: "New record", contributingActivities: [], implementsSrs: [{ sr: "DA-C13", hlr: "C" }] }] }));
    openDrawer({ kind: "unavail", id: uuid });
  }
  function addCoincident(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, coincidentMaintenanceRecords: [...(draft.coincidentMaintenanceRecords ?? []), { uuid, redundantEquipmentIds: [], scope: "INTRASYSTEM", plannedActivityDescription: "", basis: "PREOP_ASSUMPTION", implementsSrs: [{ sr: "DA-C18", hlr: "C" }] }] }));
    openDrawer({ kind: "coincident", id: uuid });
  }
  function addRepair(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, repairTimeRecords: [...(draft.repairTimeRecords ?? []), { uuid, sscReference: "New repair record", repairEvents: [{ identificationToRestorationHours: 0 }], implementsSrs: [{ sr: "DA-C20", hlr: "C" }] }] }));
    openDrawer({ kind: "repair", id: uuid });
  }
  function addRecovery(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, recoveryTimeRecords: [...(draft.recoveryTimeRecords ?? []), { uuid, functionLost: "New recovery record", recoveryEvents: [{ identificationToRestorationHours: 0 }], implementsSrs: [{ sr: "DA-C22", hlr: "C" }] }] }));
    openDrawer({ kind: "recovery", id: uuid });
  }
  function addOutage(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, lpsdOutageDataRecords: [...(draft.lpsdOutageDataRecords ?? []), { uuid, outageType: "New outage", implementsSrs: [{ sr: "DA-C24", hlr: "C" }] }] }));
    openDrawer({ kind: "outage", id: uuid });
  }
  const coincident = da.coincidentMaintenanceRecords ?? [];
  const repair = da.repairTimeRecords ?? [];
  const recovery = da.recoveryTimeRecords ?? [];
  const outage = da.lpsdOutageDataRecords ?? [];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="DA" title="Unavailability from maintenance and test" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-C13 · DA-C15</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addUnavail}><DAIcon.Plus /> Add record</button>}
          </div>
        </div>
        <p className="poscard__sub">Count only the activities that disable the function, and assign it to the support system when that is the cause.</p>
        <div className="daunavail">
          {unavail.map((u) => (
            <div key={u.uuid} className={`daunavail__card${u.assignedToSupportSystem !== undefined ? " daunavail__card--support" : ""}`} onClick={() => openDrawer({ kind: "unavail", id: u.uuid })}>
              <div className="daunavail__head">
                <span className="daunavail__name">{u.componentOrTrainReference}</span>
                <span className="daunavail__sys posmono">{u.systemReference}</span>
                {u.assignedToSupportSystem !== undefined && <span className="daunavail__assign">Assigned to {u.assignedToSupportSystem}</span>}
              </div>
              <div className="daunavail__acts">
                {u.contributingActivities.map((a, i) => (
                  <div key={i} className={`daunavail__act daunavail__act--${a.disablesFunction ? "disables" : "no"}`}>
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
            <WorkbookSectionHeading workbook="DA" title="Coincident maintenance" level={3} />
            <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
              <DaProvenanceChip>DA-C18</DaProvenanceChip>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCoincident}><DAIcon.Plus /> Add record</button>}
            </div>
          </div>
          <p className="poscard__sub">A planned activity that takes two redundant trains down together is evaluated explicitly, not buried.</p>
          {coincident.map((c) => (
            <div key={c.uuid} className="dacoin" onClick={() => openDrawer({ kind: "coincident", id: c.uuid })}>
              <div className="dacoin__head">
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
          <WorkbookSectionHeading workbook="DA" title="Repair, recovery and outage" level={3} />
          <DaProvenanceChip>DA-C20 · DA-C24</DaProvenanceChip>
        </div>
        <p className="poscard__sub">Repair time runs from finding the failure to restoration, and the outage data is the raw material behind the POS time fractions.</p>
        <div className="dargo">
          <div className="dargo__group">
            <div className="dargo__group-cap"><span>Repair</span>{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addRepair}><DAIcon.Plus /> Add</button>}</div>
            {repair.map((r) => (
              <div key={r.uuid} className="dargo__row" onClick={() => openDrawer({ kind: "repair", id: r.uuid })}>
                <span className="dargo__name">{r.sscReference}</span>
                <span className="dargo__val posmono">{r.repairEvents[0]?.identificationToRestorationHours ?? 0} h mean</span>
              </div>
            ))}
          </div>
          <div className="dargo__group">
            <div className="dargo__group-cap"><span>Recovery</span>{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addRecovery}><DAIcon.Plus /> Add</button>}</div>
            {recovery.map((r) => (
              <div key={r.uuid} className="dargo__row" onClick={() => openDrawer({ kind: "recovery", id: r.uuid })}>
                <span className="dargo__name">{r.functionLost}</span>
                <span className="dargo__val posmono">{r.recoveryEvents[0]?.identificationToRestorationHours ?? 0} h mean</span>
              </div>
            ))}
          </div>
          <div className="dargo__group">
            <div className="dargo__group-cap"><span>Outage</span>{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addOutage}><DAIcon.Plus /> Add</button>}</div>
            {outage.map((o) => (
              <div key={o.uuid} className="dargo__row" onClick={() => openDrawer({ kind: "outage", id: o.uuid })}>
                <span className="dargo__name">{o.outageType} · {o.plantOperatingStateRef}</span>
                <span className="dargo__val posmono">{o.outagesPerCalendarYear}/yr · {o.durationHours} h</span>
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
          <WorkbookSectionHeading workbook="DA" title="Estimates on the ladder" level={3} />
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
                <div className="daest__uncert">{uncertaintyText(p.uncertainty, p.isRiskSignificant ?? false)}</div>
                {p.similarEquipmentAdjustment !== undefined && (
                  <div className="daest__similar">{p.similarEquipmentAdjustment.sourceEquipment}. {p.similarEquipmentAdjustment.adjustments}</div>
                )}
                <div className="daest__foot">
                  <span className="daest__rung">{(p.estimationApproach !== undefined ? ESTIMATION_APPROACH[p.estimationApproach]?.label : undefined) ?? "Generic"}</span>
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
          <WorkbookSectionHeading workbook="DA" title="Bayesian estimate" level={3} />
          <DaProvenanceChip>DA-D4 · DA-D5</DaProvenanceChip>
        </div>
        <p className="poscard__sub">When updating produces a parameter, the posterior is checked against the relative weight of the prior and the evidence.</p>
        <div className="dabayes">
          {withBayes.map((p) => {
            const bu = p.bayesianUpdate!;
            const check = bu.posteriorReasonablenessCheck!;
            const plant = check.evidenceStage === "PLANT_SPECIFIC";
            return (
              <div key={p.uuid} className="dabayes__card" onClick={() => openDrawer({ kind: "estimate", id: p.uuid })}>
                <div className="dabayes__head">
                  <span className="dabayes__name">{p.name}</span>
                  <span className={`dabayes__stage dabayes__stage--${plant ? "plant" : "tech"}`}>{plant ? "Plant evidence" : "Technology evidence"}</span>
                </div>
                <div className="dabayes__flow">
                  <span className="dabayes__node dabayes__node--prior">{bu.prior?.source ?? "Prior"}</span>
                  <span className="dabayes__arrow">→</span>
                  <span className="dabayes__node dabayes__node--post">{posteriorText(bu)}</span>
                </div>
                <div className={`dabayes__check${check.reasonable ? "" : " dabayes__check--warn"}`}>
                  <span>{check.basis}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── 08 — Common-Cause (HLR-D) ─────────────────────────────────────────────
function CcfScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const ccfs = da.ccfParameterEstimations ?? [];
  function addCcf(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, ccfParameterEstimations: [...(draft.ccfParameterEstimations ?? []), { uuid, ccfGroupReference: "New group", modelType: "BETA_FACTOR", parameters: {}, parameterSource: "GENERIC", componentBoundaryConsistencyBasis: "", implementsSrs: [{ sr: "DA-D7", hlr: "D" }] }] }));
    openDrawer({ kind: "ccf", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="DA" title="Common-cause parameters" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-D7 · DA-D8</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCcf}><DAIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">A beta-factor or equivalent at CC-I, or a multi-parameter model for risk-significant common-cause events at CC-II.</p>
        <div className="daccf">
          {ccfs.map((c) => {
            const name = c.dataSources?.[0]?.context ?? c.ccfGroupReference;
            const rs = c.isRiskSignificant === true;
            return (
              <div key={c.uuid} className={`daccf__card${rs ? " daccf__card--rs" : ""}`} onClick={() => openDrawer({ kind: "ccf", id: c.uuid })}>
                <div className="daccf__head">
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
                  <div className="daccf__r">{CCF_SOURCE_LABELS[c.parameterSource] ?? c.parameterSource}</div>
                  <div className="daccf__r">{c.componentBoundaryConsistencyBasis}</div>
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
          <WorkbookSectionHeading workbook="DA" title="Consistent exclusion" level={3} />
          <DaProvenanceChip>DA-D9</DaProvenanceChip>
        </div>
        <p className="poscard__sub">An event excluded from the independent database is excluded from the common-cause database too, or the ratio is distorted.</p>
        <table className="postable postable--mid" style={{ marginTop: 4 }}>
          <thead><tr><th>Group</th><th>Applied consistently</th><th>Basis</th></tr></thead>
          <tbody>
            {ccfs.map((c) => (
              <tr key={c.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "ccf", id: c.uuid })} style={{ cursor: "pointer" }}>
                <td><div className="postable__name">{c.ccfGroupReference}</div></td>
                <td>{c.genericExclusionConsistencyConfirmed === true ? "Yes" : "Open"}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{c.genericExclusionConsistencyBasis ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── 09 — Uncertainty & Pre-op (closeout) ──────────────────────────────────
function UncertScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const register: { key: string; kind: "uncsource" | "preop" | "sens"; id: string; type: string; tone: string; item: string; detail: string; srs: string }[] = [
    ...da.modelUncertainty.uncertaintySources.map((u, i) => ({ key: `u${String(i)}`, kind: "uncsource" as const, id: String(i), type: "Uncertainty", tone: "progress", item: u.source, detail: u.impact, srs: "DA-A5 · E2" })),
    ...(da.preOperationalAssumptions ?? []).map((a) => ({ key: a.uuid, kind: "preop" as const, id: a.uuid, type: "Pre-op", tone: "warn", item: a.influenceOnDefinition, detail: a.description, srs: PA_SR[a.assumptionId] ?? "DA-A6" })),
    ...(da.sensitivityStudies ?? []).map((s) => ({ key: s.uuid, kind: "sens" as const, id: s.uuid, type: "Sensitivity", tone: "", item: s.name ?? "Sensitivity study", detail: s.results ?? "", srs: SS_SR[s.uuid] ?? "DA-E2" })),
  ];
  const mods = da.dataModificationAdjustments ?? [];
  function addDatamod(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, dataModificationAdjustments: [...(draft.dataModificationAdjustments ?? []), { uuid, modificationDescription: "New modification", affectedParameterIds: [], pastDataDisposition: "RETAINED_WITH_JUSTIFICATION", basis: "", implementsSrs: [{ sr: "DA-D10", hlr: "D" }] }] }));
    openDrawer({ kind: "datamod", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="DA" title="Open items register" level={3} />
          <span className="possubtle">DA-A5, C9, D5, E2</span>
        </div>
        <p className="poscard__sub">The uncertainty sources, the pre-operational assumptions and the sensitivity studies feed the documentation.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r) => (
              <tr key={r.key} className="postable__row--clickable" onClick={() => openDrawer({ kind: r.kind, id: r.id })} style={{ cursor: "pointer" }}>
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
          <WorkbookSectionHeading workbook="DA" title="Data modification" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-D10</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDatamod}><DAIcon.Plus /> Add record</button>}
          </div>
        </div>
        <p className="poscard__sub">When a plant modification makes past data unrepresentative, the data stops being used as-is.</p>
        <table className="postable postable--mid" style={{ marginTop: 4 }}>
          <thead><tr><th>Modification</th><th>Disposition</th><th>Affected parameters</th><th>Basis</th></tr></thead>
          <tbody>
            {mods.map((d) => (
              <tr key={d.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "datamod", id: d.uuid })} style={{ cursor: "pointer" }}>
                <td><div className="postable__name">{d.modificationDescription}</div></td>
                <td><span className="daoutlier__status">{d.pastDataDisposition === "ADJUSTED" ? "Adjusted" : d.pastDataDisposition === "DISCARDED" ? "Discarded" : "Retained with justification"}</span></td>
                <td>{d.affectedParameterIds.map((pid) => <div key={pid} className="posmono" style={{ fontSize: 11.5 }}>{pid}</div>)}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{d.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <WorkbookSectionHeading workbook="DA" title="Conformance check" level={3} className="posgen__readout-h" />
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable, stage</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="DA" title="Hand-off to internal review" level={3} className="posgen__readout-h" />
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

function ListEditor({ label, items, disabled, onApply }: { label: string; items: string[]; disabled: boolean; onApply: (next: string[]) => void }): JSX.Element {
  return (
    <div>
      <WorkbookCueLabel workbook="DA" title={label} cueKey="Structured analysis subsection" className="essec" />
      {items.map((x, i) => (
        <div key={i} className="posrow" style={{ gap: 6, marginBottom: 6 }}>
          <WorkbookInput className="posfield__input" value={x} disabled={disabled} onChange={(e) => onApply(items.map((y, j) => (j === i ? e.target.value : y)))} />
          {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onApply(items.filter((_, j) => j !== i))}><DAIcon.Close /></button>}
        </div>
      ))}
      {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onApply([...items, ""])}><DAIcon.Plus /> Add item</button>}
    </div>
  );
}

// ─── Drawer content ─────────────────────────────────────────────────────────
function DrawerContent({ context, onClose }: { context: DaDrawerContext; onClose: () => void }): JSX.Element | null {
  const { da, links, editable, mutateDa } = useDaWorkbook();

  if (context.kind === "param" || context.kind === "estimate") {
    const p = da.parameters.find((x) => x.uuid === context.id);
    if (p === undefined) return null;
    const patchParam = (patch: Partial<DataAnalysisParameter>): void => {
      mutateDa((draft) => ({ ...draft, parameters: draft.parameters.map((x) => (x.uuid === p.uuid ? { ...x, ...patch } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">{context.kind === "estimate" ? "Estimate" : "Parameter"} · {p.uuid}</div>
            <h2 className="posdrawer__title">{p.name}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={p.name} disabled={!editable} onChange={(e) => patchParam({ name: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Description</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={p.description ?? ""} disabled={!editable} onChange={(e) => patchParam({ description: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Type</label><select className="posfield__select" value={p.parameterType} disabled={!editable} onChange={(e) => patchParam({ parameterType: e.target.value as DataAnalysisParameter["parameterType"] })}>{Object.entries(PARAM_TYPES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Value</label><WorkbookInput className="posfield__input" type="number" step="any" value={p.value} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchParam({ value: v }); }} /></div>
            <div className="posfield"><label className="posfield__label">Value type</label><select className="posfield__select" value={p.valueType} disabled={!editable} onChange={(e) => patchParam({ valueType: e.target.value as DataAnalysisParameter["valueType"] })}><option value="MEAN">Mean</option><option value="POINT_ESTIMATE">Point estimate</option></select></div>
            <div className="posfield"><label className="posfield__label">Pedigree</label><select className="posfield__select" value={p.estimationApproach ?? ""} disabled={!editable} onChange={(e) => patchParam({ estimationApproach: e.target.value === "" ? undefined : (e.target.value as DataAnalysisParameter["estimationApproach"]) })}><option value="">—</option>{Object.entries(ESTIMATION_APPROACH).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Risk significance</label><select className="posfield__select" value={p.isRiskSignificant === true ? "yes" : "no"} disabled={!editable} onChange={(e) => patchParam({ isRiskSignificant: e.target.value === "yes" })}><option value="no">Not risk-significant</option><option value="yes">Risk-significant</option></select></div>
            <div className="posfield"><label className="posfield__label">Operating state</label>{(links?.posStates ?? []).length > 0 ? <select className="posfield__select" value={p.plantOperatingStateRef ?? ""} disabled={!editable} onChange={(e) => patchParam({ plantOperatingStateRef: e.target.value === "" ? undefined : e.target.value })}><option value="">—</option>{(links?.posStates ?? []).map((st) => <option key={st.id} value={st.id}>{st.id} · {st.name}</option>)}</select> : <WorkbookInput className="posfield__input posmono" value={p.plantOperatingStateRef ?? ""} disabled={!editable} onChange={(e) => patchParam({ plantOperatingStateRef: e.target.value === "" ? undefined : e.target.value })} />}</div>
            <div className="posfield"><label className="posfield__label">Basic event</label><WorkbookInput className="posfield__input posmono" value={p.basicEventRef ?? ""} disabled={!editable} onChange={(e) => patchParam({ basicEventRef: e.target.value === "" ? undefined : e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">System</label><WorkbookInput className="posfield__input posmono" value={p.systemReference ?? ""} disabled={!editable} onChange={(e) => patchParam({ systemReference: e.target.value === "" ? undefined : e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Component boundary</label><select className="posfield__select" value={p.componentBoundaryRef ?? ""} disabled={!editable} onChange={(e) => patchParam({ componentBoundaryRef: e.target.value === "" ? undefined : e.target.value })}><option value="">—</option>{da.componentBoundaries.map((cb) => <option key={cb.uuid} value={cb.uuid}>{cb.name}</option>)}</select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Model selection basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.modelSelectionBasis ?? ""} disabled={!editable} onChange={(e) => patchParam({ modelSelectionBasis: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Required data</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.requiredData ?? ""} disabled={!editable} onChange={(e) => patchParam({ requiredData: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Multi-state applicability</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.multiPosApplicabilityJustification ?? ""} disabled={!editable} onChange={(e) => patchParam({ multiPosApplicabilityJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "boundary") {
    const b = da.componentBoundaries.find((x) => x.uuid === context.id);
    if (b === undefined) return null;
    const patchBoundary = (patch: Partial<ComponentBoundary>): void => {
      mutateDa((draft) => ({ ...draft, componentBoundaries: draft.componentBoundaries.map((x) => (x.uuid === b.uuid ? { ...x, ...patch } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Component boundary · {b.uuid}</div>
            <h2 className="posdrawer__title">{b.name}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={b.name} disabled={!editable} onChange={(e) => patchBoundary({ name: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">System</label><WorkbookInput className="posfield__input posmono" value={b.systemId} disabled={!editable} onChange={(e) => patchBoundary({ systemId: e.target.value })} /></div>
          </div>
          <div className="posfield"><label className="posfield__label">Description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={b.description} disabled={!editable} onChange={(e) => patchBoundary({ description: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Boundary scope</label><WorkbookInput className="posfield__input" value={b.boundaries[0] ?? ""} disabled={!editable} onChange={(e) => patchBoundary({ boundaries: [e.target.value, ...b.boundaries.slice(1)] })} /></div>
          <div className="posfield"><label className="posfield__label">Boundary basis</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={b.boundaryBasis} disabled={!editable} onChange={(e) => patchBoundary({ boundaryBasis: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="DA" title="Included items" className="essec" />
            {b.includedItems.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 6, marginBottom: 6 }}>
                <WorkbookInput className="posfield__input" value={x} disabled={!editable} onChange={(e) => patchBoundary({ includedItems: b.includedItems.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBoundary({ includedItems: b.includedItems.filter((_, j) => j !== i) })}><DAIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBoundary({ includedItems: [...b.includedItems, ""] })}><DAIcon.Plus /> Add item</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="DA" title="Excluded items" className="essec" />
            {(b.excludedItems ?? []).map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 6, marginBottom: 6 }}>
                <WorkbookInput className="posfield__input" value={x} disabled={!editable} onChange={(e) => patchBoundary({ excludedItems: (b.excludedItems ?? []).map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBoundary({ excludedItems: (b.excludedItems ?? []).filter((_, j) => j !== i) })}><DAIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBoundary({ excludedItems: [...(b.excludedItems ?? []), ""] })}><DAIcon.Plus /> Add item</button>}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "grouping") {
    const g = (da.componentGroupings ?? []).find((x) => x.uuid === context.id);
    if (g === undefined) return null;
    const patchGrouping = (patch: Partial<ComponentGrouping>): void => {
      mutateDa((draft) => ({ ...draft, componentGroupings: (draft.componentGroupings ?? []).map((x) => (x.uuid === g.uuid ? { ...x, ...patch } : x)) }));
    };
    const listEditor = (label: string, items: string[], apply: (next: string[]) => void): JSX.Element => (
      <div>
        <WorkbookCueLabel workbook="DA" title={label} cueKey="Structured analysis subsection" className="essec" />
        {items.map((x, i) => (
          <div key={i} className="posrow" style={{ gap: 6, marginBottom: 6 }}>
            <WorkbookInput className="posfield__input" value={x} disabled={!editable} onChange={(e) => apply(items.map((y, j) => (j === i ? e.target.value : y)))} />
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => apply(items.filter((_, j) => j !== i))}><DAIcon.Close /></button>}
          </div>
        ))}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => apply([...items, ""])}><DAIcon.Plus /> Add item</button>}
      </div>
    );
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Component group · {g.uuid}</div>
            <h2 className="posdrawer__title">{g.name}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={g.name} disabled={!editable} onChange={(e) => patchGrouping({ name: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">System</label><WorkbookInput className="posfield__input posmono" value={g.systemId} disabled={!editable} onChange={(e) => patchGrouping({ systemId: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Grouping basis</label><select className="posfield__select" value={g.groupingBasis} disabled={!editable} onChange={(e) => patchGrouping({ groupingBasis: e.target.value as ComponentGrouping["groupingBasis"] })}>{Object.entries(GROUPING_BASIS).map(([id, x]) => <option key={id} value={id}>{x.label} ({x.cc})</option>)}</select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Grouping justification</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={g.groupingJustification} disabled={!editable} onChange={(e) => patchGrouping({ groupingJustification: e.target.value })} /></div>
          {listEditor("Members", g.componentIds, (next) => patchGrouping({ componentIds: next }))}
          {listEditor("Design characteristics", g.designCharacteristics, (next) => patchGrouping({ designCharacteristics: next }))}
          {listEditor("Service conditions", g.serviceConditions, (next) => patchGrouping({ serviceConditions: next }))}
          {listEditor("Environmental conditions", g.environmentalConditions, (next) => patchGrouping({ environmentalConditions: next }))}
          <div>
            <WorkbookCueLabel workbook="DA" title="Outliers held out" className="essec" />
            {(g.excludedOutliers ?? []).map((oid, i) => {
              const o = (da.outlierComponents ?? []).find((x) => x.uuid === oid);
              return (
                <div key={oid} className="posrow" style={{ gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <span className="poschip posmono" style={{ flex: 1 }}>{o !== undefined ? o.componentId : oid}</span>
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchGrouping({ excludedOutliers: (g.excludedOutliers ?? []).filter((_, j) => j !== i) })}><DAIcon.Close /></button>}
                </div>
              );
            })}
            {editable && (
              <select className="posfield__select" value="" onChange={(e) => { if (e.target.value !== "") patchGrouping({ excludedOutliers: [...(g.excludedOutliers ?? []), e.target.value] }); }}>
                <option value="">Add an outlier…</option>
                {(da.outlierComponents ?? []).filter((o) => !(g.excludedOutliers ?? []).includes(o.uuid)).map((o) => <option key={o.uuid} value={o.uuid}>{o.componentId}</option>)}
              </select>
            )}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "outlier") {
    const o = (da.outlierComponents ?? []).find((x) => x.uuid === context.id);
    if (o === undefined) return null;
    const patchOutlier = (patch: Partial<OutlierComponent>): void => {
      mutateDa((draft) => ({ ...draft, outlierComponents: (draft.outlierComponents ?? []).map((x) => (x.uuid === o.uuid ? { ...x, ...patch } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Outlier · {o.uuid}</div>
            <h2 className="posdrawer__title">{o.componentId}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Component</label><WorkbookInput className="posfield__input" value={o.componentId} disabled={!editable} onChange={(e) => patchOutlier({ componentId: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">System</label><WorkbookInput className="posfield__input posmono" value={o.systemId} disabled={!editable} onChange={(e) => patchOutlier({ systemId: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Potential group</label><select className="posfield__select" value={o.potentialGroupId} disabled={!editable} onChange={(e) => patchOutlier({ potentialGroupId: e.target.value })}><option value="">—</option>{(da.componentGroupings ?? []).map((cg) => <option key={cg.uuid} value={cg.groupId}>{cg.name}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Status</label><select className="posfield__select" value={o.status} disabled={!editable} onChange={(e) => patchOutlier({ status: e.target.value as OutlierComponent["status"] })}><option value="CONFIRMED">Confirmed</option><option value="TENTATIVE">Tentative</option><option value="UNDER_REVIEW">Under review</option></select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Exclusion reason</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={o.exclusionReason} disabled={!editable} onChange={(e) => patchOutlier({ exclusionReason: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Exclusion justification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={o.exclusionJustification} disabled={!editable} onChange={(e) => patchOutlier({ exclusionJustification: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Alternative handling</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={o.alternativeHandling} disabled={!editable} onChange={(e) => patchOutlier({ alternativeHandling: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="DA" title="Differentiating characteristics" className="essec" />
            {o.differentiatingCharacteristics.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 6, marginBottom: 6 }}>
                <WorkbookInput className="posfield__input" value={x} disabled={!editable} onChange={(e) => patchOutlier({ differentiatingCharacteristics: o.differentiatingCharacteristics.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchOutlier({ differentiatingCharacteristics: o.differentiatingCharacteristics.filter((_, j) => j !== i) })}><DAIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchOutlier({ differentiatingCharacteristics: [...o.differentiatingCharacteristics, ""] })}><DAIcon.Plus /> Add item</button>}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "source") {
    const src = (da.externalDataSources ?? []).find((x) => x.uuid === context.id);
    if (src === undefined) return null;
    const patch = (pp: Partial<ExternalDataSource>): void => {
      mutateDa((draft) => ({ ...draft, externalDataSources: (draft.externalDataSources ?? []).map((x) => (x.uuid === src.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Data source · {src.uuid}</div>
            <h2 className="posdrawer__title">{src.name}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={src.name} disabled={!editable} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Source type</label><select className="posfield__select" value={src.sourceType} disabled={!editable} onChange={(e) => patch({ sourceType: e.target.value as ExternalDataSource["sourceType"] })}>{Object.entries(SOURCE_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Location</label><WorkbookInput className="posfield__input" value={src.sourceLocation} disabled={!editable} onChange={(e) => patch({ sourceLocation: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Period start</label><WorkbookInput className="posfield__input posmono" value={src.timePeriod.start} disabled={!editable} onChange={(e) => patch({ timePeriod: { ...src.timePeriod, start: e.target.value } })} /></div>
            <div className="posfield"><label className="posfield__label">Period end</label><WorkbookInput className="posfield__input posmono" value={src.timePeriod.end} disabled={!editable} onChange={(e) => patch({ timePeriod: { ...src.timePeriod, end: e.target.value } })} /></div>
            <div className="posfield"><label className="posfield__label">Access method</label><WorkbookInput className="posfield__input" value={src.accessMethod} disabled={!editable} onChange={(e) => patch({ accessMethod: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Data format</label><WorkbookInput className="posfield__input" value={src.dataFormat} disabled={!editable} onChange={(e) => patch({ dataFormat: e.target.value })} /></div>
          </div>
          <div className="posfield"><label className="posfield__label">Quality assurance</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={src.qualityAssurance ?? ""} disabled={!editable} onChange={(e) => patch({ qualityAssurance: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Validation method</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={src.validationMethod ?? ""} disabled={!editable} onChange={(e) => patch({ validationMethod: e.target.value === "" ? undefined : e.target.value })} /></div>
          <ListEditor label="Limitations" items={src.limitations ?? []} disabled={!editable} onApply={(next) => patch({ limitations: next })} />
          <ListEditor label="Reference documentation" items={src.referenceDocumentation} disabled={!editable} onApply={(next) => patch({ referenceDocumentation: next })} />
        </div>
      </>
    );
  }

  if (context.kind === "failuredef") {
    const fd = (da.failureEventClassifications ?? []).find((x) => x.uuid === context.id);
    if (fd === undefined) return null;
    const patch = (pp: Partial<FailureEventClassification>): void => {
      mutateDa((draft) => ({ ...draft, failureEventClassifications: (draft.failureEventClassifications ?? []).map((x) => (x.uuid === fd.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Failure definition · {fd.uuid}</div>
            <WorkbookSectionHeading workbook="DA" title="What counts as a failure" level={2} className="posdrawer__title" />
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Definition basis</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={fd.failureDefinitionBasis} disabled={!editable} onChange={(e) => patch({ failureDefinitionBasis: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Repeated-failure counting</label><select className="posfield__select" value={fd.repeatedFailureCountingApplied ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ repeatedFailureCountingApplied: e.target.value === "yes" })}><option value="yes">One repetitive cause counts once</option><option value="no">Each occurrence counts</option></select></div>
          <ListEditor label="Counts as a failure" items={fd.degradedStatesCountedAsFailures} disabled={!editable} onApply={(next) => patch({ degradedStatesCountedAsFailures: next })} />
          <ListEditor label="Does not count" items={fd.degradedStatesNotCounted} disabled={!editable} onApply={(next) => patch({ degradedStatesNotCounted: next })} />
        </div>
      </>
    );
  }

  if (context.kind === "demand") {
    const d = (da.demandCountRecords ?? []).find((x) => x.uuid === context.id);
    if (d === undefined) return null;
    const patch = (pp: Partial<DemandCountRecord>): void => {
      mutateDa((draft) => ({ ...draft, demandCountRecords: (draft.demandCountRecords ?? []).map((x) => (x.uuid === d.uuid ? { ...x, ...pp } : x)) }));
    };
    const num = (v: string): number | undefined => { const n = Number(v); return Number.isNaN(n) ? undefined : n; };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Demand counting · {d.uuid}</div>
            <h2 className="posdrawer__title">{d.componentGroupRef === "" ? "New demand record" : d.componentGroupRef}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Component group</label><select className="posfield__select" value={d.componentGroupRef} disabled={!editable} onChange={(e) => patch({ componentGroupRef: e.target.value })}><option value="">—</option>{(da.componentGroupings ?? []).map((cg) => <option key={cg.uuid} value={cg.groupId}>{cg.name}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Basis</label><select className="posfield__select" value={d.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value as DemandCountRecord["basis"] })}>{Object.entries(DEMAND_BASIS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Surveillance demands</label><WorkbookInput className="posfield__input posmono" type="number" value={d.surveillanceTestDemands ?? 0} disabled={!editable} onChange={(e) => { const n = num(e.target.value); if (n !== undefined) patch({ surveillanceTestDemands: n }); }} /></div>
            <div className="posfield"><label className="posfield__label">Maintenance demands</label><WorkbookInput className="posfield__input posmono" type="number" value={d.maintenanceActDemands ?? 0} disabled={!editable} onChange={(e) => { const n = num(e.target.value); if (n !== undefined) patch({ maintenanceActDemands: n }); }} /></div>
            <div className="posfield"><label className="posfield__label">Operational demands</label><WorkbookInput className="posfield__input posmono" type="number" value={d.operationalDemands ?? 0} disabled={!editable} onChange={(e) => { const n = num(e.target.value); if (n !== undefined) patch({ operationalDemands: n }); }} /></div>
            <div className="posfield"><label className="posfield__label">Total demands</label><WorkbookInput className="posfield__input posmono" type="number" value={d.totalDemands} disabled={!editable} onChange={(e) => { const n = num(e.target.value); if (n !== undefined) patch({ totalDemands: n }); }} /></div>
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "exposure") {
    const ex = (da.exposureTimeRecords ?? []).find((x) => x.uuid === context.id);
    if (ex === undefined) return null;
    const patch = (pp: Partial<ExposureTimeRecord>): void => {
      mutateDa((draft) => ({ ...draft, exposureTimeRecords: (draft.exposureTimeRecords ?? []).map((x) => (x.uuid === ex.uuid ? { ...x, ...pp } : x)) }));
    };
    const num = (v: string): number | undefined => { const n = Number(v); return Number.isNaN(n) ? undefined : n; };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Exposure time · {ex.uuid}</div>
            <h2 className="posdrawer__title">{ex.componentGroupRef === "" ? "New exposure record" : ex.componentGroupRef}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Component group</label><select className="posfield__select" value={ex.componentGroupRef} disabled={!editable} onChange={(e) => patch({ componentGroupRef: e.target.value })}><option value="">—</option>{(da.componentGroupings ?? []).map((cg) => <option key={cg.uuid} value={cg.groupId}>{cg.name}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Basis</label><select className="posfield__select" value={ex.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value as ExposureTimeRecord["basis"] })}>{Object.entries(EXPOSURE_BASIS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Standby hours</label><WorkbookInput className="posfield__input posmono" type="number" value={ex.standbyHours ?? 0} disabled={!editable} onChange={(e) => { const n = num(e.target.value); if (n !== undefined) patch({ standbyHours: n }); }} /></div>
            <div className="posfield"><label className="posfield__label">Operating hours</label><WorkbookInput className="posfield__input posmono" type="number" value={ex.operatingHours ?? 0} disabled={!editable} onChange={(e) => { const n = num(e.target.value); if (n !== undefined) patch({ operatingHours: n }); }} /></div>
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "testcred") {
    const t = (da.testCredibilityReviews ?? []).find((x) => x.uuid === context.id);
    if (t === undefined) return null;
    const patch = (pp: Partial<TestCredibilityReview>): void => {
      mutateDa((draft) => ({ ...draft, testCredibilityReviews: (draft.testCredibilityReviews ?? []).map((x) => (x.uuid === t.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Test credibility · {t.uuid}</div>
            <h2 className="posdrawer__title">{t.testProcedureReference}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Test procedure</label><WorkbookInput className="posfield__input" value={t.testProcedureReference} disabled={!editable} onChange={(e) => patch({ testProcedureReference: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Component group</label><select className="posfield__select" value={t.componentGroupRef ?? ""} disabled={!editable} onChange={(e) => patch({ componentGroupRef: e.target.value === "" ? undefined : e.target.value })}><option value="">—</option>{(da.componentGroupings ?? []).map((cg) => <option key={cg.uuid} value={cg.groupId}>{cg.name}</option>)}</select></div>
          <ListEditor label="Failure modes exercised" items={t.failureModesExercised} disabled={!editable} onApply={(next) => patch({ failureModesExercised: next })} />
          <ListEditor label="Failure modes not exercised" items={t.failureModesNotExercised} disabled={!editable} onApply={(next) => patch({ failureModesNotExercised: next })} />
          <div className="posfield"><label className="posfield__label">Demand crediting decision</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={t.demandCreditingDecision} disabled={!editable} onChange={(e) => patch({ demandCreditingDecision: e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "unavail") {
    const u = (da.unavailabilityDataRecords ?? []).find((x) => x.uuid === context.id);
    if (u === undefined) return null;
    const patch = (pp: Partial<UnavailabilityDataRecord>): void => {
      mutateDa((draft) => ({ ...draft, unavailabilityDataRecords: (draft.unavailabilityDataRecords ?? []).map((x) => (x.uuid === u.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Unavailability · {u.uuid}</div>
            <h2 className="posdrawer__title">{u.componentOrTrainReference}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Component or train</label><WorkbookInput className="posfield__input" value={u.componentOrTrainReference} disabled={!editable} onChange={(e) => patch({ componentOrTrainReference: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">System</label><WorkbookInput className="posfield__input posmono" value={u.systemReference ?? ""} disabled={!editable} onChange={(e) => patch({ systemReference: e.target.value === "" ? undefined : e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Assigned to support system</label><WorkbookInput className="posfield__input posmono" value={u.assignedToSupportSystem ?? ""} disabled={!editable} onChange={(e) => patch({ assignedToSupportSystem: e.target.value === "" ? undefined : e.target.value })} /></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="DA" title="Contributing activities" className="essec" />
            {u.contributingActivities.map((a, i) => (
              <div key={i} className="posrow" style={{ gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <WorkbookInput className="posfield__input" style={{ flex: 2, minWidth: 140 }} value={a.activity} disabled={!editable} onChange={(e) => patch({ contributingActivities: u.contributingActivities.map((y, j) => (j === i ? { ...y, activity: e.target.value } : y)) })} />
                <WorkbookInput className="posfield__input posmono" style={{ width: 90 }} type="number" step="any" value={a.durationHours} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ contributingActivities: u.contributingActivities.map((y, j) => (j === i ? { ...y, durationHours: n } : y)) }); }} />
                <select className="posfield__select" style={{ width: 160 }} value={a.disablesFunction ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ contributingActivities: u.contributingActivities.map((y, j) => (j === i ? { ...y, disablesFunction: e.target.value === "yes" } : y)) })}><option value="yes">Disables</option><option value="no">Does not disable</option></select>
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ contributingActivities: u.contributingActivities.filter((_, j) => j !== i) })}><DAIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ contributingActivities: [...u.contributingActivities, { activity: "", durationHours: 0, disablesFunction: true }] })}><DAIcon.Plus /> Add activity</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Pre-operational basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={u.preOperationalAssumptionsBasis ?? ""} disabled={!editable} onChange={(e) => patch({ preOperationalAssumptionsBasis: e.target.value === "" ? undefined : e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "coincident") {
    const c = (da.coincidentMaintenanceRecords ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (pp: Partial<CoincidentMaintenanceRecord>): void => {
      mutateDa((draft) => ({ ...draft, coincidentMaintenanceRecords: (draft.coincidentMaintenanceRecords ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Coincident maintenance · {c.uuid}</div>
            <h2 className="posdrawer__title">{c.redundantEquipmentIds.join(" + ") === "" ? "New record" : c.redundantEquipmentIds.join(" + ")}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <ListEditor label="Redundant equipment" items={c.redundantEquipmentIds} disabled={!editable} onApply={(next) => patch({ redundantEquipmentIds: next })} />
          <div className="posfield"><label className="posfield__label">Planned activity</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.plannedActivityDescription} disabled={!editable} onChange={(e) => patch({ plannedActivityDescription: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Unavailability</label><WorkbookInput className="posfield__input posmono" type="number" step="any" value={c.unavailabilityValue ?? 0} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ unavailabilityValue: n }); }} /></div>
            <div className="posfield"><label className="posfield__label">Scope</label><select className="posfield__select" value={c.scope} disabled={!editable} onChange={(e) => patch({ scope: e.target.value as CoincidentMaintenanceRecord["scope"] })}><option value="INTRASYSTEM">Within system</option><option value="INTERSYSTEM">Across systems</option></select></div>
            <div className="posfield"><label className="posfield__label">Basis</label><select className="posfield__select" value={c.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value as CoincidentMaintenanceRecord["basis"] })}><option value="PREOP_ASSUMPTION">Pre-operational assumption</option><option value="ACTUAL_PLANT_EXPERIENCE">Actual plant experience</option></select></div>
            <div className="posfield"><label className="posfield__label">Systems Analysis event</label><WorkbookInput className="posfield__input posmono" value={c.systemsAnalysisSimultaneousEventRef ?? ""} disabled={!editable} onChange={(e) => patch({ systemsAnalysisSimultaneousEventRef: e.target.value === "" ? undefined : e.target.value })} /></div>
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "repair") {
    const r = (da.repairTimeRecords ?? []).find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    const patch = (pp: Partial<RepairTimeRecord>): void => {
      mutateDa((draft) => ({ ...draft, repairTimeRecords: (draft.repairTimeRecords ?? []).map((x) => (x.uuid === r.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Repair time · {r.uuid}</div>
            <h2 className="posdrawer__title">{r.sscReference}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">SSC</label><WorkbookInput className="posfield__input" value={r.sscReference} disabled={!editable} onChange={(e) => patch({ sscReference: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Identification to restoration (h)</label><WorkbookInput className="posfield__input posmono" type="number" step="any" value={r.repairEvents[0]?.identificationToRestorationHours ?? 0} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ repairEvents: [{ ...r.repairEvents[0], identificationToRestorationHours: n }] }); }} /></div>
          </div>
          <div className="posfield"><label className="posfield__label">Pre-operational basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.preOperationalAssumptionsBasis ?? ""} disabled={!editable} onChange={(e) => patch({ preOperationalAssumptionsBasis: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Operating-state influences</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.plantOperatingStateInfluences ?? ""} disabled={!editable} onChange={(e) => patch({ plantOperatingStateInfluences: e.target.value === "" ? undefined : e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "recovery") {
    const r = (da.recoveryTimeRecords ?? []).find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    const patch = (pp: Partial<RecoveryTimeRecord>): void => {
      mutateDa((draft) => ({ ...draft, recoveryTimeRecords: (draft.recoveryTimeRecords ?? []).map((x) => (x.uuid === r.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Recovery time · {r.uuid}</div>
            <h2 className="posdrawer__title">{r.functionLost}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Function lost</label><WorkbookInput className="posfield__input" value={r.functionLost} disabled={!editable} onChange={(e) => patch({ functionLost: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Identification to restoration (h)</label><WorkbookInput className="posfield__input posmono" type="number" step="any" value={r.recoveryEvents[0]?.identificationToRestorationHours ?? 0} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ recoveryEvents: [{ ...r.recoveryEvents[0], identificationToRestorationHours: n }] }); }} /></div>
          </div>
          <ListEditor label="Generic sources" items={r.genericSourceReferences ?? []} disabled={!editable} onApply={(next) => patch({ genericSourceReferences: next })} />
        </div>
      </>
    );
  }

  if (context.kind === "outage") {
    const o = (da.lpsdOutageDataRecords ?? []).find((x) => x.uuid === context.id);
    if (o === undefined) return null;
    const patch = (pp: Partial<LpsdOutageDataRecord>): void => {
      mutateDa((draft) => ({ ...draft, lpsdOutageDataRecords: (draft.lpsdOutageDataRecords ?? []).map((x) => (x.uuid === o.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Outage record · {o.uuid}</div>
            <h2 className="posdrawer__title">{o.outageType}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Outage type</label><WorkbookInput className="posfield__input" value={o.outageType} disabled={!editable} onChange={(e) => patch({ outageType: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Operating state</label>{(links?.posStates ?? []).length > 0 ? <select className="posfield__select" value={o.plantOperatingStateRef ?? ""} disabled={!editable} onChange={(e) => patch({ plantOperatingStateRef: e.target.value === "" ? undefined : e.target.value })}><option value="">—</option>{(links?.posStates ?? []).map((st) => <option key={st.id} value={st.id}>{st.id} · {st.name}</option>)}</select> : <WorkbookInput className="posfield__input posmono" value={o.plantOperatingStateRef ?? ""} disabled={!editable} onChange={(e) => patch({ plantOperatingStateRef: e.target.value === "" ? undefined : e.target.value })} />}</div>
            <div className="posfield"><label className="posfield__label">Duration (h)</label><WorkbookInput className="posfield__input posmono" type="number" step="any" value={o.durationHours ?? 0} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ durationHours: n }); }} /></div>
            <div className="posfield"><label className="posfield__label">Outages per year</label><WorkbookInput className="posfield__input posmono" type="number" step="any" value={o.outagesPerCalendarYear ?? 0} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ outagesPerCalendarYear: n }); }} /></div>
          </div>
          <div className="posfield"><label className="posfield__label">POS data link basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={o.posDataLinkBasis ?? ""} disabled={!editable} onChange={(e) => patch({ posDataLinkBasis: e.target.value === "" ? undefined : e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "ccf") {
    const c = (da.ccfParameterEstimations ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (pp: Partial<CcfParameterEstimation>): void => {
      mutateDa((draft) => ({ ...draft, ccfParameterEstimations: (draft.ccfParameterEstimations ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Common cause · {c.uuid}</div>
            <h2 className="posdrawer__title">{c.ccfGroupReference}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">CCF group</label><WorkbookInput className="posfield__input posmono" value={c.ccfGroupReference} disabled={!editable} onChange={(e) => patch({ ccfGroupReference: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Model</label><select className="posfield__select" value={c.modelType} disabled={!editable} onChange={(e) => patch({ modelType: e.target.value as CcfParameterEstimation["modelType"] })}>{Object.entries(CCF_MODEL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Parameter source</label><select className="posfield__select" value={c.parameterSource} disabled={!editable} onChange={(e) => patch({ parameterSource: e.target.value as CcfParameterEstimation["parameterSource"] })}>{Object.entries(CCF_SOURCE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Risk significance</label><select className="posfield__select" value={c.isRiskSignificant === true ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ isRiskSignificant: e.target.value === "yes" })}><option value="no">Not risk-significant</option><option value="yes">Risk-significant</option></select></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="DA" title="Model parameters" className="essec" />
            {Object.entries(c.parameters).map(([k, v]) => (
              <div key={k} className="posrow" style={{ gap: 6, marginBottom: 6, alignItems: "center" }}>
                <span className="poschip posmono" style={{ minWidth: 90, justifyContent: "center" }}>{k}</span>
                <WorkbookInput className="posfield__input posmono" type="number" step="any" value={v} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ parameters: { ...c.parameters, [k]: n } }); }} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ parameters: Object.fromEntries(Object.entries(c.parameters).filter(([kk]) => kk !== k)) })}><DAIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ parameters: { ...c.parameters, [`p${String(Object.keys(c.parameters).length + 1)}`]: 0 } })}><DAIcon.Plus /> Add parameter</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Boundary consistency basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.componentBoundaryConsistencyBasis} disabled={!editable} onChange={(e) => patch({ componentBoundaryConsistencyBasis: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Exclusions applied consistently</label><select className="posfield__select" value={c.genericExclusionConsistencyConfirmed === true ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ genericExclusionConsistencyConfirmed: e.target.value === "yes" })}><option value="no">Open</option><option value="yes">Confirmed</option></select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Exclusion consistency basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.genericExclusionConsistencyBasis ?? ""} disabled={!editable} onChange={(e) => patch({ genericExclusionConsistencyBasis: e.target.value === "" ? undefined : e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "uncsource") {
    const idx = Number(context.id);
    const u = da.modelUncertainty.uncertaintySources[idx];
    if (u === undefined) return null;
    const patch = (pp: { source?: string; impact?: string }): void => {
      mutateDa((draft) => ({ ...draft, modelUncertainty: { ...draft.modelUncertainty, uncertaintySources: draft.modelUncertainty.uncertaintySources.map((x, i) => (i === idx ? { ...x, ...pp } : x)) } }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Uncertainty source</div>
            <h2 className="posdrawer__title">{u.source}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Source</label><WorkbookInput className="posfield__input" value={u.source} disabled={!editable} onChange={(e) => patch({ source: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Impact</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={u.impact} disabled={!editable} onChange={(e) => patch({ impact: e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "preop") {
    const a = (da.preOperationalAssumptions ?? []).find((x) => x.uuid === context.id);
    if (a === undefined) return null;
    const patch = (pp: { description?: string; influenceOnDefinition?: string; closureBasis?: string }): void => {
      mutateDa((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).map((x) => (x.uuid === a.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Pre-operational assumption · {a.uuid}</div>
            <h2 className="posdrawer__title">{a.influenceOnDefinition}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Area</label><WorkbookInput className="posfield__input" value={a.influenceOnDefinition} disabled={!editable} onChange={(e) => patch({ influenceOnDefinition: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Description</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={a.description} disabled={!editable} onChange={(e) => patch({ description: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Closure basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.closureBasis ?? ""} disabled={!editable} onChange={(e) => patch({ closureBasis: e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "sens") {
    const st = (da.sensitivityStudies ?? []).find((x) => x.uuid === context.id);
    if (st === undefined) return null;
    const patch = (pp: { name?: string; description?: string; results?: string }): void => {
      mutateDa((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).map((x) => (x.uuid === st.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Sensitivity study · {st.uuid}</div>
            <h2 className="posdrawer__title">{st.name ?? "Sensitivity study"}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={st.name ?? ""} disabled={!editable} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={st.description ?? ""} disabled={!editable} onChange={(e) => patch({ description: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Results</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={st.results ?? ""} disabled={!editable} onChange={(e) => patch({ results: e.target.value })} /></div>
        </div>
      </>
    );
  }

  if (context.kind === "datamod") {
    const d = (da.dataModificationAdjustments ?? []).find((x) => x.uuid === context.id);
    if (d === undefined) return null;
    const patch = (pp: Partial<DataModificationAdjustment>): void => {
      mutateDa((draft) => ({ ...draft, dataModificationAdjustments: (draft.dataModificationAdjustments ?? []).map((x) => (x.uuid === d.uuid ? { ...x, ...pp } : x)) }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Data modification · {d.uuid}</div>
            <h2 className="posdrawer__title">{d.modificationDescription}</h2>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><DAIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Modification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={d.modificationDescription} disabled={!editable} onChange={(e) => patch({ modificationDescription: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Past data disposition</label><select className="posfield__select" value={d.pastDataDisposition} disabled={!editable} onChange={(e) => patch({ pastDataDisposition: e.target.value as DataModificationAdjustment["pastDataDisposition"] })}><option value="ADJUSTED">Adjusted</option><option value="DISCARDED">Discarded</option><option value="RETAINED_WITH_JUSTIFICATION">Retained with justification</option></select></div>
          <div className="posfield"><label className="posfield__label">Basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={d.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value })} /></div>
          <ListEditor label="Affected parameters" items={d.affectedParameterIds} disabled={!editable} onApply={(next) => patch({ affectedParameterIds: next })} />
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
