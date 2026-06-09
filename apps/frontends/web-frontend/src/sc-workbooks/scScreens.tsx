import { Fragment, JSX, ReactNode, useMemo, useState } from "react";
import { SCIcon } from "./scIcons";
import { Badge, SCProvenanceChip, type BadgeKind } from "./scShared";
import {
  CAPABILITY_CATEGORIES,
  SC_SAFETY_FUNCTIONS,
  SC_RAD_BARRIERS,
  SC_INITIATORS,
  SC_ANALYSIS_TYPES,
  SC_RC_TONES,
  SC_SAFE_STABLE_CONDITIONS,
  SC_UPSTREAM_LINKS,
  SC_DOWNSTREAM_LINKS,
  SC_END_STATE_NAMES,
  SC_SYSTEM_DEPS,
  SC_PASSIVE_SYSTEMS,
  SC_REALISTIC_ANALYSES,
  SC_WARN_CODES,
  SC_PASSIVE_WARN,
  SC_PASSIVE_NOTES,
  SC_MISSION_IE,
  SC_MISSION_SEQ,
  SC_CRITERION_SYSTEMS,
  type CapabilityCategory,
  type Stage,
  type Tone,
} from "./scViewData";
import { ccScore, type CcScore } from "./scSelectors";
import { useScWorkbook } from "./scWorkbookContext";
import { generateScReport } from "./scDocx";

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = SCIcon[name] ?? SCIcon.Link;
  return <Icon />;
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

