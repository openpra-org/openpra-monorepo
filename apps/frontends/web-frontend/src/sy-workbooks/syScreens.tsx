import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX, useEffect, useState } from "react";
import type { SystemBasicEvent, SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import {
  applyFaultTreeBasicEventToSystemBasicEvent,
  systemBasicEventToFaultTreeBasicEvent,
} from "interfaces-mef-types/sy/system-models";
import {
  FaultTreeEditor,
  applyFaultTreeOperation,
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
  type FaultTreeOperation,
  type FaultTreeSelection,
} from "../newly-developed-methods/fault-tree";
import {
  validateFaultTreeModel,
  type FaultTreeAnalysisResult,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { SYIcon } from "./syIcons";
import { Badge, SYProvenanceChip } from "./syShared";
import {
  CAPABILITY_CATEGORIES,
  FAILURE_MODE_TYPES,
  CCF_MODELS,
  ccfParams,
  ccfModelCheck,
  toExp,
  SCREENING_CRITERIA,
  type Stage,
} from "./syViewData";
import { ccScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "./syWorkbookApi";

interface SyDrawerContext {
  kind: "system" | "ccf" | "hfe" | "screening" | "exclusion" | "unavail" | "ssc" | "spc" | "inv" | "dic" | "loop" | "confirm" | "oc" | "unc" | "assum" | "sens" | "be";
  id: string;
}

interface SyIfaceLane {
  key: string;
  code: string;
  element: string;
  role: string;
  direction: "in" | "out";
  columns: string[];
  rows: { id: string; name: string; values: string[] }[];
  empty: string;
}

function ScopeScreen({ ccId, setCcId, stage, setStage, onAction }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
}): JSX.Element {
  const { sy, links, editable, mutateSy } = useSyWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const ifaceLanes: SyIfaceLane[] = [
    {
      key: "in-POS", code: "POS", element: "Plant Operating States", role: "Operating states", direction: "in",
      columns: ["Operating state", "Decay heat", "Duration (h)"],
      rows: (links?.posStates ?? []).map((st) => ({ id: st.id, name: `${st.id} · ${st.name}`, values: [st.decayLabel, String(st.durationHours)] })),
      empty: "Load an example to pull the operating states the systems align to.",
    },
    {
      key: "in-SC", code: "SC", element: "Success Criteria", role: "System success criteria", direction: "in",
      columns: ["System", "Required capacities"],
      rows: (links?.scSystems ?? []).map((y) => ({ id: y.id, name: y.name, values: [y.capacities] })),
      empty: "Load an example to pull the system success criteria this analysis models.",
    },
    {
      key: "out-HR", code: "HR", element: "Human Reliability", role: "Human failure events", direction: "out",
      columns: ["Human failure event", "System", "Task"],
      rows: sy.humanFailureEventIntegrations.map((h) => ({ id: h.uuid, name: h.hfeReference, values: [h.system, h.taskDescription] })),
      empty: "No human failure events integrated yet.",
    },
    {
      key: "out-DA", code: "DA", element: "Data Analysis", role: "Basic events", direction: "out",
      columns: ["Basic event", "Failure mode", "Point estimate"],
      rows: (sy.systemBasicEvents ?? []).map((b) => ({ id: b.uuid, name: b.name, values: [String(b.failureMode ?? ""), b.probability !== undefined ? b.probability.toExponential(1) : ""] })),
      empty: "No basic events defined yet.",
    },
    {
      key: "out-ESQ", code: "ESQ", element: "Event Sequence Quantification", role: "System fault trees", direction: "out",
      columns: ["System", "Top event", "Mission (h)"],
      rows: sy.systemDefinitions.map((d) => ({ id: d.uuid, name: d.name, values: [d.description ?? "", String(d.missionTimeHours)] })),
      empty: "No system models defined yet.",
    },
  ];
  const selectedLane = ifaceLanes.find((l) => l.key === selectedTe);

  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateSy((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    onAction(`Plant stage set to ${newStage === "operational" ? "Operational" : "Pre-operational"}`);
    mutateSy((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Interfaces" level={3} />
          {links !== null ? <Badge kind="ok">Linked</Badge> : <Badge kind="warn">Not linked</Badge>}
        </div>
        <p className="poscard__sub">Systems Analysis reads the system success criteria from SC and the operating states from POS, then hands its fault-tree models to ESQ, its basic events to DA, and its human failure events to HR. Select an element to see the data exchanged.</p>
        <div className="poshandoff__grid">
          {ifaceLanes.map((lane) => (
            <button key={lane.key} type="button"
              className={`poshandoff__tile${selectedTe === lane.key ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.key ? null : lane.key)}>
              <span className="poshandoff__tile-code">{lane.code}</span>
              <span className="poshandoff__tile-name">{lane.element}</span>
              <span className="poshandoff__tile-role">{lane.direction === "in" ? "Provides · " : "Consumes · "}{lane.role}</span>
            </button>
          ))}
        </div>
        {selectedLane !== undefined && (
          <div style={{ marginTop: 16 }}>
            <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
              {selectedLane.direction === "in"
                ? `Systems Analysis receives ${selectedLane.role.toLowerCase()} from ${selectedLane.element}`
                : `${selectedLane.element} receives ${selectedLane.role.toLowerCase()} from Systems Analysis`}
            </div>
            {selectedLane.rows.length > 0 ? (
              <table className="postable postable--mid">
                <thead><tr>{selectedLane.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {selectedLane.rows.map((r) => (
                    <tr key={r.id}>
                      <td><div className="postable__name">{r.name}</div></td>
                      {r.values.map((v, idx) => <td key={selectedLane.columns[idx + 1] ?? `c${idx}`} className="mono">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="posmuted" style={{ margin: 0 }}>{selectedLane.empty}</p>
            )}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Screened models where justified, or detailed models for risk-significant systems.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const score = ccScore(sy, c.id, stage);
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
        <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Plant stage" level={3} /></div>
        <p className="poscard__sub">SY has the heaviest pre-operational fork, since it leans most on walkdowns and operating practice.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Models rest on design information, with ten pre-operational SRs logging the gaps."],
            ["operational", "Operational", "Walkdowns and maintenance history confirm the models and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <WorkbookInput type="radio" name="sy-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
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

function toFaultTreeEditorModel(model: SystemLogicModel): FaultTreeEditorModel {
  return {
    modelId: model.uuid,
    code: model.code,
    name: model.name,
    description: model.description,
    topGate: model.topGate,
    gates: model.gates,
    leafNodes: model.leafNodes,
    gateInputs: model.gateInputs,
    nodePositions: model.nodePositions,
    layout: model.layout,
  };
}

function toFaultTreeEditorCatalogue(events: readonly SystemBasicEvent[]): FaultTreeEditorCatalogue {
  return {
    basicEvents: events.map(systemBasicEventToFaultTreeBasicEvent),
    presentations: events.map((event) => {
      const failureMode = event.failureMode ?? "";
      return {
        basicEventId: event.uuid,
        failureModeLabel: FAILURE_MODE_TYPES[failureMode]?.label ?? failureMode,
        failureModeShort: FAILURE_MODE_TYPES[failureMode]?.short ?? failureMode,
        commonCause: failureMode === "COMMON_CAUSE_FAILURE",
        repairCredited: event.repairModeled === true,
      };
    }),
  };
}

function newSystemBasicEvent(event: FaultTreeEditorCatalogue["basicEvents"][number]): SystemBasicEvent {
  return {
    uuid: event.id,
    code: event.code,
    name: event.name,
    description: event.description,
    eventType: "BASIC",
    ...(Number.isFinite(event.probability.value) ? { probability: event.probability.value } : {}),
    repairModeled: false,
    implementsSrs: [],
  };
}

function ModelsScreen({ sysId, setSysId, openDrawer }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
}): JSX.Element {
  const { sy, shortOf, editable, mutateSy, runtime } = useSyWorkbook();
  const [selection, setSelection] = useState<FaultTreeSelection>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, FaultTreeAnalysisResult>>({});
  const [runningModelId, setRunningModelId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const sysDef = sy.systemDefinitions.find((s) => s.uuid === sysId) ?? sy.systemDefinitions[0];

  useEffect(() => setSelection(null), [sysId]);

  if (sysDef === undefined) {
    return (
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="System" level={3} />
          <span className="possubtle">0 systems · SY-A1, A7, A8</span>
        </div>
        <p className="poscard__sub">No systems have been added to this workbook yet.</p>
        <div className="eswarn">
          <span>Add or import a system definition before building its fault-tree logic model.</span>
        </div>
      </div>
    );
  }

  const logic = sy.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
  const supportSystems = sy.systemDependencies.filter((d) => d.dependentSystem === sysDef.uuid).map((d) => d.supportingSystem);
  const varCrit = (sy.variableSuccessCriteria ?? []).filter((v) => v.systemReference === sysDef.uuid);
  const applicablePos = sysDef.applicablePlantOperatingStates ?? [];
  const catalogue = toFaultTreeEditorCatalogue(sy.systemBasicEvents);
  const editorModel = logic === undefined ? null : toFaultTreeEditorModel(logic);
  const editorModels = sy.systemLogicModels.map(toFaultTreeEditorModel);
  const transferTargets = sy.systemLogicModels.flatMap((candidate) =>
    candidate.topGate === null || candidate.uuid === logic?.uuid
      ? []
      : [{
          target: { modelId: candidate.uuid, entityId: candidate.topGate.gateId },
          code: candidate.code,
          name: candidate.name,
          description: candidate.description,
        }],
  );
  const validation = editorModel === null || logic?.nonDetailedModelJustification !== undefined
    ? []
    : validateFaultTreeModel(editorModel, {
        basicEventCatalogue: {
          workbookId: runtime.workbookId ?? "local-sy-workbook",
          basicEvents: catalogue.basicEvents,
        },
        availableTransferTargets: transferTargets.map(({ target }) => target),
        faultTreeModels: editorModels,
      });
  const analysisResult = logic === undefined ? null : (analysisResults[logic.uuid] ?? null);

  function createFaultTree(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      systemLogicModels: [
        ...draft.systemLogicModels,
        {
          uuid,
          code: `FT-${shortOf(sysDef.uuid)}`,
          name: `${sysDef.name} fault tree`,
          systemReference: sysDef.uuid,
          description: sysDef.description ?? sysDef.name,
          modelRepresentation: "FAULT_TREE",
          topGate: null,
          gates: [],
          leafNodes: [],
          gateInputs: [],
          nodePositions: [],
          layout: {
            viewport: { x: 0, y: 0, zoom: 1 },
            mode: "AUTOMATIC",
            direction: "TOP_TO_BOTTOM",
          },
          implementsSrs: [{ sr: "SY-A7", hlr: "A" as const }],
        },
      ],
    }));
  }

  function applyOperation(operation: FaultTreeOperation): void {
    if (!editable || logic === undefined || editorModel === null) return;
    const next = applyFaultTreeOperation(editorModel, catalogue, operation);
    mutateSy((draft) => {
      const existingEvents = new Map(draft.systemBasicEvents.map((event) => [event.uuid, event]));
      const systemBasicEvents = next.catalogue.basicEvents.map((event) => {
        const current = existingEvents.get(event.id);
        return current === undefined
          ? newSystemBasicEvent(event)
          : applyFaultTreeBasicEventToSystemBasicEvent(current, event);
      });
      const { modelId: _modelId, ...normalizedModel } = next.model;
      return {
        ...draft,
        systemBasicEvents,
        systemLogicModels: draft.systemLogicModels.map((candidate) =>
          candidate.uuid === logic.uuid ? { ...candidate, ...normalizedModel } : candidate,
        ),
      };
    });
  }

  async function runAnalysis(): Promise<void> {
    if (!editable || logic === undefined || runtime.workbookId === null || runtime.revision === null) {
      setRunError("Analysis is available after this workbook has been saved.");
      return;
    }
    setRunningModelId(logic.uuid);
    setRunError(null);
    try {
      const validated = await validateSyFaultTree(runtime.workbookId, logic.uuid, runtime.revision);
      if (!validated.validation.valid) {
        throw new Error(validated.validation.issues[0]?.message ?? "The fault tree is not ready for analysis.");
      }
      const execution = await runSyFaultTree(runtime.workbookId, logic.uuid, runtime.revision);
      if (execution.run.status === "FAILED") {
        throw new Error(execution.run.failure?.message ?? "Fault-tree analysis failed.");
      }
      if (execution.run.status !== "SUCCEEDED") {
        throw new Error(`Fault-tree analysis did not complete (status: ${execution.run.status}).`);
      }
      const result = await getSyFaultTreeResult(runtime.workbookId, logic.uuid, execution.run.id);
      setAnalysisResults((current) => ({ ...current, [logic.uuid]: result }));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Fault-tree analysis failed.");
    } finally {
      setRunningModelId(null);
    }
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="System" level={3} />
          <span className="possubtle">{sy.systemDefinitions.length} systems · SY-A1, A7, A8</span>
        </div>
        <p className="poscard__sub">Select a system to see its boundary and logic model.</p>
        <select className="posfield__select" style={{ maxWidth: 360 }} value={sysDef.uuid} onChange={(e) => setSysId(e.target.value)}>
          {sy.systemDefinitions.map((s) => (
            <option key={s.uuid} value={s.uuid}>{shortOf(s.uuid)}: {s.name}</option>
          ))}
        </select>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title={sysDef.name} cueKey="System definition" />
        </div>
        <div className="sysd">
          <div className="sysd__card">
            <div className="sysd__head"><span className="sysd__name">Top event</span></div>
            <div className="sysd__body">{sysDef.description ?? sysDef.name}</div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><span className="sysd__name">Success criterion</span></div>
            <div className="sysd__body">{sysDef.successCriterion ?? "—"}
              {varCrit.length > 0 && (
                <div className="syvsc">
                  {varCrit.map((v) => (
                    <div key={v.uuid} className="syvsc__row">
                      <span className="syvsc__when">{v.plantOperatingStateId ?? v.scenarioCondition ?? "Condition"}</span>
                      <span className="syvsc__crit">{v.basis}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><WorkbookCueLabel workbook="SY" title="Model boundary" className="sysd__name" /><span className="sysd__cap">SY-A8</span></div>
            <div className="sysd__body"><div className="syboundary__list">{sysDef.boundaries.map((b, i) => <span key={i} className="syboundary__tag">{b}</span>)}</div></div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><span className="sysd__name">Support interfaces</span></div>
            <div className="sysd__body">
              {supportSystems.length > 0
                ? <div className="syboundary__list">{supportSystems.map((id) => <span key={id} className="syboundary__tag">{shortOf(id)}</span>)}</div>
                : <span className="possubtle">None</span>}
            </div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><WorkbookCueLabel workbook="SY" title="Operating states" className="sysd__name" /><span className="sysd__cap">POS</span></div>
            <div className="sysd__body">
              {applicablePos.length > 0
                ? <div className="syboundary__list">{applicablePos.map((pid) => <span key={pid} className="syboundary__tag">{pid}</span>)}</div>
                : <span className="possubtle">All states</span>}
            </div>
          </div>
        </div>
        {logic?.nonDetailedModelJustification !== undefined && (
          <div className="eswarn" style={{ marginTop: 12 }}><span>System-level model (SY-A9). {logic.nonDetailedModelJustification}</span></div>
        )}
      </div>

      {logic !== undefined && editorModel !== null && logic.nonDetailedModelJustification === undefined ? (
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="SY" title={<>Logic model · {shortOf(sysDef.uuid)}</>} cueKey="Fault-tree logic model" />
            <SYProvenanceChip>SY-A7 · SY-A14</SYProvenanceChip>
          </div>
          <p className="poscard__sub">The fault tree is a common representation of the system logic model, and other representations could be used. Select a basic event to edit its definition.</p>
          {runError !== null && <div className="eswarn" role="alert"><span>{runError}</span></div>}
          <FaultTreeEditor
            model={editorModel}
            catalogue={catalogue}
            capabilities={{
              mode: editable ? "AUTHOR" : "READ_ONLY",
              canEditBasicEvents: editable,
              canEditLayout: editable,
              canImport: editable,
              canExport: true,
              canRunAnalysis: editable && runtime.workbookId !== null && runningModelId !== logic.uuid,
            }}
            selection={selection}
            validation={validation}
            saveState={runtime.saveStatus}
            analysisResult={analysisResult}
            resultIsStale={analysisResult !== null && (runtime.saveStatus !== "saved" || analysisResult.owner.workbookRevision !== runtime.revision)}
            transferTargets={transferTargets}
            onOperation={applyOperation}
            onSelectionChange={setSelection}
            onOpenReference={(request) => {
              if (request.kind === "BASIC_EVENT") {
                openDrawer({ kind: "be", id: request.basicEventId });
                return;
              }
              const target = sy.systemLogicModels.find((candidate) => candidate.uuid === request.target.modelId);
              if (target !== undefined) setSysId(target.systemReference);
            }}
            onRun={() => { void runAnalysis(); }}
          />
        </div>
      ) : logic?.nonDetailedModelJustification !== undefined ? (
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title={<>Logic model · {shortOf(sysDef.uuid)}</>} cueKey="System-level logic model" /></div>
          <div className="eswarn">
            <span>This system is modeled at the system level; a decomposed fault tree is not required. {logic.nonDetailedModelJustification}</span>
          </div>
        </div>
      ) : (
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title={<>Logic model · {shortOf(sysDef.uuid)}</>} cueKey="Fault-tree logic model" /></div>
          <div className="eswarn">
            <span>No decomposed fault tree has been created for this system.</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={createFaultTree}>Create fault tree</button>}
          </div>
        </div>
      )}
    </>
  );
}

function FailuresScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  function addUnavailability(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      simultaneousUnavailabilityEvents: [...(draft.simultaneousUnavailabilityEvents ?? []), {
        uuid, description: "", componentIds: [], plannedActivityBasis: "", implementsSrs: [{ sr: "SY-A27", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "unavail", id: uuid });
  }
  function addHfe(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      humanFailureEventIntegrations: [...draft.humanFailureEventIntegrations, {
        uuid, hfeReference: "", system: draft.systemDefinitions[0]?.uuid ?? "", taskDescription: "", hfeType: "PRE_INITIATOR" as const, isTestMaintenance: false, implementsSrs: [{ sr: "SY-A21", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "hfe", id: uuid });
  }
  function addScreening(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      componentScreeningJustifications: [...(draft.componentScreeningJustifications ?? []), {
        uuid, systemReference: draft.systemDefinitions[0]?.uuid ?? "", componentId: "", screeningCriterion: "a" as const, quantitativeJustification: "", implementsSrs: [{ sr: "SY-A20", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "screening", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Exclusions and diversion paths" level={3} />
          <span className="possubtle">SY-A16, A17, A18</span>
        </div>
        <p className="poscard__sub">The included failure modes are the fault trees in step 02. This table records what each model deliberately leaves out and which diversion paths it models. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>System</th><th>Left out</th><th>Diversion path</th></tr></thead>
          <tbody>
            {sy.systemDefinitions.map((def) => (
              <tr key={def.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "exclusion", id: def.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{shortOf(def.uuid)}</td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{(def.justificationForExclusionOfComponents ?? []).join(" ")}</td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{def.flowDiversionConsiderations?.[0] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Screening" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A20</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addScreening}><SYIcon.Plus /> Add component</button>}
          </div>
        </div>
        <p className="poscard__sub">Unlike success criteria, SY allows screening, but only against stated criteria. Click a row to edit it.</p>
        <div className="syscreen__crit">
          {SCREENING_CRITERIA.map((c) => (
            <div key={c.code} className="syscreen__crit-item">
              <span className="syscreen__crit-code">{c.code}</span>
              <span className="syscreen__crit-label">{c.label}</span>
            </div>
          ))}
        </div>
        <table className="postable" style={{ marginTop: 12 }}>
          <thead><tr><th>Component</th><th>System</th><th>Justification</th><th>Criterion</th></tr></thead>
          <tbody>
            {(sy.componentScreeningJustifications ?? []).map((c) => {
              return (
                <tr key={c.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "screening", id: c.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{c.componentId}</td>
                  <td>{shortOf(c.systemReference)}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{c.quantitativeJustification}</td>
                  <td><span className="syscreen__pill">Criterion {c.screeningCriterion}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Simultaneous unavailability" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">SY-A27</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addUnavailability}><SYIcon.Plus /> Add record</button>}
          </div>
        </div>
        <p className="poscard__sub">Single-train test and maintenance lives in the fault trees as unavailability events. This table records redundant equipment planned out of service at the same time. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Planned activity</th><th>Components</th><th>DA parameter</th></tr></thead>
          <tbody>
            {(sy.simultaneousUnavailabilityEvents ?? []).map((u) => (
              <tr key={u.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "unavail", id: u.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{u.description}</td>
                <td><div className="posrow posrow--wrap" style={{ gap: 5 }}>{u.componentIds.map((c) => <span key={c} className="poschip">{c}</span>)}</div></td>
                <td className="posmono" style={{ fontSize: 11 }}>{u.dataAnalysisRef ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Human failure events placed in the models" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A21 · SY-A23</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addHfe}><SYIcon.Plus /> Add event</button>}
          </div>
        </div>
        <p className="poscard__sub">SY places the event in the model and hands it to Human Reliability to quantify. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Task</th><th>System</th><th>Type</th><th>HR reference</th></tr></thead>
          <tbody>
            {sy.humanFailureEventIntegrations.map((h) => {
              return (
                <tr key={h.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "hfe", id: h.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{h.taskDescription}</td>
                  <td>{shortOf(h.system)}</td>
                  <td>{h.hfeType === "PRE_INITIATOR" ? <Badge kind="warn">Pre-initiator</Badge> : <Badge kind="progress">Post-initiator</Badge>}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{h.hfeReference}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CcfScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const groups = sy.commonCauseFailureGroups;
  const intra = groups.filter((g) => g.scope === "INTRASYSTEM");
  const inter = groups.filter((g) => g.scope === "INTERSYSTEM");
  function addGroup(scope: "INTRASYSTEM" | "INTERSYSTEM"): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      commonCauseFailureGroups: [...draft.commonCauseFailureGroups, {
        uuid, name: "", description: "", scope, affectedComponents: [], affectedSystems: [draft.systemDefinitions[0]?.uuid ?? ""], modelType: "BETA_FACTOR",
        modelSpecificParameters: { betaFactorParameters: { beta: 0.05, totalFailureProbability: 0 } },
        members: { basicEvents: [] }, sharedCauseFactors: {}, implementsSrs: [{ sr: scope === "INTRASYSTEM" ? "SY-B1" : "SY-B2", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "ccf", id: uuid });
  }
  function GroupCard({ g }: { g: (typeof groups)[number] }): JSX.Element {
    const model = CCF_MODELS[g.modelType];
    const par = ccfParams(g);
    const affects = g.affectedSystems.filter((a) => a !== g.affectedSystems[0]);
    return (
      <div className="syccf__card" onClick={() => openDrawer({ kind: "ccf", id: g.uuid })}>
        <div className="syccf__head">
          <div className="syccf__head-main">
            <div className="syccf__name">{g.name.length > 0 ? g.name : "New group"}</div>
            <div className="syccf__scope">{g.scope === "INTRASYSTEM" ? "Within one system" : "Across systems"} · {model?.label ?? g.modelType}{par === null ? "" : ` · ${par.short}`}</div>
          </div>
        </div>
        <div className="syccf__members">
          {g.affectedComponents.map((m) => <span key={m} className="syccf__member">{m}</span>)}
        </div>
        <div className="syccf__basis">{g.description}</div>
        <div className="syccf__foot">
          <span className="syccf__da">{g.dataAnalysisCCFParameterRef ?? "—"}</span>
          {affects.length > 0 && <span className="syccf__affects">Couples {affects.map((a) => shortOf(a)).join(", ")}</span>}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Within a system" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B1</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addGroup("INTRASYSTEM")}><SYIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">Redundant trains in one system that share a make, a crew or a room. Click a group to edit it.</p>
        <div className="syccf">{intra.map((g) => <GroupCard key={g.uuid} g={g} />)}</div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Across systems" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B2</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addGroup("INTERSYSTEM")}><SYIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">Shared parts and a shared software image that couple more than one system at once. Click a group to edit it.</p>
        <div className="syccf">{inter.map((g) => <GroupCard key={g.uuid} g={g} />)}</div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Consistency with the models and Data Analysis" level={3} />
          <SYProvenanceChip>SY-B4</SYProvenanceChip>
        </div>
        <p className="poscard__sub">Each group probability derives from its parameters and must match the common cause event in the logic model.</p>
        <table className="postable">
          <thead><tr><th>Group</th><th>Parameters</th><th>Group probability</th><th>Model event</th><th>DA parameter</th><th>Status</th></tr></thead>
          <tbody>
            {groups.map((g) => {
              const par = ccfParams(g);
              const check = ccfModelCheck(g, sy);
              return (
                <tr key={g.uuid}>
                  <td style={{ fontWeight: 600 }}>{g.name.length > 0 ? g.name : "New group"}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{par === null ? "—" : par.detail}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{check.expected === null ? "—" : toExp(check.expected)}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{check.eventId ?? "—"}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{g.dataAnalysisCCFParameterRef ?? "—"}</td>
                  <td><span className="sylight"><span className={`sylight__dot sylight__dot--${check.ok ? "s" : "f"}`} /> {check.ok ? "Consistent" : "Inconsistent"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export { ScopeScreen, ModelsScreen, FailuresScreen, CcfScreen, type SyDrawerContext };
