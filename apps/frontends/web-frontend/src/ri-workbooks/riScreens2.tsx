import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { type RiskIntegration, type ConsequenceMeasure, type RiskMetric, type CompiledRiskInput, type RiskContributor, type ModelUncertaintySource, type ScreenedItemLedgerEntry, type RiskUncertaintyAnalysis, type RiskIntegrationMethod } from "interfaces-mef-types/ri/risk-integration";
import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { RIIcon } from "./riIcons";
import { Badge, RiProvenanceChip, valText } from "./riShared";
import {
  DrawerHead,
  RiTextField,
  RiAreaField,
  RiNumberField,
  RiSelectField,
  RiStringList,
  RemoveBtn,
  SrChips,
  APP_TYPE_OPTIONS,
  CRITERIA_SOURCE_OPTIONS,
  BASIS_OPTIONS,
  METRIC_OPTIONS,
  CRITERIA_TYPE_OPTIONS,
  CALC_LEVEL_OPTIONS,
  USED_OPTIONS,
  CONFIRMED_OPTIONS,
  COMPLIANCE_OPTIONS,
  IMPORTANCE_OPTIONS,
  ELEMENT_OPTIONS,
  CONTRIBUTOR_BUCKET_OPTIONS,
  SCREENED_ITEM_TYPE_OPTIONS,
  ELEMENT_CODE_OPTIONS,
  CHAR_LEVEL_OPTIONS,
  EVAL_SCOPE_OPTIONS,
  EVAL_TYPE_OPTIONS,
  PERFORMED_OPTIONS,
  FOUND_OPTIONS,
  RECORDED_OPTIONS,
  CONSIDERED_OPTIONS,
  VERIFIED_OPTIONS,
  THRESHOLD_LEVELS,
  labelOf,
} from "./riFields";
import { useRiWorkbook } from "./riWorkbookContext";
import { generateRiReport } from "./riDocx";
import {
  REGISTER_SIDE,
  ELEMENT_CODE_BY_TYPE,
  ELEMENT_NAME_BY_CODE,
  RI_TOC,
  type CapabilityCategory,
} from "./riViewData";
import { familySignificance, contributorRollup, findContributor, lognormalBounds, metricRollup, type ContributorBucketKey, type CcScore } from "./riSelectors";
import { type RiDrawerContext } from "./riScreens";

// ─── 04 — Aggregation & Contributors (RI-B3, B4, B5, B6) ───────────────────
const MASKING_ROWS: { label: string; field: "variationNotSignificantJustification" | "releaseCategorySelectionSufficiency" | "familyAssignmentSufficiency" }[] = [
  { label: "Within-family variation", field: "variationNotSignificantJustification" },
  { label: "Release-category selection", field: "releaseCategorySelectionSufficiency" },
  { label: "Family assignment", field: "familyAssignmentSufficiency" },
];

function nextSigId(rollup: { contributor: { uuid: string } }[]): string {
  const n = rollup.reduce((m, r) => {
    const v = Number(r.contributor.uuid.split("-").pop());
    return Number.isNaN(v) ? m : Math.max(m, v);
  }, 0) + 1;
  return `SIG-${String(n)}`;
}

function AggregateScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const results = ri.integratedRiskResults;
  const conservatism = new Map((results.aggregationApproach.detailConservatismDifferences ?? []).map((d) => [d.scope, d.description]));
  const rollup = contributorRollup(ri);
  const groups = results.hazardGroupContributions ?? [];
  const gar = ri.groupingAdequacyReview;
  const assumptions = results.keyAssumptions ?? [];
  const reactorBasis = assumptions.find((a) => a.toLowerCase().includes("reactor"));
  const sourceBasis = assumptions.find((a) => a.toLowerCase().includes("source"));

  function addHazardGroup(): void {
    if (!editable) return;
    const index = groups.length;
    mutateRi((d) => ({
      ...d,
      integratedRiskResults: {
        ...d.integratedRiskResults,
        hazardGroupContributions: [...(d.integratedRiskResults.hazardGroupContributions ?? []), { hazardGroup: "New hazard group", contribution: 0 }],
      },
    }));
    openDrawer({ kind: "hazardgroup", id: String(index) });
  }

  function addContributor(): void {
    if (!editable) return;
    const uuid = nextSigId(rollup);
    mutateRi((d) => ({
      ...d,
      significantContributors: {
        ...d.significantContributors,
        significantEventSequenceFamilies: [...(d.significantContributors.significantEventSequenceFamilies ?? []), {
          uuid,
          name: "New contributor",
          contributorType: "Family",
          sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
          sourceId: "",
          importanceLevel: ImportanceLevel.MEDIUM,
          context: "",
        }],
      },
    }));
    openDrawer({ kind: "contributor", id: uuid });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Aggregation honesty</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-B3</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "aggregation", id: "aggregation" })}><RIIcon.Settings /> Edit review</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addHazardGroup}><RIIcon.Plus /> Add hazard group</button>}
          </div>
        </div>
        <p className="poscard__sub">Each source and hazard contribution is identified, and a conservative model may not be summed with a realistic one and read as either. Select a row to edit it.</p>
        {groups.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No hazard-group contributions yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Hazard group</th><th>Model treatment</th><th>Contribution</th></tr></thead>
            <tbody>
              {groups.map((g, i) => {
                const note = conservatism.get(g.hazardGroup) ?? "";
                const isConservative = note.toLowerCase().includes("conservative");
                return (
                  <tr key={g.hazardGroup} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "hazardgroup", id: String(i) })}>
                    <td>
                      <div className="postable__name">{g.hazardGroup}</div>
                      {note.length > 0 && <span className="possubtle" style={{ fontSize: 12 }}>{note}</span>}
                    </td>
                    <td>{isConservative ? <Badge kind="warn">Conservative</Badge> : <Badge kind="ok">Realistic</Badge>}</td>
                    <td className="posmono">{Math.round(g.contribution * 1000) / 10}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Multi-reactor and multi-source terms</h3>
          <RiProvenanceChip>RI-B4</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The multi-reactor and multi-source release contributions are recorded, even where the single-unit scope keeps them from driving. Select a row to edit it.</p>
        <table className="postable postable--mid">
          <tbody>
            <tr className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "aggregation", id: "aggregation" })}>
              <td>
                <div className="postable__name">Multi-reactor release contributions</div>
                {reactorBasis !== undefined && <span className="possubtle" style={{ fontSize: 12 }}>{reactorBasis}</span>}
              </td>
              <td>{results.multiReactorContributionsIncluded ? <Badge kind="ok">Recorded</Badge> : <Badge kind="warn">Not recorded</Badge>}</td>
            </tr>
            <tr className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "aggregation", id: "aggregation" })}>
              <td>
                <div className="postable__name">Multi-source release contributions</div>
                {sourceBasis !== undefined && <span className="possubtle" style={{ fontSize: 12 }}>{sourceBasis}</span>}
              </td>
              <td>{results.multiSourceContributionsIncluded ? <Badge kind="ok">Recorded</Badge> : <Badge kind="warn">Not recorded</Badge>}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Anti-masking review</h3>
          <RiProvenanceChip>RI-B5</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The within-family variations are justified as not risk-significant, so a worst member never hides behind a benign representative. Select a row to edit it.</p>
        <table className="postable postable--mid">
          <thead><tr><th>Review</th><th>Status</th></tr></thead>
          <tbody>
            {MASKING_ROWS.map((r) => {
              const text = gar[r.field];
              const reopened = text.toLowerCase().includes("reopen");
              return (
                <tr key={r.field} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "grouping", id: "grouping" })}>
                  <td>
                    <div className="postable__name">{r.label}</div>
                    <span className="possubtle" style={{ fontSize: 12 }}>{text}</span>
                  </td>
                  <td>{reopened ? <Badge kind="warn">Reopened</Badge> : <Badge kind="ok">No masking</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-significant contributors</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-B6</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "contribbasis", id: "contribbasis" })}><RIIcon.Settings /> Edit basis</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addContributor}><RIIcon.Plus /> Add contributor</button>}
          </div>
        </div>
        <p className="poscard__sub">{ri.significantContributors.insightDerivationBasis ?? "The contributors are identified at an insight-grade level."} Select a row to edit it.</p>
        {rollup.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No risk-significant contributors yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Contributor</th><th>Kind</th><th>From</th><th>Significance</th></tr></thead>
            <tbody>
              {rollup.map((r) => {
                const code = ELEMENT_CODE_BY_TYPE[r.contributor.sourceElement] ?? "RI";
                return (
                  <tr key={r.contributor.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "contributor", id: r.contributor.uuid })}>
                    <td>
                      <div className="postable__name">{r.contributor.name}</div>
                      <span className="possubtle" style={{ fontSize: 12 }}>{r.contributor.context ?? ""}</span>
                    </td>
                    <td className="possubtle" style={{ fontSize: 12.5 }}>{r.kind}</td>
                    <td className="posmono">{code} · {r.contributor.sourceId}</td>
                    <td>
                      {r.contributor.importanceLevel === "HIGH" && <Badge kind="block">High</Badge>}
                      {r.contributor.importanceLevel === "MEDIUM" && <Badge kind="warn">Medium</Badge>}
                      {(r.contributor.importanceLevel === "LOW" || r.contributor.importanceLevel === undefined) && <Badge kind="draft">Low</Badge>}
                    </td>
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

// ─── 05 — Risk Uncertainty (HLR-RI-C) ──────────────────────────────────────
function nextPrefixedId(prefix: string, ids: string[]): string {
  const n = ids.reduce((m, id) => {
    const v = Number(id.split("-").pop());
    return Number.isNaN(v) ? m : Math.max(m, v);
  }, 0) + 1;
  return `${prefix}-${String(n)}`;
}

function UncertaintyScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const gar = ri.groupingAdequacyReview;
  const ledger = ri.screenedItemsLedger ?? [];
  const studies = ri.sensitivityStudies ?? [];

  function addSource(): void {
    if (!editable) return;
    const uuid = nextPrefixedId("MU", ri.modelUncertaintySources.map((u) => u.uuid));
    mutateRi((d) => ({
      ...d,
      modelUncertaintySources: [...d.modelUncertaintySources, {
        uuid,
        name: "New uncertainty source",
        description: "",
        originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
        affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"],
        impactAssessment: "",
        implementsSrs: [{ sr: "RI-C1", hlr: "C" as const }, { sr: "RI-C3", hlr: "C" as const }],
      }],
    }));
    openDrawer({ kind: "musource", id: uuid });
  }

  function addScreened(): void {
    if (!editable) return;
    const uuid = nextPrefixedId("SL", ledger.map((s) => s.uuid));
    mutateRi((d) => ({
      ...d,
      screenedItemsLedger: [...(d.screenedItemsLedger ?? []), {
        uuid,
        itemType: "EVENT_SEQUENCE" as const,
        itemRef: "",
        screeningElementCode: "ESQ" as const,
        screeningBasis: "",
        implementsSrs: [{ sr: "RI-C1", hlr: "C" as const }],
      }],
    }));
    openDrawer({ kind: "screened", id: uuid });
  }

  function addAnalysis(): void {
    if (!editable) return;
    const uuid = nextPrefixedId("RIU", ri.uncertaintyAnalyses.map((u) => u.uuid));
    mutateRi((d) => ({
      ...d,
      uncertaintyAnalyses: [...d.uncertaintyAnalyses, {
        uuid,
        name: "New uncertainty analysis",
        metric: "",
        characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT" as const,
        propagationMethod: "Monte Carlo sampling of the risk-significant distributions",
        sokcAndPhenomenaTreatment: { eventFrequencySokcConsidered: true, phenomenaDependenciesConsidered: true },
        evaluationScope: "COMBINATION" as const,
        evaluationType: "QUANTITATIVE" as const,
        implementsSrs: [{ sr: "RI-C3", hlr: "C" as const }, { sr: "RI-C4", hlr: "C" as const }],
      }],
    }));
    openDrawer({ kind: "propagation", id: uuid });
  }

  function addStudy(): void {
    if (!editable) return;
    const uuid = nextPrefixedId("RIS", studies.map((s) => s.uuid));
    mutateRi((d) => ({
      ...d,
      sensitivityStudies: [...(d.sensitivityStudies ?? []), {
        uuid,
        name: "New sensitivity study",
        description: "",
        variedParameters: [],
        parameterRanges: {},
        implementsSrs: [{ sr: "RI-D2", hlr: "D" as const }],
      }],
    }));
    openDrawer({ kind: "sensitivity", id: uuid });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Master uncertainty register</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-C1 · C3</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}><RIIcon.Plus /> Add source</button>}
          </div>
        </div>
        <p className="poscard__sub">The register compiles the key model uncertainties from every element, the frequency-side impacts via ESQ and the consequence-side impacts via MS and RC. Select a row to edit it.</p>
        {ri.modelUncertaintySources.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No uncertainty sources compiled yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Element</th><th>Uncertainty source</th><th>Side</th><th>Impact on the total</th></tr></thead>
            <tbody>
              {ri.modelUncertaintySources.map((u) => {
                const code = ELEMENT_CODE_BY_TYPE[u.originatingElement] ?? "RI";
                return (
                  <tr key={u.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "musource", id: u.uuid })}>
                    <td className="posmono">{code}</td>
                    <td>
                      <div className="postable__name">{u.name}</div>
                      <span className="possubtle" style={{ fontSize: 12 }}>{u.description}</span>
                    </td>
                    <td className="possubtle" style={{ fontSize: 12.5 }}>{REGISTER_SIDE[code] ?? "Frequency side"}</td>
                    <td className="possubtle" style={{ fontSize: 12.5 }}>{u.impactAssessment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screened-items ledger</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-C1</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addScreened}><RIIcon.Plus /> Add item</button>}
          </div>
        </div>
        <p className="poscard__sub">Every screening decision made anywhere in the PRA lands here, so the register of record shows what was set aside and why. Select a row to edit it.</p>
        {ledger.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No screened items recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Element</th><th>Screened item</th><th>Basis</th></tr></thead>
            <tbody>
              {ledger.map((s) => (
                <tr key={s.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "screened", id: s.uuid })}>
                  <td className="posmono">{s.screeningElementCode}</td>
                  <td>
                    <div className="postable__name">{s.itemRef}</div>
                    <span className="possubtle" style={{ fontSize: 12 }}>{labelOf(SCREENED_ITEM_TYPE_OPTIONS, s.itemType)}</span>
                  </td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{s.screeningBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Grouping-uncertainty review</h3>
          <RiProvenanceChip>RI-C2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The grouping uncertainty is reviewed so it does not make a family artificially risk-significant, in either direction. Select the row to edit it.</p>
        <table className="postable postable--mid">
          <tbody>
            <tr className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "grouping", id: "grouping" })}>
              <td>
                <div className="postable__name">Family grouping uncertainty</div>
                <span className="possubtle" style={{ fontSize: 12 }}>{gar.groupingUncertaintyReview.findings ?? "The grouping uncertainty is reviewed."}</span>
              </td>
              <td>
                {!gar.groupingUncertaintyReview.performed && <Badge kind="draft">Not performed</Badge>}
                {gar.groupingUncertaintyReview.performed && (gar.groupingUncertaintyReview.artificialSignificanceFound ? <Badge kind="warn">Artifact found</Badge> : <Badge kind="ok">No artifact</Badge>)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Propagation fork</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-C4</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAnalysis}><RIIcon.Plus /> Add analysis</button>}
          </div>
        </div>
        <p className="poscard__sub">The upstream uncertainty machines converge here, the correlation from the quantification and the phenomena dependencies from the source term and the consequence analysis. Select a fork to edit it.</p>
        {ri.uncertaintyAnalyses.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No propagation analysis recorded yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ri.uncertaintyAnalyses.map((propagation) => {
              const bounds = lognormalBounds(propagation.parameterUncertainty);
              const sokc = propagation.sokcAndPhenomenaTreatment;
              return (
                <div key={propagation.uuid} className="riprop" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "propagation", id: propagation.uuid })} onKeyDown={(e) => { if (e.key === "Enter") openDrawer({ kind: "propagation", id: propagation.uuid }); }}>
                  <div className="riprop__sources">
                    {sokc.eventFrequencySokcConsidered && (
                      <div className="riprop__src">
                        <div className="riprop__src-main">
                          <div className="riprop__src-name">State-of-knowledge correlation</div>
                          <div className="riprop__src-from posmono">ESQ-E2 · frequency side</div>
                        </div>
                      </div>
                    )}
                    {sokc.phenomenaDependenciesConsidered && (
                      <div className="riprop__src">
                        <div className="riprop__src-main">
                          <div className="riprop__src-name">Phenomena dependencies</div>
                          <div className="riprop__src-from posmono">MS-D4 · RCQ-C2 · consequence side</div>
                        </div>
                      </div>
                    )}
                    <div className="riprop__src">
                      <div className="riprop__src-main">
                        <div className="riprop__src-name">{propagation.propagationMethod}</div>
                        <div className="riprop__src-from posmono">{labelOf(EVAL_TYPE_OPTIONS, propagation.evaluationType)} · {labelOf(EVAL_SCOPE_OPTIONS, propagation.evaluationScope)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="riprop__arrow" aria-hidden="true">→</div>
                  <div className="riprop__out">
                    <span className="riprop__out-cap">{propagation.name ?? "Integrated risk uncertainty"}</span>
                    <div className="riprop__dist"><span className="riprop__dist-mean" /></div>
                    <div className="riprop__scale">
                      <span>{valText(bounds?.p05)}</span>
                      <span>median {valText(bounds?.mean)}</span>
                      <span>{valText(bounds?.p95)}</span>
                    </div>
                    <span className="riprop__level">{labelOf(CHAR_LEVEL_OPTIONS, propagation.characterizationLevel)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sensitivity studies</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-D2</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addStudy}><RIIcon.Plus /> Add study</button>}
          </div>
        </div>
        <p className="poscard__sub">The sensitivity studies test the aggregation, the grouping and the correlation, and they feed the model-uncertainty documentation. Select a row to edit it.</p>
        {studies.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No sensitivity studies yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Study</th><th>Result</th><th>SR</th></tr></thead>
            <tbody>
              {studies.map((s) => (
                <tr key={s.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "sensitivity", id: s.uuid })}>
                  <td>
                    <div className="postable__name">{s.name ?? "Sensitivity study"}</div>
                    <span className="possubtle" style={{ fontSize: 12 }}>{s.description}</span>
                  </td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{s.results ?? ""}</td>
                  <td className="posmono">{(s.implementsSrs ?? []).map((x) => x.sr).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── 06 — Feedback & Dispatch (HLR-RI-D, the loop closer) ───────────────────
const IMPORTANCE_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function highestSignificance(levels: (ImportanceLevel | undefined)[]): ImportanceLevel | undefined {
  let best: ImportanceLevel | undefined;
  for (const lv of levels) {
    if (lv === undefined) continue;
    if (best === undefined || (IMPORTANCE_ORDER[lv] ?? 2) < (IMPORTANCE_ORDER[best] ?? 2)) best = lv;
  }
  return best;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

function FeedbackScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const dispatch = ri.riskIntegrationFeedbackDispatch;
  const doc = ri.documentation;

  const esqSig = highestSignificance((dispatch?.eventSequenceQuantificationFeedback?.familyFeedback ?? []).map((f) => f.riskSignificance));
  const msSig = highestSignificance([
    ...(dispatch?.mechanisticSourceTermFeedback?.releaseCategoryFeedback ?? []).map((f) => f.riskSignificance),
    ...(dispatch?.mechanisticSourceTermFeedback?.sourceTermFeedback ?? []).map((f) => f.riskSignificance),
  ]);
  const rcSig = highestSignificance((dispatch?.radiologicalConsequenceFeedback?.metricFeedback ?? []).map((f) => f.riskSignificance));

  const rows: { code: string; message: string; significance?: ImportanceLevel; detail: string }[] = [
    {
      code: "ESQ",
      significance: esqSig,
      message: dispatch?.eventSequenceQuantificationFeedback?.generalFeedback ?? "No feedback recorded yet.",
      detail: `${countLabel((dispatch?.eventSequenceQuantificationFeedback?.familyFeedback ?? []).length, "family entry", "family entries")} · ${countLabel((dispatch?.eventSequenceQuantificationFeedback?.contributorFeedback ?? []).length, "contributor entry", "contributor entries")}`,
    },
    {
      code: "MS",
      significance: msSig,
      message: dispatch?.mechanisticSourceTermFeedback?.generalFeedback ?? "No feedback recorded yet.",
      detail: `${countLabel((dispatch?.mechanisticSourceTermFeedback?.releaseCategoryFeedback ?? []).length, "category entry", "category entries")} · ${countLabel((dispatch?.mechanisticSourceTermFeedback?.sourceTermFeedback ?? []).length, "source-term entry", "source-term entries")}`,
    },
    {
      code: "RC",
      significance: rcSig,
      message: dispatch?.radiologicalConsequenceFeedback?.generalFeedback ?? "No feedback recorded yet.",
      detail: countLabel((dispatch?.radiologicalConsequenceFeedback?.metricFeedback ?? []).length, "metric entry", "metric entries"),
    },
    ...(dispatch?.additionalElementFeedback ?? []).map((f) => ({
      code: f.elementCode,
      significance: f.riskSignificance,
      message: f.generalFeedback ?? "No feedback recorded yet.",
      detail: countLabel((f.recommendations ?? []).length, "recommendation", "recommendations"),
    })),
  ];

  const usedCodes = new Set(rows.map((r) => r.code));
  const nextCode = (["IE", "ES", "SY", "HR", "DA", "POS", "SC"] as const).find((c) => !usedCodes.has(c));

  function addElement(): void {
    if (!editable || nextCode === undefined) return;
    mutateRi((d) => ({
      ...d,
      riskIntegrationFeedbackDispatch: {
        ...(d.riskIntegrationFeedbackDispatch ?? {}),
        additionalElementFeedback: [...(d.riskIntegrationFeedbackDispatch?.additionalElementFeedback ?? []), { elementCode: nextCode, riskSignificance: ImportanceLevel.MEDIUM, generalFeedback: "", recommendations: [] }],
      },
    }));
    openDrawer({ kind: "dispatch", id: nextCode });
  }

  function patchDoc(next: Partial<typeof doc>): void {
    if (!editable) return;
    mutateRi((d) => ({ ...d, documentation: { ...d.documentation, ...next } }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Feedback dispatch</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-D1</RiProvenanceChip>
            {editable && nextCode !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addElement}><RIIcon.Plus /> Add element</button>}
          </div>
        </div>
        <p className="poscard__sub">RI dispatches the risk significance back to every element it touches, the sending counterpart of the feedback every upstream element waits to receive. Select a row to edit it.</p>
        <table className="postable postable--mid">
          <thead><tr><th>Element</th><th>Significance</th><th>Feedback</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "dispatch", id: r.code })}>
                <td>
                  <div className="postable__name">{ELEMENT_NAME_BY_CODE[r.code] ?? r.code}</div>
                  <span className="possubtle posmono" style={{ fontSize: 11 }}>{r.code} · {r.detail}</span>
                </td>
                <td>
                  {r.significance === "HIGH" && <Badge kind="block">High</Badge>}
                  {r.significance === "MEDIUM" && <Badge kind="warn">Medium</Badge>}
                  {r.significance === "LOW" && <Badge kind="draft">Low</Badge>}
                  {r.significance === undefined && <span className="possubtle" style={{ fontSize: 11.5 }}>—</span>}
                </td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Documentation readiness</h3>
          <RiProvenanceChip>RI-D1 · D2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The documentation records the criteria, the results, the design-feature insights and the traceability to the contributors.</p>
        <div className="posfield-grid">
          <RiAreaField label="Criteria and target" value={doc.riskSignificanceCriteriaUsed} onChange={(v) => patchDoc({ riskSignificanceCriteriaUsed: v })} disabled={!editable} rows={2} />
          <RiAreaField label="Traceability" value={doc.traceabilityToUpstreamContributions} onChange={(v) => patchDoc({ traceabilityToUpstreamContributions: v })} disabled={!editable} rows={2} />
          <RiAreaField label="Design-feature insights" value={doc.designFeatureInsights} onChange={(v) => patchDoc({ designFeatureInsights: v })} disabled={!editable} rows={2} />
          <RiAreaField label="Model uncertainty" value={doc.modelUncertaintySourcesDocumentation} onChange={(v) => patchDoc({ modelUncertaintySourcesDocumentation: v })} disabled={!editable} rows={2} />
          <RiAreaField label="Results summary" value={doc.resultsSummary} onChange={(v) => patchDoc({ resultsSummary: v })} disabled={!editable} rows={2} />
          <RiAreaField label="Contributor roll-up" value={doc.integratedContributorRollup} onChange={(v) => patchDoc({ integratedContributorRollup: v })} disabled={!editable} rows={2} />
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

// ─── Drawer content ────────────────────────────────────────────────────────
type Criteria = RiskIntegration["riskSignificanceCriteria"][number];
type Thresholds = RiskIntegration["reportingThresholds"];

function toCriteriaSource(v: string): Criteria["criteriaSource"] {
  if (v === "TABLE_1_9_1") return "TABLE_1_9_1";
  if (v === "ALTERNATE") return "ALTERNATE";
  return "TABLE_1_9_2";
}

function toAppType(v: string): Criteria["applicationType"] {
  return v === "BASELINE_RISK" ? "BASELINE_RISK" : "FIXED_RISK_TARGET";
}

function toBasis(v: string): "STANDARD_DEFAULT" | "JUSTIFIED_ALTERNATIVE" {
  return v === "JUSTIFIED_ALTERNATIVE" ? "JUSTIFIED_ALTERNATIVE" : "STANDARD_DEFAULT";
}

function toCompliance(v: string): "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE" {
  if (v === "NON_COMPLIANT") return "NON_COMPLIANT";
  if (v === "INDETERMINATE") return "INDETERMINATE";
  return "COMPLIANT";
}

function DrawerContent({ context, onClose }: { context: RiDrawerContext; onClose: () => void }): JSX.Element | null {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const dis = !editable;

  if (context.kind === "measures") {
    const measures = ri.scopeDefinition.consequenceMeasures;
    const setMeasures = (next: ConsequenceMeasure[]): void => {
      mutateRi((d) => ({ ...d, scopeDefinition: { ...d.scopeDefinition, consequenceMeasures: next } }));
    };
    return (
      <>
        <DrawerHead cap="Consequence measures · RI-A1" title="Consequence measures" sub="The measures come from the intended applications and set the metric vocabulary for the consequence side." onClose={onClose} />
        <div className="posdrawer__body">
          {measures.length === 0 && <p className="posmuted" style={{ margin: 0 }}>No consequence measures yet.</p>}
          {measures.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span className="rinum" style={{ marginTop: 6 }}>{i + 1}</span>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <RiTextField label="Measure" value={m.name} onChange={(v) => setMeasures(measures.map((y, j) => (j === i ? { ...y, name: v } : y)))} disabled={dis} placeholder="e.g. Site-boundary individual dose" />
                <RiAreaField label="Description" value={m.description ?? ""} onChange={(v) => setMeasures(measures.map((y, j) => (j === i ? { ...y, description: v } : y)))} disabled={dis} rows={2} />
                {editable && (
                  <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setMeasures([...measures.slice(0, i), ...measures.slice(i + 1)])}>Remove</button>
                )}
              </div>
            </div>
          ))}
          {editable && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" style={{ alignSelf: "flex-start" }} onClick={() => setMeasures([...measures, { name: "", description: "" }])}><RIIcon.Plus /> Add measure</button>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "floors") {
    const t = ri.reportingThresholds;
    const patch = (next: Partial<Thresholds>): void => {
      mutateRi((d) => ({ ...d, reportingThresholds: { ...d.reportingThresholds, ...next } }));
    };
    return (
      <>
        <DrawerHead cap="Reporting floors · RI-A4 · A5" title="Reporting floors" sub="Below these floors the PRA cannot believe its own numbers." onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RiNumberField label="Minimum reporting frequency (per plant-year)" value={t.minimumReportingFrequencyPerPlantYear} onChange={(v) => patch({ minimumReportingFrequencyPerPlantYear: v })} disabled={dis} />
            <RiSelectField label="Frequency basis" value={t.frequencyBasis} options={BASIS_OPTIONS} onChange={(v) => patch({ frequencyBasis: toBasis(v) })} disabled={dis} />
            {t.frequencyBasis === "JUSTIFIED_ALTERNATIVE" && (
              <div className="posfield posfield-grid--span2">
                <RiAreaField label="Frequency justification" value={t.frequencyJustification ?? ""} onChange={(v) => patch({ frequencyJustification: v })} disabled={dis} rows={2} />
              </div>
            )}
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Minimum reporting consequence" value={t.minimumReportingConsequenceDescription} onChange={(v) => patch({ minimumReportingConsequenceDescription: v })} disabled={dis} />
            </div>
            <RiSelectField label="Consequence basis" value={t.consequenceBasis} options={BASIS_OPTIONS} onChange={(v) => patch({ consequenceBasis: toBasis(v) })} disabled={dis} />
            {t.consequenceBasis === "JUSTIFIED_ALTERNATIVE" && (
              <div className="posfield posfield-grid--span2">
                <RiAreaField label="Consequence justification" value={t.consequenceJustification ?? ""} onChange={(v) => patch({ consequenceJustification: v })} disabled={dis} rows={2} />
              </div>
            )}
          </div>
          <SrChips srs={t.implementsSrs} />
        </div>
      </>
    );
  }

  if (context.kind === "criteria") {
    const c = ri.riskSignificanceCriteria.find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (next: Partial<Criteria>): void => {
      mutateRi((d) => ({ ...d, riskSignificanceCriteria: d.riskSignificanceCriteria.map((x) => (x.uuid === c.uuid ? { ...x, ...next } : x)) }));
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({ ...d, riskSignificanceCriteria: d.riskSignificanceCriteria.filter((x) => x.uuid !== c.uuid) }));
    };
    const isAbsolute = c.applicationType === "FIXED_RISK_TARGET";
    const levels = isAbsolute ? c.absoluteThresholds : c.relativeThresholds;
    const setLevel = (key: (typeof THRESHOLD_LEVELS)[number]["key"], v: number): void => {
      patch(isAbsolute
        ? { absoluteThresholds: { ...c.absoluteThresholds, [key]: v } }
        : { relativeThresholds: { ...c.relativeThresholds, [key]: v } });
    };
    return (
      <>
        <DrawerHead cap="Risk-significance criteria" title={c.name.length > 0 ? c.name : "Untitled criteria"} sub={isAbsolute ? "Fixed risk target · absolute thresholds" : "Baseline risk · relative thresholds"} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Name" value={c.name} onChange={(v) => patch({ name: v })} disabled={dis} />
            </div>
            <RiSelectField label="Application" value={c.applicationType} options={APP_TYPE_OPTIONS} onChange={(v) => patch({ applicationType: toAppType(v) })} disabled={dis} />
            <RiSelectField label="Criteria source" value={c.criteriaSource} options={CRITERIA_SOURCE_OPTIONS} onChange={(v) => patch({ criteriaSource: toCriteriaSource(v) })} disabled={dis} />
            <RiSelectField label="Criteria type" value={String(c.criteriaType)} options={CRITERIA_TYPE_OPTIONS} onChange={(v) => patch({ criteriaType: v })} disabled={dis} />
            <RiSelectField label="Risk metric" value={String(c.metricType)} options={METRIC_OPTIONS} onChange={(v) => patch({ metricType: v })} disabled={dis} />
            {c.criteriaSource === "ALTERNATE" && (
              <div className="posfield posfield-grid--span2">
                <RiAreaField label="Alternate justification" value={c.alternateJustification ?? ""} onChange={(v) => patch({ alternateJustification: v })} disabled={dis} rows={2} />
              </div>
            )}
            <div className="posfield posfield-grid--span2">
              <RiAreaField label="Description" value={c.description ?? ""} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
            </div>
          </div>

          <div>
            <div className="essec">{isAbsolute ? "Absolute thresholds (per plant-year)" : "Relative thresholds (fraction of the total)"}</div>
            <div className="posfield-grid">
              {THRESHOLD_LEVELS.map((lv) => (
                <RiNumberField key={lv.key} label={lv.label} value={levels?.[lv.key] ?? 0} onChange={(v) => setLevel(lv.key, v)} disabled={dis} />
              ))}
            </div>
          </div>

          <RiAreaField label="Justification" value={c.justification} onChange={(v) => patch({ justification: v })} disabled={dis} rows={4} />
          <RiStringList label="Intended applications" values={c.intendedApplications ?? []} onChange={(v) => patch({ intendedApplications: v })} disabled={dis} />
          <RiStringList label="References" values={c.references ?? []} onChange={(v) => patch({ references: v })} disabled={dis} />

          <SrChips srs={c.implementsSrs} />
          {editable && <RemoveBtn label="Remove criteria" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "calc") {
    const a = ri.integratedRiskResults.calculationApproach;
    const level = ri.integratedRiskResults.calculationLevel;
    const patch = (next: Partial<typeof a>): void => {
      mutateRi((d) => ({ ...d, integratedRiskResults: { ...d.integratedRiskResults, calculationApproach: { ...d.integratedRiskResults.calculationApproach, ...next } } }));
    };
    const setLevel = (v: string): void => {
      mutateRi((d) => ({ ...d, integratedRiskResults: { ...d.integratedRiskResults, calculationLevel: v === "POINT_ESTIMATE" ? "POINT_ESTIMATE" : "MEAN" } }));
    };
    return (
      <>
        <DrawerHead cap="Calculation approach · RI-B2" title="Calculation approach" sub="How the integrated risk is totaled, plotted and drawn." onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RiSelectField label="Calculation type" value={level} options={CALC_LEVEL_OPTIONS} onChange={setLevel} disabled={dis} />
            <RiSelectField label="Sum of products" value={a.sumOfProducts === true ? "yes" : "no"} options={USED_OPTIONS} onChange={(v) => patch({ sumOfProducts: v === "yes" })} disabled={dis} />
            <RiSelectField label="Frequency-consequence plot" value={a.frequencyConsequencePlots === true ? "yes" : "no"} options={USED_OPTIONS} onChange={(v) => patch({ frequencyConsequencePlots: v === "yes" })} disabled={dis} />
            <RiSelectField label="Exceedance-frequency curve" value={a.exceedanceFrequencyCurves === true ? "yes" : "no"} options={USED_OPTIONS} onChange={(v) => patch({ exceedanceFrequencyCurves: v === "yes" })} disabled={dis} />
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Alternative approach" value={a.alternativeApproach ?? ""} onChange={(v) => patch({ alternativeApproach: v })} disabled={dis} placeholder="Only when a route outside the three above is taken." />
            </div>
          </div>
          <RiAreaField label="Justification" value={a.justification} onChange={(v) => patch({ justification: v })} disabled={dis} rows={4} />
          <SrChips srs={ri.integratedRiskResults.implementsSrs} />
        </div>
      </>
    );
  }

  if (context.kind === "metric") {
    const m = ri.integratedRiskResults.metrics.find((x) => x.uuid === context.id);
    if (m === undefined) return null;
    const roll = metricRollup(ri, m);
    const measures = ri.scopeDefinition.consequenceMeasures;
    const measureOptions: [string, string][] = [["", "Not linked"], ...measures.map((x) => [x.name, x.name] as [string, string])];
    const patch = (next: Partial<RiskMetric>): void => {
      mutateRi((d) => ({ ...d, integratedRiskResults: { ...d.integratedRiskResults, metrics: d.integratedRiskResults.metrics.map((x) => (x.uuid === m.uuid ? { ...x, ...next } : x)) } }));
    };
    const patchAccept = (next: Partial<NonNullable<RiskMetric["acceptanceCriteria"]>>): void => {
      patch({ acceptanceCriteria: { limit: m.acceptanceCriteria?.limit ?? 0, basis: m.acceptanceCriteria?.basis ?? "", complianceStatus: m.acceptanceCriteria?.complianceStatus ?? "COMPLIANT", ...next } });
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({ ...d, integratedRiskResults: { ...d.integratedRiskResults, metrics: d.integratedRiskResults.metrics.filter((x) => x.uuid !== m.uuid) } }));
    };
    const dist = m.uncertainty?.type === DistributionType.LOGNORMAL ? m.uncertainty : undefined;
    const patchDist = (median: number | undefined, ef: number | undefined): void => {
      patch({ uncertainty: { type: DistributionType.LOGNORMAL, median: median ?? dist?.median ?? 0, errorFactor: ef ?? dist?.errorFactor ?? 3 } });
    };
    return (
      <>
        <DrawerHead cap="Risk metric · RI-B2" title={m.name.length > 0 ? m.name : "Untitled metric"} sub={m.consequenceMeasureRef !== undefined && m.consequenceMeasureRef.length > 0 ? `Sums ${m.consequenceMeasureRef.toLowerCase()} across the compiled families` : undefined} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Name" value={m.name} onChange={(v) => patch({ name: v })} disabled={dis} />
            </div>
            <RiSelectField label="Risk metric" value={String(m.metricType)} options={METRIC_OPTIONS} onChange={(v) => patch({ metricType: v })} disabled={dis} />
            <RiSelectField label="Consequence measure summed" value={m.consequenceMeasureRef ?? ""} options={measureOptions} onChange={(v) => patch({ consequenceMeasureRef: v })} disabled={dis} />
            <RiNumberField label="Value" value={m.value} onChange={(v) => patch({ value: v })} disabled={dis} />
            <RiTextField label="Units" value={m.units} onChange={(v) => patch({ units: v })} disabled={dis} />
            <div className="posfield posfield-grid--span2">
              <RiAreaField label="Description" value={m.description ?? ""} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
            </div>
          </div>

          {roll.computed !== undefined && (
            <span className="richeck">
              <span className={`richeck__dot richeck__dot--${roll.matches ? "ok" : "warn"}`} />
              <span>The compiled families sum to {valText(roll.computed)} {m.units}{roll.matches ? ", matching the value recorded above." : ", so the value recorded above is out of date."}</span>
            </span>
          )}

          <div>
            <div className="essec">Acceptance criteria</div>
            <div className="posfield-grid">
              <RiNumberField label="Limit" value={m.acceptanceCriteria?.limit ?? 0} onChange={(v) => patchAccept({ limit: v })} disabled={dis} />
              <RiSelectField label="Compliance status" value={m.acceptanceCriteria?.complianceStatus ?? "COMPLIANT"} options={COMPLIANCE_OPTIONS} onChange={(v) => patchAccept({ complianceStatus: toCompliance(v) })} disabled={dis} />
              <div className="posfield posfield-grid--span2">
                <RiAreaField label="Basis" value={m.acceptanceCriteria?.basis ?? ""} onChange={(v) => patchAccept({ basis: v })} disabled={dis} rows={2} />
              </div>
            </div>
          </div>

          <div>
            <div className="essec">Uncertainty</div>
            <div className="posfield-grid">
              <RiNumberField label="Median" value={dist?.median ?? 0} onChange={(v) => patchDist(v, undefined)} disabled={dis} />
              <RiNumberField label="Error factor" value={dist?.errorFactor ?? 0} onChange={(v) => patchDist(undefined, v)} disabled={dis} />
              <div className="posfield posfield-grid--span2">
                <RiAreaField label="Uncertainty description" value={m.uncertaintyDescription ?? ""} onChange={(v) => patch({ uncertaintyDescription: v })} disabled={dis} rows={2} />
              </div>
            </div>
          </div>

          <SrChips srs={m.implementsSrs} />
          {editable && <RemoveBtn label="Remove metric" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "aggregation") {
    const results = ri.integratedRiskResults;
    const a = results.aggregationApproach;
    const patchResults = (next: Partial<typeof results>): void => {
      mutateRi((d) => ({ ...d, integratedRiskResults: { ...d.integratedRiskResults, ...next } }));
    };
    const patchAggr = (next: Partial<typeof a>): void => {
      patchResults({ aggregationApproach: { ...a, ...next } });
    };
    return (
      <>
        <DrawerHead cap="Aggregation review · RI-B3 · B4" title="Aggregation honesty" sub="The per-hazard-group review, the multi-unit terms and the key assumptions behind the sum." onClose={onClose} />
        <div className="posdrawer__body">
          <RiAreaField label="Description" value={a.description} onChange={(v) => patchAggr({ description: v })} disabled={dis} rows={2} />
          <div className="posfield-grid">
            <RiSelectField label="Per-source and per-hazard contributions identified" value={a.perSourceHazardContributionsIdentified ? "yes" : "no"} options={CONFIRMED_OPTIONS} onChange={(v) => patchAggr({ perSourceHazardContributionsIdentified: v === "yes" })} disabled={dis} />
            <RiSelectField label="Separate per-group review" value={a.separateReviewPerformed === true ? "yes" : "no"} options={PERFORMED_OPTIONS} onChange={(v) => patchAggr({ separateReviewPerformed: v === "yes" })} disabled={dis} />
            <RiSelectField label="Multi-reactor contributions" value={results.multiReactorContributionsIncluded ? "yes" : "no"} options={RECORDED_OPTIONS} onChange={(v) => patchResults({ multiReactorContributionsIncluded: v === "yes" })} disabled={dis} />
            <RiSelectField label="Multi-source contributions" value={results.multiSourceContributionsIncluded ? "yes" : "no"} options={RECORDED_OPTIONS} onChange={(v) => patchResults({ multiSourceContributionsIncluded: v === "yes" })} disabled={dis} />
          </div>
          <RiAreaField label="Separate review findings" value={a.separateReviewFindings ?? ""} onChange={(v) => patchAggr({ separateReviewFindings: v })} disabled={dis} rows={3} />
          <RiAreaField label="Justification" value={a.justification} onChange={(v) => patchAggr({ justification: v })} disabled={dis} rows={2} />
          <RiStringList label="Key assumptions" values={results.keyAssumptions ?? []} onChange={(v) => patchResults({ keyAssumptions: v })} disabled={dis} />
          <SrChips srs={results.implementsSrs} />
        </div>
      </>
    );
  }

  if (context.kind === "hazardgroup") {
    const groups = ri.integratedRiskResults.hazardGroupContributions ?? [];
    const idx = Number(context.id);
    const g = groups[idx];
    if (g === undefined) return null;
    const conservatism = (ri.integratedRiskResults.aggregationApproach.detailConservatismDifferences ?? []).find((x) => x.scope === g.hazardGroup);
    const patchGroup = (next: Partial<typeof g>): void => {
      mutateRi((d) => {
        const list = d.integratedRiskResults.hazardGroupContributions ?? [];
        const before = list[idx];
        const updated = list.map((x, j) => (j === idx ? { ...x, ...next } : x));
        let differences = d.integratedRiskResults.aggregationApproach.detailConservatismDifferences;
        if (next.hazardGroup !== undefined && before !== undefined && differences !== undefined) {
          differences = differences.map((x) => (x.scope === before.hazardGroup ? { ...x, scope: next.hazardGroup ?? x.scope } : x));
        }
        return {
          ...d,
          integratedRiskResults: {
            ...d.integratedRiskResults,
            hazardGroupContributions: updated,
            aggregationApproach: { ...d.integratedRiskResults.aggregationApproach, detailConservatismDifferences: differences },
          },
        };
      });
    };
    const setConservatism = (text: string): void => {
      mutateRi((d) => {
        const existing = d.integratedRiskResults.aggregationApproach.detailConservatismDifferences ?? [];
        const has = existing.some((x) => x.scope === g.hazardGroup);
        const differences = text.length === 0
          ? existing.filter((x) => x.scope !== g.hazardGroup)
          : has
            ? existing.map((x) => (x.scope === g.hazardGroup ? { ...x, description: text } : x))
            : [...existing, { scope: g.hazardGroup, description: text }];
        return { ...d, integratedRiskResults: { ...d.integratedRiskResults, aggregationApproach: { ...d.integratedRiskResults.aggregationApproach, detailConservatismDifferences: differences } } };
      });
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({
        ...d,
        integratedRiskResults: {
          ...d.integratedRiskResults,
          hazardGroupContributions: (d.integratedRiskResults.hazardGroupContributions ?? []).filter((_, j) => j !== idx),
          aggregationApproach: {
            ...d.integratedRiskResults.aggregationApproach,
            detailConservatismDifferences: (d.integratedRiskResults.aggregationApproach.detailConservatismDifferences ?? []).filter((x) => x.scope !== g.hazardGroup),
          },
        },
      }));
    };
    return (
      <>
        <DrawerHead cap="Hazard group · RI-B3" title={g.hazardGroup} sub={`${Math.round(g.contribution * 1000) / 10} percent of the integrated total`} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RiTextField label="Hazard group" value={g.hazardGroup} onChange={(v) => patchGroup({ hazardGroup: v })} disabled={dis} />
            <RiNumberField label="Contribution (fraction of the total)" value={g.contribution} onChange={(v) => patchGroup({ contribution: v })} disabled={dis} />
          </div>
          <RiAreaField label="Model treatment" value={conservatism?.description ?? ""} onChange={setConservatism} disabled={dis} rows={2} />
          {editable && <RemoveBtn label="Remove hazard group" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "grouping") {
    const gar = ri.groupingAdequacyReview;
    const patchGar = (next: Partial<typeof gar>): void => {
      mutateRi((d) => ({ ...d, groupingAdequacyReview: { ...d.groupingAdequacyReview, ...next } }));
    };
    const patchRev = (next: Partial<typeof gar.groupingUncertaintyReview>): void => {
      patchGar({ groupingUncertaintyReview: { ...gar.groupingUncertaintyReview, ...next } });
    };
    return (
      <>
        <DrawerHead cap="Grouping adequacy · RI-B5 · C2" title="Anti-masking review" sub="The within-family variation, the category selection and the grouping-uncertainty check." onClose={onClose} />
        <div className="posdrawer__body">
          <RiAreaField label="Within-family variation" value={gar.variationNotSignificantJustification} onChange={(v) => patchGar({ variationNotSignificantJustification: v })} disabled={dis} rows={3} />
          <RiAreaField label="Release-category selection" value={gar.releaseCategorySelectionSufficiency} onChange={(v) => patchGar({ releaseCategorySelectionSufficiency: v })} disabled={dis} rows={3} />
          <RiAreaField label="Family assignment" value={gar.familyAssignmentSufficiency} onChange={(v) => patchGar({ familyAssignmentSufficiency: v })} disabled={dis} rows={3} />
          <div className="posfield-grid">
            <RiSelectField label="Grouping-uncertainty review" value={gar.groupingUncertaintyReview.performed ? "yes" : "no"} options={PERFORMED_OPTIONS} onChange={(v) => patchRev({ performed: v === "yes" })} disabled={dis} />
            <RiSelectField label="Artificial significance" value={gar.groupingUncertaintyReview.artificialSignificanceFound ? "yes" : "no"} options={FOUND_OPTIONS} onChange={(v) => patchRev({ artificialSignificanceFound: v === "yes" })} disabled={dis} />
          </div>
          <RiAreaField label="Review findings" value={gar.groupingUncertaintyReview.findings ?? ""} onChange={(v) => patchRev({ findings: v })} disabled={dis} rows={2} />
          <SrChips srs={gar.implementsSrs} />
        </div>
      </>
    );
  }

  if (context.kind === "contributor") {
    const row = findContributor(ri, context.id);
    if (row === undefined) return null;
    const c = row.contributor;
    const patch = (next: Partial<RiskContributor>): void => {
      mutateRi((d) => ({
        ...d,
        significantContributors: {
          ...d.significantContributors,
          [row.bucket]: (d.significantContributors[row.bucket] ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...next } : x)),
        },
      }));
    };
    const moveBucket = (nextKey: string): void => {
      const target = CONTRIBUTOR_BUCKET_OPTIONS.find(([v]) => v === nextKey);
      if (target === undefined || nextKey === row.bucket) return;
      const key = nextKey as ContributorBucketKey;
      mutateRi((d) => ({
        ...d,
        significantContributors: {
          ...d.significantContributors,
          [row.bucket]: (d.significantContributors[row.bucket] ?? []).filter((x) => x.uuid !== c.uuid),
          [key]: [...(d.significantContributors[key] ?? []), { ...c, contributorType: target[1] }],
        },
      }));
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({
        ...d,
        significantContributors: {
          ...d.significantContributors,
          [row.bucket]: (d.significantContributors[row.bucket] ?? []).filter((x) => x.uuid !== c.uuid),
        },
      }));
    };
    const setElement = (v: string): void => {
      const t = Object.values(TechnicalElementTypes).find((x) => x === v);
      if (t !== undefined) patch({ sourceElement: t });
    };
    const setImportance = (v: string): void => {
      const lv = Object.values(ImportanceLevel).find((x) => x === v);
      if (lv !== undefined) patch({ importanceLevel: lv });
    };
    return (
      <>
        <DrawerHead cap="Risk-significant contributor · RI-B6" title={c.name.length > 0 ? c.name : "Untitled contributor"} sub={`${row.kind} · ${c.sourceId}`} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Name" value={c.name} onChange={(v) => patch({ name: v })} disabled={dis} />
            </div>
            <RiSelectField label="Kind" value={row.bucket} options={CONTRIBUTOR_BUCKET_OPTIONS} onChange={moveBucket} disabled={dis} />
            <RiSelectField label="Significance" value={c.importanceLevel ?? "LOW"} options={IMPORTANCE_OPTIONS} onChange={setImportance} disabled={dis} />
            <RiSelectField label="Source element" value={c.sourceElement} options={ELEMENT_OPTIONS} onChange={setElement} disabled={dis} />
            <RiTextField label="Source id" value={c.sourceId} onChange={(v) => patch({ sourceId: v })} disabled={dis} placeholder="The id the source element uses" />
          </div>
          <RiAreaField label="Context" value={c.context ?? ""} onChange={(v) => patch({ context: v })} disabled={dis} rows={2} />
          <RiStringList label="Insights" values={c.insights ?? []} onChange={(v) => patch({ insights: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove contributor" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "contribbasis") {
    const sc = ri.significantContributors;
    const patch = (next: Partial<typeof sc>): void => {
      mutateRi((d) => ({ ...d, significantContributors: { ...d.significantContributors, ...next } }));
    };
    return (
      <>
        <DrawerHead cap="Contributor roll-up · RI-B6" title="Derivation basis" sub="How the contributors are ranked and what the roll-up teaches." onClose={onClose} />
        <div className="posdrawer__body">
          <RiAreaField label="Derivation basis" value={sc.insightDerivationBasis ?? ""} onChange={(v) => patch({ insightDerivationBasis: v })} disabled={dis} rows={3} />
          <RiAreaField label="Description" value={sc.description ?? ""} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <RiStringList label="Insights" values={sc.insights ?? []} onChange={(v) => patch({ insights: v })} disabled={dis} />
          <SrChips srs={sc.implementsSrs} />
        </div>
      </>
    );
  }

  if (context.kind === "musource") {
    const u = ri.modelUncertaintySources.find((x) => x.uuid === context.id);
    if (u === undefined) return null;
    const patch = (next: Partial<ModelUncertaintySource>): void => {
      mutateRi((d) => ({ ...d, modelUncertaintySources: d.modelUncertaintySources.map((x) => (x.uuid === u.uuid ? { ...x, ...next } : x)) }));
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({ ...d, modelUncertaintySources: d.modelUncertaintySources.filter((x) => x.uuid !== u.uuid) }));
    };
    const setElement = (v: string): void => {
      const t = Object.values(TechnicalElementTypes).find((x) => x === v);
      if (t !== undefined) patch({ originatingElement: t });
    };
    return (
      <>
        <DrawerHead cap="Model-uncertainty source · RI-C1" title={u.name.length > 0 ? u.name : "Untitled source"} sub={ELEMENT_CODE_BY_TYPE[u.originatingElement] ?? ""} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Name" value={u.name} onChange={(v) => patch({ name: v })} disabled={dis} />
            </div>
            <RiSelectField label="Originating element" value={u.originatingElement} options={ELEMENT_OPTIONS} onChange={setElement} disabled={dis} />
            <RiTextField label="Characterization method" value={u.characterizationMethod ?? ""} onChange={(v) => patch({ characterizationMethod: v })} disabled={dis} placeholder="How the source is characterized" />
          </div>
          <RiAreaField label="Description" value={u.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <RiAreaField label="Impact on the total" value={u.impactAssessment} onChange={(v) => patch({ impactAssessment: v })} disabled={dis} rows={2} />
          <RiStringList label="Related assumptions" values={u.relatedAssumptions ?? []} onChange={(v) => patch({ relatedAssumptions: v })} disabled={dis} />
          <RiStringList label="Recommendations" values={u.recommendations ?? []} onChange={(v) => patch({ recommendations: v })} disabled={dis} />
          <SrChips srs={u.implementsSrs} />
          {editable && <RemoveBtn label="Remove source" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "screened") {
    const s = (ri.screenedItemsLedger ?? []).find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    const patch = (next: Partial<ScreenedItemLedgerEntry>): void => {
      mutateRi((d) => ({ ...d, screenedItemsLedger: (d.screenedItemsLedger ?? []).map((x) => (x.uuid === s.uuid ? { ...x, ...next } : x)) }));
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({ ...d, screenedItemsLedger: (d.screenedItemsLedger ?? []).filter((x) => x.uuid !== s.uuid) }));
    };
    const ITEM_TYPES: ScreenedItemLedgerEntry["itemType"][] = ["HAZARD_GROUP", "HAZARD_EVENT", "PLANT_OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "BASIC_EVENT"];
    const CODES: ScreenedItemLedgerEntry["screeningElementCode"][] = ["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "MS", "RC"];
    return (
      <>
        <DrawerHead cap="Screened item · RI-C1" title={s.itemRef.length > 0 ? s.itemRef : "Untitled item"} sub={`${s.screeningElementCode} · ${labelOf(SCREENED_ITEM_TYPE_OPTIONS, s.itemType)}`} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Screened item" value={s.itemRef} onChange={(v) => patch({ itemRef: v })} disabled={dis} />
            </div>
            <RiSelectField label="Item type" value={s.itemType} options={SCREENED_ITEM_TYPE_OPTIONS} onChange={(v) => { const t = ITEM_TYPES.find((x) => x === v); if (t !== undefined) patch({ itemType: t }); }} disabled={dis} />
            <RiSelectField label="Screening element" value={s.screeningElementCode} options={ELEMENT_CODE_OPTIONS} onChange={(v) => { const cCode = CODES.find((x) => x === v); if (cCode !== undefined) patch({ screeningElementCode: cCode }); }} disabled={dis} />
          </div>
          <RiAreaField label="Screening basis" value={s.screeningBasis} onChange={(v) => patch({ screeningBasis: v })} disabled={dis} rows={2} />
          <RiAreaField label="Impact on the risk metrics" value={s.impactOnRiskMetrics ?? ""} onChange={(v) => patch({ impactOnRiskMetrics: v })} disabled={dis} rows={2} />
          <SrChips srs={s.implementsSrs} />
          {editable && <RemoveBtn label="Remove item" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "propagation") {
    const u = ri.uncertaintyAnalyses.find((x) => x.uuid === context.id);
    if (u === undefined) return null;
    const patch = (next: Partial<RiskUncertaintyAnalysis>): void => {
      mutateRi((d) => ({ ...d, uncertaintyAnalyses: d.uncertaintyAnalyses.map((x) => (x.uuid === u.uuid ? { ...x, ...next } : x)) }));
    };
    const patchSokc = (next: Partial<RiskUncertaintyAnalysis["sokcAndPhenomenaTreatment"]>): void => {
      patch({ sokcAndPhenomenaTreatment: { ...u.sokcAndPhenomenaTreatment, ...next } });
    };
    const dist = u.parameterUncertainty?.type === DistributionType.LOGNORMAL ? u.parameterUncertainty : undefined;
    const patchDist = (median: number | undefined, ef: number | undefined): void => {
      patch({ parameterUncertainty: { type: DistributionType.LOGNORMAL, median: median ?? dist?.median ?? 0, errorFactor: ef ?? dist?.errorFactor ?? 3 } });
    };
    return (
      <>
        <DrawerHead cap="Uncertainty propagation · RI-C3 · C4" title={u.name ?? "Integrated risk uncertainty"} sub={labelOf(CHAR_LEVEL_OPTIONS, u.characterizationLevel)} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Name" value={u.name ?? ""} onChange={(v) => patch({ name: v })} disabled={dis} />
            </div>
            <RiSelectField label="Characterization level" value={u.characterizationLevel} options={CHAR_LEVEL_OPTIONS} onChange={(v) => patch({ characterizationLevel: v === "CHARACTERIZED" ? "CHARACTERIZED" : "PROPAGATED_RISK_SIGNIFICANT" })} disabled={dis} />
            <RiTextField label="Metric" value={String(u.metric)} onChange={(v) => patch({ metric: v })} disabled={dis} placeholder="The risk metric this analysis characterizes" />
            <RiTextField label="Propagation method" value={u.propagationMethod} onChange={(v) => patch({ propagationMethod: v })} disabled={dis} />
            <RiSelectField label="Evaluation type" value={u.evaluationType} options={EVAL_TYPE_OPTIONS} onChange={(v) => patch({ evaluationType: v === "QUALITATIVE" ? "QUALITATIVE" : "QUANTITATIVE" })} disabled={dis} />
            <RiSelectField label="Evaluation scope" value={u.evaluationScope} options={EVAL_SCOPE_OPTIONS} onChange={(v) => patch({ evaluationScope: v === "INDIVIDUAL" ? "INDIVIDUAL" : "COMBINATION" })} disabled={dis} />
            <RiNumberField label="Median" value={dist?.median ?? 0} onChange={(v) => patchDist(v, undefined)} disabled={dis} />
            <RiNumberField label="Error factor" value={dist?.errorFactor ?? 0} onChange={(v) => patchDist(undefined, v)} disabled={dis} />
            <RiSelectField label="State-of-knowledge correlation" value={u.sokcAndPhenomenaTreatment.eventFrequencySokcConsidered ? "yes" : "no"} options={CONSIDERED_OPTIONS} onChange={(v) => patchSokc({ eventFrequencySokcConsidered: v === "yes" })} disabled={dis} />
            <RiSelectField label="Phenomena dependencies" value={u.sokcAndPhenomenaTreatment.phenomenaDependenciesConsidered ? "yes" : "no"} options={CONSIDERED_OPTIONS} onChange={(v) => patchSokc({ phenomenaDependenciesConsidered: v === "yes" })} disabled={dis} />
          </div>
          <RiAreaField label="Treatment description" value={u.sokcAndPhenomenaTreatment.treatmentDescription ?? ""} onChange={(v) => patchSokc({ treatmentDescription: v })} disabled={dis} rows={2} />
          <RiAreaField label="Risk-significance basis" value={u.sokcAndPhenomenaTreatment.riskSignificanceBasis ?? ""} onChange={(v) => patchSokc({ riskSignificanceBasis: v })} disabled={dis} rows={2} />
          <RiStringList label="Key uncertainty sources" values={u.keyUncertaintySourceRefs ?? []} onChange={(v) => patch({ keyUncertaintySourceRefs: v })} disabled={dis} placeholder="e.g. MU-ESQ" />
          <div>
            <div className="essec">Prioritization</div>
            {(u.prioritization ?? []).map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <span className="rinum" style={{ marginTop: 6 }}>{i + 1}</span>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  <RiTextField label="Uncertainty source" value={row.uncertaintySourceId} onChange={(v) => patch({ prioritization: (u.prioritization ?? []).map((y, j) => (j === i ? { ...y, uncertaintySourceId: v } : y)) })} disabled={dis} placeholder="e.g. MU-ESQ" />
                  <RiSelectField label="Priority" value={row.priorityLevel} options={IMPORTANCE_OPTIONS} onChange={(v) => { const lv = Object.values(ImportanceLevel).find((x) => x === v); if (lv !== undefined) patch({ prioritization: (u.prioritization ?? []).map((y, j) => (j === i ? { ...y, priorityLevel: lv } : y)) }); }} disabled={dis} />
                  <RiAreaField label="Basis" value={row.basis} onChange={(v) => patch({ prioritization: (u.prioritization ?? []).map((y, j) => (j === i ? { ...y, basis: v } : y)) })} disabled={dis} rows={2} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patch({ prioritization: (u.prioritization ?? []).filter((_, j) => j !== i) })}>Remove entry</button>}
                </div>
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ prioritization: [...(u.prioritization ?? []), { uncertaintySourceId: "", priorityLevel: ImportanceLevel.MEDIUM, basis: "" }] })}><RIIcon.Plus /> Add priority</button>}
          </div>
          <RiAreaField label="Uncertainty range discussion" value={u.uncertaintyRangeDiscussion ?? ""} onChange={(v) => patch({ uncertaintyRangeDiscussion: v })} disabled={dis} rows={2} />
          <SrChips srs={u.implementsSrs} />
        </div>
      </>
    );
  }

  if (context.kind === "sensitivity") {
    const s = (ri.sensitivityStudies ?? []).find((x) => x.uuid === context.id);
    if (s === undefined) return null;
    const patch = (next: Partial<SensitivityStudy>): void => {
      mutateRi((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).map((x) => (x.uuid === s.uuid ? { ...x, ...next } : x)) }));
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({ ...d, sensitivityStudies: (d.sensitivityStudies ?? []).filter((x) => x.uuid !== s.uuid) }));
    };
    const setParams = (params: string[]): void => {
      const ranges: Record<string, [number, number]> = {};
      for (const p of params) {
        if (p.length > 0) ranges[p] = s.parameterRanges[p] ?? [0, 0];
      }
      patch({ variedParameters: params, parameterRanges: ranges });
    };
    const setRange = (param: string, idx: 0 | 1, value: number): void => {
      const cur = s.parameterRanges[param] ?? [0, 0];
      const nextRange: [number, number] = idx === 0 ? [value, cur[1]] : [cur[0], value];
      patch({ parameterRanges: { ...s.parameterRanges, [param]: nextRange } });
    };
    return (
      <>
        <DrawerHead cap="Sensitivity study · RI-D2" title={s.name ?? "Sensitivity study"} sub={s.description} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RiTextField label="Name" value={s.name ?? ""} onChange={(v) => patch({ name: v })} disabled={dis} />
            <RiTextField label="Impact" value={s.impact ?? ""} onChange={(v) => patch({ impact: v })} disabled={dis} placeholder="What the study moves" />
          </div>
          <RiAreaField label="Description" value={s.description} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <RiStringList label="Varied parameters" values={s.variedParameters} onChange={setParams} disabled={dis} />
          {s.variedParameters.filter((p) => p.length > 0).length > 0 && (
            <div className="posfield">
              <label className="posfield__label">Parameter ranges</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {s.variedParameters.filter((p) => p.length > 0).map((param) => {
                  const range = s.parameterRanges[param] ?? [0, 0];
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
          <RiAreaField label="Results" value={s.results ?? ""} onChange={(v) => patch({ results: v })} disabled={dis} rows={2} />
          <RiAreaField label="Insights" value={s.insights ?? ""} onChange={(v) => patch({ insights: v })} disabled={dis} rows={2} />
          <SrChips srs={s.implementsSrs ?? []} />
          {editable && <RemoveBtn label="Remove study" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "dispatch") {
    const code = context.id;
    const dispatch = ri.riskIntegrationFeedbackDispatch;
    const patchDispatch = (fn: (d: NonNullable<RiskIntegration["riskIntegrationFeedbackDispatch"]>) => NonNullable<RiskIntegration["riskIntegrationFeedbackDispatch"]>): void => {
      mutateRi((d) => ({ ...d, riskIntegrationFeedbackDispatch: fn(d.riskIntegrationFeedbackDispatch ?? {}) }));
    };
    const setImportanceIn = (v: string): ImportanceLevel | undefined => Object.values(ImportanceLevel).find((x) => x === v);

    if (code === "ESQ") {
      const fb = dispatch?.eventSequenceQuantificationFeedback ?? {};
      const families = fb.familyFeedback ?? [];
      const contributors = fb.contributorFeedback ?? [];
      const patchEsq = (next: Partial<typeof fb>): void => {
        patchDispatch((d) => ({ ...d, eventSequenceQuantificationFeedback: { ...(d.eventSequenceQuantificationFeedback ?? {}), ...next } }));
      };
      const familyRefs: [string, string][] = ri.compiledRiskInputs.map((x) => [x.eventSequenceFamilyRef, x.eventSequenceFamilyRef]);
      return (
        <>
          <DrawerHead cap="Feedback dispatch · RI-D1" title="Event Sequence Quantification" sub="The family significance and the contributor insights sent back to the quantification." onClose={onClose} />
          <div className="posdrawer__body">
            <RiAreaField label="General feedback" value={fb.generalFeedback ?? ""} onChange={(v) => patchEsq({ generalFeedback: v })} disabled={dis} rows={2} />
            <div>
              <div className="essec">Family feedback</div>
              {families.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span className="rinum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RiSelectField label="Family" value={f.familyRef} options={familyRefs} onChange={(v) => patchEsq({ familyFeedback: families.map((y, j) => (j === i ? { ...y, familyRef: v } : y)) })} disabled={dis} />
                    <RiSelectField label="Significance" value={f.riskSignificance ?? "LOW"} options={IMPORTANCE_OPTIONS} onChange={(v) => { const lv = setImportanceIn(v); if (lv !== undefined) patchEsq({ familyFeedback: families.map((y, j) => (j === i ? { ...y, riskSignificance: lv } : y)) }); }} disabled={dis} />
                    <RiStringList label="Recommendations" values={f.recommendations ?? []} onChange={(v) => patchEsq({ familyFeedback: families.map((y, j) => (j === i ? { ...y, recommendations: v } : y)) })} disabled={dis} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patchEsq({ familyFeedback: families.filter((_, j) => j !== i) })}>Remove entry</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchEsq({ familyFeedback: [...families, { familyRef: ri.compiledRiskInputs[0]?.eventSequenceFamilyRef ?? "", riskSignificance: ImportanceLevel.MEDIUM, recommendations: [] }] })}><RIIcon.Plus /> Add family entry</button>}
            </div>
            <div>
              <div className="essec">Contributor feedback</div>
              {contributors.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span className="rinum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RiTextField label="Entity" value={f.entityRef} onChange={(v) => patchEsq({ contributorFeedback: contributors.map((y, j) => (j === i ? { ...y, entityRef: v } : y)) })} disabled={dis} />
                    <RiSelectField label="Significance" value={f.riskSignificance ?? "LOW"} options={IMPORTANCE_OPTIONS} onChange={(v) => { const lv = setImportanceIn(v); if (lv !== undefined) patchEsq({ contributorFeedback: contributors.map((y, j) => (j === i ? { ...y, riskSignificance: lv } : y)) }); }} disabled={dis} />
                    <RiStringList label="Recommendations" values={f.recommendations ?? []} onChange={(v) => patchEsq({ contributorFeedback: contributors.map((y, j) => (j === i ? { ...y, recommendations: v } : y)) })} disabled={dis} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patchEsq({ contributorFeedback: contributors.filter((_, j) => j !== i) })}>Remove entry</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchEsq({ contributorFeedback: [...contributors, { entityRef: "", riskSignificance: ImportanceLevel.MEDIUM, recommendations: [] }] })}><RIIcon.Plus /> Add contributor entry</button>}
            </div>
          </div>
        </>
      );
    }

    if (code === "MS") {
      const fb = dispatch?.mechanisticSourceTermFeedback ?? {};
      const categories = fb.releaseCategoryFeedback ?? [];
      const sourceTerms = fb.sourceTermFeedback ?? [];
      const patchMs = (next: Partial<typeof fb>): void => {
        patchDispatch((d) => ({ ...d, mechanisticSourceTermFeedback: { ...(d.mechanisticSourceTermFeedback ?? {}), ...next } }));
      };
      const rcRefs: [string, string][] = (ri.scopeDefinition.releaseCategoryRefs ?? []).map((x) => [x, x]);
      const stRefs: [string, string][] = (ri.scopeDefinition.sourceTermDefinitionRefs ?? []).map((x) => [x, x]);
      return (
        <>
          <DrawerHead cap="Feedback dispatch · RI-D1" title="Mechanistic Source Term" sub="The release-category and source-term significance sent back to the source term." onClose={onClose} />
          <div className="posdrawer__body">
            <RiAreaField label="General feedback" value={fb.generalFeedback ?? ""} onChange={(v) => patchMs({ generalFeedback: v })} disabled={dis} rows={2} />
            <div>
              <div className="essec">Release-category feedback</div>
              {categories.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span className="rinum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RiSelectField label="Release category" value={f.releaseCategoryRef} options={rcRefs} onChange={(v) => patchMs({ releaseCategoryFeedback: categories.map((y, j) => (j === i ? { ...y, releaseCategoryRef: v } : y)) })} disabled={dis} />
                    <RiSelectField label="Significance" value={f.riskSignificance ?? "LOW"} options={IMPORTANCE_OPTIONS} onChange={(v) => { const lv = setImportanceIn(v); if (lv !== undefined) patchMs({ releaseCategoryFeedback: categories.map((y, j) => (j === i ? { ...y, riskSignificance: lv } : y)) }); }} disabled={dis} />
                    <RiStringList label="Recommendations" values={f.recommendations ?? []} onChange={(v) => patchMs({ releaseCategoryFeedback: categories.map((y, j) => (j === i ? { ...y, recommendations: v } : y)) })} disabled={dis} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patchMs({ releaseCategoryFeedback: categories.filter((_, j) => j !== i) })}>Remove entry</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchMs({ releaseCategoryFeedback: [...categories, { releaseCategoryRef: ri.scopeDefinition.releaseCategoryRefs?.[0] ?? "", riskSignificance: ImportanceLevel.MEDIUM, recommendations: [] }] })}><RIIcon.Plus /> Add category entry</button>}
            </div>
            <div>
              <div className="essec">Source-term feedback</div>
              {sourceTerms.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span className="rinum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RiSelectField label="Source term" value={f.sourceTermDefinitionRef} options={stRefs} onChange={(v) => patchMs({ sourceTermFeedback: sourceTerms.map((y, j) => (j === i ? { ...y, sourceTermDefinitionRef: v } : y)) })} disabled={dis} />
                    <RiSelectField label="Significance" value={f.riskSignificance ?? "LOW"} options={IMPORTANCE_OPTIONS} onChange={(v) => { const lv = setImportanceIn(v); if (lv !== undefined) patchMs({ sourceTermFeedback: sourceTerms.map((y, j) => (j === i ? { ...y, riskSignificance: lv } : y)) }); }} disabled={dis} />
                    <RiStringList label="Key uncertainties" values={f.keyUncertainties ?? []} onChange={(v) => patchMs({ sourceTermFeedback: sourceTerms.map((y, j) => (j === i ? { ...y, keyUncertainties: v } : y)) })} disabled={dis} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patchMs({ sourceTermFeedback: sourceTerms.filter((_, j) => j !== i) })}>Remove entry</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchMs({ sourceTermFeedback: [...sourceTerms, { sourceTermDefinitionRef: ri.scopeDefinition.sourceTermDefinitionRefs?.[0] ?? "", riskSignificance: ImportanceLevel.MEDIUM, keyUncertainties: [] }] })}><RIIcon.Plus /> Add source-term entry</button>}
            </div>
          </div>
        </>
      );
    }

    if (code === "RC") {
      const fb = dispatch?.radiologicalConsequenceFeedback ?? {};
      const metrics = fb.metricFeedback ?? [];
      const patchRc = (next: Partial<typeof fb>): void => {
        patchDispatch((d) => ({ ...d, radiologicalConsequenceFeedback: { ...(d.radiologicalConsequenceFeedback ?? {}), ...next } }));
      };
      const measureRefs: [string, string][] = ri.scopeDefinition.consequenceMeasures.map((m) => [m.name, m.name]);
      return (
        <>
          <DrawerHead cap="Feedback dispatch · RI-D1" title="Radiological Consequence" sub="The metric significance sent back to the consequence analysis." onClose={onClose} />
          <div className="posdrawer__body">
            <RiAreaField label="General feedback" value={fb.generalFeedback ?? ""} onChange={(v) => patchRc({ generalFeedback: v })} disabled={dis} rows={2} />
            <div>
              <div className="essec">Metric feedback</div>
              {metrics.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span className="rinum" style={{ marginTop: 6 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <RiSelectField label="Consequence measure" value={f.metric} options={measureRefs} onChange={(v) => patchRc({ metricFeedback: metrics.map((y, j) => (j === i ? { ...y, metric: v } : y)) })} disabled={dis} />
                    <RiSelectField label="Significance" value={f.riskSignificance ?? "LOW"} options={IMPORTANCE_OPTIONS} onChange={(v) => { const lv = setImportanceIn(v); if (lv !== undefined) patchRc({ metricFeedback: metrics.map((y, j) => (j === i ? { ...y, riskSignificance: lv } : y)) }); }} disabled={dis} />
                    <RiStringList label="Recommendations" values={f.recommendations ?? []} onChange={(v) => patchRc({ metricFeedback: metrics.map((y, j) => (j === i ? { ...y, recommendations: v } : y)) })} disabled={dis} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => patchRc({ metricFeedback: metrics.filter((_, j) => j !== i) })}>Remove entry</button>}
                  </div>
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchRc({ metricFeedback: [...metrics, { metric: ri.scopeDefinition.consequenceMeasures[0]?.name ?? "", riskSignificance: ImportanceLevel.MEDIUM, recommendations: [] }] })}><RIIcon.Plus /> Add metric entry</button>}
            </div>
          </div>
        </>
      );
    }

    const entry = (dispatch?.additionalElementFeedback ?? []).find((f) => f.elementCode === code);
    if (entry === undefined) return null;
    const patchEntry = (next: Partial<typeof entry>): void => {
      patchDispatch((d) => ({
        ...d,
        additionalElementFeedback: (d.additionalElementFeedback ?? []).map((f) => (f.elementCode === code ? { ...f, ...next } : f)),
      }));
    };
    const removeEntry = (): void => {
      onClose();
      patchDispatch((d) => ({ ...d, additionalElementFeedback: (d.additionalElementFeedback ?? []).filter((f) => f.elementCode !== code) }));
    };
    return (
      <>
        <DrawerHead cap="Feedback dispatch · RI-D1" title={ELEMENT_NAME_BY_CODE[code] ?? code} sub={`The risk significance sent back to ${code}.`} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RiSelectField label="Significance" value={entry.riskSignificance ?? "LOW"} options={IMPORTANCE_OPTIONS} onChange={(v) => { const lv = setImportanceIn(v); if (lv !== undefined) patchEntry({ riskSignificance: lv }); }} disabled={dis} />
          </div>
          <RiAreaField label="General feedback" value={entry.generalFeedback ?? ""} onChange={(v) => patchEntry({ generalFeedback: v })} disabled={dis} rows={2} />
          <RiStringList label="Insights" values={entry.insights ?? []} onChange={(v) => patchEntry({ insights: v })} disabled={dis} />
          <RiStringList label="Recommendations" values={entry.recommendations ?? []} onChange={(v) => patchEntry({ recommendations: v })} disabled={dis} />
          {editable && <RemoveBtn label="Remove element" onClick={removeEntry} />}
        </div>
      </>
    );
  }

  if (context.kind === "method") {
    const m = ri.integrationMethods.find((x) => x.uuid === context.id);
    if (m === undefined) return null;
    const patch = (next: Partial<RiskIntegrationMethod>): void => {
      mutateRi((d) => ({ ...d, integrationMethods: d.integrationMethods.map((x) => (x.uuid === m.uuid ? { ...x, ...next } : x)) }));
    };
    const patchVer = (next: Partial<NonNullable<RiskIntegrationMethod["verificationStatus"]>>): void => {
      patch({ verificationStatus: { verified: m.verificationStatus?.verified ?? false, ...m.verificationStatus, ...next } });
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({ ...d, integrationMethods: d.integrationMethods.filter((x) => x.uuid !== m.uuid) }));
    };
    return (
      <>
        <DrawerHead cap="Integration method · RI-B7" title={m.name.length > 0 ? m.name : "Untitled method"} sub={m.verificationStatus?.verified === true ? "Verified" : "Not verified"} onClose={onClose} />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Name" value={m.name} onChange={(v) => patch({ name: v })} disabled={dis} />
            </div>
            <RiSelectField label="Verification" value={m.verificationStatus?.verified === true ? "yes" : "no"} options={VERIFIED_OPTIONS} onChange={(v) => patchVer({ verified: v === "yes" })} disabled={dis} />
            <RiTextField label="Verification method" value={m.verificationStatus?.verificationMethod ?? ""} onChange={(v) => patchVer({ verificationMethod: v })} disabled={dis} placeholder="How the method was verified" />
          </div>
          <RiAreaField label="Description" value={m.description ?? ""} onChange={(v) => patch({ description: v })} disabled={dis} rows={2} />
          <RiAreaField label="Scope of applicability" value={m.scopeJustification} onChange={(v) => patch({ scopeJustification: v })} disabled={dis} rows={2} />
          <RiStringList label="Limitations" values={m.limitations ?? []} onChange={(v) => patch({ limitations: v })} disabled={dis} />
          <SrChips srs={m.implementsSrs} />
          {editable && <RemoveBtn label="Remove method" onClick={remove} />}
        </div>
      </>
    );
  }

  if (context.kind === "family") {
    const f = ri.compiledRiskInputs.find((x) => x.uuid === context.id);
    if (f === undefined) return null;
    const sig = familySignificance(ri, f.eventSequenceFamilyRef);
    const measures = ri.scopeDefinition.consequenceMeasures;
    const patch = (next: Partial<CompiledRiskInput>): void => {
      mutateRi((d) => ({ ...d, compiledRiskInputs: d.compiledRiskInputs.map((x) => (x.uuid === f.uuid ? { ...x, ...next } : x)) }));
    };
    const setConsequence = (metric: string, meanValue: number): void => {
      patch({
        consequences: f.consequences.some((x) => x.metric === metric)
          ? f.consequences.map((x) => (x.metric === metric ? { ...x, meanValue } : x))
          : [...f.consequences, { metric, meanValue }],
      });
    };
    const setConsequenceDist = (metric: string, median: number | undefined, ef: number | undefined): void => {
      const entry = f.consequences.find((x) => x.metric === metric);
      const prev = entry?.distribution?.type === DistributionType.LOGNORMAL ? entry.distribution : undefined;
      const distribution: ParameterDistribution = { type: DistributionType.LOGNORMAL, median: median ?? prev?.median ?? 0, errorFactor: ef ?? prev?.errorFactor ?? 3 };
      patch({
        consequences: entry !== undefined
          ? f.consequences.map((x) => (x.metric === metric ? { ...x, distribution } : x))
          : [...f.consequences, { metric, meanValue: 0, distribution }],
      });
    };
    const remove = (): void => {
      onClose();
      mutateRi((d) => ({ ...d, compiledRiskInputs: d.compiledRiskInputs.filter((x) => x.uuid !== f.uuid) }));
    };
    const dist = f.frequencyDistribution?.type === DistributionType.LOGNORMAL ? f.frequencyDistribution : undefined;
    const patchDist = (median: number | undefined, ef: number | undefined): void => {
      patch({ frequencyDistribution: { type: DistributionType.LOGNORMAL, median: median ?? dist?.median ?? 0, errorFactor: ef ?? dist?.errorFactor ?? 3 } });
    };
    const bounds = lognormalBounds(f.frequencyDistribution);
    const rcRefs: [string, string][] = [["", "—"], ...(ri.scopeDefinition.releaseCategoryRefs ?? []).map((x) => [x, x] as [string, string])];
    const stRefs: [string, string][] = [["", "—"], ...(ri.scopeDefinition.sourceTermDefinitionRefs ?? []).map((x) => [x, x] as [string, string])];
    return (
      <>
        <DrawerHead
          cap="Compiled family · RI-B1"
          title={f.eventSequenceFamilyRef}
          sub={`${sig === "HIGH" ? "High" : sig === "MEDIUM" ? "Medium" : "Low"} significance${f.releaseCategoryRef !== undefined ? ` · bounds ${f.releaseCategoryRef}` : ""}`}
          onClose={onClose}
        />
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <RiTextField label="Event sequence family" value={f.eventSequenceFamilyRef} onChange={(v) => patch({ eventSequenceFamilyRef: v })} disabled={dis} />
            <RiTextField label="Quantification reference" value={f.esqFamilyQuantificationRef ?? ""} onChange={(v) => patch({ esqFamilyQuantificationRef: v })} disabled={dis} placeholder="e.g. EFQ-1" />
            <RiSelectField label="Release category" value={f.releaseCategoryRef ?? ""} options={rcRefs} onChange={(v) => patch({ releaseCategoryRef: v })} disabled={dis} />
            <RiSelectField label="Source term" value={f.sourceTermDefinitionRef ?? ""} options={stRefs} onChange={(v) => patch({ sourceTermDefinitionRef: v })} disabled={dis} />
            <div className="posfield posfield-grid--span2">
              <RiTextField label="Consequence record reference" value={f.rcqRecordRef ?? ""} onChange={(v) => patch({ rcqRecordRef: v })} disabled={dis} placeholder="e.g. RCQ-ESF-EARLY" />
            </div>
          </div>

          <div>
            <div className="essec">Frequency, from quantification</div>
            <div className="posfield-grid">
              <RiNumberField label="Mean frequency" value={f.frequency} onChange={(v) => patch({ frequency: v })} disabled={dis} />
              <RiTextField label="Frequency unit" value={f.frequencyUnit ?? ""} onChange={(v) => patch({ frequencyUnit: v })} disabled={dis} placeholder="per plant-year" />
              <RiNumberField label="Median" value={dist?.median ?? 0} onChange={(v) => patchDist(v, undefined)} disabled={dis} />
              <RiNumberField label="Error factor" value={dist?.errorFactor ?? 0} onChange={(v) => patchDist(undefined, v)} disabled={dis} />
            </div>
            {bounds !== undefined && (
              <span className="richeck">
                <span className="richeck__dot richeck__dot--ok" />
                <span>The 90 percent interval runs {valText(bounds.p05)} to {valText(bounds.p95)}, computed from the median and the error factor.</span>
              </span>
            )}
          </div>

          <div>
            <div className="essec">Consequences, from the consequence analysis</div>
            {measures.length === 0 ? (
              <p className="posmuted" style={{ margin: 0 }}>No consequence measures defined yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {measures.map((mm) => {
                  const entry = f.consequences.find((x) => x.metric === mm.name);
                  const cdist = entry?.distribution?.type === DistributionType.LOGNORMAL ? entry.distribution : undefined;
                  const cbounds = lognormalBounds(entry?.distribution);
                  return (
                    <div key={mm.name}>
                      <div className="possubtle" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{mm.name}</div>
                      <div className="posfield-grid">
                        <RiNumberField label="Mean value" value={entry?.meanValue ?? 0} onChange={(v) => setConsequence(mm.name, v)} disabled={dis} />
                        <RiNumberField label="Median" value={cdist?.median ?? 0} onChange={(v) => setConsequenceDist(mm.name, v, undefined)} disabled={dis} />
                        <RiNumberField label="Error factor" value={cdist?.errorFactor ?? 0} onChange={(v) => setConsequenceDist(mm.name, undefined, v)} disabled={dis} />
                      </div>
                      {cbounds !== undefined && (
                        <span className="richeck">
                          <span className="richeck__dot richeck__dot--ok" />
                          <span>The 90 percent interval runs {valText(cbounds.p05)} to {valText(cbounds.p95)}, from the consequence record.</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="essec">Consistency</div>
            <div className="posfield-grid">
              <RiSelectField label="Consistent with the event-sequence analysis" value={f.consistentWithEventSequenceAnalysis === true ? "yes" : "no"} options={CONFIRMED_OPTIONS} onChange={(v) => patch({ consistentWithEventSequenceAnalysis: v === "yes" })} disabled={dis} />
              <RiSelectField label="Consistent with the source term" value={f.consistentWithMechanisticSourceTerm === true ? "yes" : "no"} options={CONFIRMED_OPTIONS} onChange={(v) => patch({ consistentWithMechanisticSourceTerm: v === "yes" })} disabled={dis} />
            </div>
          </div>

          <SrChips srs={f.implementsSrs} />
          {editable && <RemoveBtn label="Remove family" onClick={remove} />}
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
