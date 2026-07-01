import { JSX } from "react";
import { ESQIcon } from "./esqIcons";
import { Badge, EsqProvenanceChip, valText, pctText } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { WorkbookInterfaceTiles } from "../workbooks/workbookInterfaces";
import {
  CAPABILITY_CATEGORIES,
  ESQ_METHODS,
  QUANT_BASIS_LABELS,
  CONTRIBUTOR_TYPE_LABELS,
  MUTEX_TREATMENT_LABELS,
  APPROXIMATIONS,
  A5_SPLIT,
  type Stage,
} from "./esqViewData";
import { familyMeanFrequency, familyIsRiskSignificant, familyIsWarn } from "./esqSelectors";

interface EsqDrawerContext {
  kind: "family" | "barrier";
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
    <div className="esqfam__contrib-bar">
      <span className="esqfam__contrib-bar-fill" style={{ width: pctText(frac) }} />
      <span className="esqfam__contrib-bar-txt">{pctText(frac)}</span>
    </div>
  );
}

// ─── 01 — Scope & Inputs ───────────────────────────────────────────────────
function ScopeScreen({ ccId, setCcId, stage, setStage }: { ccId: string; setCcId: (id: string) => void; onAction: (msg: string) => void; stage: Stage; setStage: (s: Stage) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];

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
        <p className="poscard__sub">What flows into Event Sequence Quantification and what it feeds. Select an element to see the data exchanged.</p>
        <WorkbookInterfaceTiles element="ESQ" />
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
        <div className="hrnote" style={{ marginTop: 12 }}>
          <ESQIcon.Sparkle />
          <span>CC-II cannot be met without real uncertainty propagation, since the mean of a product of correlated estimates is not the product of the means.</span>
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
        <div className="hrnote" style={{ marginTop: 12 }}>
          <ESQIcon.Tag />
          <span>ESQ owns almost no pre-operational fork, since it inherits its pre-operational character through the upstream parameters and models.</span>
        </div>
      </div>
    </>
  );
}

