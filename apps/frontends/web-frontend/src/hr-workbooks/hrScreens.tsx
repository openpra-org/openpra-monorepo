import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX, useEffect, useId, useRef, useState } from "react";
import { HANDOFF_ELEMENT_NAMES } from "interfaces-mef-types/technical-element-handoff";
import { HandoffImports, readableId } from "../workbooks/workbookHandoff";
import { HRIcon } from "./hrIcons";
import { Badge, HRProvenanceChip, hepText } from "./hrShared";
import { quantificationHepText } from "./hrDaLinks";
import {
  CAPABILITY_CATEGORIES,
  ACTIVITY_TYPES,
  ACTIVITY_SOURCES,
  IMPACT_LEVELS,
  RECOVERY_CREDIT_LABELS,
  DEPENDENCE_LEVELS,
  type Stage,
} from "./hrViewData";
import { ccScore } from "./hrSelectors";
import { useHrWorkbook } from "./hrWorkbookContext";
import { HR_LINK_CODES, type HrLinkActions, type HrLinkCode, type HrLinkOption } from "./hrLinks";

interface HrDrawerContext {
  kind: "activity" | "contribution" | "prescreen" | "prehfe" | "prequant" | "precredit" | "respreview" | "respconfirm" | "posthfe" | "respquant" | "jointfloor" | "consistency" | "uncertsource" | "relatedassumption" | "reasonablealt" | "preopassum" | "sensitivity" | "efc" | "dependence" | "recovery";
  id: string;
}

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = HRIcon[name] ?? HRIcon.Link;
  return <Icon />;
}

function exposureLabel(hours: number | undefined): string {
  if (hours === undefined) return "Not set";
  if (hours >= 2000) return "Quarterly";
  if (hours >= 600) return "Monthly";
  if (hours >= 120) return "Weekly";
  if (hours >= 20) return "Daily";
  return `${hours} h`;
}

