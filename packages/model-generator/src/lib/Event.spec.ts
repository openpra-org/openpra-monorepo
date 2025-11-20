import { Event } from "./Event";

describe("Event", () => {
  let event: Event;

  beforeEach(() => {
    event = new Event("test");
  });

  test("isCommon should return false for a new event", () => {
    expect(event.isCommon()).toBe(false);
  });

  test("isOrphan should return true for a new event", () => {
    expect(event.isOrphan()).toBe(true);
  });

  test("numParents should return 0 for a new event", () => {
    expect(event.numParents()).toBe(0);
  });

  test("addParent should add a parent to the event", () => {
    const parent = new Event("parent");
    event.addParent(parent);
    expect(event.isOrphan()).toBe(false);
    expect(event.numParents()).toBe(1);
  });

  test("should not add duplicate parents", () => {
    const parent = new Event("parent");
    event.addParent(parent);
    expect(event.parents.length).toBe(1);
    
    // Adding the same parent again should be ignored
    event.addParent(parent);
    expect(event.parents.length).toBe(1);
  });
});
