import { JSX } from "react";
import { SearchIcon } from "../welcome/icons";
import "./css/noResultsState.css";

function NoResultsState({ onClear }: { onClear: () => void }): JSX.Element {
  return (
    <div className="empty empty--results">
      <div className="empty__art empty__art--soft"><SearchIcon /></div>
      <h2 className="empty__title">No projects match those filters</h2>
      <p className="empty__sub">
        Try a different search term, change the risk mode filter, or clear all filters.
      </p>
      <button type="button" className="btn btn--ghost" onClick={onClear}>Clear filters</button>
    </div>
  );
}

export { NoResultsState };
