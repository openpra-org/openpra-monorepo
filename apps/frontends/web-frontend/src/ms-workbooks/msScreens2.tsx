import { JSX } from "react";
import { type ReleasePhase, type SourceTermDefinition } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { MSIcon } from "./msIcons";
import { Badge, MsProvenanceChip, valText, fracText, pctText } from "./msShared";
import { useMsWorkbook } from "./msWorkbookContext";
import { MethodChips, type MsDrawerContext } from "./msScreens";
import { generateMsReport } from "./msDocx";
import {
  TIMING_LABELS,
  MAGNITUDE_LABELS,
  DIFFERENTIATION_LABELS,
  CALC_BASIS_LABELS,
  RELEASE_FORM_LABELS,
  MECHANISM_SIGNIFICANCE_LABELS,
  TRANSPORT_PHENOMENON_LABELS,
  ST_BASIS_LABELS,
  PASS_FRACTIONS,
  MODEL_METHOD,
  C_LADDER,
  D2_SPLIT,
  PA_SR,
  SS_SR,
  MS_TOC,
  type Stage,
  type CapabilityCategory,
} from "./msViewData";
import { categoryIsRiskSignificant, assignedFamilies, speciesTotals, phaseQuantity, lognormalBounds, type CcScore } from "./msSelectors";

// ─── 05 — Source Terms (HLR-C) ─────────────────────────────────────────────
function PhaseTimeline({ phases }: { phases: ReleasePhase[] }): JSX.Element {
  const max = Math.max(...phases.map((p) => p.endTime), 1);
  return (
    <div className="msterm__timeline">
      {phases.map((p) => {
        const left = (p.startTime / max) * 100;
        const width = ((p.endTime - p.startTime) / max) * 100;
        return (
          <div key={p.uuid} className="msterm__phase" style={{ left: `${left}%`, width: `${width}%` }}>
            <span className="msterm__phase-name">{p.name}</span>
            <span className="msterm__phase-time posmono">{p.startTime} to {p.endTime} {p.timeUnit}</span>
          </div>
        );
      })}
    </div>
  );
}

function SourceTermTable({ st }: { st: SourceTermDefinition }): JSX.Element {
  const totals = speciesTotals(st);
  return (
    <table className="postable msterm__table">
      <thead>
        <tr>
          <th>Species</th>
          {st.releasePhases.map((p) => <th key={p.uuid}>{p.name}</th>)}
          <th>Total fraction</th>
          <th>Form</th>
        </tr>
      </thead>
      <tbody>
        {st.releaseForms.map((r, i) => (
          <tr key={i}>
            <td className="posmono" style={{ fontWeight: 700 }}>{r.radionuclide}</td>
            {st.releasePhases.map((p) => <td key={p.uuid} className="posmono">{fracText(phaseQuantity(st, p.uuid, r.radionuclide))}</td>)}
            <td className="posmono" style={{ fontWeight: 700 }}>{fracText(totals.get(r.radionuclide))}</td>
            <td><span className={`msform msform--${r.form.toLowerCase()}`}>{RELEASE_FORM_LABELS[r.form] ?? r.form}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SourceTermScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms } = useMsWorkbook();
  function categoryName(ref: string): string {
    return ms.releaseCategories.find((r) => r.uuid === ref)?.name ?? ref;
  }
  function boundingSequence(ref: string): string {
    return ms.releaseCategories.find((r) => r.uuid === ref)?.boundingSequenceReference ?? "n/a";
  }
  const headline = ms.sourceTermDefinitions.find((s) => s.releaseCategoryReference === "RC-3") ?? ms.sourceTermDefinitions[0];
  const models = ms.sourceTermModels ?? [];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The calculation ladder</h3>
          <MsProvenanceChip>MS-C1 · C2 · C3</MsProvenanceChip>
        </div>
        <p className="poscard__sub">Risk-significance purchases mechanistic treatment, so the plant-specific calculation is performed for every category that could be risk-significant.</p>
        <div className="mssplit">
          <div className="mssplit__col">
            <span className="mssplit__cc mssplit__cc--i">CC-I</span>
            <div className="mssplit__title">{C_LADDER.cci.title}</div>
            <p className="mssplit__desc">{C_LADDER.cci.desc}</p>
            <span className="mssplit__tag" style={{ color: "var(--color-text-subtle)" }}><MSIcon.Doc /> {C_LADDER.cci.tag}</span>
          </div>
          <div className="mssplit__col mssplit__col--ii">
            <span className="mssplit__cc mssplit__cc--ii">CC-II</span>
            <div className="mssplit__title">{C_LADDER.ccii.title}</div>
            <p className="mssplit__desc">{C_LADDER.ccii.desc}</p>
            <span className="mssplit__tag"><MSIcon.Atom /> {C_LADDER.ccii.tag}</span>
          </div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Sparkle />
          <span>{C_LADDER.note}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Source terms</h3>
          <span className="possubtle">{ms.sourceTermDefinitions.length} categories · MS-C1, C3, C4</span>
        </div>
        <p className="poscard__sub">A source term is the complete description of the release, so each one carries its phases, its forms, its warning time, its energy and its elevation.</p>
        <div className="msterm">
          {ms.sourceTermDefinitions.map((s) => {
            const basis = ST_BASIS_LABELS[s.sourceTermBasis];
            const methodId = MODEL_METHOD[s.sourceTermModelRefs?.[0] ?? ""] ?? "transport";
            return (
              <div key={s.uuid} className="msterm__card" onClick={() => openDrawer({ kind: "sourceterm", id: s.uuid })}>
                <div className="msterm__head">
                  <div className="msterm__head-main">
                    <div className="msterm__name">{categoryName(s.releaseCategoryReference)}</div>
                    <div className="msterm__ref posmono">{s.releaseCategoryReference} · bounds {boundingSequence(s.releaseCategoryReference)}</div>
                  </div>
                  <span className={`msterm__basis msterm__basis--${basis?.kind ?? "generic"}`}>
                    {basis?.kind === "mechanistic" ? <MSIcon.Atom /> : <MSIcon.Doc />} {basis?.label ?? s.sourceTermBasis}
                  </span>
                </div>
                <PhaseTimeline phases={s.releasePhases} />
                <div className="msterm__attrs">
                  {s.warningTimeForEvacuation !== undefined && <div className="msterm__attr"><MSIcon.Clock /><span>{s.warningTimeForEvacuation}</span></div>}
                  {s.releaseEnergy !== undefined && <div className="msterm__attr"><MSIcon.Thermo /><span>{s.releaseEnergy.quantity} {s.releaseEnergy.unit}</span></div>}
                  {s.releaseElevation !== undefined && <div className="msterm__attr"><MSIcon.Ruler /><span>{s.releaseElevation.quantity} {s.releaseElevation.unit}</span></div>}
                </div>
                <div className="msterm__foot">
                  <MethodChips ids={[methodId]} label="Calculated by" />
                  {s.riskSignificantCategoryCalculationConfirmed === true && <span className="msterm__rs">Risk-significant confirmed</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {headline !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Quantitative source-term table</h3>
            <MsProvenanceChip>MS-E2</MsProvenanceChip>
          </div>
          <p className="poscard__sub">The documentation deliverable is the table itself, here for {categoryName(headline.releaseCategoryReference)}, by species, phase and form.</p>
          <SourceTermTable st={headline} />
          <div className="hrnote" style={{ marginTop: 12 }}>
            <MSIcon.Dust />
            <span>{headline.particleSizeDistribution?.description} The consequence analysis takes the table, and risk integration multiplies the frequency by what it computes.</span>
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Source-term models</h3>
          <MsProvenanceChip>MS-C5</MsProvenanceChip>
        </div>
        <p className="poscard__sub">The calculation runs in validated codes within their applicability limits, with the roles named rather than any product.</p>
        <div className="msmodel">
          {models.map((m) => (
            <div key={m.uuid} className="msmodel__card">
              <div className="msmodel__head">
                <span className="msmodel__icon"><MSIcon.Cpu /></span>
                <div className="msmodel__head-main">
                  <div className="msmodel__name">{m.name}</div>
                  <div className="msmodel__role">{m.technicalBasis}</div>
                </div>
                <span className="msmodel__vv"><MSIcon.Verified /> {m.validationStatus}</span>
              </div>
              <div className="msmodel__limits">
                {(m.applicabilityLimits ?? []).map((l, i) => (
                  <div key={i} className="msmodel__limit"><MSIcon.Tag /> {l}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 06 — Uncertainty & Pre-op (HLR-D closeout) ────────────────────────────
function UncertScreen({ stage }: { stage: Stage }): JSX.Element {
  const { ms } = useMsWorkbook();
  const propagated = ms.uncertaintyAnalyses.filter((u) => u.characterizationLevel === "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES");
  const modelUncertainties = ms.modelUncertaintyAssessments ?? [];
  const register: { type: string; tone: string; item: string; detail: string; srs: string }[] = [
    ...modelUncertainties.map((u) => ({ type: "Uncertainty", tone: "progress", item: u.uncertaintySource, detail: u.consequenceEffect, srs: u.implementsSrs.map((s) => s.sr).join(", ") })),
    ...(ms.preOperationalAssumptions ?? []).map((a) => ({ type: "Pre-op", tone: "warn", item: a.influenceOnDefinition, detail: a.description, srs: PA_SR[a.assumptionId] ?? "MS-B7" })),
    ...(ms.sensitivityStudies ?? []).map((s) => ({ type: "Sensitivity", tone: "", item: s.name ?? "Sensitivity study", detail: s.results ?? "", srs: SS_SR[s.uuid] ?? "MS-D3" })),
  ];
  function categoryName(ref: string): string {
    return ms.releaseCategories.find((r) => r.uuid === ref)?.name ?? ref;
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The uncertainty fork</h3>
          <MsProvenanceChip>MS-D2</MsProvenanceChip>
        </div>
        <p className="poscard__sub">A point estimate with the uncertainty characterized, or a mean with a probabilistic representation for the categories tied to risk-significant families.</p>
        <div className="mssplit">
          <div className="mssplit__col">
            <span className="mssplit__cc mssplit__cc--i">CC-I</span>
            <div className="mssplit__title">{D2_SPLIT.cci.title}</div>
            <p className="mssplit__desc">{D2_SPLIT.cci.desc}</p>
            <span className="mssplit__tag" style={{ color: "var(--color-text-subtle)" }}><MSIcon.Hash /> {D2_SPLIT.cci.tag}</span>
          </div>
          <div className="mssplit__col mssplit__col--ii">
            <span className="mssplit__cc mssplit__cc--ii">CC-II</span>
            <div className="mssplit__title">{D2_SPLIT.ccii.title}</div>
            <p className="mssplit__desc">{D2_SPLIT.ccii.desc}</p>
            <span className="mssplit__tag"><MSIcon.Curve /> {D2_SPLIT.ccii.tag}</span>
          </div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Person />
          <span>{D2_SPLIT.note}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Phenomena-dependency propagation</h3>
          <MsProvenanceChip>MS-D4</MsProvenanceChip>
        </div>
        <p className="poscard__sub">If one piece of physics is uncertain, everything downstream is uncertain together, so the correlated phenomena are sampled together.</p>
        <div className="msprop">
          {propagated.map((u) => {
            const ci = u.uncertaintyPropagationResults?.confidenceIntervals?.[0];
            return (
              <div key={u.uuid} className="msprop__card">
                <div className="msprop__head">
                  <span className="msprop__cat">{u.releaseCategoryReference}</span>
                  <span className="msprop__cat-name">{categoryName(u.releaseCategoryReference)}</span>
                  {u.componentEstimates.some((c) => c.isRiskSignificantFamily) && <span className="msterm__rs">Risk-significant</span>}
                </div>
                <div className="msprop__deps">
                  {(u.phenomenaDependencies ?? []).map((d, i) => (
                    <div key={i} className="msprop__dep">
                      <div className="msprop__dep-chain">
                        {d.dependentPhenomena.map((p, j) => (
                          <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span className="msprop__dep-node">{p}</span>
                            {j < d.dependentPhenomena.length - 1 && <span className="msprop__dep-link"><MSIcon.Link /></span>}
                          </span>
                        ))}
                      </div>
                      <p className="msprop__dep-desc">{d.description}</p>
                    </div>
                  ))}
                </div>
                <div className="msprop__components">
                  {u.componentEstimates.map((c, i) => {
                    const bounds = lognormalBounds(c.distribution);
                    return (
                      <div key={i} className="msprop__comp">
                        <span className="msprop__comp-name">{c.component}</span>
                        {c.probabilisticRepresentationProvided === true && bounds !== undefined ? (
                          <div className="msprop__comp-dist">
                            <span className="msprop__comp-p posmono">{fracText(bounds.p05)}</span>
                            <span className="msprop__comp-bar"><span className="msprop__comp-bar-mean" /></span>
                            <span className="msprop__comp-p posmono">{fracText(bounds.p95)}</span>
                            <span className="msprop__comp-mean posmono">mean {fracText(bounds.mean)}</span>
                          </div>
                        ) : (
                          <span className="msprop__comp-point posmono">point estimate</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {ci !== undefined && (
                  <div className="msprop__ci">
                    <MSIcon.Curve />
                    <span>{u.uncertaintyPropagationResults?.resultSummary} The {ci.level}% interval spans {fracText(ci.lowerBound)} to {fracText(ci.upperBound)}.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <MSIcon.Sparkle />
          <span>This is the correlated-parameter idea transposed to correlated phenomena, where the dependence between uncertain physics is carried forward, not dropped.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Model-uncertainty sources</h3>
          <MsProvenanceChip>MS-C6 · MS-D3</MsProvenanceChip>
        </div>
        <p className="poscard__sub">The consequence effects of the barrier and source-term model uncertainties are assessed, individually or in combination.</p>
        <div className="hrtheme">
          {modelUncertainties.map((u) => (
            <div key={u.uuid} className="hrtheme__cell">
              <span className="hrtheme__sr posmono">{u.evaluationType === "QUANTITATIVE" ? "Quant" : "Qual"}</span>
              <span className="hrtheme__t">{u.uncertaintySource}. {u.consequenceEffect}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <span className="possubtle">{register.length} items · MS-B6, C6, D3, E1, E4</span>
        </div>
        <p className="poscard__sub">The uncertainty sources, the sensitivity studies and the pre-operational assumptions feed the documentation.</p>
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
        <div className="msmetric">
          <span className="msmetric__icon"><MSIcon.Gauge /></span>
          <div className="msmetric__main">
            <div className="msmetric__title">Surrogate risk metric</div>
            <p className="msmetric__body">{ms.documentation.surrogateRiskMetrics}</p>
          </div>
        </div>
        {stage === "pre_operational" && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <MSIcon.Lock />
            <span>Three pre-operational assumptions fork here, in the barriers, the source term and the documentation, since the physics is design-driven.</span>
          </div>
        )}
      </div>
    </>
  );
}

// ─── 07 — Draft (the report template) ──────────────────────────────────────
function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: { cc: CapabilityCategory; scores: CcScore; stage: Stage; onSubmitDraft: () => void; canSubmit: boolean }): JSX.Element {
  const { ms } = useMsWorkbook();
  const ready = scores.blocked === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(ms, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ms.name} — MS Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{ms.name}</h1>
        <h2>Preliminary Mechanistic Source Term Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {MS_TOC.map(([tt, p], i) => (
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
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 6 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><MSIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateMsReport(ms, ready); }}><MSIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><MSIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer content (category / inventory / barrier / source term) ─────────
function DrawerContent({ context, onClose }: { context: MsDrawerContext; onClose: () => void }): JSX.Element | null {
  const { ms } = useMsWorkbook();

  if (context.kind === "category") {
    const r = ms.releaseCategories.find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Release category</div>
            <h2 className="posdrawer__title">{r.name}</h2>
            <p className="posdrawer__sub">{r.uuid}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><MSIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Definition</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{r.description}</p>
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Timing</label><div style={{ fontWeight: 700, fontSize: 12.5 }}>{r.timingClassification ?? "n/a"}</div></div>
            <div className="posfield"><label className="posfield__label">Magnitude</label><div style={{ fontWeight: 700, fontSize: 12.5 }}>{r.magnitudeClassification ?? "n/a"}</div></div>
            <div className="posfield"><label className="posfield__label">Headline release fraction</label><div className="posmono" style={{ fontWeight: 700 }}>{fracText(headlineFor(r.uuid))}</div></div>
            <div className="posfield"><label className="posfield__label">Risk significance</label><div>{categoryIsRiskSignificant(r) ? <Badge kind="progress">Risk-significant</Badge> : <Badge>Not significant</Badge>}</div></div>
          </div>
          <div>
            <div className="essec">Bounding sequence</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-text-muted)", margin: 0 }}>{r.boundingSequenceReference}. {r.boundingSequenceJustification}</p>
          </div>
          <div>
            <div className="essec">Release-termination time</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-text-muted)", margin: 0 }}>{r.releaseTerminationTime.value} {r.releaseTerminationTime.unit}. {r.releaseTerminationTime.justification}</p>
          </div>
          <div>
            <div className="essec">Families assigned</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {assignedFamilies(r).map((f) => <span key={f} className="poschip posmono">{f}</span>)}
            </div>
          </div>
          <div>
            <div className="essec">Differentiation basis</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-text-muted)", margin: 0 }}>{DIFFERENTIATION_LABELS[r.differentiationBasis]}. {r.technicalBasis}</p>
          </div>
          <div className="posdrawer__srs">{r.implementsSrs.map((s) => <span key={s.sr} className="poschip posmono">{s.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "inventory") {
    const s = ms.sourceInventories.find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Source inventory</div>
            <h2 className="posdrawer__title">{s.name}</h2>
            <p className="posdrawer__sub">{s.radioactiveSourceRef} · {CALC_BASIS_LABELS[s.calculationBasis]}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><MSIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Description</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{s.description}</p>
          </div>
          <div>
            <div className="essec">Radionuclide inventory</div>
            <table className="postable">
              <thead><tr><th>Species</th><th>Quantity</th><th>Physical form</th><th>Chemical form</th></tr></thead>
              <tbody>
                {s.inventory.map((r, i) => (
                  <tr key={i}>
                    <td className="posmono" style={{ fontWeight: 700 }}>{r.radionuclide}</td>
                    <td className="posmono">{valText(r.quantity)} {r.unit}</td>
                    <td><span className={`msform msform--${(r.physicalForm ?? "OTHER").toLowerCase()}`}>{RELEASE_FORM_LABELS[r.physicalForm ?? "OTHER"] ?? r.physicalForm}</span></td>
                    <td className="possubtle" style={{ fontSize: 12 }}>{r.chemicalForm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="essec">Basis</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-text-muted)", margin: 0 }}>{s.inventoryDataSource} {s.radionuclideSelectionBasis}</p>
          </div>
          <div className="posdrawer__srs">{s.implementsSrs.map((x) => <span key={x.sr} className="poschip posmono">{x.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "barrier") {
    const b = ms.transportBarrierAssessments.find((x) => x.uuid === context.id);
    if (b === undefined) return null;
    const transport = b.transportCharacteristics[0];
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Transport barrier</div>
            <h2 className="posdrawer__title">{b.name}</h2>
            <p className="posdrawer__sub">{b.barrierType} · passes {pctText(PASS_FRACTIONS[b.uuid] ?? 1.0)}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><MSIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          {transport !== undefined && (
            <div>
              <div className="essec">Transport characteristics</div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{transport.description} {transport.retentionEffectiveness}</p>
            </div>
          )}
          <div>
            <div className="essec">Failure modes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(b.failureModes ?? []).map((m, i) => <div key={i} className="msbar__mode"><MSIcon.Warn /> {m}</div>)}
            </div>
          </div>
          {b.physicalChemicalConditions !== undefined && (
            <div>
              <div className="essec">Physical and chemical conditions</div>
              <div className="posfield-grid">
                <div className="posfield"><label className="posfield__label">Temperature</label><div style={{ fontSize: 12.5 }}>{b.physicalChemicalConditions.temperature ?? "n/a"}</div></div>
                <div className="posfield"><label className="posfield__label">Chemical environment</label><div style={{ fontSize: 12.5 }}>{b.physicalChemicalConditions.chemicalEnvironment ?? "n/a"}</div></div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Impact on transport</label><div style={{ fontSize: 12.5 }}>{b.physicalChemicalConditions.impactOnTransport}</div></div>
              </div>
            </div>
          )}
          <div>
            <div className="essec">Transport mechanisms</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {(b.transportMechanisms ?? []).map((m, i) => (
                <span key={i} className={`msbar__mech msbar__mech--${m.significance.toLowerCase()}`}>
                  {TRANSPORT_PHENOMENON_LABELS[m.mechanismType] ?? m.mechanismType} · {MECHANISM_SIGNIFICANCE_LABELS[m.significance] ?? m.significance}
                </span>
              ))}
            </div>
          </div>
          {transport?.affectedRadionuclides !== undefined && (
            <div>
              <div className="essec">Affected species</div>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                {transport.affectedRadionuclides.map((a, i) => <span key={i} className="poschip posmono">{a}</span>)}
              </div>
            </div>
          )}
          <div className="posdrawer__srs">{b.implementsSrs.map((s) => <span key={s.sr} className="poschip posmono">{s.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "sourceterm") {
    const s = ms.sourceTermDefinitions.find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    const basis = ST_BASIS_LABELS[s.sourceTermBasis];
    const categoryName = ms.releaseCategories.find((r) => r.uuid === s.releaseCategoryReference)?.name ?? s.releaseCategoryReference;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Source term</div>
            <h2 className="posdrawer__title">{categoryName}</h2>
            <p className="posdrawer__sub">{s.releaseCategoryReference} · {basis?.label ?? s.sourceTermBasis}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><MSIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          {s.sourceTermBasis === "GENERIC_APPLICABLE" && (
            <div>
              <div className="essec">Generic applicability</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-text-muted)", margin: "0 0 8px" }}>{s.genericApplicabilityJustification}</p>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                {(s.postProcessingModifications ?? []).map((p, i) => <span key={i} className="poschip"><MSIcon.Wrench /> {p}</span>)}
              </div>
            </div>
          )}
          <div>
            <div className="essec">Release by species and phase</div>
            <SourceTermTable st={s} />
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Particle size</label><div style={{ fontSize: 12.5 }}>{s.particleSizeDistribution?.description ?? "n/a"}</div></div>
            <div className="posfield"><label className="posfield__label">Warning time</label><div style={{ fontSize: 12.5 }}>{s.warningTimeForEvacuation ?? "n/a"}</div></div>
            <div className="posfield"><label className="posfield__label">Thermal energy</label><div className="posmono">{s.releaseEnergy !== undefined ? `${s.releaseEnergy.quantity} ${s.releaseEnergy.unit}` : "n/a"}</div></div>
            <div className="posfield"><label className="posfield__label">Release elevation</label><div className="posmono">{s.releaseElevation !== undefined ? `${s.releaseElevation.quantity} ${s.releaseElevation.unit}` : "n/a"}</div></div>
          </div>
          <div className="posdrawer__srs">{s.implementsSrs.map((x) => <span key={x.sr} className="poschip posmono">{x.sr}</span>)}</div>
        </div>
      </>
    );
  }

  return null;

  function headlineFor(categoryUuid: string): number | undefined {
    const st = ms.sourceTermDefinitions.find((x) => x.releaseCategoryReference === categoryUuid);
    if (st === undefined) return undefined;
    const totals = speciesTotals(st);
    return totals.get("Cs-137") ?? (st.releaseForms[0] !== undefined ? totals.get(st.releaseForms[0].radionuclide) : undefined);
  }
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return (
    <div className="poscard">
      <div className="hrempty">
        <div className="hrempty__title">{label}</div>
        <p className="hrempty__hint">This step is part of the Mechanistic Source Term Analysis workflow.</p>
      </div>
    </div>
  );
}

export { SourceTermScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };
