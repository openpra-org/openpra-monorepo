import { JSX } from "react";
import { DAIcon } from "./daIcons";
import { Badge, DaProvenanceChip, valText, unitText } from "./daShared";
import { useDaWorkbook } from "./daWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  EVIDENCE_LADDER,
  PROBABILITY_MODELS,
  PARAM_TYPES,
  ESTIMATION_APPROACH,
  DA_METHODS,
  GROUPING_BASIS,
  SOURCE_TYPES,
  type Stage,
} from "./daViewData";
import { modelLabel, paramIsWarn } from "./daSelectors";
import { WorkbookUpstreamBar, WorkbookInterfaceMap } from "../workbooks/workbookInterfaces";

interface DaDrawerContext {
  kind: "param" | "boundary" | "grouping" | "estimate";
  id: string;
}

function LadderStrip(): JSX.Element {
  return (
    <div className="daladder">
      {EVIDENCE_LADDER.map((r, i) => {
        const Icon = DAIcon[r.icon] ?? DAIcon.Database;
        return (
          <div key={r.id} className={`daladder__rung daladder__rung--${r.color}`}>
            <span className="daladder__rung-num">{i + 1}</span>
            <span className="daladder__icon"><Icon /></span>
            <div className="daladder__main">
              <div className="daladder__label">{r.label}</div>
              <div className="daladder__tag">{r.tag}</div>
              <p className="daladder__desc">{r.desc}</p>
            </div>
            <span className="daladder__sr posmono">{r.rung}</span>
          </div>
        );
      })}
      <div className="daladder__foot">
        <DAIcon.Tag />
        <span>The rung the estimate stands on is always recorded.</span>
      </div>
    </div>
  );
}

function MethodChips({ ids, label }: { ids: string[]; label?: string }): JSX.Element | null {
  const ms = ids.map((id) => DA_METHODS[id]).filter((m): m is (typeof DA_METHODS)[string] => m !== undefined);
  if (ms.length === 0) return null;
  return (
    <div className="hrmethods">
      {label !== undefined && <span className="hrmethods__label">{label}</span>}
      {ms.map((m) => (
        <span key={m.id} className="hrmethod-chip" title={`${m.name} · ${m.ref}`}>{m.abbr}</span>
      ))}
    </div>
  );
}

function ParamTypePill({ type }: { type: string }): JSX.Element {
  const t = PARAM_TYPES[type];
  return <span className={`daptype daptype--${t?.tone ?? "primary"}`}>{t?.short ?? type}</span>;
}

function RungPill({ approach }: { approach?: string }): JSX.Element {
  const a = approach !== undefined ? ESTIMATION_APPROACH[approach] : undefined;
  return <span className={`darung darung--${a?.rung ?? "generic"}`}>{a?.label ?? "Generic"}</span>;
}

function LadderPosition({ rung }: { rung: string }): JSX.Element {
  return (
    <div className="daladpos">
      {EVIDENCE_LADDER.map((r) => (
        <span key={r.id} className={`daladpos__rung daladpos__rung--${r.color}${r.color === rung ? " daladpos__rung--on" : ""}`} title={r.label}>{r.label}</span>
      ))}
    </div>
  );
}

// ─── 01 — Scope & Sources ──────────────────────────────────────────────────
function ScopeScreen({ ccId, setCcId, stage, setStage }: { ccId: string; setCcId: (id: string) => void; onAction: (msg: string) => void; stage: Stage; setStage: (s: Stage) => void }): JSX.Element {
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The evidence ladder</h3>
          <span className="possubtle">Strongest pedigree first</span>
        </div>
        <p className="poscard__sub">DA fills the empty numeric slots from the model with numbers, each carrying a pedigree.</p>
        <LadderStrip />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <DaProvenanceChip>Linked</DaProvenanceChip>
        </div>
        <p className="poscard__sub">SY hands DA the list of basic events to fill, and POS sets the per-state context and the outage timelines.</p>
        <WorkbookUpstreamBar element="DA" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
          <span className="possubtle">The only sideways supplier in the model</span>
        </div>
        <p className="poscard__sub">DA delivers frequencies to IE, basic-event probabilities and CCF parameters to SY, parameters to HR, and every number to ESQ.</p>
        <WorkbookInterfaceMap element="DA" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">The available estimate with uncertainty, or a realistic mean for the risk-significant basic events.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
              </button>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <DAIcon.Sparkle />
          <span>At CC-II the evidence is the records, since realistic estimates for risk-significant events cannot be met from a handbook.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">DA has the starkest pre-operational fork, since a paper plant has no records to count at all.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Generic sources, technology experience and planned schedules stand in, with every borrowing justified."],
            ["operational", "Operational", "Plant records of failures, demands, time and outages replace the borrowed values and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="da-stage" value={val} checked={stage === val} onChange={() => setStage(val)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <DAIcon.Warn />
          <span>Seventeen operating-only collection requirements show as not applicable while the plant is pre-operational.</span>
        </div>
      </div>
    </>
  );
}