// ─── 02 — Integrate & Quantify (HLR-A) ─────────────────────────────────────
function IntegrateScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const scope = esq.modelIntegration.scopeCoverage;
  const scopeCells: { k: string; v: number; cap: string; icon: string }[] = [
    { k: "Sources", v: scope.radionuclideSources.length, cap: "Radionuclide sources", icon: "Atom" },
    { k: "IE groups", v: scope.initiatingEventGroups.length, cap: "Initiating-event groups", icon: "Bolt" },
    { k: "Hazard groups", v: scope.hazardGroups.length, cap: "Internal and external", icon: "Flame" },
    { k: "POS", v: scope.plantOperatingStates.length, cap: "Plant operating states", icon: "Layers" },
    { k: "Evolutions", v: scope.plantEvolutions.length, cap: "Plant evolutions", icon: "Activity" },
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Model integration</h3>
          <EsqProvenanceChip>ESQ-A2</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The grand integration combines the sequences, the system logic, the data and the human reliability across the full scope.</p>
        <div className="esqscope">
          {scopeCells.map((s) => {
            const Icon = ESQIcon[s.icon] ?? ESQIcon.Layers;
            return (
              <div key={s.k} className="esqscope__cell">
                <span className="esqscope__k"><Icon /> {s.k}</span>
                <span className="esqscope__v">{s.v}</span>
                <span className="esqscope__cap">{s.cap}</span>
              </div>
            );
          })}
        </div>
        {esq.modelIntegration.multiReactorInclusionBasis !== undefined && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <ESQIcon.Network />
            <span>{esq.modelIntegration.multiReactorInclusionBasis}</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Event sequence families</h3>
          <span className="possubtle">{esq.familyQuantifications.length} families · ESQ-A1, A4</span>
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
                  <ESQIcon.Function /> {qb?.label ?? f.quantificationBasis}
                </span>
                {f.percentile95 !== undefined && (
                  <div className="esqfam__pct">
                    {([["05", f.percentile05, 28], ["50", f.percentile50, 60], ["95", f.percentile95, 100]] as [string, number | undefined, number][]).map(([k, v, w]) => (
                      <div key={k} className="esqfam__pct-row">
                        <span className="esqfam__pct-k">P{k}</span>
                        <span className="esqfam__pct-bar"><span className="esqfam__pct-fill" style={{ width: `${w}%` }} /></span>
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
                <div className="esqfam__foot">
                  <MethodChips ids={["ftlink", "mcub"]} label="Solved by" />
                  {familyIsRiskSignificant(f) && <span className="esqfam__rs">Risk-significant</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The capability split</h3>
          <EsqProvenanceChip>ESQ-A5</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">ESQ's signature split, the most computational in the standard, from a point estimate to a mean with the state-of-knowledge correlation.</p>
        <div className="esqsplit">
          <div className="esqsplit__col">
            <span className="esqsplit__cc esqsplit__cc--i">CC-I</span>
            <div className="esqsplit__title">{A5_SPLIT.cci.title}</div>
            <p className="esqsplit__desc">{A5_SPLIT.cci.desc}</p>
            <span className="esqsplit__tag" style={{ color: "var(--color-text-subtle)" }}><ESQIcon.Hash /> {A5_SPLIT.cci.tag}</span>
          </div>
          <div className="esqsplit__col esqsplit__col--ii">
            <span className="esqsplit__cc esqsplit__cc--ii">CC-II</span>
            <div className="esqsplit__title">{A5_SPLIT.ccii.title}</div>
            <p className="esqsplit__desc">{A5_SPLIT.ccii.desc}</p>
            <span className="esqsplit__tag"><ESQIcon.Link /> {A5_SPLIT.ccii.tag}</span>
          </div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <ESQIcon.Sparkle />
          <span>{A5_SPLIT.note}</span>
        </div>
      </div>
    </>
  );
}

// ─── 03 — Solve & Converge (HLR-B, computational core) ─────────────────────
function SolveScreen(): JSX.Element {
  const { esq } = useEsqWorkbook();
  const qm = esq.quantificationMethods;
  const trunc = qm.truncation;
  const maxFreq = Math.max(...trunc.truncationProgression.map((c) => trunc.frequencyAtTruncation[c] ?? 0), 1e-12);
  const approxOn: Record<string, boolean> = {
    "rare-event": qm.cutsetSolutionMethod === "RARE_EVENT",
    mcub: qm.cutsetSolutionMethod === "MCUB",
    exact: true,
    "monte-carlo": esq.uncertaintyPropagation.propagationMethod === "MONTE_CARLO",
  };
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Quantification codes</h3>
          <EsqProvenanceChip>ESQ-B1</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The codes are demonstrated against accepted algorithms, with the method-specific limitations identified and the roles named rather than any product.</p>
        <div className="esqcode">
          {qm.computerCodes.map((c) => (
            <div key={c.name} className="esqcode__card">
              <div className="esqcode__head">
                <span className="esqcode__icon"><ESQIcon.Cpu /></span>
                <div className="esqcode__head-main">
                  <div className="esqcode__name">{c.name}</div>
                  <div className="esqcode__ver">{c.methodSpecificFeatures?.[0] ?? `v${c.version}`}</div>
                </div>
              </div>
              <div className="esqcode__vv">
                {c.verificationDocumentation.length > 0 && <span className="esqcode__vv-pill"><ESQIcon.Verified /> Verified</span>}
                {c.validationDocumentation.length > 0 && <span className="esqcode__vv-pill"><ESQIcon.Check /> Validated</span>}
              </div>
              <div className="esqcode__limits">
                {c.methodSpecificLimitations.map((l, i) => (
                  <div key={i} className="esqcode__limit"><ESQIcon.Warn /> {l}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Truncation convergence</h3>
          <EsqProvenanceChip>ESQ-B2 · ESQ-B3</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The truncation limit is set by lowering the cutoff until the family frequency stops moving, with the dependencies confirmed to survive the cut.</p>
        <div className="esqtrunc">
          <div className="esqtrunc__chart">
            {trunc.truncationProgression.map((cutoff, i) => {
              const freq = trunc.frequencyAtTruncation[cutoff];
              const delta = trunc.percentageChangeAtTruncation[cutoff];
              const h = Math.round(((freq ?? 0) / maxFreq) * 100);
              const converged = delta !== undefined && delta < 0.5;
              return (
                <div key={i} className="esqtrunc__col">
                  <div className="esqtrunc__bar-wrap">
                    <div className={`esqtrunc__bar${converged ? " esqtrunc__bar--converged" : ""}`} style={{ height: `${h}%` }}>
                      <span className="esqtrunc__bar-val">{valText(freq)}</span>
                    </div>
                  </div>
                  <span className="esqtrunc__cut">{valText(cutoff)}</span>
                  {delta !== undefined
                    ? <span className={`esqtrunc__delta esqtrunc__delta--${delta >= 1 ? "high" : "low"}`}>{delta}%</span>
                    : <span className="esqtrunc__delta esqtrunc__delta--low">base</span>}
                </div>
              );
            })}
          </div>
          <div className="esqtrunc__note">
            <ESQIcon.Activity />
            <span>{trunc.basisForSelection} The cutoff settles at {valText(trunc.finalTruncationValue)} per year, and the merged cutsets are re-confirmed after merging.</span>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Solution and approximation</h3>
          <EsqProvenanceChip>ESQ-B4</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">Cutsets are solved by the minimal cutset upper bound or an exact solution, and the rare-event approximation is not relied on for risk-significant families.</p>
        <div className="esqapprox">
          {APPROXIMATIONS.map((a) => (
            <div key={a.id} className={`esqapprox__chip${approxOn[a.id] ? " esqapprox__chip--on" : ""}`}>
              <span className="esqapprox__chip-k">{a.label}</span>
              <span className="esqapprox__chip-v">{a.note}</span>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <ESQIcon.Tag />
          <span>The solution method is declared with the result, so the reader knows which approximation produced the number.</span>
        </div>
      </div>
    </>
  );
}

// ─── 04 — Logic Integrity (HLR-B) ──────────────────────────────────────────
function LogicScreen(): JSX.Element {
  const { esq } = useEsqWorkbook();
  const flags = esq.flagEventSettings ?? [];
  const mutex = esq.mutuallyExclusiveEventRules ?? [];
  const circular = esq.circularLogicResolutions ?? [];
  const modules = esq.moduleUsageRecords ?? [];
  const success = esq.systemSuccessTreatment;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">House-event flags</h3>
          <EsqProvenanceChip>ESQ-B9</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">Logic flag events are set to true or false, not to a probability of one or zero, so the flag restructures the logic before the cutsets are generated.</p>
        <div className="esqflag">
          {flags.map((f) => (
            <div key={f.uuid} className="esqflag__row">
              <div className="esqflag__main">
                <span className="esqflag__name">{f.name}</span>
                <span className="esqflag__purpose">{f.purpose}. {f.effect}</span>
              </div>
              <span className={`esqflag__state esqflag__state--${f.state ? "true" : "false"}`}>{f.state ? "TRUE" : "FALSE"}</span>
              <span className="esqflag__node posmono">{(f.applicableFamilyRefs ?? [])[0] ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <ESQIcon.Sparkle />
          <span>A probability-one event survives into the cutsets and corrupts them, so a true or false house event is used instead.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Mutually exclusive events</h3>
          <EsqProvenanceChip>ESQ-B7 · ESQ-B8</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">Cutsets that contain events that cannot coexist are identified, then corrected by logic or by deletion, so they are not multiplied together.</p>
        <div className="esqmutex">
          {mutex.map((m) => (
            <div key={m.uuid} className="esqmutex__row">
              <div className="esqmutex__main">
                <span className="esqmutex__desc">{m.description}</span>
                <span className="esqmutex__basis">{m.basis}</span>
              </div>
              <div className="esqmutex__events">
                {m.eventIds.map((e, i) => <span key={i} className="esqmutex__event">{e}</span>)}
              </div>
              <span className="esqmutex__treat">{MUTEX_TREATMENT_LABELS[m.treatment] ?? m.treatment}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Circular logic, successes and modules</h3>
          <EsqProvenanceChip>ESQ-B5 · B6 · B10</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The support-system loops are broken without bias, the success branches are kept, and the shared modules stay independent and interpretable.</p>
        <div className="esqlogic">
          {circular.map((c) => (
            <div key={c.uuid} className="esqlogic__card">
              <div className="esqlogic__head">
                <span className="esqlogic__icon"><ESQIcon.Branch /></span>
                <span className="esqlogic__name">Circular logic</span>
                <span className="esqlogic__sr">B5</span>
              </div>
              <p className="esqlogic__desc">{c.description}. {c.resolutionDescription}</p>
              <div className="esqlogic__detail"><ESQIcon.Check /> {c.neutralityJustification}</div>
            </div>
          ))}
          <div className="esqlogic__card">
            <div className="esqlogic__head">
              <span className="esqlogic__icon"><ESQIcon.Check /></span>
              <span className="esqlogic__name">Successes kept</span>
              <span className="esqlogic__sr">B6</span>
            </div>
            <p className="esqlogic__desc">{success.treatmentMethod} {success.impactOnResults}</p>
            {success.modelingExamples?.[0] !== undefined && (
              <div className="esqlogic__detail"><ESQIcon.Tree /> {success.modelingExamples[0]}</div>
            )}
          </div>
          {modules.map((m) => (
            <div key={m.uuid} className="esqlogic__card">
              <div className="esqlogic__head">
                <span className="esqlogic__icon"><ESQIcon.Boxes /></span>
                <span className="esqlogic__name">Modules</span>
                <span className="esqlogic__sr">B10</span>
              </div>
              <p className="esqlogic__desc">{m.processDescription}</p>
              <div className="esqlogic__detail"><ESQIcon.Check /> Shared events identified, modules independent, per-event results interpretable.</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export { ScopeScreen, IntegrateScreen, SolveScreen, LogicScreen, MethodChips, FamilyContribBar, type EsqDrawerContext };
