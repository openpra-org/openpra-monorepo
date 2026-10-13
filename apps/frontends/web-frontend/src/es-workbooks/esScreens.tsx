import { stringifyJson } from "interfaces-shared-types/json";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { recordLabel } from "../workbooks/workbookHandoff";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { Fragment, JSX, useEffect, useId, useMemo, useRef, useState } from "react";
import { ESIcon } from "./esIcons";
import { Badge, fmtImportance } from "./esShared";
import {
  ES_RELEASE_CATEGORIES,
  ES_DEPENDENCY_TYPES,
  type CapabilityCategory,
} from "./esViewData";
import { type Dependency, DependencyType, type ReleaseCategoryMapping, type EventSequenceFamily, type EventSequenceScreeningRecord, type EventSequenceAnalysis, type EsEndStateDefinition, type EsEndStateKind, type EventTree, type EventTreeOutcome, eventTreeOutcomeRank } from "interfaces-mef-types/es/event-sequence-analysis";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
import { EndState } from "interfaces-mef-types/core/events";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { useEsWorkbook, type EsFaultTreeSource } from "./esWorkbookContext";
import {
  eventTreesView,
  coverageView,
  dependencyBoundFunctionalEvents,
  nextReleaseCategoryId,
  releaseCategoryOptions,
  endStateUseCount,
  withEndStateDefinitionApplied,
  withSyncedSequenceEndState,
  withTreeSequenceClassification,
  reservedSequenceNames,
  withDistinctSequences,
  screeningView,
  dependenciesView,
  sequencesView,
  freqValue,
  type EventTreeView,
  type DependencyView,
  type CcScore,
} from "./esSelectors";
import { generateEsReport } from "./esDocx";
import { EsFaultTreeReferencePicker } from "./esFaultTreeReferencePicker";
import { setFunctionalEventFaultTreeReference } from "./esFaultTreeReferences";
import { ChoiceEditor, DialogHead, DialogShell } from "./EsScope";
import { BARRIER_CONDITIONS, END_STATE_KINDS, SequenceRecordTabs, sequenceFindings, type RecordTab } from "./EsSequenceTabs";
import {
  EventTreeEditor,
  applyEventTreeOperation,
  createEmptyEventTree,
  validateEventTree,
  type EventTreeOperation,
  type EventTreeRepresentation,
} from "../newly-developed-methods/event-tree";
import { transferBreadcrumb, useTransferTrail } from "../newly-developed-methods/shared/transferTrail";
import "./css/esScreens.css";
import "./css/esSequences.css";

function fmtExp(n: number | undefined): string {
  return n === undefined ? "—" : n.toExponential(1);
}

function eventPathState(state: EventTreeOutcome): { label: string; tone: "s" | "f" | "b" | "n" } {
  if (state === "SUCCESS") return { label: "Success", tone: "s" };
  if (state === "FAILURE") return { label: "Failure", tone: "f" };
  if (state === "BYPASSED") return { label: "Bypassed", tone: "b" };
  return { label: `Branch ${String(eventTreeOutcomeRank(state) + 1)}`, tone: "n" };
}

function EsEmpty({ title, hint }: { title: string; hint: string }): JSX.Element {
  return (
    <div className="esempty">
      <div className="esempty__title">{title}</div>
      <div className="esempty__hint">{hint}</div>
    </div>
  );
}


type DrawerCtx = { kind: "sequence"; id: string } | { kind: "dependency"; id: string } | { kind: "releaseCategory"; id: string } | { kind: "family"; id: string } | { kind: "screening"; id: string };

function SequenceDrawerBody({ seqId, trees, deps, onClose }: { seqId: string; trees: EventTreeView[]; deps: DependencyView[]; onClose: () => void }): JSX.Element | null {
  const found = trees.flatMap((t) => t.sequences.map((s) => ({ s, t }))).find((x) => x.s.id === seqId);
  if (found === undefined) return null;
  const { s, t } = found;
  const imp = fmtImportance(s.importance);
  const relatedDeps = deps.filter((d) => d.initiatingEvents.includes(t.initiatingEventId));
  const isOk = s.endState === "SUCCESSFUL_MITIGATION";
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Event sequence · {s.id}</div>
          <h2 className="posdrawer__title">{t.name}</h2>
          <div className="posdrawer__sub">{t.initiatingEventId}{t.plantOperatingStateId !== undefined ? ` · ${t.plantOperatingStateId}` : ""}{t.missionTime !== undefined ? ` · mission time ${t.missionTime} ${t.missionTimeUnits ?? ""}` : ""}{s.meanFrequency !== undefined ? ` · ${fmtExp(s.meanFrequency)}/yr` : ""}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ES" title="Sequence path" level={3} />
            {isOk ? <Badge kind="ok">Safe stable state</Badge> : <Badge kind="block">Release · {s.releaseCategoryId}</Badge>}
          </div>
          <div className="espath">
            <div className="espath__node"><span className="espath__node-fe">{t.initiatingEventId}</span><span className="espath__node-state" style={{ color: "var(--color-primary)" }}>IE</span></div>
            {t.functionalEvents.map((fe) => {
              const st = s.path[fe.id];
              if (st === undefined) return null;
              return (
                <Fragment key={fe.id}>
                  <span className="espath__arrow"><ESIcon.ArrowR /></span>
                  <div className={`espath__node espath__node--${eventPathState(st).tone}`} title={fe.label}>
                    <span className="espath__node-fe">{fe.id}</span>
                    <span className="espath__node-state"><span className={`esqlight__dot esqlight__dot--${eventPathState(st).tone}`} />{eventPathState(st).label}</span>
                  </div>
                </Fragment>
              );
            })}
            <span className="espath__arrow"><ESIcon.ArrowR /></span>
            <span className={`espath__end espath__end--${isOk ? "ok" : "block"}`}>
              {isOk ? "Safe state" : s.releaseCategoryId}
            </span>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Outcome" level={3} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">End state</label><div className="posmono">{isOk ? "Safe stable state" : "Radionuclide release"}</div></div>
            <div className="posfield"><label className="posfield__label">Mean frequency</label><div className="posmono">{s.meanFrequency !== undefined ? `${fmtExp(s.meanFrequency)} /yr` : "—"}</div></div>
            <div className="posfield"><label className="posfield__label">Release category</label><div className="posmono">{s.releaseCategoryId === undefined ? "None (no release)" : s.releaseCategoryId}</div></div>
            {s.familyId !== undefined && <div className="posfield"><label className="posfield__label">Sequence family</label><div className="posmono">{s.familyId}</div></div>}
            {imp.label !== "—" && <div className="posfield"><label className="posfield__label">Risk importance</label><div className="posmono">{imp.label}</div></div>}
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Dependencies in this tree" level={3} /><Badge kind="progress">{relatedDeps.length}</Badge></div>
          {relatedDeps.length > 0 ? (
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {relatedDeps.map((d) => <span key={d.id} className="poschip">{d.id} · {ES_DEPENDENCY_TYPES[d.type]?.label ?? d.type}</span>)}
            </div>
          ) : <p className="possubtle" style={{ margin: 0 }}>No dependencies modelled in this tree.</p>}
        </div>
      </div>
    </>
  );
}

