import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { withRcFamilyConsequences } from "interfaces-shared-types/rc-workbooks/family-consequences";
import { DrawerContent, QuantifyScreen } from "../rcScreens3";
import type { RcDrawerContext } from "../rcScreens";
import { RcWorkbookProvider, type RcWorkbookData } from "../rcWorkbookContext";

const file = { documentId: "00000000-0000-4000-8000-000000000001", filename: "run.out", sha256: "a".repeat(64), size: 10, uploadedAt: "2026-09-24T00:00:00.000Z" };
const snapshotId = "00000000-0000-4000-8000-000000000002";
const family = (entityId: string) => ({ referenceType: "EVENT_SEQUENCE_FAMILY" as const, workbookId: "es-1", entityId });
const es = { eventSequenceFamilies: [{ uuid: "ESF-EARLY", name: "Early release", memberSequenceIds: [] }, { uuid: "ESF-ATWS", name: "Failure to trip", memberSequenceIds: [] }, { uuid: "ESF-LATE", name: "Late release", memberSequenceIds: [] }] } as unknown as EventSequenceAnalysis;

function workbook(): RadiologicalConsequenceAnalysis {
  return withRcFamilyConsequences({
    linkedWorkbooks: { ES: "es-1" },
    protectiveActionParameters: {}, meteorologicalData: {}, atmosphericTransportAndDispersion: {}, dosimetry: {},
    scope: { metrics: [{ id: "RCM-01", name: "Individual dose at boundary", quantity: "INDIVIDUAL_DOSE", receptor: { kind: "EAB_MAXIMUM" }, window: { seconds: 2592000, start: "RELEASE_ONSET" },
      protectiveActionsCredited: false, statistics: { mean: true, percentiles: [5, 95], exceedanceThresholds: [] }, criterion: "", basis: "" }] },
    releaseCategoryToConsequence: { releaseCategoryInputs: [
      { releaseCategory: "RC-1", eventSequenceFamilyReferences: [family("ESF-EARLY"), family("ESF-ATWS")], releaseCharacteristics: {} },
      { releaseCategory: "RC-2", eventSequenceFamilyReferences: [family("ESF-LATE")], releaseCharacteristics: {} },
    ] },
    consequenceQuantification: {
      consequenceCodesUsed: [], modelAndCodeLimitations: [], eventSequenceConsequences: [], outputReview: { performed: false }, resultsConfirmation: { performed: false },
      modelUncertaintyAssessments: [], uncertaintyCharacterization: { level: "CHARACTERIZED", description: "" },
      caseRecords: { revision: 1, snapshots: [{ id: snapshotId, label: "Case 01", categoryId: "RC-1", file, inputHash: "b".repeat(64), createdBy: "analyst", reviewItems: 0, inventoryCount: 1, receptorCount: 1, trialCount: 1 }],
        results: [{ id: "00000000-0000-4000-8000-000000000003", snapshotId, categoryId: "RC-1", metricId: "RCM-01", unit: "Sv", statistics: { mean: 0.0125, percentiles: [{ percentile: 5, value: 0.0033 }, { percentile: 95, value: 0.03 }], exceedances: [] },
          version: "code 1.0", reference: "Run 7", confirmed: true, file, recordedBy: "analyst", valueSource: "transcribed" }] },
    },
  } as unknown as RadiologicalConsequenceAnalysis);
}

function setup() {
  let latest = workbook();
  function Harness() {
    const [data, setData] = useState({ rc: latest, cc: {}, nms: [] } as unknown as RcWorkbookData);
    const [drawer, setDrawer] = useState<RcDrawerContext | null>(null);
    return <RcWorkbookProvider data={data} editable links={{ options: { ES: [], MS: [], RI: [] }, es }} mutateRc={(mutator) => setData((previous) => { latest = withRcFamilyConsequences(mutator(previous.rc)); return { ...previous, rc: latest }; })}>
      <QuantifyScreen openDrawer={setDrawer} />
      {drawer && <div role="dialog" aria-label="Family drawer"><DrawerContent context={drawer} onClose={() => setDrawer(null)} centered /></div>}
    </RcWorkbookProvider>;
  }
  render(<Harness />);
  return { current: () => latest };
}

describe("Step 08 event-sequence consequences", () => {
  it("copies the category result to every family in it and shows families still waiting", () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: "Consequences" }));
    expect(screen.getByText("ESF-EARLY · in RC-1")).toBeInTheDocument();
    expect(screen.getByText("ESF-ATWS · in RC-1")).toBeInTheDocument();
    expect(screen.getAllByText("3.3E-3 to 3.0E-2")).toHaveLength(2);
    expect(screen.getByText("ESF-LATE · in RC-2")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the RC-2 result")).toBeInTheDocument();
  });

  it("keeps hand-typed family values only with a stated reason and can return to the category result", () => {
    const { current } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Consequences" }));
    fireEvent.click(screen.getByText("ESF-ATWS · in RC-1"));
    fireEvent.click(screen.getByRole("button", { name: "Enter hand-typed values" }));
    const entry = () => current().consequenceQuantification.eventSequenceConsequences.find((row) => row.eventSequenceFamily === "ESF-ATWS")!;
    expect(entry()).toMatchObject({ uuid: "RCQ-ESF-ATWS", origin: "OVERRIDE", overrideReason: "", consequenceResults: [{ metric: "Individual dose at boundary", meanValue: 0.0125, unit: "Sv" }] });
    expect(screen.getByRole("alert")).toHaveTextContent("Reason required");
    const reason = screen.getByLabelText("Reason for hand-typed values");
    fireEvent.change(reason, { target: { value: "Separate run for the failure-to-trip family." } });
    fireEvent.blur(reason);
    expect(entry().overrideReason).toBe("Separate run for the failure-to-trip family.");
    expect(screen.getByText("Failure to trip · hand-typed values")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use the category result" }));
    expect(entry()).toMatchObject({ uuid: "RCQ-ESF-ATWS", origin: "CATEGORY_RESULT" });
  });
});
