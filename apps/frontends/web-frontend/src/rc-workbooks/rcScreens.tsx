import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX, useState } from "react";
import { type PlantStage } from "interfaces-mef-types/core/pra-common";
import { type RcEvaluationSubElement } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RCIcon } from "./rcIcons";
import { Badge, RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  RC_METHODS,
  SITE_OPTIONS,
  PROTECTIVE_ACTION_LABELS,
  INCIDENT_PHASE_LABELS,
  EVAC_DELAY_LABELS,
  SITE_DATA_BASIS_LABELS,
  type SiteBasis,
} from "./rcViewData";
import { RcMsSourceTerm } from "./rcMsSourceTerm";
import { RcSiteReceptorsPanel } from "./rcSiteReceptors";
import { RcMeteorologyPanel } from "./rcMeteorology";
import { RC_SCOPE_ASPECTS, rcScopeTreatment } from "./rcScope";

type Stage = "pre_operational" | "operational";

interface RcDrawerContext {
  kind: string;
  id: string;
}

function MethodChips({ ids, label }: { ids: string[]; label?: string }): JSX.Element | null {
  const ms = ids.map((id) => RC_METHODS[id]).filter((m): m is (typeof RC_METHODS)[string] => m !== undefined);
  if (ms.length === 0) return null;
  return (
    <div className="hrmethods">
      {label !== undefined && <span className="hrmethods__label">{label}</span>}
      {ms.map((m) => (
        <span key={m.id} className="hrmethod-chip" aria-label={`${m.name} · ${m.ref}`}>{m.abbr}</span>
      ))}
    </div>
  );
}

