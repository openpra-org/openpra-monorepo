import { JSX, useEffect, useId, useRef, useState } from "react";
import { carriesUncertainExpression, type SystemBasicEvent, type SystemLogicModel, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { failureRateToProbability, requiresFailureRateConversionReview, type QuantificationTimeUnit } from "interfaces-mef-types/modeling";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
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
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { AnalysisRunHistory } from "../newly-developed-methods/shared/analysisRunHistory";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { NoSystemsCard } from "./syShared";
import { SyFaultTreeAnalysis, type FaultTreeRunConfiguration } from "./SyFaultTreeAnalysis";
import { SyCapabilityRepresentation } from "./SyCapabilityRepresentation";
import { SyPreOperationalAssumptions } from "./SyPreOperationalAssumptions";
import { SySystemDescription } from "./SySystemDescription";
import { SyBasicEvents } from "./SyBasicEvents";
import { FAILURE_MODE_TYPES } from "./syViewData";
import {
  useSyWorkbook,
  type SyControlledHumanFailureOption,
  type SyControlledLegacyParameterOption,
} from "./syWorkbookContext";
import { asComponentEvent, editorOptions, useEventPoints, withoutStoredValue, type PointState } from "./syBasicEventValues";
import { useSyValueSources, useSystemHours } from "./syMissionTimes";
import { toExp } from "./syViewData";
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

interface CatalogueSources {
  legacyParameters?: readonly SyControlledLegacyParameterOption[];
  humanFailures?: readonly SyControlledHumanFailureOption[];
  points?: ReadonlyMap<string, PointState>;
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

function componentProjection(event: SystemBasicEvent, points: ReadonlyMap<string, PointState> | undefined): FaultTreeEditorCatalogue["basicEvents"][number] {
  const projected = systemBasicEventToFaultTreeBasicEvent(withoutStoredValue(event));
  const state = points?.get(event.uuid);
  const expression = projected.probability.expression;
  return { ...projected, probability: { value: state?.status === "ready" ? state.value.point : Number.NaN, ...(expression === undefined ? {} : { expression }) } };
}

function toFaultTreeEditorCatalogue(
  events: readonly SystemBasicEvent[],
  { legacyParameters = [], humanFailures = [], points }: CatalogueSources = {},
): FaultTreeEditorCatalogue {
  const controlledParameterValues = new Map(
    legacyParameters.map((parameter) => [
      JSON.stringify([parameter.workbookId, parameter.parameterId]),
      parameter,
    ]),
  );
  const controlledHumanFailureValues = new Map(
    humanFailures.map((humanFailure) => [
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
      if (carriesUncertainExpression(event.failureMode)) return componentProjection(event, points);
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
      if (controlledParameter !== undefined && basis?.kind === "FAILURE_RATE" && controlledParameter.rateUnit !== undefined) {
        const resolvedBasis = { ...basis, failureRate: { value: controlledParameter.value, unit: controlledParameter.rateUnit } };
        return { ...projected, probability: { ...projected.probability, value: failureRateToProbability(resolvedBasis), quantificationBasis: resolvedBasis } };
      }
      if (controlledParameter !== undefined && basis?.kind !== "FAILURE_RATE" && controlledParameter.rateUnit === undefined) {
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

function newSystemBasicEvent(event: FaultTreeEditorCatalogue["basicEvents"][number], missionTime: UncertainExpression | undefined): SystemBasicEvent {
  const created: SystemBasicEvent = {
    uuid: event.id,
    code: event.code,
    name: event.name,
    description: event.description,
    eventType: "BASIC",
    ...(event.probability.controlledDataSource?.referenceType === "HUMAN_FAILURE_EVENT"
      ? { failureMode: "HUMAN_ERROR" }
      : {}),
    ...(Number.isFinite(event.probability.value) ? { probability: event.probability.value } : {}),
    ...(event.probability.expression === undefined ? {} : { expression: structuredClone(event.probability.expression) }),
    ...(event.probability.quantificationBasis === undefined
      ? {}
      : { quantificationBasis: structuredClone(event.probability.quantificationBasis) }),
    ...(event.probability.controlledDataSource === undefined
      ? {}
      : { controlledDataSource: { ...event.probability.controlledDataSource } }),
    repairModeled: false,
    implementsSrs: [],
  };
  return carriesUncertainExpression(created.failureMode) ? asComponentEvent(created, missionTime) : created;
}

const TIME_UNIT_WORDS: Record<QuantificationTimeUnit, { one: string; many: string }> = {
  SECOND: { one: "second", many: "seconds" },
  MINUTE: { one: "minute", many: "minutes" },
  HOUR: { one: "hour", many: "hours" },
  DAY: { one: "day", many: "days" },
  YEAR: { one: "year", many: "years" },
};

function legacyValueText(event: FaultTreeEditorCatalogue["basicEvents"][number]): string {
  const basis = event.probability.quantificationBasis;
  if (basis?.kind === "FAILURE_RATE") {
    return `Rate ${toExp(basis.failureRate.value)} per ${TIME_UNIT_WORDS[basis.failureRate.unit].one} over ${basis.missionTime.value} ${TIME_UNIT_WORDS[basis.missionTime.unit].many}`;
  }
  return Number.isFinite(event.probability.value) ? `Probability ${toExp(event.probability.value)}` : "No value yet";
}

function readOnlyValues(events: readonly SystemBasicEvent[], catalogue: FaultTreeEditorCatalogue, label: (key: string) => string): Record<string, string> {
  const projected = new Map(catalogue.basicEvents.map((event) => [event.id, event]));
  return Object.fromEntries(events.map((event) => {
    if (carriesUncertainExpression(event.failureMode)) return [event.uuid, event.expression === undefined ? "No value yet" : expressionText(event.expression, label)];
    const shown = projected.get(event.uuid);
    return [event.uuid, shown === undefined ? "No value yet" : legacyValueText(shown)];
  }));
}

function componentValueIssues(issues: readonly ValidationIssue[], events: readonly SystemBasicEvent[], points: ReadonlyMap<string, PointState>): ValidationIssue[] {
  const byId = new Map(events.map((event) => [event.uuid, event]));
  return issues.flatMap((issue): ValidationIssue[] => {
    const event = issue.entityId === undefined ? undefined : byId.get(issue.entityId);
    if (issue.code !== "FT_BASIC_EVENT_PROBABILITY_INVALID" || event === undefined || !carriesUncertainExpression(event.failureMode)) return [issue];
    if (event.expression === undefined) return [{ ...issue, message: `${event.code} has no value yet. Set it in the Basic events tab.` }];
    const state = points.get(event.uuid);
    if (state?.status === "failed") return [{ ...issue, message: `${event.code}: ${state.error}` }];
    return state?.status === "ready" ? [issue] : [];
  });
}

function syFaultTreeOperation(
  logic: SystemLogicModel,
  catalogue: FaultTreeEditorCatalogue,
  operation: FaultTreeOperation,
): (draft: SystemsAnalysis) => SystemsAnalysis {
  const next = applyFaultTreeOperation(toFaultTreeEditorModel(logic), catalogue, operation);
  return (draft) => {
    const existingEvents = new Map(draft.systemBasicEvents.map((event) => [event.uuid, event]));
    const missionTime = draft.systemDefinitions.find((system) => system.uuid === logic.systemReference)?.missionTime;
    const systemBasicEvents = next.catalogue.basicEvents.map((event) => {
      const current = existingEvents.get(event.id);
      if (current === undefined) return newSystemBasicEvent(event, missionTime);
      const applied = applyFaultTreeBasicEventToSystemBasicEvent(current, event);
      return carriesUncertainExpression(current.failureMode) ? withoutStoredValue(applied) : applied;
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

function ModelsScreen({ sysId, setSysId, openDrawer, onOpenSystems }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
  onOpenSystems?: () => void;
}): JSX.Element {
  const {
    sy,
    shortOf,
    editable,
    mutateSy,
    runtime,
    controlledParameters,
    controlledLegacyParameters,
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
  const shownLogic = sysDef === undefined ? undefined : sy.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
  const values = useSyValueSources();
  const points = useEventPoints(shownLogic === undefined || isSystemLevelModel(shownLogic) ? [] : systemLogicModelBasicEvents(sy, shownLogic), values.table);
  const missionHours = useSystemHours(sysDef === undefined ? [] : [sysDef]).get(sysDef?.uuid ?? "");

  useEffect(() => setSelection(null), [sysId]);

  if (sysDef === undefined) {
    return <NoSystemsCard title="System models" purpose="describe and build each one here." onOpenSystems={onOpenSystems} />;
  }

  const system = sysDef;
  const logic = sy.systemLogicModels.find((m) => m.systemReference === system.uuid);
  const systemLevel = logic !== undefined && isSystemLevelModel(logic);
  const catalogue = toFaultTreeEditorCatalogue(sy.systemBasicEvents, {
    legacyParameters: controlledLegacyParameters,
    humanFailures: controlledHumanFailures,
    points,
  });
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
    : componentValueIssues(validateFaultTreeModel(editorModel, {
        basicEventCatalogue: {
          workbookId: runtime.workbookId ?? "local-sy-workbook",
          basicEvents: catalogue.basicEvents,
        },
        availableTransferTargets: transferTargets.map(({ target }) => target),
        faultTreeModels: editorModels,
      }), sy.systemBasicEvents, points);
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
          {onOpenSystems !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenSystems}>Change model depth in Systems in scope</button>}
        </div>
      );
    }
    return (
      <div className="sy-model-note">
        <p>This system has no fault tree yet. Create it here, then right-click a gate to add its inputs.</p>
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
          <>
          {editable && <p className="poscard__sub">Right-click a gate to add gates, basic events, house events or transfers. Give each basic event a value in the Basic events tab. Type it, or link a DA estimate after linking a DA workbook in Step 01.</p>}
          <SyFaultTreeDiagrams
            systemId={system.uuid}
            onAddDiagram={editable ? () => openDrawer({ kind: "diagram", id: system.uuid }) : undefined}
            onEditDiagram={editable ? (diagramId) => openDrawer({ kind: "diagram", id: system.uuid, diagramId }) : undefined}
          >
            <FaultTreeEditor
              model={editorModel}
              catalogue={catalogue}
              readOnlyBasicEventValues={readOnlyValues(sy.systemBasicEvents, catalogue, values.label)}
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
              defaultMissionTime={system.missionTime}
              daParameterOptions={editorOptions(controlledParameters)}
              missionTimeOptions={values.missionTimeOptions}
              parameterTable={values.table}
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
          </>
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
              missionHours={missionHours}
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
