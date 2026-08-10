import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { PlantResponseModelScreen } from "../seismicPraScreens";
import {
  SeismicPraWorkbookProvider,
  type SeismicPraVariant,
} from "../seismicPraWorkbookContext";

beforeAll(() => {
  if (globalThis.structuredClone === undefined) {
    globalThis.structuredClone = <T,>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;
  }
});

function renderPlantResponseModel(
  variant: SeismicPraVariant = "htgr",
): ReturnType<typeof createSeismicPraExample> {
  const mef = createSeismicPraExample(variant);
  render(
    <SeismicPraWorkbookProvider
      mef={mef}
      linkedInputs={null}
      editable
      mutate={jest.fn()}
    >
      <PlantResponseModelScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 09 plant-response model", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete analyst workflow for %s",
    (variant) => {
      const mef = renderPlantResponseModel(variant);
      const identification =
        mef.seismicPlantResponseAnalysis.initiatingEventIdentification;
      const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
      const mappings =
        mef.seismicPlantResponseAnalysis.quantification
          .eventSequenceFamilyQuantifications;

      for (const heading of [
        "Seismic initiating events",
        "Baseline model adaptation",
        "Seismic failure logic",
        "Retained secondary hazards",
        "Sequence outcome mapping",
      ]) {
        expect(screen.getByRole("heading", { name: heading }))
          .toBeInTheDocument();
      }

      expect(screen.queryByRole("heading", { name: "Screening criteria" }))
        .not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Fragility evaluations" }))
        .not.toBeInTheDocument();

      const expectedRows = [
        [
          "Initiating-event register",
          identification.directInitiators.length
            + identification.secondaryHazardInitiators.length,
        ],
        [
          "Multi-unit and radioactive-material-source dependencies",
          model.multiReactorModels.length,
        ],
        ["Retained baseline model contents", 8],
        ["Seismic logic additions", model.newSeismicLogic.length],
        ["Seismic mission times", model.missionTimeAssessments.length],
        ["Seismic basic events", model.inducedFailures.length],
        ["Contact-chatter treatment", model.contactChatterModels.length],
        ["Secondary-hazard plant models", model.retainedHazardModels.length],
        ["Event-sequence family mapping", mappings.length],
        ["Model reconciliation", model.peerReviewFindingResolutions.length],
      ] as const;

      for (const [caption, rowCount] of expectedRows) {
        const table = screen.getByRole("table", { name: caption });
        expect(within(table).getAllByRole("row")).toHaveLength(rowCount + 1);
        expect(table).toHaveStyle({ tableLayout: "fixed" });
      }
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "reconciles retained initiators, failures, baseline logic, and outcomes for %s",
    (variant) => {
      const mef = renderPlantResponseModel(variant);
      const spr = mef.seismicPlantResponseAnalysis;
      const identification = spr.initiatingEventIdentification;
      const model = spr.plantResponseModel;
      const mappings = spr.quantification.eventSequenceFamilyQuantifications;
      const equipmentRefs = new Set(
        spr.seismicEquipmentListDevelopment.equipment.map((item) => item.uuid),
      );
      const fragilityRefs = new Set(
        mef.seismicFragilityAnalysis.results.fragilityEvaluations
          .map((evaluation) => evaluation.uuid),
      );
      const retainedRefs = new Set(identification.retainedInitiatingEventRefs);
      const mappedInitiatorRefs = new Set(
        mappings.flatMap((mapping) => mapping.initiatingEventRefs),
      );
      const mappedSequenceRefs = new Set(
        mappings.flatMap((mapping) => mapping.eventSequenceRefs),
      );
      const allInitiators = [
        ...identification.directInitiators,
        ...identification.secondaryHazardInitiators,
      ];

      for (const initiator of allInitiators.filter((item) =>
        retainedRefs.has(item.uuid))) {
        expect(initiator.retained).toBe(true);
        expect(initiator.eventSequenceRefs.length).toBeGreaterThan(0);
        expect(mappedInitiatorRefs.has(initiator.uuid)).toBe(true);
        expect(initiator.eventSequenceRefs.every((reference) =>
          mappedSequenceRefs.has(reference))).toBe(true);
      }

      for (const initiator of allInitiators.filter((item) =>
        !item.retained)) {
        expect(initiator.screeningOrSubsumingBasis?.length)
          .toBeGreaterThan(40);
      }

      for (const failure of model.inducedFailures) {
        expect(equipmentRefs.has(failure.sscRef)).toBe(true);
        expect(fragilityRefs.has(failure.fragilityEvaluationRef)).toBe(true);
        expect(failure.systemsBasicEventRef.length).toBeGreaterThan(0);
        expect(failure.eventSequenceRefs.length).toBeGreaterThan(0);
        expect(failure.modelImplementation.length).toBeGreaterThan(80);
      }

      expect(model.nonSeismicFailureRefs.length).toBeGreaterThan(0);
      expect(model.unavailabilityRefs.length).toBeGreaterThan(0);
      expect(model.humanErrorRefs.length).toBeGreaterThan(0);
      expect(model.eventSequenceRefs.length).toBeGreaterThan(0);
      expect(model.systemsLogicModelRefs.length).toBeGreaterThan(0);
      expect(model.missionTimeAssessments.every((mission) =>
        mission.missionTimeValid)).toBe(true);
      expect(model.peerReviewFindingResolutions.every((finding) =>
        finding.resolutionStatus === "RESOLVED")).toBe(true);
      expect(mappings.every((mapping) =>
        mapping.initiatingEventRefs.length > 0
        && mapping.eventSequenceRefs.length > 0
        && (mapping.releaseCategoryRef?.length ?? 0) > 0)).toBe(true);
    },
  );

  it("uses reactor-specific initiating events and shared-effect models", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicPlantResponseAnalysis;
    const sfr = createSeismicPraExample("sfr")
      .seismicPlantResponseAnalysis;

    expect(htgr.initiatingEventIdentification.directInitiators.some((item) =>
      item.name.includes("module"))).toBe(true);
    expect(sfr.initiatingEventIdentification.directInitiators.some((item) =>
      item.name.includes("sodium"))).toBe(true);
    expect(htgr.plantResponseModel.multiReactorModels[0]?.applicable)
      .toBe(true);
    expect(htgr.plantResponseModel.multiReactorModels[0]?.reactorUnitRefs)
      .toHaveLength(4);
    expect(sfr.plantResponseModel.multiReactorModels[0]?.applicable)
      .toBe(false);
    expect(sfr.plantResponseModel.radioactiveMaterialSourceRefs)
      .toContain("SOURCE-SODIUM-ACTIVATION-PRODUCTS");
  });

  it("keeps explanations behind question-mark controls", async () => {
    const mef = renderPlantResponseModel();
    const initiator =
      mef.seismicPlantResponseAnalysis.initiatingEventIdentification
        .directInitiators[0]!;

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: "About Seismic initiating events",
    }));
    expect(screen.getByRole("note")).toHaveTextContent(
      "An initiating event is the first modeled event in a sequence",
    );
    expect(screen.getByRole("note")).toHaveTextContent("For example");

    expect(screen.queryByText(initiator.description)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: `Technical decision for ${initiator.name}`,
    }));
    expect(screen.getByText(new RegExp(initiator.description)))
      .toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps add actions with their technical tables", () => {
    renderPlantResponseModel();

    for (const [caption, action] of [
      ["Initiating-event register", "Add direct event"],
      [
        "Multi-unit and radioactive-material-source dependencies",
        "Add shared-effect model",
      ],
      ["Seismic logic additions", "Add logic change"],
      ["Seismic mission times", "Add mission time"],
      ["Seismic basic events", "Add seismic basic event"],
      ["Contact-chatter treatment", "Add chatter treatment"],
      ["Secondary-hazard plant models", "Add retained hazard"],
      ["Event-sequence family mapping", "Add outcome mapping"],
      ["Model reconciliation", "Add model finding"],
    ] as const) {
      const table = screen.getByRole("table", { name: caption });
      const captionRow = table.parentElement?.querySelector(
        ".stable__caption-row",
      );
      expect(captionRow).not.toBeNull();
      expect(within(captionRow as HTMLElement).getByRole("button", {
        name: action,
      })).toBeInTheDocument();
    }
  });

  it("opens identification and basic-event records in one flat editor", async () => {
    renderPlantResponseModel();

    await userEvent.click(screen.getByRole("button", {
      name: "Edit identification scope",
    }));
    const identificationDialog = screen.getByRole("dialog", {
      name: "Initiating-event identification",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(identificationDialog).getByLabelText("Systematic process"))
      .toBeInTheDocument();
    expect(within(identificationDialog).getByText(
      "Retained initiating event references",
    )).toBeInTheDocument();
    expect(identificationDialog.querySelector(".sstructured__navlist"))
      .toBeNull();
    await userEvent.click(within(identificationDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add seismic basic event",
    }));
    const failureDialog = screen.getByRole("dialog", {
      name: "New seismic basic event",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(failureDialog).getByLabelText(
      "Systems basic event reference",
    ))
      .toBeInTheDocument();
    expect(within(failureDialog).getByLabelText(
      "Fragility evaluation reference",
    ))
      .toBeInTheDocument();
    expect(within(failureDialog).getByText("Correlation group references"))
      .toBeInTheDocument();
    expect(failureDialog.querySelector(".sstructured__navlist")).toBeNull();
  });
});
