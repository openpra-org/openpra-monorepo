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
});
