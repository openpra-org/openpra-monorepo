import { act, renderHook } from "@testing-library/react";
import { useAppearancePrefs } from "../useAppearancePrefs";

describe("useAppearancePrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to comfortable density / fontSize 15 / sigFigs 4", () => {
    const { result } = renderHook(() => useAppearancePrefs());
    expect(result.current.prefs.density).toBe("comfortable");
    expect(result.current.prefs.fontSize).toBe(15);
    expect(result.current.prefs.sigFigs).toBe(4);
    expect(result.current.prefs.reducedMotion).toBe(false);
    expect(result.current.prefs.highContrast).toBe(false);
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useAppearancePrefs());
    act(() => { result.current.setDensity("compact"); });
    act(() => { result.current.setFontSize(18); });
    act(() => { result.current.setReducedMotion(true); });
    const stored = JSON.parse(localStorage.getItem("openpra.appearance") ?? "{}");
    expect(stored.density).toBe("compact");
    expect(stored.fontSize).toBe(18);
    expect(stored.reducedMotion).toBe(true);
  });

  it("clamps fontSize back to default when stored value is out of range", () => {
    localStorage.setItem("openpra.appearance", JSON.stringify({ fontSize: 50 }));
    const { result } = renderHook(() => useAppearancePrefs());
    expect(result.current.prefs.fontSize).toBe(15);
  });
});
