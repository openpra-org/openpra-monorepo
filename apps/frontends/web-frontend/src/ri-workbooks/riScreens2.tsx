import { JSX } from "react";
import { RIIcon } from "./riIcons";
import { Badge, RiProvenanceChip, valText } from "./riShared";
import { useRiWorkbook } from "./riWorkbookContext";
import { generateRiReport } from "./riDocx";
import {
  FAMILY_NAMES,
  FAMILY_HAZARD,
  FAMILY_NOTES,
  REGISTER_SIDE,
  ELEMENT_CODE_BY_TYPE,
  REGISTER_NOTE,
  ANTI_MASKING_ROWS,
  PROPAGATION_SOURCES,
  EXTRA_DISPATCH,
  SIG_LABELS,
  SS_SR,
  RI_TOC,
  type CapabilityCategory,
  type DispatchCardSpec,
} from "./riViewData";
import { familySignificance, compiledById, consequenceOf, contributorRollup, lognormalBounds, type CcScore } from "./riSelectors";
import { type RiDrawerContext } from "./riScreens";

// ─── 04 — Aggregation & Contributors (RI-B3, B4, B5, B6) ───────────────────
function AggregateScreen(): JSX.Element {
  const { ri } = useRiWorkbook();
  const results = ri.integratedRiskResults;
  const conservatism = new Map((results.aggregationApproach.detailConservatismDifferences ?? []).map((d) => [d.scope, d.description]));
  const rollup = contributorRollup(ri);
  const multiTerms = [
    { id: "reactor", label: "Multi-reactor release contributions", state: results.multiReactorContributionsIncluded ? "Recorded, single unit" : "Not recorded", note: ri.integratedRiskResults.keyAssumptions?.[0] ?? "The multi-reactor term is recorded." },
    { id: "source", label: "Multi-source release contributions", state: results.multiSourceContributionsIncluded ? "Recorded, single source" : "Not recorded", note: ri.integratedRiskResults.keyAssumptions?.[1] ?? "The multi-source term is recorded." },
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Aggregation honesty</h3>
          <RiProvenanceChip>RI-B3</RiProvenanceChip>
        </div>
        <p className="poscard__sub">Each source and hazard contribution is identified, and a conservative model may not be summed with a realistic one and read as either.</p>
        <div className="riaggr">
          {(results.hazardGroupContributions ?? []).map((r) => {
            const conservative = (conservatism.get(r.hazardGroup) ?? "").toLowerCase().includes("conservative");
            const pct = Math.round(r.contribution * 100);
            return (
              <div key={r.hazardGroup} className="riaggr__row">
                <div className="riaggr__main">
                  <div className="riaggr__name">{r.hazardGroup}</div>
                  <div className="riaggr__note">{conservatism.get(r.hazardGroup) ?? ""}</div>
                  <div className="riaggr__bar" style={{ width: `${pct}%` }} />
                </div>
                <span className={`riaggr__model riaggr__model--${conservative ? "conservative" : "realistic"}`}>{conservative ? "CC-I conservative" : "CC-II realistic"}</span>
                <span className="riaggr__contrib posmono">{pct}%</span>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Warn />
          <span>{results.aggregationApproach.separateReviewFindings ?? results.aggregationApproach.justification}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Multi-reactor and multi-source terms</h3>
          <RiProvenanceChip>RI-B4</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The multi-reactor and multi-source release contributions are recorded, even where the single-unit scope keeps them from driving.</p>
        <div className="rigrid--2">
          {multiTerms.map((m) => (
            <div key={m.id} className="ricard">
              <div className="posrow" style={{ gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>{m.label}</span>
                <span className="posbadge"><span className="posbadge__dot" />{m.state}</span>
              </div>
              <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>{m.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Anti-masking review</h3>
          <RiProvenanceChip>RI-B5</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The within-family variations are justified as not risk-significant, so a worst member never hides behind a benign representative.</p>
        <div className="rimask">
          {ANTI_MASKING_ROWS.map((r) => (
            <div key={r.id} className={`rimask__row${r.flag ? " rimask__row--flag" : ""}`}>
              <span className="rimask__icon">{r.flag ? <RIIcon.Warn /> : <RIIcon.Check />}</span>
              <div className="rimask__main">
                <div className="rimask__name">{r.name}</div>
                <div className="rimask__note">{ri.groupingAdequacyReview[r.field]}</div>
              </div>
              <span className={`rimask__state rimask__state--${r.flag ? "reopened" : "clear"}`}>{r.stateLabel}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-significant contributors</h3>
          <RiProvenanceChip>RI-B6</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The contributors are identified at an insight-grade level, the roll-up RI documents and feeds back upstream.</p>
        <div className="ricontrib">
          {rollup.map((c, i) => (
            <div key={c.contributor.uuid} className="ricontrib__row">
              <span className="ricontrib__rank posmono">{i + 1}</span>
              <div className="ricontrib__main">
                <div className="ricontrib__name">{c.contributor.name}</div>
                <div className="ricontrib__basis">{c.contributor.context ?? ""}</div>
              </div>
              <span className="ricontrib__kind">{c.kind}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 05 — Risk Uncertainty (HLR-RI-C) ──────────────────────────────────────
function UncertaintyScreen(): JSX.Element {
  const { ri } = useRiWorkbook();
  const screenedByCode = new Map<string, string>((ri.screenedItemsLedger ?? []).map((s) => [s.screeningElementCode, s.screeningBasis]));
  const propagation = ri.uncertaintyAnalyses[0];
  const bounds = lognormalBounds(propagation?.parameterUncertainty);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Master uncertainty register</h3>
          <RiProvenanceChip>RI-C1</RiProvenanceChip>
        </div>
        <p className="poscard__sub">{REGISTER_NOTE}</p>
        <div className="riledger">
          <div className="riledger__row riledger__row--head">
            <div className="riledger__el">Element</div>
            <div className="riledger__head-cell">Key uncertainty source</div>
            <div className="riledger__head-cell riledger__impact">Impact and screened-out items</div>
          </div>
          {ri.modelUncertaintySources.map((u) => {
            const code = ELEMENT_CODE_BY_TYPE[u.originatingElement] ?? "RI";
            const screened = screenedByCode.get(code);
            return (
              <div key={u.uuid} className="riledger__row">
                <div className="riledger__el">{code}</div>
                <div className="riledger__source">
                  <span className="riledger__source-name">{u.name}</span>
                  <span className="riledger__source-tag"><RIIcon.Link /> {REGISTER_SIDE[code] ?? "Frequency side"}</span>
                </div>
                <div className="riledger__impact">
                  <span>
                    {u.impactAssessment}
                    {screened !== undefined && <span className="riledger__screened" style={{ marginLeft: 6 }}><RIIcon.Filter /> {screened}</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Database />
          <span>RI-C1 is the screening ledger of record, since every screening decision made anywhere in the PRA appears here.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Grouping-uncertainty review</h3>
          <RiProvenanceChip>RI-C2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The grouping uncertainty is reviewed so it does not make a family artificially risk-significant, in either direction.</p>
        <div className="rimask">
          <div className="rimask__row">
            <span className="rimask__icon"><RIIcon.Check /></span>
            <div className="rimask__main">
              <div className="rimask__name">Family grouping uncertainty</div>
              <div className="rimask__note">{ri.groupingAdequacyReview.groupingUncertaintyReview.findings ?? "The grouping uncertainty is reviewed."}</div>
            </div>
            <span className="rimask__state rimask__state--clear">{ri.groupingAdequacyReview.groupingUncertaintyReview.artificialSignificanceFound ? "Artifact found" : "No artifact"}</span>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Propagation fork</h3>
          <RiProvenanceChip>RI-C4</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The three upstream uncertainty machines converge here, the correlation from ESQ and the phenomena dependencies from MS and RC.</p>
        <div className="riprop">
          <div className="riprop__sources">
            {PROPAGATION_SOURCES.map((s) => {
              const Icon = RIIcon[s.icon] ?? RIIcon.Link;
              return (
                <div key={s.id} className="riprop__src" title={s.note}>
                  <span className="riprop__src-icon"><Icon /></span>
                  <div className="riprop__src-main">
                    <div className="riprop__src-name">{s.name}</div>
                    <div className="riprop__src-from posmono">{s.from}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="riprop__arrow"><RIIcon.ArrowR /></div>
          <div className="riprop__out">
            <span className="riprop__out-cap">{propagation?.name ?? "Integrated risk uncertainty"}</span>
            <div className="riprop__dist"><span className="riprop__dist-mean" /></div>
            <div className="riprop__scale">
              <span>{valText(bounds?.p05)}</span>
              <span>mean {valText(bounds?.mean)}</span>
              <span>{valText(bounds?.p95)}</span>
            </div>
            <span className="riprop__level"><RIIcon.Curve /> {propagation?.characterizationLevel === "PROPAGATED_RISK_SIGNIFICANT" ? "CC-II propagated distribution" : "Characterized range"}</span>
          </div>
        </div>
        {bounds !== undefined && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <RIIcon.Sparkle />
            <span>The 90 percent interval for the integrated latent risk spans {valText(bounds.p05)} to {valText(bounds.p95)} per plant-year.</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sensitivity studies</h3>
          <span className="possubtle">{(ri.sensitivityStudies ?? []).length} studies · feed the documentation</span>
        </div>
        <p className="poscard__sub">The sensitivity studies test the aggregation, the grouping and the correlation, and they feed the model-uncertainty documentation.</p>
        <table className="postable">
          <thead><tr><th>Study</th><th>Result</th><th>SR</th></tr></thead>
          <tbody>
            {(ri.sensitivityStudies ?? []).map((s) => (
              <tr key={s.uuid}>
                <td style={{ fontWeight: 600 }}>{s.name ?? "Sensitivity study"}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{s.results ?? ""}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{SS_SR[s.uuid] ?? "RI-D2"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── 06 — Feedback & Dispatch (HLR-RI-D, the loop closer) ───────────────────
function FeedbackScreen(): JSX.Element {
  const { ri } = useRiWorkbook();
  const dispatch = ri.riskIntegrationFeedbackDispatch;
  const cards: DispatchCardSpec[] = [
    {
      code: "ESQ",
      element: "Event Sequence Quantification",
      significance: dispatch?.eventSequenceQuantificationFeedback?.familyFeedback?.[0]?.riskSignificance ?? "MEDIUM",
      msg: dispatch?.eventSequenceQuantificationFeedback?.generalFeedback ?? "The family significance is dispatched back to the quantification.",
    },
    {
      code: "MS",
      element: "Mechanistic Source Term",
      significance: dispatch?.mechanisticSourceTermFeedback?.releaseCategoryFeedback?.[0]?.riskSignificance ?? "MEDIUM",
      msg: dispatch?.mechanisticSourceTermFeedback?.generalFeedback ?? "The release-category significance is dispatched back to the source term.",
    },
    {
      code: "RC",
      element: "Radiological Consequence",
      significance: dispatch?.radiologicalConsequenceFeedback?.metricFeedback?.[0]?.riskSignificance ?? "MEDIUM",
      msg: dispatch?.radiologicalConsequenceFeedback?.generalFeedback ?? "The metric significance is dispatched back to the consequence analysis.",
    },
    ...EXTRA_DISPATCH,
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Feedback dispatch</h3>
          <RiProvenanceChip>RI-D1</RiProvenanceChip>
        </div>
        <p className="poscard__sub">RI dispatches the risk significance back to every element it touches, the sending counterpart of the feedback every upstream element waits to receive.</p>
        <div className="rifeed">
          {cards.map((f) => {
            const sigCls = f.significance === "HIGH" ? "high" : f.significance === "MEDIUM" ? "medium" : "low";
            return (
              <div key={f.code} className="rifeed__card">
                <span className="rifeed__icon"><RIIcon.Send /></span>
                <div className="rifeed__main">
                  <div className="rifeed__el">
                    <span className="rifeed__el-name">{f.element}</span>
                    <span className="rifeed__el-code posmono">{f.code}</span>
                  </div>
                  <p className="rifeed__msg">{f.msg}</p>
                  <span className={`rifeed__sig rifeed__sig--${sigCls}`}><RIIcon.Gauge /> {SIG_LABELS[f.significance]} significance</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Refresh />
          <span>The dispatch closes the loop the whole standard has been building, eleven elements pointing at one total.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Documentation readiness</h3>
          <RiProvenanceChip>RI-D1 · D2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The documentation records the criteria, the results, the design-feature insights and the traceability to the contributors.</p>
        <div className="posfield-grid">
          <div className="posfield"><label className="posfield__label">Criteria and target</label><div style={{ fontSize: 12.5 }}>{ri.documentation.riskSignificanceCriteriaUsed}</div></div>
          <div className="posfield"><label className="posfield__label">Traceability</label><div style={{ fontSize: 12.5 }}>{ri.documentation.traceabilityToUpstreamContributions}</div></div>
          <div className="posfield"><label className="posfield__label">Design-feature insights</label><div style={{ fontSize: 12.5 }}>{ri.documentation.designFeatureInsights}</div></div>
          <div className="posfield"><label className="posfield__label">Model uncertainty</label><div style={{ fontSize: 12.5 }}>{ri.documentation.modelUncertaintySourcesDocumentation}</div></div>
        </div>
      </div>
    </>
  );
}

// ─── 07 — Draft (the RI report template) ───────────────────────────────────
function DraftScreen({ cc, scores, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  onSubmitDraft: () => void;
  canSubmit: boolean;
}): JSX.Element {
  const { ri } = useRiWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  const stage = ri.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(ri, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ri.name} — RI Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{ri.name}</h1>
        <h2>Preliminary Risk Integration</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {RI_TOC.map(([tt, p], i) => (
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
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 6 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><RIIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateRiReport(ri, false); }}><RIIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><RIIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer content (compiled family) ──────────────────────────────────────
function DrawerContent({ context, onClose }: { context: RiDrawerContext; onClose: () => void }): JSX.Element | null {
  const { ri } = useRiWorkbook();
  if (context.kind === "family") {
    const f = compiledById(ri, context.id);
    if (f === undefined) return null;
    const sig = familySignificance(ri, f.eventSequenceFamilyRef);
    const latent = consequenceOf(f, "Latent cancer risk");
    const dose = consequenceOf(f, "Site-boundary individual dose");
    const product = latent !== undefined ? f.frequency * latent : undefined;
    const freqBounds = lognormalBounds(f.frequencyDistribution);
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Compiled family</div>
            <h2 className="posdrawer__title">{FAMILY_NAMES[f.eventSequenceFamilyRef] ?? f.eventSequenceFamilyRef}</h2>
            <p className="posdrawer__sub">{f.eventSequenceFamilyRef}{f.releaseCategoryRef !== undefined ? ` · bounds ${f.releaseCategoryRef}` : ""} · {FAMILY_HAZARD[f.eventSequenceFamilyRef] ?? "Internal events"}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><RIIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Convergence summary</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{FAMILY_NOTES[f.eventSequenceFamilyRef] ?? "A compiled family with its two jaws."}</p>
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Release category</label><div className="posmono" style={{ fontWeight: 700 }}>{f.releaseCategoryRef ?? "n/a"}</div></div>
            <div className="posfield"><label className="posfield__label">Risk significance</label><div>{sig === "LOW" ? <Badge>Low</Badge> : sig === "MEDIUM" ? <Badge kind="warn">Medium</Badge> : <Badge kind="block">High</Badge>}</div></div>
          </div>
          <div>
            <div className="essec">Frequency and consequence</div>
            <table className="postable">
              <thead><tr><th>Jaw</th><th>Mean</th><th>Unit</th><th>90% interval</th></tr></thead>
              <tbody>
                <tr><td style={{ fontWeight: 600 }}>Frequency, from ESQ</td><td className="posmono" style={{ fontWeight: 700 }}>{valText(f.frequency)}</td><td className="posmono">per yr</td><td className="posmono">{freqBounds !== undefined ? `${valText(freqBounds.p05)} to ${valText(freqBounds.p95)}` : "n/a"}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Latent risk, from RC</td><td className="posmono" style={{ fontWeight: 700 }}>{valText(latent)}</td><td className="posmono">per event</td><td className="posmono">n/a</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Site-boundary dose, from RC</td><td className="posmono" style={{ fontWeight: 700 }}>{valText(dose)}</td><td className="posmono">Sv</td><td className="posmono">n/a</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Risk product</td><td className="posmono" style={{ fontWeight: 700 }}>{valText(product)}</td><td className="posmono">per yr</td><td className="posmono">n/a</td></tr>
              </tbody>
            </table>
          </div>
          <div className="posdrawer__srs">
            <span className="poschip posmono">RI-B1</span>
            <span className="poschip posmono">RI-B2</span>
            <span className="poschip posmono">RI-B6</span>
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
        <p className="hrempty__hint">This step is part of the Risk Integration workflow.</p>
      </div>
    </div>
  );
}

export { AggregateScreen, UncertaintyScreen, FeedbackScreen, DraftScreen, DrawerContent, PlaceholderScreen };
