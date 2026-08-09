import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { DistributionType } from "interfaces-mef-types/core/events";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type RcSubElement } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RCIcon } from "./rcIcons";
import { RcProvenanceChip, valText } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import { generateRcReport } from "./rcDocx";
import {
  RC_CODE_ICONS,
  RISK_SIGNIFICANCE_LABELS,
  MU_SR,
  BS_SR,
  SS_SR,
  RC_TOC,
  type CapabilityCategory,
  type SiteBasis,
} from "./rcViewData";
import { lognormalBounds, type CcScore } from "./rcSelectors";
import { type RcDrawerContext } from "./rcScreens";
import {
  DrawerHead,
  RcTextField,
  RcAreaField,
  RcNumberField,
  RcSelectField,
  RcStringList,
  RemoveBtn,
  YESNO_OPTIONS,
  SIG_OPTIONS,
  STATUS_OPTIONS,
  EVAL_TYPE_OPTIONS,
  EVAL_SCOPE_OPTIONS,
  PROT_ACTION_OPTIONS,
  COHORT_APPROACH_OPTIONS,
  POP_BASIS_OPTIONS,
  LAND_BASIS_OPTIONS,
  PLANT_BASIS_OPTIONS,
  EVAC_COMPONENT_OPTIONS,
  PERIOD_APPROACH_OPTIONS,
  STABILITY_OPTIONS,
  MIXING_SCOPE_OPTIONS,
  MODEL_CLASS_OPTIONS,
  TEMPORAL_OPTIONS,
  SPATIAL_OPTIONS,
  SAMPLING_OPTIONS,
  SEGMENTATION_OPTIONS,
  DRY_APPROACH_OPTIONS,
  DEPLETION_SCOPE_OPTIONS,
  PATHWAY_OPTIONS,
  IMMERSION_OPTIONS,
  BREATHING_OPTIONS,
  INGESTION_OPTIONS,
  DCF_TYPE_OPTIONS,
  EARLY_EFFECT_OPTIONS,
  LATENT_EFFECT_OPTIONS,
  ECON_BASIS_OPTIONS,
  UNCERT_LEVEL_OPTIONS,
  SUB_ELEMENT_OPTIONS,
  RI_FB_STATUS_OPTIONS,
  RI_RESP_STATUS_OPTIONS,
} from "./rcFields";

