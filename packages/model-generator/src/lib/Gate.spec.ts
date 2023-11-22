import { Gate } from "./Gate";
import { Event } from "./Event";

describe("Gate", () => {
  let gate: Gate;
  let event: Event;

  beforeEach(() => {
    gate = new Gate("G1", "AND");
    event = new Event("E1");
  });

  test("constructor", () => {
    expect(gate.name).toBe("G1");
    expect(gate.operator).toBe("AND");
    expect(gate.kNum).toBeNull();
    expect(gate.numArguments()).toBe(0);
  });

  test("add_argument", () => {
    gate.addArgument(event);
    expect(gate.numArguments()).toBe(1);
    expect(event.parents.has(gate)).toBeTruthy();
  });

  test("get_ancestors", () => {
    const gate2 = new Gate("G2", "OR");
    gate2.addArgument(gate);
    expect(gate.getAncestors().has(gate2)).toBeTruthy();
  });
});
