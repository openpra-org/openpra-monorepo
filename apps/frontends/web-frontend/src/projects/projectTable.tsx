import { JSX } from "react";
import { type Project } from "interfaces-shared-types";
import { ProjectRow } from "./projectRow";
import type { ProjectCardProps } from "./projectCard";
import "./css/projectTable.css";

type RowHandlers = Omit<ProjectCardProps, "project">;

function ProjectTable({
  projects,
  rowHandlers,
}: {
  projects: Project[];
  rowHandlers: (project: Project) => RowHandlers;
}): JSX.Element {
  return (
    <div className="ap__table" role="table">
      <div className="ap__tr ap__tr--head" role="row">
        <div className="ap__th ap__th--name" role="columnheader">Project</div>
        <div className="ap__th" role="columnheader">Risk mode</div>
        <div className="ap__th" role="columnheader">Progress</div>
        <div className="ap__th" role="columnheader">Collaborators</div>
        <div className="ap__th" role="columnheader">Last edited</div>
        <div className="ap__th ap__th--actions" role="columnheader" aria-label="Actions" />
      </div>
      {projects.map((p) => (
        <ProjectRow key={p.id} project={p} {...rowHandlers(p)} />
      ))}
    </div>
  );
}

export { ProjectTable };
