/**
 *  EventType.test.ts
 * @remarks This file contains unit tests for the EventType.
 *  The tests use jest framework.
 */

import { EventType } from "./EventType";
import { IDType } from "./IDType";
import { LabelType } from "./LabelType";

describe("EventType", () => {
  it("should be an object type", () => {
    const event: EventType = {
      id: "testID",
      label: { name: "testName", description: "testDescription" },
    };
    expect(typeof event).toBe("object");
  });

  it("should have an id of IDType", () => {
    const id: IDType = "testID";
    const event: EventType = { id };
    expect(typeof event.id).toBe("string");
  });

  it("should have a label of LabelType", () => {
    const label: LabelType = {
      name: "testName",
      description: "testDescription",
    };
    const event: EventType = { label };
    expect(typeof event.label).toBe("object");
  });
});
