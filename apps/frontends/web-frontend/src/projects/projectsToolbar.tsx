import { JSX } from "react";
import { type RiskMode, RISK_MODES } from "interfaces-shared-types";
import { CloseIcon, SearchIcon } from "../welcome/icons";
import { SortMenu, type SortKey } from "./sortMenu";
import { ViewToggle } from "./viewToggle";
import { ArchivedToggle } from "./archivedToggle";
import type { ViewMode } from "./useViewMode";
import "./css/projectsToolbar.css";

type ModeFilter = RiskMode | "all";

function ProjectsToolbar({
  query,
  setQuery,
  modeFilter,
  setModeFilter,
  sort,
  setSort,
  view,
  setView,
  showArchived,
  setShowArchived,
  archivedCount,
}: {
  query: string;
  setQuery: (q: string) => void;
  modeFilter: ModeFilter;
  setModeFilter: (m: ModeFilter) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  archivedCount: number;
}): JSX.Element {
  return (
    <div className="ap__toolbar">
      <div className="ap__search">
        <span className="ap__search-icon"><SearchIcon /></span>
        <input
          className="ap__search-input"
          type="text"
          placeholder="Search projects by name or risk mode…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          aria-label="Search projects"
        />
        {query && (
          <button
            type="button"
            className="ap__search-clear"
            onClick={() => { setQuery(""); }}
            aria-label="Clear search"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="ap__filters" role="tablist" aria-label="Filter by risk mode">
        <FilterChip active={modeFilter === "all"} onClick={() => { setModeFilter("all"); }}>
          All modes
        </FilterChip>
        {RISK_MODES.map((m) => (
          <FilterChip
            key={m.id}
            active={modeFilter === m.id}
            onClick={() => { setModeFilter(m.id); }}
          >
            {m.name}
          </FilterChip>
        ))}
      </div>

      <div className="ap__toolbar-r">
        <ArchivedToggle showArchived={showArchived} setShowArchived={setShowArchived} count={archivedCount} />
        <SortMenu sort={sort} setSort={setSort} />
        <ViewToggle view={view} setView={setView} />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`ap__chip${active ? " ap__chip--active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export { ProjectsToolbar };
export type { ModeFilter };
