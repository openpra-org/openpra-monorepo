import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { type PlantStage } from "interfaces-mef-types/core/pra-common";
import { type RcEvaluationSubElement } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RCIcon } from "./rcIcons";
import { Badge, RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  RC_METHODS,
  SITE_OPTIONS,
  type SiteBasis,
} from "./rcViewData";
import { RcInterfaces } from "./rcInterfaces";
import { RcProtectiveOperational } from "./rcProtectiveOperational";
import { RcMeteorologyPanel } from "./rcMeteorology";
import { RC_SCOPE_ASPECTS, rcScopeTreatment } from "./rcScope";
import { RcMetricsCard } from "./rcMetrics";
import { RC_METRIC_DEFAULT_EXCLUSION, rcAspectDecision, rcMetricsCreditingProtectiveActions } from "interfaces-shared-types/rc-workbooks/metrics";

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
        evaluationDecisions: [
          ...(draft.scope.evaluationDecisions ?? []).filter((decision) => decision.subElement !== subElement),
          { subElement, included: false, exclusionReason },
        ],
      },
    }));
  }
  function chooseInclusion(subElement: RcEvaluationSubElement, value: string): void {
    if (value === "excluded" && rcAspectDecision({ metrics: rc.scope.metrics }, subElement).defaulted) updateExclusionReason(subElement, RC_METRIC_DEFAULT_EXCLUSION);
    else updateScopeDecision(subElement, value === "" ? undefined : value === "included");
  }
  const protectiveMetrics = rcMetricsCreditingProtectiveActions(rc.scope.metrics);
  const metricList = (metrics: { id: string }[]) => metrics.map((metric) => metric.id).join(", ");

  return (
    <>
      <div className="poscard rc-handoff__wide-card">
        <div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Interfaces" level={3} /></div>
        <RcInterfaces openDrawer={openDrawer} />
      </div>

      <RcMetricsCard openDrawer={openDrawer} />

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
                const decision = rcAspectDecision(rc.scope, aspect.subElement);
                const treatment = rcScopeTreatment(rc, aspect.subElement);
                const reasonMissing = decision.included === false && !decision.exclusionReason?.trim();
                const hasDefault = rcAspectDecision({ metrics: rc.scope.metrics }, aspect.subElement).defaulted;
                return <tr key={aspect.subElement}>
                  <td><strong>{aspect.label}</strong><span className="rcscope__step">Step {aspect.step}</span></td>
                  <td>{decision.required ? <>
                    <strong>Required</strong>
                    <span className="rcscope__step" title={decision.neededBy.map((metric) => metric.name).join(", ")}>Needed by {metricList(decision.neededBy)}</span>
                    {aspect.subElement === "RCPA" && <span className="rcscope__step">{protectiveMetrics.length ? `Protective actions needed by ${metricList(protectiveMetrics)}` : "No metric credits protective actions"}</span>}
                  </> : <select className="posfield__select" aria-label={`${aspect.label} inclusion`} value={decision.included === undefined ? "" : decision.included ? "included" : "excluded"} disabled={!editable} onChange={(event) => chooseInclusion(aspect.subElement, event.target.value)}>
                    {!hasDefault && <option value="">Not set</option>}<option value="included">Included</option><option value="excluded">Excluded</option>
                  </select>}</td>
                  <td>{decision.included === false ? "—" : treatment || <span className="posmuted">Not recorded</span>}</td>
                  <td>{decision.included === false ? <><WorkbookInput className="posfield__input" aria-label={`${aspect.label} exclusion reason`} aria-invalid={reasonMissing} value={decision.exclusionReason ?? ""} disabled={!editable} onChange={(event) => updateExclusionReason(aspect.subElement, event.target.value)} />{reasonMissing && <span className="rcscope__error" role="alert">Reason required</span>}</> : "—"}</td>
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
  return <RcProtectiveOperational openDrawer={openDrawer} initialSiteTab={initialSiteTab} />;
}

// ─── 03 — Meteorology (RCME) ───────────────────────────────────────────────
function WeatherScreen({ openDrawer, onReviewSite }: { openDrawer: (ctx: RcDrawerContext) => void; onReviewSite?: () => void }): JSX.Element {
  return <RcMeteorologyPanel onReviewSite={onReviewSite} onEditBasis={() => openDrawer({ kind: "metbasis", id: "meteorology" })} onEditQuality={() => openDrawer({ kind: "metquality", id: "meteorology" })} />;
}

export { RcInterfaces, HandoffScreen, ProtectiveScreen, WeatherScreen, MethodChips, type RcDrawerContext };
