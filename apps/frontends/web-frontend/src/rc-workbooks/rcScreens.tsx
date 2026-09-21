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
  type SiteBasis,
} from "./rcViewData";
import { RcMsSourceTerm } from "./rcMsSourceTerm";
import { RcProtectiveOperational } from "./rcProtectiveOperational";
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
  return <RcProtectiveOperational openDrawer={openDrawer} initialSiteTab={initialSiteTab} />;
}

// ─── 03 — Meteorology (RCME) ───────────────────────────────────────────────
function WeatherScreen({ openDrawer, onReviewSite }: { openDrawer: (ctx: RcDrawerContext) => void; onReviewSite?: () => void }): JSX.Element {
  return <RcMeteorologyPanel onReviewSite={onReviewSite} onEditBasis={() => openDrawer({ kind: "metbasis", id: "meteorology" })} onEditQuality={() => openDrawer({ kind: "metquality", id: "meteorology" })} />;
}

export { RcInterfaces, HandoffScreen, ProtectiveScreen, WeatherScreen, MethodChips, type RcDrawerContext };
