import type { FaultTreeEditorCatalogue, FaultTreeEditorModel } from "../faultTreeTypes";
import {
  OpenPsaExportError,
  OpenPsaImportError,
  exportOpenPsaFaultTree,
  importOpenPsaFaultTree,
  mergeOpenPsaImportCatalogue,
} from "../openPsa";

const uuid = (suffix: number): string =>
  `30000000-0000-4000-8000-${suffix.toString(16).padStart(12, "0")}`;

function roundTripFixture(): {
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
} {
  const model: FaultTreeEditorModel = {
    modelId: uuid(1),
    code: "FT_SPECIAL",
    name: "Loss of <cooling> & power",
    description: "Line one\nLine two & more",
    topGate: { gateId: uuid(2) },
    gates: [
      { id: uuid(2), kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" },
      { id: uuid(3), kind: "GATE", gateType: "AND", code: "AND", name: "And", description: "" },
      { id: uuid(4), kind: "GATE", gateType: "NOT", code: "NOT", name: "Not", description: "" },
      {
        id: uuid(5),
        kind: "GATE",
        gateType: "K_OF_N",
        k: 2,
        code: "VOTE",
        name: "Vote",
        description: "",
      },
    ],
    leafNodes: [
      { id: uuid(6), kind: "BASIC_EVENT_REFERENCE", basicEventId: uuid(10) },
      {
        id: uuid(7),
        kind: "HOUSE_EVENT",
        code: "HOUSE",
        name: "House",
        description: "Set for maintenance",
        state: true,
      },
      {
        id: uuid(8),
        kind: "UNDEVELOPED_EVENT",
        code: "UNDEV",
        name: "Undeveloped",
        description: "",
      },
      {
        id: uuid(9),
        kind: "TRANSFER_REFERENCE",
        code: "TRANSFER",
        name: "Transfer",
        description: "",
        target: { modelId: uuid(30), entityId: uuid(31) },
      },
    ],
    gateInputs: [
      { id: uuid(11), gateId: uuid(2), childId: uuid(3), order: 0 },
      { id: uuid(12), gateId: uuid(2), childId: uuid(4), order: 1 },
      { id: uuid(13), gateId: uuid(2), childId: uuid(5), order: 2 },
      { id: uuid(14), gateId: uuid(3), childId: uuid(6), order: 0 },
      { id: uuid(15), gateId: uuid(3), childId: uuid(7), order: 1 },
      { id: uuid(16), gateId: uuid(4), childId: uuid(6), order: 0 },
      { id: uuid(17), gateId: uuid(5), childId: uuid(6), order: 0 },
      { id: uuid(18), gateId: uuid(5), childId: uuid(8), order: 1 },
      { id: uuid(19), gateId: uuid(5), childId: uuid(9), order: 2 },
    ],
    nodePositions: [
      { nodeId: uuid(2), position: { x: 10, y: 20 } },
      { nodeId: uuid(6), position: { x: 30, y: 40 } },
    ],
    layout: {
      mode: "MANUAL",
      direction: "TOP_TO_BOTTOM",
      viewport: { x: 12, y: -7, zoom: 1.25 },
    },
  };
  const catalogue: FaultTreeEditorCatalogue = {
    basicEvents: [
      {
        id: uuid(10),
        code: "BE_PUMP",
        name: "Pump fails & jams",
        description: "A <shared> event",
        probability: {
          value: 0.01,
          controlledDataSource: {
            referenceType: "HUMAN_FAILURE_EVENT",
            workbookId: "hr-workbook",
            entityId: "hfe-pump",
            quantificationId: "hep-pump",
          },
        },
      },
    ],
    presentations: [
      {
        basicEventId: uuid(10),
        failureModeLabel: "Fail to run",
        failureModeShort: "FTR",
        commonCause: true,
        repairCredited: false,
      },
    ],
  };
  return { model, catalogue };
}

describe("OpenPSA fault-tree interchange", () => {
  it("exports standard Boolean operators and round-trips normalized editor data", () => {
    const fixture = roundTripFixture();
    const xml = exportOpenPsaFaultTree(fixture.model, fixture.catalogue);
    const imported = importOpenPsaFaultTree(xml);

    expect(xml).toContain("<opsa-mef>");
    expect(xml).toContain("<and>");
    expect(xml).toContain("<not>");
    expect(xml).toContain('<atleast min="2">');
    expect(xml).toContain("Loss of &lt;cooling&gt; &amp; power");
    expect(imported.model).toEqual(fixture.model);
    expect(imported.catalogue).toEqual(fixture.catalogue);
    expect(imported.warnings).toEqual([]);
  });

  it("imports a plain OpenPSA document without OpenPRA extensions", () => {
    const imported = importOpenPsaFaultTree(`<?xml version="1.0"?>
      <opsa-mef>
        <define-fault-tree name="FT1">
          <define-gate name="TOP">
            <or>
              <basic-event name="BE1"/>
              <house-event name="H1"/>
            </or>
          </define-gate>
          <define-basic-event name="BE1"><float value="0.125"/></define-basic-event>
          <define-house-event name="H1"><constant value="true"/></define-house-event>
        </define-fault-tree>
      </opsa-mef>`);

    expect(imported.model.code).toBe("FT1");
    expect(imported.model.topGate).toEqual({ gateId: imported.model.gates[0].id });
    expect(imported.model.gates[0].gateType).toBe("OR");
    expect(imported.model.gateInputs).toHaveLength(2);
    expect(imported.model.gateInputs.map(({ order }) => order)).toEqual([0, 1]);
    expect(imported.catalogue.basicEvents[0].probability.value).toBe(0.125);
    expect(imported.model.leafNodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "HOUSE_EVENT", state: true })]),
    );
  });

  it("can omit the lossless editor snapshot and import the standard subset", () => {
    const fixture = roundTripFixture();
    const xml = exportOpenPsaFaultTree(fixture.model, fixture.catalogue, {
      includeEditorSnapshot: false,
    });
    const imported = importOpenPsaFaultTree(xml);

    expect(xml).not.toContain("openpra.editor-snapshot");
    expect(xml).toContain('name="openpra.controlled-reference-type" value="HUMAN_FAILURE_EVENT"');
    expect(imported.model.gates.map(({ gateType }) => gateType)).toEqual([
      "OR",
      "AND",
      "NOT",
      "K_OF_N",
    ]);
    const sharedBasicReference = imported.model.leafNodes.find(
      (leaf) => leaf.kind === "BASIC_EVENT_REFERENCE",
    );
    expect(sharedBasicReference).toBeDefined();
    expect(
      imported.model.gateInputs.filter(({ childId }) => childId === sharedBasicReference?.id),
    ).toHaveLength(3);
    expect(imported.catalogue.basicEvents[0]?.probability.controlledDataSource).toEqual({
      referenceType: "HUMAN_FAILURE_EVENT",
      workbookId: "hr-workbook",
      entityId: "hfe-pump",
      quantificationId: "hep-pump",
    });
  });

  it("merges imported events without deleting catalogue entries owned by another tree", () => {
    const fixture = roundTripFixture();
    const otherTreeEvent = {
      id: uuid(40),
      code: "BE_OTHER_TREE",
      name: "Event referenced by another tree",
      description: "Must survive an import into this tree",
      probability: { value: 0.04 },
    };
    const current: FaultTreeEditorCatalogue = {
      ...fixture.catalogue,
      basicEvents: [...fixture.catalogue.basicEvents, otherTreeEvent],
    };
    const imported: FaultTreeEditorCatalogue = {
      basicEvents: [
        { ...fixture.catalogue.basicEvents[0], probability: { value: 0.25 } },
        {
          id: uuid(41),
          code: "BE_IMPORTED",
          name: "Imported event",
          description: "New to this workbook",
          probability: { value: 0.1 },
        },
      ],
    };

    const merged = mergeOpenPsaImportCatalogue(current, imported);

    expect(merged.basicEvents).toEqual([
      expect.objectContaining({ id: uuid(10), probability: { value: 0.25 } }),
      otherTreeEvent,
      expect.objectContaining({ id: uuid(41), code: "BE_IMPORTED" }),
    ]);
    expect(merged.presentations).toEqual(fixture.catalogue.presentations);
  });

  it("reports malformed XML and models OpenPSA cannot represent", () => {
    expect(() => importOpenPsaFaultTree("<opsa-mef><define-fault-tree>"))
      .toThrow(OpenPsaImportError);

    const fixture = roundTripFixture();
    fixture.model.gateInputs = fixture.model.gateInputs.filter(({ gateId }) => gateId !== uuid(4));
    expect(() => exportOpenPsaFaultTree(fixture.model, fixture.catalogue)).toThrow(
      OpenPsaExportError,
    );
  });
});