// ─── 02 — Define Parameters (HLR-A) ────────────────────────────────────────
function DefineScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Parameters to estimate</h3>
          <span className="possubtle">{da.parameters.length} slots · DA-A1, A3, A4</span>
        </div>
        <p className="poscard__sub">Each basic event from SY becomes a parameter with a type, a matching boundary and a fitting probability model.</p>
        <div className="daparam">
          {da.parameters.map((p) => (
            <div key={p.uuid} className={`daparam__card${paramIsWarn(p) ? " daparam__card--warn" : ""}`} onClick={() => openDrawer({ kind: "param", id: p.uuid })}>
              <div className="daparam__head">
                <ParamTypePill type={p.parameterType} />
                <span className="daparam__be posmono">{p.basicEventRef}</span>
                <RungPill approach={p.estimationApproach} />
              </div>
              <div className="daparam__name">{p.name}</div>
              <div className="daparam__meta">
                <span className="daparam__sys posmono">{p.systemReference}</span>
                <span className="daparam__pos">{p.plantOperatingStateRef}{p.multiPosApplicabilityJustification !== undefined ? " +" : ""}</span>
                {p.isRiskSignificant === true && <span className="daparam__rs">Risk-significant</span>}
              </div>
              <div className="daparam__foot">
                <span className="daparam__model">{modelLabel(p)}</span>
                <span className="daparam__val posmono">{valText(p.value)}<span className="daparam__unit">{unitText(p.parameterType)}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Component boundaries</h3>
          <DaProvenanceChip>DA-A2</DaProvenanceChip>
        </div>
        <p className="poscard__sub">The boundary, the failure modes and the success criteria must match the SY basic event, or the analysis double-counts.</p>
        <div className="daboundary">
          {da.componentBoundaries.map((b) => {
            const consistent = !b.boundaryBasis.toLowerCase().includes("under review");
            return (
              <div key={b.uuid} className={`daboundary__card${consistent ? "" : " daboundary__card--warn"}`} onClick={() => openDrawer({ kind: "boundary", id: b.uuid })}>
                <div className="daboundary__head">
                  <span className="daboundary__name">{b.name}</span>
                  <span className="daboundary__sys posmono">{b.systemId}</span>
                  {consistent ? <Badge kind="ok">Matches SY</Badge> : <Badge kind="warn">Overlap open</Badge>}
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
                <div className="daboundary__basis"><DAIcon.Link /> {b.boundaryBasis}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Probability model per event</h3>
          <DaProvenanceChip>DA-A3</DaProvenanceChip>
        </div>
        <p className="poscard__sub">A standby pump on demand and a running pump per hour are different objects, so each event gets the model that fits.</p>
        <table className="postable" style={{ marginTop: 4 }}>
          <thead><tr><th>Model</th><th>Basis</th><th>Estimated in</th><th>Distribution</th></tr></thead>
          <tbody>
            {PROBABILITY_MODELS.map((m) => {
              const t = PARAM_TYPES[m.paramType];
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.label}
                    <div className="possubtle" style={{ fontSize: 11.5, marginTop: 2, fontWeight: 400 }}>{m.note}</div>
                  </td>
                  <td><span className={`damodel-basis damodel-basis--${m.basis.toLowerCase()}`}>{m.basis === "DEMAND" ? "Per demand" : "Over time"}</span></td>
                  <td className="posmono" style={{ fontSize: 11.5 }}>{t?.unit}</td>
                  <td className="posmono" style={{ fontSize: 11.5 }}>{m.dist}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── 03 — Group Populations (HLR-B) ────────────────────────────────────────
function GroupScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da } = useDaWorkbook();
  const groupings = da.componentGroupings ?? [];
  const outliers = da.outlierComponents ?? [];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Homogeneous populations</h3>
          <span className="possubtle">{groupings.length} groups · DA-B1</span>
        </div>
        <p className="poscard__sub">Pool components by type at CC-I, or by type and service and environment at CC-II, since pooling unlike things poisons the estimate.</p>
        <div className="dagroup">
          {groupings.map((g) => {
            const basis = GROUPING_BASIS[g.groupingBasis];
            const heldOut = g.excludedOutliers ?? [];
            return (
              <div key={g.uuid} className="dagroup__card" onClick={() => openDrawer({ kind: "grouping", id: g.uuid })}>
                <div className="dagroup__head">
                  <span className="dagroup__icon"><DAIcon.Merge /></span>
                  <div className="dagroup__head-main">
                    <div className="dagroup__name">{g.name}</div>
                    <div className="dagroup__sys posmono">{g.systemId}</div>
                  </div>
                  <span className={`dagroup__cc dagroup__cc--${basis?.cc === "CC-II" ? "ii" : "i"}`}>{basis?.label} · {basis?.cc}</span>
                </div>
                <div className="dagroup__members">
                  {g.componentIds.map((m, i) => <span key={i} className="dagroup__member">{m}</span>)}
                </div>
                <div className="dagroup__service">
                  {g.serviceConditions.map((s, i) => <span key={i} className="dagroup__cond"><DAIcon.Thermo /> {s}</span>)}
                </div>
                <p className="dagroup__just">{g.groupingJustification}</p>
                {heldOut.length > 0 && (
                  <div className="dagroup__outliers"><DAIcon.Filter /> {heldOut.length} outlier{heldOut.length === 1 ? "" : "s"} held out</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Outliers held out</h3>
          <DaProvenanceChip>DA-B2</DaProvenanceChip>
        </div>
        <p className="poscard__sub">A never-tested valve or a mothballed spare does not get pooled with frequently exercised equipment.</p>
        <div className="daoutlier">
          {outliers.map((o) => (
            <div key={o.uuid} className="daoutlier__row">
              <div className="daoutlier__main">
                <span className="daoutlier__name">{o.componentId}</span>
                <span className="daoutlier__reason">{o.exclusionReason}</span>
              </div>
              <div className="daoutlier__diff">
                {o.differentiatingCharacteristics.map((d, i) => <span key={i} className="daoutlier__tag">{d}</span>)}
              </div>
              <Badge kind="ok">Excluded</Badge>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <DAIcon.Filter />
          <span>This is the anti-masking rule applied to populations rather than sequences.</span>
        </div>
      </div>
    </>
  );
}

// ─── 04 — Collect: Generic (HLR-C, first movement) ─────────────────────────
function GenericScreen(): JSX.Element {
  const { da } = useDaWorkbook();
  const sources = da.externalDataSources ?? [];
  function appliesTo(name: string): string[] {
    return da.parameters.filter((p) => (p.dataSources ?? []).some((ds) => ds.source === name)).map((p) => p.uuid);
  }
  function isNonnuclear(limits: string[] | undefined): boolean {
    return (limits ?? []).some((l) => l.toLowerCase().includes("nonnuclear"));
  }
  function isPerState(limits: string[] | undefined): boolean {
    return !(limits ?? []).some((l) => l.toLowerCase().includes("single state"));
  }
  function applicabilityNote(limits: string[] | undefined): string {
    return (limits ?? []).find((l) => l.toLowerCase().includes("applicab")) ?? (limits ?? [])[0] ?? "";
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Generic and technology sources</h3>
          <span className="possubtle">{sources.length} sources · DA-C1, C2</span>
        </div>
        <p className="poscard__sub">Collect generic estimates per operating state, and add technology experience from other facilities while the plant is pre-operational.</p>
        <div className="dasource">
          {sources.map((s) => {
            const otherFacility = s.sourceType === "OTHER_FACILITY_EXPERIENCE";
            const nonnuclear = isNonnuclear(s.limitations);
            const perState = isPerState(s.limitations);
            return (
              <div key={s.uuid} className={`dasource__card${otherFacility ? " dasource__card--other" : ""}`}>
                <div className="dasource__head">
                  <span className="dasource__icon"><DAIcon.Database /></span>
                  <div className="dasource__head-main">
                    <div className="dasource__name">{s.name}</div>
                    <div className="dasource__type">{SOURCE_TYPES[s.sourceType] ?? s.sourceType} · {s.timePeriod.start} to {s.timePeriod.end}</div>
                  </div>
                  {nonnuclear
                    ? <span className="dasource__flag dasource__flag--nonnuclear"><DAIcon.Beaker /> Nonnuclear</span>
                    : otherFacility
                      ? <span className="dasource__flag dasource__flag--other"><DAIcon.Sparkle /> Other facility</span>
                      : null}
                </div>
                <div className="dasource__applies">
                  {appliesTo(s.name).map((pid) => <span key={pid} className="dasource__param posmono">{pid}</span>)}
                </div>
                <p className="dasource__note">{s.qualityAssurance}</p>
                <div className="dasource__foot">
                  <span className={`dasource__state${perState ? " dasource__state--on" : ""}`}>
                    <DAIcon.Layers /> {perState ? "Collected per state" : "Single state"}
                  </span>
                  <DaProvenanceChip>{s.implementsSrs.map((r) => r.sr).join(" · ")}</DaProvenanceChip>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Reuse across operating states</h3>
          <DaProvenanceChip>DA-C25</DaProvenanceChip>
        </div>
        <p className="poscard__sub">A generic estimate is reused for another operating state only after its applicability to that state is established.</p>
        <div className="dareuse">
          {sources.filter((s) => isPerState(s.limitations)).map((s) => (
            <div key={s.uuid} className="dareuse__row">
              <span className="dareuse__name">{s.name}</span>
              <span className="dareuse__just">{applicabilityNote(s.limitations)}</span>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <DAIcon.Warn />
          <span>A full-power failure rate is not automatically the mid-outage rate, so each state is checked.</span>
        </div>
      </div>
    </>
  );
}

export {
  ScopeScreen,
  DefineScreen,
  GroupScreen,
  GenericScreen,
  MethodChips,
  LadderPosition,
  ParamTypePill,
  RungPill,
  type DaDrawerContext,
};
