import {
  AnalysisReadyValidationOutcomeSchema,
  DraftValidationOutcomeSchema,
  ValidationIssueSchema,
} from "../../shared";
import type { FaultTreeModel } from "..";
import {
  validateFaultTreeBooleanGraph,
  validateFaultTreeAnalysisReady,
  validateFaultTreeDraft,
  validateFaultTreeGateInputs,
  validateFaultTreeIdentity,
  validateFaultTreeKOfN,
  validateFaultTreeModel,
  validateFaultTreeProbabilitiesAndTransfers,
  validateFaultTreeReachability,
  validateFaultTreeTransferCycles,
  validateFaultTreeTopGate,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174120";
const GATE_ID = "123e4567-e89b-42d3-a456-426614174121";
const LEAF_ID = "123e4567-e89b-42d3-a456-426614174122";
const MISSING_GATE_ID = "123e4567-e89b-42d3-a456-426614174123";
const OTHER_GATE_ID = "123e4567-e89b-42d3-a456-426614174124";
const INPUT_ID = "123e4567-e89b-42d3-a456-426614174125";
const POSITION_ID = "123e4567-e89b-42d3-a456-426614174126";
const BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174127";
const BASIC_EVENT_REFERENCE_ID = "123e4567-e89b-42d3-a456-426614174128";
const OTHER_BASIC_EVENT_REFERENCE_ID = "123e4567-e89b-42d3-a456-426614174129";
const OTHER_INPUT_ID = "123e4567-e89b-42d3-a456-426614174130";
const NOT_GATE_ID = "123e4567-e89b-42d3-a456-426614174131";
const THIRD_INPUT_ID = "123e4567-e89b-42d3-a456-426614174132";
const TARGET_MODEL_ID = "123e4567-e89b-42d3-a456-426614174133";
const TARGET_GATE_ID = "123e4567-e89b-42d3-a456-426614174134";
const TRANSFER_ID = "123e4567-e89b-42d3-a456-426614174135";
const OTHER_MODEL_ID = "123e4567-e89b-42d3-a456-426614174136";
const OTHER_TRANSFER_ID = "123e4567-e89b-42d3-a456-426614174137";
const THIRD_MODEL_ID = "123e4567-e89b-42d3-a456-426614174138";
const THIRD_GATE_ID = "123e4567-e89b-42d3-a456-426614174139";

const model: FaultTreeModel = {
  schemaVersion: "1.0.0",
  id: MODEL_ID,
  projectId: "project-mhtgr",
  methodType: "FAULT_TREE",
  code: "FT-RT",
  name: "Reactor trip failure",
  description: "Fault tree used to test analysis-ready validation.",
  revision: 1,
  createdBy: "analyst@example.com",
  createdAt: "2026-08-20T16:00:00.000Z",
  updatedBy: "analyst@example.com",
  updatedAt: "2026-08-20T16:00:00.000Z",
  topGate: { gateId: GATE_ID },
  gates: [
    {
      id: GATE_ID,
      code: "TOP",
      name: "Top gate",
      description: "Top event logic.",
      kind: "GATE",
      gateType: "OR",
    },
  ],
  leafNodes: [
    {
      id: LEAF_ID,
      code: "UE-1",
      name: "Undeveloped event",
      description: "Leaf event.",
      kind: "UNDEVELOPED_EVENT",
    },
  ],
  gateInputs: [{ id: INPUT_ID, gateId: GATE_ID, childId: LEAF_ID, order: 0 }],
  nodePositions: [],
  layout: {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "MANUAL",
    direction: "TOP_TO_BOTTOM",
  },
};

describe("fault-tree top-gate validation", () => {
  it("accepts exactly one top-gate reference that resolves to one gate", () => {
    expect(validateFaultTreeTopGate(model)).toEqual([]);
    expect(validateFaultTreeModel(model)).toEqual([]);
  });

  it("reports a missing top gate against the model topGate field", () => {
    expect(validateFaultTreeTopGate({ ...model, topGate: null })).toEqual([
      expect.objectContaining({
        code: "FT_TOP_GATE_REQUIRED",
        entityId: MODEL_ID,
        fieldPath: ["topGate"],
      }),
    ]);
  });

  it("reports a dangling top-gate reference", () => {
    expect(validateFaultTreeTopGate({ ...model, topGate: { gateId: MISSING_GATE_ID } })).toEqual([
      expect.objectContaining({
        code: "FT_TOP_GATE_NOT_FOUND",
        entityId: MISSING_GATE_ID,
        fieldPath: ["topGate", "gateId"],
      }),
    ]);
  });

  it("rejects a top-gate reference that resolves to a leaf", () => {
    expect(validateFaultTreeTopGate({ ...model, topGate: { gateId: LEAF_ID } })).toEqual([
      expect.objectContaining({
        code: "FT_TOP_GATE_MUST_REFERENCE_GATE",
        entityId: LEAF_ID,
        fieldPath: ["topGate", "gateId"],
      }),
    ]);
  });

  it("rejects a top-gate id that ambiguously resolves to duplicate gates", () => {
    expect(validateFaultTreeTopGate({ ...model, gates: [model.gates[0], model.gates[0]] })).toEqual([
      expect.objectContaining({
        code: "FT_TOP_GATE_AMBIGUOUS",
        entityId: GATE_ID,
        fieldPath: ["topGate", "gateId"],
      }),
    ]);
  });

  it.each([
    { ...model, topGate: null },
    { ...model, topGate: { gateId: MISSING_GATE_ID } },
    { ...model, topGate: { gateId: LEAF_ID } },
    { ...model, gates: [model.gates[0], model.gates[0]] },
  ])("emits addressable validation issues for invalid top-gate case %#", (candidate) => {
    for (const issue of validateFaultTreeTopGate(candidate)) {
      expect(ValidationIssueSchema.safeParse(issue).success).toBe(true);
    }
  });
});

describe("fault-tree identity validation", () => {
  const otherGate: FaultTreeModel["gates"][number] = {
    ...model.gates[0],
    id: OTHER_GATE_ID,
    code: "G-OTHER",
    name: "Other gate",
  };
  const input: FaultTreeModel["gateInputs"][number] = {
    id: INPUT_ID,
    gateId: GATE_ID,
    childId: LEAF_ID,
    order: 0,
  };
  const position: FaultTreeModel["nodePositions"][number] = {
    nodeId: POSITION_ID,
    position: { x: 10, y: 20 },
  };

  it("accepts unique node, code, input, and position identities", () => {
    expect(
      validateFaultTreeIdentity({
        ...model,
        gates: [...model.gates, otherGate],
        gateInputs: [input],
        nodePositions: [position],
      }),
    ).toEqual([]);
  });

  it("rejects a node id reused across the gate and leaf collections", () => {
    const issues = validateFaultTreeIdentity({
      ...model,
      leafNodes: [{ ...model.leafNodes[0], id: GATE_ID }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_DUPLICATE_NODE_ID",
        entityId: GATE_ID,
        fieldPath: ["leafNodes", 0, "id"],
      }),
    ]);
  });

  it("rejects case-insensitive duplicate analyst-facing codes", () => {
    const issues = validateFaultTreeIdentity({
      ...model,
      gates: [...model.gates, { ...otherGate, code: " top " }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_DUPLICATE_ENTITY_CODE",
        entityId: OTHER_GATE_ID,
        fieldPath: ["gates", 1, "code"],
      }),
    ]);
  });

  it("rejects duplicate gate-input ids", () => {
    const issues = validateFaultTreeIdentity({
      ...model,
      gateInputs: [input, { ...input, gateId: OTHER_GATE_ID }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_DUPLICATE_GATE_INPUT_ID",
        entityId: INPUT_ID,
        fieldPath: ["gateInputs", 1, "id"],
      }),
    ]);
  });

  it("rejects more than one saved position for a node", () => {
    const issues = validateFaultTreeIdentity({
      ...model,
      nodePositions: [position, { ...position, position: { x: 30, y: 40 } }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_DUPLICATE_NODE_POSITION",
        entityId: POSITION_ID,
        fieldPath: ["nodePositions", 1, "nodeId"],
      }),
    ]);
  });

  it("preserves intentional reuse of one catalogue basic event through unique references", () => {
    const sharedBasicEventReferences: FaultTreeModel["leafNodes"] = [
      { id: BASIC_EVENT_REFERENCE_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID },
      { id: OTHER_BASIC_EVENT_REFERENCE_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID },
    ];

    expect(validateFaultTreeIdentity({ ...model, leafNodes: sharedBasicEventReferences })).toEqual([]);
  });

  it("includes identity findings in aggregate FT validation as addressable issues", () => {
    const issues = validateFaultTreeModel({
      ...model,
      gates: [...model.gates, { ...otherGate, code: "TOP" }],
      gateInputs: [
        { id: INPUT_ID, gateId: GATE_ID, childId: OTHER_GATE_ID, order: 0 },
        { id: OTHER_INPUT_ID, gateId: OTHER_GATE_ID, childId: LEAF_ID, order: 0 },
      ],
    });

    expect(issues).toEqual([expect.objectContaining({ code: "FT_DUPLICATE_ENTITY_CODE" })]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("fault-tree gate-input validation", () => {
  const input: FaultTreeModel["gateInputs"][number] = {
    id: INPUT_ID,
    gateId: GATE_ID,
    childId: LEAF_ID,
    order: 0,
  };
  const otherGate: FaultTreeModel["gates"][number] = {
    ...model.gates[0],
    id: OTHER_GATE_ID,
    code: "G-OTHER",
  };
  const notGate: FaultTreeModel["gates"][number] = {
    ...model.gates[0],
    id: NOT_GATE_ID,
    code: "G-NOT",
    gateType: "NOT",
  };

  it("accepts resolved, uniquely ordered gate inputs and one child for a NOT gate", () => {
    expect(
      validateFaultTreeGateInputs({
        ...model,
        gates: [...model.gates, notGate],
        gateInputs: [input, { ...input, id: OTHER_INPUT_ID, gateId: NOT_GATE_ID }],
      }),
    ).toEqual([]);
  });

  it.each([
    {
      candidate: { ...input, gateId: MISSING_GATE_ID },
      code: "FT_GATE_INPUT_GATE_NOT_FOUND",
      field: "gateId",
    },
    {
      candidate: { ...input, childId: MISSING_GATE_ID },
      code: "FT_GATE_INPUT_CHILD_NOT_FOUND",
      field: "childId",
    },
  ])("reports a dangling $field reference", ({ candidate, code, field }) => {
    expect(validateFaultTreeGateInputs({ ...model, gateInputs: [candidate] })).toEqual([
      expect.objectContaining({ code, entityId: INPUT_ID, fieldPath: ["gateInputs", 0, field] }),
    ]);
  });

  it("reports ambiguous parent and child references", () => {
    const duplicateGate = { ...model.gates[0] };
    const issues = validateFaultTreeGateInputs({
      ...model,
      gates: [...model.gates, duplicateGate],
      leafNodes: [...model.leafNodes, { ...model.leafNodes[0], id: LEAF_ID }],
      gateInputs: [input],
    });

    expect(issues).toEqual([
      expect.objectContaining({ code: "FT_GATE_INPUT_GATE_AMBIGUOUS" }),
      expect.objectContaining({ code: "FT_GATE_INPUT_CHILD_AMBIGUOUS" }),
    ]);
  });

  it("rejects duplicate child references and duplicate order within a gate", () => {
    const issues = validateFaultTreeGateInputs({
      ...model,
      gateInputs: [input, { ...input, id: OTHER_INPUT_ID }],
    });

    expect(issues).toEqual([
      expect.objectContaining({ code: "FT_DUPLICATE_GATE_INPUT_ORDER", fieldPath: ["gateInputs", 1, "order"] }),
      expect.objectContaining({ code: "FT_DUPLICATE_GATE_INPUT_CHILD", fieldPath: ["gateInputs", 1, "childId"] }),
    ]);
  });

  it("requires input order to be contiguous from zero", () => {
    const issues = validateFaultTreeGateInputs({
      ...model,
      gates: [...model.gates, otherGate],
      gateInputs: [{ ...input, order: 1 }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_GATE_INPUT_ORDER_GAP",
        entityId: INPUT_ID,
        fieldPath: ["gateInputs", 0, "order"],
      }),
    ]);
  });

  it.each([0, 2])("rejects a NOT gate with %s children", (childCount) => {
    const notInputs = [
      { ...input, gateId: NOT_GATE_ID },
      { ...input, id: OTHER_INPUT_ID, gateId: NOT_GATE_ID, childId: GATE_ID, order: 1 },
    ].slice(0, childCount);
    const issues = validateFaultTreeGateInputs({
      ...model,
      gates: [...model.gates, notGate],
      gateInputs: notInputs,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "FT_NOT_GATE_CHILD_COUNT",
        entityId: NOT_GATE_ID,
        fieldPath: ["gates", 1, "gateType"],
      }),
    );
  });

  it("includes gate-input findings in aggregate validation as addressable issues", () => {
    const issues = validateFaultTreeModel({
      ...model,
      leafNodes: [],
      gateInputs: [{ ...input, childId: MISSING_GATE_ID }],
    });

    expect(issues).toEqual([expect.objectContaining({ code: "FT_GATE_INPUT_CHILD_NOT_FOUND" })]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("fault-tree K-of-N validation", () => {
  const kOfNGate: FaultTreeModel["gates"][number] = {
    ...model.gates[0],
    id: OTHER_GATE_ID,
    code: "G-K",
    gateType: "K_OF_N",
    k: 2,
  };
  const leafNodes: FaultTreeModel["leafNodes"] = [
    ...model.leafNodes,
    { id: BASIC_EVENT_REFERENCE_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID },
    { id: OTHER_BASIC_EVENT_REFERENCE_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID },
  ];
  const inputs: FaultTreeModel["gateInputs"] = [
    { id: INPUT_ID, gateId: OTHER_GATE_ID, childId: LEAF_ID, order: 0 },
    { id: OTHER_INPUT_ID, gateId: OTHER_GATE_ID, childId: BASIC_EVENT_REFERENCE_ID, order: 1 },
    { id: THIRD_INPUT_ID, gateId: OTHER_GATE_ID, childId: OTHER_BASIC_EVENT_REFERENCE_ID, order: 2 },
  ];

  it.each([1, 3])("accepts K=%s at a valid threshold boundary for three inputs", (k) => {
    expect(
      validateFaultTreeKOfN({
        ...model,
        gates: [...model.gates, { ...kOfNGate, k }],
        leafNodes,
        gateInputs: inputs,
      }),
    ).toEqual([]);
  });

  it("rejects K greater than the number of distinct inputs", () => {
    const issues = validateFaultTreeKOfN({
      ...model,
      gates: [...model.gates, { ...kOfNGate, k: 4 }],
      leafNodes,
      gateInputs: inputs,
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_K_OF_N_THRESHOLD_EXCEEDS_INPUTS",
        entityId: OTHER_GATE_ID,
        fieldPath: ["gates", 1, "k"],
      }),
    ]);
  });

  it("rejects a positive K when the voting gate has no inputs", () => {
    expect(validateFaultTreeKOfN({ ...model, gates: [...model.gates, { ...kOfNGate, k: 1 }] })).toEqual([
      expect.objectContaining({ code: "FT_K_OF_N_THRESHOLD_EXCEEDS_INPUTS" }),
    ]);
  });

  it("counts distinct children so duplicate input records cannot inflate N", () => {
    const duplicateChildInputs: FaultTreeModel["gateInputs"] = [
      inputs[0],
      { ...inputs[1], childId: LEAF_ID },
    ];

    expect(
      validateFaultTreeKOfN({
        ...model,
        gates: [...model.gates, kOfNGate],
        leafNodes,
        gateInputs: duplicateChildInputs,
      }),
    ).toEqual([expect.objectContaining({ code: "FT_K_OF_N_THRESHOLD_EXCEEDS_INPUTS" })]);
  });

  it("does not apply voting thresholds to non-K-of-N gates", () => {
    expect(validateFaultTreeKOfN(model)).toEqual([]);
  });

  it("includes K-of-N findings in aggregate validation as addressable issues", () => {
    const issues = validateFaultTreeModel({
      ...model,
      gates: [...model.gates, { ...kOfNGate, k: 1 }],
      leafNodes: [],
      gateInputs: [{ id: INPUT_ID, gateId: GATE_ID, childId: OTHER_GATE_ID, order: 0 }],
    });

    expect(issues).toEqual([expect.objectContaining({ code: "FT_K_OF_N_THRESHOLD_EXCEEDS_INPUTS" })]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("fault-tree Boolean graph validation", () => {
  const otherGate: FaultTreeModel["gates"][number] = {
    ...model.gates[0],
    id: OTHER_GATE_ID,
    code: "G-OTHER",
  };

  it("accepts an acyclic gate chain", () => {
    expect(
      validateFaultTreeBooleanGraph({
        ...model,
        gates: [...model.gates, otherGate],
        gateInputs: [
          { id: INPUT_ID, gateId: GATE_ID, childId: OTHER_GATE_ID, order: 0 },
          { id: OTHER_INPUT_ID, gateId: OTHER_GATE_ID, childId: LEAF_ID, order: 0 },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects a gate that directly references itself", () => {
    const issues = validateFaultTreeBooleanGraph({
      ...model,
      gateInputs: [{ id: INPUT_ID, gateId: GATE_ID, childId: GATE_ID, order: 0 }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_BOOLEAN_CYCLE",
        entityId: INPUT_ID,
        fieldPath: ["gateInputs", 0, "childId"],
      }),
    ]);
  });

  it("rejects a cycle spanning multiple gates", () => {
    const issues = validateFaultTreeBooleanGraph({
      ...model,
      gates: [...model.gates, otherGate],
      gateInputs: [
        { id: INPUT_ID, gateId: GATE_ID, childId: OTHER_GATE_ID, order: 0 },
        { id: OTHER_INPUT_ID, gateId: OTHER_GATE_ID, childId: GATE_ID, order: 0 },
      ],
    });

    expect(issues).toEqual([expect.objectContaining({ code: "FT_BOOLEAN_CYCLE", entityId: OTHER_INPUT_ID })]);
  });

  it("allows multiple parents to share a child gate in an acyclic DAG", () => {
    const thirdGate: FaultTreeModel["gates"][number] = {
      ...otherGate,
      id: NOT_GATE_ID,
      code: "G-SHARED",
    };
    expect(
      validateFaultTreeBooleanGraph({
        ...model,
        gates: [...model.gates, otherGate, thirdGate],
        gateInputs: [
          { id: INPUT_ID, gateId: GATE_ID, childId: NOT_GATE_ID, order: 0 },
          { id: OTHER_INPUT_ID, gateId: OTHER_GATE_ID, childId: NOT_GATE_ID, order: 0 },
        ],
      }),
    ).toEqual([]);
  });

  it("reports both a Boolean cycle and a dangling reference through aggregate validation", () => {
    const issues = validateFaultTreeModel({
      ...model,
      leafNodes: [],
      gateInputs: [
        { id: INPUT_ID, gateId: GATE_ID, childId: GATE_ID, order: 0 },
        { id: OTHER_INPUT_ID, gateId: GATE_ID, childId: MISSING_GATE_ID, order: 1 },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "FT_GATE_INPUT_CHILD_NOT_FOUND", entityId: OTHER_INPUT_ID }),
        expect.objectContaining({ code: "FT_BOOLEAN_CYCLE", entityId: INPUT_ID }),
      ]),
    );
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("fault-tree probability and transfer-target validation", () => {
  const basicEventReference: FaultTreeModel["leafNodes"][number] = {
    id: BASIC_EVENT_REFERENCE_ID,
    kind: "BASIC_EVENT_REFERENCE",
    basicEventId: BASIC_EVENT_ID,
  };
  const transferReference: FaultTreeModel["leafNodes"][number] = {
    id: TRANSFER_ID,
    code: "TR-1",
    name: "Transfer to support-system FT",
    description: "Cross-model transfer reference.",
    kind: "TRANSFER_REFERENCE",
    target: { modelId: TARGET_MODEL_ID, entityId: TARGET_GATE_ID },
  };
  const catalogue = {
    schemaVersion: "1.0.0" as const,
    projectId: model.projectId,
    revision: 1,
    createdBy: "analyst@example.com",
    createdAt: "2026-08-20T16:00:00.000Z",
    updatedBy: "analyst@example.com",
    updatedAt: "2026-08-20T16:00:00.000Z",
    basicEvents: [
      {
        id: BASIC_EVENT_ID,
        code: "BE-1",
        name: "Pump fails",
        description: "Shared catalogue event.",
        probability: { value: 0.01 },
      },
    ],
  };
  const context = {
    basicEventCatalogue: catalogue,
    availableTransferTargets: [{ modelId: TARGET_MODEL_ID, entityId: TARGET_GATE_ID }],
  };

  it.each([0, 0.25, 1])("accepts a resolved basic event with probability %s", (value) => {
    expect(
      validateFaultTreeProbabilitiesAndTransfers(
        { ...model, leafNodes: [basicEventReference] },
        {
          ...context,
          basicEventCatalogue: {
            ...catalogue,
            basicEvents: [{ ...catalogue.basicEvents[0], probability: { value } }],
          },
        },
      ),
    ).toEqual([]);
  });

  it("rejects a missing and an ambiguous basic-event catalogue target", () => {
    expect(
      validateFaultTreeProbabilitiesAndTransfers({ ...model, leafNodes: [basicEventReference] }),
    ).toEqual([expect.objectContaining({ code: "FT_BASIC_EVENT_NOT_FOUND" })]);
    expect(
      validateFaultTreeProbabilitiesAndTransfers(
        { ...model, leafNodes: [basicEventReference] },
        { basicEventCatalogue: { ...catalogue, basicEvents: [catalogue.basicEvents[0], catalogue.basicEvents[0]] } },
      ),
    ).toEqual([expect.objectContaining({ code: "FT_BASIC_EVENT_AMBIGUOUS" })]);
  });

  it("rejects a catalogue from another project", () => {
    expect(
      validateFaultTreeProbabilitiesAndTransfers(
        { ...model, leafNodes: [basicEventReference] },
        { basicEventCatalogue: { ...catalogue, projectId: "other-project" } },
      ),
    ).toEqual([expect.objectContaining({ code: "FT_BASIC_EVENT_CATALOGUE_PROJECT_MISMATCH" })]);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid resolved probability %s",
    (value) => {
      const issues = validateFaultTreeProbabilitiesAndTransfers(
        { ...model, leafNodes: [basicEventReference] },
        {
          basicEventCatalogue: {
            ...catalogue,
            basicEvents: [{ ...catalogue.basicEvents[0], probability: { value } }],
          },
        },
      );

      expect(issues).toEqual([
        expect.objectContaining({
          code: "FT_BASIC_EVENT_PROBABILITY_INVALID",
          entityId: BASIC_EVENT_ID,
          fieldPath: ["basicEvents", 0, "probability", "value"],
        }),
      ]);
    },
  );

  it("accepts exactly one available cross-model transfer target", () => {
    expect(
      validateFaultTreeProbabilitiesAndTransfers({ ...model, leafNodes: [transferReference] }, context),
    ).toEqual([]);
  });

  it("rejects missing and ambiguous transfer targets", () => {
    expect(
      validateFaultTreeProbabilitiesAndTransfers({ ...model, leafNodes: [transferReference] }),
    ).toEqual([expect.objectContaining({ code: "FT_TRANSFER_TARGET_NOT_FOUND" })]);
    expect(
      validateFaultTreeProbabilitiesAndTransfers(
        { ...model, leafNodes: [transferReference] },
        { availableTransferTargets: [transferReference.target, transferReference.target] },
      ),
    ).toEqual([expect.objectContaining({ code: "FT_TRANSFER_TARGET_AMBIGUOUS" })]);
  });

  it("includes resolved probability and transfer checks in aggregate validation", () => {
    const validModel = {
      ...model,
      leafNodes: [basicEventReference, transferReference],
      gateInputs: [
        { id: INPUT_ID, gateId: GATE_ID, childId: BASIC_EVENT_REFERENCE_ID, order: 0 },
        { id: OTHER_INPUT_ID, gateId: GATE_ID, childId: TRANSFER_ID, order: 1 },
      ],
    };
    expect(validateFaultTreeModel(validModel, context)).toEqual([]);

    const issues = validateFaultTreeModel(validModel);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "FT_BASIC_EVENT_NOT_FOUND" }),
        expect.objectContaining({ code: "FT_TRANSFER_TARGET_NOT_FOUND" }),
      ]),
    );
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("fault-tree transfer-cycle validation", () => {
  const transfer = (
    id: string,
    targetModelId: string,
    targetGateId: string,
  ): FaultTreeModel["leafNodes"][number] => ({
    id,
    code: `TR-${id.slice(-3)}`,
    name: "Transfer reference",
    description: "Cross-model dependency.",
    kind: "TRANSFER_REFERENCE",
    target: { modelId: targetModelId, entityId: targetGateId },
  });
  const otherModel: FaultTreeModel = {
    ...model,
    id: OTHER_MODEL_ID,
    code: "FT-OTHER",
    topGate: { gateId: OTHER_GATE_ID },
    gates: [{ ...model.gates[0], id: OTHER_GATE_ID, code: "TOP-OTHER" }],
    leafNodes: [],
  };
  const thirdModel: FaultTreeModel = {
    ...model,
    id: THIRD_MODEL_ID,
    code: "FT-THIRD",
    topGate: { gateId: THIRD_GATE_ID },
    gates: [{ ...model.gates[0], id: THIRD_GATE_ID, code: "TOP-THIRD" }],
    leafNodes: [],
  };

  it("accepts an acyclic transfer chain", () => {
    const source = { ...model, leafNodes: [transfer(TRANSFER_ID, OTHER_MODEL_ID, OTHER_GATE_ID)] };
    const middle = {
      ...otherModel,
      leafNodes: [transfer(OTHER_TRANSFER_ID, THIRD_MODEL_ID, THIRD_GATE_ID)],
    };

    expect(validateFaultTreeTransferCycles(source, { faultTreeModels: [middle, thirdModel] })).toEqual([]);
  });

  it("rejects a transfer back to the same fault tree", () => {
    const source = { ...model, leafNodes: [transfer(TRANSFER_ID, MODEL_ID, GATE_ID)] };
    expect(validateFaultTreeTransferCycles(source)).toEqual([
      expect.objectContaining({
        code: "FT_TRANSFER_CYCLE",
        entityId: TRANSFER_ID,
        fieldPath: ["leafNodes", 0, "target"],
      }),
    ]);
  });

  it("reports every transfer edge in a two-model cycle", () => {
    const source = { ...model, leafNodes: [transfer(TRANSFER_ID, OTHER_MODEL_ID, OTHER_GATE_ID)] };
    const target = {
      ...otherModel,
      leafNodes: [transfer(OTHER_TRANSFER_ID, MODEL_ID, GATE_ID)],
    };
    const issues = validateFaultTreeTransferCycles(source, { faultTreeModels: [target] });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "FT_TRANSFER_CYCLE", entityId: TRANSFER_ID }),
        expect.objectContaining({ code: "FT_TRANSFER_CYCLE", entityId: OTHER_TRANSFER_ID }),
      ]),
    );
    expect(issues).toHaveLength(2);
  });

  it("allows multiple models to share an acyclic transfer target", () => {
    const source = { ...model, leafNodes: [transfer(TRANSFER_ID, THIRD_MODEL_ID, THIRD_GATE_ID)] };
    const peer = {
      ...otherModel,
      leafNodes: [transfer(OTHER_TRANSFER_ID, THIRD_MODEL_ID, THIRD_GATE_ID)],
    };

    expect(validateFaultTreeTransferCycles(source, { faultTreeModels: [peer, thirdModel] })).toEqual([]);
  });

  it("ignores cycles outside the validated model's dependency closure", () => {
    const cyclicPeer = {
      ...otherModel,
      leafNodes: [transfer(OTHER_TRANSFER_ID, OTHER_MODEL_ID, OTHER_GATE_ID)],
    };

    expect(validateFaultTreeTransferCycles(model, { faultTreeModels: [cyclicPeer] })).toEqual([]);
  });

  it("includes transfer-cycle findings in aggregate validation as addressable issues", () => {
    const cyclicModel = {
      ...model,
      leafNodes: [transfer(TRANSFER_ID, MODEL_ID, GATE_ID)],
      gateInputs: [{ id: INPUT_ID, gateId: GATE_ID, childId: TRANSFER_ID, order: 0 }],
    };
    const issues = validateFaultTreeModel(cyclicModel, {
      availableTransferTargets: [{ modelId: MODEL_ID, entityId: GATE_ID }],
      faultTreeModels: [cyclicModel],
    });

    expect(issues).toEqual([expect.objectContaining({ code: "FT_TRANSFER_CYCLE" })]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("fault-tree reachability validation", () => {
  const otherGate: FaultTreeModel["gates"][number] = {
    ...model.gates[0],
    id: OTHER_GATE_ID,
    code: "G-OTHER",
  };
  const otherLeaf: FaultTreeModel["leafNodes"][number] = {
    ...model.leafNodes[0],
    id: OTHER_BASIC_EVENT_REFERENCE_ID,
    code: "UE-OTHER",
  };

  it("accepts gates and leaves connected below the top gate", () => {
    expect(
      validateFaultTreeReachability({
        ...model,
        gates: [...model.gates, otherGate],
        leafNodes: [...model.leafNodes, otherLeaf],
        gateInputs: [
          { id: INPUT_ID, gateId: GATE_ID, childId: OTHER_GATE_ID, order: 0 },
          { id: OTHER_INPUT_ID, gateId: OTHER_GATE_ID, childId: LEAF_ID, order: 0 },
          { id: THIRD_INPUT_ID, gateId: OTHER_GATE_ID, childId: OTHER_BASIC_EVENT_REFERENCE_ID, order: 1 },
        ],
      }),
    ).toEqual([]);
  });

  it("reports each disconnected gate and leaf", () => {
    const issues = validateFaultTreeReachability({
      ...model,
      gates: [...model.gates, otherGate],
      leafNodes: [...model.leafNodes, otherLeaf],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "FT_NODE_UNREACHABLE",
        entityId: OTHER_GATE_ID,
        fieldPath: ["gates", 1],
      }),
      expect.objectContaining({
        code: "FT_NODE_UNREACHABLE",
        entityId: OTHER_BASIC_EVENT_REFERENCE_ID,
        fieldPath: ["leafNodes", 1],
      }),
    ]);
  });

  it("terminates on a reachable Boolean cycle without mislabeling its nodes as disconnected", () => {
    expect(
      validateFaultTreeReachability({
        ...model,
        gates: [...model.gates, otherGate],
        gateInputs: [
          { id: INPUT_ID, gateId: GATE_ID, childId: OTHER_GATE_ID, order: 0 },
          { id: OTHER_INPUT_ID, gateId: OTHER_GATE_ID, childId: GATE_ID, order: 0 },
          { id: THIRD_INPUT_ID, gateId: OTHER_GATE_ID, childId: LEAF_ID, order: 1 },
        ],
      }),
    ).toEqual([]);
  });

  it.each([
    { ...model, topGate: null },
    { ...model, topGate: { gateId: MISSING_GATE_ID } },
    { ...model, gates: [model.gates[0], model.gates[0]] },
  ])("defers invalid top-gate case %# to top-gate validation", (candidate) => {
    expect(validateFaultTreeReachability(candidate)).toEqual([]);
  });

  it("includes unreachable nodes in aggregate validation as addressable issues", () => {
    const issues = validateFaultTreeModel({ ...model, gates: [...model.gates, otherGate] });

    expect(issues).toEqual([expect.objectContaining({ code: "FT_NODE_UNREACHABLE", entityId: OTHER_GATE_ID })]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("fault-tree validation policy integration", () => {
  const validatedAt = "2026-08-20T17:00:00.000Z";

  it("reports an incomplete FT but keeps its draft saveable", () => {
    const outcome = validateFaultTreeDraft({ ...model, topGate: null }, validatedAt);

    expect(outcome.saveAllowed).toBe(true);
    expect(outcome.validation).toMatchObject({
      modelId: MODEL_ID,
      revision: 1,
      mode: "DRAFT",
      valid: false,
      issues: [expect.objectContaining({ code: "FT_TOP_GATE_REQUIRED" })],
    });
    expect(DraftValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("blocks quantification for the same incomplete FT", () => {
    const outcome = validateFaultTreeAnalysisReady({ ...model, topGate: null }, validatedAt);

    expect(outcome.quantificationAllowed).toBe(false);
    expect(outcome.validation).toMatchObject({
      mode: "ANALYSIS_READY",
      valid: false,
      issues: [expect.objectContaining({ code: "FT_TOP_GATE_REQUIRED" })],
    });
    expect(AnalysisReadyValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("allows quantification for a clean, reachable FT", () => {
    const outcome = validateFaultTreeAnalysisReady(model, validatedAt);

    expect(outcome.quantificationAllowed).toBe(true);
    expect(outcome.validation.valid).toBe(true);
    expect(outcome.validation.issues).toEqual([]);
  });

  it("passes catalogue and model-index context through the complete rule set", () => {
    const basicEventReference: FaultTreeModel["leafNodes"][number] = {
      id: BASIC_EVENT_REFERENCE_ID,
      kind: "BASIC_EVENT_REFERENCE",
      basicEventId: BASIC_EVENT_ID,
    };
    const contextModel = {
      ...model,
      leafNodes: [basicEventReference],
      gateInputs: [{ id: INPUT_ID, gateId: GATE_ID, childId: BASIC_EVENT_REFERENCE_ID, order: 0 }],
    };
    const validContext = {
      basicEventCatalogue: {
        schemaVersion: "1.0.0" as const,
        projectId: model.projectId,
        revision: 1,
        createdBy: "analyst@example.com",
        createdAt: "2026-08-20T16:00:00.000Z",
        updatedBy: "analyst@example.com",
        updatedAt: "2026-08-20T16:00:00.000Z",
        basicEvents: [
          {
            id: BASIC_EVENT_ID,
            code: "BE-1",
            name: "Pump fails",
            description: "Shared catalogue event.",
            probability: { value: 0.01 },
          },
        ],
      },
    };

    expect(validateFaultTreeAnalysisReady(contextModel, validatedAt).quantificationAllowed).toBe(false);
    expect(validateFaultTreeAnalysisReady(contextModel, validatedAt, validContext).quantificationAllowed).toBe(true);
  });
});
