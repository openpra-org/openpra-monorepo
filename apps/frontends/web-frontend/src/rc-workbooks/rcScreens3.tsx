import { JSX } from "react";
import { RCIcon } from "./rcIcons";
import { Badge, RcProvenanceChip, valText } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import { generateRcReport } from "./rcDocx";
import {
  RC_CODE_ICONS,
  UNCERTAINTY_SOURCES,
  RISK_SIGNIFICANCE_LABELS,
  MU_SR,
  BS_SR,
  SS_SR,
  SURROGATE_METRIC_NOTE,
  RC_TOC,
  type CapabilityCategory,
  type SiteBasis,
} from "./rcViewData";
import { lognormalBounds, type CcScore } from "./rcSelectors";
import { type RcDrawerContext } from "./rcScreens";

// ─── 08 — Quantification (RCQ) ─────────────────────────────────────────────
function QuantifyScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc } = useRcWorkbook();
  const q = rc.consequenceQuantification;
  const headlineFamily = q.eventSequenceConsequences[0];
  const headlineResult = headlineFamily?.consequenceResults[0];
  const headlineBounds = lognormalBounds(headlineResult?.uncertaintyDistribution);
  const register: { type: string; tone: string; item: string; detail: string; srs: string }[] = [
    ...q.modelUncertaintyAssessments.map((u) => ({ type: "Uncertainty", tone: "progress", item: u.uncertaintySource, detail: u.effectOnMetrics, srs: `${MU_SR[u.sourceSubElement] ?? "RCQ-C1"}, RCQ-C1` })),
    ...(rc.boundingSiteAssumptions ?? []).map((a) => ({ type: "Bounding site", tone: "warn", item: a.influenceOnDefinition, detail: a.description, srs: BS_SR[a.assumptionId] ?? "RCRE-A1" })),
    ...(rc.sensitivityStudies ?? []).map((s) => ({ type: "Sensitivity", tone: "", item: s.name ?? "Sensitivity study", detail: s.results ?? "", srs: SS_SR[s.uuid] ?? "RCQ-D2" })),
  ];

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consequence codes</h3>
          <RcProvenanceChip>RCQ-A1 · A2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The codes are demonstrated against accepted algorithms, with the roles named rather than any product.</p>
        <div className="rccode">
          {q.consequenceCodesUsed.map((c) => {
            const Icon = RCIcon[RC_CODE_ICONS[c.code] ?? "Cpu"] ?? RCIcon.Cpu;
            const limits = q.modelAndCodeLimitations.filter((l) => l.code === c.code);
            return (
              <div key={c.code} className="rccode__card">
                <span className="rccode__icon"><Icon /></span>
                <div className="rccode__main">
                  <div className="rccode__name">{c.code}</div>
                  <div className="rccode__role">{limits[0]?.limitation ?? "Runs the consequence chain."}</div>
                  {c.benchmarkBasis !== undefined && <div className="rccode__bench"><RCIcon.Verified /> {c.benchmarkBasis}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Cpu />
          <span>The method-specific features and limits are identified, {q.modelAndCodeLimitations.map((l) => l.feature.toLowerCase()).join(", ")}.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consequence table</h3>
          <RcProvenanceChip>RCQ-A3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The deliverable is the list of event sequence families and their radiological consequences, the table RI pairs with the ESQ frequency.</p>
        <div className="rcfamily">
          {q.eventSequenceConsequences.map((f) => {
            const sig = f.riskSignificance ?? "LOW";
            const sigClass = sig === "LOW" ? "low" : "high";
            return (
              <div key={f.eventSequenceFamily} className="rcfamily__card" onClick={() => openDrawer({ kind: "family", id: f.eventSequenceFamily })}>
                <div className="rcfamily__head">
                  <div className="rcfamily__head-main">
                    <div className="rcfamily__id posmono">{f.eventSequenceFamily}{f.releaseCategoryReference !== undefined ? ` · bounds ${f.releaseCategoryReference}` : ""}</div>
                    <div className="rcfamily__name">{f.sourceTermReference !== undefined ? `Source term ${f.sourceTermReference}` : "Event sequence family"}</div>
                  </div>
                  <span className={`rcfamily__sig rcfamily__sig--${sigClass}`}>{RISK_SIGNIFICANCE_LABELS[sig] ?? sig}</span>
                </div>
                <div className="rcfamily__metrics">
                  {f.consequenceResults.map((m, i) => {
                    const bounds = lognormalBounds(m.uncertaintyDistribution);
                    return (
                      <div key={i} className="rcfamily__metric">
                        <span className="rcfamily__metric-k">{m.metric}</span>
                        <div className="rcfamily__metric-vrow">
                          <span className="rcfamily__metric-v posmono">{valText(m.meanValue)}</span>
                          <span className="rcfamily__metric-u">{m.unit ?? ""}</span>
                          {bounds !== undefined && <span className="rcfamily__metric-ci">{valText(bounds.p05)} to {valText(bounds.p95)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Gauge />
          <span>RC computes the consequence side, and RI clamps this table against the ESQ frequency to form the frequency-consequence point.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Output review</h3>
          <RcProvenanceChip>RCQ-B1 · B2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The output files are scanned for error statements and silent zeros, then the results are confirmed against expectation.</p>
        <div className="rcgrid--2">
          {(q.outputReview.acceptanceJustifications ?? []).map((note, i) => (
            <div key={i} className="rccard rccard--credit">
              <div className="posrow" style={{ gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>{i === 0 ? "Error statements in the output files" : "Unexpected zeros in the results"}</span>
                <span className="posbadge posbadge--ok"><span className="posbadge__dot" />Clear</span>
              </div>
              <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>{note}</p>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Search />
          <span>{q.resultsConfirmation.description ?? "The results are confirmed against expectation."}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-significant contributors</h3>
          <RcProvenanceChip>RCQ-B3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The risk-significant contributors are identified per HLR-RI-B, the handshake from the consequence side.</p>
        <div className="rccontrib">
          {(q.riskSignificantContributors ?? []).map((c, i) => (
            <div key={c.contributor} className="rccontrib__row">
              <span className="rccontrib__rank posmono">{i + 1}</span>
              <div className="rccontrib__main">
                <div className="rccontrib__name">{c.contributor}</div>
                <div className="rccontrib__basis">{c.basisPerRiB}</div>
              </div>
              <span className="rccontrib__imp">{RISK_SIGNIFICANCE_LABELS[c.significance ?? "MEDIUM"] ?? "Medium"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The uncertainty funnel</h3>
          <RcProvenanceChip>RCQ-C1 · C2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The model uncertainties from every sub-element funnel into the uncertainty distribution of each consequence metric.</p>
        <div className="rcfunnel">
          <div className="rcfunnel__sources">
            {UNCERTAINTY_SOURCES.map((s) => (
              <span key={s.se} className={`rcfunnel__src rcfunnel__src--${s.tone}`} title={`${s.source} · ${s.srs}`}>{s.se}</span>
            ))}
          </div>
          <div className="rcfunnel__arrow"><RCIcon.ArrowR /></div>
          <div className="rcfunnel__out">
            <span className="rcfunnel__out-cap">{headlineResult !== undefined && headlineFamily !== undefined ? `${headlineResult.metric} for ${headlineFamily.releaseCategoryReference ?? headlineFamily.eventSequenceFamily}` : "Headline metric"}</span>
            <div className="rcfunnel__dist"><span className="rcfunnel__dist-mean" /></div>
            <div className="rcfunnel__scale">
              <span>{valText(headlineBounds?.p05)}</span>
              <span>mean {valText(headlineResult?.meanValue)}</span>
              <span>{valText(headlineBounds?.p95)}</span>
            </div>
            <span className="rcfunnel__level"><RCIcon.Curve /> {q.uncertaintyCharacterization.level === "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES" ? "Propagated with phenomena dependencies" : "Characterized"}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {(q.uncertaintyCharacterization.phenomenaDependencies ?? []).map((d, i) => (
            <div key={i} className="rccard" style={{ background: "var(--color-surface-low)", padding: "10px 13px", gap: 6 }}>
              <div className="posrow" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {d.dependentPhenomena.map((p, j) => (
                  <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span className="rcse rcse--credit">{p}</span>
                    {j < d.dependentPhenomena.length - 1 && <span style={{ color: "var(--rc-credit)", display: "inline-flex" }}><RCIcon.Link /></span>}
                  </span>
                ))}
              </div>
              <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>{d.description} {d.treatmentMethod}</p>
            </div>
          ))}
        </div>
        {headlineBounds !== undefined && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <RCIcon.Sparkle />
            <span>The 90 percent interval for the early-release latent risk spans {valText(headlineBounds.p05)} to {valText(headlineBounds.p95)} per event.</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <span className="possubtle">{register.length} items · RCQ-C1, D2 and the bounding-site assumptions</span>
        </div>
        <p className="poscard__sub">The model uncertainties, the bounding-site assumptions and the sensitivity studies feed the documentation.</p>
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
        <div className="rcmetric">
          <span className="rcmetric__icon"><RCIcon.Gauge /></span>
          <div className="rcmetric__main">
            <div className="rcmetric__title">Frequency-consequence target</div>
            <p className="rcmetric__body">{SURROGATE_METRIC_NOTE}</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── 09 — Draft (the report template) ──────────────────────────────────────
function DraftScreen({ cc, scores, site, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  site: SiteBasis;
  onSubmitDraft: () => void;
  canSubmit: boolean;
}): JSX.Element {
  const { rc } = useRcWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(rc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${rc.name} — RC Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{rc.name}</h1>
        <h2>Preliminary Radiological Consequence Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {RC_TOC.map(([tt, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{tt}</span><span>{p}</span></div>
          ))}
        </div>
      </div>

      <div className="posgen__side">
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Conformance check</h3>
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Site basis</span><span style={{ fontWeight: 700 }}>{site === "actual_site" ? "Identified site" : "Bounding site"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable, site</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 8 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><RCIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateRcReport(rc, false); }}><RCIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><RCIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer content (consequence family) ───────────────────────────────────
function DrawerContent({ context, onClose }: { context: RcDrawerContext; onClose: () => void }): JSX.Element | null {
  const { rc } = useRcWorkbook();

  if (context.kind === "family") {
    const f = rc.consequenceQuantification.eventSequenceConsequences.find((x) => x.eventSequenceFamily === context.id);
    if (f === undefined) return null;
    const sig = f.riskSignificance ?? "LOW";
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Event sequence family</div>
            <h2 className="posdrawer__title">{f.eventSequenceFamily}</h2>
            <p className="posdrawer__sub">{f.releaseCategoryReference !== undefined ? `bounds ${f.releaseCategoryReference}` : ""}{f.sourceTermReference !== undefined ? ` · ${f.sourceTermReference}` : ""}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><RCIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Consequence summary</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>
              {f.consequenceResults[0]?.uncertaintyDescription ?? "The consequence is quantified per family for the chosen metric set."}
            </p>
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Release category</label><div className="posmono" style={{ fontWeight: 700 }}>{f.releaseCategoryReference ?? "n/a"}</div></div>
            <div className="posfield"><label className="posfield__label">Risk significance</label><div>{sig === "LOW" ? <Badge>Low</Badge> : <Badge kind="progress">{RISK_SIGNIFICANCE_LABELS[sig] ?? sig}</Badge>}</div></div>
          </div>
          <div>
            <div className="essec">Consequence metrics</div>
            <table className="postable">
              <thead><tr><th>Metric</th><th>Mean</th><th>Unit</th><th>90% interval</th></tr></thead>
              <tbody>
                {f.consequenceResults.map((m, i) => {
                  const bounds = lognormalBounds(m.uncertaintyDistribution);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{m.metric}</td>
                      <td className="posmono" style={{ fontWeight: 700 }}>{valText(m.meanValue)}</td>
                      <td className="posmono">{m.unit ?? ""}</td>
                      <td className="posmono">{bounds !== undefined ? `${valText(bounds.p05)} to ${valText(bounds.p95)}` : "n/a"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="posdrawer__srs">
            <span className="poschip posmono">RCQ-A3</span>
            <span className="poschip posmono">RCQ-B3</span>
            <span className="poschip posmono">RCQ-C2</span>
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
        <p className="hrempty__hint">This step is part of the Radiological Consequence Analysis workflow.</p>
      </div>
    </div>
  );
}

export { QuantifyScreen, DraftScreen, DrawerContent, PlaceholderScreen };
