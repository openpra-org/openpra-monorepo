import { JSX, useCallback, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqModelRunId, solveInputsKey } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqModelRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { EsqWorkbookProvider } from "../esqWorkbookContext";
import type { EsqUpstream } from "../esqLinks";
import { SolveDialogs } from "../EsqSolveTabs";
import { type EsqWindowContext } from "../esqShared";
import { withModelImported } from "../esqModel";
import { AS_SET } from "../esqLogic";
import { withRunOfRecord } from "../esqSolve";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-10-05T12:00:00.000Z";
const RUN = "4f6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const CUT_OFFS = [1e-6, 1e-7, 1e-8, 1e-9, 1e-10, 1e-11, 1e-12, 1e-13, 1e-14];
const RELEASE = [7.22e-5, 7.54e-5, 7.6075e-5, 7.6091e-5, 7.6107e-5, 7.61085e-5, 7.610863e-5, 7.6108643e-5, 7.61086450e-5];

function importedEsq(): EventSequenceQuantification {
  return withModelImported(linkedEsq(), modelUpstream(), NOW);
}

function summaryOf(esq: EventSequenceQuantification): EsqModelRunResult {
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_MODEL_RUN",
    runId: RUN,
    owner: { workbookId: "esq-1", modelId: esqModelRunId(), workbookRevision: 4 },
    completedAt: NOW,
    inputs: solveInputsKey(esq),
    calculation: "CUT_SETS",
    logic: AS_SET,
    cutSets: { basis: "FREQUENCY", cutOffs: CUT_OFFS, quantifier: "MCUB", keep: 100 },
    trees: [
      { treeId: "ET-A", runId: "5a6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f", status: "SUCCEEDED", initiatorFrequency: 2.5, failure: null },
      { treeId: "ET-B", runId: "6b6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f", status: "SUCCEEDED", initiatorFrequency: 0.5, failure: null },
    ],
    sequences: [
      { treeId: "ET-A", sequenceIds: ["A-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 2.8e-5, annualFrequency: 7e-5, cutSetCount: 30 },
      { treeId: "ET-A", sequenceIds: ["A-3", "T-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 1e-6, annualFrequency: 2.5e-6, cutSetCount: 4 },
      { treeId: "ET-B", sequenceIds: ["B-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 7e-6, annualFrequency: 3.5e-6, cutSetCount: 3 },
      { treeId: "ET-A", sequenceIds: ["A-1"], familyId: "F-OK", endState: "SUCCESSFUL_MITIGATION", conditionalProbability: 1, annualFrequency: 2.5, cutSetCount: 1 },
      { treeId: "ET-B", sequenceIds: ["B-1"], familyId: "F-OK", endState: "SUCCESSFUL_MITIGATION", conditionalProbability: 1, annualFrequency: 0.5, cutSetCount: 1 },
    ],
    families: [
      {
        familyId: "F-REL",
        annualFrequency: 7.61086450e-5,
        sequenceCount: 3,
        cutSetCount: 309,
        sweep: CUT_OFFS.map((cutOff, index) => ({ cutOff, count: index + 6, annualFrequency: RELEASE[index] ?? 0 })),
        states: [{ stateId: "POS-01", annualFrequency: 7.2e-5, sweep: CUT_OFFS.map((cutOff, index) => ({ cutOff, count: index + 4, annualFrequency: (RELEASE[index] ?? 0) * 0.95 })) }],
        cutSets: [
          { treeId: "ET-A", basicEventIds: ["E-1", "E-2"], annualFrequency: 3.3e-5 },
          { treeId: "ET-B", basicEventIds: ["E-3"], annualFrequency: 1.2e-5 },
        ],
      },
      {
        familyId: "F-OK",
        annualFrequency: 3,
        sequenceCount: 2,
        cutSetCount: 2,
        sweep: CUT_OFFS.map((cutOff) => ({ cutOff, count: 2, annualFrequency: 3 })),
        states: [],
        cutSets: [{ treeId: "ET-A", basicEventIds: [], annualFrequency: 2.5 }],
      },
    ],
    endStates: [{ endState: "RADIONUCLIDE_RELEASE", annualFrequency: 7.6e-5 }],
    eventCodes: { "E-1": "SCS-PM-A", "E-2": "RCCS-STACK", "E-3": "RPS-DIV" },
    peakProbability: 2.8e-5,
  };
}

function Harness({ initial, window: context, upstream, onChange }: { initial: EventSequenceQuantification; window: EsqWindowContext; upstream: EsqUpstream; onChange: (esq: EventSequenceQuantification) => void }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange(next);
    return next;
  }), [onChange]);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={upstream}>
      <SolveDialogs context={context} onClose={() => undefined} />
    </EsqWorkbookProvider>
  );
}

describe("ESQ Step 05 solve dialogs", () => {
  it("keeps typed and imported family values and picks the value of record in the family dialog", () => {
    const base = importedEsq();
    const recorded = withRunOfRecord(base, summaryOf(base));
    const upstream = modelUpstream();
    const es = upstream.es;
    if (es === undefined) throw new Error("fixture has no ES");
    es.eventSequenceFamilies = es.eventSequenceFamilies.map((family) => (family.uuid === "F-REL" ? { ...family, meanFrequency: 4.323e-5 } : family));
    const onChange = jest.fn();
    render(<Harness initial={recorded} upstream={upstream} window={{ kind: "esqSolveFamily", id: "F-REL" }} onChange={onChange} />);
    const frequency = screen.getByLabelText("Typed frequency (/yr)");
    fireEvent.focus(frequency);
    fireEvent.change(frequency, { target: { value: "7.5e-5" } });
    fireEvent.blur(frequency);
    const source = screen.getByLabelText("Source of the typed value");
    fireEvent.focus(source);
    fireEvent.change(source, { target: { value: "Hand calculation" } });
    fireEvent.blur(source);
    fireEvent.click(screen.getByRole("button", { name: "Import from ES · 4.32E-5" }));
    fireEvent.change(screen.getByLabelText("Value of record"), { target: { value: "IMPORTED" } });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(last.solve?.families.find((entry) => entry.familyId === "F-REL")).toMatchObject({
      ofRecord: "IMPORTED",
      typed: { annualFrequency: 7.5e-5, source: "Hand calculation" },
      imported: { annualFrequency: 4.323e-5, element: "ES", workbookId: "es-1" },
    });
    expect(last.familyQuantifications.find((record) => record.eventSequenceFamilyRef === "F-REL")?.meanFrequency).toBe(4.323e-5);
  });
});
