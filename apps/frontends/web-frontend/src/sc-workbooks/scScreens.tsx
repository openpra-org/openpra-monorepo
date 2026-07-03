import { Fragment, JSX, ReactNode, useMemo, useState } from "react";
import { SCIcon } from "./scIcons";
import { Badge, SCProvenanceChip, type BadgeKind } from "./scShared";
import {
  CAPABILITY_CATEGORIES,
  SC_ANALYSIS_TYPES,
  SC_RC_TONES,
  scSafetyFunctionsFor,
  scBarriersFor,
  scInitiatorsFor,
  scCriterionSystemsFor,
  scPosNamesFor,
  SC_END_STATE_NAMES,
  type CapabilityCategory,
  type Stage,
  type Tone,
} from "./scViewData";
import { ccScore, type CcScore } from "./scSelectors";
import { type RadionuclideBarrierCriterion, type SystemSuccessCriteriaDefinition, type SharedResourceDefinition, type ComponentMissionTimeDefinition, type ComputerCodeValidation, type ExpertJudgment } from "interfaces-mef-types/sc/success-criteria-development";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { type PreOperationalAssumption } from "interfaces-mef-types/core/documentation";
import { useScWorkbook } from "./scWorkbookContext";
import { generateScReport } from "./scDocx";

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = SCIcon[name] ?? SCIcon.Link;
  return <Icon />;
}

interface ScIfaceLane {
  key: string;
  code: string;
  element: string;
  role: string;
  direction: "in" | "out";
  columns: string[];
  rows: { id: string; name: string; values: string[] }[];
  empty: string;
}

function csvList(value: string): string[] {
  return value.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
}

function ScEmpty({ title, hint }: { title: string; hint: string }): JSX.Element {
  return (
    <div className="scempty">
      <div className="scempty__title">{title}</div>
      <p className="scempty__hint">{hint}</p>
    </div>
  );
}

function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }): JSX.Element {
  return (
    <>
      <div className="scdrawer__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="scdrawer" role="dialog" aria-modal="true">{children}</aside>
    </>
  );
}

