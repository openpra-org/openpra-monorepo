import { JSX, useState } from "react";
import { MSIcon } from "./msIcons";
import { Badge, MsProvenanceChip, valText, fracText, pctText } from "./msShared";
import { useMsWorkbook } from "./msWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  MS_METHODS,
  TIMING_LABELS,
  MAGNITUDE_LABELS,
  DIFFERENTIATION_LABELS,
  CALC_BASIS_LABELS,
  RELEASE_FORM_LABELS,
  TRANSPORT_PHENOMENON_LABELS,
  type Stage,
} from "./msViewData";
import { categoryIsRiskSignificant, categoryIsWarn, assignedFamilies, headlineReleaseDetail, barrierPassFraction, barriersForCategory, retentionChainNet } from "./msSelectors";

interface MsDrawerContext {
  kind: "category" | "inventory" | "barrier" | "sourceterm" | "phenomena" | "uncertainty" | "modeluncertainty" | "sensitivity" | "preop" | "completeness" | "model";
  id: string;
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
function MsInterfaces(): JSX.Element {
  const { ms } = useMsWorkbook();
  const [selected, setSelected] = useState<string | null>(null);
  const lanes: { key: string; code: string; element: string; role: string; direction: "in" | "out"; columns: string[]; rows: { id: string; name: string; values: string[] }[]; empty: string }[] = [
    { key: "in-POS", code: "POS", element: "Plant Operating States", role: "Sources and barriers", direction: "in", columns: ["Source", "Basis", "Species"], rows: ms.sourceInventories.map((s) => ({ id: s.uuid, name: `${s.uuid} · ${s.name}`, values: [CALC_BASIS_LABELS[s.calculationBasis] ?? s.calculationBasis, String(s.inventory.length)] })), empty: "No source inventories yet. Add them in Sources and barriers." },
    { key: "in-ES", code: "ES", element: "Event Sequence Analysis", role: "Release categories", direction: "in", columns: ["Category", "Timing", "Magnitude"], rows: ms.releaseCategories.map((r) => ({ id: r.uuid, name: `${r.uuid} · ${r.name}`, values: [r.timingClassification ?? "—", r.magnitudeClassification ?? "—"] })), empty: "No release categories yet. Add them in Release Categories." },
    { key: "in-ESQ", code: "ESQ", element: "Event Sequence Quantification", role: "Risk significance", direction: "in", columns: ["Category", "Risk-significant"], rows: ms.releaseCategories.map((r) => ({ id: r.uuid, name: `${r.uuid} · ${r.name}`, values: [categoryIsRiskSignificant(r) ? "Yes" : "—"] })), empty: "No release categories yet." },
    { key: "out-RC", code: "RC", element: "Radiological Consequence", role: "Source terms", direction: "out", columns: ["Source term", "Category", "Cs-137"], rows: ms.sourceTermDefinitions.map((s) => ({ id: s.uuid, name: s.uuid, values: [s.releaseCategoryReference, fracText(headlineReleaseDetail(ms, s.releaseCategoryReference)?.value)] })), empty: "No source terms yet. Add them in Source Terms." },
    { key: "out-RI", code: "RI", element: "Risk Integration", role: "Source-term uncertainty", direction: "out", columns: ["Analysis", "Category", "Level"], rows: ms.uncertaintyAnalyses.map((u) => ({ id: u.uuid, name: u.uuid, values: [u.releaseCategoryReference, u.characterizationLevel === "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES" ? "Propagated" : "Characterized"] })), empty: "No uncertainty analyses yet. Add them in Uncertainty." },
  ];
  const active = lanes.find((l) => l.key === selected);
  return (
    <>
      <div className="poshandoff__grid">
        {lanes.map((lane) => (
          <button key={lane.key} type="button"
            className={`poshandoff__tile${selected === lane.key ? " poshandoff__tile--active" : ""}`}
            onClick={() => setSelected(selected === lane.key ? null : lane.key)}>
            <span className="poshandoff__tile-code">{lane.code}</span>
            <span className="poshandoff__tile-name">{lane.element}</span>
            <span className="poshandoff__tile-role">{lane.direction === "out" ? "Consumes · " : "Provides · "}{lane.role}</span>
          </button>
        ))}
      </div>
      {active !== undefined && (
        <div style={{ marginTop: 16 }}>
          <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
            {active.direction === "out"
              ? `${active.element} receives ${active.role.toLowerCase()} from Mechanistic Source Term`
              : `Mechanistic Source Term receives ${active.role.toLowerCase()} from ${active.element}`}
          </div>
          {active.rows.length > 0 ? (
            <table className="postable postable--mid">
              <thead><tr>{active.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {active.rows.map((r) => (
                  <tr key={r.id}>
                    <td><div className="postable__name">{r.name}</div></td>
                    {r.values.map((v, idx) => <td key={active.columns[idx + 1] ?? `c${String(idx)}`} className="posmono">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="posmuted" style={{ margin: 0 }}>{active.empty}</p>
          )}
        </div>
      )}
    </>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage }: { ccId: string; setCcId: (id: string) => void; onAction: (msg: string) => void; stage: Stage; setStage: (s: Stage) => void }): JSX.Element {
  const { ms, editable, mutateMs } = useMsWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateMs((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateMs((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateMs((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
        <p className="poscard__sub">Select an element to see the data exchanged.</p>
        <MsInterfaces />
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what this mechanistic source-term analysis covers and what it excludes.</p>
        <textarea
          className="posfield__textarea"
          placeholder="State the in-scope release categories, sources of radioactive material, and explicit exclusions."
          rows={4}
          value={ms.praScope}
          disabled={!editable}
          onChange={(e) => onScopeChange(e.target.value)}
        />
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
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)} disabled={!editable}
                style={{ textAlign: "left", cursor: editable ? "pointer" : "default", opacity: !editable && !active ? 0.6 : 1, borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">MS has a light pre-operational fork, since the source-term physics is design-driven and the as-built gap enters only through the inputs.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Pre-operational assumptions are logged where the source term rests on design values, and nothing else forks."],
            ["operational", "Operational", "The pre-operational assumptions close, and the as-built inventories and barrier details replace the design values."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: editable ? "pointer" : "default", opacity: !editable && stage !== val ? 0.6 : 1, borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="ms-stage" value={val} checked={stage === val} disabled={!editable} onChange={() => onStageChange(val)} />
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

// ─── 02 — Release Categories (HLR-A) ───────────────────────────────────────
function CategoriesScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms, editable, mutateMs } = useMsWorkbook();
  function addCategory(): void {
    const n = ms.releaseCategories.reduce((m, r) => { const v = Number(r.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `RC-${String(n)}`;
    mutateMs((d) => ({ ...d, releaseCategories: [...d.releaseCategories, { uuid, name: "New release category", description: "", technicalBasis: "", supportingReferences: [], groupingJustification: "", differentiationBasis: "CONSEQUENCE_METRIC", timingClassification: "Late", magnitudeClassification: "Low", boundingSequenceReference: "", boundingSequenceJustification: "", releaseTerminationTime: { value: 24, unit: "h", justification: "" }, implementsSrs: [{ sr: "MS-A1", hlr: "A" }, { sr: "MS-A4", hlr: "A" }, { sr: "MS-A5", hlr: "A" }] }] }));
    openDrawer({ kind: "category", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Release categories</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-A1 · A4 · A5</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCategory}><MSIcon.Plus /> Add category</button>}
          </div>
        </div>
        <p className="poscard__sub">Each category carries the source-term attributes the consequence analysis needs, with a bounding sequence and a justified termination time. Select a card to edit it.</p>
        {ms.releaseCategories.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No release categories yet. Add one to define a bin, its bounding sequence and its termination time.</p>
        ) : (
        <div className="mscat">
          {ms.releaseCategories.map((r) => {
            const rs = categoryIsRiskSignificant(r);
            const timing = r.timingClassification ?? "Late";
            const magnitude = r.magnitudeClassification ?? "Low";
            const detail = headlineReleaseDetail(ms, r.uuid);
            return (
              <div key={r.uuid} className={`mscat__card${categoryIsWarn(r) ? " mscat__card--warn" : ""}`} onClick={() => openDrawer({ kind: "category", id: r.uuid })}>
                <div className="mscat__head">
                  <div className="mscat__head-main">
                    <div className="mscat__name">{r.name}</div>
                    <div className="mscat__ref posmono">{r.uuid}</div>
                  </div>
                  <div className="mscat__val">
                    <span className="mscat__val-num">{detail !== undefined ? fracText(detail.value) : "n/a"}</span>
                    <span className="mscat__val-kind">{detail !== undefined ? `${detail.species} fraction` : "no source term"}</span>
                  </div>
                </div>
                <div className="mscat__tags">
                  <span className={`mscat__tag mscat__tag--t-${TIMING_LABELS[timing] ?? "late"}`}>{timing}</span>
                  <span className={`mscat__tag mscat__tag--m-${MAGNITUDE_LABELS[magnitude] ?? "low"}`}>{magnitude}</span>
                  {rs
                    ? <span className="mscat__tag mscat__tag--rs">Risk-significant</span>
                    : <span className="mscat__tag mscat__tag--ns">Not significant</span>}
                </div>
                <p className="mscat__desc">{r.description}</p>
                <div className="mscat__meta">
                  <div className="mscat__meta-row">
                    <span className="mscat__meta-k">Bounding sequence</span>
                    <span className="mscat__meta-v posmono">{r.boundingSequenceReference}</span>
                  </div>
                  <div className="mscat__meta-row">
                    <span className="mscat__meta-k">Termination time</span>
                    <span className="mscat__meta-v posmono">{r.releaseTerminationTime.value} {r.releaseTerminationTime.unit}</span>
                  </div>
                  <div className="mscat__meta-row">
                    <span className="mscat__meta-k">Families assigned</span>
                    <span className="mscat__meta-v posmono">{assignedFamilies(r).join(" · ")}</span>
                  </div>
                </div>
                <div className="mscat__foot">
                  <span className="poschip">{DIFFERENTIATION_LABELS[r.differentiationBasis]}</span>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Category completeness</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-A2</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "completeness", id: "completeness" })}>Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">Every event sequence family maps to one release category, shown below. Open the editor to record the completeness basis.</p>
        {ms.releaseCategories.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No release categories yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Release category</th><th>Families assigned</th></tr></thead>
            <tbody>
              {ms.releaseCategories.map((r) => (
                <tr key={r.uuid}>
                  <td><div className="postable__name">{r.name}</div><div className="possubtle posmono" style={{ fontSize: 11 }}>{r.uuid}</div></td>
                  <td>{assignedFamilies(r).length === 0
                    ? <span className="possubtle" style={{ fontSize: 12 }}>no families assigned</span>
                    : <div className="posrow posrow--wrap" style={{ gap: 5 }}>{assignedFamilies(r).map((f) => <span key={f} className="poschip posmono">{f}</span>)}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── 03 — Sources & Barriers (HLR-B, the inventories and the retention) ────
function RetentionChain({ categoryRef }: { categoryRef: string }): JSX.Element {
  const { ms } = useMsWorkbook();
  let frac = 1.0;
  const steps = barriersForCategory(ms, categoryRef).map((b) => {
    const passes = barrierPassFraction(b);
    frac = frac * passes;
    return { barrier: b, passes, after: frac, df: b.decontaminationFactor ?? 1 };
  });
  const net = retentionChainNet(ms, categoryRef);
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
            <span className="mschain__arrow">→</span>
            <div className="mschain__barrier">
              <div className="mschain__barrier-bar-wrap">
                <div className="mschain__barrier-bar" style={{ height: `${heightPct}%` }} />
              </div>
              <span className="mschain__barrier-name">{s.barrier.name}</span>
              <span className="mschain__barrier-pass">passes {pctText(s.passes)}</span>
              <span className="mschain__barrier-df posmono">DF {s.df}</span>
            </div>
          </span>
        );
      })}
      <span className="mschain__arrow">→</span>
      <div className="mschain__node mschain__node--release">
        <span className="mschain__node-cap">Release</span>
        <span className="mschain__node-val posmono">{fracText(net)}</span>
        <span className="mschain__node-sub">reaches environment</span>
      </div>
    </div>
  );
}

function SourcesScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms, editable, mutateMs } = useMsWorkbook();
  function addInventory(): void {
    const n = ms.sourceInventories.reduce((m, s) => { const v = Number(s.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `SRC-${String(n)}`;
    mutateMs((d) => ({ ...d, sourceInventories: [...d.sourceInventories, { uuid, name: "New source inventory", radioactiveSourceRef: "", description: "", calculationBasis: "PLANT_SPECIFIC_CALCULATION", inventory: [], inventoryDataSource: "", radionuclideSelectionBasis: "", implementsSrs: [{ sr: "MS-B1", hlr: "B" }] }] }));
    openDrawer({ kind: "inventory", id: uuid });
  }
  function addBarrier(): void {
    const n = ms.transportBarrierAssessments.reduce((m, b) => { const v = Number(b.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `BAR-${String(n)}`;
    mutateMs((d) => ({ ...d, transportBarrierAssessments: [...d.transportBarrierAssessments, { uuid, name: "New barrier", releaseCategoryReference: d.releaseCategories[0]?.uuid ?? "", sourceInventoryRefs: [], description: "", barrierType: "New barrier type", decontaminationFactor: 1, failureModes: [], transportCharacteristics: [{ description: "", affectedRadionuclides: [], retentionEffectiveness: "" }], transportMechanisms: [], implementsSrs: [{ sr: "MS-B2", hlr: "B" }, { sr: "MS-B3", hlr: "B" }, { sr: "MS-B4", hlr: "B" }] }] }));
    openDrawer({ kind: "barrier", id: uuid });
  }
  function categoryName(ref: string): string {
    return ms.releaseCategories.find((r) => r.uuid === ref)?.name ?? ref;
  }
  const barrieredCategories: string[] = [];
  for (const b of ms.transportBarrierAssessments) {
    if (!barrieredCategories.includes(b.releaseCategoryReference)) barrieredCategories.push(b.releaseCategoryReference);
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Source inventories</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-B1</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addInventory}><MSIcon.Plus /> Add inventory</button>}
          </div>
        </div>
        <p className="poscard__sub">Inventories are estimated generically at CC-I or calculated plant-specifically at CC-II, with the physical and chemical form per species. Select a card to edit it.</p>
        {ms.sourceInventories.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No source inventories yet. Add one to carry the radionuclide groups a release can draw from.</p>
        ) : (
        <div className="msinv">
          {ms.sourceInventories.map((s) => (
            <div key={s.uuid} className="msinv__card" onClick={() => openDrawer({ kind: "inventory", id: s.uuid })}>
              <div className="msinv__head">
                <div className="msinv__head-main">
                  <div className="msinv__name">{s.name}</div>
                  <div className="msinv__src posmono">{s.radioactiveSourceRef}</div>
                </div>
                <span className={`msinv__basis msinv__basis--${s.calculationBasis === "PLANT_SPECIFIC_CALCULATION" ? "calc" : "gen"}`}>
                  {CALC_BASIS_LABELS[s.calculationBasis]}
                </span>
              </div>
              {s.inventory.length === 0 ? (
                <p className="possubtle" style={{ fontSize: 11.5, margin: 0 }}>No species yet</p>
              ) : (
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
              )}
              {(s.inventoryDataSource ?? "").length > 0 && (
                <div className="msinv__foot">
                  <span className="possubtle" style={{ fontSize: 11 }}>{s.inventoryDataSource}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The retention chain</h3>
          <MsProvenanceChip>MS-B2 · MS-B4</MsProvenanceChip>
        </div>
        <p className="poscard__sub">The barriers from each source to the environment are identified per release category, and the fraction each one passes is set by its decontamination factor rather than assumed.</p>
        {barrieredCategories.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No barriers yet. Add barriers to build the retention chain for a release category.</p>
        ) : (
          barrieredCategories.map((catRef) => (
            <div key={catRef} style={{ marginBottom: 14 }}>
              <div className="possubtle" style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>{categoryName(catRef)}</div>
              <RetentionChain categoryRef={catRef} />
            </div>
          ))
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Barrier failure modes and transport</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-B3 · B4</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addBarrier}><MSIcon.Plus /> Add barrier</button>}
          </div>
        </div>
        <p className="poscard__sub">Each barrier carries its decontamination factor, its failure modes and the transport characteristics through it. Select a card to edit it.</p>
        {ms.transportBarrierAssessments.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No barriers yet. Add the barriers from each source to the environment for a release category.</p>
        ) : (
        <div className="msbar">
          {ms.transportBarrierAssessments.map((b) => (
            <div key={b.uuid} className="msbar__card" onClick={() => openDrawer({ kind: "barrier", id: b.uuid })}>
              <div className="msbar__head">
                <div className="msbar__head-main">
                  <div className="msbar__name">{b.name}</div>
                  <div className="msbar__type posmono">{b.barrierType} · {categoryName(b.releaseCategoryReference)}</div>
                </div>
                <span className="msbar__pass posmono">DF {b.decontaminationFactor ?? 1} · passes {pctText(barrierPassFraction(b))}</span>
              </div>
              <div className="msbar__modes">
                {(b.failureModes ?? []).map((m, i) => (
                  <div key={i} className="msbar__mode">{m}</div>
                ))}
              </div>
              {(b.transportCharacteristics[0]?.retentionEffectiveness ?? "").length > 0 && (
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
        )}
      </div>
    </>
  );
}

// ─── 04 — Transport Phenomena (HLR-B, the physics heart) ───────────────────
function TransportScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms, editable, mutateMs } = useMsWorkbook();
  function categoryName(ref: string): string {
    if (ref.length === 0) return "Unassigned category";
    return ms.releaseCategories.find((r) => r.uuid === ref)?.name ?? ref;
  }
  function addAssessment(): void {
    const n = ms.transportPhenomenaAssessments.reduce((m, a) => { const v = Number(a.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `TPA-${String(n)}`;
    mutateMs((d) => ({ ...d, transportPhenomenaAssessments: [...d.transportPhenomenaAssessments, { uuid, releaseCategoryReference: d.releaseCategories[0]?.uuid ?? "", phenomenaChecklist: [], designUniquePhenomena: [], modelsUsed: [], relatedBarrierAssessmentRefs: [], consequenceQuantificationSupport: { description: "", adequacyJustification: "", sufficientForRiskSignificantDifferentiation: true }, implementsSrs: [{ sr: "MS-B5", hlr: "B" }] }] }));
    openDrawer({ kind: "phenomena", id: uuid });
  }
  return (
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Transport phenomena</h3>
        <div className="posrow" style={{ gap: 10 }}>
          <MsProvenanceChip>MS-B5 · C4</MsProvenanceChip>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAssessment}><MSIcon.Plus /> Add assessment</button>}
        </div>
      </div>
      <p className="poscard__sub">The phenomena checklist is addressed per release category, with the design-unique physics named under item k. Select an assessment to edit it.</p>
      {ms.transportPhenomenaAssessments.length === 0 ? (
        <p className="posmuted" style={{ margin: 0 }}>No transport-phenomena assessments yet. Add one to address the phenomena checklist for a release category.</p>
      ) : (
        ms.transportPhenomenaAssessments.map((assessment, ai) => {
          const checklist = assessment.phenomenaChecklist;
          const included = checklist.filter((p) => p.included).length;
          const designUnique = assessment.designUniquePhenomena ?? [];
          return (
            <div key={assessment.uuid} style={{ borderTop: ai === 0 ? undefined : "1px solid var(--color-border)", paddingTop: ai === 0 ? 4 : 16, marginTop: ai === 0 ? 8 : 16 }}>
              <div className="posrow" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                  <span style={{ fontFamily: "'Literata', Georgia, serif", fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>{categoryName(assessment.releaseCategoryReference)}</span>
                  <span className="possubtle" style={{ fontSize: 12 }}>{checklist.length === 0 ? "Checklist not started" : `${String(included)} of ${String(checklist.length)} phenomena included`}</span>
                </div>
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "phenomena", id: assessment.uuid })}>Edit</button>}
              </div>
              {checklist.length === 0 ? (
                <p className="posmuted" style={{ margin: 0 }}>No phenomena screened yet. Open the editor to add them.</p>
              ) : (
                <div className="msphen">
                  {checklist.map((p) => (
                    <div key={p.phenomenonType} className={`msphen__cell${p.included ? "" : " msphen__cell--out"}${p.phenomenonType === "DESIGN_UNIQUE" ? " msphen__cell--unique" : ""}`}>
                      <div className="msphen__cell-head">
                        <span className={`msphen__dot msphen__dot--${p.included ? "in" : "out"}`} />
                        <span className="msphen__label">{TRANSPORT_PHENOMENON_LABELS[p.phenomenonType] ?? p.phenomenonType}</span>
                        {p.phenomenonType === "DESIGN_UNIQUE" && <span className="msphen__k">item k</span>}
                      </div>
                      <p className="msphen__basis">{p.justification}</p>
                    </div>
                  ))}
                </div>
              )}
              {designUnique.length > 0 && (
                <div className="msunique" style={{ marginTop: 12 }}>
                  {designUnique.map((d) => (
                    <div key={d.name} className="msunique__row">
                      <div className="msunique__main">
                        <div className="msunique__name">{d.name}</div>
                        {d.note !== undefined && d.note.length > 0 && <p className="msunique__note">{d.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export { ScopeScreen, CategoriesScreen, SourcesScreen, TransportScreen, MethodChips, type MsDrawerContext };
