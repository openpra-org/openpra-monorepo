import { act, renderHook } from "@testing-library/react";
import { useViewMode } from "../useViewMode";

describe("useViewMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'grid' when nothing is stored", () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current[0]).toBe("grid");
  });

  it("reads a previously stored view from localStorage", () => {
    localStorage.setItem("openpra.projects.view", "list");
    const { result } = renderHook(() => useViewMode());
    expect(result.current[0]).toBe("list");
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useViewMode());
    act(() => { result.current[1]("list"); });
    expect(localStorage.getItem("openpra.projects.view")).toBe("list");
  });

  it("ignores unrecognized stored values and falls back to 'grid'", () => {
    localStorage.setItem("openpra.projects.view", "carousel");
    const { result } = renderHook(() => useViewMode());
    expect(result.current[0]).toBe("grid");
  });
});
