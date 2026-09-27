import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { Workbook } from "interfaces-shared-types";
import { RcInterfaces } from "../rcScreens";
import { RcWorkbookProvider, type RcSourceTermActions, type RcWorkbookData } from "../rcWorkbookContext";
import type { RcLinks } from "../rcLinks";

const workbook = (id: string, name: string) => ({ id, name, status: "in-progress", version: 2, ownerFullName: "Analyst One", updatedAt: "2026-09-20T10:00:00.000Z" }) as Workbook;
const metric = { id: "RCM-01", name: "Individual dose at boundary", quantity: "INDIVIDUAL_DOSE", receptor: { kind: "EAB_MAXIMUM" }, window: { seconds: 2592000, start: "RELEASE_ONSET" },
  protectiveActionsCredited: false, statistics: { mean: true, percentiles: [95], exceedanceThresholds: [] }, criterion: "Target", basis: "Basis" };
const es = {
  eventSequenceFamilies: [
    { uuid: "ESF-EARLY", name: "Early release", releaseCategoryIds: ["RC-1"], memberSequenceIds: ["S-1", "S-2"] },
    { uuid: "ESF-OK", name: "Safe stable state", releaseCategoryIds: [], memberSequenceIds: ["S-9"] },
  ],
  releaseCategoryMappings: [{ uuid: "RCM-1", releaseCategoryId: "RC-1", eventSequenceIds: ["S-1", "S-2"], physicalReleaseCharacteristics: [] }],
} as unknown as EventSequenceAnalysis;
const ms = {
  releaseCategories: [{ uuid: "RC-1", name: "Early", boundingSequenceReference: "S-2", boundingSequenceJustification: "Largest release." }],
  sourceInventories: [{ uuid: "SRC-1", name: "Core", inventory: [{ radionuclide: "Cs-137", quantity: 1e17, unit: "Bq" }] }],
  transportBarrierAssessments: [],
  sourceTermDefinitions: [{ uuid: "ST-1", releaseCategoryReference: "RC-1", releasePhases: [{ uuid: "p1", name: "Puff", startTime: 0, endTime: 2, timeUnit: "h" }],
    radionuclideReleases: [{ phaseId: "p1", quantities: [{ radionuclide: "Cs-137", quantity: 1e-4, unit: "fraction", expressedAsReleaseFraction: true }] }], releaseElevation: { quantity: 10, unit: "m" } }],
} as unknown as MechanisticSourceTermAnalysis;

function setup(rc: Partial<RadiologicalConsequenceAnalysis>, links: RcLinks, sourceTerms?: RcSourceTermActions) {
  const openDrawer = jest.fn();
  let latest = rc as RadiologicalConsequenceAnalysis;
  function Harness() {
    const [data, setData] = useState({ rc: latest, cc: {}, nms: [] } as unknown as RcWorkbookData);
    return <RcWorkbookProvider data={data} editable links={links} sourceTerms={sourceTerms} mutateRc={(mutator) => setData((previous) => { latest = mutator(previous.rc); return { ...previous, rc: latest }; })}>
      <RcInterfaces openDrawer={openDrawer} />
    </RcWorkbookProvider>;
  }
  render(<Harness />);
  return { openDrawer, current: () => latest };
}
const baseRc = (extra: Partial<RadiologicalConsequenceAnalysis> = {}) => ({
  scope: { metrics: [metric] }, releaseCategoryToConsequence: { releaseCategoryInputs: [{ releaseCategory: "RC-1", releaseCharacteristics: {} }] },
  consequenceQuantification: { eventSequenceConsequences: [] }, ...extra,
}) as Partial<RadiologicalConsequenceAnalysis>;
const options = { ES: [workbook("es-1", "ES analysis")], MS: [workbook("ms-1", "MS analysis")], RI: [workbook("ri-1", "RI analysis")] };