function DependencyDrawerBody({ depId, deps, trees, onClose }: { depId: string; deps: DependencyView[]; trees: EventTreeView[]; onClose: () => void }): JSX.Element | null {
  const { editable, mutateEs, ieLink } = useEsWorkbook();
  const d = deps.find((x) => x.id === depId);
  if (d === undefined) return null;
  const meta = ES_DEPENDENCY_TYPES[d.type];
  const imp = fmtImportance(d.importance);
  const ieName = (ie: string): string => ieLink.groups.find((group) => group.id === ie)?.name ?? trees.find((t) => t.initiatingEventId === ie)?.name ?? ie;
  const ieChipLabel = (ie: string): string => (ieName(ie) === ie ? ie : `${ie} · ${ieName(ie)}`);
  const ieOptions = Array.from(new Set([...ieLink.groups.map((group) => group.id), ...trees.map((t) => t.initiatingEventId), ...d.initiatingEvents]));

  function patchDep(patch: Partial<Dependency>): void {
    if (!editable) return;
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: {
        ...draft.dependencyModels,
        functionalDependencies: (draft.dependencyModels?.functionalDependencies ?? []).map((m) => ({
          ...m,
          dependencies: m.dependencies.map((x) => (x.uuid === depId ? { ...x, ...patch } : x)),
        })),
      },
    }));
  }
  function toggleIe(ie: string): void {
    const cur = d?.initiatingEvents ?? [];
    patchDep({ applicableInitiatingEvents: cur.includes(ie) ? cur.filter((x) => x !== ie) : [...cur, ie] });
  }
  function removeDep(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: {
        ...draft.dependencyModels,
        functionalDependencies: (draft.dependencyModels?.functionalDependencies ?? []).map((m) => ({
          ...m,
          dependencies: m.dependencies.filter((x) => x.uuid !== depId),
        })),
      },
    }));
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Dependency · {d.id}</div>
          <h2 className="posdrawer__title">{d.from}</h2>
          <div className="posdrawer__sub">{meta?.label ?? d.type} dependency · depends upon {d.to}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Description" level={3} />{!editable && imp.label !== "—" && <Badge kind={imp.kind}>{imp.label} importance</Badge>}</div>
          {editable
            ? <WorkbookTextarea className="posfield__textarea" style={{ minHeight: 64 }} placeholder="What links these two elements, and how is it modelled?" value={d.desc} onChange={(e) => patchDep({ description: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{d.desc}</p>}
        </div>
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Modelling" level={3} /></div>
          <div className="posfield-grid">
            {editable && (
              <>
                <div className="posfield"><label className="posfield__label">Dependent element</label>
                  <WorkbookInput className="posfield__input" value={d.from} onChange={(e) => patchDep({ dependentElement: e.target.value })} />
                </div>
                <div className="posfield"><label className="posfield__label">Depends upon</label>
                  <WorkbookInput className="posfield__input" value={d.to} onChange={(e) => patchDep({ dependedUponElement: e.target.value })} />
                </div>
              </>
            )}
            <div className="posfield"><label className="posfield__label">Type</label>
              {editable
                ? <select className="posfield__select" value={d.type} onChange={(e) => patchDep({ dependencyType: e.target.value as DependencyType })}>
                    {Object.entries(ES_DEPENDENCY_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                : <div><Badge kind={meta?.tone === "warn" ? "warn" : "progress"}>{meta?.label ?? d.type}</Badge></div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time-phased</label>
              {editable
                ? <select className="posfield__select" value={d.timePhased ? "yes" : "no"} onChange={(e) => patchDep({ timePhased: e.target.value === "yes" })}>
                    <option value="no">No</option>
                    <option value="yes">Yes, it changes as the event progresses</option>
                  </select>
                : <div>{d.timePhased ? "Yes, it changes as the event progresses" : "No"}</div>}
            </div>
            {editable && (
              <div className="posfield"><label className="posfield__label">Importance</label>
                <select className="posfield__select" value={d.importance ?? ""} onChange={(e) => patchDep({ importanceLevel: e.target.value.length === 0 ? undefined : (e.target.value as ImportanceLevel) })}>
                  <option value="">Not set</option>
                  <option value={ImportanceLevel.HIGH}>High</option>
                  <option value={ImportanceLevel.MEDIUM}>Medium</option>
                  <option value={ImportanceLevel.LOW}>Low</option>
                </select>
              </div>
            )}
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Appears in</label>
              {editable ? (
                <>
                  {d.initiatingEvents.length > 0 && (
                    <div className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 8 }}>
                      {d.initiatingEvents.map((ie) => (
                        <span key={ie} className="poschip poschip--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {ieChipLabel(ie)}
                          <button type="button" title="Remove" onClick={() => toggleIe(ie)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {ieOptions.filter((ie) => !d.initiatingEvents.includes(ie)).length > 0 && (
                    <select className="posfield__select" value="" onChange={(e) => { if (e.target.value.length > 0) toggleIe(e.target.value); }}>
                      <option value="">Add an initiating event…</option>
                      {ieOptions.filter((ie) => !d.initiatingEvents.includes(ie)).map((ie) => <option key={ie} value={ie}>{ieChipLabel(ie)}</option>)}
                    </select>
                  )}
                </>
              ) : (
                <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                  {d.initiatingEvents.map((ie) => <span key={ie} className="poschip">{ieChipLabel(ie)}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeDep}><ESIcon.Close /> Remove dependency</button>
          </div>
        )}
      </div>
    </>
  );
}

function ReleaseCategoryDrawerBody({ mappingId, onClose }: { mappingId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const m = (es.releaseCategoryMappings ?? []).find((x) => x.uuid === mappingId);
  if (m === undefined) return null;
  const rcMeta = ES_RELEASE_CATEGORIES.find((r) => r.id === m.releaseCategoryId);
  const mappedElsewhere = new Set((es.releaseCategoryMappings ?? []).filter((x) => x.uuid !== mappingId).flatMap((x) => x.eventSequenceIds));
  const eligible = es.eventSequences
    .filter((s) => s.endState === "RADIONUCLIDE_RELEASE" && !m.eventSequenceIds.includes(s.uuid) && !mappedElsewhere.has(s.uuid))
    .map((s) => s.uuid);

  function patch(patchObj: Partial<ReleaseCategoryMapping>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, releaseCategoryMappings: (draft.releaseCategoryMappings ?? []).map((x) => (x.uuid === mappingId ? { ...x, ...patchObj } : x)) }));
  }
  function toggleMember(seqId: string): void {
    const cur = m?.eventSequenceIds ?? [];
    patch({ eventSequenceIds: cur.includes(seqId) ? cur.filter((x) => x !== seqId) : [...cur, seqId] });
  }
  function removeMapping(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, releaseCategoryMappings: (draft.releaseCategoryMappings ?? []).filter((x) => x.uuid !== mappingId) }));
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Release category · {recordLabel(m.uuid, m.name)}</div>
          <h2 className="posdrawer__title">{m.releaseCategoryId}{rcMeta !== undefined ? ` · ${rcMeta.name}` : ""}</h2>
          <div className="posdrawer__sub">{m.eventSequenceIds.length} sequences mapped · handed to Mechanistic Source Term (ES-C8)</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Mapping basis" level={3} /></div>
          {editable
            ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="Why these sequences share one source-term calculation" value={m.mappingBasis} onChange={(e) => patch({ mappingBasis: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{m.mappingBasis}</p>}
        </div>
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Characteristics" level={3} /></div>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Common characteristics (comma separated)</label>
              {editable
                ? <WorkbookInput className="posfield__input" value={m.commonCharacteristics.join(", ")} onChange={(e) => patch({ commonCharacteristics: csvList(e.target.value) })} />
                : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{m.commonCharacteristics.map((c) => <span key={c} className="poschip">{c}</span>)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Physical release characteristics (comma separated)</label>
              {editable
                ? <WorkbookInput className="posfield__input" value={m.physicalReleaseCharacteristics.join(", ")} onChange={(e) => patch({ physicalReleaseCharacteristics: csvList(e.target.value) })} />
                : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{m.physicalReleaseCharacteristics.map((c) => <span key={c} className="poschip poschip--warn">{c}</span>)}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Processed by risk integration</label>
              {editable
                ? <select className="posfield__select" value={m.processedByRiskIntegration === true ? "yes" : m.processedByRiskIntegration === false ? "no" : ""} onChange={(e) => patch({ processedByRiskIntegration: e.target.value.length === 0 ? undefined : e.target.value === "yes" })}>
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                : <div>{m.processedByRiskIntegration === true ? "Yes" : m.processedByRiskIntegration === false ? "No" : "—"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Member sequences" level={3} /></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {m.eventSequenceIds.map((id) => (
              <span key={id} className="poschip poschip--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {id}
                {editable && <button type="button" title="Remove" onClick={() => toggleMember(id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>}
              </span>
            ))}
            {editable && eligible.length > 0 && (
              <select className="posfield__select" style={{ maxWidth: 220 }} value="" onChange={(e) => { if (e.target.value.length > 0) toggleMember(e.target.value); }}>
                <option value="">Add a release sequence…</option>
                {eligible.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            )}
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeMapping}><ESIcon.Close /> Remove category mapping</button>
          </div>
        )}
      </div>
    </>
  );
}

function FamilyDrawerBody({ familyId, onClose }: { familyId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const f = es.eventSequenceFamilies.find((x) => x.uuid === familyId);
  if (f === undefined) return null;
  const freqOf = new Map(es.eventSequences.map((s) => [s.uuid, freqValue(s.meanFrequency) ?? 0]));
  const representativeId = [...f.memberSequenceIds].sort((a, b) => (freqOf.get(b) ?? 0) - (freqOf.get(a) ?? 0))[0];
  const inOtherFamily = new Set(es.eventSequenceFamilies.filter((x) => x.uuid !== familyId).flatMap((x) => x.memberSequenceIds));
  const eligible = es.eventSequences
    .filter((s) => s.endState === f.endState && !f.memberSequenceIds.includes(s.uuid) && !inOtherFamily.has(s.uuid))
    .map((s) => s.uuid);
  const ieOptions = Array.from(new Set(es.eventSequences.map((s) => s.initiatingEventId)));
  const posOptions = Array.from(new Set(es.eventSequences.map((s) => s.plantOperatingStateId)));

  function patch(patchObj: Partial<EventSequenceFamily>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, eventSequenceFamilies: draft.eventSequenceFamilies.map((x) => (x.uuid === familyId ? { ...x, ...patchObj } : x)) }));
  }
  function toggleMember(seqId: string): void {
    const cur = f?.memberSequenceIds ?? [];
    const next = cur.includes(seqId) ? cur.filter((x) => x !== seqId) : [...cur, seqId];
    patch({ memberSequenceIds: next, meanFrequency: next.reduce((a, id) => a + (freqOf.get(id) ?? 0), 0) });
  }
  function removeFamily(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, eventSequenceFamilies: draft.eventSequenceFamilies.filter((x) => x.uuid !== familyId) }));
  }

  const isOk = f.endState === "SUCCESSFUL_MITIGATION";
  const rc = (f.releaseCategoryIds ?? [])[0] ?? "";
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Sequence family · {recordLabel(f.uuid, f.name)}</div>
          {editable
            ? <WorkbookInput className="posfield__input" style={{ fontSize: 16, fontWeight: 700 }} value={f.name} onChange={(e) => patch({ name: e.target.value })} />
            : <h2 className="posdrawer__title">{f.name}</h2>}
          <div className="posdrawer__sub">{f.memberSequenceIds.length} member sequences · mean {fmtExp(freqValue(f.meanFrequency))}/yr · one source-term calculation (ES-C8)</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Representative plant response" level={3} /></div>
          {editable
            ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="How the plant responds in every member of this family" value={f.representativePlantResponse} onChange={(e) => patch({ representativePlantResponse: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{f.representativePlantResponse}</p>}
        </div>
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Classification" level={3} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">End state</label>
              {editable
                ? <select className="posfield__select" value={f.endState} onChange={(e) => patch({ endState: e.target.value === "SUCCESSFUL_MITIGATION" ? EndState.SUCCESSFUL_MITIGATION : EndState.RADIONUCLIDE_RELEASE, releaseCategoryIds: e.target.value === "SUCCESSFUL_MITIGATION" ? [] : f.releaseCategoryIds })}>
                    <option value="SUCCESSFUL_MITIGATION">Safe stable state</option>
                    <option value="RADIONUCLIDE_RELEASE">Radionuclide release</option>
                  </select>
                : <div>{isOk ? "Safe stable state" : "Radionuclide release"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Release category</label>
              {editable
                ? <select className="posfield__select" value={rc} disabled={isOk} onChange={(e) => patch({ releaseCategoryIds: e.target.value.length === 0 ? [] : [e.target.value] })}>
                    <option value="">None</option>
                    {ES_RELEASE_CATEGORIES.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                  </select>
                : <div>{rc.length > 0 ? rc : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Representative initiating event</label>
              {editable
                ? <select className="posfield__select" value={f.representativeInitiatingEventId} onChange={(e) => patch({ representativeInitiatingEventId: e.target.value })}>
                    {ieOptions.map((ie) => <option key={ie} value={ie}>{ie}</option>)}
                  </select>
                : <div className="posmono">{f.representativeInitiatingEventId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Representative operating state</label>
              {editable
                ? <select className="posfield__select" value={f.representativePlantOperatingStateId} onChange={(e) => patch({ representativePlantOperatingStateId: e.target.value })}>
                    {posOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                : <div className="posmono">{f.representativePlantOperatingStateId}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Similarity check (leave empty when resolved)</label>
              {editable
                ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="Open ES-C3 check on whether the representative bounds every member" value={f.similarityBasis ?? ""} onChange={(e) => patch({ similarityBasis: e.target.value.length === 0 ? undefined : e.target.value })} />
                : <div>{f.similarityBasis ?? "Resolved"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Member sequences" level={3} /></div>
          <p className="poscard__sub">The highest-frequency member <span className="posmono">{representativeId ?? "—"}</span> is the representative sequence.</p>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {f.memberSequenceIds.map((id) => (
              <span key={id} className={`poschip${id === representativeId ? " poschip--primary" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {id}
                {editable && <button type="button" title="Remove" onClick={() => toggleMember(id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>}
              </span>
            ))}
            {editable && eligible.length > 0 && (
              <select className="posfield__select" style={{ maxWidth: 220 }} value="" onChange={(e) => { if (e.target.value.length > 0) toggleMember(e.target.value); }}>
                <option value="">Add a sequence…</option>
                {eligible.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            )}
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeFamily}><ESIcon.Close /> Remove family</button>
          </div>
        )}
      </div>
    </>
  );
}

function ScreeningDrawerBody({ recordId, onClose }: { recordId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const r = es.screeningRecords.find((x) => x.sequenceId === recordId);
  if (r === undefined) return null;
  const seq = es.eventSequences.find((s) => s.uuid === recordId);
  const isOk = seq?.endState === "SUCCESSFUL_MITIGATION";

  function patch(patchObj: Partial<EventSequenceScreeningRecord>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, screeningRecords: draft.screeningRecords.map((x) => (x.sequenceId === recordId ? { ...x, ...patchObj } : x)) }));
  }
  function removeRecord(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, screeningRecords: draft.screeningRecords.filter((x) => x.sequenceId !== recordId) }));
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Screening record · {r.sequenceId}</div>
          <h2 className="posdrawer__title">{seq?.name ?? r.sequenceId}</h2>
          <div className="posdrawer__sub">{seq !== undefined
            ? `${seq.initiatingEventId} · ${seq.plantOperatingStateId} · ${isOk ? "safe stable state" : seq.releaseCategoryId ?? "release"} · ${fmtExp(freqValue(seq.meanFrequency))}/yr`
            : "Not in the sequence model (screened out before sequence development)"}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Disposition" level={3} /></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Decision</label>
              {editable
                ? <select className="posfield__select" value={r.retained ? "retained" : "screened"} onChange={(e) => patch(e.target.value === "retained" ? { retained: true, criterion: undefined } : { retained: false, criterion: r.criterion ?? "SCR-3" })}>
                    <option value="retained">Retained</option>
                    <option value="screened">Screened out</option>
                  </select>
                : <div>{r.retained ? "Retained" : "Screened out"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Screening criterion</label>
              {editable && !r.retained
                ? <select className="posfield__select" value={r.criterion ?? "SCR-3"} onChange={(e) => patch({ criterion: e.target.value === "SCR-1" ? "SCR-1" : e.target.value === "SCR-2" ? "SCR-2" : "SCR-3" })}>
                    <option value="SCR-1">SCR-1</option>
                    <option value="SCR-2">SCR-2</option>
                    <option value="SCR-3">SCR-3</option>
                  </select>
                : <div className="posmono">{r.retained ? "—" : r.criterion ?? "—"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="ES" title="Justification" level={3} /></div>
          {editable
            ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} placeholder="Why this sequence is kept, or the SCR basis for dropping it" value={r.justification} onChange={(e) => patch({ justification: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{r.justification}</p>}
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeRecord}><ESIcon.Close /> Remove record</button>
          </div>
        )}
      </div>
    </>
  );
}

function DrawerHost({ ctx, onClose }: { ctx: DrawerCtx; onClose: () => void }): JSX.Element {
  const { es } = useEsWorkbook();
  const trees = useMemo(() => eventTreesView(es), [es]);
  const deps = useMemo(() => dependenciesView(es), [es]);
  useEffect(() => {
    function onKey(e: KeyboardEvent): void { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="posdrawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="posdrawer" role="dialog" aria-modal="true">
        {ctx.kind === "sequence" && <SequenceDrawerBody seqId={ctx.id} trees={trees} deps={deps} onClose={onClose} />}
        {ctx.kind === "dependency" && <DependencyDrawerBody depId={ctx.id} deps={deps} trees={trees} onClose={onClose} />}
        {ctx.kind === "releaseCategory" && <ReleaseCategoryDrawerBody mappingId={ctx.id} onClose={onClose} />}
        {ctx.kind === "family" && <FamilyDrawerBody familyId={ctx.id} onClose={onClose} />}
        {ctx.kind === "screening" && <ScreeningDrawerBody recordId={ctx.id} onClose={onClose} />}
      </div>
    </div>
  );
}


interface EsTrailPlace {
  treeId: string;
  selection: string | null;
}

function useFaultTreeNames(trees: readonly EventTree[], linkedSyId: string | undefined, linkedSy: SystemsAnalysis | undefined, source: EsFaultTreeSource | undefined): Map<string, string> {
  const [fetched, setFetched] = useState<ReadonlyMap<string, SystemsAnalysis>>(new Map());
  const requested = useRef(new Set<string>());
  const referenced = useMemo(() => [...new Set(trees.flatMap((tree) => Object.values(tree.functionalEvents).flatMap((event) => (event.faultTreeTopEvent === undefined ? [] : [event.faultTreeTopEvent.workbookId]))))], [trees]);
  useEffect(() => {
    for (const workbookId of referenced) {
      if (workbookId.length === 0 || workbookId === source?.workbookId || (workbookId === linkedSyId && linkedSy !== undefined) || requested.current.has(workbookId)) continue;
      requested.current.add(workbookId);
      getSyWorkbook(workbookId)
        .then((workbook) => setFetched((current) => new Map(current).set(workbookId, workbook.mef)))
        .catch(() => undefined);
    }
  }, [referenced, source?.workbookId, linkedSyId, linkedSy]);
  return useMemo(() => {
    const names = new Map<string, string>();
    const add = (workbookId: string, mef: SystemsAnalysis): void => {
      for (const model of mef.systemLogicModels) {
        names.set(`${workbookId}|${model.uuid}`, model.name);
        if (!names.has(`|${model.uuid}`)) names.set(`|${model.uuid}`, model.name);
      }
    };
    if (source !== undefined) add(source.workbookId, source.mef);
    if (linkedSy !== undefined) add(linkedSyId ?? "", linkedSy);
    for (const [workbookId, mef] of fetched) add(workbookId, mef);
    return names;
  }, [fetched, linkedSy, linkedSyId, source]);
}

function treeCode(tree: EventTree): string {
  return tree.label !== undefined && tree.label.length > 0 ? tree.label : tree.name;
}

type SequenceTab = "coverage" | "tree" | "screening" | RecordTab;

const SEQUENCE_TABS: { id: SequenceTab; label: string }[] = [
  { id: "coverage", label: "Coverage" },
  { id: "tree", label: "Event tree" },
  { id: "sequences", label: "Sequences" },
  { id: "endstates", label: "End states" },
  { id: "families", label: "Families" },
  { id: "categories", label: "Release categories" },
  { id: "transfers", label: "Transfers" },
  { id: "screening", label: "Screening" },
  { id: "checks", label: "Checks" },
];

function kindOfScEndState(endState: EndState): EsEndStateKind {
  return endState === EndState.RADIONUCLIDE_RELEASE ? "RELEASE" : "SAFE_STABLE";
}

function EndStateDialog({ treeId, endStateId, sequenceId, onClose }: { treeId: string; endStateId?: string; sequenceId?: string; onClose: () => void }): JSX.Element {
  const { es, upstream, editable, mutateEs } = useEsWorkbook();
  const existing = es.endStateDefinitions?.find((candidate) => candidate.id === endStateId);
  const [draft, setDraft] = useState<EsEndStateDefinition>(() => existing ?? { code: "", name: "", kind: "SAFE_STABLE", id: crypto.randomUUID() });
  const [newCategory, setNewCategory] = useState("");
  const fieldId = useId();
  const categories = releaseCategoryOptions(es);
  const scEndStates = upstream?.sc?.endStateDefinitions ?? [];
  const sources = es.scopeDefinition.radioactiveMaterialSources;
  const barriers = es.scopeDefinition.radionuclideBarriers;
  const uses = existing === undefined ? 0 : endStateUseCount(es, existing.id);
  const code = draft.code.trim();
  const taken = (es.endStateDefinitions ?? []).some((candidate) => candidate.id !== draft.id && candidate.code === code);
  const categoryCode = newCategory.trim();
  const ready = code.length > 0 && draft.name.trim().length > 0 && !taken;

  function patch(fields: Partial<EsEndStateDefinition>): void {
    setDraft((current) => ({ ...current, ...fields }));
  }

  function linkSc(scId: string): void {
    const linked = scEndStates.find((candidate) => candidate.uuid === scId);
    if (linked === undefined) {
      setDraft(({ scEndStateId: _old, ...rest }) => rest);
      return;
    }
    const kind = kindOfScEndState(linked.endState);
    setDraft((current) => {
      const { releaseCategoryId: _previous, ...rest } = current;
      const category = linked.resultingReleaseCategoryId ?? linked.releaseCategoryReferences[0];
      return { ...rest, scEndStateId: linked.uuid, kind, definition: linked.definition, ...(kind === "RELEASE" && category !== undefined ? { releaseCategoryId: category } : {}) };
    });
  }

  function setBarrier(barrier: string, condition: string): void {
    const kept = (draft.barriers ?? []).filter((entry) => entry.barrier !== barrier);
    const chosen = BARRIER_CONDITIONS.find((option) => option.id === condition)?.id;
    patch({ barriers: chosen === undefined ? kept : [...kept, { barrier, condition: chosen }] });
  }

  function save(): void {
    if (!editable || !ready) return;
    const releaseCategoryId = draft.kind === "RELEASE" ? (categoryCode.length > 0 ? categoryCode : draft.releaseCategoryId) : undefined;
    const { releaseCategoryId: _previous, ...rest } = draft;
    const definition: EsEndStateDefinition = { ...rest, code, name: draft.name.trim(), ...(releaseCategoryId === undefined ? {} : { releaseCategoryId }) };
    mutateEs((current) => {
      const definitions = current.endStateDefinitions ?? [];
      let next: EventSequenceAnalysis = {
        ...current,
        endStateDefinitions: definitions.some((candidate) => candidate.id === definition.id) ? definitions.map((candidate) => (candidate.id === definition.id ? definition : candidate)) : [...definitions, definition],
      };
      if (releaseCategoryId !== undefined && !releaseCategoryOptions(next).some((option) => option.id === releaseCategoryId)) {
        next = { ...next, releaseCategoryMappings: [...(next.releaseCategoryMappings ?? []), { uuid: crypto.randomUUID(), name: definition.name, releaseCategoryId, eventSequenceIds: [], mappingBasis: "", commonCharacteristics: [], physicalReleaseCharacteristics: [], implementsSrs: [] }] };
      }
      next = withEndStateDefinitionApplied(next, definition.id);
      if (sequenceId !== undefined) {
        next = {
          ...next,
          eventTrees: (next.eventTrees ?? []).map((tree) => (tree.uuid === treeId ? applyEventTreeOperation(tree, { kind: "SET_SEQUENCE_END_STATE", sequenceId, endState: definition.kind === "RELEASE" ? "RADIONUCLIDE_RELEASE" : "SUCCESSFUL_MITIGATION", endStateId: definition.id }) : tree)),
        };
        next = withSyncedSequenceEndState(next, treeId, sequenceId);
      }
      return next;
    });
    onClose();
  }

  function remove(): void {
    if (!editable || existing === undefined || uses > 0) return;
    mutateEs((current) => ({ ...current, endStateDefinitions: (current.endStateDefinitions ?? []).filter((candidate) => candidate.id !== existing.id) }));
    onClose();
  }

  return (
    <DialogShell label="End state" onClose={onClose}>
      <DialogHead cap={existing === undefined ? "New end state · ES-A8 · ES-C1" : "End state · ES-A8 · ES-C1"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          {scEndStates.length > 0 && (
            <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-sc`}>SC end state</label>
              <select id={`${fieldId}-sc`} className="posfield__select" value={draft.scEndStateId ?? ""} disabled={!editable} onChange={(event) => linkSc(event.target.value)}>
                <option value="">Typed in ES</option>
                {scEndStates.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{recordLabel(candidate.uuid, candidate.definition)}</option>)}
              </select>
            </div>
          )}
          <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-code`}>Code</label>
            <input id={`${fieldId}-code`} className="posfield__input posmono" value={draft.code} disabled={!editable} onChange={(event) => patch({ code: event.target.value })} />
          </div>
          <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-kind`}>Kind</label>
            <select id={`${fieldId}-kind`} className="posfield__select" value={draft.kind} disabled={!editable} onChange={(event) => { const kind = END_STATE_KINDS.find((option) => option.id === event.target.value)?.id; if (kind !== undefined) patch({ kind }); }}>
              {END_STATE_KINDS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-name`}>Name</label>
            <input id={`${fieldId}-name`} className="posfield__input" value={draft.name} disabled={!editable} onChange={(event) => patch({ name: event.target.value })} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-definition`}>Definition</label>
            <textarea id={`${fieldId}-definition`} className="posfield__textarea" rows={3} value={draft.definition ?? ""} disabled={!editable} onChange={(event) => patch({ definition: event.target.value })} />
          </div>
          {draft.kind === "RELEASE" && (
            <>
              <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-category`}>Release category</label>
                <select id={`${fieldId}-category`} className="posfield__select" value={draft.releaseCategoryId ?? ""} disabled={!editable || categoryCode.length > 0} onChange={(event) => { const { releaseCategoryId: _old, ...rest } = draft; setDraft(event.target.value.length === 0 ? rest : { ...rest, releaseCategoryId: event.target.value }); }}>
                  <option value="">None</option>
                  {categories.map((option) => <option key={option.id} value={option.id}>{option.name.length > 0 && option.name !== option.id ? `${option.id} · ${option.name}` : option.id}</option>)}
                </select>
              </div>
              <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-new-category`}>New release category</label>
                <input id={`${fieldId}-new-category`} className="posfield__input posmono" placeholder={nextReleaseCategoryId(categories.map((option) => option.id))} value={newCategory} disabled={!editable} onChange={(event) => setNewCategory(event.target.value)} />
              </div>
              <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-path`}>Release path</label>
                <input id={`${fieldId}-path`} className="posfield__input" value={draft.releasePath ?? ""} disabled={!editable} onChange={(event) => patch({ releasePath: event.target.value })} />
              </div>
              <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-timing`}>Timing</label>
                <input id={`${fieldId}-timing`} className="posfield__input" value={draft.timing ?? ""} disabled={!editable} onChange={(event) => patch({ timing: event.target.value })} />
              </div>
            </>
          )}
        </div>
        <ChoiceEditor label="Reactors and sources" choices={sources.map((source) => ({ id: source, label: "" }))} values={draft.reactorsAndSources ?? []} editable={editable} addLabel="Add a reactor or source" mono={false} onChange={(reactorsAndSources) => patch({ reactorsAndSources })} />
        {barriers.length > 0 && (
          <div className="posfield-grid">
            {barriers.map((barrier) => (
              <div key={barrier} className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-barrier-${barrier}`}>{barrier}</label>
                <select id={`${fieldId}-barrier-${barrier}`} className="posfield__select" value={draft.barriers?.find((entry) => entry.barrier === barrier)?.condition ?? ""} disabled={!editable} onChange={(event) => setBarrier(barrier, event.target.value)}>
                  <option value="">Not recorded</option>
                  {BARRIER_CONDITIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        {taken && <p className="es-scope-error" role="alert">{code} is already used by another end state.</p>}
        {editable && (
          <div className="posrow es-dialog-actions">
            {existing !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" disabled={uses > 0} title={uses > 0 ? `${String(uses)} path${uses === 1 ? "" : "s"} use this end state` : undefined} onClick={remove}>Delete end state</button>}
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!ready} onClick={save}>{existing === undefined ? "Add end state" : "Save"}</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function SequencesScreen({ treeId, setTreeId, tab, setTab }: { treeId: string; setTreeId: (id: string) => void; tab: SequenceTab; setTab: (tab: SequenceTab) => void }): JSX.Element {
  const { es, posLink, ieLink, projectId, faultTreeSource, upstream, editable, mutateEs, runtime } = useEsWorkbook();
  const faultTreeNames = useFaultTreeNames(es.eventTrees ?? [], es.linkedWorkbooks?.SY, upstream?.sy, faultTreeSource);
  const coverage = useMemo(() => coverageView(es, posLink, ieLink), [es, posLink, ieLink]);
  const releaseCategories = useMemo(() => releaseCategoryOptions(es), [es]);
  const initiatorOptions = useMemo(() => {
    const known = new Set(coverage.groups.map((group) => group.id));
    return [...coverage.groups, ...ieLink.groups.filter((group) => !known.has(group.id))].map((group) => ({ id: group.id, name: group.name }));
  }, [coverage.groups, ieLink.groups]);
  const [representation, setRepresentation] = useState<EventTreeRepresentation>("event-tree");
  const [selection, setSelection] = useState<string | null>(null);
  const [faultTreeLink, setFaultTreeLink] = useState<{ eventTreeId: string; functionalEventId: string; functionalEventName: string } | null>(null);
  const [endStateDialog, setEndStateDialog] = useState<{ endStateId?: string; sequenceId?: string } | null>(null);
  const endStateOptions = useMemo(() => (es.endStateDefinitions ?? []).map((definition) => ({
    id: definition.id,
    code: definition.code,
    name: definition.name,
    release: definition.kind === "RELEASE",
    source: definition.scEndStateId === undefined ? "Typed in ES" : `Linked from SC · ${definition.scEndStateId}`,
  })), [es.endStateDefinitions]);
  const endStateIds = useMemo(() => new Set(endStateOptions.map((option) => option.id)), [endStateOptions]);
  const findings = useMemo(() => sequenceFindings(es), [es]);
  const tablist = useRef<HTMLDivElement>(null);
  const tabsId = useId();
  const trees = es.eventTrees ?? [];
  const model = trees.find((tree) => tree.uuid === treeId) ?? trees[0];
  const activeTreeId = model?.uuid ?? "";

  const pendingSelection = useRef<EsTrailPlace | null>(null);
  const trail = useTransferTrail<EsTrailPlace>(
    (place) => place.treeId === activeTreeId,
    (from, to, live) => {
      const sequenceId = live ? selection : from.selection;
      return sequenceId !== null && trees.find((tree) => tree.uuid === from.treeId)?.transfers?.[sequenceId]?.targetEventTreeId === to.treeId;
    },
  );
  const currentPlace = (): EsTrailPlace => ({ treeId: activeTreeId, selection });
  const goTo = (place: EsTrailPlace): void => {
    if (place.treeId === activeTreeId) {
      setSelection(place.selection);
      return;
    }
    pendingSelection.current = place;
    setTreeId(place.treeId);
  };
  const openTree = (id: string): void => {
    trail.reset();
    setTreeId(id);
    setSelection(null);
    setTab("tree");
  };
  const openPath = (id: string, selected: string | null): void => {
    trail.reset();
    pendingSelection.current = { treeId: id, selection: selected };
    setTreeId(id);
    setTab("tree");
  };

  useEffect(() => {
    if (model !== undefined && treeId !== model.uuid) setTreeId(model.uuid);
  }, [model, treeId]);

  useEffect(() => {
    const pending = pendingSelection.current;
    if (pending === null || pending.treeId !== activeTreeId || tab !== "tree") return;
    pendingSelection.current = null;
    setSelection(pending.selection);
  }, [activeTreeId, tab]);

  const createTree = (initiatingEventId?: string, plantOperatingStateId?: string): void => {
    if (!editable) return;
    const initiator = initiatingEventId ?? ieLink.groups[0]?.id ?? es.scopeDefinition.initiatingEventIds[0] ?? "IE-1";
    const operatingState = plantOperatingStateId ?? posLink.states[0]?.id ?? es.scopeDefinition.plantOperatingStateIds[0];
    const created = createEmptyEventTree(initiator, operatingState);
    mutateEs((draft) => ({ ...draft, eventTrees: [...(draft.eventTrees ?? []), created] }));
    openTree(created.uuid);
  };

  const applyOperation = (operation: EventTreeOperation): void => {
    if (model === undefined) return;
    mutateEs((draft) => {
      const reserved = reservedSequenceNames(draft, model.uuid);
      const applied = {
        ...draft,
        eventTrees: (draft.eventTrees ?? []).map((candidate) => candidate.uuid === model.uuid ? applyEventTreeOperation(candidate, operation, reserved) : candidate),
      };
      const synced = operation.kind === "SET_SEQUENCE_END_STATE" ? withSyncedSequenceEndState(applied, model.uuid, operation.sequenceId) : applied;
      return withDistinctSequences(draft, synced);
    });
  };

  const linkingTree = trees.find((tree) => tree.uuid === faultTreeLink?.eventTreeId);
  const linkingFunctionalEvent = Object.values(linkingTree?.functionalEvents ?? {}).find((event) => event.uuid === faultTreeLink?.functionalEventId);

  function renderCoverage(): JSX.Element {
    if (coverage.groups.length === 0 || coverage.states.length === 0) {
      return <div className="es-seq-note"><p>Add operating states and initiating event groups to the analysis scope in Step 01.</p></div>;
    }
    return (
      <div className="esmatrix-wrap">
        <table className="esmatrix">
          <thead><tr><th className="esmatrix__corner">Operating state</th>{coverage.groups.map((group) => <th key={group.id} className={`esmatrix__col${model?.initiatingEventId === group.id ? " esmatrix__col--active" : ""}`}>{group.id}</th>)}</tr></thead>
          <tbody>{coverage.states.map((state) => <tr key={state.id}><th className="esmatrix__rowh"><span className="esmatrix__rowh-id">{state.id}</span>{state.name.length > 0 && <span className="esmatrix__rowh-name">{state.name}</span>}</th>{coverage.groups.map((group) => {
            const cellTreeId = coverage.cellTree[`${group.id}|${state.id}`];
            const selected = cellTreeId === model?.uuid;
            return <td key={group.id} className={`esmatrix__cell${cellTreeId === undefined ? "" : " esmatrix__cell--on"}${selected ? " esmatrix__cell--sel" : ""}`} title={cellTreeId === undefined ? `Create ${group.id} in ${state.id}` : `Open ${group.id} in ${state.id}`} onClick={() => { if (cellTreeId === undefined) createTree(group.id, state.id); else openTree(cellTreeId); }}>{cellTreeId === undefined ? (editable ? <span className="esmatrix__add">+</span> : <span className="esmatrix__na">·</span>) : <span className="esmatrix__dot" />}</td>;
          })}</tr>)}</tbody>
        </table>
      </div>
    );
  }

  function renderTree(): JSX.Element {
    if (model === undefined) {
      return (
        <div className="es-seq-note">
          <p>This workbook has no event tree yet.</p>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => createTree()}>Create event tree</button>}
        </div>
      );
    }
    return (
      <EventTreeEditor
        model={model}
        breadcrumb={transferBreadcrumb(trail, currentPlace, goTo)}
        eventSequences={es.eventSequences}
        availableInitiatingEvents={initiatorOptions}
        availableOperatingStates={coverage.states}
        editFrequency={false}
        availableTransfers={trees.filter((tree) => tree.uuid !== model.uuid).map((tree) => ({ id: tree.uuid, name: tree.name, sequenceIds: Object.keys(tree.sequences) }))}
        sequenceFamilyOptions={es.eventSequenceFamilies.map((family) => ({ id: family.uuid, name: family.name }))}
        releaseCategoryOptions={releaseCategories}
        representation={representation}
        capabilities={{ author: editable, quantification: false, linkSelection: true }}
        selection={selection}
        validation={validateEventTree(model, trees, endStateIds).filter((finding) => !finding.code.startsWith("ET_FREQUENCY")
          && !(finding.code === "ET_FT_LINK_REQUIRED" && finding.entityId !== undefined && dependencyBoundFunctionalEvents(es, model).has(finding.entityId)))}
        saveState={runtime.saveState}
        onOperation={applyOperation}
        onRepresentationChange={setRepresentation}
        onSelectionChange={setSelection}
        faultTreeName={(reference) => faultTreeNames.get(`${reference.workbookId}|${reference.modelId}`) ?? faultTreeNames.get(`|${reference.modelId}`)}
        onSelectFaultTreeLink={(functionalEvent) => setFaultTreeLink({ eventTreeId: model.uuid, functionalEventId: functionalEvent.uuid, functionalEventName: functionalEvent.label ?? functionalEvent.name })}
        onClassifySequence={(sequenceId, changes) => mutateEs((draft) => withTreeSequenceClassification(draft, model.uuid, sequenceId, changes))}
        sequenceFamilySource="From the Families tab"
        releaseCategorySource="From the Release categories tab"
        endStateOptions={endStateOptions}
        onAddEndState={editable ? (sequenceId) => setEndStateDialog({ sequenceId }) : undefined}
        onEditEndState={(endStateId) => setEndStateDialog({ endStateId })}
        onOpenReference={(reference) => {
          if ("targetEventTreeId" in reference) {
            const target = trees.find((tree) => tree.uuid === reference.targetEventTreeId);
            trail.follow(
              { place: currentPlace(), label: treeCode(model) },
              { place: { treeId: reference.targetEventTreeId, selection: null }, label: target === undefined ? reference.targetEventTreeId : treeCode(target) },
            );
            setTreeId(reference.targetEventTreeId);
            setSelection(null);
          } else {
            window.open(`/sy-workbooks/${reference.workbookId}`, "_blank", "noopener,noreferrer");
          }
        }}
      />
    );
  }

  return (
    <>
      <div className="poscard es-seq-card">
        {(tab === "coverage" || tab === "tree") && <div className="poscard__head es-seq-card__head">
          {model !== undefined ? (
            <div className="es-seq-card__picker">
              <label className="posfield__label" htmlFor={`${tabsId}-tree`}>Event tree</label>
              <div className="es-seq-card__pick-row">
                <select id={`${tabsId}-tree`} className="posfield__select" value={model.uuid} onChange={(event) => openTree(event.target.value)}>
                  {trees.map((tree) => <option key={tree.uuid} value={tree.uuid}>{tree.name}</option>)}
                </select>
                {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => createTree()}>Add event tree</button>}
              </div>
            </div>
          ) : editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => createTree()}>Add event tree</button>}
        </div>}
        <div
          className="es-tabs"
          role="tablist"
          aria-label="Event sequence sections"
          ref={tablist}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const current = SEQUENCE_TABS.findIndex((item) => item.id === tab);
            const next = event.key === "Home" ? 0 : event.key === "End" ? SEQUENCE_TABS.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + SEQUENCE_TABS.length) % SEQUENCE_TABS.length;
            const target = SEQUENCE_TABS[next];
            if (target === undefined) return;
            setTab(target.id);
            tablist.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
          }}
        >
          {SEQUENCE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabsId}-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
            >
              {item.id === "checks" ? `Checks (${String(findings.length)})` : item.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} className="es-seq-card__panel">
          {tab === "coverage" ? renderCoverage() : tab === "tree" ? renderTree() : tab === "screening" ? <ScreeningScreen /> : (
            <SequenceRecordTabs
              tab={tab}
              findings={findings}
              groups={initiatorOptions}
              states={coverage.states}
              onOpenPath={openPath}
              onAddEndState={() => setEndStateDialog({})}
              onEditEndState={(endStateId) => setEndStateDialog({ endStateId })}
            />
          )}
        </div>
      </div>

      {endStateDialog !== null && <EndStateDialog treeId={model?.uuid ?? ""} {...(endStateDialog.endStateId === undefined ? {} : { endStateId: endStateDialog.endStateId })} {...(endStateDialog.sequenceId === undefined ? {} : { sequenceId: endStateDialog.sequenceId })} onClose={() => setEndStateDialog(null)} />}

      {faultTreeLink !== null && (projectId !== undefined || faultTreeSource !== undefined) && (
        <EsFaultTreeReferencePicker
          {...(projectId === undefined ? {} : { projectId })}
          {...(faultTreeSource === undefined ? {} : { embeddedSource: faultTreeSource })}
          {...(es.linkedWorkbooks?.SY === undefined ? {} : { linkedWorkbookId: es.linkedWorkbooks.SY })}
          functionalEventName={faultTreeLink.functionalEventName}
          currentReference={linkingFunctionalEvent?.faultTreeTopEvent}
          onClose={() => setFaultTreeLink(null)}
          onConfirm={(reference) => {
            mutateEs((draft) => setFunctionalEventFaultTreeReference(draft, faultTreeLink.eventTreeId, faultTreeLink.functionalEventId, reference));
            setFaultTreeLink(null);
          }}
        />
      )}
    </>
  );
}


function csvList(value: string): string[] {
  return value.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
}

function ScreeningScreen(): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const records = useMemo(() => screeningView(es), [es]);
  const seqs = useMemo(() => sequencesView(es), [es]);
  const seqById = useMemo(() => new Map(seqs.map((s) => [s.id, s])), [seqs]);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const eligible = seqs.filter((s) => !records.some((r) => r.sequenceId === s.id)).map((s) => s.id);

  function addRecord(seqId: string): void {
    if (!editable || seqId.length === 0) return;
    mutateEs((draft) => ({ ...draft, screeningRecords: [...draft.screeningRecords, { sequenceId: seqId, retained: true, justification: "", implementsSrs: [] }] }));
    setDrawer({ kind: "screening", id: seqId });
  }

  return (
    <>
        {editable && eligible.length > 0 && (
          <div className="es-records__bar">
            <select className="posfield__select" style={{ maxWidth: 220 }} value="" aria-label="Add a screening record" onChange={(e) => addRecord(e.target.value)}>
              <option value="">Add a record for…</option>
              {eligible.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        )}
        {records.length > 0 ? (
          <table className="postable">
            <thead><tr><th>Sequence</th><th>Basis</th><th>Status</th></tr></thead>
            <tbody>
              {records.map((r) => {
                const seq = seqById.get(r.sequenceId);
                return (
                  <tr key={r.sequenceId} className="postable__row--clickable" onClick={() => setDrawer({ kind: "screening", id: r.sequenceId })}>
                    <td>
                      <div className="postable__name posmono">{r.sequenceId}</div>
                      <span className="postable__name-sub">{seq !== undefined ? `${seq.initiatingEventId} · ${seq.plantOperatingStateId}` : "Pre-layout scenario"}</span>
                    </td>
                    <td><span className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{r.justification.length > 0 ? r.justification : "—"}</span></td>
                    <td>{r.retained ? <Badge kind="ok">Retained</Badge> : <Badge kind="draft">Screened · {r.criterion}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EsEmpty title="No screening records yet" hint="Every sequence is kept by default; record the basis for any sequence screened out under SCR-3 (ES-A7)." />}
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { es } = useEsWorkbook();
  const ready = scores.blocked === 0;
  function downloadJson(): void {
    const blob = new Blob([stringifyJson(es, 2)!], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${es.name} — ES Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  const TOC_ITEMS: [string, string][] = [
    ["Executive summary", "5"],
    ["Introduction", "6"],
    ["    Purpose", "6"],
    ["    Scope", "6"],
    ["    Relationship to other documents", "6"],
    ["    Document layout", "6"],
    ["    Quality assurance", "6"],
    ["    Freeze date", "6"],
    ["Assumptions & limitations", "7"],
    ["Initiating events selected for ES analysis", "8"],
    ["Event sequence development", "9"],
    ["    General framework of ES models", "9"],
    ["    Event sequence end states", "9"],
    ["    Implementation of the framework", "9"],
    ["    Response of plant systems & structures", "9"],
    ["    Source term characteristics", "9"],
    ["    Event sequence development models", "9"],
    ["Event sequence analysis for mode & state", "10"],
    ["    Common elements (scope, success criteria, mitigation)", "10"],
    ["    Key assumptions & uncertainties", "10"],
    ["    Event sequence quantification", "10"],
    ["    Event sequence models", "10"],
    ["Preliminary point-estimate licensing basis events", "11"],
    ["References", "12"],
  ];
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{es.name}</h1>
        <h2>Preliminary Event Sequence Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {TOC_ITEMS.map(([t, p], i) => (<div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>))}
        </div>
      </div>

      <div className="posgen__side">
        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="ES" title="Conformance check" level={3} className="posgen__readout-h" />
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
        </div>

        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="ES" title="Draft submission" level={3} className="posgen__readout-h" />
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All items pass at <strong>{cc.name}</strong>, so making the draft locks Steps 1-8 and moves the workbook to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention, so you can still make a working draft, but it cannot be approved until they are fixed.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}><ESIcon.Send /> Submit draft to internal review</button>
            )}
            <button type="button" className="posnav__btn" onClick={() => { void generateEsReport(es, ready); }}><ESIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><ESIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return (
    <div className="poscard">
      <div className="esplaceholder">
        <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{label}</div>
        <div className="possubtle">This step is part of the Event Sequence Analysis build and lands in a later phase.</div>
      </div>
    </div>
  );
}

export {
  SequencesScreen,
  ScreeningScreen,
  DraftScreen,
  PlaceholderScreen,
  type SequenceTab,
};
