import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import type { Workbook } from "interfaces-shared-types";
import { rcLinkedDataFor, rcSavedForm, rcWithLinkedData, type RcLinkedData } from "interfaces-shared-types/rc-workbooks/linked-data";
import { RcInterfaces } from "../rcScreens";
import { RcWorkbookProvider, type RcSourceTermActions, type RcWorkbookData } from "../rcWorkbookContext";
import type { RcLinks } from "../rcLinks";
import { getEsWorkbook } from "../../es-workbooks/esWorkbookApi";
import { getMsWorkbook } from "../../ms-workbooks/msWorkbookApi";
import { getRiWorkbook } from "../../ri-workbooks/riWorkbookApi";

jest.mock("../../es-workbooks/esWorkbookApi", () => ({ ...jest.requireActual("../../es-workbooks/esWorkbookApi"), getEsWorkbook: jest.fn() }));
jest.mock("../../ms-workbooks/msWorkbookApi", () => ({ ...jest.requireActual("../../ms-workbooks/msWorkbookApi"), getMsWorkbook: jest.fn() }));
jest.mock("../../ri-workbooks/riWorkbookApi", () => ({ ...jest.requireActual("../../ri-workbooks/riWorkbookApi"), getRiWorkbook: jest.fn() }));

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
const ri = { uuid: "ri-analysis" } as unknown as RiskIntegration;
const sourceValues = { groups: [{ id: 1, name: "Cs-137" }], inventory: [{ name: "Cs-137", activityBq: 1e17, group: 1 }], releases: [{ id: 1, startSeconds: 0, durationSeconds: 7200, heightMetres: 10, fractions: [1e-4] }] };
const everything: RcLinkedData = { es: { workbookId: "es-1", analysis: es }, ms: { workbookId: "ms-1", analysis: ms }, ri: { workbookId: "ri-1", analysis: ri } };