function UpstreamLinkBar(): JSX.Element {
  return (
    <div className="scup">
      {SC_UPSTREAM_LINKS.map((u) => (
        <div key={u.id} className={`scup__card${u.status === "in_review" ? " scup__card--update" : ""}`}>
          <div className="scup__top">
            <span className="scup__badge"><NamedIcon name={u.icon} /></span>
            <div>
              <div className="scup__el">{u.element}</div>
              <div className="scup__wb">{u.workbook} · v{u.version}</div>
            </div>
          </div>
          <div className="scup__delivers">{u.delivers}. {u.note}</div>
          <div className="scup__foot">
            {u.status === "in_review"
              ? <span className="scup__status scup__status--review"><SCIcon.Refresh /> In review</span>
              : <span className="scup__status scup__status--approved"><SCIcon.Check /> Approved</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScScopeScreen({ ccId, setCcId, stage, setStage, onAction }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
}): JSX.Element {
  const { sc } = useScWorkbook();
  const barriers = sc.radionuclideBarrierCriteria;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <SCProvenanceChip kind="sc">Linked</SCProvenanceChip>
        </div>
        <p className="poscard__sub">Criteria differ per state and per challenge. Operating states come from POS, challenges from IE, and ES-A3 names a function that SC-A5 specifies.</p>
        <UpstreamLinkBar />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Downstream consumers</h3>
          <span className="possubtle">Read mid-stream by three elements</span>
        </div>
        <div className="posrow posrow--wrap" style={{ gap: 10 }}>
          {SC_DOWNSTREAM_LINKS.map((d) => (
            <div key={d.id} className="scdown">
              <span className="scdown__badge"><NamedIcon name={d.icon} /></span>
              <div><div className="scdown__el">{d.element}</div><div className="scdown__use">{d.uses}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Radionuclide transport barriers</h3>
          <Badge kind="progress">{barriers.length} barriers</Badge>
        </div>
        <p className="poscard__sub">A parameter and a protecting criterion per barrier (SC-A4).</p>
        <table className="postable">
          <thead><tr><th>Barrier</th><th>Parameter</th><th>Criterion</th><th>Method</th></tr></thead>
          <tbody>
            {barriers.map((b) => {
              const spec = SC_RAD_BARRIERS[b.barrierId];
              const pp = b.protectionParameters[0];
              return (
                <tr key={b.uuid}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      <span style={{ color: "var(--color-primary)", display: "inline-flex" }}><NamedIcon name={spec?.icon ?? "Shield"} /></span>
                      {spec?.name ?? b.barrierId}
                    </span>
                  </td>
                  <td>{pp?.parameter ?? "—"}</td>
                  <td>{pp?.criterion ?? "—"}</td>
                  <td><span className={`scbar__method scbar__method--${b.effectivenessEvaluationMethod.toLowerCase()}`}>{b.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic" : "Conservative"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
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
                <input type="radio" name="sc-stage" value={val} checked={stage === val} onChange={() => { setStage(val); onAction(`Plant stage set to ${title}`); }} />
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

function StableScreen(): JSX.Element {
  const { sc } = useScWorkbook();
  const sss = sc.safeStableStateDefinition;
  const hasDefinition = sss.definition.length > 0;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Safe stable state</h3>
          <SCProvenanceChip kind="sc">SC-A1</SCProvenanceChip>
        </div>
        <div className="scsss__statement">
          <span className="scsss__statement-icon"><SCIcon.Target /></span>
          <span className="scsss__statement-text">{sss.definition}</span>
        </div>
        {hasDefinition && (
          <div className="scsss">
            {SC_SAFE_STABLE_CONDITIONS.map((c) => (
              <div key={c.id} className="scsss__cell">
                <span className="scsss__icon"><NamedIcon name={c.icon} /></span>
                <span className="scsss__label">{c.label}</span>
                <span className="scsss__detail">{c.detail}</span>
              </div>
            ))}
          </div>
        )}
        <div className="scsss__basis"><SCIcon.Ruler /> {sss.basis}</div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">End states</h3>
          <span className="possubtle">{sc.endStateDefinitions.length} defined · SC-A2, SC-A3</span>
        </div>
        <p className="poscard__sub">Release-category bins come from Mechanistic Source Term, defined once and reused.</p>
        <div className="scend">
          {sc.endStateDefinitions.map((e) => {
            const rc = e.resultingReleaseCategoryId ?? (e.releaseCategoryReferences[0] ?? "SSS");
            const tone: Tone = String(e.endState) === "SUCCESSFUL_MITIGATION" ? "ok" : SC_RC_TONES[rc] ?? "warn";
            return (
              <div key={e.uuid} className={`scend__card scend__card--${tone}`}>
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
                {e.marginJustification !== undefined && <div className="scend__margin"><SCIcon.Ruler /><span>{e.marginJustification}</span></div>}
              </div>
            );
          })}
        </div>
      </div>
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
  const { sc } = useScWorkbook();
  const [sfId, setSfId] = useState("all");
  const [ieId, setIeId] = useState("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

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
  const openGroup = groups.find((g) => g.key === openKey) ?? null;

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Success criteria table</h3>
          <span className="possubtle">{groups.length} criteria · SC-A5</span>
        </div>
        <p className="poscard__sub">A criterion per function, per event, per state. Select a card for the full record.</p>
        <div className="sccrit-axes">
          <span className="sccrit-axes__item"><span className="sccrit-axes__k">Function</span><span className="sccrit-axes__v">{Object.keys(SC_SAFETY_FUNCTIONS).length} safety functions</span></span>
          <span className="sccrit-axes__item"><span className="sccrit-axes__k">Event</span><span className="sccrit-axes__v">{Object.keys(SC_INITIATORS).length} initiating events</span></span>
          <span className="sccrit-axes__item"><span className="sccrit-axes__k">State</span><span className="sccrit-axes__v">Operating states from POS</span></span>
        </div>
        <div className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 4 }}>
          <span className="possubtle" style={{ fontSize: 12, marginRight: 2 }}>Function</span>
          <button type="button" className={`poschip${sfId === "all" ? " poschip--primary" : ""}`} onClick={() => setSfId("all")}>All</button>
          {Object.values(SC_SAFETY_FUNCTIONS).map((s) => (
            <button key={s.id} type="button" className={`poschip${sfId === s.id ? " poschip--primary" : ""}`} onClick={() => setSfId(s.id)}>{s.id}</button>
          ))}
        </div>
        <div className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 12 }}>
          <span className="possubtle" style={{ fontSize: 12, marginRight: 2 }}>Event</span>
          <button type="button" className={`poschip${ieId === "all" ? " poschip--primary" : ""}`} onClick={() => setIeId("all")}>All</button>
          {Object.values(SC_INITIATORS).map((i) => (
            <button key={i.id} type="button" className={`poschip${ieId === i.id ? " poschip--primary" : ""}`} onClick={() => setIeId(i.id)}>{i.short}</button>
          ))}
        </div>
        <div className="sccrit">
          {filtered.length === 0 && <p className="possubtle" style={{ fontSize: 12.5, padding: "8px 2px" }}>No criterion recorded for this combination yet.</p>}
          {filtered.map((g) => {
            const sf = SC_SAFETY_FUNCTIONS[g.sf];
            const ie = SC_INITIATORS[g.ie];
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

      {(sc.systemSuccessCriteria ?? []).length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">System success criteria</h3>
            <span className="possubtle">What each system must deliver</span>
          </div>
          <p className="poscard__sub">Each criterion becomes a concrete demand on its systems, modeled by SY.</p>
          <div className="scsys">
            {(sc.systemSuccessCriteria ?? []).map((s) => {
              const passive = SC_PASSIVE_SYSTEMS.includes(s.systemId);
              const dep = SC_SYSTEM_DEPS[s.systemId];
              return (
                <div key={s.uuid} className="scsys__card">
                  <div className="scsys__head">
                    <span className="scsys__icon"><SCIcon.Settings /></span>
                    <span className="scsys__name">{s.description}</span>
                    {passive && <span className="scsys__passive"><SCIcon.Check /> Passive</span>}
                  </div>
                  <div className="scsys__cap">
                    {s.requiredCapacities.map((cap, i) => (
                      <Fragment key={i}>
                        <span className="scsys__cap-k">{cap.parameter}</span>
                        <span className="scsys__cap-v">{cap.value}</span>
                      </Fragment>
                    ))}
                  </div>
                  {dep !== undefined && <div className="scsys__dep">{dep}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(sc.sharedResources ?? []).length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Shared systems</h3>
            <SCProvenanceChip kind="sc">SC-A6</SCProvenanceChip>
          </div>
          <p className="poscard__sub">Single reactor, so sharing is about resources serving more than one source.</p>
          <div className="scsys">
            {(sc.sharedResources ?? []).map((r) => (
              <div key={r.uuid} className="scsys__card">
                <div className="scsys__head">
                  <span className="scsys__icon"><SCIcon.Group /></span>
                  <span className="scsys__name">{r.name}</span>
                </div>
                <div className="scsys__cap">
                  <span className="scsys__cap-k">Shared by</span><span className="scsys__cap-v" style={{ fontFamily: "inherit", fontWeight: 600 }}>{r.description}</span>
                  <span className="scsys__cap-k">Common initiator</span><span className="scsys__cap-v" style={{ fontFamily: "inherit", fontWeight: 600 }}>{r.commonInitiatingEventReferences.join(", ")}</span>
                </div>
                <div className="scsys__dep">{r.allocationStrategy} {r.successCriteriaImpact}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {openGroup !== null && (() => {
        const g = openGroup;
        const sf = SC_SAFETY_FUNCTIONS[g.sf];
        const ie = SC_INITIATORS[g.ie];
        const real = realIes.has(g.ie);
        const rs = rsIes.has(g.ie);
        const systems = SC_CRITERION_SYSTEMS[g.key] ?? [];
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
              <div className="scsss__statement" style={{ margin: 0 }}>
                <span className="scsss__statement-icon"><SCIcon.Target /></span>
                <span className="scsss__statement-text">{g.criterion}</span>
              </div>
              {g.detail.length > 0 && <div><div className="scsec">How it is met</div><p className="scdrawer__text">{g.detail}</p></div>}
              <div className="posfield-grid">
                <div className="posfield"><label className="posfield__label">Safety function</label><div style={{ fontWeight: 700 }}>{sf?.name ?? g.sf}</div></div>
                <div className="posfield"><label className="posfield__label">Initiating event</label><div className="posmono">{g.ie}</div></div>
                <div className="posfield"><label className="posfield__label">Operating states</label><div className="posmono">{g.pos.join(", ")}</div></div>
                <div className="posfield"><label className="posfield__label">Capability</label><div>{real ? "Realistic (CC-II)" : "Generic (CC-I)"}</div></div>
              </div>
              {systems.length > 0 && (
                <div><div className="scsec">Systems credited</div><div className="posrow posrow--wrap" style={{ gap: 6 }}>{systems.map((s) => <span key={s} className="poschip">{sysNameById.get(s) ?? s}</span>)}</div></div>
              )}
              {g.analyses.length > 0 && (
                <div><div className="scsec">Supporting analyses</div><div className="posrow posrow--wrap" style={{ gap: 6 }}>{g.analyses.map((a) => <span key={a} className="poschip poschip--method"><SCIcon.Beaker /> {a}</span>)}</div></div>
              )}
              {rs && <div className="scwarn"><span className="scwarn__icon"><SCIcon.Warn /></span><span>Risk-significant sequence, so CC-II requires realistic, design-specific analysis here.</span></div>}
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}

function MissionScreen(): JSX.Element {
  const { sc } = useScWorkbook();
  const MAX_H = 96;
  const pct = (h: number): number => Math.max(4, Math.min(100, (h / MAX_H) * 100));
  const minPct = (24 / MAX_H) * 100;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sequence mission times</h3>
          <SCProvenanceChip kind="sc">SC-A7</SCProvenanceChip>
        </div>
        <p className="poscard__sub">Minimum 24 hours to a safe stable state. Shortfalls need a treatment.</p>
        <div className="scmt">
          {sc.missionTimes.map((m) => {
            const reaches = m.safeStableStateAchievedWithinMissionTime;
            const ie = SC_MISSION_IE[m.uuid];
            const seq = SC_MISSION_SEQ[m.uuid] ?? m.eventSequenceReference;
            return (
              <div key={m.uuid} className="scmt__row">
                <div>
                  <div className="scmt__seq">{seq}</div>
                  {ie !== undefined && <div className="scmt__ie">{ie}</div>}
                  <div className="scmt__basis">{m.basis}</div>
                  {m.treatmentJustification !== undefined && (
                    <div className="scmt__treat"><SCIcon.Warn /><span>{m.treatmentJustification}</span></div>
                  )}
                </div>
                <div className="scmt__gauge">
                  <div className="scmt__gauge-head">
                    <span className="scmt__gauge-val">{m.missionTimeHours} h</span>
                    <span className={`scmt__reach scmt__reach--${reaches ? "ok" : "no"}`}>
                      {reaches ? <><SCIcon.Check /> Reaches safe state</> : <><SCIcon.Warn /> Treatment applied</>}
                    </span>
                  </div>
                  <div className="scmt__track" style={{ marginTop: 14 }}>
                    <div className={`scmt__fill ${reaches ? "scmt__fill--ok" : "scmt__fill--warn"}`} style={{ width: `${pct(m.missionTimeHours)}%` }} />
                    <div className="scmt__min" style={{ left: `${minPct}%` }}><span className="scmt__min-lab">24 h min</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(sc.componentMissionTimes ?? []).length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Component mission times</h3>
            <SCProvenanceChip kind="sc">SC-A8</SCProvenanceChip>
          </div>
          <p className="poscard__sub">Each component time must support its sequence, or be justified.</p>
          <table className="postable">
            <thead><tr><th>Component</th><th>Component time</th><th>Sequence</th><th>Supports</th></tr></thead>
            <tbody>
              {(sc.componentMissionTimes ?? []).map((c) => {
                const justified = c.shorterMissionTimeJustification !== undefined;
                return (
                  <tr key={c.uuid}>
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
  const { sc } = useScWorkbook();
  const [openId, setOpenId] = useState<string | null>(null);
  const openAnalysis = sc.engineeringAnalyses.find((a) => a.uuid === openId) ?? null;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Engineering analyses</h3>
          <span className="possubtle">{sc.engineeringAnalyses.length} analyses · SC-B1, B4, B8</span>
        </div>
        <p className="poscard__sub">Each criterion rests on a validated, applicable analysis. Select a card for the full record.</p>
        <div className="scanal">
          {sc.engineeringAnalyses.map((a) => {
            const type = SC_ANALYSIS_TYPES[a.analysisType] ?? SC_ANALYSIS_TYPES.OTHER;
            const reasonable = a.reasonablenessReview?.performed === true;
            const realistic = SC_REALISTIC_ANALYSES.includes(a.analysisId);
            return (
              <button key={a.uuid} type="button" className="scanal__card" onClick={() => setOpenId(a.uuid)}>
                <div className="scanal__top">
                  <span className="scanal__type"><NamedIcon name={type.icon} /></span>
                  <div>
                    <div className="scanal__id">{a.analysisId} · {type.label}</div>
                    <div className="scanal__title">{a.description}</div>
                  </div>
                </div>
                {a.computerCode !== undefined && <span className="scanal__code"><SCIcon.Code /> {a.computerCode}{a.codeVersion !== undefined ? ` v${a.codeVersion}` : ""}</span>}
                <div className="scanal__meta"><strong>Applicability.</strong> {a.applicabilityToPlantConditions}</div>
                <div className="scanal__foot">
                  <span className={`scbar__method scbar__method--${realistic ? "realistic" : "conservative"}`}>{realistic ? "Realistic" : "Conservative"}</span>
                  <span className={`scanal__reason scanal__reason--${reasonable ? "ok" : "warn"}`}>
                    {reasonable ? <><SCIcon.Check /> Reasonable</> : <><SCIcon.Warn /> Review open</>}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {(sc.computerCodeValidations ?? []).length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Computer codes</h3>
            <SCProvenanceChip kind="sc">SC-B4</SCProvenanceChip>
          </div>
          <p className="poscard__sub">Each code needs accepted V&V and demonstrated applicability.</p>
          <table className="postable">
            <thead><tr><th>Code</th><th>Validation</th><th>Limitations</th><th>Status</th></tr></thead>
            <tbody>
              {(sc.computerCodeValidations ?? []).map((c) => {
                const warn = SC_WARN_CODES.includes(c.uuid);
                return (
                  <tr key={c.uuid}>
                    <td><span className="posmono" style={{ fontWeight: 700 }}>{c.computerCode}</span><div className="possubtle" style={{ fontSize: 11 }}>v{c.codeVersion}</div></td>
                    <td>{c.verificationDocumentation}</td>
                    <td className="possubtle" style={{ fontSize: 12 }}>{c.limitations.join(" ")}</td>
                    <td>{warn ? <Badge kind="warn">Gap</Badge> : <Badge kind="ok">Validated</Badge>}</td>
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
        <p className="poscard__sub">Load on each barrier against the parameters defining its capacity.</p>
        <div className="scbar">
          {sc.radionuclideBarrierCriteria.map((b) => {
            const spec = SC_RAD_BARRIERS[b.barrierId];
            const load = b.challengeLoads[0];
            return (
              <div key={b.uuid} className="scbar__row">
                <div>
                  <div className="scbar__barname"><span className="scbar__barname-icon"><NamedIcon name={spec?.icon ?? "Shield"} /></span>{spec?.short ?? b.barrierId}</div>
                  <span className={`scbar__method scbar__method--${b.effectivenessEvaluationMethod.toLowerCase()}`} style={{ marginTop: 8, display: "inline-block" }}>{b.effectivenessEvaluationMethod === "REALISTIC" ? "Realistic (CC-II)" : "Conservative (CC-I)"}</span>
                </div>
                <div className="scbar__lc">
                  <div className="scbar__box scbar__box--load"><div className="scbar__box-k">Load</div><div className="scbar__box-v">{load?.loadDescription ?? "—"}</div></div>
                  <div className="scbar__box scbar__box--cap"><div className="scbar__box-k">Capacity</div><div className="scbar__box-v">{b.capacityParameters.join(", ")}</div></div>
                  {b.uncertaintyAssessment !== undefined && <div className="scbar__unc"><SCIcon.Ruler /><span>{b.uncertaintyAssessment}</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(sc.expertJudgments ?? []).length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Expert judgment</h3>
            <SCProvenanceChip kind="sc">SC-B2</SCProvenanceChip>
          </div>
          <p className="poscard__sub">When data or methods are lacking, the Section 4.2 process applies.</p>
          {(sc.expertJudgments ?? []).map((e) => (
            <div key={e.uuid} className="scsys__card" style={{ marginTop: 4 }}>
              <div className="scsys__head">
                <span className="scsys__icon"><SCIcon.Person /></span>
                <span className="scsys__name">{e.topic}</span>
              </div>
              <div className="scanal__meta"><strong>Why.</strong> {e.justification}</div>
              <div className="scanal__meta" style={{ marginTop: 4 }}><strong>Outcome.</strong> {e.outcome}</div>
              <div className="scsys__dep">Panel. {e.panelMembers.join(", ")}.</div>
            </div>
          ))}
        </div>
      )}

      {openAnalysis !== null && (() => {
        const a = openAnalysis;
        const type = SC_ANALYSIS_TYPES[a.analysisType] ?? SC_ANALYSIS_TYPES.OTHER;
        const reasonable = a.reasonablenessReview?.performed === true;
        return (
          <Drawer onClose={() => setOpenId(null)}>
            <div className="scdrawer__head">
              <div>
                <div className="scdrawer__cap">Engineering analysis · {a.analysisId}</div>
                <h2 className="scdrawer__title">{a.description}</h2>
                <p className="scdrawer__sub">{type.label}{a.computerCode !== undefined ? ` · ${a.computerCode} v${a.codeVersion ?? ""}` : ""}</p>
              </div>
              <button type="button" className="scdrawer__close" onClick={() => setOpenId(null)}><SCIcon.Close /></button>
            </div>
            <div className="scdrawer__body">
              <div><div className="scsec">Applicability</div><p className="scdrawer__text">{a.applicabilityToPlantConditions}</p></div>
              {a.validationVerificationBasis !== undefined && <div><div className="scsec">Verification & validation</div><p className="scdrawer__text">{a.validationVerificationBasis}</p></div>}
              {!reasonable && a.reasonablenessReview !== undefined && (
                <div className="scwarn"><span className="scwarn__icon"><SCIcon.Warn /></span><span>{a.reasonablenessReview.conclusion}</span></div>
              )}
              {a.supportedSuccessCriteria.length > 0 && (
                <div><div className="scsec">Supports criteria</div><div className="posrow posrow--wrap" style={{ gap: 6 }}>{a.supportedSuccessCriteria.map((s) => <span key={s} className="poschip">{s}</span>)}</div></div>
              )}
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>{a.implementsSrs.map((s) => <span key={s.sr} className="poschip poschip--method">{s.sr}</span>)}</div>
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}

function PassiveScreen(): JSX.Element {
  const { sc } = useScWorkbook();
  const passive = sc.passiveSafetyFunctionCriteria ?? [];
  if (passive.length === 0) {
    return <div className="poscard"><ScEmpty title="No passive functions recorded yet" hint="Passive safety functions use mechanistic models with characterized model and input uncertainty for functional reliability (SC-B5)." /></div>;
  }
  return (
    <div className="scpsv">
      {passive.map((p) => {
        const warnNote = SC_PASSIVE_WARN[p.uuid];
        const warn = warnNote !== undefined;
        const note = SC_PASSIVE_NOTES[p.uuid];
        return (
          <div key={p.uuid} className={`scpsv__card${warn ? " scpsv__card--warn" : ""}`}>
            <div className="scpsv__head">
              <span className="scpsv__icon"><NamedIcon name={SC_SAFETY_FUNCTIONS[p.safetyFunctionId]?.icon ?? "Atom"} /></span>
              <div>
                <div className="scpsv__name">{p.name}</div>
                <div className="scpsv__phenom">{p.passivePhenomena.map((ph) => <span key={ph} className="scpsv__phenom-tag">{ph}</span>)}</div>
              </div>
            </div>
            <div className="scpsv__grid">
              <div className="scpsv__item">
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
              <div className="scpsv__item">
                <div className="scpsv__item-k"><SCIcon.Network /> Phenomena</div>
                <div className="scpsv__item-v">{p.passivePhenomena.join(", ")}.</div>
              </div>
            </div>
            <div className={`scpsv__rel${warn ? " scpsv__rel--warn" : ""}`}>
              <span className="scpsv__rel-icon">{warn ? <SCIcon.Warn /> : <SCIcon.Check />}</span>
              <span className="scpsv__rel-text">{p.passiveFunctionalReliabilityBasis}</span>
            </div>
            {(note !== undefined || warn) && (
              <div className="scpsv__note"><SCIcon.Sparkle /><span>{note ?? ""}{warn ? ` ${warnNote}` : ""}</span></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConsistencyScreen(): JSX.Element {
  const { sc } = useScWorkbook();
  const cv = sc.consistencyVerifications ?? [];
  const checks: { id: string; subject: string; detail: string; ok: boolean; sr: string }[] = [];
  for (const v of cv) {
    checks.push({ id: `${v.uuid}-d`, subject: "Design features", detail: v.designBasesVerification.description, ok: v.designBasesVerification.isConsistent, sr: "SC-A9" });
    checks.push({ id: `${v.uuid}-l`, subject: "Procedures", detail: v.licensingBasesVerification.description, ok: v.licensingBasesVerification.isConsistent, sr: "SC-A9" });
    checks.push({ id: `${v.uuid}-o`, subject: "Operating philosophy", detail: v.operationalPracticesVerification.description, ok: v.operationalPracticesVerification.isConsistent, sr: "SC-A9" });
  }
  const adc = sc.analysisDetailConsistency;
  checks.push({ id: "adc", subject: "Analysis detail", detail: adc.basis, ok: adc.consistentWithInitiatingEventGrouping && adc.consistentWithPlantOperatingStateDefinition && adc.consistentWithEventSequenceModeling, sr: "SC-B3" });
  const openCount = checks.filter((c) => !c.ok).length;

  const register: { id: string; type: string; tone: BadgeKind | undefined; item: string; detail: string; sr: string }[] = [
    ...sc.modelUncertainty.uncertaintySources.map((u, i) => ({ id: `mu-${i}`, type: "Uncertainty", tone: "progress" as BadgeKind, item: u.source, detail: u.impact, sr: "SC-B9" })),
    ...(sc.preOperationalAssumptions ?? []).map((a) => ({ id: a.uuid, type: "Pre-op", tone: "warn" as BadgeKind, item: a.influenceOnDefinition, detail: a.description, sr: "SC-A11" })),
    ...(sc.sensitivityStudies ?? []).map((s) => ({ id: s.uuid, type: "Sensitivity", tone: undefined, item: s.name ?? s.description, detail: s.results ?? "", sr: "SC-A10" })),
  ];

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consistency checks</h3>
          {openCount === 0 ? <Badge kind="ok">All consistent</Badge> : <Badge kind="warn">{openCount} open</Badge>}
        </div>
        <div className="sccv">
          {checks.map((c) => (
            <div key={c.id} className="sccv__row">
              <span className={`sccv__mark sccv__mark--${c.ok ? "ok" : "no"}`}>{c.ok ? <SCIcon.Check /> : <SCIcon.Warn />}</span>
              <span className="sccv__subject">{c.subject}<span className="sccv__sr">{c.sr}</span></span>
              <span className="sccv__detail">{c.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <span className="possubtle">{register.length} items · SC-A10, A11, B9, B10</span>
        </div>
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
          <h3 className="posgen__readout-h">Send to internal review</h3>
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
          </div>
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Where it goes next</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>These criteria are read by the three elements that consume them.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {SC_DOWNSTREAM_LINKS.map((d) => (
              <span key={d.id} className="poschip poschip--method"><SCIcon.ArrowR /> {d.element}</span>
            ))}
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
  StableScreen,
  CriteriaScreen,
  MissionScreen,
  BasesScreen,
  PassiveScreen,
  ConsistencyScreen,
  DraftScreen,
  PlaceholderScreen,
};
