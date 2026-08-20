import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { type ReleasePhase, type SourceTermDefinition, TransportPhenomenonType } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { DistributionType } from "interfaces-mef-types/core/events";
import { MSIcon } from "./msIcons";
import { MsProvenanceChip, fracText } from "./msShared";
import { useMsWorkbook } from "./msWorkbookContext";
import { MethodChips, type MsDrawerContext } from "./msScreens";
import { generateMsReport } from "./msDocx";
import {
  RELEASE_FORM_LABELS,
  TRANSPORT_PHENOMENON_LABELS,
  ST_BASIS_LABELS,
  MODEL_METHOD,
  MS_TOC,
  type Stage,
  type CapabilityCategory,
} from "./msViewData";
import { speciesTotals, phaseQuantity, lognormalBounds, type CcScore } from "./msSelectors";

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
          <th>Chemical form</th>
        </tr>
      </thead>
      <tbody>
        {st.releaseForms.map((r, i) => (
          <tr key={i}>
            <td className="posmono" style={{ fontWeight: 700 }}>{r.radionuclide}</td>
            {st.releasePhases.map((p) => <td key={p.uuid} className="posmono">{fracText(phaseQuantity(st, p.uuid, r.radionuclide))}</td>)}
            <td className="posmono" style={{ fontWeight: 700 }}>{fracText(totals.get(r.radionuclide))}</td>
            <td><span className={`msform msform--${r.form.toLowerCase()}`}>{RELEASE_FORM_LABELS[r.form] ?? r.form}</span></td>
            <td className="possubtle" style={{ fontSize: 12 }}>{r.chemicalForm ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SourceTermScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms, editable, mutateMs } = useMsWorkbook();
  function categoryName(ref: string): string {
    return ms.releaseCategories.find((r) => r.uuid === ref)?.name ?? ref;
  }
  function boundingSequence(ref: string): string {
    return ms.releaseCategories.find((r) => r.uuid === ref)?.boundingSequenceReference ?? "n/a";
  }
  const headline = [...ms.sourceTermDefinitions]
    .map((s) => ({ s, cs: speciesTotals(s).get("Cs-137") ?? 0 }))
    .sort((a, b) => b.cs - a.cs)[0]?.s ?? ms.sourceTermDefinitions[0];
  const models = ms.sourceTermModels ?? [];
  function addSourceTerm(): void {
    const n = ms.sourceTermDefinitions.reduce((m, s) => { const v = Number(s.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `ST-${String(n)}`;
    mutateMs((d) => ({ ...d, sourceTermDefinitions: [...d.sourceTermDefinitions, { uuid, releaseCategoryReference: d.releaseCategories[0]?.uuid ?? "", sourceTermBasis: "PLANT_SPECIFIC_MECHANISTIC", riskSignificantCategoryCalculationConfirmed: false, releasePhases: [], radionuclideReleases: [], releaseForms: [], sourceTermModelRefs: [], implementsSrs: [{ sr: "MS-C1", hlr: "C" }, { sr: "MS-C3", hlr: "C" }, { sr: "MS-E2", hlr: "E" }] }] }));
    openDrawer({ kind: "sourceterm", id: uuid });
  }
  function addModel(): void {
    const n = models.reduce((m, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `MOD-${String(n)}`;
    mutateMs((d) => ({ ...d, sourceTermModels: [...(d.sourceTermModels ?? []), { uuid, name: "New model", version: "", technicalBasis: "", validationStatus: "Not validated", applicabilityLimits: [], implementsSrs: [{ sr: "MS-C5", hlr: "C" }] }] }));
    openDrawer({ kind: "model", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="MS" title="Source terms" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-C1 · C3 · C4</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSourceTerm}><MSIcon.Plus /> Add source term</button>}
          </div>
        </div>
        <p className="poscard__sub">A source term is the complete description of the release, so each one carries its phases, its forms, its warning time, its energy and its elevation. Select a card to edit it.</p>
        {ms.sourceTermDefinitions.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No source terms yet. Add one to calculate the release for a category, by species, phase and form.</p>
        ) : (
        <div className="msterm">
          {ms.sourceTermDefinitions.map((s) => {
            const basis = ST_BASIS_LABELS[s.sourceTermBasis];
            const modelRef = s.sourceTermModelRefs?.[0] ?? "";
            const methodId = MODEL_METHOD[modelRef];
            const hasFoot = (s.sourceTermModelRefs ?? []).length > 0 || s.riskSignificantCategoryCalculationConfirmed === true;
            return (
              <div key={s.uuid} className="msterm__card" onClick={() => openDrawer({ kind: "sourceterm", id: s.uuid })}>
                <div className="msterm__head">
                  <div className="msterm__head-main">
                    <div className="msterm__name">{categoryName(s.releaseCategoryReference)}</div>
                    <div className="msterm__ref posmono">{s.releaseCategoryReference} · bounds {boundingSequence(s.releaseCategoryReference)}</div>
                  </div>
                  <span className={`msterm__basis msterm__basis--${basis?.kind ?? "generic"}`}>
                    {basis?.label ?? s.sourceTermBasis}
                  </span>
                </div>
                {s.releasePhases.length > 0 && <PhaseTimeline phases={s.releasePhases} />}
                <div className="msterm__attrs">
                  {(s.warningTimeForEvacuation ?? "").length > 0 && <div className="msterm__attr"><span>{s.warningTimeForEvacuation}</span></div>}
                  {s.releaseEnergy !== undefined && <div className="msterm__attr"><span>{s.releaseEnergy.quantity} {s.releaseEnergy.unit}</span></div>}
                  {s.releaseElevation !== undefined && <div className="msterm__attr"><span>{s.releaseElevation.quantity} {s.releaseElevation.unit}</span></div>}
                </div>
                {hasFoot && (
                  <div className="msterm__foot">
                    {methodId !== undefined && <MethodChips ids={[methodId]} label="Calculated by" />}
                    {(s.sourceTermModelRefs ?? []).length > 0 && methodId === undefined && <span className="possubtle" style={{ fontSize: 11 }}>Models {(s.sourceTermModelRefs ?? []).join(", ")}</span>}
                    {s.riskSignificantCategoryCalculationConfirmed === true && <span className="msterm__rs">Risk-significant confirmed</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {headline !== undefined && headline.releaseForms.length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="MS" title="Quantitative source-term table" level={3} />
            <MsProvenanceChip>MS-E2</MsProvenanceChip>
          </div>
          <p className="poscard__sub">The documentation deliverable is the table itself, here for {categoryName(headline.releaseCategoryReference)}, by species, phase, form and chemical form.</p>
          <SourceTermTable st={headline} />
          {(headline.particleSizeDistribution?.description ?? "").length > 0 && (
            <p className="possubtle" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{headline.particleSizeDistribution?.description}</p>
          )}
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="MS" title="Source-term models" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-C5</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addModel}><MSIcon.Plus /> Add model</button>}
          </div>
        </div>
        <p className="poscard__sub">The calculation runs in validated codes within their applicability limits, with the roles named rather than any product. Select a card to edit it.</p>
        {models.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No source-term models yet. Add the validated codes the calculation runs in.</p>
        ) : (
        <div className="msmodel">
          {models.map((m) => (
            <div key={m.uuid} className="msmodel__card" onClick={() => openDrawer({ kind: "model", id: m.uuid })} style={{ cursor: "pointer" }}>
              <div className="msmodel__head">
                <div className="msmodel__head-main">
                  <div className="msmodel__name">{m.name}{m.version.length > 0 ? ` · v${m.version}` : ""}</div>
                  <div className="msmodel__role">{m.technicalBasis}</div>
                </div>
                <span className="msmodel__vv">{m.validationStatus}</span>
              </div>
              {(m.verificationValidationProcess ?? "").length > 0 && <p className="possubtle" style={{ fontSize: 11.5, margin: 0, lineHeight: 1.4 }}>{m.verificationValidationProcess}</p>}
              <div className="msmodel__limits">
                {(m.applicabilityLimits ?? []).map((l, i) => (
                  <div key={i} className="msmodel__limit">{l}</div>
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

// ─── 06 — Uncertainty & Pre-op (HLR-D closeout) ────────────────────────────
function UncertScreen({ openDrawer }: { openDrawer: (ctx: MsDrawerContext) => void }): JSX.Element {
  const { ms, editable, mutateMs } = useMsWorkbook();
  const analyses = ms.uncertaintyAnalyses;
  const modelUncertainties = ms.modelUncertaintyAssessments ?? [];
  const sensitivity = ms.sensitivityStudies ?? [];
  const preop = ms.preOperationalAssumptions ?? [];
  function categoryName(ref: string): string {
    return ms.releaseCategories.find((r) => r.uuid === ref)?.name ?? ref;
  }
  function srList(srs?: { sr: string }[]): string {
    return (srs ?? []).map((s) => s.sr).join(", ");
  }
  function nextId(prefix: string, ids: string[]): string {
    const n = ids.reduce((m, id) => { const v = Number(id.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    return `${prefix}-${String(n)}`;
  }
  function addAnalysis(): void {
    const uuid = nextId("UA", analyses.map((a) => a.uuid));
    mutateMs((d) => ({ ...d, uncertaintyAnalyses: [...d.uncertaintyAnalyses, { uuid, propagationMethod: "MONTE_CARLO", modelUncertainties: [], releaseCategoryReference: d.releaseCategories[0]?.uuid ?? "", uncertainInputParameters: [], componentEstimates: [], characterizationLevel: "CHARACTERIZED", implementsSrs: [{ sr: "MS-D1", hlr: "D" }] }] }));
    openDrawer({ kind: "uncertainty", id: uuid });
  }
  function addModelUncertainty(): void {
    const uuid = nextId("MU", modelUncertainties.map((u) => u.uuid));
    mutateMs((d) => ({ ...d, modelUncertaintyAssessments: [...(d.modelUncertaintyAssessments ?? []), { uuid, sourceBlock: "SOURCE_TERM_CALCULATION", uncertaintySource: "New model uncertainty", relatedAssumptions: [], evaluationType: "QUALITATIVE", evaluationScope: "INDIVIDUAL", consequenceEffect: "", implementsSrs: [{ sr: "MS-D3", hlr: "D" }] }] }));
    openDrawer({ kind: "modeluncertainty", id: uuid });
  }
  function addSensitivity(): void {
    const uuid = nextId("SS", sensitivity.map((s) => s.uuid));
    mutateMs((d) => ({ ...d, sensitivityStudies: [...(d.sensitivityStudies ?? []), { uuid, name: "New sensitivity study", description: "", variedParameters: [], parameterRanges: {}, results: "", implementsSrs: [{ sr: "MS-D3", hlr: "D" }] }] }));
    openDrawer({ kind: "sensitivity", id: uuid });
  }
  function addPreop(): void {
    const uuid = nextId("PA", preop.map((a) => a.uuid));
    mutateMs((d) => ({ ...d, preOperationalAssumptions: [...(d.preOperationalAssumptions ?? []), { uuid, assumptionId: uuid, description: "New assumption", influenceOnDefinition: "New area", status: "OPEN", limitations: [], riskImpact: ImportanceLevel.MEDIUM, closureBasis: "", plannedClosureActions: [], affectedElementIds: [], implementsSrs: [{ sr: "MS-E4", hlr: "E" }] }] }));
    openDrawer({ kind: "preop", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="MS" title="Uncertainty analyses" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-D2 · D4</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAnalysis}><MSIcon.Plus /> Add analysis</button>}
          </div>
        </div>
        <p className="poscard__sub">A point estimate with the uncertainty characterized, or a mean with a probabilistic representation for the categories tied to risk-significant families. When physics is correlated, the dependent phenomena are sampled together. Select a card to edit it.</p>
        {analyses.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No uncertainty analyses yet. Add one to characterize or propagate the source-term uncertainty for a category.</p>
        ) : (
        <div className="msprop">
          {analyses.map((u) => {
            const ci = u.uncertaintyPropagationResults?.confidenceIntervals?.[0];
            const propagated = u.characterizationLevel === "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES";
            return (
              <div key={u.uuid} className="msprop__card" onClick={() => openDrawer({ kind: "uncertainty", id: u.uuid })} style={{ cursor: "pointer" }}>
                <div className="msprop__head">
                  <span className="msprop__cat">{u.releaseCategoryReference}</span>
                  <span className="msprop__cat-name">{categoryName(u.releaseCategoryReference)}</span>
                  {u.componentEstimates.some((c) => c.isRiskSignificantFamily)
                    ? <span className="msterm__rs">Risk-significant</span>
                    : <span className="poschip">{propagated ? "Propagated" : "Characterized"}</span>}
                </div>
                {propagated && (u.phenomenaDependencies ?? []).length > 0 && (
                  <div className="msprop__deps">
                    {(u.phenomenaDependencies ?? []).map((d, i) => (
                      <div key={i} className="msprop__dep">
                        <div className="msprop__dep-chain">
                          {d.dependentPhenomena.map((p, j) => (
                            <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span className="msprop__dep-node">{p}</span>
                              {j < d.dependentPhenomena.length - 1 && <span className="msprop__dep-link">·</span>}
                            </span>
                          ))}
                        </div>
                        <p className="msprop__dep-desc">{d.description}</p>
                      </div>
                    ))}
                  </div>
                )}
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
                {((u.uncertaintyPropagationResults?.resultSummary ?? "").length > 0 || ci !== undefined) && (
                  <div className="msprop__ci">
                    <span>{u.uncertaintyPropagationResults?.resultSummary}{ci !== undefined && ` The ${String(ci.level)}% interval spans ${fracText(ci.lowerBound)} to ${fracText(ci.upperBound)}.`}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="MS" title="Model-uncertainty sources" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-C6 · D3</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addModelUncertainty}><MSIcon.Plus /> Add source</button>}
          </div>
        </div>
        <p className="poscard__sub">The consequence effects of the barrier and source-term model uncertainties are assessed, individually or in combination. Select a cell to edit it.</p>
        {modelUncertainties.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No model-uncertainty sources yet. Add the barrier and source-term model uncertainties to assess.</p>
        ) : (
          <div className="hrtheme">
            {modelUncertainties.map((u) => (
              <div key={u.uuid} className="hrtheme__cell" onClick={() => openDrawer({ kind: "modeluncertainty", id: u.uuid })} style={{ cursor: "pointer" }}>
                <span className="hrtheme__sr posmono">{u.evaluationType === "QUANTITATIVE" ? "Quant" : "Qual"}</span>
                <span className="hrtheme__t">{u.uncertaintySource}. {u.consequenceEffect}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="MS" title="Open items register" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <MsProvenanceChip>MS-D3 · E4</MsProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSensitivity}><MSIcon.Plus /> Add sensitivity</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addPreop}><MSIcon.Plus /> Add assumption</button>}
          </div>
        </div>
        <p className="poscard__sub">The sensitivity studies and the pre-operational assumptions feed the documentation. Select a row to edit it.</p>
        {sensitivity.length === 0 && preop.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No sensitivity studies or pre-operational assumptions yet.</p>
        ) : (
          <table className="postable">
            <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
            <tbody>
              {sensitivity.map((s) => (
                <tr key={s.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "sensitivity", id: s.uuid })} style={{ cursor: "pointer" }}>
                  <td><span className="posbadge">Sensitivity</span></td>
                  <td style={{ fontWeight: 600 }}>{s.name ?? "Sensitivity study"}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{s.results ?? ""}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{srList(s.implementsSrs)}</td>
                </tr>
              ))}
              {preop.map((a) => (
                <tr key={a.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "preop", id: a.uuid })} style={{ cursor: "pointer" }}>
                  <td><span className="posbadge posbadge--warn"><span className="posbadge__dot" />Pre-op</span></td>
                  <td style={{ fontWeight: 600 }}>{a.influenceOnDefinition}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{a.description}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{srList(a.implementsSrs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="MS" title="Surrogate risk metric" level={3} />
          <MsProvenanceChip>MS-E1</MsProvenanceChip>
        </div>
        <p className="poscard__sub">The surrogate risk metric relates the source-term deliverable to the plant risk metric that Risk Integration pairs with the frequency.</p>
        <WorkbookTextarea
          className="posfield__textarea"
          rows={3}
          placeholder="Describe how the large-release-frequency surrogate maps to a release category."
          value={ms.documentation.surrogateRiskMetrics}
          disabled={!editable}
          onChange={(e) => mutateMs((d) => ({ ...d, documentation: { ...d.documentation, surrogateRiskMetrics: e.target.value } }))}
        />
      </div>
    </>
  );
}

// ─── 07 — Draft (the report template) ──────────────────────────────────────
function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: { cc: CapabilityCategory; scores: CcScore; stage: Stage; onSubmitDraft: () => void; canSubmit: boolean }): JSX.Element {
  const { ms } = useMsWorkbook();
  const ready = scores.warn === 0 && scores.blocked === 0;
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
          <WorkbookSectionHeading workbook="MS" title="Conformance check" level={3} className="posgen__readout-h" />
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable, stage</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="MS" title="Hand-off to internal review" level={3} className="posgen__readout-h" />
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
function DrawerHead({ cap, title, sub, onClose }: { cap: string; title: string; sub?: string; onClose: () => void }): JSX.Element {
  return (
    <div className="posdrawer__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        <WorkbookSectionHeading workbook="MS" title={title} cueKey={cap} description={sub} level={2} className="posdrawer__title" />
      </div>
      <button type="button" className="posdrawer__close" onClick={onClose}><MSIcon.Close /></button>
    </div>
  );
}

function MsTextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookInput className="posfield__input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function MsAreaField({ label, value, onChange, disabled, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; rows?: number }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookTextarea className="posfield__textarea" rows={rows} style={{ resize: "vertical" }} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function MsNumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookInput className="posfield__input posmono" type="number" step="any" value={value} disabled={disabled} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) onChange(v); }} />
    </div>
  );
}

function MsSelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <select className="posfield__select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function MsStringList({ label, values, onChange, disabled }: { label: string; values: string[]; onChange: (v: string[]) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {values.map((v, i) => (
          <div key={i} className="posrow" style={{ gap: 6 }}>
            <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={v} disabled={disabled} onChange={(e) => onChange(values.map((y, j) => (j === i ? e.target.value : y)))} />
            {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange([...values.slice(0, i), ...values.slice(i + 1)])}>Remove</button>}
          </div>
        ))}
        {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...values, ""])}><MSIcon.Plus /> Add</button>}
      </div>
    </div>
  );
}

function RemoveBtn({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={onClick}>{label}</button>;
}

function SrChips({ srs }: { srs: { sr: string }[] }): JSX.Element {
  return (
    <div>
      <WorkbookCueLabel workbook="MS" title="Standard requirements" className="essec" />
      <div className="posdrawer__srs">{srs.map((s) => <span key={s.sr} className="poschip posmono">{s.sr}</span>)}</div>
    </div>
  );
}

const FORM_OPTIONS: [string, string][] = [["ELEMENTAL", "Elemental"], ["AEROSOL", "Aerosol"], ["DUST", "Dust"], ["OTHER", "Other"]];
const CALC_OPTIONS: [string, string][] = [["PLANT_SPECIFIC_CALCULATION", "Plant-specific calculation"], ["GENERIC_ESTIMATE", "Generic estimate"]];
const DIFF_OPTIONS: [string, string][] = [["CONSEQUENCE_METRIC", "Consequence metric"], ["CONSEQUENCE_METRIC_AND_RISK_SIGNIFICANT_DIFFERENTIATION", "Metric and risk-significant split"]];
const ST_BASIS_OPTIONS: [string, string][] = [["PLANT_SPECIFIC_MECHANISTIC", "Plant-specific, mechanistic"], ["GENERIC_APPLICABLE", "Generic, applicable"]];
const SIG_OPTIONS: [string, string][] = [["HIGH", "High"], ["MEDIUM", "Medium"], ["LOW", "Low"]];
const EVAL_TYPE_OPTIONS: [string, string][] = [["QUALITATIVE", "Qualitative"], ["QUANTITATIVE", "Quantitative"]];
const EVAL_SCOPE_OPTIONS: [string, string][] = [["INDIVIDUAL", "Individual"], ["COMBINATION", "Combination"]];
const SOURCE_BLOCK_OPTIONS: [string, string][] = [["BARRIER_TRANSPORT_ASSESSMENT", "Barrier transport assessment"], ["SOURCE_TERM_CALCULATION", "Source-term calculation"]];
const PROP_METHOD_OPTIONS: [string, string][] = [["MONTE_CARLO", "Monte Carlo"], ["LATIN_HYPERCUBE", "Latin hypercube"], ["ANALYTICAL", "Analytical"], ["OTHER", "Other"]];
const CHAR_LEVEL_OPTIONS: [string, string][] = [["CHARACTERIZED", "Characterized"], ["PROPAGATED_WITH_PHENOMENA_DEPENDENCIES", "Propagated with phenomena dependencies"]];
const VALUE_TYPE_OPTIONS: [string, string][] = [["POINT_ESTIMATE", "Point estimate"], ["MEAN", "Mean"]];
const STATUS_OPTIONS: [string, string][] = [["OPEN", "Open"], ["CLOSED", "Closed"], ["IN_PROGRESS", "In progress"]];
const YESNO_OPTIONS: [string, string][] = [["yes", "Yes"], ["no", "No"]];
const PHENOM_OPTIONS: [string, string][] = Object.entries(TRANSPORT_PHENOMENON_LABELS);

function DrawerContent({ context, onClose }: { context: MsDrawerContext; onClose: () => void }): JSX.Element | null {
  const { ms, editable, mutateMs } = useMsWorkbook();
  const dis = !editable;
  const categoryOptions: [string, string][] = ms.releaseCategories.map((c) => [c.uuid, `${c.uuid} · ${c.name}`]);

  if (context.kind === "category") {
    const r = ms.releaseCategories.find((x) => x.uuid === context.id);
    if (r === undefined) return null;
    const patch = (next: Partial<typeof r>): void => mutateMs((d) => ({ ...d, releaseCategories: d.releaseCategories.map((x) => (x.uuid === r.uuid ? { ...x, ...next } : x)) }));
    const patchTerm = (next: Partial<typeof r.releaseTerminationTime>): void => patch({ releaseTerminationTime: { ...r.releaseTerminationTime, ...next } });
    const remove = (): void => { mutateMs((d) => ({ ...d, releaseCategories: d.releaseCategories.filter((x) => x.uuid !== r.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Release category" title={r.name} sub={r.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <MsTextField label="Name" value={r.name} onChange={(v) => patch({ name: v })} disabled={dis} />
          <MsAreaField label="Definition" value={r.description} onChange={(v) => patch({ description: v })} disabled={dis} />
          <div className="posfield-grid">
            <MsTextField label="Timing" value={r.timingClassification ?? ""} onChange={(v) => patch({ timingClassification: v })} disabled={dis} />
            <MsTextField label="Magnitude" value={r.magnitudeClassification ?? ""} onChange={(v) => patch({ magnitudeClassification: v })} disabled={dis} />
          </div>
          <MsSelectField label="Differentiation basis" value={r.differentiationBasis} options={DIFF_OPTIONS} onChange={(v) => patch({ differentiationBasis: v as typeof r.differentiationBasis })} disabled={dis} />
          <MsTextField label="Bounding sequence" value={r.boundingSequenceReference} onChange={(v) => patch({ boundingSequenceReference: v })} disabled={dis} />
          <MsAreaField label="Bounding sequence justification" value={r.boundingSequenceJustification ?? ""} onChange={(v) => patch({ boundingSequenceJustification: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <MsNumberField label="Termination time value" value={r.releaseTerminationTime.value} onChange={(v) => patchTerm({ value: v })} disabled={dis} />
            <MsTextField label="Termination time unit" value={r.releaseTerminationTime.unit} onChange={(v) => patchTerm({ unit: v })} disabled={dis} />
          </div>
          <MsAreaField label="Termination time justification" value={r.releaseTerminationTime.justification} onChange={(v) => patchTerm({ justification: v })} disabled={dis} rows={2} />
          <MsAreaField label="Grouping justification" value={r.groupingJustification ?? ""} onChange={(v) => patch({ groupingJustification: v })} disabled={dis} rows={2} />
          <MsAreaField label="Technical basis" value={r.technicalBasis} onChange={(v) => patch({ technicalBasis: v })} disabled={dis} rows={2} />
          <MsStringList label="Families assigned" values={r.supportingReferences ?? []} onChange={(v) => patch({ supportingReferences: v })} disabled={dis} />
          <SrChips srs={r.implementsSrs} />
          {editable && <RemoveBtn label="Remove category" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "inventory") {
    const s = ms.sourceInventories.find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    const patch = (next: Partial<typeof s>): void => mutateMs((d) => ({ ...d, sourceInventories: d.sourceInventories.map((x) => (x.uuid === s.uuid ? { ...x, ...next } : x)) }));
    const setInv = (rows: typeof s.inventory): void => patch({ inventory: rows });
    const remove = (): void => { mutateMs((d) => ({ ...d, sourceInventories: d.sourceInventories.filter((x) => x.uuid !== s.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Source inventory" title={s.name} sub={s.radioactiveSourceRef} onClose={onClose} />
        <div className="posdrawer__body">
          <MsTextField label="Name" value={s.name} onChange={(v) => patch({ name: v })} disabled={dis} />
          <div className="posfield-grid">
            <MsTextField label="Source reference" value={s.radioactiveSourceRef ?? ""} onChange={(v) => patch({ radioactiveSourceRef: v })} disabled={dis} />
            <MsSelectField label="Calculation basis" value={s.calculationBasis} options={CALC_OPTIONS} onChange={(v) => patch({ calculationBasis: v as typeof s.calculationBasis })} disabled={dis} />
          </div>
          <MsAreaField label="Description" value={s.description} onChange={(v) => patch({ description: v })} disabled={dis} />
          <div className="posfield">
            <label className="posfield__label">Radionuclide inventory</label>
            <table className="postable">
              <thead><tr><th>Species</th><th>Quantity</th><th>Unit</th><th>Physical form</th><th>Chemical form</th>{editable && <th />}</tr></thead>
              <tbody>
                {s.inventory.map((rn, i) => (
                  <tr key={i}>
                    <td><WorkbookInput className="posfield__input posmono" value={rn.radionuclide} disabled={dis} onChange={(e) => setInv(s.inventory.map((y, j) => (j === i ? { ...y, radionuclide: e.target.value } : y)))} /></td>
                    <td><WorkbookInput className="posfield__input posmono" type="number" step="any" value={rn.quantity} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setInv(s.inventory.map((y, j) => (j === i ? { ...y, quantity: v } : y))); }} /></td>
                    <td><WorkbookInput className="posfield__input" style={{ width: 64 }} value={rn.unit} disabled={dis} onChange={(e) => setInv(s.inventory.map((y, j) => (j === i ? { ...y, unit: e.target.value } : y)))} /></td>
                    <td><select className="posfield__select" value={String(rn.physicalForm ?? "OTHER")} disabled={dis} onChange={(e) => setInv(s.inventory.map((y, j) => (j === i ? { ...y, physicalForm: e.target.value } : y)))}>{FORM_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                    <td><WorkbookInput className="posfield__input" value={rn.chemicalForm ?? ""} disabled={dis} onChange={(e) => setInv(s.inventory.map((y, j) => (j === i ? { ...y, chemicalForm: e.target.value } : y)))} /></td>
                    {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setInv([...s.inventory.slice(0, i), ...s.inventory.slice(i + 1)])}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => setInv([...s.inventory, { radionuclide: "New species", quantity: 0, unit: "Bq", physicalForm: "AEROSOL", chemicalForm: "" }])}><MSIcon.Plus /> Add species</button>}
          </div>
          <MsAreaField label="Inventory data source" value={s.inventoryDataSource ?? ""} onChange={(v) => patch({ inventoryDataSource: v })} disabled={dis} rows={2} />
          <MsAreaField label="Radionuclide selection basis" value={s.radionuclideSelectionBasis ?? ""} onChange={(v) => patch({ radionuclideSelectionBasis: v })} disabled={dis} rows={2} />
          <SrChips srs={s.implementsSrs} />
          {editable && <RemoveBtn label="Remove inventory" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "barrier") {
    const b = ms.transportBarrierAssessments.find((x) => x.uuid === context.id);
    if (b === undefined) return null;
    const patch = (next: Partial<typeof b>): void => mutateMs((d) => ({ ...d, transportBarrierAssessments: d.transportBarrierAssessments.map((x) => (x.uuid === b.uuid ? { ...x, ...next } : x)) }));
    const transport = b.transportCharacteristics[0] ?? { description: "", retentionEffectiveness: "", affectedRadionuclides: [] };
    const patchTransport = (next: Partial<typeof transport>): void => patch({ transportCharacteristics: [{ ...transport, ...next }, ...b.transportCharacteristics.slice(1)] });
    const cond = b.physicalChemicalConditions ?? { impactOnTransport: "" };
    const patchCond = (next: Partial<typeof cond>): void => patch({ physicalChemicalConditions: { ...cond, ...next } });
    const mechs = b.transportMechanisms ?? [];
    const setMechs = (rows: typeof mechs): void => patch({ transportMechanisms: rows });
    const remove = (): void => { mutateMs((d) => ({ ...d, transportBarrierAssessments: d.transportBarrierAssessments.filter((x) => x.uuid !== b.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Transport barrier" title={b.name} sub={b.barrierType} onClose={onClose} />
        <div className="posdrawer__body">
          <MsTextField label="Name" value={b.name} onChange={(v) => patch({ name: v })} disabled={dis} />
          <div className="posfield-grid">
            <MsTextField label="Barrier type" value={b.barrierType} onChange={(v) => patch({ barrierType: v })} disabled={dis} />
            <MsSelectField label="Release category" value={b.releaseCategoryReference} options={categoryOptions} onChange={(v) => patch({ releaseCategoryReference: v })} disabled={dis} />
          </div>
          <MsNumberField label="Decontamination factor" value={b.decontaminationFactor ?? 1} onChange={(v) => patch({ decontaminationFactor: v })} disabled={dis} />
          <MsAreaField label="Description" value={b.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <MsStringList label="Failure modes" values={b.failureModes ?? []} onChange={(v) => patch({ failureModes: v })} disabled={dis} />
          <MsAreaField label="Transport characteristics" value={transport.description} onChange={(v) => patchTransport({ description: v })} disabled={dis} rows={2} />
          <MsTextField label="Retention effectiveness" value={transport.retentionEffectiveness ?? ""} onChange={(v) => patchTransport({ retentionEffectiveness: v })} disabled={dis} />
          <MsStringList label="Affected species" values={transport.affectedRadionuclides ?? []} onChange={(v) => patchTransport({ affectedRadionuclides: v })} disabled={dis} />
          <div className="posfield-grid">
            <MsTextField label="Temperature" value={cond.temperature ?? ""} onChange={(v) => patchCond({ temperature: v })} disabled={dis} />
            <MsTextField label="Chemical environment" value={cond.chemicalEnvironment ?? ""} onChange={(v) => patchCond({ chemicalEnvironment: v })} disabled={dis} />
          </div>
          <MsAreaField label="Impact on transport" value={cond.impactOnTransport} onChange={(v) => patchCond({ impactOnTransport: v })} disabled={dis} rows={2} />
          <div className="posfield">
            <label className="posfield__label">Transport mechanisms</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {mechs.map((m, i) => (
                <div key={i} className="posrow" style={{ gap: 6 }}>
                  <select className="posfield__select" style={{ flex: 1 }} value={m.mechanismType} disabled={dis} onChange={(e) => setMechs(mechs.map((y, j) => (j === i ? { ...y, mechanismType: e.target.value as TransportPhenomenonType } : y)))}>{PHENOM_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <WorkbookInput className="posfield__input" style={{ flex: 2 }} value={m.description} disabled={dis} onChange={(e) => setMechs(mechs.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
                  <select className="posfield__select" style={{ width: 96 }} value={m.significance} disabled={dis} onChange={(e) => setMechs(mechs.map((y, j) => (j === i ? { ...y, significance: e.target.value as ImportanceLevel } : y)))}>{SIG_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setMechs([...mechs.slice(0, i), ...mechs.slice(i + 1)])}>Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setMechs([...mechs, { mechanismType: TransportPhenomenonType.DEPOSITION, description: "", significance: ImportanceLevel.MEDIUM }])}><MSIcon.Plus /> Add mechanism</button>}
            </div>
          </div>
          <SrChips srs={b.implementsSrs} />
          {editable && <RemoveBtn label="Remove barrier" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "sourceterm") {
    const s = ms.sourceTermDefinitions.find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    const categoryName = ms.releaseCategories.find((r) => r.uuid === s.releaseCategoryReference)?.name ?? s.releaseCategoryReference;
    const patch = (next: Partial<typeof s>): void => mutateMs((d) => ({ ...d, sourceTermDefinitions: d.sourceTermDefinitions.map((x) => (x.uuid === s.uuid ? { ...x, ...next } : x)) }));
    const setForms = (rows: typeof s.releaseForms): void => patch({ releaseForms: rows });
    const setPhases = (rows: typeof s.releasePhases): void => patch({ releasePhases: rows });
    const setQuantity = (phaseId: string, radionuclide: string, value: number): void => {
      const entry = s.radionuclideReleases.find((pr) => pr.phaseId === phaseId);
      let releases: typeof s.radionuclideReleases;
      if (entry === undefined) {
        releases = [...s.radionuclideReleases, { phaseId, quantities: [{ radionuclide, quantity: value, unit: "fraction", expressedAsReleaseFraction: true }] }];
      } else {
        releases = s.radionuclideReleases.map((pr) => {
          if (pr.phaseId !== phaseId) return pr;
          const has = pr.quantities.some((q) => q.radionuclide === radionuclide);
          const quantities = has
            ? pr.quantities.map((q) => (q.radionuclide === radionuclide ? { ...q, quantity: value } : q))
            : [...pr.quantities, { radionuclide, quantity: value, unit: "fraction", expressedAsReleaseFraction: true }];
          return { ...pr, quantities };
        });
      }
      patch({ radionuclideReleases: releases });
    };
    const remove = (): void => { mutateMs((d) => ({ ...d, sourceTermDefinitions: d.sourceTermDefinitions.filter((x) => x.uuid !== s.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Source term" title={categoryName} sub={s.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <MsSelectField label="Release category" value={s.releaseCategoryReference} options={categoryOptions} onChange={(v) => patch({ releaseCategoryReference: v })} disabled={dis} />
            <MsSelectField label="Source-term basis" value={s.sourceTermBasis} options={ST_BASIS_OPTIONS} onChange={(v) => patch({ sourceTermBasis: v as typeof s.sourceTermBasis })} disabled={dis} />
          </div>
          {s.sourceTermBasis === "GENERIC_APPLICABLE" && (
            <>
              <MsAreaField label="Generic applicability justification" value={s.genericApplicabilityJustification ?? ""} onChange={(v) => patch({ genericApplicabilityJustification: v })} disabled={dis} rows={2} />
              <MsStringList label="Post-processing modifications" values={s.postProcessingModifications ?? []} onChange={(v) => patch({ postProcessingModifications: v })} disabled={dis} />
            </>
          )}
          <MsSelectField label="Risk-significant calculation confirmed" value={s.riskSignificantCategoryCalculationConfirmed === true ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ riskSignificantCategoryCalculationConfirmed: v === "yes" })} disabled={dis} />
          <MsStringList label="Source-term model references" values={s.sourceTermModelRefs ?? []} onChange={(v) => patch({ sourceTermModelRefs: v })} disabled={dis} />
          <div className="posfield-grid">
            <MsNumberField label="Involved reactors" value={s.involvedReactors ?? 1} onChange={(v) => patch({ involvedReactors: v })} disabled={dis} />
            <MsTextField label="Warning time" value={s.warningTimeForEvacuation ?? ""} onChange={(v) => patch({ warningTimeForEvacuation: v })} disabled={dis} />
          </div>
          <MsAreaField label="Initiating-event characteristics" value={s.initiatingEventCharacteristics ?? ""} onChange={(v) => patch({ initiatingEventCharacteristics: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <MsNumberField label="Thermal energy" value={s.releaseEnergy?.quantity ?? 0} onChange={(v) => patch({ releaseEnergy: { quantity: v, unit: s.releaseEnergy?.unit ?? "MW thermal" } })} disabled={dis} />
            <MsTextField label="Thermal energy unit" value={s.releaseEnergy?.unit ?? ""} onChange={(v) => patch({ releaseEnergy: { quantity: s.releaseEnergy?.quantity ?? 0, unit: v } })} disabled={dis} />
            <MsNumberField label="Release elevation" value={s.releaseElevation?.quantity ?? 0} onChange={(v) => patch({ releaseElevation: { quantity: v, unit: s.releaseElevation?.unit ?? "m" } })} disabled={dis} />
            <MsTextField label="Release elevation unit" value={s.releaseElevation?.unit ?? ""} onChange={(v) => patch({ releaseElevation: { quantity: s.releaseElevation?.quantity ?? 0, unit: v } })} disabled={dis} />
          </div>
          <MsAreaField label="Particle-size distribution" value={s.particleSizeDistribution?.description ?? ""} onChange={(v) => patch({ particleSizeDistribution: { description: v, sizeRanges: s.particleSizeDistribution?.sizeRanges ?? [] } })} disabled={dis} rows={2} />
          <div className="posfield">
            <label className="posfield__label">Release phases</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {s.releasePhases.map((p, i) => (
                <div key={p.uuid} className="posrow" style={{ gap: 6 }}>
                  <WorkbookInput className="posfield__input" style={{ flex: 2 }} value={p.name} disabled={dis} onChange={(e) => setPhases(s.releasePhases.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                  <WorkbookInput className="posfield__input posmono" style={{ width: 70 }} type="number" step="any" value={p.startTime} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setPhases(s.releasePhases.map((y, j) => (j === i ? { ...y, startTime: v } : y))); }} />
                  <WorkbookInput className="posfield__input posmono" style={{ width: 70 }} type="number" step="any" value={p.endTime} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setPhases(s.releasePhases.map((y, j) => (j === i ? { ...y, endTime: v } : y))); }} />
                  <WorkbookInput className="posfield__input" style={{ width: 56 }} value={p.timeUnit ?? ""} disabled={dis} onChange={(e) => setPhases(s.releasePhases.map((y, j) => (j === i ? { ...y, timeUnit: e.target.value } : y)))} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setPhases([...s.releasePhases.slice(0, i), ...s.releasePhases.slice(i + 1)])}>Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setPhases([...s.releasePhases, { uuid: `p${String(s.releasePhases.length + 1)}`, name: "New phase", startTime: 0, endTime: 0, timeUnit: "h" }])}><MSIcon.Plus /> Add phase</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Release by species, phase and form</label>
            <table className="postable">
              <thead><tr><th>Species</th>{s.releasePhases.map((p) => <th key={p.uuid}>{p.name}</th>)}<th>Form</th><th>Chemical form</th>{editable && <th />}</tr></thead>
              <tbody>
                {s.releaseForms.map((rf, i) => (
                  <tr key={i}>
                    <td><WorkbookInput className="posfield__input posmono" style={{ width: 84 }} value={rf.radionuclide} disabled={dis} onChange={(e) => setForms(s.releaseForms.map((y, j) => (j === i ? { ...y, radionuclide: e.target.value } : y)))} /></td>
                    {s.releasePhases.map((p) => (
                      <td key={p.uuid}><WorkbookInput className="posfield__input posmono" style={{ width: 78 }} type="number" step="any" value={phaseQuantity(s, p.uuid, rf.radionuclide) ?? 0} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setQuantity(p.uuid, rf.radionuclide, v); }} /></td>
                    ))}
                    <td><select className="posfield__select" value={String(rf.form)} disabled={dis} onChange={(e) => setForms(s.releaseForms.map((y, j) => (j === i ? { ...y, form: e.target.value } : y)))}>{FORM_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                    <td><WorkbookInput className="posfield__input" value={rf.chemicalForm ?? ""} disabled={dis} onChange={(e) => setForms(s.releaseForms.map((y, j) => (j === i ? { ...y, chemicalForm: e.target.value } : y)))} /></td>
                    {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setForms([...s.releaseForms.slice(0, i), ...s.releaseForms.slice(i + 1)])}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => setForms([...s.releaseForms, { radionuclide: "New species", form: "AEROSOL", chemicalForm: "" }])}><MSIcon.Plus /> Add species</button>}
          </div>
          <SrChips srs={s.implementsSrs} />
          {editable && <RemoveBtn label="Remove source term" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "phenomena") {
    const a = ms.transportPhenomenaAssessments.find((x) => x.uuid === context.id);
    if (a === undefined) return null;
    const patch = (next: Partial<typeof a>): void => mutateMs((d) => ({ ...d, transportPhenomenaAssessments: d.transportPhenomenaAssessments.map((x) => (x.uuid === a.uuid ? { ...x, ...next } : x)) }));
    const setChecklist = (rows: typeof a.phenomenaChecklist): void => patch({ phenomenaChecklist: rows });
    const designUnique = a.designUniquePhenomena ?? [];
    const setDesign = (rows: typeof designUnique): void => patch({ designUniquePhenomena: rows });
    const patchSupport = (next: Partial<typeof a.consequenceQuantificationSupport>): void => patch({ consequenceQuantificationSupport: { ...a.consequenceQuantificationSupport, ...next } });
    const remove = (): void => { mutateMs((d) => ({ ...d, transportPhenomenaAssessments: d.transportPhenomenaAssessments.filter((x) => x.uuid !== a.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Transport phenomena" title={ms.releaseCategories.find((r) => r.uuid === a.releaseCategoryReference)?.name ?? a.releaseCategoryReference} sub={a.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <MsSelectField label="Release category" value={a.releaseCategoryReference} options={categoryOptions} onChange={(v) => patch({ releaseCategoryReference: v })} disabled={dis} />
          <div className="posfield">
            <label className="posfield__label">Phenomena checklist</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {a.phenomenaChecklist.map((p, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, borderBottom: "1px dashed var(--color-border)", paddingBottom: 8 }}>
                  <div className="posrow" style={{ gap: 6 }}>
                    <select className="posfield__select" style={{ flex: 1 }} value={p.phenomenonType} disabled={dis} onChange={(e) => setChecklist(a.phenomenaChecklist.map((y, j) => (j === i ? { ...y, phenomenonType: e.target.value as TransportPhenomenonType } : y)))}>{PHENOM_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <select className="posfield__select" style={{ width: 110 }} value={p.included ? "yes" : "no"} disabled={dis} onChange={(e) => setChecklist(a.phenomenaChecklist.map((y, j) => (j === i ? { ...y, included: e.target.value === "yes" } : y)))}><option value="yes">Included</option><option value="no">Screened</option></select>
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setChecklist([...a.phenomenaChecklist.slice(0, i), ...a.phenomenaChecklist.slice(i + 1)])}>Remove</button>}
                  </div>
                  <WorkbookInput className="posfield__input" value={p.justification ?? ""} disabled={dis} onChange={(e) => setChecklist(a.phenomenaChecklist.map((y, j) => (j === i ? { ...y, justification: e.target.value } : y)))} />
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setChecklist([...a.phenomenaChecklist, { phenomenonType: TransportPhenomenonType.OTHER, included: true, justification: "" }])}><MSIcon.Plus /> Add phenomenon</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Design-unique phenomena</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {designUnique.map((d, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div className="posrow" style={{ gap: 6 }}>
                    <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={d.name} disabled={dis} onChange={(e) => setDesign(designUnique.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDesign([...designUnique.slice(0, i), ...designUnique.slice(i + 1)])}>Remove</button>}
                  </div>
                  <WorkbookInput className="posfield__input" placeholder="Note" value={d.note ?? ""} disabled={dis} onChange={(e) => setDesign(designUnique.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} />
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setDesign([...designUnique, { name: "New phenomenon", note: "" }])}><MSIcon.Plus /> Add</button>}
            </div>
          </div>
          <MsStringList label="Models used" values={a.modelsUsed} onChange={(v) => patch({ modelsUsed: v })} disabled={dis} />
          <MsStringList label="Related barrier assessments" values={a.relatedBarrierAssessmentRefs ?? []} onChange={(v) => patch({ relatedBarrierAssessmentRefs: v })} disabled={dis} />
          <MsAreaField label="Treatment adequacy" value={a.consequenceQuantificationSupport.description} onChange={(v) => patchSupport({ description: v })} disabled={dis} rows={2} />
          <MsAreaField label="Adequacy justification" value={a.consequenceQuantificationSupport.adequacyJustification} onChange={(v) => patchSupport({ adequacyJustification: v })} disabled={dis} rows={2} />
          <MsSelectField label="Sufficient for risk-significant differentiation" value={a.consequenceQuantificationSupport.sufficientForRiskSignificantDifferentiation === false ? "no" : "yes"} options={YESNO_OPTIONS} onChange={(v) => patchSupport({ sufficientForRiskSignificantDifferentiation: v === "yes" })} disabled={dis} />
          <SrChips srs={a.implementsSrs} />
          {editable && <RemoveBtn label="Remove assessment" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "uncertainty") {
    const u = ms.uncertaintyAnalyses.find((x) => x.uuid === context.id);
    if (u === undefined) return null;
    const patch = (next: Partial<typeof u>): void => mutateMs((d) => ({ ...d, uncertaintyAnalyses: d.uncertaintyAnalyses.map((x) => (x.uuid === u.uuid ? { ...x, ...next } : x)) }));
    const comps = u.componentEstimates;
    const setComps = (rows: typeof comps): void => patch({ componentEstimates: rows });
    const inputs = u.uncertainInputParameters;
    const setInputs = (rows: typeof inputs): void => patch({ uncertainInputParameters: rows });
    const ci = u.uncertaintyPropagationResults?.confidenceIntervals?.[0];
    const patchResults = (next: Partial<NonNullable<typeof u.uncertaintyPropagationResults>>): void => patch({ uncertaintyPropagationResults: { description: u.uncertaintyPropagationResults?.description ?? "", resultSummary: u.uncertaintyPropagationResults?.resultSummary ?? "", confidenceIntervals: u.uncertaintyPropagationResults?.confidenceIntervals, ...next } });
    const setCi = (next: Partial<{ level: number; lowerBound: number; upperBound: number }>): void => patchResults({ confidenceIntervals: [{ level: ci?.level ?? 90, lowerBound: ci?.lowerBound ?? 0, upperBound: ci?.upperBound ?? 0, ...next }] });
    const remove = (): void => { mutateMs((d) => ({ ...d, uncertaintyAnalyses: d.uncertaintyAnalyses.filter((x) => x.uuid !== u.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Uncertainty analysis" title={ms.releaseCategories.find((r) => r.uuid === u.releaseCategoryReference)?.name ?? u.releaseCategoryReference} sub={u.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <MsSelectField label="Release category" value={u.releaseCategoryReference} options={categoryOptions} onChange={(v) => patch({ releaseCategoryReference: v })} disabled={dis} />
            <MsTextField label="Source-term reference" value={u.sourceTermDefinitionRef ?? ""} onChange={(v) => patch({ sourceTermDefinitionRef: v })} disabled={dis} />
            <MsSelectField label="Propagation method" value={u.propagationMethod} options={PROP_METHOD_OPTIONS} onChange={(v) => patch({ propagationMethod: v as typeof u.propagationMethod })} disabled={dis} />
            <MsNumberField label="Number of samples" value={u.numberOfSamples ?? 0} onChange={(v) => patch({ numberOfSamples: v })} disabled={dis} />
          </div>
          <MsSelectField label="Characterization level" value={u.characterizationLevel} options={CHAR_LEVEL_OPTIONS} onChange={(v) => patch({ characterizationLevel: v as typeof u.characterizationLevel })} disabled={dis} />
          <div className="posfield-grid">
            <MsSelectField label="Expert judgment used" value={u.expertJudgmentUsed === true ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ expertJudgmentUsed: v === "yes" })} disabled={dis} />
            <MsSelectField label="Expert-judgment process satisfied" value={u.expertJudgmentProcessSatisfied === true ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ expertJudgmentProcessSatisfied: v === "yes" })} disabled={dis} />
          </div>
          <div className="posfield">
            <label className="posfield__label">Phenomena dependencies</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(u.phenomenaDependencies ?? []).map((dep, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, borderBottom: "1px dashed var(--color-border)", paddingBottom: 8 }}>
                  <WorkbookInput className="posfield__input" placeholder="Description" value={dep.description} disabled={dis} onChange={(e) => patch({ phenomenaDependencies: (u.phenomenaDependencies ?? []).map((y, j) => (j === i ? { ...y, description: e.target.value } : y)) })} />
                  <WorkbookInput className="posfield__input" placeholder="Dependent phenomena, comma separated" value={dep.dependentPhenomena.join(", ")} disabled={dis} onChange={(e) => patch({ phenomenaDependencies: (u.phenomenaDependencies ?? []).map((y, j) => (j === i ? { ...y, dependentPhenomena: e.target.value.split(",").map((x) => x.trim()).filter((x) => x.length > 0) } : y)) })} />
                  <div className="posrow" style={{ gap: 6 }}>
                    <WorkbookInput className="posfield__input" style={{ flex: 1 }} placeholder="Treatment method" value={dep.treatmentMethod} disabled={dis} onChange={(e) => patch({ phenomenaDependencies: (u.phenomenaDependencies ?? []).map((y, j) => (j === i ? { ...y, treatmentMethod: e.target.value } : y)) })} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ phenomenaDependencies: [...(u.phenomenaDependencies ?? []).slice(0, i), ...(u.phenomenaDependencies ?? []).slice(i + 1)] })}>Remove</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patch({ phenomenaDependencies: [...(u.phenomenaDependencies ?? []), { description: "", dependentPhenomena: [], treatmentMethod: "" }] })}><MSIcon.Plus /> Add dependency</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Component estimates</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {comps.map((c, i) => {
                const median = c.distribution?.type === DistributionType.LOGNORMAL ? c.distribution.median : undefined;
                const ef = c.distribution?.type === DistributionType.LOGNORMAL ? c.distribution.errorFactor : undefined;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, borderBottom: "1px dashed var(--color-border)", paddingBottom: 8 }}>
                    <div className="posrow" style={{ gap: 6 }}>
                      <WorkbookInput className="posfield__input" style={{ flex: 2 }} value={c.component} disabled={dis} onChange={(e) => setComps(comps.map((y, j) => (j === i ? { ...y, component: e.target.value } : y)))} />
                      <select className="posfield__select" style={{ width: 120 }} value={c.valueType} disabled={dis} onChange={(e) => setComps(comps.map((y, j) => (j === i ? { ...y, valueType: e.target.value as typeof c.valueType } : y)))}>{VALUE_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                      {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setComps([...comps.slice(0, i), ...comps.slice(i + 1)])}>Remove</button>}
                    </div>
                    <div className="posrow" style={{ gap: 6 }}>
                      <select className="posfield__select" style={{ flex: 1 }} value={c.isRiskSignificantFamily ? "yes" : "no"} disabled={dis} onChange={(e) => setComps(comps.map((y, j) => (j === i ? { ...y, isRiskSignificantFamily: e.target.value === "yes" } : y)))}><option value="yes">Risk-significant</option><option value="no">Not significant</option></select>
                      <WorkbookInput className="posfield__input posmono" style={{ width: 100 }} type="number" step="any" placeholder="median" value={median ?? ""} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setComps(comps.map((y, j) => (j === i ? { ...y, probabilisticRepresentationProvided: true, distribution: { type: DistributionType.LOGNORMAL, median: v, errorFactor: ef ?? 2 } } : y))); }} />
                      <WorkbookInput className="posfield__input posmono" style={{ width: 90 }} type="number" step="any" placeholder="EF" value={ef ?? ""} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setComps(comps.map((y, j) => (j === i ? { ...y, probabilisticRepresentationProvided: true, distribution: { type: DistributionType.LOGNORMAL, median: median ?? 0, errorFactor: v } } : y))); }} />
                    </div>
                  </div>
                );
              })}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setComps([...comps, { component: "New component", valueType: "MEAN", isRiskSignificantFamily: false }])}><MSIcon.Plus /> Add component</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Uncertain input parameters</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {inputs.map((p, i) => (
                <div key={i} className="posrow" style={{ gap: 6 }}>
                  <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={p.parameter} disabled={dis} onChange={(e) => setInputs(inputs.map((y, j) => (j === i ? { ...y, parameter: e.target.value } : y)))} />
                  <WorkbookInput className="posfield__input" style={{ flex: 2 }} value={p.description} disabled={dis} onChange={(e) => setInputs(inputs.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setInputs([...inputs.slice(0, i), ...inputs.slice(i + 1)])}>Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setInputs([...inputs, { parameter: "New parameter", description: "" }])}><MSIcon.Plus /> Add parameter</button>}
            </div>
          </div>
          <MsAreaField label="Result summary" value={u.uncertaintyPropagationResults?.resultSummary ?? ""} onChange={(v) => patchResults({ resultSummary: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <MsNumberField label="Confidence level (%)" value={ci?.level ?? 90} onChange={(v) => setCi({ level: v })} disabled={dis} />
            <MsNumberField label="Lower bound" value={ci?.lowerBound ?? 0} onChange={(v) => setCi({ lowerBound: v })} disabled={dis} />
            <MsNumberField label="Upper bound" value={ci?.upperBound ?? 0} onChange={(v) => setCi({ upperBound: v })} disabled={dis} />
          </div>
          <SrChips srs={u.implementsSrs} />
          {editable && <RemoveBtn label="Remove analysis" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "modeluncertainty") {
    const u = (ms.modelUncertaintyAssessments ?? []).find((x) => x.uuid === context.id);
    if (u === undefined) return null;
    const patch = (next: Partial<typeof u>): void => mutateMs((d) => ({ ...d, modelUncertaintyAssessments: (d.modelUncertaintyAssessments ?? []).map((x) => (x.uuid === u.uuid ? { ...x, ...next } : x)) }));
    const remove = (): void => { mutateMs((d) => ({ ...d, modelUncertaintyAssessments: (d.modelUncertaintyAssessments ?? []).filter((x) => x.uuid !== u.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Model uncertainty" title={u.uncertaintySource} sub={u.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <MsTextField label="Uncertainty source" value={u.uncertaintySource} onChange={(v) => patch({ uncertaintySource: v })} disabled={dis} />
          <MsSelectField label="Source block" value={u.sourceBlock} options={SOURCE_BLOCK_OPTIONS} onChange={(v) => patch({ sourceBlock: v as typeof u.sourceBlock })} disabled={dis} />
          <div className="posfield-grid">
            <MsSelectField label="Evaluation type" value={u.evaluationType} options={EVAL_TYPE_OPTIONS} onChange={(v) => patch({ evaluationType: v as typeof u.evaluationType })} disabled={dis} />
            <MsSelectField label="Evaluation scope" value={u.evaluationScope} options={EVAL_SCOPE_OPTIONS} onChange={(v) => patch({ evaluationScope: v as typeof u.evaluationScope })} disabled={dis} />
          </div>
          <MsAreaField label="Consequence effect" value={u.consequenceEffect} onChange={(v) => patch({ consequenceEffect: v })} disabled={dis} rows={2} />
          <MsStringList label="Related assumptions" values={u.relatedAssumptions} onChange={(v) => patch({ relatedAssumptions: v })} disabled={dis} />
          <SrChips srs={u.implementsSrs} />
          {editable && <RemoveBtn label="Remove source" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "sensitivity") {
    const st = (ms.sensitivityStudies ?? []).find((x) => x.uuid === context.id);
    if (st === undefined) return null;
    const patch = (next: Partial<typeof st>): void => mutateMs((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).map((x) => (x.uuid === st.uuid ? { ...x, ...next } : x)) }));
    const setRange = (param: string, idx: 0 | 1, value: number): void => {
      const cur = st.parameterRanges[param] ?? [0, 0];
      const nextRange: [number, number] = idx === 0 ? [value, cur[1]] : [cur[0], value];
      patch({ parameterRanges: { ...st.parameterRanges, [param]: nextRange } });
    };
    const remove = (): void => { mutateMs((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).filter((x) => x.uuid !== st.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Sensitivity study" title={st.name ?? st.uuid} sub={st.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <MsTextField label="Name" value={st.name ?? ""} onChange={(v) => patch({ name: v })} disabled={dis} />
          <MsAreaField label="Description" value={st.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <MsStringList label="Varied parameters" values={st.variedParameters} onChange={(v) => patch({ variedParameters: v })} disabled={dis} />
          {st.variedParameters.length > 0 && (
            <div className="posfield">
              <label className="posfield__label">Parameter ranges</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {st.variedParameters.map((param) => {
                  const range = st.parameterRanges[param] ?? [0, 0];
                  return (
                    <div key={param} className="posrow" style={{ gap: 6, alignItems: "center" }}>
                      <span className="possubtle" style={{ flex: 1, fontSize: 12 }}>{param}</span>
                      <WorkbookInput className="posfield__input posmono" style={{ width: 90 }} type="number" step="any" value={range[0]} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setRange(param, 0, v); }} />
                      <WorkbookInput className="posfield__input posmono" style={{ width: 90 }} type="number" step="any" value={range[1]} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setRange(param, 1, v); }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <MsAreaField label="Results" value={st.results ?? ""} onChange={(v) => patch({ results: v })} disabled={dis} rows={2} />
          <SrChips srs={st.implementsSrs ?? []} />
          {editable && <RemoveBtn label="Remove study" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "preop") {
    const a = (ms.preOperationalAssumptions ?? []).find((x) => x.uuid === context.id);
    if (a === undefined) return null;
    const patch = (next: Partial<typeof a>): void => mutateMs((d) => ({ ...d, preOperationalAssumptions: (d.preOperationalAssumptions ?? []).map((x) => (x.uuid === a.uuid ? { ...x, ...next } : x)) }));
    const remove = (): void => { mutateMs((d) => ({ ...d, preOperationalAssumptions: (d.preOperationalAssumptions ?? []).filter((x) => x.uuid !== a.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Pre-operational assumption" title={a.influenceOnDefinition} sub={a.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <MsTextField label="Area of influence" value={a.influenceOnDefinition} onChange={(v) => patch({ influenceOnDefinition: v })} disabled={dis} />
          <MsAreaField label="Description" value={a.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <MsSelectField label="Status" value={a.status} options={STATUS_OPTIONS} onChange={(v) => patch({ status: v as typeof a.status })} disabled={dis} />
            <MsSelectField label="Risk impact" value={a.riskImpact} options={SIG_OPTIONS} onChange={(v) => patch({ riskImpact: v as typeof a.riskImpact })} disabled={dis} />
          </div>
          <MsAreaField label="Closure basis" value={a.closureBasis} onChange={(v) => patch({ closureBasis: v })} disabled={dis} rows={2} />
          <MsStringList label="Planned closure actions" values={a.plannedClosureActions} onChange={(v) => patch({ plannedClosureActions: v })} disabled={dis} />
          <MsStringList label="Limitations" values={a.limitations} onChange={(v) => patch({ limitations: v })} disabled={dis} />
          <MsStringList label="Affected element paths" values={a.affectedElementIds} onChange={(v) => patch({ affectedElementIds: v })} disabled={dis} />
          <SrChips srs={a.implementsSrs ?? []} />
          {editable && <RemoveBtn label="Remove assumption" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "completeness") {
    const c = ms.releaseCategoryCompletenessAssessment;
    const patch = (next: Partial<typeof c>): void => mutateMs((d) => ({ ...d, releaseCategoryCompletenessAssessment: { ...d.releaseCategoryCompletenessAssessment, ...next } }));
    return (
      <>
        <DrawerHead cap="Category completeness" title="Completeness assessment" onClose={onClose} />
        <div className="posdrawer__body">
          <MsSelectField label="Reasonably complete" value={c.setReasonablyComplete ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ setReasonablyComplete: v === "yes" })} disabled={dis} />
          <MsAreaField label="Basis" value={c.basis} onChange={(v) => patch({ basis: v })} disabled={dis} rows={3} />
          <MsAreaField label="Consistency with consequence analysis" value={c.consistencyWithConsequenceAnalysis} onChange={(v) => patch({ consistencyWithConsequenceAnalysis: v })} disabled={dis} rows={3} />
        </div>
      </>
    );
  }

  if (context.kind === "model") {
    const m = (ms.sourceTermModels ?? []).find((x) => x.uuid === context.id);
    if (m === undefined) return null;
    const patch = (next: Partial<typeof m>): void => mutateMs((d) => ({ ...d, sourceTermModels: (d.sourceTermModels ?? []).map((x) => (x.uuid === m.uuid ? { ...x, ...next } : x)) }));
    const remove = (): void => { mutateMs((d) => ({ ...d, sourceTermModels: (d.sourceTermModels ?? []).filter((x) => x.uuid !== m.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Source-term model" title={m.name} sub={m.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <MsTextField label="Name" value={m.name} onChange={(v) => patch({ name: v })} disabled={dis} />
          <div className="posfield-grid">
            <MsTextField label="Version" value={m.version} onChange={(v) => patch({ version: v })} disabled={dis} />
            <MsTextField label="Validation status" value={m.validationStatus} onChange={(v) => patch({ validationStatus: v })} disabled={dis} />
          </div>
          <MsAreaField label="Technical basis" value={m.technicalBasis} onChange={(v) => patch({ technicalBasis: v })} disabled={dis} rows={2} />
          <MsAreaField label="Verification and validation process" value={m.verificationValidationProcess ?? ""} onChange={(v) => patch({ verificationValidationProcess: v })} disabled={dis} rows={2} />
          <MsAreaField label="Similar-class application evaluation" value={m.similarClassApplicationEvaluation ?? ""} onChange={(v) => patch({ similarClassApplicationEvaluation: v })} disabled={dis} rows={2} />
          <MsStringList label="Applicability limits" values={m.applicabilityLimits ?? []} onChange={(v) => patch({ applicabilityLimits: v })} disabled={dis} />
          <SrChips srs={m.implementsSrs} />
          {editable && <RemoveBtn label="Remove model" onClick={remove} />}
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
        <p className="hrempty__hint">This step is part of the Mechanistic Source Term Analysis workflow.</p>
      </div>
    </div>
  );
}

export { SourceTermScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };
