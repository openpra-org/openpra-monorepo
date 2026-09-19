import { JSX, useEffect, useMemo, useState } from "react";
import type { FaultTreeTopEventReference, MethodEntityReference } from "interfaces-mef-types/modeling";
import type { SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { systemBasicEventToFaultTreeBasicEvent } from "interfaces-mef-types/sy/system-models";
import { validateFaultTreeModel } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import {
  FaultTreeEditor,
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
  type FaultTreeSelection,
} from "../newly-developed-methods/fault-tree";
import { getSyWorkbook, type SyWorkbookResponse } from "../sy-workbooks/syWorkbookApi";
import { listWorkbooks } from "../workbooks/workbookApi";
import { ESIcon } from "./esIcons";
import type { EsFaultTreeSource } from "./esWorkbookContext";
import "./css/esLinkModal.css";

interface EsFaultTreeReferencePickerProps {
  projectId?: string;
  embeddedSource?: EsFaultTreeSource;
  functionalEventName: string;
  currentReference?: FaultTreeTopEventReference;
  onClose: () => void;
  onConfirm: (reference: FaultTreeTopEventReference) => void;
}

const REFERENCE_SELECTION_CAPABILITIES = {
  mode: "REFERENCE_SELECTION" as const,
  canEditBasicEvents: false,
  canEditLayout: false,
  canImport: false,
  canExport: false,
  canRunAnalysis: false,
};

function toEditorModel(model: SystemLogicModel): FaultTreeEditorModel {
  const minX = model.nodePositions.length === 0 ? 0 : Math.min(...model.nodePositions.map(({ position }) => position.x));
  const minY = model.nodePositions.length === 0 ? 0 : Math.min(...model.nodePositions.map(({ position }) => position.y));
  return {
    modelId: model.uuid,
    code: model.code,
    name: model.name,
    description: model.description,
    topGate: model.topGate,
    gates: model.gates,
    leafNodes: model.leafNodes,
    gateInputs: model.gateInputs,
    nodePositions: model.nodePositions.map(({ nodeId, position }) => ({
      nodeId,
      position: { x: position.x - minX + 24, y: position.y - minY + 24 },
    })),
    layout: { ...model.layout, viewport: { x: 0, y: 0, zoom: 1 } },
  };
}

function EsFaultTreeReferencePicker({
  projectId,
  embeddedSource,
  functionalEventName,
  currentReference,
  onClose,
  onConfirm,
}: EsFaultTreeReferencePickerProps): JSX.Element {
  const [workbooks, setWorkbooks] = useState<Array<{ id: string; name: string }> | null>(null);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const [source, setSource] = useState<Pick<SyWorkbookResponse, "workbookId" | "mef"> | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [selection, setSelection] = useState<FaultTreeSelection>(null);
  const [selectedTarget, setSelectedTarget] = useState<MethodEntityReference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWorkbooks(null);
    setError(null);
    if (embeddedSource !== undefined) {
      setWorkbooks([{ id: embeddedSource.workbookId, name: embeddedSource.workbookName }]);
      setSelectedWorkbookId(embeddedSource.workbookId);
      return () => { cancelled = true; };
    }
    if (projectId === undefined) {
      setWorkbooks([]);
      setError("No Systems Analysis source is available for fault-tree linking.");
      return () => { cancelled = true; };
    }
    listWorkbooks(projectId, "SY")
      .then(({ workbooks: available }) => {
        if (cancelled) return;
        setWorkbooks(available);
        const preferred = available.find(({ id }) => id === currentReference?.workbookId) ?? available[0];
        setSelectedWorkbookId(preferred?.id ?? "");
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setWorkbooks([]);
          setError(loadError instanceof Error ? loadError.message : "Could not load Systems Analysis workbooks.");
        }
      });
    return () => { cancelled = true; };
  }, [currentReference?.workbookId, embeddedSource, projectId]);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setSelectedModelId("");
    setModelQuery("");
    setSelection(null);
    setSelectedTarget(null);
    setSelectionHint(null);
    if (selectedWorkbookId.length === 0) return () => { cancelled = true; };

    setError(null);
    const receiveSource = (response: Pick<SyWorkbookResponse, "workbookId" | "mef">): void => {
      if (cancelled) return;
      const availableModels = response.mef.systemLogicModels.filter(({ topGate }) => topGate !== null);
      const preferred = availableModels.find(
        ({ uuid }) => selectedWorkbookId === currentReference?.workbookId && uuid === currentReference.modelId,
      ) ?? availableModels[0];
      setSource(response);
      setSelectedModelId(preferred?.uuid ?? "");
      if (preferred !== undefined && preferred.topGate !== null) {
        setSelection({ kind: "GATE", gateId: preferred.topGate.gateId });
        setSelectedTarget({ modelId: preferred.uuid, entityId: preferred.topGate.gateId });
      }
    };
    if (embeddedSource !== undefined && selectedWorkbookId === embeddedSource.workbookId) {
      receiveSource(embeddedSource);
      return () => { cancelled = true; };
    }
    getSyWorkbook(selectedWorkbookId)
      .then(receiveSource)
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the Systems Analysis workbook.");
        }
      });
    return () => { cancelled = true; };
  }, [
    currentReference?.entityId,
    currentReference?.modelId,
    currentReference?.workbookId,
    embeddedSource,
    selectedWorkbookId,
  ]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const availableModels = source?.mef.systemLogicModels.filter(({ topGate }) => topGate !== null) ?? [];
  const normalizedQuery = modelQuery.trim().toLowerCase();
  const filteredModels = normalizedQuery.length === 0 ? availableModels : availableModels.filter((model) => {
    const topGate = model.topGate === null ? undefined : model.gates.find((gate) => gate.id === model.topGate?.gateId);
    return [model.code, model.name, model.systemReference, topGate?.code, topGate?.name]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const selectedModel = availableModels.find(({ uuid }) => uuid === selectedModelId);
  const editorModel = selectedModel === undefined ? null : toEditorModel(selectedModel);
  const transferTargets = availableModels.flatMap((candidate) =>
    candidate.topGate === null || candidate.uuid === selectedModelId
      ? []
      : [{
          target: { modelId: candidate.uuid, entityId: candidate.topGate.gateId },
          code: candidate.code,
          name: candidate.name,
          description: candidate.description,
        }],
  );
  const catalogue = useMemo<FaultTreeEditorCatalogue>(
    () => ({
      basicEvents: (source?.mef.systemBasicEvents ?? []).map(systemBasicEventToFaultTreeBasicEvent),
    }),
    [source],
  );
  const validation = editorModel === null
    ? []
    : validateFaultTreeModel(editorModel, {
        basicEventCatalogue: { workbookId: selectedWorkbookId, basicEvents: catalogue.basicEvents },
        availableTransferTargets: transferTargets.map(({ target }) => target),
        faultTreeModels: availableModels.map(toEditorModel),
      });

  function selectModel(modelId: string): void {
    const nextModel = availableModels.find((model) => model.uuid === modelId);
    setSelectedModelId(modelId);
    setSelection(nextModel?.topGate === null || nextModel?.topGate === undefined
      ? null
      : { kind: "GATE", gateId: nextModel.topGate.gateId });
    setSelectedTarget(nextModel?.topGate === null || nextModel?.topGate === undefined
      ? null
      : { modelId: nextModel.uuid, entityId: nextModel.topGate.gateId });
    setSelectionHint(null);
  }

  function receiveReference(target: MethodEntityReference): void {
    if (target.entityId !== selectedModel?.topGate?.gateId) {
      setSelectedTarget(null);
      setSelectionHint("Select the top gate. Internal gates cannot be linked as a fault-tree top event.");
      return;
    }
    setSelectedTarget(target);
    setSelectionHint(null);
  }

  function confirm(): void {
    if (selectedTarget === null || selectedWorkbookId.length === 0) return;
    onConfirm({
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: selectedWorkbookId,
      modelId: selectedTarget.modelId,
      entityId: selectedTarget.entityId,
    });
  }

  const selectedTargetCode = selectedTarget === null
    ? null
    : availableModels
      .find((model) => model.uuid === selectedTarget.modelId)
      ?.gates.find((gate) => gate.id === selectedTarget.entityId)?.code ?? null;

  return (
    <div className="eslink-backdrop eslink-backdrop--fault-tree" onClick={onClose}>
      <div
        className="eslink eslink--fault-tree"
        role="dialog"
        aria-modal="true"
        aria-label={`Select a fault-tree top event for ${functionalEventName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="eslink__body eslink__body--fault-tree">
          <div className="eslink__ft-toolbar">
            <div className="eslink__ft-selectors">
              <label className="posfield">
                <span className="posfield__label">Systems workbook</span>
                <select
                  className="posfield__select"
                  value={selectedWorkbookId}
                  disabled={workbooks === null || workbooks.length === 0}
                  onChange={(event) => setSelectedWorkbookId(event.target.value)}
                >
                  {(workbooks ?? []).map((workbook) => <option key={workbook.id} value={workbook.id}>{workbook.name}</option>)}
                </select>
              </label>
              <label className="posfield">
                <span className="posfield__label">Search fault trees</span>
                <input
                  className="posfield__input"
                  type="search"
                  value={modelQuery}
                  placeholder="Tree code, name, top gate, or system"
                  onChange={(event) => setModelQuery(event.target.value)}
                />
              </label>
              <label className="posfield">
                <span className="posfield__label">Fault tree</span>
                <select
                  className="posfield__select"
                  value={selectedModelId}
                  disabled={source === null || availableModels.length === 0}
                  onChange={(event) => selectModel(event.target.value)}
                >
                  {filteredModels.length === 0 && <option value="">No matching fault tree</option>}
                  {filteredModels.map((model) => {
                    const topGate = model.topGate === null ? undefined : model.gates.find((gate) => gate.id === model.topGate?.gateId);
                    return <option key={model.uuid} value={model.uuid}>{model.code} · {model.name}{topGate?.code === undefined ? "" : ` · ${topGate.code}`}</option>;
                  })}
                </select>
              </label>
            </div>
            <div className="eslink__ft-actions">
              {selectedTargetCode !== null && <span className="eslink__selection-summary">{selectedTargetCode}</span>}
              <button
                type="button"
                className="posnav__btn posnav__btn--primary"
                disabled={selectedTarget === null}
                onClick={confirm}
              >
                <ESIcon.Link /> Link selected top event
              </button>
              <button type="button" className="eslink__close" onClick={onClose} aria-label="Close"><ESIcon.Close /></button>
            </div>
          </div>

          {workbooks === null && <p className="pws-status">Loading Systems Analysis workbooks…</p>}
          {workbooks !== null && workbooks.length === 0 && error === null && (
            <p className="pws-status">No Systems Analysis workbook is available in this project.</p>
          )}
          {selectedWorkbookId.length > 0 && source === null && error === null && (
            <p className="pws-status">Loading fault trees…</p>
          )}
          {source !== null && availableModels.length === 0 && (
            <p className="pws-status">This Systems Analysis workbook has no fault tree with a top gate.</p>
          )}
          {error !== null && <p className="eslink__error" role="alert">{error}</p>}

          {editorModel !== null && (
            <div className="eslink__ft-editor">
              {selectionHint !== null && <p className="eslink__error" role="alert">{selectionHint}</p>}
              <FaultTreeEditor
                key={`${selectedWorkbookId}:${editorModel.modelId}`}
                model={editorModel}
                catalogue={catalogue}
                capabilities={REFERENCE_SELECTION_CAPABILITIES}
                selection={selection}
                validation={validation}
                saveState="saved"
                analysisResult={null}
                resultIsStale={false}
                transferTargets={transferTargets}
                onOperation={() => undefined}
                onSelectionChange={(nextSelection) => {
                  setSelection(nextSelection);
                  if (nextSelection?.kind !== "GATE") setSelectedTarget(null);
                }}
                onOpenReference={(request) => {
                  if (request.kind === "GATE") receiveReference(request.target);
                  if (request.kind === "TRANSFER") selectModel(request.target.modelId);
                }}
                onRun={() => undefined}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export { EsFaultTreeReferencePicker };
export type { EsFaultTreeReferencePickerProps };
