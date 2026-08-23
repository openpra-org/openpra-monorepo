import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { type EventSequenceFamilyQuantification, type QuantificationMethods, type ComputerCodeRecord, type ConvergenceAnalysis, type FlagEventSetting, type MutuallyExclusiveEventRule, type CircularLogicResolution, type ModuleUsageRecord, type SystemSuccessTreatment, type DependencyTreatment, type MultiHfeCutsetIdentification, type LinkingTransferRecord, type PhenomenaDependencyAssessment, type PhenomenaModelLogic, type EquipmentSurvivabilityAssessment, type RadionuclideBarrierQuantification, type RiskSignificantContributor, type ModelUncertaintySourceAssessment } from "interfaces-mef-types/esq/event-sequence-quantification";
import { DistributionType } from "interfaces-mef-types/core/events";
import { ESQIcon } from "./esqIcons";
import { Badge, EsqProvenanceChip, valText, pctText } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { type EsqDrawerContext } from "./esqScreens";
import { generateEsqReport } from "./esqDocx";
import {
  QUANT_BASIS_LABELS,
  CONTRIBUTOR_TYPE_LABELS,
  CONTRIBUTOR_TYPE_ENTRIES,
  MUTEX_TREATMENT_LABELS,
  CIRCULAR_METHOD_LABELS,
  MODULE_TYPE_LABELS,
  DEPENDENCY_TYPE_LABELS,
  APPROACH_LABELS,
  TRUNCATION_METHOD_LABELS,
  CHALLENGE_BASIS_LABELS,
  ESQ_TOC,
  type Stage,
  type CapabilityCategory,
} from "./esqViewData";
import { familyMeanFrequency, type CcScore } from "./esqSelectors";
import { EsqBayesianNetworkWorkspace } from "./esqBayesianNetworkWorkspace";