// ─── 08 — Quantification (RCQ) ─────────────────────────────────────────────
function QuantifyScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const q = rc.consequenceQuantification;
  const pd = q.uncertaintyCharacterization.phenomenaDependencies ?? [];
  function setPd(rows: NonNullable<typeof q.uncertaintyCharacterization.phenomenaDependencies>): void {
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, uncertaintyCharacterization: { ...d.consequenceQuantification.uncertaintyCharacterization, phenomenaDependencies: rows } } }));
  }
  const justifications = q.outputReview.acceptanceJustifications ?? [];
  function setJustifications(rows: string[]): void {
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, outputReview: { ...d.consequenceQuantification.outputReview, acceptanceJustifications: rows } } }));
  }
  const criteria = q.riskSignificanceCriteriaUsed ?? [];
  function setCriteria(rows: NonNullable<typeof q.riskSignificanceCriteriaUsed>): void {
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, riskSignificanceCriteriaUsed: rows } }));
  }
  const mapping = q.riskMetricMapping ?? [];
  function setMapping(rows: NonNullable<typeof q.riskMetricMapping>): void {
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, riskMetricMapping: rows } }));
  }
  const qlimits = q.quantificationLimitations ?? [];
  function setQlimits(rows: string[]): void {
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, quantificationLimitations: rows } }));
  }
  const register: { type: string; tone: string; item: string; detail: string; srs: string; kind: string; id: string }[] = [
    ...q.modelUncertaintyAssessments.map((u, i) => ({ type: "Uncertainty", tone: "progress", item: u.uncertaintySource, detail: u.effectOnMetrics, srs: `${MU_SR[u.sourceSubElement] ?? "RCQ-C1"}, RCQ-C1`, kind: "uncertainty", id: String(i) })),
    ...(rc.boundingSiteAssumptions ?? []).map((a) => ({ type: "Bounding site", tone: "warn", item: a.influenceOnDefinition, detail: a.description, srs: BS_SR[a.assumptionId] ?? "RCRE-A1", kind: "bounding", id: a.assumptionId })),
    ...(rc.sensitivityStudies ?? []).map((s) => ({ type: "Sensitivity", tone: "", item: s.name ?? "Sensitivity study", detail: s.results ?? "", srs: SS_SR[s.uuid] ?? "RCQ-D2", kind: "sensitivity", id: s.uuid })),
    ...(rc.preOperationalAssumptions ?? []).map((a) => ({ type: "Pre-op", tone: "warn", item: a.influenceOnDefinition, detail: a.description, srs: a.implementsSrs?.[0]?.sr ?? "RCQ-D1", kind: "preop", id: a.assumptionId })),
  ];

  function addCode(): void {
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, consequenceCodesUsed: [...d.consequenceQuantification.consequenceCodesUsed, { code: "New code" }] } }));
    openDrawer({ kind: "code", id: String(q.consequenceCodesUsed.length) });
  }
  function addFamily(): void {
    const uuid = `RCQ-ESF-${String(q.eventSequenceConsequences.length + 1)}`;
    const family = `ESF-${String(q.eventSequenceConsequences.length + 1)}`;
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, eventSequenceConsequences: [...d.consequenceQuantification.eventSequenceConsequences, { uuid, eventSequenceFamily: family, consequenceResults: [], riskSignificance: ImportanceLevel.LOW }] } }));
    openDrawer({ kind: "family", id: family });
  }
  function addUncertainty(): void {
    mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, modelUncertaintyAssessments: [...d.consequenceQuantification.modelUncertaintyAssessments, { sourceSubElement: "RCAD", uncertaintySource: "New model uncertainty", relatedAssumptions: [], evaluationType: "QUALITATIVE", evaluationScope: "INDIVIDUAL", effectOnMetrics: "" }] } }));
    openDrawer({ kind: "uncertainty", id: String(q.modelUncertaintyAssessments.length) });
  }
  function addSensitivity(): void {
    const uuid = `SS-${String((rc.sensitivityStudies ?? []).length + 1)}`;
    mutateRc((d) => ({ ...d, sensitivityStudies: [...(d.sensitivityStudies ?? []), { uuid, name: "New sensitivity study", description: "", variedParameters: [], parameterRanges: {}, results: "" }] }));
    openDrawer({ kind: "sensitivity", id: uuid });
  }
  function addPreop(): void {
    const uuid = `PA-${String((rc.preOperationalAssumptions ?? []).length + 1)}`;
    mutateRc((d) => ({ ...d, preOperationalAssumptions: [...(d.preOperationalAssumptions ?? []), { uuid, assumptionId: uuid, description: "New assumption", influenceOnDefinition: "New area", status: "OPEN", limitations: [], riskImpact: ImportanceLevel.MEDIUM, closureBasis: "", plannedClosureActions: [], affectedElementIds: [] }] }));
    openDrawer({ kind: "preop", id: uuid });
  }
  const rif = rc.riskIntegrationFeedback;
  function addRif(): void {
    mutateRc((d) => ({ ...d, riskIntegrationFeedback: { analysisRef: "ri-generic-1", feedbackDate: "", metricFeedback: [], releaseCategoryFeedback: [], generalFeedback: "", response: { description: "", changes: [], status: "IN_PROGRESS" } } }));
    openDrawer({ kind: "rifeedback", id: "rif" });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consequence codes</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCQ-A1 · A2</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCode}><RCIcon.Plus /> Add code</button>}
          </div>
        </div>
        <p className="poscard__sub">The codes are demonstrated against accepted algorithms, with the roles named rather than any product. Select a code to edit it.</p>
        <div className="rccode">
          {q.consequenceCodesUsed.map((c, i) => {
            const Icon = RCIcon[RC_CODE_ICONS[c.code] ?? "Cpu"] ?? RCIcon.Cpu;
            const limits = q.modelAndCodeLimitations.filter((l) => l.code === c.code);
            return (
              <button key={i} type="button" className="rccode__card" style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "code", id: String(i) })}>
                <span className="rccode__icon"><Icon /></span>
                <div className="rccode__main">
                  <div className="rccode__name">{c.code}</div>
                  <div className="rccode__role">{limits[0]?.limitation ?? "Runs the consequence chain."}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consequence table</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCQ-A3</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addFamily}><RCIcon.Plus /> Add family</button>}
          </div>
        </div>
        <p className="poscard__sub">The deliverable is the list of event sequence families and their radiological consequences, the table RI pairs with the ESQ frequency. Select a family to edit it.</p>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="posfield">
            <label className="posfield__label">Acceptance justifications</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {justifications.length === 0 && <p className="posmuted" style={{ margin: 0 }}>No acceptance justifications yet.</p>}
              {justifications.map((j, i) => (
                <div key={i} className="posrow" style={{ gap: 8, alignItems: "center" }}>
                  <span className="rcnum">{i + 1}</span>
                  <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={j} disabled={!editable} onChange={(e) => setJustifications(justifications.map((y, k) => (k === i ? e.target.value : y)))} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" onClick={() => setJustifications([...justifications.slice(0, i), ...justifications.slice(i + 1)])}>Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setJustifications([...justifications, "New acceptance justification"])}><RCIcon.Plus /> Add justification</button>}
            </div>
          </div>
          <RcAreaField label="Results confirmation" value={q.resultsConfirmation.description ?? ""} disabled={!editable} rows={2}
            onChange={(v) => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, resultsConfirmation: { performed: d.consequenceQuantification.resultsConfirmation.performed, description: v } } }))} />
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
            <div key={i} className="rccontrib__row">
              <span className="rccontrib__rank posmono">{i + 1}</span>
              <div className="rccontrib__main">
                <WorkbookInput className="posfield__input" style={{ fontWeight: 600, marginBottom: 4 }} value={c.contributor} disabled={!editable}
                  onChange={(e) => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, riskSignificantContributors: (d.consequenceQuantification.riskSignificantContributors ?? []).map((y, j) => (j === i ? { ...y, contributor: e.target.value } : y)) } }))} />
                <WorkbookInput className="posfield__input" value={c.basisPerRiB} disabled={!editable}
                  onChange={(e) => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, riskSignificantContributors: (d.consequenceQuantification.riskSignificantContributors ?? []).map((y, j) => (j === i ? { ...y, basisPerRiB: e.target.value } : y)) } }))} />
              </div>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, riskSignificantContributors: (d.consequenceQuantification.riskSignificantContributors ?? []).filter((_, j) => j !== i) } }))}>Remove</button>}
            </div>
          ))}
        </div>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ marginTop: 8 }} onClick={() => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, riskSignificantContributors: [...(d.consequenceQuantification.riskSignificantContributors ?? []), { contributor: "New contributor", basisPerRiB: "", significance: ImportanceLevel.MEDIUM }] } }))}><RCIcon.Plus /> Add contributor</button>}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Uncertainty characterization</h3>
          <RcProvenanceChip>RCQ-C1 · C2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The model uncertainties from every sub-element funnel into the uncertainty distribution of each consequence metric, with the dependent phenomena sampled together.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <RcSelectField label="Characterization level" value={q.uncertaintyCharacterization.level} options={UNCERT_LEVEL_OPTIONS} disabled={!editable}
            onChange={(v) => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, uncertaintyCharacterization: { ...d.consequenceQuantification.uncertaintyCharacterization, level: v as typeof q.uncertaintyCharacterization.level } } }))} />
          <div className="posfield">
            <label className="posfield__label">Uncertainty characterization description</label>
            <WorkbookTextarea className="posfield__textarea" rows={2} value={q.uncertaintyCharacterization.description} disabled={!editable}
              onChange={(e) => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, uncertaintyCharacterization: { ...d.consequenceQuantification.uncertaintyCharacterization, description: e.target.value } } }))} />
          </div>
          <div className="posfield">
            <label className="posfield__label">Phenomena dependencies</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {pd.length === 0 && <p className="posmuted" style={{ margin: 0 }}>No phenomena dependencies yet.</p>}
              {pd.map((dep, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span className="rcnum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RcTextField label="Description" value={dep.description} disabled={!editable} onChange={(v) => setPd(pd.map((y, j) => (j === i ? { ...y, description: v } : y)))} />
                    <RcTextField label="Dependent phenomena (comma separated)" value={dep.dependentPhenomena.join(", ")} disabled={!editable} onChange={(v) => setPd(pd.map((y, j) => (j === i ? { ...y, dependentPhenomena: v.split(",").map((x) => x.trim()).filter((x) => x.length > 0) } : y)))} />
                    <RcTextField label="Treatment method" value={dep.treatmentMethod} disabled={!editable} onChange={(v) => setPd(pd.map((y, j) => (j === i ? { ...y, treatmentMethod: v } : y)))} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setPd([...pd.slice(0, i), ...pd.slice(i + 1)])}>Remove</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setPd([...pd, { description: "", dependentPhenomena: [], treatmentMethod: "" }])}><RCIcon.Plus /> Add dependency</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Quantification basis and limitations</h3>
          <RcProvenanceChip>RCQ-B3 · D3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The risk-significance criteria, the mapping from each consequence metric to the plant risk metric, and the quantification limitations.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="posfield">
            <label className="posfield__label">Risk-significance criteria</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {criteria.length === 0 && <p className="posmuted" style={{ margin: 0 }}>No risk-significance criteria yet.</p>}
              {criteria.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span className="rcnum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RcTextField label="Criteria type" value={c.criteriaType} disabled={!editable} onChange={(v) => setCriteria(criteria.map((y, j) => (j === i ? { ...y, criteriaType: v } : y)))} />
                    <RcTextField label="Description" value={c.description} disabled={!editable} onChange={(v) => setCriteria(criteria.map((y, j) => (j === i ? { ...y, description: v } : y)))} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setCriteria([...criteria.slice(0, i), ...criteria.slice(i + 1)])}>Remove</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setCriteria([...criteria, { criteriaType: "SAFETY_GOAL", description: "" }])}><RCIcon.Plus /> Add criterion</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Risk-metric mapping</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mapping.length === 0 && <p className="posmuted" style={{ margin: 0 }}>No risk-metric mappings yet.</p>}
              {mapping.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span className="rcnum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RcTextField label="Consequence metric" value={m.consequenceMetric} disabled={!editable} onChange={(v) => setMapping(mapping.map((y, j) => (j === i ? { ...y, consequenceMetric: v } : y)))} />
                    <RcTextField label="Risk metric" value={m.riskMetric} disabled={!editable} onChange={(v) => setMapping(mapping.map((y, j) => (j === i ? { ...y, riskMetric: v } : y)))} />
                    <RcTextField label="Mapping description" value={m.mappingDescription} disabled={!editable} onChange={(v) => setMapping(mapping.map((y, j) => (j === i ? { ...y, mappingDescription: v } : y)))} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setMapping([...mapping.slice(0, i), ...mapping.slice(i + 1)])}>Remove</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setMapping([...mapping, { consequenceMetric: "", riskMetric: "OTHER", mappingDescription: "" }])}><RCIcon.Plus /> Add mapping</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Quantification limitations</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {qlimits.length === 0 && <p className="posmuted" style={{ margin: 0 }}>No quantification limitations yet.</p>}
              {qlimits.map((l, i) => (
                <div key={i} className="posrow" style={{ gap: 8, alignItems: "center" }}>
                  <span className="rcnum">{i + 1}</span>
                  <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={l} disabled={!editable} onChange={(e) => setQlimits(qlimits.map((y, k) => (k === i ? e.target.value : y)))} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" onClick={() => setQlimits([...qlimits.slice(0, i), ...qlimits.slice(i + 1)])}>Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setQlimits([...qlimits, "New limitation"])}><RCIcon.Plus /> Add limitation</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <span className="possubtle">{register.length} items · RCQ-C1, D2 and the bounding-site assumptions</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addUncertainty}><RCIcon.Plus /> Add uncertainty</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addSensitivity}><RCIcon.Plus /> Add sensitivity</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addPreop}><RCIcon.Plus /> Add assumption</button>}
          </div>
        </div>
        <p className="poscard__sub">The model uncertainties, the bounding-site assumptions and the sensitivity studies feed the documentation. Select a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r, i) => (
              <tr key={i} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: r.kind, id: r.id })}>
                <td><span className={`posbadge${r.tone !== "" ? ` posbadge--${r.tone}` : ""}`}>{r.tone !== "" && <span className="posbadge__dot" />}{r.type}</span></td>
                <td style={{ fontWeight: 600 }}>{r.item}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.srs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-integration feedback</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCQ-B3 · RI-C1</RcProvenanceChip>
            {editable && rif !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "rifeedback", id: "rif" })}><RCIcon.Settings /> Edit</button>}
            {editable && rif === undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRif}><RCIcon.Plus /> Add feedback</button>}
          </div>
        </div>
        <p className="poscard__sub">The feedback Risk Integration returns on the consequence table, and the RC response.</p>
        {rif === undefined ? (
          <p className="posmuted" style={{ margin: 0 }}>No risk-integration feedback yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div><span className="possubtle" style={{ fontWeight: 700 }}>Analysis: </span><span className="posmono">{rif.analysisRef}</span></div>
            {(rif.generalFeedback ?? "").length > 0 && <p className="possubtle" style={{ margin: 0, lineHeight: 1.5 }}>{rif.generalFeedback}</p>}
            {rif.response !== undefined && <p className="possubtle" style={{ margin: 0, lineHeight: 1.5 }}><strong>Response:</strong> {rif.response.description}</p>}
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              <span className="poschip">{(rif.releaseCategoryFeedback ?? []).length} category items</span>
              <span className="poschip">{(rif.metricFeedback ?? []).length} metric items</span>
            </div>
          </div>
        )}
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

