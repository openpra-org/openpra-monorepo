import { JSX, useState } from "react";
import { ESQIcon } from "./esqIcons";
import { Badge, EsqProvenanceChip, valText, pctText } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  ESQ_METHODS,
  QUANT_BASIS_LABELS,
  CONTRIBUTOR_TYPE_LABELS,
  MUTEX_TREATMENT_LABELS,
  CIRCULAR_METHOD_LABELS,
  MODULE_TYPE_LABELS,
  APPROACH_LABELS,
  SOLUTION_METHOD_LABELS,
  type Stage,
} from "./esqViewData";
import { type CircularLogicResolution } from "interfaces-mef-types/esq/event-sequence-quantification";
import { familyMeanFrequency, familyIsRiskSignificant, familyIsWarn } from "./esqSelectors";

interface EsqDrawerContext {
  kind: "family" | "barrier" | "code" | "truncation" | "solution" | "flag" | "mutex" | "circular" | "module" | "success" | "dependency" | "multihfe" | "transfer" | "phenomena" | "phenomodel" | "survivability" | "contributor" | "importance" | "cutsetreview" | "screening" | "consistency" | "funnel" | "sokc";
  id: string;
}

function MethodChips({ ids, label }: { ids: string[]; label?: string }): JSX.Element | null {
  const ms = ids.map((id) => ESQ_METHODS[id]).filter((m): m is (typeof ESQ_METHODS)[string] => m !== undefined);
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

function FamilyContribBar({ frac }: { frac: number }): JSX.Element {
  return (
    <div className="esqfam__contrib-meter">
      <div className="esqfam__contrib-bar"><span className="esqfam__contrib-bar-fill" style={{ width: pctText(frac) }} /></div>
      <span className="esqfam__contrib-pct">{pctText(frac)}</span>
    </div>
  );
}

// ─── 01 — Scope & Inputs ───────────────────────────────────────────────────
function ScopeScreen({ ccId, setCcId, stage, setStage }: { ccId: string; setCcId: (id: string) => void; onAction: (msg: string) => void; stage: Stage; setStage: (s: Stage) => void }): JSX.Element {
  const { esq, links, editable, mutateEsq } = useEsqWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const ifaceLanes: { key: string; code: string; element: string; role: string; direction: "in" | "out"; columns: string[]; rows: { id: string; name: string; values: string[] }[]; empty: string }[] = [
    { key: "in-POS", code: "POS", element: "Plant Operating States", role: "Operating states and time weights", direction: "in", columns: ["State", "Mode", "Hours"], rows: (links?.posStates ?? []).map((x) => ({ id: x.id, name: `${x.id} · ${x.name}`, values: [x.mode, String(x.durationHours)] })), empty: "Load the example to pull the operating states the family frequencies are weighted across." },
    { key: "in-IE", code: "IE", element: "Initiating Events", role: "Group frequencies", direction: "in", columns: ["Group", "Name", "Frequency (/yr)"], rows: (links?.ieGroups ?? []).map((g) => ({ id: g.id, name: g.id, values: [g.name, valText(g.frequency)] })), empty: "Load the example to pull the initiating-event group frequencies the quantification starts from." },
    { key: "in-ES", code: "ES", element: "Event Sequence Analysis", role: "Sequence families and end states", direction: "in", columns: ["Family", "Name"], rows: (links?.esFamilies ?? []).map((f) => ({ id: f.id, name: f.id, values: [f.name] })), empty: "Load the example to pull the sequence families the quantification carries." },
    { key: "in-SC", code: "SC", element: "Success Criteria", role: "Mission times and success criteria", direction: "in", columns: ["Criterion", "Sequence", "Mission (h)"], rows: (links?.scMissionTimes ?? []).map((m) => ({ id: m.id, name: m.id, values: [m.sequence, String(m.hours)] })), empty: "Load the example to pull the mission times the sequence logic is solved against." },
    { key: "in-SY", code: "SY", element: "Systems Analysis", role: "System logic models", direction: "in", columns: ["System", "Name"], rows: (links?.sySystems ?? []).map((y) => ({ id: y.id, name: y.id, values: [y.name] })), empty: "Load the example to pull the system models the linking substitutes." },
    { key: "in-HR", code: "HR", element: "Human Reliability", role: "Quantified human actions", direction: "in", columns: ["HFE", "Mean"], rows: (links?.hrActions ?? []).map((h) => ({ id: h.id, name: h.hfe, values: [valText(h.mean)] })), empty: "Load the example to pull the quantified human actions the cutsets carry." },
    { key: "in-DA", code: "DA", element: "Data Analysis", role: "Parameter estimates and distributions", direction: "in", columns: ["Parameter", "Mean"], rows: (links?.daParams ?? []).map((d) => ({ id: d.id, name: d.name, values: [valText(d.value)] })), empty: "Load the example to pull the parameter estimates the model binds." },
    { key: "out-MS", code: "MS", element: "Mechanistic Source Term", role: "Release inputs", direction: "out", columns: ["Family", "End state", "Frequency (/yr)"], rows: esq.familyQuantifications.map((f) => ({ id: f.uuid, name: f.name, values: [f.eventSequenceFamilyRef, valText(familyMeanFrequency(f))] })), empty: "No family frequencies yet." },
    { key: "out-RI", code: "RI", element: "Risk Integration", role: "Family frequencies and significance", direction: "out", columns: ["Family", "Frequency (/yr)", "Risk-significant"], rows: esq.familyQuantifications.map((f) => ({ id: f.uuid, name: f.name, values: [valText(familyMeanFrequency(f)), familyIsRiskSignificant(f) ? "Yes" : "—"] })), empty: "No family frequencies yet." },
  ];
  const selectedLane = ifaceLanes.find((l) => l.key === selectedTe);

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateEsq((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateEsq((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateEsq((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
        <p className="poscard__sub">Select an element to see the data exchanged.</p>
        <div className="poshandoff__grid">
          {ifaceLanes.map((lane) => (
            <button key={lane.key} type="button"
              className={`poshandoff__tile${selectedTe === lane.key ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.key ? null : lane.key)}>
              <span className="poshandoff__tile-code">{lane.code}</span>
              <span className="poshandoff__tile-name">{lane.element}</span>
              <span className="poshandoff__tile-role">{lane.direction === "out" ? "Consumes · " : "Provides · "}{lane.role}</span>
            </button>
          ))}
        </div>
        {selectedLane !== undefined && (
          <div style={{ marginTop: 16 }}>
            <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
              {selectedLane.direction === "out"
                ? `${selectedLane.element} receives ${selectedLane.role.toLowerCase()} from Event Sequence Quantification`
                : `Event Sequence Quantification receives ${selectedLane.role.toLowerCase()} from ${selectedLane.element}`}
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
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what this event-sequence quantification covers and what it excludes.</p>
        <textarea
          className="posfield__textarea"
          placeholder="State the in-scope sources, initiating-event groups, hazard groups, operating states, and explicit exclusions."
          rows={4}
          value={esq.praScope}
          disabled={!editable}
          onChange={(e) => onScopeChange(e.target.value)}
        />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">A point estimate from point-estimate inputs, or the mean with the correlation between shared estimates accounted for.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
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
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">ESQ has the lightest pre-operational fork in the standard, since computation works the same on a paper plant and a real one.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Two pre-operational assumptions are logged, in the dependency treatment and the documentation, and nothing else forks."],
            ["operational", "Operational", "The two pre-operational assumptions close, and the inherited inputs carry the rest of the character."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="esq-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
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

// ─── 02 — Integrate & Quantify (HLR-A) ─────────────────────────────────────
function IntegrateScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  function addFamily(): void {
    const next = esq.familyQuantifications.reduce((m, x) => { const nm = Number(x.uuid.split("-")[1]); return Number.isNaN(nm) ? m : Math.max(m, nm); }, 0) + 1;
    const uuid = `EFQ-${String(next)}`;
    mutateEsq((draft) => ({ ...draft, familyQuantifications: [...draft.familyQuantifications, { uuid, name: "New family", eventSequenceFamilyRef: "", dependenciesConsideredInGrouping: true, quantificationBasis: "POINT_ESTIMATE", meanFrequency: 0, implementsSrs: [{ sr: "ESQ-A1", hlr: "A" }, { sr: "ESQ-A4", hlr: "A" }] }] }));
    openDrawer({ kind: "family", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Event sequence families</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <span className="possubtle">ESQ-A1, A4</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addFamily}><ESQIcon.Plus /> Add family</button>}
          </div>
        </div>
        <p className="poscard__sub">Sequences are grouped into families with like end states and like dependencies, and each family carries a frequency.</p>
        <div className="esqfam">
          {esq.familyQuantifications.map((f) => {
            const qb = QUANT_BASIS_LABELS[f.quantificationBasis];
            return (
              <div key={f.uuid} className={`esqfam__card${familyIsWarn(f) ? " esqfam__card--warn" : ""}`} onClick={() => openDrawer({ kind: "family", id: f.uuid })}>
                <div className="esqfam__head">
                  <div className="esqfam__head-main">
                    <div className="esqfam__name">{f.name}</div>
                    <div className="esqfam__ref posmono">{f.eventSequenceFamilyRef}</div>
                  </div>
                  <div className="esqfam__val">
                    <span className="esqfam__val-num">{valText(familyMeanFrequency(f))}</span>
                    <span className="esqfam__val-kind">per year</span>
                  </div>
                </div>
                <span className={`esqfam__basis esqfam__basis--${qb?.kind ?? "point"}`}>
                  {qb?.label ?? f.quantificationBasis}
                </span>
                {f.percentile95 !== undefined && (
                  <div className="esqfam__pct">
                    {([["P05", f.percentile05], ["P50", f.percentile50], ["P95", f.percentile95]] as [string, number | undefined][]).map(([k, v]) => (
                      <div key={k} className="esqfam__pct-cell">
                        <span className="esqfam__pct-k">{k}</span>
                        <span className="esqfam__pct-v">{valText(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="esqfam__contrib">
                  {(f.contributionBreakdown ?? []).map((c, i) => (
                    <div key={i} className="esqfam__contrib-row">
                      <span className="esqfam__contrib-name">{c.contributorRef}</span>
                      <span className="esqfam__contrib-type">{CONTRIBUTOR_TYPE_LABELS[c.contributorType] ?? c.contributorType}</span>
                      <FamilyContribBar frac={c.fractionalContribution} />
                    </div>
                  ))}
                </div>
                {familyIsRiskSignificant(f) && (
                  <div className="esqfam__foot">
                    <span className="esqfam__rs">Risk-significant</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </>
  );
}

// ─── 03 — Solve & Converge (HLR-B, computational core) ─────────────────────
function SolveScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const qm = esq.quantificationMethods;
  const trunc = qm.truncation;
  const demoFamily = esq.familyQuantifications.find((x) => x.uuid === trunc.demonstratedFamilyRef);
  const freqHeader = demoFamily !== undefined ? `${demoFamily.name} frequency (/yr)` : "Family frequency (/yr)";
  function addCode(): void {
    const nextIndex = qm.computerCodes.length;
    mutateEsq((draft) => ({ ...draft, quantificationMethods: { ...draft.quantificationMethods, computerCodes: [...draft.quantificationMethods.computerCodes, { name: "New code", version: "1.0", verificationDocumentation: "", validationDocumentation: "", methodSpecificLimitations: [], implementsSrs: [{ sr: "ESQ-B1", hlr: "B" }] }] } }));
    openDrawer({ kind: "code", id: String(nextIndex) });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Quantification codes</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B1</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCode}><ESQIcon.Plus /> Add code</button>}
          </div>
        </div>
        <p className="poscard__sub">The codes are demonstrated against accepted algorithms, with the method-specific limitations identified and the roles named rather than any product.</p>
        {qm.computerCodes.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No codes recorded yet. Add the quantification codes this analysis relies on.</p>
        ) : (
          <div className="esqcode">
            {qm.computerCodes.map((c, i) => (
              <div key={`${c.name}-${String(i)}`} className="esqcode__card" onClick={() => openDrawer({ kind: "code", id: String(i) })} style={{ cursor: "pointer" }}>
                <div className="esqcode__head">
                  <div className="esqcode__head-main">
                    <div className="esqcode__name">{c.name}</div>
                  </div>
                </div>
                {c.verificationDocumentation !== "" && <div className="esqcode__meta"><span className="esqcode__meta-k">Verified</span><span className="esqcode__meta-v">{c.verificationDocumentation}</span></div>}
                {c.validationDocumentation !== "" && <div className="esqcode__meta"><span className="esqcode__meta-k">Validated</span><span className="esqcode__meta-v">{c.validationDocumentation}</span></div>}
                {c.benchmarkComparison !== undefined && <div className="esqcode__meta"><span className="esqcode__meta-k">Benchmark</span><span className="esqcode__meta-v">{c.benchmarkComparison}</span></div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Truncation convergence</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B2 · ESQ-B3</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "truncation", id: "truncation" })}>Edit study</button>}
          </div>
        </div>
        <p className="poscard__sub">{trunc.basisForSelection !== "" ? trunc.basisForSelection : "The truncation limit is set by lowering the cutoff until the family frequency stops moving."}</p>
        {trunc.truncationProgression.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No convergence study yet. Edit the study to record the truncation progression.</p>
        ) : (
          <>
            <table className="postable postable--mid">
              <thead><tr><th>Cutoff (/yr)</th><th>{freqHeader}</th><th>Change</th></tr></thead>
              <tbody>
                {trunc.truncationProgression.map((cutoff, i) => {
                  const freq = trunc.frequencyAtTruncation[cutoff];
                  const delta = trunc.percentageChangeAtTruncation[cutoff];
                  return (
                    <tr key={i}>
                      <td className="posmono">{valText(cutoff)}</td>
                      <td className="posmono">{valText(freq)}</td>
                      <td className="posmono">{delta !== undefined ? `${String(delta)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Solution and approximation</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B4</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "solution", id: "solution" })}>Edit method</button>}
          </div>
        </div>
        <p className="poscard__sub">The solution method behind the family frequencies, declared with the result.</p>
        <div className="esqsol">
          <div className="esqsol__cell">
            <span className="esqsol__k">Approach</span>
            <span className="esqsol__v">{APPROACH_LABELS[qm.approach] ?? qm.approach}</span>
          </div>
          <div className="esqsol__cell">
            <span className="esqsol__k">Cutset solution</span>
            <span className="esqsol__v">{SOLUTION_METHOD_LABELS[qm.cutsetSolutionMethod ?? ""] ?? "Not selected yet"}</span>
          </div>
        </div>
        {qm.cutsetSolutionMethod === "RARE_EVENT" && qm.rareEventJustification !== undefined && (
          <p className="posmuted" style={{ marginTop: 12, marginBottom: 0 }}>{qm.rareEventJustification}</p>
        )}
      </div>
    </>
  );
}

// ─── 04 — Logic Integrity (HLR-B) ──────────────────────────────────────────
function LogicScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const flags = esq.flagEventSettings ?? [];
  const mutex = esq.mutuallyExclusiveEventRules ?? [];
  const circular = esq.circularLogicResolutions ?? [];
  const modules = esq.moduleUsageRecords ?? [];
  const success = esq.systemSuccessTreatment;
  const familyName = (ref: string): string => esq.familyQuantifications.find((x) => x.uuid === ref)?.name ?? ref;
  function nextId(prefix: string, list: { uuid: string }[]): string {
    const n = list.reduce((m, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    return `${prefix}-${String(n)}`;
  }
  function addFlag(): void {
    const uuid = nextId("FL", flags);
    mutateEsq((draft) => ({ ...draft, flagEventSettings: [...(draft.flagEventSettings ?? []), { uuid, name: "New flag", purpose: "", state: false, effect: "", basis: "", isTemporary: false, applicableFamilyRefs: [], setPriorToCutsetGeneration: true, implementsSrs: [{ sr: "ESQ-B9", hlr: "B" }] }] }));
    openDrawer({ kind: "flag", id: uuid });
  }
  function addMutex(): void {
    const uuid = nextId("MX", mutex);
    mutateEsq((draft) => ({ ...draft, mutuallyExclusiveEventRules: [...(draft.mutuallyExclusiveEventRules ?? []), { uuid, description: "New rule", eventIds: [], basis: "", identifiedInResults: true, treatment: "LOGIC_ELIMINATION", implementsSrs: [{ sr: "ESQ-B7", hlr: "B" }, { sr: "ESQ-B8", hlr: "B" }] }] }));
    openDrawer({ kind: "mutex", id: uuid });
  }
  function addCircular(): void {
    const uuid = nextId("CL", circular);
    mutateEsq((draft) => ({ ...draft, circularLogicResolutions: [...(draft.circularLogicResolutions ?? []), { uuid, description: "New resolution", involvedElementIds: [], detectionMethod: "", resolutionMethod: "LOGIC_TRANSFORMATION" as CircularLogicResolution["resolutionMethod"], resolutionDescription: "", neutralityJustification: "", implementsSrs: [{ sr: "ESQ-B5", hlr: "B" }] }] }));
    openDrawer({ kind: "circular", id: uuid });
  }
  function addModule(): void {
    const uuid = nextId("MOD", modules);
    mutateEsq((draft) => ({ ...draft, moduleUsageRecords: [...(draft.moduleUsageRecords ?? []), { uuid, moduleType: "MODULE", processDescription: "", sharedEventsIdentified: false, trueIndependenceVerified: false, perEventInterpretabilityMaintained: false, implementsSrs: [{ sr: "ESQ-B10", hlr: "B" }] }] }));
    openDrawer({ kind: "module", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">House-event flags</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B9</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addFlag}><ESQIcon.Plus /> Add flag</button>}
          </div>
        </div>
        <p className="poscard__sub">Logic flags are set true or false, not to a probability of one or zero, so they restructure the logic before the cutsets are generated.</p>
        {flags.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No flags recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Flag</th><th>State</th><th>Effect</th><th>Applies to</th></tr></thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "flag", id: f.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{f.name}</div><div className="possubtle" style={{ fontSize: 12 }}>{f.purpose}</div></td>
                  <td><span className={`esqstate esqstate--${f.state ? "on" : "off"}`}><span className="esqstate__dot" />{f.state ? "True" : "False"}</span></td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{f.effect}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{(f.applicableFamilyRefs ?? []).map(familyName).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Mutually exclusive events</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B7 · ESQ-B8</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMutex}><ESQIcon.Plus /> Add rule</button>}
          </div>
        </div>
        <p className="poscard__sub">Cutsets that contain events that cannot coexist are identified, then corrected by logic or by deletion, so they are not multiplied together.</p>
        {mutex.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No rules recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Rule</th><th>Events</th><th>Treatment</th></tr></thead>
            <tbody>
              {mutex.map((m) => (
                <tr key={m.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "mutex", id: m.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{m.description}</div><div className="possubtle" style={{ fontSize: 12 }}>{m.basis}</div></td>
                  <td>{m.eventIds.map((e, i) => <span key={i} className="poschip posmono" style={{ marginRight: 4 }}>{e}</span>)}</td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{MUTEX_TREATMENT_LABELS[m.treatment] ?? m.treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Circular logic</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B5</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCircular}><ESQIcon.Plus /> Add resolution</button>}
          </div>
        </div>
        <p className="poscard__sub">The support-system loops are detected and broken without adding bias to the result.</p>
        {circular.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No resolutions recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Loop</th><th>Systems</th><th>Method</th></tr></thead>
            <tbody>
              {circular.map((c) => (
                <tr key={c.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "circular", id: c.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{c.description}</div><div className="possubtle" style={{ fontSize: 12 }}>{c.resolutionDescription}</div></td>
                  <td>{c.involvedElementIds.map((e, i) => <span key={i} className="poschip posmono" style={{ marginRight: 4 }}>{e}</span>)}</td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{CIRCULAR_METHOD_LABELS[c.resolutionMethod] ?? c.resolutionMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Success paths kept</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B6</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "success", id: "success" })}>Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">{success.treatmentMethod}</p>
        {success.systemsWithSuccessModeled.length > 0 && (
          <div className="posrow posrow--wrap" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle" style={{ fontSize: 12.5 }}>Success modeled in</span>
            {success.systemsWithSuccessModeled.map((sys) => <span key={sys} className="poschip posmono">{sys}</span>)}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Modules</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-B10</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addModule}><ESQIcon.Plus /> Add module</button>}
          </div>
        </div>
        <p className="poscard__sub">Shared modules stay independent and interpretable at the level of the individual events.</p>
        {modules.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No modules recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Module</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              {modules.map((m) => {
                const status: [string, boolean][] = [["Shared events", m.sharedEventsIdentified], ["Independent", m.trueIndependenceVerified], ["Interpretable", m.perEventInterpretabilityMaintained]];
                return (
                  <tr key={m.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "module", id: m.uuid })} style={{ cursor: "pointer" }}>
                    <td><div className="postable__name">{m.processDescription}</div></td>
                    <td className="possubtle" style={{ fontSize: 12.5 }}>{MODULE_TYPE_LABELS[m.moduleType] ?? m.moduleType}</td>
                    <td><div className="esqstates">{status.map(([label, on]) => <span key={label} className={`esqstate esqstate--${on ? "on" : "off"}`}><span className="esqstate__dot" />{label}</span>)}</div></td>
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

export { ScopeScreen, IntegrateScreen, SolveScreen, LogicScreen, MethodChips, FamilyContribBar, type EsqDrawerContext };