// ─── 05 — Dependencies (HLR-C) ─────────────────────────────────────────────
function DependScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const dep = esq.dependencyTreatment;
  const multiHfe = esq.multiHfeCutsetIdentifications ?? [];
  const hfeApps = esq.hfeDependencyApplications ?? [];
  const transfers = esq.linkingTransferRecords ?? [];
  const phenomena = esq.phenomenaDependencyAssessments ?? [];
  const pml = esq.phenomenaModelLogic;
  const surv = esq.equipmentSurvivabilityAssessments ?? [];
  const jointHepFor = (m: MultiHfeCutsetIdentification): (typeof hfeApps)[number] | undefined =>
    hfeApps.find((h) => m.cutsetDescription.includes(h.cutsetContext));
  function nextId(prefix: string, list: { uuid: string }[]): string {
    const n = list.reduce((mx, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? mx : Math.max(mx, v); }, 0) + 1;
    return `${prefix}-${String(n)}`;
  }
  function addMultiHfe(): void {
    const uuid = nextId("MH", multiHfe);
    mutateEsq((d) => ({ ...d, multiHfeCutsetIdentifications: [...(d.multiHfeCutsetIdentifications ?? []), { uuid, cutsetDescription: "New cutset", hfeRefs: [], potentialRiskImpact: "", implementsSrs: [{ sr: "ESQ-C1", hlr: "C" }, { sr: "ESQ-C2", hlr: "C" }] }] }));
    openDrawer({ kind: "multihfe", id: uuid });
  }
  function addTransfer(): void {
    const uuid = nextId("LT", transfers);
    mutateEsq((d) => ({ ...d, linkingTransferRecords: [...(d.linkingTransferRecords ?? []), { uuid, sourceTreeDescription: "Source tree", targetTreeDescription: "Target tree", failedEquipmentTransferred: [], flagSettingsTransferred: [], frequencyTransferred: true, implementsSrs: [{ sr: "ESQ-C3", hlr: "C" }] }] }));
    openDrawer({ kind: "transfer", id: uuid });
  }
  function addPhenomena(): void {
    const uuid = nextId("PD", phenomena);
    mutateEsq((d) => ({ ...d, phenomenaDependencyAssessments: [...(d.phenomenaDependencyAssessments ?? []), { uuid, phenomenon: "New phenomenon", affectedSscRefs: [], dependencyAssessment: "", implementsSrs: [{ sr: "ESQ-C4", hlr: "C" }] }] }));
    openDrawer({ kind: "phenomena", id: uuid });
  }
  function addSurv(): void {
    const uuid = nextId("SURV", surv);
    mutateEsq((d) => ({ ...d, equipmentSurvivabilityAssessments: [...(d.equipmentSurvivabilityAssessments ?? []), { uuid, equipmentRefs: [], environmentalConditions: [], survivabilityCriteria: "", assessmentResults: [], creditTaken: false, implementsSrs: [{ sr: "ESQ-C8", hlr: "C" }, { sr: "ESQ-C9", hlr: "C" }] }] }));
    openDrawer({ kind: "survivability", id: uuid });
  }
  return (
    <>
      <EsqBayesianNetworkWorkspace />

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Dependency treatment" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-C1 · ESQ-C2</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "dependency", id: "dependency" })}>Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">How each kind of dependency is carried in the integrated model, so nothing that moves together is quantified as independent.</p>
        <table className="postable postable--mid">
          <thead><tr><th>Type</th><th>Treatment</th><th>Example</th></tr></thead>
          <tbody>
            {dep.dependenciesByType.map((t, i) => (
              <tr key={i}>
                <td><div className="postable__name">{DEPENDENCY_TYPE_LABELS[t.type] ?? t.type}</div></td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{t.treatmentDescription}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{(t.examples ?? [])[0] ?? "\u2014"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="possubtle" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{dep.postInitiatorHfeDependencyBasis}</p>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Multiple human failure events in a cutset" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-C1 · ESQ-C2</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMultiHfe}><ESQIcon.Plus /> Add cutset</button>}
          </div>
        </div>
        <p className="poscard__sub">Cutsets with several human failure events are found, then their joint dependency is assessed, so the joint floor binds the product.</p>
        {multiHfe.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No multi-HFE cutsets recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Cutset</th><th>Human failure events</th><th>Joint HEP</th></tr></thead>
            <tbody>
              {multiHfe.map((m) => {
                const app = jointHepFor(m);
                const rs = m.potentialRiskImpact.toLowerCase().includes("risk-significant");
                return (
                  <tr key={m.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "multihfe", id: m.uuid })} style={{ cursor: "pointer" }}>
                    <td><div className="postable__name">{m.cutsetDescription}</div>{rs && <span className="esqstate esqstate--on" style={{ marginTop: 4 }}><span className="esqstate__dot" />Risk-significant</span>}</td>
                    <td>{m.hfeRefs.map((h, i) => <span key={i} className="poschip posmono" style={{ marginRight: 4 }}>{h}</span>)}</td>
                    <td className="posmono">{app !== undefined ? valText(app.appliedJointHep) : "\u2014"}{app !== undefined && <div className="possubtle" style={{ fontSize: 11 }}>per {app.hrDependencyAssessmentRef}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Event-tree linking transfers" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-C3</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addTransfer}><ESQIcon.Plus /> Add transfer</button>}
          </div>
        </div>
        <p className="poscard__sub">On each transfer to a downstream tree, the sequence characteristics travel with the handoff, not only the frequency.</p>
        {transfers.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No transfers recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Transfer</th><th>Carried across</th><th>Characteristics</th></tr></thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "transfer", id: t.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{t.sourceTreeDescription} to {t.targetTreeDescription}</div></td>
                  <td>{[...t.failedEquipmentTransferred, ...t.flagSettingsTransferred].map((e, i) => <span key={i} className="poschip posmono" style={{ marginRight: 4 }}>{e}</span>)}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{(t.otherCharacteristicsTransferred ?? [])[0] ?? "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Phenomena dependencies" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-C4 · ESQ-C6</EsqProvenanceChip>
            <div className="posrow" style={{ gap: 6 }}>
              {pml !== undefined && editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "phenomodel", id: "phenomodel" })}>Model logic</button>}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPhenomena}><ESQIcon.Plus /> Add phenomenon</button>}
            </div>
          </div>
        </div>
        <p className="poscard__sub">Phenomenological dependencies on credited equipment are assessed, and any independence assumption is justified.</p>
        {phenomena.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No phenomena recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Phenomenon</th><th>Affects</th><th>Assessment</th></tr></thead>
            <tbody>
              {phenomena.map((ph) => (
                <tr key={ph.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "phenomena", id: ph.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{ph.phenomenon}</div></td>
                  <td><div className="posrow posrow--wrap" style={{ gap: 6 }}>{ph.affectedSscRefs.map((x, i) => <span key={i} className="poschip posmono">{x}</span>)}</div></td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{ph.dependencyAssessment}{(ph.independenceJustifications ?? [])[0] !== undefined ? ` ${(ph.independenceJustifications ?? [])[0]}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pml !== undefined && (
          <p className="possubtle" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{pml.scrubbingJustification} {pml.beneficialFailureJustification}</p>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Equipment survivability credit" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-C8 · ESQ-C9</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSurv}><ESQIcon.Plus /> Add assessment</button>}
          </div>
        </div>
        <p className="poscard__sub">No credit is taken beyond the qualification limits at CC-I; credit at CC-II is earned by an engineering analysis that shows the equipment survives.</p>
        {surv.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No survivability assessments recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Equipment</th><th>Environment</th><th>Credit</th></tr></thead>
            <tbody>
              {surv.map((v) => (
                <tr key={v.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "survivability", id: v.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{v.equipmentRefs[0] ?? v.uuid}</div><div className="possubtle" style={{ fontSize: 12 }}>{v.survivabilityCriteria}</div></td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{(v.environmentalConditions[0]?.severity) ?? "\u2014"}</td>
                  <td><span className={`esqstate esqstate--${v.creditTaken ? "on" : "off"}`}><span className="esqstate__dot" />{v.creditTaken ? "Credited" : "Not credited"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function BarriersScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const barriers = esq.barrierQuantifications;
  function addBarrier(): void {
    const n = barriers.reduce((m, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `BAR-${String(n)}`;
    mutateEsq((d) => ({ ...d, barrierQuantifications: [...d.barrierQuantifications, { uuid, name: "New barrier", applicableSourceRefs: [], failureModes: [], challengingPhenomena: [], challengeAssessment: { basis: "CONSERVATIVE_GENERIC_ESTIMATE", challenges: [] }, capacityEvaluation: { basis: "CONSERVATIVE", description: "" }, implementsSrs: [{ sr: "ESQ-C10", hlr: "C" }] }] }));
    openDrawer({ kind: "barrier", id: uuid });
  }
  const capacityLabel = (b: (typeof barriers)[number]): string =>
    b.capacityEvaluation.basis === "REALISTIC" ? (b.capacityEvaluation.inServiceAgingIncluded === true ? "Realistic with aging" : "Realistic") : "Conservative";
  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="ESQ" title="Radionuclide barriers" level={3} />
        <div className="posrow" style={{ gap: 10 }}>
          <EsqProvenanceChip>ESQ-C10 to C15</EsqProvenanceChip>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addBarrier}><ESQIcon.Plus /> Add barrier</button>}
        </div>
      </div>
      <p className="poscard__sub">Each barrier is evaluated for its gross and localized failure modes, its challenging phenomena, and its capacity, conservatively at CC-I or realistically with aging at CC-II. For this reactor a barrier is not a containment building, so this is where the functional-containment argument is quantified.</p>
      {barriers.length === 0 ? (
        <p className="posmuted" style={{ margin: 0 }}>No barriers recorded yet.</p>
      ) : (
        <table className="postable postable--mid">
          <thead><tr><th>Barrier</th><th>Sources</th><th>Challenge</th><th>Capacity</th></tr></thead>
          <tbody>
            {barriers.map((b) => (
              <tr key={b.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "barrier", id: b.uuid })} style={{ cursor: "pointer" }}>
                <td><div className="postable__name">{b.name}</div><div className="possubtle" style={{ fontSize: 12 }}>{b.failureModes.length} failure mode{b.failureModes.length === 1 ? "" : "s"}</div></td>
                <td>{b.applicableSourceRefs.map((sc, i) => <span key={i} className="poschip posmono" style={{ marginRight: 4 }}>{sc}</span>)}</td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{CHALLENGE_BASIS_LABELS[b.challengeAssessment.basis]}</td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{capacityLabel(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── 07 — Review Results (HLR-D) ───────────────────────────────────────────
function ResultsScreen({ openDrawer }: { openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const contributors = esq.riskSignificantContributors;
  const analyses = esq.importanceAnalyses ?? [];
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
  function addContributor(): void {
    const n = contributors.reduce((m, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `RC-${String(n)}`;
    mutateEsq((d) => ({ ...d, riskSignificantContributors: [...d.riskSignificantContributors, { uuid, contributorType: "CCF" as RiskSignificantContributor["contributorType"], entityRef: "New contributor", applicableFamilyRefs: [], riskSignificanceCriteriaBasis: "", basis: "", implementsSrs: [{ sr: "ESQ-D6", hlr: "D" }] }] }));
    openDrawer({ kind: "contributor", id: uuid });
  }
  function addCutset(): void {
    const all = [...esq.cutsetLogicReviews, ...esq.nonSignificantSampleReviews];
    const n = all.reduce((m, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `CR-${String(n)}`;
    mutateEsq((d) => ({ ...d, cutsetLogicReviews: [...d.cutsetLogicReviews, { uuid, sampleDescription: "New sample", logicCorrect: true, findings: "", implementsSrs: [{ sr: "ESQ-D1", hlr: "D" }] }] }));
    openDrawer({ kind: "cutsetreview", id: uuid });
  }
  function addImportance(): void {
    const n = analyses.reduce((m, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `IMP-${String(n)}`;
    mutateEsq((d) => ({ ...d, importanceAnalyses: [...(d.importanceAnalyses ?? []), { uuid, scope: "OVERALL", measures: [], implementsSrs: [{ sr: "ESQ-D7", hlr: "D" }] }] }));
    openDrawer({ kind: "importance", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Risk-significant contributors" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-D6</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addContributor}><ESQIcon.Plus /> Add contributor</button>}
          </div>
        </div>
        <p className="poscard__sub">The contributors are identified using the criteria defined by Risk Integration, with the single-reactor scope noted for this single-unit site.</p>
        {contributors.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No contributors recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Contributor</th><th>Type</th><th>Families</th><th>Contribution</th></tr></thead>
            <tbody>
              {contributors.map((c) => (
                <tr key={c.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "contributor", id: c.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{c.entityRef}</div></td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{CONTRIBUTOR_TYPE_LABELS[c.contributorType] ?? c.contributorType}</td>
                  <td>{c.applicableFamilyRefs.map((f, i) => <span key={i} className="poschip posmono" style={{ marginRight: 4 }}>{f}</span>)}</td>
                  <td className="posmono">{pctText(c.fractionalContribution ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Importance review" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-D7</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addImportance}><ESQIcon.Plus /> Add analysis</button>}
          </div>
        </div>
        <p className="poscard__sub">The importance measures are read at the model’s level of detail, overall and per family, and anything unexpected is reconciled rather than rationalized.</p>
        {analyses.map((an) => (
          <div key={an.uuid} style={{ marginTop: 12 }}>
            <div className="posrow" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="possubtle" style={{ fontWeight: 600, color: "var(--color-text)" }}>{an.scope === "OVERALL" ? "Overall" : an.scope === "PER_FAMILY" ? `Per family · ${an.familyRef ?? ""}` : `Per sequence · ${an.sequenceRef ?? ""}`}</span>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "importance", id: an.uuid })}>Edit</button>}
            </div>
            <table className="postable postable--mid">
              <thead><tr><th>Entity</th><th>Type</th><th>Fussell-Vesely</th><th>Risk achievement worth</th></tr></thead>
              <tbody>
                {an.measures.map((m, i) => (
                  <tr key={i}>
                    <td><div className="postable__name">{m.entityRef}</div></td>
                    <td className="possubtle" style={{ fontSize: 12 }}>{m.entityType.split("_").join(" ").toLowerCase()}</td>
                    <td className="posmono">{(m.fussellVesely ?? 0).toFixed(2)}</td>
                    <td className="posmono">{(m.riskAchievementWorth ?? 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {unexpected !== undefined && (
          <p className="possubtle" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>{unexpected.description} {unexpected.reconciliation}</p>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Cutset logic review" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-D1 · ESQ-D5</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCutset}><ESQIcon.Plus /> Add sample</button>}
          </div>
        </div>
        <p className="poscard__sub">The risk-significant cutsets are checked for correct logic, and a sample of the small cutsets is checked for physical meaning.</p>
        {cutsetCards.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No samples reviewed yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Sample</th><th>Scope</th><th>Finding</th></tr></thead>
            <tbody>
              {cutsetCards.map((c) => (
                <tr key={c.id} className="postable__row--clickable" onClick={() => openDrawer({ kind: "cutsetreview", id: c.id })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{c.sample}</div></td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{c.scope === "sig" ? "Risk-significant" : "Non-significant"}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{c.finding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {audit !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title="Screening audit" level={3} />
            <div className="posrow" style={{ gap: 10 }}>
              <EsqProvenanceChip>ESQ-D8</EsqProvenanceChip>
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "screening", id: "screening" })}>Edit</button>}
            </div>
          </div>
          <p className="poscard__sub">ESQ performs none of its own screening but audits everyone else’s, so the cumulative effect of the screened-out initiators is checked.</p>
          <p className="possubtle" style={{ fontSize: 12.5, margin: "0 0 10px" }}>{audit.cumulativeImpactAssessment} {audit.basis}</p>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {audit.screenedInitiatingEventRefs.map((r, i) => <span key={i} className="poschip posmono">{r}</span>)}
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Consistency and similar-plant comparison" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-D2 · D3 · D4</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "consistency", id: "consistency" })}>Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The results are checked against the upstream models, the operational reality, the internal rules, and a similar plant.</p>
        <table className="postable postable--mid">
          <tbody>
            {consistency?.modelingFindings !== undefined && <tr><td style={{ width: 44 }}><span className="poschip posmono">D2</span></td><td className="possubtle" style={{ fontSize: 12.5 }}>{consistency.modelingFindings}</td></tr>}
            {consistency?.operationalFindings !== undefined && <tr><td><span className="poschip posmono">D2</span></td><td className="possubtle" style={{ fontSize: 12.5 }}>{consistency.operationalFindings}</td></tr>}
            {ruleReview?.findings !== undefined && <tr><td><span className="poschip posmono">D3</span></td><td className="possubtle" style={{ fontSize: 12.5 }}>{ruleReview.findings}</td></tr>}
            {similar?.keyDifferences[0] !== undefined && <tr><td><span className="poschip posmono">D4</span></td><td className="possubtle" style={{ fontSize: 12.5 }}>{similar.keyDifferences[0]}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── 08 — Uncertainty & Pre-op (HLR-E closeout) ────────────────────────────
function UncertScreen({ stage, openDrawer }: { stage: Stage; openDrawer: (ctx: EsqDrawerContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const funnel = esq.modelUncertaintySourceAssessments ?? [];
  const sokc = esq.uncertaintyPropagation.stateOfKnowledgeCorrelation;
  void stage;
  const register: { type: string; tone: string; item: string; detail: string; srs: string }[] = [
    ...esq.modelUncertainty.uncertaintySources.map((u) => ({ type: "Uncertainty", tone: "progress", item: u.source, detail: u.impact, srs: "ESQ-E1" })),
    ...(esq.preOperationalAssumptions ?? []).map((x) => ({ type: "Pre-op", tone: "warn", item: x.influenceOnDefinition, detail: x.description, srs: "ESQ-C17" })),
    ...(esq.sensitivityStudies ?? []).map((x) => ({ type: "Sensitivity", tone: "", item: x.name ?? "Sensitivity study", detail: x.results ?? "", srs: "ESQ-E2" })),
  ];
  function addFunnel(): void {
    const n = funnel.reduce((m, x) => { const v = Number(x.uuid.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const uuid = `UF-${String(n)}`;
    mutateEsq((d) => ({ ...d, modelUncertaintySourceAssessments: [...(d.modelUncertaintySourceAssessments ?? []), { uuid, sourceElementCode: "ESQ", uncertaintySource: "New source", relatedAssumptions: [], evaluationType: "QUALITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "", implementsSrs: [{ sr: "ESQ-E1", hlr: "E" }] }] }));
    openDrawer({ kind: "funnel", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="The uncertainty funnel" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-E1</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addFunnel}><ESQIcon.Plus /> Add source</button>}
          </div>
        </div>
        <p className="poscard__sub">Every element’s uncertainty stream converges here, assessed for its effect on the family frequencies, qualitatively or quantitatively.</p>
        {funnel.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No uncertainty streams recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Element</th><th>Source and effect</th><th>Evaluation</th></tr></thead>
            <tbody>
              {funnel.map((u) => (
                <tr key={u.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "funnel", id: u.uuid })} style={{ cursor: "pointer" }}>
                  <td><span className="poschip posmono">{u.sourceElementCode}</span></td>
                  <td><div className="postable__name">{u.uncertaintySource}</div><div className="possubtle" style={{ fontSize: 12 }}>{u.effectOnFamilyFrequencies}</div></td>
                  <td><span className={`esqstate esqstate--${u.evaluationType === "QUANTITATIVE" ? "on" : "off"}`}><span className="esqstate__dot" />{u.evaluationType === "QUANTITATIVE" ? "Quantitative" : "Qualitative"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="State-of-knowledge correlation" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <EsqProvenanceChip>ESQ-E2 · ESQ-A5</EsqProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "sokc", id: "sokc" })}>Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The uncertainty is propagated with the correlation between shared estimates accounted for, so estimates drawn from one number move together.</p>
        {sokc.handlingDescription !== undefined && <p className="possubtle" style={{ fontSize: 12.5, margin: "0 0 10px" }}>{sokc.handlingDescription}</p>}
        {(sokc.correlatedParameterGroups ?? []).map((g, i) => (
          <div key={i} className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 6, alignItems: "center" }}>
            <span className="possubtle" style={{ fontSize: 12 }}>Group {i + 1}</span>
            {g.map((prm, j) => <span key={j} className="poschip posmono">{prm}</span>)}
          </div>
        ))}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Open items register" level={3} />
          <span className="possubtle">ESQ-C16, C17, E1, E2, F5</span>
        </div>
        <p className="poscard__sub">The uncertainty sources, the pre-operational assumptions and the sensitivity studies feed the documentation.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r, i) => (
              <tr key={i}>
                <td><span className={`posbadge${r.tone !== "" ? ` posbadge--${r.tone}` : ""}`}>{r.tone !== "" && <span className="posbadge__dot" />}{r.type}</span></td>
                <td><div className="postable__name">{r.item}</div></td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.srs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── 09 — Draft ────────────────────────────────────────────────────────────
function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: { cc: CapabilityCategory; scores: CcScore; stage: Stage; onSubmitDraft: () => void; canSubmit: boolean }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(esq, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${esq.name} — ESQ Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
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
          <WorkbookSectionHeading workbook="ESQ" title="Conformance check" level={3} className="posgen__readout-h" />
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable, stage</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="ESQ" title="Hand-off to internal review" level={3} className="posgen__readout-h" />
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 8 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><ESQIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateEsqReport(esq, false); }}><ESQIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><ESQIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer content (family / barrier) ─────────────────────────────────────
function DrawerContent({ context, onClose }: { context: EsqDrawerContext; onClose: () => void }): JSX.Element | null {
  const { esq, links, editable, mutateEsq } = useEsqWorkbook();

  if (context.kind === "family") {
    const f = esq.familyQuantifications.find((x) => x.uuid === context.id);
    if (f === undefined) return null;
    const patchFamily = (patch: Partial<EventSequenceFamilyQuantification>): void => {
      mutateEsq((draft) => ({ ...draft, familyQuantifications: draft.familyQuantifications.map((x) => (x.uuid === f.uuid ? { ...x, ...patch } : x)) }));
    };
    const dist = f.frequencyDistribution?.type === DistributionType.LOGNORMAL ? f.frequencyDistribution : undefined;
    const patchDist = (median: number | undefined, ef: number | undefined): void => {
      patchFamily({ frequencyDistribution: { type: DistributionType.LOGNORMAL, median: median ?? dist?.median ?? 0, errorFactor: ef ?? dist?.errorFactor ?? 3 } });
    };
    const patchPercentile = (key: "percentile05" | "percentile50" | "percentile95", raw: string): void => {
      if (raw === "") { patchFamily({ [key]: undefined }); return; }
      const v = Number(raw);
      if (!Number.isNaN(v)) patchFamily({ [key]: v });
    };
    const removeFamily = (): void => {
      mutateEsq((draft) => ({ ...draft, familyQuantifications: draft.familyQuantifications.filter((x) => x.uuid !== f.uuid) }));
      onClose();
    };
    const contribs = f.contributionBreakdown ?? [];
    const patchContrib = (i: number, patch: Partial<(typeof contribs)[number]>): void => {
      patchFamily({ contributionBreakdown: contribs.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
    };
    const sources = f.significantUncertaintySources ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Event sequence family · {f.uuid}</div>
            <h2 className="posdrawer__title">{f.name}</h2>
            <p className="posdrawer__sub">{f.eventSequenceFamilyRef}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={f.name} disabled={!editable} onChange={(e) => patchFamily({ name: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Sequence family</label>{(links?.esFamilies ?? []).length > 0 ? <select className="posfield__select" value={f.eventSequenceFamilyRef} disabled={!editable} onChange={(e) => patchFamily({ eventSequenceFamilyRef: e.target.value })}><option value="">—</option>{(links?.esFamilies ?? []).map((x) => <option key={x.id} value={x.id}>{x.id} · {x.name}</option>)}</select> : <WorkbookInput className="posfield__input posmono" value={f.eventSequenceFamilyRef} disabled={!editable} onChange={(e) => patchFamily({ eventSequenceFamilyRef: e.target.value })} />}</div>
            <div className="posfield"><label className="posfield__label">Quantification basis</label><select className="posfield__select" value={f.quantificationBasis} disabled={!editable} onChange={(e) => patchFamily({ quantificationBasis: e.target.value as EventSequenceFamilyQuantification["quantificationBasis"] })}>{Object.entries(QUANT_BASIS_LABELS).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Mean frequency (/yr)</label><WorkbookInput className="posfield__input" type="number" step="any" value={familyMeanFrequency(f)} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchFamily({ meanFrequency: v }); }} /></div>
            <div className="posfield"><label className="posfield__label">Median (/yr)</label><WorkbookInput className="posfield__input" type="number" step="any" value={dist?.median ?? ""} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchDist(v, undefined); }} /></div>
            <div className="posfield"><label className="posfield__label">Error factor</label><WorkbookInput className="posfield__input" type="number" step="any" value={dist?.errorFactor ?? ""} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchDist(undefined, v); }} /></div>
            <div className="posfield"><label className="posfield__label">Dependencies in grouping</label><select className="posfield__select" value={f.dependenciesConsideredInGrouping ? "yes" : "no"} disabled={!editable} onChange={(e) => patchFamily({ dependenciesConsideredInGrouping: e.target.value === "yes" })}><option value="yes">Considered</option><option value="no">Not considered</option></select></div>
            <div className="posfield"><label className="posfield__label">P05 (/yr)</label><WorkbookInput className="posfield__input" type="number" step="any" value={f.percentile05 ?? ""} disabled={!editable} onChange={(e) => patchPercentile("percentile05", e.target.value)} /></div>
            <div className="posfield"><label className="posfield__label">P50 (/yr)</label><WorkbookInput className="posfield__input" type="number" step="any" value={f.percentile50 ?? ""} disabled={!editable} onChange={(e) => patchPercentile("percentile50", e.target.value)} /></div>
            <div className="posfield"><label className="posfield__label">P95 (/yr)</label><WorkbookInput className="posfield__input" type="number" step="any" value={f.percentile95 ?? ""} disabled={!editable} onChange={(e) => patchPercentile("percentile95", e.target.value)} /></div>
          </div>
          <div className="posfield"><label className="posfield__label">How it is quantified</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={f.representativeSequenceSelectionBasis ?? ""} disabled={!editable} onChange={(e) => patchFamily({ representativeSequenceSelectionBasis: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Cross-state grouping</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={f.crossPosGroupingJustification ?? ""} disabled={!editable} onChange={(e) => patchFamily({ crossPosGroupingJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Cross-source grouping</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={f.crossSourceGroupingJustification ?? ""} disabled={!editable} onChange={(e) => patchFamily({ crossSourceGroupingJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Contribution breakdown" className="essec" />
            {contribs.map((c, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input" style={{ flex: 2 }} value={c.contributorRef} disabled={!editable} onChange={(e) => patchContrib(i, { contributorRef: e.target.value })} />
                <select className="posfield__select" style={{ flex: 1 }} value={c.contributorType} disabled={!editable} onChange={(e) => patchContrib(i, { contributorType: e.target.value })}>{Object.entries(CONTRIBUTOR_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
                <WorkbookInput className="posfield__input" type="number" step="any" style={{ width: 90 }} value={c.fractionalContribution} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchContrib(i, { fractionalContribution: v }); }} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patchFamily({ contributionBreakdown: contribs.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchFamily({ contributionBreakdown: [...contribs, { contributorRef: "", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0 }] })}><ESQIcon.Plus /> Add contributor</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Significant uncertainty sources" className="essec" />
            {sources.map((u, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={u} disabled={!editable} onChange={(e) => patchFamily({ significantUncertaintySources: sources.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patchFamily({ significantUncertaintySources: sources.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchFamily({ significantUncertaintySources: [...sources, ""] })}><ESQIcon.Plus /> Add source</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {f.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}
          </div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={removeFamily}>Remove family</button>}
        </div>
      </>
    );
  }

  if (context.kind === "code") {
    const idx = Number(context.id);
    const c = esq.quantificationMethods.computerCodes[idx];
    if (c === undefined) return null;
    const patchCode = (patch: Partial<ComputerCodeRecord>): void => {
      mutateEsq((draft) => ({ ...draft, quantificationMethods: { ...draft.quantificationMethods, computerCodes: draft.quantificationMethods.computerCodes.map((x, j) => (j === idx ? { ...x, ...patch } : x)) } }));
    };
    const removeCode = (): void => {
      mutateEsq((draft) => ({ ...draft, quantificationMethods: { ...draft.quantificationMethods, computerCodes: draft.quantificationMethods.computerCodes.filter((_, j) => j !== idx) } }));
      onClose();
    };
    const feats = c.methodSpecificFeatures ?? [];
    const limits = c.methodSpecificLimitations;
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Quantification code</div>
            <h2 className="posdrawer__title">{c.name}</h2>
            <p className="posdrawer__sub">v{c.version}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={c.name} disabled={!editable} onChange={(e) => patchCode({ name: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Version</label><WorkbookInput className="posfield__input posmono" value={c.version} disabled={!editable} onChange={(e) => patchCode({ version: e.target.value })} /></div>
          </div>
          <div className="posfield"><label className="posfield__label">Verification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.verificationDocumentation} disabled={!editable} onChange={(e) => patchCode({ verificationDocumentation: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Validation</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.validationDocumentation} disabled={!editable} onChange={(e) => patchCode({ validationDocumentation: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Benchmark comparison</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.benchmarkComparison ?? ""} disabled={!editable} onChange={(e) => patchCode({ benchmarkComparison: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Features" className="essec" />
            {feats.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patchCode({ methodSpecificFeatures: feats.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patchCode({ methodSpecificFeatures: feats.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchCode({ methodSpecificFeatures: [...feats, ""] })}><ESQIcon.Plus /> Add feature</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Method-specific limitations" className="essec" />
            {limits.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patchCode({ methodSpecificLimitations: limits.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patchCode({ methodSpecificLimitations: limits.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchCode({ methodSpecificLimitations: [...limits, ""] })}><ESQIcon.Plus /> Add limitation</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {c.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}
          </div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={removeCode}>Remove code</button>}
        </div>
      </>
    );
  }

  if (context.kind === "truncation") {
    const t = esq.quantificationMethods.truncation;
    const patchTrunc = (patch: Partial<ConvergenceAnalysis>): void => {
      mutateEsq((draft) => ({ ...draft, quantificationMethods: { ...draft.quantificationMethods, truncation: { ...draft.quantificationMethods.truncation, ...patch } } }));
    };
    const rows = t.truncationProgression.map((cutoff) => ({ cutoff, freq: t.frequencyAtTruncation[cutoff] ?? 0 }));
    const applyRows = (next: { cutoff: number; freq: number }[]): void => {
      const freqAt: Record<number, number> = {};
      const deltaAt: Record<number, number> = {};
      next.forEach((r, i) => {
        freqAt[r.cutoff] = r.freq;
        if (i > 0) {
          const prev = next[i - 1].freq;
          if (prev > 0) deltaAt[r.cutoff] = Math.round((Math.abs(r.freq - prev) / prev) * 1000) / 10;
        }
      });
      patchTrunc({ truncationProgression: next.map((r) => r.cutoff), frequencyAtTruncation: freqAt, percentageChangeAtTruncation: deltaAt });
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Truncation convergence study</div>
            <WorkbookSectionHeading workbook="ESQ" title="Convergence demonstration" level={2} className="posdrawer__title" />
            <p className="posdrawer__sub">The change column is computed from the recorded frequencies</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Truncation method</label><select className="posfield__select" value={t.truncationMethod} disabled={!editable} onChange={(e) => patchTrunc({ truncationMethod: e.target.value as ConvergenceAnalysis["truncationMethod"] })}>{Object.entries(TRUNCATION_METHOD_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Final truncation value (/yr)</label><WorkbookInput className="posfield__input" type="number" step="any" value={t.finalTruncationValue} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchTrunc({ finalTruncationValue: v }); }} /></div>
            <div className="posfield"><label className="posfield__label">Demonstrated family</label><select className="posfield__select" value={t.demonstratedFamilyRef ?? ""} disabled={!editable} onChange={(e) => patchTrunc({ demonstratedFamilyRef: e.target.value === "" ? undefined : e.target.value })}><option value="">—</option>{esq.familyQuantifications.map((fq) => <option key={fq.uuid} value={fq.uuid}>{fq.uuid} · {fq.name}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Dependencies preserved</label><select className="posfield__select" value={t.dependenciesPreservedAtTruncation ? "yes" : "no"} disabled={!editable} onChange={(e) => patchTrunc({ dependenciesPreservedAtTruncation: e.target.value === "yes" })}><option value="yes">Confirmed</option><option value="no">Not confirmed</option></select></div>
            <div className="posfield"><label className="posfield__label">Merged cutsets re-confirmed</label><select className="posfield__select" value={t.mergedCutsetTruncationConfirmed === true ? "yes" : "no"} disabled={!editable} onChange={(e) => patchTrunc({ mergedCutsetTruncationConfirmed: e.target.value === "yes" })}><option value="yes">Confirmed</option><option value="no">Not confirmed</option></select></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Progression" className="essec" />
            <div className="posrow" style={{ gap: 8, marginBottom: 4 }}>
              <span className="posfield__label" style={{ flex: 1 }}>Cutoff (/yr)</span>
              <span className="posfield__label" style={{ flex: 1 }}>Tracked-family frequency (/yr)</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input posmono" type="number" step="any" style={{ flex: 1 }} value={r.cutoff} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) applyRows(rows.map((y, j) => (j === i ? { ...y, cutoff: v } : y))); }} />
                <WorkbookInput className="posfield__input posmono" type="number" step="any" style={{ flex: 1 }} value={r.freq} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) applyRows(rows.map((y, j) => (j === i ? { ...y, freq: v } : y))); }} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => applyRows(rows.filter((_, j) => j !== i))}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => applyRows([...rows, { cutoff: rows.length > 0 ? rows[rows.length - 1].cutoff / 10 : 1e-9, freq: rows.length > 0 ? rows[rows.length - 1].freq : 0 }])}><ESQIcon.Plus /> Add cutoff</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Basis for selection</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={t.basisForSelection} disabled={!editable} onChange={(e) => patchTrunc({ basisForSelection: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Convergence demonstration</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={t.convergenceDemonstration} disabled={!editable} onChange={(e) => patchTrunc({ convergenceDemonstration: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Merged-cutset confirmation basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={t.mergedCutsetConfirmationBasis ?? ""} disabled={!editable} onChange={(e) => patchTrunc({ mergedCutsetConfirmationBasis: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Truncation sensitivity</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={t.truncationSensitivity ?? ""} disabled={!editable} onChange={(e) => patchTrunc({ truncationSensitivity: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {t.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "solution") {
    const qm = esq.quantificationMethods;
    const patchQm = (patch: Partial<QuantificationMethods>): void => {
      mutateEsq((draft) => ({ ...draft, quantificationMethods: { ...draft.quantificationMethods, ...patch } }));
    };
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Solution and approximation</div>
            <WorkbookSectionHeading workbook="ESQ" title="Quantification method" level={2} className="posdrawer__title" />
            <p className="posdrawer__sub">{APPROACH_LABELS[qm.approach] ?? qm.approach}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Approach</label><select className="posfield__select" value={qm.approach} disabled={!editable} onChange={(e) => patchQm({ approach: e.target.value as QuantificationMethods["approach"] })}>{Object.entries(APPROACH_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Cutset solution method</label><select className="posfield__select" value={qm.cutsetSolutionMethod ?? ""} disabled={!editable} onChange={(e) => { const method = e.target.value === "" ? undefined : (e.target.value as QuantificationMethods["cutsetSolutionMethod"]); patchQm(method === "RARE_EVENT" ? { cutsetSolutionMethod: method } : { cutsetSolutionMethod: method, rareEventJustification: undefined }); }}><option value="">—</option><option value="MCUB">Minimal cutset upper bound</option><option value="EXACT">Exact solution</option><option value="RARE_EVENT">Rare-event approximation</option></select></div>
          </div>
          {qm.cutsetSolutionMethod === "RARE_EVENT" && (
            <div className="posfield"><label className="posfield__label">Rare-event justification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={qm.rareEventJustification ?? ""} disabled={!editable} onChange={(e) => patchQm({ rareEventJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
          )}
          <div className="posfield"><label className="posfield__label">Method discrimination</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={qm.methodDiscriminationJustification} disabled={!editable} onChange={(e) => patchQm({ methodDiscriminationJustification: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Post-initiator HFE handling</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={qm.postInitiatorHfeHandling ?? ""} disabled={!editable} onChange={(e) => patchQm({ postInitiatorHfeHandling: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {qm.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "flag") {
    const f = (esq.flagEventSettings ?? []).find((x) => x.uuid === context.id);
    if (f === undefined) return null;
    const patch = (p: Partial<FlagEventSetting>): void => {
      mutateEsq((draft) => ({ ...draft, flagEventSettings: (draft.flagEventSettings ?? []).map((x) => (x.uuid === f.uuid ? { ...x, ...p } : x)) }));
    };
    const remove = (): void => {
      mutateEsq((draft) => ({ ...draft, flagEventSettings: (draft.flagEventSettings ?? []).filter((x) => x.uuid !== f.uuid) }));
      onClose();
    };
    const refs = f.applicableFamilyRefs ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">House-event flag · {f.uuid}</div><h2 className="posdrawer__title">{f.name}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={f.name} disabled={!editable} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Purpose</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={f.purpose} disabled={!editable} onChange={(e) => patch({ purpose: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Effect</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={f.effect} disabled={!editable} onChange={(e) => patch({ effect: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={f.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">State</label><select className="posfield__select" value={f.state ? "true" : "false"} disabled={!editable} onChange={(e) => patch({ state: e.target.value === "true" })}><option value="true">True</option><option value="false">False</option></select></div>
            <div className="posfield"><label className="posfield__label">Set before cutset generation</label><select className="posfield__select" value={f.setPriorToCutsetGeneration ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ setPriorToCutsetGeneration: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
            <div className="posfield"><label className="posfield__label">Temporary</label><select className="posfield__select" value={f.isTemporary ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ isTemporary: e.target.value === "yes" })}><option value="no">Permanent</option><option value="yes">Temporary</option></select></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Applies to families" className="essec" />
            {refs.map((r, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <select className="posfield__select" style={{ flex: 1 }} value={r} disabled={!editable} onChange={(e) => patch({ applicableFamilyRefs: refs.map((y, j) => (j === i ? e.target.value : y)) })}><option value="">—</option>{esq.familyQuantifications.map((fq) => <option key={fq.uuid} value={fq.uuid}>{fq.uuid} · {fq.name}</option>)}</select>
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ applicableFamilyRefs: refs.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ applicableFamilyRefs: [...refs, ""] })}><ESQIcon.Plus /> Add family</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{f.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove flag</button>}
        </div>
      </>
    );
  }

  if (context.kind === "mutex") {
    const m = (esq.mutuallyExclusiveEventRules ?? []).find((x) => x.uuid === context.id);
    if (m === undefined) return null;
    const patch = (p: Partial<MutuallyExclusiveEventRule>): void => {
      mutateEsq((draft) => ({ ...draft, mutuallyExclusiveEventRules: (draft.mutuallyExclusiveEventRules ?? []).map((x) => (x.uuid === m.uuid ? { ...x, ...p } : x)) }));
    };
    const remove = (): void => {
      mutateEsq((draft) => ({ ...draft, mutuallyExclusiveEventRules: (draft.mutuallyExclusiveEventRules ?? []).filter((x) => x.uuid !== m.uuid) }));
      onClose();
    };
    const evs = m.eventIds;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Mutually exclusive rule · {m.uuid}</div><h2 className="posdrawer__title">{m.description}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Description</label><WorkbookInput className="posfield__input" value={m.description} disabled={!editable} onChange={(e) => patch({ description: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={m.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Treatment</label><select className="posfield__select" value={m.treatment} disabled={!editable} onChange={(e) => patch({ treatment: e.target.value as MutuallyExclusiveEventRule["treatment"] })}>{Object.entries(MUTEX_TREATMENT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Identified in results</label><select className="posfield__select" value={m.identifiedInResults ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ identifiedInResults: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Events that cannot coexist" className="essec" />
            {evs.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ eventIds: evs.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ eventIds: evs.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ eventIds: [...evs, ""] })}><ESQIcon.Plus /> Add event</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Retention justification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={m.retentionJustification ?? ""} disabled={!editable} onChange={(e) => patch({ retentionJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{m.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove rule</button>}
        </div>
      </>
    );
  }

  if (context.kind === "circular") {
    const c = (esq.circularLogicResolutions ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (p: Partial<CircularLogicResolution>): void => {
      mutateEsq((draft) => ({ ...draft, circularLogicResolutions: (draft.circularLogicResolutions ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...p } : x)) }));
    };
    const remove = (): void => {
      mutateEsq((draft) => ({ ...draft, circularLogicResolutions: (draft.circularLogicResolutions ?? []).filter((x) => x.uuid !== c.uuid) }));
      onClose();
    };
    const els = c.involvedElementIds;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Circular logic · {c.uuid}</div><h2 className="posdrawer__title">{c.description}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Description</label><WorkbookInput className="posfield__input" value={c.description} disabled={!editable} onChange={(e) => patch({ description: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Detection method</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.detectionMethod} disabled={!editable} onChange={(e) => patch({ detectionMethod: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Resolution method</label><select className="posfield__select" value={c.resolutionMethod} disabled={!editable} onChange={(e) => patch({ resolutionMethod: e.target.value as CircularLogicResolution["resolutionMethod"] })}>{Object.entries(CIRCULAR_METHOD_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="posfield"><label className="posfield__label">Resolution description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.resolutionDescription} disabled={!editable} onChange={(e) => patch({ resolutionDescription: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Neutrality justification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.neutralityJustification} disabled={!editable} onChange={(e) => patch({ neutralityJustification: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Systems in the loop" className="essec" />
            {els.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ involvedElementIds: els.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ involvedElementIds: els.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ involvedElementIds: [...els, ""] })}><ESQIcon.Plus /> Add system</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{c.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove resolution</button>}
        </div>
      </>
    );
  }

  if (context.kind === "module") {
    const m = (esq.moduleUsageRecords ?? []).find((x) => x.uuid === context.id);
    if (m === undefined) return null;
    const patch = (p: Partial<ModuleUsageRecord>): void => {
      mutateEsq((draft) => ({ ...draft, moduleUsageRecords: (draft.moduleUsageRecords ?? []).map((x) => (x.uuid === m.uuid ? { ...x, ...p } : x)) }));
    };
    const remove = (): void => {
      mutateEsq((draft) => ({ ...draft, moduleUsageRecords: (draft.moduleUsageRecords ?? []).filter((x) => x.uuid !== m.uuid) }));
      onClose();
    };
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Module · {m.uuid}</div><h2 className="posdrawer__title">{MODULE_TYPE_LABELS[m.moduleType] ?? m.moduleType}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Module type</label><select className="posfield__select" value={m.moduleType} disabled={!editable} onChange={(e) => patch({ moduleType: e.target.value as ModuleUsageRecord["moduleType"] })}>{Object.entries(MODULE_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="posfield"><label className="posfield__label">Process description</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={m.processDescription} disabled={!editable} onChange={(e) => patch({ processDescription: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Shared events identified</label><select className="posfield__select" value={m.sharedEventsIdentified ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ sharedEventsIdentified: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
            <div className="posfield"><label className="posfield__label">Independence verified</label><select className="posfield__select" value={m.trueIndependenceVerified ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ trueIndependenceVerified: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
            <div className="posfield"><label className="posfield__label">Per-event interpretable</label><select className="posfield__select" value={m.perEventInterpretabilityMaintained ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ perEventInterpretabilityMaintained: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{m.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove module</button>}
        </div>
      </>
    );
  }

  if (context.kind === "success") {
    const t = esq.systemSuccessTreatment;
    const patch = (p: Partial<SystemSuccessTreatment>): void => {
      mutateEsq((draft) => ({ ...draft, systemSuccessTreatment: { ...draft.systemSuccessTreatment, ...p } }));
    };
    const systems = t.systemsWithSuccessModeled;
    const examples = t.modelingExamples ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Success paths kept</div><WorkbookSectionHeading workbook="ESQ" title="System success treatment" level={2} className="posdrawer__title" /></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Treatment method</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={t.treatmentMethod} disabled={!editable} onChange={(e) => patch({ treatmentMethod: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Impact on results</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={t.impactOnResults} disabled={!editable} onChange={(e) => patch({ impactOnResults: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Systems with success modeled" className="essec" />
            {systems.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ systemsWithSuccessModeled: systems.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ systemsWithSuccessModeled: systems.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ systemsWithSuccessModeled: [...systems, ""] })}><ESQIcon.Plus /> Add system</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Modeling examples" className="essec" />
            {examples.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ modelingExamples: examples.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ modelingExamples: examples.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ modelingExamples: [...examples, ""] })}><ESQIcon.Plus /> Add example</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{t.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "dependency") {
    const d = esq.dependencyTreatment;
    const patch = (p: Partial<DependencyTreatment>): void => { mutateEsq((dr) => ({ ...dr, dependencyTreatment: { ...dr.dependencyTreatment, ...p } })); };
    const rows = d.dependenciesByType;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Dependency treatment</div><WorkbookSectionHeading workbook="ESQ" title="By type and method" level={2} className="posdrawer__title" /></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <WorkbookCueLabel workbook="ESQ" title="Dependencies by type" className="essec" />
          {rows.map((r, i) => (
            <div key={i} className="posfield" style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined, paddingTop: i > 0 ? 12 : 0 }}>
              <label className="posfield__label">{DEPENDENCY_TYPE_LABELS[r.type] ?? r.type}</label>
              <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={r.treatmentDescription} disabled={!editable} onChange={(e) => patch({ dependenciesByType: rows.map((y, j) => (j === i ? { ...y, treatmentDescription: e.target.value } : y)) })} />
              <WorkbookInput className="posfield__input" style={{ marginTop: 6 }} value={(r.examples ?? [])[0] ?? ""} disabled={!editable} placeholder="Example" onChange={(e) => patch({ dependenciesByType: rows.map((y, j) => (j === i ? { ...y, examples: e.target.value === "" ? [] : [e.target.value] } : y)) })} />
            </div>
          ))}
          <div className="posfield"><label className="posfield__label">Post-initiator HFE dependency method</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={d.postInitiatorHfeDependencyMethod} disabled={!editable} onChange={(e) => patch({ postInitiatorHfeDependencyMethod: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Post-initiator HFE dependency basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={d.postInitiatorHfeDependencyBasis} disabled={!editable} onChange={(e) => patch({ postInitiatorHfeDependencyBasis: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Recovery dependency treatment</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={d.recoveryDependencyTreatment} disabled={!editable} onChange={(e) => patch({ recoveryDependencyTreatment: e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{d.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "multihfe") {
    const m = (esq.multiHfeCutsetIdentifications ?? []).find((x) => x.uuid === context.id);
    if (m === undefined) return null;
    const patch = (p: Partial<MultiHfeCutsetIdentification>): void => { mutateEsq((dr) => ({ ...dr, multiHfeCutsetIdentifications: (dr.multiHfeCutsetIdentifications ?? []).map((x) => (x.uuid === m.uuid ? { ...x, ...p } : x)) })); };
    const remove = (): void => { mutateEsq((dr) => ({ ...dr, multiHfeCutsetIdentifications: (dr.multiHfeCutsetIdentifications ?? []).filter((x) => x.uuid !== m.uuid) })); onClose(); };
    const app = (esq.hfeDependencyApplications ?? []).find((h) => m.cutsetDescription.includes(h.cutsetContext));
    const patchApp = (p: Partial<NonNullable<typeof app>>): void => { if (app === undefined) return; mutateEsq((dr) => ({ ...dr, hfeDependencyApplications: (dr.hfeDependencyApplications ?? []).map((x) => (x.uuid === app.uuid ? { ...x, ...p } : x)) })); };
    const refs = m.hfeRefs;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Multi-HFE cutset · {m.uuid}</div><WorkbookSectionHeading workbook="ESQ" title="Joint dependency" level={2} className="posdrawer__title" /></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Cutset description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={m.cutsetDescription} disabled={!editable} onChange={(e) => patch({ cutsetDescription: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Human failure events" className="essec" />
            {refs.map((x, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ hfeRefs: refs.map((y, j) => (j === i ? e.target.value : y)) })} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ hfeRefs: refs.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ hfeRefs: [...refs, ""] })}><ESQIcon.Plus /> Add HFE</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Potential risk impact</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={m.potentialRiskImpact} disabled={!editable} onChange={(e) => patch({ potentialRiskImpact: e.target.value })} /></div>
          {app !== undefined && (
            <div className="posfield-grid">
              <div className="posfield"><label className="posfield__label">HR dependency assessment</label><WorkbookInput className="posfield__input posmono" value={app.hrDependencyAssessmentRef} disabled={!editable} onChange={(e) => patchApp({ hrDependencyAssessmentRef: e.target.value })} /></div>
              <div className="posfield"><label className="posfield__label">Applied joint HEP</label><WorkbookInput className="posfield__input" type="number" step="any" value={app.appliedJointHep ?? ""} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchApp({ appliedJointHep: v }); }} /></div>
            </div>
          )}
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{m.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove cutset</button>}
        </div>
      </>
    );
  }

  if (context.kind === "transfer") {
    const t = (esq.linkingTransferRecords ?? []).find((x) => x.uuid === context.id);
    if (t === undefined) return null;
    const patch = (p: Partial<LinkingTransferRecord>): void => { mutateEsq((dr) => ({ ...dr, linkingTransferRecords: (dr.linkingTransferRecords ?? []).map((x) => (x.uuid === t.uuid ? { ...x, ...p } : x)) })); };
    const remove = (): void => { mutateEsq((dr) => ({ ...dr, linkingTransferRecords: (dr.linkingTransferRecords ?? []).filter((x) => x.uuid !== t.uuid) })); onClose(); };
    const eqp = t.failedEquipmentTransferred; const flg = t.flagSettingsTransferred; const oc = t.otherCharacteristicsTransferred ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Linking transfer · {t.uuid}</div><h2 className="posdrawer__title">{t.sourceTreeDescription} to {t.targetTreeDescription}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Source tree</label><WorkbookInput className="posfield__input" value={t.sourceTreeDescription} disabled={!editable} onChange={(e) => patch({ sourceTreeDescription: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Target tree</label><WorkbookInput className="posfield__input" value={t.targetTreeDescription} disabled={!editable} onChange={(e) => patch({ targetTreeDescription: e.target.value })} /></div>
            <div className="posfield"><label className="posfield__label">Frequency transferred</label><select className="posfield__select" value={t.frequencyTransferred ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ frequencyTransferred: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Failed equipment carried" className="essec" />
            {eqp.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ failedEquipmentTransferred: eqp.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ failedEquipmentTransferred: eqp.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ failedEquipmentTransferred: [...eqp, ""] })}><ESQIcon.Plus /> Add equipment</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Flag settings carried" className="essec" />
            {flg.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ flagSettingsTransferred: flg.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ flagSettingsTransferred: flg.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ flagSettingsTransferred: [...flg, ""] })}><ESQIcon.Plus /> Add flag</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Other characteristics carried</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={oc[0] ?? ""} disabled={!editable} onChange={(e) => patch({ otherCharacteristicsTransferred: e.target.value === "" ? [] : [e.target.value] })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{t.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove transfer</button>}
        </div>
      </>
    );
  }

  if (context.kind === "phenomena") {
    const ph = (esq.phenomenaDependencyAssessments ?? []).find((x) => x.uuid === context.id);
    if (ph === undefined) return null;
    const patch = (p: Partial<PhenomenaDependencyAssessment>): void => { mutateEsq((dr) => ({ ...dr, phenomenaDependencyAssessments: (dr.phenomenaDependencyAssessments ?? []).map((x) => (x.uuid === ph.uuid ? { ...x, ...p } : x)) })); };
    const remove = (): void => { mutateEsq((dr) => ({ ...dr, phenomenaDependencyAssessments: (dr.phenomenaDependencyAssessments ?? []).filter((x) => x.uuid !== ph.uuid) })); onClose(); };
    const sscs = ph.affectedSscRefs; const inds = ph.independenceJustifications ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Phenomena dependency · {ph.uuid}</div><h2 className="posdrawer__title">{ph.phenomenon}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Phenomenon</label><WorkbookInput className="posfield__input" value={ph.phenomenon} disabled={!editable} onChange={(e) => patch({ phenomenon: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Affected systems and components" className="essec" />
            {sscs.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ affectedSscRefs: sscs.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ affectedSscRefs: sscs.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ affectedSscRefs: [...sscs, ""] })}><ESQIcon.Plus /> Add reference</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Dependency assessment</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={ph.dependencyAssessment} disabled={!editable} onChange={(e) => patch({ dependencyAssessment: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Independence justifications" className="essec" />
            {inds.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ independenceJustifications: inds.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ independenceJustifications: inds.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ independenceJustifications: [...inds, ""] })}><ESQIcon.Plus /> Add justification</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{ph.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove phenomenon</button>}
        </div>
      </>
    );
  }

  if (context.kind === "phenomodel") {
    const pl = esq.phenomenaModelLogic;
    if (pl === undefined) return null;
    const patch = (p: Partial<PhenomenaModelLogic>): void => { mutateEsq((dr) => ({ ...dr, phenomenaModelLogic: dr.phenomenaModelLogic === undefined ? dr.phenomenaModelLogic : { ...dr.phenomenaModelLogic, ...p } })); };
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Phenomena model logic</div><WorkbookSectionHeading workbook="ESQ" title="Included effects" level={2} className="posdrawer__title" /></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={pl.description} disabled={!editable} onChange={(e) => patch({ description: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Logic included</label><select className="posfield__select" value={pl.logicIncluded ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ logicIncluded: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
            <div className="posfield"><label className="posfield__label">Scrubbing effects</label><select className="posfield__select" value={pl.scrubbingEffectsIncluded === true ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ scrubbingEffectsIncluded: e.target.value === "yes" })}><option value="yes">Included</option><option value="no">Not included</option></select></div>
            <div className="posfield"><label className="posfield__label">Beneficial failures</label><select className="posfield__select" value={pl.beneficialFailuresIncluded === true ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ beneficialFailuresIncluded: e.target.value === "yes" })}><option value="yes">Included</option><option value="no">Not included</option></select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Scrubbing justification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={pl.scrubbingJustification ?? ""} disabled={!editable} onChange={(e) => patch({ scrubbingJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Beneficial-failure justification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={pl.beneficialFailureJustification ?? ""} disabled={!editable} onChange={(e) => patch({ beneficialFailureJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{pl.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "survivability") {
    const v = (esq.equipmentSurvivabilityAssessments ?? []).find((x) => x.uuid === context.id);
    if (v === undefined) return null;
    const patch = (p: Partial<EquipmentSurvivabilityAssessment>): void => { mutateEsq((dr) => ({ ...dr, equipmentSurvivabilityAssessments: (dr.equipmentSurvivabilityAssessments ?? []).map((x) => (x.uuid === v.uuid ? { ...x, ...p } : x)) })); };
    const remove = (): void => { mutateEsq((dr) => ({ ...dr, equipmentSurvivabilityAssessments: (dr.equipmentSurvivabilityAssessments ?? []).filter((x) => x.uuid !== v.uuid) })); onClose(); };
    const eqp = v.equipmentRefs; const conds = v.environmentalConditions; const res = v.assessmentResults;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Survivability assessment · {v.uuid}</div><h2 className="posdrawer__title">{v.equipmentRefs[0] ?? "Equipment"}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Equipment" className="essec" />
            {eqp.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ equipmentRefs: eqp.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ equipmentRefs: eqp.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ equipmentRefs: [...eqp, ""] })}><ESQIcon.Plus /> Add equipment</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Environmental conditions" className="essec" />
            {conds.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input" style={{ flex: 1 }} placeholder="Type" value={x.type} disabled={!editable} onChange={(e) => patch({ environmentalConditions: conds.map((y, j) => (j === i ? { ...y, type: e.target.value } : y)) })} /><WorkbookInput className="posfield__input" style={{ flex: 2 }} placeholder="Severity" value={x.severity} disabled={!editable} onChange={(e) => patch({ environmentalConditions: conds.map((y, j) => (j === i ? { ...y, severity: e.target.value } : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ environmentalConditions: conds.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ environmentalConditions: [...conds, { type: "", severity: "" }] })}><ESQIcon.Plus /> Add condition</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Survivability criteria</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={v.survivabilityCriteria} disabled={!editable} onChange={(e) => patch({ survivabilityCriteria: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Results" className="essec" />
            {res.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><span className={`esqstate esqstate--${x.survives ? "on" : "off"}`}><span className="esqstate__dot" />{x.survives ? "Survives" : "Fails"}</span><WorkbookInput className="posfield__input" style={{ flex: 1 }} placeholder="Basis" value={x.basis} disabled={!editable} onChange={(e) => patch({ assessmentResults: res.map((y, j) => (j === i ? { ...y, basis: e.target.value } : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ assessmentResults: res.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ assessmentResults: [...res, { equipmentRef: eqp[0] ?? "", survives: true, basis: "" }] })}><ESQIcon.Plus /> Add result</button>}
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Credit taken</label><select className="posfield__select" value={v.creditTaken ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ creditTaken: e.target.value === "yes" })}><option value="yes">Credited at CC-II</option><option value="no">Not credited</option></select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Credit justification</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={v.creditJustification ?? ""} disabled={!editable} onChange={(e) => patch({ creditJustification: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{v.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove assessment</button>}
        </div>
      </>
    );
  }

  if (context.kind === "funnel") {
    const u = (esq.modelUncertaintySourceAssessments ?? []).find((x) => x.uuid === context.id);
    if (u === undefined) return null;
    const patch = (p: Partial<ModelUncertaintySourceAssessment>): void => { mutateEsq((dr) => ({ ...dr, modelUncertaintySourceAssessments: (dr.modelUncertaintySourceAssessments ?? []).map((x) => (x.uuid === u.uuid ? { ...x, ...p } : x)) })); };
    const remove = (): void => { mutateEsq((dr) => ({ ...dr, modelUncertaintySourceAssessments: (dr.modelUncertaintySourceAssessments ?? []).filter((x) => x.uuid !== u.uuid) })); onClose(); };
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Uncertainty stream · {u.uuid}</div><h2 className="posdrawer__title">{u.sourceElementCode}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Source element</label><select className="posfield__select" value={u.sourceElementCode} disabled={!editable} onChange={(e) => patch({ sourceElementCode: e.target.value as ModelUncertaintySourceAssessment["sourceElementCode"] })}>{["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ"].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Evaluation</label><select className="posfield__select" value={u.evaluationType} disabled={!editable} onChange={(e) => patch({ evaluationType: e.target.value as ModelUncertaintySourceAssessment["evaluationType"] })}><option value="QUALITATIVE">Qualitative</option><option value="QUANTITATIVE">Quantitative</option></select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Uncertainty source</label><WorkbookInput className="posfield__input" value={u.uncertaintySource} disabled={!editable} onChange={(e) => patch({ uncertaintySource: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Effect on family frequencies</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={u.effectOnFamilyFrequencies} disabled={!editable} onChange={(e) => patch({ effectOnFamilyFrequencies: e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{u.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove source</button>}
        </div>
      </>
    );
  }

  if (context.kind === "sokc") {
    const up = esq.uncertaintyPropagation;
    const c = up.stateOfKnowledgeCorrelation;
    const patch = (p: Partial<typeof c>): void => { mutateEsq((dr) => ({ ...dr, uncertaintyPropagation: { ...dr.uncertaintyPropagation, stateOfKnowledgeCorrelation: { ...dr.uncertaintyPropagation.stateOfKnowledgeCorrelation, ...p } } })); };
    const groups = c.correlatedParameterGroups ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">State-of-knowledge correlation</div><WorkbookSectionHeading workbook="ESQ" title="Shared-estimate handling" level={2} className="posdrawer__title" /></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Considered</label><select className="posfield__select" value={c.isConsidered ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ isConsidered: e.target.value === "yes" })}><option value="yes">Yes</option><option value="no">No</option></select></div>
          <div className="posfield"><label className="posfield__label">Handling description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.handlingDescription ?? ""} disabled={!editable} onChange={(e) => patch({ handlingDescription: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Impact assessment</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.impactAssessment ?? ""} disabled={!editable} onChange={(e) => patch({ impactAssessment: e.target.value === "" ? undefined : e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Correlated parameter groups" className="essec" />
            {groups.map((g, i) => (
              <div key={i} className="posfield" style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined, paddingTop: i > 0 ? 12 : 0 }}>
                <label className="posfield__label">Group {String(i + 1)} (comma-separated)</label>
                <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
                  <WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={g.join(", ")} disabled={!editable} onChange={(e) => patch({ correlatedParameterGroups: groups.map((y, j) => (j === i ? e.target.value.split(",").map((z) => z.trim()).filter((z) => z !== "") : y)) })} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ correlatedParameterGroups: groups.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
                </div>
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ correlatedParameterGroups: [...groups, []] })}><ESQIcon.Plus /> Add group</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{up.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "contributor") {
    const c = esq.riskSignificantContributors.find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (p: Partial<RiskSignificantContributor>): void => { mutateEsq((dr) => ({ ...dr, riskSignificantContributors: dr.riskSignificantContributors.map((x) => (x.uuid === c.uuid ? { ...x, ...p } : x)) })); };
    const remove = (): void => { mutateEsq((dr) => ({ ...dr, riskSignificantContributors: dr.riskSignificantContributors.filter((x) => x.uuid !== c.uuid) })); onClose(); };
    const fams = c.applicableFamilyRefs;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Risk-significant contributor · {c.uuid}</div><h2 className="posdrawer__title">{c.entityRef}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Entity</label><WorkbookInput className="posfield__input" value={c.entityRef} disabled={!editable} onChange={(e) => patch({ entityRef: e.target.value })} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Type</label><select className="posfield__select" value={c.contributorType} disabled={!editable} onChange={(e) => patch({ contributorType: e.target.value as RiskSignificantContributor["contributorType"] })}>{CONTRIBUTOR_TYPE_ENTRIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="posfield"><label className="posfield__label">Contribution (fraction)</label><WorkbookInput className="posfield__input" type="number" step="any" value={c.fractionalContribution ?? ""} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patch({ fractionalContribution: v }); }} /></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Applicable families" className="essec" />
            {fams.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><select className="posfield__select" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ applicableFamilyRefs: fams.map((y, j) => (j === i ? e.target.value : y)) })}><option value="">·—</option>{esq.familyQuantifications.map((fq) => <option key={fq.uuid} value={fq.uuid}>{fq.uuid} · {fq.name}</option>)}</select>{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ applicableFamilyRefs: fams.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ applicableFamilyRefs: [...fams, ""] })}><ESQIcon.Plus /> Add family</button>}
          </div>
          <div className="posfield"><label className="posfield__label">Risk-significance criteria basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.riskSignificanceCriteriaBasis} disabled={!editable} onChange={(e) => patch({ riskSignificanceCriteriaBasis: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={c.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{c.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove contributor</button>}
        </div>
      </>
    );
  }

  if (context.kind === "importance") {
    const rec = (esq.importanceAnalyses ?? []).find((x) => x.uuid === context.id);
    const rev = (esq.importanceReviews ?? [])[0];
    if (rec === undefined) return null;
    const measures = rec.measures;
    const showReview = rec.scope === "OVERALL" && rev !== undefined;
    const removeRec = (): void => { mutateEsq((dr) => ({ ...dr, importanceAnalyses: (dr.importanceAnalyses ?? []).filter((x) => x.uuid !== rec.uuid) })); onClose(); };
    const patchMeasures = (next: typeof measures): void => { mutateEsq((dr) => ({ ...dr, importanceAnalyses: (dr.importanceAnalyses ?? []).map((x) => (x.uuid === rec.uuid ? { ...x, measures: next } : x)) })); };
    const unexpected = rev?.unexpectedResults ?? [];
    const patchUnexpected = (next: typeof unexpected): void => { mutateEsq((dr) => ({ ...dr, importanceReviews: (dr.importanceReviews ?? []).map((x, i) => (i === 0 ? { ...x, unexpectedResults: next } : x)) })); };
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Importance analysis · {rec.uuid}</div><h2 className="posdrawer__title">{rec.scope === "OVERALL" ? "Overall" : rec.scope === "PER_FAMILY" ? `Per family · ${rec.familyRef ?? ""}` : "Per sequence"}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <WorkbookCueLabel workbook="ESQ" title="Importance measures" className="essec" />
          {measures.map((m, i) => (
            <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
              <WorkbookInput className="posfield__input" style={{ flex: 2 }} value={m.entityRef} disabled={!editable} onChange={(e) => patchMeasures(measures.map((y, j) => (j === i ? { ...y, entityRef: e.target.value } : y)))} />
              <WorkbookInput className="posfield__input posmono" type="number" step="any" style={{ width: 84 }} title="Fussell-Vesely" value={m.fussellVesely ?? ""} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchMeasures(measures.map((y, j) => (j === i ? { ...y, fussellVesely: v } : y))); }} />
              <WorkbookInput className="posfield__input posmono" type="number" step="any" style={{ width: 84 }} title="Risk achievement worth" value={m.riskAchievementWorth ?? ""} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patchMeasures(measures.map((y, j) => (j === i ? { ...y, riskAchievementWorth: v } : y))); }} />
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patchMeasures(measures.filter((_, j) => j !== i))}><ESQIcon.Close /></button>}
            </div>
          ))}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchMeasures([...measures, { entityType: "BASIC_EVENT", entityRef: "", fussellVesely: 0, riskAchievementWorth: 1 }])}><ESQIcon.Plus /> Add measure</button>}
          {showReview && (
            <>
              <WorkbookCueLabel workbook="ESQ" title="Unexpected results reconciled" className="essec" />
              {unexpected.map((u, i) => (
                <div key={i} className="posfield" style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined, paddingTop: i > 0 ? 12 : 0 }}>
                  <WorkbookInput className="posfield__input" placeholder="Entity" value={u.entityRef} disabled={!editable} onChange={(e) => patchUnexpected(unexpected.map((y, j) => (j === i ? { ...y, entityRef: e.target.value } : y)))} />
                  <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical", marginTop: 6 }} placeholder="Description" value={u.description} disabled={!editable} onChange={(e) => patchUnexpected(unexpected.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
                  <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical", marginTop: 6 }} placeholder="Reconciliation" value={u.reconciliation} disabled={!editable} onChange={(e) => patchUnexpected(unexpected.map((y, j) => (j === i ? { ...y, reconciliation: e.target.value } : y)))} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ marginTop: 6 }} onClick={() => patchUnexpected(unexpected.filter((_, j) => j !== i))}><ESQIcon.Close /> Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patchUnexpected([...unexpected, { entityRef: "", description: "", reconciliation: "" }])}><ESQIcon.Plus /> Add reconciliation</button>}
            </>
          )}
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{rec.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && rec.scope !== "OVERALL" && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={removeRec}>Remove analysis</button>}
        </div>
      </>
    );
  }

  if (context.kind === "cutsetreview") {
    const sig = esq.cutsetLogicReviews.find((x) => x.uuid === context.id);
    const nonsig = esq.nonSignificantSampleReviews.find((x) => x.uuid === context.id);
    const rec = sig ?? nonsig;
    if (rec === undefined) return null;
    const isSig = sig !== undefined;
    const patchField = (field: "sampleDescription" | "findings", val: string): void => {
      mutateEsq((dr) => isSig
        ? { ...dr, cutsetLogicReviews: dr.cutsetLogicReviews.map((x) => (x.uuid === rec.uuid ? { ...x, [field]: val } : x)) }
        : { ...dr, nonSignificantSampleReviews: dr.nonSignificantSampleReviews.map((x) => (x.uuid === rec.uuid ? { ...x, [field]: val } : x)) });
    };
    const remove = (): void => { mutateEsq((dr) => isSig ? { ...dr, cutsetLogicReviews: dr.cutsetLogicReviews.filter((x) => x.uuid !== rec.uuid) } : { ...dr, nonSignificantSampleReviews: dr.nonSignificantSampleReviews.filter((x) => x.uuid !== rec.uuid) }); onClose(); };
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Cutset review · {rec.uuid}</div><h2 className="posdrawer__title">{isSig ? "Risk-significant sample" : "Non-significant sample"}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Sample description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={rec.sampleDescription} disabled={!editable} onChange={(e) => patchField("sampleDescription", e.target.value)} /></div>
          <div className="posfield"><label className="posfield__label">Findings</label><WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={rec.findings} disabled={!editable} onChange={(e) => patchField("findings", e.target.value)} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{rec.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove sample</button>}
        </div>
      </>
    );
  }

  if (context.kind === "screening") {
    const audit = esq.screenedEventCumulativeAssessment;
    if (audit === undefined) return null;
    const patch = (p: Partial<NonNullable<typeof audit>>): void => { mutateEsq((dr) => ({ ...dr, screenedEventCumulativeAssessment: dr.screenedEventCumulativeAssessment === undefined ? dr.screenedEventCumulativeAssessment : { ...dr.screenedEventCumulativeAssessment, ...p } })); };
    const refs = audit.screenedInitiatingEventRefs;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Screening audit</div><WorkbookSectionHeading workbook="ESQ" title="Cumulative screened-event check" level={2} className="posdrawer__title" /></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Cumulative impact assessment</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={audit.cumulativeImpactAssessment} disabled={!editable} onChange={(e) => patch({ cumulativeImpactAssessment: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Basis</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={audit.basis} disabled={!editable} onChange={(e) => patch({ basis: e.target.value })} /></div>
          <div className="posfield"><label className="posfield__label">Affects risk-significant contributors</label><select className="posfield__select" value={audit.affectsRiskSignificantContributors ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ affectsRiskSignificantContributors: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></select></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Screened initiating events" className="essec" />
            {refs.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input posmono" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ screenedInitiatingEventRefs: refs.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ screenedInitiatingEventRefs: refs.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ screenedInitiatingEventRefs: [...refs, ""] })}><ESQIcon.Plus /> Add event</button>}
          </div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{audit.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
        </div>
      </>
    );
  }

  if (context.kind === "consistency") {
    const con = esq.consistencyReviews[0];
    const rul = esq.ruleLogicReviews[0];
    const sim = (esq.similarPlantComparisons ?? [])[0];
    const patchCon = (p: Partial<typeof con>): void => { mutateEsq((dr) => ({ ...dr, consistencyReviews: dr.consistencyReviews.map((x, i) => (i === 0 ? { ...x, ...p } : x)) })); };
    const patchRul = (p: Partial<typeof rul>): void => { mutateEsq((dr) => ({ ...dr, ruleLogicReviews: dr.ruleLogicReviews.map((x, i) => (i === 0 ? { ...x, ...p } : x)) })); };
    const patchSim = (p: Partial<NonNullable<typeof sim>>): void => { mutateEsq((dr) => ({ ...dr, similarPlantComparisons: (dr.similarPlantComparisons ?? []).map((x, i) => (i === 0 ? { ...x, ...p } : x)) })); };
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Consistency reviews</div><WorkbookSectionHeading workbook="ESQ" title="Against models, rules and a similar plant" level={2} className="posdrawer__title" /></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          {con !== undefined && <div className="posfield"><label className="posfield__label">Modeling consistency (D2)</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={con.modelingFindings ?? ""} disabled={!editable} onChange={(e) => patchCon({ modelingFindings: e.target.value })} /></div>}
          {con !== undefined && <div className="posfield"><label className="posfield__label">Operational consistency (D2)</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={con.operationalFindings ?? ""} disabled={!editable} onChange={(e) => patchCon({ operationalFindings: e.target.value })} /></div>}
          {rul !== undefined && <div className="posfield"><label className="posfield__label">Rule-logic review (D3)</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={rul.findings ?? ""} disabled={!editable} onChange={(e) => patchRul({ findings: e.target.value })} /></div>}
          {sim !== undefined && <div className="posfield"><label className="posfield__label">Similar-plant key difference (D4)</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={sim.keyDifferences[0] ?? ""} disabled={!editable} onChange={(e) => patchSim({ keyDifferences: [e.target.value, ...sim.keyDifferences.slice(1)] })} /></div>}
          {sim !== undefined && <div className="posfield"><label className="posfield__label">Cause of the difference</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={(sim.differenceCauses ?? [])[0] ?? ""} disabled={!editable} onChange={(e) => patchSim({ differenceCauses: [e.target.value, ...(sim.differenceCauses ?? []).slice(1)] })} /></div>}
        </div>
      </>
    );
  }

  if (context.kind === "barrier") {
    const b = esq.barrierQuantifications.find((x) => x.uuid === context.id);
    if (b === undefined) return null;
    const patch = (p: Partial<RadionuclideBarrierQuantification>): void => { mutateEsq((dr) => ({ ...dr, barrierQuantifications: dr.barrierQuantifications.map((x) => (x.uuid === b.uuid ? { ...x, ...p } : x)) })); };
    const remove = (): void => { mutateEsq((dr) => ({ ...dr, barrierQuantifications: dr.barrierQuantifications.filter((x) => x.uuid !== b.uuid) })); onClose(); };
    const srcs = b.applicableSourceRefs; const modes = b.failureModes; const phen = b.challengingPhenomena;
    return (
      <>
        <div className="posdrawer__head">
          <div><div className="posdrawer__cap">Radionuclide barrier · {b.uuid}</div><h2 className="posdrawer__title">{b.name}</h2></div>
          <button type="button" className="posdrawer__close" onClick={onClose}><ESQIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield"><label className="posfield__label">Name</label><WorkbookInput className="posfield__input" value={b.name} disabled={!editable} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Applicable sources" className="essec" />
            {srcs.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ applicableSourceRefs: srcs.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ applicableSourceRefs: srcs.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ applicableSourceRefs: [...srcs, ""] })}><ESQIcon.Plus /> Add source</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Failure modes" className="essec" />
            {modes.map((m, i) => (
              <div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                <select className="posfield__select" style={{ width: 120 }} value={m.failureType} disabled={!editable} onChange={(e) => patch({ failureModes: modes.map((y, j) => (j === i ? { ...y, failureType: e.target.value as typeof m.failureType } : y)) })}><option value="GROSS">Gross</option><option value="LOCALIZED_DEGRADED">Localized</option></select>
                <WorkbookInput className="posfield__input" style={{ flex: 1 }} placeholder="Mode" value={m.failureMode} disabled={!editable} onChange={(e) => patch({ failureModes: modes.map((y, j) => (j === i ? { ...y, failureMode: e.target.value } : y)) })} />
                <WorkbookInput className="posfield__input posmono" type="number" step="any" style={{ width: 96 }} value={m.probability ?? ""} disabled={!editable} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) patch({ failureModes: modes.map((y, j) => (j === i ? { ...y, probability: v } : y)) }); }} />
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ failureModes: modes.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}
              </div>
            ))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ failureModes: [...modes, { failureMode: "", failureType: "GROSS", mechanisms: [] }] })}><ESQIcon.Plus /> Add mode</button>}
          </div>
          <div>
            <WorkbookCueLabel workbook="ESQ" title="Challenging phenomena" className="essec" />
            {phen.map((x, i) => (<div key={i} className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}><WorkbookInput className="posfield__input" style={{ flex: 1 }} value={x} disabled={!editable} onChange={(e) => patch({ challengingPhenomena: phen.map((y, j) => (j === i ? e.target.value : y)) })} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => patch({ challengingPhenomena: phen.filter((_, j) => j !== i) })}><ESQIcon.Close /></button>}</div>))}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => patch({ challengingPhenomena: [...phen, ""] })}><ESQIcon.Plus /> Add phenomenon</button>}
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Challenge basis</label><select className="posfield__select" value={b.challengeAssessment.basis} disabled={!editable} onChange={(e) => patch({ challengeAssessment: { ...b.challengeAssessment, basis: e.target.value as typeof b.challengeAssessment.basis } })}><option value="CONSERVATIVE_GENERIC_ESTIMATE">Conservative estimate</option><option value="REALISTIC_PLANT_SPECIFIC_CALCULATION">Realistic plant-specific</option></select></div>
            <div className="posfield"><label className="posfield__label">Capacity basis</label><select className="posfield__select" value={b.capacityEvaluation.basis} disabled={!editable} onChange={(e) => patch({ capacityEvaluation: { ...b.capacityEvaluation, basis: e.target.value as typeof b.capacityEvaluation.basis } })}><option value="CONSERVATIVE">Conservative</option><option value="REALISTIC">Realistic</option></select></div>
            <div className="posfield"><label className="posfield__label">In-service aging</label><select className="posfield__select" value={b.capacityEvaluation.inServiceAgingIncluded === true ? "yes" : "no"} disabled={!editable} onChange={(e) => patch({ capacityEvaluation: { ...b.capacityEvaluation, inServiceAgingIncluded: e.target.value === "yes" } })}><option value="no">Not included</option><option value="yes">Included</option></select></div>
          </div>
          <div className="posfield"><label className="posfield__label">Capacity description</label><WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={b.capacityEvaluation.description} disabled={!editable} onChange={(e) => patch({ capacityEvaluation: { ...b.capacityEvaluation, description: e.target.value } })} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>{b.implementsSrs.map((x) => <span key={x.sr} className="poschip poschip--method">{x.sr}</span>)}</div>
          {editable && <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={remove}>Remove barrier</button>}
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
