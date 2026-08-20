import { JSX } from "react";
import { GridIcon, ListIcon } from "../welcome/icons";
import type { ViewMode } from "./useViewMode";
import "./css/viewToggle.css";

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }): JSX.Element {
  return (
    <div className="ap__view" role="tablist" aria-label="View mode">
      <button
        type="button"
        role="tab"
        aria-selected={view === "grid"}
        className={`ap__view-btn${view === "grid" ? " ap__view-btn--active" : ""}`}
        onClick={() => { setView("grid"); }}
        aria-label="Grid view"
      >
        <GridIcon />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "list"}
        className={`ap__view-btn${view === "list" ? " ap__view-btn--active" : ""}`}
        onClick={() => { setView("list"); }}
        aria-label="List view"
      >
        <ListIcon />
      </button>
    </div>
  );
}

export { ViewToggle };
