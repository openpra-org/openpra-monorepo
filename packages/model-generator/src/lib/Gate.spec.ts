import { Gate } from "./Gate";
import { Event } from "./Event";

describe("Gate", () => {
  let gate: Gate;
  let event: Event;

  beforeEach(() => {
    gate = new Gate("G1", "and");
    event = new Event("E1");
  });

  test("constructor", () => {
    expect(gate.name).toBe("G1");
    expect(gate.operator).toBe("and");
    expect(gate.kNum).toBeFalsy();
    expect(gate.numArguments()).toBe(0);
  });

  test("add_argument", () => {
    gate.addArgument(event);
    expect(gate.numArguments()).toBe(1);
    expect(event.parents.includes(gate)).toBeTruthy();
  });

  test("get_ancestors", () => {
    const gate2 = new Gate("G2", "or");
    gate2.addArgument(gate);
    expect(gate.getAncestors().has(gate2)).toBeTruthy();
  });
});