// ─── Interfaces — the data RC exchanges with ES, MS and RI ──────────────────
function RcInterfaces({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc, eventSequenceFamilySources, releaseCategorySources } = useRcWorkbook();
  const rcc = rc.releaseCategoryToConsequence;
  const inputs = rcc.releaseCategoryInputs;
  const metrics = rc.scope.consequenceMetrics;
  const [selected, setSelected] = useState<string | null>("MS");

  const tiles: { code: string; name: string; handoff: string }[] = [
    { code: "ES", name: "Event Sequence Analysis", handoff: "Provides · Release categories" },
    { code: "MS", name: "Mechanistic Source Term", handoff: "Provides · Source term" },
    { code: "RI", name: "Risk Integration", handoff: "Provides measures · Receives results" },
  ];
  const unmatchedInputs = inputs.filter((input) => !releaseCategorySources.some((source) => source.category.releaseCategoryId === input.releaseCategory));

  function updateMetrics(next: string[]): void {
    if (!editable) return;
    mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, consequenceMetrics: next } }));
  }

  return (
    <>
      <div className="poshandoff__grid rc-handoff__interface-tiles">
        {tiles.map((tile) => (
          <button key={tile.code} type="button"
            className={`poshandoff__tile${selected === tile.code ? " poshandoff__tile--active" : ""}`}
            onClick={() => setSelected(selected === tile.code ? null : tile.code)}>
            <span className="poshandoff__tile-code">{tile.code}</span>
            <span className="poshandoff__tile-name">{tile.name}</span>
            <span className="poshandoff__tile-role">{tile.handoff}</span>
          </button>
        ))}
      </div>

      {selected === "ES" && (
        <div className="rc-handoff__es" style={{ marginTop: 16 }}>
          {releaseCategorySources.length === 0 && inputs.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No ES release categories or RC categories yet.</p>
          ) : (
            <table className="postable postable--mid">
              <thead><tr><th>Matching RC category</th><th>ES category</th><th>ES families</th><th>Physical release characteristics</th></tr></thead>
              <tbody>
                {releaseCategorySources.map((source) => {
                  const familyNames = eventSequenceFamilySources
                    .filter((family) => family.workbookId === source.workbookId && family.family.releaseCategoryIds?.includes(source.category.releaseCategoryId))
                    .map((family) => family.family.name || family.family.uuid);
                  return <tr key={`${source.workbookId}|${source.category.uuid}`}>
                    <td className="posmono">{inputs.some((input) => input.releaseCategory === source.category.releaseCategoryId) ? source.category.releaseCategoryId : "Not in RC"}</td>
                    <td><div className="postable__name">{source.category.releaseCategoryId}</div><span className="postable__name-sub">{source.workbookName}</span></td>
                    <td>{familyNames.length > 0 ? familyNames.join(", ") : "—"}</td>
                    <td>{source.category.physicalReleaseCharacteristics.join(" · ") || "—"}</td>
                  </tr>;
                })}
                {unmatchedInputs.map((input) => (
                  <tr key={`unmatched|${input.releaseCategory}`}>
                    <td><div className="postable__name">{input.releaseCategory}</div></td>
                    <td>No matching ES category</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected === "MS" && <RcMsSourceTerm openDrawer={openDrawer} />}

      {selected === "RI" && (
        <div className="rc-handoff__ri" style={{ marginTop: 16 }}>
          <div className="posfield">
            <label className="posfield__label">Consequence metrics</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {metrics.map((m, i) => (
                <div key={i} className="posrow" style={{ gap: 6 }}>
                  <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={m} disabled={!editable} onChange={(e) => updateMetrics(metrics.map((y, j) => (j === i ? e.target.value : y)))} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => updateMetrics([...metrics.slice(0, i), ...metrics.slice(i + 1)])}>Remove</button>}
                </div>
              ))}
              {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => updateMetrics([...metrics, "New consequence metric"])}><RCIcon.Plus /> Add metric</button>}
            </div>
          </div>
          <div className="posfield" style={{ marginTop: 16 }}>
            <label className="posfield__label">Metric selection basis</label>
            <WorkbookTextarea className="posfield__textarea" rows={2} value={rc.scope.metricSelectionApplicationBasis ?? ""} disabled={!editable}
              onChange={(e) => mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, metricSelectionApplicationBasis: e.target.value } }))} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── 01 — Scope (RCRE) ─────────────────────────────────────────────────────
function HandoffScreen({ ccId, setCcId, site, setSite, openDrawer }: {
  ccId: string;
  setCcId: (id: string) => void;
  site: SiteBasis;
  setSite: (s: SiteBasis) => void;
  openDrawer: (ctx: RcDrawerContext) => void;
}): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const stage: Stage = rc.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateRc((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateRc((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    const plantStage: PlantStage = newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL";
    mutateRc((draft) => ({ ...draft, plantStage }));
  }
  function onSiteChange(next: SiteBasis): void {
    if (!editable) return;
    setSite(next);
    mutateRc((draft) => {
      const current = draft.releaseCategoryToConsequence;
      if (next === "bounding_site") {
        const existing = current.siteInformation.isBounding ? current.siteInformation.boundingSite : undefined;
        return {
          ...draft,
          releaseCategoryToConsequence: {
            ...current,
            siteInformation: {
              isBounding: true,
              boundingSite: existing ?? {
                description: "A bounding generic inland site.",
                characteristics: { siteBoundaryDistance: 400, populationCentreDistance: 6, terrain: "Flat inland terrain." },
                boundingJustification: "Justified to bound every candidate site in the PRA scope.",
              },
            },
          },
        };
      }
      return {
        ...draft,
        releaseCategoryToConsequence: {
          ...current,
          siteInformation: { isBounding: false, siteReference: current.siteInformation.isBounding ? "SITE-1" : current.siteInformation.siteReference },
        },
      };
    });
  }
  function updateScopeDecision(subElement: RcEvaluationSubElement, included: boolean | undefined): void {
    if (!editable) return;
    mutateRc((draft) => ({
      ...draft,
      scope: {
        ...draft.scope,
        evaluationDecisions: [
          ...(draft.scope.evaluationDecisions ?? []).filter((decision) => decision.subElement !== subElement),
          ...(included === undefined ? [] : [{ subElement, included }]),
        ],
      },
    }));
  }
  function updateExclusionReason(subElement: RcEvaluationSubElement, exclusionReason: string): void {
    if (!editable) return;
    mutateRc((draft) => ({
      ...draft,
      scope: {
        ...draft.scope,
        evaluationDecisions: (draft.scope.evaluationDecisions ?? []).map((decision) => (
          decision.subElement === subElement ? { ...decision, exclusionReason } : decision
        )),
      },
    }));
  }

  return (
    <>
      <div className="poscard rc-handoff__wide-card">
        <div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Interfaces" level={3} /></div>
        <RcInterfaces openDrawer={openDrawer} />
      </div>

      <div className="poscard rc-handoff__wide-card rc-handoff__scope">
        <div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="PRA scope" level={3} /></div>
        <WorkbookTextarea
          className="posfield__textarea"
          aria-label="PRA scope"
          rows={3}
          value={rc.praScope}
          disabled={!editable}
          onChange={(e) => onScopeChange(e.target.value)}
        />
        <div className="rcscope">
          <h4 className="rcscope__title">Evaluation by aspect</h4>
          <div className="rcscope__table-wrap">
            <table className="postable rcscope__table" aria-label="Evaluation by aspect">
              <thead><tr><th>Aspect</th><th>Included?</th><th>Treatment used</th><th>Reason for exclusion</th></tr></thead>
              <tbody>{RC_SCOPE_ASPECTS.map((aspect) => {
                const decision = rc.scope.evaluationDecisions?.find((item) => item.subElement === aspect.subElement);
                const treatment = rcScopeTreatment(rc, aspect.subElement);
                const reasonMissing = decision?.included === false && !decision.exclusionReason?.trim();
                return <tr key={aspect.subElement}>
                  <td><strong>{aspect.label}</strong><span className="rcscope__step">Step {aspect.step}</span></td>
                  <td><select className="posfield__select" aria-label={`${aspect.label} inclusion`} value={decision === undefined ? "" : decision.included ? "included" : "excluded"} disabled={!editable} onChange={(event) => updateScopeDecision(aspect.subElement, event.target.value === "" ? undefined : event.target.value === "included")}>
                    <option value="">Not set</option><option value="included">Included</option><option value="excluded">Excluded</option>
                  </select></td>
                  <td>{decision?.included === false ? "—" : treatment || <span className="posmuted">Not recorded</span>}</td>
                  <td>{decision?.included === false ? <><WorkbookInput className="posfield__input" aria-label={`${aspect.label} exclusion reason`} aria-invalid={reasonMissing} value={decision.exclusionReason ?? ""} disabled={!editable} onChange={(event) => updateExclusionReason(aspect.subElement, event.target.value)} />{reasonMissing && <span className="rcscope__error" role="alert">Reason required</span>}</> : "—"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="poscard rc-handoff__compact-card">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div className="rc-handoff__choices">
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

      <div className="poscard rc-handoff__compact-card">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Site fork" level={3} />
          <RcProvenanceChip>RCRE-A1</RcProvenanceChip>
        </div>
        <div className="rcsite">
          {SITE_OPTIONS.map((o) => {
            const Icon = RCIcon[o.icon] ?? RCIcon.Pin;
            const active = o.id === site;
            return (
              <button key={o.id} type="button" className={`rcsite__opt${active ? " rcsite__opt--active" : ""}`} disabled={!editable} onClick={() => onSiteChange(o.id)}>
                <div className="rcsite__opt-head">
                  <span className="rcsite__opt-icon"><Icon /></span>
                  <div>
                    <div className="rcsite__opt-name">{o.name}</div>
                    <div className="rcsite__opt-tag">{o.tag}</div>
                  </div>
                </div>
                <p className="rcsite__opt-desc">{o.desc}</p>
              </button>
            );
          })}
        </div>
        {rc.releaseCategoryToConsequence.siteInformation.isBounding && editable && (
          <button type="button" className="posnav__btn posnav__btn--sm" style={{ marginTop: 12 }} onClick={() => openDrawer({ kind: "site", id: "site" })}>
            <RCIcon.Settings /> Edit bounding site
          </button>
        )}
      </div>

      <div className="poscard rc-handoff__compact-card">
        <div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Plant stage" level={3} /></div>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Plant-response data comes from general or design calculations, with gaps from the not-yet-built plant written down as assumptions."],
            ["operational", "Operational", "Real data and procedures from the running plant are available to confirm the consequence analysis."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <WorkbookInput type="radio" name="rc-stage" value={val} checked={stage === val} disabled={!editable} onChange={() => onStageChange(val)} />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12.5 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 02 — Protective Actions & Site (RCPA) ─────────────────────────────────
function ProtectiveScreen({ openDrawer, initialSiteTab }: { openDrawer: (ctx: RcDrawerContext) => void; initialSiteTab?: "location" | "receptors" }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const pa = rc.protectiveActionParameters;
  const cohorts = pa.cohortModeling.cohorts ?? [];
  const speedFlags = pa.evacuationSpeed;
  const params = pa.protectionParameters ?? [];

  const siteRows = [
    { id: "pop", name: "Population distribution", icon: "Users", note: [pa.populationDistribution.description, pa.populationDistribution.justification].filter(Boolean).join(" "), basis: pa.populationDistribution.basis },
    { id: "land", name: "Land use", icon: "Leaf", note: pa.landUseData.description, basis: pa.landUseData.basis },
    { id: "bldg", name: "Building dimensions and stack heights", icon: "Home", note: pa.plantPhysicalCharacteristics.description, basis: pa.plantPhysicalCharacteristics.basis },
  ];

  function addAction(): void {
    mutateRc((draft) => ({ ...draft, protectiveActionParameters: { ...draft.protectiveActionParameters, protectiveActionsIncluded: [...draft.protectiveActionParameters.protectiveActionsIncluded, { action: "EVACUATION", included: true, applicabilityJustification: "New protective action." }] } }));
    openDrawer({ kind: "protaction", id: String(pa.protectiveActionsIncluded.length) });
  }
  function addCohort(): void {
    mutateRc((draft) => {
      const cm = draft.protectiveActionParameters.cohortModeling;
      return { ...draft, protectiveActionParameters: { ...draft.protectiveActionParameters, cohortModeling: { ...cm, cohorts: [...(cm.cohorts ?? []), { name: "New cohort", description: "" }] } } };
    });
    openDrawer({ kind: "cohort", id: String(cohorts.length) });
  }
  function addSourceDoc(): void {
    mutateRc((draft) => ({ ...draft, protectiveActionParameters: { ...draft.protectiveActionParameters, sourceDocuments: [...draft.protectiveActionParameters.sourceDocuments, { document: "New source document", usage: "" }] } }));
    openDrawer({ kind: "sourcedoc", id: String(pa.sourceDocuments.length) });
  }
  function addEvacDelay(): void {
    mutateRc((draft) => ({ ...draft, protectiveActionParameters: { ...draft.protectiveActionParameters, evacuationDelayComponents: [...(draft.protectiveActionParameters.evacuationDelayComponents ?? []), { component: "LOAD_VEHICLES", estimate: "+0 min" }] } }));
    openDrawer({ kind: "evacdelay", id: String((pa.evacuationDelayComponents ?? []).length) });
  }
  function addProtParam(): void {
    mutateRc((draft) => ({ ...draft, protectiveActionParameters: { ...draft.protectiveActionParameters, protectionParameters: [...(draft.protectiveActionParameters.protectionParameters ?? []), { parameter: "New parameter", value: "", source: "" }] } }));
    openDrawer({ kind: "protparam", id: String(params.length) });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Protective actions" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A1</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAction}><RCIcon.Plus /> Add action</button>}
          </div>
        </div>
        <div className="rcpa">
          {pa.protectiveActionsIncluded.map((a, i) => {
            const meta = PROTECTIVE_ACTION_LABELS[a.action];
            const Icon = RCIcon[meta?.icon ?? "Shield"] ?? RCIcon.Shield;
            return (
              <button key={i} type="button" className={`rcpa__cell${a.included ? "" : " rcpa__cell--out"}`} style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "protaction", id: String(i) })}>
                <span className="rcpa__icon"><Icon /></span>
                <div className="rcpa__main">
                  <div className="rcpa__name">{meta?.name ?? a.action}</div>
                  <div className="rcpa__note">{a.applicabilityJustification ?? "n/a"}</div>
                </div>
                <span className={`rcpa__state rcpa__state--${a.included ? "in" : "out"}`}>{a.included ? <RCIcon.Check /> : <RCIcon.Close />}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Incident phases" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A2</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSourceDoc}><RCIcon.Plus /> Add document</button>}
          </div>
        </div>
        <div className="rcphase">
          {pa.incidentPhasesModeled.map((p) => {
            const meta = INCIDENT_PHASE_LABELS[p.phase];
            return (
              <button key={p.phase} type="button" className="rcphase__col" style={{ cursor: "pointer", textAlign: "left", width: "100%", font: "inherit", color: "inherit" }} onClick={() => openDrawer({ kind: "phase", id: p.phase })}>
                <div className="rcphase__col-head">
                  <span className="rcphase__dot" />
                  <div>
                    <div className="rcphase__name">{meta?.name ?? p.phase}</div>
                    <div className="rcphase__window posmono">{meta?.window ?? ""}</div>
                  </div>
                </div>
                <p className="rcphase__desc">{p.criteriaDescription}</p>
              </button>
            );
          })}
        </div>
        <div className="rcbasis" style={{ marginTop: 12 }}>
          {pa.sourceDocuments.map((d, i) => (
            <button key={i} type="button" className="rcbasis__row" style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "sourcedoc", id: String(i) })}>
              <span className="rcbasis__icon"><RCIcon.Doc /></span>
              <div className="rcbasis__main">
                <div className="rcbasis__name">{d.document}</div>
                <div className="rcbasis__note">{d.usage}</div>
              </div>
              <span className="rcbasis__tag rcbasis__tag--rich">Source</span>
            </button>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Cohort modeling" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A4 · A5</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCohort}><RCIcon.Plus /> Add cohort</button>}
          </div>
        </div>
        <div className="rccohort">
          {cohorts.map((c, i) => {
            const refuse = c.name.toLowerCase().includes("non-compliant");
            return (
              <button key={i} type="button" className={`rccohort__card${refuse ? " rccohort__card--refuse" : ""}`} style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "cohort", id: String(i) })}>
                <span className="rccohort__name">{c.name}</span>
                <p className="rccohort__desc">{c.description}</p>
              </button>
            );
          })}
        </div>
        <div className="posfield" style={{ marginTop: 12 }}>
          <label className="posfield__label">Shelter-in-place credit justification</label>
          <WorkbookTextarea className="posfield__textarea" rows={2} value={pa.shelterInPlaceCredit?.justification ?? ""} disabled={!editable}
            onChange={(e) => mutateRc((draft) => ({ ...draft, protectiveActionParameters: { ...draft.protectiveActionParameters, shelterInPlaceCredit: { credited: draft.protectiveActionParameters.shelterInPlaceCredit?.credited ?? true, justification: e.target.value } } }))} />
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Protection parameters" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A12</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addProtParam}><RCIcon.Plus /> Add parameter</button>}
          </div>
        </div>
        {params.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No protection parameters yet.</p>
        ) : (
          <table className="postable">
            <thead><tr><th>Parameter</th><th>Value</th><th>Source</th></tr></thead>
            <tbody>
              {params.map((p, i) => (
                <tr key={i} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "protparam", id: String(i) })}>
                  <td style={{ fontWeight: 600 }}>{p.parameter}</td>
                  <td className="posmono">{p.value}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Evacuation delay chain" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A9 · A10</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addEvacDelay}><RCIcon.Plus /> Add link</button>}
          </div>
        </div>
        <div className="rcdelay">
          {(pa.evacuationDelayComponents ?? []).map((l, i) => (
            <button key={i} type="button" className="rcdelay__link" style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "evacdelay", id: String(i) })}>
              <span className="rcdelay__num posmono">{i + 1}</span>
              <span className="rcdelay__label">{EVAC_DELAY_LABELS[l.component] ?? l.component}</span>
              <span className="rcdelay__est">{l.estimate}</span>
            </button>
          ))}
        </div>
        {speedFlags !== undefined && (
          <div className="posfield" style={{ marginTop: 12 }}>
            <label className="posfield__label">Evacuation speed basis</label>
            <WorkbookTextarea className="posfield__textarea" rows={2} value={speedFlags.basis} disabled={!editable}
              onChange={(e) => mutateRc((draft) => ({ ...draft, protectiveActionParameters: { ...draft.protectiveActionParameters, evacuationSpeed: { ...speedFlags, basis: e.target.value } } }))} />
          </div>
        )}
      </div>

      <RcSiteReceptorsPanel initialTab={initialSiteTab} />

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Site data" level={3} />
          <RcProvenanceChip>RCPA-B1 · B2 · B3</RcProvenanceChip>
        </div>
        <div className="rcbasis">
          {siteRows.map((d) => {
            const Icon = RCIcon[d.icon] ?? RCIcon.Map;
            const basis = SITE_DATA_BASIS_LABELS[d.basis] ?? { label: d.basis, kind: "simple" as const };
            return (
              <button key={d.id} type="button" className="rcbasis__row" style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "sitedata", id: d.id })}>
                <span className="rcbasis__icon"><Icon /></span>
                <div className="rcbasis__main">
                  <div className="rcbasis__name">{d.name}</div>
                  <div className="rcbasis__note">{d.note}</div>
                </div>
                <span className={`rcbasis__tag rcbasis__tag--${basis.kind}`}>{basis.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── 03 — Meteorology (RCME) ───────────────────────────────────────────────
function WeatherScreen({ openDrawer, onReviewSite }: { openDrawer: (ctx: RcDrawerContext) => void; onReviewSite?: () => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const met = rc.meteorologicalData;
  return (
    <>
      <RcMeteorologyPanel onReviewSite={onReviewSite} />
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Meteorological data quality" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCME-A1 to A4</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "metdata", id: "met" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <div className="rcmet">
          <div className="rcmet__rows">
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Radio /> Source</span><span className="rcmet__v">{met.dataSource}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Map /> Representativeness</span><span className="rcmet__v">{met.spatialRepresentativenessJustification}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Refresh /> Substitution</span><span className="rcmet__v">{met.dataRecovery.substitutionTechniques ?? "n/a"}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Person /> Review</span><span className="rcmet__v">{[met.dataRecovery.meteorologistReview?.reviewerQualification, met.dataRecovery.meteorologistReview?.considerations].filter(Boolean).join(" ") || "n/a"}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Settings /> Instruments</span><span className="rcmet__v">{met.instrumentationQuality?.description ?? "n/a"}</span></div>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Period selection" level={3} />
          <RcProvenanceChip>RCME-A2</RcProvenanceChip>
        </div>
        <div className="posfield">
          <label className="posfield__label">Period-selection description</label>
          <WorkbookTextarea className="posfield__textarea" rows={2} value={met.periodSelection.periodDescription} disabled={!editable}
            onChange={(e) => mutateRc((draft) => ({ ...draft, meteorologicalData: { ...draft.meteorologicalData, periodSelection: { ...draft.meteorologicalData.periodSelection, periodDescription: e.target.value } } }))} />
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Extracted parameters" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCME-A5 to A7</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "metparams", id: "met" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <div className="rcparam">
          {met.extractedParameters.windSpeedAndDirection10m && <span className="rcparam__chip"><RCIcon.Wind /> Wind and direction at 10 m</span>}
          {met.extractedParameters.stabilityClassMeasurement && <span className="rcparam__chip"><RCIcon.Layers /> Stability class</span>}
          {met.extractedParameters.precipitation === true && <span className="rcparam__chip"><RCIcon.Rain /> Precipitation</span>}
          {met.mixingHeights !== undefined && <span className="rcparam__chip"><RCIcon.Mountain /> Mixing heights</span>}
        </div>
        <div className="posfield" style={{ marginTop: 12 }}>
          <label className="posfield__label">Stability classification method</label>
          <WorkbookTextarea className="posfield__textarea" rows={2} value={met.stabilityClassificationMethod.description} disabled={!editable}
            onChange={(e) => mutateRc((draft) => ({ ...draft, meteorologicalData: { ...draft.meteorologicalData, stabilityClassificationMethod: { ...draft.meteorologicalData.stabilityClassificationMethod, description: e.target.value } } }))} />
        </div>
      </div>
    </>
  );
}

export { RcInterfaces, HandoffScreen, ProtectiveScreen, WeatherScreen, MethodChips, type RcDrawerContext };
