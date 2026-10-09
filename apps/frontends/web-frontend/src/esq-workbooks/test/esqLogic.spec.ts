import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { esqEndStateRunId, esqSequenceRunId, esqTreeRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { type EsqUpstream } from "../esqLinks";
import { withFunctionLink, withModelImported } from "../esqModel";
import {
  familyTotals,
  logicComplete,
  logicViewOf,
  runRows,
  withExclusion,
  withFlag,
  withLoopBreak,
  withUnusedBreaksRemoved,
} from "../esqLogic";
import { stepsFromMef } from "../esqSelectors";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-10-05T12:00:00.000Z";

function loopedUpstream(): EsqUpstream {
  const upstream = modelUpstream();
  const sy = upstream.sy;
  if (sy === undefined) throw new Error("fixture has no SY");
  sy.systemLogicModels = sy.systemLogicModels.map((model) => {
    if (model.uuid === "M-SUP") {
      return { ...model, leafNodes: [...model.leafNodes, { id: "X-COOL", kind: "TRANSFER_REFERENCE", code: "COOL", name: "COOL", description: "", target: { modelId: "M-COOL", entityId: "G-COOL" } }] };
    }
    if (model.uuid === "M-RPS") {
      return { ...model, gates: [{ id: "G-RPS", kind: "GATE", gateType: "OR", code: "RPS-OR", name: "Trip fails", description: "" }], leafNodes: [...model.leafNodes, { id: "H-DC", kind: "HOUSE_EVENT", code: "DC-LOST", name: "DC power lost", description: "", state: false }] };
    }
    return model;
  });
  return upstream;
}

function linked(): EventSequenceQuantification {
  let esq = withModelImported(linkedEsq(), loopedUpstream(), NOW);
  esq = withFunctionLink(esq, "RT", { functionId: "RT", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } } });
  return withFunctionLink(esq, "COOL", { functionId: "COOL", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-COOL", gateId: "G-COOL" } } });
}

function checks(esq: EventSequenceQuantification): string[] {
  return (logicViewOf(esq)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

describe("ESQ Step 03 logic", () => {
  it("needs the Step 02 import first", () => {
    expect(logicViewOf(linkedEsq())).toBeUndefined();
    expect(logicComplete(linkedEsq())).toBe(false);
  });

  it("keeps a reached support loop open until one transfer is cut", () => {
    const esq = linked();
    const view = logicViewOf(esq);
    expect(view?.loops.map((loop) => `${loop.codes.join("+")}:${loop.open}:${loop.reached}`)).toEqual(["COOL-TOP+SUP-TOP:true:true"]);
    expect(checks(esq)).toEqual(["error:Loop not broken:COOL-TOP, SUP-TOP"]);
    expect(logicComplete(esq)).toBe(false);
    const cut = withLoopBreak(esq, "M-SUP", "M-COOL", { fromModelId: "M-SUP", toModelId: "M-COOL", state: false, basis: "" });
    expect(logicViewOf(cut)?.loops[0]?.open).toBe(false);
    expect(checks(cut)).toEqual(["warning:Break basis missing:COOL-TOP, SUP-TOP"]);
    const recorded = withLoopBreak(cut, "M-SUP", "M-COOL", { fromModelId: "M-SUP", toModelId: "M-COOL", state: false, basis: "Cooling runs without its own support signal." });
    expect(checks(recorded)).toEqual([]);
    expect(logicComplete(recorded)).toBe(true);
    expect(stepsFromMef(recorded, "preparer").find((step) => step.id === "logic")?.status).toBe("complete");
  });

  it("checks flag targets, bases and conflicts per tree", () => {
    let esq = withLoopBreak(linked(), "M-SUP", "M-COOL", { fromModelId: "M-SUP", toModelId: "M-COOL", state: true, basis: "Conservative." });
    esq = withFlag(esq, "FL-1", { id: "FL-1", name: "", state: true, groupIds: [], stateIds: [], basis: "" });
    expect(checks(esq)).toEqual(["error:Target missing:FL-1", "warning:Name missing:FL-1", "warning:Basis missing:FL-1"]);
    esq = withFlag(esq, "FL-1", { id: "FL-1", name: "DC lost", target: { kind: "HOUSE", id: "H-DC", modelId: "M-RPS" }, state: true, groupIds: [], stateIds: [], basis: "Loss of DC initiators." });
    expect(logicViewOf(esq)?.flags[0]?.target).toBe("House event DC-LOST in RPS-TOP");
    expect(checks(esq)).toEqual([]);
    esq = withFlag(esq, "FL-2", { id: "FL-2", name: "DC kept", target: { kind: "HOUSE", id: "H-DC", modelId: "M-RPS" }, state: false, groupIds: ["IEG-01"], stateIds: ["POS-02"], basis: "Shutdown keeps DC." });
    expect(checks(esq)).toEqual(["error:Flags conflict:FL-1 and FL-2"]);
    expect(logicViewOf(esq)?.findings[0]?.detail).toBe("FL-1 sets House event DC-LOST in RPS-TOP TRUE and FL-2 sets it FALSE in ET-B.");
    esq = withFlag(esq, "FL-2", { id: "FL-2", name: "Gate", target: { kind: "GATE", id: "G-MISSING", modelId: "M-RPS" }, state: false, groupIds: ["IEG-09"], stateIds: [], basis: "Test." });
    expect(checks(esq)).toEqual(["error:Target not imported:Gate", "warning:Applies to no tree:Gate"]);
  });

  it("checks that each exclusion has two imported events and a basis", () => {
    let esq = withLoopBreak(linked(), "M-SUP", "M-COOL", { fromModelId: "M-SUP", toModelId: "M-COOL", state: true, basis: "Conservative." });
    esq = withExclusion(esq, "EX-1", { id: "EX-1", eventIds: ["E-2"], basis: "" });
    expect(checks(esq)).toEqual(["error:Too few events:EX-1", "error:Basis missing:EX-1"]);
    esq = withExclusion(esq, "EX-1", { id: "EX-1", eventIds: ["E-2", "E-9"], basis: "Never both out." });
    expect(checks(esq)).toEqual(["error:Event not imported:EX-1"]);
    esq = withExclusion(esq, "EX-1", { id: "EX-1", eventIds: ["E-2", "E-3"], basis: "Never both out." });
    expect(logicViewOf(esq)?.exclusions[0]?.codes).toEqual(["SUP-HFE", "SUP-FAN-FR"]);
    expect(checks(esq)).toEqual([]);
    expect(withExclusion(esq, "EX-1", undefined).logic?.exclusions).toEqual([]);
  });

  it("removes breaks that no longer cut a loop", () => {
    const esq = withLoopBreak(linked(), "M-COOL", "M-RPS", { fromModelId: "M-COOL", toModelId: "M-RPS", state: false, basis: "Old." });
    expect(logicViewOf(esq)?.unusedBreaks).toHaveLength(1);
    expect(checks(esq)).toContain("note:Breaks not used:1 break");
    expect(withUnusedBreaksRemoved(esq).logic?.loopBreaks).toEqual([]);
  });

  it("maps run results back to sequence codes, families and transfer chains", () => {
    const esq = linked();
    const result: EventTreeAnalysisResult = {
      schemaVersion: "1.0.0",
      runId: "00000000-0000-4000-8000-000000000001",
      owner: { workbookId: "esq-1", modelId: esqTreeRunId("ET-A"), workbookRevision: 2 },
      mode: "INDEPENDENT",
      sequences: [
        { sequenceId: esqSequenceRunId("ET-A", "A-1"), path: [], result: { kind: "END_STATE", endStateId: esqEndStateRunId("SUCCESSFUL_MITIGATION") }, conditionalProbability: 0.9, annualFrequency: 2.4 },
        { sequenceId: esqSequenceRunId("ET-A", "A-2"), path: [], result: { kind: "END_STATE", endStateId: esqEndStateRunId("RADIONUCLIDE_RELEASE") }, conditionalProbability: 1e-3, annualFrequency: 2e-3 },
        {
          sequenceId: "00000000-0000-4000-8000-000000000009",
          sequenceChain: [{ modelId: esqTreeRunId("ET-A"), entityId: esqSequenceRunId("ET-A", "A-3") }, { modelId: esqTreeRunId("ET-T"), entityId: esqSequenceRunId("ET-T", "T-2") }],
          path: [],
          result: { kind: "END_STATE", endStateId: esqEndStateRunId("RADIONUCLIDE_RELEASE") },
          conditionalProbability: 1e-6,
          annualFrequency: 3e-6,
        },
      ],
      endStateAggregates: [],
      validationIssues: [],
      completedAt: NOW,
    };
    const rows = runRows(esq, result);
    expect(rows.map((row) => `${row.code}:${row.familyId ?? "-"}:${row.endState ?? "-"}`)).toEqual([
      "A-1:F-OK:SUCCESSFUL_MITIGATION",
      "A-2:F-REL:RADIONUCLIDE_RELEASE",
      "A-3 to T-2:F-REL:RADIONUCLIDE_RELEASE",
    ]);
    expect(familyTotals(rows)).toEqual([{ familyId: "F-OK", frequency: 2.4 }, { familyId: "F-REL", frequency: 2e-3 + 3e-6 }]);
  });
});
