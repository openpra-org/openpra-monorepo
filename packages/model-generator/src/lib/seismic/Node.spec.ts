import { Node } from "./Node";

describe("Node", () => {
  let node: Node;

  beforeEach(() => {
    node = new Node("AND", "A logical AND gate", "gate", "ANDGate");
  });

  test("Node should be initialized with correct properties", () => {
    expect(node.logicType).toBe("AND");
    expect(node.description).toBe("A logical AND gate");
    expect(node.nodeType).toBe("gate");
    expect(node.name).toBe("ANDGate");
    expect(node.children).toEqual([]);
    // Optional properties are undefined by default
    expect(node.failureModel).toBeUndefined();
    expect(node.library).toBeUndefined();
    expect(node.procedure).toBeUndefined();
    expect(node.id).toBeUndefined();
    expect(node.roomId).toBeUndefined();
    expect(node.correlationSet).toBeUndefined();
  });

  test("addChild should add a child node", () => {
    const childNode = new Node("BE", "A basic event", "event", "BasicEvent1");
    node.addChild(childNode);
    expect(node.children.length).toBe(1);
    expect(node.children[0]).toBe(childNode);
  });

  test("Node should support optional properties", () => {
    const nodeWithOptional = new Node(
      "OR",
      "A logical OR gate",
      "gate",
      "ORGate",
      "FailureModelX",
      "LibraryY",
      "ProcedureZ",
      "123",
      "Room1",
      new Set<number>([1, 2, 3]),
    );
    expect(nodeWithOptional.failureModel).toBe("FailureModelX");
    expect(nodeWithOptional.library).toBe("LibraryY");
    expect(nodeWithOptional.procedure).toBe("ProcedureZ");
    expect(nodeWithOptional.id).toBe("123");
    expect(nodeWithOptional.roomId).toBe("Room1");
    expect(nodeWithOptional.correlationSet).toEqual(new Set<number>([1, 2, 3]));
  });

  test("Node should be initialized from a JSON object with failure model", () => {
    const jsonObject = {
      "_id": { "$oid": "651a0157ff3b4433457db73d" },
      "room_id": { "$oid": "65026bcf7358e5227605e79b" },
      "failure_model": {
        "distribution_type": "SL",
        "beta_r_uncertainty": 0.2,
        "beta_u_uncertainty": 0.05,
        "pga": "",
        "median_seismic_acceleration": 2,
        "amplification": 1.2,
        "aging_model": {
          "type": "linear",
          "aging_rate": [-0.006, -0.002],
          "affected_parameters": ["median_seismic_acceleration", "beta_r_uncertainty"],
          "time": 15
        }
      },
      "description": "Fire Source 1",
      "name": "FR-SRC-1",
      "type": "SBE",
      "logic_type": "BE",
      "ssc_id": { "$oid": "656fee14026b2a847fc7a64c" },
      "elevation": 3.8,
      "correlation_set": 1
    };

    const node = new Node(
      jsonObject.logic_type,
      jsonObject.description,
      jsonObject.type,
      jsonObject.name,
      JSON.stringify(jsonObject.failure_model),
      undefined,
      undefined,
      jsonObject._id ? jsonObject._id.$oid : undefined,
      jsonObject.room_id ? jsonObject.room_id.$oid : undefined,
      jsonObject.correlation_set ? new Set([jsonObject.correlation_set]) : undefined,
    );

    expect(node.logicType).toBe("BE");
    expect(node.description).toBe("Fire Source 1");
    expect(node.nodeType).toBe("SBE");
    expect(node.name).toBe("FR-SRC-1");
    expect(node.failureModel).toEqual(JSON.stringify(jsonObject.failure_model));
    expect(node.children).toEqual([]);
    expect(node.library).toBeUndefined();
    expect(node.procedure).toBeUndefined();
    expect(node.id).toBe("651a0157ff3b4433457db73d");
    expect(node.roomId).toBe("65026bcf7358e5227605e79b");
    expect(node.correlationSet).toEqual(new Set([1])); // Fixed: Ensure Set is created with an array of values
  });
});