describe("Step 01 interfaces", () => {
  it("links each upstream workbook through a source workbook select", () => {
    const { current } = setup(baseRc(), { options });
    expect(screen.getByRole("button", { name: /ES Event Sequence Analysis/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Source workbook"), { target: { value: "es-1" } });
    expect(current().linkedWorkbooks).toEqual({ ES: "es-1" });
    const table = screen.getByRole("table", { name: "Linked ES workbook" });
    expect(within(table).getByText("ES analysis")).toBeInTheDocument();
    expect(within(table).getByText("In progress")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /RI Risk Integration/ }));
    expect(screen.getByLabelText("Source workbook")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Source workbook"), { target: { value: "ri-1" } });
    expect(current().linkedWorkbooks).toEqual({ ES: "es-1", RI: "ri-1" });
  });

  it("maps linked families into categories and records the bounding member", () => {
    const { current } = setup(baseRc({ linkedWorkbooks: { ES: "es-1" } }), { options, es });
    fireEvent.click(screen.getByRole("button", { name: "Add families from ES" }));
    expect(screen.getByLabelText("Release category for ESF-EARLY")).toHaveValue("RC-1");
    expect(screen.getByLabelText("Release category for ESF-OK")).toHaveValue("");
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs[0].eventSequenceFamilyReferences).toEqual([{ referenceType: "EVENT_SEQUENCE_FAMILY", workbookId: "es-1", entityId: "ESF-EARLY" }]);
    fireEvent.change(screen.getByLabelText("Bounding sequence for RC-1"), { target: { value: "S-2" } });
    fireEvent.change(screen.getByLabelText("Screening basis for RC-1"), { target: { value: "Largest release in the category." } });
    fireEvent.blur(screen.getByLabelText("Screening basis for RC-1"));
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs[0].boundingMember).toEqual({ sequenceId: "S-2", basis: "Largest release in the category." });
    fireEvent.change(screen.getByLabelText("Release category for ESF-EARLY"), { target: { value: "" } });
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs[0].eventSequenceFamilyReferences).toEqual([]);
  });

  it("imports the category source term from the linked MS workbook", async () => {
    const saveValues = jest.fn(async () => ({ releaseCategory: "RC-1", releaseCharacteristics: {} }));
    const { current } = setup(baseRc({ linkedWorkbooks: { MS: "ms-1" } }), { options, ms }, { importFile: jest.fn(), saveValues, downloadOriginal: jest.fn() });
    fireEvent.click(screen.getByRole("button", { name: /MS Mechanistic Source Term/ }));
    expect(screen.getByLabelText("MS source term")).toHaveValue("ST-1");
    expect(screen.getByRole("checkbox", { name: "SRC-1 · Core" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Import from MS" }));
    await waitFor(() => expect(saveValues).toHaveBeenCalledWith("RC-1", 0, {
      groups: [{ id: 1, name: "Cs-137" }], inventory: [{ name: "Cs-137", activityBq: 1e17, group: 1 }], releases: [{ id: 1, startSeconds: 0, durationSeconds: 7200, heightMetres: 10, fractions: [1e-4] }],
    }, { workbookId: "ms-1", sourceTermId: "ST-1", inventoryIds: ["SRC-1"] }));
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs[0]).toMatchObject({ sourceTermDefinitionRef: "ST-1", boundingMember: { sequenceId: "S-2", basis: "Largest release." } });
  });

  it("checks the RI measures against the consequence metrics", () => {
    const { current, openDrawer } = setup(baseRc({ linkedWorkbooks: { RI: "ri-1" } }), { options, riMeasures: ["Individual dose at boundary", "Land contamination area"] });
    fireEvent.click(screen.getByRole("button", { name: /RI Risk Integration/ }));
    expect(screen.getByLabelText("Metric for Individual dose at boundary")).toHaveValue("RCM-01");
    expect(screen.getByLabelText("Metric for Land contamination area")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Add metric" }));
    expect(current().scope.metrics?.map((entry) => [entry.id, entry.name])).toEqual([["RCM-01", "Individual dose at boundary"], ["RCM-02", "Land contamination area"]]);
    expect(openDrawer).toHaveBeenCalledWith({ kind: "metric", id: "RCM-02" });
  });
});