// ─── Drawer content — every editable RC entity ─────────────────────────────
function DrawerContent({ context, onClose }: { context: RcDrawerContext; onClose: () => void }): JSX.Element | null {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const dis = !editable;
  const rcc = rc.releaseCategoryToConsequence;
  const pa = rc.protectiveActionParameters;
  const ad = rc.atmosphericTransportAndDispersion;
  const catOptions: [string, string][] = rcc.releaseCategoryInputs.map((c) => [c.releaseCategory, c.releaseCategory]);

  if (context.kind === "category") {
    const c = rcc.releaseCategoryInputs.find((x) => x.releaseCategory === context.id);
    if (c === undefined) return null;
    const ch = c.releaseCharacteristics;
    const patch = (next: Partial<typeof c>): void => mutateRc((d) => ({ ...d, releaseCategoryToConsequence: { ...d.releaseCategoryToConsequence, releaseCategoryInputs: d.releaseCategoryToConsequence.releaseCategoryInputs.map((x) => (x.releaseCategory === c.releaseCategory ? { ...x, ...next } : x)) } }));
    const patchCh = (next: Partial<typeof ch>): void => patch({ releaseCharacteristics: { ...ch, ...next } });
    const fractions = ch.radionuclideGroupFractions ?? [];
    const timings = ch.releasePhaseTimings ?? [];
    const remove = (): void => { mutateRc((d) => ({ ...d, releaseCategoryToConsequence: { ...d.releaseCategoryToConsequence, releaseCategoryInputs: d.releaseCategoryToConsequence.releaseCategoryInputs.filter((x) => x.releaseCategory !== c.releaseCategory) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Release category" title={c.releaseCategory} sub={c.sourceTermDefinitionRef} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RcTextField label="Category id" value={c.releaseCategory} onChange={(v) => patch({ releaseCategory: v })} disabled={dis} />
            <RcTextField label="Source-term reference" value={c.sourceTermDefinitionRef ?? ""} onChange={(v) => patch({ sourceTermDefinitionRef: v })} disabled={dis} />
          </div>
          <div className="posfield-grid">
            <RcNumberField label="Number of plumes" value={ch.numberOfPlumes ?? 1} onChange={(v) => patchCh({ numberOfPlumes: v })} disabled={dis} />
            <RcNumberField label="Warning time (h)" value={ch.warningTime ?? 0} onChange={(v) => patchCh({ warningTime: v })} disabled={dis} />
          </div>
          <RcTextField label="Warning-time description" value={ch.warningTimeDescription ?? ""} onChange={(v) => patchCh({ warningTimeDescription: v })} disabled={dis} />
          <div className="posfield-grid">
            <RcNumberField label="Release energy (MW)" value={ch.releaseEnergy ?? 0} onChange={(v) => patchCh({ releaseEnergy: v })} disabled={dis} />
            <RcNumberField label="Release height (m)" value={ch.releaseHeight ?? 0} onChange={(v) => patchCh({ releaseHeight: v })} disabled={dis} />
          </div>
          <RcTextField label="Release-energy description" value={ch.releaseEnergyDescription ?? ""} onChange={(v) => patchCh({ releaseEnergyDescription: v })} disabled={dis} />
          <RcTextField label="Release-height description" value={ch.releaseHeightDescription ?? ""} onChange={(v) => patchCh({ releaseHeightDescription: v })} disabled={dis} />
          <RcTextField label="Particle-size description" value={ch.releasedParticleSizeDescription ?? ""} onChange={(v) => patchCh({ releasedParticleSizeDescription: v })} disabled={dis} />
          <RcAreaField label="Important-radionuclides justification" value={ch.importantRadionuclidesJustification ?? ""} onChange={(v) => patchCh({ importantRadionuclidesJustification: v })} disabled={dis} rows={2} />
          <RcStringList label="Important radionuclides" values={ch.importantRadionuclides ?? []} onChange={(v) => patchCh({ importantRadionuclides: v })} disabled={dis} />
          <RcAreaField label="Hazards impacting protective actions" value={ch.hazardsImpactingProtectiveActions ?? ""} onChange={(v) => patchCh({ hazardsImpactingProtectiveActions: v })} disabled={dis} rows={2} />
          <RcAreaField label="Release uncertainties" value={ch.releaseUncertainties ?? ""} onChange={(v) => patchCh({ releaseUncertainties: v })} disabled={dis} rows={2} />
          <div className="posfield">
            <label className="posfield__label">Radionuclide group fractions</label>
            <table className="postable">
              <thead><tr><th>Group</th><th>Fraction</th>{editable && <th />}</tr></thead>
              <tbody>
                {fractions.map((g, i) => (
                  <tr key={i}>
                    <td><WorkbookInput className="posfield__input posmono" value={g.group} disabled={dis} onChange={(e) => patchCh({ radionuclideGroupFractions: fractions.map((y, j) => (j === i ? { ...y, group: e.target.value } : y)) })} /></td>
                    <td><WorkbookInput className="posfield__input posmono" type="number" step="any" value={g.fraction} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchCh({ radionuclideGroupFractions: fractions.map((y, j) => (j === i ? { ...y, fraction: v } : y)) }); }} /></td>
                    {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchCh({ radionuclideGroupFractions: [...fractions.slice(0, i), ...fractions.slice(i + 1)] })}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => patchCh({ radionuclideGroupFractions: [...fractions, { group: "New group", fraction: 0 }] })}><RCIcon.Plus /> Add group</button>}
          </div>
          <div className="posfield">
            <label className="posfield__label">Release phase timings</label>
            <table className="postable">
              <thead><tr><th>Start</th><th>Duration</th><th>Unit</th>{editable && <th />}</tr></thead>
              <tbody>
                {timings.map((t, i) => (
                  <tr key={i}>
                    <td><WorkbookInput className="posfield__input posmono" type="number" step="any" value={t.startTime} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchCh({ releasePhaseTimings: timings.map((y, j) => (j === i ? { ...y, startTime: v } : y)) }); }} /></td>
                    <td><WorkbookInput className="posfield__input posmono" type="number" step="any" value={t.duration} disabled={dis} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchCh({ releasePhaseTimings: timings.map((y, j) => (j === i ? { ...y, duration: v } : y)) }); }} /></td>
                    <td><WorkbookInput className="posfield__input" style={{ width: 56 }} value={t.timeUnit ?? "h"} disabled={dis} onChange={(e) => patchCh({ releasePhaseTimings: timings.map((y, j) => (j === i ? { ...y, timeUnit: e.target.value } : y)) })} /></td>
                    {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchCh({ releasePhaseTimings: [...timings.slice(0, i), ...timings.slice(i + 1)] })}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => patchCh({ releasePhaseTimings: [...timings, { startTime: 0, duration: 0, timeUnit: "h" }] })}><RCIcon.Plus /> Add phase</button>}
          </div>
          {editable && <RemoveBtn label="Remove category" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "site") {
    if (!rcc.siteInformation.isBounding) return null;
    const bs = rcc.siteInformation.boundingSite;
    const patch = (next: Partial<typeof bs>): void => mutateRc((d) => {
      if (!d.releaseCategoryToConsequence.siteInformation.isBounding) return d;
      return { ...d, releaseCategoryToConsequence: { ...d.releaseCategoryToConsequence, siteInformation: { isBounding: true, boundingSite: { ...d.releaseCategoryToConsequence.siteInformation.boundingSite, ...next } } } };
    });
    const chars = bs.characteristics;
    const patchChars = (next: Partial<typeof chars>): void => patch({ characteristics: { ...chars, ...next } });
    const extra = chars.additionalCharacteristics ?? [];
    return (
      <>
        <DrawerHead cap="Bounding site" title="Bounding-site characteristics" sub="RCRE-A1" onClose={onClose} />
        <div className="posdrawer__body">
          <RcAreaField label="Description" value={bs.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <RcAreaField label="Bounding justification" value={bs.boundingJustification} onChange={(v) => patch({ boundingJustification: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <RcNumberField label="Site boundary distance (m)" value={chars.siteBoundaryDistance ?? 0} onChange={(v) => patchChars({ siteBoundaryDistance: v })} disabled={dis} />
            <RcNumberField label="Population centre distance (km)" value={chars.populationCentreDistance ?? 0} onChange={(v) => patchChars({ populationCentreDistance: v })} disabled={dis} />
          </div>
          <RcTextField label="Terrain" value={chars.terrain ?? ""} onChange={(v) => patchChars({ terrain: v })} disabled={dis} />
          <RcStringList label="Bounded sites" values={bs.boundedSites ?? []} onChange={(v) => patch({ boundedSites: v })} disabled={dis} />
          <div className="posfield">
            <label className="posfield__label">Additional characteristics</label>
            <table className="postable">
              <thead><tr><th>Name</th><th>Value</th>{editable && <th />}</tr></thead>
              <tbody>
                {extra.map((a, i) => (
                  <tr key={i}>
                    <td><WorkbookInput className="posfield__input" value={a.name} disabled={dis} onChange={(e) => patchChars({ additionalCharacteristics: extra.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} /></td>
                    <td><WorkbookInput className="posfield__input" value={a.value} disabled={dis} onChange={(e) => patchChars({ additionalCharacteristics: extra.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)) })} /></td>
                    {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchChars({ additionalCharacteristics: [...extra.slice(0, i), ...extra.slice(i + 1)] })}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => patchChars({ additionalCharacteristics: [...extra, { name: "New characteristic", value: "" }] })}><RCIcon.Plus /> Add characteristic</button>}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "protaction") {
    const idx = Number(context.id);
    const a = pa.protectiveActionsIncluded[idx];
    if (a === undefined) return null;
    const patch = (next: Partial<typeof a>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, protectiveActionsIncluded: d.protectiveActionParameters.protectiveActionsIncluded.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, protectiveActionsIncluded: d.protectiveActionParameters.protectiveActionsIncluded.filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Protective action" title={a.action} onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Action" value={a.action} options={PROT_ACTION_OPTIONS} onChange={(v) => patch({ action: v as typeof a.action })} disabled={dis} />
          <RcSelectField label="Included" value={a.included ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ included: v === "yes" })} disabled={dis} />
          <RcAreaField label="Applicability justification" value={a.applicabilityJustification ?? ""} onChange={(v) => patch({ applicabilityJustification: v })} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove action" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "cohort") {
    const idx = Number(context.id);
    const cohorts = pa.cohortModeling.cohorts ?? [];
    const c = cohorts[idx];
    if (c === undefined) return null;
    const patch = (next: Partial<typeof c>): void => mutateRc((d) => { const cm = d.protectiveActionParameters.cohortModeling; return { ...d, protectiveActionParameters: { ...d.protectiveActionParameters, cohortModeling: { ...cm, cohorts: (cm.cohorts ?? []).map((x, j) => (j === idx ? { ...x, ...next } : x)) } } }; });
    const remove = (): void => { mutateRc((d) => { const cm = d.protectiveActionParameters.cohortModeling; return { ...d, protectiveActionParameters: { ...d.protectiveActionParameters, cohortModeling: { ...cm, cohorts: (cm.cohorts ?? []).filter((_, j) => j !== idx) } } }; }); onClose(); };
    return (
      <>
        <DrawerHead cap="Cohort" title={c.name} onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Cohort modeling approach" value={pa.cohortModeling.approach} options={COHORT_APPROACH_OPTIONS} onChange={(v) => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, cohortModeling: { ...d.protectiveActionParameters.cohortModeling, approach: v as typeof pa.cohortModeling.approach } } }))} disabled={dis} />
          <RcTextField label="Name" value={c.name} onChange={(v) => patch({ name: v })} disabled={dis} />
          <RcAreaField label="Description" value={c.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <RcAreaField label="Compliance assumption" value={c.complianceAssumption ?? ""} onChange={(v) => patch({ complianceAssumption: v })} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove cohort" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "sourcedoc") {
    const idx = Number(context.id);
    const doc = pa.sourceDocuments[idx];
    if (doc === undefined) return null;
    const patch = (next: Partial<typeof doc>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, sourceDocuments: d.protectiveActionParameters.sourceDocuments.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, sourceDocuments: d.protectiveActionParameters.sourceDocuments.filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Source document" title={doc.document} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Document" value={doc.document} onChange={(v) => patch({ document: v })} disabled={dis} />
          <RcAreaField label="Usage" value={doc.usage} onChange={(v) => patch({ usage: v })} disabled={dis} rows={2} />
          <RcAreaField label="Justification" value={doc.justification ?? ""} onChange={(v) => patch({ justification: v })} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove document" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "phase") {
    const p = pa.incidentPhasesModeled.find((x) => x.phase === context.id);
    if (p === undefined) return null;
    const patch = (next: Partial<typeof p>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, incidentPhasesModeled: d.protectiveActionParameters.incidentPhasesModeled.map((x) => (x.phase === p.phase ? { ...x, ...next } : x)) } }));
    return (
      <>
        <DrawerHead cap="Incident phase" title={p.phase} onClose={onClose} />
        <div className="posdrawer__body">
          <RcAreaField label="Criteria description" value={p.criteriaDescription} onChange={(v) => patch({ criteriaDescription: v })} disabled={dis} rows={3} />
        </div>
      </>
    );
  }

  if (context.kind === "evacdelay") {
    const idx = Number(context.id);
    const comps = pa.evacuationDelayComponents ?? [];
    const l = comps[idx];
    if (l === undefined) return null;
    const patch = (next: Partial<typeof l>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, evacuationDelayComponents: (d.protectiveActionParameters.evacuationDelayComponents ?? []).map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, evacuationDelayComponents: (d.protectiveActionParameters.evacuationDelayComponents ?? []).filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Evacuation delay link" title={l.component} onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Component" value={l.component} options={EVAC_COMPONENT_OPTIONS} onChange={(v) => patch({ component: v as typeof l.component })} disabled={dis} />
          <RcTextField label="Estimate" value={l.estimate} onChange={(v) => patch({ estimate: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove link" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "protparam") {
    const idx = Number(context.id);
    const params = pa.protectionParameters ?? [];
    const p = params[idx];
    if (p === undefined) return null;
    const patch = (next: Partial<typeof p>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, protectionParameters: (d.protectiveActionParameters.protectionParameters ?? []).map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, protectionParameters: (d.protectiveActionParameters.protectionParameters ?? []).filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Protection parameter" title={p.parameter} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Parameter" value={p.parameter} onChange={(v) => patch({ parameter: v })} disabled={dis} />
          <RcTextField label="Value" value={p.value} onChange={(v) => patch({ value: v })} disabled={dis} />
          <RcAreaField label="Source" value={p.source} onChange={(v) => patch({ source: v })} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove parameter" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "sitedata") {
    if (context.id === "pop") {
      const p = pa.populationDistribution;
      const patch = (next: Partial<typeof p>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, populationDistribution: { ...d.protectiveActionParameters.populationDistribution, ...next } } }));
      return (
        <>
          <DrawerHead cap="Site data" title="Population distribution" sub="RCPA-B1" onClose={onClose} />
          <div className="posdrawer__body">
            <RcSelectField label="Basis" value={p.basis} options={POP_BASIS_OPTIONS} onChange={(v) => patch({ basis: v as typeof p.basis })} disabled={dis} />
            <RcAreaField label="Description" value={p.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
            <RcAreaField label="Justification" value={p.justification ?? ""} onChange={(v) => patch({ justification: v })} disabled={dis} rows={2} />
            <RcTextField label="Projection adjustments" value={p.projectionAdjustments ?? ""} onChange={(v) => patch({ projectionAdjustments: v })} disabled={dis} />
          </div>
        </>
      );
    }
    if (context.id === "land") {
      const l = pa.landUseData;
      const patch = (next: Partial<typeof l>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, landUseData: { ...d.protectiveActionParameters.landUseData, ...next } } }));
      return (
        <>
          <DrawerHead cap="Site data" title="Land use" sub="RCPA-B2" onClose={onClose} />
          <div className="posdrawer__body">
            <RcSelectField label="Basis" value={l.basis} options={LAND_BASIS_OPTIONS} onChange={(v) => patch({ basis: v as typeof l.basis })} disabled={dis} />
            <RcAreaField label="Description" value={l.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
            <RcTextField label="Intra-regional adjustments" value={l.intraRegionalAdjustments ?? ""} onChange={(v) => patch({ intraRegionalAdjustments: v })} disabled={dis} />
          </div>
        </>
      );
    }
    const b = pa.plantPhysicalCharacteristics;
    const patch = (next: Partial<typeof b>): void => mutateRc((d) => ({ ...d, protectiveActionParameters: { ...d.protectiveActionParameters, plantPhysicalCharacteristics: { ...d.protectiveActionParameters.plantPhysicalCharacteristics, ...next } } }));
    return (
      <>
        <DrawerHead cap="Site data" title="Building dimensions and stack heights" sub="RCPA-B3" onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Basis" value={b.basis} options={PLANT_BASIS_OPTIONS} onChange={(v) => patch({ basis: v as typeof b.basis })} disabled={dis} />
          <RcAreaField label="Description" value={b.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
        </div>
      </>
    );
  }

  if (context.kind === "metdata") {
    const met = rc.meteorologicalData;
    const patch = (next: Partial<typeof met>): void => mutateRc((d) => ({ ...d, meteorologicalData: { ...d.meteorologicalData, ...next } }));
    const dr = met.dataRecovery;
    const patchDr = (next: Partial<typeof dr>): void => patch({ dataRecovery: { ...dr, ...next } });
    const mr = dr.meteorologistReview ?? { performed: false };
    const iq = met.instrumentationQuality ?? { calibratedProgram: true };
    const ar = met.accuracyReview;
    return (
      <>
        <DrawerHead cap="Meteorology" title="Meteorological data quality" sub="RCME-A1 to A4" onClose={onClose} />
        <div className="posdrawer__body">
          <RcAreaField label="Data source" value={met.dataSource} onChange={(v) => patch({ dataSource: v })} disabled={dis} rows={2} />
          <RcAreaField label="Spatial representativeness justification" value={met.spatialRepresentativenessJustification} onChange={(v) => patch({ spatialRepresentativenessJustification: v })} disabled={dis} rows={2} />
          <RcSelectField label="Period-selection approach" value={met.periodSelection.approach} options={PERIOD_APPROACH_OPTIONS} onChange={(v) => patch({ periodSelection: { ...met.periodSelection, approach: v as typeof met.periodSelection.approach } })} disabled={dis} />
          <RcAreaField label="Period-selection description" value={met.periodSelection.periodDescription} onChange={(v) => patch({ periodSelection: { ...met.periodSelection, periodDescription: v } })} disabled={dis} rows={2} />
          <RcNumberField label="Combined data recovery (%)" value={dr.combinedRecoveryPercent ?? 0} onChange={(v) => patchDr({ combinedRecoveryPercent: v, meetsNinetyPercent: v >= 90 })} disabled={dis} />
          <RcAreaField label="Low-recovery justification" value={dr.lowRecoveryJustification ?? ""} onChange={(v) => patchDr({ lowRecoveryJustification: v })} disabled={dis} rows={2} />
          <RcAreaField label="Substitution techniques" value={dr.substitutionTechniques ?? ""} onChange={(v) => patchDr({ substitutionTechniques: v })} disabled={dis} rows={2} />
          <RcSelectField label="Meteorologist review performed" value={mr.performed ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patchDr({ meteorologistReview: { ...mr, performed: v === "yes" } })} disabled={dis} />
          <RcTextField label="Reviewer qualification" value={mr.reviewerQualification ?? ""} onChange={(v) => patchDr({ meteorologistReview: { ...mr, reviewerQualification: v } })} disabled={dis} />
          <RcAreaField label="Review considerations" value={mr.considerations ?? ""} onChange={(v) => patchDr({ meteorologistReview: { ...mr, considerations: v } })} disabled={dis} rows={2} />
          <RcSelectField label="Calibrated instrumentation program" value={iq.calibratedProgram ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ instrumentationQuality: { ...iq, calibratedProgram: v === "yes" } })} disabled={dis} />
          <RcAreaField label="Instrumentation quality" value={iq.description ?? ""} onChange={(v) => patch({ instrumentationQuality: { ...iq, description: v } })} disabled={dis} rows={2} />
          <RcSelectField label="Accuracy review performed" value={ar.performed ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ accuracyReview: { ...ar, performed: v === "yes" } })} disabled={dis} />
          <RcAreaField label="Accuracy review findings" value={ar.findings ?? ""} onChange={(v) => patch({ accuracyReview: { ...ar, findings: v } })} disabled={dis} rows={2} />
          <RcTextField label="Temporal changes accommodation" value={met.temporalChangesAccommodation ?? ""} onChange={(v) => patch({ temporalChangesAccommodation: v })} disabled={dis} />
          <RcTextField label="Time resolution" value={met.timeResolution ?? ""} onChange={(v) => patch({ timeResolution: v })} disabled={dis} />
          <RcAreaField label="Parameter uncertainty characterization" value={met.parameterUncertaintyCharacterization ?? ""} onChange={(v) => patch({ parameterUncertaintyCharacterization: v })} disabled={dis} rows={2} />
        </div>
      </>
    );
  }

  if (context.kind === "metparams") {
    const met = rc.meteorologicalData;
    const patch = (next: Partial<typeof met>): void => mutateRc((d) => ({ ...d, meteorologicalData: { ...d.meteorologicalData, ...next } }));
    const ep = met.extractedParameters;
    return (
      <>
        <DrawerHead cap="Meteorology" title="Extracted parameters" sub="RCME-A5 to A7" onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Wind speed and direction at 10 m" value={ep.windSpeedAndDirection10m ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ extractedParameters: { ...ep, windSpeedAndDirection10m: v === "yes" } })} disabled={dis} />
          <RcSelectField label="Stability class measurement" value={ep.stabilityClassMeasurement ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ extractedParameters: { ...ep, stabilityClassMeasurement: v === "yes" } })} disabled={dis} />
          <RcSelectField label="Precipitation" value={ep.precipitation === true ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ extractedParameters: { ...ep, precipitation: v === "yes" } })} disabled={dis} />
          {met.mixingHeights !== undefined && (
            <>
              <RcSelectField label="Mixing-height scope" value={met.mixingHeights.scope} options={MIXING_SCOPE_OPTIONS} onChange={(v) => patch({ mixingHeights: { scope: v as NonNullable<typeof met.mixingHeights>["scope"], source: met.mixingHeights?.source ?? "" } })} disabled={dis} />
              <RcTextField label="Mixing-height source" value={met.mixingHeights.source} onChange={(v) => patch({ mixingHeights: { scope: met.mixingHeights?.scope ?? "SEASONAL_MORNING_AND_AFTERNOON", source: v } })} disabled={dis} />
            </>
          )}
          <RcSelectField label="Stability classification approach" value={met.stabilityClassificationMethod.approach} options={STABILITY_OPTIONS} onChange={(v) => patch({ stabilityClassificationMethod: { ...met.stabilityClassificationMethod, approach: v as typeof met.stabilityClassificationMethod.approach } })} disabled={dis} />
          <RcAreaField label="Stability classification description" value={met.stabilityClassificationMethod.description} onChange={(v) => patch({ stabilityClassificationMethod: { ...met.stabilityClassificationMethod, description: v } })} disabled={dis} rows={2} />
        </div>
      </>
    );
  }

  if (context.kind === "dispersion") {
    const patch = (next: Partial<typeof ad>): void => mutateRc((d) => ({ ...d, atmosphericTransportAndDispersion: { ...d.atmosphericTransportAndDispersion, ...next } }));
    const ms = ad.meteorologicalSampling;
    return (
      <>
        <DrawerHead cap="Dispersion" title="Dispersion model and sampling" sub="RCAD-A to C" onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Model class" value={ad.dispersionModel.modelClass} options={MODEL_CLASS_OPTIONS} onChange={(v) => patch({ dispersionModel: { ...ad.dispersionModel, modelClass: v as typeof ad.dispersionModel.modelClass } })} disabled={dis} />
          <RcTextField label="Model name" value={ad.dispersionModel.name ?? ""} onChange={(v) => patch({ dispersionModel: { ...ad.dispersionModel, name: v } })} disabled={dis} />
          <RcAreaField label="Model justification" value={ad.dispersionModel.justification} onChange={(v) => patch({ dispersionModel: { ...ad.dispersionModel, justification: v } })} disabled={dis} rows={2} />
          <RcSelectField label="Temporal resolution" value={ad.temporalResolution.approach} options={TEMPORAL_OPTIONS} onChange={(v) => patch({ temporalResolution: { ...ad.temporalResolution, approach: v as typeof ad.temporalResolution.approach } })} disabled={dis} />
          <RcTextField label="Temporal description" value={ad.temporalResolution.description ?? ""} onChange={(v) => patch({ temporalResolution: { ...ad.temporalResolution, description: v } })} disabled={dis} />
          <RcSelectField label="Spatial treatment" value={ad.spatialTreatment.approach} options={SPATIAL_OPTIONS} onChange={(v) => patch({ spatialTreatment: { ...ad.spatialTreatment, approach: v as typeof ad.spatialTreatment.approach } })} disabled={dis} />
          <RcTextField label="Grid description" value={ad.spatialTreatment.gridDescription ?? ""} onChange={(v) => patch({ spatialTreatment: { ...ad.spatialTreatment, gridDescription: v } })} disabled={dis} />
          <RcTextField label="Grid justification" value={ad.spatialTreatment.gridJustification ?? ""} onChange={(v) => patch({ spatialTreatment: { ...ad.spatialTreatment, gridJustification: v } })} disabled={dis} />
          <RcSelectField label="Weather sampling" value={ms.approach} options={SAMPLING_OPTIONS} onChange={(v) => patch({ meteorologicalSampling: { ...ms, approach: v as typeof ms.approach } })} disabled={dis} />
          <RcAreaField label="Sampling technique" value={ms.technique ?? ""} onChange={(v) => patch({ meteorologicalSampling: { ...ms, technique: v } })} disabled={dis} rows={2} />
          <RcNumberField label="Mean-shift percent" value={ms.meanShiftValidation?.meanShiftPercent ?? 0} onChange={(v) => patch({ meteorologicalSampling: { ...ms, meanShiftValidation: { performed: ms.meanShiftValidation?.performed ?? true, meanShiftPercent: v, justification: ms.meanShiftValidation?.justification } } })} disabled={dis} />
          <RcSelectField label="Plume rise credited" value={ad.plumeRise.credited ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ plumeRise: { ...ad.plumeRise, credited: v === "yes" } })} disabled={dis} />
          <RcTextField label="Plume-rise algorithms" value={ad.plumeRise.algorithmsDescription ?? ""} onChange={(v) => patch({ plumeRise: { ...ad.plumeRise, algorithmsDescription: v } })} disabled={dis} />
          <RcTextField label="Elevated-release algorithms" value={ad.elevatedReleaseAlgorithms ?? ""} onChange={(v) => patch({ elevatedReleaseAlgorithms: v })} disabled={dis} />
          <RcTextField label="Building-wake effects" value={ad.buildingWakeEffects ?? ""} onChange={(v) => patch({ buildingWakeEffects: v })} disabled={dis} />
          <RcSelectField label="Plume segmentation" value={ad.plumeSegmentation.approach} options={SEGMENTATION_OPTIONS} onChange={(v) => patch({ plumeSegmentation: { ...ad.plumeSegmentation, approach: v as typeof ad.plumeSegmentation.approach } })} disabled={dis} />
        </div>
      </>
    );
  }

  if (context.kind === "deposition") {
    const dep = ad.deposition;
    const patch = (next: Partial<typeof dep>): void => mutateRc((d) => ({ ...d, atmosphericTransportAndDispersion: { ...d.atmosphericTransportAndDispersion, deposition: { ...d.atmosphericTransportAndDispersion.deposition, ...next } } }));
    const vels = dep.dryDeposition.velocities ?? [];
    const wash = dep.wetDeposition.washoutCoefficients ?? [];
    return (
      <>
        <DrawerHead cap="Deposition" title="Deposition matrix" sub="RCAD-E1 to E7" onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Dry deposition included" value={dep.dryDeposition.included ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ dryDeposition: { ...dep.dryDeposition, included: v === "yes" } })} disabled={dis} />
          <RcSelectField label="Dry deposition approach" value={dep.dryDeposition.approach ?? "SINGLE_VELOCITY"} options={DRY_APPROACH_OPTIONS} onChange={(v) => patch({ dryDeposition: { ...dep.dryDeposition, approach: v as NonNullable<typeof dep.dryDeposition.approach> } })} disabled={dis} />
          <div className="posfield">
            <label className="posfield__label">Dry-deposition velocities (m/s)</label>
            <table className="postable">
              <thead><tr><th>Particle size</th><th>Velocity</th>{editable && <th />}</tr></thead>
              <tbody>
                {vels.map((vv, i) => (
                  <tr key={i}>
                    <td><WorkbookInput className="posfield__input" value={vv.particleSize ?? ""} disabled={dis} onChange={(e) => patch({ dryDeposition: { ...dep.dryDeposition, velocities: vels.map((y, j) => (j === i ? { ...y, particleSize: e.target.value } : y)) } })} /></td>
                    <td><WorkbookInput className="posfield__input posmono" type="number" step="any" value={vv.velocity} disabled={dis} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ dryDeposition: { ...dep.dryDeposition, velocities: vels.map((y, j) => (j === i ? { ...y, velocity: n } : y)) } }); }} /></td>
                    {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ dryDeposition: { ...dep.dryDeposition, velocities: [...vels.slice(0, i), ...vels.slice(i + 1)] } })}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => patch({ dryDeposition: { ...dep.dryDeposition, velocities: [...vels, { particleSize: "New size", velocity: 0 }] } })}><RCIcon.Plus /> Add velocity</button>}
          </div>
          <RcSelectField label="Wet deposition included" value={dep.wetDeposition.included ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ wetDeposition: { ...dep.wetDeposition, included: v === "yes" } })} disabled={dis} />
          <RcSelectField label="Precipitation-intensity dependent" value={dep.wetDeposition.precipitationIntensityDependent === true ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ wetDeposition: { ...dep.wetDeposition, precipitationIntensityDependent: v === "yes" } })} disabled={dis} />
          <div className="posfield">
            <label className="posfield__label">Washout coefficients (1/s)</label>
            <table className="postable">
              <thead><tr><th>Condition</th><th>Coefficient</th>{editable && <th />}</tr></thead>
              <tbody>
                {wash.map((w, i) => (
                  <tr key={i}>
                    <td><WorkbookInput className="posfield__input" value={w.condition} disabled={dis} onChange={(e) => patch({ wetDeposition: { ...dep.wetDeposition, washoutCoefficients: wash.map((y, j) => (j === i ? { ...y, condition: e.target.value } : y)) } })} /></td>
                    <td><WorkbookInput className="posfield__input posmono" type="number" step="any" value={w.coefficient} disabled={dis} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ wetDeposition: { ...dep.wetDeposition, washoutCoefficients: wash.map((y, j) => (j === i ? { ...y, coefficient: n } : y)) } }); }} /></td>
                    {editable && <td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ wetDeposition: { ...dep.wetDeposition, washoutCoefficients: [...wash.slice(0, i), ...wash.slice(i + 1)] } })}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => patch({ wetDeposition: { ...dep.wetDeposition, washoutCoefficients: [...wash, { condition: "New condition", coefficient: 0 }] } })}><RCIcon.Plus /> Add coefficient</button>}
          </div>
          <RcSelectField label="Source depletion included" value={dep.sourceDepletion.included ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ sourceDepletion: { ...dep.sourceDepletion, included: v === "yes" } })} disabled={dis} />
          <RcSelectField label="Depletion scope" value={dep.sourceDepletion.scope ?? "DRY_AND_WET"} options={DEPLETION_SCOPE_OPTIONS} onChange={(v) => patch({ sourceDepletion: { ...dep.sourceDepletion, scope: v as NonNullable<typeof dep.sourceDepletion.scope> } })} disabled={dis} />
          <RcSelectField label="Resuspension included" value={dep.resuspension.included ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ resuspension: { ...dep.resuspension, included: v === "yes" } })} disabled={dis} />
          <RcTextField label="Resuspension description" value={dep.resuspension.description ?? ""} onChange={(v) => patch({ resuspension: { ...dep.resuspension, description: v } })} disabled={dis} />
        </div>
      </>
    );
  }

  if (context.kind === "pathway") {
    const idx = Number(context.id);
    const p = rc.dosimetry.exposurePathways[idx];
    if (p === undefined) return null;
    const patch = (next: Partial<typeof p>): void => mutateRc((d) => ({ ...d, dosimetry: { ...d.dosimetry, exposurePathways: d.dosimetry.exposurePathways.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, dosimetry: { ...d.dosimetry, exposurePathways: d.dosimetry.exposurePathways.filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Exposure pathway" title={p.pathway} onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Pathway" value={p.pathway} options={PATHWAY_OPTIONS} onChange={(v) => patch({ pathway: v as typeof p.pathway })} disabled={dis} />
          <RcSelectField label="Included" value={p.included ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ included: v === "yes" })} disabled={dis} />
          <RcAreaField label="Exclusion justification" value={p.exclusionJustification ?? ""} onChange={(v) => patch({ exclusionJustification: v })} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove pathway" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "dosetreatment") {
    const dose = rc.dosimetry;
    const patch = (next: Partial<typeof dose>): void => mutateRc((d) => ({ ...d, dosimetry: { ...d.dosimetry, ...next } }));
    return (
      <>
        <DrawerHead cap="Dosimetry" title="Dose treatment" sub="RCDO-A4 to B1" onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Cloud immersion model" value={dose.cloudImmersionModel.approach} options={IMMERSION_OPTIONS} onChange={(v) => patch({ cloudImmersionModel: { ...dose.cloudImmersionModel, approach: v as typeof dose.cloudImmersionModel.approach } })} disabled={dis} />
          <RcTextField label="Cloud immersion description" value={dose.cloudImmersionModel.description ?? ""} onChange={(v) => patch({ cloudImmersionModel: { ...dose.cloudImmersionModel, description: v } })} disabled={dis} />
          <RcSelectField label="Breathing rates" value={dose.breathingRates.approach} options={BREATHING_OPTIONS} onChange={(v) => patch({ breathingRates: { ...dose.breathingRates, approach: v as typeof dose.breathingRates.approach } })} disabled={dis} />
          <RcTextField label="Breathing rates description" value={dose.breathingRates.description ?? ""} onChange={(v) => patch({ breathingRates: { ...dose.breathingRates, description: v } })} disabled={dis} />
          <RcSelectField label="Ingestion treatment" value={dose.ingestionTreatment.approach} options={INGESTION_OPTIONS} onChange={(v) => patch({ ingestionTreatment: { ...dose.ingestionTreatment, approach: v as typeof dose.ingestionTreatment.approach } })} disabled={dis} />
          <RcTextField label="Ingestion description" value={dose.ingestionTreatment.description ?? ""} onChange={(v) => patch({ ingestionTreatment: { ...dose.ingestionTreatment, description: v } })} disabled={dis} />
          <RcAreaField label="Dose-conversion source" value={dose.dcf.source} onChange={(v) => patch({ dcf: { ...dose.dcf, source: v } })} disabled={dis} rows={2} />
          <RcSelectField label="Dose-conversion type" value={dose.dcf.type} options={DCF_TYPE_OPTIONS} onChange={(v) => patch({ dcf: { ...dose.dcf, type: v as typeof dose.dcf.type } })} disabled={dis} />
          <RcTextField label="Groundshine integration" value={dose.groundshineIntegration ?? ""} onChange={(v) => patch({ groundshineIntegration: v })} disabled={dis} />
          <RcTextField label="Skin beta treatment" value={dose.skinBetaTreatment ?? ""} onChange={(v) => patch({ skinBetaTreatment: v })} disabled={dis} />
          <RcTextField label="Dose aggregation method" value={dose.doseAggregationMethod ?? ""} onChange={(v) => patch({ doseAggregationMethod: v })} disabled={dis} />
        </div>
      </>
    );
  }

  if (context.kind === "healthparams") {
    const he = rc.healthEffects;
    const patch = (next: Partial<typeof he>): void => mutateRc((d) => ({ ...d, healthEffects: { ...d.healthEffects, ...next } }));
    return (
      <>
        <DrawerHead cap="Health effects" title="Effect parameters" sub="RCHE-A2 to A4" onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Early-effect approach" value={he.earlyEffectParameters.approach} options={EARLY_EFFECT_OPTIONS} onChange={(v) => patch({ earlyEffectParameters: { ...he.earlyEffectParameters, approach: v as typeof he.earlyEffectParameters.approach } })} disabled={dis} />
          <RcAreaField label="Early-effect description" value={he.earlyEffectParameters.description} onChange={(v) => patch({ earlyEffectParameters: { ...he.earlyEffectParameters, description: v } })} disabled={dis} rows={2} />
          <RcSelectField label="Latent-effect approach" value={he.latentEffectParameters.approach} options={LATENT_EFFECT_OPTIONS} onChange={(v) => patch({ latentEffectParameters: { ...he.latentEffectParameters, approach: v as typeof he.latentEffectParameters.approach } })} disabled={dis} />
          <RcAreaField label="Latent-effect description" value={he.latentEffectParameters.description} onChange={(v) => patch({ latentEffectParameters: { ...he.latentEffectParameters, description: v } })} disabled={dis} rows={2} />
          <RcSelectField label="Age and gender homogeneous" value={he.ageGenderHomogeneous ? "yes" : "no"} options={YESNO_OPTIONS} onChange={(v) => patch({ ageGenderHomogeneous: v === "yes" })} disabled={dis} />
        </div>
      </>
    );
  }

  if (context.kind === "riskfactor") {
    const idx = Number(context.id);
    const r = rc.healthEffects.riskFactorSources[idx];
    if (r === undefined) return null;
    const patch = (next: Partial<typeof r>): void => mutateRc((d) => ({ ...d, healthEffects: { ...d.healthEffects, riskFactorSources: d.healthEffects.riskFactorSources.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, healthEffects: { ...d.healthEffects, riskFactorSources: d.healthEffects.riskFactorSources.filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Risk-factor source" title={r.source} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Source" value={r.source} onChange={(v) => patch({ source: v })} disabled={dis} />
          <RcTextField label="Recognized body" value={r.recognizedBody} onChange={(v) => patch({ recognizedBody: v })} disabled={dis} />
          <RcTextField label="Version" value={r.version ?? ""} onChange={(v) => patch({ version: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove source" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "costcategory") {
    const idx = Number(context.id);
    const c = rc.economicFactors.costCategories[idx];
    if (c === undefined) return null;
    const patch = (next: Partial<typeof c>): void => mutateRc((d) => ({ ...d, economicFactors: { ...d.economicFactors, costCategories: d.economicFactors.costCategories.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, economicFactors: { ...d.economicFactors, costCategories: d.economicFactors.costCategories.filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Cost category" title={c.category} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Category" value={c.category} onChange={(v) => patch({ category: v })} disabled={dis} />
          <RcStringList label="Parameter definitions" values={c.parameterDefinitions} onChange={(v) => patch({ parameterDefinitions: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove category" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "costparam") {
    const idx = Number(context.id);
    const e = rc.economicFactors.costParameterEstimates[idx];
    if (e === undefined) return null;
    const patch = (next: Partial<typeof e>): void => mutateRc((d) => ({ ...d, economicFactors: { ...d.economicFactors, costParameterEstimates: d.economicFactors.costParameterEstimates.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, economicFactors: { ...d.economicFactors, costParameterEstimates: d.economicFactors.costParameterEstimates.filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Economic parameter" title={e.parameter} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Parameter" value={e.parameter} onChange={(v) => patch({ parameter: v })} disabled={dis} />
          <RcSelectField label="Data basis" value={e.dataBasis} options={ECON_BASIS_OPTIONS} onChange={(v) => patch({ dataBasis: v as typeof e.dataBasis })} disabled={dis} />
          <RcAreaField label="Source" value={e.source} onChange={(v) => patch({ source: v })} disabled={dis} rows={2} />
          <RcAreaField label="Justification" value={e.justification ?? ""} onChange={(v) => patch({ justification: v })} disabled={dis} rows={2} />
          <RcTextField label="Time-frame adjustment" value={e.timeFrameAdjustment ?? ""} onChange={(v) => patch({ timeFrameAdjustment: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove parameter" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "code") {
    const idx = Number(context.id);
    const c = rc.consequenceQuantification.consequenceCodesUsed[idx];
    if (c === undefined) return null;
    const patch = (next: Partial<typeof c>): void => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, consequenceCodesUsed: d.consequenceQuantification.consequenceCodesUsed.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, consequenceCodesUsed: d.consequenceQuantification.consequenceCodesUsed.filter((_, j) => j !== idx) } })); onClose(); };
    const allLims = rc.consequenceQuantification.modelAndCodeLimitations;
    const setLims = (rows: typeof allLims): void => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, modelAndCodeLimitations: rows } }));
    const myLims = allLims.map((l, gi) => ({ l, gi })).filter((x) => x.l.code === c.code);
    return (
      <>
        <DrawerHead cap="Consequence code" title={c.code} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Code" value={c.code} onChange={(v) => patch({ code: v })} disabled={dis} />
          <RcAreaField label="Benchmark basis" value={c.benchmarkBasis ?? ""} onChange={(v) => patch({ benchmarkBasis: v })} disabled={dis} rows={2} />
          <div className="posfield">
            <label className="posfield__label">Model and code limitations</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myLims.length === 0 && <p className="posmuted" style={{ margin: 0 }}>No limitations recorded for this code.</p>}
              {myLims.map(({ l, gi }) => (
                <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 8, borderBottom: "1px dashed var(--color-border)", paddingBottom: 8 }}>
                  <RcTextField label="Feature" value={l.feature} onChange={(v) => setLims(allLims.map((y, k) => (k === gi ? { ...y, feature: v } : y)))} disabled={dis} />
                  <RcAreaField label="Limitation" value={l.limitation} onChange={(v) => setLims(allLims.map((y, k) => (k === gi ? { ...y, limitation: v } : y)))} disabled={dis} rows={2} />
                  <RcTextField label="Justification" value={l.justification ?? ""} onChange={(v) => setLims(allLims.map((y, k) => (k === gi ? { ...y, justification: v } : y)))} disabled={dis} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setLims(allLims.filter((_, k) => k !== gi))}>Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setLims([...allLims, { code: c.code, feature: "New feature", limitation: "" }])}><RCIcon.Plus /> Add limitation</button>}
            </div>
          </div>
          {editable && <RemoveBtn label="Remove code" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "family") {
    const f = rc.consequenceQuantification.eventSequenceConsequences.find((x) => x.eventSequenceFamily === context.id);
    if (f === undefined) return null;
    const patch = (next: Partial<typeof f>): void => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, eventSequenceConsequences: d.consequenceQuantification.eventSequenceConsequences.map((x) => (x.eventSequenceFamily === f.eventSequenceFamily ? { ...x, ...next } : x)) } }));
    const results = f.consequenceResults;
    const remove = (): void => { mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, eventSequenceConsequences: d.consequenceQuantification.eventSequenceConsequences.filter((x) => x.eventSequenceFamily !== f.eventSequenceFamily) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Event sequence family" title={f.eventSequenceFamily} sub={f.releaseCategoryReference} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RcTextField label="Family" value={f.eventSequenceFamily} onChange={(v) => patch({ eventSequenceFamily: v })} disabled={dis} />
            <RcSelectField label="Release category" value={f.releaseCategoryReference ?? ""} options={[["", "None"], ...catOptions]} onChange={(v) => patch({ releaseCategoryReference: v.length > 0 ? v : undefined })} disabled={dis} />
          </div>
          <div className="posfield-grid">
            <RcTextField label="Source-term reference" value={f.sourceTermReference ?? ""} onChange={(v) => patch({ sourceTermReference: v })} disabled={dis} />
            <RcSelectField label="Risk significance" value={f.riskSignificance ?? "LOW"} options={SIG_OPTIONS} onChange={(v) => patch({ riskSignificance: v as ImportanceLevel })} disabled={dis} />
          </div>
          <div className="posfield">
            <label className="posfield__label">Consequence results</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map((m, i) => {
                const median = m.uncertaintyDistribution?.type === DistributionType.LOGNORMAL ? m.uncertaintyDistribution.median : undefined;
                const ef = m.uncertaintyDistribution?.type === DistributionType.LOGNORMAL ? m.uncertaintyDistribution.errorFactor : undefined;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, borderBottom: "1px dashed var(--color-border)", paddingBottom: 8 }}>
                    <div className="posrow" style={{ gap: 6 }}>
                      <WorkbookInput className="posfield__input" style={{ flex: 2 }} value={m.metric} disabled={dis} onChange={(e) => patch({ consequenceResults: results.map((y, j) => (j === i ? { ...y, metric: e.target.value } : y)) })} />
                      <WorkbookInput className="posfield__input posmono" style={{ width: 90 }} type="number" step="any" value={m.meanValue} disabled={dis} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ consequenceResults: results.map((y, j) => (j === i ? { ...y, meanValue: n } : y)) }); }} />
                      <WorkbookInput className="posfield__input" style={{ width: 80 }} value={m.unit ?? ""} disabled={dis} onChange={(e) => patch({ consequenceResults: results.map((y, j) => (j === i ? { ...y, unit: e.target.value } : y)) })} />
                      {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ consequenceResults: [...results.slice(0, i), ...results.slice(i + 1)] })}>Remove</button>}
                    </div>
                    <div className="posrow" style={{ gap: 6 }}>
                      <WorkbookInput className="posfield__input posmono" style={{ width: 110 }} type="number" step="any" placeholder="median" value={median ?? ""} disabled={dis} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ consequenceResults: results.map((y, j) => (j === i ? { ...y, uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: n, errorFactor: ef ?? 3 } } : y)) }); }} />
                      <WorkbookInput className="posfield__input posmono" style={{ width: 90 }} type="number" step="any" placeholder="EF" value={ef ?? ""} disabled={dis} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) patch({ consequenceResults: results.map((y, j) => (j === i ? { ...y, uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: median ?? 0, errorFactor: n } } : y)) }); }} />
                      <WorkbookInput className="posfield__input" style={{ flex: 1 }} placeholder="description" value={m.uncertaintyDescription ?? ""} disabled={dis} onChange={(e) => patch({ consequenceResults: results.map((y, j) => (j === i ? { ...y, uncertaintyDescription: e.target.value } : y)) })} />
                    </div>
                  </div>
                );
              })}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patch({ consequenceResults: [...results, { metric: "New metric", meanValue: 0, unit: "per event" }] })}><RCIcon.Plus /> Add result</button>}
            </div>
          </div>
          {editable && <RemoveBtn label="Remove family" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "uncertainty") {
    const idx = Number(context.id);
    const u = rc.consequenceQuantification.modelUncertaintyAssessments[idx];
    if (u === undefined) return null;
    const patch = (next: Partial<typeof u>): void => mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, modelUncertaintyAssessments: d.consequenceQuantification.modelUncertaintyAssessments.map((x, j) => (j === idx ? { ...x, ...next } : x)) } }));
    const remove = (): void => { mutateRc((d) => ({ ...d, consequenceQuantification: { ...d.consequenceQuantification, modelUncertaintyAssessments: d.consequenceQuantification.modelUncertaintyAssessments.filter((_, j) => j !== idx) } })); onClose(); };
    return (
      <>
        <DrawerHead cap="Model uncertainty" title={u.uncertaintySource} onClose={onClose} />
        <div className="posdrawer__body">
          <RcSelectField label="Source sub-element" value={u.sourceSubElement} options={SUB_ELEMENT_OPTIONS} onChange={(v) => patch({ sourceSubElement: v as RcSubElement })} disabled={dis} />
          <RcTextField label="Uncertainty source" value={u.uncertaintySource} onChange={(v) => patch({ uncertaintySource: v })} disabled={dis} />
          <div className="posfield-grid">
            <RcSelectField label="Evaluation type" value={u.evaluationType} options={EVAL_TYPE_OPTIONS} onChange={(v) => patch({ evaluationType: v as typeof u.evaluationType })} disabled={dis} />
            <RcSelectField label="Evaluation scope" value={u.evaluationScope} options={EVAL_SCOPE_OPTIONS} onChange={(v) => patch({ evaluationScope: v as typeof u.evaluationScope })} disabled={dis} />
          </div>
          <RcAreaField label="Effect on metrics" value={u.effectOnMetrics} onChange={(v) => patch({ effectOnMetrics: v })} disabled={dis} rows={2} />
          <RcStringList label="Related assumptions" values={u.relatedAssumptions} onChange={(v) => patch({ relatedAssumptions: v })} disabled={dis} />
          <RcStringList label="Reasonable alternatives" values={u.reasonableAlternatives ?? []} onChange={(v) => patch({ reasonableAlternatives: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove uncertainty" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "sensitivity") {
    const st = (rc.sensitivityStudies ?? []).find((x) => x.uuid === context.id);
    if (st === undefined) return null;
    const patch = (next: Partial<typeof st>): void => mutateRc((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).map((x) => (x.uuid === st.uuid ? { ...x, ...next } : x)) }));
    const remove = (): void => { mutateRc((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).filter((x) => x.uuid !== st.uuid) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Sensitivity study" title={st.name ?? st.uuid} sub={st.uuid} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Name" value={st.name ?? ""} onChange={(v) => patch({ name: v })} disabled={dis} />
          <RcAreaField label="Description" value={st.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <RcStringList label="Varied parameters" values={st.variedParameters} onChange={(v) => patch({ variedParameters: v })} disabled={dis} />
          <RcAreaField label="Results" value={st.results ?? ""} onChange={(v) => patch({ results: v })} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove study" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "bounding") {
    const a = (rc.boundingSiteAssumptions ?? []).find((x) => x.assumptionId === context.id);
    if (a === undefined) return null;
    const patch = (next: Partial<typeof a>): void => mutateRc((d) => ({ ...d, boundingSiteAssumptions: (d.boundingSiteAssumptions ?? []).map((x) => (x.assumptionId === a.assumptionId ? { ...x, ...next } : x)) }));
    const remove = (): void => { mutateRc((d) => ({ ...d, boundingSiteAssumptions: (d.boundingSiteAssumptions ?? []).filter((x) => x.assumptionId !== a.assumptionId) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Bounding-site assumption" title={a.influenceOnDefinition} sub={a.assumptionId} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Area of influence" value={a.influenceOnDefinition} onChange={(v) => patch({ influenceOnDefinition: v })} disabled={dis} />
          <RcAreaField label="Description" value={a.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <RcSelectField label="Status" value={a.status} options={STATUS_OPTIONS} onChange={(v) => patch({ status: v as typeof a.status })} disabled={dis} />
            <RcSelectField label="Risk impact" value={a.riskImpact ?? "MEDIUM"} options={SIG_OPTIONS} onChange={(v) => patch({ riskImpact: v as ImportanceLevel })} disabled={dis} />
          </div>
          <RcAreaField label="Closure basis" value={a.closureBasis ?? ""} onChange={(v) => patch({ closureBasis: v })} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove assumption" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "preop") {
    const a = (rc.preOperationalAssumptions ?? []).find((x) => x.assumptionId === context.id);
    if (a === undefined) return null;
    const patch = (next: Partial<typeof a>): void => mutateRc((d) => ({ ...d, preOperationalAssumptions: (d.preOperationalAssumptions ?? []).map((x) => (x.assumptionId === a.assumptionId ? { ...x, ...next } : x)) }));
    const remove = (): void => { mutateRc((d) => ({ ...d, preOperationalAssumptions: (d.preOperationalAssumptions ?? []).filter((x) => x.assumptionId !== a.assumptionId) })); onClose(); };
    return (
      <>
        <DrawerHead cap="Pre-operational assumption" title={a.influenceOnDefinition} sub={a.assumptionId} onClose={onClose} />
        <div className="posdrawer__body">
          <RcTextField label="Area of influence" value={a.influenceOnDefinition} onChange={(v) => patch({ influenceOnDefinition: v })} disabled={dis} />
          <RcAreaField label="Description" value={a.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <RcSelectField label="Status" value={a.status} options={STATUS_OPTIONS} onChange={(v) => patch({ status: v as typeof a.status })} disabled={dis} />
            <RcSelectField label="Risk impact" value={a.riskImpact ?? "MEDIUM"} options={SIG_OPTIONS} onChange={(v) => patch({ riskImpact: v as ImportanceLevel })} disabled={dis} />
          </div>
          <RcAreaField label="Closure basis" value={a.closureBasis ?? ""} onChange={(v) => patch({ closureBasis: v })} disabled={dis} rows={2} />
          <RcStringList label="Limitations" values={a.limitations} onChange={(v) => patch({ limitations: v })} disabled={dis} />
          <RcStringList label="Planned closure actions" values={a.plannedClosureActions} onChange={(v) => patch({ plannedClosureActions: v })} disabled={dis} />
          <RcStringList label="Affected element paths" values={a.affectedElementIds} onChange={(v) => patch({ affectedElementIds: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove assumption" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "rifeedback") {
    const f = rc.riskIntegrationFeedback;
    if (f === undefined) return null;
    const patch = (next: Partial<NonNullable<typeof rc.riskIntegrationFeedback>>): void => mutateRc((d) => (d.riskIntegrationFeedback === undefined ? d : { ...d, riskIntegrationFeedback: { ...d.riskIntegrationFeedback, ...next } }));
    const rcf = f.releaseCategoryFeedback ?? [];
    const mf = f.metricFeedback ?? [];
    const resp = f.response ?? { description: "", changes: [], status: "IN_PROGRESS" as const };
    const remove = (): void => { mutateRc((d) => ({ ...d, riskIntegrationFeedback: undefined })); onClose(); };
    return (
      <>
        <DrawerHead cap="Risk-integration feedback" title="Risk-integration feedback" sub={f.analysisRef} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RcTextField label="Analysis reference" value={f.analysisRef} onChange={(v) => patch({ analysisRef: v })} disabled={dis} />
            <RcTextField label="Feedback date" value={f.feedbackDate ?? ""} onChange={(v) => patch({ feedbackDate: v })} disabled={dis} />
          </div>
          <RcAreaField label="General feedback" value={f.generalFeedback ?? ""} onChange={(v) => patch({ generalFeedback: v })} disabled={dis} rows={2} />
          <div className="posfield">
            <label className="posfield__label">Release-category feedback</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rcf.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span className="rcnum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RcSelectField label="Release category" value={c.releaseCategoryReference} options={catOptions} onChange={(v) => patch({ releaseCategoryFeedback: rcf.map((y, j) => (j === i ? { ...y, releaseCategoryReference: v } : y)) })} disabled={dis} />
                    <RcSelectField label="Risk significance" value={c.riskSignificance ?? "MEDIUM"} options={SIG_OPTIONS} onChange={(v) => patch({ releaseCategoryFeedback: rcf.map((y, j) => (j === i ? { ...y, riskSignificance: v as ImportanceLevel } : y)) })} disabled={dis} />
                    <RcStringList label="Insights" values={c.insights ?? []} onChange={(v) => patch({ releaseCategoryFeedback: rcf.map((y, j) => (j === i ? { ...y, insights: v } : y)) })} disabled={dis} />
                    <RcStringList label="Recommendations" values={c.recommendations ?? []} onChange={(v) => patch({ releaseCategoryFeedback: rcf.map((y, j) => (j === i ? { ...y, recommendations: v } : y)) })} disabled={dis} />
                    <RcSelectField label="Status" value={c.status ?? "PENDING"} options={RI_FB_STATUS_OPTIONS} onChange={(v) => patch({ releaseCategoryFeedback: rcf.map((y, j) => (j === i ? { ...y, status: v as NonNullable<typeof c.status> } : y)) })} disabled={dis} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" style={{ alignSelf: "flex-start" }} onClick={() => patch({ releaseCategoryFeedback: [...rcf.slice(0, i), ...rcf.slice(i + 1)] })}>Remove</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patch({ releaseCategoryFeedback: [...rcf, { releaseCategoryReference: catOptions[0]?.[0] ?? "", riskSignificance: ImportanceLevel.MEDIUM, insights: [], recommendations: [], status: "PENDING" }] })}><RCIcon.Plus /> Add category feedback</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Metric feedback</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {mf.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span className="rcnum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RcTextField label="Metric" value={m.metric} onChange={(v) => patch({ metricFeedback: mf.map((y, j) => (j === i ? { ...y, metric: v } : y)) })} disabled={dis} />
                    <RcSelectField label="Risk significance" value={m.riskSignificance ?? "MEDIUM"} options={SIG_OPTIONS} onChange={(v) => patch({ metricFeedback: mf.map((y, j) => (j === i ? { ...y, riskSignificance: v as ImportanceLevel } : y)) })} disabled={dis} />
                    <RcStringList label="Insights" values={m.insights ?? []} onChange={(v) => patch({ metricFeedback: mf.map((y, j) => (j === i ? { ...y, insights: v } : y)) })} disabled={dis} />
                    <RcStringList label="Recommendations" values={m.recommendations ?? []} onChange={(v) => patch({ metricFeedback: mf.map((y, j) => (j === i ? { ...y, recommendations: v } : y)) })} disabled={dis} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm rcbtn-danger" style={{ alignSelf: "flex-start" }} onClick={() => patch({ metricFeedback: [...mf.slice(0, i), ...mf.slice(i + 1)] })}>Remove</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patch({ metricFeedback: [...mf, { metric: "New metric", riskSignificance: ImportanceLevel.MEDIUM, insights: [], recommendations: [] }] })}><RCIcon.Plus /> Add metric feedback</button>}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">RC response</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <RcAreaField label="Description" value={resp.description} onChange={(v) => patch({ response: { ...resp, description: v } })} disabled={dis} rows={2} />
              <RcStringList label="Changes" values={resp.changes ?? []} onChange={(v) => patch({ response: { ...resp, changes: v } })} disabled={dis} />
              <RcSelectField label="Status" value={resp.status} options={RI_RESP_STATUS_OPTIONS} onChange={(v) => patch({ response: { ...resp, status: v as typeof resp.status } })} disabled={dis} />
            </div>
          </div>
          {editable && <RemoveBtn label="Remove feedback" onClick={remove} />}
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
