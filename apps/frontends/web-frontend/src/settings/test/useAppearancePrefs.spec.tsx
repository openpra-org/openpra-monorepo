import { act, renderHook } from "@testing-library/react";
import { useAppearancePrefs } from "../useAppearancePrefs";

describe("useAppearancePrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to sigFigs 4 / motion + contrast off", () => {
    const { result } = renderHook(() => useAppearancePrefs());
    expect(result.current.prefs.sigFigs).toBe(4);
    expect(result.current.prefs.reducedMotion).toBe(false);
    expect(result.current.prefs.highContrast).toBe(false);
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useAppearancePrefs());
    act(() => { result.current.setSigFigs(6); });
    act(() => { result.current.setReducedMotion(true); });
    const stored = JSON.parse(localStorage.getItem("openpra.appearance") ?? "{}");
    expect(stored.sigFigs).toBe(6);
    expect(stored.reducedMotion).toBe(true);
  });

  it("clamps sigFigs back to default when stored value is out of range", () => {
    localStorage.setItem("openpra.appearance", JSON.stringify({ sigFigs: 99 }));
    const { result } = renderHook(() => useAppearancePrefs());
    expect(result.current.prefs.sigFigs).toBe(4);
  });
});
