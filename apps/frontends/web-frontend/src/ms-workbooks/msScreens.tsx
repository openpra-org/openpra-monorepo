import { JSX } from "react";
import { MSIcon } from "./msIcons";
import { Badge, MsProvenanceChip, valText, fracText, pctText } from "./msShared";
import { useMsWorkbook } from "./msWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  MS_METHODS,
  MS_UPSTREAM_LINKS,
  MS_DOWNSTREAM_LINKS,
  SOURCE_TERM_ATTRIBUTES,
  TIMING_LABELS,
  MAGNITUDE_LABELS,
  DIFFERENTIATION_LABELS,
  CALC_BASIS_LABELS,
  RELEASE_FORM_LABELS,
  TRANSPORT_PHENOMENON_LABELS,
  PASS_FRACTIONS,
  DESIGN_UNIQUE_NOTES,
  PHENOMENA_MODELS_USED,
  A3_SPLIT,
  type Stage,
} from "./msViewData";
import { categoryIsRiskSignificant, categoryIsWarn, assignedFamilies, headlineRelease } from "./msSelectors";

interface MsDrawerContext {
  kind: "category" | "inventory" | "barrier" | "sourceterm";
  id: string;
}

// ─── Shared interface bars ─────────────────────────────────────────────────
function UpstreamLinkBar(): JSX.Element {
  return (
    <div className="mssrc">
      {MS_UPSTREAM_LINKS.map((u) => {
        const Icon = MSIcon[u.icon] ?? MSIcon.Link;
        const needsUpdate = u.status === "in_review";
        return (
          <div key={u.id} className={`mssrc__card${needsUpdate ? " mssrc__card--update" : ""}`}>
            <div className="mssrc__top">
              <span className="mssrc__badge"><Icon /></span>
              <div>
                <div className="mssrc__el">{u.element}</div>
                <div className="mssrc__wb">{u.workbook} · v{u.version}</div>
              </div>
            </div>
            <div className="mssrc__delivers">{u.delivers}. {u.note}</div>
            <div className="mssrc__foot">
              <span className="mssrc__sync">Synced {u.synced}</span>
              {needsUpdate
                ? <span className="mssrc__resync">Re-sync</span>
                : <span className="mssrc__status mssrc__status--approved"><MSIcon.Check /> Approved</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InterfaceMap(): JSX.Element {
  function Node({ element, use, icon, up }: { element: string; use: string; icon: string; up?: boolean }): JSX.Element {
    const Icon = MSIcon[icon] ?? MSIcon.Link;
    return (
      <div className={`syflow__node${up === true ? " syflow__node--up" : ""}`}>
        <span className="syflow__node-badge"><Icon /></span>
        <div className="syflow__node-body">
          <span className="syflow__node-el">{element}</span>
          <span className="syflow__node-use">{use}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="syflow">
      <div className="syflow__col">
        <div className="syflow__col-head"><MSIcon.ArrowR /> Inputs</div>
        {MS_UPSTREAM_LINKS.map((u) => <Node key={u.id} element={u.element} use={u.delivers ?? ""} icon={u.icon} up />)}
      </div>
      <div className="syflow__col">
        <div className="syflow__col-head">Outputs <MSIcon.ArrowR /></div>
        {MS_DOWNSTREAM_LINKS.map((d) => <Node key={d.id} element={d.element} use={d.uses ?? ""} icon={d.icon} />)}
        <div className="hrnote" style={{ marginTop: 4 }}>
          <MSIcon.Wind />
          <span>MS feeds the source term to the radiological consequence analysis, which RI pairs with the ESQ frequency.</span>
        </div>
      </div>
    </div>
  );
}

function MethodChips({ ids, label }: { ids: string[]; label?: string }): JSX.Element | null {
  const ms = ids.map((id) => MS_METHODS[id]).filter((m): m is (typeof MS_METHODS)[string] => m !== undefined);
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

// ─── 01 — Scope & Inputs ───────────────────────────────────────────────────
function ScopeScreen({ ccId, setCcId, stage, setStage }: { ccId: string; setCcId: (id: string) => void; onAction: (msg: string) => void; stage: Stage; setStage: (s: Stage) => void }): JSX.Element {
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <MsProvenanceChip>Linked</MsProvenanceChip>
        </div>
        <p className="poscard__sub">Three elements feed the source term, the release-category definitions, the source and barrier inventory, and the risk-significance.</p>
        <UpstreamLinkBar />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
          <span className="possubtle">The first element on the consequence side</span>
        </div>
        <p className="poscard__sub">MS takes the categories, the inventory and the significance, and it delivers the source term to the consequence analysis.</p>
        <InterfaceMap />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Applicable generic source terms with the uncertainty characterized, or plant-specific mechanistic calculations with the phenomena uncertainty propagated.</p>
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
          <MSIcon.Sparkle />
          <span>For a reactor type that has never operated, an applicable generic source term often does not exist, which makes CC-II the practical floor.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">MS has a light pre-operational fork, since the source-term physics is design-driven and the as-built gap enters only through the inputs.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Three pre-operational assumptions are logged, in the barriers, the source term and the documentation, and nothing else forks."],
            ["operational", "Operational", "The three pre-operational assumptions close, and the as-built inventories and barrier details replace the design values."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="ms-stage" value={val} checked={stage === val} onChange={() => setStage(val)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Tag />
          <span>Only three of the twenty-seven requirements are pre-operational only, B7, C7 and E4, the same narrowing fork seen on the consequence side.</span>
        </div>
      </div>
    </>
  );
}

// ─── 02 — Release Categories (HLR-A) ───────────────────────────────────────
function CategoriesScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms } = useMsWorkbook();
  const completeness = ms.releaseCategoryCompletenessAssessment;
  const allFamilies = new Set<string>();
  for (const r of ms.releaseCategories) {
    for (const f of assignedFamilies(r)) allFamilies.add(f);
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Source-term attributes</h3>
          <MsProvenanceChip>MS-A1</MsProvenanceChip>
        </div>
        <p className="poscard__sub">A source term is the complete description of a release, so each category is verified to carry every attribute the consequence analysis needs.</p>
        <div className="msattr">
          {SOURCE_TERM_ATTRIBUTES.map((a) => {
            const Icon = MSIcon[a.icon] ?? MSIcon.Tag;
            return (
              <div key={a.id} className="msattr__cell">
                <span className="msattr__icon"><Icon /></span>
                <div className="msattr__main">
                  <div className="msattr__label">{a.label}</div>
                  <div className="msattr__note">{a.note}</div>
                </div>
                <span className="msattr__check"><MSIcon.Check /></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Release categories</h3>
          <span className="possubtle">{ms.releaseCategories.length} categories · MS-A1, A4, A5</span>
        </div>
        <p className="poscard__sub">The categories are defined under ES-C1, and MS verifies their attributes, the bounding sequence and the termination time.</p>
        <div className="mscat">
          {ms.releaseCategories.map((r) => {
            const rs = categoryIsRiskSignificant(r);
            const timing = r.timingClassification ?? "Late";
            const magnitude = r.magnitudeClassification ?? "Low";
            return (
              <div key={r.uuid} className={`mscat__card${categoryIsWarn(r) ? " mscat__card--warn" : ""}`} onClick={() => openDrawer({ kind: "category", id: r.uuid })}>
                <div className="mscat__head">
                  <div className="mscat__head-main">
                    <div className="mscat__name">{r.name}</div>
                    <div className="mscat__ref posmono">{r.uuid}</div>
                  </div>
                  <div className="mscat__val">
                    <span className="mscat__val-num">{fracText(headlineRelease(ms, r.uuid))}</span>
                    <span className="mscat__val-kind">release fraction</span>
                  </div>
                </div>
                <div className="mscat__tags">
                  <span className={`mscat__tag mscat__tag--t-${TIMING_LABELS[timing] ?? "late"}`}><MSIcon.Clock /> {timing}</span>
                  <span className={`mscat__tag mscat__tag--m-${MAGNITUDE_LABELS[magnitude] ?? "low"}`}><MSIcon.Wind /> {magnitude}</span>
                  {rs
                    ? <span className="mscat__tag mscat__tag--rs">Risk-significant</span>
                    : <span className="mscat__tag mscat__tag--ns">Not significant</span>}
                </div>
                <p className="mscat__desc">{r.description}</p>
                <div className="mscat__meta">
                  <div className="mscat__meta-row">
                    <span className="mscat__meta-k"><MSIcon.Tree /> Bounding sequence</span>
                    <span className="mscat__meta-v posmono">{r.boundingSequenceReference}</span>
                  </div>
                  <div className="mscat__meta-row">
                    <span className="mscat__meta-k"><MSIcon.Clock /> Termination time</span>
                    <span className="mscat__meta-v posmono">{r.releaseTerminationTime.value} {r.releaseTerminationTime.unit}</span>
                  </div>
                  <div className="mscat__meta-row">
                    <span className="mscat__meta-k"><MSIcon.Boxes /> Families assigned</span>
                    <span className="mscat__meta-v posmono">{assignedFamilies(r).join(" · ")}</span>
                  </div>
                </div>
                <div className="mscat__foot">
                  <span className="poschip">{DIFFERENTIATION_LABELS[r.differentiationBasis]}</span>
                  <span className="mscat__more">Open <MSIcon.ArrowR /></span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Clock />
          <span>The termination time is when the count stops, and a release is not over just because the first puff ended, so revaporization is checked.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Category completeness</h3>
          <MsProvenanceChip>MS-A2</MsProvenanceChip>
        </div>
        <p className="poscard__sub">The category set is reasonably complete when every family maps to one category and no family is left unassigned.</p>
        <div className="mscomplete">
          <div className="mscomplete__stat">
            <span className="mscomplete__stat-num">{allFamilies.size}</span>
            <span className="mscomplete__stat-cap">of {allFamilies.size} families assigned</span>
          </div>
          <div className="mscomplete__body">
            <p className="mscomplete__line">{completeness.basis}</p>
            <p className="mscomplete__line mscomplete__line--sub">{completeness.consistencyWithConsequenceAnalysis}</p>
            <div className="mscomplete__map">
              {ms.releaseCategories.map((r) => (
                <div key={r.uuid} className="mscomplete__map-row">
                  <span className="mscomplete__map-cat">{r.uuid}</span>
                  <MSIcon.ArrowL />
                  <span className="mscomplete__map-fams">
                    {assignedFamilies(r).map((f) => <span key={f} className="mscomplete__map-fam posmono">{f}</span>)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The grouping split</h3>
          <MsProvenanceChip>MS-A3</MsProvenanceChip>
        </div>
        <p className="poscard__sub">Coarse bins are used where nothing matters, and fine bins are used where the risk concentrates.</p>
        <div className="mssplit">
          <div className="mssplit__col">
            <span className="mssplit__cc mssplit__cc--i">CC-I</span>
            <div className="mssplit__title">{A3_SPLIT.cci.title}</div>
            <p className="mssplit__desc">{A3_SPLIT.cci.desc}</p>
            <span className="mssplit__tag" style={{ color: "var(--color-text-subtle)" }}><MSIcon.Hash /> {A3_SPLIT.cci.tag}</span>
          </div>
          <div className="mssplit__col mssplit__col--ii">
            <span className="mssplit__cc mssplit__cc--ii">CC-II</span>
            <div className="mssplit__title">{A3_SPLIT.ccii.title}</div>
            <p className="mssplit__desc">{A3_SPLIT.ccii.desc}</p>
            <span className="mssplit__tag"><MSIcon.Function /> {A3_SPLIT.ccii.tag}</span>
          </div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Sparkle />
          <span>{A3_SPLIT.note}</span>
        </div>
      </div>
    </>
  );
}

// ─── 03 — Sources & Barriers (HLR-B, the inventories and the retention) ────
function RetentionChain(): JSX.Element {
  const { ms } = useMsWorkbook();
  let frac = 1.0;
  const steps = ms.transportBarrierAssessments.map((b) => {
    const passes = PASS_FRACTIONS[b.uuid] ?? 1.0;
    frac = frac * passes;
    return { barrier: b, passes, after: frac };
  });
  const net = frac;
  return (
    <div className="mschain">
      <div className="mschain__node mschain__node--source">
        <span className="mschain__node-cap">Source</span>
        <span className="mschain__node-val">100%</span>
        <span className="mschain__node-sub">inventory</span>
      </div>
      {steps.map((s) => {
        const heightPct = Math.max(8, Math.round(Math.sqrt(s.after) * 100));
        return (
          <span key={s.barrier.uuid} style={{ display: "contents" }}>
            <span className="mschain__arrow"><MSIcon.ArrowR /></span>
            <div className="mschain__barrier">
              <div className="mschain__barrier-bar-wrap">
                <div className="mschain__barrier-bar" style={{ height: `${heightPct}%` }} />
              </div>
              <span className="mschain__barrier-name">{s.barrier.name}</span>
              <span className="mschain__barrier-pass">passes {pctText(s.passes)}</span>
              <span className="mschain__barrier-df posmono">DF {Math.round(1 / s.passes)}</span>
            </div>
          </span>
        );
      })}
      <span className="mschain__arrow"><MSIcon.ArrowR /></span>
      <div className="mschain__node mschain__node--release">
        <span className="mschain__node-cap">Release</span>
        <span className="mschain__node-val posmono">{fracText(net)}</span>
        <span className="mschain__node-sub">reaches environment</span>
      </div>
    </div>
  );
}

function SourcesScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms } = useMsWorkbook();
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Source inventories</h3>
          <span className="possubtle">{ms.sourceInventories.length} sources · MS-B1</span>
        </div>
        <p className="poscard__sub">Inventories are estimated generically at CC-I or calculated plant-specifically at CC-II, with the physical and chemical form per species.</p>
        <div className="msinv">
          {ms.sourceInventories.map((s) => (
            <div key={s.uuid} className="msinv__card" onClick={() => openDrawer({ kind: "inventory", id: s.uuid })}>
              <div className="msinv__head">
                <span className="msinv__icon"><MSIcon.Atom /></span>
                <div className="msinv__head-main">
                  <div className="msinv__name">{s.name}</div>
                  <div className="msinv__src posmono">{s.radioactiveSourceRef}</div>
                </div>
                <span className={`msinv__basis msinv__basis--${s.calculationBasis === "PLANT_SPECIFIC_CALCULATION" ? "calc" : "gen"}`}>
                  {CALC_BASIS_LABELS[s.calculationBasis]}
                </span>
              </div>
              <div className="msinv__rns">
                {s.inventory.slice(0, 4).map((r, i) => (
                  <div key={i} className="msinv__rn">
                    <span className="msinv__rn-name posmono">{r.radionuclide}</span>
                    <span className="msinv__rn-q posmono">{valText(r.quantity)} {r.unit}</span>
                    <span className={`msinv__rn-form msinv__rn-form--${(r.physicalForm ?? "OTHER").toLowerCase()}`}>{RELEASE_FORM_LABELS[r.physicalForm ?? "OTHER"] ?? r.physicalForm}</span>
                  </div>
                ))}
                {s.inventory.length > 4 && <div className="msinv__more">plus {s.inventory.length - 4} more species</div>}
              </div>
              <div className="msinv__foot">
                <MethodChips ids={["depletion"]} label="Built by" />
              </div>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Database />
          <span>The depletion calculation is one accepted way to build the inventory, since any qualified method that produces the species set can fill the slot.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The retention chain</h3>
          <MsProvenanceChip>MS-B2 · MS-B4</MsProvenanceChip>
        </div>
        <p className="poscard__sub">The barriers from each source to the environment are identified, and the fraction each one passes is calculated rather than assumed.</p>
        <RetentionChain />
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Shield />
          <span>The whole element exists to replace assumed retention with calculated retention, so each barrier carries what passes and what is held back.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Barrier failure modes and transport</h3>
          <span className="possubtle">{ms.transportBarrierAssessments.length} barriers · MS-B3, B4</span>
        </div>
        <p className="poscard__sub">Each barrier carries its failure modes and the transport characteristics through it, with the conditions that drive the retention.</p>
        <div className="msbar">
          {ms.transportBarrierAssessments.map((b) => (
            <div key={b.uuid} className="msbar__card" onClick={() => openDrawer({ kind: "barrier", id: b.uuid })}>
              <div className="msbar__head">
                <span className="msbar__icon"><MSIcon.Shield /></span>
                <div className="msbar__head-main">
                  <div className="msbar__name">{b.name}</div>
                  <div className="msbar__type posmono">{b.barrierType}</div>
                </div>
                <span className="msbar__pass posmono">passes {pctText(PASS_FRACTIONS[b.uuid] ?? 1.0)}</span>
              </div>
              <div className="msbar__modes">
                {(b.failureModes ?? []).map((m, i) => (
                  <div key={i} className="msbar__mode"><MSIcon.Warn /> {m}</div>
                ))}
              </div>
              {b.transportCharacteristics[0]?.retentionEffectiveness !== undefined && (
                <p className="msbar__retention">{b.transportCharacteristics[0].retentionEffectiveness}</p>
              )}
              <div className="msbar__mechs">
                {(b.transportMechanisms ?? []).map((m, i) => (
                  <span key={i} className={`msbar__mech msbar__mech--${m.significance.toLowerCase()}`}>
                    {TRANSPORT_PHENOMENON_LABELS[m.mechanismType] ?? m.mechanismType}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 04 — Transport Phenomena (HLR-B, the physics heart) ───────────────────
function TransportScreen(): JSX.Element {
  const { ms } = useMsWorkbook();
  const assessment = ms.transportPhenomenaAssessments[0];
  const checklist = assessment?.phenomenaChecklist ?? [];
  const included = checklist.filter((p) => p.included).length;
  const designUnique = assessment?.designUniquePhenomena ?? [];
  const support = assessment?.consequenceQuantificationSupport;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Transport-phenomena checklist</h3>
          <span className="possubtle">{included} of {checklist.length} included · MS-B5</span>
        </div>
        <p className="poscard__sub">The phenomena checklist is the physics heart of the element, and each phenomenon is included or screened with a one-line basis.</p>
        <div className="msphen">
          {checklist.map((p) => (
            <div key={p.phenomenonType} className={`msphen__cell${p.included ? "" : " msphen__cell--out"}${p.phenomenonType === "DESIGN_UNIQUE" ? " msphen__cell--unique" : ""}`}>
              <div className="msphen__cell-head">
                <span className={`msphen__dot msphen__dot--${p.included ? "in" : "out"}`}>{p.included ? <MSIcon.Check /> : <MSIcon.Close />}</span>
                <span className="msphen__label">{TRANSPORT_PHENOMENON_LABELS[p.phenomenonType] ?? p.phenomenonType}</span>
                {p.phenomenonType === "DESIGN_UNIQUE" && <span className="msphen__k">item k</span>}
              </div>
              <p className="msphen__basis">{p.justification}</p>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Activity />
          <span>The source term changes while it travels, so the decay and the daughter buildup during transport are part of the checklist.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Design-unique phenomena</h3>
          <MsProvenanceChip>MS-B5 item k</MsProvenanceChip>
        </div>
        <p className="poscard__sub">Item k is the explicit non-LWR catch-all, where the reactor-specific physics enters by name.</p>
        <div className="msunique">
          {designUnique.map((d) => (
            <div key={d} className="msunique__row">
              <span className="msunique__icon"><MSIcon.Flame /></span>
              <div className="msunique__main">
                <div className="msunique__name">{d}</div>
                {DESIGN_UNIQUE_NOTES[d] !== undefined && <p className="msunique__note">{DESIGN_UNIQUE_NOTES[d]}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Flame />
          <span>For this design the sodium fire and the sodium-concrete interaction enter here, which a bounding LWR source term would never capture.</span>
        </div>
      </div>

      {support !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Phenomena treatment adequacy</h3>
            <MsProvenanceChip>MS-B5 · MS-C4</MsProvenanceChip>
          </div>
          <p className="poscard__sub">The phenomena treatment is justified to suffice for the chosen consequence metric and to discriminate the risk-significant family differences.</p>
          <div className="msadeq">
            <div className="msadeq__main">
              <p className="msadeq__line">{support.description}</p>
              <p className="msadeq__line msadeq__line--sub">{support.adequacyJustification}</p>
            </div>
            <div className="msadeq__models">
              <span className="msadeq__models-cap">Models used</span>
              <MethodChips ids={PHENOMENA_MODELS_USED} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { ScopeScreen, CategoriesScreen, SourcesScreen, TransportScreen, MethodChips, type MsDrawerContext };