function ScScopeScreen({ ccId, setCcId, stage, setStage }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
}): JSX.Element {
  const { sc, links, editable, mutateSc } = useScWorkbook();
  const barriers = sc.radionuclideBarrierCriteria;
  const barrierSpecs = scBarriersFor(sc.uuid);
  const [openBarrierId, setOpenBarrierId] = useState<string | null>(null);
  const unusedBarrierIds = Object.keys(barrierSpecs).filter((id) => !barriers.some((b) => b.barrierId === id));

  function patchBarrier(uuid: string, patch: Partial<RadionuclideBarrierCriterion>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, radionuclideBarrierCriteria: draft.radionuclideBarrierCriteria.map((b) => (b.uuid === uuid ? { ...b, ...patch } : b)) }));
  }
  function addBarrier(): void {
    if (!editable || unusedBarrierIds.length === 0) return;
    const id = unusedBarrierIds[0];
    const record: RadionuclideBarrierCriterion = {
      uuid: id,
      barrierId: id,
      protectionParameters: [{ parameter: "", criterion: "", basis: "" }],
      challengeLoads: [],
      capacityParameters: [],
      effectivenessEvaluationMethod: "CONSERVATIVE",
      engineeringAnalysisReferences: [],
      implementsSrs: [{ sr: "SC-A4", hlr: "A" }],
    };
    mutateSc((draft) => ({ ...draft, radionuclideBarrierCriteria: [...draft.radionuclideBarrierCriteria, record] }));
    setOpenBarrierId(id);
  }
  function removeBarrier(uuid: string): void {
    if (!editable) return;
    setOpenBarrierId(null);
    mutateSc((draft) => ({ ...draft, radionuclideBarrierCriteria: draft.radionuclideBarrierCriteria.filter((b) => b.uuid !== uuid) }));
  }
  const openBarrier = barriers.find((b) => b.uuid === openBarrierId) ?? null;

  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const sfSpecs = scSafetyFunctionsFor(sc.uuid);
  const ifaceLanes: ScIfaceLane[] = [
    {
      key: "in-POS", code: "POS", element: "Plant Operating States", role: "Operating states", direction: "in",
      columns: ["Operating state", "Decay heat", "Duration (h)"],
      rows: (links?.posStates ?? []).map((st) => ({ id: st.id, name: `${st.id} · ${st.name}`, values: [st.decayLabel, String(st.durationHours)] })),
      empty: "Load an example to pull the operating states and their decay levels.",
    },
    {
      key: "in-IE", code: "IE", element: "Initiating Events", role: "Initiating-event groups", direction: "in",
      columns: ["Initiating-event group", "Frequency (/yr)", "States"],
      rows: (links?.ieGroups ?? []).map((g) => ({ id: g.id, name: `${g.id} · ${g.name}`, values: [g.frequency.toExponential(1), String(g.stateCount)] })),
      empty: "Load an example to pull the initiating-event groups and frequencies.",
    },
    {
      key: "in-ES", code: "ES", element: "Event Sequence Analysis", role: "Key safety functions", direction: "in",
      columns: ["Safety function", "What success means"],
      rows: (links?.esFunctions ?? []).map((f) => ({ id: f.id, name: f.name, values: [sfSpecs[f.id]?.desc ?? ""] })),
      empty: "Load an example to pull the key safety functions the criteria answer.",
    },
    {
      key: "out-ES", code: "ES", element: "Event Sequence Analysis", role: "Branch success criteria", direction: "out",
      columns: ["Safety function", "Event", "State", "Criterion"],
      rows: sc.safetyFunctionSuccessCriteria.map((c) => ({ id: c.uuid, name: sfSpecs[c.safetyFunctionId]?.name ?? c.safetyFunctionId, values: [c.initiatingEventId, c.plantOperatingStateId, c.criteria[0] ?? ""] })),
      empty: "No criteria stated yet.",
    },
    {
      key: "out-SY", code: "SY", element: "Systems Analysis", role: "System demands", direction: "out",
      columns: ["System", "Required capacities"],
      rows: (sc.systemSuccessCriteria ?? []).map((y) => ({ id: y.uuid, name: y.description, values: [y.requiredCapacities.map((c) => `${c.parameter}: ${c.value}`).join(" · ")] })),
      empty: "No system criteria stated yet.",
    },
    {
      key: "out-HR", code: "HR", element: "Human Reliability", role: "Operator criteria", direction: "out",
      columns: ["Operator action", "Time available", "Criterion"],
      rows: (sc.humanActionSuccessCriteria ?? []).map((h) => ({ id: h.uuid, name: h.description, values: [h.timeAvailable, h.successCriteria] })),
      empty: "No operator criteria stated yet.",
    },
  ];
  const selectedLane = ifaceLanes.find((l) => l.key === selectedTe);

  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateSc((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateSc((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
          {links !== null ? <Badge kind="ok">Linked</Badge> : <Badge kind="warn">Not linked</Badge>}
        </div>
        <p className="poscard__sub">Success Criteria reads the operating states from POS, the initiating events from IE, and the key safety functions from ES, then hands its criteria to ES, SY and HR. Select an element to see the data exchanged.</p>
        <div className="poshandoff__grid">
          {ifaceLanes.map((lane) => (
            <button key={lane.key} type="button"
              className={`poshandoff__tile${selectedTe === lane.key ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.key ? null : lane.key)}>
              <span className="poshandoff__tile-code">{lane.code}</span>
              <span className="poshandoff__tile-name">{lane.element}</span>
              <span className="poshandoff__tile-role">{lane.direction === "in" ? "Provides · " : "Consumes · "}{lane.role}</span>
            </button>
          ))}
        </div>
        {selectedLane !== undefined && (
          <div style={{ marginTop: 16 }}>
            <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
              {selectedLane.direction === "in"
                ? `Success Criteria receives ${selectedLane.role.toLowerCase()} from ${selectedLane.element}`
                : `${selectedLane.element} receives ${selectedLane.role.toLowerCase()} from Success Criteria`}
            </div>
            {selectedLane.rows.length > 0 ? (
              <table className="postable postable--mid">
                <thead><tr>{selectedLane.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {selectedLane.rows.map((r) => (
                    <tr key={r.id}>
                      <td><div className="postable__name">{r.name}</div></td>
                      {r.values.map((v, idx) => <td key={selectedLane.columns[idx + 1] ?? `c${idx}`} className="mono">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="posmuted" style={{ margin: 0 }}>{selectedLane.empty}</p>
            )}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Radionuclide transport barriers</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SCProvenanceChip kind="sc">SC-A4</SCProvenanceChip>
            {editable && unusedBarrierIds.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addBarrier}><SCIcon.Plus /> Add barrier</button>}
          </div>
        </div>
        <p className="poscard__sub">A parameter and a protecting criterion per barrier. Click a barrier to edit it.</p>
        <table className="postable">
          <thead><tr><th>Barrier</th><th>Parameter</th><th>Criterion</th><th>Method</th></tr></thead>
          <tbody>
            {barriers.map((b) => {
              const spec = barrierSpecs[b.barrierId];
              const pp = b.protectionParameters[0];
              return (
                <tr key={b.uuid} className="postable__row--clickable" onClick={() => setOpenBarrierId(b.uuid)}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      <span style={{ color: "var(--color-primary)", display: "inline-flex" }}><NamedIcon name={spec?.icon ?? "Shield"} /></span>
                      {spec?.name ?? b.barrierId}
                    </span>
                  </td>
                  <td>{pp !== undefined && pp.parameter.length > 0 ? pp.parameter : "—"}</td>
                  <td>{pp !== undefined && pp.criterion.length > 0 ? pp.criterion : "—"}</td>
                  <td><span className={`scbar__method scbar__method--${b.effectivenessEvaluationMethod.toLowerCase()}`}>{b.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic" : "Conservative"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openBarrier !== null && (() => {
        const b = openBarrier;
        const spec = barrierSpecs[b.barrierId];
        function patchParam(index: number, patch: Partial<{ parameter: string; criterion: string; basis: string }>): void {
          patchBarrier(b.uuid, { protectionParameters: b.protectionParameters.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
        }
        return (
          <Drawer onClose={() => setOpenBarrierId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Radionuclide barrier · SC-A4</div>
                <h2 className="scdrawer__title">{spec?.name ?? b.barrierId}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenBarrierId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Protection</h3></div>
                <div className="posfield-grid">
                  <div className="posfield"><label className="posfield__label">Parameter</label>
                    {editable ? <input className="posfield__input" value={b.protectionParameters[0]?.parameter ?? ""} onChange={(e) => patchParam(0, { parameter: e.target.value })} /> : <div>{b.protectionParameters[0]?.parameter ?? "—"}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Criterion</label>
                    {editable ? <input className="posfield__input" value={b.protectionParameters[0]?.criterion ?? ""} onChange={(e) => patchParam(0, { criterion: e.target.value })} /> : <div>{b.protectionParameters[0]?.criterion ?? "—"}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
                    {editable ? <input className="posfield__input posmono" value={b.protectionParameters[0]?.basis ?? ""} onChange={(e) => patchParam(0, { basis: e.target.value })} /> : <div className="posmono">{b.protectionParameters[0]?.basis ?? "—"}</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Capacity and method</h3></div>
                <div className="posfield-grid">
                  <div className="posfield"><label className="posfield__label">Evaluation method</label>
                    {editable
                      ? <select className="posfield__select" value={b.effectivenessEvaluationMethod} onChange={(e) => patchBarrier(b.uuid, { effectivenessEvaluationMethod: e.target.value === "REALISTIC" ? "REALISTIC" : "CONSERVATIVE" })}>
                          <option value="CONSERVATIVE">Conservative</option>
                          <option value="REALISTIC">Realistic</option>
                        </select>
                      : <div>{b.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic" : "Conservative"}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Capacity parameters (comma separated)</label>
                    {editable ? <input className="posfield__input" value={b.capacityParameters.join(", ")} onChange={(e) => patchBarrier(b.uuid, { capacityParameters: csvList(e.target.value) })} /> : <div>{b.capacityParameters.join(", ")}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Uncertainty assessment</label>
                    {editable
                      ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={b.uncertaintyAssessment ?? ""} onChange={(e) => patchBarrier(b.uuid, { uncertaintyAssessment: e.target.value.length === 0 ? undefined : e.target.value })} />
                      : <div>{b.uncertaintyAssessment ?? "—"}</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Challenge loads</h3></div>
                {b.challengeLoads.length > 0 ? b.challengeLoads.map((load, i) => (
                  <div key={i} className="posfield-grid" style={{ marginBottom: 8 }}>
                    <div className="posfield"><label className="posfield__label">Sequence</label>
                      {editable ? <input className="posfield__input posmono" value={load.eventSequenceReference ?? ""} onChange={(e) => patchBarrier(b.uuid, { challengeLoads: b.challengeLoads.map((x, j) => (j === i ? { ...x, eventSequenceReference: e.target.value.length === 0 ? undefined : e.target.value } : x)) })} /> : <div className="posmono">{load.eventSequenceReference ?? "—"}</div>}
                    </div>
                    <div className="posfield"><label className="posfield__label">Attributes (comma separated)</label>
                      {editable ? <input className="posfield__input" value={load.physicalAttributes.join(", ")} onChange={(e) => patchBarrier(b.uuid, { challengeLoads: b.challengeLoads.map((x, j) => (j === i ? { ...x, physicalAttributes: csvList(e.target.value) } : x)) })} /> : <div>{load.physicalAttributes.join(", ")}</div>}
                    </div>
                    <div className="posfield posfield-grid--span2"><label className="posfield__label">Load</label>
                      {editable ? <input className="posfield__input" value={load.loadDescription} onChange={(e) => patchBarrier(b.uuid, { challengeLoads: b.challengeLoads.map((x, j) => (j === i ? { ...x, loadDescription: e.target.value } : x)) })} /> : <div>{load.loadDescription}</div>}
                    </div>
                  </div>
                )) : <p className="possubtle" style={{ margin: 0, fontSize: 12.5 }}>No challenge loads recorded yet.</p>}
                {editable && (
                  <button type="button" className="posnav__btn posnav__btn--sm" style={{ marginTop: 8 }} onClick={() => patchBarrier(b.uuid, { challengeLoads: [...b.challengeLoads, { loadDescription: "", physicalAttributes: [] }] })}><SCIcon.Plus /> Add load</button>
                )}
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeBarrier(b.uuid)}><SCIcon.Close /> Remove barrier</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{(CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0]).tag}</Badge>
        </div>
        <p className="poscard__sub">Generic analyses, or realistic design-specific ones.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const score = ccScore(sc, c.id, stage);
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
                <div className="possubtle" style={{ fontSize: 11.5, marginTop: 8 }}>{score.met} of {score.applicable} SRs ready</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">Mostly a design question, so plant stage matters little here.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Criteria rest on design analyses, with three pre-operational SRs logging the design gaps."],
            ["operational", "Operational", "As-built data and procedures can confirm the criteria and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="sc-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
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

function EndStatesScreen(): JSX.Element {
  const { sc, editable, mutateSc } = useScWorkbook();
  const [openEndId, setOpenEndId] = useState<string | null>(null);
  const openEnd = sc.endStateDefinitions.find((e) => e.uuid === openEndId) ?? null;
  function patchEnd(uuid: string, patch: Partial<(typeof sc.endStateDefinitions)[number]>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, endStateDefinitions: draft.endStateDefinitions.map((e) => (e.uuid === uuid ? { ...e, ...patch } : e)) }));
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">End states</h3>
          <span className="possubtle">{sc.endStateDefinitions.length} defined · SC-A2, SC-A3</span>
        </div>
        <p className="poscard__sub">Defined once and reused across every event tree. Release categories come from Mechanistic Source Term.</p>
        {sc.endStateDefinitions.length === 0 && <ScEmpty title="No end states yet" hint="Load an example to see the end states defined against the release categories." />}
        <div className="scend">
          {sc.endStateDefinitions.map((e) => {
            const rc = e.resultingReleaseCategoryId ?? (e.releaseCategoryReferences[0] ?? "SSS");
            const tone: Tone = String(e.endState) === "SUCCESSFUL_MITIGATION" ? "ok" : SC_RC_TONES[rc] ?? "warn";
            return (
              <button type="button" key={e.uuid} className={`scend__card scend__card--${tone} scend__card--clickable`} onClick={() => setOpenEndId(e.uuid)}>
                <div className="scend__head">
                  <span className="scend__name">{SC_END_STATE_NAMES[rc] ?? (String(e.endState) === "SUCCESSFUL_MITIGATION" ? "Safe stable state" : "Radionuclide release")}</span>
                  <span className="scend__rc">{rc}</span>
                  <span className="scend__rc" style={{ marginLeft: "auto" }}>{e.implementsSrs.map((s) => s.sr).join(" · ")}</span>
                </div>
                <div className="scend__def">{e.definition}</div>
                <div className="scend__params">
                  <div className="scend__param-row">
                    <span className="scend__param-k" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-subtle)" }}>Parameter</span>
                    <span className="scend__param-v" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Criterion</span>
                    <span className="scend__param-basis">Basis</span>
                  </div>
                  {e.determiningParameters.map((p, i) => (
                    <div key={i} className="scend__param-row">
                      <span className="scend__param-k">{p.parameter}</span>
                      <span className="scend__param-v">{p.criterion}</span>
                      <span className="scend__param-basis">{p.basis}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openEnd !== null && (() => {
        const e = openEnd;
        const rc = e.resultingReleaseCategoryId ?? (e.releaseCategoryReferences[0] ?? "SSS");
        function patchParamRow(index: number, patch: Partial<{ parameter: string; criterion: string; basis: string }>): void {
          patchEnd(e.uuid, { determiningParameters: e.determiningParameters.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
        }
        return (
          <Drawer onClose={() => setOpenEndId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">End state · SC-A2, SC-A3</div>
                <h2 className="scdrawer__title">{SC_END_STATE_NAMES[rc] ?? rc}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenEndId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Definition</h3></div>
                {editable
                  ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={e.definition} onChange={(ev) => patchEnd(e.uuid, { definition: ev.target.value })} />
                  : <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{e.definition}</p>}
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Determining parameters</h3></div>
                {e.determiningParameters.map((row, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined, paddingTop: i > 0 ? 12 : 0, marginBottom: 10 }}>
                    <div className="scdrawer__param-cap"><span className="scdrawer__param-num">{i + 1}</span>{row.parameter.length > 0 ? row.parameter : "New parameter"}</div>
                    <div className="posfield-grid">
                    <div className="posfield"><label className="posfield__label">Parameter</label>
                      {editable ? <input className="posfield__input" value={row.parameter} onChange={(ev) => patchParamRow(i, { parameter: ev.target.value })} /> : <div>{row.parameter}</div>}
                    </div>
                    <div className="posfield"><label className="posfield__label">Criterion</label>
                      {editable ? <input className="posfield__input" value={row.criterion} onChange={(ev) => patchParamRow(i, { criterion: ev.target.value })} /> : <div>{row.criterion}</div>}
                    </div>
                    <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
                      {editable ? (
                        <div className="posrow" style={{ gap: 6 }}>
                          <input className="posfield__input posmono" style={{ flex: 1 }} value={row.basis} onChange={(ev) => patchParamRow(i, { basis: ev.target.value })} />
                          <button type="button" className="posnav__btn posnav__btn--sm" title="Remove row" onClick={() => patchEnd(e.uuid, { determiningParameters: e.determiningParameters.filter((_, j) => j !== i) })}><SCIcon.Close /></button>
                        </div>
                      ) : <div className="posmono">{row.basis}</div>}
                    </div>
                    </div>
                  </div>
                ))}
                {editable && (
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchEnd(e.uuid, { determiningParameters: [...e.determiningParameters, { parameter: "", criterion: "", basis: "" }] })}><SCIcon.Plus /> Add parameter</button>
                )}
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Margin and selection</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Margin justification</label>
                    {editable
                      ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={e.marginJustification ?? ""} onChange={(ev) => patchEnd(e.uuid, { marginJustification: ev.target.value.length === 0 ? undefined : ev.target.value })} />
                      : <div>{e.marginJustification ?? "—"}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Selection basis</label>
                    {editable
                      ? <input className="posfield__input" value={e.realisticSelectionBasis ?? ""} onChange={(ev) => patchEnd(e.uuid, { realisticSelectionBasis: ev.target.value.length === 0 ? undefined : ev.target.value })} />
                      : <div>{e.realisticSelectionBasis ?? "—"}</div>}
                  </div>
                </div>
              </div>
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}

interface CriteriaGroup {
  key: string;
  sf: string;
  ie: string;
  pos: string[];
  criterion: string;
  detail: string;
  analyses: string[];
}

function CriteriaScreen(): JSX.Element {
  const { sc, editable, mutateSc } = useScWorkbook();
  const safetyFunctions = scSafetyFunctionsFor(sc.uuid);
  const initiators = scInitiatorsFor(sc.uuid);
  const criterionSystems = scCriterionSystemsFor(sc.uuid);
  const posNames = scPosNamesFor(sc.uuid);
  const [sfId, setSfId] = useState("all");
  const [ieId, setIeId] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openSysId, setOpenSysId] = useState<string | null>(null);
  const [openShrId, setOpenShrId] = useState<string | null>(null);

  const rsIes = useMemo(() => new Set(sc.overallSuccessCriteria.filter((o) => o.isRiskSignificant).flatMap((o) => o.applicableInitiatingEvents ?? [])), [sc.overallSuccessCriteria]);
  const realIes = useMemo(() => new Set(sc.overallSuccessCriteria.filter((o) => o.usesRealisticCriteria === true).flatMap((o) => o.applicableInitiatingEvents ?? [])), [sc.overallSuccessCriteria]);
  const sysNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sc.systemSuccessCriteria ?? []) m.set(s.systemId, s.description);
    return m;
  }, [sc.systemSuccessCriteria]);

  const groups = useMemo<CriteriaGroup[]>(() => {
    const m = new Map<string, CriteriaGroup>();
    for (const c of sc.safetyFunctionSuccessCriteria) {
      const key = `${c.safetyFunctionId}|${c.initiatingEventId}`;
      const existing = m.get(key);
      if (existing !== undefined) existing.pos.push(c.plantOperatingStateId);
      else m.set(key, { key, sf: c.safetyFunctionId, ie: c.initiatingEventId, pos: [c.plantOperatingStateId], criterion: c.criteria[0] ?? "", detail: c.criteria[1] ?? "", analyses: c.engineeringAnalysisReferences });
    }
    return Array.from(m.values());
  }, [sc.safetyFunctionSuccessCriteria]);

  const filtered = groups.filter((g) => (sfId === "all" || g.sf === sfId) && (ieId === "all" || g.ie === ieId));
  const activeFilters = (sfId === "all" ? 0 : 1) + (ieId === "all" ? 0 : 1);
  const openGroup = groups.find((g) => g.key === openKey) ?? null;

  function rowsOf(key: string): { sf: string; ie: string } {
    const [sf, ie] = key.split("|");
    return { sf, ie };
  }
  function patchGroup(key: string, patch: { criterion?: string; detail?: string; analyses?: string[] }): void {
    if (!editable) return;
    const { sf, ie } = rowsOf(key);
    mutateSc((draft) => ({
      ...draft,
      safetyFunctionSuccessCriteria: draft.safetyFunctionSuccessCriteria.map((c) => {
        if (c.safetyFunctionId !== sf || c.initiatingEventId !== ie) return c;
        const criterion = patch.criterion ?? c.criteria[0] ?? "";
        const detail = patch.detail ?? c.criteria[1] ?? "";
        return { ...c, criteria: [criterion, detail], engineeringAnalysisReferences: patch.analyses ?? c.engineeringAnalysisReferences };
      }),
    }));
  }
  function setGroupIdentity(key: string, next: { sf?: string; ie?: string }): void {
    if (!editable) return;
    const { sf, ie } = rowsOf(key);
    const newSf = next.sf ?? sf;
    const newIe = next.ie ?? ie;
    mutateSc((draft) => ({
      ...draft,
      safetyFunctionSuccessCriteria: draft.safetyFunctionSuccessCriteria.map((c) =>
        c.safetyFunctionId === sf && c.initiatingEventId === ie
          ? { ...c, uuid: `SFC-${newSf}-${newIe}-${c.plantOperatingStateId}`, safetyFunctionId: newSf, initiatingEventId: newIe }
          : c),
    }));
    setOpenKey(`${newSf}|${newIe}`);
  }
  function addPos(key: string, pos: string): void {
    if (!editable || pos.length === 0) return;
    const { sf, ie } = rowsOf(key);
    const sample = sc.safetyFunctionSuccessCriteria.find((c) => c.safetyFunctionId === sf && c.initiatingEventId === ie);
    if (sample === undefined) return;
    mutateSc((draft) => ({
      ...draft,
      safetyFunctionSuccessCriteria: [...draft.safetyFunctionSuccessCriteria, { ...sample, uuid: `SFC-${sf}-${ie}-${pos}`, plantOperatingStateId: pos }],
    }));
  }
  function removePos(key: string, pos: string): void {
    if (!editable) return;
    const { sf, ie } = rowsOf(key);
    mutateSc((draft) => ({
      ...draft,
      safetyFunctionSuccessCriteria: draft.safetyFunctionSuccessCriteria.filter((c) => !(c.safetyFunctionId === sf && c.initiatingEventId === ie && c.plantOperatingStateId === pos)),
    }));
  }
  function removeGroup(key: string): void {
    if (!editable) return;
    const { sf, ie } = rowsOf(key);
    setOpenKey(null);
    mutateSc((draft) => ({
      ...draft,
      safetyFunctionSuccessCriteria: draft.safetyFunctionSuccessCriteria.filter((c) => !(c.safetyFunctionId === sf && c.initiatingEventId === ie)),
    }));
  }
  function addGroup(): void {
    if (!editable) return;
    const used = new Set(groups.map((g) => g.key));
    let pick: { sf: string; ie: string } | null = null;
    for (const sf of Object.keys(safetyFunctions)) {
      for (const ie of Object.keys(initiators)) {
        if (!used.has(`${sf}|${ie}`)) { pick = { sf, ie }; break; }
      }
      if (pick !== null) break;
    }
    if (pick === null) return;
    const chosen = pick;
    mutateSc((draft) => ({
      ...draft,
      safetyFunctionSuccessCriteria: [...draft.safetyFunctionSuccessCriteria, {
        uuid: `SFC-${chosen.sf}-${chosen.ie}-POS-01`,
        safetyFunctionId: chosen.sf,
        initiatingEventId: chosen.ie,
        plantOperatingStateId: "POS-01",
        criteria: ["", ""],
        engineeringAnalysisReferences: [],
        implementsSrs: [{ sr: "SC-A5", hlr: "A" }],
      }],
    }));
    setOpenKey(`${chosen.sf}|${chosen.ie}`);
  }

  const openSys = (sc.systemSuccessCriteria ?? []).find((s) => s.uuid === openSysId) ?? null;
  const openShr = (sc.sharedResources ?? []).find((r) => r.uuid === openShrId) ?? null;

  function patchSys(uuid: string, patch: Partial<SystemSuccessCriteriaDefinition>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, systemSuccessCriteria: (draft.systemSuccessCriteria ?? []).map((x) => (x.uuid === uuid ? { ...x, ...patch } : x)) }));
  }
  function removeSys(uuid: string): void {
    if (!editable) return;
    setOpenSysId(null);
    mutateSc((draft) => ({ ...draft, systemSuccessCriteria: (draft.systemSuccessCriteria ?? []).filter((x) => x.uuid !== uuid) }));
  }
  function addSys(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, systemSuccessCriteria: [...(draft.systemSuccessCriteria ?? []), {
      uuid, systemId: "SYS-", description: "", requiredCapacities: [], systemDependencies: [],
      analysisReferences: [], overallSuccessCriteriaId: draft.overallSuccessCriteria[0]?.uuid ?? "", implementsSrs: [{ sr: "SC-A5", hlr: "A" }],
    }] }));
    setOpenSysId(uuid);
  }
  function patchShr(uuid: string, patch: Partial<SharedResourceDefinition>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, sharedResources: (draft.sharedResources ?? []).map((x) => (x.uuid === uuid ? { ...x, ...patch } : x)) }));
  }
  function removeShr(uuid: string): void {
    if (!editable) return;
    setOpenShrId(null);
    mutateSc((draft) => ({ ...draft, sharedResources: (draft.sharedResources ?? []).filter((x) => x.uuid !== uuid) }));
  }
  function addShr(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, sharedResources: [...(draft.sharedResources ?? []), {
      uuid, name: "", description: "", sharedBySystems: [], sharedByReactors: [], commonInitiatingEventReferences: [],
      allocationStrategy: "", successCriteriaImpact: "", analysisReferences: [], implementsSrs: [{ sr: "SC-A6", hlr: "A" }],
    }] }));
    setOpenShrId(uuid);
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Success criteria table</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">{groups.length} criteria · SC-A5</span>
            <button type="button" className={`posnav__btn posnav__btn--sm${activeFilters > 0 ? " posnav__btn--primary" : ""}`} onClick={() => setFilterOpen(!filterOpen)}><SCIcon.Filter /> Filter{activeFilters > 0 ? ` · ${activeFilters}` : ""}</button>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addGroup}><SCIcon.Plus /> Add criterion</button>}
          </div>
        </div>
        <p className="poscard__sub">A criterion per function, per event, per state. Select a card for the full record.</p>
        {filterOpen && (
          <div className="sccrit-filter">
            <div className="sccrit-filter__group">
              <span className="sccrit-filter__label">Function</span>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                <button type="button" className={`poschip${sfId === "all" ? " poschip--primary" : ""}`} onClick={() => setSfId("all")}>All</button>
                {Object.values(safetyFunctions).map((s) => (
                  <button key={s.id} type="button" className={`poschip${sfId === s.id ? " poschip--primary" : ""}`} onClick={() => setSfId(s.id)}>{s.id}</button>
                ))}
              </div>
            </div>
            <div className="sccrit-filter__group">
              <span className="sccrit-filter__label">Event</span>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                <button type="button" className={`poschip${ieId === "all" ? " poschip--primary" : ""}`} onClick={() => setIeId("all")}>All</button>
                {Object.values(initiators).map((i) => (
                  <button key={i.id} type="button" className={`poschip${ieId === i.id ? " poschip--primary" : ""}`} onClick={() => setIeId(i.id)}>{i.short}</button>
                ))}
              </div>
            </div>
            {activeFilters > 0 && (
              <div><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setSfId("all"); setIeId("all"); }}>Clear filters</button></div>
            )}
          </div>
        )}
        <div className="sccrit">
          {filtered.length === 0 && <p className="possubtle" style={{ fontSize: 12.5, padding: "8px 2px" }}>No criterion recorded for this combination yet.</p>}
          {filtered.map((g) => {
            const sf = safetyFunctions[g.sf];
            const ie = initiators[g.ie];
            const rs = rsIes.has(g.ie);
            const real = realIes.has(g.ie);
            return (
              <button key={g.key} type="button" className="sccrit__card" onClick={() => setOpenKey(g.key)}>
                <div className="sccrit__bar">
                  <span className="sccrit__sf"><span className="sccrit__sf-icon"><NamedIcon name={sf?.icon ?? "Target"} /></span>{sf?.name ?? g.sf}</span>
                  <span className="sccrit__dim sccrit__dim--ie">{ie?.short ?? g.ie}</span>
                  <span className="sccrit__bar-spacer" />
                  <span className={`sccrit__rs sccrit__rs--${rs ? "yes" : "no"}`}>{rs ? "Risk significant" : "Not risk significant"}</span>
                </div>
                <div className="sccrit__body">
                  <div className="sccrit__statement">{g.criterion}</div>
                  {g.detail.length > 0 && <div className="sccrit__detail">{g.detail}</div>}
                  <div className="sccrit__foot">
                    {g.pos.map((p) => <span key={p} className="sccrit__pos">{p}</span>)}
                    <span className={`sccrit__cc sccrit__cc--${real ? "real" : "generic"}`}>{real ? "Realistic (CC-II)" : "Generic (CC-I)"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {((sc.systemSuccessCriteria ?? []).length > 0 || editable) && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">System success criteria</h3>
            <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
              <span className="possubtle">What each system must deliver</span>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSys}><SCIcon.Plus /> Add system</button>}
            </div>
          </div>
          <p className="poscard__sub">Each criterion becomes a concrete demand on its systems, modeled by SY. Select a system to edit it.</p>
          <div className="scsys">
            {(sc.systemSuccessCriteria ?? []).map((s) => (
              <button key={s.uuid} type="button" className="scsys__card scsys__card--clickable" onClick={() => setOpenSysId(s.uuid)}>
                <div className="scsys__head">
                  <span className="scsys__icon"><SCIcon.Settings /></span>
                  <span className="scsys__name">{s.description}</span>
                </div>
                <div className="scsys__cap">
                  {s.requiredCapacities.map((cap, i) => (
                    <Fragment key={i}>
                      <span className="scsys__cap-k">{cap.parameter}</span>
                      <span className="scsys__cap-v">{cap.value}</span>
                    </Fragment>
                  ))}
                </div>
                <div className="scsys__dep">{(s.systemDependencies ?? []).length === 0 ? "No support-system dependencies." : (s.systemDependencies ?? []).map((d) => d.dependencyNature).join(" ")}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {((sc.sharedResources ?? []).length > 0 || editable) && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Shared systems</h3>
            <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
              <SCProvenanceChip kind="sc">SC-A6</SCProvenanceChip>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addShr}><SCIcon.Plus /> Add resource</button>}
            </div>
          </div>
          <p className="poscard__sub">Single reactor, so sharing is about resources serving more than one source. Select a resource to edit it.</p>
          <div className="scsys">
            {(sc.sharedResources ?? []).map((r) => (
              <button key={r.uuid} type="button" className="scsys__card scsys__card--clickable" onClick={() => setOpenShrId(r.uuid)}>
                <div className="scsys__head">
                  <span className="scsys__icon"><SCIcon.Group /></span>
                  <span className="scsys__name">{r.name}</span>
                </div>
                <div className="scsys__cap">
                  <span className="scsys__cap-k">Shared by</span><span className="scsys__cap-v" style={{ fontFamily: "inherit", fontWeight: 600 }}>{r.description}</span>
                  <span className="scsys__cap-k">Common initiator</span><span className="scsys__cap-v" style={{ fontFamily: "inherit", fontWeight: 600 }}>{r.commonInitiatingEventReferences.join(", ")}</span>
                </div>
                <div className="scsys__dep">{r.allocationStrategy} {r.successCriteriaImpact}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {openGroup !== null && (() => {
        const g = openGroup;
        const sf = safetyFunctions[g.sf];
        const ie = initiators[g.ie];
        const real = realIes.has(g.ie);
        const rs = rsIes.has(g.ie);
        const systems = criterionSystems[g.key] ?? [];
        return (
          <Drawer onClose={() => setOpenKey(null)}>
            <div className="scdrawer__head">
              <div>
                <div className="scdrawer__cap">Success criterion · SC-A5</div>
                <h2 className="scdrawer__title">{sf?.name ?? g.sf}</h2>
                <p className="scdrawer__sub">{ie?.name ?? g.ie} · {g.pos.join(", ")}</p>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenKey(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body">
              {editable
                ? <div><div className="scsec">Criterion</div><textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={g.criterion} onChange={(e) => patchGroup(g.key, { criterion: e.target.value })} /></div>
                : <div><div className="scsec">Criterion</div><p className="scdrawer__text" style={{ fontWeight: 600 }}>{g.criterion}</p></div>}
              {editable
                ? <div><div className="scsec">How it is met</div><textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={g.detail} onChange={(e) => patchGroup(g.key, { detail: e.target.value })} /></div>
                : g.detail.length > 0 && <div><div className="scsec">How it is met</div><p className="scdrawer__text">{g.detail}</p></div>}
              <div className="posfield-grid">
                <div className="posfield"><label className="posfield__label">Safety function</label>
                  {editable
                    ? <select className="posfield__select" value={g.sf} onChange={(e) => setGroupIdentity(g.key, { sf: e.target.value })}>
                        {Object.values(safetyFunctions).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    : <div style={{ fontWeight: 700 }}>{sf?.name ?? g.sf}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Initiating event</label>
                  {editable
                    ? <select className="posfield__select" value={g.ie} onChange={(e) => setGroupIdentity(g.key, { ie: e.target.value })}>
                        {Object.values(initiators).map((x) => <option key={x.id} value={x.id}>{x.id} · {x.short}</option>)}
                      </select>
                    : <div className="posmono">{g.ie}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Operating states</label>
                  <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                    {g.pos.map((pos) => (
                      <span key={pos} className="poschip poschip--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={posNames[pos] ?? pos}>
                        {pos}
                        {editable && g.pos.length > 1 && <button type="button" title="Remove" onClick={() => removePos(g.key, pos)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>}
                      </span>
                    ))}
                    {editable && Object.keys(posNames).filter((posId) => !g.pos.includes(posId)).length > 0 && (
                      <select className="posfield__select" style={{ maxWidth: 200 }} value="" onChange={(e) => addPos(g.key, e.target.value)}>
                        <option value="">Add a state…</option>
                        {Object.keys(posNames).filter((posId) => !g.pos.includes(posId)).map((posId) => <option key={posId} value={posId}>{posId} · {posNames[posId]}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div className="posfield"><label className="posfield__label">Capability</label><div>{real ? "Realistic (CC-II)" : "Generic (CC-I)"}</div></div>
                <div className="posfield"><label className="posfield__label">Analyses (comma separated)</label>
                  {editable ? <input className="posfield__input posmono" value={g.analyses.join(", ")} onChange={(e) => patchGroup(g.key, { analyses: csvList(e.target.value) })} /> : <div className="posmono">{g.analyses.join(", ")}</div>}
                </div>
              </div>
              {systems.length > 0 && (
                <div><div className="scsec">Systems credited</div><div className="posrow posrow--wrap" style={{ gap: 6 }}>{systems.map((s) => <span key={s} className="poschip">{sysNameById.get(s) ?? s}</span>)}</div></div>
              )}
              {g.analyses.length > 0 && (
                <div><div className="scsec">Supporting analyses</div><div className="posrow posrow--wrap" style={{ gap: 6 }}>{g.analyses.map((a) => <span key={a} className="poschip poschip--method"><SCIcon.Beaker /> {a}</span>)}</div></div>
              )}
              {rs && <div className="scwarn"><span className="scwarn__icon"><SCIcon.Warn /></span><span>Risk-significant sequence, so CC-II requires realistic, design-specific analysis here.</span></div>}
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeGroup(g.key)}><SCIcon.Close /> Remove criterion</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {openSys !== null && (() => {
        const s = openSys;
        function patchCap(i: number, patch: Partial<{ parameter: string; value: string; basis: string }>): void {
          patchSys(s.uuid, { requiredCapacities: s.requiredCapacities.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
        }
        function patchDep(i: number, patch: Partial<{ dependentSystemId: string; dependencyNature: string }>): void {
          patchSys(s.uuid, { systemDependencies: (s.systemDependencies ?? []).map((d, j) => (j === i ? { ...d, ...patch } : d)) });
        }
        return (
          <Drawer onClose={() => setOpenSysId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">System success criterion · SC-A5</div>
                <h2 className="scdrawer__title">{s.description.length > 0 ? s.description : s.systemId}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenSysId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">System</h3></div>
                <div className="posfield-grid">
                  <div className="posfield"><label className="posfield__label">Name</label>
                    {editable ? <input className="posfield__input" value={s.description} onChange={(e) => patchSys(s.uuid, { description: e.target.value })} /> : <div>{s.description}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">System id</label>
                    {editable ? <input className="posfield__input posmono" value={s.systemId} onChange={(e) => patchSys(s.uuid, { systemId: e.target.value })} /> : <div className="posmono">{s.systemId}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Serves overall criterion</label>
                    {editable ? (
                      <select className="posfield__select" value={s.overallSuccessCriteriaId} onChange={(e) => patchSys(s.uuid, { overallSuccessCriteriaId: e.target.value })}>
                        {sc.overallSuccessCriteria.map((o) => <option key={o.uuid} value={o.uuid}>{o.uuid} · {o.description}</option>)}
                      </select>
                    ) : <div className="posmono">{s.overallSuccessCriteriaId}</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Required capacities</h3></div>
                {s.requiredCapacities.map((row, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined, paddingTop: i > 0 ? 12 : 0, marginBottom: 10 }}>
                    <div className="scdrawer__param-cap"><span className="scdrawer__param-num">{i + 1}</span>{row.parameter.length > 0 ? row.parameter : "New capacity"}</div>
                    <div className="posfield-grid">
                    <div className="posfield"><label className="posfield__label">Parameter</label>
                      {editable ? <input className="posfield__input" value={row.parameter} onChange={(e) => patchCap(i, { parameter: e.target.value })} /> : <div>{row.parameter}</div>}
                    </div>
                    <div className="posfield"><label className="posfield__label">Value</label>
                      {editable ? <input className="posfield__input" value={row.value} onChange={(e) => patchCap(i, { value: e.target.value })} /> : <div>{row.value}</div>}
                    </div>
                    <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
                      {editable ? (
                        <div className="posrow" style={{ gap: 6 }}>
                          <input className="posfield__input posmono" style={{ flex: 1 }} value={row.basis} onChange={(e) => patchCap(i, { basis: e.target.value })} />
                          <button type="button" className="posnav__btn posnav__btn--sm" title="Remove capacity" onClick={() => patchSys(s.uuid, { requiredCapacities: s.requiredCapacities.filter((_, j) => j !== i) })}><SCIcon.Close /></button>
                        </div>
                      ) : <div className="posmono">{row.basis}</div>}
                    </div>
                    </div>
                  </div>
                ))}
                {editable && (
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchSys(s.uuid, { requiredCapacities: [...s.requiredCapacities, { parameter: "", value: "", basis: "" }] })}><SCIcon.Plus /> Add capacity</button>
                )}
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Support dependencies</h3></div>
                {(s.systemDependencies ?? []).length === 0 && <p className="possubtle" style={{ margin: 0, fontSize: 12.5 }}>No support-system dependencies.</p>}
                {(s.systemDependencies ?? []).map((d, i) => (
                  <div key={i} className="posfield-grid" style={{ marginBottom: 8 }}>
                    <div className="posfield"><label className="posfield__label">Support system</label>
                      {editable ? <input className="posfield__input posmono" value={d.dependentSystemId} onChange={(e) => patchDep(i, { dependentSystemId: e.target.value })} /> : <div className="posmono">{d.dependentSystemId}</div>}
                    </div>
                    <div className="posfield"><label className="posfield__label">What it provides</label>
                      {editable ? (
                        <div className="posrow" style={{ gap: 6 }}>
                          <input className="posfield__input" style={{ flex: 1 }} value={d.dependencyNature} onChange={(e) => patchDep(i, { dependencyNature: e.target.value })} />
                          <button type="button" className="posnav__btn posnav__btn--sm" title="Remove dependency" onClick={() => patchSys(s.uuid, { systemDependencies: (s.systemDependencies ?? []).filter((_, j) => j !== i) })}><SCIcon.Close /></button>
                        </div>
                      ) : <div>{d.dependencyNature}</div>}
                    </div>
                  </div>
                ))}
                {editable && (
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchSys(s.uuid, { systemDependencies: [...(s.systemDependencies ?? []), { dependentSystemId: "", dependencyNature: "" }] })}><SCIcon.Plus /> Add dependency</button>
                )}
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeSys(s.uuid)}><SCIcon.Close /> Remove criterion</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {openShr !== null && (() => {
        const r = openShr;
        return (
          <Drawer onClose={() => setOpenShrId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Shared resource · SC-A6</div>
                <h2 className="scdrawer__title">{r.name.length > 0 ? r.name : "Shared resource"}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenShrId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Resource</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
                    {editable ? <input className="posfield__input" value={r.name} onChange={(e) => patchShr(r.uuid, { name: e.target.value })} /> : <div>{r.name}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Shared by</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.description} onChange={(e) => patchShr(r.uuid, { description: e.target.value })} /> : <div>{r.description}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Systems</label>
                    {editable ? <input className="posfield__input posmono" value={r.sharedBySystems.join(", ")} onChange={(e) => patchShr(r.uuid, { sharedBySystems: csvList(e.target.value) })} /> : <div className="posmono">{r.sharedBySystems.join(", ")}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Common initiators</label>
                    {editable ? <input className="posfield__input posmono" value={r.commonInitiatingEventReferences.join(", ")} onChange={(e) => patchShr(r.uuid, { commonInitiatingEventReferences: csvList(e.target.value) })} /> : <div className="posmono">{r.commonInitiatingEventReferences.join(", ")}</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Treatment</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Allocation</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.allocationStrategy} onChange={(e) => patchShr(r.uuid, { allocationStrategy: e.target.value })} /> : <div>{r.allocationStrategy}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Impact on the criteria</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.successCriteriaImpact} onChange={(e) => patchShr(r.uuid, { successCriteriaImpact: e.target.value })} /> : <div>{r.successCriteriaImpact}</div>}
                  </div>
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeShr(r.uuid)}><SCIcon.Close /> Remove resource</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}

function MissionScreen(): JSX.Element {
  const { sc, links, editable, mutateSc } = useScWorkbook();
  const seqInfo = links?.esSequenceInfo ?? {};
  const MAX_H = 96;
  const pct = (h: number): number => Math.max(4, Math.min(100, (h / MAX_H) * 100));
  const minPct = (24 / MAX_H) * 100;
  const [openMtId, setOpenMtId] = useState<string | null>(null);
  const openMt = sc.missionTimes.find((m) => m.uuid === openMtId) ?? null;
  const [openCmtId, setOpenCmtId] = useState<string | null>(null);
  const openCmt = (sc.componentMissionTimes ?? []).find((c) => c.uuid === openCmtId) ?? null;

  function patchMt(uuid: string, patch: Partial<(typeof sc.missionTimes)[number]>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, missionTimes: draft.missionTimes.map((m) => (m.uuid === uuid ? { ...m, ...patch } : m)) }));
  }
  function addMt(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, missionTimes: [...draft.missionTimes, { uuid: id, eventSequenceReference: "", missionTimeHours: 24, basis: "", safeStableStateAchievedWithinMissionTime: true, analysisReferences: [], implementsSrs: [{ sr: "SC-A7", hlr: "A" }] }] }));
    setOpenMtId(id);
  }
  function removeMt(uuid: string): void {
    if (!editable) return;
    setOpenMtId(null);
    mutateSc((draft) => ({ ...draft, missionTimes: draft.missionTimes.filter((m) => m.uuid !== uuid) }));
  }
  function patchCmt(uuid: string, patch: Partial<ComponentMissionTimeDefinition>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, componentMissionTimes: (draft.componentMissionTimes ?? []).map((c) => (c.uuid === uuid ? { ...c, ...patch } : c)) }));
  }
  function addCmt(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, componentMissionTimes: [...(draft.componentMissionTimes ?? []), { uuid: id, componentId: "", missionTimeHours: 24, eventSequenceReference: "", analysisReferences: [], implementsSrs: [{ sr: "SC-A8", hlr: "A" }] }] }));
    setOpenCmtId(id);
  }
  function removeCmt(uuid: string): void {
    if (!editable) return;
    setOpenCmtId(null);
    mutateSc((draft) => ({ ...draft, componentMissionTimes: (draft.componentMissionTimes ?? []).filter((c) => c.uuid !== uuid) }));
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sequence mission times</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SCProvenanceChip kind="sc">SC-A7</SCProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMt}><SCIcon.Plus /> Add mission time</button>}
          </div>
        </div>
        <p className="poscard__sub">Minimum 24 hours to a safe stable state. Shortfalls need a treatment. Click a row to edit it.</p>
        <div className="scmt">
          {sc.missionTimes.map((m) => {
            const reaches = m.safeStableStateAchievedWithinMissionTime;
            const info = seqInfo[m.eventSequenceReference];
            return (
              <button type="button" key={m.uuid} className="scmt__row scmt__row--clickable" onClick={() => setOpenMtId(m.uuid)}>
                <div>
                  <div className="scmt__seq">{m.eventSequenceReference}{info !== undefined && info.scenario.length > 0 ? ` · ${info.scenario}` : ""}</div>
                  {info !== undefined && (
                    <div className="scmt__ie">
                      {info.ieId.length > 0 && <span>{info.ieId} →</span>}
                      {info.states.map((st) => (
                        <span key={st.fn} className="scqlight"><span className={`scqlight__dot scqlight__dot--${st.ok ? "s" : "f"}`} />{st.fn}</span>
                      ))}
                      <span>→ {info.outcome}</span>
                    </div>
                  )}
                  <div className="scmt__basis">{m.basis}</div>
                  {m.treatmentJustification !== undefined && (
                    <div className="scmt__treat"><SCIcon.Warn /><span>{m.treatmentJustification}</span></div>
                  )}
                </div>
                <div className="scmt__gauge">
                  <div className="scmt__gauge-head">
                    <span className="scmt__gauge-val">{m.missionTimeHours} h</span>
                    <span className={`scmt__reach scmt__reach--${reaches ? "ok" : "no"}`}>
                      <span className={`scqlight__dot scqlight__dot--${reaches ? "s" : "f"}`} />{reaches ? "Reaches safe state" : "Treatment applied"}
                    </span>
                  </div>
                  <div className="scmt__track" style={{ marginTop: 14 }}>
                    <div className={`scmt__fill ${reaches ? "scmt__fill--ok" : "scmt__fill--warn"}`} style={{ width: `${pct(m.missionTimeHours)}%` }} />
                    <div className="scmt__min" style={{ left: `${minPct}%` }}><span className="scmt__min-lab">24 h min</span></div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openMt !== null && (() => {
        const m = openMt;
        return (
          <Drawer onClose={() => setOpenMtId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Mission time · SC-A7</div>
                <h2 className="scdrawer__title">{m.eventSequenceReference.length > 0 ? m.eventSequenceReference : m.uuid}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenMtId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Sequence and time</h3></div>
                <div className="posfield-grid">
                  <div className="posfield"><label className="posfield__label">Sequence</label>
                    {editable ? <input className="posfield__input posmono" value={m.eventSequenceReference} onChange={(e) => patchMt(m.uuid, { eventSequenceReference: e.target.value })} /> : <div className="posmono">{m.eventSequenceReference}</div>}
                    {seqInfo[m.eventSequenceReference] !== undefined && <div className="possubtle" style={{ fontSize: 11.5, marginTop: 4 }}>{`${seqInfo[m.eventSequenceReference].scenario} → ${seqInfo[m.eventSequenceReference].outcome}`}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Mission time (h)</label>
                    {editable ? <input className="posfield__input posmono" value={String(m.missionTimeHours)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) patchMt(m.uuid, { missionTimeHours: v }); }} /> : <div className="posmono">{m.missionTimeHours} h</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={m.basis} onChange={(e) => patchMt(m.uuid, { basis: e.target.value })} /> : <div>{m.basis}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Analyses (comma separated)</label>
                    {editable ? <input className="posfield__input posmono" value={m.analysisReferences.join(", ")} onChange={(e) => patchMt(m.uuid, { analysisReferences: csvList(e.target.value) })} /> : <div className="posmono">{m.analysisReferences.join(", ")}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Risk significant</label>
                    {editable
                      ? <select className="posfield__select" value={m.isRiskSignificant === true ? "yes" : "no"} onChange={(e) => patchMt(m.uuid, { isRiskSignificant: e.target.value === "yes" })}>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      : <div>{m.isRiskSignificant === true ? "Yes" : "No"}</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Safe stable state</h3></div>
                <div className="posfield-grid">
                  <div className="posfield"><label className="posfield__label">Reached within the mission time</label>
                    {editable
                      ? <select className="posfield__select" value={m.safeStableStateAchievedWithinMissionTime ? "yes" : "no"} onChange={(e) => { const yes = e.target.value === "yes"; patchMt(m.uuid, { safeStableStateAchievedWithinMissionTime: yes, treatmentWhenNotAchieved: yes ? undefined : (m.treatmentWhenNotAchieved ?? "ADDITIONAL_EVALUATION"), treatmentJustification: yes ? undefined : m.treatmentJustification }); }}>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      : <div>{m.safeStableStateAchievedWithinMissionTime ? "Yes" : "No"}</div>}
                  </div>
                  {!m.safeStableStateAchievedWithinMissionTime && (
                    <div className="posfield"><label className="posfield__label">Treatment</label>
                      {editable
                        ? <select className="posfield__select" value={m.treatmentWhenNotAchieved ?? "ADDITIONAL_EVALUATION"} onChange={(e) => patchMt(m.uuid, { treatmentWhenNotAchieved: e.target.value === "CONSERVATIVE_END_STATE" ? "CONSERVATIVE_END_STATE" : e.target.value === "EXTENDED_MISSION_TIME" ? "EXTENDED_MISSION_TIME" : "ADDITIONAL_EVALUATION" })}>
                            <option value="CONSERVATIVE_END_STATE">Conservative end state</option>
                            <option value="EXTENDED_MISSION_TIME">Extended mission time</option>
                            <option value="ADDITIONAL_EVALUATION">Additional evaluation</option>
                          </select>
                        : <div>{m.treatmentWhenNotAchieved ?? "—"}</div>}
                    </div>
                  )}
                  {!m.safeStableStateAchievedWithinMissionTime && (
                    <div className="posfield posfield-grid--span2"><label className="posfield__label">Treatment justification</label>
                      {editable
                        ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={m.treatmentJustification ?? ""} onChange={(e) => patchMt(m.uuid, { treatmentJustification: e.target.value.length === 0 ? undefined : e.target.value })} />
                        : <div>{m.treatmentJustification ?? "—"}</div>}
                    </div>
                  )}
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeMt(m.uuid)}><SCIcon.Close /> Remove mission time</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {openCmt !== null && (() => {
        const c = openCmt;
        return (
          <Drawer onClose={() => setOpenCmtId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Component mission time · SC-A8</div>
                <h2 className="scdrawer__title">{c.componentId.length > 0 ? c.componentId : "Component"}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenCmtId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Component and time</h3></div>
                <div className="posfield-grid">
                  <div className="posfield"><label className="posfield__label">Component</label>
                    {editable ? <input className="posfield__input" value={c.componentId} onChange={(e) => patchCmt(c.uuid, { componentId: e.target.value })} /> : <div>{c.componentId}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Component time (h)</label>
                    {editable ? <input className="posfield__input posmono" value={String(c.missionTimeHours)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) patchCmt(c.uuid, { missionTimeHours: v }); }} /> : <div className="posmono">{c.missionTimeHours} h</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Sequence</label>
                    {editable ? <input className="posfield__input posmono" value={c.eventSequenceReference} onChange={(e) => patchCmt(c.uuid, { eventSequenceReference: e.target.value })} /> : <div className="posmono">{c.eventSequenceReference}</div>}
                    {seqInfo[c.eventSequenceReference] !== undefined && <div className="possubtle" style={{ fontSize: 11.5, marginTop: 4 }}>{`${seqInfo[c.eventSequenceReference].scenario} → ${seqInfo[c.eventSequenceReference].outcome}`}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Analyses (comma separated)</label>
                    {editable ? <input className="posfield__input posmono" value={c.analysisReferences.join(", ")} onChange={(e) => patchCmt(c.uuid, { analysisReferences: csvList(e.target.value) })} /> : <div className="posmono">{c.analysisReferences.join(", ")}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Shorter-time justification</label>
                    {editable
                      ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.shorterMissionTimeJustification ?? ""} onChange={(e) => patchCmt(c.uuid, { shorterMissionTimeJustification: e.target.value.length === 0 ? undefined : e.target.value })} />
                      : <div>{c.shorterMissionTimeJustification ?? "—"}</div>}
                  </div>
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeCmt(c.uuid)}><SCIcon.Close /> Remove component time</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {((sc.componentMissionTimes ?? []).length > 0 || editable) && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Component mission times</h3>
            <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
              <SCProvenanceChip kind="sc">SC-A8</SCProvenanceChip>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCmt}><SCIcon.Plus /> Add component</button>}
            </div>
          </div>
          <p className="poscard__sub">Each component time must support its sequence, or be justified. Click a row to edit it.</p>
          <table className="postable">
            <thead><tr><th>Component</th><th>Component time</th><th>Sequence</th><th>Supports</th></tr></thead>
            <tbody>
              {(sc.componentMissionTimes ?? []).map((c) => {
                const justified = c.shorterMissionTimeJustification !== undefined;
                return (
                  <tr key={c.uuid} className="postable__row--clickable" onClick={() => setOpenCmtId(c.uuid)}>
                    <td style={{ fontWeight: 600 }}>{c.componentId}
                      {justified && <div className="possubtle" style={{ fontSize: 11.5, marginTop: 2, fontWeight: 400 }}>{c.shorterMissionTimeJustification}</div>}
                    </td>
                    <td className="posmono">{c.missionTimeHours} h</td>
                    <td className="posmono">{c.eventSequenceReference}</td>
                    <td>{justified ? <Badge kind="warn">Justified</Badge> : <Badge kind="ok">Direct</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function BasesScreen(): JSX.Element {
  const { sc, editable, mutateSc } = useScWorkbook();
  const [openId, setOpenId] = useState<string | null>(null);
  const openAnalysis = sc.engineeringAnalyses.find((a) => a.uuid === openId) ?? null;
  const [openCodeId, setOpenCodeId] = useState<string | null>(null);
  const openCode = (sc.computerCodeValidations ?? []).find((c) => c.uuid === openCodeId) ?? null;
  const [openBarId, setOpenBarId] = useState<string | null>(null);
  const openBar = sc.radionuclideBarrierCriteria.find((b) => b.uuid === openBarId) ?? null;
  const [openEjId, setOpenEjId] = useState<string | null>(null);
  const openEj = (sc.expertJudgments ?? []).find((e) => e.uuid === openEjId) ?? null;

  function patchAnalysis(uuid: string, patch: Partial<(typeof sc.engineeringAnalyses)[number]>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, engineeringAnalyses: draft.engineeringAnalyses.map((a) => (a.uuid === uuid ? { ...a, ...patch } : a)) }));
  }
  function addAnalysis(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, engineeringAnalyses: [...draft.engineeringAnalyses, { uuid: id, analysisId: "", analysisType: "THERMAL_HYDRAULIC" as (typeof sc.engineeringAnalyses)[number]["analysisType"], description: "", applicabilityToPlantConditions: "", keyParametersAndResults: {}, supportedSuccessCriteria: [], implementsSrs: [{ sr: "SC-B1", hlr: "B" }] }] }));
    setOpenId(id);
  }
  function removeAnalysis(uuid: string): void {
    if (!editable) return;
    setOpenId(null);
    mutateSc((draft) => ({ ...draft, engineeringAnalyses: draft.engineeringAnalyses.filter((a) => a.uuid !== uuid) }));
  }
  function patchCode(uuid: string, patch: Partial<ComputerCodeValidation>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, computerCodeValidations: (draft.computerCodeValidations ?? []).map((c) => (c.uuid === uuid ? { ...c, ...patch } : c)) }));
  }
  function addCode(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, computerCodeValidations: [...(draft.computerCodeValidations ?? []), { uuid: id, name: "", computerCode: "", codeVersion: "", verificationDocumentation: "", phenomenaValidation: [], limitations: [], implementsSrs: [{ sr: "SC-B4", hlr: "B" }] }] }));
    setOpenCodeId(id);
  }
  function removeCode(uuid: string): void {
    if (!editable) return;
    setOpenCodeId(null);
    mutateSc((draft) => ({ ...draft, computerCodeValidations: (draft.computerCodeValidations ?? []).filter((c) => c.uuid !== uuid) }));
  }
  function patchBar(uuid: string, patch: Partial<RadionuclideBarrierCriterion>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, radionuclideBarrierCriteria: draft.radionuclideBarrierCriteria.map((b) => (b.uuid === uuid ? { ...b, ...patch } : b)) }));
  }
  function patchEj(uuid: string, patch: Partial<ExpertJudgment>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, expertJudgments: (draft.expertJudgments ?? []).map((e) => (e.uuid === uuid ? { ...e, ...patch } : e)) }));
  }
  function addEj(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, expertJudgments: [...(draft.expertJudgments ?? []), { uuid: id, topic: "", justification: "", panelMembers: [], processDescription: "", processDocumentationReference: "", outcome: "", informedSuccessCriteria: [], implementsSrs: [{ sr: "SC-B2", hlr: "B" }] }] }));
    setOpenEjId(id);
  }
  function removeEj(uuid: string): void {
    if (!editable) return;
    setOpenEjId(null);
    mutateSc((draft) => ({ ...draft, expertJudgments: (draft.expertJudgments ?? []).filter((e) => e.uuid !== uuid) }));
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Engineering analyses</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">{sc.engineeringAnalyses.length} analyses · SC-B1, B4, B8</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAnalysis}><SCIcon.Plus /> Add analysis</button>}
          </div>
        </div>
        <p className="poscard__sub">Each criterion rests on a validated, applicable analysis. Select a card for the full record.</p>
        <div className="scanal">
          {sc.engineeringAnalyses.map((a) => {
            const type = SC_ANALYSIS_TYPES[a.analysisType] ?? SC_ANALYSIS_TYPES.OTHER;
            return (
              <button key={a.uuid} type="button" className="scanal__card" onClick={() => setOpenId(a.uuid)}>
                <div className="scanal__top">
                  <span className="scanal__type"><NamedIcon name={type.icon} /></span>
                  <div>
                    <div className="scanal__id">{a.analysisId} · {type.label}</div>
                  </div>
                </div>
                <div className="scanal__meta"><strong>Applicability.</strong> {a.applicabilityToPlantConditions}</div>
              </button>
            );
          })}
        </div>
      </div>

      {((sc.computerCodeValidations ?? []).length > 0 || editable) && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Computer codes</h3>
            <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
              <SCProvenanceChip kind="sc">SC-B4</SCProvenanceChip>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCode}><SCIcon.Plus /> Add code</button>}
            </div>
          </div>
          <p className="poscard__sub">Each code needs accepted V&V and demonstrated applicability. Click a row to edit it.</p>
          <table className="postable">
            <thead><tr><th>Code</th><th>Validation</th><th>Limitations</th><th>Status</th></tr></thead>
            <tbody>
              {(sc.computerCodeValidations ?? []).map((c) => {
                const gap = c.validationGap !== undefined;
                return (
                  <tr key={c.uuid} className="postable__row--clickable" onClick={() => setOpenCodeId(c.uuid)}>
                    <td><span style={{ fontWeight: 700 }}>{c.name.length > 0 ? c.name : c.computerCode}</span></td>
                    <td>{c.verificationDocumentation}</td>
                    <td className="possubtle" style={{ fontSize: 12 }}>{c.limitations.join(" ")}</td>
                    <td>{gap ? <Badge kind="warn">Gap</Badge> : <Badge kind="ok">Validated</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Barrier loads against capacity</h3>
          <span className="possubtle">{sc.radionuclideBarrierCriteria.length} barriers · SC-B6, B7</span>
        </div>
        <p className="poscard__sub">Load on each barrier against the parameters defining its capacity. Click a barrier to edit it.</p>
        <div className="scbar">
          {sc.radionuclideBarrierCriteria.map((b) => {
            const spec = scBarriersFor(sc.uuid)[b.barrierId];
            return (
              <button type="button" key={b.uuid} className="scbar__card scbar__card--clickable" onClick={() => setOpenBarId(b.uuid)}>
                <div className="scbar__head">
                  <span className="scbar__barname-icon"><NamedIcon name={spec?.icon ?? "Shield"} /></span>
                  <span className="scbar__name">{spec?.short ?? b.barrierId}</span>
                  <span className={`scbar__method scbar__method--${b.effectivenessEvaluationMethod.toLowerCase()}`} style={{ marginLeft: "auto" }}>{b.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic (CC-II)" : "Conservative (CC-I)"}</span>
                </div>
                <div className="scbar__lines">
                  <div className="scbar__line">
                    <span className="scbar__tag scbar__tag--load">Load</span>
                    <div className="scbar__line-v">
                      {b.challengeLoads.length === 0 ? <div>—</div> : b.challengeLoads.map((l, i) => (
                        <div key={i}>{l.eventSequenceReference !== undefined && <span className="scbar__seq">{l.eventSequenceReference}</span>}{l.loadDescription}</div>
                      ))}
                    </div>
                  </div>
                  <div className="scbar__line">
                    <span className="scbar__tag scbar__tag--cap">Capacity</span>
                    <div className="scbar__line-v">
                      {b.capacityParameters.length === 0 ? <div>—</div> : b.capacityParameters.map((cp, i) => (
                        <div key={i}>{cp}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {((sc.expertJudgments ?? []).length > 0 || editable) && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Expert judgment</h3>
            <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
              <SCProvenanceChip kind="sc">SC-B2</SCProvenanceChip>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addEj}><SCIcon.Plus /> Add judgment</button>}
            </div>
          </div>
          <p className="poscard__sub">When data or methods are lacking, the Section 4.2 process applies. Click a record to edit it.</p>
          {(sc.expertJudgments ?? []).map((e) => (
            <button type="button" key={e.uuid} className="scsys__card scsys__card--clickable" style={{ marginTop: 4, width: "100%" }} onClick={() => setOpenEjId(e.uuid)}>
              <div className="scsys__head">
                <span className="scsys__icon"><SCIcon.Person /></span>
                <span className="scsys__name">{e.topic}</span>
              </div>
              <div className="scanal__meta"><strong>Why.</strong> {e.justification}</div>
              <div className="scanal__meta" style={{ marginTop: 4 }}><strong>Outcome.</strong> {e.outcome}</div>
            </button>
          ))}
        </div>
      )}

      {openAnalysis !== null && (() => {
        const a = openAnalysis;
        const reasonable = a.reasonablenessReview?.performed === true;
        return (
          <Drawer onClose={() => setOpenId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Engineering analysis</div>
                <h2 className="scdrawer__title">{a.description.length > 0 ? a.description : a.analysisId}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body">
              <div className="posfield-grid">
                <div className="posfield"><label className="posfield__label">Analysis id</label>
                  {editable ? <input className="posfield__input posmono" value={a.analysisId} onChange={(e) => patchAnalysis(a.uuid, { analysisId: e.target.value })} /> : <div className="posmono">{a.analysisId}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Name</label>
                  {editable ? <input className="posfield__input" value={a.description} onChange={(e) => patchAnalysis(a.uuid, { description: e.target.value })} /> : <div>{a.description}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Type</label>
                  {editable ? (
                    <select className="posfield__select" value={a.analysisType} onChange={(e) => patchAnalysis(a.uuid, { analysisType: e.target.value as (typeof sc.engineeringAnalyses)[number]["analysisType"] })}>
                      {Object.entries(SC_ANALYSIS_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                    </select>
                  ) : <div>{(SC_ANALYSIS_TYPES[a.analysisType] ?? SC_ANALYSIS_TYPES.OTHER).label}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Code or model</label>
                  {editable ? <input className="posfield__input" value={a.computerCode ?? ""} onChange={(e) => patchAnalysis(a.uuid, { computerCode: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{a.computerCode ?? "—"}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Version</label>
                  {editable ? <input className="posfield__input posmono" value={a.codeVersion ?? ""} onChange={(e) => patchAnalysis(a.uuid, { codeVersion: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div className="posmono">{a.codeVersion ?? "—"}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Method</label>
                  {editable ? (
                    <select className="posfield__select" value={a.usesRealisticMethods === true ? "realistic" : "conservative"} onChange={(e) => patchAnalysis(a.uuid, { usesRealisticMethods: e.target.value === "realistic" })}>
                      <option value="realistic">Realistic</option>
                      <option value="conservative">Conservative</option>
                    </select>
                  ) : <div>{a.usesRealisticMethods === true ? "Realistic" : "Conservative"}</div>}
                </div>
              </div>
              <div><div className="scsec">Applicability</div>
                {editable
                  ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.applicabilityToPlantConditions} onChange={(e) => patchAnalysis(a.uuid, { applicabilityToPlantConditions: e.target.value })} />
                  : <p className="scdrawer__text">{a.applicabilityToPlantConditions}</p>}
              </div>
              <div><div className="scsec">Verification and validation</div>
                {editable
                  ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.validationVerificationBasis ?? ""} onChange={(e) => patchAnalysis(a.uuid, { validationVerificationBasis: e.target.value.length === 0 ? undefined : e.target.value })} />
                  : a.validationVerificationBasis !== undefined && <p className="scdrawer__text">{a.validationVerificationBasis}</p>}
              </div>
              <div><div className="scsec">Limitations</div>
                {editable
                  ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={(a.limitations ?? []).join("\n")} onChange={(e) => patchAnalysis(a.uuid, { limitations: e.target.value.length === 0 ? undefined : e.target.value.split("\n") })} />
                  : (a.limitations ?? []).length > 0 ? <p className="scdrawer__text">{(a.limitations ?? []).join(" ")}</p> : <p className="possubtle" style={{ margin: 0, fontSize: 12.5 }}>None recorded.</p>}
                {editable && <div className="possubtle" style={{ fontSize: 11, marginTop: 4 }}>One limitation per line.</div>}
              </div>
              {(editable || Object.keys(a.keyParametersAndResults).length > 0) && (
                <div><div className="scsec">Key results</div>
                  {Object.entries(a.keyParametersAndResults).map(([k, v], i) => (
                    <div key={i} className="posfield-grid" style={{ marginBottom: 8 }}>
                      <div className="posfield"><label className="posfield__label">Parameter</label>
                        {editable
                          ? <input className="posfield__input" value={k} onChange={(e) => { const entries = Object.entries(a.keyParametersAndResults); entries[i] = [e.target.value, String(v)]; patchAnalysis(a.uuid, { keyParametersAndResults: Object.fromEntries(entries) }); }} />
                          : <div>{k}</div>}
                      </div>
                      <div className="posfield"><label className="posfield__label">Result</label>
                        {editable ? (
                          <div className="posrow" style={{ gap: 6 }}>
                            <input className="posfield__input posmono" style={{ flex: 1 }} value={String(v)} onChange={(e) => { const entries = Object.entries(a.keyParametersAndResults); entries[i] = [k, e.target.value]; patchAnalysis(a.uuid, { keyParametersAndResults: Object.fromEntries(entries) }); }} />
                            <button type="button" className="posnav__btn posnav__btn--sm" title="Remove result" onClick={() => { const entries = Object.entries(a.keyParametersAndResults).filter((_, j) => j !== i); patchAnalysis(a.uuid, { keyParametersAndResults: Object.fromEntries(entries) }); }}><SCIcon.Close /></button>
                          </div>
                        ) : <div className="posmono">{String(v)}</div>}
                      </div>
                    </div>
                  ))}
                  {editable && (
                    <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchAnalysis(a.uuid, { keyParametersAndResults: { ...a.keyParametersAndResults, "": "" } })}><SCIcon.Plus /> Add result</button>
                  )}
                </div>
              )}
              {!reasonable && a.reasonablenessReview !== undefined && (
                <div className="scwarn"><span className="scwarn__icon"><SCIcon.Warn /></span><span>{a.reasonablenessReview.conclusion}</span></div>
              )}
              {editable && (
                <div><div className="scsec">Reasonableness review</div>
                  <div className="posfield-grid">
                    <div className="posfield"><label className="posfield__label">Performed</label>
                      <select className="posfield__select" value={reasonable ? "yes" : "no"} onChange={(e) => patchAnalysis(a.uuid, { reasonablenessReview: { performed: e.target.value === "yes", method: a.reasonablenessReview?.method ?? "Independent reasonableness review", conclusion: a.reasonablenessReview?.conclusion ?? "" } })}>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div className="posfield"><label className="posfield__label">Review method</label>
                      <input className="posfield__input" value={a.reasonablenessReview?.method ?? ""} onChange={(e) => patchAnalysis(a.uuid, { reasonablenessReview: { performed: reasonable, method: e.target.value, conclusion: a.reasonablenessReview?.conclusion ?? "" } })} />
                    </div>
                    <div className="posfield posfield-grid--span2"><label className="posfield__label">Conclusion</label>
                      <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.reasonablenessReview?.conclusion ?? ""} onChange={(e) => patchAnalysis(a.uuid, { reasonablenessReview: { performed: reasonable, method: a.reasonablenessReview?.method ?? "Independent reasonableness review", conclusion: e.target.value } })} />
                    </div>
                  </div>
                </div>
              )}
              {(editable || a.supportedSuccessCriteria.length > 0) && (
                <div><div className="scsec">Supports criteria</div>
                  {editable
                    ? <input className="posfield__input posmono" value={a.supportedSuccessCriteria.join(", ")} onChange={(e) => patchAnalysis(a.uuid, { supportedSuccessCriteria: csvList(e.target.value) })} />
                    : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{a.supportedSuccessCriteria.map((s) => <span key={s} className="poschip">{s}</span>)}</div>}
                </div>
              )}
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>{a.implementsSrs.map((s) => <span key={s.sr} className="poschip poschip--method">{s.sr}</span>)}</div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeAnalysis(a.uuid)}><SCIcon.Close /> Remove analysis</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {openCode !== null && (() => {
        const c = openCode;
        function patchPhen(i: number, patch: Partial<{ phenomenonDescription: string; validationResults: string; reference: string }>): void {
          patchCode(c.uuid, { phenomenaValidation: c.phenomenaValidation.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
        }
        return (
          <Drawer onClose={() => setOpenCodeId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="scdrawer__cap">Computer code · SC-B4</div>
                <h2 className="scdrawer__title">{c.name.length > 0 ? c.name : c.computerCode.length > 0 ? c.computerCode : "New code"}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenCodeId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Code</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
                    {editable ? <input className="posfield__input" value={c.name} onChange={(e) => patchCode(c.uuid, { name: e.target.value })} /> : <div>{c.name}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Version</label>
                    {editable ? <input className="posfield__input posmono" value={c.codeVersion} onChange={(e) => patchCode(c.uuid, { codeVersion: e.target.value })} /> : <div className="posmono">{c.codeVersion}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Code or model</label>
                    {editable ? <input className="posfield__input" value={c.computerCode} onChange={(e) => patchCode(c.uuid, { computerCode: e.target.value })} /> : <div>{c.computerCode}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Verification and validation</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.verificationDocumentation} onChange={(e) => patchCode(c.uuid, { verificationDocumentation: e.target.value })} /> : <div>{c.verificationDocumentation}</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Phenomena validation</h3></div>
                {c.phenomenaValidation.map((row, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined, paddingTop: i > 0 ? 12 : 0, marginBottom: 10 }}>
                    <div className="scdrawer__param-cap"><span className="scdrawer__param-num">{i + 1}</span>{row.phenomenonDescription.length > 0 ? row.phenomenonDescription : "New phenomenon"}</div>
                    <div className="posfield-grid">
                    <div className="posfield posfield-grid--span2"><label className="posfield__label">Phenomenon</label>
                      {editable ? <input className="posfield__input" value={row.phenomenonDescription} onChange={(e) => patchPhen(i, { phenomenonDescription: e.target.value })} /> : <div>{row.phenomenonDescription}</div>}
                    </div>
                    <div className="posfield"><label className="posfield__label">Results</label>
                      {editable ? <input className="posfield__input" value={row.validationResults} onChange={(e) => patchPhen(i, { validationResults: e.target.value })} /> : <div>{row.validationResults}</div>}
                    </div>
                    <div className="posfield"><label className="posfield__label">Reference</label>
                      {editable ? (
                        <div className="posrow" style={{ gap: 6 }}>
                          <input className="posfield__input posmono" style={{ flex: 1 }} value={row.reference} onChange={(e) => patchPhen(i, { reference: e.target.value })} />
                          <button type="button" className="posnav__btn posnav__btn--sm" title="Remove phenomenon" onClick={() => patchCode(c.uuid, { phenomenaValidation: c.phenomenaValidation.filter((_, j) => j !== i) })}><SCIcon.Close /></button>
                        </div>
                      ) : <div className="posmono">{row.reference}</div>}
                    </div>
                    </div>
                  </div>
                ))}
                {editable && (
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchCode(c.uuid, { phenomenaValidation: [...c.phenomenaValidation, { phenomenonDescription: "", validationResults: "", reference: "" }] })}><SCIcon.Plus /> Add phenomenon</button>
                )}
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Limitations and gaps</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Limitations (one per line)</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.limitations.join("\n")} onChange={(e) => patchCode(c.uuid, { limitations: e.target.value.length === 0 ? [] : e.target.value.split("\n") })} /> : <div>{c.limitations.join(" ")}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Validation gap</label>
                    {editable
                      ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.validationGap ?? ""} onChange={(e) => patchCode(c.uuid, { validationGap: e.target.value.length === 0 ? undefined : e.target.value })} />
                      : <div>{c.validationGap ?? "—"}</div>}
                  </div>
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeCode(c.uuid)}><SCIcon.Close /> Remove code</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {openBar !== null && (() => {
        const b = openBar;
        const spec = scBarriersFor(sc.uuid)[b.barrierId];
        function patchLoad(i: number, patch: Partial<{ eventSequenceReference: string | undefined; loadDescription: string; physicalAttributes: string[] }>): void {
          patchBar(b.uuid, { challengeLoads: b.challengeLoads.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
        }
        return (
          <Drawer onClose={() => setOpenBarId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Barrier loads · SC-B6, B7</div>
                <h2 className="scdrawer__title">{spec?.short ?? b.barrierId}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenBarId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Evaluation method</h3></div>
                {editable ? (
                  <select className="posfield__select" style={{ maxWidth: 240 }} value={b.effectivenessEvaluationMethod} onChange={(e) => patchBar(b.uuid, { effectivenessEvaluationMethod: e.target.value === "REALISTIC" ? "REALISTIC" : "CONSERVATIVE" })}>
                    <option value="REALISTIC">Realistic (CC-II)</option>
                    <option value="CONSERVATIVE">Conservative (CC-I)</option>
                  </select>
                ) : <div>{b.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic (CC-II)" : "Conservative (CC-I)"}</div>}
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Challenge loads</h3></div>
                {b.challengeLoads.map((row, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined, paddingTop: i > 0 ? 12 : 0, marginBottom: 10 }}>
                    <div className="scdrawer__param-cap"><span className="scdrawer__param-num">{i + 1}</span>{row.loadDescription.length > 0 ? row.loadDescription : "New load"}</div>
                    <div className="posfield-grid">
                    <div className="posfield"><label className="posfield__label">Sequence</label>
                      {editable ? <input className="posfield__input posmono" value={row.eventSequenceReference ?? ""} onChange={(e) => patchLoad(i, { eventSequenceReference: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div className="posmono">{row.eventSequenceReference ?? "—"}</div>}
                    </div>
                    <div className="posfield"><label className="posfield__label">Load</label>
                      {editable ? (
                        <div className="posrow" style={{ gap: 6 }}>
                          <input className="posfield__input" style={{ flex: 1 }} value={row.loadDescription} onChange={(e) => patchLoad(i, { loadDescription: e.target.value })} />
                          <button type="button" className="posnav__btn posnav__btn--sm" title="Remove load" onClick={() => patchBar(b.uuid, { challengeLoads: b.challengeLoads.filter((_, j) => j !== i) })}><SCIcon.Close /></button>
                        </div>
                      ) : <div>{row.loadDescription}</div>}
                    </div>
                    <div className="posfield posfield-grid--span2"><label className="posfield__label">Physical attributes (comma separated)</label>
                      {editable ? <input className="posfield__input" value={row.physicalAttributes.join(", ")} onChange={(e) => patchLoad(i, { physicalAttributes: csvList(e.target.value) })} /> : <div>{row.physicalAttributes.join(", ")}</div>}
                    </div>
                    </div>
                  </div>
                ))}
                {editable && (
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchBar(b.uuid, { challengeLoads: [...b.challengeLoads, { loadDescription: "", physicalAttributes: [] }] })}><SCIcon.Plus /> Add load</button>
                )}
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Capacity and uncertainty</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Capacity parameters (one per line)</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={b.capacityParameters.join("\n")} onChange={(e) => patchBar(b.uuid, { capacityParameters: e.target.value.length === 0 ? [] : e.target.value.split("\n") })} /> : <div>{b.capacityParameters.join(", ")}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Uncertainty assessment</label>
                    {editable
                      ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={b.uncertaintyAssessment ?? ""} onChange={(e) => patchBar(b.uuid, { uncertaintyAssessment: e.target.value.length === 0 ? undefined : e.target.value })} />
                      : <div>{b.uncertaintyAssessment ?? "—"}</div>}
                  </div>
                </div>
              </div>
            </div>
          </Drawer>
        );
      })()}

      {openEj !== null && (() => {
        const e = openEj;
        return (
          <Drawer onClose={() => setOpenEjId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="scdrawer__cap">Expert judgment · SC-B2</div>
                <h2 className="scdrawer__title">{e.topic.length > 0 ? e.topic : "New judgment"}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenEjId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Judgment</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Topic</label>
                    {editable ? <input className="posfield__input" value={e.topic} onChange={(ev) => patchEj(e.uuid, { topic: ev.target.value })} /> : <div>{e.topic}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Why judgment is needed</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={e.justification} onChange={(ev) => patchEj(e.uuid, { justification: ev.target.value })} /> : <div>{e.justification}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Outcome</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={e.outcome} onChange={(ev) => patchEj(e.uuid, { outcome: ev.target.value })} /> : <div>{e.outcome}</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="poscard__head"><h3 className="poscard__title">Process</h3></div>
                <div className="posfield-grid">
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Process</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={e.processDescription} onChange={(ev) => patchEj(e.uuid, { processDescription: ev.target.value })} /> : <div>{e.processDescription}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Documentation</label>
                    {editable ? <input className="posfield__input posmono" value={e.processDocumentationReference} onChange={(ev) => patchEj(e.uuid, { processDocumentationReference: ev.target.value })} /> : <div className="posmono">{e.processDocumentationReference}</div>}
                  </div>
                  <div className="posfield"><label className="posfield__label">Panel members (comma separated)</label>
                    {editable ? <input className="posfield__input" value={e.panelMembers.join(", ")} onChange={(ev) => patchEj(e.uuid, { panelMembers: csvList(ev.target.value) })} /> : <div>{e.panelMembers.join(", ")}</div>}
                  </div>
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Informs criteria (comma separated)</label>
                    {editable ? <input className="posfield__input posmono" value={e.informedSuccessCriteria.join(", ")} onChange={(ev) => patchEj(e.uuid, { informedSuccessCriteria: csvList(ev.target.value) })} /> : <div className="posmono">{e.informedSuccessCriteria.join(", ")}</div>}
                  </div>
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeEj(e.uuid)}><SCIcon.Close /> Remove judgment</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}

function PassiveScreen(): JSX.Element {
  const { sc, editable, mutateSc } = useScWorkbook();
  const passive = sc.passiveSafetyFunctionCriteria ?? [];
  const [openPsvId, setOpenPsvId] = useState<string | null>(null);
  const openPsv = passive.find((x) => x.uuid === openPsvId) ?? null;
  const safetyFunctions = scSafetyFunctionsFor(sc.uuid);

  function patchPsv(uuid: string, patch: Partial<(typeof passive)[number]>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, passiveSafetyFunctionCriteria: (draft.passiveSafetyFunctionCriteria ?? []).map((x) => (x.uuid === uuid ? { ...x, ...patch } : x)) }));
  }
  function addPsv(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, passiveSafetyFunctionCriteria: [...(draft.passiveSafetyFunctionCriteria ?? []), { uuid: id, name: "New passive function", safetyFunctionId: Object.keys(safetyFunctions)[0] ?? "SF-DHR", passivePhenomena: [], mechanisticModelDescription: "", empiricalDataReferences: [], modelUncertaintyCharacterization: "", inputDataUncertaintyCharacterization: "", passiveFunctionalReliabilityBasis: "", engineeringAnalysisReferences: [], implementsSrs: [{ sr: "SC-B5", hlr: "B" }] }] }));
    setOpenPsvId(id);
  }
  function removePsv(uuid: string): void {
    if (!editable) return;
    setOpenPsvId(null);
    mutateSc((draft) => ({ ...draft, passiveSafetyFunctionCriteria: (draft.passiveSafetyFunctionCriteria ?? []).filter((x) => x.uuid !== uuid) }));
  }

  if (passive.length === 0) {
    return (
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Passive safety functions</h3>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPsv}><SCIcon.Plus /> Add function</button>}
        </div>
        <ScEmpty title="No passive functions recorded yet" hint="Passive safety functions use mechanistic models with characterized model and input uncertainty for functional reliability (SC-B5)." />
      </div>
    );
  }
  return (
    <>
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Passive safety functions</h3>
        <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
          <span className="possubtle">SC-B5</span>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPsv}><SCIcon.Plus /> Add function</button>}
        </div>
      </div>
      <p className="poscard__sub">Each passive function uses a mechanistic model with characterized model and input uncertainty for its functional reliability. Click a card for the full record.</p>
    <div className="scpsv">
      {passive.map((p) => {
        const warn = p.openItem !== undefined;
        return (
          <button type="button" key={p.uuid} className={`scpsv__card scpsv__card--clickable${warn ? " scpsv__card--warn" : ""}`} onClick={() => setOpenPsvId(p.uuid)}>
            <div className="scpsv__head">
              <span className="scpsv__icon"><NamedIcon name={scSafetyFunctionsFor(sc.uuid)[p.safetyFunctionId]?.icon ?? "Atom"} /></span>
              <div>
                <div className="scpsv__name">{p.name}</div>
                <div className="scpsv__phenom">{p.passivePhenomena.map((ph) => <span key={ph} className="scpsv__phenom-tag">{ph}</span>)}</div>
              </div>
            </div>
            <div className="scpsv__grid">
              <div className="scpsv__item scpsv__item--wide">
                <div className="scpsv__item-k"><SCIcon.Beaker /> Mechanistic model</div>
                <div className="scpsv__item-v">{p.mechanisticModelDescription}</div>
                <div className="scpsv__data">{p.empiricalDataReferences.map((d) => <span key={d} className="scpsv__data-tag">{d}</span>)}</div>
              </div>
              <div className="scpsv__item">
                <div className="scpsv__item-k"><SCIcon.Ruler /> Model uncertainty</div>
                <div className="scpsv__item-v">{p.modelUncertaintyCharacterization}</div>
              </div>
              <div className="scpsv__item">
                <div className="scpsv__item-k"><SCIcon.Gauge /> Input uncertainty</div>
                <div className="scpsv__item-v">{p.inputDataUncertaintyCharacterization}</div>
              </div>
            </div>
            {warn && (
              <div className="scpsv__note"><SCIcon.Warn /><span>{p.openItem}</span></div>
            )}
          </button>
        );
      })}
    </div>
    </div>

    {openPsv !== null && (() => {
      const p = openPsv;
      return (
        <Drawer onClose={() => setOpenPsvId(null)}>
          <div className="scdrawer__head" style={{ borderBottom: "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="scdrawer__cap">Passive safety function · SC-B5</div>
              {editable
                ? <input className="posfield__input" style={{ fontSize: 16, fontWeight: 700 }} value={p.name} onChange={(e) => patchPsv(p.uuid, { name: e.target.value })} />
                : <h2 className="scdrawer__title">{p.name}</h2>}
            </div>
            <button type="button" className="scdrawer__close" onClick={() => setOpenPsvId(null)}><SCIcon.Close /></button>
          </div>
          <div className="scdrawer__body" style={{ paddingTop: 4 }}>
            <div>
              <div className="poscard__head"><h3 className="poscard__title">Model</h3></div>
              <div className="posfield-grid">
                <div className="posfield"><label className="posfield__label">Safety function</label>
                  {editable
                    ? <select className="posfield__select" value={p.safetyFunctionId} onChange={(e) => patchPsv(p.uuid, { safetyFunctionId: e.target.value })}>
                        {Object.values(safetyFunctions).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    : <div>{safetyFunctions[p.safetyFunctionId]?.name ?? p.safetyFunctionId}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Phenomena (comma separated)</label>
                  {editable ? <input className="posfield__input" value={p.passivePhenomena.join(", ")} onChange={(e) => patchPsv(p.uuid, { passivePhenomena: csvList(e.target.value) })} /> : <div>{p.passivePhenomena.join(", ")}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Mechanistic model</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.mechanisticModelDescription} onChange={(e) => patchPsv(p.uuid, { mechanisticModelDescription: e.target.value })} /> : <div>{p.mechanisticModelDescription}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Empirical data (comma separated)</label>
                  {editable ? <input className="posfield__input" value={p.empiricalDataReferences.join(", ")} onChange={(e) => patchPsv(p.uuid, { empiricalDataReferences: csvList(e.target.value) })} /> : <div>{p.empiricalDataReferences.join(", ")}</div>}
                </div>
              </div>
            </div>
            <div>
              <div className="poscard__head"><h3 className="poscard__title">Uncertainty</h3></div>
              <div className="posfield-grid">
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Model uncertainty</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.modelUncertaintyCharacterization} onChange={(e) => patchPsv(p.uuid, { modelUncertaintyCharacterization: e.target.value })} /> : <div>{p.modelUncertaintyCharacterization}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Input uncertainty</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.inputDataUncertaintyCharacterization} onChange={(e) => patchPsv(p.uuid, { inputDataUncertaintyCharacterization: e.target.value })} /> : <div>{p.inputDataUncertaintyCharacterization}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Functional reliability basis</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.passiveFunctionalReliabilityBasis} onChange={(e) => patchPsv(p.uuid, { passiveFunctionalReliabilityBasis: e.target.value })} /> : <div>{p.passiveFunctionalReliabilityBasis}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Open item</label>
                  {editable
                    ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={p.openItem ?? ""} onChange={(e) => patchPsv(p.uuid, { openItem: e.target.value.length === 0 ? undefined : e.target.value })} />
                    : <div>{p.openItem ?? "—"}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Analyses (comma separated)</label>
                  {editable ? <input className="posfield__input posmono" value={p.engineeringAnalysisReferences.join(", ")} onChange={(e) => patchPsv(p.uuid, { engineeringAnalysisReferences: csvList(e.target.value) })} /> : <div className="posmono">{p.engineeringAnalysisReferences.join(", ")}</div>}
                </div>
              </div>
            </div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>{p.implementsSrs.map((s) => <span key={s.sr} className="poschip poschip--method">{s.sr}</span>)}</div>
            {editable && (
              <div className="posrow" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removePsv(p.uuid)}><SCIcon.Close /> Remove function</button>
              </div>
            )}
          </div>
        </Drawer>
      );
    })()}
    </>
  );
}

function ConsistencyScreen(): JSX.Element {
  const { sc, editable, mutateSc } = useScWorkbook();
  const cv = sc.consistencyVerifications ?? [];
  const [openCheckId, setOpenCheckId] = useState<string | null>(null);
  const [openSourceIdx, setOpenSourceIdx] = useState<number | null>(null);
  const [openPaId, setOpenPaId] = useState<string | null>(null);
  const [openSsId, setOpenSsId] = useState<string | null>(null);
  const openPa = (sc.preOperationalAssumptions ?? []).find((a) => a.uuid === openPaId) ?? null;
  const openSs = (sc.sensitivityStudies ?? []).find((x) => x.uuid === openSsId) ?? null;

  type VerKey = "designBasesVerification" | "licensingBasesVerification" | "operationalPracticesVerification";
  function patchVer(uuid: string, key: VerKey, patch: Partial<{ isConsistent: boolean; description: string; references: string[] }>): void {
    if (!editable) return;
    mutateSc((draft) => ({
      ...draft,
      consistencyVerifications: (draft.consistencyVerifications ?? []).map((v) => (v.uuid === uuid ? { ...v, [key]: { ...v[key], ...patch } } : v)),
    }));
  }
  function patchAdc(patch: Partial<typeof sc.analysisDetailConsistency>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, analysisDetailConsistency: { ...draft.analysisDetailConsistency, ...patch } }));
  }
  function patchSource(index: number, patch: Partial<{ source: string; impact: string }>): void {
    if (!editable) return;
    mutateSc((draft) => ({
      ...draft,
      modelUncertainty: { ...draft.modelUncertainty, uncertaintySources: draft.modelUncertainty.uncertaintySources.map((u, i) => (i === index ? { ...u, ...patch } : u)) },
    }));
  }
  function addSource(): void {
    if (!editable) return;
    mutateSc((draft) => ({
      ...draft,
      modelUncertainty: { ...draft.modelUncertainty, uncertaintySources: [...draft.modelUncertainty.uncertaintySources, { source: "", impact: "" }] },
    }));
    setOpenSourceIdx(sc.modelUncertainty.uncertaintySources.length);
  }
  function removeSource(index: number): void {
    if (!editable) return;
    setOpenSourceIdx(null);
    mutateSc((draft) => ({
      ...draft,
      modelUncertainty: { ...draft.modelUncertainty, uncertaintySources: draft.modelUncertainty.uncertaintySources.filter((_, i) => i !== index) },
    }));
  }
  function patchPa(uuid: string, patch: Partial<PreOperationalAssumption>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).map((a) => (a.uuid === uuid ? { ...a, ...patch } : a)) }));
  }
  function addPa(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, preOperationalAssumptions: [...(draft.preOperationalAssumptions ?? []), { uuid: id, assumptionId: id, description: "", influenceOnDefinition: "", status: "OPEN", limitations: [], riskImpact: ImportanceLevel.LOW, closureBasis: "", plannedClosureActions: [], affectedElementIds: [] }] }));
    setOpenPaId(id);
  }
  function removePa(uuid: string): void {
    if (!editable) return;
    setOpenPaId(null);
    mutateSc((draft) => ({ ...draft, preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).filter((a) => a.uuid !== uuid) }));
  }
  function patchSs(uuid: string, patch: Partial<SensitivityStudy>): void {
    if (!editable) return;
    mutateSc((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).map((x) => (x.uuid === uuid ? { ...x, ...patch } : x)) }));
  }
  function addSs(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSc((draft) => ({ ...draft, sensitivityStudies: [...(draft.sensitivityStudies ?? []), { uuid: id, description: "", variedParameters: [], parameterRanges: {} }] }));
    setOpenSsId(id);
  }
  function removeSs(uuid: string): void {
    if (!editable) return;
    setOpenSsId(null);
    mutateSc((draft) => ({ ...draft, sensitivityStudies: (draft.sensitivityStudies ?? []).filter((x) => x.uuid !== uuid) }));
  }
  const checks: { id: string; subject: string; detail: string; ok: boolean; sr: string }[] = [];
  for (const v of cv) {
    checks.push({ id: `${v.uuid}-d`, subject: "Design features", detail: v.designBasesVerification.description, ok: v.designBasesVerification.isConsistent, sr: "SC-A9" });
    checks.push({ id: `${v.uuid}-l`, subject: "Procedures", detail: v.licensingBasesVerification.description, ok: v.licensingBasesVerification.isConsistent, sr: "SC-A9" });
    checks.push({ id: `${v.uuid}-o`, subject: "Operating philosophy", detail: v.operationalPracticesVerification.description, ok: v.operationalPracticesVerification.isConsistent, sr: "SC-A9" });
  }
  const adc = sc.analysisDetailConsistency;
  checks.push({ id: "adc", subject: "Analysis detail", detail: adc.basis, ok: adc.consistentWithInitiatingEventGrouping && adc.consistentWithPlantOperatingStateDefinition && adc.consistentWithEventSequenceModeling, sr: "SC-B3" });
  const openCount = checks.filter((c) => !c.ok).length;

  const register: { id: string; kind: "mu" | "pa" | "ss"; idx: number; type: string; tone: BadgeKind | undefined; item: string; detail: string; sr: string }[] = [
    ...sc.modelUncertainty.uncertaintySources.map((u, i) => ({ id: `mu-${i}`, kind: "mu" as const, idx: i, type: "Uncertainty", tone: "progress" as BadgeKind, item: u.source, detail: u.impact, sr: "SC-B9" })),
    ...(sc.preOperationalAssumptions ?? []).map((a) => ({ id: a.uuid, kind: "pa" as const, idx: 0, type: "Pre-op", tone: "warn" as BadgeKind, item: a.influenceOnDefinition, detail: a.description, sr: "SC-A11" })),
    ...(sc.sensitivityStudies ?? []).map((x) => ({ id: x.uuid, kind: "ss" as const, idx: 0, type: "Sensitivity", tone: undefined, item: x.name ?? x.description, detail: x.results ?? "", sr: "SC-A10" })),
  ];

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consistency checks</h3>
          {openCount === 0 ? <Badge kind="ok">All consistent</Badge> : <Badge kind="warn">{openCount} open</Badge>}
        </div>
        <p className="poscard__sub">Click a check to edit it.</p>
        <div className="sccv">
          {checks.map((c) => (
            <button type="button" key={c.id} className="sccv__row sccv__row--clickable" onClick={() => setOpenCheckId(c.id)}>
              <span className={`sccv__mark sccv__mark--${c.ok ? "ok" : "no"}`}><span className={`scqlight__dot scqlight__dot--${c.ok ? "s" : "f"}`} /></span>
              <span className="sccv__subject">{c.subject}<span className="sccv__sr">{c.sr}</span></span>
              <span className="sccv__detail">{c.detail}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <div className="posrow posrow--wrap" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">SC-A10, A11, B9, B10</span>
            {editable && <>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={addSource}><SCIcon.Plus /> Uncertainty</button>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={addPa}><SCIcon.Plus /> Assumption</button>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={addSs}><SCIcon.Plus /> Sensitivity study</button>
            </>}
          </div>
        </div>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r) => (
              <tr key={r.id} className="postable__row--clickable" onClick={() => { if (r.kind === "mu") setOpenSourceIdx(r.idx); else if (r.kind === "pa") setOpenPaId(r.id); else setOpenSsId(r.id); }}>
                <td><Badge kind={r.tone}>{r.type}</Badge></td>
                <td style={{ fontWeight: 600 }}>{r.item.length > 0 ? r.item : "—"}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.sr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openCheckId !== null && (() => {
        const parts = openCheckId.split("-");
        const suffix = parts[parts.length - 1];
        if (openCheckId === "adc") {
          const adcNow = sc.analysisDetailConsistency;
          return (
            <Drawer onClose={() => setOpenCheckId(null)}>
              <div className="scdrawer__head" style={{ borderBottom: "none" }}>
                <div>
                  <div className="scdrawer__cap">Consistency check · SC-B3</div>
                  <h2 className="scdrawer__title">Analysis detail</h2>
                </div>
                <button type="button" className="scdrawer__close" onClick={() => setOpenCheckId(null)}><SCIcon.Close /></button>
              </div>
              <div className="scdrawer__body" style={{ paddingTop: 4 }}>
                <div className="posfield-grid">
                  {([
                    ["consistentWithInitiatingEventGrouping", "Matches the IE grouping"],
                    ["consistentWithPlantOperatingStateDefinition", "Matches the POS definitions"],
                    ["consistentWithEventSequenceModeling", "Matches the ES modeling"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="posfield"><label className="posfield__label">{label}</label>
                      {editable
                        ? <select className="posfield__select" value={adcNow[key] ? "yes" : "no"} onChange={(e) => patchAdc({ [key]: e.target.value === "yes" })}>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        : <div>{adcNow[key] ? "Yes" : "No"}</div>}
                    </div>
                  ))}
                  <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
                    {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={adcNow.basis} onChange={(e) => patchAdc({ basis: e.target.value })} /> : <div>{adcNow.basis}</div>}
                  </div>
                </div>
              </div>
            </Drawer>
          );
        }
        const verUuid = openCheckId.slice(0, openCheckId.length - 2);
        const ver = cv.find((v) => v.uuid === verUuid);
        if (ver === undefined) return null;
        const key: VerKey = suffix === "d" ? "designBasesVerification" : suffix === "l" ? "licensingBasesVerification" : "operationalPracticesVerification";
        const subject = suffix === "d" ? "Design features" : suffix === "l" ? "Procedures" : "Operating philosophy";
        const rec = ver[key];
        return (
          <Drawer onClose={() => setOpenCheckId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Consistency check · SC-A9</div>
                <h2 className="scdrawer__title">{subject}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenCheckId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div className="posfield-grid">
                <div className="posfield"><label className="posfield__label">Consistent</label>
                  {editable
                    ? <select className="posfield__select" value={rec.isConsistent ? "yes" : "no"} onChange={(e) => patchVer(ver.uuid, key, { isConsistent: e.target.value === "yes" })}>
                        <option value="yes">Yes</option>
                        <option value="no">Open</option>
                      </select>
                    : <div>{rec.isConsistent ? "Yes" : "Open"}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">References (comma separated)</label>
                  {editable ? <input className="posfield__input" value={rec.references.join(", ")} onChange={(e) => patchVer(ver.uuid, key, { references: csvList(e.target.value) })} /> : <div>{rec.references.join(", ")}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={rec.description} onChange={(e) => patchVer(ver.uuid, key, { description: e.target.value })} /> : <div>{rec.description}</div>}
                </div>
              </div>
            </div>
          </Drawer>
        );
      })()}

      {openSourceIdx !== null && sc.modelUncertainty.uncertaintySources[openSourceIdx] !== undefined && (() => {
        const src = sc.modelUncertainty.uncertaintySources[openSourceIdx];
        return (
          <Drawer onClose={() => setOpenSourceIdx(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Model uncertainty source · SC-B9</div>
                <h2 className="scdrawer__title">{src.source.length > 0 ? src.source : "New source"}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenSourceIdx(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div className="posfield-grid">
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Source</label>
                  {editable ? <input className="posfield__input" value={src.source} onChange={(e) => patchSource(openSourceIdx, { source: e.target.value })} /> : <div>{src.source}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Impact</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={src.impact} onChange={(e) => patchSource(openSourceIdx, { impact: e.target.value })} /> : <div>{src.impact}</div>}
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeSource(openSourceIdx)}><SCIcon.Close /> Remove source</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {openPa !== null && (() => {
        const a = openPa;
        return (
          <Drawer onClose={() => setOpenPaId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Pre-operational assumption · SC-A11</div>
                <h2 className="scdrawer__title">{a.influenceOnDefinition.length > 0 ? a.influenceOnDefinition : "New assumption"}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenPaId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div className="posfield-grid">
                <div className="posfield"><label className="posfield__label">Area affected</label>
                  {editable ? <input className="posfield__input" value={a.influenceOnDefinition} onChange={(e) => patchPa(a.uuid, { influenceOnDefinition: e.target.value })} /> : <div>{a.influenceOnDefinition}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Status</label>
                  {editable
                    ? <select className="posfield__select" value={a.status} onChange={(e) => patchPa(a.uuid, { status: e.target.value === "CLOSED" ? "CLOSED" : e.target.value === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN" })}>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    : <div>{a.status}</div>}
                </div>
                <div className="posfield"><label className="posfield__label">Risk impact</label>
                  {editable
                    ? <select className="posfield__select" value={a.riskImpact} onChange={(e) => patchPa(a.uuid, { riskImpact: e.target.value as ImportanceLevel })}>
                        {Object.values(ImportanceLevel).map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                      </select>
                    : <div>{a.riskImpact}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.description} onChange={(e) => patchPa(a.uuid, { description: e.target.value })} /> : <div>{a.description}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Closure basis</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.closureBasis} onChange={(e) => patchPa(a.uuid, { closureBasis: e.target.value })} /> : <div>{a.closureBasis}</div>}
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removePa(a.uuid)}><SCIcon.Close /> Remove assumption</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}

      {openSs !== null && (() => {
        const x = openSs;
        return (
          <Drawer onClose={() => setOpenSsId(null)}>
            <div className="scdrawer__head" style={{ borderBottom: "none" }}>
              <div>
                <div className="scdrawer__cap">Sensitivity study · SC-A10</div>
                <h2 className="scdrawer__title">{(x.name ?? "").length > 0 ? x.name : x.description.length > 0 ? x.description : "New study"}</h2>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenSsId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body" style={{ paddingTop: 4 }}>
              <div className="posfield-grid">
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
                  {editable ? <input className="posfield__input" value={x.name ?? ""} onChange={(e) => patchSs(x.uuid, { name: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{x.name ?? "—"}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={x.description} onChange={(e) => patchSs(x.uuid, { description: e.target.value })} /> : <div>{x.description}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Varied parameters (comma separated)</label>
                  {editable ? <input className="posfield__input" value={x.variedParameters.join(", ")} onChange={(e) => patchSs(x.uuid, { variedParameters: csvList(e.target.value) })} /> : <div>{x.variedParameters.join(", ")}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Results</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={x.results ?? ""} onChange={(e) => patchSs(x.uuid, { results: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{x.results ?? "—"}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Insights</label>
                  {editable ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={x.insights ?? ""} onChange={(e) => patchSs(x.uuid, { insights: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{x.insights ?? "—"}</div>}
                </div>
              </div>
              {editable && (
                <div className="posrow" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => removeSs(x.uuid)}><SCIcon.Close /> Remove study</button>
                </div>
              )}
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}

const SC_TOC_ITEMS: [string, string][] = [
  ["Executive summary", "5"],
  ["Introduction", "6"],
  ["    Purpose", "6"],
  ["    Scope", "6"],
  ["    Relationship to other documents", "6"],
  ["    Document layout", "6"],
  ["    Quality assurance", "6"],
  ["    Freeze date", "6"],
  ["Assumptions & limitations", "7"],
  ["Definition & requirements for success criteria", "8"],
  ["    Scope of success criteria", "8"],
  ["        Safe stable end states", "8"],
  ["        End states involving a release", "8"],
  ["Success criteria & bases", "9"],
  ["    Safe stable end states", "9"],
  ["    Event sequence end states", "9"],
  ["    Application of end states in the ES model", "9"],
  ["    Functional success criteria", "9"],
  ["    Event-specific functional SC & mission times", "9"],
  ["    Success criteria basis", "9"],
  ["    System-level success criteria", "9"],
  ["    Plant response analyses to confirm SC", "9"],
  ["Identified uncertainties", "10"],
  ["References", "11"],
];

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { sc } = useScWorkbook();
  const ready = scores.blocked === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(sc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sc.name} — SC Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{sc.name}</h1>
        <h2>Preliminary Success Criteria Development</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {SC_TOC_ITEMS.map(([t, p], i) => (<div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>))}
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
              ? <>All items pass at <strong>{cc.name}</strong>. Producing the draft locks Steps 1–7 and advances the workbook to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need{scores.warn === 1 ? "s" : ""} attention. You may produce a working draft, but approval is gated until they are resolved.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
                <SCIcon.Send /> {ready ? "Submit draft to internal review" : "Submit working draft to review"}
              </button>
            )}
            <button type="button" className="posnav__btn" onClick={() => { void generateScReport(sc, ready); }}><SCIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><SCIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return <div className="poscard"><ScEmpty title={label} hint="This step is not part of the current workbook view." /></div>;
}

export {
  ScScopeScreen,
  EndStatesScreen,
  CriteriaScreen,
  MissionScreen,
  BasesScreen,
  PassiveScreen,
  ConsistencyScreen,
  DraftScreen,
  PlaceholderScreen,
};