function setup(rc: Partial<RadiologicalConsequenceAnalysis>, links: RcLinks, sourceTerms?: RcSourceTermActions) {
  const openDrawer = jest.fn();
  let latest = rc as RadiologicalConsequenceAnalysis;
  function Harness() {
    const [saved, setSaved] = useState(latest);
    const read = rcLinkedDataFor(saved, everything);
    const data = { rc: rcWithLinkedData(saved, read), cc: {}, nms: [] } as unknown as RcWorkbookData;
    return <RcWorkbookProvider data={data} editable links={links} linked={read} sourceTerms={sourceTerms} mutateRc={(mutator) => setSaved((previous) => {
      const before = rcLinkedDataFor(previous, everything);
      latest = rcSavedForm(mutator(rcWithLinkedData(previous, before)), before);
      return latest;
    })}>
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
  beforeEach(() => {
    jest.mocked(getEsWorkbook).mockResolvedValue({ mef: es } as Awaited<ReturnType<typeof getEsWorkbook>>);
    jest.mocked(getMsWorkbook).mockResolvedValue({ mef: ms } as Awaited<ReturnType<typeof getMsWorkbook>>);
    jest.mocked(getRiWorkbook).mockResolvedValue({ mef: ri } as Awaited<ReturnType<typeof getRiWorkbook>>);
  });

  it("links each upstream workbook through a source workbook select", async () => {
    const { current } = setup(baseRc(), { options });
    expect(screen.getByRole("button", { name: /ES Event Sequence Analysis/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Source workbook"), { target: { value: "es-1" } });
    await waitFor(() => expect(current().linkedWorkbooks).toEqual({ ES: "es-1" }));
    expect(screen.getByLabelText("Source workbook")).toHaveValue("es-1");
    fireEvent.click(screen.getByRole("button", { name: /RI Risk Integration/ }));
    expect(screen.getByLabelText("Source workbook")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Source workbook"), { target: { value: "ri-1" } });
    await waitFor(() => expect(current().linkedWorkbooks).toEqual({ ES: "es-1", RI: "ri-1" }));
  });

  it("asks once before a link replaces the release categories typed by hand", async () => {
    const typed = baseRc();
    typed.releaseCategoryToConsequence!.releaseCategoryInputs.push({ releaseCategory: "RC-9", releaseCharacteristics: {} });
    const { current } = setup(typed, { options });
    fireEvent.change(screen.getByLabelText("Source workbook"), { target: { value: "es-1" } });
    expect(await screen.findByText("Linking replaces the release categories entered here (RC-9).")).toBeInTheDocument();
    expect(current().linkedWorkbooks).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Link ES analysis" }));
    await waitFor(() => expect(current().linkedWorkbooks).toEqual({ ES: "es-1" }));
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs.map((category) => category.releaseCategory)).toEqual(["RC-1"]);
  });

  it("shows the linked family map with no import step and saves only a typed assignment with its reason", () => {
    const { current } = setup(baseRc({ linkedWorkbooks: { ES: "es-1" } }), { options, es });
    expect(screen.queryByRole("button", { name: /from ES/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Release category for ESF-EARLY")).toHaveValue("RC-1");
    expect(screen.getByLabelText("Release category for ESF-OK")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Bounding sequence for RC-1"), { target: { value: "S-2" } });
    fireEvent.change(screen.getByLabelText("Screening basis for RC-1"), { target: { value: "Largest release in the category." } });
    fireEvent.blur(screen.getByLabelText("Screening basis for RC-1"));
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs[0].boundingMember).toEqual({ sequenceId: "S-2", basis: "Largest release in the category." });
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs[0].eventSequenceFamilyReferences).toBeUndefined();
    expect(current().releaseCategoryToConsequence.familyMapOverrides).toBeUndefined();
    fireEvent.change(screen.getByLabelText("Release category for ESF-EARLY"), { target: { value: "" } });
    expect(current().releaseCategoryToConsequence.familyMapOverrides).toEqual([{ familyId: "ESF-EARLY" }]);
    fireEvent.change(screen.getByLabelText("Reason for ESF-EARLY"), { target: { value: "Screened out for this site." } });
    fireEvent.blur(screen.getByLabelText("Reason for ESF-EARLY"));
    expect(current().releaseCategoryToConsequence.familyMapOverrides).toEqual([{ familyId: "ESF-EARLY", reason: "Screened out for this site." }]);
    fireEvent.change(screen.getByLabelText("Release category for ESF-EARLY"), { target: { value: "RC-1" } });
    expect(current().releaseCategoryToConsequence.familyMapOverrides).toBeUndefined();
    expect(screen.queryByLabelText("Reason for ESF-EARLY")).not.toBeInTheDocument();
  });

  it("reads the category source term from the linked MS workbook with no import step", async () => {
    const typeOver = jest.fn(async () => ({ releaseCategory: "RC-1", releaseCharacteristics: {} }));
    const { current } = setup(baseRc({ linkedWorkbooks: { MS: "ms-1" } }), { options, ms }, { importFile: jest.fn(), saveValues: jest.fn(), typeOver, downloadOriginal: jest.fn() });
    fireEvent.click(screen.getByRole("button", { name: /MS Mechanistic Source Term/ }));
    expect(screen.queryByRole("button", { name: "Import from MS" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Source term from")).toHaveValue("ms");
    expect(screen.getByLabelText("MS source term")).toHaveValue("ST-1");
    expect(screen.getByRole("checkbox", { name: "SRC-1 · Core" })).toBeChecked();
    expect(screen.getByText("MS ST-1 · SRC-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save source data" })).not.toBeInTheDocument();
    expect(current().releaseCategoryToConsequence.releaseCategoryInputs[0].sourceTerm).toBeUndefined();
    fireEvent.change(screen.getByLabelText("Source term from"), { target: { value: "typed" } });
    await waitFor(() => expect(typeOver).toHaveBeenCalledWith("RC-1", sourceValues));
  });

  it("checks the RI measures against the consequence metrics", () => {
    const { current, openDrawer } = setup(baseRc({ linkedWorkbooks: { RI: "ri-1" } }), { options, ri, riMeasures: ["Individual dose at boundary", "Land contamination area"] });
    fireEvent.click(screen.getByRole("button", { name: /RI Risk Integration/ }));
    expect(screen.getByLabelText("Metric for Individual dose at boundary")).toHaveValue("RCM-01");
    expect(screen.getByLabelText("Metric for Land contamination area")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Add metric" }));
    expect(current().scope.metrics?.map((entry) => [entry.id, entry.name])).toEqual([["RCM-01", "Individual dose at boundary"], ["RCM-02", "Land contamination area"]]);
    expect(openDrawer).toHaveBeenCalledWith({ kind: "metric", id: "RCM-02" });
  });
});
