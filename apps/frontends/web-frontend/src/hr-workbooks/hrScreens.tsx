import { JSX } from "react";
import { HRIcon } from "./hrIcons";
import { Badge, HRProvenanceChip, hepText } from "./hrShared";
import {
  CAPABILITY_CATEGORIES,
  THREE_MOMENTS,
  HRA_METHODS,
  ACTIVITY_TYPES,
  ACTIVITY_SOURCES,
  IMPACT_LEVELS,
  RECOVERY_CREDIT_LABELS,
  DEPENDENCE_LEVELS,
  HEP_METHODS,
  DEP_METHOD,
  type Stage,
} from "./hrViewData";
import { ccScore } from "./hrSelectors";
import { useHrWorkbook } from "./hrWorkbookContext";
import { WorkbookUpstreamBar, WorkbookInterfaceMap } from "../workbooks/workbookInterfaces";

interface HrDrawerContext {
  kind: "activity" | "prehfe" | "posthfe" | "dependence" | "recovery";
  id: string;
}

const ACTIVITY_WARN: Record<string, string> = {
  "RA-4": "Diverse-system reach under review against the actuation logic.",
  "RA-7": "Sequencing of the two banks under review against the staggered-maintenance rule.",
};

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = HRIcon[name] ?? HRIcon.Link;
  return <Icon />;
}

function MethodChips({ ids, label }: { ids: (string | undefined)[]; label?: string }): JSX.Element | null {
  const ms = ids.filter((id): id is string => id !== undefined).map((id) => HRA_METHODS[id]).filter((m) => m !== undefined);
  if (ms.length === 0) return null;
  return (
    <div className="hrmethods">
      {label !== undefined && <span className="hrmethods__label">{label}</span>}
      {ms.map((m) => <span key={m.id} className="hrmethod-chip" title={`${m.name} · ${m.ref}`}>{m.abbr}</span>)}
    </div>
  );
}

function exposureLabel(hours: number | undefined): string {
  if (hours === undefined) return "Not set";
  if (hours >= 2000) return "Quarterly";
  if (hours >= 600) return "Monthly";
  if (hours >= 120) return "Weekly";
  if (hours >= 20) return "Daily";
  return `${hours} h`;
}

