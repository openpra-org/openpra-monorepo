import { HouseEvent } from "./HouseEvent";

describe("HouseEvent", () => {
  let houseEvent: HouseEvent;
  const testName = "HouseEvent1";
  const testState = "true";

  beforeEach(() => {
    houseEvent = new HouseEvent(testName, testState);
  });

  it("should correctly initialize with given name and state", () => {
    expect(houseEvent.name).toBe(testName);
    expect(houseEvent.state).toBe(testState);
  });

  it("should generate correct XML output", () => {
    const expectedXML = `<define-house-event name="${testName}"><constant value="${testState}"/></define-house-event>`;
    expect(houseEvent.toXML()).toBe(expectedXML);
  });

  it("should generate correct Aralia output", () => {
    const expectedAralia = `s(${testName}) = ${testState}`;
    expect(houseEvent.toAralia()).toBe(expectedAralia);
  });
});
