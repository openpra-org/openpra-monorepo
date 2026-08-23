import { JSX, useEffect, useMemo, useState } from "react";
import type { FaultTreeTopEventReference, MethodEntityReference } from "interfaces-mef-types/modeling";
import type { SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { systemBasicEventToFaultTreeBasicEvent } from "interfaces-mef-types/sy/system-models";
import { validateFaultTreeModel } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { Workbook } from "interfaces-shared-types";
import {
  FaultTreeEditor,
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
  type FaultTreeSelection,
} from "../newly-developed-methods/fault-tree";
import { getSyWorkbook, type SyWorkbookResponse } from "../sy-workbooks/syWorkbookApi";
import { listWorkbooks } from "../workbooks/workbookApi";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { ESIcon } from "./esIcons";
import "./css/esLinkModal.css";

interface EsFaultTreeReferencePickerProps {
  projectId: string;
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

function EsFaultTreeReferencePicker({
  projectId,
  functionalEventName,
  currentReference,
  onClose,
  onConfirm,
}: EsFaultTreeReferencePickerProps): JSX.Element {
  const [workbooks, setWorkbooks] = useState<Workbook[] | null>(null);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const [source, setSource] = useState<SyWorkbookResponse | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selection, setSelection] = useState<FaultTreeSelection>(null);
  const [selectedTarget, setSelectedTarget] = useState<MethodEntityReference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWorkbooks(null);
    setError(null);
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
  }, [currentReference?.workbookId, projectId]);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setSelectedModelId("");
    setSelection(null);
    setSelectedTarget(null);
    setSelectionHint(null);
    if (selectedWorkbookId.length === 0) return () => { cancelled = true; };

    setError(null);
    getSyWorkbook(selectedWorkbookId)
      .then((response) => {
        if (cancelled) return;
        const availableModels = response.mef.systemLogicModels.filter(({ topGate }) => topGate !== null);
        const preferred = availableModels.find(
          ({ uuid }) => selectedWorkbookId === currentReference?.workbookId && uuid === currentReference.modelId,
        ) ?? availableModels[0];
        setSource(response);
        setSelectedModelId(preferred?.uuid ?? "");
        if (
          preferred !== undefined
          && preferred.topGate !== null
          && selectedWorkbookId === currentReference?.workbookId
          && preferred.uuid === currentReference.modelId
          && preferred.topGate.gateId === currentReference.entityId
        ) {
          setSelection({ kind: "GATE", gateId: currentReference.entityId });
          setSelectedTarget({ modelId: currentReference.modelId, entityId: currentReference.entityId });
        }
      })
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
  const selectedModel = availableModels.find(({ uuid }) => uuid === selectedModelId);
  const editorModel = selectedModel === undefined ? null : toEditorModel(selectedModel);
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
        availableTransferTargets: availableModels.flatMap((model) =>
          model.topGate === null ? [] : [{ modelId: model.uuid, entityId: model.topGate.gateId }],
        ),
        faultTreeModels: availableModels.map(toEditorModel),
      });

  function selectModel(modelId: string): void {
    setSelectedModelId(modelId);
    setSelection(null);
    setSelectedTarget(null);
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

  return (
    <div className="eslink-backdrop" onClick={onClose}>
      <div
        className="eslink eslink--fault-tree"
        role="dialog"
        aria-modal="true"
        aria-label={`Select a fault-tree top event for ${functionalEventName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="eslink__head">
          <div>
            <div className="eslink__eyebrow"><ESIcon.Link /> Stable workbook reference</div>
            <WorkbookSectionHeading workbook="ES" title={`Link ${functionalEventName}`} level={2} className="eslink__title" />
          </div>
          <button type="button" className="eslink__close" onClick={onClose} aria-label="Close"><ESIcon.Close /></button>
        </header>

        <div className="eslink__body eslink__body--fault-tree">
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
              <span className="posfield__label">Fault tree</span>
              <select
                className="posfield__select"
                value={selectedModelId}
                disabled={source === null || availableModels.length === 0}
                onChange={(event) => selectModel(event.target.value)}
              >
                {availableModels.map((model) => <option key={model.uuid} value={model.uuid}>{model.code} · {model.name}</option>)}
              </select>
            </label>
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
              <p className="possubtle">Select the top gate in the canonical fault-tree viewer, then confirm the stable reference.</p>
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
                onOperation={() => undefined}
                onSelectionChange={(nextSelection) => {
                  setSelection(nextSelection);
                  if (nextSelection?.kind !== "GATE") setSelectedTarget(null);
                }}
                onOpenReference={(request) => {
                  if (request.kind === "GATE") receiveReference(request.target);
                }}
                onRun={() => undefined}
              />
            </div>
          )}
        </div>

        <footer className="eslink__foot">
          <span className="eslink__selection-summary">
            {selectedTarget === null ? "No top event selected" : `Selected ${selectedTarget.entityId}`}
          </span>
          <button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="posnav__btn posnav__btn--primary"
            disabled={selectedTarget === null}
            onClick={confirm}
          >
            <ESIcon.Link /> Link selected top event
          </button>
        </footer>
      </div>
    </div>
  );
}

export { EsFaultTreeReferencePicker };
export type { EsFaultTreeReferencePickerProps };
