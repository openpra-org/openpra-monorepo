import { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon, PlusIcon } from "../welcome/icons";
import "./css/projectsHeader.css";

function ProjectsHeader({
  filteredCount,
  totalCount,
  hasFilters,
  onClearFilters,
  onNewProject,
  isEmpty,
}: {
  filteredCount: number;
  totalCount: number;
  hasFilters: boolean;
  onClearFilters: () => void;
  onNewProject: () => void;
  isEmpty: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const projectsWord = totalCount === 1 ? "project" : "projects";

  return (
    <div className="ap__head">
      <div className="ap__head-l">
        <button type="button" className="ap__back" onClick={() => { navigate("/"); }}>
          <ArrowLeftIcon /> Welcome
        </button>
        <h1 className="ap__title">All projects</h1>
        <p className="ap__sub">
          {isEmpty
            ? "No projects yet."
            : `${filteredCount} of ${totalCount} ${projectsWord}`}
          {!isEmpty && hasFilters && (
            <button type="button" className="btn btn--link ap__clear" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </p>
      </div>
      <div className="ap__head-r">
        <button type="button" className="btn btn--primary" onClick={onNewProject}>
          <PlusIcon /> New project
        </button>
      </div>
    </div>
  );
}

export { ProjectsHeader };
