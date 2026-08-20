import { act, renderHook } from "@testing-library/react";
import { useTheme } from "../useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to 'auto' and writes data-theme=auto on mount", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBe("auto");
  });

  it("reads a previously stored theme from localStorage", () => {
    localStorage.setItem("openpra.theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists the new theme to localStorage and updates data-theme", () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current[1]("light"); });
    expect(localStorage.getItem("openpra.theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("falls back to 'auto' when stored value is unrecognized", () => {
    localStorage.setItem("openpra.theme", "nonsense");
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("auto");
  });
});
