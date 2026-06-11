import { JSX } from "react";
import { ESQIcon } from "./esqIcons";
import { Badge, EsqProvenanceChip, valText, freqText, pctText } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { MethodChips, type EsqDrawerContext } from "./esqScreens";
import { generateEsqReport } from "./esqDocx";
import {
  QUANT_BASIS_LABELS,
  CONTRIBUTOR_TYPE_LABELS,
  CHALLENGE_BASIS_LABELS,
  EXT_HAZARD_BASIS_LABELS,
  ADVERSE_ENV_CREDIT,
  SOKC_CITED_SRS,
  PA_SR,
  SS_SR,
  ESQ_TOC,
  type Stage,
  type CapabilityCategory,
} from "./esqViewData";
import { familyMeanFrequency, familyIsRiskSignificant, importanceLevel, type CcScore } from "./esqSelectors";

// ─── 05 — Dependencies (HLR-C) ─────────────────────────────────────────────
function DependScreen(): JSX.Element {
  const { esq } = useEsqWorkbook();
  const multiHfe = esq.multiHfeCutsetIdentifications ?? [];
  const hfeApps = esq.hfeDependencyApplications ?? [];
  const transfers = esq.linkingTransferRecords ?? [];
  const phenomena = esq.phenomenaDependencyAssessments ?? [];
  const pml = esq.phenomenaModelLogic;
  const surv = (esq.equipmentSurvivabilityAssessments ?? [])[0];
  function dependencyAppFor(cutsetDescription: string): (typeof hfeApps)[number] | undefined {
    return hfeApps.find((h) => cutsetDescription.includes(h.cutsetContext));
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Multiple human failure events in a cutset</h3>
          <EsqProvenanceChip>ESQ-C1 · ESQ-C2</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">Cutsets with several human failure events are found, then their joint dependency is assessed, so the joint floor binds the product.</p>
        <div className="esqhfe">
          {multiHfe.map((m) => {
            const app = dependencyAppFor(m.cutsetDescription);
            const rs = m.potentialRiskImpact.toLowerCase().includes("risk-significant");
            return (
              <div key={m.uuid} className="esqhfe__card">
                <div className="esqhfe__head">
                  <span className="esqhfe__cutset posmono">{app?.cutsetContext ?? m.uuid}</span>
                  {rs && <span className="esqfam__rs">Risk-significant</span>}
                </div>
                <p className="esqhfe__desc">{m.cutsetDescription}</p>
                <div className="esqhfe__chain">
                  {m.hfeRefs.map((h, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="esqhfe__hfe">{h}</span>
                      {i < m.hfeRefs.length - 1 && <span className="esqhfe__times">×</span>}
                    </span>
                  ))}
                </div>
                {app !== undefined && (
                  <div className="esqhfe__joint">
                    <span className="esqhfe__joint-cap">Joint HEP per {app.hrDependencyAssessmentRef}</span>
                    <span className="esqhfe__joint-val posmono">{valText(app.appliedJointHep)}</span>
                    <span className="esqhfe__joint-floor">Floor binds</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <ESQIcon.Person />
          <span>The joint-HEP floor machinery built in the human reliability analysis is applied here, at the cutset level, during quantification.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Event-tree linking transfers</h3>
          <EsqProvenanceChip>ESQ-C3</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">On each transfer to a downstream tree, the sequence characteristics travel with the handoff, not only the frequency.</p>
        <div className="esqphen">
          {transfers.map((t) => (
            <div key={t.uuid} className="esqphen__row" style={{ borderLeftColor: "var(--esq-solve)" }}>
              <div className="esqphen__main">
                <span className="esqphen__name" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{t.sourceTreeDescription} <ESQIcon.ArrowR /> {t.targetTreeDescription}</span>
                <div className="esqphen__ssc">
                  {t.failedEquipmentTransferred.map((e, i) => <span key={i} className="esqphen__ssc-tag">{e}</span>)}
                  {t.flagSettingsTransferred.map((fl, i) => <span key={`f${i}`} className="esqphen__ssc-tag">{fl}</span>)}
                </div>
              </div>
              <span className="esqphen__assess">{t.otherCharacteristicsTransferred?.[0] ?? "The sequence characteristics carry into the downstream tree."}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Phenomena dependencies</h3>
          <EsqProvenanceChip>ESQ-C4 · ESQ-C6</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">Phenomenological dependencies on credited equipment are assessed, and any independence assumption is justified.</p>
        <div className="esqphen">
          {phenomena.map((p) => (
            <div key={p.uuid} className="esqphen__row">
              <div className="esqphen__main">
                <span className="esqphen__name">{p.phenomenon}</span>
                <div className="esqphen__ssc">
                  {p.affectedSscRefs.map((s, i) => <span key={i} className="esqphen__ssc-tag">{s}</span>)}
                </div>
              </div>
              <span className="esqphen__assess">{p.dependencyAssessment}{p.independenceJustifications?.[0] !== undefined ? ` ${p.independenceJustifications[0]}` : ""}</span>
            </div>
          ))}
        </div>
        {pml !== undefined && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <ESQIcon.Flame />
            <span>{pml.scrubbingJustification} {pml.beneficialFailureJustification}</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The adverse-environment credit fence</h3>
          <EsqProvenanceChip>ESQ-C8 · ESQ-C9</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">Realism is purchasable but optimism is not, so no credit is taken at CC-I and credit at CC-II is earned by analysis.</p>
        <div className="esqcredit">
          <div className="esqcredit__col esqcredit__col--no">
            <span className="esqcredit__cc">CC-I</span>
            <div className="esqcredit__rule">{ADVERSE_ENV_CREDIT.cci.rule}</div>
            <p className="esqcredit__body">{ADVERSE_ENV_CREDIT.cci.body}</p>
          </div>
          <div className="esqcredit__col esqcredit__col--yes">
            <span className="esqcredit__cc">CC-II</span>
            <div className="esqcredit__rule">{ADVERSE_ENV_CREDIT.ccii.rule}</div>
            <p className="esqcredit__body">{ADVERSE_ENV_CREDIT.ccii.body}</p>
            <div className="esqcredit__reqs">
              {ADVERSE_ENV_CREDIT.ccii.requirements.map((r, i) => (
                <span key={i} className="esqcredit__req"><ESQIcon.Check /> {r}</span>
              ))}
            </div>
          </div>
        </div>
        {surv !== undefined && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <ESQIcon.Thermo />
            <span>The {surv.equipmentRefs[0]} stays within its limit under the {surv.environmentalConditions[0]?.severity.toLowerCase()}, so the action is credited at CC-II.</span>
          </div>
        )}
      </div>
    </>
  );
}

// ─── 06 — Barriers (HLR-C, the barrier block) ──────────────────────────────
function BarriersScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const barriers = esq.barrierQuantifications;
  return (
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Radionuclide barriers</h3>
        <span className="possubtle">{barriers.length} barriers · ESQ-C10 to C15</span>
      </div>
      <p className="poscard__sub">Each barrier is evaluated for its gross and localized failure modes, its challenging phenomena, and its capacity, conservatively at CC-I or realistically with aging at CC-II.</p>
      <div className="esqbar">
        {barriers.map((b) => {
          const extHazard = b.externalHazardCapacity?.[0];
          const screened = b.screenedOutMechanisms ?? [];
          return (
            <div key={b.uuid} className="esqbar__card" onClick={() => openDrawer({ kind: "barrier", id: b.uuid })}>
              <div className="esqbar__head">
                <span className="esqbar__icon"><ESQIcon.Shield /></span>
                <div className="esqbar__head-main">
                  <div className="esqbar__name">{b.name}</div>
                  <div className="esqbar__src posmono">{b.applicableSourceRefs.join(" · ")}</div>
                </div>
              </div>
              <div className="esqbar__modes">
                {b.failureModes.map((m, i) => (
                  <div key={i} className="esqbar__mode">
                    <span className={`esqbar__mode-tag esqbar__mode-tag--${m.failureType === "GROSS" ? "gross" : "local"}`}>{m.failureType === "GROSS" ? "Gross" : "Localized"}</span>
                    <span className="esqbar__mode-name">{m.failureMode}</span>
                    <span className="esqbar__mode-p posmono">{valText(m.probability)}</span>
                  </div>
                ))}
              </div>
              <div className="esqbar__cols">
                <div>
                  <span className="esqbar__col-cap">Challenge</span>
                  <span className={`esqbar__col-basis esqbar__col-basis--${b.challengeAssessment.basis === "REALISTIC_PLANT_SPECIFIC_CALCULATION" ? "real" : "cons"}`}>
                    <ESQIcon.Curve /> {CHALLENGE_BASIS_LABELS[b.challengeAssessment.basis]}
                  </span>
                </div>
                <div>
                  <span className="esqbar__col-cap">Capacity</span>
                  <span className={`esqbar__col-basis esqbar__col-basis--${b.capacityEvaluation.basis === "REALISTIC" ? "real" : "cons"}`}>
                    <ESQIcon.Scale /> {b.capacityEvaluation.basis === "REALISTIC" ? (b.capacityEvaluation.inServiceAgingIncluded === true ? "Realistic with aging" : "Realistic") : "Conservative"}
                  </span>
                </div>
              </div>
              <div className="esqbar__foot">
                {extHazard !== undefined && (
                  <span className="poschip"><ESQIcon.Flame /> {extHazard.hazard} · {EXT_HAZARD_BASIS_LABELS[extHazard.basis]}</span>
                )}
                {screened.length > 0 && <EsqProvenanceChip>{screened[0].criterion}</EsqProvenanceChip>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hrnote" style={{ marginTop: 12 }}>
        <ESQIcon.Shield />
        <span>For this reactor a barrier is not a containment building, so this block is where the functional-containment argument gets quantified.</span>
      </div>
    </div>
  );
}

// ─── 07 — Review Results (HLR-D) ───────────────────────────────────────────
function ResultsScreen(): JSX.Element {
  const { esq } = useEsqWorkbook();
  const contributors = esq.riskSignificantContributors;
  const maxFrac = Math.max(...contributors.map((c) => c.fractionalContribution ?? 0), 0.01);
  const measures = (esq.importanceAnalyses ?? [])[0]?.measures ?? [];
  const impReview = (esq.importanceReviews ?? [])[0];
  const unexpected = impReview?.unexpectedResults?.[0];
  const audit = esq.screenedEventCumulativeAssessment;
  const consistency = esq.consistencyReviews[0];
  const ruleReview = esq.ruleLogicReviews[0];
  const similar = (esq.similarPlantComparisons ?? [])[0];
  const cutsetCards: { id: string; scope: "sig" | "nonsig"; sample: string; finding: string }[] = [
    ...esq.cutsetLogicReviews.map((c) => ({ id: c.uuid, scope: "sig" as const, sample: c.sampleDescription, finding: c.findings })),
    ...esq.nonSignificantSampleReviews.map((c) => ({ id: c.uuid, scope: "nonsig" as const, sample: c.sampleDescription, finding: c.findings })),
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-significant contributors</h3>
          <EsqProvenanceChip>ESQ-D6</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The contributors are identified using the criteria defined by Risk Integration, with the single-reactor scope noted for this single-unit site.</p>
        <div className="esqcontrib">
          {contributors.map((c, i) => (
            <div key={c.uuid} className="esqcontrib__row">
              <span className="esqcontrib__rank">{i + 1}</span>
              <div className="esqcontrib__main">
                <span className="esqcontrib__name">{c.entityRef}</span>
                <span className="esqcontrib__type">{CONTRIBUTOR_TYPE_LABELS[c.contributorType] ?? c.contributorType}</span>
              </div>
              <div className="esqcontrib__bar-cell">
                <span className="esqcontrib__bar"><span className="esqcontrib__bar-fill" style={{ width: `${Math.round(((c.fractionalContribution ?? 0) / maxFrac) * 100)}%` }} /></span>
              </div>
              <span className="esqcontrib__pct">{pctText(c.fractionalContribution ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Importance review</h3>
          <EsqProvenanceChip>ESQ-D7</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The importance measures are read at the model's level of detail, and anything unexpected is reconciled rather than rationalized.</p>
        <table className="postable" style={{ marginTop: 4 }}>
          <thead><tr><th>Entity</th><th>Type</th><th>Fussell-Vesely</th><th>Risk achievement worth</th></tr></thead>
          <tbody>
            {measures.map((m, i) => {
              const level = importanceLevel(m.fussellVesely);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{m.entityRef}</td>
                  <td className="possubtle" style={{ fontSize: 11.5 }}>{m.entityType.split("_").join(" ").toLowerCase()}</td>
                  <td><span className={`esqimp__measure esqimp__measure--${level}`}>{(m.fussellVesely ?? 0).toFixed(2)}</span></td>
                  <td><span className={`esqimp__measure esqimp__measure--${level}`}>{(m.riskAchievementWorth ?? 0).toFixed(1)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {unexpected !== undefined && (
          <div className="esqcheck esqcheck--warn" style={{ marginTop: 12 }}>
            <ESQIcon.Warn />
            <span>{unexpected.description} {unexpected.reconciliation}</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Cutset logic review</h3>
          <EsqProvenanceChip>ESQ-D1 · ESQ-D5</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The risk-significant cutsets are checked for correct logic, and a sample of the small cutsets is checked for physical meaning.</p>
        <div className="esqcut">
          {cutsetCards.map((c) => (
            <div key={c.id} className={`esqcut__card esqcut__card--${c.scope}`}>
              <div className="esqcut__head">
                <span className={`esqcut__scope esqcut__scope--${c.scope}`}>{c.scope === "sig" ? "Risk-significant" : "Non-significant"}</span>
                <span className="esqcut__name">{c.sample}</span>
              </div>
              <p className="esqcut__finding">{c.finding}</p>
              <span className="esqcut__verdict esqcut__verdict--ok"><ESQIcon.Check /> Logic confirmed</span>
            </div>
          ))}
        </div>
      </div>

      {audit !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Screening audit</h3>
            <EsqProvenanceChip>ESQ-D8</EsqProvenanceChip>
          </div>
          <p className="poscard__sub">ESQ performs none of its own screening but audits everyone else's, so the cumulative effect of the screened-out initiators is checked.</p>
          <div className="esqaudit">
            <span className="esqaudit__icon"><ESQIcon.Filter /></span>
            <div className="esqaudit__main">
              <div className="esqaudit__title">Cumulative screened-event check</div>
              <p className="esqaudit__body">{audit.cumulativeImpactAssessment} {audit.basis}</p>
              <div className="esqaudit__refs">
                {audit.screenedInitiatingEventRefs.map((r, i) => <span key={i} className="poschip">{r}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consistency and similar-plant comparison</h3>
          <EsqProvenanceChip>ESQ-D2 · D3 · D4</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The results are checked against the upstream models, the operational reality, the internal rules, and a similar plant.</p>
        <div className="hrtheme">
          {consistency?.modelingFindings !== undefined && (
            <div className="hrtheme__cell"><span className="hrtheme__sr posmono">D2</span><span className="hrtheme__t">{consistency.modelingFindings}</span></div>
          )}
          {consistency?.operationalFindings !== undefined && (
            <div className="hrtheme__cell"><span className="hrtheme__sr posmono">D2</span><span className="hrtheme__t">{consistency.operationalFindings}</span></div>
          )}
          {ruleReview?.findings !== undefined && (
            <div className="hrtheme__cell"><span className="hrtheme__sr posmono">D3</span><span className="hrtheme__t">{ruleReview.findings}</span></div>
          )}
          {similar?.keyDifferences[0] !== undefined && (
            <div className="hrtheme__cell"><span className="hrtheme__sr posmono">D4</span><span className="hrtheme__t">{similar.keyDifferences[0]}</span></div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 08 — Uncertainty & Pre-op (HLR-E closeout) ────────────────────────────
function UncertScreen({ stage }: { stage: Stage }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const funnel = esq.modelUncertaintySourceAssessments ?? [];
  const sokc = esq.uncertaintyPropagation.stateOfKnowledgeCorrelation;
  const register: { type: string; tone: string; item: string; detail: string; srs: string }[] = [
    ...esq.modelUncertainty.uncertaintySources.map((u) => ({ type: "Uncertainty", tone: "progress", item: u.source, detail: u.impact, srs: "ESQ-C16 · E1" })),
    ...(esq.preOperationalAssumptions ?? []).map((a) => ({ type: "Pre-op", tone: "warn", item: a.influenceOnDefinition, detail: a.description, srs: PA_SR[a.assumptionId] ?? "ESQ-C17" })),
    ...(esq.sensitivityStudies ?? []).map((s) => ({ type: "Sensitivity", tone: "", item: s.name ?? "Sensitivity study", detail: s.results ?? "", srs: SS_SR[s.uuid] ?? "ESQ-E2" })),
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The uncertainty funnel</h3>
          <EsqProvenanceChip>ESQ-E1</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">Every element's uncertainty stream converges here, assessed for its effect on the family frequencies, qualitatively or quantitatively.</p>
        <div className="esqfunnel">
          {funnel.map((u) => (
            <div key={u.uuid} className="esqfunnel__row">
              <span className="esqfunnel__el posmono">{u.sourceElementCode}</span>
              <span className="esqfunnel__src">{u.uncertaintySource}. {u.effectOnFamilyFrequencies}</span>
              <span className={`esqfunnel__eval esqfunnel__eval--${u.evaluationType === "QUANTITATIVE" ? "quant" : "qual"}`}>{u.evaluationType === "QUANTITATIVE" ? "Quantitative" : "Qualitative"}</span>
            </div>
          ))}
          <div className="esqfunnel__spout">
            <ESQIcon.Sigma />
            <span>The streams converge into the family-frequency uncertainty.</span>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">State-of-knowledge correlation</h3>
          <EsqProvenanceChip>ESQ-E2 · ESQ-A5</EsqProvenanceChip>
        </div>
        <p className="poscard__sub">The uncertainty is propagated with the correlation between shared estimates accounted for, so estimates drawn from one number move together.</p>
        <div className="esqsokc">
          <div className="esqsokc__head">
            <span className="esqsokc__icon"><ESQIcon.Curve /></span>
            <div>
              <div className="esqsokc__title">Propagated with the correlation accounted for</div>
              <div className="esqsokc__sub">{sokc.handlingDescription}</div>
            </div>
          </div>
          <div className="esqsokc__groups">
            {(sokc.correlatedParameterGroups ?? []).map((g, i) => (
              <div key={i} className="esqsokc__group">
                <span className="esqsokc__group-icon"><ESQIcon.Link /></span>
                <div className="esqsokc__group-main">
                  <div className="esqsokc__group-name">Shared estimate group {i + 1}</div>
                  <div className="esqsokc__group-params posmono">{g.join(" · ")}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="esqsokc__note">
            <ESQIcon.Sparkle />
            <span>The uncertainty blocks built shape-identical across IE, HR and DA are consumed here uniformly. It cites {SOKC_CITED_SRS.join(", ")} by name.</span>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <span className="possubtle">{register.length} items · ESQ-C16, C17, E1, E2, F5</span>
        </div>
        <p className="poscard__sub">The uncertainty sources, the pre-operational assumptions and the sensitivity studies feed the documentation.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r, i) => (
              <tr key={i}>
                <td><span className={`posbadge${r.tone !== "" ? ` posbadge--${r.tone}` : ""}`}>{r.tone !== "" && <span className="posbadge__dot" />}{r.type}</span></td>
                <td style={{ fontWeight: 600 }}>{r.item}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.srs}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stage === "pre_operational" && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <ESQIcon.Lock />
            <span>Only two pre-operational assumptions fork here, in the dependency treatment and the documentation, the lightest fork in the standard.</span>
          </div>
        )}
      </div>
    </>
  );
}

// ─── 09 — Draft ────────────────────────────────────────────────────────────
function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: { cc: CapabilityCategory; scores: CcScore; stage: Stage; onSubmitDraft: () => void; canSubmit: boolean }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{esq.name}</h1>
        <h2>Preliminary Event Sequence Quantification</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {ESQ_TOC.map(([tt, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{tt}</span><span>{p}</span></div>
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
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable, stage</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Send to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 8 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><ESQIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateEsqReport(esq, false); }}><ESQIcon.Download /> Download draft (.docx)</button>
          </div>
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Where it goes next</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>The family frequencies flow into Risk Integration, and the release inputs flow into the source term.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="poschip poschip--method"><ESQIcon.ArrowR /> Risk Integration (RI)</span>
            <span className="poschip poschip--method"><ESQIcon.ArrowR /> Mechanistic Source Term (MS)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer content (family / barrier) ─────────────────────────────────────
function DrawerContent({ context, onClose }: { context: EsqDrawerContext; onClose: () => void }): JSX.Element | null {
  const { esq } = useEsqWorkbook();

  if (context.kind === "family") {
    const f = esq.familyQuantifications.find((x) => x.uuid === context.id);
    if (f === undefined) return null;
    const qb = QUANT_BASIS_LABELS[f.quantificationBasis];
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Event sequence family</div>
            <h2 className="posdrawer__title">{f.name}</h2>
            <p className="posdrawer__sub">{f.eventSequenceFamilyRef}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          {f.representativeSequenceSelectionBasis !== undefined && (
            <div>
              <div className="essec">How it is quantified</div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{f.representativeSequenceSelectionBasis}</p>
            </div>
          )}
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Mean frequency</label><div className="posmono" style={{ fontWeight: 700 }}>{freqText(familyMeanFrequency(f))}</div></div>
            <div className="posfield"><label className="posfield__label">Quantification basis</label><div style={{ fontWeight: 700, fontSize: 12.5 }}>{qb?.label ?? f.quantificationBasis}</div></div>
            {f.percentile95 !== undefined && <div className="posfield"><label className="posfield__label">P05 to P95</label><div className="posmono" style={{ fontSize: 12 }}>{valText(f.percentile05)} to {valText(f.percentile95)}</div></div>}
            <div className="posfield"><label className="posfield__label">Risk significance</label><div>{familyIsRiskSignificant(f) ? <Badge kind="progress">Risk-significant</Badge> : <Badge>Not significant</Badge>}</div></div>
          </div>
          {f.crossPosGroupingJustification !== undefined && (
            <div>
              <div className="essec">Grouping basis</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-text-muted)", margin: 0 }}>{f.crossPosGroupingJustification}{f.crossSourceGroupingJustification !== undefined ? ` ${f.crossSourceGroupingJustification}` : ""}</p>
            </div>
          )}
          <div>
            <div className="essec">Contribution breakdown</div>
            <div className="esqfam__contrib">
              {(f.contributionBreakdown ?? []).map((c, i) => (
                <div key={i} className="esqfam__contrib-row">
                  <span className="esqfam__contrib-name">{c.contributorRef}</span>
                  <span className="esqfam__contrib-type">{CONTRIBUTOR_TYPE_LABELS[c.contributorType] ?? c.contributorType}</span>
                  <div className="esqfam__contrib-bar"><span className="esqfam__contrib-bar-fill" style={{ width: pctText(c.fractionalContribution) }} /><span className="esqfam__contrib-bar-txt">{pctText(c.fractionalContribution)}</span></div>
                </div>
              ))}
            </div>
          </div>
          {(f.significantUncertaintySources ?? []).length > 0 && (
            <div>
              <div className="essec">Significant uncertainty sources</div>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                {(f.significantUncertaintySources ?? []).map((u, i) => <span key={i} className="poschip">{u}</span>)}
              </div>
            </div>
          )}
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {f.implementsSrs.map((s) => <span key={s.sr} className="poschip poschip--method">{s.sr}</span>)}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "barrier") {
    const b = esq.barrierQuantifications.find((x) => x.uuid === context.id);
    if (b === undefined) return null;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Radionuclide barrier</div>
            <h2 className="posdrawer__title">{b.name}</h2>
            <p className="posdrawer__sub">{b.applicableSourceRefs.join(" · ")}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">How it is evaluated</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{b.capacityEvaluation.description}</p>
          </div>
          <div>
            <div className="essec">Failure modes</div>
            <div className="esqbar__modes">
              {b.failureModes.map((m, i) => (
                <div key={i} className="esqbar__mode">
                  <span className={`esqbar__mode-tag esqbar__mode-tag--${m.failureType === "GROSS" ? "gross" : "local"}`}>{m.failureType === "GROSS" ? "Gross" : "Localized"}</span>
                  <span className="esqbar__mode-name">{m.failureMode}</span>
                  <span className="esqbar__mode-p posmono">{valText(m.probability)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="essec">Challenging phenomena</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {b.challengingPhenomena.map((p, i) => <span key={i} className="poschip"><ESQIcon.Flame /> {p}</span>)}
            </div>
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Challenge basis</label><div style={{ fontWeight: 700, fontSize: 12.5 }}>{CHALLENGE_BASIS_LABELS[b.challengeAssessment.basis]}</div></div>
            <div className="posfield"><label className="posfield__label">Capacity basis</label><div style={{ fontWeight: 700, fontSize: 12.5 }}>{b.capacityEvaluation.basis === "REALISTIC" ? (b.capacityEvaluation.inServiceAgingIncluded === true ? "Realistic with aging" : "Realistic") : "Conservative"}</div></div>
            {b.externalHazardCapacity?.[0] !== undefined && (
              <div className="posfield"><label className="posfield__label">External hazard</label><div style={{ fontSize: 12.5 }}>{b.externalHazardCapacity[0].hazard} · {EXT_HAZARD_BASIS_LABELS[b.externalHazardCapacity[0].basis]}</div></div>
            )}
          </div>
          {(b.screenedOutMechanisms ?? []).length > 0 && (
            <div>
              <div className="essec">Screened-out mechanisms</div>
              {(b.screenedOutMechanisms ?? []).map((s, i) => (
                <div key={i} className="esqbar__screened"><ESQIcon.Filter /> {s.mechanism}. {s.justification}</div>
              ))}
            </div>
          )}
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {b.implementsSrs.map((s) => <span key={s.sr} className="poschip poschip--method">{s.sr}</span>)}
          </div>
        </div>
      </>
    );
  }

  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return (
    <div className="poscard">
      <div className="hrempty">
        <div className="hrempty__title">{label}</div>
        <p className="hrempty__hint">This step is part of the Event Sequence Quantification workflow.</p>
      </div>
    </div>
  );
}

export { DependScreen, BarriersScreen, ResultsScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };
