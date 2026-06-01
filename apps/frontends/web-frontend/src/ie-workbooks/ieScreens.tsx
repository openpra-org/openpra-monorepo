import { JSX, useState } from "react";
import {
  InitiatingEventCategory,
  type InitiatorDefinition,
  type InitiatingEventGroup,
  type InitiatingEventFrequencyQuantification,
  type InitiatingEventScreeningRecord,
  type HazardAnalysis,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import { type Frequency, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { IEIcon } from "./ieIcons";
import { Badge, Stat } from "./ieShared";
import { useIeWorkbook } from "./ieWorkbookContext";
import { CAPABILITY_CATEGORIES, CATEGORY_COLORS, INITIATOR_CATEGORIES, categoryById, type CapabilityCategory } from "./ieViewData";
import { type CcScore } from "./ieSelectors";

function freqValue(f: Frequency | FrequencyWithDistribution): number {
  return typeof f === "number" ? f : f.value;
}

function fmtFreq(f: Frequency | FrequencyWithDistribution | undefined): string {
  if (f === undefined) return "—";
  const v = freqValue(f);
  if (!isFinite(v) || v <= 0) return "—";
  const exp = Math.floor(Math.log10(v));
  const mantissa = v / Math.pow(10, exp);
  const sign = exp < 0 ? "-" : "+";
  return `${mantissa.toFixed(1)}E${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
}

const LOG_MIN = -6.5;
const LOG_MAX = 0.6;

function freqToPct(v: number): number {
  if (!isFinite(v) || v <= 0) return 0;
  const l = Math.log10(v);
  return Math.max(2, Math.min(100, ((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100));
}

function CatIcon({ catId, size = 14 }: { catId: string; size?: number }): JSX.Element {
  const cat = categoryById(catId);
  const Ico = (cat !== undefined && IEIcon[cat.icon] !== undefined) ? IEIcon[cat.icon] : IEIcon.Bolt;
  return (
    <span style={{ display: "inline-flex", width: size, height: size, color: CATEGORY_COLORS[catId] }}>
      <Ico />
    </span>
  );
}

function DispositionChip({ status }: { status: string }): JSX.Element {
  if (status === "RETAINED") return <span className="poschip poschip--ok-soft">Retained</span>;
  if (status === "MERGED") return <span className="poschip">Grouped</span>;
  if (status === "SCREENED_OUT") return <span className="poschip poschip--muted">Screened out</span>;
  return <span className="poschip">{status}</span>;
}

interface ScreenProps {
  ccId: string;
  setCcId: (id: string) => void;
  onAction: (msg: string) => void;
}
function ScopeScreen({ ccId, setCcId }: ScreenProps): JSX.Element {
  const { ie, posLink } = useIeWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const linked = posLink.linkedPosWorkbookId !== null;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Scope of this Initiating Event Analysis</h3>
          {linked ? <Badge kind="ok">Synced from POS</Badge> : <Badge kind="warn">Not linked to POS</Badge>}
        </div>
        <p className="poscard__sub">{ie.praScope.length > 0 ? ie.praScope : "Describe the PRA scope for this initiating event analysis."}</p>
        <div className="posrow posrow--wrap" style={{ gap: 6 }}>
          <span className="poschip">{ie.includesNonInternalHazardGroups ? "Includes non-internal hazard groups" : "Internal events only"}</span>
          <span className="poschip">{ie.applicablePlantOperatingStates.length} operating states in scope</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sources of radioactive material</h3>
          <span className="possubtle">Imported from POS · escape mechanisms are IE's own work (IE-A2)</span>
        </div>
        {posLink.sources.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No sources linked yet. Link a POS workbook on the Operating States step.</p>
        ) : (
          <table className="postable">
            <thead><tr><th>Source</th><th>Location</th><th>Barriers</th></tr></thead>
            <tbody>
              {posLink.sources.map((s) => (
                <tr key={s.id}>
                  <td><div className="postable__name">{s.name}</div></td>
                  <td className="mono">{s.location}</td>
                  <td><div className="posrow posrow--wrap" style={{ gap: 4 }}>{s.barriers.map((b, i) => <span key={i} className="poschip">{b}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Literata', serif", fontWeight: 700, fontSize: 16, color: "var(--color-text)" }}>{c.name}</span>
                  <span className="possubtle" style={{ fontSize: 12 }}>{c.tag}</span>
                </div>
                <div className="possubtle">{c.description}</div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
function StatesScreen({ onOpenLink }: ScreenProps & { onOpenLink: () => void }): JSX.Element {
  const { ie, posLink } = useIeWorkbook();
  if (posLink.linkedPosWorkbookId === null) {
    return (
      <div className="poscard" style={{ textAlign: "center", padding: 32 }}>
        <div style={{ display: "inline-flex", width: 32, height: 32, color: "var(--color-primary)", marginBottom: 10 }}><IEIcon.Link /></div>
        <h3 className="poscard__title" style={{ marginBottom: 6 }}>No operating states linked yet</h3>
        <p className="possubtle" style={{ maxWidth: 460, margin: "0 auto 16px" }}>
          IE works inside the coordinate system POS already defined. Link a POS workbook to import its operating states and sources. Do not retype data that lives upstream.
        </p>
        <button type="button" className="posnav__btn posnav__btn--primary" onClick={onOpenLink}>
          <IEIcon.Download /> Import from a POS workbook
        </button>
      </div>
    );
  }
  const atPower = posLink.states.filter((s) => s.operatingMode === "POWER").length;
  return (
    <>
      <div className="ieposlink">
        <span className="ieposlink__icon"><IEIcon.Link /></span>
        <div className="ieposlink__main">
          <div className="ieposlink__title">Linked to <strong>{posLink.linkedName ?? "POS workbook"}</strong></div>
          <div className="ieposlink__sub">{posLink.states.length} operating states imported.</div>
        </div>
        <div className="ieposlink__actions">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenLink}><IEIcon.Refresh /> Re-link</button>
        </div>
      </div>
      <div className="posstats">
        <Stat num={posLink.states.length} cap="Operating states" sub="Imported from POS" />
        <Stat num={atPower} cap="States at-power" kind="ok" />
        <Stat num={posLink.states.length - atPower} cap="States at LPSD" sub="Shutdown / refuel" />
        <Stat num="IE-C8" cap="Weighting rule" sub="Fraction-of-time applied" />
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Operating states</h3></div>
        <table className="postable">
          <thead><tr><th>State</th><th>Mode</th><th>Mean duration (h)</th><th>Entry frequency</th><th>Initiators applicable</th></tr></thead>
          <tbody>
            {posLink.states.map((s) => {
              const count = ie.initiators.filter((i) => i.applicableStates.includes(s.id)).length;
              return (
                <tr key={s.id}>
                  <td><div className="postable__name">{s.id}</div><span className="postable__name-sub">{s.name}</span></td>
                  <td className="mono">{s.operatingMode}</td>
                  <td className="mono">{s.meanDurationHours.toLocaleString("en-US")}</td>
                  <td className="mono">{s.meanEntryFrequency}</td>
                  <td className="mono">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
function MethodsScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const methodIds = new Set<string>();
  for (const i of ie.initiators) for (const m of i.identificationMethodIds) methodIds.add(m);
  const byMethod = Array.from(methodIds).map((m) => ({ id: m, count: ie.initiators.filter((i) => i.identificationMethodIds.includes(m)).length }));
  return (
    <>
      <div className="posstats">
        <Stat num={methodIds.size} cap="Methods registered" />
        <Stat num={`${ie.completenessSearch.functionalCategoriesCovered.length} / 7`} cap="Categories covered" kind="ok" />
        <Stat num={ie.initiators.length} cap="Initiators yielded" sub="Before grouping" />
        <Stat num={ie.initiatingEventGroups.length} cap="Groups" />
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Systematic search methods</h3></div>
        {byMethod.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No methods recorded yet.</p> : (
          <div className="iemethod-grid">
            {byMethod.map((m) => (
              <div key={m.id} className="iemethod">
                <div className="iemethod__head">
                  <span className="iemethod__icon"><IEIcon.Network /></span>
                  <div className="iemethod__title-block"><div className="iemethod__name">{m.id}</div></div>
                </div>
                <div className="iemethod__foot"><span className="posmono possubtle">{m.count} initiators</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
function IdentifyScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const initiators = ie.initiators;
  const shown = activeCat !== null ? initiators.filter((i) => i.category === activeCat) : initiators;
  const retained = initiators.filter((i) => i.screeningStatus === "RETAINED").length;
  const merged = initiators.filter((i) => i.screeningStatus === "MERGED").length;
  const screened = initiators.filter((i) => i.screeningStatus === "SCREENED_OUT").length;
  const total = initiators.length;
  const cat = activeCat !== null ? categoryById(activeCat) : undefined;

  return (
    <>
      <div className="posstats">
        <Stat num={total} cap="Initiators identified" sub="Across 7 categories" />
        <Stat num={retained} cap="Retained" kind="ok" />
        <Stat num={merged} cap="Grouped" sub="Bounded by a group" />
        <Stat num={screened} cap="Screened out" sub="With justification" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Challenge spectrum (IE-A5)</h3>
          <span className="possubtle">Click a category to filter</span>
        </div>
        <div className="iespectrum">
          <div className="iespectrum__bar" role="img" aria-label="Initiating-event challenge spectrum">
            {INITIATOR_CATEGORIES.map((c) => {
              const n = initiators.filter((i) => i.category === c.id).length;
              if (n === 0 || total === 0) return null;
              const isActive = activeCat === c.id;
              return (
                <button key={c.id} type="button"
                  className={`iespectrum__seg${activeCat !== null && !isActive ? " iespectrum__seg--dim" : ""}`}
                  style={{ width: `${(n / total) * 100}%`, background: CATEGORY_COLORS[c.id] }}
                  onClick={() => setActiveCat(isActive ? null : c.id)}
                  title={`${c.label} · ${n}`}>
                  <span className="iespectrum__seg-n">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="iespectrum__legend">
            {INITIATOR_CATEGORIES.map((c) => {
              const n = initiators.filter((i) => i.category === c.id).length;
              const isActive = activeCat === c.id;
              return (
                <button key={c.id} type="button" className={`iespectrum__leg${isActive ? " iespectrum__leg--active" : ""}`} onClick={() => setActiveCat(isActive ? null : c.id)}>
                  <span className="iespectrum__leg-key" style={{ background: CATEGORY_COLORS[c.id] }} />
                  <span className="iespectrum__leg-label">{c.label}</span>
                  <span className="iespectrum__leg-n">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        {cat !== undefined && (
          <div className="iecat-blurb">
            <CatIcon catId={cat.id} size={18} />
            <div><strong>{cat.label}</strong> <span className="possubtle">— {cat.blurb}</span></div>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">{cat !== undefined ? cat.label : "All initiators"}<span className="possubtle" style={{ fontWeight: 400 }}> · {shown.length}</span></h3>
          {activeCat !== null && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setActiveCat(null)}>Clear filter</button>}
        </div>
        {shown.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No initiators identified yet.</p> : (
          <table className="postable">
            <thead><tr><th>Initiator</th><th>Category</th><th>States</th><th>Barrier</th><th>Disposition</th></tr></thead>
            <tbody>
              {shown.map((i) => {
                const c = categoryById(i.category);
                const barrier = i.barrierImpacts[0]?.state ?? "—";
                return (
                  <tr key={i.uuid}>
                    <td><div className="postable__name">{i.uuid} · {i.name}</div>{i.subcategory !== undefined && <span className="postable__name-sub">{i.subcategory}</span>}</td>
                    <td><span className="iecat-tag"><CatIcon catId={i.category} size={13} /> {c?.label ?? i.category}</span></td>
                    <td className="mono">{i.applicableStates.length}</td>
                    <td><span className={`poschip${barrier === "INTACT" ? "" : " poschip--warn"}`}>{barrier}</span></td>
                    <td><DispositionChip status={i.screeningStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
function CompletenessScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const cs = ie.completenessSearch;
  const checks: { label: string; ok: boolean }[] = [
    { label: "All seven functional categories covered", ok: cs.functionalCategoriesCovered.length >= 7 },
    { label: "Per-system search performed", ok: cs.perSystemSearchPerformed },
    { label: "Per-support-system search performed", ok: cs.perSupportSystemSearchPerformed },
    { label: "Radioactive-source mechanisms addressed", ok: cs.radioactiveSourceMechanismsAddressed },
    { label: "Multi-reactor / shared-source events addressed", ok: cs.multiReactorEventsAddressed },
  ];
  return (
    <>
      <div className="posstats">
        <Stat num={`${cs.functionalCategoriesCovered.length} / 7`} cap="Functional categories" kind={cs.functionalCategoriesCovered.length >= 7 ? "ok" : "warn"} />
        <Stat num={cs.perSystemSearchPerformed ? "Yes" : "No"} cap="Per-system sweep" />
        <Stat num={cs.perSupportSystemSearchPerformed ? "Yes" : "No"} cap="Support-system sweep" />
        <Stat num={cs.radioactiveSourceMechanismsAddressed ? "Yes" : "No"} cap="Source mechanisms" />
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Completeness checks</h3></div>
        <div className="iecheck-list">
          {checks.map((c, i) => (
            <div key={i} className={`iecheck iecheck--${c.ok ? "ok" : "warn"}`}>
              <span className="iecheck__icon">{c.ok ? <IEIcon.Check /> : <IEIcon.Warn />}</span>
              <div className="iecheck__main"><div className="iecheck__label">{c.label}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Coverage matrix: category × state</h3><span className="possubtle">A dot marks an initiator in that category and state</span></div>
        <div className="iecov">
          <table className="iecov__table">
            <thead>
              <tr><th className="iecov__corner" rowSpan={2}>Category</th><th className="iecov__grouph" colSpan={ie.applicablePlantOperatingStates.length}>Operating state (POS)</th></tr>
              <tr>{ie.applicablePlantOperatingStates.map((s) => <th key={s} className="iecov__colh"><span>{s.replace("POS-", "")}</span></th>)}</tr>
            </thead>
            <tbody>
              {INITIATOR_CATEGORIES.map((cat) => (
                <tr key={cat.id}>
                  <td className="iecov__rowh"><CatIcon catId={cat.id} size={13} /> <span>{cat.label}</span></td>
                  {ie.applicablePlantOperatingStates.map((s) => {
                    const hit = ie.initiators.some((i) => i.category === cat.id && i.applicableStates.includes(s));
                    return <td key={s} className="iecov__cell">{hit && <span className="iecov__dot" style={{ background: CATEGORY_COLORS[cat.id] }} />}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
function HazardsScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const hazards: HazardAnalysis[] = ie.hazardAnalyses ?? [];
  return (
    <>
      <div className="posstats">
        <Stat num={hazards.length} cap="Hazard analyses" />
        <Stat num={hazards.filter((h) => h.hazardType === "INTERNAL").length} cap="Internal" />
        <Stat num={hazards.filter((h) => h.hazardType === "EXTERNAL").length} cap="External" />
        <Stat num={hazards.reduce((a, h) => a + h.inducedInitiatorIds.length, 0)} cap="Induced initiators" />
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Hazard analyses</h3><span className="possubtle">IE-A5(e/f)</span></div>
        {hazards.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No hazard analyses recorded yet.</p> : (
          <div className="iehazard-grid">
            {hazards.map((h) => (
              <div key={h.uuid} className="iehazard">
                <div className="iehazard__head">
                  <span className="iehazard__icon"><IEIcon.Flame /></span>
                  <div><div className="iehazard__name">{h.name}</div><div className="iehazard__type">{h.hazardType === "INTERNAL" ? "Internal hazard" : "External hazard"}</div></div>
                </div>
                <p className="iehazard__basis">{h.screeningBasis}</p>
                <div className="iehazard__foot"><span className="possubtle">Induces {h.inducedInitiatorIds.join(", ")}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
function GroupingScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const groups: InitiatingEventGroup[] = ie.initiatingEventGroups;
  const bounded = groups.filter((g) => g.groupingDoesNotMaskRiskSignificantSequences).length;
  return (
    <>
      <div className="posstats">
        <Stat num={groups.length} cap="Initiating-event groups" />
        <Stat num={bounded} cap="Fully bounded" kind="ok" />
        <Stat num={groups.length - bounded} cap="Anti-masking open" kind={groups.length - bounded > 0 ? "warn" : "ok"} />
        <Stat num="CC-II" cap="Grouping rule" />
      </div>
      {groups.length === 0 ? <div className="poscard"><p className="posmuted" style={{ margin: 0 }}>No groups defined yet.</p></div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          {groups.map((g) => (
            <div key={g.uuid} className="poscard">
              <div className="poscard__head">
                <div>
                  <div className="posrow" style={{ gap: 10 }}>
                    <span className="posmono possubtle">{g.uuid}</span>
                    <h3 className="poscard__title" style={{ fontSize: 16 }}>{g.name}</h3>
                    {g.groupingDoesNotMaskRiskSignificantSequences ? <Badge kind="ok">Bounded</Badge> : <Badge kind="warn">Anti-masking open</Badge>}
                  </div>
                  <div className="possubtle" style={{ marginTop: 6 }}>{g.memberInitiatorIds.length} members · Mean {fmtFreq(g.meanFrequency)} per plant-yr</div>
                </div>
              </div>
              <div className="iegroup__members">
                {g.memberInitiatorIds.map((m) => {
                  const init = ie.initiators.find((i) => i.uuid === m);
                  const isBounding = m === g.boundingInitiatorId;
                  return (
                    <span key={m} className={`iegroup__member${isBounding ? " iegroup__member--bounding" : ""}`} title={init?.name ?? m}>
                      {isBounding && <span className="iegroup__member-crown"><IEIcon.Target /></span>}
                      {init !== undefined && <CatIcon catId={init.category} size={13} />}
                      <span className="iegroup__member-id">{m}</span>
                    </span>
                  );
                })}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.55, margin: "12px 0 0" }}>{g.groupingBasis}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
function ScreeningScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const records: InitiatingEventScreeningRecord[] = ie.screeningRecords;
  const screenedOut = records.filter((r) => !r.retained).length;
  const blocked = records.filter((r) => r.retained && !r.barrierIntegrityPreconditionMet).length;
  return (
    <>
      <div className="posstats">
        <Stat num={records.length} cap="Events evaluated" />
        <Stat num={screenedOut} cap="Screened out" sub="SCR-justified" />
        <Stat num={blocked} cap="Blocked at barrier gate" kind="block" />
        <Stat num="IE-C9" cap="Screening rule" sub="Barrier gate + SCR" />
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">The screening gate</h3></div>
        <div className="iegate">
          <div className="iegate__stage"><div className="iegate__stage-num">1</div><div className="iegate__stage-body"><div className="iegate__stage-title">Barrier-integrity precondition (IE-C9a)</div><div className="iegate__stage-sub">Does the event avoid any failure or bypass of a radionuclide transport barrier?</div></div></div>
          <div className="iegate__arrow"><IEIcon.ArrowR /></div>
          <div className="iegate__stage"><div className="iegate__stage-num">2</div><div className="iegate__stage-body"><div className="iegate__stage-title">SCR test (IE-C9b)</div><div className="iegate__stage-sub">Same impact as a much-higher-frequency event, or detected and corrected before a complicated shutdown.</div></div></div>
          <div className="iegate__arrow"><IEIcon.ArrowR /></div>
          <div className="iegate__result"><span className="iegate__result-icon"><IEIcon.Check /></span><span>Eligible to screen</span></div>
        </div>
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Screening decisions</h3></div>
        {records.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No screening records yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {records.map((rec, i) => {
              const target = ie.initiators.find((x) => x.uuid === rec.initiatorOrGroupId);
              return (
                <div key={i} className={`iescreen${!rec.barrierIntegrityPreconditionMet ? " iescreen--blocked" : ""}`}>
                  <div className="iescreen__head">
                    <div className="posrow" style={{ gap: 10 }}>
                      <span className="posmono possubtle">{rec.initiatorOrGroupId}</span>
                      <span className="possubtle">{target?.name ?? ""}</span>
                    </div>
                    {rec.retained ? <Badge kind="block">Retained (gate failed)</Badge> : <Badge kind="draft">Screened out</Badge>}
                  </div>
                  <div className="iescreen__gate">
                    <span className={`iescreen__pre${rec.barrierIntegrityPreconditionMet ? " iescreen__pre--ok" : " iescreen__pre--fail"}`}>
                      {rec.barrierIntegrityPreconditionMet ? <IEIcon.Check /> : <IEIcon.Close />} Barrier intact
                    </span>
                    {rec.criterion !== undefined ? <span className="poschip poschip--primary">{rec.criterion}</span> : <span className="poschip poschip--warn">No SCR, barrier gate blocks screening</span>}
                  </div>
                  <p className="iescreen__just">{rec.justification}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
function FrequencyScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const records: InitiatingEventFrequencyQuantification[] = ie.quantifications;
  const ranked = [...records].sort((a, b) => freqValue(b.meanFrequency) - freqValue(a.meanFrequency));
  const labelFor = (id: string): string => {
    const grp = ie.initiatingEventGroups.find((g) => g.uuid === id);
    if (grp !== undefined) return grp.name;
    const init = ie.initiators.find((i) => i.uuid === id);
    return init?.name ?? id;
  };
  const weighted = records.filter((r) => r.posTimeFractionApplied).length;
  const ticks = ["1e-6", "1e-5", "1e-4", "1e-3", "1e-2", "1e-1", "1e0"];
  return (
    <>
      <div className="posstats">
        <Stat num={records.length} cap="Quantified events / groups" />
        <Stat num="plant-yr" cap="Frequency basis" sub="IE-C8 · calendar-year" kind="ok" />
        <Stat num={`${weighted} / ${records.length}`} cap="POS-time-fraction applied" />
        <Stat num={ie.initiatingEventGroups.length} cap="Groups quantified" />
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Annual frequencies</h3></div>
        {records.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No quantifications yet.</p> : (
          <div className="iefreq">
            <div className="iefreq__axis">
              {ticks.map((t) => <span key={t} className="iefreq__tick" style={{ left: `${freqToPct(parseFloat(t))}%` }}>{fmtFreq(parseFloat(t))}</span>)}
            </div>
            {ranked.map((r) => {
              const mean = freqValue(r.meanFrequency);
              const high = r.basis === "FAULT_TREE" || mean >= 1;
              return (
                <div key={r.initiatorOrGroupId} className="iefreq__row">
                  <div className="iefreq__label">
                    <span className="iefreq__label-id">{r.initiatorOrGroupId}</span>
                    <span className="iefreq__label-name">{labelFor(r.initiatorOrGroupId)}</span>
                  </div>
                  <div className="iefreq__track">
                    <div className={`iefreq__fill${high ? " iefreq__fill--high" : ""}`} style={{ width: `${freqToPct(mean)}%` }} />
                    <span className="iefreq__val">{fmtFreq(r.meanFrequency)}<span className="iefreq__unit"> per plant-yr</span></span>
                  </div>
                  <div className="iefreq__meta">
                    <span className="poschip">{r.basis.replace(/_/g, " ").toLowerCase()}</span>
                    {r.posTimeFractionApplied
                      ? <span className="iefreq__flag iefreq__flag--ok"><IEIcon.Layers /> weighted</span>
                      : <span className="iefreq__flag"><IEIcon.Quake /> hazard curve</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  const ready = scores.blocked === 0;
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>IE Workbook</h1>
        <h2>Preliminary Initiating Event Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {[["Executive summary", "4"], ["Sources of radioactive material", "7"], ["Identification of initiating events", "9"], ["Grouping of initiating events", "21"], ["Screening of initiating events", "24"], ["Initiating-event frequencies", "27"], ["Model uncertainty & assumptions", "33"]].map(([t, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>
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
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" className="posnav__btn posnav__btn--primary" disabled={!canSubmit} style={!canSubmit ? { opacity: 0.5, cursor: "not-allowed" } : undefined} onClick={() => onSubmitDraft(ready)}>
              <IEIcon.Send /> Submit draft to internal review
            </button>
          </div>
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Downstream interfaces</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="poschip poschip--method"><IEIcon.ArrowR /> Event Sequence Analysis (ES)</span>
            <span className="poschip poschip--method"><IEIcon.ArrowR /> Event Sequence Quantification (ESQ)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  ScopeScreen,
  StatesScreen,
  MethodsScreen,
  IdentifyScreen,
  CompletenessScreen,
  HazardsScreen,
  GroupingScreen,
  ScreeningScreen,
  FrequencyScreen,
  DraftScreen,
  type ScreenProps,
};