function HrInterfaces({ linkActions }: { linkActions?: HrLinkActions }): JSX.Element {
  const { hr, editable } = useHrWorkbook();
  const [selected, setSelected] = useState<HrLinkCode | null>("POS");
  const [options, setOptions] = useState<Partial<Record<HrLinkCode, HrLinkOption[]>>>({});
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<HrLinkCode>());
  const selectId = useId();
  const linkedId = selected === null ? null : hr.linkedWorkbooks?.[selected] ?? null;
  const choices = selected === null ? undefined : options[selected];
  const linked = choices?.find((option) => option.workbookId === linkedId);

  useEffect(() => {
    if (linkActions === undefined) return;
    for (const code of HR_LINK_CODES) {
      if (requested.current.has(code)) continue;
      requested.current.add(code);
      linkActions.available(code)
        .then((found) => setOptions((current) => ({ ...current, [code]: found })))
        .catch((failure: Error) => setError(failure.message));
    }
  }, [linkActions]);

  return (
    <>
      <div className="poshandoff__grid hr-scope-tiles">
        {HR_LINK_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className={`poshandoff__tile${selected === code ? " poshandoff__tile--active" : ""}`}
            aria-pressed={selected === code}
            onClick={() => { setSelected(selected === code ? null : code); setError(null); }}
          >
            <span className="poshandoff__tile-code">{code}</span>
            <span className="poshandoff__tile-name">{HANDOFF_ELEMENT_NAMES[code]}</span>
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="hr-scope-lane">
          <div className="hr-scope-link">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select
              id={selectId}
              className="posfield__select"
              value={linkedId ?? ""}
              disabled={!editable || linkActions === undefined || choices === undefined}
              onChange={(event) => linkActions?.setLink(selected, event.target.value.length === 0 ? null : event.target.value)}
            >
              <option value="">{choices !== undefined && choices.length === 0 && linkedId === null ? `No ${selected} workbooks in this project` : "Not linked"}</option>
              {(choices ?? []).map((option) => <option key={option.workbookId} value={option.workbookId}>{option.name}</option>)}
              {linkedId !== null && linked === undefined && <option value={linkedId}>{linkedId.startsWith("example") ? `Example ${selected} workbook` : choices === undefined ? "" : `${selected} workbook not in this project`}</option>}
            </select>
          </div>
          <HandoffImports consumer="HRA" producer={selected} />
          {error !== null && <p className="hr-scope-error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage, linkActions }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
  linkActions?: HrLinkActions;
}): JSX.Element {
  const { hr, editable, mutateHr } = useHrWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateHr((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateHr((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading title="Interfaces" level={3} /></div>
        <p className="poscard__sub">Links are optional. Linked workbooks supply the initiator choices, the DA HEPs, and the state, criterion and system names.</p>
        <HrInterfaces linkActions={linkActions} />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Conservative values where justified, or detailed assessments for risk-significant human failure events.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const score = ccScore(hr, c.id, stage);
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
                <div className="possubtle" style={{ fontSize: 11.5, marginTop: 8 }}>{score.ready} of {score.total} SRs ready</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading title="Plant stage" level={3} /></div>
        <p className="poscard__sub">HR has the widest pre-operational fork, since it depends most on how crews run the plant with its procedures.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Activities and actions rest on planned procedures and borrowed experience, with the gaps logged."],
            ["operational", "Operational", "Talk-throughs, simulator runs and operating history confirm the analysis and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <WorkbookInput type="radio" name="hr-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function PreIdentifyScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, links, editable, mutateHr } = useHrWorkbook();
  const multiTrain = hr.routineActivities.filter((a) => a.affectsMultipleTrainsOrDiverseSystems);
  const ieName = (id: string | undefined): string => (id === undefined ? "\u2014" : (links?.ieInitiators.find((i) => i.id === id)?.name ?? id));
  const carriedTo = (activityId: string): string | undefined => hr.humanFailureEvents.find((h) => h.preInitiatorDetail?.sourceActivityId === activityId)?.uuid;
  function addActivity(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({
      ...draft,
      routineActivities: [...draft.routineActivities, {
        uuid, name: "New activity", activityType: "REALIGNMENT" as const, description: "", identificationSources: ["PROCEDURES" as const], affectedSystems: [], applicablePlantOperatingStates: [], affectsMultipleTrainsOrDiverseSystems: false, implementsSrs: [{ sr: "HR-A1", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "activity", id: uuid });
  }
  function addContribution(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({
      ...draft,
      supportSystemInitiatorOperatorContributions: [...(draft.supportSystemInitiatorOperatorContributions ?? []), {
        uuid, systemReference: "", included: true, implementsSrs: [{ sr: "HR-A7", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "contribution", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Routine activities" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">{hr.routineActivities.length} found · HR-A1, A3</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addActivity}><HRIcon.Plus /> Add activity</button>}
          </div>
        </div>
        <p className="poscard__sub">Find the realignment and calibration activities that can leave equipment unavailable until it is demanded. Click an activity to edit it.</p>
        <div className="hrra">
          {hr.routineActivities.map((a) => {
            const type = ACTIVITY_TYPES[a.activityType];
            return (
              <div key={a.uuid} className="hrra__card" onClick={() => openDrawer({ kind: "activity", id: a.uuid })}>
                <div className="hrra__head">
                  <div className="hrra__head-main">
                    <div className="hrra__name">{a.name}</div>
                    <div className="hrra__type">{type?.label ?? a.activityType}</div>
                  </div>
                  {a.affectsMultipleTrainsOrDiverseSystems && <span className="hrra__multi-flag">Multi-train</span>}
                </div>
                <p className="hrra__desc">{a.description}</p>
                <div className="hrra__foot">
                  <span className="hrra__sys">{a.affectedSystems.join(", ")}</span>
                  <span className="hrra__sources">{a.identificationSources.map((s) => ACTIVITY_SOURCES[s]).join(" · ")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Multi-train work practices" level={3} />
          <HRProvenanceChip>HR-A5</HRProvenanceChip>
        </div>
        <p className="poscard__sub">Flag the work that touches redundant trains or diverse systems at once, since it cannot be screened out later and must be carried as a defined event.</p>
        <div className="hrmulti">
          {multiTrain.map((a) => {
            const hfe = carriedTo(a.uuid);
            return (
              <div key={a.uuid} className="hrmulti__row">
                <span className="hrmulti__row-name">{a.name}</span>
                <span className="hrmulti__row-mech">{a.multiTrainMechanism}</span>
                {hfe !== undefined ? <Badge kind="ok">Carried to {hfe}</Badge> : <Badge kind="warn">Not yet defined</Badge>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Operator contributions to initiators" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-A7</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addContribution}><HRIcon.Plus /> Add contribution</button>}
          </div>
        </div>
        <p className="poscard__sub">Include the operator-error contributions in the support-system initiating event fault trees from Initiating Events. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Support system</th><th>Initiating event it contributes to</th><th>Included</th></tr></thead>
          <tbody>
            {(hr.supportSystemInitiatorOperatorContributions ?? []).map((s) => (
              <tr key={s.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "contribution", id: s.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{s.systemReference}
                  <span className="postable__name-sub posmono">{s.faultTreeReference ?? "—"}</span>
                </td>
                <td>{ieName(s.faultTreeReference)}</td>
                <td>{s.included ? <Badge kind="ok">Included</Badge> : <Badge>Excluded</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PreDefineScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, editable, mutateHr } = useHrWorkbook();
  const preHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming === "PRE_INITIATOR");
  function activityName(id: string): string {
    return hr.routineActivities.find((a) => a.uuid === id)?.name ?? id;
  }
  function isMultiTrain(activityId: string): boolean {
    return hr.routineActivities.find((a) => a.uuid === activityId)?.affectsMultipleTrainsOrDiverseSystems ?? false;
  }
  function addScreening(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({
      ...draft,
      preInitiatorScreeningRecords: [...draft.preInitiatorScreeningRecords, {
        uuid, activityId: draft.routineActivities[0]?.uuid ?? "", screenedOut: false, criterion: "SCR-3" as const, justification: "", applicableStatesVerified: true, multiTrainProhibitionRespected: true, implementsSrs: [{ sr: "HR-B1", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "prescreen", id: uuid });
  }
  function addPreHfe(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({
      ...draft,
      humanFailureEvents: [...draft.humanFailureEvents, {
        uuid, name: "New pre-initiator event", hfeTiming: "PRE_INITIATOR" as const, description: "", impactLevel: "TRAIN" as const, affectedSystems: [], applicablePlantOperatingStates: [], preInitiatorDetail: { sourceActivityId: draft.routineActivities[0]?.uuid ?? "", detectionBasis: "", unavailabilityModes: [], miscalibrationImpactIncluded: false }, implementsSrs: [{ sr: "HR-C1", hlr: "C" as const }],
      }],
    }));
    openDrawer({ kind: "prehfe", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Screening" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-B1 · HR-B3</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addScreening}><HRIcon.Plus /> Add screening</button>}
          </div>
        </div>
        <p className="poscard__sub">Screen with screening-grade criteria per operating state, but never screen out a multi-train activity. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Activity</th><th>Basis</th><th>Decision</th></tr></thead>
          <tbody>
            {hr.preInitiatorScreeningRecords.map((s) => (
              <tr key={s.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "prescreen", id: s.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{activityName(s.activityId)}
                  {isMultiTrain(s.activityId) && <span className="hrscreen__prohibit">Protected</span>}
                </td>
                <td className="possubtle" style={{ fontSize: 12 }}>{s.justification}</td>
                <td>{s.screenedOut ? <Badge kind="draft">Screened out</Badge> : <Badge kind="progress">Carried</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Pre-initiator events" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">{preHfes.length} defined · HR-C1, C2, C4, C5</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPreHfe}><HRIcon.Plus /> Add event</button>}
          </div>
        </div>
        <p className="poscard__sub">Define each event at the fitting level, with the operating states it applies to, the time it sits undetected, and the unavailability modes. Click an event to edit it.</p>
        <div className="hrhfe">
          {preHfes.map((h) => {
            const detail = h.preInitiatorDetail;
            const detect = detail?.averageTimeToDetectionHours;
            return (
              <div key={h.uuid} className="hrhfe__card" onClick={() => openDrawer({ kind: "prehfe", id: h.uuid })}>
                <div className="hrhfe__head">
                  {readableId(h.uuid) !== undefined && <span className="hrhfe__id posmono">{h.uuid}</span>}
                  {detail?.miscalibrationImpactIncluded === true && <span className="hrhfe__miscal">Miscalibration</span>}
                </div>
                <div className="hrhfe__name">{h.name}</div>
                <div className="hrhfe__meta">
                  <span className="hrhfe__level">{IMPACT_LEVELS[h.impactLevel]} level</span>
                </div>
                <div className="hrhfe__expo">
                  <span className="hrhfe__expo-k">Exposure window</span>
                  <span className="hrhfe__expo-bar"><span className="hrhfe__expo-fill" style={{ width: `${Math.min(100, ((detect ?? 0) / 2160) * 100)}%` }} /></span>
                  <span className="hrhfe__expo-v">{exposureLabel(detect)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function PreQuantScreen({ openDrawer }: { openDrawer: (ctx: HrDrawerContext) => void }): JSX.Element {
  const { hr, editable, mutateHr, daHeps } = useHrWorkbook();
  const preHfes = hr.humanFailureEvents.filter((h) => h.hfeTiming === "PRE_INITIATOR");
  const preDeps = hr.dependencyAssessments.filter((d) => d.scope === "PRE_INITIATOR_SET");
  function quantOf(id: string) {
    return hr.hepQuantifications.find((q) => q.hfeId === id);
  }
  function hfeName(id: string): string {
    return hr.humanFailureEvents.find((h) => h.uuid === id)?.name ?? id;
  }
  function addQuant(): void {
    if (!editable) return;
    const target = preHfes.find((h) => quantOf(h.uuid) === undefined);
    if (target === undefined) { if (preHfes[0] !== undefined) openDrawer({ kind: "prequant", id: preHfes[0].uuid }); return; }
    mutateHr((draft) => ({ ...draft, hepQuantifications: [...draft.hepQuantifications, {
      uuid: crypto.randomUUID(), hfeId: target.uuid, methodology: "", assessmentType: "CONSERVATIVE_ESTIMATE" as const, isRiskSignificant: false, hep: { node: "VALUE" as const, value: { unit: "PROBABILITY" as const, law: { family: "POINT" as const, value: 1.0e-2 } } }, plantSpecificInformationUsed: [], uncertaintyCharacterization: { riskSignificant: false, method: "", probabilisticRepresentationProvided: false }, implementsSrs: [{ sr: "HR-D1", hlr: "D" as const }],
    }] }));
    openDrawer({ kind: "prequant", id: target.uuid });
  }
  function addCredit(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, preInitiatorRecoveryCredits: [...(draft.preInitiatorRecoveryCredits ?? []), {
      uuid, hfeId: preHfes[0]?.uuid ?? "", recoveryFactorsMethodologyConsistent: true, maximumCreditSpecified: 0.1, creditBases: ["INDEPENDENT_VERIFICATION" as const], implementsSrs: [{ sr: "HR-D5", hlr: "D" as const }],
    }] }));
    openDrawer({ kind: "precredit", id: uuid });
  }
  function addDependence(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateHr((draft) => ({ ...draft, dependencyAssessments: [...draft.dependencyAssessments, {
      uuid, scope: "PRE_INITIATOR_SET" as const, hfeIds: [], commonElements: [], dependenceLevel: "HIGH" as const, jointHep: 1.0e-3, implementsSrs: [{ sr: "HR-D7", hlr: "D" as const }],
    }] }));
    openDrawer({ kind: "dependence", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Quantification" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-D1 · HR-D2</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addQuant}><HRIcon.Plus /> Add quantification</button>}
          </div>
        </div>
        <p className="poscard__sub">Conservative estimates at CC-I, or detailed mean values for the risk-significant events at CC-II. Click a row to edit it.</p>
        <table className="postable" style={{ marginTop: 12 }}>
          <thead><tr><th>Event</th><th>Assessment</th><th>HEP</th><th>Risk-significant</th></tr></thead>
          <tbody>
            {preHfes.map((h) => {
              const q = quantOf(h.uuid);
              if (q === undefined) return null;
              return (
                <tr key={h.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "prequant", id: h.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{h.name}
                    <div className="possubtle" style={{ fontSize: 11.5, marginTop: 2, fontWeight: 400 }}>{q.methodology}</div>
                  </td>
                  <td>{q.assessmentType === "DETAILED_ASSESSMENT" ? <span className="hrmethod hrmethod--detailed">Detailed</span> : <span className="hrmethod hrmethod--conservative">Conservative</span>}</td>
                  <td className="posmono hrhep">{quantificationHepText(q, daHeps)}</td>
                  <td>{q.isRiskSignificant ? <Badge kind="progress">Risk-significant</Badge> : <Badge>Screened value</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Recovery credit" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-D5 · HR-D6</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCredit}><HRIcon.Plus /> Add recovery credit</button>}
          </div>
        </div>
        <p className="poscard__sub">A check or a test that catches the error can lower its probability, but only with a stated reason and a stated limit. Click a row to edit it.</p>
        <div className="hrrecred">
          {(hr.preInitiatorRecoveryCredits ?? []).map((r) => (
            <div key={r.uuid} className="hrrecred__row" onClick={() => openDrawer({ kind: "precredit", id: r.uuid })} style={{ cursor: "pointer" }}>
              <span className="hrrecred__name">{hfeName(r.hfeId)}</span>
              <span className="hrrecred__credit">{RECOVERY_CREDIT_LABELS[(r.creditBases ?? [])[0] ?? ""] ?? "Recovery credit"}</span>
              <span className="hrrecred__max posmono">lowers it {r.maximumCreditSpecified > 0 ? Math.round(1 / r.maximumCreditSpecified) : 1}x at most</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Same-crew dependence" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <HRProvenanceChip>HR-D7</HRProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDependence}><HRIcon.Plus /> Add dependence</button>}
          </div>
        </div>
        <p className="poscard__sub">Evaluate the pre-initiator events that share a cause and calculate the joint probability above the product. Click a set to edit it.</p>
        {preDeps.map((d) => (
          <div key={d.uuid} className="hrdep" onClick={() => openDrawer({ kind: "dependence", id: d.uuid })} style={{ cursor: "pointer" }}>
            <div className="hrdep__head">
              <div>
                <div className="hrdep__title">{d.hfeIds.map(hfeName).join(", ")}</div>
                <div className="hrdep__level">Dependence. {DEPENDENCE_LEVELS[d.dependenceLevel]}</div>
              </div>
              <span className="hrdep__joint posmono">{hepText(d.jointHep)}<span className="hrhep__kind">joint</span></span>
            </div>
            <div className="hrdep__elements">
              {d.commonElements.map((e, i) => <span key={i} className="hrdep__el">{e}</span>)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export { ScopeScreen, PreIdentifyScreen, PreDefineScreen, PreQuantScreen, NamedIcon, type HrDrawerContext };
