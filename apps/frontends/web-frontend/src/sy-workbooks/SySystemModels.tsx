import { JSX, useEffect, useId, useRef, useState } from "react";
import type { SystemBasicEvent, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { failureRateToProbability, requiresFailureRateConversionReview } from "interfaces-mef-types/modeling";
import {
  applyFaultTreeBasicEventToSystemBasicEvent,
  systemBasicEventToFaultTreeBasicEvent,
  systemLogicModelBasicEvents,
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
import { useAnalysisSourceGuard } from "../newly-developed-methods/shared/useAnalysisSourceGuard";
import { AnalysisRunHistory } from "../newly-developed-methods/shared/analysisRunHistory";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { SyFaultTreeAnalysis, type FaultTreeRunConfiguration } from "./SyFaultTreeAnalysis";
import { SyCapabilityRepresentation } from "./SyCapabilityRepresentation";
import { SyPreOperationalAssumptions } from "./SyPreOperationalAssumptions";
import { SySystemDescription } from "./SySystemDescription";
import { SyBasicEvents } from "./SyBasicEvents";
import { FAILURE_MODE_TYPES } from "./syViewData";
import {
  useSyWorkbook,
  type SyControlledHumanFailureOption,
  type SyControlledParameterOption,
} from "./syWorkbookContext";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "./syWorkbookApi";
import { isSystemLevelModel } from "./sySelectors";
import type { SyDrawerContext } from "./syScreens";
import { SyFaultTreeDiagrams } from "./SyFaultTreeDiagrams";
import "./css/syModels.css";

type ModelTab = "description" | "fault-tree" | "basic-events" | "quantification" | "assumptions";

const MODEL_TABS: { id: ModelTab; label: string }[] = [
  { id: "description", label: "Description" },
  { id: "fault-tree", label: "Fault tree" },
  { id: "basic-events", label: "Basic events" },
  { id: "quantification", label: "Quantification" },
  { id: "assumptions", label: "Assumptions" },
];

const DEFAULT_MISSION_TIME_HOURS = 24;

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

function toFaultTreeEditorCatalogue(
  events: readonly SystemBasicEvent[],
  controlledParameters: readonly SyControlledParameterOption[] = [],
  controlledHumanFailures: readonly SyControlledHumanFailureOption[] = [],
): FaultTreeEditorCatalogue {
  const controlledParameterValues = new Map(
    controlledParameters.map((parameter) => [
      JSON.stringify([parameter.workbookId, parameter.parameterId]),
      parameter,
    ]),
  );
  const controlledHumanFailureValues = new Map(
    controlledHumanFailures.map((humanFailure) => [
      JSON.stringify([
        humanFailure.workbookId,
        humanFailure.humanFailureEventId,
        humanFailure.quantificationId,
      ]),
      humanFailure.value,
    ]),
  );
  return {
    basicEvents: events.map((event) => {
      const projected = systemBasicEventToFaultTreeBasicEvent(event);
      if (event.controlledDataSource === undefined || requiresFailureRateConversionReview(event.quantificationBasis)) return projected;
      const controlledParameter = event.controlledDataSource.referenceType === "WORKBOOK_PARAMETER"
        ? controlledParameterValues.get(JSON.stringify([
            event.controlledDataSource.workbookId,
            event.controlledDataSource.entityId,
          ]))
        : undefined;
      const controlledHumanFailureValue = event.controlledDataSource.referenceType === "HUMAN_FAILURE_EVENT"
        ? controlledHumanFailureValues.get(JSON.stringify([
            event.controlledDataSource.workbookId,
            event.controlledDataSource.entityId,
            event.controlledDataSource.quantificationId,
          ]))
        : undefined;
      const basis = projected.probability.quantificationBasis;
      if (controlledParameter !== undefined && basis?.kind === "FAILURE_RATE" && controlledParameter.parameterType === "FREQUENCY") {
        const resolvedBasis = { ...basis, failureRate: { ...basis.failureRate, value: controlledParameter.value } };
        return { ...projected, probability: { ...projected.probability, value: failureRateToProbability(resolvedBasis), quantificationBasis: resolvedBasis } };
      }
      if (controlledParameter !== undefined && basis?.kind !== "FAILURE_RATE" && controlledParameter.parameterType !== "FREQUENCY") {
        return { ...projected, probability: { ...projected.probability, value: controlledParameter.value } };
      }
      return controlledHumanFailureValue === undefined || basis?.kind === "FAILURE_RATE"
        ? projected
        : { ...projected, probability: { ...projected.probability, value: controlledHumanFailureValue } };
    }),
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
    ...(event.probability.controlledDataSource?.referenceType === "HUMAN_FAILURE_EVENT"
      ? { failureMode: "HUMAN_ERROR" }
      : {}),
    ...(Number.isFinite(event.probability.value) ? { probability: event.probability.value } : {}),
    ...(event.probability.quantificationBasis === undefined
      ? {}
      : { quantificationBasis: structuredClone(event.probability.quantificationBasis) }),
    ...(event.probability.controlledDataSource === undefined
      ? {}
      : { controlledDataSource: { ...event.probability.controlledDataSource } }),
    repairModeled: false,
    implementsSrs: [],
  };
}

function syFaultTreeOperation(
  logic: SystemLogicModel,
  catalogue: FaultTreeEditorCatalogue,
  operation: FaultTreeOperation,
): (draft: SystemsAnalysis) => SystemsAnalysis {
  const next = applyFaultTreeOperation(toFaultTreeEditorModel(logic), catalogue, operation);
  return (draft) => {
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
  };
}

function ModelsScreen({ sysId, setSysId, openDrawer, onOpenScope }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenScope?: () => void;
}): JSX.Element {
  const {
    sy,
    shortOf,
    editable,
    mutateSy,
    runtime,
    controlledParameters,
    controlledHumanFailures,
  } = useSyWorkbook();
  const { sourceWarning } = useAnalysisSourceGuard("sy", runtime.workbookId);
  const [tab, setTab] = useState<ModelTab>("description");
  const [selection, setSelection] = useState<FaultTreeSelection>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, FaultTreeAnalysisResult>>({});
  const [batchAnalysisResults, setBatchAnalysisResults] = useState<FaultTreeAnalysisResult[]>([]);
  const [runningModelId, setRunningModelId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const tablist = useRef<HTMLDivElement>(null);
  const id = useId();
  const sysDef = sy.systemDefinitions.find((s) => s.uuid === sysId) ?? sy.systemDefinitions[0];

  useEffect(() => setSelection(null), [sysId]);

  if (sysDef === undefined) {
    return (
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="System models" level={3} />
          <span className="possubtle">0 systems</span>
        </div>
        <p className="posmuted">No systems are in scope yet. Add the systems to model in Step 01, then describe and build each one here.</p>
        {onOpenScope !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary sy-model-card__scope" onClick={onOpenScope}>Go to Scope</button>}
      </div>
    );
  }

  const system = sysDef;
  const missionTimeHours = system.missionTimeHours ?? DEFAULT_MISSION_TIME_HOURS;
  const logic = sy.systemLogicModels.find((m) => m.systemReference === system.uuid);
  const systemLevel = logic !== undefined && isSystemLevelModel(logic);
  const catalogue = toFaultTreeEditorCatalogue(
    sy.systemBasicEvents,
    controlledParameters,
    controlledHumanFailures,
  );
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
  const validation = editorModel === null || systemLevel
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
  const resultIsStale = analysisResult !== null && (sourceWarning !== null || runtime.saveStatus !== "saved" || analysisResult.owner.workbookRevision !== runtime.revision);
  const eventCount = logic === undefined || systemLevel ? 0 : systemLogicModelBasicEvents(sy, logic).length;

  function createFaultTree(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      systemLogicModels: [
        ...draft.systemLogicModels,
        {
          uuid,
          code: `FT-${shortOf(system.uuid)}`,
          name: `${system.name} fault tree`,
          systemReference: system.uuid,
          description: system.description ?? system.name,
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
    if (!editable || logic === undefined) return;
    mutateSy(syFaultTreeOperation(logic, catalogue, operation));
  }

  async function runAnalysis(configuration: FaultTreeRunConfiguration, modelIds: string[]): Promise<void> {
    if (!editable || logic === undefined || runtime.workbookId === null || runtime.revision === null) {
      setRunError("Analysis is available after this workbook has been saved.");
      return;
    }
    setRunningModelId(configuration.workflow === "BATCH" ? "BATCH" : logic.uuid);
    setRunError(null);
    setBatchAnalysisResults([]);
    try {
      const completed: FaultTreeAnalysisResult[] = [];
      const failures: string[] = [];
      for (const modelId of modelIds) {
        try {
          const validated = await validateSyFaultTree(runtime.workbookId, modelId, runtime.revision);
          if (!validated.validation.valid) {
            throw new Error(validated.validation.issues[0]?.message ?? "The fault tree is not ready for analysis.");
          }
          const execution = await runSyFaultTree(runtime.workbookId, modelId, runtime.revision, configuration);
          if (execution.run.status === "FAILED") {
            throw new Error(execution.run.failure?.message ?? "Fault-tree analysis failed.");
          }
          if (execution.run.status !== "SUCCEEDED") {
            throw new Error(`Fault-tree analysis did not complete (status: ${execution.run.status}).`);
          }
          const result = await getSyFaultTreeResult(runtime.workbookId, modelId, execution.run.id);
          completed.push(result);
          setAnalysisResults((current) => ({ ...current, [modelId]: result }));
        } catch (error) {
          const label = sy.systemLogicModels.find((candidate) => candidate.uuid === modelId)?.code ?? modelId;
          failures.push(`${label}: ${error instanceof Error ? error.message : "Fault-tree analysis failed."}`);
          if (configuration.workflow === "MANUAL") throw error;
        }
      }
      setBatchAnalysisResults(configuration.workflow === "BATCH" ? completed : []);
      if (failures.length > 0) throw new Error(failures.join(" "));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Fault-tree analysis failed.");
    } finally {
      setRunningModelId(null);
    }
  }

  function renderNoFaultTree(): JSX.Element {
    if (systemLevel) {
      return (
        <div className="sy-model-note">
          <p>This system uses a system-level model, so it has no fault tree. {logic?.nonDetailedModelJustification}</p>
          {onOpenScope !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenScope}>Change model depth in Scope</button>}
        </div>
      );
    }
    return (
      <div className="sy-model-note">
        <p>This system has no fault tree yet.</p>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={createFaultTree}>Create fault tree</button>}
      </div>
    );
  }

  function renderPanel(): JSX.Element {
    switch (tab) {
      case "description":
        return <SySystemDescription systemId={system.uuid} openDrawer={openDrawer} />;
      case "fault-tree":
        if (logic === undefined || editorModel === null || systemLevel) return renderNoFaultTree();
        return (
          <SyFaultTreeDiagrams
            systemId={system.uuid}
            onAddDiagram={editable ? () => openDrawer({ kind: "diagram", id: system.uuid }) : undefined}
            onEditDiagram={editable ? (diagramId) => openDrawer({ kind: "diagram", id: system.uuid, diagramId }) : undefined}
          >
            <FaultTreeEditor
              model={editorModel}
              catalogue={catalogue}
              capabilities={{
                mode: editable ? "AUTHOR" : "READ_ONLY",
                canEditBasicEvents: editable,
                canEditLayout: editable,
                canImport: editable,
                canExport: true,
                canRunAnalysis: false,
              }}
              selection={selection}
              validation={validation}
              saveState={runtime.saveStatus}
              analysisResult={analysisResult}
              showResults={false}
              showHeaderStatus={false}
              resultIsStale={resultIsStale}
              transferTargets={transferTargets}
              defaultMissionTime={{ value: missionTimeHours, unit: "HOUR" }}
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
              onRun={() => undefined}
            />
          </SyFaultTreeDiagrams>
        );
      case "basic-events":
        if (logic === undefined || systemLevel) return renderNoFaultTree();
        return <SyBasicEvents logic={logic} openDrawer={openDrawer} />;
      case "quantification":
        if (logic === undefined || systemLevel) return renderNoFaultTree();
        if (logic.topGate === null) {
          return <div className="sy-model-note"><p>Set the top gate in the Fault tree tab before quantifying this system.</p></div>;
        }
        return (
          <div className="sy-model-quant">
            <SyFaultTreeAnalysis
              key={logic.uuid}
              exactResult={analysisResult}
              batchResults={batchAnalysisResults}
              exactResultIsStale={resultIsStale}
              exactRunError={runError}
              exactRunning={runningModelId === logic.uuid}
              sourceWarning={sourceWarning}
              currentModelId={logic.uuid}
              defaultMissionTimeHours={missionTimeHours}
              basicEventCodes={Object.fromEntries(catalogue.basicEvents.map((event) => [event.id, event.code]))}
              models={sy.systemLogicModels.flatMap((candidate) =>
                candidate.topGate === null || isSystemLevelModel(candidate)
                  ? []
                  : [{ id: candidate.uuid, label: `${candidate.code} · ${candidate.name}` }],
              )}
              onRun={(configuration, modelIds) => { void runAnalysis(configuration, modelIds); }}
            />
            <AnalysisRunHistory host="sy" workbookId={runtime.workbookId} modelId={logic.uuid} />
          </div>
        );
      case "assumptions":
        return (
          <div className="sy-review">
            <SyCapabilityRepresentation systemId={system.uuid} openDrawer={openDrawer} />
            <SyPreOperationalAssumptions systemId={system.uuid} openDrawer={openDrawer} />
          </div>
        );
    }
  }

  return (
    <div className="poscard sy-model-card">
      <div className="poscard__head sy-model-card__head">
        <WorkbookSectionHeading workbook="SY" title={system.name} cueKey="System definition" level={3} />
        <label className="sy-model-card__picker">
          <span className="posfield__label">System</span>
          <select className="posfield__select" aria-label="System" value={system.uuid} onChange={(event) => setSysId(event.target.value)}>
            {sy.systemDefinitions.map((s) => (
              <option key={s.uuid} value={s.uuid}>{shortOf(s.uuid)} · {s.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="sy-tabs"
        role="tablist"
        aria-label="System model sections"
        ref={tablist}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const current = MODEL_TABS.findIndex((item) => item.id === tab);
          const next = event.key === "Home" ? 0 : event.key === "End" ? MODEL_TABS.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + MODEL_TABS.length) % MODEL_TABS.length;
          const target = MODEL_TABS[next];
          if (target === undefined) return;
          setTab(target.id);
          tablist.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
        }}
      >
        {MODEL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${id}-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "basic-events" && eventCount > 0 && <span className="sy-tabs__count">{eventCount}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="sy-model-card__panel">
        {renderPanel()}
      </div>
    </div>
  );
}

export { ModelsScreen, syFaultTreeOperation, toFaultTreeEditorCatalogue };
