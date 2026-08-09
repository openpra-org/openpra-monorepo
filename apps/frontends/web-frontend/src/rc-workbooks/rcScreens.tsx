import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX, useState } from "react";
import { type PlantStage } from "interfaces-mef-types/core/pra-common";
import { RCIcon } from "./rcIcons";
import { Badge, RcProvenanceChip, valText } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  RC_METHODS,
  SITE_OPTIONS,
  HANDOFF_INPUTS,
  SCOPING_ASPECTS,
  PROTECTIVE_ACTION_LABELS,
  INCIDENT_PHASE_LABELS,
  EVAC_DELAY_LABELS,
  SITE_DATA_BASIS_LABELS,
  type SiteBasis,
} from "./rcViewData";
import { categoryInputById } from "./rcSelectors";

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
        <span key={m.id} className="hrmethod-chip" title={`${m.name} · ${m.ref}`}>{m.abbr}</span>
      ))}
    </div>
  );
}

// ─── Interfaces — the data RC exchanges with ES, MS and RI ──────────────────
function RcInterfaces({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const rcc = rc.releaseCategoryToConsequence;
  const inputs = rcc.releaseCategoryInputs;
  const metrics = rc.scope.consequenceMetrics;
  const families = rc.consequenceQuantification.eventSequenceConsequences;
  const [selected, setSelected] = useState<string | null>("MS");
  const [catId, setCatId] = useState<string>(inputs.find((c) => c.releaseCategory === "RC-1")?.releaseCategory ?? inputs[0]?.releaseCategory ?? "");
  const cat = categoryInputById(rc, catId);

  const tiles: { code: string; name: string; role: string; direction: "in" | "out" }[] = [
    { code: "ES", name: "Event Sequence Analysis", role: "Release categories", direction: "in" },
    { code: "MS", name: "Mechanistic Source Term", role: "Source term", direction: "in" },
    { code: "RI", name: "Risk Integration", role: "Consequence metric and table", direction: "out" },
  ];

  function releaseWindow(c: (typeof inputs)[number]): string {
    const timings = c.releaseCharacteristics.releasePhaseTimings ?? [];
    if (timings.length === 0) return "—";
    const start = Math.min(...timings.map((t) => t.startTime));
    const end = Math.max(...timings.map((t) => t.startTime + t.duration));
    return `${start} to ${end} ${timings[0].timeUnit ?? "h"}`;
  }

  function inputValue(id: string): string {
    if (cat === undefined) return "n/a";
    const ch = cat.releaseCharacteristics;
    switch (id) {
      case "plumes": return ch.numberOfPlumes !== undefined ? `${ch.numberOfPlumes} plume${ch.numberOfPlumes === 1 ? "" : "s"}, ${ch.releasePhaseTimings !== undefined && ch.releasePhaseTimings.length > 1 ? `${ch.releasePhaseTimings.length} phases` : "one phase"}` : "n/a";
      case "fractions": return ch.radionuclideGroupFractions !== undefined && ch.radionuclideGroupFractions.length > 0 ? ch.radionuclideGroupFractions.map((g) => `${g.group} ${g.fraction.toExponential(1).replace("e", "E")}`).join(", ") : "n/a";
      case "isotopes": return ch.importantRadionuclides?.join(", ") ?? "n/a";
      case "timing": return ch.releasePhaseTimings !== undefined && ch.releasePhaseTimings.length > 0 ? ch.releasePhaseTimings.map((t) => `${t.startTime} to ${t.startTime + t.duration} ${t.timeUnit ?? "h"}`).join(", ") : "n/a";
      case "warning": return ch.warningTimeDescription ?? (ch.warningTime !== undefined ? `About ${ch.warningTime} hours` : "n/a");
      case "energy": return ch.releaseEnergyDescription ?? (ch.releaseEnergy !== undefined ? `${ch.releaseEnergy} MW thermal` : "n/a");
      case "height": return ch.releaseHeightDescription ?? (ch.releaseHeight !== undefined ? `${ch.releaseHeight} m` : "n/a");
      case "particle": return ch.releasedParticleSizeDescription ?? "n/a";
      case "uncert": return ch.releaseUncertainties ?? "n/a";
      default: return "n/a";
    }
  }

  function addCategory(): void {
    const n = inputs.reduce((m, c) => { const v = Number(c.releaseCategory.split("-").pop()); return Number.isNaN(v) ? m : Math.max(m, v); }, 0) + 1;
    const releaseCategory = `RC-${String(n)}`;
    mutateRc((draft) => ({
      ...draft,
      releaseCategoryToConsequence: {
        ...draft.releaseCategoryToConsequence,
        releaseCategoryInputs: [...draft.releaseCategoryToConsequence.releaseCategoryInputs, { releaseCategory, releaseCharacteristics: { importantRadionuclides: [], radionuclideGroupFractions: [], releasePhaseTimings: [] } }],
      },
    }));
    setCatId(releaseCategory);
    openDrawer({ kind: "category", id: releaseCategory });
  }
  function updateMetrics(next: string[]): void {
    if (!editable) return;
    mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, consequenceMetrics: next } }));
  }

  return (
    <>
      <div className="poshandoff__grid">
        {tiles.map((tile) => (
          <button key={tile.code} type="button"
            className={`poshandoff__tile${selected === tile.code ? " poshandoff__tile--active" : ""}`}
            onClick={() => setSelected(selected === tile.code ? null : tile.code)}>
            <span className="poshandoff__tile-code">{tile.code}</span>
            <span className="poshandoff__tile-name">{tile.name}</span>
            <span className="poshandoff__tile-role">{tile.direction === "out" ? "Delivers to · " : "Provides · "}{tile.role}</span>
          </button>
        ))}
      </div>

      {selected === "ES" && (
        <div style={{ marginTop: 16 }}>
          {inputs.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No release categories yet. Add one under the Source term interface.</p>
          ) : (
            <table className="postable postable--mid">
              <thead><tr><th>Category</th><th>Source term</th><th>Plumes</th><th>Release window</th><th>Reviewed</th></tr></thead>
              <tbody>
                {inputs.map((c) => (
                  <tr key={c.releaseCategory} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "category", id: c.releaseCategory })}>
                    <td><div className="postable__name">{c.releaseCategory}</div></td>
                    <td className="posmono">{c.sourceTermDefinitionRef ?? "—"}</td>
                    <td className="posmono">{c.releaseCharacteristics.numberOfPlumes ?? "—"}</td>
                    <td className="posmono">{releaseWindow(c)}</td>
                    <td className="posmono">{rcc.releaseCategoryAndSourceTermReviewed ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected === "MS" && (
        <div style={{ marginTop: 16 }}>
          <div className="posrow" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 10 }}>
            <div className="posfield" style={{ margin: 0, minWidth: 240 }}>
              <label className="posfield__label">Source term</label>
              <select className="posfield__select" value={catId} onChange={(e) => setCatId(e.target.value)}>
                {inputs.map((r) => (
                  <option key={r.releaseCategory} value={r.releaseCategory}>{r.sourceTermDefinitionRef ?? r.releaseCategory}</option>
                ))}
              </select>
            </div>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCategory}><RCIcon.Plus /> Add category</button>}
          </div>
          {cat === undefined ? (
            <p className="posmuted" style={{ margin: 0 }}>No release categories yet. Add one to extract the nine consequence inputs from the source-term table.</p>
          ) : (
            <button type="button" className="rcinput" style={{ cursor: "pointer", textAlign: "left", border: "none", background: "none", padding: 0, width: "100%" }} onClick={() => openDrawer({ kind: "category", id: catId })}>
              {HANDOFF_INPUTS.map((h) => {
                const Icon = RCIcon[h.icon] ?? RCIcon.Tag;
                return (
                  <div key={h.id} className="rcinput__cell">
                    <span className="rcinput__icon"><Icon /></span>
                    <div className="rcinput__main">
                      <div className="rcinput__label">{h.label}</div>
                      <div className="rcinput__note posmono">{inputValue(h.id)}</div>
                    </div>
                  </div>
                );
              })}
            </button>
          )}
        </div>
      )}

      {selected === "RI" && (
        <div style={{ marginTop: 16 }}>
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
          <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", margin: "16px 0 8px" }}>Consequence table delivered to Risk Integration</div>
          {families.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No consequence families yet. They are compiled under Quantification.</p>
          ) : (
            <table className="postable postable--mid">
              <thead><tr><th>Family</th><th>Category</th>{metrics.map((m) => <th key={m}>{m}</th>)}</tr></thead>
              <tbody>
                {families.map((f) => (
                  <tr key={f.eventSequenceFamily} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "family", id: f.eventSequenceFamily })}>
                    <td><div className="postable__name">{f.eventSequenceFamily}</div></td>
                    <td className="posmono">{f.releaseCategoryReference ?? "—"}</td>
                    {metrics.map((m) => {
                      const r = f.consequenceResults.find((x) => x.metric === m);
                      return <td key={m} className="posmono">{r !== undefined ? `${valText(r.meanValue)}${r.unit !== undefined ? ` ${r.unit}` : ""}` : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
  function updateDegree(key: (typeof SCOPING_ASPECTS)[number]["degreeKey"], value: string): void {
    if (!editable) return;
    mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, [key]: value } }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
        <p className="poscard__sub">What flows into Radiological Consequence and what it feeds. Select an element to see the data exchanged.</p>
        <RcInterfaces openDrawer={openDrawer} />
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what this radiological-consequence analysis covers, and declare aspect by aspect the degree to which each downstream sub-element is evaluated.</p>
        <WorkbookTextarea
          className="posfield__textarea"
          placeholder="State the in-scope release categories, the consequence metrics, and explicit exclusions."
          rows={4}
          value={rc.praScope}
          disabled={!editable}
          onChange={(e) => onScopeChange(e.target.value)}
        />
        <div className="posrow" style={{ gap: 8, alignItems: "center", margin: "14px 0 8px" }}>
          <span className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)" }}>Degree of evaluation by aspect</span>
          <RcProvenanceChip>RCRE-B2</RcProvenanceChip>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SCOPING_ASPECTS.map((s) => (
            <div key={s.se} className="posfield">
              <label className="posfield__label"><RCIcon.Layers /> {s.aspect} <span className="rcse rcse--primary" style={{ marginLeft: 6 }}>{s.se}</span></label>
              <WorkbookTextarea className="posfield__textarea" rows={2} value={rc.scope[s.degreeKey]} disabled={!editable} onChange={(e) => updateDegree(s.degreeKey, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Simplified modules with a collapsed population, or resolved population with the physics modules switched on and the uncertainty propagated.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
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

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Site fork</h3>
          <RcProvenanceChip>RCRE-A1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">An identified site, or a justified bounding site.</p>
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

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">This sets which requirements apply and where the plant-response data comes from.</p>
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
function ProtectiveScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
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
          <h3 className="poscard__title">Protective actions</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A1</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAction}><RCIcon.Plus /> Add action</button>}
          </div>
        </div>
        <p className="poscard__sub">The protective actions that reduce the dose are listed, each included with a one-line basis. Select an action to edit it.</p>
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
          <h3 className="poscard__title">Incident phases</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A2</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSourceDoc}><RCIcon.Plus /> Add document</button>}
          </div>
        </div>
        <p className="poscard__sub">The actions are structured by incident phase, since the decision basis shifts from plant status to measurements over time. Select a phase to edit its criteria.</p>
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
          <h3 className="poscard__title">Cohort modeling</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A4 · A5</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCohort}><RCIcon.Plus /> Add cohort</button>}
          </div>
        </div>
        <p className="poscard__sub">One cohort at CC-I or multiple cohorts at CC-II, separating the compliers from the non-compliers. Select a cohort to edit it.</p>
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
          <h3 className="poscard__title">Protection parameters</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A12</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addProtParam}><RCIcon.Plus /> Add parameter</button>}
          </div>
        </div>
        <p className="poscard__sub">The shielding and protection factors for each action, each with its value and source. Select a row to edit it.</p>
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
          <h3 className="poscard__title">Evacuation delay chain</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCPA-A9 · A10</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addEvacDelay}><RCIcon.Plus /> Add link</button>}
          </div>
        </div>
        <p className="poscard__sub">The evacuation delay is a chain from the emergency declaration to the moment people depart. Select a link to edit it.</p>
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

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Site data</h3>
          <RcProvenanceChip>RCPA-B1 · B2 · B3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The population, the land use and the building data are assumed and justified for the bounding site, or sourced for the identified site. Select a row to edit it.</p>
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
function WeatherScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const met = rc.meteorologicalData;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Meteorological data quality</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCME-A1 to A4</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "metdata", id: "met" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">Hourly site data is compiled, justified as representative, at a data recovery of ninety percent or more. Select edit to change the data-quality fields.</p>
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
          <h3 className="poscard__title">Period selection</h3>
          <RcProvenanceChip>RCME-A2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">A representative single year, or a multi-year evaluation to select the representative year.</p>
        <div className="posfield">
          <label className="posfield__label">Period-selection description</label>
          <WorkbookTextarea className="posfield__textarea" rows={2} value={met.periodSelection.periodDescription} disabled={!editable}
            onChange={(e) => mutateRc((draft) => ({ ...draft, meteorologicalData: { ...draft.meteorologicalData, periodSelection: { ...draft.meteorologicalData.periodSelection, periodDescription: e.target.value } } }))} />
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Extracted parameters</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCME-A5 to A7</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "metparams", id: "met" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The wind, the stability class and the mixing height are extracted, with the precipitation added at CC-II.</p>
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

export { HandoffScreen, ProtectiveScreen, WeatherScreen, MethodChips, type RcDrawerContext };
