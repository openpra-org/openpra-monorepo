import { JSX, useState } from "react";
import { POSIcon } from "./posIcons";
import { Badge, Stat } from "./posShared";
import {
  CAPABILITY_CATEGORIES,
  CC_SCORES,
  POS_DOCUMENTS,
  type CapabilityCategory,
  type CcScore,
} from "./posViewData";
import {
  statesView,
  evolutionsView,
  interviewsView,
  screeningView,
  groupsView,
  isBarrierBroken,
  type Stage,
} from "./posSelectors";

// hardcoded — the per-screen summary figures (stat tiles, "still missing" notes,
// guided-Q&A prose) are static demo copy that mirrors the reference design.

interface DrawerContext {
  kind: "state" | "evolution" | "group";
  id: string;
}

interface ScreenProps {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  openDrawer: (ctx: DrawerContext) => void;
  onAction: (msg: string) => void;
}

function SetupScreen({ ccId, setCcId, stage, setStage, onAction }: ScreenProps): JSX.Element {
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant identity</h3>
          <Badge kind="ok">Verified from design basis</Badge>
        </div>
        <p className="poscard__sub">Inputs were drawn from the uploaded Design Basis Document (Rev 4). Edit if anything looks wrong.</p>
        <div className="posfield-grid">
          <div className="posfield">
            <label className="posfield__label">Plant name</label>
            <input className="posfield__input" defaultValue="Aurora-1" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Vendor / designer</label>
            <input className="posfield__input" defaultValue="Argent Nuclear" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Reactor type</label>
            <select className="posfield__select" defaultValue="sfr">
              <option value="sfr">Sodium-cooled fast reactor (SFR)</option>
              <option value="htgr">High-temperature gas-cooled reactor</option>
              <option value="msr">Molten salt reactor</option>
              <option value="lfr">Lead-cooled fast reactor</option>
              <option value="other">Other (specify)</option>
            </select>
          </div>
          <div className="posfield">
            <label className="posfield__label">Thermal power</label>
            <input className="posfield__input" defaultValue="300 MWt" />
          </div>
        </div>
        <div className="posfield-grid posfield-grid--3" style={{ marginTop: 16 }}>
          <div className="posfield">
            <label className="posfield__label">Primary coolant</label>
            <input className="posfield__input" defaultValue="Liquid sodium" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Intermediate coolant</label>
            <input className="posfield__input" defaultValue="Liquid sodium" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Power conversion fluid</label>
            <input className="posfield__input" defaultValue="Supercritical CO₂" />
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant stage</h3>
        </div>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          <label className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === "pre_operational" ? "var(--color-primary)" : undefined }}>
            <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
              <input type="radio" name="stage" value="pre_operational" checked={stage === "pre_operational"} onChange={() => setStage("pre_operational")} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>Pre-operational</div>
                <div className="possubtle" style={{ fontSize: 12.5 }}>
                  Plant not yet built or operated. Inputs come from design basis, vendor data, and engineering interviews.
                </div>
              </div>
            </div>
          </label>
          <label className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === "operational" ? "var(--color-primary)" : undefined }}>
            <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
              <input type="radio" name="stage" value="operational" checked={stage === "operational"} onChange={() => setStage("operational")} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>Operational</div>
                <div className="possubtle" style={{ fontSize: 12.5 }}>
                  Plant is operating. Expected records: operating history, walkdowns, interviews with operations staff.
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const scores = CC_SCORES[c.id];
            return (
              <button
                key={c.id}
                type="button"
                className="poscard"
                onClick={() => setCcId(c.id)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: active ? "var(--color-primary)" : undefined,
                  boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Literata', serif", fontWeight: 700, fontSize: 16, color: "var(--color-text)" }}>
                    {c.name}
                  </span>
                  <span className="possubtle" style={{ fontSize: 12 }}>{c.tag}</span>
                </div>
                <div className="possubtle" style={{ marginBottom: 10 }}>{c.description}</div>
                <div className="posrow" style={{ justifyContent: "space-between" }}>
                  <span className="posmono possubtle">{scores.applicable} items required</span>
                  <span className={`poschip ${active ? "poschip--primary" : ""}`}>{scores.percent}% ready</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Freeze date &amp; scope</h3>
        </div>
        <div className="posfield-grid">
          <div className="posfield">
            <label className="posfield__label">Freeze date <span className="posfield__label-opt">(plant configuration as of)</span></label>
            <input type="date" className="posfield__input" defaultValue="2026-04-01" />
          </div>
          <div className="posfield">
            <label className="posfield__label">Includes at-power operations?</label>
            <select className="posfield__select" defaultValue="yes">
              <option value="yes">Yes</option>
              <option value="no">No (LPSD-only)</option>
            </select>
          </div>
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label">Hazard groups in scope</label>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              <span className="poschip poschip--primary">Internal events</span>
              <span className="poschip">Internal fire</span>
              <span className="poschip">Internal flooding</span>
              <span className="poschip">Seismic</span>
              <button type="button" className="poschip" onClick={() => onAction("Hazard group editor opening…")}><POSIcon.Plus /> Add hazard group</button>
            </div>
            <p className="posfield__hint" style={{ marginTop: 10 }}>
              <strong>Note:</strong> Selecting hazards beyond internal events requires checking that POS definitions are still bounding for each hazard. OpenPRA will guide you in step 4.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function DocumentsScreen({ onAction }: ScreenProps): JSX.Element {
  return (
    <>
      <div className="posupload">
        <div className="posupload__icon"><POSIcon.Upload /></div>
        <div className="posupload__copy">
          <div className="posupload__copy-title">Drag &amp; drop design documents, P&amp;IDs, procedures, or prior PRAs</div>
          <div className="posupload__copy-sub">OpenPRA reads the contents, identifies relevant inputs, and links them to the right operating-state fields.</div>
        </div>
        <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Document picker opening…")}>
          <POSIcon.Upload /> Browse files
        </button>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Uploaded documents</h3>
          <div className="posrow" style={{ gap: 12 }}>
            <Badge kind="ok">{POS_DOCUMENTS.length} files</Badge>
            <Badge kind="progress">All extracted</Badge>
          </div>
        </div>
        <div className="posdoc-list">
          {POS_DOCUMENTS.map((d) => (
            <div key={d.id} className="posdoc">
              <div className="posdoc__icon">
                {d.kind === "sheet" ? <POSIcon.Sheet /> : d.kind === "image" ? <POSIcon.Image /> : <POSIcon.Doc />}
              </div>
              <div className="posdoc__main">
                <div className="posdoc__name">{d.name}</div>
                <div className="posdoc__meta">{d.size} · uploaded {d.uploaded} · linked to {d.linked} field{d.linked === 1 ? "" : "s"}</div>
              </div>
              <div className="posdoc__extracted">
                <POSIcon.Sparkle /> {d.extracted}
              </div>
              <Badge kind="ok">Indexed</Badge>
              <button type="button" className="posdoc__more" aria-label="More"><POSIcon.More /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard poscard--ghost">
        <div className="poscard__head">
          <h3 className="poscard__title">What OpenPRA is still missing</h3>
        </div>
        <p className="posmuted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
          Based on the uploaded set, three field groups have no source document attached:
        </p>
        <ul style={{ margin: "12px 0 0", paddingLeft: 22, fontSize: 13.5, lineHeight: 1.75, color: "var(--color-text)" }}>
          <li>Maintenance configuration document for IHX drained operation (referenced in POS-08)</li>
          <li>Cover-gas adjustment procedure (referenced in POS-09)</li>
          <li>Spent-fuel storage layout for ex-core source inventory</li>
        </ul>
      </div>
    </>
  );
}

function EvolutionsScreen({ openDrawer, onAction }: ScreenProps): JSX.Element {
  const evolutions = evolutionsView();
  return (
    <>
      <div className="posstats">
        <Stat num="5" cap="Evolutions" sub="From design basis" />
        <Stat num="9" cap="Operating states" sub="Slice of 5 evolutions" />
        <Stat num="8,760 h" cap="Cycle coverage" sub="100.00 % covered" kind="ok" />
        <Stat num="0" cap="Gaps detected" sub="Mutual exclusivity OK" kind="ok" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant evolutions</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn"><POSIcon.Funnel /> Filter</button>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Add evolution…")}><POSIcon.Plus /> Add evolution</button>
          </div>
        </div>
        <p className="poscard__sub">
          An evolution is a process the plant goes through (e.g., refuelling, at-power, etc.). Evolutions are sliced into operating states next.
        </p>
        <table className="postable">
          <thead>
            <tr>
              <th>Evolution</th>
              <th>States</th>
              <th>% of cycle</th>
              <th>Source document</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {evolutions.map((ev) => (
              <tr key={ev.id} className="postable__row--clickable" onClick={() => openDrawer({ kind: "evolution", id: ev.id })}>
                <td>
                  <div className="postable__name">{ev.name}</div>
                  <span className="postable__name-sub">{ev.id} · {ev.description}</span>
                </td>
                <td className="mono">{ev.statesCount}</td>
                <td className="mono">{(ev.durationFraction * 100).toFixed(1)} %</td>
                <td className="mono">{ev.fromDoc}</td>
                <td><POSIcon.Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatesScreen({ openDrawer, onAction }: ScreenProps): JSX.Element {
  const [showQA, setShowQA] = useState(false);
  const states = statesView();
  return (
    <>
      <div className="posstats">
        <Stat num="9" cap="Operating states" sub="Across 5 evolutions" />
        <Stat num="7" cap="Fully characterised" kind="ok" />
        <Stat num="1" cap="Needs attention" kind="warn" sub="POS-04 barrier-status" />
        <Stat num="2" cap="Draft" sub="POS-08, POS-09" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operating states</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn" onClick={() => setShowQA(!showQA)}>
              <POSIcon.Help /> {showQA ? "Hide guided Q&A" : "Guided Q&A"}
            </button>
            <button type="button" className="posnav__btn"><POSIcon.Sheet /> Import CSV</button>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Add operating state…")}><POSIcon.Plus /> Add state</button>
          </div>
        </div>

        {showQA && (
          <div style={{ marginBottom: 18, padding: 18, background: "var(--color-primary-soft)", borderRadius: 10, border: "1px solid var(--color-primary-focus)" }}>
            <div style={{ fontFamily: "'Nunito Sans', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-primary)", marginBottom: 10 }}>
              <POSIcon.Sparkle /> Guided Q&amp;A — OpenPRA asks, you answer
            </div>
            <div className="posqa">
              <div className="posqa__q">
                <div className="posqa__q-num">1</div>
                <div>
                  <p className="posqa__q-text">During hot standby, are both intermediate heat-transport loops in service, or is one in standby?</p>
                  <p className="posqa__q-hint">Affects whether POS-03 should split into two sub-states.</p>
                </div>
              </div>
              <div className="posqa__a">
                <textarea defaultValue="Both loops are normally aligned in standby with primary sodium pump A in operation. Loop B is the standby train; switchover takes ~12 min via OP-002 §5.4." />
                <div className="posqa__a-meta">
                  <span className="poschip poschip--primary">Linked to POS-03</span>
                  <span className="possubtle">· Will update barrier &amp; SSC fields automatically</span>
                </div>
              </div>
              <div className="posqa__q">
                <div className="posqa__q-num">2</div>
                <div>
                  <p className="posqa__q-text">In fuel-handling mode (POS-06), is the containment volume deinerted or kept under cover gas?</p>
                  <p className="posqa__q-hint">Determines whether POS-06 needs a separate radionuclide-transport barrier configuration.</p>
                </div>
              </div>
              <div className="posqa__a">
                <textarea placeholder="Type your answer…" />
              </div>
            </div>
          </div>
        )}

        <table className="postable">
          <thead>
            <tr>
              <th>State</th>
              <th>Mode</th>
              <th>Coolant T</th>
              <th>Power</th>
              <th>Barriers</th>
              <th>Status</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.id} className="postable__row--clickable" onClick={() => openDrawer({ kind: "state", id: s.id })}>
                <td>
                  <div className="postable__name">{s.id}</div>
                  <span className="postable__name-sub">{s.name}</span>
                </td>
                <td className="mono">{s.mode}</td>
                <td className="mono">{s.rcs.temp}</td>
                <td className="mono">{s.rcs.power}</td>
                <td>
                  <div className="posrow posrow--wrap" style={{ gap: 4 }}>
                    {s.barriers.map((b) => (
                      <span key={b} className={`poschip${isBarrierBroken(b) ? " poschip--warn" : ""}`}>{b}</span>
                    ))}
                  </div>
                </td>
                <td>
                  {s.status === "ok" && <Badge kind="ok">Ready</Badge>}
                  {s.status === "warn" && <Badge kind="warn">Needs attention</Badge>}
                  {s.status === "draft" && <Badge kind="draft">Draft</Badge>}
                  {s.statusMessage !== undefined && (
                    <div className="possubtle" style={{ marginTop: 4, fontSize: 11.5 }}>{s.statusMessage}</div>
                  )}
                </td>
                <td><POSIcon.Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Coverage check</h3>
          <Badge kind="ok">All conditions covered, no overlaps</Badge>
        </div>
        <p className="poscard__sub">
          OpenPRA continuously checks that every plant condition belongs to exactly one operating state (non-overlapping) and that the operating states together cover the full operating cycle (no gaps).
        </p>
        <div className="posrow" style={{ gap: 22, marginTop: 10 }}>
          <div className="posrow" style={{ gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-complete)" }} />
            <span className="possubtle">Mutual exclusivity verified across 9 states</span>
          </div>
          <div className="posrow" style={{ gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-complete)" }} />
            <span className="possubtle">Collective exhaustivity 100.00 % (8,760 h / 8,760 h)</span>
          </div>
        </div>
      </div>
    </>
  );
}

function InterviewsScreen({ onAction }: ScreenProps): JSX.Element {
  const interviews = interviewsView();
  return (
    <>
      <div className="posstats">
        <Stat num="7" cap="Sessions logged" />
        <Stat num="12" cap="Personnel involved" sub="Across 5 roles" />
        <Stat num="3" cap="Findings actioned" sub="Updated POS definitions" kind="ok" />
        <Stat num="Apr 14, 2026" cap="Most recent" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interview &amp; walkdown log</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn"><POSIcon.Mic /> Record session</button>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("New interview entry…")}><POSIcon.Plus /> Log session</button>
          </div>
        </div>
        <p className="poscard__sub">
          For pre-operational plants, engineering interviews substitute for operations walkdowns.
        </p>
        <table className="postable">
          <thead>
            <tr>
              <th>Session</th>
              <th>Method</th>
              <th>Personnel</th>
              <th>Findings</th>
              <th>Impact</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {interviews.map((iv) => (
              <tr key={iv.id} className="postable__row--clickable">
                <td>
                  <div className="postable__name">{iv.id}</div>
                  <span className="postable__name-sub">{iv.date} · {iv.evolutionId ?? "All evolutions"}</span>
                </td>
                <td><span className="poschip">{iv.method}</span></td>
                <td>
                  <div style={{ fontSize: 12.5 }}>{iv.personnel.join(", ")}</div>
                </td>
                <td>
                  <div style={{ fontSize: 12.5, color: "var(--color-text)", maxWidth: 380 }}>{iv.findings}</div>
                </td>
                <td>
                  {iv.overlooked > 0 ? (
                    <Badge kind="warn">{iv.overlooked} new state{iv.overlooked === 1 ? "" : "s"} identified</Badge>
                  ) : (
                    <Badge kind="ok">No new states</Badge>
                  )}
                </td>
                <td><POSIcon.Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ScreeningScreen({ onAction }: ScreenProps): JSX.Element {
  const records = screeningView();
  return (
    <>
      <div className="posstats">
        <Stat num="9" cap="Operating states" />
        <Stat num="2" cap="Retained explicitly" kind="ok" />
        <Stat num="1" cap="Screened out" sub="With justification" />
        <Stat num="6" cap="Default-retained" sub="No screening request" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screening decisions</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onAction("Open screening dialog…")}><POSIcon.Plus /> Propose screening</button>
          </div>
        </div>
        <p className="poscard__sub">
          Screen out a state only with written justification that downstream PRA results stay unchanged.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {records.map((rec) => (
            <div key={rec.id} className="poscard" style={{ padding: 16 }}>
              <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div className="posrow" style={{ gap: 10 }}>
                  <span className="posmono possubtle">{rec.id}</span>
                  <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14 }}>{rec.posId}</span>
                  {rec.retained ? <Badge kind="ok">Retained</Badge> : <Badge kind="draft">Screened out</Badge>}
                </div>
                <div className="posrow" style={{ gap: 10 }}>
                  {rec.criterion !== null && <span className="poschip">{rec.criterion}</span>}
                  <span className={`poschip ${rec.riskImpact === "High" ? "poschip--warn" : ""}`}>Risk impact: {rec.riskImpact}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.55 }}>{rec.justification}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function GroupingScreen({ openDrawer }: ScreenProps): JSX.Element {
  const groups = groupsView();
  return (
    <>
      <div className="posstats">
        <Stat num="9" cap="Operating states" />
        <Stat num="3" cap="Groups proposed" />
        <Stat num="2" cap="Groups fully bounded" kind="ok" />
        <Stat num="1" cap="Group needs rationale" kind="warn" sub="GRP-RFG" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {groups.map((g) => (
          <div key={g.id} className="poscard">
            <div className="poscard__head">
              <div>
                <div className="posrow" style={{ gap: 10 }}>
                  <span className="posmono possubtle">{g.id}</span>
                  <h3 className="poscard__title" style={{ fontSize: 16 }}>{g.name}</h3>
                  {g.status === "ok" ? <Badge kind="ok">Bounded</Badge> : <Badge kind="warn">Rationale pending</Badge>}
                </div>
                <div className="possubtle" style={{ marginTop: 6 }}>
                  Members: {g.members.join(", ")} · Total time {g.durationSum}
                </div>
              </div>
              <button type="button" className="posnav__btn" onClick={() => openDrawer({ kind: "group", id: g.id })}>Edit</button>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.55, marginBottom: 10 }}>{g.rationale}</div>
            <div className="posrow" style={{ gap: 22, fontSize: 12.5 }}>
              <div><span className="possubtle">Bounding by</span> <strong style={{ color: "var(--color-text)" }}>{g.boundingCharacteristic}</strong></div>
              <div><span className="possubtle">Member states</span> {g.members.map((m) => <span key={m} className="poschip" style={{ marginRight: 4 }}>{m}</span>)}</div>
            </div>
            {g.statusMessage !== undefined && (
              <div style={{ marginTop: 10, padding: 10, background: "rgba(196,122,24,0.08)", borderLeft: "3px solid var(--color-warning)", borderRadius: 4, fontSize: 12.5, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", width: 14, height: 14, color: "var(--color-warning)", flexShrink: 0 }}><POSIcon.Warn /></span>
                <span>{g.statusMessage}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function FrequencyScreen(): JSX.Element {
  const states = statesView();
  return (
    <>
      <div className="posstats">
        <Stat num="9 / 9" cap="Durations entered" kind="ok" />
        <Stat num="8 / 9" cap="Frequencies entered" kind="warn" sub="POS-09 pending" />
        <Stat num="8,760 h" cap="Sum across states" sub="100.00 % of cycle" kind="ok" />
        <Stat num="6" cap="LPSD states" sub="Decay-heat req'd in step 9" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Frequencies &amp; durations</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className="posnav__btn"><POSIcon.Sheet /> Import from operating data</button>
            <button type="button" className="posnav__btn"><POSIcon.Sparkle /> Auto-distribute from cycle plan</button>
          </div>
        </div>
        <table className="postable">
          <thead>
            <tr>
              <th>State</th>
              <th>Mode</th>
              <th>Mean duration</th>
              <th>Entry frequency</th>
              <th>Basis</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.id} className="postable__row--clickable">
                <td>
                  <div className="postable__name">{s.id}</div>
                  <span className="postable__name-sub">{s.name}</span>
                </td>
                <td className="mono">{s.mode}</td>
                <td className="mono">{s.duration}</td>
                <td className="mono">{s.frequency}</td>
                <td>
                  {s.id === "POS-09"
                    ? <Badge kind="warn">Basis not documented</Badge>
                    : <span className="possubtle" style={{ fontSize: 12.5 }}>Cycle plan §4 / Vendor letter NR-2024-117</span>}
                </td>
                <td><POSIcon.Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DecayHeatScreen({ onAction }: ScreenProps): JSX.Element {
  const lpsd = statesView().filter((s) => s.mode !== "POWER" && s.retained);
  return (
    <>
      <div className="posstats">
        <Stat num="6" cap="LPSD states require char." />
        <Stat num="0" cap="Characterised" kind="block" sub="Blocker for report" />
        <Stat num="DOC-08" cap="Decay heat source" sub="Vendor curves loaded" />
        <Stat num="Apr 12, 2026" cap="Last vendor update" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Decay-heat characterisation</h3>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onAction("Generating decay-heat from vendor curves…")}>
            <POSIcon.Sparkle /> Generate from curves
          </button>
        </div>
        <table className="postable">
          <thead>
            <tr>
              <th>State</th>
              <th>Time after shutdown</th>
              <th>Decay-heat level</th>
              <th>Basis</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lpsd.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="postable__name">{s.id}</div>
                  <span className="postable__name-sub">{s.name}</span>
                </td>
                <td className="mono">—</td>
                <td className="mono">—</td>
                <td className="possubtle">Pending vendor curve fit</td>
                <td><Badge kind="block">Required</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function GenerateScreen({
  cc,
  scores,
  stage,
  onGenerate,
}: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: Stage;
  onGenerate: (final: boolean) => void;
}): JSX.Element {
  const ready = scores.blocked === 0;
  const toc: [string, string][] = [
    ["Executive summary", "4"],
    ["Introduction", "5"],
    ["    Purpose", "5"],
    ["    Scope", "5"],
    ["    Relationship to other documents", "5"],
    ["    Document layout", "5"],
    ["    Quality assurance", "6"],
    ["    Freeze date", "6"],
    ["Assumptions and limitations", "7"],
    ["Identify plant operating states and evolutions", "9"],
    ["    Plant evolutions", "10"],
    ["    Plant operating states", "12"],
    ["    Interviews", "18"],
    ["Screening and grouping plant operating states", "20"],
    ["    Screening plant operating states", "20"],
    ["    Grouping plant operating states", "22"],
    ["Plant operating state frequencies and durations", "25"],
    ["    Frequencies and durations analysis", "25"],
    ["    Decay heat levels", "27"],
    ["References", "30"],
  ];
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>Aurora-1 — Pre-operational PRA Model</h1>
        <h2>Preliminary Plant Operating State Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {toc.map(([t, p]) => (
            <div key={t} className="posgen__preview-toc-row">
              <span>{t}</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
        <h3>Executive summary</h3>
        <p style={{ marginTop: 0 }}>
          This document presents the preliminary Plant Operating State (POS) analysis for the Aurora-1 sodium fast reactor, prepared during the pre-operational stage to support the design certification submittal. Nine plant operating states across five plant evolutions have been defined, characterised, and reviewed for completeness against the {cc.name} ({cc.tag.toLowerCase()}) capability target.
        </p>
        <p>
          {ready
            ? `All items required at ${cc.name} are satisfied. The set of operating states is mutually exclusive, collectively exhaustive across the assumed operating cycle, and traceable to the design basis.`
            : `The conformance check identifies ${scores.blocked} blocking item${scores.blocked === 1 ? "" : "s"} and ${scores.warn} item${scores.warn === 1 ? "" : "s"} requiring attention before the report can be considered final at ${cc.name}.`}
        </p>
        <h4>1 · Plant evolutions</h4>
        <p>The plant evolutions identified for Aurora-1 are listed below. Each evolution represents a distinct operating process; the operating states defined in §4.2 partition each evolution into intervals of stable plant response.</p>
        <ol>
          <li><strong>At-power operations</strong> — full-power and load-follow operation.</li>
          <li><strong>Planned shutdown to refuelling</strong> — controlled cooldown to refuelling temperature.</li>
          <li><strong>Refuelling</strong> — in-vessel fuel handling under cover gas.</li>
          <li><strong>Forced outage (reactor trip)</strong> — post-trip cooldown via DRACS.</li>
          <li><strong>Maintenance with reactor at zero power</strong> — IHX-loop maintenance configuration.</li>
        </ol>
      </div>

      <div className="posgen__side">
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Conformance check</h3>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Capability category</span>
            <span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span>
          </div>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Plant stage</span>
            <span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span>
          </div>
          <div className="posgen__bar">
            <span className="posgen__bar-label">Items satisfied</span>
            <span className="posmono">{scores.met} / {scores.applicable}</span>
          </div>
          {scores.warn > 0 && (
            <div className="posgen__bar">
              <span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span>
              <span className="posmono">{scores.warn}</span>
            </div>
          )}
          {scores.blocked > 0 && (
            <div className="posgen__bar">
              <span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span>
              <span className="posmono">{scores.blocked}</span>
            </div>
          )}
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Pre-operational assumptions</h3>
          <div className="possubtle" style={{ fontSize: 12.5, marginBottom: 10 }}>
            6 logged · 2 with closure plans pending design freeze.
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.6, color: "var(--color-text)" }}>
            <li>Refuelling cycle length assumed from vendor baseline (NR-2024-117).</li>
            <li>DRACS heat-removal performance taken from prototype testing.</li>
            <li>Cover-gas vent rate assumed bounded by design limit.</li>
            <li>+3 more — view in document.</li>
          </ul>
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Generate</h3>
          {ready ? (
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              All items pass at <strong>{cc.name}</strong>. The report will be produced as a Word document matching the OpenPRA POS template.
            </p>
          ) : (
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              {scores.blocked} blocking item{scores.blocked === 1 ? "" : "s"} must be resolved before the report can be marked final. You may still generate a <em>draft</em> with the open items flagged inline.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onGenerate(ready)}>
              <POSIcon.Download /> {ready ? "Generate report (.docx)" : "Generate draft report"}
            </button>
            <button type="button" className="posnav__btn" onClick={() => onGenerate(ready)}>
              <POSIcon.Eye /> Preview before generating
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  type DrawerContext,
  type ScreenProps,
  SetupScreen,
  DocumentsScreen,
  EvolutionsScreen,
  StatesScreen,
  InterviewsScreen,
  ScreeningScreen,
  GroupingScreen,
  FrequencyScreen,
  DecayHeatScreen,
  GenerateScreen,
};