function MomentsStrip(): JSX.Element {
  return (
    <div className="hrmoments">
      <div className="hrmoments__axis">
        <span className="hrmoments__axis-line" />
        <span className="hrmoments__initiator"><span className="hrmoments__initiator-dot" />Initiating event</span>
      </div>
      <div className="hrmoments__row">
        {THREE_MOMENTS.map((m) => (
          <div key={m.id} className={`hrmoments__card hrmoments__card--${m.color}`}>
            <div className="hrmoments__card-head">
              <span className="hrmoments__icon"><NamedIcon name={m.icon} /></span>
              <div>
                <div className="hrmoments__label">{m.label}</div>
                <div className="hrmoments__tag">{m.tag}</div>
              </div>
              <span className="hrmoments__hlr">{m.hlrs}</span>
            </div>
            <p className="hrmoments__desc">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage, onAction }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
}): JSX.Element {
  const { hr } = useHrWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Human failure events relative to the initiating event</h3></div>
        <MomentsStrip />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <HRProvenanceChip>Linked</HRProvenanceChip>
        </div>
        <p className="poscard__sub">POS sets the per-state context, ES names the actions, SC sets the time available, SY places the events.</p>
        <WorkbookUpstreamBar element="HR" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
          <span className="possubtle">Most interfaced element in the model</span>
        </div>
        <p className="poscard__sub">HR pulls operator contributions from IE, data from DA, and delivers the human error probabilities to ESQ.</p>
        <WorkbookInterfaceMap element="HR" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Conservative values where justified, or detailed assessments for risk-significant human failure events.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const score = ccScore(hr, c.id, stage);
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
                <div className="possubtle" style={{ fontSize: 11.5, marginTop: 8 }}>{score.ready} of {score.total} SRs ready</div>
              </button>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <HRIcon.Sparkle />
          <span>At CC-II the evidence is behavioral, since talk-throughs, simulator runs and measured action times cannot be met from a desk.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">HR has the widest pre-operational fork, since it depends most on how crews run the plant with its procedures.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Activities and actions rest on planned procedures and borrowed experience, with the gaps logged."],
            ["operational", "Operational", "Talk-throughs, simulator runs and operating history confirm the analysis and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="hr-stage" value={val} checked={stage === val} onChange={() => { setStage(val); onAction(`Plant stage set to ${title}`); }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function PreIdentifyScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr } = useHrWorkbook();
  const multiTrain = hr.routineActivities.filter((a) => a.affectsMultipleTrainsOrDiverseSystems);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Routine activities</h3>
          <span className="possubtle">{hr.routineActivities.length} found · HR-A1, A3</span>
        </div>
        <p className="poscard__sub">Find the realignment and calibration activities that can leave equipment unavailable until it is demanded.</p>
        <div className="hrra">
          {hr.routineActivities.map((a) => {
            const type = ACTIVITY_TYPES[a.activityType];
            const warn = ACTIVITY_WARN[a.uuid] !== undefined;
            return (
              <div key={a.uuid} className={`hrra__card${a.affectsMultipleTrainsOrDiverseSystems ? " hrra__card--multi" : ""}${warn ? " hrra__card--warn" : ""}`} onClick={() => openDrawer({ kind: "activity", id: a.uuid })}>
                <div className="hrra__head">
                  <span className="hrra__icon"><NamedIcon name={type?.icon ?? "Settings"} /></span>
                  <div className="hrra__head-main">
                    <div className="hrra__name">{a.name}</div>
                    <div className="hrra__type">{type?.label ?? a.activityType}</div>
                  </div>
                  {a.affectsMultipleTrainsOrDiverseSystems && <span className="hrra__multi-flag"><HRIcon.Users /> Multi-train</span>}
                </div>
                <p className="hrra__desc">{a.description}</p>
                <div className="hrra__foot">
                  <span className="hrra__sys">{a.affectedSystems.join(", ")}</span>
                  <span className="hrra__sources">{a.identificationSources.map((s) => ACTIVITY_SOURCES[s]).join(" · ")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Multi-train work practices</h3>
          <HRProvenanceChip>HR-A5</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Flag the work that touches redundant trains or diverse systems at once, since it cannot be screened out later.</p>
        <div className="hrmulti">
          {multiTrain.map((a) => (
            <div key={a.uuid} className="hrmulti__row">
              <span className="hrmulti__row-name">{a.name}</span>
              <span className="hrmulti__row-mech">{a.multiTrainMechanism}</span>
              {ACTIVITY_WARN[a.uuid] !== undefined ? <Badge kind="warn">Reach open</Badge> : <Badge kind="ok">Flagged</Badge>}
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operator contributions to initiators</h3>
          <HRProvenanceChip>HR-A7</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Include the operator-error contributions in the support-system initiating event fault trees from IE.</p>
        <table className="postable">
          <thead><tr><th>Support system</th><th>Fault tree</th><th>Included</th></tr></thead>
          <tbody>
            {(hr.supportSystemInitiatorOperatorContributions ?? []).map((s) => (
              <tr key={s.uuid}>
                <td style={{ fontWeight: 600 }}>{s.systemReference}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{s.faultTreeReference ?? "—"}</td>
                <td>{s.included ? <Badge kind="ok">Included</Badge> : <Badge>Excluded</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PreDefineScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr } = useHrWorkbook();
  const preHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming === "PRE_INITIATOR");
  function activityName(id: string): string {
    return hr.routineActivities.find((a) => a.uuid === id)?.name ?? id;
  }
  function isMultiTrain(activityId: string): boolean {
    return hr.routineActivities.find((a) => a.uuid === activityId)?.affectsMultipleTrainsOrDiverseSystems ?? false;
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screening</h3>
          <HRProvenanceChip>HR-B1 · HR-B3</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Screen with screening-grade criteria per operating state, but never screen out a multi-train activity.</p>
        <table className="postable" style={{ marginTop: 12 }}>
          <thead><tr><th>Activity</th><th>Decision</th><th>Basis</th></tr></thead>
          <tbody>
            {hr.preInitiatorScreeningRecords.map((s) => (
              <tr key={s.uuid}>
                <td style={{ fontWeight: 600 }}>{activityName(s.activityId)}
                  {isMultiTrain(s.activityId) && <span className="hrscreen__prohibit"><HRIcon.Users /> Protected</span>}
                </td>
                <td>{s.screenedOut ? <Badge kind="draft">Screened out</Badge> : <Badge kind="progress">Carried</Badge>}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{s.justification}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Pre-initiator events</h3>
          <span className="possubtle">{preHfes.length} defined · HR-C1, C2, C4, C5</span>
        </div>
        <p className="poscard__sub">Define each event at the fitting level, with the time it sits undetected and the unavailability modes.</p>
        <div className="hrhfe">
          {preHfes.map((h) => {
            const detail = h.preInitiatorDetail;
            const detect = detail?.averageTimeToDetectionHours;
            return (
              <div key={h.uuid} className="hrhfe__card" onClick={() => openDrawer({ kind: "prehfe", id: h.uuid })}>
                <div className="hrhfe__head">
                  <span className="hrhfe__timing hrhfe__timing--pre"><HRIcon.Settings /> Pre-initiator</span>
                  <span className="hrhfe__id posmono">{h.uuid}</span>
                  {detail?.miscalibrationImpactIncluded === true && <span className="hrhfe__miscal">Miscalibration</span>}
                </div>
                <div className="hrhfe__name">{h.name}</div>
                <div className="hrhfe__meta">
                  <span className="hrhfe__level">{IMPACT_LEVELS[h.impactLevel]} level</span>
                  <span className="hrhfe__sys">{h.affectedSystems.join(", ")}</span>
                </div>
                <div className="hrhfe__expo">
                  <span className="hrhfe__expo-k"><HRIcon.Clock /> Exposure window</span>
                  <span className="hrhfe__expo-bar"><span className="hrhfe__expo-fill" style={{ width: `${Math.min(100, ((detect ?? 0) / 2160) * 100)}%` }} /></span>
                  <span className="hrhfe__expo-v">{exposureLabel(detect)}</span>
                </div>
                <div className="hrhfe__modes">
                  {(detail?.unavailabilityModes ?? []).map((m, i) => <span key={i} className="hrhfe__mode">{m}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function PreQuantScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr } = useHrWorkbook();
  const preHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming === "PRE_INITIATOR");
  const preDeps = hr.dependencyAssessments.filter((d) => d.scope === "PRE_INITIATOR_SET");
  function quantOf(id: string) {
    return hr.hepQuantifications.find((q) => q.hfeId === id);
  }
  function hfeName(id: string): string {
    return hr.humanFailureEvents.find((h) => h.uuid === id)?.name ?? id;
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Quantification</h3>
          <HRProvenanceChip>HR-D1 · HR-D2</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Conservative estimates at CC-I, or detailed mean values for the risk-significant events at CC-II.</p>
        <table className="postable" style={{ marginTop: 12 }}>
          <thead><tr><th>Event</th><th>Assessment</th><th>HEP</th><th>Risk-significant</th></tr></thead>
          <tbody>
            {preHfes.map((h) => {
              const q = quantOf(h.uuid);
              if (q === undefined) return null;
              const value = q.meanHep ?? q.pointEstimateHep;
              return (
                <tr key={h.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "prehfe", id: h.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{h.name}
                    <div className="possubtle" style={{ fontSize: 11.5, marginTop: 2, fontWeight: 400 }}>{q.methodology}</div>
                    <MethodChips ids={[HEP_METHODS[h.uuid]?.method]} />
                  </td>
                  <td>{q.assessmentType === "DETAILED_ASSESSMENT" ? <span className="hrmethod hrmethod--detailed">Detailed</span> : <span className="hrmethod hrmethod--conservative">Conservative</span>}</td>
                  <td className="posmono hrhep">{hepText(value)}<span className="hrhep__kind">{q.meanHep !== undefined ? "mean" : "point"}</span></td>
                  <td>{q.isRiskSignificant ? <Badge kind="progress">Risk-significant</Badge> : <Badge>Screened value</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Recovery credit</h3>
          <HRProvenanceChip>HR-D5 · HR-D6</HRProvenanceChip>
        </div>
        <p className="poscard__sub">A check or a test that catches the error can lower its probability, but only with a stated reason and a stated limit.</p>
        <div className="hrrecred">
          {(hr.preInitiatorRecoveryCredits ?? []).map((r) => (
            <div key={r.uuid} className="hrrecred__row">
              <span className="hrrecred__name">{hfeName(r.hfeId)}</span>
              <span className="hrrecred__credit">{RECOVERY_CREDIT_LABELS[(r.creditBases ?? [])[0] ?? ""] ?? "Recovery credit"}</span>
              <span className="hrrecred__max posmono">lowers it {r.maximumCreditSpecified > 0 ? Math.round(1 / r.maximumCreditSpecified) : 1}x at most</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Same-crew dependence</h3>
          <HRProvenanceChip>HR-D7</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Evaluate the pre-initiator events that share a cause and calculate the joint probability above the product.</p>
        {preDeps.map((d) => (
          <div key={d.uuid} className="hrdep">
            <div className="hrdep__head">
              <span className="hrdep__icon"><HRIcon.Users /></span>
              <div>
                <div className="hrdep__title">{hfeName(d.hfeIds[0])}</div>
                <div className="hrdep__level">Dependence. {DEPENDENCE_LEVELS[d.dependenceLevel]}</div>
              </div>
              <span className="hrdep__joint posmono">{hepText(d.jointHep)}<span className="hrhep__kind">joint</span></span>
            </div>
            <div className="hrdep__elements">
              {d.commonElements.map((e, i) => <span key={i} className="hrdep__el">{e}</span>)}
            </div>
            <MethodChips ids={[DEP_METHOD]} label="Dependence model" />
          </div>
        ))}
      </div>
    </>
  );
}

export { ScopeScreen, PreIdentifyScreen, PreDefineScreen, PreQuantScreen, MethodChips, NamedIcon, type HrDrawerContext };
