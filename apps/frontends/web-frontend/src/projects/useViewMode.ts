import { useEffect, useState } from "react";

type ViewMode = "grid" | "list";

const VIEW_KEY = "openpra.projects.view";

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "grid" || v === "list") return v;
  } catch {
    return "grid";
  }
  return "grid";
}

function useViewMode(): [ViewMode, (next: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(readStoredView);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // storage unavailable — ignore
    }
  }, [view]);
  return [view, setView];
}

export { useViewMode };
export type { ViewMode };
